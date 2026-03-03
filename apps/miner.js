/**
 * NormOS — apps/miner.js
 * NormCoin Mining: passive mining, earn tiny NormCoin amounts over time
 */

const MinerApp = {
  // Global mining state so multiple windows share one miner
  _miningInterval: null,
  _mined: 0,
  _rate: 0.00001, // NormCoin per second

  create() {
    const wrap = document.createElement('div');
    wrap.className = 'miner-wrap';
    const iid = Math.random().toString(36).slice(2, 6);

    const MINED_KEY = 'normos_mined_normcoin';
    const loadMined = () => { try { return parseFloat(localStorage.getItem(MINED_KEY) || '0'); } catch { return 0; } };
    const saveMined = (v) => { try { localStorage.setItem(MINED_KEY, String(v)); } catch {} };

    MinerApp._mined = loadMined();

    const NRMC_STOCK_ID = 'NRMC';
    const getNormCoinPrice = () => {
      if (typeof Economy !== 'undefined') return Economy.getPrice(NRMC_STOCK_ID) || 0.42;
      return 0.42;
    };

    const fmt6 = (n) => n.toFixed(6);
    const fmt2 = (n) => n.toFixed(2);

    // Start global mining loop if not running
    if (!MinerApp._miningInterval) {
      MinerApp._miningInterval = setInterval(() => {
        const gain = MinerApp._rate;
        MinerApp._mined += gain;
        saveMined(MinerApp._mined);
        // Accumulate in economy — pay out $$ based on NormCoin price
        if (typeof Economy !== 'undefined') {
          const price = getNormCoinPrice();
          const dollarVal = gain * price;
          Economy.state.balance += dollarVal;
          Economy.save();
          Economy.updateWalletDisplay();
          // Sync with server
          if (typeof Network !== 'undefined' && Network.isConnected() && Network.isAuthenticated()) {
            Network.syncEconomy();
          }
          // Show payout every 30s in terminal
          MinerApp._payoutTick = (MinerApp._payoutTick || 0) + 1;
          if (MinerApp._payoutTick % 30 === 0) {
            const earned = dollarVal * 30;
            document.querySelectorAll('.miner-addterm').forEach(fn => {
              try { fn(`+$${earned.toFixed(6)} mined (${(gain*30).toFixed(8)} NRMC @ $${price.toFixed(4)}/NRMC)`, 'ok'); } catch {}
            });
            if (typeof OS !== 'undefined') {
              OS.notify('⛏️', 'NormMiner', `+$${earned.toFixed(4)} earned (${(gain*30).toFixed(6)} NRMC)`);
            }
          }
        }
        // Update any open miner UIs
        document.querySelectorAll('.miner-total-display').forEach(el => {
          el.textContent = fmt6(MinerApp._mined) + ' NRMC';
        });
        document.querySelectorAll('.miner-rate-display').forEach(el => {
          el.textContent = MinerApp._rate.toFixed(8) + ' NRMC/s';
        });
        document.querySelectorAll('.miner-hash-display').forEach(el => {
          el.textContent = Math.floor(Math.random() * 900 + 100) + ' H/s';
        });
      }, 1000);
    }

    // Random hash animation
    const genHash = () => {
      const chars = '0123456789abcdef';
      return '0x' + Array.from({length:16}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    };

    wrap.innerHTML = `
      <div class="miner-layout">
        <div class="miner-header">
          <div class="miner-logo">⛏️ NormMiner</div>
          <div class="miner-subtitle">Passive NormCoin income. Leave the app open. Get rich. Eventually.</div>
        </div>
        <div class="miner-status-grid">
          <div class="miner-card">
            <div class="miner-card-label">Total Mined</div>
            <div class="miner-total-display miner-card-val">${fmt6(MinerApp._mined)} NRMC</div>
          </div>
          <div class="miner-card">
            <div class="miner-card-label">Mining Rate</div>
            <div class="miner-rate-display miner-card-val">${MinerApp._rate.toFixed(8)} NRMC/s</div>
          </div>
          <div class="miner-card">
            <div class="miner-card-label">Hashrate</div>
            <div class="miner-hash-display miner-card-val">--- H/s</div>
          </div>
          <div class="miner-card">
            <div class="miner-card-label">NRMC Price</div>
            <div class="miner-price-val miner-card-val">$${fmt2(getNormCoinPrice())}</div>
          </div>
        </div>
        <div class="miner-terminal" id="miner-term-${iid}">
          <div class="miner-term-line ok">⛏ NormMiner v1.0 initialized</div>
          <div class="miner-term-line ok">Connected to NormPool [pool.normos.local:3333]</div>
          <div class="miner-term-line warn">Worker: ${Math.floor(Math.random()*999)+1} assigned</div>
          <div class="miner-term-line ok">Mining started...</div>
        </div>
        <div class="miner-upgrades">
          <div class="miner-upgrade-title">⚡ Upgrades</div>
          <div class="miner-upgrade-list" id="miner-upgrades-${iid}"></div>
        </div>
      </div>
    `;

    const UPGRADES = [
      { id:'gpu1',   name:'Basic GPU',         cost: 100,   multiplier: 2,    desc:'+1 GPU',            icon:'💻' },
      { id:'gpu2',   name:'GPU Cluster',        cost: 1000,  multiplier: 5,    desc:'+5 GPUs',           icon:'🖥️' },
      { id:'asic1',  name:'NormASIC Miner',     cost: 5000,  multiplier: 10,   desc:'Custom NormChip',   icon:'⚙️' },
      { id:'pool1',  name:'Pool Membership',    cost: 500,   multiplier: 1.5,  desc:'NormPool Pro',      icon:'🌊' },
    ];
    const UPGRADES_KEY = 'normos_miner_upgrades';
    const loadUpgrades = () => { try { return JSON.parse(localStorage.getItem(UPGRADES_KEY) || '[]'); } catch { return []; } };
    const saveUpgrades = (u) => { try { localStorage.setItem(UPGRADES_KEY, JSON.stringify(u)); } catch {} };

    let purchasedUpgrades = loadUpgrades();

    // Apply purchased upgrades to rate
    const BASE_RATE = 0.00001;
    const recalcRate = () => {
      let rate = BASE_RATE;
      purchasedUpgrades.forEach(id => {
        const up = UPGRADES.find(u => u.id === id);
        if (up) rate *= up.multiplier;
      });
      MinerApp._rate = rate;
    };
    recalcRate();

    const renderUpgrades = () => {
      const upgradesEl = wrap.querySelector(`#miner-upgrades-${iid}`);
      upgradesEl.innerHTML = UPGRADES.map(up => {
        const owned = purchasedUpgrades.includes(up.id);
        const balance = (typeof Economy !== 'undefined') ? Economy.state.balance : 0;
        const canAfford = balance >= up.cost;
        return `
          <div class="miner-upgrade-item ${owned ? 'owned' : ''}">
            <span class="miner-upgrade-icon">${up.icon}</span>
            <div class="miner-upgrade-info">
              <span class="miner-upgrade-name">${up.name}</span>
              <span class="miner-upgrade-desc">${up.desc} • ×${up.multiplier} rate</span>
            </div>
            ${owned
              ? '<span class="miner-upgrade-owned">✓ Owned</span>'
              : `<button class="miner-upgrade-btn ${canAfford?'':'disabled'}" data-id="${up.id}">$${up.cost.toLocaleString()}</button>`}
          </div>
        `;
      }).join('');

      wrap.querySelectorAll('.miner-upgrade-btn:not(.disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const up = UPGRADES.find(u => u.id === id);
          if (!up || purchasedUpgrades.includes(id)) return;
          if (typeof Economy === 'undefined' || Economy.state.balance < up.cost) return;
          Economy.state.balance -= up.cost;
          Economy.save();
          Economy.updateWalletDisplay();
          purchasedUpgrades.push(id);
          saveUpgrades(purchasedUpgrades);
          recalcRate();
          // Unlock miner badge
          try {
            const p = JSON.parse(localStorage.getItem('normos_profile') || '{}');
            if (!p.badges) p.badges = [];
            if (!p.badges.includes('miner')) { p.badges.push('miner'); localStorage.setItem('normos_profile', JSON.stringify(p)); }
          } catch {}
          if (typeof OS !== 'undefined') OS.notify('⛏️', 'NormMiner', `Upgraded: ${up.name}! Mining rate ×${up.multiplier}`);
          renderUpgrades();
          addTermLine(`Upgrade installed: ${up.name}`, 'ok');
        });
      });
    };

    renderUpgrades();

    const termEl = wrap.querySelector(`#miner-term-${iid}`);
    const addTermLine = (text, cls = 'info') => {
      const line = document.createElement('div');
      line.className = `miner-term-line ${cls}`;
      line.textContent = text;
      termEl.appendChild(line);
      if (termEl.children.length > 40) termEl.removeChild(termEl.firstChild);
      termEl.scrollTop = termEl.scrollHeight;
    };
    // Register so the global interval can log payouts to this window's terminal
    if (!document.querySelectorAll) return;
    const termCallback = (txt, cls) => addTermLine(txt, cls);
    if (!MinerApp._termCallbacks) MinerApp._termCallbacks = [];
    MinerApp._termCallbacks.push(termCallback);
    // Patch querySelectorAll approach — use callback array instead
    document.querySelectorAll('.miner-addterm');  // stub reference

    // Periodic hash logs
    const hashInterval = setInterval(() => {
      if (!document.body.contains(wrap)) { clearInterval(hashInterval); return; }
      addTermLine(`Found hash: ${genHash()} — accepted`, 'ok');
    }, 4000);

    // Price update
    const priceInterval = setInterval(() => {
      if (!document.body.contains(wrap)) { clearInterval(priceInterval); return; }
      const priceEl = wrap.querySelector('.miner-price-val');
      if (priceEl) priceEl.textContent = '$' + fmt2(getNormCoinPrice());
    }, 3000);

    // Styles
    if (!document.getElementById('miner-styles')) {
      const s = document.createElement('style');
      s.id = 'miner-styles';
      s.textContent = `
        .miner-wrap { height:100%; overflow-y:auto; background:var(--bg1); }
        .miner-layout { padding:16px; max-width:640px; margin:0 auto; display:flex; flex-direction:column; gap:14px; }
        .miner-header { text-align:center; padding:14px; background:var(--bg2); border-radius:8px; border:1px solid var(--border); }
        .miner-logo { font-size:1.2rem; font-weight:bold; color:var(--text1); }
        .miner-subtitle { font-size:0.7rem; color:var(--text3); margin-top:4px; font-style:italic; }
        .miner-status-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .miner-card { background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:12px; }
        .miner-card-label { font-size:0.65rem; color:var(--text3); margin-bottom:4px; text-transform:uppercase; letter-spacing:0.05em; }
        .miner-card-val { font-size:0.85rem; color:var(--accent); font-weight:600; font-family:monospace; }
        .miner-terminal { background:#0a0a0a; border:1px solid var(--border); border-radius:8px; padding:10px; height:120px; overflow-y:auto; font-family:monospace; font-size:0.65rem; }
        .miner-term-line { padding:1px 0; }
        .miner-term-line.ok { color:#4ade80; }
        .miner-term-line.warn { color:#facc15; }
        .miner-term-line.info { color:#60a5fa; }
        .miner-term-line.err { color:#f87171; }
        .miner-upgrades { background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:14px; }
        .miner-upgrade-title { font-size:0.78rem; font-weight:bold; color:var(--text1); margin-bottom:10px; }
        .miner-upgrade-list { display:flex; flex-direction:column; gap:8px; }
        .miner-upgrade-item { display:flex; align-items:center; gap:10px; padding:8px; background:var(--bg1); border-radius:6px; border:1px solid var(--border); }
        .miner-upgrade-item.owned { border-color:rgba(74,222,128,0.3); }
        .miner-upgrade-icon { font-size:1.2rem; }
        .miner-upgrade-info { flex:1; }
        .miner-upgrade-name { font-size:0.78rem; color:var(--text1); font-weight:600; display:block; }
        .miner-upgrade-desc { font-size:0.65rem; color:var(--text3); }
        .miner-upgrade-btn { background:var(--accent); color:#fff; border:none; border-radius:5px; padding:5px 12px; font-size:0.72rem; cursor:pointer; font-weight:600; white-space:nowrap; }
        .miner-upgrade-btn:hover { opacity:0.85; }
        .miner-upgrade-btn.disabled { background:var(--bg3); color:var(--text3); cursor:not-allowed; }
        .miner-upgrade-owned { font-size:0.7rem; color:#4ade80; font-weight:bold; }
      `;
      document.head.appendChild(s);
    }

    return wrap;
  }
};