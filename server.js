/**
 * NormOS — server.js v4.0
 * Features: account auth, central bank, DMs w/ files, shared stock market,
 *           money transfers, virus attacks, hacking cooldowns, daemon.norm
 */

const { WebSocketServer, WebSocket } = require('ws');
const http   = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 3001;

// Fresh in-memory store — all accounts wiped on server restart per v4.0 spec
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

const getOnlineList = () =>
  [...clients.values()].filter(c=>c.authenticated).map(c=>{
    const a=accounts.get(c.username.toLowerCase());
    return {id:c.id,username:c.username,color:c.color,
      balance:a?.balance||0, netWorth:(a?.balance||0)+(a?.deposit||0)};
  });

// ── WebSocket Server ───────────────────────────────────────────────────────
const server = http.createServer((req,res) => {
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({status:'NormOS Server v4.0',users:clients.size}));
});
const wss = new WebSocketServer({server});

wss.on('connection', (ws) => {
  const client = {id:uid(),username:null,color:'#6b7280',authenticated:false};
  clients.set(ws,client);
  sendTo(ws,{type:'auth:required'});

  ws.on('message', (raw) => {
    let msg; try { msg=JSON.parse(raw); } catch { return; }

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
        // Client sends netWorth for leaderboard display only — never trust client balance
        broadcastLeaderboard(); break;

      case 'money:transfer': {
        const amt=parseFloat(msg.amount)||0;
        if (amt<=0) { sendTo(ws,{type:'money:transfer:fail',reason:'Invalid amount.'}); break; }
        if (amt>acc.balance) { sendTo(ws,{type:'money:transfer:fail',reason:'Insufficient funds.'}); break; }
        const tacc=accounts.get((msg.to||'').toLowerCase());
        if (!tacc) { sendTo(ws,{type:'money:transfer:fail',reason:'User not found.'}); break; }
        acc.balance-=amt; tacc.balance+=amt;
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
        sendTo(ws,{type:'bank:update',balance:acc.balance,deposit:acc.deposit,
          creditScore:acc.creditScore||0,loan:acc.loans||null,
          creditTier:getCreditTier(acc.creditScore||0)});
        broadcastLeaderboard(); break;
      }

      case 'bank:withdraw': {
        const amt=parseFloat(msg.amount)||0;
        if (amt<=0||amt>(acc.deposit||0)) { sendTo(ws,{type:'bank:error',message:'Invalid amount.'}); break; }
        acc.deposit-=amt; acc.balance+=amt;
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
        sendTo(ws,{type:'bank:loan:repaid',onTime,creditScore:acc.creditScore,newBalance:acc.balance});
        broadcastLeaderboard(); break;
      }

      case 'bank:loan:default': {
        if (!acc.loans?.active) break;
        acc.balance=0; acc.deposit=0;
        acc.creditScore=Math.max(0,(acc.creditScore||0)-200);
        acc.loans=null;
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
        tradeVolume[msg.stockId]=(tradeVolume[msg.stockId]||0)+msg.shares;
        sendTo(ws,{type:'market:trade:ok',action:'BUY',stockId:msg.stockId,shares:msg.shares,price,cost,newBalance:acc.balance});
        broadcast({type:'market:activity',action:'BUY',username:acc.username,color:acc.color,
          stockId:msg.stockId,shares:msg.shares,price},ws);
        broadcastLeaderboard(); break;
      }

      case 'market:sell': {
        const stock=STOCKS.find(s=>s.id===msg.stockId);
        if (!stock||!msg.shares||msg.shares<=0) { sendTo(ws,{type:'market:trade:fail',reason:'Invalid sell order.'}); break; }
        const price=stockPrices[msg.stockId];
        const rev=price*msg.shares;
        acc.balance+=rev;
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
        // Cap stolen to max 25% of victim's balance (prevents client sending inflated value)
        const maxDrain = acc.balance * 0.25;
        const stolen=Math.min(Math.max(0,parseFloat(msg.stolen)||0), maxDrain, acc.balance);
        acc.balance=Math.max(0,acc.balance-stolen);
        const aacc=accounts.get((msg.fromUsername||'').toLowerCase());
        if (aacc) {
          aacc.balance+=stolen;
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
    }
  });

  ws.on('close', () => {
    const c=clients.get(ws);
    if (c?.authenticated) {
      console.log(`[-] ${c.username} disconnected`);
      broadcast({type:'user:leave',id:c.id,username:c.username});
      broadcastLeaderboard();
    }
    clients.delete(ws);
  });
  ws.on('error', () => clients.delete(ws));
});

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

server.listen(PORT, () => {
  console.log(`\n  NormOS Server v4.0 — ws://localhost:${PORT}`);
  console.log(`  ⚠ All accounts wiped (fresh start per v4.0).\n`);
});
