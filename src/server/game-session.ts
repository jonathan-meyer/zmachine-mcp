import { randomUUID } from 'crypto';
import { AsyncGlkOte, GameState, StatusLine } from './glkote-async.js';

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
const { ZVM } = require('ifvms');

/**
 * glkote-term's Glk API is an IIFE singleton — its internal `VM` and `GlkOte`
 * variables are module-level and overwritten on every Glk.init() call.
 * Loading a fresh module instance per session gives each session its own
 * isolated Glk closure, enabling multiple concurrent sessions.
 */
function createFreshGlk(): any {
  const resolved = require.resolve('glkote-term/src/glkapi.js');
  delete (require as any).cache[resolved];
  return require('glkote-term/src/glkapi.js');
}

export interface OutputChunk {
  text: string;
  type: 'output' | 'system';
}

export interface TurnResult {
  output: string;
  statusLine: StatusLine;
  state: GameState;
}

export class GameSession {
  readonly id: string;
  readonly gameName: string;
  readonly gameId: string;
  private glkote: AsyncGlkOte;
  private outputListeners: Array<(chunk: OutputChunk) => void> = [];
  private _initialOutput = '';

  constructor(gameId: string, gameName: string) {
    this.id = randomUUID();
    this.gameId = gameId;
    this.gameName = gameName;
    this.glkote = new AsyncGlkOte();
  }

  /**
   * Start the game. Runs the VM until it first waits for input.
   * Returns the initial output text.
   */
  /** The game's initial output text (from startup to first input prompt). */
  get initialOutput(): string {
    return this._initialOutput;
  }

  /**
   * Start the game. Runs the VM synchronously until it first waits for input.
   * Initial output is stored in this.initialOutput.
   */
  start(storyBuffer: Buffer): void {
    const vm = new ZVM();
    // Each session gets a fresh Glk instance to avoid singleton contamination
    const Glk = createFreshGlk();

    const options: any = {
      vm,
      Glk,
      GlkOte: this.glkote,
      Dialog: this.makeDialog(),
    };

    vm.prepare(storyBuffer, options);
    // Glk.init() → GlkOte.init() → accept('init') → VM.init()
    // The VM runs synchronously until the first glk_select() call
    Glk.init(options);

    this._initialOutput = this.joinOutput(this.glkote.drainOutput(), undefined);
    // Don't emitOutput here — no WebSocket listeners are attached at start time
  }

  /**
   * Send a line of text input. Runs VM synchronously until next input point.
   */
  sendInput(text: string): TurnResult {
    if (this.glkote.state !== 'waiting_input') {
      return {
        output: '',
        statusLine: { ...this.glkote.statusLine },
        state: this.glkote.state,
      };
    }

    const turnOutput = this.glkote.sendLine(text);
    const output = this.joinOutput(turnOutput, text);
    this.emitOutput(output);

    return {
      output,
      statusLine: { ...this.glkote.statusLine },
      state: this.glkote.state,
    };
  }

  get state(): GameState {
    return this.glkote.state;
  }

  get statusLine(): StatusLine {
    return { ...this.glkote.statusLine };
  }

  /**
   * Subscribe to real-time output chunks (for WebSocket streaming).
   */
  onOutput(listener: (chunk: OutputChunk) => void): () => void {
    this.outputListeners.push(listener);
    return () => {
      this.outputListeners = this.outputListeners.filter(l => l !== listener);
    };
  }

  quit(): void {
    // Nothing to explicitly stop in ifvms — sessions are just abandoned
    this.glkote.state = 'ended';
    this.emitOutput('', 'system');
  }

  private joinOutput(chunks: string[], stripEcho?: string): string {
    let text = chunks.join('');
    // Strip echoed input (first line matching the sent command)
    if (stripEcho) {
      const echoPrefix = stripEcho + '\n';
      if (text.startsWith(echoPrefix)) text = text.slice(echoPrefix.length);
    }
    // Strip trailing prompt (> with optional whitespace)
    text = text.replace(/\n>\s*$/, '').trimEnd();
    return text;
  }

  private emitOutput(text: string, type: OutputChunk['type'] = 'output'): void {
    if (!text && type === 'output') return;
    const chunk: OutputChunk = { text, type };
    for (const listener of this.outputListeners) {
      listener(chunk);
    }
  }

  private makeDialog(): any {
    // Simple in-memory save/restore dialog
    const saves = new Map<string, Uint8Array>();
    return {
      open(tosave: boolean, _usage: string, gameid: string, callback: (ref: any) => void) {
        const key = `${gameid}-save`;
        if (tosave) {
          callback({ filename: key, usage: 'data' });
        } else {
          callback(saves.has(key) ? { filename: key, usage: 'data' } : null);
        }
      },
      read(ref: any): Uint8Array | null {
        return saves.get(ref.filename) ?? null;
      },
      write(ref: any, buf: Uint8Array): void {
        saves.set(ref.filename, buf);
      },
    };
  }
}
