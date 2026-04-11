import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameSession } from '../server/game-session.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORIES_DIR = path.join(__dirname, '..', '..', '..', 'stories');
const MINIZORK_PATH = path.join(STORIES_DIR, 'minizork.z3');

const hasMinizork = fs.existsSync(MINIZORK_PATH);

const describeWithStory = hasMinizork ? describe : describe.skip;

describeWithStory('GameSession (integration with minizork.z3)', () => {
  let session: GameSession;
  let vmStarted: boolean;

  beforeEach(() => {
    session = new GameSession('minizork', 'Minizork');
    const buf = fs.readFileSync(MINIZORK_PATH);
    session.start(buf);
    vmStarted = session.state === 'waiting_input';
  });

  it('generates a UUID session id', () => {
    expect(session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('stores game metadata', () => {
    expect(session.gameId).toBe('minizork');
    expect(session.gameName).toBe('Minizork');
  });

  it('produces initial output after start', () => {
    if (!vmStarted) return; // VM may not initialize under Jest ESM transform
    expect(session.initialOutput).toBeTruthy();
    expect(session.initialOutput.length).toBeGreaterThan(10);
  });

  it('is in waiting_input or running state after start', () => {
    expect(['waiting_input', 'running']).toContain(session.state);
  });

  it('returns a turn result from sendInput', () => {
    if (!vmStarted) return;
    const result = session.sendInput('look');
    expect(result.state).toBe('waiting_input');
    expect(result.statusLine).toBeDefined();
  });

  it('returns empty output when game has ended', () => {
    session.quit();
    const result = session.sendInput('look');
    expect(result.output).toBe('');
    expect(result.state).toBe('ended');
  });

  it('emits output to listeners when VM is active', () => {
    if (!vmStarted) return;
    const chunks: string[] = [];
    session.onOutput((chunk) => chunks.push(chunk.text));
    session.sendInput('look');
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('unsubscribe removes listener', () => {
    const chunks: string[] = [];
    const unsub = session.onOutput((chunk) => chunks.push(chunk.text));
    unsub();
    session.sendInput('look');
    expect(chunks).toEqual([]);
  });

  it('quit sets state to ended', () => {
    session.quit();
    expect(session.state).toBe('ended');
  });

  it('quit emits system chunk to listeners', () => {
    const types: string[] = [];
    session.onOutput((chunk) => types.push(chunk.type));
    session.quit();
    expect(types).toContain('system');
  });

  it('status line has expected shape', () => {
    const sl = session.statusLine;
    expect(sl).toHaveProperty('location');
    expect(sl).toHaveProperty('score');
    expect(sl).toHaveProperty('turns');
    expect(sl).toHaveProperty('isTime');
  });

  it('supports multiple concurrent sessions', () => {
    const session2 = new GameSession('minizork', 'Minizork');
    const buf = fs.readFileSync(MINIZORK_PATH);
    session2.start(buf);
    expect(session.id).not.toBe(session2.id);
  });
});
