import Debug from 'debug';
import { Binary, Collection, Db, MongoClient } from 'mongodb';

const debug = Debug('zmachine:mongo');

export interface SessionDocument {
  _id: string;           // session UUID
  gameId: string;
  gameName: string;
  state: string;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface SaveDocument {
  _id: string;           // `${sessionId}:${filename}`
  sessionId: string;
  filename: string;
  data: Binary;
  savedAt: Date;
}

export class MongoSessionStore {
  private client: MongoClient;
  private db: Db;
  private sessions: Collection<SessionDocument>;
  private saves: Collection<SaveDocument>;

  constructor(client: MongoClient, dbName = 'zmachine') {
    this.client = client;
    this.db = client.db(dbName);
    this.sessions = this.db.collection<SessionDocument>('sessions');
    this.saves = this.db.collection<SaveDocument>('saves');
  }

  static async connect(uri: string, dbName?: string): Promise<MongoSessionStore> {
    const client = new MongoClient(uri);
    await client.connect();
    debug('connected to MongoDB');
    const store = new MongoSessionStore(client, dbName);
    await store.ensureIndexes();
    return store;
  }

  private async ensureIndexes(): Promise<void> {
    await this.sessions.createIndex({ gameId: 1 });
    await this.saves.createIndex({ sessionId: 1 });
  }

  async saveSession(session: {
    id: string;
    gameId: string;
    gameName: string;
    state: string;
  }): Promise<void> {
    const now = new Date();
    await this.sessions.updateOne(
      { _id: session.id },
      {
        $set: {
          gameId: session.gameId,
          gameName: session.gameName,
          state: session.state,
          lastActivityAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    debug('saved session %s', session.id);
  }

  async updateSessionState(sessionId: string, state: string): Promise<void> {
    await this.sessions.updateOne(
      { _id: sessionId },
      { $set: { state, lastActivityAt: new Date() } },
    );
  }

  async getSessionDoc(sessionId: string): Promise<SessionDocument | null> {
    return this.sessions.findOne({ _id: sessionId });
  }

  async listSessionDocs(): Promise<SessionDocument[]> {
    return this.sessions.find().toArray();
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessions.deleteOne({ _id: sessionId });
    await this.saves.deleteMany({ sessionId });
    debug('deleted session %s', sessionId);
  }

  async writeSave(sessionId: string, filename: string, data: Uint8Array): Promise<void> {
    const docId = `${sessionId}:${filename}`;
    await this.saves.updateOne(
      { _id: docId },
      {
        $set: {
          sessionId,
          filename,
          data: new Binary(Buffer.from(data)),
          savedAt: new Date(),
        },
      },
      { upsert: true },
    );
    debug('wrote save %s for session %s', filename, sessionId);
  }

  async readSave(sessionId: string, filename: string): Promise<Uint8Array | null> {
    const doc = await this.saves.findOne({ _id: `${sessionId}:${filename}` });
    if (!doc) return null;
    return new Uint8Array(doc.data.buffer);
  }

  async hasSave(sessionId: string, filename: string): Promise<boolean> {
    const count = await this.saves.countDocuments(
      { _id: `${sessionId}:${filename}` },
      { limit: 1 },
    );
    return count > 0;
  }

  async close(): Promise<void> {
    await this.client.close();
    debug('disconnected from MongoDB');
  }
}
