/**
 * NormOS v2.0 — apps/settings.js
 * System settings panel with all pages including Desktop customization
 */

const SettingsApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'settings-wrap';

    wrap.innerHTML = `
      <div class="settings-nav">
        <div class="settings-nav-item active" data-page="appearance"><span class="settings-nav-icon">🎨</span>Appearance</div>
        <div class="settings-nav-item" data-page="desktop"><span class="settings-nav-icon">🖥️</span>Desktop</div>
        <div class="settings-nav-item" data-page="system"><span class="settings-nav-icon">⚙️</span>System</div>
        <div class="settings-nav-item" data-page="user"><span class="settings-nav-icon">👤</span>User</div>
        <div class="settings-nav-item" data-page="about"><span class="settings-nav-icon">ℹ️</span>About</div>
      </div>
      <div class="settings-pane" id="settings-pane-content"></div>
    `;

    const pane = wrap.querySelector('#settings-pane-content');

    const showPage = (name) => {
      wrap.querySelectorAll('.settings-nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === name));
      pane.innerHTML = '';
      const page = document.createElement('div');
      page.className = 'settings-page visible';
      const builders = {
        appearance: settingsAppearancePage,
        desktop: settingsDesktopPage,
        system: settingsSystemPage,
        user: settingsUserPage,
        about: settingsAboutPage,
      };
      page.innerHTML = builders[name] ? builders[name]() : '<div>Coming soon</div>';
      pane.appendChild(page);
      attachSettingsPageEvents(name, page);
    };

    wrap.querySelectorAll('.settings-nav-item').forEach(el => {
      el.addEventListener('click', () => showPage(el.dataset.page));
    });

    showPage('appearance');
    return wrap;
  },
};

function attachSettingsPageEvents(name, page) {
  if (name === 'appearance') {
    page.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        page.querySelectorAll('.theme-card').forEach(c => c.style.outline = 'none');
        card.style.outline = '2px solid var(--accent)';
        OS.setTheme(card.dataset.theme);
      });
    });
    const current = document.body.className.match(/theme-(\S+)/)?.[1] || 'dark';
    const active = page.querySelector(`[data-theme="${current}"]`);
    if (active) active.style.outline = '2px solid var(--accent)';
  }

  if (name === 'desktop') {
    page.querySelectorAll('.settings-wp-card').forEach(card => {
      card.addEventListener('click', () => {
        page.querySelectorAll('.settings-wp-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const bg = document.getElementById('desktop-bg');
        if (bg) {
          bg.className = 'desktop-bg' + (card.dataset.wp ? ' ' + card.dataset.wp : '');
        }
        try { localStorage.setItem('normos_wallpaper', card.dataset.wp || ''); } catch {}
      });
    });

    page.querySelectorAll('.accent-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        page.querySelectorAll('.accent-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        document.body.dataset.accent = dot.dataset.accent;
        try { localStorage.setItem('normos_accent', dot.dataset.accent); } catch {}
      });
    });

    const fsSelect = page.querySelector('#settings-fontsize');
    if (fsSelect) {
      fsSelect.addEventListener('change', () => {
        document.body.dataset.fontsize = fsSelect.value;
        try { localStorage.setItem('normos_fontsize', fsSelect.value); } catch {}
        OS.notify('🔤', 'Settings', 'Font size updated.');
      });
    }

    const clockToggle = page.querySelector('#toggle-clock-widget');
    if (clockToggle) {
      clockToggle.addEventListener('click', () => {
        clockToggle.classList.toggle('on');
        const show = clockToggle.classList.contains('on');
        try { localStorage.setItem('normos_widget_clock', show ? 'true' : 'false'); } catch {}
        OS.toggleClockWidget(show);
        OS.notify('🕐', 'Settings', 'Clock widget ' + (show ? 'enabled' : 'disabled') + '.');
      });
    }
  }

  if (name === 'user') {
    page.querySelector('#settings-username-save')?.addEventListener('click', () => {
      const n = page.querySelector('#settings-username-input').value.trim();
      if (n) { OS.state.username = n; OS.saveState(); document.getElementById('login-display-name').textContent = n; OS.notify('👤', 'Settings', 'Username updated.'); }
    });
    page.querySelector('#settings-pw-save')?.addEventListener('click', () => {
      OS.notify('🔒', 'Settings', 'Password cannot be changed. It will always be "norm".');
    });
    page.querySelector('#settings-reset-fs')?.addEventListener('click', () => {
      if (confirm('Reset entire virtual file system to defaults? This cannot be undone.')) {
        FS.reset(); OS.notify('🗂️', 'Settings', 'File system reset.'); EventBus.emit('fs:changed', {});
      }
    });
  }

  if (name === 'system') {
    page.querySelectorAll('.toggle').forEach(t => {
      t.addEventListener('click', () => {
        t.classList.toggle('on');
        OS.notify('⚙️', 'Settings', 'Setting changed. Effect: ambiguous.');
      });
    });
  }
}

function settingsAppearancePage() {
  const themes = [
    { id: 'dark',   label: 'Dark',      bg: '#080c12', acc: '#4f9eff' },
    { id: 'light',  label: 'Light',     bg: '#f0f4f8', acc: '#2563eb' },
    { id: 'retro',  label: 'Retro',     bg: '#0d0800', acc: '#ff9500' },
    { id: 'neon',   label: 'Neon',      bg: '#000510', acc: '#00f5ff' },
    { id: 'solar',  label: 'Solarized', bg: '#002b36', acc: '#268bd2' },
    { id: 'sakura', label: 'Sakura',    bg: '#1a0a12', acc: '#ff78a2' },
  ];
  return `
    <div class="settings-page-title">Appearance</div>
    <div class="settings-section-title">Theme</div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem;">
      ${themes.map(t => `
        <div class="theme-card" data-theme="${t.id}" style="
          width:90px;padding:0.5rem;border-radius:var(--radius);
          background:${t.bg};border:1px solid var(--border);
          cursor:pointer;text-align:center;outline:2px solid transparent;outline-offset:2px;transition:outline 0.15s;">
          <div style="width:100%;height:36px;border-radius:4px;background:linear-gradient(135deg,${t.bg},${t.acc});margin-bottom:0.4rem;"></div>
          <div style="font-size:0.65rem;color:${t.acc};font-weight:600;">${t.label}</div>
        </div>`).join('')}
    </div>
    <div class="settings-section-title">Display</div>
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Animations</div><div class="settings-row-sub">Window open/close transitions</div></div>
      <div class="settings-row-control"><div class="toggle on"></div></div>
    </div>
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Transparency / Blur</div><div class="settings-row-sub">Taskbar and window blur effects</div></div>
      <div class="settings-row-control"><div class="toggle on"></div></div>
    </div>`;
}

function settingsDesktopPage() {
  const wallpapers = [
    { id: '', label: 'Default', style: 'background:radial-gradient(ellipse 80% 80% at 50% 50%, #0a1020 0%, #080c12 100%);' },
    { id: 'wp-gradient-sunset', label: 'Sunset', style: 'background:linear-gradient(135deg,#1a0533,#c84b4b,#f4a261);' },
    { id: 'wp-gradient-ocean', label: 'Ocean', style: 'background:linear-gradient(135deg,#000d26,#003380,#00a3cc);' },
    { id: 'wp-gradient-forest', label: 'Forest', style: 'background:linear-gradient(135deg,#0a1f0a,#2d6a2d,#7dc87d);' },
    { id: 'wp-solid-black', label: 'Black', style: 'background:#000;' },
    { id: 'wp-solid-navy', label: 'Navy', style: 'background:#0a0f1e;' },
    { id: 'wp-grid', label: 'Grid', style: 'background:#080c12;background-image:linear-gradient(rgba(79,158,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(79,158,255,0.1) 1px,transparent 1px);background-size:32px 32px;' },
  ];
  const accents = [
    { id: '', label: 'Blue', color: '#4f9eff' },
    { id: 'green', label: 'Green', color: '#34d399' },
    { id: 'purple', label: 'Purple', color: '#a78bfa' },
    { id: 'red', label: 'Red', color: '#f87171' },
    { id: 'orange', label: 'Orange', color: '#fb923c' },
    { id: 'yellow', label: 'Yellow', color: '#fbbf24' },
    { id: 'pink', label: 'Pink', color: '#f472b6' },
    { id: 'cyan', label: 'Cyan', color: '#22d3ee' },
  ];
  const currentWp = (() => { try { return localStorage.getItem('normos_wallpaper') || ''; } catch { return ''; } })();
  const currentAccent = (() => { try { return localStorage.getItem('normos_accent') || ''; } catch { return ''; } })();
  const currentFont = (() => { try { return localStorage.getItem('normos_fontsize') || 'medium'; } catch { return 'medium'; } })();
  const showClock = (() => { try { return localStorage.getItem('normos_widget_clock') !== 'false'; } catch { return true; } })();

  return `
    <div class="settings-page-title">Desktop</div>
    <div class="settings-section-title">Wallpaper</div>
    <div class="settings-wallpaper-grid">
      ${wallpapers.map(wp => `
        <div class="settings-wp-card ${wp.id === currentWp ? 'active' : ''}" data-wp="${wp.id}" style="${wp.style}" title="${wp.label}"></div>`).join('')}
    </div>
    <div class="settings-section-title">Accent Color</div>
    <div class="settings-accent-grid">
      ${accents.map(a => `
        <div class="accent-dot ${a.id === currentAccent ? 'active' : ''}" data-accent="${a.id}" style="background:${a.color};" title="${a.label}"></div>`).join('')}
    </div>
    <div class="settings-section-title">Font Size</div>
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">UI Font Size</div></div>
      <div>
        <select id="settings-fontsize" style="background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:0.25rem 0.5rem;color:var(--text);font-family:var(--font-ui);font-size:0.75rem;outline:none;">
          <option value="small" ${currentFont==='small'?'selected':''}>Small (12px)</option>
          <option value="medium" ${currentFont==='medium'?'selected':''}>Medium (14px)</option>
          <option value="large" ${currentFont==='large'?'selected':''}>Large (16px)</option>
          <option value="xl" ${currentFont==='xl'?'selected':''}>Extra Large (18px)</option>
        </select>
      </div>
    </div>
    <div class="settings-section-title">Widgets</div>
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Clock Widget</div><div class="settings-row-sub">Show clock on desktop (double-click to open)</div></div>
      <div class="settings-row-control"><div class="toggle ${showClock ? 'on' : ''}" id="toggle-clock-widget"></div></div>
    </div>`;
}

function settingsSystemPage() {
  return `
    <div class="settings-page-title">System</div>
    <div class="settings-section-title">Behavior</div>
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Auto-start daemon.norm</div><div class="settings-row-sub">Cannot be disabled</div></div>
      <div class="settings-row-control"><div class="toggle on" style="opacity:0.5;pointer-events:none;"></div></div>
    </div>
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Clock accuracy</div><div class="settings-row-sub">Show approximately correct time</div></div>
      <div class="settings-row-control"><div class="toggle"></div></div>
    </div>
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Send diagnostics to NormNet</div><div class="settings-row-sub">NormNet is not real, so this does nothing</div></div>
      <div class="settings-row-control"><div class="toggle on"></div></div>
    </div>
    <div class="settings-section-title">Performance</div>
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Fake process simulation</div><div class="settings-row-sub">Simulates background processes for realism</div></div>
      <div class="settings-row-control"><div class="toggle on"></div></div>
    </div>`;
}

function settingsAboutPage() {
  return `
    <div class="settings-page-title">About NormOS</div>
    <div style="text-align:center;padding:1rem 0;">
      <div style="font-size:2rem;font-weight:800;color:var(--accent);letter-spacing:0.2em;">NORMOS</div>
      <div style="font-size:0.75rem;color:var(--text2);margin-top:0.25rem;">Version 2.0.0 — Build 20250302</div>
      <div style="font-size:0.65rem;color:var(--text3);margin-top:0.5rem;">17 apps · 6 themes · 8 accent colors</div>
    </div>
    <div class="settings-section-title">System Information</div>
    <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">OS Name</div></div><div style="font-size:0.78rem;color:var(--text2);font-family:var(--font-mono)">NormOS</div></div>
    <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Kernel</div></div><div style="font-size:0.78rem;color:var(--text2);font-family:var(--font-mono)">norm_core 2.0.0</div></div>
    <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Shell</div></div><div style="font-size:0.78rem;color:var(--text2);font-family:var(--font-mono)">normbash 2.0</div></div>
    <div class="settings-row"><div class="settings-row-info"><div class="settings-row-label">Real?</div></div><div style="font-size:0.78rem;color:var(--text2);font-family:var(--font-mono)">Increasingly unclear</div></div>
    <div class="settings-section-title">Lore Progress</div>
    <div style="font-size:0.8rem;color:var(--text2);margin-top:0.5rem;">
      Chapter 1–3: Accessible<br>Chapter 4–∞: Encrypted<br>
      <span style="color:var(--text3);font-size:0.7rem;">Key: the first word you said today (or the last thought you had)</span>
    </div>`;
}

function settingsUserPage() {
  const uname = (typeof OS !== 'undefined' && OS.state) ? OS.state.username : 'norm';
  return `
    <div class="settings-page-title">User Account</div>
    <div class="settings-section-title">Profile</div>
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Display Name</div></div>
      <div style="display:flex;gap:0.4rem;align-items:center;">
        <input id="settings-username-input" style="background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:0.25rem 0.5rem;color:var(--text);font-family:var(--font-ui);font-size:0.75rem;outline:none;" value="${uname}" />
        <button class="os-btn primary" id="settings-username-save" style="padding:0.25rem 0.6rem;font-size:0.7rem;">Save</button>
      </div>
    </div>
    <div class="settings-section-title">Security</div>
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Password</div><div class="settings-row-sub">Currently: "norm"</div></div>
      <div><button class="os-btn" id="settings-pw-save">Change</button></div>
    </div>
    <div class="settings-section-title">Data</div>
    <div class="settings-row">
      <div class="settings-row-info"><div class="settings-row-label">Reset File System</div><div class="settings-row-sub">Restore all files to defaults</div></div>
      <div><button class="os-btn" id="settings-reset-fs" style="color:var(--red);">Reset</button></div>
    </div>`;
}