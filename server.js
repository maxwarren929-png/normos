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
  { id:'ITACO',   name:"Isaac's Tacos",      sector:'Consumer', basePrice:42.00,  vol:0.35,  icon:'🌮' },
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
    const buyPressure  = (tradeVolume[s.id+'_buy'] ||0) * cur * 0.006;
    const sellPressure = (tradeVolume[s.id+'_sell']||0) * cur * 0.006;
    let next;

    if (s.id === 'ITACO') {
      // Isaac's Tacos: full chaos — can swing up to 1000% up or down each tick
      const roll = Math.random();
      if (roll < 0.04) {
        // Massive moon (up to +1000%)
        const multiplier = 1 + (Math.random() * 10); // 1x–11x
        next = cur * multiplier;
        const ann = {id:++msgCounter,username:'🌮 Taco Bell',color:'#f59e0b',
          text:`🚀 ITACO MOONING +${((multiplier-1)*100).toFixed(0)}%!! Isaac found a new recipe!`,ts:ts()};
        channels.get('#general').push(ann);
        broadcast({type:'chat:message',channel:'#general',message:ann});
      } else if (roll < 0.08) {
        // Catastrophic crash (down to -99%)
        const losePct = 0.01 + Math.random() * 0.99; // lose 1%–99% of value
        next = Math.max(0.01, cur * (1 - losePct));
        const ann = {id:++msgCounter,username:'🌮 Health Inspector',color:'#f87171',
          text:`💀 ITACO CRASHED -${(losePct*100).toFixed(0)}%!! Taco Tuesday cancelled.`,ts:ts()};
        channels.get('#general').push(ann);
        broadcast({type:'chat:message',channel:'#general',message:ann});
      } else {
        // Normal tick with high volatility
        const shock  = cur * 0.6 * (Math.random() - 0.5);
        const revert = (s.basePrice - cur) * 0.002;
        next = Math.max(0.01, cur + revert + shock + buyPressure - sellPressure);
      }
    } else {
      const revert = (s.basePrice - cur) * 0.001;
      const shock  = cur * s.vol * (Math.random() - 0.5) * 0.2;
      const event  = Math.random() < 0.01 ? cur * (Math.random() * 0.12 - 0.06) : 0;
      next = Math.max(0.0001, cur + revert + shock + event + buyPressure - sellPressure);
      if (s.sector === 'Crypto' && Math.random() < 0.005)
        next = cur * (Math.random() < 0.5 ? 1.3 : 0.7);
    }

    stockPrices[s.id] = parseFloat(next.toFixed(s.id === 'VOID_C' ? 6 : 2));
    tradeVolume[s.id+'_buy']  = 0;
    tradeVolume[s.id+'_sell'] = 0;
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

const leaderboardData = () => {
  // Real players
  const players = [...accounts.values()].map(a=>({
    id:a.id, username:a.username, color:a.color,
    balance:a.balance, deposit:a.deposit||0,
    netWorth:a.balance+(a.deposit||0),
    creditScore:a.creditScore||0,
    isBank:false,
  })).sort((a,b)=>b.netWorth-a.netWorth).slice(0,50).map((u,i)=>({...u,rank:i+1}));

  // NormBank — appears as a player holding everyone's deposits
  const totalDeposits = [...accounts.values()].reduce((s,a)=>s+(a.deposit||0),0);
  const bankEntry = {
    id:'normbank', username:'NormBank', color:'#4ade80',
    balance:totalDeposits, deposit:0,
    netWorth:totalDeposits, creditScore:9999,
    isBank:true, rank:0,
  };

  // Insert bank into sorted list
  const all = [...players, bankEntry].sort((a,b)=>b.netWorth-a.netWorth).map((u,i)=>({...u,rank:i+1}));
  return all;
};

const broadcastPaywallProfiles = () => {
  const profiles = [...accounts.values()]
    .filter(a=>a.paywalls && Object.keys(a.paywalls).length>0)
    .map(a=>({ username:a.username, paywalls: Object.fromEntries(
      Object.entries(a.paywalls).map(([k,v])=>[k,{price:v.price}])
    )}));
  broadcast({type:'media:paywall:profiles', profiles});
};

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
      const displayName=(msg.displayName||msg.username||'').trim().slice(0,24).replace(/[^a-zA-Z0-9_]/g,'');
      const realName=(msg.realName||'').trim().slice(0,64);
      const uname=displayName;
      const pw=(msg.password||'').trim();
      if (uname.length<2) { sendTo(ws,{type:'auth:error',message:'Display name too short (min 2).'}); return; }
      if (pw.length<3)    { sendTo(ws,{type:'auth:error',message:'Password too short (min 3).'}); return; }
      if (accounts.has(uname.toLowerCase())) { sendTo(ws,{type:'auth:error',message:'Username taken.'}); return; }
      const acc={id:uid(),username:uname,displayName:uname,realName:realName||'',passHash:phash(pw),
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
        // Each tier has exactly one loan amount (min = max = loanCap)
        if (amt !== tier.loanCap) {
          sendTo(ws,{type:'bank:error',message:`Your tier "${tier.name}" loans are exactly $${tier.loanCap.toLocaleString()}. No more, no less.`}); break;
        }
        const rate=tier.loanCap<=500?0.05:tier.loanCap<=2500?0.10:tier.loanCap<=10000?0.20:0.30;
        const termMs=tier.loanCap<=500?300000:tier.loanCap<=2500?900000:tier.loanCap<=10000?1800000:3600000;
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
        tradeVolume[msg.stockId+'_buy']=(tradeVolume[msg.stockId+'_buy']||0)+msg.shares;
        sendTo(ws,{type:'market:trade:ok',action:'BUY',stockId:msg.stockId,shares:msg.shares,price,cost,newBalance:acc.balance});
        broadcast({type:'market:activity',action:'BUY',username:acc.username,color:acc.color,
          stockId:msg.stockId,shares:msg.shares,price},ws);
        broadcastLeaderboard(); break;
      }

      case 'market:sell': {
        const price=stockPrices[msg.stockId];
        const rev=price*msg.shares;
        acc.balance+=rev;
        tradeVolume[msg.stockId+'_sell']=(tradeVolume[msg.stockId+'_sell']||0)+msg.shares;
        sendTo(ws,{type:'market:trade:ok',action:'SELL',stockId:msg.stockId,shares:msg.shares,price,revenue:rev,newBalance:acc.balance});
        broadcast({type:'market:activity',action:'SELL',username:acc.username,color:acc.color,
          stockId:msg.stockId,shares:msg.shares,price},ws);
        broadcastLeaderboard(); break;
      }

      // ── Virus / Hacking ─────────────────────────────────────────────
      case 'virus:send': {
        const vt=msg.virusType||'generic';
        if (!acc.hackCooldowns) acc.hackCooldowns={};
        const ck=`${vt}:${msg.to}`;
        const last=acc.hackCooldowns[ck]||0;
        if (Date.now()-last<60000) {
          const rem=Math.ceil((60000-(Date.now()-last))/1000);
          sendTo(ws,{type:'virus:fail',reason:`Cooldown: ${rem}s remaining.`}); break;
        }
        acc.hackCooldowns[ck]=Date.now();

        // ── Hacking NormBank ─────────────────────────────────────────
        if (msg.to === 'normbank') {
          const roll = Math.random();
          if (roll >= 0.02) {
            // 98% fail
            sendTo(ws,{type:'virus:fail',reason:'🏦 NormBank firewall deflected your attack! (2% chance to succeed)'}); 
            const failAnn={id:++msgCounter,username:'daemon.norm',color:'#f87171',
              text:`🛡️ ${acc.username} tried to hack NormBank and FAILED. The bank firewall is no joke.`,ts:ts()};
            channels.get('#daemon-watch').push(failAnn);
            broadcast({type:'chat:message',channel:'#daemon-watch',message:failAnn});
            break;
          }
          // 2% SUCCESS — steal a % based on virus type, split among depositors
          const stealPct = vt==='ransomware'?0.20:vt==='miner'?0.10:vt==='glitch'?0.05:0.03;
          const totalDeposits = [...accounts.values()].reduce((s,a)=>s+(a.deposit||0),0);
          const stolen = totalDeposits * stealPct;
          if (stolen < 1) { sendTo(ws,{type:'virus:fail',reason:'Bank vault is empty!'}); break; }

          // Deduct proportionally from all depositors and give attacker the loot
          const depositors = [...accounts.values()].filter(a=>(a.deposit||0)>0);
          let actualStolen = 0;
          for (const dep of depositors) {
            const share = (dep.deposit / totalDeposits) * stolen;
            const take  = Math.min(share, dep.deposit);
            dep.deposit -= take;
            actualStolen += take;
            const dws = getWsByUsername(dep.username);
            if (dws) sendTo(dws,{type:'bank:hacked',
              amount:take, by:acc.username, virusType:vt,
              newDeposit:dep.deposit,
              message:`🏦💀 NormBank was hacked by ${acc.username}! You lost $${take.toFixed(2)} from your deposit.`});
          }
          acc.balance += actualStolen;
          sendTo(ws,{type:'virus:bank:success',stolen:actualStolen,
            message:`🏦💰 YOU HACKED NORMBANK! Stole $${actualStolen.toFixed(2)} (${(stealPct*100).toFixed(0)}% of vault)`});
          const ann={id:++msgCounter,username:'🚨 SYSTEM ALERT',color:'#f87171',
            text:`🏦💀 NORMBANK WAS HACKED by ${acc.username}! $${actualStolen.toFixed(2)} stolen from depositor vaults!`,ts:ts()};
          channels.get('#general').push(ann); channels.get('#daemon-watch').push(ann);
          broadcast({type:'chat:message',channel:'#general',message:ann});
          broadcast({type:'chat:message',channel:'#daemon-watch',message:ann});
          broadcastLeaderboard(); break;
        }

        // ── Normal player hack ───────────────────────────────────────
        const tws=getWsById(msg.to);
        if (!tws) { sendTo(ws,{type:'virus:fail',reason:'Target offline.'}); break; }
        sendTo(tws,{type:'virus:incoming',from:acc.username,fromId:client.id,virusType:vt,ts:ts()});
        sendTo(ws,{type:'virus:sent',to:clients.get(tws)?.username,virusType:vt,cost:0,ts:ts()});
        const ve={id:++msgCounter,username:'daemon.norm',color:'#f87171',
          text:`☣️ ${acc.username} deployed ${vt} vs ${clients.get(tws)?.username}.`,ts:ts()};
        channels.get('#daemon-watch').push(ve);
        broadcast({type:'chat:message',channel:'#daemon-watch',message:ve});
        broadcastLeaderboard(); break;
      }

      case 'virus:damage': {
        const stolen=Math.min(Math.max(0,parseFloat(msg.stolen)||0),acc.balance);
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

      case 'account:rename': {
        const newName=(msg.newName||'').trim().slice(0,24).replace(/[^a-zA-Z0-9_]/g,'');
        if (newName.length<2) { sendTo(ws,{type:'rename:fail',reason:'Name too short.'}); break; }
        if (newName.toLowerCase()===acc.username.toLowerCase()) { sendTo(ws,{type:'rename:fail',reason:'Same name.'}); break; }
        if (accounts.has(newName.toLowerCase())) { sendTo(ws,{type:'rename:fail',reason:'Name taken.'}); break; }
        const oldKey=acc.username.toLowerCase();
        accounts.delete(oldKey);
        const oldName=acc.username;
        acc.username=newName; acc.displayName=newName;
        accounts.set(newName.toLowerCase(),acc);
        client.username=newName;
        sendTo(ws,{type:'rename:ok',newName});
        broadcast({type:'user:rename',id:client.id,oldName,newName:newName});
        broadcastLeaderboard(); break;
      }

      // ── Admin (Ko1 only) ────────────────────────────────────────────────
      case 'admin:kick': {
        if (acc.username.toLowerCase()!=='ko1') { sendTo(ws,{type:'admin:fail',reason:'Not admin.'}); break; }
        const tws2=getWsByUsername(msg.target||'');
        if (!tws2) { sendTo(ws,{type:'admin:fail',reason:'User not found.'}); break; }
        const tacc2=accounts.get((msg.target||'').toLowerCase());
        sendTo(tws2,{type:'auth:kicked',message:msg.reason||'Kicked by admin.'});
        if (tacc2) {
          const ann2={id:++msgCounter,username:'NormOS',color:'#f87171',text:`🔨 ${msg.target} was kicked by Ko1.`,ts:ts()};
          channels.get('#general').push(ann2);
          broadcast({type:'chat:message',channel:'#general',message:ann2});
        }
        clients.delete(tws2); try{tws2.close();}catch{}
        broadcastLeaderboard();
        sendTo(ws,{type:'admin:ok',action:'kick',target:msg.target}); break;
      }

      case 'admin:setbalance': {
        if (acc.username.toLowerCase()!=='ko1') { sendTo(ws,{type:'admin:fail',reason:'Not admin.'}); break; }
        const tacc3=accounts.get((msg.target||'').toLowerCase());
        if (!tacc3) { sendTo(ws,{type:'admin:fail',reason:'User not found.'}); break; }
        const newBal=parseFloat(msg.balance);
        if (isNaN(newBal)||newBal<0) { sendTo(ws,{type:'admin:fail',reason:'Invalid balance.'}); break; }
        tacc3.balance=newBal;
        const tws3=getWsByUsername(tacc3.username);
        if (tws3) {
          sendTo(tws3,{type:'economy:balance:update',balance:newBal});
          sendTo(tws3,{type:'bank:update',balance:newBal,deposit:tacc3.deposit||0,creditScore:tacc3.creditScore||0,loan:tacc3.loans||null,creditTier:getCreditTier(tacc3.creditScore||0)});
        }
        broadcastLeaderboard();
        sendTo(ws,{type:'admin:ok',action:'setbalance',target:msg.target,balance:newBal}); break;
      }

      case 'admin:realnames': {
        if (acc.username.toLowerCase()!=='ko1') { sendTo(ws,{type:'admin:fail',reason:'Not admin.'}); break; }
        const names=[...accounts.values()].map(a=>({username:a.username,realName:a.realName||''}));
        sendTo(ws,{type:'admin:realnames',names}); break;
      }

      case 'shop:purchase': {
        // Client already deducted balance locally; server just validates and logs
        const cost=parseFloat(msg.price)||0;
        if (cost>0) {
          if (acc.balance<cost) { sendTo(ws,{type:'shop:fail',reason:'Insufficient funds.'}); break; }
          acc.balance-=cost;
          sendTo(ws,{type:'economy:balance:update',balance:acc.balance});
          broadcastLeaderboard();
        }
        break;
      }

      case 'hack:cooldown:reset': {
        if (acc.hackCooldowns) acc.hackCooldowns={};
        sendTo(ws,{type:'hack:cooldown:reset:ok'}); break;
      }

      case 'normtok:post': {
        // Broadcast post to all other clients
        if (!msg.post) break;
        broadcast({type:'normtok:post',post:msg.post},ws);
        break;
      }

      case 'normtunes:upload': {
        // Broadcast uploaded track to all other clients
        if (!msg.track) break;
        broadcast({type:'normtunes:track',track:msg.track},ws);
        break;
      }

      // ── Media Paywall ────────────────────────────────────────────────
      case 'media:paywall:set': {
        // Player sets a price gate on their NormTok or NormTunes
        const price = parseFloat(msg.price)||0;
        const mediaType = msg.mediaType; // 'normtok' | 'normtunes'
        if (!acc.paywalls) acc.paywalls = {};
        if (price <= 0) {
          delete acc.paywalls[mediaType];
        } else {
          acc.paywalls[mediaType] = { price, unlockedBy: acc.paywalls[mediaType]?.unlockedBy || [] };
        }
        sendTo(ws,{type:'media:paywall:set:ok', mediaType, price});
        // Broadcast updated paywall profiles to all so leaderboard/hacker list updates
        broadcastPaywallProfiles();
        break;
      }

      case 'media:paywall:unlock': {
        // Someone pays to unlock another player's NormTok/NormTunes
        const owner = accounts.get((msg.owner||'').toLowerCase());
        const mediaType = msg.mediaType;
        if (!owner || !owner.paywalls?.[mediaType]) { sendTo(ws,{type:'media:paywall:unlock:fail',reason:'No paywall found.'}); break; }
        const price = owner.paywalls[mediaType].price;
        if (acc.balance < price) { sendTo(ws,{type:'media:paywall:unlock:fail',reason:`Need $${price.toFixed(2)}.`}); break; }
        acc.balance -= price;
        owner.balance += price;
        if (!owner.paywalls[mediaType].unlockedBy) owner.paywalls[mediaType].unlockedBy=[];
        if (!owner.paywalls[mediaType].unlockedBy.includes(acc.username)) {
          owner.paywalls[mediaType].unlockedBy.push(acc.username);
        }
        sendTo(ws,{type:'media:paywall:unlock:ok', owner:owner.username, mediaType, price, newBalance:acc.balance});
        const ows=getWsByUsername(owner.username);
        if (ows) sendTo(ows,{type:'economy:balance:update',balance:owner.balance});
        if (ows) sendTo(ows,{type:'chat:dm',from:'NormOS',text:`💰 ${acc.username} just paid $${price.toFixed(2)} to unlock your ${mediaType}!`});
        broadcastLeaderboard();
        break;
      }

      case 'media:paywall:get': {
        // Get all active paywalls so client can show lock icons on leaderboard
        broadcastPaywallProfiles();
        break;
      }

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
      // Save balance state on disconnect (no-op for in-memory, but broadcast final leaderboard)
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
  const isAdmin=acc.username.toLowerCase()==='ko1';
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
    isAdmin,
  });
  const gen=channels.get('#general')||[];
  if (gen.length) sendTo(ws,{type:'chat:history',channel:'#general',messages:gen.slice(-30)});
  broadcast({type:'user:join',user:{id:acc.id,username:acc.username,color:acc.color}},ws);
  broadcastLeaderboard();
  broadcastPaywallProfiles();
}

// Frequent leaderboard broadcast (every 10s)
setInterval(() => {
  if (clients.size > 0) broadcastLeaderboard();
}, 10000);
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
