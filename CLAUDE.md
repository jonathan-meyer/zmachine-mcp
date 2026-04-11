# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (server on :3000, Vite on :5173 with proxy)
npm run dev

# Production build
npm run build

# Run production server (HTTP mode)
npm start

# Run as MCP stdio server (for Claude Desktop)
npm run start:stdio

# TypeScript type check
npm run typecheck

# Run tests
npm test

# Run tests with v8 coverage report
npm run test:coverage
```

Set the `STORIES` env var to point to your `.z3`/`.z5`/`.z8` story files (default: `../stories`).

## Architecture

### What this is
An MCP server + web UI for playing Z-Machine text adventure games (Zork, etc.) with AI agents or humans.

- **MCP transport**: stdio (Claude Desktop) or HTTP (`POST /mcp`)
- **REST API**: `GET /api/games`, `POST /api/sessions`, `POST /api/sessions/:id/input`, `DELETE /api/sessions/:id`
- **WebSocket**: `ws://localhost:3000/ws?session=<id>` for real-time output streaming

### Source layout

```
src/
  server/
    main.ts              Entry point — HTTP mode or --stdio mode
    glkote-async.ts      Custom GlkOte: captures Z-Machine I/O synchronously
    game-session.ts      One game session — wraps GlkOte, provides sendInput()
    session-manager.ts   Loads story files, manages active sessions
    mcp-server.ts        MCP tool definitions (list_games, start_game, send_input, …)
    rest-server.ts       Express REST API routes
    ws-server.ts         WebSocket server for real-time output streaming
    mongo-store.ts       Optional MongoDB persistence (sessions + saves)
  client/
    main.tsx             React entry point
    App.tsx              Root: GameList or GameTerminal based on active session
    components/
      GameList.tsx        Shows available games, starts sessions via POST /api/sessions
      GameTerminal.tsx    Terminal UI: output pane + status bar + input line
      StatusBar.tsx       Z-Machine status bar (location / score / turns)
    hooks/
      useGameSession.ts   WebSocket + REST integration hook
  __tests__/
    glkote-async.test.ts    AsyncGlkOte unit tests
    session-manager.test.ts SessionManager unit tests
    game-session.test.ts    GameSession integration tests
    mcp-server.test.ts      MCP tool tests
    rest-server.test.ts     REST API integration tests
```

### Z-Machine / ifvms integration (key design)

`ifvms` uses the Glk API (`glkote-term`) for all I/O. The Glk module is an **IIFE singleton** — its internal `VM` and `GlkOte` state is per-module-cache. To run multiple concurrent sessions, `game-session.ts` clears the `glkote-term/src/glkapi.js` entry from `require.cache` before each session to get a fresh isolated Glk instance.

The VM runs **synchronously** inside each `iface.accept()` call:
- `Glk.init()` starts the game and runs until the first `glk_select()` (input prompt)
- `glkote.sendLine(text)` resumes the VM synchronously until the next `glk_select()`
- Output produced during a turn is captured in `AsyncGlkOte.pendingOutput`

This means `session.sendInput(text)` is synchronous — it runs the VM and returns the output immediately.

### MCP tools

| Tool | Purpose |
|------|---------|
| `list_games` | List `.z3`/`.z5`/`.z8` files in the stories folder |
| `start_game` | Start a new session; returns `session_id` + opening text |
| `send_input` | Send a command; returns the game's response |
| `get_session_info` | Get session state and status line |
| `quit_game` | End a session |

### Story files
Stories are loaded from `STORIES` env var (default: `../stories`). Supported extensions: `.z3` `.z4` `.z5` `.z7` `.z8` `.zblorb`

### MongoDB Persistence (optional)

Set `MONGODB_URI` env var (e.g. `mongodb://localhost:27017`) to persist sessions and save data to MongoDB (`zmachine` database, `sessions` + `saves` collections). Without it, sessions are in-memory only.

### Testing

Jest + ts-jest with ESM preset (`--experimental-vm-modules`), v8 coverage provider. Tests live in `src/__tests__/`. Coverage is collected from `src/server/**/*.ts` (excluding `main.ts`).

### Logging

Uses `debug` package with namespaces (`zmachine:main`, `zmachine:mcp`, `zmachine:sessions`, `zmachine:ws`). All output goes to stderr, which is safe for stdio MCP transport. Enable with `DEBUG=zmachine:*`.

## Z-Machine Spec docs
- `docs/ZSpec11-latest.txt` — Z-Machine Specification v1.1
- `docs/z-spec10.pdf` — Z-Machine Specification v1.0
