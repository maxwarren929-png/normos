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

    // ── Companies state (integrated) ─────────────────────────────────────
    let playerCompanies = [];
    let myCompany       = null;
    let shareholdersCache = {};
    let companyCreateMode = false;
    const COMPANY_ICONS = ['🚀','💡','🔬','🏗️','🎮','🎵','📱','🌐','⚡','🔥','💊','🛸','🎯','🌊','🏆'];

    // Fetch company data
    const fetchCompanies = () => {
      if (typeof Network !== 'undefined' && Network.isConnected()) Network.send({ type:'companies:get' });
    };
    if (typeof Network !== 'undefined') {
      Network.on('companies:data', (msg) => {
        if (!wrap.isConnected) return;
        playerCompanies = msg.companies || [];
        myCompany       = msg.myCompany || null;
        shareholdersCache = msg.shareholders || {};
        if (activeTab === 'companies') { renderSidebar(); renderMain(); }
      });
      Network.on('companies:update', (msg) => {
        if (!wrap.isConnected) return;
        if (msg.companies) playerCompanies = msg.companies;
        if (msg.myCompany !== undefined) myCompany = msg.myCompany;
        if (msg.shareholders) Object.assign(shareholdersCache, msg.shareholders);
        if (activeTab === 'companies') { renderSidebar(); renderMain(); }
      });
      Network.on('companies:created', (msg) => {
        if (!wrap.isConnected) return;
        myCompany = msg.company; companyCreateMode = false;
        activeTab = 'companies'; selectedId = msg.company.ticker;
        renderSidebar(); renderMain();
        if (typeof OS !== 'undefined') OS.notify('🚀', 'IPO', `${msg.company.name} (${msg.company.ticker}) is live!`);
      });
      Network.on('companies:error', (msg) => {
        if (!wrap.isConnected) return;
        const errEl = wrap.querySelector('#comp-err');
        if (errEl) errEl.textContent = msg.message || 'Error';
      });
      Network.on('market:shareholders', (msg) => {
        if (!wrap.isConnected) return;
        shareholdersCache[msg.ticker] = msg.shareholders;
        if (activeTab === 'companies' && selectedId === msg.ticker) renderMain();
      });
    }
    setTimeout(fetchCompanies, 600);

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
              <div class="stocks-tab ${activeTab==='companies'?'active':''}" data-tab="companies">🏢 Companies</div>
            </div>
            <div class="stocks-sector-filter" ${activeTab==='companies'?'style="display:none"':''}>
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
          // Update active tab styling
          wrap.querySelectorAll('.stocks-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
          // Show/hide sector filter
          const sf = wrap.querySelector('.stocks-sector-filter');
          if (sf) sf.style.display = activeTab === 'companies' ? 'none' : '';
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
      } else if (activeTab === 'companies') {
        // Show player companies list + create button
        if (!playerCompanies.length) {
          listEl.innerHTML = `<div class="stocks-empty">No player companies yet.<br><span style="font-size:0.6rem;color:var(--text3)">Be the first to go public!</span></div>`;
        } else {
          listEl.innerHTML = playerCompanies.map(c => {
            const price = Economy.state.prices[c.ticker] || c.ipoPrice || 0.01;
            const hist2 = Economy.state.priceHistory[c.ticker] || [];
            const change = hist2.length>1?((hist2[hist2.length-1]-hist2[0])/hist2[0])*100:0;
            const isUp = change >= 0;
            return `<div class="stock-row ${selectedId===c.ticker?'active':''}" data-id="${c.ticker}">
              <span class="stock-icon">${c.icon}</span>
              <div class="stock-row-info">
                <div class="stock-row-name">${c.ticker} <span class="stock-sector-tag" style="background:#4f9eff22;color:#4f9eff">IPO</span></div>
                <div class="stock-row-full">${c.name} · by ${c.owner}</div>
              </div>
              <div class="stock-row-price">
                <div class="stock-price">$${Economy.fmt(price)}</div>
                <div class="stock-change ${isUp?'up':'down'}">${isUp?'▲':'▼'} ${Math.abs(change).toFixed(1)}%</div>
              </div>
            </div>`;
          }).join('');
        }
        listEl.querySelectorAll('.stock-row[data-id]').forEach(row => {
          row.addEventListener('click', () => {
            selectedId = row.dataset.id; companyCreateMode = false;
            renderSidebar(); renderMain();
            if (typeof Network !== 'undefined') Network.send({ type:'companies:shareholders', ticker: selectedId });
          });
        });
        return;
      }

      // Stock row click → show detail (market & portfolio tabs)
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
      if (activeTab === 'companies') {
        renderCompaniesMain(mainEl);
        return;
      }
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

    // ── Companies main panel ──────────────────────────────────────────────
    const renderCompaniesMain = (mainEl) => {
      if (companyCreateMode) { renderCreateCompany(mainEl); return; }
      if (selectedId) {
        const comp = playerCompanies.find(c => c.ticker === selectedId);
        if (comp) { renderCompanyDetail(mainEl, comp); return; }
      }
      // Overview
      const fmt = Economy.fmt;
      mainEl.innerHTML = `<div class="stocks-placeholder" style="padding:1.5rem;justify-content:flex-start;align-items:flex-start;">
        <div style="width:100%">
          <div style="font-size:1rem;font-weight:700;margin-bottom:0.5rem;">🏢 NormCorp Exchange</div>
          <div style="font-size:0.72rem;color:var(--text2);margin-bottom:1rem;">Player-created companies traded on the live market.</div>
          <div style="display:flex;gap:0.6rem;margin-bottom:1rem;flex-wrap:wrap;">
            <div class="sdst-item"><div class="sdst-label">Listed</div><div class="sdst-val">${playerCompanies.length}</div></div>
            <div class="sdst-item"><div class="sdst-label">Your Company</div><div class="sdst-val">${myCompany?myCompany.ticker:'None'}</div></div>
            <div class="sdst-item"><div class="sdst-label">Mkt Cap</div><div class="sdst-val">$${fmt(playerCompanies.reduce((s,c)=>s+(Economy.state.prices[c.ticker]||c.ipoPrice||0)*(c.totalShares||0),0))}</div></div>
          </div>
          ${!myCompany
            ? `<button id="comp-create-btn" style="background:var(--accent);color:#fff;border:none;border-radius:7px;padding:0.55rem 1.2rem;cursor:pointer;font-size:0.78rem;font-weight:600;margin-bottom:1rem;">🚀 Create Your Company</button>`
            : `<div style="background:var(--surface);border:1px solid var(--border);border-radius:7px;padding:0.6rem 0.85rem;margin-bottom:1rem;font-size:0.72rem;">
                You own <strong style="color:var(--accent)">${myCompany.name} (${myCompany.ticker})</strong>. Currently priced at <strong>$${fmt(Economy.state.prices[myCompany.ticker]||myCompany.ipoPrice||0)}</strong>.
               </div>`
          }
          ${playerCompanies.length > 0 ? `
            <div style="font-size:0.7rem;font-weight:600;color:var(--text2);margin-bottom:0.4rem;">SELECT A COMPANY TO TRADE</div>
            ${playerCompanies.slice(0,5).map(c => {
              const price = Economy.state.prices[c.ticker]||c.ipoPrice||0.01;
              return `<div class="stock-row" data-comp="${c.ticker}" style="cursor:pointer;margin-bottom:0.3rem;border:1px solid var(--border);border-radius:6px;padding:0.5rem 0.65rem;">
                <span class="stock-icon">${c.icon}</span>
                <div class="stock-row-info"><div class="stock-row-name">${c.ticker}</div><div class="stock-row-full">${c.name} · ${(c.totalShares||0).toLocaleString()} shares</div></div>
                <div class="stock-row-price"><div class="stock-price">$${fmt(price)}</div><div style="font-size:0.6rem;color:var(--text3)">by ${c.owner}</div></div>
              </div>`;
            }).join('')}
          ` : ''}
        </div>
      </div>`;
      mainEl.querySelector('#comp-create-btn')?.addEventListener('click', () => { companyCreateMode=true; renderCompaniesMain(mainEl); });
      mainEl.querySelectorAll('[data-comp]').forEach(row => {
        row.addEventListener('click', () => {
          selectedId = row.dataset.comp;
          renderSidebar(); renderCompaniesMain(mainEl);
          if (typeof Network !== 'undefined') Network.send({ type:'companies:shareholders', ticker: selectedId });
        });
      });
    };

    const renderCreateCompany = (mainEl) => {
      if (myCompany) { companyCreateMode=false; renderCompaniesMain(mainEl); return; }
      let selIcon = '🚀';
      mainEl.innerHTML = `<div style="padding:1rem;max-width:480px;">
        <div style="font-size:0.95rem;font-weight:700;margin-bottom:0.75rem;">🚀 Launch Your Company</div>
        <div style="font-size:0.68rem;color:var(--text3);margin-bottom:1rem;">One company per player. Your stock immediately joins the live market.</div>
        <div style="display:flex;flex-direction:column;gap:0.5rem;">
          <label style="font-size:0.62rem;color:var(--text3)">Company Name</label>
          <input id="cc-name" style="background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:0.4rem 0.65rem;color:var(--text);font-size:0.82rem;outline:none;" type="text" placeholder="e.g. NormTech Solutions" maxlength="32"/>
          <label style="font-size:0.62rem;color:var(--text3)">Ticker (2–5 chars)</label>
          <input id="cc-ticker" style="background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:0.4rem 0.65rem;color:var(--text);font-family:var(--font-mono);font-size:0.82rem;outline:none;text-transform:uppercase;" type="text" placeholder="e.g. NTCH" maxlength="5"/>
          <label style="font-size:0.62rem;color:var(--text3)">Icon</label>
          <div id="cc-icons" style="display:flex;flex-wrap:wrap;gap:0.25rem;">${COMPANY_ICONS.map(ic=>`<span class="ccfi" data-icon="${ic}" style="font-size:1.3rem;padding:0.25rem;border-radius:4px;cursor:pointer;border:2px solid transparent;transition:border-color .12s;">${ic}</span>`).join('')}</div>
          <label style="font-size:0.62rem;color:var(--text3)">Total Shares</label>
          <input id="cc-shares" style="background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:0.4rem 0.65rem;color:var(--text);font-family:var(--font-mono);font-size:0.82rem;outline:none;" type="number" value="1000000" min="100000" max="100000000"/>
          <label style="font-size:0.62rem;color:var(--text3)">Initial Capital ($) — sets IPO price</label>
          <input id="cc-capital" style="background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:0.4rem 0.65rem;color:var(--text);font-family:var(--font-mono);font-size:0.82rem;outline:none;" type="number" value="5000" min="100"/>
          <div id="cc-preview" style="font-size:0.68rem;color:var(--text2);background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:0.35rem 0.55rem;text-align:center;">IPO price: <strong>$0.005</strong></div>
          <div id="comp-err" style="font-size:0.68rem;color:#f87171;min-height:1.2em;text-align:center;"></div>
          <div style="display:flex;gap:0.5rem;">
            <button id="cc-cancel" style="flex:1;background:var(--surface2);color:var(--text2);border:1px solid var(--border);border-radius:6px;padding:0.5rem;cursor:pointer;font-size:0.75rem;">Cancel</button>
            <button id="cc-submit" style="flex:2;background:var(--accent);color:#fff;border:none;border-radius:6px;padding:0.5rem;cursor:pointer;font-size:0.75rem;font-weight:700;">🚀 Launch IPO</button>
          </div>
        </div>
      </div>`;

      // Icon select
      const updateIconSelection = () => {
        mainEl.querySelectorAll('.ccfi').forEach(ic => ic.style.borderColor = ic.dataset.icon===selIcon?'var(--accent)':'transparent');
      };
      mainEl.querySelectorAll('.ccfi').forEach(ic => ic.addEventListener('click', () => { selIcon=ic.dataset.icon; updateIconSelection(); }));
      updateIconSelection();

      // Price preview
      const updatePreview = () => {
        const cap=parseFloat(mainEl.querySelector('#cc-capital')?.value)||0;
        const sh=parseFloat(mainEl.querySelector('#cc-shares')?.value)||1;
        const p=cap/sh;
        const prev=mainEl.querySelector('#cc-preview');
        if(prev) prev.innerHTML=`IPO price: <strong>$${p<0.01?p.toFixed(6):Economy.fmt(p)}</strong>`;
      };
      mainEl.querySelector('#cc-capital')?.addEventListener('input', updatePreview);
      mainEl.querySelector('#cc-shares')?.addEventListener('input', updatePreview);
      mainEl.querySelector('#cc-ticker')?.addEventListener('input', e => { e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''); });

      mainEl.querySelector('#cc-cancel')?.addEventListener('click', () => { companyCreateMode=false; renderCompaniesMain(mainEl); });
      mainEl.querySelector('#cc-submit')?.addEventListener('click', () => {
        const name=mainEl.querySelector('#cc-name')?.value.trim();
        const ticker=mainEl.querySelector('#cc-ticker')?.value.trim().toUpperCase();
        const shares=parseInt(mainEl.querySelector('#cc-shares')?.value)||0;
        const capital=parseFloat(mainEl.querySelector('#cc-capital')?.value)||0;
        const errEl=mainEl.querySelector('#comp-err');
        if(!name||name.length<2){if(errEl)errEl.textContent='Name too short';return;}
        if(!ticker||ticker.length<2){if(errEl)errEl.textContent='Ticker must be 2–5 chars';return;}
        if(shares<100000){if(errEl)errEl.textContent='Min 100,000 shares';return;}
        if(capital<100){if(errEl)errEl.textContent='Min $100 capital';return;}
        if(capital>Economy.state.balance){if(errEl)errEl.textContent='Insufficient funds';return;}
        if(errEl)errEl.textContent='';
        if(typeof Network!=='undefined'&&Network.isConnected()){
          Network.send({type:'companies:create',name,ticker,icon:selIcon,totalShares:shares,initialCapital:capital});
        } else { if(errEl)errEl.textContent='Not connected to server'; }
      });
    };

    const renderCompanyDetail = (mainEl, c) => {
      const price = Economy.state.prices[c.ticker] || c.ipoPrice || 0.01;
      const hist2 = Economy.state.priceHistory[c.ticker] || [];
      const change = hist2.length>1?((hist2[hist2.length-1]-hist2[0])/hist2[0])*100:0;
      const isUp = change >= 0;
      const pos = Economy.state.portfolio[c.ticker];
      const topShareholders = shareholdersCache[c.ticker] || [];
      const isMyComp = myCompany?.ticker === c.ticker;
      const marketCap = price * (c.totalShares||0);

      // Sparkline
      const sparkline = (() => {
        if (hist2.length < 2) return '';
        const W=280,H=55,min=Math.min(...hist2),max=Math.max(...hist2),range=max-min||1;
        const pts=hist2.map((v,i)=>{const x=(i/(hist2.length-1))*W,y=H-((v-min)/range)*H;return`${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ');
        const color=isUp?'#34d399':'#f87171';
        return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:100%;height:55px;margin-bottom:.5rem"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;
      })();

      mainEl.innerHTML = `<div class="stocks-detail">
        <div class="sd-header">
          <span style="font-size:1.8rem">${c.icon}</span>
          <div class="sd-title-block">
            <div class="sd-ticker">${c.ticker} <span class="stock-sector-tag" style="background:#4f9eff22;color:#4f9eff">IPO</span>${isMyComp?'<span class="stock-sector-tag" style="background:#4ade8022;color:#4ade80">YOURS</span>':''}</div>
            <div class="sd-name">${c.name}</div>
            <div style="font-size:0.62rem;color:var(--text3)">by ${c.owner} · ${(c.totalShares||0).toLocaleString()} shares</div>
          </div>
          <div class="sd-price-block">
            <div class="sd-price">$${Economy.fmt(price)}</div>
            <div class="stock-change ${isUp?'up':'down'}" style="font-size:0.82rem">${isUp?'▲':'▼'} ${Math.abs(change).toFixed(2)}%</div>
          </div>
        </div>
        <div class="sd-chart">${sparkline}</div>
        <div class="sd-stats">
          <div class="sdst-item"><div class="sdst-label">Market Cap</div><div class="sdst-val">$${Economy.fmt(marketCap)}</div></div>
          <div class="sdst-item"><div class="sdst-label">Shares</div><div class="sdst-val">${(c.totalShares||0).toLocaleString()}</div></div>
          <div class="sdst-item"><div class="sdst-label">IPO Price</div><div class="sdst-val">$${Economy.fmt(c.ipoPrice||0)}</div></div>
        </div>
        ${pos?`<div class="sd-position"><div class="sdp-title">Your Position</div><div class="sdp-grid">
          <div class="sdp-item"><div class="sdp-label">Shares</div><div class="sdp-val">${pos.shares}</div></div>
          <div class="sdp-item"><div class="sdp-label">Value</div><div class="sdp-val">$${Economy.fmt(price*pos.shares)}</div></div>
          <div class="sdp-item"><div class="sdp-label">P&L</div><div class="sdp-val ${(price-pos.avgCost)>=0?'green':'red'}">${(price-pos.avgCost)>=0?'+':''}$${Economy.fmt((price-pos.avgCost)*pos.shares)}</div></div>
        </div></div>`:''}
        <div class="sd-trade"><div class="sd-trade-title">Trade ${c.ticker}</div>
          <div class="sd-trade-row">
            <label style="font-size:0.7rem;color:var(--text2)">Shares</label>
            <input class="sd-qty" id="cq-in" type="number" min="1" value="1" style="width:75px;background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:0.28rem 0.45rem;color:var(--text);font-family:var(--font-mono);font-size:0.82rem;outline:none;text-align:center;"/>
            <span id="cq-cost" style="font-size:0.68rem;color:var(--text3)">Cost: $${Economy.fmt(price)}</span>
          </div>
          <div class="sd-trade-btns">
            <button class="sd-buy-btn" id="cq-buy">🟢 Buy</button>
            ${pos?`<button class="sd-sell-btn" id="cq-sell">🔴 Sell</button>`:''}
          </div>
          <div class="sd-trade-msg" id="cq-msg"></div>
        </div>
        <div class="sd-shareholders" id="sd-shareholders-${c.ticker}">
          <div class="sdsh-title">🏆 Top Shareholders</div>
          ${topShareholders.length===0
            ?'<div style="font-size:0.62rem;color:var(--text3)">Loading shareholders...</div>'
            :topShareholders.map((sh,i)=>`<div class="sdsh-row"><span style="min-width:1.3rem">${['🥇','🥈','🥉'][i]||'·'}</span><span style="flex:1;color:${sh.color||'var(--text)'};font-size:0.68rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sh.username}${sh.isOwner?'👑':''}</span><span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text2)">${(sh.shares||0).toLocaleString()}</span><span style="font-size:0.6rem;color:var(--text3);margin-left:0.35rem">${((sh.shares||0)/(c.totalShares||1)*100).toFixed(1)}%</span></div>`).join('')
          }
        </div>
      </div>`;

      const qInp=mainEl.querySelector('#cq-in'),cqcost=mainEl.querySelector('#cq-cost');
      qInp?.addEventListener('input',()=>{if(cqcost)cqcost.textContent=`Cost: $${Economy.fmt(price*(parseFloat(qInp.value)||0))}`;});
      mainEl.querySelector('#cq-buy')?.addEventListener('click',()=>{
        const q=Math.floor(parseFloat(qInp?.value)||0);
        if (q <= 0) return;
        const msgEl=mainEl.querySelector('#cq-msg');
        if(typeof Network!=='undefined'&&Network.isConnected()){
          const cost=price*q;
          if(cost>Economy.state.balance){if(msgEl){msgEl.textContent=`Insufficient funds. Need $${Economy.fmt(cost)}.`;msgEl.style.color='var(--red)';}return;}
          if(msgEl){msgEl.textContent='Order sent...';msgEl.style.color='var(--text3)';}
          Network.buyStock(c.ticker,q);
        } else {
          const res=Economy.buy(c.ticker,q);
          if(msgEl){msgEl.textContent=res.msg;msgEl.style.color=res.ok?'var(--green)':'var(--red)';}
          if(res.ok)renderCompanyDetail(mainEl,c);
        }
      });
      mainEl.querySelector('#cq-sell')?.addEventListener('click',()=>{
        const q=Math.floor(parseFloat(qInp?.value)||0);
        if (q <= 0) return;
        const msgEl=mainEl.querySelector('#cq-msg');
        if(typeof Network!=='undefined'&&Network.isConnected()){
          if(!pos||q>pos.shares){if(msgEl){msgEl.textContent=pos?`You only own ${pos.shares} shares.`:'You don\'t own this stock.';msgEl.style.color='var(--red)';}return;}
          if(msgEl){msgEl.textContent='Order sent...';msgEl.style.color='var(--text3)';}
          Network.sellStock(c.ticker,q);
        } else {
          const res=Economy.sell(c.ticker,q);
          if(msgEl){msgEl.textContent=res.msg;msgEl.style.color=res.ok?'var(--green)':'var(--red)';}
          if(res.ok)renderCompanyDetail(mainEl,c);
        }
      });
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

          <div class="sd-shareholders" id="sd-shareholders-${id}">
            <div class="sdsh-title">🏆 Top Shareholders</div>
            <div class="sdsh-loading" style="font-size:0.65rem;color:var(--text3);">Loading...</div>
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
        if (q <= 0) return;
        const msgEl = mainEl.querySelector(`#sd-msg-${id}`);
        if (typeof Network !== 'undefined' && Network.isConnected()) {
          // Server is source of truth — send trade request, wait for market:trade:ok
          const cost = price * q;
          if (cost > Economy.state.balance) {
            if (msgEl) { msgEl.textContent = `Insufficient funds. Need $${Economy.fmt(cost)}, have $${Economy.fmt(Economy.state.balance)}.`; msgEl.style.color = 'var(--red)'; }
            return;
          }
          if (msgEl) { msgEl.textContent = 'Order sent...'; msgEl.style.color = 'var(--text3)'; }
          Network.buyStock(id, q);
        } else {
          // Offline fallback
          const res = Economy.buy(id, q);
          if (msgEl) { msgEl.textContent = res.msg; msgEl.style.color = res.ok ? 'var(--green)' : 'var(--red)'; }
          if (res.ok) { renderSidebar(); renderDetail(id); if (typeof OS !== 'undefined') OS.notify(s.icon, 'NormStock', res.msg, 3000); }
        }
      });

      // Sell
      mainEl.querySelector(`#sd-sell-${id}`)?.addEventListener('click', () => {
        const q   = Math.floor(parseFloat(qtyInput?.value) || 0);
        if (q <= 0) return;
        const msgEl = mainEl.querySelector(`#sd-msg-${id}`);
        if (typeof Network !== 'undefined' && Network.isConnected()) {
          if (!pos || q > pos.shares) {
            if (msgEl) { msgEl.textContent = pos ? `You only own ${pos.shares} shares.` : 'You don\'t own this stock.'; msgEl.style.color = 'var(--red)'; }
            return;
          }
          if (msgEl) { msgEl.textContent = 'Order sent...'; msgEl.style.color = 'var(--text3)'; }
          Network.sellStock(id, q);
        } else {
          const res = Economy.sell(id, q);
          if (msgEl) { msgEl.textContent = res.msg; msgEl.style.color = res.ok ? 'var(--green)' : 'var(--red)'; }
          if (res.ok) { renderSidebar(); renderDetail(id); if (typeof OS !== 'undefined') OS.notify(s.icon, 'NormStock', res.msg, 3000); }
        }
      });

      // Sell all
      mainEl.querySelector(`#sd-sellall-${id}`)?.addEventListener('click', () => {
        if (!pos) return;
        const msgEl = mainEl.querySelector(`#sd-msg-${id}`);
        if (typeof Network !== 'undefined' && Network.isConnected()) {
          if (msgEl) { msgEl.textContent = 'Order sent...'; msgEl.style.color = 'var(--text3)'; }
          Network.sellStock(id, pos.shares);
        } else {
          const res = Economy.sell(id, pos.shares);
          if (msgEl) { msgEl.textContent = res.msg; msgEl.style.color = res.ok ? 'var(--green)' : 'var(--red)'; }
          if (res.ok) { renderSidebar(); renderDetail(id); if (typeof OS !== 'undefined') OS.notify(s.icon, 'NormStock', res.msg, 3000); }
        }
      });

      // Request shareholders from server
      if (typeof Network !== 'undefined' && Network.isConnected()) {
        Network.send({ type: 'companies:shareholders', ticker: id });
        const onShareholders = (msg) => {
          if (msg.ticker !== id) return;
          Network.off('market:shareholders', onShareholders);
          const shEl = mainEl.querySelector(`#sd-shareholders-${id}`);
          if (!shEl) return;
          const top = (msg.shareholders || []).slice(0, 5);
          if (!top.length) {
            const loadEl = shEl.querySelector('.sdsh-loading');
            if (loadEl) loadEl.textContent = 'No shareholders yet';
            return;
          }
          shEl.innerHTML = `
            <div class="sdsh-title">🏆 Top Shareholders</div>
            ${top.map((sh, i) => `
              <div class="sdsh-row">
                <span style="min-width:1.2rem">${['🥇','🥈','🥉'][i]||'·'}</span>
                <span style="flex:1;color:${sh.color||'var(--text)'};font-size:0.7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sh.username}${sh.isOwner?'👑':''}</span>
                <span style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text2)">${(sh.shares||0).toLocaleString()}</span>
              </div>
            `).join('')}
          `;
        };
        Network.on('market:shareholders', onShareholders);
      } else {
        const shEl = mainEl.querySelector(`#sd-shareholders-${id}`);
        if (shEl) { const l = shEl.querySelector('.sdsh-loading'); if(l) l.textContent = 'Connect to see shareholders'; }
      }
    };

    render();

    // Re-render after server confirms a trade (buy/sell) so UI reflects new balance & portfolio
    if (typeof Network !== 'undefined') {
      const onTradeOk = (msg) => {
        if (!wrap.isConnected) return;
        renderSidebar();
        if (selectedId === msg.stockId) renderDetail(msg.stockId);
        if (typeof OS !== 'undefined') {
          const st = Economy.getStock(msg.stockId);
          const icon = st ? st.icon : '📈';
          if (msg.action === 'BUY') OS.notify(icon, 'NormStock', `Bought ${msg.shares} share${msg.shares>1?'s':''} of ${msg.stockId} for $${Economy.fmt(msg.cost)}.`);
          else OS.notify(icon, 'NormStock', `Sold ${msg.shares} share${msg.shares>1?'s':''} of ${msg.stockId} for $${Economy.fmt(msg.revenue)}.`);
        }
      };
      const onTradeFail = (msg) => {
        if (!wrap.isConnected) return;
        const msgEl = wrap.querySelector(`#sd-msg-${selectedId}`);
        if (msgEl) { msgEl.textContent = msg.reason || 'Trade failed'; msgEl.style.color = 'var(--red)'; }
      };
      Network.on('market:trade:ok',   onTradeOk);
      Network.on('market:trade:fail', onTradeFail);
      wrap._cleanup_stocks = () => {
        Network.off('market:trade:ok',   onTradeOk);
        Network.off('market:trade:fail', onTradeFail);
      };
    }

    // Clean up listener when window closes
    EventBus.on('window:closed', () => { if (unsubscribe) { unsubscribe(); unsubscribe = null; } if (wrap._cleanup_stocks) wrap._cleanup_stocks(); });

    return wrap;
  }
};
