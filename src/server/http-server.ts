import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express, { Request, Response } from "express";
import fs from "fs";
import { createServer } from "http";
import path from "path";
import { WebSocket, WebSocketServer } from "ws";
import { createMcpServer } from "./mcp-server.js";
import { SessionManager } from "./session-manager.js";

export function startHttpServer(
  sessionManager: SessionManager,
  port: number,
): void {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // ─── REST API ──────────────────────────────────────────────────────────────

  app.get("/api/games", (_req: Request, res: Response) => {
    res.json({ games: sessionManager.listGames() });
  });

  app.post("/api/sessions", (req: Request, res: Response) => {
    const { game_id } = req.body as { game_id?: string };
    if (!game_id) {
      res.status(400).json({ error: "game_id is required" });
      return;
    }
    try {
      const session = sessionManager.startGame(game_id);
      res.json({
        session_id: session.id,
        game_name: session.gameName,
        output: session.initialOutput,
        state: session.state,
        status_line: session.statusLine,
      });
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  app.get("/api/sessions/:id", (req: Request, res: Response) => {
    const session = sessionManager.getSession(req.params.id.at);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({
      session_id: session.id,
      game_id: session.gameId,
      game_name: session.gameName,
      state: session.state,
      status_line: session.statusLine,
    });
  });

  app.post("/api/sessions/:id/input", (req: Request, res: Response) => {
    const session = sessionManager.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const { input } = req.body as { input?: string };
    if (input === undefined) {
      res.status(400).json({ error: "input is required" });
      return;
    }
    const result = session.sendInput(input);
    res.json({
      output: result.output,
      status_line: result.statusLine,
      state: result.state,
    });
  });

  app.delete("/api/sessions/:id", (req: Request, res: Response) => {
    const {id} = req.params;

    const exists = !!sessionManager.getSession(id);
    sessionManager.closeSession(id);
    if (!exists) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ success: true });
  });

  // ─── MCP HTTP transport ────────────────────────────────────────────────────

  const mcpServer = createMcpServer(sessionManager);
  const mcpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  app.all("/mcp", async (req: Request, res: Response) => {
    await mcpTransport.handleRequest(req, res);
  });

  mcpServer.connect(mcpTransport).catch((err) => {
    console.error("MCP server connection error:", err);
  });

  // ─── Serve Vite build in production ───────────────────────────────────────

  const clientDist = path.join(__dirname, "../../dist/client");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("*path", (_req: Request, res: Response) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  // ─── HTTP + WebSocket server ───────────────────────────────────────────────

  const httpServer = createServer(app);
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

  httpServer.listen(port, () => {
    console.log(`Z-Machine MCP server running on http://localhost:${port}`);
    console.log(`  REST API: http://localhost:${port}/api`);
    console.log(`  MCP HTTP: http://localhost:${port}/mcp`);
    console.log(`  WebSocket: ws://localhost:${port}/ws?session=<id>`);
  });
}
