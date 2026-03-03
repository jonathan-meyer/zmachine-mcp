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
    http-server.ts       Express server + WebSocket + MCP HTTP transport
  client/
    main.tsx             React entry point
    App.tsx              Root: GameList or GameTerminal based on active session
    components/
      GameList.tsx        Shows available games, starts sessions via POST /api/sessions
      GameTerminal.tsx    Terminal UI: output pane + status bar + input line
      StatusBar.tsx       Z-Machine status bar (location / score / turns)
    hooks/
      useGameSession.ts   WebSocket + REST integration hook
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

## Z-Machine Spec docs
- `docs/ZSpec11-latest.txt` — Z-Machine Specification v1.1
- `docs/z-spec10.pdf` — Z-Machine Specification v1.0
