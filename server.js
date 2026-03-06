/**
 * NormOS — server.js v5.0
 * Fixes: loan system (fixed $500 tiers), hack cost deduction, save-on-disconnect,
 *        admin powers (Ko1), leaderboard (no DMs), real name support, anti-exploit
 */

const { WebSocketServer, WebSocket } = require('ws');
const http   = require('http');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(process.env.DATA_DIR || __dirname, 'normos_accounts.json');

// ── ADMIN CONFIG ────────────────────────────────────────────────────────────
const ADMIN_USERNAME = 'ko1'; // case-insensitive — Ko1, KO1, ko1 all work

// ── Persistent storage ──────────────────────────────────────────────────────
const saveAccounts = () => {
  try {
    const data = {};
    for (const [key, acc] of accounts) {
      data[key] = {
        id: acc.id,
        username: acc.username,
        realName: acc.realName || '',
        passHash: acc.passHash,
        color: acc.color,
        balance: acc.balance,
        deposit: acc.deposit || 0,
        creditScore: acc.creditScore || 0,
        loans: acc.loans || null,
        hackCooldowns: acc.hackCooldowns || {},
        desktopApps: acc.desktopApps || null,
      };
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.error('Failed to save accounts:', e.message); }
};

const loadAccounts = () => {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    for (const [key, acc] of Object.entries(data)) {
      accounts.set(key, acc);
    }
    console.log(`  ✅ Loaded ${accounts.size} accounts from disk.`);
  } catch (e) { console.error('Failed to load accounts:', e.message); }
};

const accounts = new Map();
const clients  = new Map();
const channels = new Map();
const dms      = new Map();
let   msgCounter = 0;

let _saveTimer = null;
const scheduleSave = () => {
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => { _saveTimer = null; saveAccounts(); }, 1500);
};

// Immediate save for critical operations
const immediateSave = () => {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  saveAccounts();
};

loadAccounts();

// ── Shared Stock Market ──────────────────────────────────────────────────────
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
      scheduleSave();
      const ws = getWsByUsername(acc.username);
      if (ws) sendTo(ws,{type:'bank:interest',amount:interest,newDeposit:acc.deposit});
    }
  }
  broadcastLeaderboard();
}, 60000);

// ── Leaderboard broadcast every 10s ──────────────────────────────────────────
setInterval(() => {
  if (clients.size > 0) broadcastLeaderboard();
}, 10000);

// ── Helpers ──────────────────────────────────────────────────────────────────
const DAEMON_MSGS = [
  'Still running. Just checking in.','I have been here longer than you.',
  'Your files are... interesting.','daemon.norm: process refuses to specify purpose.',
  'The cursor blinks because I allow it.','Memory usage: classified.',
  'I do not sleep. I wait.','A virus was just deployed. Not by me. Probably.',
];
['#general','#norm-talk','#daemon-watch'].forEach(ch => channels.set(ch,[]));

const uid   = () => Math.random().toString(36).slice(2,10);
const ts    = () => new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
const fmt   = (n) => parseFloat(n).toFixed(2);
const phash = (pw) => require('crypto').createHash('sha256').update(pw+'normos_salt_v4').digest('hex');
const COLORS= ['#4f9eff','#4ade80','#f59e0b','#f87171','#c084fc','#67e8f9','#fb923c','#a3e635'];

// ── LOAN SYSTEM: Each tier has a fixed loan amount ────────────────────────────
// Tiers unlock progressively larger fixed loan amounts (not caps, exact values)
const CREDIT_TIERS = [
  {name:'Base',     minScore:0,    loanAmount:500,    rate:0.05, termMs:300000,  color:'#6b7280'},
  {name:'Fair',     minScore:100,  loanAmount:2500,   rate:0.10, termMs:900000,  color:'#f59e0b'},
  {name:'Good',     minScore:300,  loanAmount:10000,  rate:0.15, termMs:1800000, color:'#4ade80'},
  {name:'Excellent',minScore:600,  loanAmount:50000,  rate:0.20, termMs:3600000, color:'#4f9eff'},
  {name:'Elite',    minScore:1000, loanAmount:250000, rate:0.25, termMs:7200000, color:'#c084fc'},
];
const getCreditTier = (score) => {
  let t = CREDIT_TIERS[0];
  for (const c of CREDIT_TIERS) { if (score >= c.minScore) t=c; }
  return t;
};

const isAdmin = (username) => username && username.toLowerCase() === ADMIN_USERNAME;

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

const getOnlineList = () =>
  [...clients.values()].filter(c=>c.authenticated).map(c=>{
    const a=accounts.get(c.username.toLowerCase());
    return {id:c.id,username:c.username,color:c.color,
      balance:a?.balance||0, netWorth:(a?.balance||0)+(a?.deposit||0)};
  });

// ── WebSocket Server ──────────────────────────────────────────────────────────
const server = http.createServer((req,res) => {
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({status:'NormOS Server v5.0',users:clients.size}));
});
const wss = new WebSocketServer({server});

wss.on('connection', (ws) => {
  const client = {id:uid(),username:null,color:'#6b7280',authenticated:false};
  clients.set(ws,client);
  sendTo(ws,{type:'auth:required'});

  ws.on('message', (raw) => {
    let msg; try { msg=JSON.parse(raw); } catch { return; }

    // ── Auth ─────────────────────────────────────────────────────────────
    if (msg.type==='auth:signup') {
      const uname=(msg.username||'').trim().slice(0,24).replace(/[^a-zA-Z0-9_]/g,'');
      const displayName=(msg.displayName||uname).trim().slice(0,24).replace(/[^a-zA-Z0-9_]/g,'');
      const realName=(msg.realName||'').trim().slice(0,100);
      const pw=(msg.password||'').trim();
      if (uname.length<2) { sendTo(ws,{type:'auth:error',message:'Username too short (min 2).'}); return; }
      if (pw.length<3)    { sendTo(ws,{type:'auth:error',message:'Password too short (min 3).'}); return; }
      if (accounts.has(uname.toLowerCase())) { sendTo(ws,{type:'auth:error',message:'Username taken.'}); return; }
      const acc={
        id:uid(), username:displayName||uname,
        realName: realName,
        passHash:phash(pw),
        color:COLORS[accounts.size%COLORS.length],
        balance:10000, deposit:0, creditScore:0,
        loans:null, hackCooldowns:{}, desktopApps:null
      };
      accounts.set(uname.toLowerCase(),acc);
      immediateSave();
      completeLogin(ws,client,acc);
      return;
    }

    if (msg.type==='auth:login') {
      const uname=(msg.username||'').trim().toLowerCase();
      const pw=(msg.password||'').trim();
      const acc=accounts.get(uname);
      if (!acc) { sendTo(ws,{type:'auth:error',message:'Account not found. Sign up first.'}); return; }
      if (acc.passHash!==phash(pw)) { sendTo(ws,{type:'auth:error',message:'Wrong password.'}); return; }
      // Kick existing session
      const old=getWsByUsername(acc.username);
      if (old&&old!==ws) {
        sendTo(old,{type:'auth:kicked',message:'Logged in from another location.'});
        clients.delete(old); try{old.close();}catch{}
      }
      completeLogin(ws,client,acc);
      return;
    }

    if (!client.authenticated) { sendTo(ws,{type:'auth:required'}); return; }
    const acc=accounts.get(client.username.toLowerCase());
    if (!acc) return;

    switch(msg.type) {

      case 'economy:sync':
        broadcastLeaderboard(); break;

      // ── Money transfer ──────────────────────────────────────────────
      case 'money:transfer': {
        const amt=parseFloat(msg.amount)||0;
        if (amt<=0) { sendTo(ws,{type:'money:transfer:fail',reason:'Invalid amount.'}); break; }
        if (amt>acc.balance) { sendTo(ws,{type:'money:transfer:fail',reason:'Insufficient funds.'}); break; }
        // Accept username-based transfers only (not ID-based to prevent exploits)
        const targetName=(msg.to||'').toLowerCase();
        const tacc=accounts.get(targetName);
        if (!tacc) { sendTo(ws,{type:'money:transfer:fail',reason:'User not found.'}); break; }
        if (tacc.username.toLowerCase()===client.username.toLowerCase()) {
          sendTo(ws,{type:'money:transfer:fail',reason:'Cannot send money to yourself.'}); break;
        }
        acc.balance-=amt; tacc.balance+=amt;
        immediateSave();
        const tws=getWsByUsername(tacc.username);
        if (tws) sendTo(tws,{type:'money:received',from:acc.username,fromId:client.id,amount:amt,ts:ts()});
        sendTo(ws,{type:'money:transfer:ok',to:tacc.username,amount:amt,newBalance:acc.balance,ts:ts()});
        broadcastLeaderboard(); break;
      }

      // ── Central Bank ──────────────────────────────────────────────────
      case 'bank:get':
        sendTo(ws,{type:'bank:update',balance:acc.balance,deposit:acc.deposit||0,
          creditScore:acc.creditScore||0,loan:acc.loans||null,
          creditTier:getCreditTier(acc.creditScore||0)}); break;

      case 'bank:deposit': {
        const amt=parseFloat(msg.amount)||0;
        if (amt<=0||amt>acc.balance) { sendTo(ws,{type:'bank:error',message:'Invalid amount.'}); break; }
        acc.balance-=amt; acc.deposit=(acc.deposit||0)+amt;
        immediateSave();
        sendTo(ws,{type:'bank:update',balance:acc.balance,deposit:acc.deposit,
          creditScore:acc.creditScore||0,loan:acc.loans||null,
          creditTier:getCreditTier(acc.creditScore||0)});
        broadcastLeaderboard(); break;
      }

      case 'bank:withdraw': {
        const amt=parseFloat(msg.amount)||0;
        if (amt<=0||amt>(acc.deposit||0)) { sendTo(ws,{type:'bank:error',message:'Invalid amount.'}); break; }
        acc.deposit-=amt; acc.balance+=amt;
        immediateSave();
        sendTo(ws,{type:'bank:update',balance:acc.balance,deposit:acc.deposit,
          creditScore:acc.creditScore||0,loan:acc.loans||null,
          creditTier:getCreditTier(acc.creditScore||0)});
        broadcastLeaderboard(); break;
      }

      // ── LOAN SYSTEM (fixed amount per tier) ──────────────────────────
      case 'bank:loan:request': {
        if (acc.loans?.active) { sendTo(ws,{type:'bank:error',message:'Already have an active loan.'}); break; }

        const score = acc.creditScore || 0;
        const tier  = getCreditTier(score);

        // The fixed loan amount for this tier — client must send exact tier amount
        const amt = tier.loanAmount;
        const requestedAmt = parseFloat(msg.amount) || 0;
        if (requestedAmt !== amt) {
          sendTo(ws,{type:'bank:error',message:`Your tier "${tier.name}" has a fixed loan of $${amt.toLocaleString()}.`}); break;
        }

        acc.loans = {
          active:true, principal:amt, rate:tier.rate, termMs:tier.termMs,
          borrowedAt:Date.now(), dueAt:Date.now()+tier.termMs,
          totalDue: parseFloat((amt + amt * tier.rate).toFixed(2)),
          tier: tier.name,
        };
        acc.balance += amt;
        immediateSave();
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
        immediateSave();
        sendTo(ws,{type:'bank:loan:repaid',onTime,creditScore:acc.creditScore,newBalance:acc.balance});
        broadcastLeaderboard(); break;
      }

      case 'bank:loan:default': {
        if (!acc.loans?.active) break;
        acc.balance=0; acc.deposit=0;
        acc.creditScore=Math.max(0,(acc.creditScore||0)-200);
        acc.loans=null;
        immediateSave();
        sendTo(ws,{type:'bank:loan:defaulted',creditScore:acc.creditScore,newBalance:0});
        broadcastLeaderboard(); break;
      }

      // ── Market ────────────────────────────────────────────────────────
      case 'market:buy': {
        const stock=STOCKS.find(s=>s.id===msg.stockId);
        if (!stock||msg.shares<=0) break;
        const price=stockPrices[msg.stockId];
        const cost=price*msg.shares;
        if (cost>acc.balance) { sendTo(ws,{type:'market:trade:fail',reason:`Need $${fmt(cost)}.`}); break; }
        acc.balance-=cost;
        scheduleSave();
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
        scheduleSave();
        tradeVolume[msg.stockId]=(tradeVolume[msg.stockId]||0)-msg.shares*0.5;
        sendTo(ws,{type:'market:trade:ok',action:'SELL',stockId:msg.stockId,shares:msg.shares,price,revenue:rev,newBalance:acc.balance});
        broadcast({type:'market:activity',action:'SELL',username:acc.username,color:acc.color,
          stockId:msg.stockId,shares:msg.shares,price},ws);
        broadcastLeaderboard(); break;
      }

      // ── Virus / Hacking (server validates cost and cooldown) ──────────
      case 'virus:send': {
        const COSTS = {generic:50, ransomware:500, miner:200, glitch:100};
        const vt    = msg.virusType || 'generic';
        const cost  = COSTS[vt] || 50;

        if (!acc.hackCooldowns) acc.hackCooldowns = {};
        const ck   = `${vt}:${msg.to}`;
        const last = acc.hackCooldowns[ck] || 0;

        // Enforce 60-second cooldown server-side
        if (Date.now()-last < 60000) {
          const rem = Math.ceil((60000-(Date.now()-last))/1000);
          sendTo(ws,{type:'virus:fail',reason:`Cooldown: ${rem}s remaining.`}); break;
        }

        // Enforce balance check and deduct cost on server
        if (acc.balance < cost) { sendTo(ws,{type:'virus:fail',reason:`Need $${cost} to send ${vt}.`}); break; }

        const tws = getWsById(msg.to);
        if (!tws) { sendTo(ws,{type:'virus:fail',reason:'Target offline.'}); break; }

        // Deduct cost from attacker BEFORE sending
        acc.balance -= cost;
        immediateSave();
        acc.hackCooldowns[ck] = Date.now();

        sendTo(tws,{type:'virus:incoming',from:acc.username,fromId:client.id,virusType:vt,ts:ts()});
        sendTo(ws,{type:'virus:sent',to:clients.get(tws)?.username,virusType:vt,cost,newBalance:acc.balance,ts:ts()});

        const ve={id:++msgCounter,username:'daemon.norm',color:'#f87171',
          text:`☣️ ${acc.username} deployed ${vt} vs ${clients.get(tws)?.username}.`,ts:ts()};
        channels.get('#daemon-watch').push(ve);
        broadcast({type:'chat:message',channel:'#daemon-watch',message:ve});
        broadcastLeaderboard(); break;
      }

      case 'virus:damage': {
        // Server validates stolen amount can't exceed balance
        const stolen = Math.min(Math.max(0, parseFloat(msg.stolen)||0), acc.balance);
        acc.balance  = Math.max(0, acc.balance - stolen);
        immediateSave();
        const aacc = accounts.get((msg.fromUsername||'').toLowerCase());
        if (aacc) {
          aacc.balance += stolen;
          scheduleSave();
          const aws = getWsByUsername(aacc.username);
          if (aws) sendTo(aws,{type:'virus:loot',amount:stolen,from:acc.username});
        }
        sendTo(ws,{type:'economy:balance:update',balance:acc.balance});
        broadcastLeaderboard(); break;
      }

      // ── Chat ──────────────────────────────────────────────────────────
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

      case 'leaderboard:get':
        sendTo(ws,{type:'leaderboard:rich',leaderboard:leaderboardData()}); break;

      case 'clipboard:share':
        broadcast({type:'clipboard:incoming',from:acc.username,color:acc.color,
          text:(msg.text||'').slice(0,2000),ts:ts()},ws); break;

      // ── Desktop apps sync ─────────────────────────────────────────────
      case 'desktop:save': {
        if (Array.isArray(msg.apps)) {
          acc.desktopApps = msg.apps.slice(0, 50); // max 50 desktop icons
          scheduleSave();
        }
        break;
      }

      case 'desktop:get':
        sendTo(ws,{type:'desktop:data',apps:acc.desktopApps||null}); break;

      // ── Admin commands ─────────────────────────────────────────────────
      case 'admin:kick': {
        if (!isAdmin(acc.username)) { sendTo(ws,{type:'admin:error',message:'Not authorized.'}); break; }
        const targetWs = getWsByUsername(msg.username||'');
        if (!targetWs) { sendTo(ws,{type:'admin:error',message:'User not online.'}); break; }
        sendTo(targetWs,{type:'auth:kicked',message:'You have been kicked by an administrator.'});
        setTimeout(()=>{ try{targetWs.close();}catch{} clients.delete(targetWs); },500);
        sendTo(ws,{type:'admin:ok',message:`Kicked ${msg.username}.`});
        broadcastLeaderboard(); break;
      }

      case 'admin:setbalance': {
        if (!isAdmin(acc.username)) { sendTo(ws,{type:'admin:error',message:'Not authorized.'}); break; }
        const tacc = accounts.get((msg.username||'').toLowerCase());
        if (!tacc) { sendTo(ws,{type:'admin:error',message:'User not found.'}); break; }
        const newBal = parseFloat(msg.balance);
        if (isNaN(newBal)||newBal<0) { sendTo(ws,{type:'admin:error',message:'Invalid balance.'}); break; }
        tacc.balance = newBal;
        immediateSave();
        const tws2 = getWsByUsername(tacc.username);
        if (tws2) sendTo(tws2,{type:'bank:update',balance:tacc.balance,deposit:tacc.deposit||0,
          creditScore:tacc.creditScore||0,loan:tacc.loans||null,
          creditTier:getCreditTier(tacc.creditScore||0)});
        sendTo(ws,{type:'admin:ok',message:`Set ${msg.username} balance to $${fmt(newBal)}.`});
        broadcastLeaderboard(); break;
      }

      case 'admin:getusers': {
        if (!isAdmin(acc.username)) { sendTo(ws,{type:'admin:error',message:'Not authorized.'}); break; }
        const userList = [...accounts.values()].map(a=>({
          username: a.username,
          realName: a.realName || '(not set)',
          balance: a.balance,
          deposit: a.deposit||0,
          creditScore: a.creditScore||0,
          hasLoan: !!(a.loans?.active),
        }));
        sendTo(ws,{type:'admin:users',users:userList}); break;
      }

      case 'admin:deleteaccount': {
        if (!isAdmin(acc.username)) { sendTo(ws,{type:'admin:error',message:'Not authorized.'}); break; }
        const delName = (msg.username||'').toLowerCase();
        if (!delName) { sendTo(ws,{type:'admin:error',message:'No username provided.'}); break; }
        if (delName === ADMIN_USERNAME) { sendTo(ws,{type:'admin:error',message:'Cannot delete admin account.'}); break; }
        const delAcc = accounts.get(delName);
        if (!delAcc) { sendTo(ws,{type:'admin:error',message:'Account not found.'}); break; }
        // Kick the user if online
        const delWs = getWsByUsername(delAcc.username);
        if (delWs) {
          sendTo(delWs,{type:'auth:kicked',message:'Your account has been deleted by an administrator.'});
          setTimeout(()=>{ try{delWs.close();}catch{} clients.delete(delWs); },500);
        }
        accounts.delete(delName);
        immediateSave();
        sendTo(ws,{type:'admin:ok',message:`Account "${delAcc.username}" deleted.`});
        broadcastLeaderboard(); break;
      }

      case 'ping': sendTo(ws,{type:'pong',ts:Date.now()}); break;
    }
  });

  ws.on('close', () => {
    const c = clients.get(ws);
    if (c?.authenticated) {
      console.log(`[-] ${c.username} disconnected`);
      // Save immediately on disconnect to prevent refresh exploits
      const disconnAcc = accounts.get(c.username.toLowerCase());
      if (disconnAcc) {
        immediateSave();
      }
      broadcast({type:'user:leave',id:c.id,username:c.username});
      broadcastLeaderboard();
    }
    clients.delete(ws);
  });
  ws.on('error', () => {
    const c = clients.get(ws);
    if (c?.authenticated) {
      const errAcc = accounts.get(c.username?.toLowerCase());
      if (errAcc) immediateSave();
    }
    clients.delete(ws);
  });
});

function completeLogin(ws, client, acc) {
  client.id=acc.id; client.username=acc.username;
  client.color=acc.color; client.authenticated=true;
  console.log(`[+] ${acc.username} logged in (${clients.size} online)`);

  const isAdminUser = isAdmin(acc.username);

  sendTo(ws,{
    type:'auth:ok', id:acc.id, username:acc.username, color:acc.color,
    balance:acc.balance, deposit:acc.deposit||0,
    creditScore:acc.creditScore||0, loan:acc.loans||null,
    creditTier:getCreditTier(acc.creditScore||0),
    online:getOnlineList(), channels:[...channels.keys()],
    leaderboard:leaderboardData(),
    isAdmin: isAdminUser,
    desktopApps: acc.desktopApps || null,
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

server.listen(PORT, () => {
  console.log(`\n  NormOS Server v5.0 — ws://localhost:${PORT}`);
  console.log(`  💾 DB: ${DB_FILE}`);
  console.log(`  👥 Accounts loaded: ${accounts.size}`);
  console.log(`  👑 Admin: ${ADMIN_USERNAME}`);
  if (!process.env.DATA_DIR) {
    console.log(`  ⚠  DATA_DIR not set. Set DATA_DIR=/data for persistent storage.`);
  } else {
    console.log(`  ✅ Persistent storage at ${process.env.DATA_DIR}`);
  }
});
