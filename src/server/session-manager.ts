import Debug from 'debug';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { GameSession } from './game-session.js';
import type { RedisSessionStore } from './redis-store.js';

const debug = Debug('zmachine:sessions');

export interface GameInfo {
  id: string;
  name: string;
  filename: string;
  version: number;
}

const STORY_EXTENSIONS = ['.z3', '.z4', '.z5', '.z7', '.z8', '.zblorb'];

function readVersion(filePath: string): number {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(1);
    fs.readSync(fd, buf, 0, 1, 0);
    fs.closeSync(fd);
    return buf[0];
  } catch {
    return 0;
  }
}

function nameFromFilename(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  return base.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export class SessionManager extends EventEmitter {
  private storiesFolder: string;
  private sessions = new Map<string, GameSession>();
  private store: RedisSessionStore | null;

  constructor(storiesFolder: string, store?: RedisSessionStore) {
    super();
    this.storiesFolder = storiesFolder;
    this.store = store ?? null;
  }

  listGames(): GameInfo[] {
    if (!fs.existsSync(this.storiesFolder)) {
      return [];
    }

    const files = fs.readdirSync(this.storiesFolder);
    const games: GameInfo[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!STORY_EXTENSIONS.includes(ext)) continue;

      const filePath = path.join(this.storiesFolder, file);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;
      } catch {
        continue;
      }

      const id = path.basename(file, ext).toLowerCase().replace(/\s+/g, '-');
      games.push({
        id,
        name: nameFromFilename(file),
        filename: file,
        version: readVersion(filePath),
      });
    }

    return games.sort((a, b) => a.name.localeCompare(b.name));
  }

  startGame(gameId: string): GameSession {
    const games = this.listGames();
    const game = games.find(g => g.id === gameId);
    if (!game) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const storyPath = path.join(this.storiesFolder, game.filename);
    const storyBuffer = fs.readFileSync(storyPath);

    const session = new GameSession(game.id, game.name, this.store ?? undefined);
    session.start(storyBuffer);
    this.sessions.set(session.id, session);
    debug("started session %s for game %s", session.id, game.id);
    if (this.store) {
      this.store.saveSession({
        id: session.id,
        gameId: session.gameId,
        gameName: session.gameName,
        state: session.state,
      }).catch(() => {});
    }
    this.emit('change');
    return session;
  }

  getSession(id: string): GameSession | undefined {
    return this.sessions.get(id);
  }

  closeSession(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.quit();
      this.sessions.delete(id);
      debug("closed session %s", id);
      if (this.store) {
        this.store.updateSessionState(id, 'ended').catch(() => {});
      }
      this.emit('change');
    }
  }

  getActiveSessions(): GameSession[] {
    return Array.from(this.sessions.values());
  }
}
