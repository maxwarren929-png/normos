/**
 * NormOS — js/network.js v5.0
 * Fixes: hack cooldowns (prevent multi-click), defensive input when multi-hacks,
 *        virus cost deducted server-side, send money fixed, anti-exploit balance sync
 */

const Network = (() => {
  const SERVER_URL      = 'wss://normos-server.onrender.com';
  const RECONNECT_DELAY = 4000;

  let ws = null, connected = false, reconnectTimer = null;

  const state = {
    myId: null, myColor: '#4f9eff', username: null,
    authenticated: false, isAdmin: false,
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

  const syncEconomy=()=>{
    // No-op: server is the source of truth for balances.
  };

  const handleMessage=(msg)=>{
    switch(msg.type){
      case 'auth:required': emit('auth:required',msg); break;
      case 'auth:error':    emit('auth:error',msg); break;
      case 'auth:kicked':   emit('auth:kicked',msg); alert('You were kicked: '+msg.message); break;

      case 'auth:ok':
        state.myId=msg.id; state.myColor=msg.color; state.username=msg.username;
        state.authenticated=true; state.isAdmin=msg.isAdmin||false;
        state.online=msg.online||[]; state.channels=msg.channels||[];
        state.leaderboard=msg.leaderboard||[];
        state.bankBalance=msg.balance||0; state.bankDeposit=msg.deposit||0;
        state.bankCreditScore=msg.creditScore||0;
        if(msg.market){state.marketPrices=msg.market.prices||{};state.marketHistory=msg.market.history||{};}
        // Sync Economy from server
        if(typeof Economy!=='undefined'){
          Economy.state.balance=msg.balance||0;
          // Restore portfolio from server so positions survive reconnects/refreshes
          if(msg.portfolio && typeof msg.portfolio==='object'){
            Economy.state.portfolio = msg.portfolio;
          }
          Economy.save(); Economy.updateWalletDisplay();
        }
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
        if(typeof Economy!=='undefined'){
          Economy.state.balance=msg.newBalance;
          // Sync local portfolio so UI shows updated positions
          if(msg.action==='BUY' && msg.stockId){
            if(!Economy.state.portfolio[msg.stockId]) Economy.state.portfolio[msg.stockId]={shares:0,avgCost:0};
            const _pos=Economy.state.portfolio[msg.stockId];
            const _ns=_pos.shares+msg.shares;
            _pos.avgCost=((_pos.avgCost*_pos.shares)+(msg.price*msg.shares))/_ns;
            _pos.shares=_ns;
          } else if(msg.action==='SELL' && msg.stockId){
            const _pos=Economy.state.portfolio[msg.stockId];
            if(_pos){ _pos.shares-=msg.shares; if(_pos.shares<=0) delete Economy.state.portfolio[msg.stockId]; }
          }
          Economy.save(); Economy.updateWalletDisplay();
        }
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

      // Bank
      case 'bank:update':
        state.bankBalance=msg.balance; state.bankDeposit=msg.deposit||0;
        state.bankCreditScore=msg.creditScore||0;
        if(msg.balance!==undefined&&typeof Economy!=='undefined'){ Economy.state.balance=msg.balance; Economy.save(); Economy.updateWalletDisplay(); }
        emit('bank:update',msg); break;
      case 'bank:interest':   emit('bank:interest',msg); break;
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

      // Virus — cost already deducted server-side, update balance from server response
      case 'virus:sent':
        // Server confirmed: deduct cost from local economy state
        if(msg.newBalance!==undefined&&typeof Economy!=='undefined'){
          Economy.state.balance=msg.newBalance; Economy.save(); Economy.updateWalletDisplay();
        }
        emit('virus:sent',msg); break;
      case 'virus:fail': emit('virus:fail',msg); break;

      case 'virus:incoming': emit('virus:incoming',msg); handleVirusAttack(msg); break;
      case 'virus:loot':
        if(typeof Economy!=='undefined'){ Economy.state.balance+=msg.amount; Economy.save(); Economy.updateWalletDisplay(); }
        emit('virus:loot',msg);
        if(typeof OS!=='undefined') OS.notify('☣️','Loot',`Stole $${msg.amount.toFixed(2)} from ${msg.from}!`);
        break;

      case 'economy:balance:update':
        if(typeof Economy!=='undefined'){ Economy.state.balance=msg.balance; Economy.save(); Economy.updateWalletDisplay(); }
        break;

      case 'desktop:data': emit('desktop:data',msg); break;

      // Admin responses
      case 'admin:ok':    emit('admin:ok',msg); break;
      case 'admin:error': emit('admin:error',msg); break;
      case 'admin:users': emit('admin:users',msg); break;

      case 'clipboard:incoming':
        emit('clipboard:incoming',msg);
        if(typeof OS!=='undefined') OS.notify('📋',`Clipboard from ${msg.from}`,msg.text.slice(0,60));
        break;
      case 'pong': emit('pong',msg); break;

      // ── Multi-Bank ────────────────────────────────────────────────
      case 'multibank:data':    emit('multibank:data',msg); break;
      case 'multibank:update':  emit('multibank:update',msg); break;
      case 'multibank:interest':
        if(typeof Economy!=='undefined'){ Economy.state.balance+=msg.amount; Economy.save(); Economy.updateWalletDisplay(); }
        emit('multibank:interest',msg);
        if(typeof OS!=='undefined') OS.notify(msg.bankId==='noot'?'🐧':msg.bankId==='elite'?'💎':'🏦','Bank Interest',`+$${msg.amount.toFixed(2)} from ${msg.bankName}`);
        break;
      case 'multibank:hack:result': emit('multibank:hack:result',msg); break;
      case 'multibank:hacked':
        emit('multibank:hacked',msg);
        if(typeof OS!=='undefined') OS.notify('💀','HACKED!',`${msg.by} stole $${(msg.lost||0).toFixed(2)} from your ${msg.bankName} deposit!`);
        break;
      case 'multibank:error':   emit('multibank:error',msg); break;

      // ── Player Companies ──────────────────────────────────────────
      case 'companies:data':        emit('companies:data',msg); break;
      case 'companies:update':      emit('companies:update',msg); break;
      case 'companies:created':     emit('companies:created',msg); break;
      case 'companies:error':       emit('companies:error',msg); break;
      case 'market:shareholders':   emit('market:shareholders',msg); break;

      // ── NorMarket ─────────────────────────────────────────────────
      case 'market:list:data':    emit('market:list:data',msg); break;
      case 'market:list:created': emit('market:list:created',msg); break;
      case 'market:list:new':     emit('market:list:new',msg); break;
      case 'market:list:bought':
        if(typeof Economy!=='undefined' && msg.newBalance !== undefined){ Economy.state.balance=msg.newBalance; Economy.save(); Economy.updateWalletDisplay(); }
        emit('market:list:bought',msg); break;
      case 'market:list:deleted': emit('market:list:deleted',msg); break;
      case 'market:list:removed': emit('market:list:removed',msg); break;
      case 'market:sale':
        emit('market:sale',msg);
        if(typeof OS!=='undefined') OS.notify('🏪','NorMarket Sale',`${msg.buyerName} bought "${msg.listingTitle}" — +$${(msg.amount||0).toFixed(2)}`);
        if(typeof Economy!=='undefined' && msg.newBalance!==undefined){ Economy.state.balance=msg.newBalance; Economy.save(); Economy.updateWalletDisplay(); }
        break;
      case 'market:bounty:received':
        emit('market:bounty:received',msg);
        if(typeof OS!=='undefined') OS.notify('🏪','Bounty Submission',`${msg.fromName} submitted work for "${msg.listingTitle}"`);
        break;
      case 'market:bounty:submitted': emit('market:bounty:submitted',msg); break;
      case 'market:bounty:paid':
        emit('market:bounty:paid',msg);
        if(typeof Economy!=='undefined' && msg.newBalance!==undefined){ Economy.state.balance=msg.newBalance; Economy.save(); Economy.updateWalletDisplay(); }
        if(typeof OS!=='undefined') OS.notify('💰','Bounty Paid',`${msg.fromName} paid you $${(msg.amount||0).toFixed(2)}!`);
        break;
      case 'market:bounty:pay:ok':
        if(typeof Economy!=='undefined' && msg.newBalance!==undefined){ Economy.state.balance=msg.newBalance; Economy.save(); Economy.updateWalletDisplay(); }
        emit('market:bounty:pay:ok',msg); break;
      case 'market:error': emit('market:error',msg); break;

      // ── NormArena ─────────────────────────────────────────────────
      case 'arena:rooms':           emit('arena:rooms',msg); break;
      case 'arena:waiting':         emit('arena:waiting',msg); break;
      case 'arena:start':           emit('arena:start',msg); break;
      case 'arena:state':           emit('arena:state',msg); break;
      case 'arena:end':
        if(typeof Economy!=='undefined'&&msg.newBalance!==undefined){Economy.state.balance=msg.newBalance;Economy.save();Economy.updateWalletDisplay();}
        emit('arena:end',msg);
        if(typeof OS!=='undefined'){
          const won=msg.winner&&msg.winner===state.username;
          const drew=!msg.winner;
          OS.notify('🏆','NormArena',drew?'Game drawn — stakes returned':won?`You won! 🎉`:`${msg.winner} won the match.`);
        }
        break;
      case 'arena:opponent:left':
        if(typeof Economy!=='undefined'&&msg.newBalance!==undefined){Economy.state.balance=msg.newBalance;Economy.save();Economy.updateWalletDisplay();}
        emit('arena:opponent:left',msg);
        if(typeof OS!=='undefined') OS.notify('🏆','NormArena','Opponent disconnected — you win!');
        break;
      case 'arena:error':           emit('arena:error',msg); break;
    }
  };

  // ── Hacking minigame + virus attack ─────────────────────────────────────────
  // Track active hack overlays to allow defensive input even when multiple attacks happen
  let _activeHackCount = 0;
  let _hackOverlays = [];

  const handleVirusAttack = (msg) => {
    const {virusType,from,fromId} = msg;

    // Check firewall protection
    try {
      const firewallUntil = parseInt(localStorage.getItem('normos_firewall_until') || '0');
      if (Date.now() < firewallUntil) {
        if (typeof OS !== 'undefined') OS.notify('🔥', 'NormFirewall', `Blocked ${virusType} attack from ${from}!`);
        send({type:'virus:blocked',from:fromId});
        return;
      }
    } catch {}

    const EFFECTS={
      generic:   {drain:0.05, duration:5000,  glitch:false},
      glitch:    {drain:0.02, duration:8000,  glitch:true},
      miner:     {drain:0.10, duration:15000, glitch:false},
      ransomware:{drain:0.25, duration:3000,  glitch:true},
      worm:      {drain:0.08, duration:10000, glitch:false},
      spyware:   {drain:0.03, duration:12000, glitch:true},
      ddos:      {drain:0.12, duration:8000,  glitch:false},
      rootkit:   {drain:0.20, duration:5000,  glitch:true},
    };
    const effect=EFFECTS[virusType]||EFFECTS.generic;

    // Show hacking minigame — can handle multiple simultaneous attacks
    showHackingMinigame(from, fromId, virusType, effect);
  };

  const showHackingMinigame = (from, fromId, virusType, effect) => {
    _activeHackCount++;
    const zBase = 999999 + (_activeHackCount * 10);

    // Pick minigame type based on virus
    const GAME_MAP = {
      generic:    'sequence',
      glitch:     'scramble',
      miner:      'math',
      ransomware: 'pattern',
      worm:       'sequence',
      spyware:    'scramble',
      ddos:       'mash',
      rootkit:    'pattern',
    };
    const gameType = GAME_MAP[virusType] || (['sequence','scramble','math','pattern','mash'][Math.floor(Math.random()*5)]);
    const hackId = 'hack-'+Math.random().toString(36).slice(2,8);
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.88);z-index:${zBase};display:flex;align-items:center;justify-content:center;font-family:var(--font-mono,monospace);`;
    let gameOver = false;
    const TIME_LIMIT = virusType === 'ransomware' ? 8000 : virusType === 'miner' ? 20000 : 15000;
    let timeLeft = TIME_LIMIT;

    const cleanup = () => {
      _activeHackCount = Math.max(0, _activeHackCount - 1);
      _hackOverlays = _hackOverlays.filter(o => o !== overlay);
      clearInterval(timerInterval);
    };

    const resolveWin = () => {
      if (gameOver) return; gameOver = true; cleanup();
      setStatus('✅ BLOCKED! Attack neutralized.', '#4ade80');
      setTimeout(() => {
        overlay.remove();
        applyGlitch(effect.glitch, 5);
        if (typeof Economy !== 'undefined') {
          const partial = Economy.state.balance * effect.drain * 0.1;
          if (partial > 0) send({ type:'virus:damage', fromId, fromUsername:from, stolen:partial });
          if (typeof OS !== 'undefined') OS.notify('🛡️','Hack Blocked',`Partial damage: -$${partial.toFixed(2)}`);
        }
      }, 1200);
    };

    const resolveMiss = () => {
      if (gameOver) return; gameOver = true; cleanup();
      setStatus('❌ FAILED! Taking full damage...', '#f87171');
      setTimeout(() => {
        overlay.remove();
        applyGlitch(effect.glitch, 20);
        if (typeof Economy !== 'undefined') {
          const stolen = Economy.state.balance * effect.drain;
          send({ type:'virus:damage', fromId, fromUsername:from, stolen });
          if (typeof OS !== 'undefined') OS.notify('☣️','Virus Hit!',`${from} stole $${stolen.toFixed(2)}!`);
        }
      }, 1200);
    };

    const applyGlitch = (doGlitch, steps) => {
      if (!doGlitch) return;
      const desktop = document.getElementById('desktop');
      if (!desktop) return;
      let g = 0;
      const gi = setInterval(() => {
        desktop.style.filter = `hue-rotate(${Math.random()*30-15}deg) contrast(${1+Math.random()*0.3})`;
        if (++g > steps) { clearInterval(gi); desktop.style.filter = ''; }
      }, 120);
    };

    const setStatus = (text, color) => {
      const el = overlay.querySelector(`#${hackId}-status`);
      if (el) { el.textContent = text; el.style.color = color; }
    };

    const baseStyle = `background:#0a0a0f;border:2px solid #f87171;border-radius:12px;padding:26px 28px;text-align:center;max-width:440px;width:90%;position:relative;box-shadow:0 0 40px #f8717144;`;

    // ── GAME 1: Sequence — type the code ────────────────────────────────────
    if (gameType === 'sequence') {
      const SEQ_LEN = virusType === 'ransomware' ? 4 : 6;
      const CHARS = 'ABCDEF0123456789';
      const target = Array.from({length:SEQ_LEN}, ()=>CHARS[Math.floor(Math.random()*CHARS.length)]).join('');
      let input = '';
      overlay.innerHTML = `<div style="${baseStyle}">
        <div style="font-size:1.6rem;margin-bottom:4px;">☣️</div>
        <div style="color:#f87171;font-size:0.95rem;font-weight:700;margin-bottom:3px;">HACK: ${virusType.toUpperCase()}</div>
        <div style="color:#9ca3af;font-size:0.7rem;margin-bottom:12px;">by <b style="color:#f87171">${from}</b> — type the sequence</div>
        <div style="font-size:1.5rem;letter-spacing:0.3em;color:#4f9eff;background:#111;padding:8px 14px;border-radius:6px;margin-bottom:10px;" id="${hackId}-target">${target}</div>
        <div style="font-size:1.3rem;letter-spacing:0.3em;color:#4ade80;background:#111;padding:7px 14px;border-radius:6px;margin-bottom:10px;min-height:40px;" id="${hackId}-input">${'_'.repeat(SEQ_LEN)}</div>
        <div style="background:#1a1a1a;border-radius:4px;height:5px;margin-bottom:8px;overflow:hidden;"><div id="${hackId}-bar" style="height:100%;background:#4ade80;width:100%;transition:width 0.1s linear;border-radius:4px;"></div></div>
        <div style="font-size:0.68rem;color:#9ca3af;" id="${hackId}-status">Block or lose ${(effect.drain*100).toFixed(0)}% — case-insensitive</div>
      </div>`;
      document.body.appendChild(overlay); _hackOverlays.push(overlay);
      overlay.setAttribute('tabindex','0'); overlay.focus();
      const updDisp = () => { const el=overlay.querySelector(`#${hackId}-input`); if(el) el.textContent=(input||'').padEnd(SEQ_LEN,'_').slice(0,SEQ_LEN); };
      const onKey = (e) => {
        if (gameOver) return;
        if (_hackOverlays[_hackOverlays.length-1] !== overlay) return;
        const k = e.key.toUpperCase();
        if (k==='ESCAPE') { resolveMiss(); return; }
        if (CHARS.includes(k) && input.length < SEQ_LEN) {
          input += k; updDisp();
          if (input.length === SEQ_LEN) { if (input===target) resolveWin(); else { input=''; updDisp(); } }
        }
      };
      document.addEventListener('keydown', onKey);
      const timerInterval = setInterval(() => {
        if (gameOver) { clearInterval(timerInterval); return; }
        timeLeft -= 100;
        const bar = overlay.querySelector(`#${hackId}-bar`);
        if (bar) { bar.style.width=(timeLeft/TIME_LIMIT*100)+'%'; if(timeLeft<5000) bar.style.background='#f87171'; }
        if (timeLeft <= 0) { clearInterval(timerInterval); resolveMiss(); }
      }, 100);
      setTimeout(()=>{ if(!gameOver) resolveMiss(); }, TIME_LIMIT+500);
      overlay._cleanup = () => document.removeEventListener('keydown', onKey);
      return;
    }

    // ── GAME 2: Scramble — find & click the correct hex word ────────────────
    if (gameType === 'scramble') {
      const WORDS = ['PATCH','BLOCK','GUARD','FIRE','WALL','LOCK','BOOT','INIT','DENY','KILL'];
      const answer = WORDS[Math.floor(Math.random()*WORDS.length)];
      const decoys = WORDS.filter(w=>w!==answer).sort(()=>Math.random()-0.5).slice(0,5);
      const opts = [...decoys, answer].sort(()=>Math.random()-0.5);
      const hexed = w => w.split('').map(c=>`<span style="animation:hack-flicker ${(0.1+Math.random()*0.3).toFixed(2)}s infinite alternate">${c}</span>`).join('');
      overlay.innerHTML = `
        <style>@keyframes hack-flicker{from{opacity:1;color:#f87171}to{opacity:0.3;color:#4f9eff}}</style>
        <div style="${baseStyle}">
          <div style="font-size:1.4rem;margin-bottom:4px">🔍</div>
          <div style="color:#f87171;font-size:0.95rem;font-weight:700;margin-bottom:3px">INTRUSION: ${virusType.toUpperCase()}</div>
          <div style="color:#9ca3af;font-size:0.7rem;margin-bottom:10px">by <b style="color:#f87171">${from}</b> — find and click the correct word</div>
          <div style="color:#f59e0b;font-size:0.8rem;margin-bottom:8px">Find: <b style="font-size:1rem;letter-spacing:0.15em">${answer}</b></div>
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;margin-bottom:12px">${opts.map(w=>`<button data-word="${w}" style="padding:0.45rem 0.9rem;background:#111;border:1px solid #333;color:#4ade80;border-radius:5px;cursor:pointer;font-family:monospace;font-size:0.85rem;letter-spacing:0.1em;transition:background 0.1s">${hexed(w)}</button>`).join('')}</div>
          <div style="background:#1a1a1a;border-radius:4px;height:5px;margin-bottom:8px;overflow:hidden;"><div id="${hackId}-bar" style="height:100%;background:#4ade80;width:100%;transition:width 0.1s linear;border-radius:4px;"></div></div>
          <div style="font-size:0.68rem;color:#9ca3af" id="${hackId}-status">Select the correct word before time runs out</div>
        </div>`;
      document.body.appendChild(overlay); _hackOverlays.push(overlay);
      overlay.querySelectorAll('[data-word]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (gameOver) return;
          if (btn.dataset.word === answer) resolveWin(); else { btn.style.background='#f8717133'; btn.disabled=true; }
        });
      });
      const timerInterval = setInterval(() => {
        if (gameOver) { clearInterval(timerInterval); return; }
        timeLeft -= 100;
        const bar = overlay.querySelector(`#${hackId}-bar`);
        if (bar) { bar.style.width=(timeLeft/TIME_LIMIT*100)+'%'; if(timeLeft<5000) bar.style.background='#f87171'; }
        if (timeLeft <= 0) { clearInterval(timerInterval); resolveMiss(); }
      }, 100);
      setTimeout(()=>{ if(!gameOver) resolveMiss(); }, TIME_LIMIT+500);
      return;
    }

    // ── GAME 3: Math — solve rapid-fire arithmetic ───────────────────────────
    if (gameType === 'math') {
      let score = 0; const needed = 3;
      const genQ = () => {
        const ops = ['+','-','*'];
        const op = ops[Math.floor(Math.random()*ops.length)];
        let a,b,ans;
        if (op==='+') { a=Math.floor(Math.random()*50)+1; b=Math.floor(Math.random()*50)+1; ans=a+b; }
        else if (op==='-') { a=Math.floor(Math.random()*50)+20; b=Math.floor(Math.random()*a)+1; ans=a-b; }
        else { a=Math.floor(Math.random()*12)+1; b=Math.floor(Math.random()*12)+1; ans=a*b; }
        return { q:`${a} ${op} ${b}`, ans };
      };
      let cur = genQ();
      overlay.innerHTML = `<div style="${baseStyle}">
        <div style="font-size:1.4rem;margin-bottom:4px">🧮</div>
        <div style="color:#f87171;font-size:0.95rem;font-weight:700;margin-bottom:3px">VIRUS DRILL: ${virusType.toUpperCase()}</div>
        <div style="color:#9ca3af;font-size:0.7rem;margin-bottom:10px">by <b style="color:#f87171">${from}</b> — solve ${needed} math problems</div>
        <div style="font-size:1.6rem;color:#f59e0b;margin-bottom:6px;font-weight:700" id="${hackId}-q">${cur.q} = ?</div>
        <div style="font-size:0.7rem;color:var(--text3);margin-bottom:8px" id="${hackId}-prog">Solved: ${score}/${needed}</div>
        <input id="${hackId}-ans" type="number" style="width:100%;padding:0.5rem;background:#111;border:1px solid #333;color:#4ade80;border-radius:6px;font-size:1.1rem;text-align:center;outline:none;font-family:monospace;box-sizing:border-box;" placeholder="Answer…" autofocus />
        <div style="font-size:0.65rem;color:#6b7280;margin-top:6px">Press Enter to submit</div>
        <div style="background:#1a1a1a;border-radius:4px;height:5px;margin:8px 0;overflow:hidden;"><div id="${hackId}-bar" style="height:100%;background:#4ade80;width:100%;transition:width 0.1s linear;border-radius:4px;"></div></div>
        <div style="font-size:0.68rem;color:#9ca3af" id="${hackId}-status">Solve fast to block the attack!</div>
      </div>`;
      document.body.appendChild(overlay); _hackOverlays.push(overlay);
      const inp = overlay.querySelector(`#${hackId}-ans`);
      setTimeout(()=>inp?.focus(), 50);
      const onKey = (e) => {
        if (gameOver) return;
        if (e.key === 'Enter') {
          const val = parseInt(inp.value);
          if (val === cur.ans) {
            score++; inp.value='';
            if (score >= needed) { resolveWin(); return; }
            cur = genQ();
            const qEl = overlay.querySelector(`#${hackId}-q`); if (qEl) qEl.textContent=cur.q+' = ?';
            const pEl = overlay.querySelector(`#${hackId}-prog`); if (pEl) pEl.textContent=`Solved: ${score}/${needed}`;
            setStatus(`✅ Correct! ${needed-score} more to go.`, '#4ade80');
            setTimeout(()=>setStatus('Solve fast to block the attack!','#9ca3af'), 700);
          } else {
            inp.value=''; inp.style.borderColor='#f87171';
            setTimeout(()=>{ if(inp) inp.style.borderColor='#333'; }, 500);
            setStatus('❌ Wrong! Try again.', '#f87171');
          }
        }
      };
      document.addEventListener('keydown', onKey);
      const timerInterval = setInterval(() => {
        if (gameOver) { clearInterval(timerInterval); return; }
        timeLeft -= 100;
        const bar = overlay.querySelector(`#${hackId}-bar`);
        if (bar) { bar.style.width=(timeLeft/TIME_LIMIT*100)+'%'; if(timeLeft<5000) bar.style.background='#f87171'; }
        if (timeLeft <= 0) { clearInterval(timerInterval); resolveMiss(); }
      }, 100);
      setTimeout(()=>{ if(!gameOver) resolveMiss(); }, TIME_LIMIT+500);
      overlay._cleanup = () => document.removeEventListener('keydown', onKey);
      return;
    }

    // ── GAME 4: Pattern — memorise then reproduce a button sequence ──────────
    if (gameType === 'pattern') {
      const SEQ = Array.from({length:4}, ()=>Math.floor(Math.random()*4));
      const COLORS4 = ['#4f9eff','#4ade80','#f59e0b','#f87171'];
      const LABELS  = ['◀','▲','▼','▶'];
      let showing = true, userInput = [];
      overlay.innerHTML = `<div style="${baseStyle}">
        <div style="font-size:1.4rem;margin-bottom:4px">🧠</div>
        <div style="color:#f87171;font-size:0.95rem;font-weight:700;margin-bottom:3px">PATTERN LOCK: ${virusType.toUpperCase()}</div>
        <div style="color:#9ca3af;font-size:0.7rem;margin-bottom:10px">by <b style="color:#f87171">${from}</b> — memorise and repeat the pattern</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;max-width:200px;margin:0 auto 12px" id="${hackId}-btns">
          ${COLORS4.map((col,i)=>`<button data-idx="${i}" style="padding:1rem;background:${col}22;border:2px solid ${col};color:${col};border-radius:8px;font-size:1.3rem;cursor:pointer;transition:background 0.15s;font-family:monospace;">${LABELS[i]}</button>`).join('')}
        </div>
        <div id="${hackId}-hint" style="font-size:0.72rem;color:#f59e0b;margin-bottom:6px">Memorising pattern…</div>
        <div id="${hackId}-dots" style="display:flex;gap:4px;justify-content:center;margin-bottom:8px">${SEQ.map(()=>`<div style="width:10px;height:10px;border-radius:50%;background:#333;"></div>`).join('')}</div>
        <div style="background:#1a1a1a;border-radius:4px;height:5px;margin-bottom:8px;overflow:hidden;"><div id="${hackId}-bar" style="height:100%;background:#4ade80;width:100%;transition:width 0.1s linear;border-radius:4px;"></div></div>
        <div style="font-size:0.68rem;color:#9ca3af" id="${hackId}-status">Watch carefully…</div>
      </div>`;
      document.body.appendChild(overlay); _hackOverlays.push(overlay);
      const btns = overlay.querySelectorAll('[data-idx]');
      btns.forEach(b => b.disabled = true);
      // Playback sequence
      let step = 0;
      const playNext = () => {
        if (step >= SEQ.length) {
          showing = false;
          overlay.querySelector(`#${hackId}-hint`).textContent = 'Now repeat the pattern!';
          setStatus('Click the buttons in order', '#4ade80');
          btns.forEach(b => b.disabled = false);
          return;
        }
        const idx = SEQ[step];
        btns[idx].style.background = COLORS4[idx] + '88';
        setTimeout(() => {
          btns[idx].style.background = COLORS4[idx] + '22';
          step++;
          setTimeout(playNext, 300);
        }, 500);
      };
      setTimeout(playNext, 600);
      btns.forEach(btn => {
        btn.addEventListener('click', () => {
          if (gameOver || showing) return;
          const idx = parseInt(btn.dataset.idx);
          const expected = SEQ[userInput.length];
          userInput.push(idx);
          // Update dots
          const dots = overlay.querySelectorAll(`#${hackId}-dots div`);
          dots[userInput.length-1].style.background = idx===expected ? '#4ade80' : '#f87171';
          if (idx !== expected) { resolveMiss(); return; }
          if (userInput.length === SEQ.length) resolveWin();
        });
      });
      const timerInterval = setInterval(() => {
        if (gameOver) { clearInterval(timerInterval); return; }
        timeLeft -= 100;
        const bar = overlay.querySelector(`#${hackId}-bar`);
        if (bar) { bar.style.width=(timeLeft/TIME_LIMIT*100)+'%'; if(timeLeft<5000) bar.style.background='#f87171'; }
        if (timeLeft <= 0) { clearInterval(timerInterval); resolveMiss(); }
      }, 100);
      setTimeout(()=>{ if(!gameOver) resolveMiss(); }, TIME_LIMIT+500);
      return;
    }

    // ── GAME 5: Mash — rapid key mashing / spam clicks ───────────────────────
    if (gameType === 'mash') {
      let hits = 0; const needed = 20;
      overlay.innerHTML = `<div style="${baseStyle}">
        <div style="font-size:1.4rem;margin-bottom:4px">💥</div>
        <div style="color:#f87171;font-size:0.95rem;font-weight:700;margin-bottom:3px">DDoS FLOOD: ${virusType.toUpperCase()}</div>
        <div style="color:#9ca3af;font-size:0.7rem;margin-bottom:10px">by <b style="color:#f87171">${from}</b> — spam SPACE or click to counter-flood</div>
        <button id="${hackId}-mash" style="width:160px;height:100px;background:#f87171;border:none;border-radius:12px;font-size:1.4rem;cursor:pointer;box-shadow:0 4px 20px #f8717166;transition:transform 0.05s;user-select:none;">💥 FLOOD</button>
        <div style="margin-top:10px;margin-bottom:4px;">
          <div style="background:#1a1a1a;border-radius:4px;height:10px;overflow:hidden;"><div id="${hackId}-prog-bar" style="height:100%;background:#f59e0b;width:0%;transition:width 0.1s;border-radius:4px;"></div></div>
        </div>
        <div style="font-size:0.75rem;color:#f59e0b;margin-bottom:6px" id="${hackId}-count">${hits}/${needed}</div>
        <div style="background:#1a1a1a;border-radius:4px;height:5px;margin-bottom:8px;overflow:hidden;"><div id="${hackId}-bar" style="height:100%;background:#4ade80;width:100%;transition:width 0.1s linear;border-radius:4px;"></div></div>
        <div style="font-size:0.68rem;color:#9ca3af" id="${hackId}-status">Mash to overload the virus!</div>
      </div>`;
      document.body.appendChild(overlay); _hackOverlays.push(overlay);
      const mashBtn = overlay.querySelector(`#${hackId}-mash`);
      const doHit = () => {
        if (gameOver) return;
        hits++;
        const pBar = overlay.querySelector(`#${hackId}-prog-bar`);
        const cEl  = overlay.querySelector(`#${hackId}-count`);
        if (pBar) pBar.style.width = (hits/needed*100)+'%';
        if (cEl)  cEl.textContent = `${hits}/${needed}`;
        mashBtn.style.transform = 'scale(0.93)';
        setTimeout(()=>{ if(mashBtn) mashBtn.style.transform='scale(1)'; }, 60);
        if (hits >= needed) resolveWin();
      };
      mashBtn.addEventListener('click', doHit);
      const onKey = (e) => { if (!gameOver && (e.code==='Space'||e.code==='Enter')) { e.preventDefault(); doHit(); } };
      document.addEventListener('keydown', onKey);
      const timerInterval = setInterval(() => {
        if (gameOver) { clearInterval(timerInterval); return; }
        timeLeft -= 100;
        const bar = overlay.querySelector(`#${hackId}-bar`);
        if (bar) { bar.style.width=(timeLeft/TIME_LIMIT*100)+'%'; if(timeLeft<5000) bar.style.background='#f87171'; }
        if (timeLeft <= 0) { clearInterval(timerInterval); resolveMiss(); }
      }, 100);
      setTimeout(()=>{ if(!gameOver) resolveMiss(); }, TIME_LIMIT+500);
      overlay._cleanup = () => document.removeEventListener('keydown', onKey);
    }
  };

  // ── Virus send with client-side cooldown tracking (server also enforces) ─────
  const _hackCooldowns = {}; // local cooldown cache to prevent UI abuse

  const sendVirusWithCooldown = (to, virusType) => {
    const ck = `${virusType}:${to}`;
    const last = _hackCooldowns[ck] || 0;
    const now = Date.now();

    if (now - last < 60000) {
      const rem = Math.ceil((60000 - (now - last)) / 1000);
      if (typeof OS !== 'undefined') OS.notify('☣️', 'Hack', `Cooldown: ${rem}s remaining.`);
      return false;
    }

    _hackCooldowns[ck] = now;
    return send({type:'virus:send', to, virusType});
  };

  // ── Taskbar indicator ────────────────────────────────────────────────────────
  const updateTaskbarIndicator=(online)=>{
    let el=document.getElementById('net-indicator');
    if(!el){
      el=document.createElement('span'); el.id='net-indicator'; el.className='tray-icon';
      el.style.cssText='cursor:pointer;font-size:0.7rem;display:flex;align-items:center;gap:3px;';
      el.addEventListener('click',()=>{if(typeof OS!=='undefined') OS.apps.open('leaderboard');});
      const tray=document.getElementById('taskbar-tray');
      if(tray) tray.prepend(el);
    }
    const count=state.online.length;
    el.innerHTML=online
      ?`<span style="color:#4ade80;font-size:0.6rem">●</span><span style="font-size:0.65rem;color:var(--text2)">${count}</span>`
      :`<span style="color:#f87171;font-size:0.6rem">●</span>`;
    el.title=online?`${count} online`:'NormNet: offline';
  };
  const updateOnlineCount=()=>updateTaskbarIndicator(connected);

  // ── Public API ────────────────────────────────────────────────────────────────
  const login       = (u,p)  => send({type:'auth:login',  username:u,password:p});
  const signup      = (u,p,opts)  => send({type:'auth:signup', username:u,password:p,...(opts||{})});
  const setUsername = (n)    => { state.username=n; };
  const sendChat    = (ch,t) => send({type:'chat:message',channel:ch,text:t});
  const joinChannel = (ch)   => send({type:'chat:join',channel:ch});
  const shareClipboard=(t)   => send({type:'clipboard:share',text:t});
  // sendDm removed from public API per requirements (DMs removed from leaderboard)
  const transferMoney=(to,a) => send({type:'money:transfer',to,amount:a});
  const sendVirus   = (to,t) => sendVirusWithCooldown(to,t);
  const buyStock    = (id,sh)=> send({type:'market:buy',stockId:id,shares:sh});
  const sellStock   = (id,sh)=> send({type:'market:sell',stockId:id,shares:sh});
  const ping        = ()     => send({type:'ping'});
  const isConnected = ()     => connected;
  const isAuthenticated=()   => state.authenticated;
  const getState    = ()     => ({...state});

  // Admin helpers
  const adminKick          = (username) => send({type:'admin:kick',username});
  const adminSetBalance    = (username,balance) => send({type:'admin:setbalance',username,balance});
  const adminGetUsers      = () => send({type:'admin:getusers'});
  const adminDeleteAccount = (username) => send({type:'admin:deleteaccount',username});

  const tryConnect=()=>{
    if(typeof EventBus!=='undefined') EventBus.on('os:ready',connect);
    else if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(connect,500));
    else setTimeout(connect,500);
  };

  tryConnect();

  return {
    on,off,send,connect,
    login,signup,setUsername,sendChat,joinChannel,shareClipboard,
    transferMoney,sendVirus,
    buyStock,sellStock,ping,isConnected,isAuthenticated,getState,syncEconomy,
    adminKick,adminSetBalance,adminGetUsers,adminDeleteAccount,
  };
})();
