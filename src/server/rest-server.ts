import { Request, Response, Router } from "express";
import { readFileSync } from "fs";
import { join } from "path";
import { SessionManager } from "./session-manager.js";

const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Z-Machine MCP REST API</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>body { margin: 0; }</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
  SwaggerUIBundle({
    url: '/api/openapi.yml',
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
    layout: 'BaseLayout',
    deepLinking: true,
    tryItOutEnabled: true,
  });
</script>
</body>
</html>`;

const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../package.json"), "utf-8"),
);
const startedAt = Date.now();

const restServer = (sessionManager: SessionManager) => {
  const router = Router();
  // ─── REST API ──────────────────────────────────────────────────────────────

  router.get("/api/docs", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(SWAGGER_UI_HTML);
  });

  router.get("/api/openapi.yml", (_req: Request, res: Response) => {
    const spec = readFileSync(join(import.meta.dirname, "../../openapi.yml"), "utf-8");
    res.setHeader("Content-Type", "application/yaml");
    res.send(spec);
  });

  router.get("/api/sessions", (_req: Request, res: Response) => {
    const sessions = sessionManager.getActiveSessions();
    res.json({
      sessions: sessions.map(s => ({
        session_id: s.id,
        game_id: s.gameId,
        game_name: s.gameName,
        state: s.state,
        status_line: s.statusLine,
      }))
    });
  });

  router.get("/api/status", (_req: Request, res: Response) => {
    const sessions = sessionManager.getActiveSessions();
    const gameCounts: Record<string, number> = {};
    for (const s of sessions) {
      gameCounts[s.gameName] = (gameCounts[s.gameName] || 0) + 1;
    }
    res.json({
      version: pkg.version,
      uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
      started_at: new Date(startedAt).toISOString(),
      sessions: {
        active: sessions.length,
        games: gameCounts,
      },
    });
  });

  router.get("/api/games", (_req: Request, res: Response) => {
    res.json({ games: sessionManager.listGames() });
  });

  router.post("/api/sessions", (req: Request, res: Response) => {
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

  router.get("/api/sessions/:id", (req: Request<{ id: string }>, res: Response) => {
    const sessionId = req.params.id;
    const session = sessionManager.getSession(sessionId);
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

  router.post("/api/sessions/:id/input", (req: Request<{ id: string }>, res: Response) => {
    const sessionId = req.params.id;
    const session = sessionManager.getSession(sessionId);
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

  router.delete("/api/sessions/:id", (req: Request<{ id: string }>, res: Response) => {
    const sessionId = req.params.id;
    const exists = !!sessionManager.getSession(sessionId);
    sessionManager.closeSession(sessionId);
    if (!exists) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ success: true });
  });

  return router;
};

export default restServer;
