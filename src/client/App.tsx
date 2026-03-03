import React, { useState } from 'react';
import GameList from './components/GameList.js';
import GameTerminal from './components/GameTerminal.js';

export interface ActiveSession {
  sessionId: string;
  gameName: string;
  initialOutput: string;
}

export default function App() {
  const [session, setSession] = useState<ActiveSession | null>(null);

  function handleGameStart(sess: ActiveSession) {
    setSession(sess);
  }

  function handleGameEnd() {
    setSession(null);
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {session ? (
        <GameTerminal
          sessionId={session.sessionId}
          gameName={session.gameName}
          initialOutput={session.initialOutput}
          onExit={handleGameEnd}
        />
      ) : (
        <GameList onStart={handleGameStart} />
      )}
    </div>
  );
}
