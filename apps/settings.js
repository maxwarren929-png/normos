/**
 * NormOS — apps/settings.js v4.1
 * Settings: theme, wallpaper, accent, username change, desktop icons, clock widget.
 */

const SettingsApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;height:100%;background:var(--bg1);color:var(--text1);font-family:var(--font-mono,monospace);overflow:hidden;';

    const SECTIONS = ['Profile','Appearance','Desktop','About'];
    let activeSection = 'Profile';

    wrap.innerHTML = `
      <div style="width:160px;border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0;">
        <div style="padding:12px 14px;font-size:0.85rem;font-weight:bold;color:var(--accent);border-bottom:1px solid var(--border);">⚙️ Settings</div>
        ${SECTIONS.map(s=>`<div class="set-nav" data-s="${s}" style="padding:9px 14px;cursor:pointer;font-size:0.78rem;color:var(--text2);border-bottom:1px solid var(--border);">${s}</div>`).join('')}
      </div>
      <div id="set-panel" style="flex:1;overflow-y:auto;padding:20px;"></div>
    `;

    const navEls = wrap.querySelectorAll('.set-nav');
    const panel  = wrap.querySelector('#set-panel');

    const setActive = (s) => {
      activeSection = s;
      navEls.forEach(el => {
        el.style.background = el.dataset.s === s ? 'var(--bg2)' : '';
        el.style.color      = el.dataset.s === s ? 'var(--text1)' : 'var(--text2)';
      });
      renderPanel();
    };
    navEls.forEach(el => el.addEventListener('click', () => setActive(el.dataset.s)));

    const h3 = (t) => `<div style="font-size:0.85rem;font-weight:bold;color:var(--accent);margin-bottom:14px;">${t}</div>`;
    const label = (t) => `<div style="font-size:0.72rem;color:var(--text3);margin-bottom:4px;">${t}</div>`;
    const row = (content) => `<div style="margin-bottom:16px;">${content}</div>`;

    const renderPanel = () => {
      panel.innerHTML = '';
      if (activeSection === 'Profile') renderProfile();
      else if (activeSection === 'Appearance') renderAppearance();
      else if (activeSection === 'Desktop') renderDesktop();
      else if (activeSection === 'About') renderAbout();
    };

    const renderProfile = () => {
      const s = typeof Network !== 'undefined' ? Network.getState() : {};
      const username = s.username || (typeof OS !== 'undefined' ? OS.state.username : 'User');
      panel.innerHTML = `
        ${h3('👤 Profile')}
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:14px;margin-bottom:16px;">
          <div style="font-size:0.75rem;color:var(--text3);margin-bottom:4px;">Current display name</div>
          <div style="font-size:1rem;font-weight:bold;color:${s.myColor||'var(--accent)'};">${username}</div>
          ${s.isAdmin ? '<div style="font-size:0.65rem;color:#f59e0b;margin-top:4px;">👑 Admin (Ko1)</div>' : ''}
        </div>
        ${row(`
          ${label('Change Display Name')}
          <input id="set-newname" type="text" placeholder="New display name" maxlength="24" value="${username}"
            style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:7px 10px;color:var(--text1);font-size:0.82rem;outline:none;font-family:inherit;box-sizing:border-box;" />
          <button id="set-rename-btn" style="margin-top:7px;padding:6px 16px;background:var(--accent);color:#000;border:none;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:bold;font-family:inherit;">Apply</button>
          <div id="set-rename-msg" style="font-size:0.7rem;min-height:18px;margin-top:5px;color:var(--text3);"></div>
        `)}
        ${row(`
          ${label('Status Message')}
          <input id="set-status" type="text" placeholder="What are you up to?" maxlength="60"
            value="${(() => { try { return localStorage.getItem('normos_status')||''; } catch { return ''; } })()}"
            style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:7px 10px;color:var(--text1);font-size:0.82rem;outline:none;font-family:inherit;box-sizing:border-box;" />
          <button id="set-status-btn" style="margin-top:7px;padding:6px 16px;background:var(--bg2);color:var(--text1);border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:0.75rem;font-family:inherit;">Save Status</button>
        `)}
      `;

      const renameBtn = panel.querySelector('#set-rename-btn');
      const renameMsg = panel.querySelector('#set-rename-msg');
      renameBtn.addEventListener('click', () => {
        const newName = panel.querySelector('#set-newname').value.trim().replace(/[^a-zA-Z0-9_]/g,'');
        if (newName.length < 2) { renameMsg.style.color='#f87171'; renameMsg.textContent='Name too short.'; return; }
        if (!Network.isConnected()) { renameMsg.style.color='#f87171'; renameMsg.textContent='Not connected.'; return; }
        Network.renameUser(newName);
        renameMsg.style.color='#4ade80'; renameMsg.textContent='Renaming…';
      });
      Network.on('rename:ok', (d) => {
        renameMsg.style.color='#4ade80'; renameMsg.textContent=`✅ Renamed to ${d.newName}`;
        if (typeof OS !== 'undefined') { OS.state.username = d.newName; OS.saveState(); }
      });
      Network.on('rename:fail', (d) => {
        renameMsg.style.color='#f87171'; renameMsg.textContent=`❌ ${d.reason}`;
      });

      panel.querySelector('#set-status-btn').addEventListener('click', () => {
        const st = panel.querySelector('#set-status').value.trim();
        try { localStorage.setItem('normos_status', st); } catch {}
        if (typeof OS !== 'undefined') OS.notify('✅','Settings','Status updated!');
      });

      // ── Monetise section ────────────────────────────────────────────────────
      const monetiseDiv = document.createElement('div');
      monetiseDiv.innerHTML = `
        <div style="margin-top:8px;">
          <div style="font-size:0.82rem;font-weight:bold;color:#f59e0b;margin-bottom:10px;">💰 Monetise Your Content</div>
          <div style="font-size:0.72rem;color:var(--text3);margin-bottom:12px;line-height:1.5;">
            Lock your NormTok or NormTunes behind a paywall. Other players must pay your set price to access your content.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <!-- NormTok paywall -->
            <div style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:12px;">
              <div style="font-size:0.78rem;font-weight:bold;color:var(--text1);margin-bottom:8px;">📱 NormTok</div>
              <div id="set-tok-status" style="font-size:0.68rem;color:var(--text3);margin-bottom:8px;">Loading...</div>
              <input id="set-tok-price" type="number" min="0" step="1" placeholder="Price (0 = free)"
                style="width:100%;background:var(--bg1);border:1px solid var(--border);border-radius:4px;padding:6px 8px;color:var(--text1);font-size:0.75rem;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:6px;" />
              <button id="set-tok-btn" style="width:100%;padding:5px;background:var(--accent);color:#000;border:none;border-radius:4px;cursor:pointer;font-size:0.72rem;font-weight:bold;font-family:inherit;">Set Paywall</button>
              <div id="set-tok-msg" style="font-size:0.65rem;min-height:14px;margin-top:4px;color:#4ade80;"></div>
            </div>
            <!-- NormTunes paywall -->
            <div style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:12px;">
              <div style="font-size:0.78rem;font-weight:bold;color:var(--text1);margin-bottom:8px;">🎵 NormTunes</div>
              <div id="set-tune-status" style="font-size:0.68rem;color:var(--text3);margin-bottom:8px;">Loading...</div>
              <input id="set-tune-price" type="number" min="0" step="1" placeholder="Price (0 = free)"
                style="width:100%;background:var(--bg1);border:1px solid var(--border);border-radius:4px;padding:6px 8px;color:var(--text1);font-size:0.75rem;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:6px;" />
              <button id="set-tune-btn" style="width:100%;padding:5px;background:var(--accent);color:#000;border:none;border-radius:4px;cursor:pointer;font-size:0.72rem;font-weight:bold;font-family:inherit;">Set Paywall</button>
              <div id="set-tune-msg" style="font-size:0.65rem;min-height:14px;margin-top:4px;color:#4ade80;"></div>
            </div>
          </div>
          <div style="font-size:0.65rem;color:var(--text3);margin-top:8px;">Set price to 0 to make it free again. Players who already paid keep their access.</div>
        </div>
      `;
      panel.appendChild(monetiseDiv);

      // Load current paywall prices from server profiles
      const uname = (typeof Network !== 'undefined') ? Network.getState().username : '';
      if (typeof Network !== 'undefined') {
        const onProfiles = (d) => {
          const me = (d.profiles||[]).find(p=>p.username===uname);
          const tok  = me?.paywalls?.normtok?.price;
          const tune = me?.paywalls?.normtunes?.price;
          const tokStatus  = panel.querySelector('#set-tok-status');
          const tuneStatus = panel.querySelector('#set-tune-status');
          if (tokStatus)  tokStatus.textContent  = tok  ? `🔒 Locked at $${tok}`  : '🔓 Public (free)';
          if (tuneStatus) tuneStatus.textContent = tune ? `🔒 Locked at $${tune}` : '🔓 Public (free)';
          if (tok  && panel.querySelector('#set-tok-price'))  panel.querySelector('#set-tok-price').value  = tok;
          if (tune && panel.querySelector('#set-tune-price')) panel.querySelector('#set-tune-price').value = tune;
        };
        Network.on('media:paywall:profiles', onProfiles);
        Network.getPaywalls();

        const setPaywall = (mediaType, inputId, msgId, statusId) => {
          const price = parseFloat(panel.querySelector(inputId)?.value) || 0;
          Network.setPaywall(mediaType, price);
          const msgEl = panel.querySelector(msgId);
          const stEl  = panel.querySelector(statusId);
          if (msgEl) { msgEl.style.color='#4ade80'; msgEl.textContent = price > 0 ? `✅ Locked at $${price}` : '✅ Set to free'; }
          if (stEl)  stEl.textContent = price > 0 ? `🔒 Locked at $${price}` : '🔓 Public (free)';
          if (typeof OS !== 'undefined') OS.notify('💰','Settings', price>0?`${mediaType} locked at $${price}`:`${mediaType} set to free`);
        };

        panel.querySelector('#set-tok-btn')?.addEventListener('click', () => setPaywall('normtok','#set-tok-price','#set-tok-msg','#set-tok-status'));
        panel.querySelector('#set-tune-btn')?.addEventListener('click', () => setPaywall('normtunes','#set-tune-price','#set-tune-msg','#set-tune-status'));
      }
    };

    const renderAppearance = () => {
      const themes = ['dark','light','green','purple','red','blue','midnight'];
      const accents = ['#4f9eff','#4ade80','#f59e0b','#f87171','#c084fc','#67e8f9','#fb923c'];
      const wallpapers = [
        {id:'wp-default',label:'Default'},
        {id:'wp-grid',label:'Grid'},
        {id:'wp-stars',label:'Stars'},
        {id:'wp-gradient',label:'Gradient'},
        {id:'wp-circuit',label:'Circuit'},
        {id:'wp-void',label:'Void'},
      ];
      const curTheme = document.body.className.match(/theme-(\S+)/)?.[1] || 'dark';
      const curWp = (() => { try { return localStorage.getItem('normos_wallpaper')||''; } catch { return ''; } })();
      const curAccent = (() => { try { return localStorage.getItem('normos_accent')||''; } catch { return ''; } })();
      panel.innerHTML = `
        ${h3('🎨 Appearance')}
        ${row(`
          ${label('Theme')}
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${themes.map(t=>`<button class="set-theme-btn" data-t="${t}" style="padding:5px 12px;border-radius:4px;border:1px solid ${curTheme===t?'var(--accent)':'var(--border)'};background:${curTheme===t?'var(--accent)':'var(--bg2)'};color:${curTheme===t?'#000':'var(--text2)'};cursor:pointer;font-size:0.72rem;font-family:inherit;">${t}</button>`).join('')}
          </div>
        `)}
        ${row(`
          ${label('Accent Color')}
          <div style="display:flex;gap:6px;">
            ${accents.map(a=>`<div class="set-accent-btn" data-a="${a}" style="width:24px;height:24px;border-radius:50%;background:${a};cursor:pointer;border:2px solid ${curAccent===a?'#fff':'transparent'};"></div>`).join('')}
          </div>
        `)}
        ${row(`
          ${label('Wallpaper')}
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${wallpapers.map(w=>`<button class="set-wp-btn" data-w="${w.id}" style="padding:5px 12px;border-radius:4px;border:1px solid ${curWp===w.id?'var(--accent)':'var(--border)'};background:${curWp===w.id?'var(--accent)':'var(--bg2)'};color:${curWp===w.id?'#000':'var(--text2)'};cursor:pointer;font-size:0.72rem;font-family:inherit;">${w.label}</button>`).join('')}
          </div>
        `)}
        ${row(`
          ${label('Font Size')}
          <div style="display:flex;gap:6px;">
            ${['small','normal','large'].map(fs=>`<button class="set-fs-btn" data-fs="${fs}" style="padding:5px 12px;border-radius:4px;border:1px solid var(--border);background:var(--bg2);color:var(--text2);cursor:pointer;font-size:0.72rem;font-family:inherit;">${fs}</button>`).join('')}
          </div>
        `)}
      `;

      panel.querySelectorAll('.set-theme-btn').forEach(btn => btn.addEventListener('click', () => {
        if (typeof OS !== 'undefined') OS.setTheme(btn.dataset.t);
        renderAppearance();
      }));
      panel.querySelectorAll('.set-accent-btn').forEach(btn => btn.addEventListener('click', () => {
        try { localStorage.setItem('normos_accent', btn.dataset.a); } catch {}
        document.body.dataset.accent = btn.dataset.a;
        renderAppearance();
      }));
      panel.querySelectorAll('.set-wp-btn').forEach(btn => btn.addEventListener('click', () => {
        try { localStorage.setItem('normos_wallpaper', btn.dataset.w); } catch {}
        const bg = document.getElementById('desktop-bg');
        if (bg) bg.className = 'desktop-bg ' + btn.dataset.w;
        renderAppearance();
      }));
      panel.querySelectorAll('.set-fs-btn').forEach(btn => btn.addEventListener('click', () => {
        try { localStorage.setItem('normos_fontsize', btn.dataset.fs); } catch {}
        document.body.dataset.fontsize = btn.dataset.fs;
      }));
    };

    const renderDesktop = () => {
      const clockOn = (() => { try { return localStorage.getItem('normos_widget_clock') !== 'false'; } catch { return true; } })();
      panel.innerHTML = `
        ${h3('🖥️ Desktop')}
        ${row(`
          ${label('Clock Widget')}
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.78rem;">
            <input type="checkbox" id="set-clock-toggle" ${clockOn?'checked':''} style="cursor:pointer;" />
            Show clock widget on desktop
          </label>
        `)}
        ${row(`
          ${label('Desktop Icons')}
          <button id="set-reset-icons" style="padding:6px 14px;background:var(--bg2);color:var(--text2);border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:0.75rem;font-family:inherit;">Reset Icon Positions</button>
        `)}
        <div style="font-size:0.72rem;color:var(--text3);margin-top:8px;">Right-click any desktop icon to remove it or reset its position. Double-click to open an app.</div>
      `;
      panel.querySelector('#set-clock-toggle').addEventListener('change', (e) => {
        try { localStorage.setItem('normos_widget_clock', e.target.checked ? 'true' : 'false'); } catch {}
        if (typeof OS !== 'undefined') OS.toggleClockWidget();
      });
      panel.querySelector('#set-reset-icons').addEventListener('click', () => {
        if (typeof OS !== 'undefined') { OS.state.iconPositions = {}; OS.saveState(); }
        if (typeof OS !== 'undefined') OS.notify('🖥️','Desktop','Icon positions reset.');
      });
    };

    const renderAbout = () => {
      panel.innerHTML = `
        ${h3('ℹ️ About NormOS')}
        <div style="font-size:0.78rem;color:var(--text2);line-height:1.8;">
          <div><span style="color:var(--text3);">Version:</span> NormOS v4.1</div>
          <div><span style="color:var(--text3);">Build:</span> ${new Date().toLocaleDateString()}</div>
          <div><span style="color:var(--text3);">Engine:</span> Vanilla JS + WebSockets</div>
          <div><span style="color:var(--text3);">Server:</span> wss://normos-server.onrender.com</div>
          <div style="margin-top:12px;color:var(--text3);font-size:0.68rem;">daemon.norm is watching. This is normal.</div>
        </div>
      `;
    };

    setActive('Profile');
    return wrap;
  },
};
