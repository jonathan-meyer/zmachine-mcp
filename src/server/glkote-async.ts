/**
 * AsyncGlkOte: a GlkOte implementation that captures Z-Machine I/O for
 * use with MCP tools and HTTP endpoints.
 *
 * ifvms runs the VM synchronously within each call to iface.accept().
 * That means:
 *   - After init(), pendingOutput has the initial game text and waitingForInput is true
 *   - After sendLine(text), pendingOutput has the turn's output and waitingForInput is true again
 *   - When the game exits, state becomes 'ended'
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface StatusLine {
  location: string;
  score: number;
  turns: number;
  isTime: boolean;
}

export type GameState = 'running' | 'waiting_input' | 'ended';

export class AsyncGlkOte {
  pendingOutput: string[] = [];
  statusLine: StatusLine = { location: '', score: 0, turns: 0, isTime: false };
  state: GameState = 'running';

  private generation = 0;
  private iface: any = null;
  private windows = new Map<number, any>();
  private bufferWindow: any = null;
  private gridWindow: any = null;
  private inputWindow: any = null;
  private inputType: 'line' | 'char' | null = null;

  // Called by the Glk API when it wants to initialize GlkOte
  init(iface: any): void {
    this.iface = iface;
    // Calling accept with 'init' starts the VM and runs until first glk_select()
    this.sendResponse('init', null, this.measureWindow());
    // At this point the VM has run to first input — state is 'waiting_input'
  }

  // Called by the Glk API with display updates (output, window changes, input requests)
  update(data: any): void {
    if (data.type === 'error') {
      this.state = 'ended';
      return;
    }
    if (data.type === 'exit') {
      this.state = 'ended';
      return;
    }
    if (data.type !== 'update') return;

    this.generation = data.gen;

    if (data.input != null) {
      this.cancelInputs(data.input);
    }
    if (data.windows != null) {
      this.updateWindows(data.windows);
    }
    if (data.content != null && data.content.length) {
      this.updateContent(data.content);
    }
    if (data.input != null) {
      this.updateInputs(data.input);
    }
  }

  // Send a line of text input. Returns the output produced by this turn.
  sendLine(text: string): string[] {
    if (this.state !== 'waiting_input' || this.inputType !== 'line') {
      return [];
    }
    const captured: string[] = [];
    // Capture output produced during this turn
    const prevOutput = this.pendingOutput;
    this.pendingOutput = captured;
    this.state = 'running';

    // Calling accept resumes the VM synchronously until next glk_select()
    this.sendResponse('line', this.inputWindow, text);

    // Restore and merge
    this.pendingOutput = [...prevOutput, ...captured];
    return captured;
  }

  // Send a single character input. Returns output produced by this turn.
  sendChar(char: string): string[] {
    if (this.state !== 'waiting_input' || this.inputType !== 'char') {
      return [];
    }
    const captured: string[] = [];
    const prevOutput = this.pendingOutput;
    this.pendingOutput = captured;
    this.state = 'running';

    this.sendResponse('char', this.inputWindow, char);

    this.pendingOutput = [...prevOutput, ...captured];
    return captured;
  }

  // Drain accumulated output
  drainOutput(): string[] {
    const out = [...this.pendingOutput];
    this.pendingOutput = [];
    return out;
  }

  log(msg: string): void {
    // Suppress VM logs — they go to stderr in debug mode
    if (process.env.DEBUG_ZMACHINE) {
      process.stderr.write(`[zvm] ${msg}\n`);
    }
  }

  error(msg: string): void {
    process.stderr.write(`[zvm error] ${msg}\n`);
    this.state = 'ended';
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private updateWindows(windows: any[]): void {
    for (const win of windows) {
      this.windows.set(win.id, win);
      if (win.type === 'buffer') this.bufferWindow = win;
      if (win.type === 'grid') this.gridWindow = win;
    }
  }

  private updateContent(contentArray: any[]): void {
    for (const winContent of contentArray) {
      const win = this.windows.get(winContent.id);
      if (!win) continue;

      if (win.type === 'buffer') {
        this.extractBufferText(winContent);
      } else if (win.type === 'grid') {
        this.extractStatusBar(winContent);
      }
    }
  }

  private extractBufferText(winContent: any): void {
    const lines: any[] = winContent.text ?? [];
    for (const line of lines) {
      if (!line.append) {
        // New paragraph line — push a newline unless this is the very start
        if (this.pendingOutput.length > 0) {
          this.pendingOutput.push('\n');
        }
      }
      const content: any[] = line.content ?? [];
      let lineText = '';
      for (let i = 0; i < content.length; i++) {
        const item = content[i];
        if (typeof item === 'string') {
          // ifvms alternates [style, text, style, text, ...]
          i++;
          const textItem = content[i];
          if (typeof textItem === 'string') {
            lineText += textItem;
          } else if (textItem && typeof textItem === 'object') {
            lineText += textItem.text ?? '';
          }
        } else if (item && typeof item === 'object') {
          lineText += item.text ?? '';
        }
      }
      if (lineText) {
        this.pendingOutput.push(lineText);
      }
    }
  }

  private extractStatusBar(winContent: any): void {
    // Grid window content for V3 games: first row is "  Location  Score: N  Turns: N  "
    const lines: any[] = winContent.text ?? [];
    if (!lines.length) return;
    const firstLine = lines[0];
    const content: any[] = firstLine.content ?? [];

    let rawText = '';
    for (let i = 0; i < content.length; i++) {
      const item = content[i];
      if (typeof item === 'string') {
        i++;
        const textItem = content[i];
        if (typeof textItem === 'string') rawText += textItem;
        else if (textItem && typeof textItem === 'object') rawText += textItem.text ?? '';
      } else if (item && typeof item === 'object') {
        rawText += item.text ?? '';
      }
    }

    if (rawText) {
      this.parseStatusLine(rawText.trim());
    }
  }

  private parseStatusLine(text: string): void {
    // V3 status: "West of House      Score: 10    Turns: 42"
    // or time:   "West of House      Time: 10:30"
    const timeMatch = text.match(/^(.*?)\s{2,}Time:\s*(\d+):(\d+)\s*$/i);
    if (timeMatch) {
      this.statusLine.location = timeMatch[1].trim();
      this.statusLine.score = parseInt(timeMatch[2], 10);
      this.statusLine.turns = parseInt(timeMatch[3], 10);
      this.statusLine.isTime = true;
      return;
    }
    const scoreMatch = text.match(/^(.*?)\s{2,}Score:\s*(-?\d+)\s+Turns:\s*(\d+)\s*$/i);
    if (scoreMatch) {
      this.statusLine.location = scoreMatch[1].trim();
      this.statusLine.score = parseInt(scoreMatch[2], 10);
      this.statusLine.turns = parseInt(scoreMatch[3], 10);
      this.statusLine.isTime = false;
      return;
    }
    // Fallback: just store whatever the grid says as location
    this.statusLine.location = text;
  }

  private cancelInputs(inputs: any[]): void {
    if (inputs.length === 0) {
      this.inputType = null;
      this.inputWindow = null;
    }
  }

  private updateInputs(inputs: any[]): void {
    if (!inputs.length) return;
    const input = inputs[0];
    this.inputType = input.type === 'char' ? 'char' : 'line';
    this.inputWindow = this.windows.get(input.id) ?? this.bufferWindow;
    this.state = 'waiting_input';
  }

  private sendResponse(type: string, win: any, val: any, val2?: any): void {
    const res: any = { type, gen: this.generation };
    if (win) res.window = win.id;
    if (type === 'init' || type === 'arrange') res.metrics = val;
    if (type === 'init') res.support = [];
    if (type === 'char') res.value = val;
    if (type === 'line') res.value = val;
    if (type === 'specialresponse') { res.response = val; res.value = val2; }
    this.iface.accept(res);
  }

  private measureWindow() {
    return {
      buffercharheight: 1, buffercharwidth: 1,
      buffermarginx: 0, buffermarginy: 0,
      graphicsmarginx: 0, graphicsmarginy: 0,
      gridcharheight: 1, gridcharwidth: 1,
      gridmarginx: 0, gridmarginy: 0,
      height: 50, width: 80,
      inspacingx: 0, inspacingy: 0,
      outspacingx: 0, outspacingy: 0,
    };
  }
}
