# Changelog

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
