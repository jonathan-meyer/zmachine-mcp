# zmachine-mcp

An [MCP](https://modelcontextprotocol.io/) server and web UI for playing Z-Machine text adventure games (Zork, Hitchhiker's Guide, etc.) with AI agents or humans.

Three interfaces expose the same game engine:

- **MCP** — stdio or HTTP transport, so AI assistants like Claude can play text adventures
- **Web UI** — React-based terminal interface with real-time WebSocket streaming
- **REST API** — programmatic session management and input/output

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

Open http://localhost:3000 to play in the browser.

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/games` | List available games |
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
| `MONGODB_URI` | — | MongoDB connection string for session persistence |
| `DEBUG` | — | Set to `zmachine:*` to enable debug logging |

### MongoDB Persistence (optional)

Set `MONGODB_URI` (e.g. `mongodb://localhost:27017`) to persist sessions and save data to MongoDB. Without it, sessions are in-memory only and lost on restart.

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
    mongo-store.ts     — Optional MongoDB persistence
  client/
    App.tsx            — React app (game list or terminal view)
    components/        — GameList, GameTerminal, StatusBar
    hooks/             — WebSocket + REST integration hook
  __tests__/           — Jest test suites
```

### Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **Z-Machine**: [ifvms](https://github.com/curiousdannii/ifvms.js) + [glkote-term](https://github.com/erkyrath/glkote-term)
- **Server**: Express 5, WebSocket (ws)
- **MCP**: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
- **Client**: React 19, Vite
- **Testing**: Jest + ts-jest
