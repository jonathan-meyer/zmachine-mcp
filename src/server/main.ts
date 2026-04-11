import cors from "cors";
import Debug from "debug";
import "dotenv/config";
import express from "express";
import ViteExpress from "vite-express";
import mcpServer, { createMcpServer } from "./mcp-server.js";
import restServer from "./rest-server.js";
import { SessionManager } from "./session-manager.js";
import wsServer from "./ws-server.js";

const debug = Debug("zmachine:main");
const STORIES_FOLDER = process.env.STORIES ?? "/";

if (process.argv.includes("--stdio")) {
  // ─── MCP stdio transport (for Claude Desktop, etc.) ──────────────────────
  const { StdioServerTransport } =
    await import("@modelcontextprotocol/sdk/server/stdio.js");
  const sessionManager = new SessionManager(STORIES_FOLDER);
  const server = createMcpServer(sessionManager);
  const transport = new StdioServerTransport();
  debug("connecting MCP stdio transport");
  await server.connect(transport);
} else {
  // ─── HTTP mode (web UI + REST + MCP HTTP + WebSocket) ────────────────────
  const app = express();
  const PORT = parseInt(process.env.PORT ?? "3000", 10);
  const sessionManager = new SessionManager(STORIES_FOLDER);

  app.use(cors());
  app.use(express.json());
  app.use(restServer(sessionManager));
  app.use(mcpServer(sessionManager));

  const server = ViteExpress.listen(app, PORT, () =>
    debug("listening on port %d", PORT),
  );

  wsServer(server, PORT, sessionManager);
}
