import React, { useEffect, useRef, useState, KeyboardEvent } from 'react';
import StatusBar from './StatusBar.js';
import { useGameSession } from '../hooks/useGameSession.js';

interface Props {
  sessionId: string;
  gameName: string;
  initialOutput: string;
  onExit: () => void;
}

export default function GameTerminal({ sessionId, gameName, initialOutput, onExit }: Props) {
  const { outputLines, statusLine, state, connected, sendInput } = useGameSession(sessionId, initialOutput);
  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputLines]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit() {
    const cmd = inputValue.trim();
    if (!cmd) return;
    setHistory(prev => [cmd, ...prev.slice(0, 49)]);
    setHistoryIndex(-1);
    setInputValue('');
    await sendInput(cmd);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIndex);
      setInputValue(history[newIndex] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setInputValue(newIndex === -1 ? '' : (history[newIndex] ?? ''));
    }
  }

  async function handleExit() {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
    onExit();
  }

  const isEnded = state === 'ended';

  return (
    <div style={styles.container} onClick={() => inputRef.current?.focus()}>
      <StatusBar statusLine={statusLine} gameName={gameName} connected={connected} />

      <div style={styles.toolbar}>
        <span style={styles.toolbarTitle}>{gameName}</span>
        <button style={styles.exitButton} onClick={handleExit}>
          ✕ Exit
        </button>
      </div>

      <div ref={outputRef} style={styles.output}>
        {outputLines.map(line => (
          <div
            key={line.id}
            style={{
              ...styles.line,
              ...(line.isEcho ? styles.echoLine : {}),
            }}
          >
            {line.text}
          </div>
        ))}
        {isEnded && (
          <div style={styles.endedMessage}>
            — Game Over —
          </div>
        )}
      </div>

      <div style={styles.inputArea}>
        <span style={styles.prompt}>&gt;</span>
        <input
          ref={inputRef}
          style={{
            ...styles.input,
            opacity: isEnded ? 0.4 : 1,
          }}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isEnded || !connected}
          placeholder={isEnded ? 'Game over' : connected ? 'Type a command…' : 'Connecting…'}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#0d0d0d',
    cursor: 'text',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 12px',
    background: '#111',
    borderBottom: '1px solid #222',
    flexShrink: 0,
  },
  toolbarTitle: {
    color: '#888',
    fontSize: '0.8rem',
  },
  exitButton: {
    background: 'none',
    border: '1px solid #444',
    color: '#888',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    transition: 'color 0.15s, border-color 0.15s',
  },
  output: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0px',
  },
  line: {
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    minHeight: '1.5em',
    color: '#d4d4d4',
  },
  echoLine: {
    color: '#7ec8e3',
    marginTop: '0.5em',
  },
  endedMessage: {
    color: '#888',
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    marginTop: '1rem',
    padding: '1rem',
    borderTop: '1px solid #333',
  },
  inputArea: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderTop: '1px solid #222',
    background: '#111',
    flexShrink: 0,
    gap: '8px',
  },
  prompt: {
    color: '#7ec8e3',
    fontWeight: 700,
    userSelect: 'none' as const,
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#7ec8e3',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    caretColor: '#7ec8e3',
  },
} as const;
