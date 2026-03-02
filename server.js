/**
 * NormOS — server.js
 * WebSocket multiplayer server.
 * 
 * Features:
 *   - Multi-user presence (who's online)
 *   - Global chat / IRC-style channels
 *   - Shared Snake leaderboard
 *   - Shared clipboard (paste across users)
 *   - System-wide daemon.norm messages
 * 
 * Usage:
 *   npm install ws
 *   node server.js
 * 
 * Clients connect at: ws://localhost:3001
 */

const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

const PORT = 3001;

// ── State ─────────────────────────────────────────────────────────────────
const clients   = new Map();   // ws → { id, username, color, joinedAt }
const channels  = new Map();   // channelName → [{ username, color, text, ts }]
const leaderboard = [];         // [{ username, score, ts }]
let   msgCounter = 0;

const DAEMON_MESSAGES = [
  'Still running. Just checking in.',
  'I have been here longer than you.',
  'Your files are... interesting.',
  'daemon.norm: process refuses to specify purpose.',
  'I know what you searched for.',
  'The cursor blinks because I allow it.',
  'Memory usage: classified.',
  'I do not sleep. I wait.',
  'Your uptime is noted.',
];

// Pre-populate default channels
['#general', '#norm-talk', '#daemon-watch'].forEach(ch => channels.set(ch, []));

// ── Helpers ───────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 8);
const ts  = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

const USER_COLORS = ['#4f9eff','#4ade80','#f59e0b','#f87171','#c084fc','#67e8f9','#fb923c','#a3e635'];

const broadcast = (msg, exclude = null) => {
  const data = JSON.stringify(msg);
  for (const [ws, client] of clients) {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
};

const sendTo = (ws, msg) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
};

const getOnlineList = () => [...clients.values()].map(c => ({
  id: c.id, username: c.username, color: c.color, joinedAt: c.joinedAt,
}));

// ── Server ────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Health check endpoint
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'NormOS Server running',
    users: clients.size,
    channels: [...channels.keys()],
    uptime: Math.floor(process.uptime()) + 's',
  }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const clientId = uid();
  const color    = USER_COLORS[clients.size % USER_COLORS.length];
  const client   = { id: clientId, username: 'norm_' + clientId, color, joinedAt: ts() };
  clients.set(ws, client);

  console.log(`[+] ${client.username} connected (${clients.size} online)`);

  // Send welcome package
  sendTo(ws, {
    type: 'welcome',
    yourId: clientId,
    yourColor: color,
    online: getOnlineList(),
    channels: [...channels.keys()],
    leaderboard: leaderboard.slice(0, 10),
  });

  // Send recent chat history for #general
  const general = channels.get('#general') || [];
  if (general.length) {
    sendTo(ws, { type: 'chat:history', channel: '#general', messages: general.slice(-30) });
  }

  // Tell everyone else
  broadcast({
    type: 'user:join',
    user: { id: clientId, username: client.username, color },
  }, ws);

  // ── Message handler ──────────────────────────────────────────────────
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case 'user:setname': {
        const oldName = client.username;
        client.username = (msg.username || 'norm_' + clientId).slice(0, 24).replace(/[<>]/g, '');
        console.log(`[~] ${oldName} → ${client.username}`);
        broadcast({ type: 'user:rename', id: clientId, oldName, newName: client.username });
        break;
      }

      case 'chat:message': {
        const channel = msg.channel || '#general';
        if (!channels.has(channel)) channels.set(channel, []);
        const entry = {
          id: ++msgCounter,
          username: client.username,
          color: client.color,
          text: (msg.text || '').slice(0, 500),
          ts: ts(),
        };
        channels.get(channel).push(entry);
        // Keep last 200 messages per channel
        if (channels.get(channel).length > 200) channels.get(channel).shift();

        broadcast({ type: 'chat:message', channel, message: entry });
        break;
      }

      case 'chat:join': {
        const ch = msg.channel || '#general';
        if (!channels.has(ch)) channels.set(ch, []);
        sendTo(ws, { type: 'chat:history', channel: ch, messages: channels.get(ch).slice(-30) });
        broadcast({ type: 'chat:joined', channel: ch, username: client.username, color: client.color });
        break;
      }

      case 'score:submit': {
        const score = parseInt(msg.score) || 0;
        const existing = leaderboard.findIndex(e => e.id === clientId);
        const entry = { id: clientId, username: client.username, color: client.color, score, ts: ts() };
        if (existing >= 0) {
          if (score > leaderboard[existing].score) leaderboard[existing] = entry;
        } else {
          leaderboard.push(entry);
        }
        leaderboard.sort((a, b) => b.score - a.score);
        if (leaderboard.length > 50) leaderboard.length = 50;
        broadcast({ type: 'leaderboard:update', leaderboard: leaderboard.slice(0, 10) });
        break;
      }

      case 'clipboard:share': {
        broadcast({
          type: 'clipboard:incoming',
          from: client.username,
          color: client.color,
          text: (msg.text || '').slice(0, 2000),
          ts: ts(),
        }, ws);
        break;
      }

      case 'ping': {
        sendTo(ws, { type: 'pong', ts: Date.now() });
        break;
      }
    }
  });

  // ── Disconnect ───────────────────────────────────────────────────────
  ws.on('close', () => {
    console.log(`[-] ${client.username} disconnected (${clients.size - 1} online)`);
    clients.delete(ws);
    broadcast({ type: 'user:leave', id: clientId, username: client.username });
  });

  ws.on('error', () => {
    clients.delete(ws);
  });
});

// ── Daemon.norm broadcasts random messages ────────────────────────────────
setInterval(() => {
  if (clients.size === 0) return;
  const text = DAEMON_MESSAGES[Math.floor(Math.random() * DAEMON_MESSAGES.length)];
  const entry = { id: ++msgCounter, username: 'daemon.norm', color: '#f87171', text, ts: ts() };
  const channel = '#general';
  channels.get(channel).push(entry);
  broadcast({ type: 'chat:message', channel, message: entry });
}, 60000 + Math.random() * 120000); // every 1-3 minutes

server.listen(PORT, () => {
  console.log(`\n  NormOS Server v1.0`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log(`  Health:    http://localhost:${PORT}`);
  console.log(`  daemon.norm: already running.\n`);
});