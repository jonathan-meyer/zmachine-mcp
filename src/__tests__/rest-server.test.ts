import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import restServer from '../server/rest-server.js';
import { SessionManager } from '../server/session-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORIES_DIR = path.join(__dirname, '..', '..', '..', 'stories');
const hasStories = fs.existsSync(path.join(STORIES_DIR, 'minizork.z3'));

const describeWithStory = hasStories ? describe : describe.skip;

async function request(
  server: http.Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const options = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode!, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode!, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describeWithStory('REST API', () => {
  let sessionManager: SessionManager;
  let app: express.Express;
  let server: http.Server;

  beforeAll((done) => {
    sessionManager = new SessionManager(STORIES_DIR);
    app = express();
    app.use(express.json());
    app.use(restServer(sessionManager));
    server = app.listen(0, done);
  });

  afterAll((done) => {
    for (const s of sessionManager.getActiveSessions()) {
      sessionManager.closeSession(s.id);
    }
    server.close(done);
  });

  describe('GET /api/games', () => {
    it('returns list of games', async () => {
      const res = await request(server, 'GET', '/api/games');
      expect(res.status).toBe(200);
      expect(res.body.games).toBeInstanceOf(Array);
      expect(res.body.games.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/sessions', () => {
    it('starts a game session', async () => {
      const res = await request(server, 'POST', '/api/sessions', {
        game_id: 'minizork',
      });
      expect(res.status).toBe(200);
      expect(res.body.session_id).toBeTruthy();
      expect(res.body.output).toBeTruthy();
      expect(res.body.state).toBe('waiting_input');
      // Clean up
      sessionManager.closeSession(res.body.session_id);
    });

    it('returns 400 without game_id', async () => {
      const res = await request(server, 'POST', '/api/sessions', {});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('game_id is required');
    });

    it('returns 404 for unknown game', async () => {
      const res = await request(server, 'POST', '/api/sessions', {
        game_id: 'nonexistent',
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('returns session info', async () => {
      const session = sessionManager.startGame('minizork');
      const res = await request(server, 'GET', `/api/sessions/${session.id}`);
      expect(res.status).toBe(200);
      expect(res.body.session_id).toBe(session.id);
      expect(res.body.game_id).toBe('minizork');
      sessionManager.closeSession(session.id);
    });

    it('returns 404 for unknown session', async () => {
      const res = await request(server, 'GET', '/api/sessions/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/sessions/:id/input', () => {
    it('sends input and returns result', async () => {
      const session = sessionManager.startGame('minizork');
      const res = await request(
        server,
        'POST',
        `/api/sessions/${session.id}/input`,
        { input: 'look' },
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('output');
      expect(res.body).toHaveProperty('state');
      expect(res.body).toHaveProperty('status_line');
      sessionManager.closeSession(session.id);
    });

    it('returns 404 for unknown session', async () => {
      const res = await request(
        server,
        'POST',
        '/api/sessions/nonexistent/input',
        { input: 'look' },
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 without input field', async () => {
      const session = sessionManager.startGame('minizork');
      const res = await request(
        server,
        'POST',
        `/api/sessions/${session.id}/input`,
        {},
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('input is required');
      sessionManager.closeSession(session.id);
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('deletes a session', async () => {
      const session = sessionManager.startGame('minizork');
      const res = await request(
        server,
        'DELETE',
        `/api/sessions/${session.id}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sessionManager.getSession(session.id)).toBeUndefined();
    });

    it('returns 404 for unknown session', async () => {
      const res = await request(
        server,
        'DELETE',
        '/api/sessions/nonexistent',
      );
      expect(res.status).toBe(404);
    });
  });
});
