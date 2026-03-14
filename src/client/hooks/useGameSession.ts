import { useEffect, useRef, useState, useCallback } from 'react';

export interface StatusLine {
  location: string;
  score: number;
  turns: number;
  isTime: boolean;
}

export interface OutputLine {
  id: number;
  text: string;
  isEcho?: boolean;
}

type GameState = 'running' | 'waiting_input' | 'ended';

let lineIdCounter = 0;

export function useGameSession(sessionId: string, initialOutput = '') {
  const [outputLines, setOutputLines] = useState<OutputLine[]>(() =>
    initialOutput
      ? initialOutput.split('\n').filter(Boolean).map(t => ({ id: lineIdCounter++, text: t }))
      : [],
  );
  const [statusLine, setStatusLine] = useState<StatusLine>({ location: '', score: 0, turns: 0, isTime: false });
  const [state, setState] = useState<GameState>('waiting_input');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws?session=${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          text?: string;
          state?: GameState;
          status_line?: StatusLine;
          output?: string;
        };

        if (msg.type === 'state' && msg.state) {
          setState(msg.state);
          if (msg.status_line) setStatusLine(msg.status_line);
        } else if (msg.type === 'output' && msg.text) {
          appendLines(msg.text);
        } else if (msg.type === 'turn_result') {
          if (msg.output) appendLines(msg.output);
          if (msg.status_line) setStatusLine(msg.status_line);
          if (msg.state) setState(msg.state);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  const sendInput = useCallback(async (input: string) => {
    // Echo the input
    setOutputLines(prev => [...prev, { id: lineIdCounter++, text: `> ${input}`, isEcho: true }]);

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', input }));
    }
  }, [sessionId]);

  function appendLines(text: string) {
    if (!text) return;
    // Split on newlines, keeping them as separate entries so we can render them
    const segments = text.split(/\n/);
    setOutputLines(prev => [
      ...prev,
      ...segments
        .filter(s => s.length > 0)
        .map(s => ({ id: lineIdCounter++, text: s })),
    ]);
  }

  return { outputLines, statusLine, state, connected, sendInput };
}
