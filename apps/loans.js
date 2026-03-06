/**
 * NormOS — apps/loans.js (v6 — Multi-Bank Hub)
 * Unified banking: NormBank Central (loans/credit) + NootScam, Elite, CommBank (hackable)
 */

const LoansApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'bank-wrap';
    const iid = Math.random().toString(36).slice(2, 6);

    let activeBank = 'central';
    let bankState = { balance:0, deposit:0, creditScore:0, loan:null };
    let multiBankData = {
      noot:  { myDeposit:0, totalDeposits:0, topDepositors:[] },
      elite: { myDeposit:0, totalDeposits:0, topDepositors:[] },
      comm:  { myDeposit:0, totalDeposits:0, topDepositors:[] },
    };
    let hackCooldowns = {};
    let loanTimer = null;

    const fmt = (n) => Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const CREDIT_TIERS = [
      {name:'Base',     minScore:0,    loanAmount:500,    rate:0.05, termMs:300000,  color:'#6b7280',icon:'⬛'},
      {name:'Fair',     minScore:100,  loanAmount:2500,   rate:0.10, termMs:900000,  color:'#f59e0b',icon:'🟡'},
      {name:'Good',     minScore:300,  loanAmount:10000,  rate:0.15, termMs:1800000, color:'#4ade80',icon:'🟢'},
      {name:'Excellent',minScore:600,  loanAmount:50000,  rate:0.20, termMs:3600000, color:'#4f9eff',icon:'🔵'},
      {name:'Elite',    minScore:1000, loanAmount:250000, rate:0.25, termMs:7200000, color:'#c084fc',icon:'💜'},
    ];

    const HACKABLE_BANKS = {
      noot:  { id:'noot',  name:'NootScam Bank', icon:'🐧', security:1, interestRate:1.8, fee:0.5,  hackDifficulty:1, color:'#f59e0b', tagline:"We're totally legit. Probably.", cdMs:60000  },
      elite: { id:'elite', name:'Elite Bank',    icon:'💎', security:3, interestRate:0.8, fee:2.5,  hackDifficulty:3, color:'#c084fc', tagline:"For those who deserve better.", cdMs:240000 },
      comm:  { id:'comm',  name:'CommBank',      icon:'🏦', security:2, interestRate:1.2, fee:1.2,  hackDifficulty:2, color:'#4f9eff', tagline:"Banking. It's a thing we do.",  cdMs:120000 },
    };

    const getCreditTier = (score) => {
      let t = CREDIT_TIERS[0];
      for (const ct of CREDIT_TIERS) { if (score >= ct.minScore) t=ct; }
      return t;
    };

    const startLoanTimer = () => {
      if (loanTimer) clearInterval(loanTimer);
      loanTimer = setInterval(() => {
        if (!document.body.contains(wrap)) { clearInterval(loanTimer); return; }
        if (!bankState.loan?.active) { clearInterval(loanTimer); return; }
        const tl = Math.max(0, bankState.loan.dueAt - Date.now());
        if (tl === 0) { clearInterval(loanTimer); if(typeof Network!=='undefined'&&Network.isConnected())Network.send({type:'bank:loan:default'}); return; }
        const countEl=wrap.querySelector('.bank-loan-countdown');
        const barEl=wrap.querySelector('.bank-loan-bar');
        if(countEl){const m=Math.floor(tl/60000),s=Math.floor((tl%60000)/1000);countEl.textContent=`${m}m ${s}s`;countEl.style.color=tl<60000?'var(--red)':'var(--text1)';}
        if(barEl){barEl.style.width=Math.min(100,(tl/bankState.loan.termMs)*100)+'%';barEl.style.background=tl<60000?'var(--red)':'var(--accent)';}
      }, 1000);
    };

    const setMsg=(el,txt,color)=>{if(el){el.textContent=txt;el.style.color=color;}};
    const showToast=(msg,color='#4ade80')=>{const t=document.createElement('div');t.style.cssText=`position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#1a1d23;border:1px solid ${color};color:${color};padding:0.55rem 1.1rem;border-radius:8px;font-size:0.76rem;z-index:9999;pointer-events:none;font-family:var(--font-mono);box-shadow:0 4px 20px rgba(0,0,0,0.5);`;t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3000);};

    const renderCentral = () => {
      const s=bankState, tier=getCreditTier(s.creditScore||0), loan=s.loan;
      const tl=loan?.active?Math.max(0,loan.dueAt-Date.now()):0;
      const tlM=Math.floor(tl/60000),tlS=Math.floor((tl%60000)/1000);
      const pct=Math.min(100,((s.creditScore||0)/1200)*100);
      const nextTier=CREDIT_TIERS.find(t=>t.minScore>(s.creditScore||0))||CREDIT_TIERS[CREDIT_TIERS.length-1];
      const loanAmt=tier.loanAmount,loanTotal=loanAmt+loanAmt*tier.rate,termMins=Math.round(tier.termMs/60000);
      return `<div class="mbank-central">
        <div class="mbc-header"><div class="mbc-logo">🏦 NormBank Central</div><div class="mbc-tagline">Deposits protected. Credit earned. Defaults punished.</div></div>
        <div class="mbc-cards">
          <div class="mbc-card"><div class="mbc-card-label">Available Cash</div><div class="mbc-card-val" style="color:#4ade80">$${fmt(s.balance)}</div></div>
          <div class="mbc-card"><div class="mbc-card-label">🔒 Deposit</div><div class="mbc-card-val" style="color:#4f9eff">$${fmt(s.deposit||0)}</div><div class="mbc-card-sub">+0.5%/min interest</div></div>
          <div class="mbc-card"><div class="mbc-card-label">Credit Score</div><div class="mbc-card-val" style="color:${tier.color}">${s.creditScore||0} ${esc(tier.icon)} ${esc(tier.name)}</div><div class="mbc-score-bar-wrap"><div class="mbc-score-bar" style="width:${pct}%;background:${tier.color}"></div></div><div class="mbc-card-sub">Next: ${esc(nextTier.name)} @ ${nextTier.minScore}</div></div>
        </div>
        <div class="mbc-section"><div class="mbc-section-title">💰 Deposit / Withdraw</div>
          <div class="mbc-row"><input class="mbc-input" id="mbc-dep-${iid}" type="number" placeholder="Deposit amount" min="1"/><button class="mbc-btn green" id="mbc-dep-btn-${iid}">Deposit</button></div>
          <div class="mbc-row"><input class="mbc-input" id="mbc-wdw-${iid}" type="number" placeholder="Withdraw amount" min="1"/><button class="mbc-btn blue" id="mbc-wdw-btn-${iid}">Withdraw</button></div>
          <div class="mbc-hint">Protected from hacks. Earns 0.5%/min interest automatically.</div>
        </div>
        ${loan?.active?`<div class="mbc-section" style="border-color:var(--red)">
          <div class="mbc-section-title" style="color:var(--red)">⚠️ Active Loan</div>
          <div class="mbc-loan-grid">
            <div class="mbc-lstat"><div class="mbc-ls-l">Borrowed</div><div class="mbc-ls-v">$${fmt(loan.principal)}</div></div>
            <div class="mbc-lstat"><div class="mbc-ls-l">Interest (${(loan.rate*100).toFixed(0)}%)</div><div class="mbc-ls-v" style="color:var(--red)">+$${fmt(loan.principal*loan.rate)}</div></div>
            <div class="mbc-lstat"><div class="mbc-ls-l">Total Due</div><div class="mbc-ls-v" style="color:var(--red);font-weight:800">$${fmt(loan.totalDue)}</div></div>
            <div class="mbc-lstat"><div class="mbc-ls-l">Time Left</div><div class="bank-loan-countdown mbc-ls-v">${tlM}m ${tlS}s</div></div>
          </div>
          <div class="mbc-bar-wrap"><div class="bank-loan-bar" style="width:${Math.min(100,(tl/(loan.termMs||1))*100)}%;background:${tl<60000?'var(--red)':'var(--accent)'}"></div></div>
          <button class="mbc-btn ${s.balance>=loan.totalDue?'green':'disabled'}" id="mbc-repay-btn-${iid}" ${s.balance<loan.totalDue?'disabled':''}>
            ${s.balance>=loan.totalDue?`💰 Repay $${fmt(loan.totalDue)}`:'❌ Insufficient funds'}
          </button>
          <div class="mbc-hint" style="color:#f87171">Default = NormBank seizes <strong>EVERYTHING</strong> including deposits.</div>
        </div>`:`<div class="mbc-section"><div class="mbc-section-title">📋 Apply for a Loan</div>
          <div class="mbc-loan-info">
            <div class="mbc-loan-main"><span style="font-size:0.82rem;font-weight:bold;">💵 Loan Amount</span><span style="font-size:1.1rem;font-weight:bold;color:#4ade80;">$${fmt(loanAmt)}</span></div>
            <div class="mbc-hint">Interest: ${(tier.rate*100).toFixed(0)}% → Total: <strong>$${fmt(loanTotal)}</strong> · Term: ${termMins} min</div>
          </div>
          <button class="mbc-btn accent" id="mbc-loan-btn-${iid}">Request $${loanAmt.toLocaleString()} Loan</button>
          <div class="mbc-tier-ladder"><div class="mbc-tier-label">Credit Tier Ladder</div>
            ${CREDIT_TIERS.map(t=>`<div class="mbc-tier-row ${(s.creditScore||0)>=t.minScore?'unlocked':'locked'}"><span>${t.icon}</span><span style="font-weight:600;color:${t.color}">${esc(t.name)}</span><span style="color:${t.color};font-weight:600;">$${t.loanAmount.toLocaleString()}</span><span style="font-size:.6rem;color:var(--text3)">${(t.rate*100).toFixed(0)}% / ${Math.round(t.termMs/60000)}min</span><span style="margin-left:auto;font-size:.6rem;color:var(--text3)">${t.minScore}+ pts</span></div>`).join('')}
          </div>
          <div class="mbc-hint">Repay on time: <strong style="color:#4ade80">+50</strong>. Late: <strong style="color:var(--red)">-100</strong>. Default: <strong style="color:var(--red)">-200 + lose everything</strong>.</div>
        </div>`}
      </div>`;
    };

    const renderHackableBank = (b) => {
      const bd=multiBankData[b.id]||{myDeposit:0,totalDeposits:0,topDepositors:[]};
      const cdMs=hackCooldowns[b.id]?Math.max(0,(hackCooldowns[b.id]+b.cdMs)-Date.now()):0;
      const cdSec=Math.ceil(cdMs/1000);
      const hackable=(bd.totalDeposits||0)*0.02;
      const top=(bd.topDepositors||[]).slice(0,8);
      return `<div class="mbank-hackable" style="--bcolor:${b.color}">
        <div class="mbh-header"><span style="font-size:2rem">${b.icon}</span><div><div class="mbh-name">${b.name}</div><div class="mbh-tagline">${b.tagline}</div></div><div class="mbh-sec">${'🔒'.repeat(b.security)}${'🔓'.repeat(3-b.security)}</div></div>
        <div class="mbh-stats">
          <div class="mbh-stat"><div class="mbhs-label">Your Deposit</div><div class="mbhs-val" style="color:${b.color}">$${fmt(bd.myDeposit||0)}</div><div class="mbhs-sub">+${b.interestRate}%/min</div></div>
          <div class="mbh-stat"><div class="mbhs-label">Total Deposits</div><div class="mbhs-val">$${fmt(bd.totalDeposits||0)}</div><div class="mbhs-sub">${top.length} depositors</div></div>
          <div class="mbh-stat"><div class="mbhs-label">Hackable (~2%)</div><div class="mbhs-val" style="color:#f87171">$${fmt(hackable)}</div><div class="mbhs-sub">From all depositors</div></div>
        </div>
        <div class="mbh-body">
          <div class="mbh-col">
            <div class="mbh-col-title">💰 Deposit / Withdraw</div>
            <div class="mbh-row"><input type="number" id="mbh-dep-${iid}" class="mbh-input" placeholder="Amount..." min="1"/><button class="mbh-btn" id="mbh-dep-btn-${iid}" style="background:${b.color}">Deposit</button></div>
            <div class="mbh-quick">${[100,500,1000,5000].map(v=>`<span class="mbh-qbtn dep" data-val="${v}">$${v.toLocaleString()}</span>`).join('')}<span class="mbh-qbtn dep" data-val="all">All</span></div>
            <div class="mbh-row" style="margin-top:0.45rem"><input type="number" id="mbh-wdw-${iid}" class="mbh-input" placeholder="Amount..." min="1"/><button class="mbh-btn" id="mbh-wdw-btn-${iid}" style="background:#374151">Withdraw</button></div>
            <div class="mbh-quick">${[100,500,1000].map(v=>`<span class="mbh-qbtn wdw" data-val="${v}">$${v.toLocaleString()}</span>`).join('')}<span class="mbh-qbtn wdw" data-val="all">All</span></div>
            <div class="mbh-fee-note">Fee: ${b.fee}% on withdrawal</div>
            <div class="mbh-msg" id="mbh-msg-${iid}"></div>
            <div class="mbh-lb-title">🏆 Top Depositors</div>
            ${top.length===0?'<div style="font-size:.62rem;color:var(--text3);padding:0.3rem 0">No depositors yet</div>':top.map((dep,i)=>`<div class="mbh-lb-row"><span class="mbh-lb-rank">${['🥇','🥈','🥉'][i]||(i+1)+'.'}</span><span class="mbh-lb-name" style="color:${dep.color||'var(--text)'}">${dep.username}</span><span class="mbh-lb-amt" style="color:${b.color}">$${fmt(dep.deposit)}</span><span class="mbh-lb-pct">${bd.totalDeposits>0?((dep.deposit/bd.totalDeposits)*100).toFixed(1):0}%</span></div>`).join('')}
          </div>
          <div class="mbh-col mbh-hack-col">
            <div class="mbh-col-title">💀 Hack This Bank</div>
            <div class="mbh-hack-info">
              <div class="mbhhi-row"><span>Security</span><span>${'🔒'.repeat(b.security)} (${['Low','Medium','High'][b.security-1]})</span></div>
              <div class="mbhhi-row"><span>Minigame</span><span>${b.hackDifficulty===1?'1 round · 6 chars · 10s':b.hackDifficulty===2?'2 rounds · 9 chars · 9s':'3 rounds · 13 chars · 8s'}</span></div>
              <div class="mbhhi-row"><span>Loot</span><span style="color:#f87171">~$${fmt(hackable)}</span></div>
              <div class="mbhhi-row"><span>Cooldown</span><span>${b.cdMs/1000}s</span></div>
              <div class="mbhhi-row"><span>Est. Success</span><span>${b.hackDifficulty===1?'~85%':b.hackDifficulty===2?'~65%':'~45%'}</span></div>
            </div>
            <div class="mbh-hack-rules"><div>💸 2% stolen proportionally from depositors</div><div>⏳ Higher security = harder minigame</div><div>🔄 Cooldown after each attempt</div></div>
            ${cdSec>0
              ?`<div class="mbh-cooldown">⏳ Cooldown: <span class="mbh-cd-num" id="mbh-cd-${b.id}-${iid}">${cdSec}s</span></div>`
              :`<button class="mbh-hack-btn" id="mbh-hack-btn-${iid}" ${bd.totalDeposits<1?'disabled':''}>💀 Initiate Hack</button>${bd.totalDeposits<1?'<div style="font-size:.62rem;color:var(--text3);text-align:center;margin-top:0.3rem">No deposits to steal yet</div>':''}`
            }
          </div>
        </div>
      </div>`;
    };

    const render = () => {
      wrap.innerHTML = `<div class="mbank-layout">
        <div class="mbank-sidebar">
          <div class="mbank-sidebar-title">🏛️ NormBanks</div>
          <div class="mbank-cash-card"><div class="mbc-label">Your Cash</div><div class="mbc-val" id="mbc-cash-${iid}">$${fmt(bankState.balance)}</div></div>
          <div class="mbank-tabs">
            <div class="mbank-tab ${activeBank==='central'?'active':''}" data-bank="central"><span>🏦</span><div class="mbt-info"><div class="mbt-name">NormBank Central</div><div class="mbt-sub">Loans · Credit · Deposits</div></div><div class="mbt-dep" style="color:#4ade80">$${fmt(bankState.deposit||0)}</div></div>
            ${Object.values(HACKABLE_BANKS).map(b=>`<div class="mbank-tab ${activeBank===b.id?'active':''}" data-bank="${b.id}" style="${activeBank===b.id?'--btc:'+b.color:''}"><span>${b.icon}</span><div class="mbt-info"><div class="mbt-name">${b.name}</div><div class="mbt-sub">${b.interestRate}%/min · ${b.fee}% fee</div></div><div class="mbt-dep" style="color:${b.color}">$${fmt(multiBankData[b.id]?.myDeposit||0)}</div></div>`).join('')}
          </div>
          <div class="mbank-global"><div class="mbg-title">Global Deposits</div>${Object.values(HACKABLE_BANKS).map(b=>`<div class="mbg-row"><span>${b.icon} ${b.name.split(' ')[0]}</span><span style="color:${b.color};font-family:var(--font-mono)">$${fmt(multiBankData[b.id]?.totalDeposits||0)}</span></div>`).join('')}</div>
        </div>
        <div class="mbank-main" id="mbank-main-${iid}">${activeBank==='central'?renderCentral():renderHackableBank(HACKABLE_BANKS[activeBank])}</div>
      </div>`;
      wrap.querySelectorAll('.mbank-tab').forEach(tab=>tab.addEventListener('click',()=>{
        activeBank=tab.dataset.bank;
        wrap.querySelectorAll('.mbank-tab').forEach(t=>{t.classList.toggle('active',t.dataset.bank===activeBank);const hb=HACKABLE_BANKS[t.dataset.bank];if(t.dataset.bank===activeBank&&hb)t.style.setProperty('--btc',hb.color);else t.style.removeProperty('--btc');});
        const main=wrap.querySelector(`#mbank-main-${iid}`);if(main){main.innerHTML=activeBank==='central'?renderCentral():renderHackableBank(HACKABLE_BANKS[activeBank]);bindMainEvents();}
      }));
      bindMainEvents();
      if(bankState.loan?.active)startLoanTimer();
    };

    const rerender=()=>{
      const cashEl=wrap.querySelector(`#mbc-cash-${iid}`);if(cashEl)cashEl.textContent='$'+fmt(bankState.balance);
      wrap.querySelectorAll('.mbank-tab').forEach(tab=>{const dep=tab.querySelector('.mbt-dep');if(!dep)return;if(tab.dataset.bank==='central')dep.textContent='$'+fmt(bankState.deposit||0);else if(multiBankData[tab.dataset.bank])dep.textContent='$'+fmt(multiBankData[tab.dataset.bank].myDeposit||0);});
      // Update global deposits
      const globalRows=wrap.querySelectorAll('.mbg-row');Object.values(HACKABLE_BANKS).forEach((b,i)=>{if(globalRows[i])globalRows[i].querySelector('span:last-child').textContent='$'+fmt(multiBankData[b.id]?.totalDeposits||0);});
      const main=wrap.querySelector(`#mbank-main-${iid}`);if(main){main.innerHTML=activeBank==='central'?renderCentral():renderHackableBank(HACKABLE_BANKS[activeBank]);bindMainEvents();}
      if(bankState.loan?.active)startLoanTimer();
    };

    const bindMainEvents=()=>{
      const main=wrap.querySelector(`#mbank-main-${iid}`);if(!main)return;
      if(activeBank==='central'){
        main.querySelector(`#mbc-dep-btn-${iid}`)?.addEventListener('click',()=>{const amt=parseFloat(main.querySelector(`#mbc-dep-${iid}`)?.value)||0;if(amt<=0||amt>bankState.balance)return;if(typeof Network!=='undefined'&&Network.isConnected())Network.send({type:'bank:deposit',amount:amt});else{bankState.balance-=amt;bankState.deposit=(bankState.deposit||0)+amt;if(typeof Economy!=='undefined'){Economy.state.balance-=amt;Economy.save();Economy.updateWalletDisplay();}rerender();}});
        main.querySelector(`#mbc-wdw-btn-${iid}`)?.addEventListener('click',()=>{const amt=parseFloat(main.querySelector(`#mbc-wdw-${iid}`)?.value)||0;if(amt<=0||amt>(bankState.deposit||0))return;if(typeof Network!=='undefined'&&Network.isConnected())Network.send({type:'bank:withdraw',amount:amt});else{bankState.deposit-=amt;bankState.balance+=amt;if(typeof Economy!=='undefined'){Economy.state.balance+=amt;Economy.save();Economy.updateWalletDisplay();}rerender();}});
        main.querySelector(`#mbc-repay-btn-${iid}`)?.addEventListener('click',()=>{const loan=bankState.loan;if(!loan||bankState.balance<loan.totalDue)return;if(typeof Network!=='undefined'&&Network.isConnected())Network.send({type:'bank:loan:repay'});else{bankState.balance-=loan.totalDue;bankState.loan=null;bankState.creditScore=(bankState.creditScore||0)+50;if(typeof Economy!=='undefined'){Economy.state.balance-=loan.totalDue;Economy.save();Economy.updateWalletDisplay();}rerender();}});
        main.querySelector(`#mbc-loan-btn-${iid}`)?.addEventListener('click',()=>{const tier=getCreditTier(bankState.creditScore||0);const amt=tier.loanAmount;if(!confirm(`Borrow $${amt.toLocaleString()} (${(tier.rate*100).toFixed(0)}% interest)?\n\nTotal: $${fmt(amt+amt*tier.rate)}\nTerm: ${Math.round(tier.termMs/60000)} minutes\n\nMissing the deadline = NormBank seizes EVERYTHING.`))return;if(typeof Network!=='undefined'&&Network.isConnected())Network.send({type:'bank:loan:request',amount:amt});else{bankState.loan={active:true,principal:amt,rate:tier.rate,termMs:tier.termMs,borrowedAt:Date.now(),dueAt:Date.now()+tier.termMs,totalDue:parseFloat((amt+amt*tier.rate).toFixed(2))};bankState.balance+=amt;if(typeof Economy!=='undefined'){Economy.state.balance+=amt;Economy.save();Economy.updateWalletDisplay();}rerender();}});
        if(bankState.loan?.active)startLoanTimer();
        return;
      }
      const b=HACKABLE_BANKS[activeBank],bd=multiBankData[activeBank]||{};
      main.querySelectorAll('.mbh-qbtn.dep').forEach(btn=>btn.addEventListener('click',()=>{const inp=main.querySelector(`#mbh-dep-${iid}`);if(inp)inp.value=btn.dataset.val==='all'?Math.floor(bankState.balance):btn.dataset.val;}));
      main.querySelectorAll('.mbh-qbtn.wdw').forEach(btn=>btn.addEventListener('click',()=>{const inp=main.querySelector(`#mbh-wdw-${iid}`);if(inp)inp.value=btn.dataset.val==='all'?Math.floor(bd.myDeposit||0):btn.dataset.val;}));
      main.querySelector(`#mbh-dep-btn-${iid}`)?.addEventListener('click',()=>{const amt=parseFloat(main.querySelector(`#mbh-dep-${iid}`)?.value)||0;const msgEl=main.querySelector(`#mbh-msg-${iid}`);if(amt<=0||amt>bankState.balance){setMsg(msgEl,'Insufficient cash','#f87171');return;}if(typeof Network!=='undefined'&&Network.isConnected()){Network.send({type:'multibank:deposit',bankId:b.id,amount:amt});setMsg(msgEl,'Depositing...','var(--text3)');}else setMsg(msgEl,'Not connected','#f87171');});
      main.querySelector(`#mbh-wdw-btn-${iid}`)?.addEventListener('click',()=>{const amt=parseFloat(main.querySelector(`#mbh-wdw-${iid}`)?.value)||0;const msgEl=main.querySelector(`#mbh-msg-${iid}`);if(amt<=0||amt>(bd.myDeposit||0)){setMsg(msgEl,`Only $${fmt(bd.myDeposit||0)} deposited`,'#f87171');return;}if(typeof Network!=='undefined'&&Network.isConnected()){Network.send({type:'multibank:withdraw',bankId:b.id,amount:amt});setMsg(msgEl,'Withdrawing...','var(--text3)');}else setMsg(msgEl,'Not connected','#f87171');});
      main.querySelector(`#mbh-hack-btn-${iid}`)?.addEventListener('click',()=>{
        const cdMs2=hackCooldowns[b.id]?Math.max(0,(hackCooldowns[b.id]+b.cdMs)-Date.now()):0;
        if(cdMs2>0){showToast(`⏳ Cooldown: ${Math.ceil(cdMs2/1000)}s`,'#f59e0b');return;}
        if((bd.totalDeposits||0)<1){showToast('Nothing to steal','#f87171');return;}
        launchHackMinigame(b,()=>{hackCooldowns[b.id]=Date.now();if(typeof Network!=='undefined'&&Network.isConnected())Network.send({type:'multibank:hack',bankId:b.id,success:true});showToast('🎉 Hack submitted...','#4ade80');rerender();},()=>{hackCooldowns[b.id]=Date.now();if(typeof Network!=='undefined'&&Network.isConnected())Network.send({type:'multibank:hack',bankId:b.id,success:false});showToast('❌ Hack failed','#f87171');rerender();});
      });
      const cdEl=main.querySelector(`#mbh-cd-${b.id}-${iid}`);
      if(cdEl){const tickCd=()=>{if(!cdEl.isConnected)return;const ms=hackCooldowns[b.id]?Math.max(0,(hackCooldowns[b.id]+b.cdMs)-Date.now()):0;if(ms<=0){rerender();return;}cdEl.textContent=Math.ceil(ms/1000)+'s';setTimeout(tickCd,1000);};setTimeout(tickCd,1000);}
    };

    const launchHackMinigame=(bank,onWin,onLose)=>{
      const diff=bank.hackDifficulty,seqLen=diff===1?6:diff===2?9:13,timeMs=diff===1?10000:diff===2?9000:8000,rounds=diff===1?1:diff===2?2:3;
      const CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const genSeq=()=>Array.from({length:seqLen},()=>CHARS[Math.floor(Math.random()*CHARS.length)]).join('');
      let roundTargets=Array.from({length:rounds},genSeq),curRound=0,input='',timeLeft=timeMs,gameOver=false;
      const ov=document.createElement('div');
      ov.style.cssText=`position:fixed;inset:0;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;z-index:10000;font-family:var(--font-mono);backdrop-filter:blur(4px);`;
      ov.innerHTML=`<div style="background:#08090f;border:2px solid ${bank.color};border-radius:12px;padding:1.6rem;width:460px;max-width:92vw;box-shadow:0 0 50px ${bank.color}55;position:relative;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;"><span style="color:${bank.color};font-size:0.82rem;font-weight:700;letter-spacing:2px;">${bank.icon} HACKING: ${bank.name.toUpperCase()}</span><span style="font-size:0.65rem;color:var(--text3)">${'🔒'.repeat(bank.security)}</span></div>
        <div style="height:4px;background:#1e2433;border-radius:2px;margin-bottom:0.9rem;overflow:hidden;"><div id="hmb-${iid}" style="height:100%;width:100%;background:${bank.color};transition:width 0.1s linear;border-radius:2px;"></div></div>
        <div style="font-size:0.6rem;color:var(--text3);text-align:right;margin-bottom:0.6rem;">Round <span id="hmr-${iid}">1</span> / ${rounds}</div>
        <div style="font-size:0.6rem;color:var(--text3);letter-spacing:3px;margin-bottom:0.4rem;">TYPE THIS SEQUENCE:</div>
        <div id="hmt-${iid}" style="font-size:1.55rem;font-weight:700;letter-spacing:.22em;color:${bank.color};text-align:center;margin-bottom:.7rem;text-shadow:0 0 18px ${bank.color}">${roundTargets[0]}</div>
        <div id="hmi-${iid}" style="font-size:1.35rem;font-weight:700;letter-spacing:.22em;color:#4ade80;text-align:center;background:#0d1117;border:1px solid #1e2433;border-radius:6px;padding:.55rem;margin-bottom:.65rem;min-height:2.8rem;">${'_'.repeat(seqLen)}</div>
        <div id="hms-${iid}" style="font-size:.68rem;color:var(--text2);text-align:center;margin-bottom:.4rem;min-height:1.4em;">Type the sequence to breach the bank...</div>
        <div style="font-size:.6rem;color:var(--text3);text-align:center;">${timeMs/1000}s · ${rounds} round${rounds>1?'s':''} · ${seqLen} chars each</div>
        <button id="hmc-${iid}" style="position:absolute;top:.65rem;right:.65rem;background:none;border:1px solid #333;color:var(--text3);border-radius:4px;padding:.18rem .45rem;cursor:pointer;font-size:.62rem;">✕</button>
      </div>`;
      document.body.appendChild(ov);ov.setAttribute('tabindex','0');ov.focus();
      const updDisp=()=>{const el=ov.querySelector(`#hmi-${iid}`);if(el)el.textContent=(input||'').padEnd(seqLen,'_').slice(0,seqLen);};
      const finish=(success)=>{if(gameOver)return;gameOver=true;clearInterval(ti);document.removeEventListener('keydown',onKey);const sEl=ov.querySelector(`#hms-${iid}`);if(sEl){sEl.textContent=success?'✅ BREACH SUCCESSFUL! Extracting funds...':'❌ INTRUSION DETECTED! Access denied.';sEl.style.color=success?'#4ade80':'#f87171';}setTimeout(()=>{ov.remove();success?onWin():onLose();},1400);};
      const advance=()=>{curRound++;if(curRound>=rounds){finish(true);return;}input='';timeLeft=timeMs;const rEl=ov.querySelector(`#hmr-${iid}`),tEl=ov.querySelector(`#hmt-${iid}`),sEl=ov.querySelector(`#hms-${iid}`);if(rEl)rEl.textContent=curRound+1;if(tEl)tEl.textContent=roundTargets[curRound];if(sEl){sEl.textContent=`✅ Round ${curRound} done! Keep going!`;sEl.style.color='#4ade80';}updDisp();setTimeout(()=>{if(sEl&&!gameOver){sEl.textContent='Type the next sequence...';sEl.style.color='var(--text2)';}},900);};
      const ti=setInterval(()=>{if(gameOver){clearInterval(ti);return;}timeLeft-=100;const bar=ov.querySelector(`#hmb-${iid}`);if(bar){bar.style.width=(timeLeft/timeMs*100)+'%';if(timeLeft<=3000)bar.style.background='#f87171';}if(timeLeft<=0){clearInterval(ti);finish(false);}},100);
      const onKey=(e)=>{if(gameOver)return;if(e.key==='Escape'){finish(false);return;}const k=e.key.toUpperCase();if(!CHARS.includes(k)||input.length>=seqLen)return;input+=k;updDisp();if(input===roundTargets[curRound]){advance();}else if(input.length>=seqLen){const iEl=ov.querySelector(`#hmi-${iid}`);if(iEl){iEl.style.color='#f87171';setTimeout(()=>{if(iEl)iEl.style.color='#4ade80';},350);}input='';updDisp();if(diff>=2){roundTargets[curRound]=genSeq();const tEl=ov.querySelector(`#hmt-${iid}`);if(tEl)tEl.textContent=roundTargets[curRound];}}};
      document.addEventListener('keydown',onKey);
      ov.querySelector(`#hmc-${iid}`)?.addEventListener('click',()=>finish(false));
    };

    if(typeof Network!=='undefined'){
      const onBU=(d)=>{bankState={...bankState,...d};if(d.balance!==undefined&&typeof Economy!=='undefined'){Economy.state.balance=d.balance;Economy.save();Economy.updateWalletDisplay();}rerender();};
      const onInt=(d)=>{bankState.deposit=d.newDeposit;if(typeof OS!=='undefined')OS.notify('🏦','NormBank',`+$${fmt(d.amount)} interest!`);rerender();};
      const onLA=(d)=>{bankState.loan=d.loan;bankState.balance=d.newBalance;if(typeof Economy!=='undefined'){Economy.state.balance=d.newBalance;Economy.save();Economy.updateWalletDisplay();}if(typeof OS!=='undefined')OS.notify('🏦','Loan Approved',`$${fmt(d.loan.principal)} received!`);rerender();};
      const onLR=(d)=>{bankState.loan=null;bankState.creditScore=d.creditScore;bankState.balance=d.newBalance;if(typeof Economy!=='undefined'){Economy.state.balance=d.newBalance;Economy.save();Economy.updateWalletDisplay();}if(typeof OS!=='undefined')OS.notify('🏦','Loan',d.onTime?'Repaid on time! +50':'Late repayment -100');rerender();};
      const onLD=(d)=>{bankState.loan=null;bankState.balance=0;bankState.deposit=0;bankState.creditScore=d.creditScore;if(typeof Economy!=='undefined'){Economy.state.balance=0;Economy.save();Economy.updateWalletDisplay();}if(typeof OS!=='undefined')OS.notify('💀','LOAN DEFAULT','NormBank seized all assets!');rerender();};
      const onBE=(d)=>{if(typeof OS!=='undefined')OS.notify('🏦','Bank Error',d.message||'Error');};
      const onMbD=(msg)=>{if(!wrap.isConnected)return;if(msg.banks)multiBankData={...multiBankData,...msg.banks};rerender();};
      const onMbU=(msg)=>{if(!wrap.isConnected)return;if(msg.banks)multiBankData={...multiBankData,...msg.banks};if(msg.bankId&&msg.bankData)multiBankData[msg.bankId]=msg.bankData;if(msg.balance!==undefined&&typeof Economy!=='undefined'){Economy.state.balance=msg.balance;Economy.save();Economy.updateWalletDisplay();bankState.balance=msg.balance;}rerender();};
      const onMbI=(msg)=>{if(!wrap.isConnected)return;if(typeof OS!=='undefined')OS.notify(HACKABLE_BANKS[msg.bankId]?.icon||'🏦',msg.bankName,`+$${(msg.amount||0).toFixed(2)} interest!`);};
      const onMbH=(msg)=>{if(!wrap.isConnected)return;showToast(msg.success?`💰 Hacked ${msg.bankName}! Stole $${fmt(msg.stolen||0)}`:`❌ ${msg.reason||'Hack failed'}`,msg.success?'#4ade80':'#f87171');if(msg.newBalance!==undefined&&typeof Economy!=='undefined'){Economy.state.balance=msg.newBalance;Economy.save();Economy.updateWalletDisplay();bankState.balance=msg.newBalance;}if(msg.success)Network.send({type:'multibank:get'});};
      const onMbHacked=(msg)=>{if(!wrap.isConnected)return;if(typeof OS!=='undefined')OS.notify('💀','HACKED!',`${msg.by} stole $${(msg.lost||0).toFixed(2)} from your ${msg.bankName} deposit!`);};
      Network.on('bank:update',onBU);Network.on('bank:interest',onInt);Network.on('bank:loan:approved',onLA);Network.on('bank:loan:repaid',onLR);Network.on('bank:loan:defaulted',onLD);Network.on('bank:error',onBE);
      Network.on('multibank:data',onMbD);Network.on('multibank:update',onMbU);Network.on('multibank:interest',onMbI);Network.on('multibank:hack:result',onMbH);Network.on('multibank:hacked',onMbHacked);
      Network.send({type:'bank:get'});Network.send({type:'multibank:get'});
      wrap._cleanup=()=>{Network.off('bank:update',onBU);Network.off('bank:interest',onInt);Network.off('bank:loan:approved',onLA);Network.off('bank:loan:repaid',onLR);Network.off('bank:loan:defaulted',onLD);Network.off('bank:error',onBE);Network.off('multibank:data',onMbD);Network.off('multibank:update',onMbU);Network.off('multibank:interest',onMbI);Network.off('multibank:hack:result',onMbH);Network.off('multibank:hacked',onMbHacked);if(loanTimer)clearInterval(loanTimer);};
    }

    if(typeof Economy!=='undefined')bankState.balance=Economy.state.balance;

    if(!document.getElementById('mbank-styles')){
      const st=document.createElement('style');st.id='mbank-styles';
      st.textContent=`.bank-wrap{height:100%;overflow:hidden;background:var(--bg1)}.mbank-layout{display:flex;height:100%;overflow:hidden}.mbank-sidebar{width:215px;flex-shrink:0;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}.mbank-sidebar-title{font-size:.8rem;font-weight:700;padding:.75rem .85rem .5rem;border-bottom:1px solid var(--border);flex-shrink:0}.mbank-cash-card{padding:.6rem .85rem;border-bottom:1px solid var(--border);flex-shrink:0}.mbc-label{font-size:.6rem;color:var(--text3)}.mbc-val{font-size:1.1rem;font-weight:700;color:#4ade80;font-family:var(--font-mono)}.mbank-tabs{flex:1;overflow-y:auto;padding:.3rem 0}.mbank-tab{display:flex;align-items:center;gap:.4rem;padding:.5rem .7rem;cursor:pointer;border-left:3px solid transparent;transition:background .12s,border-color .12s}.mbank-tab:hover{background:var(--bg3)}.mbank-tab.active{background:var(--bg3);border-left-color:var(--btc,var(--accent))}.mbt-info{flex:1;min-width:0}.mbt-name{font-size:.7rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mbt-sub{font-size:.56rem;color:var(--text3)}.mbt-dep{font-size:.62rem;font-family:var(--font-mono);flex-shrink:0}.mbank-global{padding:.45rem .75rem;border-top:1px solid var(--border);flex-shrink:0}.mbg-title{font-size:.56rem;color:var(--text3);text-transform:uppercase;margin-bottom:.25rem}.mbg-row{display:flex;justify-content:space-between;font-size:.62rem;color:var(--text2);padding:.1rem 0}.mbank-main{flex:1;overflow-y:auto;min-width:0}.mbank-central{padding:.9rem;max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:.8rem}.mbc-header{text-align:center;padding:.9rem;background:var(--bg2);border-radius:8px;border:1px solid var(--border)}.mbc-logo{font-size:1.05rem;font-weight:700}.mbc-tagline{font-size:.62rem;color:var(--text3);margin-top:3px;font-style:italic}.mbc-cards{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}.mbc-card{background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:9px}.mbc-card-label{font-size:.56rem;color:var(--text3);margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em}.mbc-card-val{font-size:.88rem;font-weight:700;font-family:monospace}.mbc-card-sub{font-size:.56rem;color:var(--text3);margin-top:3px}.mbc-score-bar-wrap{background:var(--bg1);border-radius:3px;height:4px;overflow:hidden;margin:4px 0 3px}.mbc-score-bar{height:100%;border-radius:3px;transition:width .4s}.mbc-section{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:7px}.mbc-section-title{font-size:.78rem;font-weight:700}.mbc-row{display:flex;gap:6px;flex-wrap:wrap}.mbc-input{flex:1;min-width:80px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;color:var(--text1);font-size:.78rem;padding:6px 8px}.mbc-btn{border:none;border-radius:5px;padding:6px 12px;font-size:.72rem;cursor:pointer;font-weight:600;white-space:nowrap}.mbc-btn:hover:not(.disabled){opacity:.85}.mbc-btn.green{background:#4ade80;color:#000}.mbc-btn.blue{background:#4f9eff;color:#fff}.mbc-btn.accent{background:var(--accent);color:#fff}.mbc-btn.disabled{background:var(--bg3);color:var(--text3);cursor:not-allowed}.mbc-hint{font-size:.62rem;color:var(--text3);line-height:1.5}.mbc-loan-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.mbc-lstat{background:var(--bg1);border:1px solid var(--border);border-radius:5px;padding:6px 9px}.mbc-ls-l{font-size:.56rem;color:var(--text3);margin-bottom:2px}.mbc-ls-v{font-size:.82rem;font-weight:600}.mbc-bar-wrap{background:var(--bg1);border-radius:3px;height:5px;overflow:hidden}.bank-loan-bar{height:100%;transition:width 1s linear;border-radius:3px}.mbc-loan-info{background:var(--bg1);border:1px solid var(--border);border-radius:6px;padding:9px;display:flex;flex-direction:column;gap:4px}.mbc-loan-main{display:flex;align-items:center;justify-content:space-between}.mbc-tier-ladder{display:flex;flex-direction:column;gap:3px;margin-top:5px}.mbc-tier-label{font-size:.6rem;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}.mbc-tier-row{display:flex;align-items:center;gap:7px;padding:4px 7px;border-radius:4px;font-size:.65rem;background:var(--bg1);border:1px solid var(--border)}.mbc-tier-row.unlocked{border-color:rgba(74,222,128,.2)}.mbc-tier-row.locked{opacity:.4}.mbank-hackable{padding:.85rem;display:flex;flex-direction:column;gap:.75rem}.mbh-header{display:flex;align-items:center;gap:.65rem;padding-bottom:.7rem;border-bottom:2px solid var(--bcolor,var(--accent))}.mbh-name{font-size:.92rem;font-weight:700}.mbh-tagline{font-size:.6rem;color:var(--text3);font-style:italic;margin-top:2px}.mbh-sec{margin-left:auto;font-size:.85rem}.mbh-stats{display:flex;gap:.55rem}.mbh-stat{flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:.55rem;text-align:center}.mbhs-label{font-size:.56rem;color:var(--text3);margin-bottom:2px}.mbhs-val{font-size:.9rem;font-weight:700;font-family:var(--font-mono)}.mbhs-sub{font-size:.56rem;color:var(--text3);margin-top:2px}.mbh-body{display:grid;grid-template-columns:1fr 1fr;gap:.65rem;min-height:0}.mbh-col{background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:.7rem;display:flex;flex-direction:column;gap:.35rem;min-width:0}.mbh-col-title{font-size:.72rem;font-weight:700;margin-bottom:.15rem}.mbh-row{display:flex;gap:.35rem}.mbh-input{flex:1;min-width:50px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;color:var(--text1);font-size:.75rem;padding:.32rem .48rem}.mbh-btn{border:none;border-radius:5px;padding:.32rem .6rem;font-size:.68rem;cursor:pointer;font-weight:600;color:#fff;white-space:nowrap;transition:opacity .12s}.mbh-btn:hover:not(:disabled){opacity:.85}.mbh-quick{display:flex;gap:.22rem;flex-wrap:wrap}.mbh-qbtn{font-size:.58rem;padding:.18rem .38rem;background:var(--bg1);border:1px solid var(--border);border-radius:3px;cursor:pointer;color:var(--text2);transition:border-color .12s}.mbh-qbtn:hover{border-color:var(--bcolor,var(--accent));color:var(--bcolor,var(--accent))}.mbh-fee-note{font-size:.58rem;color:var(--text3)}.mbh-msg{font-size:.62rem;min-height:.9em}.mbh-lb-title{font-size:.68rem;font-weight:600;margin-top:.2rem;padding-top:.45rem;border-top:1px solid var(--border)}.mbh-lb-row{display:flex;align-items:center;gap:.3rem;padding:.18rem 0;font-size:.62rem}.mbh-lb-rank{width:1.2rem;flex-shrink:0}.mbh-lb-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mbh-lb-amt{font-family:var(--font-mono);font-weight:600;flex-shrink:0}.mbh-lb-pct{font-size:.56rem;color:var(--text3);width:2.6rem;text-align:right;flex-shrink:0}.mbh-hack-info{background:var(--bg1);border:1px solid var(--border);border-radius:5px;padding:.45rem;display:flex;flex-direction:column;gap:.18rem}.mbhhi-row{display:flex;justify-content:space-between;font-size:.6rem;color:var(--text2)}.mbh-hack-rules{font-size:.58rem;color:var(--text3);display:flex;flex-direction:column;gap:.15rem}.mbh-hack-btn{width:100%;padding:.6rem;background:linear-gradient(135deg,#7f1d1d,#dc2626);color:#fff;border:1px solid #f87171;border-radius:7px;cursor:pointer;font-size:.78rem;font-weight:700;letter-spacing:1px;transition:transform .1s,box-shadow .1s;margin-top:auto}.mbh-hack-btn:hover:not(:disabled){transform:scale(1.02);box-shadow:0 4px 18px rgba(220,38,38,.4)}.mbh-hack-btn:disabled{opacity:.4;cursor:not-allowed}.mbh-cooldown{text-align:center;font-size:.7rem;color:var(--text3);padding:.6rem;background:var(--bg1);border-radius:6px;border:1px solid var(--border);margin-top:auto}.mbh-cd-num{color:#f87171;font-weight:700;font-family:var(--font-mono)}`;
      document.head.appendChild(st);
    }

    render();
    return wrap;
  }
};
