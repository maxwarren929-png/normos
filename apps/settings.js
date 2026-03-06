/**
 * NormOS — apps/settings.js v5
 * Settings: Theme, Wallpaper, Desktop, About
 * Note: Username change removed (locked to account display name)
 */

const SettingsApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;height:100%;background:var(--bg1);color:var(--text1);font-family:var(--font-mono,monospace);overflow:hidden;';

    const THEMES = [
      { id:'dark',    name:'Dark',      desc:'Classic dark mode'              },
      { id:'light',   name:'Light',     desc:'Light mode (bright)'            },
      { id:'green',   name:'Matrix',    desc:'Green terminal aesthetic'       },
      { id:'blue',    name:'Ocean',     desc:'Cool blue tones'                },
      { id:'purple',  name:'Void',      desc:'Deep purple void'               },
      { id:'red',     name:'Crimson',   desc:'Red alert mode'                 },
      { id:'cyber',   name:'Cyber',     desc:'Neon cyberpunk'                 },
    ];

    const WALLPAPERS = [
      { id:'',         name:'Default',  desc:'Solid dark background' },
      { id:'grid',     name:'Grid',     desc:'Dot grid pattern'      },
      { id:'wave',     name:'Wave',     desc:'Animated wave'         },
      { id:'matrix',   name:'Matrix',   desc:'Falling code rain'     },
      { id:'stars',    name:'Stars',    desc:'Starfield'             },
    ];

    const isAdmin = typeof Network !== 'undefined' && Network.getState().isAdmin;

    wrap.innerHTML = `
      <div style="width:160px;border-right:1px solid var(--border);flex-shrink:0;overflow-y:auto;">
        <div style="padding:12px 10px 6px;font-size:0.6rem;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;">Settings</div>
        ${[
          ['appearance','🎨','Appearance'],
          ['desktop',   '🖥️','Desktop'],
          ['about',     'ℹ️','About'],
          ...(isAdmin ? [['admin','👑','Admin Panel']] : []),
        ].map(([id,icon,label]) =>
          `<div class="stt-nav" data-panel="${id}" style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:7px;font-size:0.78rem;border-radius:5px;margin:1px 4px;">${icon} ${label}</div>`
        ).join('')}
      </div>
      <div id="stt-panel" style="flex:1;overflow-y:auto;padding:20px;"></div>
    `;

    if (!document.getElementById('stt-style')) {
      const st = document.createElement('style');
      st.id = 'stt-style';
      st.textContent = `.stt-nav{transition:background .15s}.stt-nav:hover{background:var(--bg2)}.stt-nav.active{background:var(--bg3);color:var(--accent)}.stt-section{margin-bottom:20px}.stt-section-title{font-size:.78rem;font-weight:bold;color:var(--text1);margin-bottom:10px}.stt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}.stt-card{background:var(--bg2);border:2px solid var(--border);border-radius:8px;padding:10px;cursor:pointer;transition:border-color .15s}.stt-card:hover{border-color:var(--accent)}.stt-card.active{border-color:var(--accent)}.stt-card-name{font-size:.75rem;font-weight:bold;margin-bottom:3px}.stt-card-desc{font-size:.6rem;color:var(--text3)}.stt-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)}.stt-lbl{font-size:.75rem;color:var(--text2);flex:1}.stt-val{font-size:.72rem;color:var(--accent)}.stt-input{background:var(--bg2);border:1px solid var(--border);border-radius:5px;padding:6px 10px;color:var(--text1);font-size:.78rem;outline:none;font-family:inherit;width:100%;box-sizing:border-box}.stt-btn{background:var(--accent);color:#000;border:none;border-radius:5px;padding:7px 14px;cursor:pointer;font-size:.75rem;font-weight:bold;font-family:inherit}.stt-btn:hover{opacity:.85}.stt-btn-danger{background:#f87171;color:#000}.stt-alert{padding:8px 12px;border-radius:6px;font-size:.72rem;margin-top:6px}`;
      document.head.appendChild(st);
    }

    const panel = wrap.querySelector('#stt-panel');

    const panels = {
      appearance: () => {
        const theme = OS?.state?.theme || 'dark';
        const wp    = (() => { try { return localStorage.getItem('normos_wallpaper')||''; } catch { return ''; } })();
        panel.innerHTML = `
          <div class="stt-section">
            <div class="stt-section-title">🎨 Theme</div>
            <div class="stt-grid">
              ${THEMES.map(t => `
                <div class="stt-card ${theme===t.id?'active':''}" data-theme="${t.id}">
                  <div class="stt-card-name">${t.name}</div>
                  <div class="stt-card-desc">${t.desc}</div>
                </div>`).join('')}
            </div>
          </div>
          <div class="stt-section">
            <div class="stt-section-title">🖼️ Wallpaper</div>
            <div class="stt-grid">
              ${WALLPAPERS.map(w => `
                <div class="stt-card ${wp===w.id?'active':''}" data-wp="${w.id}">
                  <div class="stt-card-name">${w.name}</div>
                  <div class="stt-card-desc">${w.desc}</div>
                </div>`).join('')}
            </div>
          </div>
        `;
        panel.querySelectorAll('[data-theme]').forEach(el => {
          el.addEventListener('click', () => {
            OS?.setTheme(el.dataset.theme);
            panel.querySelectorAll('[data-theme]').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
          });
        });
        panel.querySelectorAll('[data-wp]').forEach(el => {
          el.addEventListener('click', () => {
            try { localStorage.setItem('normos_wallpaper', el.dataset.wp); } catch {}
            const bg = document.getElementById('desktop-bg');
            if (bg) bg.className = 'desktop-bg ' + el.dataset.wp;
            panel.querySelectorAll('[data-wp]').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
          });
        });
      },

      desktop: () => {
        const netState = typeof Network !== 'undefined' ? Network.getState() : {};
        panel.innerHTML = `
          <div class="stt-section">
            <div class="stt-section-title">🖥️ Desktop Icons</div>
            <div style="font-size:.72rem;color:var(--text3);margin-bottom:10px;">
              Right-click any desktop icon to remove it. Right-click the desktop background to add apps.
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
              <button id="stt-reset-desktop" class="stt-btn">Reset to Default</button>
              <button id="stt-reset-positions" class="stt-btn" style="background:var(--bg3);color:var(--text1);">Reset Icon Positions</button>
            </div>
          </div>
          <div class="stt-section">
            <div class="stt-section-title">👤 Account</div>
            <div class="stt-row">
              <span class="stt-lbl">Display Name</span>
              <span class="stt-val">${netState.username || OS?.state?.username || '—'}</span>
            </div>
            <div style="font-size:.65rem;color:var(--text3);margin-top:6px;">
              Username cannot be changed after account creation.
            </div>
          </div>
        `;
        panel.querySelector('#stt-reset-desktop')?.addEventListener('click', () => {
          if (!confirm('Reset desktop to default apps?')) return;
          if (typeof OS !== 'undefined') {
            OS.state.desktopApps = null;
            OS.saveState();
            if (typeof OS.buildDesktopIcons === 'function') OS.buildDesktopIcons?.();
            // Force refresh via EventBus
            if (typeof EventBus !== 'undefined') EventBus.emit('desktop:refresh');
            OS.notify('🖥️', 'Desktop', 'Desktop reset to defaults.');
          }
        });
        panel.querySelector('#stt-reset-positions')?.addEventListener('click', () => {
          if (typeof OS !== 'undefined') {
            OS.state.iconPositions = {};
            OS.saveState();
            if (typeof EventBus !== 'undefined') EventBus.emit('desktop:refresh');
            OS.notify('📌', 'Desktop', 'Icon positions reset.');
          }
        });
      },

      about: () => {
        const netState = typeof Network !== 'undefined' ? Network.getState() : {};
        panel.innerHTML = `
          <div class="stt-section">
            <div class="stt-section-title">ℹ️ About NormOS</div>
            <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px;font-size:.75rem;line-height:1.7;">
              <div><strong>NormOS</strong> v5.0</div>
              <div style="color:var(--text3);">Multiplayer browser OS simulation</div>
              <div style="margin-top:10px;">
                <div class="stt-row"><span class="stt-lbl">User</span><span class="stt-val">${netState.username||'—'}</span></div>
                <div class="stt-row"><span class="stt-lbl">Server</span><span class="stt-val">${typeof Network!=='undefined'&&Network.isConnected()?'🟢 Connected':'🔴 Offline'}</span></div>
                <div class="stt-row"><span class="stt-lbl">Online Users</span><span class="stt-val">${(netState.online||[]).length}</span></div>
                <div class="stt-row"><span class="stt-lbl">Admin</span><span class="stt-val">${netState.isAdmin?'👑 Yes':'No'}</span></div>
              </div>
            </div>
          </div>
        `;
      },

      admin: () => {
        if (!isAdmin) { panel.innerHTML = '<div style="padding:20px;color:#f87171;">Not authorized.</div>'; return; }
        panel.innerHTML = `
          <div class="stt-section">
            <div class="stt-section-title">👑 Admin Panel</div>
            <div style="background:rgba(245,158,11,0.1);border:1px solid #f59e0b;border-radius:8px;padding:12px;margin-bottom:16px;font-size:.72rem;color:#f59e0b;">
              ⚠️ Admin tools. Use responsibly.
            </div>
            <div style="display:flex;gap:8px;margin-bottom:12px;">
              <button id="admin-load-users" class="stt-btn">Load User List</button>
            </div>
            <div id="admin-user-table"></div>
          </div>
          <div class="stt-section">
            <div class="stt-section-title">Quick Actions</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;gap:8px;align-items:center;">
                <input id="admin-kick-name" class="stt-input" placeholder="Username to kick" style="max-width:200px;" />
                <button id="admin-kick-btn" class="stt-btn stt-btn-danger">Kick</button>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <input id="admin-bal-name" class="stt-input" placeholder="Username" style="max-width:140px;" />
                <input id="admin-bal-val"  class="stt-input" type="number" placeholder="Balance" style="max-width:100px;" />
                <button id="admin-bal-btn" class="stt-btn" style="background:#f59e0b;">Set Balance</button>
              </div>
            </div>
            <div id="admin-msg" style="margin-top:8px;font-size:.7rem;min-height:16px;color:#4ade80;"></div>
          </div>
        `;

        panel.querySelector('#admin-load-users')?.addEventListener('click', () => {
          if (typeof Network !== 'undefined') Network.adminGetUsers();
        });
        panel.querySelector('#admin-kick-btn')?.addEventListener('click', () => {
          const name = panel.querySelector('#admin-kick-name').value.trim();
          if (!name) return;
          if (!confirm(`Kick ${name}?`)) return;
          if (typeof Network !== 'undefined') Network.adminKick(name);
          panel.querySelector('#admin-msg').textContent = `Kicked ${name}.`;
        });
        panel.querySelector('#admin-bal-btn')?.addEventListener('click', () => {
          const name = panel.querySelector('#admin-bal-name').value.trim();
          const val  = parseFloat(panel.querySelector('#admin-bal-val').value);
          if (!name || isNaN(val)) return;
          if (typeof Network !== 'undefined') Network.adminSetBalance(name, val);
          panel.querySelector('#admin-msg').textContent = `Set ${name} balance to $${val.toFixed(2)}.`;
        });

        // Listen for user list
        const onUsers = (data) => {
          const tbl = panel.querySelector('#admin-user-table');
          if (!tbl) return;
          const safeEsc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
          tbl.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:.68rem;">
              <thead>
                <tr style="color:var(--text3);border-bottom:1px solid var(--border);">
                  <th style="padding:5px 8px;text-align:left;">Username</th>
                  <th style="padding:5px 8px;text-align:left;">Real Name</th>
                  <th style="padding:5px 8px;text-align:right;">Balance</th>
                  <th style="padding:5px 8px;text-align:right;">Score</th>
                  <th style="padding:5px 8px;text-align:center;">Del</th>
                </tr>
              </thead>
              <tbody>
                ${(data.users||[]).map(u => `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:5px 8px;color:var(--text1);">${String(u.username).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td>
                    <td style="padding:5px 8px;color:#f59e0b;">${String(u.realName||'—').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td>
                    <td style="padding:5px 8px;text-align:right;color:#4ade80;">$${Number(u.balance||0).toFixed(2)}</td>
                    <td style="padding:5px 8px;text-align:right;color:var(--text2);">${u.creditScore||0}</td>
                    <td style="padding:5px 8px;text-align:center;">
                      <button class="admin-tbl-del" data-name="${String(u.username).replace(/"/g,'&quot;')}" style="font-size:0.55rem;padding:2px 5px;background:#7f1d1d;color:#fca5a5;border:1px solid #f87171;border-radius:3px;cursor:pointer;">🗑️</button>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          `;
          Network.off('admin:users', onUsers);
          // Wire up delete buttons in table
          tbl.querySelectorAll('.admin-tbl-del').forEach(btn => {
            btn.addEventListener('click', () => {
              const name = btn.dataset.name;
              if (!confirm(`Delete account "${name}" permanently?`)) return;
              if (!confirm(`This cannot be undone. Delete "${name}"?`)) return;
              if (typeof Network !== 'undefined') Network.adminDeleteAccount(name);
              btn.closest('tr').style.opacity = '0.3';
              btn.textContent = '✓';
            });
          });
        };
        if (typeof Network !== 'undefined') Network.on('admin:users', onUsers);
        wrap._adminCleanup = () => {
          if (typeof Network !== 'undefined') Network.off('admin:users', onUsers);
        };
      },
    };

    const switchPanel = (id) => {
      wrap.querySelectorAll('.stt-nav').forEach(el => el.classList.toggle('active', el.dataset.panel === id));
      (panels[id] || panels.appearance)();
    };

    wrap.querySelectorAll('.stt-nav').forEach(el => {
      el.addEventListener('click', () => switchPanel(el.dataset.panel));
    });

    switchPanel('appearance');
    return wrap;
  }
};
