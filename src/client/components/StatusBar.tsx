import React from 'react';
import { StatusLine } from '../hooks/useGameSession.js';

interface Props {
  statusLine: StatusLine;
  gameName: string;
  connected: boolean;
}

export default function StatusBar({ statusLine, gameName, connected }: Props) {
  const right = statusLine.isTime
    ? `${String(statusLine.score).padStart(2, '0')}:${String(statusLine.turns).padStart(2, '0')}`
    : `Score: ${statusLine.score}   Turns: ${statusLine.turns}`;

  return (
    <div style={styles.bar}>
      <span style={styles.left}>
        {statusLine.location || gameName}
      </span>
      <span style={styles.center}>
        {!connected && <span style={styles.disconnected}>⚠ disconnected</span>}
      </span>
      <span style={styles.right}>{right}</span>
    </div>
  );
}

const styles = {
  bar: {
    background: '#d4d4d4',
    color: '#0d0d0d',
    padding: '2px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 700,
    fontSize: '0.85rem',
    flexShrink: 0,
    letterSpacing: '0.03em',
  },
  left: {
    flex: 1,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  center: {
    flex: 0,
    padding: '0 1rem',
  },
  right: {
    flex: 1,
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
  },
  disconnected: {
    color: '#c00',
    fontWeight: 700,
  },
} as const;
