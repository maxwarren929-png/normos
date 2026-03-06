/**
 * NormOS — apps/loans.js (v5 — Fixed $500 Loans)
 * NormBank: Deposits, Withdrawals, Interest, Credit Score, Fixed $500 Loans
 */

const LoansApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'bank-wrap';
    const iid = Math.random().toString(36).slice(2, 6);

    let bankState = {
      balance: 0, deposit: 0, creditScore: 0,
      loan: null,
      creditTier: { name:'Base', loanCap:500, color:'#6b7280', icon:'⬛' }
    };

    const fmt = (n) => Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const CREDIT_TIERS = [
      {name:'Base',     minScore:0,    loanAmount:500,    rate:0.05, termMs:300000,  color:'#6b7280',icon:'⬛'},
      {name:'Fair',     minScore:100,  loanAmount:2500,   rate:0.10, termMs:900000,  color:'#f59e0b',icon:'🟡'},
      {name:'Good',     minScore:300,  loanAmount:10000,  rate:0.15, termMs:1800000, color:'#4ade80',icon:'🟢'},
      {name:'Excellent',minScore:600,  loanAmount:50000,  rate:0.20, termMs:3600000, color:'#4f9eff',icon:'🔵'},
      {name:'Elite',    minScore:1000, loanAmount:250000, rate:0.25, termMs:7200000, color:'#c084fc',icon:'💜'},
    ];

    const getCreditTier = (score) => {
      let t = CREDIT_TIERS[0];
      for (const ct of CREDIT_TIERS) { if (score >= ct.minScore) t=ct; }
      return t;
    };

    let loanTimer = null;
    const startLoanTimer = () => {
      if (loanTimer) clearInterval(loanTimer);
      loanTimer = setInterval(() => {
        if (!document.body.contains(wrap)) { clearInterval(loanTimer); return; }
        if (!bankState.loan?.active) { clearInterval(loanTimer); return; }
        const tl = Math.max(0, bankState.loan.dueAt - Date.now());
        if (tl === 0) {
          clearInterval(loanTimer);
          if (typeof Network !== 'undefined' && Network.isConnected())
            Network.send({type:'bank:loan:default'});
          return;
        }
        const countEl = wrap.querySelector('.bank-loan-countdown');
        const barEl   = wrap.querySelector('.bank-loan-bar');
        if (countEl) {
          const m=Math.floor(tl/60000), s=Math.floor((tl%60000)/1000);
          countEl.textContent=`${m}m ${s}s`;
          countEl.style.color=tl<60000?'var(--red)':'var(--text1)';
        }
        if (barEl) {
          const pct=Math.min(100,(tl/bankState.loan.termMs)*100);
          barEl.style.width=pct+'%';
          barEl.style.background=tl<60000?'var(--red)':'var(--accent)';
        }
      }, 1000);
    };

    const render = () => {
      const s    = bankState;
      const tier = getCreditTier(s.creditScore||0);
      const loan = s.loan;
      const tl   = loan?.active ? Math.max(0,loan.dueAt-Date.now()) : 0;
      const tlM  = Math.floor(tl/60000), tlS=Math.floor((tl%60000)/1000);
      const maxScore=1200, pct=Math.min(100,((s.creditScore||0)/maxScore)*100);
      const nextTier=CREDIT_TIERS.find(t=>t.minScore>(s.creditScore||0))||CREDIT_TIERS[CREDIT_TIERS.length-1];

      // Loan amount is fixed by tier
      const loanAmt      = tier.loanAmount;
      const loanInterest = loanAmt * tier.rate;
      const loanTotal    = loanAmt + loanInterest;
      const termMinutes  = Math.round(tier.termMs / 60000);

      wrap.innerHTML = `
        <div class="bank-layout">
          <div class="bank-header">
            <div class="bank-logo">🏦 NormBank Central</div>
            <div class="bank-tagline">Deposits protected. Credit earned. Defaults punished.</div>
          </div>
          <div class="bank-cards">
            <div class="bank-card">
              <div class="bank-card-label">Available Cash</div>
              <div class="bank-card-val" style="color:#4ade80">$${fmt(s.balance)}</div>
            </div>
            <div class="bank-card">
              <div class="bank-card-label">🔒 Deposit (Protected)</div>
              <div class="bank-card-val" style="color:#4f9eff">$${fmt(s.deposit||0)}</div>
              <div class="bank-card-sub">+0.5%/min interest</div>
            </div>
            <div class="bank-card">
              <div class="bank-card-label">Credit Score</div>
              <div class="bank-card-val" style="color:${tier.color}">${s.creditScore||0} ${esc(tier.icon)} ${esc(tier.name)}</div>
              <div class="bank-score-bar-wrap"><div class="bank-score-bar" style="width:${pct}%;background:${tier.color}"></div></div>
              <div class="bank-card-sub">Next: ${esc(nextTier.name)} @ ${nextTier.minScore} pts</div>
            </div>
          </div>

          <div class="bank-section">
            <div class="bank-section-title">💰 Deposit / Withdraw</div>
            <div class="bank-row">
              <input class="bank-input" id="bank-dep-amt-${iid}" type="number" placeholder="Deposit amount" min="1" />
              <button class="bank-btn green" id="bank-dep-btn-${iid}">Deposit</button>
            </div>
            <div class="bank-row">
              <input class="bank-input" id="bank-wdw-amt-${iid}" type="number" placeholder="Withdraw amount" min="1" />
              <button class="bank-btn blue"  id="bank-wdw-btn-${iid}">Withdraw</button>
            </div>
            <div class="bank-hint">Deposited funds earn 0.5%/min interest and are <strong>protected from hacks</strong>.</div>
          </div>

          ${loan?.active ? `
          <div class="bank-section" style="border-color:var(--red)">
            <div class="bank-section-title" style="color:var(--red)">⚠️ Active Loan</div>
            <div class="bank-loan-grid">
              <div class="bank-lstat"><div class="bank-lstat-l">Borrowed</div><div class="bank-lstat-v">$${fmt(loan.principal)}</div></div>
              <div class="bank-lstat"><div class="bank-lstat-l">Interest (${(loan.rate*100).toFixed(0)}%)</div><div class="bank-lstat-v" style="color:var(--red)">+$${fmt(loan.principal*loan.rate)}</div></div>
              <div class="bank-lstat"><div class="bank-lstat-l">Total Due</div><div class="bank-lstat-v" style="color:var(--red);font-weight:800">$${fmt(loan.totalDue)}</div></div>
              <div class="bank-lstat"><div class="bank-lstat-l">Time Left</div><div class="bank-loan-countdown bank-lstat-v" style="color:${tl<60000?'var(--red)':'var(--text1)'}">${tlM}m ${tlS}s</div></div>
            </div>
            <div class="bank-bar-wrap"><div class="bank-loan-bar" style="width:${Math.min(100,(tl/(loan.termMs||1))*100)}%;background:${tl<60000?'var(--red)':'var(--accent)'}"></div></div>
            <button class="bank-btn ${s.balance>=loan.totalDue?'green':'disabled'}" id="bank-repay-btn-${iid}" ${s.balance<loan.totalDue?'disabled':''}>
              ${s.balance>=loan.totalDue?`💰 Repay $${fmt(loan.totalDue)}`:'❌ Insufficient funds to repay'}
            </button>
            <div class="bank-hint" style="color:#f87171">Default = NormBank takes <strong>EVERYTHING</strong> including deposits.</div>
          </div>` : `
          <div class="bank-section">
            <div class="bank-section-title">📋 Apply for a Loan</div>
            <div style="background:var(--bg1);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:8px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:0.82rem;font-weight:bold;color:var(--text1);">💵 Loan Amount</span>
                <span style="font-size:1.1rem;font-weight:bold;color:#4ade80;">$${fmt(loanAmt)}</span>
              </div>
              <div style="font-size:0.72rem;color:var(--text3);margin-bottom:4px;">Interest: ${(tier.rate*100).toFixed(0)}% → Total repay: <strong style="color:var(--text1);">$${fmt(loanTotal)}</strong></div>
              <div style="font-size:0.72rem;color:var(--text3);">Term: ${termMinutes} minutes to repay</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text2);margin-bottom:8px;">
              Your tier <strong style="color:${tier.color}">${esc(tier.icon)} ${esc(tier.name)}</strong> — fixed loan of <strong style="color:#4ade80;">$${loanAmt.toLocaleString()}</strong>
            </div>
            <button class="bank-btn accent" id="bank-loan-btn-${iid}" style="width:100%;">Request $${loanAmt.toLocaleString()} Loan</button>
            <div class="bank-tier-ladder" style="margin-top:10px;">
              <div style="font-size:0.68rem;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">Credit Tier Ladder — unlock higher tiers for larger fixed loans</div>
              ${CREDIT_TIERS.map(t=>`
                <div class="bank-tier-item ${(s.creditScore||0)>=t.minScore?'unlocked':'locked'}">
                  <span>${t.icon}</span>
                  <span style="font-weight:600;color:${t.color}">${esc(t.name)}</span>
                  <span style="color:${t.color};font-weight:600;">$${t.loanAmount.toLocaleString()}</span>
                  <span style="font-size:0.6rem;color:var(--text3);">${(t.rate*100).toFixed(0)}% / ${Math.round(t.termMs/60000)}min</span>
                  <span style="margin-left:auto;color:var(--text3)">${t.minScore}+ pts</span>
                </div>`).join('')}
            </div>
            <div class="bank-hint">Repay on time: <strong style="color:#4ade80">+50 score</strong>. Late: <strong style="color:var(--red)">-100</strong>. Default: <strong style="color:var(--red)">-200 + lose everything</strong>.</div>
          </div>`}
        </div>`;

      wrap.querySelector(`#bank-dep-btn-${iid}`)?.addEventListener('click',()=>{
        const amt=parseFloat(wrap.querySelector(`#bank-dep-amt-${iid}`).value)||0;
        if(amt<=0||amt>s.balance){if(typeof OS!=='undefined')OS.notify('🏦','Bank','Invalid deposit amount.');return;}
        if(typeof Network!=='undefined'&&Network.isConnected()){Network.send({type:'bank:deposit',amount:amt});}
        else{bankState.balance-=amt;bankState.deposit=(bankState.deposit||0)+amt;if(typeof Economy!=='undefined'){Economy.state.balance-=amt;Economy.save();Economy.updateWalletDisplay();}render();}
      });

      wrap.querySelector(`#bank-wdw-btn-${iid}`)?.addEventListener('click',()=>{
        const amt=parseFloat(wrap.querySelector(`#bank-wdw-amt-${iid}`).value)||0;
        if(amt<=0||amt>(s.deposit||0)){if(typeof OS!=='undefined')OS.notify('🏦','Bank','Invalid withdrawal.');return;}
        if(typeof Network!=='undefined'&&Network.isConnected()){Network.send({type:'bank:withdraw',amount:amt});}
        else{bankState.deposit-=amt;bankState.balance+=amt;if(typeof Economy!=='undefined'){Economy.state.balance+=amt;Economy.save();Economy.updateWalletDisplay();}render();}
      });

      wrap.querySelector(`#bank-repay-btn-${iid}`)?.addEventListener('click',()=>{
        if(!loan||s.balance<loan.totalDue)return;
        if(typeof Network!=='undefined'&&Network.isConnected()){Network.send({type:'bank:loan:repay'});}
        else{bankState.balance-=loan.totalDue;bankState.loan=null;bankState.creditScore=(bankState.creditScore||0)+50;if(typeof Economy!=='undefined'){Economy.state.balance-=loan.totalDue;Economy.save();Economy.updateWalletDisplay();}render();}
      });

      wrap.querySelector(`#bank-loan-btn-${iid}`)?.addEventListener('click',()=>{
        const amt = tier.loanAmount;
        const total = fmt(amt + amt * tier.rate);
        const mins = Math.round(tier.termMs / 60000);
        if(!confirm(`Borrow $${amt.toLocaleString()} (${(tier.rate*100).toFixed(0)}% interest = $${total} total)?\n\nYou have ${mins} minutes to repay.\n\nMissing the deadline = NormBank seizes EVERYTHING.`))return;
        if(typeof Network!=='undefined'&&Network.isConnected()){
          Network.send({type:'bank:loan:request',amount:amt});
        } else {
          // Offline fallback
          bankState.loan={active:true,principal:amt,rate:tier.rate,termMs:tier.termMs,
            borrowedAt:Date.now(),dueAt:Date.now()+tier.termMs,totalDue:parseFloat((amt+amt*tier.rate).toFixed(2))};
          bankState.balance+=amt;
          if(typeof Economy!=='undefined'){Economy.state.balance+=amt;Economy.save();Economy.updateWalletDisplay();}
          render();
        }
      });

      if(loan?.active) startLoanTimer();
    };

    // Network event handlers
    if(typeof Network!=='undefined'){
      const onBU=(d)=>{bankState={...bankState,...d};if(d.balance!==undefined&&typeof Economy!=='undefined'){Economy.state.balance=d.balance;Economy.save();Economy.updateWalletDisplay();}render();};
      const onInt=(d)=>{bankState.deposit=d.newDeposit;if(typeof OS!=='undefined')OS.notify('🏦','NormBank',`+$${fmt(d.amount)} deposit interest!`);render();};
      const onLA=(d)=>{bankState.loan=d.loan;bankState.balance=d.newBalance;if(typeof Economy!=='undefined'){Economy.state.balance=d.newBalance;Economy.save();Economy.updateWalletDisplay();}if(typeof OS!=='undefined')OS.notify('🏦','Loan Approved',`$${fmt(d.loan.principal)} added!`);render();};
      const onLR=(d)=>{bankState.loan=null;bankState.creditScore=d.creditScore;bankState.balance=d.newBalance;if(typeof Economy!=='undefined'){Economy.state.balance=d.newBalance;Economy.save();Economy.updateWalletDisplay();}if(typeof OS!=='undefined')OS.notify('🏦','Loan',d.onTime?'Repaid on time! +50 score':'Late repayment. -100 score');render();};
      const onLD=(d)=>{bankState.loan=null;bankState.balance=0;bankState.deposit=0;bankState.creditScore=d.creditScore;if(typeof Economy!=='undefined'){Economy.state.balance=0;Economy.save();Economy.updateWalletDisplay();}if(typeof OS!=='undefined')OS.notify('💀','LOAN DEFAULT','NormBank seized all assets!');render();};
      const onBE=(d)=>{if(typeof OS!=='undefined')OS.notify('🏦','Bank Error',d.message||'Error');};
      Network.on('bank:update',onBU);Network.on('bank:interest',onInt);
      Network.on('bank:loan:approved',onLA);Network.on('bank:loan:repaid',onLR);
      Network.on('bank:loan:defaulted',onLD);Network.on('bank:error',onBE);
      Network.send({type:'bank:get'});
      wrap._cleanup=()=>{Network.off('bank:update',onBU);Network.off('bank:interest',onInt);Network.off('bank:loan:approved',onLA);Network.off('bank:loan:repaid',onLR);Network.off('bank:loan:defaulted',onLD);Network.off('bank:error',onBE);if(loanTimer)clearInterval(loanTimer);};
    }

    if(typeof Economy!=='undefined') bankState.balance = Economy.state.balance;

    if(!document.getElementById('bank-styles')){
      const st=document.createElement('style');st.id='bank-styles';
      st.textContent=`.bank-wrap{height:100%;overflow-y:auto;background:var(--bg1)}.bank-layout{padding:16px;max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:14px}.bank-header{text-align:center;padding:16px;background:var(--bg2);border-radius:10px;border:1px solid var(--border)}.bank-logo{font-size:1.3rem;font-weight:bold;color:var(--text1)}.bank-tagline{font-size:0.7rem;color:var(--text3);margin-top:4px;font-style:italic}.bank-cards{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.bank-card{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px}.bank-card-label{font-size:0.62rem;color:var(--text3);margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em}.bank-card-val{font-size:1rem;font-weight:bold;color:var(--text1);font-family:monospace}.bank-card-sub{font-size:.62rem;color:var(--text3);margin-top:4px}.bank-score-bar-wrap{background:var(--bg1);border-radius:4px;height:5px;overflow:hidden;margin:6px 0 4px}.bank-score-bar{height:100%;border-radius:4px;transition:width .5s}.bank-section{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px}.bank-section-title{font-size:.82rem;font-weight:bold;color:var(--text1)}.bank-row{display:flex;gap:8px;flex-wrap:wrap}.bank-input{flex:1;min-width:100px;background:var(--bg1);border:1px solid var(--border);border-radius:6px;color:var(--text1);font-size:.82rem;padding:8px 10px}.bank-btn{border:none;border-radius:6px;padding:8px 16px;font-size:.78rem;cursor:pointer;font-weight:600;white-space:nowrap}.bank-btn:hover:not(.disabled){opacity:.85}.bank-btn.green{background:#4ade80;color:#000}.bank-btn.blue{background:#4f9eff;color:#fff}.bank-btn.accent{background:var(--accent);color:#fff}.bank-btn.disabled{background:var(--bg3);color:var(--text3);cursor:not-allowed}.bank-hint{font-size:.68rem;color:var(--text3);line-height:1.5}.bank-loan-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.bank-lstat{background:var(--bg1);border:1px solid var(--border);border-radius:6px;padding:8px 12px}.bank-lstat-l{font-size:.62rem;color:var(--text3);margin-bottom:2px}.bank-lstat-v{font-size:.9rem;color:var(--text1);font-weight:600}.bank-bar-wrap{background:var(--bg1);border-radius:4px;height:6px;overflow:hidden}.bank-loan-bar{height:100%;transition:width 1s linear;border-radius:4px}.bank-tier-ladder{display:flex;flex-direction:column;gap:4px}.bank-tier-item{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:6px;font-size:.72rem;background:var(--bg1);border:1px solid var(--border)}.bank-tier-item.unlocked{border-color:rgba(74,222,128,.3)}.bank-tier-item.locked{opacity:.5}`;
      document.head.appendChild(st);
    }

    render();
    return wrap;
  }
};
