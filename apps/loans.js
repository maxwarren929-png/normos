/**
 * NormOS — apps/loans.js
 * NormBank Loans: borrow, pay interest, default and lose everything
 */

const LoansApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'loans-wrap';
    const iid = Math.random().toString(36).slice(2, 6);

    const LOAN_KEY = 'normos_loan';
    const loadLoan = () => { try { return JSON.parse(localStorage.getItem(LOAN_KEY) || 'null'); } catch { return null; } };
    const saveLoan = (l) => { try { if (l) localStorage.setItem(LOAN_KEY, JSON.stringify(l)); else localStorage.removeItem(LOAN_KEY); } catch {} };

    const LOAN_TIERS = [
      { amount: 500,    rate: 0.05, term: '5 min',  ms: 300000,  label: 'Quick Cash',   risk: 'Low'    },
      { amount: 2500,   rate: 0.10, term: '15 min', ms: 900000,  label: 'Medium Risk',  risk: 'Medium' },
      { amount: 10000,  rate: 0.20, term: '30 min', ms: 1800000, label: 'High Stakes',  risk: 'High'   },
      { amount: 50000,  rate: 0.35, term: '1 hour', ms: 3600000, label: 'All In',       risk: 'Extreme' },
    ];

    const escHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });

    const checkDefault = (loan) => {
      if (!loan) return false;
      if (Date.now() > loan.dueAt) return true;
      return false;
    };

    const applyDefault = (loan) => {
      // Lose everything
      if (typeof Economy !== 'undefined') {
        Economy.state.balance = 0;
        // Liquidate portfolio
        Object.keys(Economy.state.portfolio).forEach(id => {
          const pos = Economy.state.portfolio[id];
          const price = Economy.state.prices[id] || 0;
          // Just wipe it
        });
        Economy.state.portfolio = {};
        Economy.save();
        Economy.updateWalletDisplay();
      }
      saveLoan(null);
      // Unlock bankrupt badge
      try {
        const p = JSON.parse(localStorage.getItem('normos_profile') || '{}');
        if (!p.badges) p.badges = [];
        if (!p.badges.includes('bankrupt')) { p.badges.push('bankrupt'); localStorage.setItem('normos_profile', JSON.stringify(p)); }
      } catch {}
      return true;
    };

    const render = () => {
      let loan = loadLoan();
      const defaulted = loan && checkDefault(loan);
      if (defaulted) {
        applyDefault(loan);
        loan = null;
      }

      const balance = (typeof Economy !== 'undefined') ? Economy.state.balance : 0;

      if (loan) {
        const timeLeft = Math.max(0, loan.dueAt - Date.now());
        const mins = Math.floor(timeLeft / 60000);
        const secs = Math.floor((timeLeft % 60000) / 1000);
        const interestAccrued = loan.principal * loan.rate;
        const totalDue = loan.principal + interestAccrued;
        const canPay = balance >= totalDue;

        wrap.innerHTML = `
          <div class="loans-layout">
            <div class="loans-header">
              <span class="loans-logo">🏦 NormBank</span>
              <span class="loans-tagline">We believe in you. Financially.</span>
            </div>
            <div class="loans-active-card">
              <div class="loans-active-title">⚠️ Active Loan</div>
              <div class="loans-active-grid">
                <div class="loans-stat"><div class="loans-stat-label">Borrowed</div><div class="loans-stat-val">$${fmt(loan.principal)}</div></div>
                <div class="loans-stat"><div class="loans-stat-label">Interest (${(loan.rate*100).toFixed(0)}%)</div><div class="loans-stat-val" style="color:var(--red)">+$${fmt(interestAccrued)}</div></div>
                <div class="loans-stat"><div class="loans-stat-label">Total Due</div><div class="loans-stat-val" style="color:var(--red);font-weight:bold;">$${fmt(totalDue)}</div></div>
                <div class="loans-stat"><div class="loans-stat-label">Time Remaining</div><div class="loans-stat-val" style="color:${timeLeft < 60000 ? 'var(--red)' : 'var(--text1)'};">${mins}m ${secs}s</div></div>
              </div>
              <div class="loans-timer-bar-wrap">
                <div class="loans-timer-bar" style="width:${Math.min(100,(timeLeft/loan.durationMs)*100)}%; background:${timeLeft < 60000 ? 'var(--red)' : 'var(--accent)'}"></div>
              </div>
              <div style="color:var(--text3);font-size:0.72rem;margin:8px 0 14px;">Your balance: $${fmt(balance)}</div>
              <button class="loans-pay-btn ${canPay?'':'disabled'}" id="loans-pay-${iid}" ${canPay?'':'disabled'}>
                ${canPay ? '💰 Repay Loan ($'+fmt(totalDue)+')' : '❌ Insufficient Funds to Repay'}
              </button>
              <div style="font-size:0.68rem;color:var(--text3);margin-top:8px;text-align:center;">
                If you can't repay by the deadline, NormBank will take <strong style="color:var(--red)">everything</strong>.
              </div>
            </div>
          </div>
        `;

        wrap.querySelector(`#loans-pay-${iid}`)?.addEventListener('click', () => {
          if (!canPay) return;
          Economy.state.balance -= totalDue;
          Economy.save();
          Economy.updateWalletDisplay();
          saveLoan(null);
          if (typeof OS !== 'undefined') OS.notify('🏦', 'NormBank', `Loan repaid! $${fmt(totalDue)} paid.`);
          render();
        });

        // Countdown tick
        const tick = setInterval(() => {
          if (!document.body.contains(wrap)) { clearInterval(tick); return; }
          const curLoan = loadLoan();
          if (!curLoan) { clearInterval(tick); render(); return; }
          const tl = Math.max(0, curLoan.dueAt - Date.now());
          if (tl === 0) { clearInterval(tick); render(); return; }
          const m = Math.floor(tl / 60000);
          const s = Math.floor((tl % 60000) / 1000);
          const statVals = wrap.querySelectorAll('.loans-stat-val');
          if (statVals[3]) statVals[3].textContent = `${m}m ${s}s`;
          if (statVals[3]) statVals[3].style.color = tl < 60000 ? 'var(--red)' : 'var(--text1)';
          const bar = wrap.querySelector('.loans-timer-bar');
          if (bar) { bar.style.width = Math.min(100,(tl/curLoan.durationMs)*100)+'%'; bar.style.background = tl < 60000 ? 'var(--red)' : 'var(--accent)'; }
        }, 1000);

      } else {
        wrap.innerHTML = `
          <div class="loans-layout">
            <div class="loans-header">
              <span class="loans-logo">🏦 NormBank</span>
              <span class="loans-tagline">"We believe in you. Financially."</span>
            </div>
            <div class="loans-intro">
              <div style="font-size:0.8rem;color:var(--text2);line-height:1.6;margin-bottom:16px;">
                Need cash fast? NormBank offers instant loans with <em>very reasonable</em> interest rates.<br>
                Miss the deadline? We take <strong style="color:var(--red)">everything</strong>. No exceptions.
              </div>
              <div style="font-size:0.72rem;color:var(--text3);margin-bottom:16px;">Your balance: $${fmt(balance)}</div>
            </div>
            <div class="loans-tiers">
              ${LOAN_TIERS.map((tier, i) => `
                <div class="loans-tier-card">
                  <div class="loans-tier-name">${escHtml(tier.label)}</div>
                  <div class="loans-tier-details">
                    <span class="loans-tier-amount">$${fmt(tier.amount)}</span>
                    <span class="loans-tier-rate">${(tier.rate*100).toFixed(0)}% interest</span>
                    <span class="loans-tier-term">Due in ${escHtml(tier.term)}</span>
                    <span class="loans-tier-risk risk-${tier.risk.toLowerCase()}">${escHtml(tier.risk)} Risk</span>
                  </div>
                  <button class="loans-borrow-btn" data-tier="${i}" id="loans-borrow-${iid}-${i}">💵 Borrow $${fmt(tier.amount)}</button>
                </div>
              `).join('')}
            </div>
          </div>
        `;

        LOAN_TIERS.forEach((tier, i) => {
          wrap.querySelector(`#loans-borrow-${iid}-${i}`)?.addEventListener('click', () => {
            if (!confirm(`Borrow $${fmt(tier.amount)} at ${(tier.rate*100).toFixed(0)}% interest, due in ${tier.term}?\n\nDefault = lose EVERYTHING.`)) return;
            if (typeof Economy !== 'undefined') {
              Economy.state.balance += tier.amount;
              Economy.save();
              Economy.updateWalletDisplay();
            }
            const loan = {
              principal: tier.amount,
              rate: tier.rate,
              durationMs: tier.ms,
              borrowedAt: Date.now(),
              dueAt: Date.now() + tier.ms,
            };
            saveLoan(loan);
            // Unlock badge
            try {
              const p = JSON.parse(localStorage.getItem('normos_profile') || '{}');
              if (!p.badges) p.badges = [];
              if (!p.badges.includes('loan_shark')) { p.badges.push('loan_shark'); localStorage.setItem('normos_profile', JSON.stringify(p)); }
            } catch {}
            if (typeof OS !== 'undefined') OS.notify('🏦', 'NormBank', `Loan approved! $${fmt(tier.amount)} added to your account.`);
            render();
          });
        });
      }
    };

    render();

    // Styles
    if (!document.getElementById('loans-styles')) {
      const s = document.createElement('style');
      s.id = 'loans-styles';
      s.textContent = `
        .loans-wrap { height:100%; overflow-y:auto; background:var(--bg1); }
        .loans-layout { padding:16px; max-width:600px; margin:0 auto; }
        .loans-header { text-align:center; margin-bottom:20px; padding:16px; background:var(--bg2); border-radius:10px; border:1px solid var(--border); }
        .loans-logo { font-size:1.3rem; font-weight:bold; color:var(--text1); display:block; margin-bottom:4px; }
        .loans-tagline { font-size:0.72rem; color:var(--text3); font-style:italic; }
        .loans-intro { padding:0 4px; }
        .loans-tiers { display:flex; flex-direction:column; gap:10px; }
        .loans-tier-card { background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:14px; }
        .loans-tier-name { font-size:0.85rem; font-weight:bold; color:var(--text1); margin-bottom:8px; }
        .loans-tier-details { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
        .loans-tier-amount { font-size:1rem; font-weight:bold; color:var(--accent); }
        .loans-tier-rate,.loans-tier-term { font-size:0.72rem; color:var(--text2); background:var(--bg3); padding:2px 8px; border-radius:10px; }
        .loans-tier-risk { font-size:0.68rem; font-weight:bold; padding:2px 8px; border-radius:10px; }
        .risk-low { background:rgba(74,222,128,0.15); color:#4ade80; }
        .risk-medium { background:rgba(250,204,21,0.15); color:#facc15; }
        .risk-high { background:rgba(251,146,60,0.15); color:#fb923c; }
        .risk-extreme { background:rgba(248,113,113,0.15); color:#f87171; }
        .loans-borrow-btn { background:var(--accent); color:#fff; border:none; border-radius:5px; padding:7px 16px; font-size:0.78rem; cursor:pointer; font-weight:600; width:100%; }
        .loans-borrow-btn:hover { opacity:0.85; }
        .loans-active-card { background:var(--bg2); border:1px solid var(--red); border-radius:10px; padding:18px; }
        .loans-active-title { font-size:0.85rem; font-weight:bold; color:var(--red); margin-bottom:14px; }
        .loans-active-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
        .loans-stat { background:var(--bg1); border:1px solid var(--border); border-radius:6px; padding:8px 12px; }
        .loans-stat-label { font-size:0.65rem; color:var(--text3); margin-bottom:3px; }
        .loans-stat-val { font-size:0.9rem; color:var(--text1); font-weight:600; }
        .loans-timer-bar-wrap { background:var(--bg1); border-radius:4px; height:6px; overflow:hidden; margin-bottom:10px; }
        .loans-timer-bar { height:100%; transition:width 1s linear; border-radius:4px; }
        .loans-pay-btn { background:var(--accent); color:#fff; border:none; border-radius:6px; padding:10px; font-size:0.82rem; cursor:pointer; font-weight:600; width:100%; }
        .loans-pay-btn:hover { opacity:0.85; }
        .loans-pay-btn.disabled { background:var(--bg3); color:var(--text3); cursor:not-allowed; }
      `;
      document.head.appendChild(s);
    }

    return wrap;
  }
};
