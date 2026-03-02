/**
 * NormOS — apps/shop.js
 * NormShop — spend your NormBucks on cosmetics, themes, desktop items
 */

const ShopApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;background:var(--bg1);color:var(--text1);font-family:var(--font-mono,monospace);overflow:hidden;';

    const ITEMS = [
      // Themes
      { id: 'theme_blood',    cat: 'Themes',     name: 'Blood Moon',      icon: '🌑', price: 500,   desc: 'Dark red terminal aesthetic',        effect: 'theme', value: { '--accent':'#ef4444','--bg1':'#0d0000','--bg2':'#1a0000' } },
      { id: 'theme_matrix',   cat: 'Themes',     name: 'Matrix Mode',     icon: '💚', price: 750,   desc: 'Classic green on black hacker look',  effect: 'theme', value: { '--accent':'#22c55e','--bg1':'#000000','--bg2':'#0a0a0a','--text1':'#22c55e' } },
      { id: 'theme_gold',     cat: 'Themes',     name: 'Gold Standard',   icon: '🥇', price: 2000,  desc: 'For the wealthiest NormOS users',     effect: 'theme', value: { '--accent':'#f59e0b','--bg1':'#0a0800','--bg2':'#1a1200' } },
      { id: 'theme_void',     cat: 'Themes',     name: 'The Void',        icon: '🌑', price: 1337,  desc: 'Pure darkness. No refunds.',          effect: 'theme', value: { '--accent':'#7c3aed','--bg1':'#000000','--bg2':'#050505','--text1':'#a78bfa' } },
      { id: 'theme_ice',      cat: 'Themes',     name: 'Ice Cold',        icon: '🧊', price: 800,   desc: 'Cool blue interface',                effect: 'theme', value: { '--accent':'#67e8f9','--bg1':'#00060d','--bg2':'#001020' } },
      // Desktop Pets
      { id: 'pet_daemon',     cat: 'Desktop',    name: 'daemon.norm Pet', icon: '👾', price: 999,   desc: 'A tiny daemon that walks your desktop', effect: 'pet',   value: 'daemon' },
      { id: 'pet_cat',        cat: 'Desktop',    name: 'NormCat',         icon: '🐱', price: 500,   desc: 'A cat that sits on your windows',      effect: 'pet',   value: 'cat' },
      { id: 'pet_stonks',     cat: 'Desktop',    name: 'Stonks Guy',      icon: '📈', price: 1500,  desc: 'Appears when your portfolio is up',    effect: 'pet',   value: 'stonks' },
      // Username cosmetics
      { id: 'badge_hacker',   cat: 'Profile',    name: 'Hacker Badge',    icon: '💀', price: 300,   desc: 'Show [H4X] next to your name',         effect: 'badge', value: '[H4X]' },
      { id: 'badge_whale',    cat: 'Profile',    name: 'Whale Badge',     icon: '🐳', price: 5000,  desc: 'Show [WHALE] — for the rich',          effect: 'badge', value: '[WHALE]' },
      { id: 'badge_daemon',   cat: 'Profile',    name: 'Daemon Badge',    icon: '😈', price: 1337,  desc: 'Show [d.norm] — for the initiated',    effect: 'badge', value: '[d.norm]' },
      { id: 'badge_virus',    cat: 'Profile',    name: 'Virus Badge',     icon: '☣️', price: 800,   desc: 'Show [VX] — for virus deployers',       effect: 'badge', value: '[VX]' },
      // Virus upgrades
      { id: 'virus_miner',    cat: 'Arsenal',    name: 'Cryptominer',     icon: '⛏️', price: 1000,  desc: 'Unlock the miner virus type',          effect: 'unlock', value: 'virus_miner' },
      { id: 'virus_ransom',   cat: 'Arsenal',    name: 'Ransomware Kit',  icon: '🔐', price: 3000,  desc: 'Unlock ransomware — highest drain',    effect: 'unlock', value: 'virus_ransomware' },
      { id: 'virus_shield',   cat: 'Arsenal',    name: 'Virus Shield',    icon: '🛡️', price: 2000,  desc: 'Reduce virus damage by 50%',           effect: 'unlock', value: 'virus_shield' },
      // Vanity
      { id: 'wallpaper_space',cat: 'Wallpaper',  name: 'Space Wallpaper', icon: '🌌', price: 200,   desc: 'Animated starfield desktop background', effect: 'wallpaper', value: 'space' },
      { id: 'wallpaper_grid', cat: 'Wallpaper',  name: 'Grid Wallpaper',  icon: '⬛', price: 150,   desc: 'Classic terminal grid pattern',         effect: 'wallpaper', value: 'grid' },
      { id: 'wallpaper_rain', cat: 'Wallpaper',  name: 'Code Rain',       icon: '🟩', price: 600,   desc: 'Matrix-style falling code',             effect: 'wallpaper', value: 'rain' },
    ];

    const CATEGORIES = ['All', ...new Set(ITEMS.map(i => i.cat))];

    // ── Owned items (localStorage) ───────────────────────────────────────────
    const OWNED_KEY = 'normos_shop_owned';
    const getOwned  = () => { try { return JSON.parse(localStorage.getItem(OWNED_KEY) || '[]'); } catch { return []; } };
    const addOwned  = (id) => { const o = getOwned(); if (!o.includes(id)) { o.push(id); localStorage.setItem(OWNED_KEY, JSON.stringify(o)); } };
    const isOwned   = (id) => getOwned().includes(id);

    let activeCategory = 'All';
    let selectedItem   = null;

    const render = () => {
      const balance = typeof Economy !== 'undefined' ? Economy.state.balance : 0;
      wrap.innerHTML = `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <span style="font-size:1rem;font-weight:bold;color:var(--accent);">🛒 NormShop</span>
          <span style="font-size:0.78rem;color:#4ade80;">💰 $${typeof Economy !== 'undefined' ? Economy.fmt(balance) : '0.00'}</span>
        </div>
        <div style="display:flex;height:calc(100% - 49px);">
          <!-- Sidebar categories -->
          <div style="width:130px;border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0;padding:8px 0;">
            ${CATEGORIES.map(cat => `
              <div class="shop-cat ${cat === activeCategory ? 'shop-cat-active' : ''}" data-cat="${cat}"
                style="padding:8px 14px;cursor:pointer;font-size:0.72rem;color:${cat === activeCategory ? 'var(--accent)' : 'var(--text2)'};
                background:${cat === activeCategory ? 'var(--bg2)' : 'transparent'};border-left:2px solid ${cat === activeCategory ? 'var(--accent)' : 'transparent'};">
                ${cat}
              </div>
            `).join('')}
          </div>
          <!-- Items grid -->
          <div style="flex:1;overflow-y:auto;padding:12px;">
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;" id="shop-grid"></div>
          </div>
        </div>
      `;

      // Category switching
      wrap.querySelectorAll('.shop-cat').forEach(el => {
        el.addEventListener('click', () => { activeCategory = el.dataset.cat; render(); });
      });

      renderGrid(balance);
    };

    const renderGrid = (balance) => {
      const grid = wrap.querySelector('#shop-grid');
      if (!grid) return;
      const filtered = ITEMS.filter(i => activeCategory === 'All' || i.cat === activeCategory);

      grid.innerHTML = filtered.map(item => {
        const owned      = isOwned(item.id);
        const canAfford  = balance >= item.price;
        const isActive   = selectedItem?.id === item.id;
        return `
          <div class="shop-item" data-id="${item.id}" style="
            background:var(--bg2);border:1px solid ${isActive ? 'var(--accent)' : 'var(--border)'};
            border-radius:8px;padding:14px;cursor:pointer;transition:border-color 0.15s;
            ${owned ? 'opacity:0.8;' : ''}
          ">
            <div style="font-size:1.8rem;margin-bottom:6px;">${item.icon}</div>
            <div style="font-size:0.78rem;font-weight:bold;color:var(--text1);margin-bottom:2px;">${item.name}</div>
            <div style="font-size:0.65rem;color:var(--text3);margin-bottom:8px;min-height:28px;">${item.desc}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:0.72rem;color:${owned ? '#4ade80' : canAfford ? 'var(--accent)' : '#f87171'};">
                ${owned ? '✓ Owned' : '$' + item.price.toLocaleString()}
              </span>
              ${!owned ? `
                <button class="shop-buy-btn" data-id="${item.id}" style="
                  font-size:0.65rem;padding:3px 10px;border-radius:4px;border:none;cursor:${canAfford?'pointer':'not-allowed'};
                  background:${canAfford ? 'var(--accent)' : 'var(--border)'};
                  color:${canAfford ? '#000' : 'var(--text3)'};font-family:inherit;
                ">Buy</button>
              ` : `
                <button class="shop-equip-btn" data-id="${item.id}" style="
                  font-size:0.65rem;padding:3px 10px;border-radius:4px;border:1px solid var(--accent);cursor:pointer;
                  background:transparent;color:var(--accent);font-family:inherit;
                ">Equip</button>
              `}
            </div>
          </div>
        `;
      }).join('');

      // Item click → select
      grid.querySelectorAll('.shop-item').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.classList.contains('shop-buy-btn') || e.target.classList.contains('shop-equip-btn')) return;
          selectedItem = ITEMS.find(i => i.id === el.dataset.id);
          renderGrid(balance);
        });
      });

      // Buy button
      grid.querySelectorAll('.shop-buy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = ITEMS.find(i => i.id === btn.dataset.id);
          if (!item || typeof Economy === 'undefined') return;
          if (Economy.state.balance < item.price) {
            if (typeof OS !== 'undefined') OS.notify('🛒', 'NormShop', `Not enough funds. Need $${item.price.toLocaleString()}.`);
            return;
          }
          Economy.state.balance -= item.price;
          Economy.save();
          Economy.updateWalletDisplay();
          Network.syncEconomy?.();
          addOwned(item.id);
          applyItem(item);
          if (typeof OS !== 'undefined') OS.notify('🛒', 'NormShop', `Purchased: ${item.name}!`);
          render();
        });
      });

      // Equip button
      grid.querySelectorAll('.shop-equip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = ITEMS.find(i => i.id === btn.dataset.id);
          if (item) applyItem(item);
        });
      });
    };

    // ── Apply item effects ─────────────────────────────────────────────────
    const applyItem = (item) => {
      if (item.effect === 'theme') {
        Object.entries(item.value).forEach(([prop, val]) => {
          document.documentElement.style.setProperty(prop, val);
        });
        if (typeof OS !== 'undefined') OS.notify(item.icon, 'Theme Applied', item.name);
      }

      if (item.effect === 'wallpaper') {
        applyWallpaper(item.value);
      }

      if (item.effect === 'pet') {
        spawnPet(item.value, item.icon);
      }

      if (item.effect === 'badge') {
        localStorage.setItem('normos_badge', item.value);
        if (typeof OS !== 'undefined') OS.notify(item.icon, 'Badge Equipped', `Now showing ${item.value} in chat`);
      }

      if (item.effect === 'unlock') {
        const unlocks = JSON.parse(localStorage.getItem('normos_unlocks') || '[]');
        if (!unlocks.includes(item.value)) { unlocks.push(item.value); localStorage.setItem('normos_unlocks', JSON.stringify(unlocks)); }
        if (typeof OS !== 'undefined') OS.notify(item.icon, 'Unlocked!', item.name);
      }
    };

    const applyWallpaper = (type) => {
      const bg = document.getElementById('desktop-bg');
      if (!bg) return;

      if (type === 'space') {
        bg.style.background = '#000';
        bg.innerHTML = '<canvas id="wp-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;"></canvas>';
        const canvas = bg.querySelector('#wp-canvas');
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        const stars = Array.from({ length: 200 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.5, s: Math.random() * 0.5 + 0.1 }));
        const animStars = () => {
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          stars.forEach(s => {
            s.y += s.s; if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
            ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.random() * 0.5})`;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
          });
          requestAnimationFrame(animStars);
        };
        animStars();
      }

      if (type === 'grid') {
        bg.style.cssText = 'background: #050505;background-image: linear-gradient(rgba(79,158,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(79,158,255,0.1) 1px, transparent 1px);background-size: 30px 30px;';
        bg.innerHTML = '';
      }

      if (type === 'rain') {
        bg.style.background = '#000';
        bg.innerHTML = '<canvas id="wp-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0.3;"></canvas>';
        const canvas = bg.querySelector('#wp-canvas');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        const cols = Math.floor(canvas.width / 14);
        const drops = Array(cols).fill(1);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
        const animRain = () => {
          ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.fillStyle = '#22c55e'; ctx.font = '12px monospace';
          drops.forEach((y, i) => {
            ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * 14, y * 14);
            if (y * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
          });
          requestAnimationFrame(animRain);
        };
        animRain();
      }
    };

    const spawnPet = (type, icon) => {
      const existing = document.getElementById('desktop-pet');
      if (existing) existing.remove();
      const pet = document.createElement('div');
      pet.id = 'desktop-pet';
      pet.style.cssText = 'position:fixed;bottom:50px;left:20px;font-size:1.5rem;cursor:pointer;z-index:9000;user-select:none;transition:left 0.5s,bottom 0.5s;';
      pet.textContent = icon;
      pet.title = 'Your NormOS pet!';
      document.body.appendChild(pet);
      // Random walk
      setInterval(() => {
        const x = Math.random() * (window.innerWidth - 60);
        const y = Math.random() * 100 + 50;
        pet.style.left   = x + 'px';
        pet.style.bottom = y + 'px';
      }, 3000);
    };

    // Auto-equip previously owned items on open
    const owned = getOwned();
    owned.forEach(id => {
      const item = ITEMS.find(i => i.id === id);
      if (item && (item.effect === 'theme' || item.effect === 'wallpaper')) applyItem(item);
    });

    render();

    // Refresh balance display when economy changes
    let unsub = null;
    if (typeof Economy !== 'undefined') {
      unsub = Economy.onChange(() => { if (wrap.isConnected) render(); });
    }

    wrap._shopCleanup = () => { if (unsub) unsub(); };

    return wrap;
  },
};