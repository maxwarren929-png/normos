/**
 * NormOS — js/economy.js
 * Global Dollar economy: balance, portfolio, stock market engine.
 * Accessed via Economy.* everywhere in the OS.
 */

const Economy = (() => {
  const SAVE_KEY = 'normos_economy';

  // ── Persist ──────────────────────────────────────────────────────────────
  const load = () => {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
  };
  const save = () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ balance: state.balance, portfolio: state.portfolio, txHistory: state.txHistory.slice(0, 50) })); } catch {}
  };

  // ── Stock definitions ────────────────────────────────────────────────────
  const STOCKS = [
    // Tech
    { id: 'NRM',  name: 'NormCorp',           sector: 'Tech',    basePrice: 142.50, vol: 0.025, icon: '🖥️' },
    { id: 'DMNN', name: 'Daemon Industries',  sector: 'Tech',    basePrice: 88.00,  vol: 0.04,  icon: '👾' },
    { id: 'FSYS', name: 'FileSystem Ltd',     sector: 'Tech',    basePrice: 210.00, vol: 0.02,  icon: '📁' },
    { id: 'WNDW', name: 'WindowManager Inc',  sector: 'Tech',    basePrice: 64.20,  vol: 0.03,  icon: '🪟' },
    { id: 'TRML', name: 'Terminal Solutions', sector: 'Tech',    basePrice: 39.99,  vol: 0.035, icon: '🖥️' },
    // Finance
    { id: 'NBNK', name: 'NormBank Corp',      sector: 'Finance', basePrice: 320.00, vol: 0.015, icon: '🏦' },
    { id: 'DLRS', name: 'DollarDAO',          sector: 'Finance', basePrice: 18.75,  vol: 0.05,  icon: '💵' },
    // Energy
    { id: 'LORE', name: 'Lore Energy Co',     sector: 'Energy',  basePrice: 55.40,  vol: 0.03,  icon: '⚡' },
    { id: 'VOID', name: 'The Void Corp',      sector: 'Energy',  basePrice: 0.01,   vol: 0.9,   icon: '🌑' },
    // Consumer
    { id: 'SHOP', name: 'NormShop Global',    sector: 'Consumer',basePrice: 178.00, vol: 0.022, icon: '🛒' },
    { id: 'CAFE', name: 'daemon.café',        sector: 'Consumer',basePrice: 22.50,  vol: 0.04,  icon: '☕' },
    { id: 'ITACO',name: "Isaac's Tacos",      sector: 'Consumer',basePrice: 42.00,  vol: 0.35,  icon: '🌮' },
    // Crypto
    { id: 'NRMC', name: 'NormCoin',           sector: 'Crypto',  basePrice: 0.42,   vol: 0.15,  icon: '🟡' },
    { id: 'DMNCOIN', name: 'DaemonCoin',      sector: 'Crypto',  basePrice: 1337.00,vol: 0.12,  icon: '😈' },
    { id: 'VOID_C',name: 'VoidToken',         sector: 'Crypto',  basePrice: 0.0001, vol: 0.5,   icon: '🔮' },
    { id: 'KRNL', name: 'KernelCash',         sector: 'Crypto',  basePrice: 88.88,  vol: 0.09,  icon: '💎' },
  ];

  // ── State ────────────────────────────────────────────────────────────────
  const saved = load();
  const state = {
    balance:   saved?.balance   ?? 10000.00,   // Starting $10,000
    portfolio: saved?.portfolio ?? {},          // { id: { shares, avgCost } }
    txHistory: saved?.txHistory ?? [],
    prices:    {},   // live prices, not persisted (recalculated)
    priceHistory: {}, // last 30 ticks per stock
    listeners: [],
  };

  // Init prices from base
  STOCKS.forEach(s => {
    const start = s.basePrice * (0.85 + Math.random() * 0.3);
    state.prices[s.id] = start;
    state.priceHistory[s.id] = [start];
  });

  // ── Market tick ──────────────────────────────────────────────────────────
  // In v4.0 the server drives market prices via WebSocket (market:tick events).
  // Local tick is kept as fallback for offline mode only.
  let marketOpen = true;
  const tick = () => {
    // Only run local tick if not connected to server
    if (typeof Network !== 'undefined' && Network.isConnected()) return;
    STOCKS.forEach(s => {
      const cur = state.prices[s.id];
      const revert = (s.basePrice - cur) * 0.002;
      const shock  = cur * s.vol * (Math.random() - 0.5) * 0.3;
      const event  = Math.random() < 0.01 ? cur * (Math.random() * 0.12 - 0.06) : 0;
      let next = Math.max(0.0001, cur + revert + shock + event);
      if (s.sector === 'Crypto' && Math.random() < 0.005) {
        next = cur * (Math.random() < 0.5 ? 1.3 : 0.7);
      }
      state.prices[s.id] = parseFloat(next.toFixed(s.id === 'VOID_C' ? 6 : 2));
      const hist = state.priceHistory[s.id];
      hist.push(state.prices[s.id]);
      if (hist.length > 60) hist.shift();
    });
    state.listeners.forEach(fn => { try { fn(); } catch {} });
    updateWalletDisplay();
  };

  const tickInterval = setInterval(tick, 3000); // tick every 3s

  // ── Transactions ─────────────────────────────────────────────────────────
  const buy = (stockId, shares) => {
    const s = STOCKS.find(s => s.id === stockId);
    if (!s) return { ok: false, msg: 'Unknown stock.' };
    if (shares <= 0) return { ok: false, msg: 'Invalid quantity.' };
    const price = state.prices[stockId];
    const cost  = price * shares;
    if (cost > state.balance) return { ok: false, msg: `Insufficient funds. Need $${fmt(cost)}, have $${fmt(state.balance)}.` };

    state.balance -= cost;
    if (!state.portfolio[stockId]) state.portfolio[stockId] = { shares: 0, avgCost: 0 };
    const pos = state.portfolio[stockId];
    const totalShares = pos.shares + shares;
    pos.avgCost = (pos.avgCost * pos.shares + cost) / totalShares;
    pos.shares  = totalShares;

    state.txHistory.unshift({ type: 'BUY', id: stockId, name: s.name, shares, price, total: cost, time: new Date().toLocaleTimeString() });
    save();
    state.listeners.forEach(fn => { try { fn(); } catch {} });
    updateWalletDisplay();
    return { ok: true, msg: `Bought ${shares} share${shares>1?'s':''} of ${s.name} for $${fmt(cost)}.` };
  };

  const sell = (stockId, shares) => {
    const s    = STOCKS.find(s => s.id === stockId);
    const pos  = state.portfolio[stockId];
    if (!s || !pos) return { ok: false, msg: 'You don\'t own this stock.' };
    if (shares > pos.shares) return { ok: false, msg: `You only own ${pos.shares} shares.` };

    const price   = state.prices[stockId];
    const revenue = price * shares;
    const profit  = (price - pos.avgCost) * shares;

    state.balance += revenue;
    pos.shares -= shares;
    if (pos.shares <= 0) delete state.portfolio[stockId];

    state.txHistory.unshift({ type: 'SELL', id: stockId, name: s.name, shares, price, total: revenue, profit, time: new Date().toLocaleTimeString() });
    save();
    state.listeners.forEach(fn => { try { fn(); } catch {} });
    updateWalletDisplay();
    return { ok: true, msg: `Sold ${shares} share${shares>1?'s':''} of ${s.name} for $${fmt(revenue)}. P&L: ${profit >= 0 ? '+' : ''}$${fmt(profit)}.` };
  };

  // ── Portfolio value ───────────────────────────────────────────────────────
  const portfolioValue = () => {
    return Object.entries(state.portfolio).reduce((sum, [id, pos]) => {
      return sum + (state.prices[id] || 0) * pos.shares;
    }, 0);
  };

  const totalValue = () => state.balance + portfolioValue();

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmt = (n) => {
    if (Math.abs(n) < 0.01) return n.toFixed(6);
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStock = (id) => STOCKS.find(s => s.id === id);
  const getPrice = (id) => state.prices[id] || 0;
  const getHistory = (id) => state.priceHistory[id] || [];
  const getPriceChange = (id) => {
    const hist = state.priceHistory[id];
    if (!hist || hist.length < 2) return 0;
    return ((hist[hist.length-1] - hist[0]) / hist[0]) * 100;
  };

  const onChange = (fn) => { state.listeners.push(fn); return () => { state.listeners = state.listeners.filter(f => f !== fn); }; };

  // ── Wallet tray display ───────────────────────────────────────────────────
  const updateWalletDisplay = () => {
    const el = document.getElementById('tray-wallet');
    if (el) el.textContent = '$' + fmt(state.balance);
  };

  return {
    STOCKS,
    state,
    save,
    buy,
    sell,
    fmt,
    getStock,
    getPrice,
    getHistory,
    getPriceChange,
    portfolioValue,
    totalValue,
    onChange,
    updateWalletDisplay,
  };
})();
