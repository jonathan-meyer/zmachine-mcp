import "./index.css";

interface StatusResponse {
  version: string;
  uptime_seconds: number;
  started_at: string;
  sessions: {
    active: number;
    games: Record<string, number>;
  };
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function render(status: StatusResponse) {
  const gameEntries = Object.entries(status.sessions.games);
  const gamesHtml = gameEntries.length > 0
    ? `<ul class="game-list">${gameEntries
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) =>
          `<li><span class="game-name">${name}</span><span class="game-count">${count} session${count !== 1 ? "s" : ""}</span></li>`)
        .join("")}</ul>`
    : `<p class="no-sessions">No active sessions</p>`;

  const mcpUrl = window.location.origin + "/mcp";

  return `
    <h1>⚔️ Z-Machine MCP Server</h1>
    <div class="status-card">
      <h2>Server</h2>
      <div class="stat-row">
        <span class="stat-label">Version</span>
        <span class="stat-value">${status.version}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Uptime</span>
        <span class="stat-value uptime-value">${formatUptime(status.uptime_seconds)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Started</span>
        <span class="stat-value">${new Date(status.started_at).toLocaleString()}</span>
      </div>
    </div>
    <div class="status-card">
      <h2>Sessions</h2>
      <div class="stat-row">
        <span class="stat-label">Active</span>
        <span class="stat-value highlight">${status.sessions.active}</span>
      </div>
    </div>
    <div class="status-card">
      <h2>Games in Progress</h2>
      ${gamesHtml}
    </div>
    <div class="status-card">
      <h2>MCP Quick Setup</h2>
      <p class="setup-intro">Connect an AI assistant to this server to play text adventures.</p>
      <h3>MCP Endpoint</h3>
      <p class="setup-hint">Point your MCP client at:</p>
      <pre><code>${mcpUrl}</code></pre>
      <h3>WebSocket</h3>
      <p class="setup-hint">Real-time output streaming:</p>
      <pre><code>${window.location.origin.replace(/^http/, "ws")}/ws?session=&lt;session_id&gt;</code></pre>
      <h3>Available Tools</h3>
      <table class="tools-table">
        <tr><td class="tool-name">list_games</td><td>List available story files</td></tr>
        <tr><td class="tool-name">start_game</td><td>Start a new session</td></tr>
        <tr><td class="tool-name">send_input</td><td>Send a command, get the response</td></tr>
        <tr><td class="tool-name">get_session_info</td><td>Check session state &amp; status line</td></tr>
        <tr><td class="tool-name">quit_game</td><td>End a session</td></tr>
      </table>
    </div>
  `;
}

const root = document.getElementById("root")!;
root.innerHTML = `<p class="loading">Loading…</p>`;

let currentStatus: StatusResponse | null = null;

function updateUptime() {
  if (!currentStatus) return;
  const uptimeSeconds = Math.floor(
    (Date.now() - new Date(currentStatus.started_at).getTime()) / 1000,
  );
  const el = root.querySelector(".uptime-value");
  if (el) el.textContent = formatUptime(uptimeSeconds);
}

function renderStatus() {
  if (currentStatus) root.innerHTML = render(currentStatus);
}

function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws?status`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "status_update" && currentStatus) {
        currentStatus.sessions = msg.sessions;
        renderStatus();
      }
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 3000);
  };
}

async function init() {
  try {
    const res = await fetch("/api/status");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    currentStatus = await res.json();
    renderStatus();
  } catch (err) {
    root.innerHTML = `<h1>⚔️ Z-Machine MCP Server</h1><p class="error">Failed to load status: ${(err as Error).message}</p>`;
  }

  connectWebSocket();
  setInterval(updateUptime, 1000);
}

init();
