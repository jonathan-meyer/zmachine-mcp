import path from "path";
import { SessionManager } from "./session-manager.js";

const STORIES_FOLDER =
  process.env.STORIES ?? path.join(__dirname, "../../../stories");
const PORT = parseInt(process.env.PORT ?? "3000", 10);

console.log({ STORIES_FOLDER, PORT });

const sessionManager = new SessionManager(STORIES_FOLDER);

const isStdio = process.argv.includes("--stdio");

if (isStdio) {
  // stdio transport — for Claude Desktop / local MCP clients
  // Import dynamically to avoid pulling in HTTP deps
  (async () => {
    const { StdioServerTransport } =
      await import("@modelcontextprotocol/sdk/server/stdio.js");
    const { createMcpServer } = await import("./mcp-server.js");

    const server = createMcpServer(sessionManager);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Server runs until stdin closes
  })().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
} else {
  // HTTP mode — REST API + WebSocket + MCP HTTP transport
  const { startHttpServer } = require("./http-server.js");
  startHttpServer(sessionManager, PORT);
}
