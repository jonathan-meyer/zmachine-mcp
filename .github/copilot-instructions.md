# Project Guidelines

## Build & Run

```bash
npm run dev          # Dev server (nodemon + Vite, :3000/:5173)
npm run build        # Production Vite build
npm start            # Production HTTP server
npm run start:stdio  # MCP stdio transport (Claude Desktop)
```

Set `STORIES` env var to the folder containing `.z3`/`.z5`/`.z8`/`.zblorb` story files (default: `/`).

## Architecture

MCP server + web UI for Z-Machine text adventures. Three interfaces to the same game engine:

- **MCP** — stdio (`--stdio`) or HTTP (`POST /mcp`) via `@modelcontextprotocol/sdk`
- **REST** — `GET /api/games`, `POST /api/sessions`, `POST /api/sessions/:id/input`, `DELETE /api/sessions/:id`
- **WebSocket** — `ws://localhost:3000/ws?session=<id>` for real-time output streaming

Source layout: `src/server/` (Node/Express backend), `src/client/` (React frontend). See [CLAUDE.md](../CLAUDE.md) for detailed file-by-file layout.

## Critical Design: Glk Singleton Isolation

The `ifvms` Z-Machine uses `glkote-term` which is an **IIFE singleton** — module-level state means only one VM per `require` cache entry. To support concurrent sessions, `game-session.ts` deletes the `glkote-term/src/glkapi.js` cache entry before each new session. **Never refactor this away** without an alternative isolation strategy.

The VM runs **synchronously** inside `iface.accept()`. `sendInput()` blocks, runs the VM to the next input prompt, and returns output immediately. This is intentional — not a bug.

## Conventions

- **ESM throughout** — all relative imports use `.js` extensions (TypeScript + NodeNext)
- **No linter or formatter configured** — match existing style (2-space indent, trailing commas, semicolons)
- **No test framework** — no tests exist yet
- **React client** — function components + hooks only, inline styles, no state library
- **Error handling** — minimal; REST returns 400/404 JSON, MCP tools return `isError: true`
- **Session IDs** — `crypto.randomUUID()`; game IDs derived from filenames (lowercase, hyphens)

## Z-Machine Reference

Full spec at [docs/ZSpec11-latest.txt](../docs/ZSpec11-latest.txt). Key for understanding status line parsing and output formatting in `glkote-async.ts`.
