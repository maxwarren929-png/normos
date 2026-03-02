/**
 * NormOS — js/network.js v3.0
 * Handles: chat, DMs, leaderboard, shared market, money transfers, virus attacks
 */

const Network = (() => {
  const SERVER_URL      = 'wss://normos-server.onrender.com';
  const RECONNECT_DELAY = 4000;

  let ws = null, connected = false, reconnectTimer = null;

  const state = {
    myId: null, myColor: '#4f9eff', username: null,
    online: [], leaderboard: [], channels: [],
    marketPrices: {}, marketHistory: {},
  };

  const listeners = {};
  const on   = (type, fn) => { if (!listeners[type]) listeners[type] = []; listeners[type].push(fn); };
  const off  = (type, fn) => { if (listeners[type]) listeners[type] = listeners[type].filter(f => f !== fn); };
  const emit = (type, data) => (listeners[type] || []).forEach(fn => { try { fn(data); } catch(e) {} });

  const send = (msg) => {
    if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(msg)); return true; }
    return false;
  };

  const connect = () => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    try { ws = new WebSocket(SERVER_URL); } catch(e) { scheduleReconnect(); return; }

    ws.addEventListener('open', () => {
      connected = true;
      clearTimeout(reconnectTimer);
      updateTaskbarIndicator(true);
      emit('connected', {});
      const username = typeof OS !== 'undefined' ? OS?.state?.username : null;
      if (username) setUsername(username);
      // Sync economy on connect
      setTimeout(syncEconomy, 1000);
    });

    ws.addEventListener('message', (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      handleMessage(msg);
    });

    ws.addEventListener('close', () => {
      connected = false; updateTaskbarIndicator(false);
      emit('disconnected', {}); scheduleReconnect();
    });

    ws.addEventListener('error', () => { connected = false; updateTaskbarIndicator(false); });
  };

  const scheduleReconnect = () => { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connect, RECONNECT_DELAY); };

  const syncEconomy = () => {
    if (typeof Economy !== 'undefined' && connected) {
      send({ type: 'economy:sync', balance: Economy.state.balance, netWorth: Economy.totalValue() });
    }
  };

  const handleMessage = (msg) => {
    switch (msg.type) {

      case 'welcome':
        state.myId          = msg.yourId;
        state.myColor       = msg.yourColor;
        state.online        = msg.online || [];
        state.leaderboard   = msg.leaderboard || [];
        state.channels      = msg.channels || [];
        if (msg.market) { state.marketPrices = msg.market.prices || {}; state.marketHistory = msg.market.history || {}; }
        emit('welcome', msg);
        emit('online:update', state.online);
        emit('leaderboard:rich', { leaderboard: state.leaderboard });
        emit('market:tick', { prices: state.marketPrices, history: state.marketHistory });
        updateOnlineCount();
        break;

      case 'user:join':
        state.online.push(msg.user);
        emit('user:join', msg.user); emit('online:update', state.online); updateOnlineCount();
        if (typeof OS !== 'undefined') OS.notify('🟢', 'NormOS', `${msg.user.username} joined the network`);
        break;

      case 'user:leave':
        state.online = state.online.filter(u => u.id !== msg.id);
        emit('user:leave', msg); emit('online:update', state.online); updateOnlineCount();
        break;

      case 'user:rename':
        const u = state.online.find(u => u.id === msg.id);
        if (u) u.username = msg.newName;
        emit('user:rename', msg); emit('online:update', state.online);
        break;

      case 'chat:message':   emit('chat:message', msg); break;
      case 'chat:history':   emit('chat:history', msg); break;
      case 'chat:joined':    emit('chat:joined', msg); break;

      case 'leaderboard:rich':
        state.leaderboard = msg.leaderboard;
        emit('leaderboard:rich', msg);
        break;

      // ── Market ────────────────────────────────────────────────────────────
      case 'market:tick':
        state.marketPrices  = msg.prices  || state.marketPrices;
        state.marketHistory = msg.history || state.marketHistory;
        emit('market:tick', msg);
        break;

      case 'market:activity': emit('market:activity', msg); break;
      case 'market:trade:ok': emit('market:trade:ok', msg); break;
      case 'market:trade:fail': emit('market:trade:fail', msg); break;

      // ── Money transfers ───────────────────────────────────────────────────
      case 'money:received':
        emit('money:received', msg);
        if (typeof Economy !== 'undefined') {
          Economy.state.balance += msg.amount;
          Economy.save();
          Economy.updateWalletDisplay();
        }
        if (typeof OS !== 'undefined') OS.notify('💸', 'NormBank', `${msg.from} sent you $${msg.amount.toFixed(2)}!`);
        break;

      case 'money:transfer:ok':   emit('money:transfer:ok', msg); break;
      case 'money:transfer:fail': emit('money:transfer:fail', msg); break;

      // ── Virus ─────────────────────────────────────────────────────────────
      case 'virus:incoming':
        emit('virus:incoming', msg);
        handleVirusAttack(msg);
        break;

      case 'virus:sent': emit('virus:sent', msg); break;
      case 'virus:fail': emit('virus:fail', msg); break;
      case 'virus:loot':
        emit('virus:loot', msg);
        if (typeof Economy !== 'undefined') { Economy.state.balance += msg.amount; Economy.save(); Economy.updateWalletDisplay(); }
        if (typeof OS !== 'undefined') OS.notify('☣️', 'Virus Loot', `You stole $${msg.amount.toFixed(2)} from ${msg.from}!`);
        break;

      case 'economy:balance:update':
        if (typeof Economy !== 'undefined') { Economy.state.balance = msg.balance; Economy.save(); Economy.updateWalletDisplay(); }
        break;

      // ── DMs ───────────────────────────────────────────────────────────────
      case 'dm:receive':
        emit('dm:receive', msg);
        if (typeof OS !== 'undefined') OS.notify('💬', `DM from ${msg.from}`, (msg.text||'').slice(0,60));
        break;

      case 'dm:sent':    emit('dm:sent', msg); break;
      case 'dm:history': emit('dm:history', msg); break;

      case 'clipboard:incoming':
        emit('clipboard:incoming', msg);
        if (typeof OS !== 'undefined') OS.notify('📋', `Clipboard from ${msg.from}`, msg.text.slice(0,60));
        break;

      case 'pong': emit('pong', msg); break;
    }
  };

  // ── Virus attack handler ──────────────────────────────────────────────────
  const handleVirusAttack = (msg) => {
    const { virusType, from, fromId } = msg;

    const VIRUS_EFFECTS = {
      generic:    { drain: 0.05, duration: 5000,  glitch: false },
      glitch:     { drain: 0.02, duration: 8000,  glitch: true  },
      miner:      { drain: 0.10, duration: 15000, glitch: false },
      ransomware: { drain: 0.25, duration: 3000,  glitch: true  },
    };

    const effect = VIRUS_EFFECTS[virusType] || VIRUS_EFFECTS.generic;

    // Visual glitch effect
    const desktop = document.getElementById('desktop');
    const taskbar  = document.getElementById('taskbar');
    if (effect.glitch && desktop) {
      desktop.style.animation = 'none';
      let glitchCount = 0;
      const glitchInterval = setInterval(() => {
        const hue = Math.random() * 30 - 15;
        desktop.style.filter = `hue-rotate(${hue}deg) contrast(${1 + Math.random() * 0.3})`;
        if (taskbar) taskbar.style.filter = `hue-rotate(${-hue}deg)`;
        if (++glitchCount > 20) {
          clearInterval(glitchInterval);
          desktop.style.filter = '';
          if (taskbar) taskbar.style.filter = '';
        }
      }, effect.duration / 20);
    }

    // Show scary overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(248,113,113,0.15);z-index:99999;
      display:flex;align-items:center;justify-content:center;
      pointer-events:none;animation:pulse 0.5s infinite alternate;
    `;
    overlay.innerHTML = `
      <div style="background:#0a0a0a;border:2px solid #f87171;padding:24px 32px;border-radius:8px;text-align:center;pointer-events:none;max-width:400px;">
        <div style="font-size:2rem;margin-bottom:8px;">☣️</div>
        <div style="color:#f87171;font-size:1rem;font-weight:bold;margin-bottom:4px;">VIRUS DETECTED</div>
        <div style="color:#fca5a5;font-size:0.78rem;margin-bottom:4px;">${virusType.toUpperCase()} deployed by ${from}</div>
        <div style="color:#6b7280;font-size:0.7rem;">Draining ${(effect.drain * 100).toFixed(0)}% of your balance...</div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), effect.duration);

    // Drain money after delay
    setTimeout(() => {
      if (typeof Economy !== 'undefined') {
        const stolen = Economy.state.balance * effect.drain;
        send({ type: 'virus:damage', fromId, stolen });
        if (typeof OS !== 'undefined') OS.notify('☣️', 'Virus Attack!', `${from} stole $${stolen.toFixed(2)} with a ${virusType}!`);
      }
    }, effect.duration);
  };

  // ── Taskbar indicator ──────────────────────────────────────────────────────
  const updateTaskbarIndicator = (online) => {
    let el = document.getElementById('net-indicator');
    if (!el) {
      el = document.createElement('span');
      el.id = 'net-indicator';
      el.className = 'tray-icon';
      el.style.cssText = 'cursor:pointer;font-size:0.7rem;display:flex;align-items:center;gap:3px;';
      el.addEventListener('click', () => { if (typeof OS !== 'undefined') OS.apps.open('leaderboard'); });
      const tray = document.getElementById('taskbar-tray');
      if (tray) tray.prepend(el);
    }
    const count = state.online.length;
    el.innerHTML = online
      ? `<span style="color:#4ade80;font-size:0.6rem">●</span><span style="font-size:0.65rem;color:var(--text2)">${count}</span>`
      : `<span style="color:#f87171;font-size:0.6rem">●</span>`;
    el.title = online ? `${count} online` : 'NormNet: offline';
  };

  const updateOnlineCount = () => updateTaskbarIndicator(connected);

  // ── Public API ─────────────────────────────────────────────────────────────
  const setUsername    = (n)         => { state.username = n; send({ type: 'user:setname', username: n }); };
  const sendChat       = (ch, text)  => send({ type: 'chat:message', channel: ch, text });
  const joinChannel    = (ch)        => send({ type: 'chat:join', channel: ch });
  const shareClipboard = (text)      => send({ type: 'clipboard:share', text });
  const sendDm         = (to, text)  => send({ type: 'dm:send', to, text });
  const getDmHistory   = (withId)    => send({ type: 'dm:history', withId });
  const transferMoney  = (to, amt)   => send({ type: 'money:transfer', to, amount: amt });
  const sendVirus      = (to, type)  => send({ type: 'virus:send', to, virusType: type });
  const buyStock       = (id, sh)    => send({ type: 'market:buy',  stockId: id, shares: sh });
  const sellStock      = (id, sh)    => send({ type: 'market:sell', stockId: id, shares: sh });
  const ping           = ()          => send({ type: 'ping' });
  const isConnected    = ()          => connected;
  const getState       = ()          => ({ ...state });

  // Auto-connect — reduced delay so WS connects faster
  const tryConnect = () => {
    if (typeof EventBus !== 'undefined') { EventBus.on('os:ready', connect); }
    else if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => setTimeout(connect, 500)); }
    else { setTimeout(connect, 500); }
  };

  // Sync economy every 10s
  setInterval(() => { if (connected) syncEconomy(); }, 10000);

  // Keep-alive ping every 25s so Render never sleeps mid-session
  setInterval(() => {
    if (connected) {
      ping();
    } else {
      // Wake the server via HTTP while disconnected so WS reconnect succeeds
      fetch('https://normos-server.onrender.com').catch(() => {});
    }
  }, 25000);

  // Hit the HTTP endpoint first to wake Render before attempting WebSocket
  fetch('https://normos-server.onrender.com').catch(() => {});
  tryConnect();

  return {
    on, off, send, connect,
    setUsername, sendChat, joinChannel, shareClipboard,
    sendDm, getDmHistory, transferMoney, sendVirus,
    buyStock, sellStock, ping, isConnected, getState,
    syncEconomy,
  };
})();
