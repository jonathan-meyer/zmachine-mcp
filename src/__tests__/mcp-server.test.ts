import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMcpServer } from '../server/mcp-server';
import { SessionManager } from '../server/session-manager';

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

  // Helper to call an MCP tool directly
  async function callTool(name: string, args: Record<string, unknown> = {}) {
    // Access the registered tool handlers from the McpServer internals
    // We test through the sessionManager instead for reliable testing
    return { name, args };
  }

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
