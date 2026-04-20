import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../server/mcp-server.js';
import { SessionManager } from '../server/session-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORIES_DIR = path.join(__dirname, '..', '..', '..', 'stories');
const hasStories = fs.existsSync(path.join(STORIES_DIR, 'minizork.z3'));

const describeWithStory = hasStories ? describe : describe.skip;

describeWithStory('MCP Server Tools', () => {
  let sessionManager: SessionManager;
  let server: ReturnType<typeof createMcpServer>;

  beforeEach(() => {
    sessionManager = new SessionManager(STORIES_DIR);
    server = createMcpServer(sessionManager);
  });

  afterEach(() => {
    // Clean up any sessions
    for (const s of sessionManager.getActiveSessions()) {
      sessionManager.closeSession(s.id);
    }
  });

  describe('list_games (via SessionManager)', () => {
    it('returns available games', () => {
      const games = sessionManager.listGames();
      expect(games.length).toBeGreaterThan(0);
      expect(games.find(g => g.id === 'minizork')).toBeDefined();
    });
  });

  describe('start_game (via SessionManager)', () => {
    it('starts a game and returns session', () => {
      const session = sessionManager.startGame('minizork');
      expect(session.id).toBeTruthy();
      expect(session.initialOutput).toBeTruthy();
      expect(session.state).toBe('waiting_input');
    });

    it('throws for unknown game', () => {
      expect(() => sessionManager.startGame('nonexistent')).toThrow();
    });
  });

  describe('send_input (via GameSession)', () => {
    it('sends input and receives result', () => {
      const session = sessionManager.startGame('minizork');
      const result = session.sendInput('look');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('statusLine');
    });
  });

  describe('get_session_info (via SessionManager)', () => {
    it('retrieves session by id', () => {
      const session = sessionManager.startGame('minizork');
      const retrieved = sessionManager.getSession(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(session.id);
      expect(retrieved!.gameId).toBe('minizork');
    });

    it('returns undefined for missing session', () => {
      expect(sessionManager.getSession('nonexistent')).toBeUndefined();
    });
  });

  describe('quit_game (via SessionManager)', () => {
    it('closes session and removes it', () => {
      const session = sessionManager.startGame('minizork');
      sessionManager.closeSession(session.id);
      expect(sessionManager.getSession(session.id)).toBeUndefined();
      expect(session.state).toBe('ended');
    });
  });

  describe('createMcpServer', () => {
    it('creates an MCP server instance', () => {
      expect(server).toBeDefined();
    });
  });
});

describeWithStory('MCP Tool Handlers (via Client)', () => {
  let sessionManager: SessionManager;
  let client: Client;

  beforeEach(async () => {
    sessionManager = new SessionManager(STORIES_DIR);
    const mcpServer = createMcpServer(sessionManager);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await mcpServer.connect(serverTransport);
    client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(clientTransport);
  });

  afterEach(() => {
    for (const s of sessionManager.getActiveSessions()) {
      sessionManager.closeSession(s.id);
    }
  });

  it('list_games returns games', async () => {
    const result = await client.callTool({ name: 'list_games', arguments: {} });
    const text = (result.content as any)[0].text;
    const data = JSON.parse(text);
    expect(data.games.length).toBeGreaterThan(0);
    expect(data.games.find((g: any) => g.id === 'minizork')).toBeDefined();
  });

  it('start_game returns session with output', async () => {
    const result = await client.callTool({
      name: 'start_game',
      arguments: { game_id: 'minizork' },
    });
    const text = (result.content as any)[0].text;
    const data = JSON.parse(text);
    expect(data.session_id).toBeTruthy();
    expect(data).toHaveProperty('output');
    expect(data.state).toMatch(/waiting_input|running/);
  });

  it('start_game returns error for unknown game', async () => {
    const result = await client.callTool({
      name: 'start_game',
      arguments: { game_id: 'nonexistent' },
    });
    expect(result.isError).toBe(true);
  });

  it('send_input returns game response', async () => {
    const startResult = await client.callTool({
      name: 'start_game',
      arguments: { game_id: 'minizork' },
    });
    const { session_id } = JSON.parse((startResult.content as any)[0].text);

    const result = await client.callTool({
      name: 'send_input',
      arguments: { session_id, input: 'look' },
    });
    const data = JSON.parse((result.content as any)[0].text);
    expect(data).toHaveProperty('output');
    expect(data.state).toMatch(/waiting_input|running/);
  });

  it('send_input returns error for unknown session', async () => {
    const result = await client.callTool({
      name: 'send_input',
      arguments: { session_id: 'nonexistent', input: 'look' },
    });
    expect(result.isError).toBe(true);
  });

  it('send_input returns ended message for ended session', async () => {
    const startResult = await client.callTool({
      name: 'start_game',
      arguments: { game_id: 'minizork' },
    });
    const { session_id } = JSON.parse((startResult.content as any)[0].text);
    sessionManager.closeSession(session_id);

    // Re-add a mock ended session to test the "ended" branch
    const session = sessionManager.startGame('minizork');
    session.quit();
    const result = await client.callTool({
      name: 'send_input',
      arguments: { session_id: session.id, input: 'look' },
    });
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.output).toBe('(game has ended)');
    expect(data.state).toBe('ended');
  });

  it('get_session_info returns session details', async () => {
    const startResult = await client.callTool({
      name: 'start_game',
      arguments: { game_id: 'minizork' },
    });
    const { session_id } = JSON.parse((startResult.content as any)[0].text);

    const result = await client.callTool({
      name: 'get_session_info',
      arguments: { session_id },
    });
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.session_id).toBe(session_id);
    expect(data.game_id).toBe('minizork');
    expect(data.state).toMatch(/waiting_input|running/);
  });

  it('get_session_info returns error for unknown session', async () => {
    const result = await client.callTool({
      name: 'get_session_info',
      arguments: { session_id: 'nonexistent' },
    });
    expect(result.isError).toBe(true);
  });

  it('quit_game ends session', async () => {
    const startResult = await client.callTool({
      name: 'start_game',
      arguments: { game_id: 'minizork' },
    });
    const { session_id } = JSON.parse((startResult.content as any)[0].text);

    const result = await client.callTool({
      name: 'quit_game',
      arguments: { session_id },
    });
    const data = JSON.parse((result.content as any)[0].text);
    expect(data.success).toBe(true);
    expect(sessionManager.getSession(session_id)).toBeUndefined();
  });

  it('quit_game returns error for unknown session', async () => {
    const result = await client.callTool({
      name: 'quit_game',
      arguments: { session_id: 'nonexistent' },
    });
    expect(result.isError).toBe(true);
  });
});
