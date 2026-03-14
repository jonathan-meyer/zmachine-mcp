import { Request, Response, Router } from "express";
import { SessionManager } from "./session-manager.js";

const restServer = (sessionManager: SessionManager) => {
  const router = Router();
  // ─── REST API ──────────────────────────────────────────────────────────────

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
