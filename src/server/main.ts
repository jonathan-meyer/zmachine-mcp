import cors from "cors";
import Debug from "debug";
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import { createRequire } from "module";
import ViteExpress from "vite-express";
import mcpServer, { createMcpServer } from "./mcp-server.js";
import { RedisSessionStore } from "./redis-store.js";
import restServer from "./rest-server.js";
import { SessionManager } from "./session-manager.js";
import wsServer from "./ws-server.js";
const { version } = createRequire(import.meta.url)("../../package.json") as {
  version: string;
};

const debug = Debug("zmachine:main");
const httpLog = Debug("zmachine:http");
const STORIES_FOLDER = process.env.STORIES ?? "/";
const REDIS_URL = process.env.REDIS_URL;

let store: RedisSessionStore | undefined = undefined;
if (REDIS_URL) {
  try {
    store = await RedisSessionStore.connect(REDIS_URL);
    debug("Redis session store enabled");
    // Attach global error handler to Redis client
    // @ts-ignore
    store.client.on("error", (err: any) => {
      debug("Redis error: %O", err);
    });
  } catch (err) {
    debug("Redis connection failed: %O", err);
    store = undefined;
  }
}

if (process.argv.includes("--stdio")) {
  // ─── MCP stdio transport (for Claude Desktop, etc.) ──────────────────────
  const { StdioServerTransport } =
    await import("@modelcontextprotocol/sdk/server/stdio.js");
  const sessionManager = new SessionManager(STORIES_FOLDER, store);
  const server = createMcpServer(sessionManager);
  const transport = new StdioServerTransport();
  debug("connecting MCP stdio transport");
  await server.connect(transport);
} else {
  // ─── HTTP mode (web UI + REST + MCP HTTP + WebSocket) ────────────────────
  const app = express();
  const PORT = parseInt(process.env.PORT ?? "3000", 10);
  const sessionManager = new SessionManager(STORIES_FOLDER, store);

  app.use(cors());
  app.use(express.json());
  app.use(morgan("dev", { stream: { write: (msg) => httpLog(msg.trim()) } }));
  app.use(restServer(sessionManager));
  app.use(mcpServer(sessionManager));

  ViteExpress.config({ verbosity: ViteExpress.Verbosity.Silent });

  const server = ViteExpress.listen(app, PORT, async () => {
    const viteConfig = await ViteExpress.getViteConfig();
    const mode = process.env.NODE_ENV === "production" ? "production" : "development";
    debug(`zmachine-mcp v${version} listening on port ${PORT} (${mode})`);
    if (mode === "production") {
      debug(`serving static files from ${viteConfig.build.outDir}`);
    }
  });

  wsServer(server, PORT, sessionManager);
}
