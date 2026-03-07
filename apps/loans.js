/**
 * NormOS — apps/loans.js (v7 — Hackable Banks + Loans)
 * Removed: NormBank Central deposits
 * Upgraded: roomier UI, Loans as its own sidebar tab
 */

const LoansApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'bank-wrap';
    const iid = Math.random().toString(36).slice(2, 6);

    let activeBank = 'loans';
    let bankState  = { balance:0, creditScore:0, loan:null };
    let multiBankData = {
      noot:  { myDeposit:0, totalDeposits:0, topDepositors:[] },
      elite: { myDeposit:0, totalDeposits:0, topDepositors:[] },
      comm:  { myDeposit:0, totalDeposits:0, topDepositors:[] },
    };
    let hackCooldowns = {};
    let loanTimer = null;

    const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const CREDIT_TIERS = [
      { name:'Base',      minScore:0,    loanAmount:500,    rate:0.05, termMs:300000,  color:'#6b7280', icon:'⬛' },
      { name:'Fair',      minScore:100,  loanAmount:2500,   rate:0.10, termMs:900000,  color:'#f59e0b', icon:'🟡' },
      { name:'Good',      minScore:300,  loanAmount:10000,  rate:0.15, termMs:1800000, color:'#4ade80', icon:'🟢' },
      { name:'Excellent', minScore:600,  loanAmount:50000,  rate:0.20, termMs:3600000, color:'#4f9eff', icon:'🔵' },
      { name:'Elite',     minScore:1000, loanAmount:250000, rate:0.25, termMs:7200000, color:'#c084fc', icon:'💜' },
    ];

    const HACKABLE_BANKS = {
      noot:  { id:'noot',  name:'NootScam Bank', icon:'🐧', security:1, interestRate:1.8, fee:0.5,  hackDifficulty:1, color:'#f59e0b', tagline:"We're totally legit. Probably.", cdMs:60000  },
      elite: { id:'elite', name:'Elite Bank',    icon:'💎', security:3, interestRate:0.8, fee:2.5,  hackDifficulty:3, color:'#c084fc', tagline:"For those who deserve better.", cdMs:240000 },
      comm:  { id:'comm',  name:'CommBank',      icon:'🏦', security:2, interestRate:1.2, fee:1.2,  hackDifficulty:2, color:'#4f9eff', tagline:"Banking. It's a thing we do.",  cdMs:120000 },
    };

    const getCreditTier = (score) => {
      let t = CREDIT_TIERS[0];
      for (const ct of CREDIT_TIERS) { if (score >= ct.minScore) t = ct; }
      return t;
    };

    const startLoanTimer = () => {
      if (loanTimer) clearInterval(loanTimer);
      loanTimer = setInterval(() => {
        if (!document.body.contains(wrap)) { clearInterval(loanTimer); return; }
        if (!bankState.loan?.active) { clearInterval(loanTimer); return; }
        const tl = Math.max(0, bankState.loan.dueAt - Date.now());
        if (tl === 0) { clearInterval(loanTimer); if (typeof Network !== 'undefined' && Network.isConnected()) Network.send({ type:'bank:loan:default' }); return; }
        const countEl = wrap.querySelector('.bank-loan-countdown');
        const barEl   = wrap.querySelector('.bank-loan-bar');
        if (countEl) { const m = Math.floor(tl/60000), s = Math.floor((tl%60000)/1000); countEl.textContent = `${m}m ${s}s`; countEl.style.color = tl < 60000 ? '#f87171' : 'var(--text1)'; }
        if (barEl)   { barEl.style.width = Math.min(100, (tl / bankState.loan.termMs) * 100) + '%'; barEl.style.background = tl < 60000 ? '#f87171' : 'var(--accent)'; }
      }, 1000);
    };

    const setMsg  = (el, txt, color) => { if (el) { el.textContent = txt; el.style.color = color; } };
    const showToast = (msg, color = '#4ade80') => {
      const t = document.createElement('div');
      t.style.cssText = `position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#1a1d23;border:1px solid ${color};color:${color};padding:0.6rem 1.2rem;border-radius:8px;font-size:0.76rem;z-index:9999;pointer-events:none;font-family:var(--font-mono);box-shadow:0 4px 20px rgba(0,0,0,0.5);white-space:nowrap;`;
      t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
    };

    // ── Loans panel ──────────────────────────────────────────────────────────
    const renderLoans = () => {
      const s    = bankState;
      const tier = getCreditTier(s.creditScore || 0);
      const loan = s.loan;
      const tl   = loan?.active ? Math.max(0, loan.dueAt - Date.now()) : 0;
      const tlM  = Math.floor(tl / 60000), tlS = Math.floor((tl % 60000) / 1000);
      const pct  = Math.min(100, ((s.creditScore || 0) / 1200) * 100);
      const nextTier    = CREDIT_TIERS.find(t => t.minScore > (s.creditScore || 0)) || CREDIT_TIERS[CREDIT_TIERS.length - 1];
      const loanAmt     = tier.loanAmount;
      const loanTotal   = loanAmt + loanAmt * tier.rate;
      const termMins    = Math.round(tier.termMs / 60000);

      return `<div class="ml-loans">
        <div class="ml-section ml-credit-card">
          <div class="ml-section-head">📊 Credit Score</div>
          <div class="ml-credit-row">
            <div>
              <div class="ml-score-val" style="color:${tier.color}">${s.creditScore || 0}</div>
              <div class="ml-score-tier" style="color:${tier.color}">${esc(tier.icon)} ${esc(tier.name)}</div>
            </div>
            <div class="ml-score-bar-wrap">
              <div class="ml-score-bar" style="width:${pct}%;background:${tier.color}"></div>
            </div>
          </div>
          <div class="ml-hint">Next: <strong style="color:${nextTier.color}">${esc(nextTier.name)}</strong> @ ${nextTier.minScore} pts</div>
          <div class="ml-hint" style="margin-top:0.3rem">On-time repay: <strong style="color:#4ade80">+50</strong> · Late: <strong style="color:#f87171">-100</strong> · Default: <strong style="color:#f87171">-200 + wipe cash</strong></div>
        </div>

        ${loan?.active ? `
        <div class="ml-section ml-active-loan">
          <div class="ml-section-head" style="color:#f87171">⚠️ Active Loan</div>
          <div class="ml-loan-grid">
            <div class="ml-lstat"><div class="ml-ls-l">Borrowed</div><div class="ml-ls-v">$${fmt(loan.principal)}</div></div>
            <div class="ml-lstat"><div class="ml-ls-l">Interest (${(loan.rate*100).toFixed(0)}%)</div><div class="ml-ls-v" style="color:#f87171">+$${fmt(loan.principal*loan.rate)}</div></div>
            <div class="ml-lstat"><div class="ml-ls-l">Total Due</div><div class="ml-ls-v" style="color:#f87171;font-size:1rem">$${fmt(loan.totalDue)}</div></div>
            <div class="ml-lstat"><div class="ml-ls-l">Time Left</div><div class="bank-loan-countdown ml-ls-v" style="color:${tl<60000?'#f87171':'var(--text1)'}">${tlM}m ${tlS}s</div></div>
          </div>
          <div class="ml-bar-wrap"><div class="bank-loan-bar" style="width:${Math.min(100,(tl/(loan.termMs||1))*100)}%;background:${tl<60000?'#f87171':'var(--accent)'}"></div></div>
          <button class="ml-btn ${s.balance >= loan.totalDue ? 'ml-btn-green' : 'ml-btn-disabled'}" id="ml-repay-${iid}" ${s.balance < loan.totalDue ? 'disabled' : ''}>
            ${s.balance >= loan.totalDue ? `\u{1F4B0} Repay $${fmt(loan.totalDue)}` : '\u274C Insufficient funds to repay'}
          </button>
          <div class="ml-hint" style="color:#f87171;margin-top:0.4rem">\u26A0\uFE0F Defaulting wipes your entire cash balance.</div>
        </div>` : `
        <div class="ml-section">
          <div class="ml-section-head">\u{1F4B5} Apply for a Loan</div>
          <div class="ml-loan-offer">
            <div class="ml-offer-row"><span class="ml-offer-label">Amount</span><span class="ml-offer-val" style="color:#4ade80">$${loanAmt.toLocaleString()}</span></div>
            <div class="ml-offer-row"><span class="ml-offer-label">Interest</span><span class="ml-offer-val">${(tier.rate*100).toFixed(0)}% → Total $${fmt(loanTotal)}</span></div>
            <div class="ml-offer-row"><span class="ml-offer-label">Term</span><span class="ml-offer-val">${termMins} minutes</span></div>
          </div>
          <button class="ml-btn ml-btn-accent" id="ml-loan-btn-${iid}">Request $${loanAmt.toLocaleString()} Loan</button>
        </div>`}

        <div class="ml-section">
          <div class="ml-section-head">\u{1F3C6} Credit Tier Ladder</div>
          <div class="ml-tier-list">
            ${CREDIT_TIERS.map(t => `
              <div class="ml-tier-row ${(s.creditScore||0) >= t.minScore ? 'unlocked' : 'locked'}">
                <span>${t.icon}</span>
                <span class="ml-tier-name" style="color:${t.color}">${t.name}</span>
                <span class="ml-tier-amt" style="color:${t.color}">$${t.loanAmount.toLocaleString()}</span>
                <span class="ml-tier-detail">${(t.rate*100).toFixed(0)}% · ${Math.round(t.termMs/60000)}min · ${t.minScore}+pts</span>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
    };

    // ── Hackable bank panel ───────────────────────────────────────────────────
    const renderHackableBank = (b) => {
      const bd    = multiBankData[b.id] || { myDeposit:0, totalDeposits:0, topDepositors:[] };
      const cdMs  = hackCooldowns[b.id] ? Math.max(0, (hackCooldowns[b.id] + b.cdMs) - Date.now()) : 0;
      const cdSec = Math.ceil(cdMs / 1000);
      const hackable = (bd.totalDeposits || 0) * 0.02;
      const top = (bd.topDepositors || []).slice(0, 8);

      return `<div class="ml-hackable" style="--bcolor:${b.color}">
        <div class="ml-hack-header">
          <span class="ml-hack-icon">${b.icon}</span>
          <div class="ml-hack-title-block">
            <div class="ml-hack-name">${b.name}</div>
            <div class="ml-hack-tagline">${b.tagline}</div>
          </div>
          <div class="ml-hack-sec">${'🔒'.repeat(b.security)}${'🔓'.repeat(3 - b.security)}</div>
        </div>

        <div class="ml-stats-row">
          <div class="ml-stat-card">
            <div class="ml-stat-label">Your Deposit</div>
            <div class="ml-stat-val" style="color:${b.color}">$${fmt(bd.myDeposit || 0)}</div>
            <div class="ml-stat-sub">+${b.interestRate}%/min</div>
          </div>
          <div class="ml-stat-card">
            <div class="ml-stat-label">Total Deposits</div>
            <div class="ml-stat-val">$${fmt(bd.totalDeposits || 0)}</div>
            <div class="ml-stat-sub">${top.length} depositors</div>
          </div>
          <div class="ml-stat-card">
            <div class="ml-stat-label">Hackable (~2%)</div>
            <div class="ml-stat-val" style="color:#f87171">$${fmt(hackable)}</div>
            <div class="ml-stat-sub">from all accounts</div>
          </div>
        </div>

        <div class="ml-two-col">
          <div class="ml-panel">
            <div class="ml-panel-title">\u{1F4B0} Deposit / Withdraw</div>

            <div class="ml-field-group">
              <label class="ml-field-label">Deposit amount</label>
              <div class="ml-field-row">
                <input type="number" id="ml-dep-${iid}" class="ml-input" placeholder="0.00" min="1"/>
                <button class="ml-btn ml-btn-color" id="ml-dep-btn-${iid}" style="--bc:${b.color}">Deposit</button>
              </div>
              <div class="ml-quick-row">
                ${[100,500,1000,5000].map(v => `<span class="ml-qbtn dep" data-val="${v}">$${v >= 1000 ? (v/1000)+'K' : v}</span>`).join('')}
                <span class="ml-qbtn dep" data-val="all">All</span>
              </div>
            </div>

            <div class="ml-field-group" style="margin-top:0.75rem">
              <label class="ml-field-label">Withdraw <span style="color:var(--text3);font-size:0.6rem">(${b.fee}% fee)</span></label>
              <div class="ml-field-row">
                <input type="number" id="ml-wdw-${iid}" class="ml-input" placeholder="0.00" min="1"/>
                <button class="ml-btn ml-btn-dark" id="ml-wdw-btn-${iid}">Withdraw</button>
              </div>
              <div class="ml-quick-row">
                ${[100,500,1000].map(v => `<span class="ml-qbtn wdw" data-val="${v}">$${v >= 1000 ? (v/1000)+'K' : v}</span>`).join('')}
                <span class="ml-qbtn wdw" data-val="all">All</span>
              </div>
            </div>

            <div class="ml-msg" id="ml-msg-${iid}"></div>

            <div class="ml-lb-title">\u{1F3C6} Top Depositors</div>
            <div class="ml-lb-list">
              ${top.length === 0
                ? '<div class="ml-lb-empty">No depositors yet</div>'
                : top.map((dep, i) => `
                  <div class="ml-lb-row">
                    <span class="ml-lb-rank">${['🥇','🥈','🥉'][i] || (i+1) + '.'}</span>
                    <span class="ml-lb-name" style="color:${dep.color||'var(--text)'}">${esc(dep.username)}</span>
                    <span class="ml-lb-amt" style="color:${b.color}">$${fmt(dep.deposit)}</span>
                    <span class="ml-lb-pct">${bd.totalDeposits > 0 ? ((dep.deposit / bd.totalDeposits) * 100).toFixed(1) : 0}%</span>
                  </div>`).join('')}
            </div>
          </div>

          <div class="ml-panel ml-hack-panel">
            <div class="ml-panel-title">\u{1F480} Hack This Bank</div>
            <div class="ml-hack-info-grid">
              <div class="ml-hig-row"><span>Security</span><span>${'🔒'.repeat(b.security)} (${['Low','Medium','High'][b.security-1]})</span></div>
              <div class="ml-hig-row"><span>Minigame</span><span>${b.hackDifficulty===1?'1 round, 6 chars, 10s':b.hackDifficulty===2?'2 rounds, 9 chars, 9s':'3 rounds, 13 chars, 8s'}</span></div>
              <div class="ml-hig-row"><span>Loot</span><span style="color:#f87171">~$${fmt(hackable)}</span></div>
              <div class="ml-hig-row"><span>Cooldown</span><span>${b.cdMs/1000}s after attempt</span></div>
              <div class="ml-hig-row"><span>Success</span><span>${b.hackDifficulty===1?'~85%':b.hackDifficulty===2?'~65%':'~40%'}</span></div>
            </div>
            <div class="ml-hack-rules">
              <div>💸 Steals 2% from each depositor</div>
              <div>⏳ Cooldown applies win or lose</div>
              <div>🔄 Higher security = harder minigame</div>
            </div>
            ${cdSec > 0
              ? `<div class="ml-cd-box">⏳ Cooldown: <span class="ml-cd-num" id="ml-cd-${b.id}-${iid}">${cdSec}s</span></div>`
              : `<button class="ml-hack-btn" id="ml-hack-btn-${iid}" ${bd.totalDeposits < 1 ? 'disabled' : ''}>💀 Initiate Hack</button>
                 ${bd.totalDeposits < 1 ? '<div class="ml-hint" style="text-align:center;margin-top:0.5rem">Nothing to steal yet</div>' : ''}`
            }
          </div>
        </div>
      </div>`;
    };

    // ── Render shell ─────────────────────────────────────────────────────────
    const render = () => {
      const totalMyDeps = Object.values(multiBankData).reduce((s, d) => s + (d.myDeposit || 0), 0);
      wrap.innerHTML = `<div class="mbl-layout">
        <div class="mbl-sidebar">
          <div class="mbl-sidebar-top">
            <div class="mbl-title">🏛️ NormBanks</div>
            <div class="mbl-cash-card">
              <div class="mbl-cash-label">Your Cash</div>
              <div class="mbl-cash-val" id="mbl-cash-${iid}">$${fmt(bankState.balance)}</div>
              ${totalMyDeps > 0 ? `<div class="mbl-cash-sub">Deposited: $${fmt(totalMyDeps)}</div>` : ''}
            </div>
          </div>
          <div class="mbl-nav">
            <div class="mbl-nav-item ${activeBank==='loans'?'active':''}" data-bank="loans">
              <span class="mbl-nav-icon">📋</span>
              <div class="mbl-nav-info">
                <div class="mbl-nav-name">Loans &amp; Credit</div>
                <div class="mbl-nav-sub">Score: ${bankState.creditScore||0} · ${getCreditTier(bankState.creditScore||0).name}</div>
              </div>
              ${bankState.loan?.active ? '<span class="mbl-nav-badge">LOAN</span>' : ''}
            </div>
            ${Object.values(HACKABLE_BANKS).map(b => `
              <div class="mbl-nav-item ${activeBank===b.id?'active':''}" data-bank="${b.id}" style="${activeBank===b.id?'--btc:'+b.color:''}">
                <span class="mbl-nav-icon">${b.icon}</span>
                <div class="mbl-nav-info">
                  <div class="mbl-nav-name">${b.name}</div>
                  <div class="mbl-nav-sub">${b.interestRate}%/min · ${b.fee}% fee</div>
                </div>
                <span class="mbl-nav-dep" style="color:${b.color}">$${fmt(multiBankData[b.id]?.myDeposit||0)}</span>
              </div>`).join('')}
          </div>
          <div class="mbl-global">
            <div class="mbl-global-title">Global Deposits</div>
            ${Object.values(HACKABLE_BANKS).map(b => `
              <div class="mbl-global-row">
                <span>${b.icon} ${b.name.split(' ')[0]}</span>
                <span style="color:${b.color};font-family:var(--font-mono)">$${fmt(multiBankData[b.id]?.totalDeposits||0)}</span>
              </div>`).join('')}
          </div>
        </div>
        <div class="mbl-main" id="mbl-main-${iid}">
          ${activeBank === 'loans' ? renderLoans() : renderHackableBank(HACKABLE_BANKS[activeBank])}
        </div>
      </div>`;

      wrap.querySelectorAll('.mbl-nav-item').forEach(item => item.addEventListener('click', () => {
        activeBank = item.dataset.bank;
        wrap.querySelectorAll('.mbl-nav-item').forEach(i => {
          i.classList.toggle('active', i.dataset.bank === activeBank);
          const hb = HACKABLE_BANKS[i.dataset.bank];
          if (i.dataset.bank === activeBank && hb) i.style.setProperty('--btc', hb.color);
          else i.style.removeProperty('--btc');
        });
        const main = wrap.querySelector(`#mbl-main-${iid}`);
        if (main) { main.innerHTML = activeBank === 'loans' ? renderLoans() : renderHackableBank(HACKABLE_BANKS[activeBank]); bindMainEvents(); }
      }));
      bindMainEvents();
      if (bankState.loan?.active) startLoanTimer();
    };

    const rerender = () => {
      // Always sync balance from Economy so deposit/withdraw checks are accurate
      if (typeof Economy !== 'undefined') bankState.balance = Economy.state.balance;
      const cashEl = wrap.querySelector(`#mbl-cash-${iid}`);
      if (cashEl) cashEl.textContent = '$' + fmt(bankState.balance);
      wrap.querySelectorAll('.mbl-nav-item').forEach(item => {
        const dep = item.querySelector('.mbl-nav-dep');
        if (!dep) return;
        const b = HACKABLE_BANKS[item.dataset.bank];
        if (b) dep.textContent = '$' + fmt(multiBankData[b.id]?.myDeposit || 0);
      });
      const sub = wrap.querySelector('.mbl-nav-item[data-bank="loans"] .mbl-nav-sub');
      if (sub) sub.textContent = `Score: ${bankState.creditScore||0} · ${getCreditTier(bankState.creditScore||0).name}`;
      const main = wrap.querySelector(`#mbl-main-${iid}`);
      if (main) { main.innerHTML = activeBank === 'loans' ? renderLoans() : renderHackableBank(HACKABLE_BANKS[activeBank]); bindMainEvents(); }
      if (bankState.loan?.active) startLoanTimer();
    };

    const bindMainEvents = () => {
      const main = wrap.querySelector(`#mbl-main-${iid}`);
      if (!main) return;

      if (activeBank === 'loans') {
        main.querySelector(`#ml-loan-btn-${iid}`)?.addEventListener('click', () => {
          const tier = getCreditTier(bankState.creditScore || 0);
          const amt  = tier.loanAmount;
          if (!confirm(`Borrow $${amt.toLocaleString()} (${(tier.rate*100).toFixed(0)}% interest)?\n\nTotal due: $${fmt(amt + amt * tier.rate)}\nTerm: ${Math.round(tier.termMs/60000)} minutes\n\nMissing the deadline wipes your entire cash balance.`)) return;
          if (typeof Network !== 'undefined' && Network.isConnected()) Network.send({ type:'bank:loan:request', amount:amt });
          else { bankState.loan = { active:true, principal:amt, rate:tier.rate, termMs:tier.termMs, borrowedAt:Date.now(), dueAt:Date.now()+tier.termMs, totalDue:parseFloat((amt+amt*tier.rate).toFixed(2)) }; bankState.balance += amt; if(typeof Economy!=='undefined'){Economy.state.balance+=amt;Economy.save();Economy.updateWalletDisplay();} rerender(); }
        });
        main.querySelector(`#ml-repay-${iid}`)?.addEventListener('click', () => {
          const loan = bankState.loan;
          if (!loan || bankState.balance < loan.totalDue) return;
          if (typeof Network !== 'undefined' && Network.isConnected()) Network.send({ type:'bank:loan:repay' });
          else { bankState.balance -= loan.totalDue; bankState.loan = null; bankState.creditScore = (bankState.creditScore||0)+50; if(typeof Economy!=='undefined'){Economy.state.balance-=loan.totalDue;Economy.save();Economy.updateWalletDisplay();} rerender(); }
        });
        if (bankState.loan?.active) startLoanTimer();
        return;
      }

      const b  = HACKABLE_BANKS[activeBank];
      const bd = multiBankData[activeBank] || {};

      main.querySelectorAll('.ml-qbtn.dep').forEach(btn => btn.addEventListener('click', () => {
        const inp = main.querySelector(`#ml-dep-${iid}`);
        if (inp) {
          const liveBal = (typeof Economy !== 'undefined') ? Economy.state.balance : bankState.balance;
          inp.value = btn.dataset.val === 'all' ? Math.floor(liveBal) : btn.dataset.val;
        }
      }));
      main.querySelectorAll('.ml-qbtn.wdw').forEach(btn => btn.addEventListener('click', () => {
        const inp = main.querySelector(`#ml-wdw-${iid}`);
        if (inp) {
          const liveDep = (multiBankData[activeBank] || {}).myDeposit || 0;
          inp.value = btn.dataset.val === 'all' ? Math.floor(liveDep) : btn.dataset.val;
        }
      }));

      main.querySelector(`#ml-dep-btn-${iid}`)?.addEventListener('click', () => {
        const depInp = main.querySelector(`#ml-dep-${iid}`);
        const amt   = parseFloat(depInp?.value) || 0;
        const msgEl = main.querySelector(`#ml-msg-${iid}`);
        // Always read live balance — bankState.balance may lag behind Economy
        const liveBal = (typeof Economy !== 'undefined') ? Economy.state.balance : bankState.balance;
        if (amt <= 0) { setMsg(msgEl, 'Invalid amount', '#f87171'); return; }
        if (amt > liveBal) { setMsg(msgEl, `Insufficient cash ($${fmt(liveBal)} available)`, '#f87171'); return; }
        if (typeof Network !== 'undefined' && Network.isConnected()) {
          Network.send({ type:'multibank:deposit', bankId:b.id, amount:amt });
          setMsg(msgEl, 'Depositing...', 'var(--text3)');
          if (depInp) depInp.value = '';
        } else setMsg(msgEl, 'Not connected to server', '#f87171');
      });

      main.querySelector(`#ml-wdw-btn-${iid}`)?.addEventListener('click', () => {
        const wdwInp = main.querySelector(`#ml-wdw-${iid}`);
        const amt   = parseFloat(wdwInp?.value) || 0;
        const msgEl = main.querySelector(`#ml-msg-${iid}`);
        // Re-read live deposit amount (bd captured at render time may be stale)
        const liveDep = (multiBankData[activeBank] || {}).myDeposit || 0;
        if (amt <= 0) { setMsg(msgEl, 'Invalid amount', '#f87171'); return; }
        if (amt > liveDep) { setMsg(msgEl, `Only $${fmt(liveDep)} deposited`, '#f87171'); return; }
        if (typeof Network !== 'undefined' && Network.isConnected()) {
          Network.send({ type:'multibank:withdraw', bankId:b.id, amount:amt });
          setMsg(msgEl, 'Withdrawing...', 'var(--text3)');
          if (wdwInp) wdwInp.value = '';
        } else setMsg(msgEl, 'Not connected to server', '#f87171');
      });

      main.querySelector(`#ml-hack-btn-${iid}`)?.addEventListener('click', () => {
        const cdMs2 = hackCooldowns[b.id] ? Math.max(0, (hackCooldowns[b.id] + b.cdMs) - Date.now()) : 0;
        if (cdMs2 > 0) { showToast(`⏳ Cooldown: ${Math.ceil(cdMs2 / 1000)}s`, '#f59e0b'); return; }
        if ((bd.totalDeposits || 0) < 1) { showToast('Nothing to steal', '#f87171'); return; }
        launchHackMinigame(b,
          () => { hackCooldowns[b.id] = Date.now(); if (typeof Network!=='undefined'&&Network.isConnected()) Network.send({ type:'multibank:hack', bankId:b.id, success:true }); showToast('Hack submitted...', '#4ade80'); rerender(); },
          () => { hackCooldowns[b.id] = Date.now(); if (typeof Network!=='undefined'&&Network.isConnected()) Network.send({ type:'multibank:hack', bankId:b.id, success:false }); showToast('Hack failed', '#f87171'); rerender(); }
        );
      });

      const cdEl = main.querySelector(`#ml-cd-${b.id}-${iid}`);
      if (cdEl) {
        const tickCd = () => {
          if (!cdEl.isConnected) return;
          const ms = hackCooldowns[b.id] ? Math.max(0, (hackCooldowns[b.id] + b.cdMs) - Date.now()) : 0;
          if (ms <= 0) { rerender(); return; }
          cdEl.textContent = Math.ceil(ms / 1000) + 's'; setTimeout(tickCd, 1000);
        };
        setTimeout(tickCd, 1000);
      }
    };

    // ── Hack minigame ────────────────────────────────────────────────────────
    const launchHackMinigame = (bank, onWin, onLose) => {
      const diff    = bank.hackDifficulty;
      const seqLen  = diff === 1 ? 6 : diff === 2 ? 9 : 13;
      const timeMs  = diff === 1 ? 10000 : diff === 2 ? 9000 : 8000;
      const rounds  = diff === 1 ? 1 : diff === 2 ? 2 : 3;
      const CHARS   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const genSeq  = () => Array.from({ length:seqLen }, () => CHARS[Math.floor(Math.random()*CHARS.length)]).join('');
      let roundTargets = Array.from({ length:rounds }, genSeq);
      let curRound = 0, input = '', timeLeft = timeMs, gameOver = false;

      const ov = document.createElement('div');
      ov.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;z-index:10000;font-family:var(--font-mono);backdrop-filter:blur(4px);`;
      ov.innerHTML = `<div style="background:#08090f;border:2px solid ${bank.color};border-radius:12px;padding:1.75rem;width:480px;max-width:92vw;box-shadow:0 0 50px ${bank.color}55;position:relative;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
          <span style="color:${bank.color};font-size:0.85rem;font-weight:700;letter-spacing:2px;">${bank.icon} HACKING: ${bank.name.toUpperCase()}</span>
          <span style="font-size:0.7rem;color:var(--text3)">${'🔒'.repeat(bank.security)}</span>
        </div>
        <div style="height:5px;background:#1e2433;border-radius:3px;margin-bottom:1rem;overflow:hidden;"><div id="hmb-${iid}" style="height:100%;width:100%;background:${bank.color};transition:width 0.1s linear;border-radius:3px;"></div></div>
        <div style="font-size:0.65rem;color:var(--text3);text-align:right;margin-bottom:0.7rem;">Round <span id="hmr-${iid}">1</span> / ${rounds}</div>
        <div style="font-size:0.62rem;color:var(--text3);letter-spacing:3px;margin-bottom:0.5rem;">TYPE THIS SEQUENCE:</div>
        <div id="hmt-${iid}" style="font-size:1.6rem;font-weight:700;letter-spacing:.22em;color:${bank.color};text-align:center;margin-bottom:.8rem;text-shadow:0 0 20px ${bank.color}">${roundTargets[0]}</div>
        <div id="hmi-${iid}" style="font-size:1.4rem;font-weight:700;letter-spacing:.22em;color:#4ade80;text-align:center;background:#0d1117;border:1px solid #1e2433;border-radius:7px;padding:0.65rem;margin-bottom:.75rem;min-height:3rem;">${'_'.repeat(seqLen)}</div>
        <div id="hms-${iid}" style="font-size:.7rem;color:var(--text2);text-align:center;margin-bottom:.5rem;min-height:1.5em;">Type the sequence to breach the bank...</div>
        <div style="font-size:.62rem;color:var(--text3);text-align:center;">${timeMs/1000}s · ${rounds} round${rounds>1?'s':''} · ${seqLen} chars each</div>
        <button id="hmc-${iid}" style="position:absolute;top:.7rem;right:.7rem;background:none;border:1px solid #333;color:var(--text3);border-radius:4px;padding:.2rem .5rem;cursor:pointer;font-size:.65rem;">✕</button>
      </div>`;
      document.body.appendChild(ov); ov.setAttribute('tabindex','0'); ov.focus();

      const updDisp = () => { const el = ov.querySelector(`#hmi-${iid}`); if (el) el.textContent = (input||'').padEnd(seqLen,'_').slice(0,seqLen); };
      const finish = (success) => {
        if (gameOver) return; gameOver = true; clearInterval(ti); document.removeEventListener('keydown', onKey);
        const sEl = ov.querySelector(`#hms-${iid}`);
        if (sEl) { sEl.textContent = success ? 'BREACH SUCCESSFUL! Extracting funds...' : 'INTRUSION DETECTED! Access denied.'; sEl.style.color = success ? '#4ade80' : '#f87171'; }
        setTimeout(() => { ov.remove(); success ? onWin() : onLose(); }, 1400);
      };
      const advance = () => {
        curRound++;
        if (curRound >= rounds) { finish(true); return; }
        input = ''; timeLeft = timeMs;
        const rEl = ov.querySelector(`#hmr-${iid}`), tEl = ov.querySelector(`#hmt-${iid}`), sEl = ov.querySelector(`#hms-${iid}`);
        if (rEl) rEl.textContent = curRound + 1; if (tEl) tEl.textContent = roundTargets[curRound];
        if (sEl) { sEl.textContent = `Round ${curRound} done! Keep going!`; sEl.style.color = '#4ade80'; }
        updDisp(); setTimeout(() => { if (sEl && !gameOver) { sEl.textContent = 'Type the next sequence...'; sEl.style.color = 'var(--text2)'; } }, 900);
      };
      const ti = setInterval(() => {
        if (gameOver) { clearInterval(ti); return; }
        timeLeft -= 100;
        const bar = ov.querySelector(`#hmb-${iid}`);
        if (bar) { bar.style.width = (timeLeft / timeMs * 100) + '%'; if (timeLeft <= 3000) bar.style.background = '#f87171'; }
        if (timeLeft <= 0) { clearInterval(ti); finish(false); }
      }, 100);
      const onKey = (e) => {
        if (gameOver) return;
        if (e.key === 'Escape') { finish(false); return; }
        const k = e.key.toUpperCase();
        if (!CHARS.includes(k) || input.length >= seqLen) return;
        input += k; updDisp();
        if (input === roundTargets[curRound]) { advance(); }
        else if (input.length >= seqLen) {
          const iEl = ov.querySelector(`#hmi-${iid}`);
          if (iEl) { iEl.style.color = '#f87171'; setTimeout(() => { if (iEl) iEl.style.color = '#4ade80'; }, 350); }
          input = ''; updDisp();
          if (diff >= 2) { roundTargets[curRound] = genSeq(); const tEl = ov.querySelector(`#hmt-${iid}`); if (tEl) tEl.textContent = roundTargets[curRound]; }
        }
      };
      document.addEventListener('keydown', onKey);
      ov.querySelector(`#hmc-${iid}`)?.addEventListener('click', () => finish(false));
    };

    if (typeof Economy !== 'undefined') bankState.balance = Economy.state.balance;

    // ── Network wiring ───────────────────────────────────────────────────────
    if (typeof Network !== 'undefined') {
      const onBU  = (d) => { bankState = { ...bankState, ...d }; if (d.balance !== undefined && typeof Economy !== 'undefined') { Economy.state.balance = d.balance; Economy.save(); Economy.updateWalletDisplay(); } rerender(); };
      const onLA  = (d) => { bankState.loan = d.loan; bankState.balance = d.newBalance; if(typeof Economy!=='undefined'){Economy.state.balance=d.newBalance;Economy.save();Economy.updateWalletDisplay();} if(typeof OS!=='undefined')OS.notify('📋','Loan Approved',`$${fmt(d.loan.principal)} received!`); rerender(); };
      const onLR  = (d) => { bankState.loan = null; bankState.creditScore = d.creditScore; bankState.balance = d.newBalance; if(typeof Economy!=='undefined'){Economy.state.balance=d.newBalance;Economy.save();Economy.updateWalletDisplay();} if(typeof OS!=='undefined')OS.notify('📋','Loan Repaid',d.onTime?'On time! +50':'Late! -100'); rerender(); };
      const onLD  = (d) => { bankState.loan = null; bankState.balance = 0; bankState.creditScore = d.creditScore; if(typeof Economy!=='undefined'){Economy.state.balance=0;Economy.save();Economy.updateWalletDisplay();} if(typeof OS!=='undefined')OS.notify('💀','LOAN DEFAULT','Cash wiped!'); rerender(); };
      const onBE  = (d) => { if(typeof OS!=='undefined')OS.notify('📋','Bank Error',d.message||'Error'); };
      const onMbD = (msg) => { if(!wrap.isConnected)return; if(msg.banks)multiBankData={...multiBankData,...msg.banks}; rerender(); };
      const onMbU = (msg) => {
        if (!wrap.isConnected) return;
        const prevData = multiBankData[activeBank] ? { ...multiBankData[activeBank] } : null;
        if (msg.banks) multiBankData = { ...multiBankData, ...msg.banks };
        if (msg.balance !== undefined) { bankState.balance = msg.balance; if(typeof Economy!=='undefined'){Economy.state.balance=msg.balance;Economy.save();Economy.updateWalletDisplay();} }
        // Show success toast for deposit/withdraw
        if (prevData && msg.banks && msg.banks[activeBank]) {
          const newDep = msg.banks[activeBank].myDeposit || 0;
          const diff = newDep - (prevData.myDeposit || 0);
          const b2 = HACKABLE_BANKS[activeBank];
          if (diff > 0) showToast(`${b2?.icon||'🏦'} Deposited $${fmt(diff)}`, b2?.color || '#4ade80');
          else if (diff < 0) showToast(`${b2?.icon||'🏦'} Withdrew $${fmt(-diff)} (fee deducted)`, b2?.color || '#4ade80');
        }
        rerender();
      };
      const onMbI = (msg) => { if(!wrap.isConnected)return; if(typeof OS!=='undefined')OS.notify(HACKABLE_BANKS[msg.bankId]?.icon||'🏦',msg.bankName,`+$${(msg.amount||0).toFixed(2)} interest!`); };
      const onMbH = (msg) => {
        if (!wrap.isConnected) return;
        showToast(msg.success ? `Hacked ${msg.bankName}! Stole $${fmt(msg.stolen||0)}` : (msg.reason||'Hack failed'), msg.success ? '#4ade80' : '#f87171');
        if (msg.newBalance !== undefined) { bankState.balance = msg.newBalance; if(typeof Economy!=='undefined'){Economy.state.balance=msg.newBalance;Economy.save();Economy.updateWalletDisplay();} }
        if (msg.success) Network.send({ type:'multibank:get' });
      };
      const onMbHacked = (msg) => { if(!wrap.isConnected)return; if(typeof OS!=='undefined')OS.notify('💀','HACKED!',`${msg.by} stole $${(msg.lost||0).toFixed(2)} from ${msg.bankName}!`); };
      const onMbErr = (msg) => {
        if (!wrap.isConnected) return;
        const msgEl = wrap.querySelector(`#ml-msg-${iid}`);
        if (msgEl) { msgEl.textContent = msg.message || 'Error'; msgEl.style.color = '#f87171'; }
        else showToast(msg.message || 'Bank error', '#f87171');
      };

      Network.on('bank:update',           onBU);
      Network.on('bank:loan:approved',    onLA);
      Network.on('bank:loan:repaid',      onLR);
      Network.on('bank:loan:defaulted',   onLD);
      Network.on('bank:error',            onBE);
      Network.on('multibank:data',        onMbD);
      Network.on('multibank:update',      onMbU);
      Network.on('multibank:interest',    onMbI);
      Network.on('multibank:hack:result', onMbH);
      Network.on('multibank:hacked',      onMbHacked);
      Network.on('multibank:error',         onMbErr);

      Network.send({ type:'bank:get' });
      Network.send({ type:'multibank:get' });

      wrap._cleanup = () => {
        Network.off('bank:update',           onBU);
        Network.off('bank:loan:approved',    onLA);
        Network.off('bank:loan:repaid',      onLR);
        Network.off('bank:loan:defaulted',   onLD);
        Network.off('bank:error',            onBE);
        Network.off('multibank:data',        onMbD);
        Network.off('multibank:update',      onMbU);
        Network.off('multibank:interest',    onMbI);
        Network.off('multibank:hack:result', onMbH);
        Network.off('multibank:hacked',      onMbHacked);
        Network.off('multibank:error',         onMbErr);
        if (loanTimer) clearInterval(loanTimer);
      };
    }

    // ── Inject styles ────────────────────────────────────────────────────────
    if (!document.getElementById('mbl-styles')) {
      const st = document.createElement('style'); st.id = 'mbl-styles';
      st.textContent = `.bank-wrap{height:100%;overflow:hidden;background:var(--bg1)}.mbl-layout{display:flex;height:100%;overflow:hidden}.mbl-sidebar{width:222px;flex-shrink:0;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}.mbl-sidebar-top{padding:.75rem .9rem 0;flex-shrink:0}.mbl-title{font-size:.82rem;font-weight:700;margin-bottom:.6rem;color:var(--text1)}.mbl-cash-card{background:var(--bg1);border:1px solid var(--border);border-radius:7px;padding:.6rem .8rem;margin-bottom:.7rem}.mbl-cash-label{font-size:.6rem;color:var(--text3);margin-bottom:2px}.mbl-cash-val{font-size:1.15rem;font-weight:700;color:#4ade80;font-family:var(--font-mono)}.mbl-cash-sub{font-size:.58rem;color:var(--text3);margin-top:2px}.mbl-nav{flex:1;overflow-y:auto;padding:.25rem .45rem;display:flex;flex-direction:column;gap:.2rem}.mbl-nav-item{display:flex;align-items:center;gap:.5rem;padding:.55rem .6rem;border-radius:6px;cursor:pointer;border:1px solid transparent;transition:background .12s,border-color .12s}.mbl-nav-item:hover{background:var(--bg3)}.mbl-nav-item.active{background:var(--bg3);border-color:color-mix(in srgb,var(--btc,var(--accent)) 40%,transparent)}.mbl-nav-icon{font-size:1.2rem;flex-shrink:0}.mbl-nav-info{flex:1;min-width:0}.mbl-nav-name{font-size:.72rem;font-weight:600;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mbl-nav-sub{font-size:.57rem;color:var(--text3);margin-top:1px}.mbl-nav-dep{font-size:.65rem;font-family:var(--font-mono);flex-shrink:0}.mbl-nav-badge{font-size:.5rem;background:#f87171;color:#000;padding:.1rem .3rem;border-radius:3px;font-weight:700;flex-shrink:0}.mbl-global{padding:.55rem .9rem;border-top:1px solid var(--border);flex-shrink:0}.mbl-global-title{font-size:.57rem;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.3rem}.mbl-global-row{display:flex;justify-content:space-between;font-size:.62rem;color:var(--text2);padding:.1rem 0}.mbl-main{flex:1;overflow-y:auto;min-width:0}.ml-loans{padding:1rem;display:flex;flex-direction:column;gap:.85rem;max-width:580px;margin:0 auto}.ml-section{background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:1rem}.ml-active-loan{border-color:#f8717166}.ml-section-head{font-size:.82rem;font-weight:700;margin-bottom:.75rem}.ml-credit-row{display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem}.ml-score-val{font-size:1.5rem;font-weight:800;font-family:var(--font-mono);line-height:1}.ml-score-tier{font-size:.72rem;font-weight:600;margin-top:2px}.ml-score-bar-wrap{flex:1;background:var(--bg1);border-radius:3px;height:6px;overflow:hidden}.ml-score-bar{height:100%;border-radius:3px;transition:width .4s}.ml-hint{font-size:.65rem;color:var(--text3);line-height:1.5}.ml-loan-grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.65rem}.ml-lstat{background:var(--bg1);border:1px solid var(--border);border-radius:6px;padding:.55rem .7rem}.ml-ls-l{font-size:.58rem;color:var(--text3);margin-bottom:2px}.ml-ls-v{font-size:.88rem;font-weight:700;font-family:var(--font-mono)}.ml-bar-wrap{background:var(--bg1);border-radius:3px;height:5px;overflow:hidden;margin-bottom:.65rem}.bank-loan-bar{height:100%;border-radius:3px;transition:width 1s linear}.ml-loan-offer{background:var(--bg1);border:1px solid var(--border);border-radius:7px;padding:.75rem;margin-bottom:.65rem;display:flex;flex-direction:column;gap:.35rem}.ml-offer-row{display:flex;justify-content:space-between;align-items:center;font-size:.72rem}.ml-offer-label{color:var(--text3)}.ml-offer-val{font-family:var(--font-mono);font-weight:600}.ml-btn{border:none;border-radius:6px;padding:.55rem 1rem;font-size:.75rem;cursor:pointer;font-weight:700;transition:opacity .12s;width:100%}.ml-btn:hover:not([disabled]){opacity:.85}.ml-btn[disabled]{opacity:.4;cursor:not-allowed}.ml-btn-green{background:#4ade80;color:#000}.ml-btn-accent{background:var(--accent);color:#fff}.ml-btn-dark{background:#374151;color:#fff}.ml-btn-color{background:var(--bc,var(--accent));color:#fff}.ml-btn-disabled{background:var(--bg3);color:var(--text3)}.ml-tier-list{display:flex;flex-direction:column;gap:.3rem}.ml-tier-row{display:flex;align-items:center;gap:.55rem;padding:.45rem .65rem;border-radius:5px;font-size:.68rem;background:var(--bg1);border:1px solid var(--border)}.ml-tier-row.unlocked{border-color:rgba(74,222,128,.25)}.ml-tier-row.locked{opacity:.38}.ml-tier-name{font-weight:700;min-width:62px}.ml-tier-amt{font-family:var(--font-mono);font-weight:700;min-width:72px}.ml-tier-detail{color:var(--text3);font-size:.6rem;margin-left:auto}.ml-hackable{padding:1rem;display:flex;flex-direction:column;gap:.85rem}.ml-hack-header{display:flex;align-items:center;gap:.75rem;padding-bottom:.85rem;border-bottom:2px solid var(--bcolor,var(--accent))}.ml-hack-icon{font-size:2.2rem;flex-shrink:0}.ml-hack-title-block{flex:1}.ml-hack-name{font-size:1rem;font-weight:700}.ml-hack-tagline{font-size:.62rem;color:var(--text3);font-style:italic;margin-top:2px}.ml-hack-sec{font-size:.9rem;flex-shrink:0}.ml-stats-row{display:flex;gap:.6rem}.ml-stat-card{flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:.65rem;text-align:center}.ml-stat-label{font-size:.58rem;color:var(--text3);margin-bottom:3px}.ml-stat-val{font-size:.95rem;font-weight:700;font-family:var(--font-mono)}.ml-stat-sub{font-size:.58rem;color:var(--text3);margin-top:3px}.ml-two-col{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}.ml-panel{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:.85rem;display:flex;flex-direction:column;gap:.4rem;min-width:0}.ml-panel-title{font-size:.75rem;font-weight:700;margin-bottom:.35rem}.ml-field-group{display:flex;flex-direction:column;gap:.28rem}.ml-field-label{font-size:.6rem;color:var(--text3)}.ml-field-row{display:flex;gap:.35rem}.ml-input{flex:1;min-width:0;background:var(--bg1);border:1px solid var(--border);border-radius:5px;color:var(--text1);font-size:.78rem;padding:.4rem .55rem;outline:none}.ml-input:focus{border-color:var(--bcolor,var(--accent))}.ml-btn{border:none;border-radius:5px;padding:.38rem .7rem;font-size:.7rem;cursor:pointer;font-weight:700;transition:opacity .12s;white-space:nowrap}.ml-btn:hover:not([disabled]){opacity:.85}.ml-btn[disabled]{opacity:.4;cursor:not-allowed}.ml-btn-color{background:var(--bc,var(--accent));color:#fff}.ml-btn-dark{background:#374151;color:#fff}.ml-quick-row{display:flex;gap:.2rem;flex-wrap:wrap}.ml-qbtn{font-size:.6rem;padding:.2rem .42rem;background:var(--bg1);border:1px solid var(--border);border-radius:3px;cursor:pointer;color:var(--text2);transition:border-color .1s,color .1s}.ml-qbtn:hover{border-color:var(--bcolor,var(--accent));color:var(--bcolor,var(--accent))}.ml-msg{font-size:.65rem;min-height:.9em;margin-top:.2rem}.ml-lb-title{font-size:.7rem;font-weight:700;padding-top:.55rem;border-top:1px solid var(--border);margin-top:.3rem}.ml-lb-list{display:flex;flex-direction:column;gap:.15rem}.ml-lb-empty{font-size:.62rem;color:var(--text3);padding:.3rem 0}.ml-lb-row{display:flex;align-items:center;gap:.3rem;font-size:.63rem;padding:.18rem 0}.ml-lb-rank{width:1.2rem;flex-shrink:0}.ml-lb-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ml-lb-amt{font-family:var(--font-mono);font-weight:600;flex-shrink:0}.ml-lb-pct{font-size:.56rem;color:var(--text3);width:2.6rem;text-align:right;flex-shrink:0}.ml-hack-info-grid{background:var(--bg1);border:1px solid var(--border);border-radius:6px;padding:.55rem .65rem;display:flex;flex-direction:column;gap:.25rem}.ml-hig-row{display:flex;justify-content:space-between;font-size:.62rem;color:var(--text2)}.ml-hack-rules{font-size:.6rem;color:var(--text3);display:flex;flex-direction:column;gap:.18rem;line-height:1.5}.ml-hack-btn{width:100%;padding:.7rem;background:linear-gradient(135deg,#7f1d1d,#dc2626);color:#fff;border:1px solid #f87171;border-radius:7px;cursor:pointer;font-size:.8rem;font-weight:700;letter-spacing:1px;transition:transform .1s,box-shadow .1s;margin-top:auto}.ml-hack-btn:hover:not([disabled]){transform:scale(1.02);box-shadow:0 4px 18px rgba(220,38,38,.4)}.ml-hack-btn[disabled]{opacity:.4;cursor:not-allowed}.ml-cd-box{text-align:center;font-size:.72rem;color:var(--text3);padding:.7rem;background:var(--bg1);border-radius:6px;border:1px solid var(--border);margin-top:auto}.ml-cd-num{color:#f87171;font-weight:700;font-family:var(--font-mono)}`;
      document.head.appendChild(st);
    }

    render();

    // Clean up Network listeners and loan timer when the bank window closes
    EventBus.on('window:closed', ({ appId }) => {
      if (appId !== 'bank' && appId !== 'loans') return;
      if (wrap._cleanup) wrap._cleanup();
    });

    return wrap;
  }
};
