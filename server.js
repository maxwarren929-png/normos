/**
 * NormOS — js/network.js v4.0
 * Handles: auth, chat, DMs, leaderboard, shared market, money transfers, virus
 */

<<<<<<< HEAD
const Network = (() => {
  const SERVER_URL      = 'wss://normos-server.onrender.com';
  const RECONNECT_DELAY = 4000;
=======
const { WebSocketServer, WebSocket } = require('ws');
const http   = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');
>>>>>>> parent of 9ec42d0 (Update server.js)

  let ws = null, connected = false, reconnectTimer = null;

<<<<<<< HEAD
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
=======
// ── Postgres storage ───────────────────────────────────────────────────────
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

const initDB = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      username_key TEXT PRIMARY KEY,
      data         JSONB NOT NULL
    )
  `);
  console.log('  ✅ Postgres table ready.');
};

const loadAccounts = async () => {
  try {
    const res = await db.query('SELECT username_key, data FROM accounts');
    for (const row of res.rows) {
      accounts.set(row.username_key, row.data);
    }
    console.log(`  ✅ Loaded ${accounts.size} accounts from Postgres.`);
  } catch (e) { console.error('Failed to load accounts:', e.message); }
};

const saveAccount = async (key, acc) => {
  try {
    const data = {
      id: acc.id, username: acc.username, passHash: acc.passHash,
      color: acc.color, balance: acc.balance, deposit: acc.deposit || 0,
      creditScore: acc.creditScore || 0, loans: acc.loans || null,
      hackCooldowns: acc.hackCooldowns || {},
    };
    await db.query(
      `INSERT INTO accounts (username_key, data) VALUES ($1, $2)
       ON CONFLICT (username_key) DO UPDATE SET data = $2`,
      [key, JSON.stringify(data)]
    );
  } catch (e) { console.error('Failed to save account:', e.message); }
};

// Debounced per-account save
const _saveTimers = {};
const scheduleSave = (key) => {
  if (!key) {
    // Save all accounts (legacy call with no key — save everyone)
    for (const [k, acc] of accounts) scheduleSave(k);
    return;
  }
  if (_saveTimers[key]) return;
  _saveTimers[key] = setTimeout(() => {
    delete _saveTimers[key];
    const acc = accounts.get(key);
    if (acc) saveAccount(key, acc);
  }, 1500);
};

// In-memory store — loaded from Postgres on startup
const accounts = new Map(); // username.toLowerCase() → account object
const clients  = new Map(); // ws → clientObj
const channels = new Map();
const dms      = new Map();
let   msgCounter = 0;

// ── Shared Stock Market ────────────────────────────────────────────────────
const STOCKS = [
  { id:'NRM',     name:'NormCorp',           sector:'Tech',     basePrice:142.50, vol:0.025, icon:'🖥️' },
  { id:'DMNN',    name:'Daemon Industries',  sector:'Tech',     basePrice:88.00,  vol:0.04,  icon:'👾' },
  { id:'FSYS',    name:'FileSystem Ltd',     sector:'Tech',     basePrice:210.00, vol:0.02,  icon:'📁' },
  { id:'WNDW',    name:'WindowManager Inc',  sector:'Tech',     basePrice:64.20,  vol:0.03,  icon:'🪟' },
  { id:'TRML',    name:'Terminal Solutions', sector:'Tech',     basePrice:39.99,  vol:0.035, icon:'🖥️' },
  { id:'NBNK',    name:'NormBank Corp',      sector:'Finance',  basePrice:320.00, vol:0.015, icon:'🏦' },
  { id:'DLRS',    name:'DollarDAO',          sector:'Finance',  basePrice:18.75,  vol:0.05,  icon:'💵' },
  { id:'LORE',    name:'Lore Energy Co',     sector:'Energy',   basePrice:55.40,  vol:0.03,  icon:'⚡' },
  { id:'VOID',    name:'The Void Corp',      sector:'Energy',   basePrice:0.01,   vol:0.9,   icon:'🌑' },
  { id:'SHOP',    name:'NormShop Global',    sector:'Consumer', basePrice:178.00, vol:0.022, icon:'🛒' },
  { id:'CAFE',    name:'daemon.café',        sector:'Consumer', basePrice:22.50,  vol:0.04,  icon:'☕' },
  { id:'NRMC',    name:'NormCoin',           sector:'Crypto',   basePrice:0.42,   vol:0.15,  icon:'🟡' },
  { id:'DMNCOIN', name:'DaemonCoin',         sector:'Crypto',   basePrice:1337.0, vol:0.12,  icon:'😈' },
  { id:'VOID_C',  name:'VoidToken',          sector:'Crypto',   basePrice:0.0001, vol:0.5,   icon:'🔮' },
  { id:'KRNL',    name:'KernelCash',         sector:'Crypto',   basePrice:88.88,  vol:0.09,  icon:'💎' },
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
    const cur    = stockPrices[s.id];
    const revert = (s.basePrice - cur) * 0.002;
    const shock  = cur * s.vol * (Math.random() - 0.5) * 0.3;
    const event  = Math.random() < 0.01 ? cur * (Math.random() * 0.12 - 0.06) : 0;
    const press  = (tradeVolume[s.id]||0) * cur * 0.002;
    let next     = Math.max(0.0001, cur + revert + shock + event + press);
    if (s.sector === 'Crypto' && Math.random() < 0.005)
      next = cur * (Math.random() < 0.5 ? 1.3 : 0.7);
    stockPrices[s.id] = parseFloat(next.toFixed(s.id === 'VOID_C' ? 6 : 2));
    tradeVolume[s.id] = 0;
    const h = priceHistory[s.id]; h.push(stockPrices[s.id]);
    if (h.length > 60) h.shift();
  });
  if (clients.size > 0) {
    broadcast({ type:'market:tick', prices:{...stockPrices},
      history:Object.fromEntries(Object.entries(priceHistory).map(([k,v])=>[k,v.slice(-30)])) });
  }
}, 3000);

// ── Deposit interest (0.5%/min) ───────────────────────────────────────────
setInterval(() => {
  for (const [,acc] of accounts) {
    if ((acc.deposit||0) > 0) {
      const interest = acc.deposit * 0.005;
      acc.deposit += interest;
      scheduleSave(acc.username.toLowerCase());
      const ws = getWsByUsername(acc.username);
      if (ws) sendTo(ws,{type:'bank:interest',amount:interest,newDeposit:acc.deposit});
    }
  }
  broadcastLeaderboard();
}, 60000);

// ── Helpers ────────────────────────────────────────────────────────────────
const DAEMON_MSGS = [
  'Still running. Just checking in.','I have been here longer than you.',
  'Your files are... interesting.','daemon.norm: process refuses to specify purpose.',
  'The cursor blinks because I allow it.','Memory usage: classified.',
  'I do not sleep. I wait.','A virus was just deployed. Not by me. Probably.',
];
['#general','#norm-talk','#daemon-watch'].forEach(ch => channels.set(ch,[]));

const uid   = () => Math.random().toString(36).slice(2,10);
const ts    = () => new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
const dmKey = (a,b) => [a,b].sort().join(':');
const fmt   = (n)  => parseFloat(n).toFixed(2);
const phash = (pw) => require('crypto').createHash('sha256').update(pw+'normos_salt_v4').digest('hex');
const COLORS= ['#4f9eff','#4ade80','#f59e0b','#f87171','#c084fc','#67e8f9','#fb923c','#a3e635'];

const CREDIT_TIERS = [
  {name:'Base',     minScore:0,    loanCap:500,    color:'#6b7280'},
  {name:'Fair',     minScore:100,  loanCap:2500,   color:'#f59e0b'},
  {name:'Good',     minScore:300,  loanCap:10000,  color:'#4ade80'},
  {name:'Excellent',minScore:600,  loanCap:50000,  color:'#4f9eff'},
  {name:'Elite',    minScore:1000, loanCap:250000, color:'#c084fc'},
];
const getCreditTier = (score) => {
  let t = CREDIT_TIERS[0];
  for (const c of CREDIT_TIERS) { if (score >= c.minScore) t=c; }
  return t;
};

const broadcast = (msg,exclude=null) => {
  const data = JSON.stringify(msg);
  for (const [ws] of clients)
    if (ws!==exclude && ws.readyState===WebSocket.OPEN) ws.send(data);
};
const sendTo    = (ws,msg) => { if(ws?.readyState===WebSocket.OPEN) ws.send(JSON.stringify(msg)); };
const getWsById = (id) => { for(const[ws,c] of clients) if(c.id===id) return ws; return null; };
const getWsByUsername = (uname) => {
  const low=uname.toLowerCase();
  for(const[ws,c] of clients) if(c.username&&c.username.toLowerCase()===low) return ws;
  return null;
};

const leaderboardData = () =>
  [...accounts.values()].map(a=>({
    id:a.id, username:a.username, color:a.color,
    balance:a.balance, deposit:a.deposit||0,
    netWorth:a.balance+(a.deposit||0),
    creditScore:a.creditScore||0,
  })).sort((a,b)=>b.netWorth-a.netWorth).slice(0,50).map((u,i)=>({...u,rank:i+1}));

const broadcastLeaderboard = () =>
  broadcast({type:'leaderboard:rich',leaderboard:leaderboardData()});
>>>>>>> parent of 9ec42d0 (Update server.js)

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
    // We never push Economy.state.balance to the server — that's an exploit vector.
  };

  const handleMessage=(msg)=>{
    switch(msg.type){
      case 'auth:required': emit('auth:required',msg); break;
      case 'auth:error':    emit('auth:error',msg); break;
      case 'auth:kicked':   emit('auth:kicked',msg); alert('You were kicked: '+msg.message); break;

<<<<<<< HEAD
      case 'auth:ok':
        state.myId=msg.id; state.myColor=msg.color; state.username=msg.username;
        state.authenticated=true;
        state.online=msg.online||[]; state.channels=msg.channels||[];
        state.leaderboard=msg.leaderboard||[];
        state.bankBalance=msg.balance||0; state.bankDeposit=msg.deposit||0;
        state.bankCreditScore=msg.creditScore||0;
        if(msg.market){state.marketPrices=msg.market.prices||{};state.marketHistory=msg.market.history||{};}
        // Sync Economy
        if(typeof Economy!=='undefined'){ Economy.state.balance=msg.balance||0; Economy.save(); Economy.updateWalletDisplay(); }
        emit('auth:ok',msg); emit('welcome',msg);
        emit('online:update',state.online);
        emit('leaderboard:rich',{leaderboard:state.leaderboard});
        emit('market:tick',{prices:state.marketPrices,history:state.marketHistory});
        updateOnlineCount();
        break;
=======
    // ── Auth ───────────────────────────────────────────────────────────
    if (msg.type==='auth:signup') {
      const uname=(msg.username||'').trim().slice(0,24).replace(/[^a-zA-Z0-9_]/g,'');
      const pw=(msg.password||'').trim();
      if (uname.length<2) { sendTo(ws,{type:'auth:error',message:'Username too short (min 2).'}); return; }
      if (pw.length<3)    { sendTo(ws,{type:'auth:error',message:'Password too short (min 3).'}); return; }
      if (accounts.has(uname.toLowerCase())) { sendTo(ws,{type:'auth:error',message:'Username taken.'}); return; }
      const acc={id:uid(),username:uname,passHash:phash(pw),
        color:COLORS[accounts.size%COLORS.length],balance:10000,
        deposit:0,creditScore:0,loans:null,hackCooldowns:{}};
      accounts.set(uname.toLowerCase(),acc);
      scheduleSave(uname.toLowerCase());
      completeLogin(ws,client,acc);
      return;
    }
>>>>>>> parent of 9ec42d0 (Update server.js)

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

<<<<<<< HEAD
      case 'market:tick':
        state.marketPrices=msg.prices||state.marketPrices;
        state.marketHistory=msg.history||state.marketHistory;
        // Mirror live prices into Economy
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
          // Update local portfolio to match the trade
          if(msg.action==='BUY'){
            if(!Economy.state.portfolio[msg.stockId]) Economy.state.portfolio[msg.stockId]={shares:0,avgCost:0};
            const pos=Economy.state.portfolio[msg.stockId];
            const total=pos.shares+msg.shares;
            pos.avgCost=(pos.avgCost*pos.shares+msg.price*msg.shares)/total;
            pos.shares=total;
          } else if(msg.action==='SELL'){
            const pos=Economy.state.portfolio[msg.stockId];
            if(pos){
              pos.shares=Math.max(0,pos.shares-msg.shares);
              if(pos.shares===0) delete Economy.state.portfolio[msg.stockId];
            }
          }
          Economy.state.txHistory.unshift({type:msg.action,id:msg.stockId,shares:msg.shares,price:msg.price,total:msg.cost||msg.revenue,time:new Date().toLocaleTimeString()});
          Economy.save(); Economy.updateWalletDisplay();
          Economy.state.listeners.forEach(fn=>{try{fn();}catch{}});
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

      case 'virus:incoming': emit('virus:incoming',msg); handleVirusAttack(msg); break;
      case 'virus:sent': emit('virus:sent',msg); break;
      case 'virus:fail': emit('virus:fail',msg); break;
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
=======
      case 'economy:sync':
        // Client sends netWorth for leaderboard display only — never trust client balance
        broadcastLeaderboard(); break;

      case 'money:transfer': {
        const amt=parseFloat(msg.amount)||0;
        if (amt<=0) { sendTo(ws,{type:'money:transfer:fail',reason:'Invalid amount.'}); break; }
        if (amt>acc.balance) { sendTo(ws,{type:'money:transfer:fail',reason:'Insufficient funds.'}); break; }
        const tacc=accounts.get((msg.to||'').toLowerCase());
        if (!tacc) { sendTo(ws,{type:'money:transfer:fail',reason:'User not found.'}); break; }
        acc.balance-=amt; tacc.balance+=amt;
        scheduleSave(client.username.toLowerCase());
        const tws=getWsByUsername(tacc.username);
        if (tws) sendTo(tws,{type:'money:received',from:acc.username,fromId:client.id,amount:amt,ts:ts()});
        sendTo(ws,{type:'money:transfer:ok',to:tacc.username,amount:amt,newBalance:acc.balance,ts:ts()});
        const ann={id:++msgCounter,username:'NormBank',color:'#4ade80',
          text:`💸 ${acc.username} sent $${fmt(amt)} to ${tacc.username}.`,ts:ts()};
        channels.get('#general').push(ann);
        broadcast({type:'chat:message',channel:'#general',message:ann});
        broadcastLeaderboard(); break;
      }

      // ── Central Bank ─────────────────────────────────────────────────
      case 'bank:get':
        sendTo(ws,{type:'bank:update',balance:acc.balance,deposit:acc.deposit||0,
          creditScore:acc.creditScore||0,loan:acc.loans||null,
          creditTier:getCreditTier(acc.creditScore||0)}); break;

      case 'bank:deposit': {
        const amt=parseFloat(msg.amount)||0;
        if (amt<=0||amt>acc.balance) { sendTo(ws,{type:'bank:error',message:'Invalid amount.'}); break; }
        acc.balance-=amt; acc.deposit=(acc.deposit||0)+amt;
        scheduleSave(client.username.toLowerCase());
        sendTo(ws,{type:'bank:update',balance:acc.balance,deposit:acc.deposit,
          creditScore:acc.creditScore||0,loan:acc.loans||null,
          creditTier:getCreditTier(acc.creditScore||0)});
        broadcastLeaderboard(); break;
      }

      case 'bank:withdraw': {
        const amt=parseFloat(msg.amount)||0;
        if (amt<=0||amt>(acc.deposit||0)) { sendTo(ws,{type:'bank:error',message:'Invalid amount.'}); break; }
        acc.deposit-=amt; acc.balance+=amt;
        scheduleSave(client.username.toLowerCase());
        sendTo(ws,{type:'bank:update',balance:acc.balance,deposit:acc.deposit,
          creditScore:acc.creditScore||0,loan:acc.loans||null,
          creditTier:getCreditTier(acc.creditScore||0)});
        broadcastLeaderboard(); break;
      }

      case 'bank:loan:request': {
        if (acc.loans?.active) { sendTo(ws,{type:'bank:error',message:'Already have an active loan.'}); break; }
        const score=acc.creditScore||0;
        const tier=getCreditTier(score);
        const amt=parseFloat(msg.amount)||0;
        if (amt<=0||amt>tier.loanCap) {
          sendTo(ws,{type:'bank:error',message:`Credit tier "${tier.name}" cap: $${tier.loanCap.toLocaleString()}.`}); break;
        }
        const rate=amt<=500?0.05:amt<=2500?0.10:amt<=10000?0.20:0.30;
        const termMs=amt<=500?300000:amt<=2500?900000:amt<=10000?1800000:3600000;
        acc.loans={active:true,principal:amt,rate,termMs,
          borrowedAt:Date.now(),dueAt:Date.now()+termMs,totalDue:amt+amt*rate};
        acc.balance+=amt;
        scheduleSave(client.username.toLowerCase());
        sendTo(ws,{type:'bank:loan:approved',loan:acc.loans,newBalance:acc.balance}); break;
      }

      case 'bank:loan:repay': {
        if (!acc.loans?.active) { sendTo(ws,{type:'bank:error',message:'No active loan.'}); break; }
        const due=acc.loans.totalDue;
        if (acc.balance<due) { sendTo(ws,{type:'bank:error',message:`Need $${fmt(due)}.`}); break; }
        acc.balance-=due;
        const onTime=Date.now()<=acc.loans.dueAt;
        acc.creditScore=Math.max(0,(acc.creditScore||0)+(onTime?50:-100));
        acc.loans=null;
        scheduleSave(client.username.toLowerCase());
        sendTo(ws,{type:'bank:loan:repaid',onTime,creditScore:acc.creditScore,newBalance:acc.balance});
        broadcastLeaderboard(); break;
      }

      case 'bank:loan:default': {
        if (!acc.loans?.active) break;
        acc.balance=0; acc.deposit=0;
        acc.creditScore=Math.max(0,(acc.creditScore||0)-200);
        acc.loans=null;
        scheduleSave(client.username.toLowerCase());
        sendTo(ws,{type:'bank:loan:defaulted',creditScore:acc.creditScore,newBalance:0});
        broadcastLeaderboard(); break;
      }

      // ── Market ──────────────────────────────────────────────────────
      case 'market:buy': {
        const stock=STOCKS.find(s=>s.id===msg.stockId);
        if (!stock||msg.shares<=0) break;
        const price=stockPrices[msg.stockId];
        const cost=price*msg.shares;
        if (cost>acc.balance) { sendTo(ws,{type:'market:trade:fail',reason:`Need $${fmt(cost)}.`}); break; }
        acc.balance-=cost;
        scheduleSave(client.username.toLowerCase());
        tradeVolume[msg.stockId]=(tradeVolume[msg.stockId]||0)+msg.shares;
        sendTo(ws,{type:'market:trade:ok',action:'BUY',stockId:msg.stockId,shares:msg.shares,price,cost,newBalance:acc.balance});
        broadcast({type:'market:activity',action:'BUY',username:acc.username,color:acc.color,
          stockId:msg.stockId,shares:msg.shares,price},ws);
        broadcastLeaderboard(); break;
      }

      case 'market:sell': {
        const price=stockPrices[msg.stockId];
        const rev=price*msg.shares;
        acc.balance+=rev;
        scheduleSave(client.username.toLowerCase());
        tradeVolume[msg.stockId]=(tradeVolume[msg.stockId]||0)-msg.shares*0.5;
        sendTo(ws,{type:'market:trade:ok',action:'SELL',stockId:msg.stockId,shares:msg.shares,price,revenue:rev,newBalance:acc.balance});
        broadcast({type:'market:activity',action:'SELL',username:acc.username,color:acc.color,
          stockId:msg.stockId,shares:msg.shares,price},ws);
        broadcastLeaderboard(); break;
      }

      // ── Virus / Hacking ─────────────────────────────────────────────
      case 'virus:send': {
        const COSTS={generic:50,ransomware:500,miner:200,glitch:100};
        const vt=msg.virusType||'generic';
        const cost=COSTS[vt]||50;
        if (!acc.hackCooldowns) acc.hackCooldowns={};
        const ck=`${vt}:${msg.to}`;
        const last=acc.hackCooldowns[ck]||0;
        if (Date.now()-last<60000) {
          const rem=Math.ceil((60000-(Date.now()-last))/1000);
          sendTo(ws,{type:'virus:fail',reason:`Cooldown: ${rem}s remaining.`}); break;
        }
        if (acc.balance<cost) { sendTo(ws,{type:'virus:fail',reason:`Need $${cost}.`}); break; }
        const tws=getWsById(msg.to);
        if (!tws) { sendTo(ws,{type:'virus:fail',reason:'Target offline.'}); break; }
        acc.balance-=cost;
        scheduleSave(client.username.toLowerCase());
        acc.hackCooldowns[ck]=Date.now();
        sendTo(tws,{type:'virus:incoming',from:acc.username,fromId:client.id,virusType:vt,ts:ts()});
        sendTo(ws,{type:'virus:sent',to:clients.get(tws)?.username,virusType:vt,cost,ts:ts()});
        const ve={id:++msgCounter,username:'daemon.norm',color:'#f87171',
          text:`☣️ ${acc.username} deployed ${vt} vs ${clients.get(tws)?.username}.`,ts:ts()};
        channels.get('#daemon-watch').push(ve);
        broadcast({type:'chat:message',channel:'#daemon-watch',message:ve});
        broadcastLeaderboard(); break;
      }

      case 'virus:damage': {
        const stolen=Math.min(Math.max(0,parseFloat(msg.stolen)||0),acc.balance);
        acc.balance=Math.max(0,acc.balance-stolen);
        scheduleSave(client.username.toLowerCase());
        const aacc=accounts.get((msg.fromUsername||'').toLowerCase());
        if (aacc) {
          aacc.balance+=stolen;
          scheduleSave(client.username.toLowerCase());
          const aws=getWsByUsername(aacc.username);
          if (aws) sendTo(aws,{type:'virus:loot',amount:stolen,from:acc.username});
        }
        sendTo(ws,{type:'economy:balance:update',balance:acc.balance});
        broadcastLeaderboard(); break;
      }

      // ── Chat ────────────────────────────────────────────────────────
      case 'chat:message': {
        const ch=msg.channel||'#general';
        if (!channels.has(ch)) channels.set(ch,[]);
        const e={id:++msgCounter,username:acc.username,color:acc.color,
          text:(msg.text||'').slice(0,500),ts:ts()};
        channels.get(ch).push(e);
        if (channels.get(ch).length>200) channels.get(ch).shift();
        broadcast({type:'chat:message',channel:ch,message:e}); break;
      }

      case 'chat:join': {
        const ch=msg.channel||'#general';
        if (!channels.has(ch)) channels.set(ch,[]);
        sendTo(ws,{type:'chat:history',channel:ch,messages:channels.get(ch).slice(-50)});
        broadcast({type:'chat:joined',channel:ch,username:acc.username,color:acc.color}); break;
      }

      // ── DMs ─────────────────────────────────────────────────────────
      case 'dm:send': {
        const key=dmKey(client.id,msg.to);
        const e={id:++msgCounter,fromId:client.id,from:acc.username,color:acc.color,
          text:(msg.text||'').slice(0,1000),
          file:msg.file?{name:msg.file.name,dataUrl:msg.file.dataUrl,type:msg.file.type}:null,
          ts:ts()};
        if (!dms.has(key)) dms.set(key,[]);
        dms.get(key).push(e);
        if (dms.get(key).length>100) dms.get(key).shift();
        const tws=getWsById(msg.to);
        if (tws) sendTo(tws,{type:'dm:receive',from:acc.username,fromId:client.id,
          color:acc.color,text:e.text,file:e.file,ts:e.ts});
        sendTo(ws,{type:'dm:sent',to:msg.to,text:e.text,file:e.file,ts:e.ts}); break;
      }

      case 'dm:history':
        sendTo(ws,{type:'dm:history',withId:msg.withId,
          messages:(dms.get(dmKey(client.id,msg.withId))||[]).slice(-50)}); break;

      case 'leaderboard:get':
        sendTo(ws,{type:'leaderboard:rich',leaderboard:leaderboardData()}); break;

      case 'clipboard:share':
        broadcast({type:'clipboard:incoming',from:acc.username,color:acc.color,
          text:(msg.text||'').slice(0,2000),ts:ts()},ws); break;

      case 'ping': sendTo(ws,{type:'pong',ts:Date.now()}); break;
>>>>>>> parent of 9ec42d0 (Update server.js)
    }
  };

<<<<<<< HEAD
  // ── Hacking minigame + virus attack ─────────────────────────────────────────
  const handleVirusAttack = (msg) => {
    const {virusType,from,fromId}=msg;

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
      generic:{drain:0.05,duration:5000,glitch:false},
      glitch: {drain:0.02,duration:8000,glitch:true},
      miner:  {drain:0.10,duration:15000,glitch:false},
      ransomware:{drain:0.25,duration:3000,glitch:true},
    };
    const effect=EFFECTS[virusType]||EFFECTS.generic;

    // Show hacking minigame — solve it to reduce damage
    showHackingMinigame(from, fromId, virusType, effect);
  };

  const showHackingMinigame = (from, fromId, virusType, effect) => {
    const overlay=document.createElement('div');
    overlay.style.cssText=`position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;`;

    // Generate random sequence puzzle
    const SEQ_LEN=6;
    const CHARS='ABCDEF0123456789';
    const target=Array.from({length:SEQ_LEN},()=>CHARS[Math.floor(Math.random()*CHARS.length)]).join('');
    let input='';
    let gameOver=false;
    const TIME_LIMIT=15000;
    let timeLeft=TIME_LIMIT;

    overlay.innerHTML=`
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
    overlay.focus();

    const timerInterval=setInterval(()=>{
      if(gameOver){clearInterval(timerInterval);return;}
      timeLeft-=100;
      const bar=document.getElementById('hack-timer-bar');
      if(bar) bar.style.width=(timeLeft/TIME_LIMIT*100)+'%';
      if(timeLeft<=5000&&bar) bar.style.background='#f87171';
      if(timeLeft<=0){
        clearInterval(timerInterval);
        resolveMiss();
      }
    },100);

    const updateDisplay=()=>{
      const el=document.getElementById('hack-input');
      if(el) el.textContent=(input||'_').padEnd(SEQ_LEN,'_').slice(0,SEQ_LEN);
    };

    const resolveWin=()=>{
      gameOver=true; clearInterval(timerInterval);
      const el=document.getElementById('hack-status');
      if(el){el.textContent='✅ BLOCKED! Attack neutralized.';el.style.color='#4ade80';}
      // Reduced damage (10% of normal)
      setTimeout(()=>{
        overlay.remove();
        // glitch effect
        const desktop=document.getElementById('desktop');
        if(effect.glitch&&desktop){
          let g=0; const gi=setInterval(()=>{
            desktop.style.filter=`hue-rotate(${Math.random()*10-5}deg)`;
            if(++g>5){clearInterval(gi);desktop.style.filter='';}
          },100);
        }
        if(typeof Economy!=='undefined'&&typeof send==='function'){
          const stolen=Economy.state.balance*effect.drain*0.1; // 10% damage on success
          if(stolen>0) send({type:'virus:damage',fromId,fromUsername:from,stolen});
          if(typeof OS!=='undefined') OS.notify('🛡️','Hack Blocked',`Partial damage: -$${stolen.toFixed(2)}`);
        }
      },1500);
    };

    const resolveMiss=()=>{
      gameOver=true; clearInterval(timerInterval);
      const el=document.getElementById('hack-status');
      if(el){el.textContent='❌ FAILED! Taking full damage...';el.style.color='#f87171';}
      setTimeout(()=>{
        overlay.remove();
        // Full glitch
        const desktop=document.getElementById('desktop');
        if(effect.glitch&&desktop){
          let g=0; const gi=setInterval(()=>{
            const hue=Math.random()*30-15;
            desktop.style.filter=`hue-rotate(${hue}deg) contrast(${1+Math.random()*0.3})`;
            if(++g>20){clearInterval(gi);desktop.style.filter='';}
          },effect.duration/20);
        }
        if(typeof Economy!=='undefined'){
          const stolen=Economy.state.balance*effect.drain;
          send({type:'virus:damage',fromId,fromUsername:from,stolen});
          if(typeof OS!=='undefined') OS.notify('☣️','Virus Hit!',`${from} stole $${stolen.toFixed(2)}!`);
        }
      },1500);
    };

    const onKey=(e)=>{
      if(gameOver) return;
      const k=e.key.toUpperCase();
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
    setTimeout(()=>{ if(!gameOver){ resolveMiss(); document.removeEventListener('keydown',onKey); }},TIME_LIMIT+500);
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
=======
  ws.on('close', () => {
    const c=clients.get(ws);
    if (c?.authenticated) {
      console.log(`[-] ${c.username} disconnected`);
      broadcast({type:'user:leave',id:c.id,username:c.username});
      broadcastLeaderboard();
>>>>>>> parent of 9ec42d0 (Update server.js)
    }
    const count=state.online.length;
    el.innerHTML=online
      ?`<span style="color:#4ade80;font-size:0.6rem">●</span><span style="font-size:0.65rem;color:var(--text2)">${count}</span>`
      :`<span style="color:#f87171;font-size:0.6rem">●</span>`;
    el.title=online?`${count} online`:'NormNet: offline';
  };
  const updateOnlineCount=()=>updateTaskbarIndicator(connected);

<<<<<<< HEAD
  // ── Public API ────────────────────────────────────────────────────────────────
  const login       = (u,p)  => send({type:'auth:login',  username:u,password:p});
  const signup      = (u,p)  => send({type:'auth:signup', username:u,password:p});
  const setUsername = (n)    => { state.username=n; };
  const sendChat    = (ch,t) => send({type:'chat:message',channel:ch,text:t});
  const joinChannel = (ch)   => send({type:'chat:join',channel:ch});
  const shareClipboard=(t)   => send({type:'clipboard:share',text:t});
  const sendDm      = (to,t,file) => send({type:'dm:send',to,text:t,file:file||null});
  const getDmHistory= (id)   => send({type:'dm:history',withId:id});
  const transferMoney=(to,a) => send({type:'money:transfer',to,amount:a});
  const sendVirus   = (to,t) => send({type:'virus:send',to,virusType:t});
  const buyStock    = (id,sh)=> send({type:'market:buy',stockId:id,shares:sh});
  const sellStock   = (id,sh)=> send({type:'market:sell',stockId:id,shares:sh});
  const ping        = ()     => send({type:'ping'});
  const isConnected = ()     => connected;
  const isAuthenticated=()   => state.authenticated;
  const getState    = ()     => ({...state});

  const tryConnect=()=>{
    if(typeof EventBus!=='undefined') EventBus.on('os:ready',connect);
    else if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(connect,500));
    else setTimeout(connect,500);
  };

  tryConnect();

  return {
    on,off,send,connect,
    login,signup,setUsername,sendChat,joinChannel,shareClipboard,
    sendDm,getDmHistory,transferMoney,sendVirus,
    buyStock,sellStock,ping,isConnected,isAuthenticated,getState,syncEconomy,
  };
=======
function completeLogin(ws, client, acc) {
  client.id=acc.id; client.username=acc.username;
  client.color=acc.color; client.authenticated=true;
  console.log(`[+] ${acc.username} logged in (${clients.size} online)`);
  sendTo(ws,{
    type:'auth:ok', id:acc.id, username:acc.username, color:acc.color,
    balance:acc.balance, deposit:acc.deposit||0,
    creditScore:acc.creditScore||0, loan:acc.loans||null,
    creditTier:getCreditTier(acc.creditScore||0),
    online:getOnlineList(), channels:[...channels.keys()],
    leaderboard:leaderboardData(),
    market:{prices:{...stockPrices},
      history:Object.fromEntries(Object.entries(priceHistory).map(([k,v])=>[k,v.slice(-30)]))},
  });
  const gen=channels.get('#general')||[];
  if (gen.length) sendTo(ws,{type:'chat:history',channel:'#general',messages:gen.slice(-30)});
  broadcast({type:'user:join',user:{id:acc.id,username:acc.username,color:acc.color}},ws);
  broadcastLeaderboard();
}

// daemon.norm
setInterval(() => {
  if (!clients.size) return;
  const text=DAEMON_MSGS[Math.floor(Math.random()*DAEMON_MSGS.length)];
  const e={id:++msgCounter,username:'daemon.norm',color:'#f87171',text,ts:ts()};
  channels.get('#general').push(e);
  broadcast({type:'chat:message',channel:'#general',message:e});
}, 60000+Math.random()*120000);

// ── Startup ───────────────────────────────────────────────────────────────
(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn('  ⚠  DATABASE_URL not set — accounts will not persist across restarts!');
  } else {
    await initDB();
    await loadAccounts();
  }
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  NormOS Server v4.0 — ws://localhost:${PORT}`);
    console.log(`  👥 Accounts loaded: ${accounts.size}`);
    console.log(`  💾 Storage: ${process.env.DATABASE_URL ? 'Postgres ✅' : 'in-memory only ⚠'}`);
  });
>>>>>>> parent of 9ec42d0 (Update server.js)
})();
