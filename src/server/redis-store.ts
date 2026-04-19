import Debug from 'debug';
import { createClient, RedisClientType } from 'redis';

const debug = Debug('zmachine:redis');

export interface SessionDocument {
  _id: string;           // session UUID
  gameId: string;
  gameName: string;
  state: string;
  createdAt: string;
  lastActivityAt: string;
}

export class RedisSessionStore {
  private client: RedisClientType;

  constructor(client: RedisClientType) {
    this.client = client;
  }

  static async connect(url: string): Promise<RedisSessionStore> {
    const client = createClient({
      url,
      // Heroku Redis uses self-signed certs on rediss:// URLs
      ...(url.startsWith('rediss://') && {
        socket: { tls: true, rejectUnauthorized: false },
      }),
    }) as RedisClientType;
    await client.connect();
    debug('connected to Redis');
    return new RedisSessionStore(client);
  }

  private sessionKey(id: string): string {
    return `session:${id}`;
  }

  private saveKey(sessionId: string, filename: string): string {
    return `save:${sessionId}:${filename}`;
  }

  async saveSession(session: {
    id: string;
    gameId: string;
    gameName: string;
    state: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const key = this.sessionKey(session.id);
    const existing = await this.client.hGetAll(key);
    const fields: Record<string, string> = {
      gameId: session.gameId,
      gameName: session.gameName,
      state: session.state,
      lastActivityAt: now,
    };
    if (!existing.createdAt) {
      fields.createdAt = now;
    }
    await this.client.hSet(key, fields);
    await this.client.sAdd('sessions', session.id);
    debug('saved session %s', session.id);
  }

  async updateSessionState(sessionId: string, state: string): Promise<void> {
    await this.client.hSet(this.sessionKey(sessionId), {
      state,
      lastActivityAt: new Date().toISOString(),
    });
  }

  async getSessionDoc(sessionId: string): Promise<SessionDocument | null> {
    const data = await this.client.hGetAll(this.sessionKey(sessionId));
    if (!data.gameId) return null;
    return {
      _id: sessionId,
      gameId: data.gameId,
      gameName: data.gameName,
      state: data.state,
      createdAt: data.createdAt,
      lastActivityAt: data.lastActivityAt,
    };
  }

  async listSessionDocs(): Promise<SessionDocument[]> {
    const ids = await this.client.sMembers('sessions');
    const docs: SessionDocument[] = [];
    for (const id of ids) {
      const doc = await this.getSessionDoc(id);
      if (doc) docs.push(doc);
    }
    return docs;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.del(this.sessionKey(sessionId));
    await this.client.sRem('sessions', sessionId);
    // Delete all saves for this session
    const pattern = `save:${sessionId}:*`;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
    debug('deleted session %s', sessionId);
  }

  async writeSave(sessionId: string, filename: string, data: Uint8Array): Promise<void> {
    const key = this.saveKey(sessionId, filename);
    await this.client.set(key, Buffer.from(data));
    debug('wrote save %s for session %s', filename, sessionId);
  }

  async readSave(sessionId: string, filename: string): Promise<Uint8Array | null> {
    const data = await this.client.get(
      this.client.commandOptions({ returnBuffers: true }),
      this.saveKey(sessionId, filename),
    ) as Buffer | null;
    if (!data) return null;
    return new Uint8Array(data);
  }

  async hasSave(sessionId: string, filename: string): Promise<boolean> {
    const exists = await this.client.exists(this.saveKey(sessionId, filename));
    return exists === 1;
  }

  async close(): Promise<void> {
    await this.client.quit();
    debug('disconnected from Redis');
  }
}
