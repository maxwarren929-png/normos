/**
 * NormOS — apps/settings.js
 */
const SettingsApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'settings-wrap';
    const iid = Math.random().toString(36).slice(2, 6);
    let activeSection = 'appearance';

    const SECTIONS = [
      { id:'appearance', icon:'🎨', label:'Appearance' },
      { id:'account',    icon:'👤', label:'Account' },
      { id:'system',     icon:'⚙️', label:'System' },
      { id:'privacy',    icon:'🔒', label:'Privacy' },
      { id:'about',      icon:'ℹ️',  label:'About' },
    ];
    const THEMES = [
      { id:'dark',    label:'Dark',    preview:'#1a1a2e' },
      { id:'light',   label:'Light',   preview:'#f0f0f0' },
      { id:'dracula', label:'Dracula', preview:'#282a36' },
      { id:'nord',    label:'Nord',    preview:'#2e3440' },
      { id:'mocha',   label:'Mocha',   preview:'#1e1e2e' },
      { id:'hacker',  label:'Hacker',  preview:'#0d1117' },
      { id:'sunset',  label:'Sunset',  preview:'#2d1b33' },
    ];
    const WALLPAPERS = [
      { id:'',         label:'Default', emoji:'⬛' },
      { id:'wp-grid',  label:'Grid',    emoji:'⊞'  },
      { id:'wp-dots',  label:'Dots',    emoji:'⠿'  },
      { id:'wp-stars', label:'Stars',   emoji:'✨' },
      { id:'wp-city',  label:'Neon City',emoji:'🌆'},
      { id:'wp-void',  label:'The Void',emoji:'🌑' },
    ];
    const ACCENTS = [
      { id:'',       color:'#4f9eff', label:'Blue'   },
      { id:'green',  color:'#4ade80', label:'Green'  },
      { id:'purple', color:'#a78bfa', label:'Purple' },
      { id:'orange', color:'#fb923c', label:'Orange' },
      { id:'red',    color:'#f87171', label:'Red'    },
      { id:'yellow', color:'#facc15', label:'Yellow' },
      { id:'pink',   color:'#f472b6', label:'Pink'   },
      { id:'cyan',   color:'#22d3ee', label:'Cyan'   },
    ];
    const FONT_SIZES = [
      { id:'',   label:'Default (13px)' },
      { id:'sm', label:'Small (11px)'   },
      { id:'lg', label:'Large (15px)'   },
      { id:'xl', label:'X-Large (17px)' },
    ];

    const getSetting = (k, def) => { try { return localStorage.getItem(k) || def || ''; } catch { return def || ''; } };
    const setSetting = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
    const notify = (msg) => { if (typeof OS !== 'undefined') OS.notify('⚙️', 'Settings', msg, 2500); };

    wrap.innerHTML = `
      <div class="stg-layout">
        <div class="stg-sidebar">
          <div class="stg-title">⚙️ Settings</div>
          ${SECTIONS.map(s => `<div class="stg-nav-item ${s.id === activeSection ? 'active' : ''}" data-sec="${s.id}"><span>${s.icon}</span> ${s.label}</div>`).join('')}
        </div>
        <div class="stg-main" id="stg-main-${iid}"></div>
      </div>`;

    const mainEl = wrap.querySelector(`#stg-main-${iid}`);

    wrap.querySelectorAll('.stg-nav-item').forEach(el => {
      el.addEventListener('click', () => {
        wrap.querySelectorAll('.stg-nav-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        activeSection = el.dataset.sec;
        renderSection();
      });
    });

    const renderSection = () => {
      if (activeSection === 'appearance') renderAppearance();
      else if (activeSection === 'account') renderAccount();
      else if (activeSection === 'system') renderSystem();
      else if (activeSection === 'privacy') renderPrivacy();
      else if (activeSection === 'about') renderAbout();
    };

    const renderAppearance = () => {
      const curTheme  = (() => { try { return JSON.parse(localStorage.getItem('normos_state') || '{}').theme || 'dark'; } catch { return 'dark'; } })();
      const curWp     = getSetting('normos_wallpaper');
      const curAccent = getSetting('normos_accent');
      const curFs     = getSetting('normos_fontsize');
      const curClock  = getSetting('normos_widget_clock', 'true');

      mainEl.innerHTML = `<div class="stg-content">
        <div class="stg-section-title">🎨 Theme</div>
        <div class="stg-theme-grid">${THEMES.map(t => `<div class="stg-theme-item ${t.id === curTheme ? 'active' : ''}" data-theme="${t.id}"><div class="stg-theme-preview" style="background:${t.preview};"></div><span>${t.label}</span></div>`).join('')}</div>
        <div class="stg-section-title" style="margin-top:16px;">🖼 Wallpaper</div>
        <div class="stg-wp-grid">${WALLPAPERS.map(w => `<div class="stg-wp-item ${w.id === curWp ? 'active' : ''}" data-wp="${w.id}"><div class="stg-wp-preview">${w.emoji}</div><span>${w.label}</span></div>`).join('')}</div>
        <div class="stg-section-title" style="margin-top:16px;">🔵 Accent Color</div>
        <div class="stg-accent-row">${ACCENTS.map(a => `<div class="stg-accent-dot ${a.id === curAccent ? 'active' : ''}" data-accent="${a.id}" title="${a.label}" style="background:${a.color};"></div>`).join('')}</div>
        <div class="stg-section-title" style="margin-top:16px;">🔠 Font Size</div>
        <select class="stg-select" id="stg-fs-${iid}">${FONT_SIZES.map(f => `<option value="${f.id}" ${f.id === curFs ? 'selected' : ''}>${f.label}</option>`).join('')}</select>
        <div class="stg-section-title" style="margin-top:16px;">🕐 Desktop Clock</div>
        <div class="stg-toggle-row"><span class="stg-toggle-label">Show clock on desktop</span><label class="stg-toggle"><input type="checkbox" id="stg-clock-${iid}" ${curClock !== 'false' ? 'checked' : ''}><span class="stg-toggle-slider"></span></label></div>
      </div>`;

      mainEl.querySelectorAll('.stg-theme-item').forEach(el => {
        el.addEventListener('click', () => {
          mainEl.querySelectorAll('.stg-theme-item').forEach(e => e.classList.remove('active'));
          el.classList.add('active');
          if (typeof OS !== 'undefined') OS.setTheme(el.dataset.theme);
          notify('Theme updated');
        });
      });
      mainEl.querySelectorAll('.stg-wp-item').forEach(el => {
        el.addEventListener('click', () => {
          mainEl.querySelectorAll('.stg-wp-item').forEach(e => e.classList.remove('active'));
          el.classList.add('active');
          const wp = el.dataset.wp;
          setSetting('normos_wallpaper', wp);
          const bg = document.getElementById('desktop-bg');
          if (bg) bg.className = 'desktop-bg' + (wp ? ' ' + wp : '');
          notify('Wallpaper updated');
        });
      });
      mainEl.querySelectorAll('.stg-accent-dot').forEach(el => {
        el.addEventListener('click', () => {
          mainEl.querySelectorAll('.stg-accent-dot').forEach(e => e.classList.remove('active'));
          el.classList.add('active');
          const acc = el.dataset.accent;
          setSetting('normos_accent', acc);
          document.body.dataset.accent = acc;
          notify('Accent color updated');
        });
      });
      mainEl.querySelector(`#stg-fs-${iid}`)?.addEventListener('change', function() {
        setSetting('normos_fontsize', this.value);
        document.body.dataset.fontsize = this.value;
        notify('Font size updated');
      });
      mainEl.querySelector(`#stg-clock-${iid}`)?.addEventListener('change', function() {
        setSetting('normos_widget_clock', this.checked ? 'true' : 'false');
        if (typeof OS !== 'undefined') OS.toggleClockWidget();
        notify(this.checked ? 'Clock widget enabled' : 'Clock widget hidden');
      });
    };

    const renderAccount = () => {
      const username = (typeof OS !== 'undefined' && OS.state) ? OS.state.username : 'Norm';
      const profile = (() => { try { return JSON.parse(localStorage.getItem('normos_profile') || '{}'); } catch { return {}; } })();
      const avatar = profile.avatar || '🧑';
      const bio = profile.bio || '';
      const status = getSetting('normos_status');

      mainEl.innerHTML = `<div class="stg-content">
        <div class="stg-section-title">👤 Username</div>
        <div class="stg-input-row"><input class="stg-input" id="stg-uname-${iid}" value="${username}" maxlength="20"/><button class="stg-btn" id="stg-uname-save-${iid}">Save</button></div>
        <div class="stg-section-title" style="margin-top:16px;">😊 Avatar Emoji</div>
        <div class="stg-input-row"><input class="stg-input" id="stg-avatar-${iid}" value="${avatar}" maxlength="4" style="width:70px;font-size:1.2rem;text-align:center;"/><button class="stg-btn" id="stg-avatar-save-${iid}">Save</button></div>
        <div class="stg-section-title" style="margin-top:16px;">✍️ Bio</div>
        <textarea class="stg-textarea" id="stg-bio-${iid}" maxlength="160" placeholder="Tell the world who you are...">${bio}</textarea>
        <button class="stg-btn" id="stg-bio-save-${iid}" style="margin-top:6px;">Save Bio</button>
        <div class="stg-section-title" style="margin-top:16px;">💬 Status Message</div>
        <div class="stg-input-row"><input class="stg-input" id="stg-status-${iid}" value="${status}" maxlength="60" placeholder="📈 Going all in on VOID"/><button class="stg-btn" id="stg-status-save-${iid}">Save</button></div>
        <div class="stg-section-title" style="margin-top:16px;">⚠️ Danger Zone</div>
        <button class="stg-btn danger" id="stg-reset-${iid}">Reset All Economy Data</button>
        <div style="font-size:0.68rem;color:var(--text3);margin-top:6px;">Clears balance, portfolio, and history. Cannot be undone.</div>
      </div>`;

      mainEl.querySelector(`#stg-uname-save-${iid}`)?.addEventListener('click', () => {
        const val = mainEl.querySelector(`#stg-uname-${iid}`).value.trim();
        if (!val) return;
        if (typeof OS !== 'undefined') { OS.state.username = val; OS.saveState(); }
        if (typeof Network !== 'undefined') Network.setUsername(val);
        notify('Username changed to ' + val);
      });
      mainEl.querySelector(`#stg-avatar-save-${iid}`)?.addEventListener('click', () => {
        const val = mainEl.querySelector(`#stg-avatar-${iid}`).value.trim();
        if (!val) return;
        try { const p = JSON.parse(localStorage.getItem('normos_profile') || '{}'); p.avatar = val; localStorage.setItem('normos_profile', JSON.stringify(p)); } catch {}
        notify('Avatar updated!');
      });
      mainEl.querySelector(`#stg-bio-save-${iid}`)?.addEventListener('click', () => {
        const val = mainEl.querySelector(`#stg-bio-${iid}`).value;
        try { const p = JSON.parse(localStorage.getItem('normos_profile') || '{}'); p.bio = val; localStorage.setItem('normos_profile', JSON.stringify(p)); } catch {}
        notify('Bio saved!');
      });
      mainEl.querySelector(`#stg-status-save-${iid}`)?.addEventListener('click', () => {
        setSetting('normos_status', mainEl.querySelector(`#stg-status-${iid}`).value);
        notify('Status updated!');
      });
      mainEl.querySelector(`#stg-reset-${iid}`)?.addEventListener('click', () => {
        if (!confirm('Reset ALL economy data? Cannot be undone.')) return;
        if (typeof Economy !== 'undefined') { Economy.state.balance = 10000; Economy.state.portfolio = {}; Economy.state.txHistory = []; Economy.save(); if (typeof Economy.updateWalletDisplay === 'function') Economy.updateWalletDisplay(); }
        notify('Economy reset. Starting balance: $10,000');
      });
    };

    const renderSystem = () => {
      mainEl.innerHTML = `<div class="stg-content">
        <div class="stg-section-title">🖥 System Info</div>
        <div class="stg-info-grid">
          <div class="stg-info-row"><span>OS Version</span><span>NormOS v3.1</span></div>
          <div class="stg-info-row"><span>Kernel</span><span>norm_core 3.1.0</span></div>
          <div class="stg-info-row"><span>Shell</span><span>normbash 1.0</span></div>
          <div class="stg-info-row"><span>localStorage used</span><span>${(JSON.stringify(localStorage).length / 1024).toFixed(1)} KB</span></div>
          <div class="stg-info-row"><span>daemon.norm</span><span style="color:var(--red)">Running (always)</span></div>
        </div>
        <div class="stg-section-title" style="margin-top:16px;">⚡ Quick Actions</div>
        <div class="stg-action-row">
          <button class="stg-btn" onclick="if(typeof OS!=='undefined')OS.apps.open('terminal')">Terminal</button>
          <button class="stg-btn" onclick="if(typeof OS!=='undefined')OS.apps.open('sysmon')">Sys Monitor</button>
          <button class="stg-btn" onclick="if(typeof OS!=='undefined')OS.apps.open('files')">Files</button>
        </div>
        <div class="stg-section-title" style="margin-top:16px;">🔄 Power</div>
        <div class="stg-action-row">
          <button class="stg-btn danger" onclick="if(typeof EventBus!=='undefined')EventBus.emit('os:reboot')">Reboot NormOS</button>
          <button class="stg-btn danger" onclick="location.reload()">Hard Reload</button>
        </div>
      </div>`;
    };

    const renderPrivacy = () => {
      mainEl.innerHTML = `<div class="stg-content">
        <div class="stg-section-title">🌐 Network & Sharing</div>
        <div class="stg-toggle-row"><span class="stg-toggle-label">Show on leaderboard</span><label class="stg-toggle"><input type="checkbox" id="stg-lb-${iid}" ${getSetting('normos_show_lb', 'true') !== 'false' ? 'checked' : ''}><span class="stg-toggle-slider"></span></label></div>
        <div class="stg-toggle-row" style="margin-top:10px;"><span class="stg-toggle-label">Allow virus attacks</span><label class="stg-toggle"><input type="checkbox" id="stg-virus-${iid}" ${getSetting('normos_allow_virus', 'true') !== 'false' ? 'checked' : ''}><span class="stg-toggle-slider"></span></label></div>
        <div class="stg-section-title" style="margin-top:16px;">🗑 Clear Data</div>
        <div class="stg-action-row" style="flex-direction:column;align-items:flex-start;gap:8px;">
          <button class="stg-btn danger" id="stg-clear-hist-${iid}">Clear App History</button>
          <button class="stg-btn danger" id="stg-clear-bm-${iid}">Clear Browser Bookmarks</button>
          <button class="stg-btn danger" id="stg-clear-fr-${iid}">Clear Friends List</button>
        </div>
      </div>`;
      mainEl.querySelector(`#stg-lb-${iid}`)?.addEventListener('change', function() { setSetting('normos_show_lb', this.checked ? 'true' : 'false'); notify('Setting saved'); });
      mainEl.querySelector(`#stg-virus-${iid}`)?.addEventListener('change', function() { setSetting('normos_allow_virus', this.checked ? 'true' : 'false'); notify('Setting saved'); });
      mainEl.querySelector(`#stg-clear-hist-${iid}`)?.addEventListener('click', () => { if (!confirm('Clear history?')) return; if (typeof OS !== 'undefined') { OS.state.recentApps = []; OS.saveState(); } notify('History cleared'); });
      mainEl.querySelector(`#stg-clear-bm-${iid}`)?.addEventListener('click', () => { if (!confirm('Clear bookmarks?')) return; setSetting('normos_bookmarks', '[]'); notify('Bookmarks cleared'); });
      mainEl.querySelector(`#stg-clear-fr-${iid}`)?.addEventListener('click', () => { if (!confirm('Clear friends?')) return; setSetting('normos_friends', '[]'); notify('Friends cleared'); });
    };

    const renderAbout = () => {
      mainEl.innerHTML = `<div class="stg-content" style="text-align:center;">
        <div style="font-size:3rem;margin:20px 0 8px;">⬡</div>
        <div style="font-size:1.4rem;font-weight:bold;">NormOS v3.1</div>
        <div style="font-size:0.75rem;color:var(--text3);margin-top:4px;">norm_core kernel · 29 apps installed</div>
        <div style="font-size:0.7rem;color:var(--text3);font-style:italic;margin-top:4px;">"Personal Computing for the Slightly Confused"</div>
        <div style="margin-top:20px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:left;">
          <div class="stg-section-title">💀 daemon.norm</div>
          <div style="font-size:0.78rem;color:var(--text2);line-height:1.7;">PID: [REDACTED] · Memory: ∞ · Status: <span style="color:var(--green)">Active</span><br><span style="color:var(--text3);font-style:italic;">It says hello.</span></div>
        </div>
        <div style="margin-top:12px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:left;">
          <div class="stg-section-title">📦 Installed Apps</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            ${Object.entries((typeof OS !== 'undefined' && OS.appRegistry) ? OS.appRegistry : {}).map(([id, def]) => `<div style="font-size:0.72rem;padding:4px 6px;background:var(--bg1);border-radius:4px;cursor:pointer;" onclick="if(typeof OS!=='undefined')OS.apps.open('${id}')">${def.icon} ${def.title}</div>`).join('')}
          </div>
        </div>
      </div>`;
    };

    renderSection();

    if (!document.getElementById('settings-styles')) {
      const s = document.createElement('style');
      s.id = 'settings-styles';
      s.textContent = `
        .settings-wrap{height:100%;overflow:hidden;background:var(--bg1);display:flex;flex-direction:column;}
        .stg-layout{display:flex;height:100%;overflow:hidden;}
        .stg-sidebar{width:175px;min-width:175px;background:var(--bg2);border-right:1px solid var(--border);padding:14px 10px;display:flex;flex-direction:column;gap:4px;}
        .stg-title{font-size:0.9rem;font-weight:bold;color:var(--text1);padding:4px 8px 12px;border-bottom:1px solid var(--border);margin-bottom:6px;}
        .stg-nav-item{display:flex;align-items:center;gap:8px;padding:8px 10px;font-size:0.78rem;color:var(--text2);cursor:pointer;border-radius:6px;}
        .stg-nav-item:hover,.stg-nav-item.active{background:var(--accent);color:#fff;}
        .stg-main{flex:1;overflow-y:auto;}
        .stg-content{padding:16px;display:flex;flex-direction:column;gap:6px;}
        .stg-section-title{font-size:0.7rem;font-weight:bold;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;padding-bottom:6px;border-bottom:1px solid var(--border);}
        .stg-theme-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px;margin-top:6px;}
        .stg-theme-item{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;padding:6px;border-radius:6px;border:2px solid transparent;font-size:0.7rem;color:var(--text2);}
        .stg-theme-item:hover,.stg-theme-item.active{border-color:var(--accent);color:var(--text1);}
        .stg-theme-preview{width:52px;height:32px;border-radius:4px;border:1px solid var(--border);}
        .stg-wp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px;margin-top:6px;}
        .stg-wp-item{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;padding:6px;border-radius:6px;border:2px solid transparent;font-size:0.7rem;color:var(--text2);}
        .stg-wp-item:hover,.stg-wp-item.active{border-color:var(--accent);color:var(--text1);}
        .stg-wp-preview{width:52px;height:32px;border-radius:4px;background:var(--bg2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.1rem;}
        .stg-accent-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;}
        .stg-accent-dot{width:28px;height:28px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform 0.1s;}
        .stg-accent-dot:hover,.stg-accent-dot.active{border-color:#fff;transform:scale(1.15);}
        .stg-select{background:var(--bg2);border:1px solid var(--border);border-radius:5px;color:var(--text1);font-size:0.8rem;padding:6px 10px;margin-top:6px;}
        .stg-toggle-row{display:flex;justify-content:space-between;align-items:center;margin-top:6px;}
        .stg-toggle-label{font-size:0.8rem;color:var(--text1);}
        .stg-toggle{position:relative;display:inline-block;width:36px;height:20px;}
        .stg-toggle input{opacity:0;width:0;height:0;}
        .stg-toggle-slider{position:absolute;inset:0;background:var(--bg3);border-radius:20px;cursor:pointer;transition:0.2s;}
        .stg-toggle-slider:before{content:'';position:absolute;width:14px;height:14px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:0.2s;}
        .stg-toggle input:checked+.stg-toggle-slider{background:var(--accent);}
        .stg-toggle input:checked+.stg-toggle-slider:before{transform:translateX(16px);}
        .stg-input-row{display:flex;gap:8px;align-items:center;margin-top:6px;}
        .stg-input{flex:1;background:var(--bg1);border:1px solid var(--border);border-radius:5px;color:var(--text1);font-size:0.82rem;padding:6px 10px;}
        .stg-textarea{width:100%;height:72px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;color:var(--text1);font-size:0.82rem;padding:6px 10px;resize:none;box-sizing:border-box;margin-top:6px;}
        .stg-btn{background:var(--accent);color:#fff;border:none;border-radius:5px;padding:6px 14px;font-size:0.75rem;cursor:pointer;font-weight:600;white-space:nowrap;}
        .stg-btn:hover{opacity:0.85;}
        .stg-btn.danger{background:#f87171;}
        .stg-info-grid{display:flex;flex-direction:column;gap:3px;margin-top:6px;}
        .stg-info-row{display:flex;justify-content:space-between;padding:5px 8px;background:var(--bg2);border-radius:4px;font-size:0.75rem;color:var(--text2);}
        .stg-info-row span:last-child{color:var(--text1);font-family:monospace;}
        .stg-action-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;}
      `;
      document.head.appendChild(s);
    }
    return wrap;
  }
};