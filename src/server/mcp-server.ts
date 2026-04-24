import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import Debug from "debug";
import { Request, Response, Router } from "express";
import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { SessionManager } from "./session-manager.js";

const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../package.json"), "utf-8"),
);

const debug = Debug("zmachine:mcp");

const mcpServer = (sessionManager: SessionManager) => {
  const router = Router();
  // ─── MCP HTTP transport ────────────────────────────────────────────────────

  const server = createMcpServer(sessionManager);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  server.connect(transport).catch((err) => {
    debug("MCP server connection error: %O", err);
  });

  router.all("/mcp", async (req: Request, res: Response) => {
    await transport.handleRequest(req, res, req.body);
  });

  return router;
};

export function createMcpServer(sessionManager: SessionManager): McpServer {
  const server = new McpServer({
    name: "zmachine-mcp",
    version: pkg.version,
  });

  server.registerResource(
    "rest-api-spec",
    "openapi://zmachine-mcp",
    {
      title: "REST API OpenAPI Specification",
      description:
        "OpenAPI 3.0 spec describing all HTTP endpoints: /api/status, /api/games, " +
        "/api/sessions, /api/sessions/:id, /api/sessions/:id/input. " +
        "Use these endpoints for direct HTTP access without MCP.",
      mimeType: "application/yaml",
    },
    async () => {
      const spec = readFileSync(join(import.meta.dirname, "../../openapi.yml"), "utf-8");
      return {
        contents: [{ uri: "openapi://zmachine-mcp", text: spec, mimeType: "application/yaml" }],
      };
    },
  );

  server.registerTool(
    "list_games",
    {
      title: "List Available Games",
      description: "List all Z-Machine story files available to play.",
      inputSchema: z.object({}),
    },
    async () => {
      const games = sessionManager.listGames();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ games }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_sessions",
    {
      title: "List Active Sessions",
      description:
        "List all currently active game sessions with their IDs, game, state, and status line. " +
        "Call this before starting a new game to check for sessions already in progress.",
      inputSchema: z.object({}),
    },
    async () => {
      const sessions = sessionManager.getActiveSessions();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                sessions: sessions.map((s) => ({
                  session_id: s.id,
                  game_id: s.gameId,
                  game_name: s.gameName,
                  state: s.state,
                  status_line: s.statusLine,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "start_game",
    {
      title: "Start a Game",
      description:
        "Start a new Z-Machine game session. Returns the opening text and a session_id " +
        "needed for subsequent send_input calls.",
      inputSchema: z.object({
        game_id: z
          .string()
          .describe('The game id from list_games (e.g. "zork1")'),
      }),
    },
    async ({ game_id }) => {
      try {
        const session = sessionManager.startGame(game_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  session_id: session.id,
                  output: session.initialOutput,
                  status_line: session.statusLine,
                  state: session.state,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "send_input",
    {
      title: "Send Input to Game",
      description:
        "Send a text command to an active game session and get the response. " +
        "Returns output text, status_line (location, score/time, turns), and state. " +
        'State is "waiting_input" when the game expects more input, "ended" when the game is over. ' +
        'Typical commands: "look", "inventory", "go north", "take lamp", "examine mailbox". ' +
        "Send an empty string to read current output without advancing the game.",
      inputSchema: z.object({
        session_id: z.string().describe("Session ID from start_game"),
        input: z
          .string()
          .describe('The command to send (e.g. "go north", "take lamp")'),
      }),
    },
    async ({ session_id, input }) => {
      const session = sessionManager.getSession(session_id);
      if (!session) {
        return {
          content: [
            { type: "text", text: `Error: session ${session_id} not found` },
          ],
          isError: true,
        };
      }

      if (session.state === "ended") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  output: "(game has ended)",
                  state: "ended",
                  status_line: session.statusLine,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const result = session.sendInput(input);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                output: result.output,
                status_line: result.statusLine,
                state: result.state,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_session_info",
    {
      title: "Get Session Info",
      description:
        "Get the current status and state of an active game session.",
      inputSchema: z.object({
        session_id: z.string().describe("Session ID from start_game"),
      }),
    },
    async ({ session_id }) => {
      const session = sessionManager.getSession(session_id);
      if (!session) {
        return {
          content: [
            { type: "text", text: `Error: session ${session_id} not found` },
          ],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                session_id: session.id,
                game_id: session.gameId,
                game_name: session.gameName,
                state: session.state,
                status_line: session.statusLine,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "quit_game",
    {
      title: "Quit Game",
      description: "End a game session and free its resources.",
      inputSchema: z.object({
        session_id: z.string().describe("Session ID from start_game"),
      }),
    },
    async ({ session_id }) => {
      const session = sessionManager.getSession(session_id);
      if (!session) {
        return {
          content: [
            { type: "text", text: `Error: session ${session_id} not found` },
          ],
          isError: true,
        };
      }
      sessionManager.closeSession(session_id);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true }) }],
      };
    },
  );

  return server;
}

export default mcpServer;