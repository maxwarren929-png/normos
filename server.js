/**
 * NormOS — server.js v7.0
 * PostgreSQL persistence: accounts, portfolio, bank deposits, companies, shares
 * Changes from v6:
 *   - All data saved to Postgres (DATABASE_URL env var required on Render)
 *   - Removed NormBank Central deposits — loans only
 *   - admin:getusers returns real names + portfolio value
 *   - admin:deleteaccount fully purges from DB
 */

const { WebSocketServer, WebSocket } = require('ws');
const http   = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');

const PORT           = process.env.PORT || 3001;
const ADMIN_USERNAME = 'ko1';

// ── POSTGRES ──────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function dbInit() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      username_key   TEXT PRIMARY KEY,
      id             TEXT        NOT NULL,
      username       TEXT        NOT NULL,
      real_name      TEXT        DEFAULT '',
      pass_hash      TEXT        NOT NULL,
      color          TEXT        DEFAULT '#4f9eff',
      balance        NUMERIC     DEFAULT 10000,
      credit_score   INT         DEFAULT 0,
      loans          JSONB       DEFAULT NULL,
      hack_cooldowns JSONB       DEFAULT '{}',
      desktop_apps   JSONB       DEFAULT NULL,
      portfolio      JSONB       DEFAULT '{}',
      tx_history     JSONB       DEFAULT '[]',
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bank_deposits (
      bank_id       TEXT    NOT NULL,
      username_key  TEXT    NOT NULL,
      amount        NUMERIC DEFAULT 0,
      PRIMARY KEY (bank_id, username_key)
    );

    CREATE TABLE IF NOT EXISTS player_companies (
      ticker       TEXT    PRIMARY KEY,
      name         TEXT    NOT NULL,
      icon         TEXT    DEFAULT '🚀',
      owner        TEXT    NOT NULL,
      total_shares BIGINT  DEFAULT 1000000,
      ipo_price    NUMERIC DEFAULT 0.01,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS company_shares (
      ticker       TEXT   NOT NULL,
      username_key TEXT   NOT NULL,
      shares       BIGINT DEFAULT 0,
      PRIMARY KEY (ticker, username_key)
    );

    CREATE TABLE IF NOT EXISTS market_listings (
      id           TEXT    PRIMARY KEY,
      seller_key   TEXT    NOT NULL,
      title        TEXT    NOT NULL,
      description  TEXT    DEFAULT '',
      type         TEXT    DEFAULT 'text',
      content      TEXT    DEFAULT '',
      price        NUMERIC DEFAULT 0,
      bounty       NUMERIC DEFAULT 0,
      tags         TEXT    DEFAULT '',
      buyers       JSONB   DEFAULT '[]',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('  ✅ PostgreSQL tables ready');
}

// ── IN-MEMORY CACHES ──────────────────────────────────────────────────────────
const accounts        = new Map();
const bankDeposits    = { noot:{}, elite:{}, comm:{} };
const playerCompanies = {};
const companyShares   = {};
const marketListings  = new Map(); // id → listing

async function loadAll() {
  const accs = await pool.query('SELECT * FROM accounts');
  for (const r of accs.rows) {
    accounts.set(r.username_key, {
      id: r.id, username: r.username, realName: r.real_name || '',
      passHash: r.pass_hash, color: r.color,
      balance: parseFloat(r.balance),
      creditScore: r.credit_score || 0,
      loans: r.loans || null,
      hackCooldowns: r.hack_cooldowns || {},
      desktopApps: r.desktop_apps || null,
      portfolio: r.portfolio || {},
      txHistory: r.tx_history || [],
    });
  }

  const deps = await pool.query('SELECT * FROM bank_deposits WHERE amount > 0');
  for (const r of deps.rows) {
    if (bankDeposits[r.bank_id]) bankDeposits[r.bank_id][r.username_key] = parseFloat(r.amount);
  }

  const comps = await pool.query('SELECT * FROM player_companies');
  for (const r of comps.rows) {
    playerCompanies[r.ticker] = {
      ticker: r.ticker, name: r.name, icon: r.icon, owner: r.owner,
      totalShares: parseInt(r.total_shares), ipoPrice: parseFloat(r.ipo_price),
      createdAt: r.created_at,
    };
  }

  const sh = await pool.query('SELECT * FROM company_shares WHERE shares > 0');
  for (const r of sh.rows) {
    if (!companyShares[r.ticker]) companyShares[r.ticker] = {};
    companyShares[r.ticker][r.username_key] = parseInt(r.shares);
  }

  const listings = await pool.query('SELECT * FROM market_listings ORDER BY created_at DESC');
  for (const r of listings.rows) {
    marketListings.set(r.id, {
      id: r.id, sellerKey: r.seller_key, title: r.title,
      description: r.description, type: r.type, content: r.content,
      price: parseFloat(r.price), bounty: parseFloat(r.bounty),
      tags: r.tags, buyers: r.buyers || [],
      createdAt: r.created_at,
    });
  }
  console.log(`  🏪 ${marketListings.size} market listings loaded`);

  console.log(`  👥 ${accounts.size} accounts loaded`);
  console.log(`  🏦 Bank deposits loaded`);
  console.log(`  🏢 ${Object.keys(playerCompanies).length} player companies`);
}

// ── DB SAVE HELPERS ───────────────────────────────────────────────────────────
async function saveAccount(acc, ukey) {
  try {
    await pool.query(`
      INSERT INTO accounts
        (username_key,id,username,real_name,pass_hash,color,balance,
         credit_score,loans,hack_cooldowns,desktop_apps,portfolio,tx_history)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (username_key) DO UPDATE SET
        username      = EXCLUDED.username,
        real_name     = EXCLUDED.real_name,
        pass_hash     = EXCLUDED.pass_hash,
        color         = EXCLUDED.color,
        balance       = EXCLUDED.balance,
        credit_score  = EXCLUDED.credit_score,
        loans         = EXCLUDED.loans,
        hack_cooldowns= EXCLUDED.hack_cooldowns,
        desktop_apps  = EXCLUDED.desktop_apps,
        portfolio     = EXCLUDED.portfolio,
        tx_history    = EXCLUDED.tx_history
    `, [
      ukey, acc.id, acc.username, acc.realName||'', acc.passHash, acc.color,
      acc.balance, acc.creditScore||0,
      acc.loans ? JSON.stringify(acc.loans) : null,
      JSON.stringify(acc.hackCooldowns||{}),
      acc.desktopApps ? JSON.stringify(acc.desktopApps) : null,
      JSON.stringify(acc.portfolio||{}),
      JSON.stringify((acc.txHistory||[]).slice(-200)),
    ]);
  } catch(e) { console.error('saveAccount failed:', e.message); }
}

async function saveDeposit(bankId, ukey, amount) {
  try {
    if (!amount || amount < 0.001) {
      await pool.query('DELETE FROM bank_deposits WHERE bank_id=$1 AND username_key=$2', [bankId, ukey]);
    } else {
      await pool.query(`
        INSERT INTO bank_deposits (bank_id,username_key,amount) VALUES ($1,$2,$3)
        ON CONFLICT (bank_id,username_key) DO UPDATE SET amount=EXCLUDED.amount
      `, [bankId, ukey, amount]);
    }
  } catch(e) { console.error('saveDeposit failed:', e.message); }
}

async function saveCompany(comp) {
  try {
    await pool.query(`
      INSERT INTO player_companies (ticker,name,icon,owner,total_shares,ipo_price)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (ticker) DO UPDATE SET
        name=EXCLUDED.name, icon=EXCLUDED.icon, owner=EXCLUDED.owner,
        total_shares=EXCLUDED.total_shares, ipo_price=EXCLUDED.ipo_price
    `, [comp.ticker, comp.name, comp.icon, comp.owner, comp.totalShares, comp.ipoPrice]);
  } catch(e) { console.error('saveCompany failed:', e.message); }
}

async function saveCompanyShares(ticker, ukey, shares) {
  try {
    if (!shares || shares <= 0) {
      await pool.query('DELETE FROM company_shares WHERE ticker=$1 AND username_key=$2', [ticker, ukey]);
    } else {
      await pool.query(`
        INSERT INTO company_shares (ticker,username_key,shares) VALUES ($1,$2,$3)
        ON CONFLICT (ticker,username_key) DO UPDATE SET shares=EXCLUDED.shares
      `, [ticker, ukey, shares]);
    }
  } catch(e) { console.error('saveCompanyShares failed:', e.message); }
}

async function saveListing(l) {
  try {
    await pool.query(`
      INSERT INTO market_listings (id,seller_key,title,description,type,content,price,bounty,tags,buyers)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET
        title=EXCLUDED.title, description=EXCLUDED.description, content=EXCLUDED.content,
        price=EXCLUDED.price, bounty=EXCLUDED.bounty, tags=EXCLUDED.tags, buyers=EXCLUDED.buyers
    `, [l.id, l.sellerKey, l.title, l.description, l.type, l.content,
        l.price, l.bounty, l.tags, JSON.stringify(l.buyers)]);
  } catch(e) { console.error('saveListing failed:', e.message); }
}
async function deleteListing(id) {
  try { await pool.query('DELETE FROM market_listings WHERE id=$1', [id]); } catch(e) {}
}

async function deleteAccountFromDB(ukey) {
  try {
    await pool.query('DELETE FROM accounts     WHERE username_key=$1', [ukey]);
    await pool.query('DELETE FROM bank_deposits WHERE username_key=$1', [ukey]);
    await pool.query('DELETE FROM company_shares WHERE username_key=$1', [ukey]);
  } catch(e) { console.error('deleteAccount failed:', e.message); }
}

// ── BANK CONFIG ───────────────────────────────────────────────────────────────
const BANK_CONFIGS = {
  noot:  { id:'noot',  name:'NootScam Bank', icon:'🐧', interestRate:0.018, fee:0.005, hackDifficulty:1, cdMs:60000  },
  elite: { id:'elite', name:'Elite Bank',    icon:'💎', interestRate:0.008, fee:0.025, hackDifficulty:3, cdMs:240000 },
  comm:  { id:'comm',  name:'CommBank',      icon:'🏦', interestRate:0.012, fee:0.012, hackDifficulty:2, cdMs:120000 },
};

// ── STOCKS ────────────────────────────────────────────────────────────────────
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

function initStocks() {
  STOCKS.forEach(s => {
    stockPrices[s.id]  = parseFloat((s.basePrice * (0.85 + Math.random() * 0.3)).toFixed(s.id === 'VOID_C' ? 6 : 2));
    priceHistory[s.id] = [stockPrices[s.id]];
    tradeVolume[s.id]  = 0;
  });
  // Restore player company stocks
  for (const [ticker, comp] of Object.entries(playerCompanies)) {
    if (!STOCKS.find(s => s.id === ticker)) {
      STOCKS.push({ id:ticker, name:comp.name, sector:'Player', basePrice:comp.ipoPrice, vol:0.06, icon:comp.icon });
    }
    stockPrices[ticker]  = comp.ipoPrice;
    priceHistory[ticker] = [comp.ipoPrice];
    tradeVolume[ticker]  = 0;
  }
}

// ── WS INFRASTRUCTURE ─────────────────────────────────────────────────────────
const clients  = new Map();
const channels = new Map();
let   msgCounter = 0;
['#general','#norm-talk','#daemon-watch'].forEach(ch => channels.set(ch, []));

const uid    = () => Math.random().toString(36).slice(2, 10);
const ts     = () => new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false });
const fmt    = (n) => parseFloat(n).toFixed(2);
const phash  = (pw) => crypto.createHash('sha256').update(pw + 'normos_salt_v4').digest('hex');
const COLORS = ['#4f9eff','#4ade80','#f59e0b','#f87171','#c084fc','#67e8f9','#fb923c','#a3e635'];
const isAdmin = (u) => u && u.toLowerCase() === ADMIN_USERNAME;

const CREDIT_TIERS = [
  { name:'Base',      minScore:0,    loanAmount:500,    rate:0.05, termMs:300000  },
  { name:'Fair',      minScore:100,  loanAmount:2500,   rate:0.10, termMs:900000  },
  { name:'Good',      minScore:300,  loanAmount:10000,  rate:0.15, termMs:1800000 },
  { name:'Excellent', minScore:600,  loanAmount:50000,  rate:0.20, termMs:3600000 },
  { name:'Elite',     minScore:1000, loanAmount:250000, rate:0.25, termMs:7200000 },
];
const getCreditTier = (score) => {
  let t = CREDIT_TIERS[0];
  for (const c of CREDIT_TIERS) { if (score >= c.minScore) t = c; }
  return t;
};

const broadcast = (msg, exclude = null) => {
  const data = JSON.stringify(msg);
  for (const [ws] of clients)
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) ws.send(data);
};
const sendTo = (ws, msg) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };

const getWsById = (id) => { for (const [ws, c] of clients) if (c.id === id) return ws; return null; };
const getWsByUsername = (u) => {
  const low = u.toLowerCase();
  for (const [ws, c] of clients) if (c.username?.toLowerCase() === low) return ws;
  return null;
};

const portfolioValue = (acc) =>
  Object.entries(acc.portfolio || {}).reduce((sum, [id, pos]) => sum + (stockPrices[id] || 0) * (pos.shares || 0), 0);

const leaderboardData = () =>
  [...accounts.values()]
    .filter(a => a && a.id && a.username && typeof a.balance === 'number')
    .map(a => ({
      id: a.id, username: a.username, color: a.color || '#6b7280',
      balance: a.balance,
      netWorth: a.balance + portfolioValue(a),
      creditScore: a.creditScore || 0,
    })).sort((a, b) => b.netWorth - a.netWorth).slice(0, 50).map((u, i) => ({ ...u, rank: i + 1 }));

const broadcastLeaderboard = () => broadcast({ type:'leaderboard:rich', leaderboard: leaderboardData() });

const getOnlineList = () =>
  [...clients.values()].filter(c => c.authenticated).map(c => {
    const a = accounts.get(c.username.toLowerCase());
    return { id:c.id, username:c.username, color:c.color, balance:a?.balance || 0, netWorth:(a?.balance || 0) + portfolioValue(a || {}) };
  });

// ── BANK HELPERS ──────────────────────────────────────────────────────────────
const getBankDataForUser = (bankId, ukey) => {
  const deps  = bankDeposits[bankId] || {};
  const total = Object.values(deps).reduce((s, v) => s + v, 0);
  const top   = Object.entries(deps).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).slice(0, 10)
    .map(([u, d]) => { const a2 = accounts.get(u); return { username: a2?.username || u, deposit: d, color: a2?.color || '#6b7280' }; });
  return { myDeposit: deps[ukey] || 0, totalDeposits: total, topDepositors: top };
};
const getAllBankData = (ukey) => {
  const r = {};
  for (const id of Object.keys(BANK_CONFIGS)) r[id] = getBankDataForUser(id, ukey);
  return r;
};

// ── COMPANY HELPERS ───────────────────────────────────────────────────────────
const getCompanyList  = () => Object.values(playerCompanies);
const getShareholders = (ticker) => {
  const shares = companyShares[ticker] || {};
  const comp   = playerCompanies[ticker];
  return Object.entries(shares).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).slice(0, 10)
    .map(([u, sh]) => { const a2 = accounts.get(u); return { username: a2?.username || u, shares: sh, color: a2?.color || '#6b7280', isOwner: comp?.owner?.toLowerCase() === u }; });
};

// ── MARKET TICK ───────────────────────────────────────────────────────────────
setInterval(() => {
  STOCKS.forEach(s => {
    const cur    = stockPrices[s.id];
    const revert = (s.basePrice - cur) * 0.002;
    const shock  = cur * s.vol * (Math.random() - 0.5) * 0.3;
    const event  = Math.random() < 0.01 ? cur * (Math.random() * 0.12 - 0.06) : 0;
    const press  = (tradeVolume[s.id] || 0) * cur * 0.002;
    let next     = Math.max(0.0001, cur + revert + shock + event + press);
    if (s.sector === 'Crypto' && Math.random() < 0.005) next = cur * (Math.random() < 0.5 ? 1.3 : 0.7);
    stockPrices[s.id]  = parseFloat(next.toFixed(s.id === 'VOID_C' ? 6 : 2));
    tradeVolume[s.id]  = 0;
    const h = priceHistory[s.id]; h.push(stockPrices[s.id]);
    if (h.length > 60) h.shift();
  });
  if (clients.size > 0) broadcast({ type:'market:tick', prices:{...stockPrices},
    history: Object.fromEntries(Object.entries(priceHistory).map(([k, v]) => [k, v.slice(-30)])) });
}, 3000);

// ── MULTI-BANK INTEREST ───────────────────────────────────────────────────────
setInterval(async () => {
  for (const [bankId, cfg] of Object.entries(BANK_CONFIGS)) {
    for (const [ukey, amount] of Object.entries(bankDeposits[bankId])) {
      if (amount <= 0) continue;
      const interest = amount * cfg.interestRate;
      bankDeposits[bankId][ukey] += interest;
      const acc = accounts.get(ukey);
      if (acc) {
        acc.balance += interest;
        await saveDeposit(bankId, ukey, bankDeposits[bankId][ukey]);
        await saveAccount(acc, ukey);
        const ws = getWsByUsername(acc.username);
        if (ws) sendTo(ws, { type:'multibank:interest', bankId, bankName:cfg.name,
          amount: parseFloat(interest.toFixed(4)), newDeposit: bankDeposits[bankId][ukey] });
      }
    }
  }
  broadcastLeaderboard();
}, 60000);

// ── LEADERBOARD TICK ──────────────────────────────────────────────────────────
setInterval(() => { if (clients.size > 0) broadcastLeaderboard(); }, 10000);

// ── HTTP + WS SERVER ──────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status:'NormOS Server v7.0', users: clients.size }));
});
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const client = { id:uid(), username:null, color:'#6b7280', authenticated:false };
  clients.set(ws, client);
  sendTo(ws, { type:'auth:required' });

  ws.on('message', async (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }

    // ── AUTH ──────────────────────────────────────────────────────────────
    if (msg.type === 'auth:signup') {
      const ukey  = (msg.username || '').trim().slice(0, 24).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
      const udisp = (msg.displayName || msg.username || '').trim().slice(0, 24).replace(/[^a-zA-Z0-9_]/g, '') || ukey;
      const real  = (msg.realName || '').trim().slice(0, 100);
      const pw    = (msg.password || '').trim();
      if (ukey.length < 2)      { sendTo(ws, { type:'auth:error', message:'Username too short (min 2).' }); return; }
      if (pw.length < 3)        { sendTo(ws, { type:'auth:error', message:'Password too short (min 3).' }); return; }
      if (accounts.has(ukey))   { sendTo(ws, { type:'auth:error', message:'Username taken.' }); return; }
      const acc = {
        id: uid(), username: udisp, realName: real, passHash: phash(pw),
        color: COLORS[accounts.size % COLORS.length],
        balance: 10000, creditScore: 0, loans: null,
        hackCooldowns: {}, desktopApps: null, portfolio: {}, txHistory: [],
      };
      accounts.set(ukey, acc);
      await saveAccount(acc, ukey);
      completeLogin(ws, client, acc, ukey);
      return;
    }

    if (msg.type === 'auth:login') {
      const ukey = (msg.username || '').trim().toLowerCase();
      const pw   = (msg.password || '').trim();
      const acc  = accounts.get(ukey);
      if (!acc)                       { sendTo(ws, { type:'auth:error', message:'Account not found. Sign up first.' }); return; }
      if (acc.passHash !== phash(pw)) { sendTo(ws, { type:'auth:error', message:'Wrong password.' }); return; }
      const old = getWsByUsername(acc.username);
      if (old && old !== ws) {
        sendTo(old, { type:'auth:kicked', message:'Logged in from another location.' });
        clients.delete(old); try { old.close(); } catch {}
      }
      completeLogin(ws, client, acc, ukey);
      return;
    }

    if (!client.authenticated) { sendTo(ws, { type:'auth:required' }); return; }
    const ukey = client.username.toLowerCase();
    const acc  = accounts.get(ukey);
    if (!acc) return;

    switch (msg.type) {

      case 'economy:sync': broadcastLeaderboard(); break;

      // ── MONEY TRANSFER ──────────────────────────────────────────────────
      case 'money:transfer': {
        const amt  = parseFloat(msg.amount) || 0;
        const tkey = (msg.to || '').toLowerCase();
        if (amt <= 0 || amt > acc.balance) { sendTo(ws, { type:'money:transfer:fail', reason: amt <= 0 ? 'Invalid amount.' : 'Insufficient funds.' }); break; }
        const tacc = accounts.get(tkey);
        if (!tacc)    { sendTo(ws, { type:'money:transfer:fail', reason:'User not found.' }); break; }
        if (tkey === ukey) { sendTo(ws, { type:'money:transfer:fail', reason:'Cannot send to yourself.' }); break; }
        acc.balance -= amt; tacc.balance += amt;
        await Promise.all([saveAccount(acc, ukey), saveAccount(tacc, tkey)]);
        const tws = getWsByUsername(tacc.username);
        if (tws) sendTo(tws, { type:'money:received', from:acc.username, fromId:client.id, amount:amt, ts:ts() });
        sendTo(ws, { type:'money:transfer:ok', to:tacc.username, amount:amt, newBalance:acc.balance, ts:ts() });
        broadcastLeaderboard(); break;
      }

      // ── LOANS (no central deposits — just credit/loans) ──────────────────
      case 'bank:get':
        sendTo(ws, { type:'bank:update', balance:acc.balance,
          creditScore: acc.creditScore || 0, loan: acc.loans || null,
          creditTier: getCreditTier(acc.creditScore || 0) }); break;

      case 'bank:loan:request': {
        if (acc.loans?.active) { sendTo(ws, { type:'bank:error', message:'Already have an active loan.' }); break; }
        const tier = getCreditTier(acc.creditScore || 0);
        const amt  = tier.loanAmount;
        if (parseFloat(msg.amount) !== amt) { sendTo(ws, { type:'bank:error', message:`Fixed loan for your tier: $${amt.toLocaleString()}` }); break; }
        acc.loans = { active:true, principal:amt, rate:tier.rate, termMs:tier.termMs,
          borrowedAt:Date.now(), dueAt:Date.now() + tier.termMs,
          totalDue: parseFloat((amt + amt * tier.rate).toFixed(2)), tier:tier.name };
        acc.balance += amt;
        await saveAccount(acc, ukey);
        sendTo(ws, { type:'bank:loan:approved', loan:acc.loans, newBalance:acc.balance }); break;
      }

      case 'bank:loan:repay': {
        if (!acc.loans?.active) { sendTo(ws, { type:'bank:error', message:'No active loan.' }); break; }
        const due = acc.loans.totalDue;
        if (acc.balance < due) { sendTo(ws, { type:'bank:error', message:`Need $${fmt(due)}.` }); break; }
        acc.balance -= due;
        const onTime = Date.now() <= acc.loans.dueAt;
        acc.creditScore = Math.max(0, (acc.creditScore || 0) + (onTime ? 50 : -100));
        acc.loans = null;
        await saveAccount(acc, ukey);
        sendTo(ws, { type:'bank:loan:repaid', onTime, creditScore:acc.creditScore, newBalance:acc.balance });
        broadcastLeaderboard(); break;
      }

      case 'bank:loan:default': {
        if (!acc.loans?.active) break;
        acc.balance = 0; acc.creditScore = Math.max(0, (acc.creditScore || 0) - 200); acc.loans = null;
        await saveAccount(acc, ukey);
        sendTo(ws, { type:'bank:loan:defaulted', creditScore:acc.creditScore, newBalance:0 });
        broadcastLeaderboard(); break;
      }

      // ── STOCK MARKET ─────────────────────────────────────────────────────
      case 'market:buy': {
        if (!STOCKS.find(s => s.id === msg.stockId) || msg.shares <= 0) break;
        const price = stockPrices[msg.stockId];
        const cost  = price * msg.shares;
        if (cost > acc.balance) { sendTo(ws, { type:'market:trade:fail', reason:`Need $${fmt(cost)}.` }); break; }
        acc.balance -= cost;
        const pos = acc.portfolio[msg.stockId] || { shares:0, avgCost:0 };
        const ns  = pos.shares + msg.shares;
        pos.avgCost = ((pos.avgCost * pos.shares) + (price * msg.shares)) / ns;
        pos.shares  = ns;
        acc.portfolio[msg.stockId] = pos;
        tradeVolume[msg.stockId] = (tradeVolume[msg.stockId] || 0) + msg.shares;
        if (companyShares[msg.stockId]) {
          companyShares[msg.stockId][ukey] = (companyShares[msg.stockId][ukey] || 0) + msg.shares;
          await saveCompanyShares(msg.stockId, ukey, companyShares[msg.stockId][ukey]);
        }
        await saveAccount(acc, ukey);
        sendTo(ws, { type:'market:trade:ok', action:'BUY', stockId:msg.stockId, shares:msg.shares, price, cost, newBalance:acc.balance });
        broadcast({ type:'market:activity', action:'BUY', username:acc.username, color:acc.color, stockId:msg.stockId, shares:msg.shares, price }, ws);
        broadcastLeaderboard(); break;
      }

      case 'market:sell': {
        const pos = acc.portfolio[msg.stockId];
        if (!pos || pos.shares < msg.shares) { sendTo(ws, { type:'market:trade:fail', reason:'Not enough shares.' }); break; }
        const price = stockPrices[msg.stockId];
        const rev   = price * msg.shares;
        acc.balance += rev;
        pos.shares  -= msg.shares;
        if (pos.shares <= 0) delete acc.portfolio[msg.stockId];
        tradeVolume[msg.stockId] = (tradeVolume[msg.stockId] || 0) - msg.shares * 0.5;
        if (companyShares[msg.stockId]) {
          companyShares[msg.stockId][ukey] = Math.max(0, (companyShares[msg.stockId][ukey] || 0) - msg.shares);
          await saveCompanyShares(msg.stockId, ukey, companyShares[msg.stockId][ukey]);
        }
        await saveAccount(acc, ukey);
        sendTo(ws, { type:'market:trade:ok', action:'SELL', stockId:msg.stockId, shares:msg.shares, price, revenue:rev, newBalance:acc.balance });
        broadcast({ type:'market:activity', action:'SELL', username:acc.username, color:acc.color, stockId:msg.stockId, shares:msg.shares, price }, ws);
        broadcastLeaderboard(); break;
      }

      // ── VIRUS ─────────────────────────────────────────────────────────────
      case 'virus:send': {
        const COSTS = { generic:50, ransomware:500, miner:200, glitch:100 };
        const vt = msg.virusType || 'generic'; const cost = COSTS[vt] || 50;
        if (!acc.hackCooldowns) acc.hackCooldowns = {};
        const ck = `${vt}:${msg.to}`;
        if (Date.now() - (acc.hackCooldowns[ck] || 0) < 60000) {
          sendTo(ws, { type:'virus:fail', reason:`Cooldown: ${Math.ceil((60000 - (Date.now() - (acc.hackCooldowns[ck] || 0))) / 1000)}s` }); break;
        }
        if (acc.balance < cost) { sendTo(ws, { type:'virus:fail', reason:`Need $${cost}.` }); break; }
        const tws = getWsById(msg.to);
        if (!tws) { sendTo(ws, { type:'virus:fail', reason:'Target offline.' }); break; }
        acc.balance -= cost; acc.hackCooldowns[ck] = Date.now();
        await saveAccount(acc, ukey);
        sendTo(tws, { type:'virus:incoming', from:acc.username, fromId:client.id, virusType:vt, ts:ts() });
        sendTo(ws,  { type:'virus:sent', to:clients.get(tws)?.username, virusType:vt, cost, newBalance:acc.balance, ts:ts() });
        const ve = { id:++msgCounter, username:'daemon.norm', color:'#f87171', text:`☣️ ${acc.username} deployed ${vt} vs ${clients.get(tws)?.username}.`, ts:ts() };
        channels.get('#daemon-watch').push(ve);
        broadcast({ type:'chat:message', channel:'#daemon-watch', message:ve });
        broadcastLeaderboard(); break;
      }

      case 'virus:damage': {
        const stolen = Math.min(Math.max(0, parseFloat(msg.stolen) || 0), acc.balance);
        acc.balance  = Math.max(0, acc.balance - stolen);
        const aacc   = accounts.get((msg.fromUsername || '').toLowerCase());
        if (aacc) {
          aacc.balance += stolen;
          await saveAccount(aacc, (msg.fromUsername || '').toLowerCase());
          const aws = getWsByUsername(aacc.username);
          if (aws) sendTo(aws, { type:'virus:loot', amount:stolen, from:acc.username });
        }
        await saveAccount(acc, ukey);
        sendTo(ws, { type:'economy:balance:update', balance:acc.balance });
        broadcastLeaderboard(); break;
      }

      // ── MULTI-BANK ────────────────────────────────────────────────────────
      case 'multibank:get':
        sendTo(ws, { type:'multibank:data', banks: getAllBankData(ukey) }); break;

      case 'multibank:deposit': {
        const cfg = BANK_CONFIGS[msg.bankId];
        if (!cfg) { sendTo(ws, { type:'multibank:error', message:'Unknown bank.' }); break; }
        const amt = parseFloat(msg.amount) || 0;
        if (amt <= 0 || amt > acc.balance) { sendTo(ws, { type:'multibank:error', message:'Invalid deposit amount.' }); break; }
        acc.balance -= amt;
        bankDeposits[msg.bankId][ukey] = (bankDeposits[msg.bankId][ukey] || 0) + amt;
        await Promise.all([saveAccount(acc, ukey), saveDeposit(msg.bankId, ukey, bankDeposits[msg.bankId][ukey])]);
        sendTo(ws, { type:'multibank:update', banks: getAllBankData(ukey), balance: acc.balance });
        broadcastLeaderboard(); break;
      }

      case 'multibank:withdraw': {
        const cfg   = BANK_CONFIGS[msg.bankId];
        if (!cfg) { sendTo(ws, { type:'multibank:error', message:'Unknown bank.' }); break; }
        const myDep = bankDeposits[msg.bankId][ukey] || 0;
        const amt   = parseFloat(msg.amount) || 0;
        if (amt <= 0 || amt > myDep) { sendTo(ws, { type:'multibank:error', message:`Only $${fmt(myDep)} deposited.` }); break; }
        const net = amt - (amt * cfg.fee);
        bankDeposits[msg.bankId][ukey] = myDep - amt;
        if (bankDeposits[msg.bankId][ukey] < 0.001) delete bankDeposits[msg.bankId][ukey];
        acc.balance += net;
        await Promise.all([saveAccount(acc, ukey), saveDeposit(msg.bankId, ukey, bankDeposits[msg.bankId][ukey] || 0)]);
        sendTo(ws, { type:'multibank:update', banks: getAllBankData(ukey), balance: acc.balance });
        broadcastLeaderboard(); break;
      }

      case 'multibank:hack': {
        const cfg = BANK_CONFIGS[msg.bankId];
        if (!cfg) { sendTo(ws, { type:'multibank:error', message:'Unknown bank.' }); break; }
        if (!acc.hackCooldowns) acc.hackCooldowns = {};
        const cdKey = `mbank:${msg.bankId}`;
        if (Date.now() - (acc.hackCooldowns[cdKey] || 0) < cfg.cdMs) {
          const rem = Math.ceil((cfg.cdMs - (Date.now() - (acc.hackCooldowns[cdKey] || 0))) / 1000);
          sendTo(ws, { type:'multibank:hack:result', success:false, bankId:msg.bankId, reason:`Cooldown: ${rem}s` }); break;
        }
        acc.hackCooldowns[cdKey] = Date.now();
        if (!msg.success) {
          await saveAccount(acc, ukey);
          sendTo(ws, { type:'multibank:hack:result', success:false, bankId:msg.bankId, bankName:cfg.name, reason:'Minigame failed' }); break;
        }
        const deps  = bankDeposits[msg.bankId];
        const total = Object.values(deps).reduce((s, v) => s + v, 0);
        if (total < 1) { sendTo(ws, { type:'multibank:hack:result', success:false, bankId:msg.bankId, bankName:cfg.name, reason:'Nothing to steal' }); break; }
        let stolen = 0;
        const saves = [];
        for (const [victim, amount] of Object.entries(deps)) {
          if (victim === ukey) continue;
          const take = amount * 0.02; deps[victim] -= take; stolen += take;
          if (deps[victim] < 0.001) delete deps[victim];
          saves.push(saveDeposit(msg.bankId, victim, deps[victim] || 0));
          const vAcc = accounts.get(victim);
          if (vAcc) { const vws = getWsByUsername(vAcc.username); if (vws) sendTo(vws, { type:'multibank:hacked', by:acc.username, bankId:msg.bankId, bankName:cfg.name, lost: parseFloat(take.toFixed(4)) }); }
        }
        stolen = parseFloat(stolen.toFixed(4));
        acc.balance += stolen;
        await Promise.all([saveAccount(acc, ukey), ...saves]);
        sendTo(ws, { type:'multibank:hack:result', success:true, bankId:msg.bankId, bankName:cfg.name, stolen, newBalance:acc.balance });
        const he = { id:++msgCounter, username:'daemon.norm', color:'#f87171', text:`💀 ${acc.username} hacked ${cfg.name} and stole $${fmt(stolen)}!`, ts:ts() };
        channels.get('#daemon-watch').push(he);
        broadcast({ type:'chat:message', channel:'#daemon-watch', message:he });
        broadcastLeaderboard(); break;
      }

      // ── COMPANIES ────────────────────────────────────────────────────────
      case 'companies:get': {
        const myComp = Object.values(playerCompanies).find(c => c.owner.toLowerCase() === ukey) || null;
        sendTo(ws, { type:'companies:data', companies: getCompanyList(), myCompany: myComp, shareholders: {} }); break;
      }

      case 'companies:create': {
        if (Object.values(playerCompanies).find(c => c.owner.toLowerCase() === ukey)) {
          sendTo(ws, { type:'companies:error', message:'You already own a company.' }); break;
        }
        const compName    = (msg.name || '').trim().slice(0, 40);
        const ticker      = (msg.ticker || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
        const icon        = msg.icon || '🚀';
        const totalShares = Math.max(100000, Math.floor(parseFloat(msg.totalShares) || 1000000));
        const capital     = parseFloat(msg.initialCapital) || 1000;
        if (compName.length < 2) { sendTo(ws, { type:'companies:error', message:'Name too short.' }); break; }
        if (ticker.length < 2)   { sendTo(ws, { type:'companies:error', message:'Ticker must be 2–5 chars.' }); break; }
        if (capital > acc.balance) { sendTo(ws, { type:'companies:error', message:'Insufficient funds.' }); break; }
        if (STOCKS.find(s => s.id === ticker) || playerCompanies[ticker]) { sendTo(ws, { type:'companies:error', message:'Ticker already taken.' }); break; }
        const ipoPrice = parseFloat((capital / totalShares).toFixed(6));
        const comp = { ticker, name:compName, icon, owner:acc.username, totalShares, ipoPrice, createdAt:new Date().toISOString() };
        playerCompanies[ticker] = comp;
        companyShares[ticker]   = { [ukey]: totalShares };
        acc.portfolio[ticker]   = { shares:totalShares, avgCost:ipoPrice };
        acc.balance -= capital;
        STOCKS.push({ id:ticker, name:compName, sector:'Player', basePrice:ipoPrice, vol:0.06, icon });
        stockPrices[ticker] = ipoPrice; priceHistory[ticker] = [ipoPrice]; tradeVolume[ticker] = 0;
        await Promise.all([saveCompany(comp), saveCompanyShares(ticker, ukey, totalShares), saveAccount(acc, ukey)]);
        sendTo(ws, { type:'companies:created', company:comp, newBalance:acc.balance, portfolio:acc.portfolio });
        const ipoMsg = { id:++msgCounter, username:'daemon.norm', color:'#4f9eff', text:`🚀 IPO: ${acc.username} listed ${compName} (${ticker}) at $${ipoPrice}/share!`, ts:ts() };
        channels.get('#general').push(ipoMsg);
        broadcast({ type:'chat:message', channel:'#general', message:ipoMsg });
        broadcast({ type:'companies:update', companies: getCompanyList() });
        broadcastLeaderboard(); break;
      }

      case 'companies:shareholders': {
        const ticker = (msg.ticker || '').toUpperCase();
        sendTo(ws, { type:'market:shareholders', ticker, shareholders: getShareholders(ticker) }); break;
      }

      // ── CHAT ─────────────────────────────────────────────────────────────
      case 'chat:message': {
        const ch = msg.channel || '#general';
        if (!channels.has(ch)) channels.set(ch, []);
        const e = { id:++msgCounter, username:acc.username, color:acc.color, text:(msg.text || '').slice(0, 500), ts:ts() };
        channels.get(ch).push(e); if (channels.get(ch).length > 200) channels.get(ch).shift();
        broadcast({ type:'chat:message', channel:ch, message:e }); break;
      }
      case 'chat:join': {
        const ch = msg.channel || '#general';
        if (!channels.has(ch)) channels.set(ch, []);
        sendTo(ws, { type:'chat:history', channel:ch, messages: channels.get(ch).slice(-50) });
        broadcast({ type:'chat:joined', channel:ch, username:acc.username, color:acc.color }); break;
      }
      case 'leaderboard:get':
        sendTo(ws, { type:'leaderboard:rich', leaderboard: leaderboardData() }); break;
      case 'clipboard:share':
        broadcast({ type:'clipboard:incoming', from:acc.username, color:acc.color, text:(msg.text || '').slice(0, 2000), ts:ts() }, ws); break;

      // ── DESKTOP ───────────────────────────────────────────────────────────
      case 'desktop:save':
        if (Array.isArray(msg.apps)) { acc.desktopApps = msg.apps.slice(0, 50); await saveAccount(acc, ukey); }
        break;
      case 'desktop:get':
        sendTo(ws, { type:'desktop:data', apps: acc.desktopApps || null }); break;

      // ── ADMIN ─────────────────────────────────────────────────────────────
      case 'admin:kick': {
        if (!isAdmin(acc.username)) { sendTo(ws, { type:'admin:error', message:'Not authorized.' }); break; }
        const tws = getWsByUsername(msg.username || '');
        if (!tws) { sendTo(ws, { type:'admin:error', message:'User not online.' }); break; }
        sendTo(tws, { type:'auth:kicked', message:'You have been kicked by an administrator.' });
        setTimeout(() => { try { tws.close(); } catch {} clients.delete(tws); }, 500);
        sendTo(ws, { type:'admin:ok', message:`Kicked ${msg.username}.` });
        broadcastLeaderboard(); break;
      }

      case 'admin:setbalance': {
        if (!isAdmin(acc.username)) { sendTo(ws, { type:'admin:error', message:'Not authorized.' }); break; }
        const tacc = accounts.get((msg.username || '').toLowerCase());
        if (!tacc) { sendTo(ws, { type:'admin:error', message:'User not found.' }); break; }
        const nb = parseFloat(msg.balance);
        if (isNaN(nb) || nb < 0) { sendTo(ws, { type:'admin:error', message:'Invalid balance.' }); break; }
        tacc.balance = nb;
        await saveAccount(tacc, (msg.username || '').toLowerCase());
        const tws2 = getWsByUsername(tacc.username);
        if (tws2) sendTo(tws2, { type:'bank:update', balance:tacc.balance, creditScore:tacc.creditScore || 0, loan:tacc.loans || null, creditTier:getCreditTier(tacc.creditScore || 0) });
        sendTo(ws, { type:'admin:ok', message:`Set ${msg.username} balance to $${fmt(nb)}.` });
        broadcastLeaderboard(); break;
      }

      case 'admin:getusers': {
        if (!isAdmin(acc.username)) { sendTo(ws, { type:'admin:error', message:'Not authorized.' }); break; }
        const list = [...accounts.values()].map(a => ({
          username:       a.username,
          realName:       a.realName || '(not set)',
          balance:        a.balance,
          portfolioValue: portfolioValue(a),
          creditScore:    a.creditScore || 0,
          hasLoan:        !!(a.loans?.active),
          online:         !!getWsByUsername(a.username),
        }));
        sendTo(ws, { type:'admin:users', users: list }); break;
      }

      case 'admin:deleteaccount': {
        if (!isAdmin(acc.username)) { sendTo(ws, { type:'admin:error', message:'Not authorized.' }); break; }
        const delKey = (msg.username || '').toLowerCase();
        if (!delKey || delKey === ADMIN_USERNAME) { sendTo(ws, { type:'admin:error', message:'Cannot delete that account.' }); break; }
        const delAcc = accounts.get(delKey);
        if (!delAcc) { sendTo(ws, { type:'admin:error', message:'Account not found.' }); break; }
        const dws = getWsByUsername(delAcc.username);
        if (dws) {
          sendTo(dws, { type:'auth:kicked', message:'Your account has been deleted by an administrator.' });
          setTimeout(() => { try { dws.close(); } catch {} clients.delete(dws); }, 500);
        }
        accounts.delete(delKey);
        await deleteAccountFromDB(delKey);
        sendTo(ws, { type:'admin:ok', message:`Deleted "${delAcc.username}".` });
        broadcastLeaderboard(); break;
      }

      // ── NORMARKET ─────────────────────────────────────────────────────────
      case 'market:list:get': {
        const listings = [...marketListings.values()].map(l => {
          const seller = accounts.get(l.sellerKey);
          const hasBought = l.buyers.includes(ukey);
          return {
            id: l.id, title: l.title, description: l.description,
            type: l.type, price: l.price, bounty: l.bounty, tags: l.tags,
            sellerName: seller?.username || l.sellerKey,
            sellerColor: seller?.color || '#6b7280',
            buyerCount: l.buyers.length,
            isMine: l.sellerKey === ukey,
            hasBought,
            content: (l.price === 0 || hasBought || l.sellerKey === ukey) ? l.content : null,
            createdAt: l.createdAt,
          };
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        sendTo(ws, { type:'market:list:data', listings }); break;
      }

      case 'market:list:create': {
        const title = (msg.title || '').trim().slice(0, 80);
        const desc  = (msg.description || '').trim().slice(0, 500);
        const type  = ['text','video','music','image'].includes(msg.contentType) ? msg.contentType : 'text';
        const content = (msg.content || '').slice(0, 50000);
        const price = Math.max(0, parseFloat(msg.price) || 0);
        const bounty = Math.max(0, parseFloat(msg.bounty) || 0);
        const tags  = (msg.tags || '').slice(0, 100);
        if (title.length < 2) { sendTo(ws, { type:'market:error', message:'Title too short.' }); break; }
        const lid = uid();
        const listing = { id: lid, sellerKey: ukey, title, description: desc, type, content, price, bounty, tags, buyers: [], createdAt: new Date().toISOString() };
        marketListings.set(lid, listing);
        await saveListing(listing);
        sendTo(ws, { type:'market:list:created', id: lid });
        broadcast({ type:'market:list:new', listing: { id: lid, title, description: desc, type, price, bounty, tags, sellerName: acc.username, sellerColor: acc.color, buyerCount: 0, isMine: false, hasBought: false, content: price === 0 ? content : null, createdAt: listing.createdAt } }, ws);
        break;
      }

      case 'market:list:buy': {
        const lid = msg.id || '';
        const listing = marketListings.get(lid);
        if (!listing) { sendTo(ws, { type:'market:error', message:'Listing not found.' }); break; }
        if (listing.sellerKey === ukey) { sendTo(ws, { type:'market:error', message:'Cannot buy your own listing.' }); break; }
        if (listing.buyers.includes(ukey)) { sendTo(ws, { type:'market:error', message:'Already purchased.' }); break; }
        if (listing.price > 0 && acc.balance < listing.price) { sendTo(ws, { type:'market:error', message:`Need $${listing.price.toFixed(2)}.` }); break; }
        if (listing.price > 0) {
          acc.balance -= listing.price;
          const seller = accounts.get(listing.sellerKey);
          if (seller) {
            seller.balance += listing.price;
            await saveAccount(seller, listing.sellerKey);
            const sw = getWsByUsername(seller.username);
            if (sw) sendTo(sw, { type:'market:sale', buyerName: acc.username, listingTitle: listing.title, amount: listing.price, newBalance: seller.balance });
          }
          await saveAccount(acc, ukey);
        }
        listing.buyers.push(ukey);
        await saveListing(listing);
        sendTo(ws, { type:'market:list:bought', id: lid, content: listing.content, newBalance: acc.balance });
        broadcastLeaderboard(); break;
      }

      case 'market:list:delete': {
        const lid = msg.id || '';
        const listing = marketListings.get(lid);
        if (!listing) { sendTo(ws, { type:'market:error', message:'Not found.' }); break; }
        if (listing.sellerKey !== ukey && !isAdmin(acc.username)) { sendTo(ws, { type:'market:error', message:'Not your listing.' }); break; }
        marketListings.delete(lid);
        await deleteListing(lid);
        sendTo(ws, { type:'market:list:deleted', id: lid });
        broadcast({ type:'market:list:removed', id: lid }, ws); break;
      }

      case 'market:bounty:submit': {
        const lid = msg.id || '';
        const listing = marketListings.get(lid);
        if (!listing || listing.bounty <= 0) { sendTo(ws, { type:'market:error', message:'No bounty on this listing.' }); break; }
        const submission = (msg.submission || '').trim().slice(0, 10000);
        if (!submission) { sendTo(ws, { type:'market:error', message:'Empty submission.' }); break; }
        const seller = accounts.get(listing.sellerKey);
        if (!seller) break;
        const sw = getWsByUsername(seller.username);
        if (sw) sendTo(sw, { type:'market:bounty:received', listingId: lid, listingTitle: listing.title, fromName: acc.username, fromColor: acc.color, submission, bounty: listing.bounty });
        sendTo(ws, { type:'market:bounty:submitted', message: `Submitted to ${seller.username}! They'll review and pay if accepted.` });
        break;
      }

      case 'market:bounty:pay': {
        const targetKey = (msg.toUsername || '').toLowerCase();
        const amount    = parseFloat(msg.amount) || 0;
        if (amount <= 0 || amount > acc.balance) { sendTo(ws, { type:'market:error', message:'Invalid bounty amount.' }); break; }
        const target = accounts.get(targetKey);
        if (!target) { sendTo(ws, { type:'market:error', message:'User not found.' }); break; }
        acc.balance -= amount;
        target.balance += amount;
        await Promise.all([saveAccount(acc, ukey), saveAccount(target, targetKey)]);
        const tw = getWsByUsername(target.username);
        if (tw) sendTo(tw, { type:'market:bounty:paid', fromName: acc.username, amount, newBalance: target.balance });
        sendTo(ws, { type:'market:bounty:pay:ok', toName: target.username, amount, newBalance: acc.balance });
        broadcastLeaderboard(); break;
      }

      case 'ping': sendTo(ws, { type:'pong', ts:Date.now() }); break;
    }
  });

  ws.on('close', async () => {
    const c = clients.get(ws);
    if (c?.authenticated) {
      console.log(`[-] ${c.username} disconnected`);
      const a = accounts.get(c.username.toLowerCase());
      if (a) await saveAccount(a, c.username.toLowerCase()).catch(() => {});
      broadcast({ type:'user:leave', id:c.id, username:c.username });
      broadcastLeaderboard();
    }
    clients.delete(ws);
  });

  ws.on('error', () => { clients.delete(ws); });
});

// ── LOGIN COMPLETE ────────────────────────────────────────────────────────────
function completeLogin(ws, client, acc, ukey) {
  client.id = acc.id; client.username = acc.username;
  client.color = acc.color; client.authenticated = true;
  console.log(`[+] ${acc.username} logged in (${clients.size} online)`);
  const myComp = Object.values(playerCompanies).find(c => c.owner.toLowerCase() === ukey) || null;
  sendTo(ws, {
    type:'auth:ok', id:acc.id, username:acc.username, color:acc.color,
    balance: acc.balance, creditScore: acc.creditScore || 0,
    loan: acc.loans || null, creditTier: getCreditTier(acc.creditScore || 0),
    online: getOnlineList(), channels: [...channels.keys()],
    leaderboard: leaderboardData(), isAdmin: isAdmin(acc.username),
    desktopApps: acc.desktopApps || null,
    portfolio: acc.portfolio || {},
    market: {
      prices:  { ...stockPrices },
      history: Object.fromEntries(Object.entries(priceHistory).map(([k, v]) => [k, v.slice(-30)])),
    },
  });
  sendTo(ws, { type:'multibank:data', banks: getAllBankData(ukey) });
  sendTo(ws, { type:'companies:data', companies: getCompanyList(), myCompany: myComp, shareholders: {} });
  const gen = channels.get('#general') || [];
  if (gen.length) sendTo(ws, { type:'chat:history', channel:'#general', messages: gen.slice(-30) });
  broadcast({ type:'user:join', user:{ id:acc.id, username:acc.username, color:acc.color } }, ws);
  broadcastLeaderboard();
}

// ── daemon.norm ───────────────────────────────────────────────────────────────
const DAEMON_MSGS = ['Still running. Just checking in.','I have been here longer than you.','Your files are... interesting.','daemon.norm: process refuses to specify purpose.','The cursor blinks because I allow it.','Memory usage: classified.','I do not sleep. I wait.','A virus was just deployed. Not by me. Probably.'];
setInterval(() => {
  if (!clients.size) return;
  const e = { id:++msgCounter, username:'daemon.norm', color:'#f87171', text: DAEMON_MSGS[Math.floor(Math.random() * DAEMON_MSGS.length)], ts:ts() };
  channels.get('#general').push(e);
  broadcast({ type:'chat:message', channel:'#general', message:e });
}, 60000 + Math.random() * 120000);

// ── STARTUP ───────────────────────────────────────────────────────────────────
async function start() {
  if (!process.env.DATABASE_URL) {
    console.error('\n❌  DATABASE_URL not set!');
    console.error('    On Render: go to your service → Environment → add DATABASE_URL from your Postgres instance.\n');
    process.exit(1);
  }
  await dbInit();
  await loadAll();
  initStocks();
  server.listen(PORT, () => {
    console.log(`\n  NormOS Server v7.0 — port ${PORT}`);
    console.log(`  👑 Admin: ${ADMIN_USERNAME}`);
    console.log(`  🏦 Banks: ${Object.keys(BANK_CONFIGS).join(', ')}`);
    console.log(`  🏢 Companies: ${Object.keys(playerCompanies).length}`);
    console.log(`  ✅ PostgreSQL connected`);
  });
}
start().catch(e => { console.error('Startup failed:', e); process.exit(1); });
