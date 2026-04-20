import { jest } from '@jest/globals';

// Mock the redis module before importing RedisSessionStore
const mockClient = {
  connect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  quit: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  hSet: jest.fn<() => Promise<number>>().mockResolvedValue(1),
  hGetAll: jest.fn<() => Promise<Record<string, string>>>().mockResolvedValue({}),
  sAdd: jest.fn<() => Promise<number>>().mockResolvedValue(1),
  sRem: jest.fn<() => Promise<number>>().mockResolvedValue(1),
  sMembers: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
  del: jest.fn<() => Promise<number>>().mockResolvedValue(1),
  set: jest.fn<() => Promise<string | null>>().mockResolvedValue('OK'),
  get: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
  exists: jest.fn<() => Promise<number>>().mockResolvedValue(0),
  keys: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),
};

jest.unstable_mockModule('redis', () => ({
  createClient: jest.fn(() => mockClient),
}));

const { RedisSessionStore } = await import('../server/redis-store.js');

describe('RedisSessionStore', () => {
  let store: InstanceType<typeof RedisSessionStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Construct directly with mock client to avoid connect() call
    store = new RedisSessionStore(mockClient as any);
  });

  describe('connect', () => {
    it('creates a client and connects', async () => {
      const s = await RedisSessionStore.connect('redis://localhost:6379');
      expect(mockClient.connect).toHaveBeenCalled();
      expect(s).toBeInstanceOf(RedisSessionStore);
    });

    it('sets TLS options for rediss:// URLs', async () => {
      const { createClient } = await import('redis');
      await RedisSessionStore.connect('rediss://host:6380');
      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'rediss://host:6380',
          socket: { tls: true, rejectUnauthorized: false },
        }),
      );
    });
  });

  describe('saveSession', () => {
    it('saves a new session with createdAt', async () => {
      mockClient.hGetAll.mockResolvedValueOnce({});
      await store.saveSession({
        id: 'sess-1',
        gameId: 'zork',
        gameName: 'Zork I',
        state: 'waiting_input',
      });
      expect(mockClient.hSet).toHaveBeenCalledWith(
        'session:sess-1',
        expect.objectContaining({
          gameId: 'zork',
          gameName: 'Zork I',
          state: 'waiting_input',
          createdAt: expect.any(String),
          lastActivityAt: expect.any(String),
        }),
      );
      expect(mockClient.sAdd).toHaveBeenCalledWith('sessions', 'sess-1');
    });

    it('skips createdAt if session already exists', async () => {
      mockClient.hGetAll.mockResolvedValueOnce({ createdAt: '2024-01-01T00:00:00Z' });
      await store.saveSession({
        id: 'sess-1',
        gameId: 'zork',
        gameName: 'Zork I',
        state: 'waiting_input',
      });
      const fields = (mockClient.hSet.mock.calls as any[][])[0][1] as Record<string, string>;
      expect(fields).not.toHaveProperty('createdAt');
    });
  });

  describe('updateSessionState', () => {
    it('updates state and lastActivityAt', async () => {
      await store.updateSessionState('sess-1', 'ended');
      expect(mockClient.hSet).toHaveBeenCalledWith(
        'session:sess-1',
        expect.objectContaining({ state: 'ended', lastActivityAt: expect.any(String) }),
      );
    });
  });

  describe('getSessionDoc', () => {
    it('returns a session document', async () => {
      mockClient.hGetAll.mockResolvedValueOnce({
        gameId: 'zork',
        gameName: 'Zork I',
        state: 'waiting_input',
        createdAt: '2024-01-01T00:00:00Z',
        lastActivityAt: '2024-01-01T00:01:00Z',
      });
      const doc = await store.getSessionDoc('sess-1');
      expect(doc).toEqual({
        _id: 'sess-1',
        gameId: 'zork',
        gameName: 'Zork I',
        state: 'waiting_input',
        createdAt: '2024-01-01T00:00:00Z',
        lastActivityAt: '2024-01-01T00:01:00Z',
      });
    });

    it('returns null for missing session', async () => {
      mockClient.hGetAll.mockResolvedValueOnce({});
      const doc = await store.getSessionDoc('nonexistent');
      expect(doc).toBeNull();
    });
  });

  describe('listSessionDocs', () => {
    it('returns all session documents', async () => {
      mockClient.sMembers.mockResolvedValueOnce(['sess-1', 'sess-2']);
      mockClient.hGetAll
        .mockResolvedValueOnce({
          gameId: 'zork', gameName: 'Zork I', state: 'waiting_input',
          createdAt: '2024-01-01T00:00:00Z', lastActivityAt: '2024-01-01T00:01:00Z',
        })
        .mockResolvedValueOnce({
          gameId: 'hitchhiker', gameName: "Hitchhiker's", state: 'ended',
          createdAt: '2024-01-01T00:02:00Z', lastActivityAt: '2024-01-01T00:03:00Z',
        });
      const docs = await store.listSessionDocs();
      expect(docs).toHaveLength(2);
      expect(docs[0]._id).toBe('sess-1');
      expect(docs[1]._id).toBe('sess-2');
    });

    it('skips sessions with missing data', async () => {
      mockClient.sMembers.mockResolvedValueOnce(['sess-1', 'ghost']);
      mockClient.hGetAll
        .mockResolvedValueOnce({
          gameId: 'zork', gameName: 'Zork I', state: 'waiting_input',
          createdAt: '2024-01-01T00:00:00Z', lastActivityAt: '2024-01-01T00:01:00Z',
        })
        .mockResolvedValueOnce({});
      const docs = await store.listSessionDocs();
      expect(docs).toHaveLength(1);
    });
  });

  describe('deleteSession', () => {
    it('removes session key, set member, and saves', async () => {
      mockClient.keys.mockResolvedValueOnce(['save:sess-1:file1', 'save:sess-1:file2']);
      await store.deleteSession('sess-1');
      expect(mockClient.del).toHaveBeenCalledWith('session:sess-1');
      expect(mockClient.sRem).toHaveBeenCalledWith('sessions', 'sess-1');
      expect(mockClient.del).toHaveBeenCalledWith(['save:sess-1:file1', 'save:sess-1:file2']);
    });

    it('skips save deletion when no saves exist', async () => {
      mockClient.keys.mockResolvedValueOnce([]);
      await store.deleteSession('sess-1');
      expect(mockClient.del).toHaveBeenCalledTimes(1); // only session key
    });
  });

  describe('writeSave / readSave / hasSave', () => {
    it('writes save data as base64', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      await store.writeSave('sess-1', 'save.dat', data);
      expect(mockClient.set).toHaveBeenCalledWith(
        'save:sess-1:save.dat',
        Buffer.from(data).toString('base64'),
      );
    });

    it('reads save data back from base64', async () => {
      const original = new Uint8Array([10, 20, 30]);
      mockClient.get.mockResolvedValueOnce(Buffer.from(original).toString('base64'));
      const result = await store.readSave('sess-1', 'save.dat');
      expect(result).toEqual(original);
    });

    it('returns null for missing save', async () => {
      mockClient.get.mockResolvedValueOnce(null);
      const result = await store.readSave('sess-1', 'missing.dat');
      expect(result).toBeNull();
    });

    it('hasSave returns true when key exists', async () => {
      mockClient.exists.mockResolvedValueOnce(1);
      expect(await store.hasSave('sess-1', 'save.dat')).toBe(true);
    });

    it('hasSave returns false when key missing', async () => {
      mockClient.exists.mockResolvedValueOnce(0);
      expect(await store.hasSave('sess-1', 'save.dat')).toBe(false);
    });
  });

  describe('close', () => {
    it('calls quit on the client', async () => {
      await store.close();
      expect(mockClient.quit).toHaveBeenCalled();
    });
  });
});
