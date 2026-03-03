/**
 * NormOS — apps/stocks.js
 * NormStock — stock trading app with live prices, portfolio, charts, history.
 */

const StocksApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'stocks-wrap';

    let activeTab   = 'market';
    let selectedId  = null;
    let filterSector = 'All';
    let unsubscribe = null;

    const render = () => {
      const sectors = ['All', ...new Set(Economy.STOCKS.map(s => s.sector))];
      wrap.innerHTML = `
        <div class="stocks-layout">
          <!-- Sidebar -->
          <div class="stocks-sidebar">
            <div class="stocks-balance-card">
              <div class="sbc-label">Cash Balance</div>
              <div class="sbc-val">$${Economy.fmt(Economy.state.balance)}</div>
              <div class="sbc-sub">Portfolio: $${Economy.fmt(Economy.portfolioValue())}</div>
              <div class="sbc-sub">Total: $${Economy.fmt(Economy.totalValue())}</div>
            </div>
            <div class="stocks-tabs">
              <div class="stocks-tab ${activeTab==='market'?'active':''}" data-tab="market">📈 Market</div>
              <div class="stocks-tab ${activeTab==='portfolio'?'active':''}" data-tab="portfolio">💼 Portfolio</div>
              <div class="stocks-tab ${activeTab==='history'?'active':''}" data-tab="history">📋 History</div>
            </div>
            <div class="stocks-sector-filter">
              ${sectors.map(s => `<span class="sector-pill ${filterSector===s?'active':''}" data-sector="${s}">${s}</span>`).join('')}
            </div>
            <div class="stocks-list" id="stocks-list"></div>
          </div>
          <!-- Main panel -->
          <div class="stocks-main" id="stocks-main">
            <div class="stocks-placeholder">
              <div style="font-size:2.5rem;">📈</div>
              <div style="font-size:0.85rem;color:var(--text2);margin-top:0.5rem;">Select a stock to trade</div>
            </div>
          </div>
        </div>
      `;

      // Tab switching
      wrap.querySelectorAll('.stocks-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          activeTab = tab.dataset.tab;
          selectedId = null;
          renderSidebar();
          renderMain();
        });
      });

      // Sector filter
      wrap.querySelectorAll('.sector-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          filterSector = pill.dataset.sector;
          renderSidebar();
        });
      });

      renderSidebar();
      renderMain();

      // Subscribe to price updates
      if (unsubscribe) unsubscribe();
      unsubscribe = Economy.onChange(() => {
        if (!wrap.isConnected) { unsubscribe && unsubscribe(); return; }
        renderSidebar();
        if (selectedId) renderDetail(selectedId);
        // Update balance card
        const bc = wrap.querySelector('.sbc-val');
        if (bc) bc.textContent = '$' + Economy.fmt(Economy.state.balance);
        const bcsub = wrap.querySelectorAll('.sbc-sub');
        if (bcsub[0]) bcsub[0].textContent = 'Portfolio: $' + Economy.fmt(Economy.portfolioValue());
        if (bcsub[1]) bcsub[1].textContent = 'Total: $' + Economy.fmt(Economy.totalValue());
      });
    };

    const renderSidebar = () => {
      const listEl = wrap.querySelector('#stocks-list');
      if (!listEl) return;

      if (activeTab === 'market') {
        const filtered = Economy.STOCKS.filter(s => filterSector === 'All' || s.sector === filterSector);
        listEl.innerHTML = filtered.map(s => {
          const price  = Economy.getPrice(s.id);
          const change = Economy.getPriceChange(s.id);
          const isUp   = change >= 0;
          const pos    = Economy.state.portfolio[s.id];
          return `
            <div class="stock-row ${selectedId === s.id ? 'active' : ''}" data-id="${s.id}">
              <span class="stock-icon">${s.icon}</span>
              <div class="stock-row-info">
                <div class="stock-row-name">${s.id} <span class="stock-sector-tag">${s.sector}</span></div>
                <div class="stock-row-full">${s.name}</div>
              </div>
              <div class="stock-row-price">
                <div class="stock-price">$${Economy.fmt(price)}</div>
                <div class="stock-change ${isUp ? 'up' : 'down'}">${isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%</div>
                ${pos ? `<div class="stock-owned">${pos.shares} owned</div>` : ''}
              </div>
            </div>`;
        }).join('');
      } else if (activeTab === 'portfolio') {
        const positions = Object.entries(Economy.state.portfolio);
        if (!positions.length) {
          listEl.innerHTML = '<div class="stocks-empty">No positions yet. Buy some stocks!</div>';
        } else {
          listEl.innerHTML = positions.map(([id, pos]) => {
            const s      = Economy.getStock(id);
            const price  = Economy.getPrice(id);
            const value  = price * pos.shares;
            const pnl    = (price - pos.avgCost) * pos.shares;
            const pnlPct = ((price - pos.avgCost) / pos.avgCost) * 100;
            const isUp   = pnl >= 0;
            return `
              <div class="stock-row ${selectedId === id ? 'active' : ''}" data-id="${id}">
                <span class="stock-icon">${s?.icon || '📊'}</span>
                <div class="stock-row-info">
                  <div class="stock-row-name">${id}</div>
                  <div class="stock-row-full">${pos.shares} shares @ $${Economy.fmt(pos.avgCost)}</div>
                </div>
                <div class="stock-row-price">
                  <div class="stock-price">$${Economy.fmt(value)}</div>
                  <div class="stock-change ${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}$${Economy.fmt(pnl)} (${pnlPct.toFixed(1)}%)</div>
                </div>
              </div>`;
          }).join('');
        }
      } else if (activeTab === 'history') {
        const hist = Economy.state.txHistory;
        if (!hist.length) {
          listEl.innerHTML = '<div class="stocks-empty">No transactions yet.</div>';
        } else {
          listEl.innerHTML = hist.slice(0, 30).map(tx => `
            <div class="tx-row">
              <span class="tx-type ${tx.type === 'BUY' ? 'buy' : 'sell'}">${tx.type}</span>
              <div class="tx-info">
                <div>${tx.id} × ${tx.shares}</div>
                <div style="font-size:0.62rem;color:var(--text3);">${tx.time}</div>
              </div>
              <div class="tx-val">
                $${Economy.fmt(tx.total)}
                ${tx.profit !== undefined ? `<div style="font-size:0.62rem;color:${tx.profit>=0?'var(--green)':'var(--red)'};">${tx.profit>=0?'+':''}$${Economy.fmt(tx.profit)}</div>` : ''}
              </div>
            </div>`).join('');
        }
      }

      // Stock row click → show detail
      listEl.querySelectorAll('.stock-row[data-id]').forEach(row => {
        row.addEventListener('click', () => {
          selectedId = row.dataset.id;
          renderSidebar();
          renderMain();
        });
      });
    };

    const renderMain = () => {
      const mainEl = wrap.querySelector('#stocks-main');
      if (!mainEl) return;
      if (!selectedId) {
        if (activeTab === 'history') {
          mainEl.innerHTML = `<div class="stocks-placeholder"><div style="font-size:2rem">📋</div><div style="color:var(--text2);margin-top:0.5rem;font-size:0.82rem;">Transaction history shown in sidebar</div></div>`;
        } else {
          mainEl.innerHTML = `<div class="stocks-placeholder"><div style="font-size:2.5rem;">📈</div><div style="font-size:0.85rem;color:var(--text2);margin-top:0.5rem;">Select a stock to trade</div></div>`;
        }
        return;
      }
      renderDetail(selectedId);
    };

    const renderDetail = (id) => {
      const mainEl = wrap.querySelector('#stocks-main');
      if (!mainEl) return;
      const s      = Economy.getStock(id);
      if (!s) return;
      const price  = Economy.getPrice(id);
      const hist   = Economy.getHistory(id);
      const change = Economy.getPriceChange(id);
      const isUp   = change >= 0;
      const pos    = Economy.state.portfolio[id];

      // Mini sparkline SVG
      const sparkline = (() => {
        if (hist.length < 2) return '';
        const W = 300, H = 80;
        const min = Math.min(...hist), max = Math.max(...hist);
        const range = max - min || 1;
        const pts = hist.map((v, i) => {
          const x = (i / (hist.length - 1)) * W;
          const y = H - ((v - min) / range) * H;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        const color = isUp ? '#34d399' : '#f87171';
        return `
          <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:100%;height:80px;">
            <defs>
              <linearGradient id="sg-${id}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
            <polygon points="0,${H} ${pts} ${W},${H}" fill="url(#sg-${id})"/>
          </svg>`;
      })();

      mainEl.innerHTML = `
        <div class="stocks-detail">
          <div class="sd-header">
            <span style="font-size:2rem;">${s.icon}</span>
            <div class="sd-title-block">
              <div class="sd-ticker">${s.id} <span class="stock-sector-tag">${s.sector}</span></div>
              <div class="sd-name">${s.name}</div>
            </div>
            <div class="sd-price-block">
              <div class="sd-price">$${Economy.fmt(price)}</div>
              <div class="stock-change ${isUp ? 'up' : 'down'}" style="font-size:0.85rem;">${isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%</div>
            </div>
          </div>

          <div class="sd-chart">
            ${sparkline}
            <div class="sd-chart-labels">
              <span>${hist.length > 0 ? '$' + Economy.fmt(hist[0]) : ''}</span>
              <span style="color:var(--text3);font-size:0.6rem;">Last ${hist.length} ticks</span>
              <span>$${Economy.fmt(price)}</span>
            </div>
          </div>

          ${pos ? `
          <div class="sd-position">
            <div class="sdp-title">Your Position</div>
            <div class="sdp-grid">
              <div class="sdp-item"><div class="sdp-label">Shares</div><div class="sdp-val">${pos.shares}</div></div>
              <div class="sdp-item"><div class="sdp-label">Avg Cost</div><div class="sdp-val">$${Economy.fmt(pos.avgCost)}</div></div>
              <div class="sdp-item"><div class="sdp-label">Mkt Value</div><div class="sdp-val">$${Economy.fmt(price * pos.shares)}</div></div>
              <div class="sdp-item"><div class="sdp-label">P&L</div><div class="sdp-val ${(price-pos.avgCost)>=0?'green':'red'}">${(price-pos.avgCost)>=0?'+':''}$${Economy.fmt((price-pos.avgCost)*pos.shares)}</div></div>
            </div>
          </div>` : ''}

          <div class="sd-trade">
            <div class="sd-trade-title">Trade ${s.id}</div>
            <div class="sd-trade-row">
              <label style="font-size:0.72rem;color:var(--text2);">Shares</label>
              <input class="sd-qty" id="sd-qty-${id}" type="number" min="1" value="1" style="width:80px;background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:0.3rem 0.5rem;color:var(--text);font-family:var(--font-mono);font-size:0.85rem;outline:none;text-align:center;" />
              <span id="sd-cost-${id}" style="font-size:0.72rem;color:var(--text3);font-family:var(--font-mono);">Cost: $${Economy.fmt(price)}</span>
            </div>
            <div class="sd-trade-btns">
              <button class="sd-buy-btn" id="sd-buy-${id}">🟢 Buy</button>
              ${pos ? `<button class="sd-sell-btn" id="sd-sell-${id}">🔴 Sell</button>` : ''}
              ${pos ? `<button class="sd-sellall-btn" id="sd-sellall-${id}">Sell All (${pos.shares})</button>` : ''}
            </div>
            <div class="sd-trade-msg" id="sd-msg-${id}"></div>
            <div style="font-size:0.62rem;color:var(--text3);margin-top:0.5rem;">Cash: $${Economy.fmt(Economy.state.balance)}</div>
          </div>

          <div class="sd-stats">
            <div class="sdst-item"><div class="sdst-label">Sector</div><div class="sdst-val">${s.sector}</div></div>
            <div class="sdst-item"><div class="sdst-label">Ticker</div><div class="sdst-val" style="font-family:var(--font-mono);">${s.id}</div></div>
            <div class="sdst-item"><div class="sdst-label">Volatility</div><div class="sdst-val">${(s.vol * 100).toFixed(0)}%</div></div>
            <div class="sdst-item"><div class="sdst-label">Base Price</div><div class="sdst-val">$${Economy.fmt(s.basePrice)}</div></div>
          </div>
        </div>
      `;

      // Qty input → update cost
      const qtyInput = mainEl.querySelector(`#sd-qty-${id}`);
      const costEl   = mainEl.querySelector(`#sd-cost-${id}`);
      qtyInput?.addEventListener('input', () => {
        const q = parseFloat(qtyInput.value) || 0;
        if (costEl) costEl.textContent = `Cost: $${Economy.fmt(price * q)}`;
      });

      // Buy
      mainEl.querySelector(`#sd-buy-${id}`)?.addEventListener('click', () => {
        const q   = Math.floor(parseFloat(qtyInput?.value) || 0);
        const res = Economy.buy(id, q);
        const msgEl = mainEl.querySelector(`#sd-msg-${id}`);
        if (msgEl) {
          msgEl.textContent = res.msg;
          msgEl.style.color = res.ok ? 'var(--green)' : 'var(--red)';
        }
        if (res.ok) { renderSidebar(); renderDetail(id); if (typeof OS !== 'undefined') OS.notify(s.icon, 'NormStock', res.msg, 3000); }
      });

      // Sell
      mainEl.querySelector(`#sd-sell-${id}`)?.addEventListener('click', () => {
        const q   = Math.floor(parseFloat(qtyInput?.value) || 0);
        const res = Economy.sell(id, q);
        const msgEl = mainEl.querySelector(`#sd-msg-${id}`);
        if (msgEl) { msgEl.textContent = res.msg; msgEl.style.color = res.ok ? 'var(--green)' : 'var(--red)'; }
        if (res.ok) { renderSidebar(); renderDetail(id); if (typeof OS !== 'undefined') OS.notify(s.icon, 'NormStock', res.msg, 3000); }
      });

      // Sell all
      mainEl.querySelector(`#sd-sellall-${id}`)?.addEventListener('click', () => {
        if (!pos) return;
        const res = Economy.sell(id, pos.shares);
        const msgEl = mainEl.querySelector(`#sd-msg-${id}`);
        if (msgEl) { msgEl.textContent = res.msg; msgEl.style.color = res.ok ? 'var(--green)' : 'var(--red)'; }
        if (res.ok) { renderSidebar(); renderDetail(id); if (typeof OS !== 'undefined') OS.notify(s.icon, 'NormStock', res.msg, 3000); }
      });
    };

    render();

    // Clean up listener when window closes
    EventBus.on('window:closed', () => { if (unsubscribe) { unsubscribe(); unsubscribe = null; } });

    return wrap;
  }
};