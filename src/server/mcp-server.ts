import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SessionManager } from './session-manager.js';

export function createMcpServer(sessionManager: SessionManager): McpServer {
  const server = new McpServer({
    name: 'zmachine-mcp',
    version: '0.1.0',
  });

  server.registerTool(
    'list_games',
    {
      title: 'List Available Games',
      description: 'List all Z-Machine story files available to play.',
      inputSchema: z.object({}),
    },
    async () => {
      const games = sessionManager.listGames();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ games }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    'start_game',
    {
      title: 'Start a Game',
      description:
        'Start a new Z-Machine game session. Returns the opening text and a session_id ' +
        'needed for subsequent send_input calls.',
      inputSchema: z.object({
        game_id: z.string().describe(
          'The game id from list_games (e.g. "zork1")',
        ),
      }),
    },
    async ({ game_id }) => {
      try {
        const session = sessionManager.startGame(game_id);
        return {
          content: [
            {
              type: 'text',
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
          content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'send_input',
    {
      title: 'Send Input to Game',
      description:
        'Send a command to the active game session. Returns the game\'s response text. ' +
        'Use empty string to get current output without sending input.',
      inputSchema: z.object({
        session_id: z.string().describe('Session ID from start_game'),
        input: z.string().describe('The command to send (e.g. "go north", "take lamp")'),
      }),
    },
    async ({ session_id, input }) => {
      const session = sessionManager.getSession(session_id);
      if (!session) {
        return {
          content: [{ type: 'text', text: `Error: session ${session_id} not found` }],
          isError: true,
        };
      }

      if (session.state === 'ended') {
        return {
          content: [{ type: 'text', text: JSON.stringify({ output: '(game has ended)', state: 'ended', status_line: session.statusLine }, null, 2) }],
        };
      }

      const result = session.sendInput(input);
      return {
        content: [
          {
            type: 'text',
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
    'get_session_info',
    {
      title: 'Get Session Info',
      description: 'Get the current status and state of an active game session.',
      inputSchema: z.object({
        session_id: z.string().describe('Session ID from start_game'),
      }),
    },
    async ({ session_id }) => {
      const session = sessionManager.getSession(session_id);
      if (!session) {
        return {
          content: [{ type: 'text', text: `Error: session ${session_id} not found` }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: 'text',
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
    'quit_game',
    {
      title: 'Quit Game',
      description: 'End a game session and free its resources.',
      inputSchema: z.object({
        session_id: z.string().describe('Session ID from start_game'),
      }),
    },
    async ({ session_id }) => {
      const session = sessionManager.getSession(session_id);
      if (!session) {
        return {
          content: [{ type: 'text', text: `Error: session ${session_id} not found` }],
          isError: true,
        };
      }
      sessionManager.closeSession(session_id);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
      };
    },
  );

  return server;
}
