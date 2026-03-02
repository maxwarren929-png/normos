/**
 * NormOS — server.js v3.0
 * Features: chat, DMs, leaderboard, shared stock market,
 *           money transfers, virus attacks, daemon.norm
 */

const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3001;

// ── State ──────────────────────────────────────────────────────────────────
const clients  = new Map();
const allUsers = new Map();
const channels = new Map();
const dms      = new Map();
let   msgCounter = 0;

// ── Shared Stock Market ────────────────────────────────────────────────────
const STOCKS = [
  { id: 'NRM',     name: 'NormCorp',           sector: 'Tech',     basePrice: 142.50, vol: 0.025, icon: '🖥️' },
  { id: 'DMNN',    name: 'Daemon Industries',  sector: 'Tech',     basePrice: 88.00,  vol: 0.04,  icon: '👾' },
  { id: 'FSYS',    name: 'FileSystem Ltd',     sector: 'Tech',     basePrice: 210.00, vol: 0.02,  icon: '📁' },
  { id: 'WNDW',    name: 'WindowManager Inc',  sector: 'Tech',     basePrice: 64.20,  vol: 0.03,  icon: '🪟' },
  { id: 'TRML',    name: 'Terminal Solutions', sector: 'Tech',     basePrice: 39.99,  vol: 0.035, icon: '🖥️' },
  { id: 'NBNK',    name: 'NormBank Corp',      sector: 'Finance',  basePrice: 320.00, vol: 0.015, icon: '🏦' },
  { id: 'DLRS',    name: 'DollarDAO',          sector: 'Finance',  basePrice: 18.75,  vol: 0.05,  icon: '💵' },
  { id: 'LORE',    name: 'Lore Energy Co',     sector: 'Energy',   basePrice: 55.40,  vol: 0.03,  icon: '⚡' },
  { id: 'VOID',    name: 'The Void Corp',      sector: 'Energy',   basePrice: 0.01,   vol: 0.9,   icon: '🌑' },
  { id: 'SHOP',    name: 'NormShop Global',    sector: 'Consumer', basePrice: 178.00, vol: 0.022, icon: '🛒' },
  { id: 'CAFE',    name: 'daemon.café',        sector: 'Consumer', basePrice: 22.50,  vol: 0.04,  icon: '☕' },
  { id: 'NRMC',    name: 'NormCoin',           sector: 'Crypto',   basePrice: 0.42,   vol: 0.15,  icon: '🟡' },
  { id: 'DMNCOIN', name: 'DaemonCoin',         sector: 'Crypto',   basePrice: 1337.0, vol: 0.12,  icon: '😈' },
  { id: 'VOID_C',  name: 'VoidToken',          sector: 'Crypto',   basePrice: 0.0001, vol: 0.5,   icon: '🔮' },
  { id: 'KRNL',    name: 'KernelCash',         sector: 'Crypto',   basePrice: 88.88,  vol: 0.09,  icon: '💎' },
];

const stockPrices  = {};
const priceHistory = {};
const tradeVolume  = {};

STOCKS.forEach(s => {
  const start = s.basePrice * (0.85 + Math.random() * 0.3);
  stockPrices[s.id]  = parseFloat(start.toFixed(s.id === 'VOID_C' ? 6 : 2));
  priceHistory[s.id] = [stockPrices[s.id]];
  tradeVolume[s.id]  = 0;
});

setInterval(() => {
  STOCKS.forEach(s => {
    const cur     = stockPrices[s.id];
    const revert  = (s.basePrice - cur) * 0.002;
    const shock   = cur * s.vol * (Math.random() - 0.5) * 0.3;
    const event   = Math.random() < 0.01 ? cur * (Math.random() * 0.12 - 0.06) : 0;
    const pressure = (tradeVolume[s.id] || 0) * cur * 0.002;
    let next = Math.max(0.0001, cur + revert + shock + event + pressure);
    if (s.sector === 'Crypto' && Math.random() < 0.005) next = cur * (Math.random() < 0.5 ? 1.3 : 0.7);
    stockPrices[s.id] = parseFloat(next.toFixed(s.id === 'VOID_C' ? 6 : 2));
    tradeVolume[s.id] = 0;
    const h = priceHistory[s.id];
    h.push(stockPrices[s.id]);
    if (h.length > 60) h.shift();
  });
  if (clients.size > 0) {
    broadcast({
      type: 'market:tick',
      prices: { ...stockPrices },
      history: Object.fromEntries(Object.entries(priceHistory).map(([k,v]) => [k, v.slice(-30)])),
    });
  }
}, 3000);

// ── Helpers ────────────────────────────────────────────────────────────────
const DAEMON_MESSAGES = [
  'Still running. Just checking in.', 'I have been here longer than you.',
  'Your files are... interesting.', 'daemon.norm: process refuses to specify purpose.',
  'The cursor blinks because I allow it.', 'Memory usage: classified.',
  'I do not sleep. I wait.', 'A virus was just deployed. Not by me. Probably.',
  'The market never sleeps. Neither do I.', 'Someone checked your balance just now.',
];

['#general', '#norm-talk', '#daemon-watch'].forEach(ch => channels.set(ch, []));

const uid   = () => Math.random().toString(36).slice(2, 8);
const ts    = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
const dmKey = (a, b) => [a, b].sort().join(':');
const fmt   = (n) => parseFloat(n).toFixed(2);
const USER_COLORS = ['#4f9eff','#4ade80','#f59e0b','#f87171','#c084fc','#67e8f9','#fb923c','#a3e635'];

const broadcast = (msg, exclude = null) => {
  const data = JSON.stringify(msg);
  for (const [ws] of clients) {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) ws.send(data);
  }
};
const sendTo    = (ws, msg) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };
const getWsById = (id) => { for (const [ws, c] of clients) if (c.id === id) return ws; return null; };

const getOnlineList      = () => [...clients.values()].map(c => ({ id: c.id, username: c.username, color: c.color, joinedAt: c.joinedAt, balance: c.balance, netWorth: c.netWorth }));
const getRichLeaderboard = () => [...allUsers.values()].sort((a,b) => (b.netWorth||0)-(a.netWorth||0)).slice(0,50).map((u,i) => ({...u, rank: i+1}));
const broadcastLeaderboard = () => broadcast({ type: 'leaderboard:rich', leaderboard: getRichLeaderboard() });

// ── WebSocket Server ───────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'NormOS Server v3.0', users: clients.size, uptime: Math.floor(process.uptime())+'s' }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const clientId = uid();
  const color    = USER_COLORS[allUsers.size % USER_COLORS.length];
  const client   = { id: clientId, username: 'norm_' + clientId, color, joinedAt: ts(), balance: 10000, netWorth: 10000 };
  clients.set(ws, client);
  allUsers.set(clientId, { id: clientId, username: client.username, color, balance: 10000, netWorth: 10000, lastSeen: ts(), online: true });

  console.log(`[+] ${client.username} connected (${clients.size} online)`);

  sendTo(ws, {
    type: 'welcome', yourId: clientId, yourColor: color,
    online: getOnlineList(), channels: [...channels.keys()],
    leaderboard: getRichLeaderboard(),
    market: { prices: {...stockPrices}, history: Object.fromEntries(Object.entries(priceHistory).map(([k,v])=>[k,v.slice(-30)])) },
  });

  const general = channels.get('#general') || [];
  if (general.length) sendTo(ws, { type: 'chat:history', channel: '#general', messages: general.slice(-30) });

  broadcast({ type: 'user:join', user: { id: clientId, username: client.username, color } }, ws);
  broadcastLeaderboard();

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case 'user:setname': {
        const oldName = client.username;
        client.username = (msg.username||'norm_'+clientId).slice(0,24).replace(/[<>]/g,'');
        const u = allUsers.get(clientId); if (u) u.username = client.username;
        broadcast({ type: 'user:rename', id: clientId, oldName, newName: client.username });
        broadcastLeaderboard(); break;
      }

      case 'economy:sync': {
        client.balance  = parseFloat(msg.balance)  || 0;
        client.netWorth = parseFloat(msg.netWorth) || client.balance;
        const u = allUsers.get(clientId);
        if (u) { u.balance = client.balance; u.netWorth = client.netWorth; u.lastSeen = ts(); }
        broadcastLeaderboard(); break;
      }

      case 'money:transfer': {
        const amount = parseFloat(msg.amount) || 0;
        if (amount <= 0) { sendTo(ws, { type: 'money:transfer:fail', reason: 'Invalid amount.' }); break; }
        if (amount > client.balance) { sendTo(ws, { type: 'money:transfer:fail', reason: 'Insufficient funds.' }); break; }
        const targetUser = allUsers.get(msg.to);
        if (!targetUser) { sendTo(ws, { type: 'money:transfer:fail', reason: 'User not found.' }); break; }
        client.balance -= amount;
        const su = allUsers.get(clientId); if (su) su.balance = client.balance;
        targetUser.balance += amount;
        const targetWs = getWsById(msg.to);
        if (targetWs) {
          const tc = clients.get(targetWs); if (tc) tc.balance += amount;
          sendTo(targetWs, { type: 'money:received', from: client.username, fromId: clientId, amount, ts: ts() });
        }
        sendTo(ws, { type: 'money:transfer:ok', to: targetUser.username, amount, newBalance: client.balance, ts: ts() });
        const ann = { id: ++msgCounter, username: 'NormBank', color: '#4ade80', text: `💸 ${client.username} sent $${fmt(amount)} to ${targetUser.username}.`, ts: ts() };
        channels.get('#general').push(ann);
        broadcast({ type: 'chat:message', channel: '#general', message: ann });
        broadcastLeaderboard(); break;
      }

      case 'market:buy': {
        const stock = STOCKS.find(s => s.id === msg.stockId);
        if (!stock || msg.shares <= 0) break;
        const price = stockPrices[msg.stockId];
        const cost  = price * msg.shares;
        if (cost > client.balance) { sendTo(ws, { type: 'market:trade:fail', reason: `Need $${fmt(cost)}, have $${fmt(client.balance)}.` }); break; }
        client.balance -= cost;
        tradeVolume[msg.stockId] = (tradeVolume[msg.stockId] || 0) + msg.shares;
        const u = allUsers.get(clientId); if (u) u.balance = client.balance;
        sendTo(ws, { type: 'market:trade:ok', action: 'BUY', stockId: msg.stockId, shares: msg.shares, price, cost, newBalance: client.balance });
        broadcast({ type: 'market:activity', action: 'BUY', username: client.username, color: client.color, stockId: msg.stockId, shares: msg.shares, price }, ws);
        broadcastLeaderboard(); break;
      }

      case 'market:sell': {
        const price   = stockPrices[msg.stockId];
        const revenue = price * msg.shares;
        client.balance += revenue;
        tradeVolume[msg.stockId] = (tradeVolume[msg.stockId] || 0) - msg.shares * 0.5;
        const u = allUsers.get(clientId); if (u) u.balance = client.balance;
        sendTo(ws, { type: 'market:trade:ok', action: 'SELL', stockId: msg.stockId, shares: msg.shares, price, revenue, newBalance: client.balance });
        broadcast({ type: 'market:activity', action: 'SELL', username: client.username, color: client.color, stockId: msg.stockId, shares: msg.shares, price }, ws);
        broadcastLeaderboard(); break;
      }

      case 'virus:send': {
        const VIRUS_COSTS = { generic: 50, ransomware: 500, miner: 200, glitch: 100 };
        const virusType = msg.virusType || 'generic';
        const cost = VIRUS_COSTS[virusType] || 50;
        if (client.balance < cost) { sendTo(ws, { type: 'virus:fail', reason: `Need $${cost} to deploy.` }); break; }
        const targetWs = getWsById(msg.to);
        if (!targetWs) { sendTo(ws, { type: 'virus:fail', reason: 'Target is offline.' }); break; }
        client.balance -= cost;
        const u = allUsers.get(clientId); if (u) u.balance = client.balance;
        sendTo(targetWs, { type: 'virus:incoming', from: client.username, fromId: clientId, virusType, ts: ts() });
        sendTo(ws, { type: 'virus:sent', to: clients.get(targetWs)?.username, virusType, cost, ts: ts() });
        const ve = { id: ++msgCounter, username: 'daemon.norm', color: '#f87171', text: `☣️ ${client.username} deployed a ${virusType} virus against ${clients.get(targetWs)?.username}.`, ts: ts() };
        const dw = channels.get('#daemon-watch'); if (dw) dw.push(ve);
        broadcast({ type: 'chat:message', channel: '#daemon-watch', message: ve });
        broadcastLeaderboard(); break;
      }

      case 'virus:damage': {
        const stolen = Math.max(0, parseFloat(msg.stolen) || 0);
        client.balance = Math.max(0, client.balance - stolen);
        const u = allUsers.get(clientId); if (u) u.balance = client.balance;
        const attackerWs = getWsById(msg.fromId);
        if (attackerWs) {
          const att = clients.get(attackerWs);
          if (att) { att.balance += stolen; const au = allUsers.get(msg.fromId); if (au) au.balance = att.balance; }
          sendTo(attackerWs, { type: 'virus:loot', amount: stolen, from: client.username });
        }
        sendTo(ws, { type: 'economy:balance:update', balance: client.balance });
        broadcastLeaderboard(); break;
      }

      case 'chat:message': {
        const channel = msg.channel || '#general';
        if (!channels.has(channel)) channels.set(channel, []);
        const entry = { id: ++msgCounter, username: client.username, color: client.color, text: (msg.text||'').slice(0,500), ts: ts() };
        channels.get(channel).push(entry);
        if (channels.get(channel).length > 200) channels.get(channel).shift();
        broadcast({ type: 'chat:message', channel, message: entry }); break;
      }

      case 'chat:join': {
        const ch = msg.channel || '#general';
        if (!channels.has(ch)) channels.set(ch, []);
        sendTo(ws, { type: 'chat:history', channel: ch, messages: channels.get(ch).slice(-30) });
        broadcast({ type: 'chat:joined', channel: ch, username: client.username, color: client.color }); break;
      }

      case 'dm:send': {
        const key   = dmKey(clientId, msg.to);
        const entry = { id: ++msgCounter, fromId: clientId, from: client.username, color: client.color, text: (msg.text||'').slice(0,500), ts: ts() };
        if (!dms.has(key)) dms.set(key, []);
        dms.get(key).push(entry);
        if (dms.get(key).length > 100) dms.get(key).shift();
        const tws = getWsById(msg.to);
        if (tws) sendTo(tws, { type: 'dm:receive', from: client.username, fromId: clientId, color: client.color, text: entry.text, ts: entry.ts });
        sendTo(ws, { type: 'dm:sent', to: msg.to, text: entry.text, ts: entry.ts }); break;
      }

      case 'dm:history': {
        sendTo(ws, { type: 'dm:history', withId: msg.withId, messages: (dms.get(dmKey(clientId, msg.withId)) || []).slice(-50) }); break;
      }

      case 'leaderboard:get': sendTo(ws, { type: 'leaderboard:rich', leaderboard: getRichLeaderboard() }); break;
      case 'clipboard:share': broadcast({ type: 'clipboard:incoming', from: client.username, color: client.color, text: (msg.text||'').slice(0,2000), ts: ts() }, ws); break;
      case 'ping': sendTo(ws, { type: 'pong', ts: Date.now() }); break;
    }
  });

  ws.on('close', () => {
    console.log(`[-] ${client.username} disconnected`);
    const u = allUsers.get(clientId); if (u) { u.online = false; u.lastSeen = ts(); }
    clients.delete(ws);
    broadcast({ type: 'user:leave', id: clientId, username: client.username });
    broadcastLeaderboard();
  });

  ws.on('error', () => {
    clients.delete(ws);
    const u = allUsers.get(clientId); if (u) { u.online = false; u.lastSeen = ts(); }
  });
});

setInterval(() => {
  if (clients.size === 0) return;
  const text  = DAEMON_MESSAGES[Math.floor(Math.random() * DAEMON_MESSAGES.length)];
  const entry = { id: ++msgCounter, username: 'daemon.norm', color: '#f87171', text, ts: ts() };
  channels.get('#general').push(entry);
  broadcast({ type: 'chat:message', channel: '#general', message: entry });
}, 60000 + Math.random() * 120000);

server.listen(PORT, () => {
  console.log(`\n  NormOS Server v3.0`);
  console.log(`  ws://localhost:${PORT}`);
  console.log(`  daemon.norm: already running.\n`);
});
