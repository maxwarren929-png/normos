/**
 * NormOS — apps/appstore.js
 * NormHub App Store
 */
const AppStoreApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'appstore-wrap';
    const iid = Math.random().toString(36).slice(2, 6);
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const fmt = (n) => Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const INSTALLS_KEY = 'normos_appstore_installs';
    const loadInstalls = () => { try { return JSON.parse(localStorage.getItem(INSTALLS_KEY) || '{}'); } catch { return {}; } };
    const saveInstalls = (i) => { try { localStorage.setItem(INSTALLS_KEY, JSON.stringify(i)); } catch {} };

    let installs = loadInstalls();
    let activeCategory = 'featured';
    let searchQuery = '';

    const APPS = [
      { id:'terminal',    name:'Terminal',         icon:'🖥️', cat:'system',  price:0,    rating:4.8, reviews:2341, desc:'Bash-like terminal with secrets, lore commands, and sudo weirdness.', publisher:'NormOS Core', builtIn:true, appId:'terminal' },
      { id:'stocks',      name:'NormStock',        icon:'📈', cat:'finance', price:0,    rating:4.9, reviews:8821, desc:'Real-time shared stock market. Your trades move prices for everyone.', publisher:'NormOS Core', builtIn:true, appId:'stocks' },
      { id:'casino',      name:'NormCasino',       icon:'🎰', cat:'games',   price:0,    rating:4.7, reviews:5512, desc:'Slots, blackjack, and coinflip. Real balance. Real losses.', publisher:'NormOS Core', builtIn:true, appId:'casino' },
      { id:'normtok',     name:'NormTok',          icon:'📱', cat:'social',  price:0,    rating:4.5, reviews:3201, desc:'Post short thoughts. Like and tip posts with real money.', publisher:'NormOS Core', builtIn:true, appId:'normtok' },
      { id:'miner',       name:'NormMiner',        icon:'⛏️', cat:'finance', price:0,    rating:4.2, reviews:1822, desc:'Passive NormCoin mining while the app is open.', publisher:'NormOS Core', builtIn:true, appId:'miner' },
      { id:'chat',        name:'NormChat',         icon:'💬', cat:'social',  price:0,    rating:4.6, reviews:9001, desc:'Multiplayer chat with channels and DMs.', publisher:'NormOS Core', builtIn:true, appId:'chat' },
      { id:'bank',        name:'NormBank Central', icon:'🏦', cat:'finance', price:0,    rating:4.5, reviews:2800, desc:'Deposits, loans, credit score, interest. Central banking for NormOS.', publisher:'NormBank Corp', builtIn:true, appId:'bank' },
      { id:'mail',        name:'NormMail',         icon:'📧', cat:'social',  price:0,    rating:4.4, reviews:1500, desc:'Real email between online users. Send money as attachments.', publisher:'NormOS Core', builtIn:true, appId:'mail' },
      { id:'paint',       name:'NormPaint',        icon:'🎨', cat:'creative',price:0,    rating:4.3, reviews:2100, desc:'Canvas drawing app with brushes and fill tool.', publisher:'NormOS Core', builtIn:true, appId:'paint' },
      { id:'leaderboard', name:'Leaderboard',      icon:'🏆', cat:'social',  price:0,    rating:4.7, reviews:6200, desc:'Global wealth rankings. Send money or viruses directly from the list.', publisher:'NormOS Core', builtIn:true, appId:'leaderboard' },
      { id:'firewall',    name:'NormFirewall',     icon:'🛡', cat:'system',  price:10000,rating:4.9, reviews:1203, desc:'Blocks ALL hacks for 5 minutes. Activates immediately on purchase.', publisher:'NormSec Inc', builtIn:false, appId:'firewall' },
      { id:'snake',       name:'Snake',            icon:'🐍', cat:'games',   price:500,  rating:4.5, reviews:2800, desc:'Classic snake game. Purchase to unlock.', publisher:'NormGame Studios', builtIn:false, appId:'snake' },
      { id:'cryptopet',   name:'CryptoPet',        icon:'🐱', cat:'games',   price:200,  rating:4.6, reviews:4400, desc:'Desktop tamagotchi. Feed it NormCoin. Neglect it and it judges you publicly.', publisher:'PetDev Corp', builtIn:false, appId:'miner' },
      { id:'voidtracker', name:'VOID Tracker Pro', icon:'🌑', cat:'finance', price:500,  rating:3.2, reviews:891,  desc:'Real-time VoidToken alerts. Crash predictions (60% wrong). Panic button included.', publisher:'VoidCorp Analytics', builtIn:false, appId:'stocks' },
      { id:'normdate',    name:'NormDate',         icon:'💘', cat:'social',  price:0,    rating:2.1, reviews:43,   desc:'Dating app for NormOS users. Matched by net worth. Currently 2 users.', publisher:'NormDate LLC', builtIn:false, appId:'leaderboard' },
      { id:'normdocs',    name:'NormDocs',         icon:'📄', cat:'system',  price:150,  rating:3.8, reviews:234,  desc:'Create and edit documents. Exports as .normdoc which nothing else can open.', publisher:'NormSoft', builtIn:false, appId:'texteditor' },
    ];

    const CATS = [
      { id:'featured', label:'⭐ Featured' },
      { id:'games',    label:'🎮 Games' },
      { id:'finance',  label:'💰 Finance' },
      { id:'social',   label:'👥 Social' },
      { id:'creative', label:'🎨 Creative' },
      { id:'system',   label:'⚙️ System' },
    ];

    wrap.innerHTML = `
      <div class="as-layout">
        <div class="as-sidebar">
          <div class="as-logo">🏪 NormHub</div>
          <input class="as-search" id="as-search-${iid}" placeholder="Search apps..." />
          <div class="as-nav">${CATS.map(c => `<div class="as-nav-item ${c.id === activeCategory ? 'active' : ''}" data-cat="${c.id}">${c.label}</div>`).join('')}</div>
          <div class="as-balance-box">
            <div style="font-size:0.6rem;color:var(--text3);">Your Balance</div>
            <div class="as-balance-val" id="as-bal-${iid}">$0.00</div>
          </div>
        </div>
        <div class="as-main" id="as-main-${iid}"></div>
      </div>`;

    const mainEl = wrap.querySelector(`#as-main-${iid}`);
    const balEl  = wrap.querySelector(`#as-bal-${iid}`);
    const refreshBal = () => { if (typeof Economy !== 'undefined') balEl.textContent = '$' + fmt(Economy.state.balance); };
    refreshBal();

    wrap.querySelector(`#as-search-${iid}`)?.addEventListener('input', function() { searchQuery = this.value.toLowerCase(); renderMain(); });
    wrap.querySelectorAll('.as-nav-item').forEach(el => {
      el.addEventListener('click', () => {
        wrap.querySelectorAll('.as-nav-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        activeCategory = el.dataset.cat;
        searchQuery = '';
        wrap.querySelector(`#as-search-${iid}`).value = '';
        renderMain();
      });
    });

    const stars = (r) => { const full = Math.floor(r), half = r % 1 >= 0.5; return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - Math.ceil(r)); };

    const renderMain = () => {
      let apps = searchQuery
        ? APPS.filter(a => a.name.toLowerCase().includes(searchQuery) || a.desc.toLowerCase().includes(searchQuery))
        : activeCategory === 'featured' ? APPS : APPS.filter(a => a.cat === activeCategory);

      mainEl.innerHTML = `<div class="as-content">
        ${activeCategory === 'featured' && !searchQuery ? `
          <div class="as-featured-banner">
            <div class="as-banner-title">🎰 NormCasino is live</div>
            <div class="as-banner-sub">Slots • Blackjack • Coinflip — real balance, real consequences</div>
            <button class="as-banner-btn" onclick="if(typeof OS!=='undefined')OS.apps.open('casino')">Open Now</button>
          </div>` : ''}
        <div class="as-section-title">${searchQuery ? 'Results for "' + esc(searchQuery) + '"' : (CATS.find(c => c.id === activeCategory)?.label || '')}</div>
        <div class="as-app-grid">
          ${apps.map(app => {
            const isInstalled = app.builtIn || installs[app.id];
            return `<div class="as-app-card">
              <div class="as-app-icon">${app.icon}</div>
              <div class="as-app-info">
                <div class="as-app-name">${esc(app.name)}</div>
                <div class="as-app-publisher">${esc(app.publisher)}</div>
                <div class="as-app-stars">${stars(app.rating)} <span style="color:var(--text3)">(${Number(app.reviews).toLocaleString()})</span></div>
                <div class="as-app-desc">${esc(app.desc)}</div>
              </div>
              <div class="as-app-actions">
                ${isInstalled && app.appId
                  ? `<button class="as-open-btn" data-openapp="${app.appId}">Open</button>`
                  : isInstalled
                    ? `<span class="as-installed-badge">✓ Installed</span>`
                    : `<button class="as-buy-btn" data-appid="${app.id}" data-price="${app.price}">${app.price === 0 ? 'Get' : '$' + fmt(app.price)}</button>`}
              </div>
            </div>`;
          }).join('')}
          ${!apps.length ? '<div class="as-empty">No apps found.</div>' : ''}
        </div>
      </div>`;

      mainEl.querySelectorAll('.as-open-btn').forEach(btn => {
        btn.addEventListener('click', () => { if (typeof OS !== 'undefined') OS.apps.open(btn.dataset.openapp); });
      });
      mainEl.querySelectorAll('.as-buy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const appId = btn.dataset.appid;
          const price = parseFloat(btn.dataset.price);
          const appDef = APPS.find(a => a.id === appId);
          if (!appDef) return;
          if (price > 0) {
            const bal = (typeof Economy !== 'undefined') ? Economy.state.balance : 0;
            if (bal < price) { if (typeof OS !== 'undefined') OS.notify('🏪', 'NormHub', 'Insufficient funds. Need $' + fmt(price)); return; }
            if (!confirm('Purchase ' + appDef.name + ' for $' + fmt(price) + '?')) return;
            if (typeof Economy !== 'undefined') { Economy.state.balance -= price; Economy.save(); if (typeof Economy.updateWalletDisplay === 'function') Economy.updateWalletDisplay(); }
            refreshBal();
          }
          // Firewall: activates immediately, consumable — don't mark as installed
          if (appId === 'firewall') {
            const until = Date.now() + 5 * 60 * 1000;
            try { localStorage.setItem('normos_firewall_until', String(until)); } catch {}
            if (typeof OS !== 'undefined') OS.notify('🛡', 'NormFirewall', '🔥 ACTIVE — All hacks blocked for 5 minutes!');
            renderMain(); return;
          }
          installs[appId] = true;
          saveInstalls(installs);
          if (typeof OS !== 'undefined') OS.notify('🏪', 'NormHub', appDef.name + ' installed!');
          if (appId === 'snake') {
            if (typeof OS !== 'undefined') OS.apps.open('snake');
          } else if (appDef.appId && typeof OS !== 'undefined') {
            OS.apps.open(appDef.appId);
          }
          renderMain();
        });
      });
    };

    renderMain();
    const balInt = setInterval(() => { if (!document.body.contains(wrap)) { clearInterval(balInt); return; } refreshBal(); }, 2000);

    if (!document.getElementById('appstore-styles')) {
      const s = document.createElement('style');
      s.id = 'appstore-styles';
      s.textContent = `
        .appstore-wrap{height:100%;overflow:hidden;background:var(--bg1);display:flex;flex-direction:column;}
        .as-layout{display:flex;height:100%;overflow:hidden;}
        .as-sidebar{width:175px;min-width:175px;background:var(--bg2);border-right:1px solid var(--border);padding:12px 8px;display:flex;flex-direction:column;gap:6px;}
        .as-logo{font-size:1rem;font-weight:bold;color:var(--text1);padding:4px 4px 10px;border-bottom:1px solid var(--border);}
        .as-search{background:var(--bg1);border:1px solid var(--border);border-radius:5px;color:var(--text1);font-size:0.75rem;padding:6px 8px;}
        .as-nav{display:flex;flex-direction:column;gap:2px;}
        .as-nav-item{padding:7px 10px;font-size:0.75rem;color:var(--text2);cursor:pointer;border-radius:5px;}
        .as-nav-item:hover,.as-nav-item.active{background:var(--accent);color:#fff;}
        .as-balance-box{margin-top:auto;background:var(--bg1);border:1px solid var(--border);border-radius:6px;padding:8px;text-align:center;}
        .as-balance-val{font-size:0.85rem;font-weight:bold;color:var(--green);font-family:monospace;}
        .as-main{flex:1;overflow-y:auto;}
        .as-content{padding:16px;}
        .as-featured-banner{background:linear-gradient(135deg,var(--accent),#7c3aed);border-radius:12px;padding:20px;margin-bottom:20px;color:#fff;}
        .as-banner-title{font-size:1.1rem;font-weight:bold;}
        .as-banner-sub{font-size:0.75rem;opacity:0.85;margin:4px 0 12px;}
        .as-banner-btn{background:#fff;color:var(--accent);border:none;border-radius:6px;padding:7px 18px;font-size:0.8rem;cursor:pointer;font-weight:700;}
        .as-section-title{font-size:0.75rem;font-weight:bold;color:var(--text2);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em;}
        .as-app-grid{display:flex;flex-direction:column;gap:8px;}
        .as-app-card{display:flex;align-items:flex-start;gap:12px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;}
        .as-app-card:hover{border-color:var(--accent);}
        .as-app-icon{font-size:2.2rem;min-width:44px;text-align:center;}
        .as-app-info{flex:1;}
        .as-app-name{font-size:0.88rem;font-weight:bold;color:var(--text1);}
        .as-app-publisher{font-size:0.65rem;color:var(--text3);margin-bottom:3px;}
        .as-app-stars{font-size:0.7rem;color:#facc15;margin-bottom:4px;}
        .as-app-desc{font-size:0.73rem;color:var(--text2);line-height:1.5;}
        .as-app-actions{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;min-width:76px;}
        .as-open-btn{background:var(--accent);color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:0.75rem;cursor:pointer;font-weight:600;white-space:nowrap;}
        .as-open-btn:hover{opacity:0.85;}
        .as-buy-btn{background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:0.75rem;cursor:pointer;color:var(--text1);font-weight:600;white-space:nowrap;}
        .as-buy-btn:hover{background:var(--accent);color:#fff;border-color:var(--accent);}
        .as-installed-badge{font-size:0.68rem;color:var(--green);font-weight:bold;}
        .as-empty{text-align:center;color:var(--text3);padding:40px;font-size:0.85rem;}
      `;
      document.head.appendChild(s);
    }
    return wrap;
  }
};
