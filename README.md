# zmachine-mcp

An [MCP](https://modelcontextprotocol.io/) server for playing Z-Machine text adventure games (Zork, Hitchhiker's Guide, etc.) with AI agents.

Three interfaces expose the same game engine:

- **MCP** — stdio or HTTP transport, so AI assistants like Claude can play text adventures
- **REST API** — programmatic session management and input/output
- **WebSocket** — real-time output streaming

A built-in status page at `/` shows server health, active sessions, and MCP setup instructions.

## Quick Start

```bash
npm install
```

Place your Z-Machine story files (`.z3`, `.z4`, `.z5`, `.z7`, `.z8`, `.zblorb`) in a folder and point to it:

```bash
export STORIES=../stories
```

Then start the server:

```bash
# Development (auto-reload, server on :3000, Vite on :5173)
npm run dev

# Production
npm run build && npm start
```

Open http://localhost:3000 to see the server status page.

## MCP Integration

### Claude Desktop (stdio)

```bash
npm run start:stdio
```

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "zmachine": {
      "command": "npx",
      "args": ["tsx", "src/server/main.ts", "--stdio"],
      "env": {
        "STORIES": "/path/to/your/stories"
      }
    }
  }
}
```

### HTTP Transport

When running in HTTP mode, the MCP endpoint is available at `POST /mcp`.

### MCP Tools

| Tool | Description |
|------|-------------|
| `list_games` | List available story files |
| `start_game` | Start a new session; returns session ID and opening text |
| `send_input` | Send a command; returns the game's response |
| `get_session_info` | Get session state and status line |
| `quit_game` | End a session |

## REST API

Interactive documentation is available at [`/api/docs`](http://localhost:3000/api/docs) when the server is running. The raw OpenAPI spec is at [`/api/openapi.yml`](http://localhost:3000/api/openapi.yml).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Server status, uptime, active sessions |
| `GET` | `/api/games` | List available games |
| `GET` | `/api/sessions` | List all active sessions with their IDs, game, state, and status line |
| `POST` | `/api/sessions` | Create a new game session |
| `POST` | `/api/sessions/:id/input` | Send input to a session |
| `DELETE` | `/api/sessions/:id` | End a session |

## WebSocket

Connect to `ws://localhost:3000/ws?session=<id>` for real-time output streaming.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `STORIES` | `../stories` | Path to folder containing Z-Machine story files |
| `PORT` | `3000` | HTTP server port |
| `REDIS_URL` | — | Redis connection URL for session persistence |
| `DEBUG` | — | Set to `zmachine:*` to enable debug logging |

### Redis Persistence (optional)

Set `REDIS_URL` (e.g. `redis://localhost:6379`) to persist sessions and save data to Redis. Without it, sessions are in-memory only and lost on restart.

## Development

```bash
npm run dev           # Dev server with auto-reload
npm test              # Run tests
npm run test:coverage # Tests with coverage report
npm run typecheck     # TypeScript type checking
```

### Project Structure

```
src/
  server/
    main.ts            — Entry point (HTTP or stdio mode)
    mcp-server.ts      — MCP tool definitions
    rest-server.ts     — Express REST API
    ws-server.ts       — WebSocket server
    session-manager.ts — Loads stories, manages sessions
    game-session.ts    — Single game session (wraps Z-Machine VM)
    glkote-async.ts    — Custom GlkOte for synchronous I/O capture
    redis-store.ts     — Optional Redis persistence
  client/
    main.ts            — Status page (polls /api/status)
    index.css          — Status page styles
  __tests__/           — Jest test suites
```

### Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **Z-Machine**: [ifvms](https://github.com/curiousdannii/ifvms.js) + [glkote-term](https://github.com/erkyrath/glkote-term)
- **Server**: Express 5, WebSocket (ws)
- **MCP**: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
- **Client**: Vanilla TypeScript, Vite
- **Testing**: Jest + ts-jest
