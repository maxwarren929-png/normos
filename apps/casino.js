/**
 * NormOS — apps/casino.js
 * NormCasino: Slots, Blackjack, Coinflip. Real balance. Real danger.
 */

const CasinoApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'height:100%;display:flex;flex-direction:column;background:var(--bg1);overflow:hidden;';
    const iid = 'c' + Math.random().toString(36).slice(2, 7);

    const fmt    = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const bal    = () => (typeof Economy !== 'undefined') ? Economy.state.balance : 0;
    const debit  = n => { if (typeof Economy !== 'undefined') { Economy.state.balance -= n; Economy.save(); if (Economy.updateWalletDisplay) Economy.updateWalletDisplay(); } };
    const credit = n => { if (typeof Economy !== 'undefined') { Economy.state.balance += n; Economy.save(); if (Economy.updateWalletDisplay) Economy.updateWalletDisplay(); } };
    const broadcast = msg => { try { if (typeof Network !== 'undefined') Network.sendChat('#general', `🎰 CASINO: ${msg}`); } catch {} };

    let activeGame = 'slots';
    let spinning   = false;
    let bjState    = null;
    let histItems  = [];

    wrap.innerHTML = `
      <div style="display:flex;height:100%;overflow:hidden;">
        <div style="width:155px;min-width:155px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:12px 8px;gap:6px;">
          <div style="font-size:1rem;font-weight:800;color:var(--text1);padding-bottom:8px;border-bottom:1px solid var(--border);">🎰 NormCasino</div>
          <div style="font-size:0.6rem;color:var(--text3);font-style:italic;line-height:1.4;">"The house always wins.<br>You are not the house."</div>
          <div id="${iid}nav" style="display:flex;flex-direction:column;gap:2px;margin-top:4px;">
            <div data-g="slots"     style="padding:7px 10px;font-size:0.75rem;cursor:pointer;border-radius:5px;background:var(--accent);color:#fff;">🎰 Slots</div>
            <div data-g="blackjack" style="padding:7px 10px;font-size:0.75rem;cursor:pointer;border-radius:5px;color:var(--text2);">🃏 Blackjack</div>
            <div data-g="coinflip"  style="padding:7px 10px;font-size:0.75rem;cursor:pointer;border-radius:5px;color:var(--text2);">🪙 Coinflip</div>
          </div>
          <div style="background:var(--bg1);border:1px solid var(--border);border-radius:6px;padding:8px;text-align:center;margin-top:auto;">
            <div style="font-size:0.58rem;color:var(--text3);text-transform:uppercase;">Balance</div>
            <div id="${iid}bal" style="font-size:0.88rem;font-weight:bold;color:var(--green);font-family:monospace;">${fmt(bal())}</div>
          </div>
          <div style="font-size:0.62rem;color:var(--text3);text-transform:uppercase;margin-top:4px;">Recent</div>
          <div id="${iid}hist" style="display:flex;flex-direction:column;gap:1px;font-size:0.63rem;overflow-y:auto;max-height:130px;"></div>
        </div>
        <div id="${iid}main" style="flex:1;overflow-y:auto;padding:20px;display:flex;align-items:flex-start;justify-content:center;"></div>
      </div>`;

    const mainEl = wrap.querySelector(`#${iid}main`);
    const balEl  = wrap.querySelector(`#${iid}bal`);
    const histEl = wrap.querySelector(`#${iid}hist`);

    const refreshBal = () => { balEl.textContent = fmt(bal()); };
    const addHist = (txt, win) => {
      histItems.unshift({ txt, win });
      if (histItems.length > 10) histItems.pop();
      histEl.innerHTML = histItems.map(h => `<div style="color:${h.win?'var(--green)':'var(--red)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h.txt}</div>`).join('');
    };

    wrap.querySelectorAll(`#${iid}nav [data-g]`).forEach(el => {
      el.addEventListener('click', () => {
        wrap.querySelectorAll(`#${iid}nav [data-g]`).forEach(e => { e.style.background=''; e.style.color='var(--text2)'; });
        el.style.background = 'var(--accent)'; el.style.color = '#fff';
        activeGame = el.dataset.g;
        bjState = null;
        renderGame();
      });
    });

    // ── Shared helpers ─────────────────────────────────────────────────────
    const betRow = (id, def, presets) => `
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:10px 0;">
        <span style="font-size:0.72rem;color:var(--text2);">Bet $</span>
        <input id="${id}" type="number" value="${def}" min="1" style="width:80px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;color:var(--text1);font-size:0.8rem;padding:4px 8px;"/>
        ${presets.map(p=>`<button onclick="this.closest('[id]').querySelector('#${id}').value=${p}" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:3px 7px;font-size:0.68rem;cursor:pointer;color:var(--text1);">${p>=1000?'$'+(p/1000)+'k':'$'+p}</button>`).join('')}
      </div>`;

    const bigBtn = (id, lbl, bg='var(--accent)') =>
      `<button id="${id}" style="background:${bg};color:#fff;border:none;border-radius:8px;padding:10px 0;font-size:0.9rem;cursor:pointer;font-weight:700;width:100%;margin-top:6px;">${lbl}</button>`;

    // ════════════════════════════════════════════════════════════════════════
    // SLOTS
    // ════════════════════════════════════════════════════════════════════════
    const SYM  = ['🍒','🍋','🍊','🍇','⭐','💎','🔔','7️⃣','💀','🌙'];
    const WGHT = [  25,   20,   18,   15,   10,    5,    4,    2,   1,  0.5];
    const PAYS = {
      '🍒🍒🍒':3,'🍋🍋🍋':4,'🍊🍊🍊':5,'🍇🍇🍇':6,
      '⭐⭐⭐':10,'🔔🔔🔔':15,'💎💎💎':25,'7️⃣7️⃣7️⃣':50,
      '💀💀💀':0.1,'🌙🌙🌙':100,
      '🍒🍒_':1.5,'⭐⭐_':2,'💎💎_':4,
    };
    const pickSym = () => {
      let r = Math.random() * WGHT.reduce((a,b)=>a+b,0);
      for (let i=0;i<SYM.length;i++){r-=WGHT[i];if(r<=0)return SYM[i];}
      return SYM[0];
    };
    const calcPay = (reels, bet) => {
      const k=reels.join('');
      if (PAYS[k]!=null) return bet*PAYS[k];
      const k2=reels[0]+reels[1]+'_';
      if (reels[0]===reels[1]&&PAYS[k2]!=null) return bet*PAYS[k2];
      return 0;
    };

    const renderSlots = () => {
      mainEl.innerHTML = `
        <div style="width:100%;max-width:480px;">
          <div style="font-size:1.1rem;font-weight:bold;margin-bottom:16px;">🎰 Slot Machine</div>
          <div style="display:flex;gap:12px;justify-content:center;margin:20px 0;">
            ${[0,1,2].map(i=>`<div id="${iid}r${i}" style="width:80px;height:80px;background:var(--bg2);border:2px solid var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:2.2rem;">🎰</div>`).join('')}
          </div>
          <div id="${iid}smsg" style="text-align:center;font-size:0.9rem;min-height:26px;margin:6px 0;">Pull to spin!</div>
          ${betRow(`${iid}sbet`,10,[10,50,100,500])}
          ${bigBtn(`${iid}spin`,'🎰 SPIN')}
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:10px;margin-top:16px;">
            <div style="font-size:0.68rem;font-weight:bold;color:var(--text2);margin-bottom:6px;">PAY TABLE</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;">
              ${Object.entries(PAYS).filter(([k])=>!k.includes('_')).map(([k,v])=>`
                <div style="display:flex;justify-content:space-between;font-size:0.65rem;padding:2px 4px;">
                  <span>${k}</span><span style="color:${v>=50?'var(--accent)':'var(--green)'}">${v}×</span>
                </div>`).join('')}
            </div>
          </div>
        </div>`;

      wrap.querySelector(`#${iid}spin`).addEventListener('click', () => {
        if (spinning) return;
        const bet = parseFloat(wrap.querySelector(`#${iid}sbet`).value)||10;
        const msgEl = wrap.querySelector(`#${iid}smsg`);
        if (bet<=0||bet>bal()){msgEl.textContent=bet>bal()?'Insufficient funds!':'Invalid bet.';return;}
        debit(bet); refreshBal();
        spinning = true;
        wrap.querySelector(`#${iid}spin`).disabled = true;
        msgEl.textContent = 'Spinning...';
        const rEls = [0,1,2].map(i=>wrap.querySelector(`#${iid}r${i}`));
        const final = [pickSym(),pickSym(),pickSym()];
        let tick=0, total=18;
        const go = () => {
          tick++;
          if (tick<total) {
            rEls.forEach((el,i)=>{if(tick<total-i*3)el.textContent=SYM[Math.floor(Math.random()*SYM.length)];else el.textContent=final[i];});
            setTimeout(go, 55+tick*5);
          } else {
            rEls.forEach((el,i)=>el.textContent=final[i]);
            spinning=false; wrap.querySelector(`#${iid}spin`).disabled=false;
            const pay=calcPay(final,bet);
            if(pay>0){
              credit(pay); refreshBal();
              msgEl.innerHTML=`<span style="color:var(--green)">WIN! +${fmt(pay)} (${(pay/bet).toFixed(1)}×)</span>`;
              addHist(`+${fmt(pay)} slots`,true);
              if(pay>=bet*25){const who=typeof OS!=='undefined'?OS.state.username:'Someone';broadcast(`${who} hit ${final.join('')} for ${fmt(pay)} on Slots! 🎉`);}
            } else {
              msgEl.innerHTML=`<span style="color:var(--red)">Lost ${fmt(bet)}. Again.</span>`;
              addHist(`-${fmt(bet)} slots`,false);
            }
          }
        };
        go();
      });
    };

    // ════════════════════════════════════════════════════════════════════════
    // BLACKJACK
    // ════════════════════════════════════════════════════════════════════════
    const CVALS={A:11,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:10,Q:10,K:10};
    const SUITS=['♠','♥','♦','♣'], RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const mkDeck = ()=>SUITS.flatMap(s=>RANKS.map(r=>({r,s}))).sort(()=>Math.random()-.5);
    const draw   = d=>d.pop();
    const hval   = h=>{let t=h.reduce((s,c)=>s+CVALS[c.r],0),a=h.filter(c=>c.r==='A').length;while(t>21&&a-->0)t-=10;return t;};
    const cardEl = (c,hidden=false)=>hidden
      ? `<div style="width:44px;height:62px;background:#2563eb;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;color:#fff;border:1px solid #555;flex-shrink:0;">🂠</div>`
      : `<div style="width:44px;height:62px;background:#fff;border-radius:5px;display:flex;flex-direction:column;justify-content:space-between;padding:3px 4px;border:1px solid #aaa;font-size:0.78rem;font-weight:bold;color:${c.s==='♥'||c.s==='♦'?'#c0392b':'#111'};flex-shrink:0;"><div>${c.r}</div><div style="align-self:center;">${c.s}</div></div>`;

    const renderBJ = () => {
      if (!bjState) {
        mainEl.innerHTML = `
          <div style="width:100%;max-width:480px;">
            <div style="font-size:1.1rem;font-weight:bold;margin-bottom:8px;">🃏 Blackjack</div>
            <div style="font-size:0.75rem;color:var(--text2);margin-bottom:16px;">Beat the dealer to 21 without going over. Blackjack pays 2.5×.</div>
            ${betRow(`${iid}bjbet`,25,[25,100,250,500])}
            ${bigBtn(`${iid}bjdeal`,'🃏 Deal Cards')}
          </div>`;
        wrap.querySelector(`#${iid}bjdeal`).addEventListener('click',()=>{
          const bet=parseFloat(wrap.querySelector(`#${iid}bjbet`).value)||25;
          if(bet>bal()){if(typeof OS!=='undefined')OS.notify('🃏','Blackjack','Insufficient funds!');return;}
          debit(bet);refreshBal();
          const d=mkDeck();
          bjState={d,bet,player:[draw(d),draw(d)],dealer:[draw(d),draw(d)],done:false};
          renderBJ();
        });
        return;
      }
      const pv=hval(bjState.player),dv=hval(bjState.dealer);
      mainEl.innerHTML=`
        <div style="width:100%;max-width:480px;">
          <div style="font-size:1.1rem;font-weight:bold;margin-bottom:12px;">🃏 Blackjack — Bet: ${fmt(bjState.bet)}</div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;">
            <div style="font-size:0.7rem;color:var(--text2);margin-bottom:6px;">Dealer ${bjState.done?'('+dv+')':''}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">${bjState.dealer.map((c,i)=>cardEl(c,!bjState.done&&i===1)).join('')}</div>
          </div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px;">
            <div style="font-size:0.7rem;color:var(--text2);margin-bottom:6px;">You (${pv})</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">${bjState.player.map(c=>cardEl(c)).join('')}</div>
          </div>
          <div id="${iid}bjmsg" style="text-align:center;font-size:0.88rem;min-height:24px;margin-bottom:8px;">${bjState.resultMsg||''}</div>
          ${!bjState.done?`
            <div style="display:flex;gap:8px;">
              <button id="${iid}bjhit"   style="flex:1;padding:9px;background:#4ade80;border:none;border-radius:6px;font-size:0.82rem;font-weight:700;cursor:pointer;color:#111;">Hit</button>
              <button id="${iid}bjstand" style="flex:1;padding:9px;background:#f87171;border:none;border-radius:6px;font-size:0.82rem;font-weight:700;cursor:pointer;color:#111;">Stand</button>
              ${bjState.player.length===2&&bal()>=bjState.bet?`<button id="${iid}bjdbl" style="flex:1;padding:9px;background:#facc15;border:none;border-radius:6px;font-size:0.82rem;font-weight:700;cursor:pointer;color:#111;">Double</button>`:''}
            </div>`:`<button id="${iid}bjnew" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.88rem;font-weight:700;cursor:pointer;margin-top:4px;">New Hand</button>`}
        </div>`;

      const bjStand=()=>{
        while(hval(bjState.dealer)<17)bjState.dealer.push(draw(bjState.d));
        const pv2=hval(bjState.player),dv2=hval(bjState.dealer);
        bjState.done=true;
        if(pv2>21){bjState.resultMsg=`<span style="color:var(--red)">Bust! Lost ${fmt(bjState.bet)}</span>`;addHist(`-${fmt(bjState.bet)} BJ`,false);}
        else if(dv2>21||pv2>dv2){
          const nat=pv2===21&&bjState.player.length===2;
          const pay=bjState.bet*(nat?2.5:2);
          credit(pay);refreshBal();
          bjState.resultMsg=`<span style="color:var(--green)">${nat?'Blackjack! ':''}Won ${fmt(pay-bjState.bet)}</span>`;
          addHist(`+${fmt(pay-bjState.bet)} BJ`,true);
          if(pay>=2000)broadcast(`${typeof OS!=='undefined'?OS.state.username:'Someone'} won ${fmt(pay-bjState.bet)} at Blackjack! 🃏`);
        } else if(pv2===dv2){credit(bjState.bet);refreshBal();bjState.resultMsg='Push — bet returned';addHist('$0 BJ push',false);}
        else{bjState.resultMsg=`<span style="color:var(--red)">Dealer wins. Lost ${fmt(bjState.bet)}</span>`;addHist(`-${fmt(bjState.bet)} BJ`,false);}
        renderBJ();
      };

      if(!bjState.done){
        wrap.querySelector(`#${iid}bjhit`)?.addEventListener('click',()=>{bjState.player.push(draw(bjState.d));if(hval(bjState.player)>=21)bjStand();else renderBJ();});
        wrap.querySelector(`#${iid}bjstand`)?.addEventListener('click',bjStand);
        wrap.querySelector(`#${iid}bjdbl`)?.addEventListener('click',()=>{debit(bjState.bet);bjState.bet*=2;refreshBal();bjState.player.push(draw(bjState.d));bjStand();});
      } else {
        wrap.querySelector(`#${iid}bjnew`)?.addEventListener('click',()=>{bjState=null;renderBJ();});
      }
    };

    // ════════════════════════════════════════════════════════════════════════
    // COINFLIP
    // ════════════════════════════════════════════════════════════════════════
    const renderCoinflip = () => {
      mainEl.innerHTML = `
        <div style="width:100%;max-width:400px;text-align:center;">
          <div style="font-size:1.1rem;font-weight:bold;margin-bottom:8px;">🪙 Coinflip</div>
          <div id="${iid}coin" style="font-size:5rem;margin:20px 0;">🪙</div>
          <div id="${iid}cfmsg" style="font-size:0.88rem;min-height:24px;margin-bottom:8px;">Choose heads or tails.</div>
          ${betRow(`${iid}cfbet`,50,[50,200,500,1000])}
          <div style="display:flex;gap:12px;justify-content:center;margin:10px 0;">
            <button id="${iid}heads" style="flex:1;padding:10px;background:var(--bg2);border:2px solid var(--border);border-radius:8px;font-size:0.88rem;font-weight:600;cursor:pointer;color:var(--text1);">👑 Heads</button>
            <button id="${iid}tails" style="flex:1;padding:10px;background:var(--bg2);border:2px solid var(--border);border-radius:8px;font-size:0.88rem;font-weight:600;cursor:pointer;color:var(--text1);">🪙 Tails</button>
          </div>
          <div id="${iid}cfresult"></div>
          <div style="margin-top:16px;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;font-size:0.7rem;color:var(--text3);">50/50 odds. Pays 2×. Wins over $5,000 are announced to all users.</div>
        </div>`;

      const flip = choice => {
        const bet=parseFloat(wrap.querySelector(`#${iid}cfbet`).value)||50;
        const msgEl=wrap.querySelector(`#${iid}cfmsg`);
        if(bet>bal()){msgEl.textContent='Insufficient funds!';return;}
        debit(bet);refreshBal();
        const coinEl=wrap.querySelector(`#${iid}coin`);
        wrap.querySelector(`#${iid}heads`).disabled=true;
        wrap.querySelector(`#${iid}tails`).disabled=true;
        let t=0;
        const spin=setInterval(()=>{
          coinEl.textContent=t%2===0?'👑':'🪙';t++;
          if(t>14){
            clearInterval(spin);
            const result=Math.random()<0.5?'heads':'tails';
            coinEl.textContent=result==='heads'?'👑':'🪙';
            wrap.querySelector(`#${iid}heads`).disabled=false;
            wrap.querySelector(`#${iid}tails`).disabled=false;
            if(result===choice){
              credit(bet*2);refreshBal();
              msgEl.innerHTML=`<span style="color:var(--green)">Correct! Won ${fmt(bet)}</span>`;
              addHist(`+${fmt(bet)} flip`,true);
              if(bet>=5000)broadcast(`${typeof OS!=='undefined'?OS.state.username:'Someone'} flipped ${fmt(bet)} and won! 🪙`);
            } else {
              msgEl.innerHTML=`<span style="color:var(--red)">Wrong! ${result==='heads'?'👑':'🪙'} Lost ${fmt(bet)}</span>`;
              addHist(`-${fmt(bet)} flip`,false);
            }
          }
        },80);
      };
      wrap.querySelector(`#${iid}heads`)?.addEventListener('click',()=>flip('heads'));
      wrap.querySelector(`#${iid}tails`)?.addEventListener('click',()=>flip('tails'));
    };

    const renderGame = () => {
      if (activeGame==='slots') renderSlots();
      else if (activeGame==='blackjack') renderBJ();
      else renderCoinflip();
    };

    renderGame();
    const balTick = setInterval(()=>{if(!document.body.contains(wrap)){clearInterval(balTick);return;}refreshBal();},1500);
    return wrap;
  }
};