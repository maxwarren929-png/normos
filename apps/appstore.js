/**
 * NormOS — apps/normshop.js
 * NormShop: Buy hacks, backgrounds, and other upgrades
 */

const AppStoreApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;height:100%;background:var(--bg1);color:var(--text1);font-family:var(--font-mono,monospace);overflow:hidden;';

    const getUnlocks = () => { try { return JSON.parse(localStorage.getItem('normos_unlocks') || '[]'); } catch { return []; } };
    const addUnlock  = (id) => { const u=getUnlocks(); if(!u.includes(id)){u.push(id);try{localStorage.setItem('normos_unlocks',JSON.stringify(u));}catch{}} };
    const hasUnlock  = (id) => getUnlocks().includes(id);
    const fmt = (n) => '$' + Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');

    const CATEGORIES = ['All','🦠 Hacks','🖼 Backgrounds','⚙️ Upgrades'];

    const ITEMS = [
      // ── Hacks ────────────────────────────────────────────────────────────────
      {
        id:'virus_generic', cat:'🦠 Hacks', name:'Generic Virus', icon:'🦠',
        price:0, desc:'Basic balance drain (5%). Comes free with your account.',
        free:true,
      },
      {
        id:'virus_glitch', cat:'🦠 Hacks', name:'Glitch Bomb', icon:'👾',
        price:800, desc:'Causes screen glitch on target + 2% drain. Annoying and stylish.',
      },
      {
        id:'virus_miner', cat:'🦠 Hacks', name:'Crypto Miner', icon:'⛏️',
        price:2500, desc:'Secretly mines from target for 15 seconds, draining 10% over time.',
      },
      {
        id:'virus_ransomware', cat:'🦠 Hacks', name:'Ransomware', icon:'🔐',
        price:8000, desc:'Heavy instant hit — drains 25% of target\'s balance. Use wisely.',
      },
      // ── Backgrounds ──────────────────────────────────────────────────────────
      {
        id:'bg_matrix', cat:'🖼 Backgrounds', name:'Matrix Rain', icon:'🟩',
        price:500, desc:'Animated green code rain. Yes, we went there.',
        bgClass:'wp-matrix',
      },
      {
        id:'bg_synthwave', cat:'🖼 Backgrounds', name:'Synthwave Sunset', icon:'🌅',
        price:750, desc:'Neon purple and pink retro grid. For when you feel like the 80s.',
        bgClass:'wp-synthwave',
      },
      {
        id:'bg_space', cat:'🖼 Backgrounds', name:'Deep Space', icon:'🌌',
        price:600, desc:'Starfield with slow nebula drift. Very calming. Very expensive.',
        bgClass:'wp-space',
      },
      {
        id:'bg_rain', cat:'🖼 Backgrounds', name:'Rainy Window', icon:'🌧️',
        price:400, desc:'Cozy rain streaks on a dark window. Perfect for the vibe.',
        bgClass:'wp-rain',
      },
      // ── Upgrades ────────────────────────────────────────────────────────────
      {
        id:'firewall_basic', cat:'⚙️ Upgrades', name:'Basic Firewall', icon:'🔥',
        price:1200, desc:'Blocks ALL incoming hacks for 10 minutes. One-time use per purchase.',
        consumable:true,
      },
      {
        id:'interest_boost', cat:'⚙️ Upgrades', name:'Interest Booster', icon:'📈',
        price:3000, desc:'Doubles your deposit interest rate for 1 hour. Stack your gains.',
        consumable:true,
      },
      {
        id:'hack_cooldown_reset', cat:'⚙️ Upgrades', name:'Cooldown Reset', icon:'⏱️',
        price:500, desc:'Instantly resets all your hack cooldowns. Strike again immediately.',
        consumable:true,
      },
    ];

    let activeCategory = 'All';
    let msgMap = {};

    const render = () => {
      const balance = typeof Economy !== 'undefined' ? Economy.state.balance : 0;
      wrap.innerHTML = `
        <div style="width:160px;border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0;">
          <div style="padding:12px 14px;font-size:0.9rem;font-weight:bold;color:var(--accent);border-bottom:1px solid var(--border);">🛒 NormShop</div>
          ${CATEGORIES.map(c=>`
            <div class="nshop-nav" data-cat="${esc(c)}" style="padding:9px 14px;cursor:pointer;font-size:0.78rem;
              color:${activeCategory===c?'var(--text1)':'var(--text2)'};
              background:${activeCategory===c?'var(--bg2)':'transparent'};
              border-bottom:1px solid var(--border);">${esc(c)}</div>
          `).join('')}
          <div style="padding:12px 14px;margin-top:8px;border-top:1px solid var(--border);">
            <div style="font-size:0.62rem;color:var(--text3);margin-bottom:3px;">YOUR BALANCE</div>
            <div style="font-size:0.85rem;font-weight:bold;color:#4ade80;" id="nshop-bal">${fmt(balance)}</div>
          </div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:16px;">
          <div style="font-size:0.85rem;font-weight:bold;color:var(--text1);margin-bottom:14px;">${activeCategory === 'All' ? '🛒 All Items' : activeCategory}</div>
          <div id="nshop-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;"></div>
        </div>
      `;

      wrap.querySelectorAll('.nshop-nav').forEach(el => {
        el.addEventListener('click', () => { activeCategory = el.dataset.cat; render(); });
      });

      const grid = wrap.querySelector('#nshop-grid');
      const visible = ITEMS.filter(item => activeCategory === 'All' || item.cat === activeCategory);

      visible.forEach(item => {
        const owned = hasUnlock(item.id);
        const canAfford = balance >= item.price;
        const card = document.createElement('div');
        card.style.cssText = `background:var(--bg2);border:1px solid ${owned?'#4ade80':canAfford?'var(--border)':'var(--border)'};border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:8px;`;
        card.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.8rem;">${item.icon}</span>
            <div>
              <div style="font-size:0.82rem;font-weight:bold;color:var(--text1);">${esc(item.name)}</div>
              <div style="font-size:0.62rem;color:var(--text3);">${item.cat}</div>
            </div>
          </div>
          <div style="font-size:0.72rem;color:var(--text2);line-height:1.5;">${esc(item.desc)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:auto;">
            <span style="font-size:0.85rem;font-weight:bold;color:${item.price===0?'#4ade80':'#f59e0b'};">${item.price===0?'FREE':fmt(item.price)}</span>
            ${owned && !item.consumable
              ? `<span style="font-size:0.72rem;color:#4ade80;font-weight:bold;">✅ Owned</span>`
              : `<button class="nshop-buy-btn" data-id="${item.id}" style="padding:5px 14px;background:${canAfford||item.price===0?'var(--accent)':'var(--bg3)'};color:${canAfford||item.price===0?'#000':'var(--text3)'};border:none;border-radius:5px;cursor:${canAfford||item.price===0?'pointer':'not-allowed'};font-size:0.72rem;font-weight:bold;font-family:inherit;">
                ${item.consumable?'🛒 Use':'🛒 Buy'}
              </button>`
            }
          </div>
          <div class="nshop-msg" data-id="${item.id}" style="font-size:0.68rem;min-height:16px;color:#4ade80;"></div>
        `;
        grid.appendChild(card);
      });

      grid.querySelectorAll('.nshop-buy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = ITEMS.find(i => i.id === btn.dataset.id);
          if (!item) return;
          const msgEl = grid.querySelector(`.nshop-msg[data-id="${item.id}"]`);
          const bal = typeof Economy !== 'undefined' ? Economy.state.balance : 0;

          if (item.price === 0 || item.free) {
            addUnlock(item.id);
            if (msgEl) { msgEl.textContent = '✅ Added to your arsenal!'; msgEl.style.color = '#4ade80'; }
            setTimeout(render, 800);
            return;
          }

          if (bal < item.price) {
            if (msgEl) { msgEl.textContent = `❌ Need ${fmt(item.price)}`; msgEl.style.color = '#f87171'; }
            return;
          }

          // Deduct balance
          if (typeof Economy !== 'undefined') { Economy.state.balance -= item.price; Economy.save(); Economy.updateWalletDisplay(); }
          if (typeof Network !== 'undefined' && Network.isConnected()) {
            Network.send({ type: 'shop:purchase', itemId: item.id, price: item.price });
          }

          // Apply effect
          if (item.bgClass) {
            try { localStorage.setItem('normos_wallpaper', item.bgClass); } catch {}
            const bg = document.getElementById('desktop-bg');
            if (bg) bg.className = 'desktop-bg ' + item.bgClass;
          }

          if (item.id === 'firewall_basic') {
            try { localStorage.setItem('normos_firewall_until', String(Date.now() + 600000)); } catch {}
            if (typeof OS !== 'undefined') OS.notify('🔥','Firewall','Active for 10 minutes!');
          }

          if (item.id === 'interest_boost') {
            try { localStorage.setItem('normos_interest_boost_until', String(Date.now() + 3600000)); } catch {}
            if (typeof OS !== 'undefined') OS.notify('📈','Interest Boost','Double interest for 1 hour!');
          }

          if (item.id === 'hack_cooldown_reset') {
            // Clear all hack cooldown timestamps
            try {
              const keys = Object.keys(localStorage).filter(k => k.startsWith('normos_hackcd_'));
              keys.forEach(k => localStorage.removeItem(k));
            } catch {}
            // Tell server to reset our cooldowns
            if (typeof Network !== 'undefined') Network.send({ type: 'hack:cooldown:reset' });
            if (typeof OS !== 'undefined') OS.notify('⏱️','Cooldowns','All hack cooldowns reset!');
          }

          if (!item.consumable) addUnlock(item.id);

          if (msgEl) { msgEl.textContent = '✅ Purchased!'; msgEl.style.color = '#4ade80'; }
          if (typeof OS !== 'undefined') OS.notify('🛒','NormShop',`Purchased ${item.name}!`);
          setTimeout(render, 800);
        });
      });
    };

    // Listen for balance updates to refresh the balance display
    if (typeof Network !== 'undefined') {
      const onBal = () => {
        const balEl = wrap.querySelector('#nshop-bal');
        if (balEl && typeof Economy !== 'undefined') balEl.textContent = fmt(Economy.state.balance);
      };
      Network.on('economy:balance:update', onBal);
      Network.on('market:trade:ok', onBal);
      Network.on('bank:update', onBal);
      wrap._shopCleanup = () => {
        Network.off('economy:balance:update', onBal);
        Network.off('market:trade:ok', onBal);
        Network.off('bank:update', onBal);
      };
    }

    render();

    // Add animated backgrounds CSS if not already present
    if (!document.getElementById('normshop-bg-styles')) {
      const st = document.createElement('style');
      st.id = 'normshop-bg-styles';
      st.textContent = `
        .desktop-bg.wp-matrix { background: #000; }
        .desktop-bg.wp-matrix::before { content:''; position:absolute; inset:0; background: repeating-linear-gradient(0deg, rgba(0,255,0,0.03) 0px, rgba(0,255,0,0.03) 1px, transparent 1px, transparent 20px); animation: matrix-scroll 8s linear infinite; }
        @keyframes matrix-scroll { 0%{background-position:0 0} 100%{background-position:0 400px} }

        .desktop-bg.wp-synthwave { background: linear-gradient(180deg, #0d0221 0%, #1a0533 40%, #3d0066 60%, #ff6ec7 100%); }
        .desktop-bg.wp-synthwave::before { content:''; position:absolute; inset:0; background: repeating-linear-gradient(90deg,rgba(255,110,199,0.1) 0px,transparent 1px,transparent 80px), repeating-linear-gradient(0deg,rgba(255,110,199,0.1) 0px,transparent 1px,transparent 80px); }

        .desktop-bg.wp-space { background: #000; }
        .desktop-bg.wp-space::before { content:''; position:absolute; inset:0; background: radial-gradient(ellipse at 20% 50%, rgba(120,0,255,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(0,80,255,0.1) 0%, transparent 40%); }
        .desktop-bg.wp-space::after { content:''; position:absolute; inset:0; background-image: radial-gradient(1px 1px at 10% 20%, #fff 0%, transparent 100%), radial-gradient(1px 1px at 30% 70%, rgba(255,255,255,0.8) 0%, transparent 100%), radial-gradient(1px 1px at 60% 10%, #fff 0%, transparent 100%), radial-gradient(1px 1px at 80% 50%, rgba(255,255,255,0.6) 0%, transparent 100%), radial-gradient(1px 1px at 50% 90%, #fff 0%, transparent 100%), radial-gradient(1.5px 1.5px at 15% 40%, rgba(200,200,255,0.9) 0%, transparent 100%), radial-gradient(1px 1px at 90% 80%, #fff 0%, transparent 100%), radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,0.7) 0%, transparent 100%); }

        .desktop-bg.wp-rain { background: linear-gradient(180deg, #0a1628 0%, #0d1f3c 100%); }
        .desktop-bg.wp-rain::before { content:''; position:absolute; inset:0; background: repeating-linear-gradient(105deg, transparent, transparent 2px, rgba(100,150,255,0.04) 2px, rgba(100,150,255,0.04) 3px); animation: rain-fall 0.8s linear infinite; background-size: 30px 80px; }
        @keyframes rain-fall { 0%{background-position:0 0} 100%{background-position:-30px 80px} }
      `;
      document.head.appendChild(st);
    }

    return wrap;
  }
};
