import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { SessionManager } from "./session-manager.js";

// ─── WebSocket server ───────────────────────────────────────────────

const wsServer = (
  httpServer: Server,
  port: number,
  sessionManager: SessionManager,
) => {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url ?? "", `http://localhost:${port}`);
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
                output: result.output,
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
    });
  });
};

export default wsServer;
