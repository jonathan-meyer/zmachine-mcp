import fs from 'fs';
import os from 'os';
import path from 'path';
import { SessionManager } from '../server/session-manager';

describe('SessionManager', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zmachine-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('listGames()', () => {
    it('returns empty array for nonexistent folder', () => {
      const mgr = new SessionManager('/nonexistent/path/that/will/not/exist');
      expect(mgr.listGames()).toEqual([]);
    });

    it('returns empty array for empty folder', () => {
      const mgr = new SessionManager(tmpDir);
      expect(mgr.listGames()).toEqual([]);
    });

    it('finds .z3 files', () => {
      fs.writeFileSync(path.join(tmpDir, 'mygame.z3'), Buffer.from([3]));
      const mgr = new SessionManager(tmpDir);
      const games = mgr.listGames();
      expect(games).toHaveLength(1);
      expect(games[0]).toEqual({
        id: 'mygame',
        name: 'Mygame',
        filename: 'mygame.z3',
        version: 3,
      });
    });

    it('finds .z5 and .z8 files', () => {
      fs.writeFileSync(path.join(tmpDir, 'game5.z5'), Buffer.from([5]));
      fs.writeFileSync(path.join(tmpDir, 'game8.z8'), Buffer.from([8]));
      const mgr = new SessionManager(tmpDir);
      const games = mgr.listGames();
      expect(games).toHaveLength(2);
      expect(games.map(g => g.id)).toEqual(expect.arrayContaining(['game5', 'game8']));
    });

    it('finds .zblorb files', () => {
      fs.writeFileSync(path.join(tmpDir, 'story.zblorb'), Buffer.from([5]));
      const mgr = new SessionManager(tmpDir);
      const games = mgr.listGames();
      expect(games).toHaveLength(1);
      expect(games[0].id).toBe('story');
    });

    it('ignores non-story files', () => {
      fs.writeFileSync(path.join(tmpDir, 'readme.txt'), 'hello');
      fs.writeFileSync(path.join(tmpDir, 'game.z3'), Buffer.from([3]));
      const mgr = new SessionManager(tmpDir);
      expect(mgr.listGames()).toHaveLength(1);
    });

    it('ignores directories with story extensions', () => {
      fs.mkdirSync(path.join(tmpDir, 'folder.z3'));
      const mgr = new SessionManager(tmpDir);
      expect(mgr.listGames()).toEqual([]);
    });

    it('returns games sorted by name', () => {
      fs.writeFileSync(path.join(tmpDir, 'zork.z3'), Buffer.from([3]));
      fs.writeFileSync(path.join(tmpDir, 'advent.z5'), Buffer.from([5]));
      const mgr = new SessionManager(tmpDir);
      const games = mgr.listGames();
      expect(games[0].id).toBe('advent');
      expect(games[1].id).toBe('zork');
    });

    it('derives game ID from filename (lowercase, hyphens)', () => {
      fs.writeFileSync(path.join(tmpDir, 'My Game.z3'), Buffer.from([3]));
      const mgr = new SessionManager(tmpDir);
      const games = mgr.listGames();
      expect(games[0].id).toBe('my-game');
    });

    it('derives display name from filename', () => {
      fs.writeFileSync(path.join(tmpDir, 'lost-pig.z8'), Buffer.from([8]));
      const mgr = new SessionManager(tmpDir);
      const games = mgr.listGames();
      expect(games[0].name).toBe('Lost Pig');
    });

    it('reads Z-Machine version from first byte', () => {
      fs.writeFileSync(path.join(tmpDir, 'v5.z5'), Buffer.from([5, 0, 0]));
      const mgr = new SessionManager(tmpDir);
      const games = mgr.listGames();
      expect(games[0].version).toBe(5);
    });
  });

  describe('startGame()', () => {
    it('throws for unknown game id', () => {
      const mgr = new SessionManager(tmpDir);
      expect(() => mgr.startGame('nonexistent')).toThrow('Game not found: nonexistent');
    });
  });

  describe('session management', () => {
    it('getSession returns undefined for unknown id', () => {
      const mgr = new SessionManager(tmpDir);
      expect(mgr.getSession('unknown')).toBeUndefined();
    });

    it('closeSession is safe for unknown id', () => {
      const mgr = new SessionManager(tmpDir);
      expect(() => mgr.closeSession('unknown')).not.toThrow();
    });

    it('getActiveSessions returns empty initially', () => {
      const mgr = new SessionManager(tmpDir);
      expect(mgr.getActiveSessions()).toEqual([]);
    });
  });
});
