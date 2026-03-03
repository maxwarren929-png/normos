/**
 * NormOS — js/network.js v4.0
 * Handles: auth, chat, DMs, leaderboard, shared market, money transfers, virus
 */

const Network = (() => {
  const SERVER_URL      = 'wss://normos.onrender.com';
  const RECONNECT_DELAY = 4000;

  let ws = null, connected = false, reconnectTimer = null;

  const state = {
    myId: null, myColor: '#4f9eff', username: null,
    authenticated: false,
    online: [], leaderboard: [], channels: [],
    marketPrices: {}, marketHistory: {},
    bankBalance: 0, bankDeposit: 0, bankCreditScore: 0,
  };

  const listeners = {};
  const on   = (t,fn) => { if(!listeners[t]) listeners[t]=[]; listeners[t].push(fn); };
  const off  = (t,fn) => { if(listeners[t]) listeners[t]=listeners[t].filter(f=>f!==fn); };
  const emit = (t,d)  => (listeners[t]||[]).forEach(fn=>{ try{fn(d);}catch(e){} });

  const send = (msg) => {
    if(ws && ws.readyState===WebSocket.OPEN){ ws.send(JSON.stringify(msg)); return true; }
    return false;
  };

  const connect = () => {
    if(ws&&(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING)) return;
    try{ ws=new WebSocket(SERVER_URL); }catch(e){ scheduleReconnect(); return; }

    ws.addEventListener('open',()=>{
      connected=true; clearTimeout(reconnectTimer);
      updateTaskbarIndicator(true); emit('connected',{});
    });
    ws.addEventListener('message',(ev)=>{
      let msg; try{msg=JSON.parse(ev.data);}catch{return;}
      handleMessage(msg);
    });
    ws.addEventListener('close',()=>{
      connected=false; state.authenticated=false;
      updateTaskbarIndicator(false); emit('disconnected',{}); scheduleReconnect();
    });
    ws.addEventListener('error',()=>{ connected=false; updateTaskbarIndicator(false); });
  };

  const scheduleReconnect=()=>{ clearTimeout(reconnectTimer); reconnectTimer=setTimeout(connect,RECONNECT_DELAY); };

  const handleMessage=(msg)=>{
    switch(msg.type){
      case 'auth:required': emit('auth:required',msg); break;
      case 'auth:error':    emit('auth:error',msg); break;
      case 'auth:kicked':   emit('auth:kicked',msg); alert('You were kicked: '+msg.message); break;

      case 'auth:ok':
        state.myId=msg.id; state.myColor=msg.color; state.username=msg.username;
        state.authenticated=true;
        state.online=msg.online||[]; state.channels=msg.channels||[];
        state.leaderboard=msg.leaderboard||[];
        state.bankBalance=msg.balance||0; state.bankDeposit=msg.deposit||0;
        state.bankCreditScore=msg.creditScore||0;
        if(msg.market){state.marketPrices=msg.market.prices||{};state.marketHistory=msg.market.history||{};}
        // Server is source of truth — overwrite local Economy balance
        if(typeof Economy!=='undefined'){ Economy.state.balance=msg.balance||0; Economy.save(); Economy.updateWalletDisplay(); }
        emit('auth:ok',msg); emit('welcome',msg);
        emit('online:update',state.online);
        emit('leaderboard:rich',{leaderboard:state.leaderboard});
        emit('market:tick',{prices:state.marketPrices,history:state.marketHistory});
        updateOnlineCount();
        break;

      case 'user:join':
        state.online.push(msg.user); emit('user:join',msg.user);
        emit('online:update',state.online); updateOnlineCount();
        if(typeof OS!=='undefined') OS.notify('🟢','NormOS',`${msg.user.username} joined`);
        break;
      case 'user:leave':
        state.online=state.online.filter(u=>u.id!==msg.id);
        emit('user:leave',msg); emit('online:update',state.online); updateOnlineCount();
        break;
      case 'user:rename':
        { const u=state.online.find(u=>u.id===msg.id); if(u) u.username=msg.newName; }
        emit('user:rename',msg); emit('online:update',state.online);
        break;

      case 'chat:message':  emit('chat:message',msg); break;
      case 'chat:history':  emit('chat:history',msg); break;
      case 'chat:joined':   emit('chat:joined',msg); break;

      case 'leaderboard:rich':
        state.leaderboard=msg.leaderboard; emit('leaderboard:rich',msg); break;

      case 'market:tick':
        state.marketPrices=msg.prices||state.marketPrices;
        state.marketHistory=msg.history||state.marketHistory;
        if(typeof Economy!=='undefined'){
          Object.assign(Economy.state.prices,state.marketPrices);
          Object.keys(state.marketHistory).forEach(k=>{
            if(state.marketHistory[k]) Economy.state.priceHistory[k]=state.marketHistory[k];
          });
          Economy.state.listeners.forEach(fn=>{try{fn();}catch{}});
          Economy.updateWalletDisplay();
        }
        emit('market:tick',msg); break;

      case 'market:activity': emit('market:activity',msg); break;
      case 'market:trade:ok':
        if(typeof Economy!=='undefined'){ Economy.state.balance=msg.newBalance; Economy.save(); Economy.updateWalletDisplay(); }
        emit('market:trade:ok',msg); break;
      case 'market:trade:fail': emit('market:trade:fail',msg); break;

      case 'money:received':
        if(typeof Economy!=='undefined'){ Economy.state.balance+=msg.amount; Economy.save(); Economy.updateWalletDisplay(); }
        emit('money:received',msg);
        if(typeof OS!=='undefined') OS.notify('💸','NormBank',`${msg.from} sent you $${msg.amount.toFixed(2)}!`);
        break;
      case 'money:transfer:ok':
        if(typeof Economy!=='undefined'){ Economy.state.balance=msg.newBalance; Economy.save(); Economy.updateWalletDisplay(); }
        emit('money:transfer:ok',msg); break;
      case 'money:transfer:fail': emit('money:transfer:fail',msg); break;

      case 'bank:update':
        state.bankBalance=msg.balance; state.bankDeposit=msg.deposit||0;
        state.bankCreditScore=msg.creditScore||0;
        if(msg.balance!==undefined&&typeof Economy!=='undefined'){ Economy.state.balance=msg.balance; Economy.save(); Economy.updateWalletDisplay(); }
        emit('bank:update',msg); break;
      case 'bank:interest': emit('bank:interest',msg); break;
      case 'bank:loan:approved':
        if(msg.newBalance!==undefined&&typeof Economy!=='undefined'){ Economy.state.balance=msg.newBalance; Economy.save(); Economy.updateWalletDisplay(); }
        emit('bank:loan:approved',msg); break;
      case 'bank:loan:repaid':
        if(msg.newBalance!==undefined&&typeof Economy!=='undefined'){ Economy.state.balance=msg.newBalance; Economy.save(); Economy.updateWalletDisplay(); }
        emit('bank:loan:repaid',msg); break;
      case 'bank:loan:defaulted':
        if(typeof Economy!=='undefined'){ Economy.state.balance=0; Economy.save(); Economy.updateWalletDisplay(); }
        emit('bank:loan:defaulted',msg); break;
      case 'bank:error': emit('bank:error',msg); break;

      case 'virus:incoming': emit('virus:incoming',msg); handleVirusAttack(msg); break;
      case 'virus:sent':  emit('virus:sent',msg); break;
      case 'virus:fail':  emit('virus:fail',msg); break;
      case 'virus:loot':
        if(typeof Economy!=='undefined'){ Economy.state.balance+=msg.amount; Economy.save(); Economy.updateWalletDisplay(); }
        emit('virus:loot',msg);
        if(typeof OS!=='undefined') OS.notify('☣️','Loot',`Stole $${msg.amount.toFixed(2)} from ${msg.from}!`);
        break;

      case 'economy:balance:update':
        if(typeof Economy!=='undefined'){ Economy.state.balance=msg.balance; Economy.save(); Economy.updateWalletDisplay(); }
        break;

      case 'dm:receive':
        emit('dm:receive',msg);
        if(typeof OS!=='undefined') OS.notify('💬',`DM from ${msg.from}`,(msg.text||'').slice(0,60));
        break;
      case 'dm:sent':    emit('dm:sent',msg); break;
      case 'dm:history': emit('dm:history',msg); break;

      case 'clipboard:incoming':
        emit('clipboard:incoming',msg);
        if(typeof OS!=='undefined') OS.notify('📋',`Clipboard from ${msg.from}`,msg.text.slice(0,60));
        break;
      case 'pong': emit('pong',msg); break;
    }
  };

  // ── Virus / hacking minigame ──────────────────────────────────────────────
  const handleVirusAttack = (msg) => {
    const {virusType,from,fromId} = msg;

    // Check firewall
    try {
      const firewallUntil = parseInt(localStorage.getItem('normos_firewall_until') || '0');
      if (Date.now() < firewallUntil) {
        if(typeof OS!=='undefined') OS.notify('🔥','NormFirewall',`Blocked ${virusType} attack from ${from}!`);
        send({type:'virus:blocked',from:fromId});
        return;
      }
    } catch {}

    const EFFECTS = {
      generic:    {drain:0.05, duration:5000,  glitch:false},
      glitch:     {drain:0.02, duration:8000,  glitch:true},
      miner:      {drain:0.10, duration:15000, glitch:false},
      ransomware: {drain:0.25, duration:3000,  glitch:true},
    };
    const effect = EFFECTS[virusType] || EFFECTS.generic;
    showHackingMinigame(from, fromId, virusType, effect);
  };

  const showHackingMinigame = (from, fromId, virusType, effect) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;`;

    const SEQ_LEN = 6;
    const CHARS   = 'ABCDEF0123456789';
    const target  = Array.from({length:SEQ_LEN},()=>CHARS[Math.floor(Math.random()*CHARS.length)]).join('');
    let input = '', gameOver = false;
    const TIME_LIMIT = 15000;
    let timeLeft = TIME_LIMIT;

    overlay.innerHTML = `
      <div style="background:#0a0a0a;border:2px solid #f87171;border-radius:10px;padding:28px;text-align:center;max-width:420px;width:90%;">
        <div style="font-size:1.8rem;margin-bottom:6px;">☣️</div>
        <div style="color:#f87171;font-size:1rem;font-weight:bold;margin-bottom:4px;">HACK INCOMING: ${virusType.toUpperCase()}</div>
        <div style="color:#9ca3af;font-size:0.75rem;margin-bottom:14px;">Attack by <strong style="color:#f87171">${from}</strong></div>
        <div style="color:#4ade80;font-size:0.78rem;margin-bottom:6px;">Type the sequence to block the attack:</div>
        <div style="font-size:1.6rem;letter-spacing:0.3em;color:#4f9eff;font-family:monospace;background:#111;padding:10px 16px;border-radius:6px;margin-bottom:12px;" id="hack-target">${target}</div>
        <div style="font-size:1.4rem;letter-spacing:0.3em;color:#4ade80;font-family:monospace;background:#111;padding:8px 16px;border-radius:6px;margin-bottom:12px;min-height:44px;" id="hack-input">_</div>
        <div style="font-size:0.72rem;color:#6b7280;margin-bottom:10px;">Type using keyboard — case-insensitive</div>
        <div style="background:#1a1a1a;border-radius:4px;height:6px;overflow:hidden;margin-bottom:10px;">
          <div id="hack-timer-bar" style="height:100%;background:#4ade80;width:100%;transition:width 0.1s linear;border-radius:4px;"></div>
        </div>
        <div style="color:#9ca3af;font-size:0.7rem;" id="hack-status">Block the attack or lose ${(effect.drain*100).toFixed(0)}% of your balance</div>
      </div>
    `;
    document.body.appendChild(overlay);

    const timerInterval = setInterval(()=>{
      if(gameOver){clearInterval(timerInterval);return;}
      timeLeft -= 100;
      const bar = document.getElementById('hack-timer-bar');
      if(bar) bar.style.width = (timeLeft/TIME_LIMIT*100)+'%';
      if(timeLeft<=5000&&bar) bar.style.background='#f87171';
      if(timeLeft<=0){ clearInterval(timerInterval); resolveMiss(); }
    },100);

    const updateDisplay = () => {
      const el = document.getElementById('hack-input');
      if(el) el.textContent = (input||'_').padEnd(SEQ_LEN,'_').slice(0,SEQ_LEN);
    };

    const resolveWin = () => {
      gameOver=true; clearInterval(timerInterval);
      const el = document.getElementById('hack-status');
      if(el){el.textContent='✅ BLOCKED! Attack neutralized.';el.style.color='#4ade80';}
      setTimeout(()=>{
        overlay.remove();
        if(effect.glitch){
          const desktop=document.getElementById('desktop');
          if(desktop){ let g=0; const gi=setInterval(()=>{ desktop.style.filter=`hue-rotate(${Math.random()*10-5}deg)`; if(++g>5){clearInterval(gi);desktop.style.filter='';} },100); }
        }
        if(typeof Economy!=='undefined'){
          const stolen = Economy.state.balance*effect.drain*0.1;
          if(stolen>0) send({type:'virus:damage',fromId,fromUsername:from,stolen});
          if(typeof OS!=='undefined') OS.notify('🛡️','Hack Blocked',`Partial damage: -$${stolen.toFixed(2)}`);
        }
      },1500);
    };

    const resolveMiss = () => {
      gameOver=true; clearInterval(timerInterval);
      const el = document.getElementById('hack-status');
      if(el){el.textContent='❌ FAILED! Taking full damage...';el.style.color='#f87171';}
      setTimeout(()=>{
        overlay.remove();
        if(effect.glitch){
          const desktop=document.getElementById('desktop');
          if(desktop){ let g=0; const gi=setInterval(()=>{ const hue=Math.random()*30-15; desktop.style.filter=`hue-rotate(${hue}deg) contrast(${1+Math.random()*0.3})`; if(++g>20){clearInterval(gi);desktop.style.filter='';} },effect.duration/20); }
        }
        if(typeof Economy!=='undefined'){
          const stolen = Economy.state.balance*effect.drain;
          send({type:'virus:damage',fromId,fromUsername:from,stolen});
          if(typeof OS!=='undefined') OS.notify('☣️','Virus Hit!',`${from} stole $${stolen.toFixed(2)}!`);
        }
      },1500);
    };

    const onKey = (e) => {
      if(gameOver) return;
      const k = e.key.toUpperCase();
      if(k==='ESCAPE'){resolveMiss();document.removeEventListener('keydown',onKey);return;}
      if(CHARS.includes(k)&&input.length<SEQ_LEN){
        input+=k; updateDisplay();
        if(input.length===SEQ_LEN){
          if(input===target) resolveWin();
          else{ input=''; updateDisplay(); }
          document.removeEventListener('keydown',onKey);
        }
      }
    };
    document.addEventListener('keydown',onKey);
    setTimeout(()=>{ if(!gameOver){ resolveMiss(); document.removeEventListener('keydown',onKey); } },TIME_LIMIT+500);
  };

  // ── Taskbar indicator ─────────────────────────────────────────────────────
  const updateTaskbarIndicator = (online) => {
    let el = document.getElementById('net-indicator');
    if(!el){
      el = document.createElement('span'); el.id='net-indicator'; el.className='tray-icon';
      el.style.cssText = 'cursor:pointer;font-size:0.7rem;display:flex;align-items:center;gap:3px;';
      el.addEventListener('click',()=>{ if(typeof OS!=='undefined') OS.apps.open('leaderboard'); });
      const tray = document.getElementById('taskbar-tray');
      if(tray) tray.prepend(el);
    }
    const count = state.online.length;
    el.innerHTML = online
      ? `<span style="color:#4ade80;font-size:0.6rem">●</span><span style="font-size:0.65rem;color:var(--text2)">${count}</span>`
      : `<span style="color:#f87171;font-size:0.6rem">●</span>`;
    el.title = online ? `${count} online` : 'NormNet: offline';
  };
  const updateOnlineCount = () => updateTaskbarIndicator(connected);

  // ── Public API ────────────────────────────────────────────────────────────
  const login          = (u,p)    => send({type:'auth:login',   username:u, password:p});
  const signup         = (u,p)    => send({type:'auth:signup',  username:u, password:p});
  const setUsername    = (n)      => { state.username=n; };
  const sendChat       = (ch,t)   => send({type:'chat:message', channel:ch, text:t});
  const joinChannel    = (ch)     => send({type:'chat:join',    channel:ch});
  const shareClipboard = (t)      => send({type:'clipboard:share', text:t});
  const sendDm         = (to,t,f) => send({type:'dm:send',     to, text:t, file:f||null});
  const getDmHistory   = (id)     => send({type:'dm:history',  withId:id});
  const transferMoney  = (to,a)   => send({type:'money:transfer', to, amount:a});
  const sendVirus      = (to,t)   => send({type:'virus:send',  to, virusType:t});
  const buyStock       = (id,sh)  => send({type:'market:buy',  stockId:id, shares:sh});
  const sellStock      = (id,sh)  => send({type:'market:sell', stockId:id, shares:sh});
  const ping           = ()       => send({type:'ping'});
  const isConnected    = ()       => connected;
  const isAuthenticated= ()       => state.authenticated;
  const getState       = ()       => ({...state});
  const syncEconomy    = ()       => {}; // no-op — server is source of truth

  const tryConnect = () => {
    if(typeof EventBus!=='undefined') EventBus.on('os:ready', connect);
    else if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(connect,500));
    else setTimeout(connect, 500);
  };

  tryConnect();

  return {
    on, off, send, connect,
    login, signup, setUsername, sendChat, joinChannel, shareClipboard,
    sendDm, getDmHistory, transferMoney, sendVirus,
    buyStock, sellStock, ping, isConnected, isAuthenticated, getState, syncEconomy,
  };
})();
