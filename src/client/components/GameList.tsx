import React, { useEffect, useState } from 'react';
import { ActiveSession } from '../App.js';

interface GameInfo {
  id: string;
  name: string;
  filename: string;
  version: number;
}

interface Props {
  onStart: (session: ActiveSession) => void;
}

export default function GameList({ onStart }: Props) {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/games')
      .then(r => r.json())
      .then((data: { games: GameInfo[] }) => {
        setGames(data.games);
        setLoading(false);
      })
      .catch(err => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  async function handleStart(game: GameInfo) {
    setStarting(game.id);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: game.id }),
      });
      const data = await res.json() as { session_id: string; game_name: string; output: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to start game');
      onStart({ sessionId: data.session_id, gameName: data.game_name, initialOutput: data.output ?? '' });
    } catch (err) {
      setError(String(err));
    } finally {
      setStarting(null);
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Z-Machine Player</h1>
        <p style={styles.subtitle}>Select a game to play</p>
      </header>

      <main style={styles.main}>
        {loading && <p style={styles.message}>Loading games…</p>}
        {error && <p style={{ ...styles.message, color: '#f88' }}>Error: {error}</p>}
        {!loading && !error && games.length === 0 && (
          <p style={styles.message}>
            No games found. Set the <code>STORIES</code> environment variable to point to a folder
            containing .z3/.z5/.z8 files.
          </p>
        )}
        <ul style={styles.list}>
          {games.map(game => (
            <li key={game.id} style={styles.item}>
              <button
                style={{
                  ...styles.button,
                  opacity: starting === game.id ? 0.6 : 1,
                }}
                onClick={() => handleStart(game)}
                disabled={starting !== null}
              >
                <span style={styles.gameName}>{game.name}</span>
                <span style={styles.gameMeta}>
                  V{game.version} · {game.filename}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>

      <footer style={styles.footer}>
        <p>
          MCP endpoint: <code>http://localhost:3000/mcp</code>
          {' · '}
          <a
            href="https://inform-fiction.org/zmachine/standards/index.html"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#8af' }}
          >
            Z-Machine Spec
          </a>
        </p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    maxWidth: '720px',
    margin: '0 auto',
    padding: '2rem 1rem',
  },
  header: {
    marginBottom: '2rem',
    borderBottom: '1px solid #333',
    paddingBottom: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '1.8rem',
    color: '#fff',
    letterSpacing: '0.05em',
  },
  subtitle: {
    margin: '0.5rem 0 0',
    color: '#888',
    fontSize: '0.9rem',
  },
  main: {
    flex: 1,
  },
  message: {
    color: '#aaa',
    fontStyle: 'italic' as const,
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  item: {
    display: 'block',
  },
  button: {
    width: '100%',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '0.75rem 1rem',
    color: '#d4d4d4',
    textAlign: 'left' as const,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background 0.15s, border-color 0.15s',
    fontSize: '0.95rem',
  },
  gameName: {
    fontWeight: 600,
    color: '#fff',
  },
  gameMeta: {
    color: '#666',
    fontSize: '0.8rem',
  },
  footer: {
    marginTop: '2rem',
    paddingTop: '1rem',
    borderTop: '1px solid #222',
    color: '#555',
    fontSize: '0.8rem',
  },
} as const;
