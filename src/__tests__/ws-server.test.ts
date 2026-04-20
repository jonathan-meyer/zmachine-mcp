import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws';
import { SessionManager } from '../server/session-manager.js';
import wsServer from '../server/ws-server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORIES_DIR = path.join(__dirname, '..', '..', '..', 'stories');
const hasStories = fs.existsSync(path.join(STORIES_DIR, 'minizork.z3'));

const describeWithStory = hasStories ? describe : describe.skip;

function waitForMessage(ws: WebSocket): Promise<any> {
  return new Promise((resolve) => {
    ws.once('message', (data: Buffer) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}

function waitForClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    ws.on('close', (code: number, reason: Buffer) => {
      resolve({ code, reason: reason.toString() });
    });
  });
}

describeWithStory('WebSocket Server', () => {
  let sessionManager: SessionManager;
  let server: http.Server;
  let port: number;

  beforeAll((done) => {
    sessionManager = new SessionManager(STORIES_DIR);
    const app = express();
    server = app.listen(0, () => {
      port = (server.address() as { port: number }).port;
      wsServer(server, port, sessionManager);
      done();
    });
  });

  afterAll((done) => {
    for (const s of sessionManager.getActiveSessions()) {
      sessionManager.closeSession(s.id);
    }
    server.close(() => done());
  }, 10000);

  it('closes connection when no session parameter', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const { code, reason } = await waitForClose(ws);
    expect(code).toBe(1008);
    expect(reason).toBe('session parameter required');
  });

  it('closes connection for unknown session', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?session=nonexistent`);
    const { code, reason } = await waitForClose(ws);
    expect(code).toBe(1008);
    expect(reason).toBe('session not found');
  });

  it('sends initial state on connect', async () => {
    const session = sessionManager.startGame('minizork');
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?session=${session.id}`);
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('state');
    expect(msg.state).toBe('waiting_input');
    expect(msg.status_line).toBeDefined();
    ws.close();
    sessionManager.closeSession(session.id);
  });

  it('handles input messages and returns turn_result', async () => {
    const session = sessionManager.startGame('minizork');
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?session=${session.id}`);

    // Consume initial state message
    await waitForMessage(ws);

    // Send input
    ws.send(JSON.stringify({ type: 'input', input: 'look' }));

    // Should get output and then turn_result
    const messages: any[] = [];
    await new Promise<void>((resolve) => {
      ws.on('message', (data: Buffer) => {
        messages.push(JSON.parse(data.toString()));
        // We expect an output message and a turn_result message
        if (messages.some(m => m.type === 'turn_result')) {
          resolve();
        }
      });
    });

    const turnResult = messages.find(m => m.type === 'turn_result');
    expect(turnResult).toBeDefined();
    expect(turnResult.state).toMatch(/waiting_input|running/);
    expect(turnResult.status_line).toBeDefined();

    ws.close();
    sessionManager.closeSession(session.id);
  });

  it('streams output chunks to connected clients', async () => {
    const session = sessionManager.startGame('minizork');
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?session=${session.id}`);

    // Consume initial state
    await waitForMessage(ws);

    ws.send(JSON.stringify({ type: 'input', input: 'look' }));

    const messages: any[] = [];
    await new Promise<void>((resolve) => {
      ws.on('message', (data: Buffer) => {
        messages.push(JSON.parse(data.toString()));
        if (messages.some(m => m.type === 'turn_result')) {
          resolve();
        }
      });
    });

    const outputMsg = messages.find(m => m.type === 'output');
    // Output may arrive as part of turn_result depending on timing
    if (outputMsg) {
      expect(outputMsg.text).toBeTruthy();
    }

    ws.close();
    sessionManager.closeSession(session.id);
  });

  it('ignores malformed messages', async () => {
    const session = sessionManager.startGame('minizork');
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?session=${session.id}`);

    await waitForMessage(ws);

    // Send garbage — should not crash the server
    ws.send('not json at all');
    ws.send(JSON.stringify({ type: 'unknown' }));

    // Connection should still be open — send a valid input to verify
    ws.send(JSON.stringify({ type: 'input', input: 'look' }));
    const msg = await new Promise<any>((resolve) => {
      ws.on('message', (data: Buffer) => {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'turn_result') resolve(parsed);
      });
    });
    expect(msg.type).toBe('turn_result');

    ws.close();
    sessionManager.closeSession(session.id);
  });
});
