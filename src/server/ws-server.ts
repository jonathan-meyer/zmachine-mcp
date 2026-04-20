import Debug from "debug";
import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { SessionManager } from "./session-manager.js";

const debug = Debug("zmachine:ws");

// ─── WebSocket server ───────────────────────────────────────────────

const wsServer = (
  httpServer: Server,
  port: number,
  sessionManager: SessionManager,
) => {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const statusClients = new Set<WebSocket>();

  const buildSessionStatus = () => {
    const sessions = sessionManager.getActiveSessions();
    const gameCounts: Record<string, number> = {};
    for (const s of sessions) {
      gameCounts[s.gameName] = (gameCounts[s.gameName] || 0) + 1;
    }
    return JSON.stringify({
      type: "status_update",
      sessions: { active: sessions.length, games: gameCounts },
    });
  };

  const broadcastStatus = () => {
    const payload = buildSessionStatus();
    for (const ws of statusClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  };

  sessionManager.on("change", broadcastStatus);

  wss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url ?? "", `http://localhost:${port}`);

    // Status page connection
    if (url.searchParams.has("status")) {
      debug("status client connected");
      statusClients.add(ws);
      ws.send(buildSessionStatus());
      ws.on("close", () => {
        statusClients.delete(ws);
        debug("status client disconnected");
      });
      return;
    }

    const sessionId = url.searchParams.get("session");

    if (!sessionId) {
      ws.close(1008, "session parameter required");
      return;
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      ws.close(1008, "session not found");
      return;
    }

    debug("client connected to session %s", sessionId);

    // Send initial state
    ws.send(
      JSON.stringify({
        type: "state",
        state: session.state,
        status_line: session.statusLine,
      }),
    );

    // Stream real-time output
    const unsubscribe = session.onOutput((chunk) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "output", text: chunk.text }));
      }
    });

    // Handle incoming input from WebSocket (alternative to REST)
    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          type: string;
          input?: string;
        };
        if (msg.type === "input" && msg.input !== undefined) {
          const result = session.sendInput(msg.input);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "turn_result",
                status_line: result.statusLine,
                state: result.state,
              }),
            );
          }
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      unsubscribe();
      debug("client disconnected from session %s", sessionId);
    });
  });
};

export default wsServer;
