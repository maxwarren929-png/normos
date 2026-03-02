/**
 * NormOS — js/network.js
 * Client-side WebSocket connector for NormOS multiplayer.
 * 
 * Exposes: window.Network
 * 
 * Features:
 *   - Auto-connect / auto-reconnect
 *   - Online user presence
 *   - Chat message routing
 *   - Snake leaderboard sync
 *   - Shared clipboard
 *   - Taskbar online indicator
 */

const Network = (() => {
  const SERVER_URL = 'ws://localhost:3001';
  const RECONNECT_DELAY = 4000;

  let ws = null;
  let connected = false;
  let reconnectTimer = null;

  // Local state
  const state = {
    myId: null,
    myColor: '#4f9eff',
    username: null,
    online: [],
    leaderboard: [],
    channels: [],
  };

  // Event listeners: type → [fn]
  const listeners = {};

  const on = (type, fn) => {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(fn);
  };

  const off = (type, fn) => {
    if (listeners[type]) listeners[type] = listeners[type].filter(f => f !== fn);
  };

  const emit = (type, data) => {
    (listeners[type] || []).forEach(fn => { try { fn(data); } catch(e) {} });
  };

  // ── Send ───────────────────────────────────────────────────────────────
  const send = (msg) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  };

  // ── Connect ────────────────────────────────────────────────────────────
  const connect = () => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    try {
      ws = new WebSocket(SERVER_URL);
    } catch (e) {
      scheduleReconnect();
      return;
    }

    ws.addEventListener('open', () => {
      connected = true;
      clearTimeout(reconnectTimer);
      console.log('[Network] Connected to NormOS server');
      updateTaskbarIndicator(true);
      emit('connected', {});

      // Set username from OS state
      const username = OS?.state?.username;
      if (username) setUsername(username);
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      handleMessage(msg);
    });

    ws.addEventListener('close', () => {
      connected = false;
      updateTaskbarIndicator(false);
      emit('disconnected', {});
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      connected = false;
      updateTaskbarIndicator(false);
    });
  };

  const scheduleReconnect = () => {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => connect(), RECONNECT_DELAY);
  };

  // ── Message Handler ────────────────────────────────────────────────────
  const handleMessage = (msg) => {
    switch (msg.type) {

      case 'welcome':
        state.myId       = msg.yourId;
        state.myColor    = msg.yourColor;
        state.online     = msg.online || [];
        state.leaderboard = msg.leaderboard || [];
        state.channels   = msg.channels || [];
        emit('welcome', msg);
        emit('online:update', state.online);
        emit('leaderboard:update', state.leaderboard);
        updateOnlineCount();
        break;

      case 'user:join':
        state.online.push(msg.user);
        emit('user:join', msg.user);
        emit('online:update', state.online);
        updateOnlineCount();
        if (typeof OS !== 'undefined') {
          OS.notify('🟢', 'NormOS', `${msg.user.username} joined the network`);
        }
        break;

      case 'user:leave':
        state.online = state.online.filter(u => u.id !== msg.id);
        emit('user:leave', msg);
        emit('online:update', state.online);
        updateOnlineCount();
        break;

      case 'user:rename':
        const u = state.online.find(u => u.id === msg.id);
        if (u) u.username = msg.newName;
        emit('user:rename', msg);
        emit('online:update', state.online);
        break;

      case 'chat:message':
        emit('chat:message', msg);
        break;

      case 'chat:history':
        emit('chat:history', msg);
        break;

      case 'chat:joined':
        emit('chat:joined', msg);
        break;

      case 'leaderboard:update':
        state.leaderboard = msg.leaderboard;
        emit('leaderboard:update', msg.leaderboard);
        break;

      case 'clipboard:incoming':
        emit('clipboard:incoming', msg);
        if (typeof OS !== 'undefined') {
          OS.notify('📋', `Clipboard from ${msg.from}`, msg.text.slice(0, 60) + (msg.text.length > 60 ? '…' : ''));
        }
        break;

      case 'pong':
        emit('pong', msg);
        break;
    }
  };

  // ── Taskbar indicator ──────────────────────────────────────────────────
  const updateTaskbarIndicator = (online) => {
    let indicator = document.getElementById('net-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.id = 'net-indicator';
      indicator.className = 'tray-icon';
      indicator.title = 'NormNet Multiplayer';
      indicator.style.cssText = 'cursor:pointer;font-size:0.7rem;display:flex;align-items:center;gap:3px;';
      indicator.addEventListener('click', () => {
        if (typeof OS !== 'undefined') OS.apps.open('chat');
      });
      const tray = document.getElementById('taskbar-tray');
      if (tray) tray.prepend(indicator);
    }

    const count = state.online.length;
    indicator.innerHTML = online
      ? `<span style="color:#4ade80;font-size:0.6rem">●</span><span style="font-size:0.65rem;color:var(--text2)">${count}</span>`
      : `<span style="color:#f87171;font-size:0.6rem">●</span>`;
    indicator.title = online ? `${count} user(s) online` : 'NormNet: offline';
  };

  const updateOnlineCount = () => {
    updateTaskbarIndicator(connected);
  };

  // ── Public API ─────────────────────────────────────────────────────────
  const setUsername = (name) => {
    state.username = name;
    send({ type: 'user:setname', username: name });
  };

  const sendChat = (channel, text) => send({ type: 'chat:message', channel, text });

  const joinChannel = (channel) => send({ type: 'chat:join', channel });

  const submitScore = (score) => send({ type: 'score:submit', score });

  const shareClipboard = (text) => send({ type: 'clipboard:share', text });

  const ping = () => send({ type: 'ping' });

  const isConnected = () => connected;
  const getState    = () => ({ ...state });

  // Auto-connect when OS is ready
  const tryConnect = () => {
    if (typeof EventBus !== 'undefined') {
      EventBus.on('os:ready', connect);
    } else {
      // Fallback: connect after DOM ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(connect, 2000));
      } else {
        setTimeout(connect, 2000);
      }
    }
  };

  tryConnect();

  return { on, off, connect, send, setUsername, sendChat, joinChannel, submitScore, shareClipboard, ping, isConnected, getState };
})();