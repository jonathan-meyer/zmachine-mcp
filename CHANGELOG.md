
# Changelog

## [0.6.0] - 2026-04-24

### Added
- Morgan HTTP request logging piped through `debug` (`zmachine:http` namespace)
- Startup message logs server version and port via `zmachine:main` debug namespace
- ViteExpress verbosity silenced; mode and static file path logged through unified debug output
- `DEBUG` env var added to Procfile for web process

## [0.5.0] - 2026-04-24

### Added
- OpenAPI documentation and endpoints for active sessions

## [0.4.1] - 2026-04-23

### Changed
- Refactor: update AsyncGlkOte to use 'lines' instead of 'text' for grid window content

## [0.4.0] - 2026-04-20

### Added
- Status page now uses WebSocket for live updates (no polling)
- SessionManager emits 'change' events for session lifecycle
- WebSocket server broadcasts status updates to status page clients
- Robust Redis error handling: server logs errors but does not crash on disconnect

### Changed
- Client uptime display is now local and updates every second

### Fixed
- All tests pass (104/104)

## [0.3.1] - 2026-04-20

### Fixed
- MCP server transport now uses `randomUUID` for session ID generation

## [0.3.0] - 2026-04-20

### Added
- `/api/status` endpoint returning version, uptime, and session statistics
- Vanilla TypeScript status page with server health, active sessions, and MCP setup guide
- Redis session store test suite with full mock coverage
- WebSocket server test suite
- MCP tool handler tests via Client SDK (`InMemoryTransport`)
- REST API tests for `/api/status`

### Changed
- Replaced React game UI with lightweight vanilla TypeScript status page
- Removed MongoDB store (`mongo-store.ts`) — fully replaced by Redis

### Fixed
- Test tsconfig `exclude` override so type-checking works in `src/__tests__/`

## 0.2.0 — 2026-04-20

### Changed
- Replaced MongoDB persistence with Redis (`REDIS_URL` replaces `MONGODB_URI`)
- Replaced React game UI with a vanilla TypeScript status page showing server health, active sessions, and MCP setup guide
- Added `/api/status` endpoint (version, uptime, session stats)

### Added
- Heroku support (`Procfile`, `heroku-postbuild` script, `engines` field)
- README with setup instructions, MCP integration guide, and project structure

## 0.1.0 — 2026-04-19

### Added
- MCP server with stdio and HTTP transports
- Z-Machine game engine integration via `ifvms` + `glkote-term`
- REST API for session management
- WebSocket server for real-time output streaming
- MongoDB session persistence (optional)
- React web UI for playing games in the browser
- Jest test suite with coverage
- Debug logging via `debug` package
