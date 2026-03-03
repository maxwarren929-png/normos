/**
 * NormOS — os.js (v3.1)
 * Main OS orchestrator.
 */

const OS = (() => {
  const STATE_KEY = 'normos_state';

  const state = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      return {
        username:      saved.username      || 'Norm',
        theme:         saved.theme         || 'dark',
        recentApps:    saved.recentApps    || [],
        firstBoot:     saved.firstBoot     !== false,
        iconPositions: saved.iconPositions || {},
      };
    } catch { return { username:'Norm', theme:'dark', recentApps:[], firstBoot:true, iconPositions:{} }; }
  })();

  const saveState = () => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {}
  };

  // ── App Registry ─────────────────────────────────────────────────────────
  const appRegistry = {
    terminal:    { title:'Terminal',        icon:'🖥️',  width:720,  height:460, create:()=>TerminalApp.create()    },
    files:       { title:'File Explorer',   icon:'📁',  width:760,  height:500, create:()=>FileExplorerApp.create()},
    browser:     { title:'NormBrowser',     icon:'🌐',  width:900,  height:580, create:()=>BrowserApp.create()     },
    sysmon:      { title:'System Monitor',  icon:'📊',  width:640,  height:500, create:()=>SysmonApp.create()      },
    settings:    { title:'Settings',        icon:'⚙️',  width:680,  height:500, create:()=>SettingsApp.create()    },
    snake:       { title:'Snake',           icon:'🐍',  width:380,  height:420, minWidth:380, minHeight:420, resizable:false, create:()=>SnakeApp.create() },
    chat:        { title:'NormChat',        icon:'💬',  width:800,  height:520, create:()=>ChatApp.create()        },
    messaging:   { title:'Messaging',       icon:'💬',  width:800,  height:520, create:()=>ChatApp.create()        },
    paint:       { title:'NormPaint',       icon:'🎨',  width:900,  height:580, create:()=>PaintApp.create()       },
    normsheet:   { title:'NormSheet',       icon:'📊',  width:860,  height:540, create:()=>NormSheetApp.create()   },
    calculator:  { title:'Calculator',      icon:'🔢',  width:320,  height:460, minWidth:320, minHeight:460, resizable:false, create:()=>CalculatorApp.create() },
    clock:       { title:'Clock',           icon:'🕐',  width:400,  height:420, create:()=>ClockApp.create()       },
    music:       { title:'NormTunes',       icon:'🎵',  width:340,  height:560, create:()=>MusicApp.create()       },
    calendar:    { title:'Calendar',        icon:'📅',  width:880,  height:560, create:()=>CalendarApp.create()    },
    imagedrop:   { title:'Image Viewer',    icon:'🖼',  width:760,  height:540, create:()=>ImageDropApp.create()   },
    texteditor:  { title:'NormEdit',        icon:'✏️',  width:800,  height:560, create:(o)=>TextEditorApp.create(o?.filePath,o?.content) },
    stocks:      { title:'NormStock',       icon:'📈',  width:940,  height:580, create:()=>StocksApp.create()      },
    leaderboard: { title:'Leaderboard',     icon:'🏆',  width:900,  height:560, create:()=>LeaderboardApp.create() },
    // ── v4.0 apps ─────────────────────────────────────────────────────────
    normtok:     { title:'NormTok',         icon:'📱',  width:860,  height:560, create:()=>NormTokApp.create()     },
    social:      { title:'Social',          icon:'👥',  width:720,  height:560, create:()=>SocialApp.create()      },
    bank:        { title:'NormBank',        icon:'🏦',  width:680,  height:580, create:()=>LoansApp.create()       },
    loans:       { title:'NormBank',        icon:'🏦',  width:680,  height:580, create:()=>LoansApp.create(),       hidden:true },
    miner:       { title:'NormMiner',       icon:'⛏️',  width:640,  height:520, create:()=>MinerApp.create()       },
    casino:      { title:'NormCasino',      icon:'🎰',  width:900,  height:560, create:()=>CasinoApp.create()      },
    settings:    { title:'Settings',        icon:'⚙️',  width:720,  height:520, create:()=>SettingsApp.create()    },
    hub:         { title:'NormHub',         icon:'🏪',  width:880,  height:560, create:()=>AppStoreApp.create()    },
    appstore:    { title:'NormHub',         icon:'🏪',  width:880,  height:560, create:()=>AppStoreApp.create(),    hidden:true },
    shop:        { title:'NormHub',         icon:'🏪',  width:880,  height:560, create:()=>AppStoreApp.create(),    hidden:true },
  };

  const BOOT_MSGS = [
    { cls:'ok',   text:'Loading norm_core kernel v4.0...' },
    { cls:'ok',   text:'Initializing memory subsystem' },
    { cls:'ok',   text:'Mounting virtual filesystem' },
    { cls:'warn', text:'daemon.norm: process refuses to specify purpose' },
    { cls:'ok',   text:'Starting window compositor v4' },
    { cls:'ok',   text:'Loading account system...' },
    { cls:'info', text:'Performing one-time database migration...' },
    { cls:'warn', text:'All previous accounts wiped. Fresh start.' },
    { cls:'ok',   text:'Initializing NormNet multiplayer layer...' },
    { cls:'ok',   text:'Loading app registry (30 applications)' },
    { cls:'ok',   text:'NormBank Central: credit score engine started' },
    { cls:'ok',   text:'NormBank: deposit interest accrual ready (0.5%/min)' },
    { cls:'ok',   text:'NormBank: loan tier system initialized' },
    { cls:'ok',   text:'NormStock: shared global market live (15 assets)' },
    { cls:'warn', text:'VoidToken: price unstable. This is expected.' },
    { cls:'ok',   text:'NormChat: ready' },
    { cls:'ok',   text:'Messaging: DM file attachments enabled' },
    { cls:'ok',   text:'NormPaint: canvas initialized, file save ready' },
    { cls:'ok',   text:'NormEdit: markdown rendering ready' },
    { cls:'ok',   text:'NormHub: merged Shop + Hub (30 apps listed)' },
    { cls:'ok',   text:'Leaderboard: tracking all accounts' },
    { cls:'ok',   text:'Hacking system: minigame engine loaded' },
    { cls:'ok',   text:'Hacking: 60s cooldown system active' },
    { cls:'ok',   text:'NormTok: social feed initialized' },
    { cls:'ok',   text:'NormMiner: payout feedback enabled' },
    { cls:'ok',   text:'Social: Profile + Friends + Messaging merged' },
    { cls:'ok',   text:'NormCasino: RNG seeded (house advantage: confirmed)' },
    { cls:'ok',   text:'Settings: user preferences loaded' },
    { cls:'warn', text:'daemon.norm: "I see the new accounts."' },
    { cls:'ok',   text:'Restoring desktop layout...' },
    { cls:'warn', text:'Clock accuracy: still not guaranteed' },
    { cls:'fail', text:'Notepad: removed' },
    { cls:'fail', text:'NormMail: removed (use Messaging in Social app)' },
    { cls:'warn', text:'Purpose: increasingly unclear. Financially dangerous, though.' },
    { cls:'ok',   text:'NormOS v4.0 ready.' },
  ];

  // ── Boot ─────────────────────────────────────────────────────────────────
  const runBoot = () => {
    const logEl    = document.getElementById('boot-log');
    const fillEl   = document.getElementById('boot-fill');
    const statusEl = document.getElementById('boot-status-text');
    const total    = BOOT_MSGS.length;
    let idx = 0;
    const step = () => {
      if (idx >= total) { setTimeout(showLogin, 600); return; }
      const msg  = BOOT_MSGS[idx];
      const line = document.createElement('span');
      line.className   = `boot-line ${msg.cls}`;
      line.textContent = msg.text;
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
      fillEl.style.width = Math.round(((idx + 1) / total) * 100) + '%';
      statusEl.textContent = msg.text;
      idx++;
      setTimeout(step, 50 + Math.random() * 85);
    };
    setTimeout(step, 400);
  };

  // ── Login / Signup ───────────────────────────────────────────────────────
  const showLogin = () => {
    document.getElementById('boot-screen').style.display = 'none';
    const loginEl = document.getElementById('login-screen');
    loginEl.style.display = 'flex';

    // Replace login card with full auth UI
    const card = loginEl.querySelector('.login-card');
    if (!card) return;

    const clockEl = document.getElementById('login-clock');
    const dateEl  = document.getElementById('login-date');
    const tick = () => {
      const now = new Date();
      if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
      if (dateEl)  dateEl.textContent  = now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
    };
    tick();
    const ci = setInterval(tick, 1000);

    let mode = 'login'; // or 'signup'
    card.innerHTML = `
      <div class="login-avatar">🏦</div>
      <div class="login-username" id="auth-title">Welcome to NormOS</div>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button id="auth-tab-login"  style="flex:1;padding:6px;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:5px;cursor:pointer;font-size:0.8rem;font-weight:600;">Sign In</button>
        <button id="auth-tab-signup" style="flex:1;padding:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);border-radius:5px;cursor:pointer;font-size:0.8rem;">Create Account</button>
      </div>
      <input class="login-input" type="text"     id="auth-username" placeholder="Username" autocomplete="off" maxlength="24" />
      <input class="login-input" type="password" id="auth-password" placeholder="Password" autocomplete="off" />
      <button class="login-btn" id="auth-submit">Sign In →</button>
      <div id="auth-status" style="font-size:0.7rem;color:var(--text3);margin-top:6px;min-height:18px;text-align:center;"></div>
      <div class="login-hint">Server: wss://normos-server.onrender.com</div>
    `;

    const setMode = (m) => {
      mode = m;
      const tl = card.querySelector('#auth-tab-login');
      const ts = card.querySelector('#auth-tab-signup');
      const ti = card.querySelector('#auth-title');
      const sb = card.querySelector('#auth-submit');
      if (m === 'login') {
        tl.style.cssText = 'flex:1;padding:6px;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:5px;cursor:pointer;font-size:0.8rem;font-weight:600;';
        ts.style.cssText = 'flex:1;padding:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);border-radius:5px;cursor:pointer;font-size:0.8rem;';
        ti.textContent   = 'Sign In';
        sb.textContent   = 'Sign In →';
      } else {
        ts.style.cssText = 'flex:1;padding:6px;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:5px;cursor:pointer;font-size:0.8rem;font-weight:600;';
        tl.style.cssText = 'flex:1;padding:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);border-radius:5px;cursor:pointer;font-size:0.8rem;';
        ti.textContent   = 'Create Account';
        sb.textContent   = 'Create Account →';
      }
    };

    card.querySelector('#auth-tab-login').addEventListener('click', () => setMode('login'));
    card.querySelector('#auth-tab-signup').addEventListener('click', () => setMode('signup'));

    const statusEl = card.querySelector('#auth-status');
    const setStatus = (msg, color='var(--text3)') => { statusEl.textContent=msg; statusEl.style.color=color; };

    // Listen for auth results from Network
    const onAuthOk = (data) => {
      clearInterval(ci);
      cleanupListeners();
      state.username = data.username;
      saveState();
      setStatus('✅ Authenticated!', '#4ade80');
      loginEl.style.opacity = '0';
      loginEl.style.transition = 'opacity 0.4s';
      setTimeout(() => { loginEl.style.display = 'none'; showDesktop(); }, 400);
    };
    const onAuthErr = (data) => {
      setStatus('❌ ' + (data.message||'Error'), 'var(--red)');
      card.querySelector('#auth-password').value = '';
      card.querySelector('#auth-password').focus();
    };
    const onAuthRequired = () => {
      setStatus('Server connected — enter your credentials.', '#4ade80');
    };
    const onConnected = () => {
      setStatus('Server connected — enter your credentials.', '#4ade80');
    };
    const cleanupListeners = () => {
      Network.off('auth:ok', onAuthOk);
      Network.off('auth:error', onAuthErr);
      Network.off('auth:required', onAuthRequired);
      Network.off('connected', onConnected);
    };
    Network.on('auth:ok', onAuthOk);
    Network.on('auth:error', onAuthErr);
    Network.on('auth:required', onAuthRequired);
    Network.on('connected', onConnected);

    const doSubmit = () => {
      const uname = (card.querySelector('#auth-username').value||'').trim();
      const pw    = (card.querySelector('#auth-password').value||'').trim();
      if (!uname) { setStatus('Enter a username.', 'var(--red)'); return; }
      if (!pw)    { setStatus('Enter a password.', 'var(--red)'); return; }
      if (!Network.isConnected()) {
        // Offline fallback — just enter desktop with the provided name
        state.username = uname; saveState();
        clearInterval(ci);
        cleanupListeners();
        loginEl.style.opacity='0'; loginEl.style.transition='opacity 0.4s';
        setTimeout(()=>{ loginEl.style.display='none'; showDesktop(); },400);
        return;
      }
      setStatus('Authenticating…', 'var(--text3)');
      if (mode === 'login') Network.login(uname, pw);
      else                  Network.signup(uname, pw);
    };

    card.querySelector('#auth-submit').addEventListener('click', doSubmit);
    card.querySelector('#auth-password').addEventListener('keydown', e => { if (e.key==='Enter') doSubmit(); });
    card.querySelector('#auth-username').addEventListener('keydown', e => { if (e.key==='Enter') card.querySelector('#auth-password').focus(); });
    setTimeout(() => card.querySelector('#auth-username').focus(), 100);

    if (Network.isConnected()) setStatus('Server connected — enter your credentials.', '#4ade80');
    else setStatus('Connecting to server…', '#f59e0b');
  };

  const login = () => document.getElementById('auth-submit')?.click();

  // ── Restore customizations ───────────────────────────────────────────────
  const restoreCustomizations = () => {
    const wp = (() => { try { return localStorage.getItem('normos_wallpaper'); } catch { return null; } })();
    const bg = document.getElementById('desktop-bg');
    if (bg && wp) bg.className = 'desktop-bg ' + wp;

    const accent = (() => { try { return localStorage.getItem('normos_accent'); } catch { return null; } })();
    if (accent) document.body.dataset.accent = accent;

    const fs = (() => { try { return localStorage.getItem('normos_fontsize'); } catch { return null; } })();
    if (fs) document.body.dataset.fontsize = fs;
  };

  // ── Desktop clock widget ─────────────────────────────────────────────────
  let _clockInt = null;
  const buildClockWidget = () => {
    const c = document.getElementById('desktop-widgets');
    if (!c) return;
    if (_clockInt) { clearInterval(_clockInt); _clockInt = null; }
    const show = (() => { try { return localStorage.getItem('normos_widget_clock') !== 'false'; } catch { return true; } })();
    c.innerHTML = '';
    if (!show) return;
    const w = document.createElement('div');
    w.className = 'desk-widget';
    w.innerHTML = `<div class="desk-widget-clock" id="wc-time"></div><div class="desk-widget-date" id="wc-date"></div>`;
    c.appendChild(w);
    const upd = () => {
      const now = new Date();
      const t = document.getElementById('wc-time'); if (t) t.textContent = now.toLocaleTimeString('en-US', { hour12:false });
      const d = document.getElementById('wc-date'); if (d) d.textContent = now.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    };
    upd(); _clockInt = setInterval(upd, 1000);
    w.addEventListener('dblclick', () => apps.open('clock'));
  };
  const toggleClockWidget = () => { buildClockWidget(); };

  // ── Status tray ──────────────────────────────────────────────────────────
  const initStatusTray = () => {
    const el = document.getElementById('tray-status');
    if (!el) return;
    const refresh = () => {
      const status = (() => { try { return localStorage.getItem('normos_status') || ''; } catch { return ''; } })();
      if (status) {
        el.style.display = '';
        el.textContent = status.length > 22 ? status.slice(0, 22) + '…' : status;
        el.title = status;
      } else {
        el.style.display = 'none';
      }
    };
    refresh();
    el.addEventListener('click', () => apps.open('profile'));
    setInterval(refresh, 8000);
  };

  // ── Loan default watcher ─────────────────────────────────────────────────
  const initLoanWatcher = () => {
    const check = () => {
      try {
        const loan = JSON.parse(localStorage.getItem('normos_loan') || 'null');
        if (!loan) return;
        const timeLeft = loan.dueAt - Date.now();
        if (timeLeft <= 0) return; // LoansApp handles the actual default
        if (timeLeft < 120000 && timeLeft > 115000) {
          notify('🏦', 'NormBank', '⚠️ LOAN DUE IN 2 MINUTES. Pay up or lose everything.', 8000);
        } else if (timeLeft < 300000 && timeLeft > 295000) {
          notify('🏦', 'NormBank', 'Loan due in 5 minutes. Open NormBank to repay.', 6000);
        }
      } catch {}
    };
    setInterval(check, 5000);
  };

  // ── Desktop ──────────────────────────────────────────────────────────────
  const showDesktop = () => {
    applyTheme(state.theme);
    restoreCustomizations();
    document.getElementById('desktop').style.display  = 'block';
    document.getElementById('taskbar').style.display  = 'flex';
    buildDesktopIcons();
    buildStartMenu();
    startClock();
    buildClockWidget();
    initSnap();
    initStatusTray();
    initLoanWatcher();

    document.getElementById('desktop').addEventListener('contextmenu', e => {
      if (e.target.closest('.desk-icon')) return;
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { icon:'🔄', label:'Refresh Desktop',   action: buildDesktopIcons },
        { icon:'⚙️', label:'Desktop Settings',  action: ()=>apps.open('settings') },
        { sep:true },
        { icon:'🖥️', label:'Terminal',          action: ()=>apps.open('terminal') },
        { icon:'📁', label:'File Explorer',     action: ()=>apps.open('files') },
        { icon:'📈', label:'NormStock',         action: ()=>apps.open('stocks') },
        { icon:'🏆', label:'Leaderboard',       action: ()=>apps.open('leaderboard') },
        { icon:'🏦', label:'NormBank',           action: ()=>apps.open('bank') },
        { sep:true },
        { icon:'📱', label:'NormTok',           action: ()=>apps.open('normtok') },
        { icon:'👥', label:'Social',            action: ()=>apps.open('social') },
        { icon:'⛏️', label:'NormMiner',         action: ()=>apps.open('miner') },
        { icon:'🎰', label:'NormCasino',        action: ()=>apps.open('casino') },
        { sep:true },
        { icon:'💬', label:'NormChat',          action: ()=>apps.open('chat') },
        { icon:'🏪', label:'NormHub',           action: ()=>apps.open('hub') },
        { icon:'🎨', label:'NormPaint',         action: ()=>apps.open('paint') },
        { icon:'✏️', label:'NormEdit',          action: ()=>apps.open('texteditor') },
        { sep:true },
        { icon:'⚙️', label:'Settings',          action: ()=>apps.open('settings') },
      ]);
    });

    document.addEventListener('mousedown', e => {
      const sm  = document.getElementById('start-menu');
      const ctx = document.getElementById('context-menu');
      if (!e.target.closest('#start-menu') && !e.target.closest('#start-btn')) { sm.style.display = 'none'; sm.classList.remove('open'); }
      if (!e.target.closest('#context-menu')) ctx.style.display = 'none';
    });

    EventBus.on('app:open',   ({ appId, filePath, content }) => apps.open(appId, { filePath, content }));
    EventBus.on('os:reboot',  runReboot);
    EventBus.on('os:logout',  showLogin);

    setTimeout(() => notify('👋', 'Welcome to NormOS v4.0', `Logged in as ${state.username}. Balance: $${Economy.fmt(Economy.state.balance)}`), 1500);
    setTimeout(() => notify('🏦', 'NormBank Central', 'New: Credit scores, deposits, interest. Open NormBank to get started.'), 4000);
    setTimeout(() => notify('☣️', 'Hacking System', 'Hacks now require a minigame. Block attacks by typing the sequence.'), 7000);
    setTimeout(() => notify('📈', 'NormStock', 'Shared global market — your trades affect everyone\'s prices.'), 10000);

    EventBus.emit('os:ready');
    state.firstBoot = false;
    saveState();
  };

  // ── Draggable desktop icons ──────────────────────────────────────────────
  const buildDesktopIcons = () => {
    const container = document.getElementById('desktop-icons');
    container.innerHTML = '';

    const iconApps = [
      'terminal','files','browser','texteditor',
      'sysmon','snake','chat','paint',
      'normsheet','calculator','clock','music','calendar',
      'imagedrop','stocks','leaderboard',
      // v4.0 apps
      'normtok','social','bank','miner',
      'casino','settings','hub',
    ];

    const colH = 90, colW = 90, startX = 12, startY = 12;
    const maxRows = Math.floor((window.innerHeight - 44 - startY) / colH);

    iconApps.forEach((id, i) => {
      const app = appRegistry[id];
      if (!app) return;

      const col  = Math.floor(i / maxRows);
      const row  = i % maxRows;
      const defX = startX + col * colW;
      const defY = startY + row * colH;

      const saved = state.iconPositions[id];
      const x = saved ? saved.x : defX;
      const y = saved ? saved.y : defY;

      const el = document.createElement('div');
      el.className   = 'desk-icon';
      el.dataset.appid = id;
      el.style.cssText = `position:absolute;left:${x}px;top:${y}px;`;
      el.innerHTML   = `<span class="di-emoji">${app.icon}</span><span class="di-label">${app.title}</span>`;

      let dragging = false, dragOffX = 0, dragOffY = 0, didDrag = false;

      el.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        dragging = true; didDrag = false;
        dragOffX = e.clientX - el.offsetLeft;
        dragOffY = e.clientY - el.offsetTop;
        el.classList.add('dragging');
        el.style.zIndex = 50;

        const onMove = (me) => {
          if (!dragging) return;
          didDrag = true;
          const nx = Math.max(0, Math.min(window.innerWidth  - 80,  me.clientX - dragOffX));
          const ny = Math.max(0, Math.min(window.innerHeight - 90 - 44, me.clientY - dragOffY));
          el.style.left = nx + 'px';
          el.style.top  = ny + 'px';
        };
        const onUp = () => {
          dragging = false;
          el.classList.remove('dragging');
          el.style.zIndex = '';
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup',  onUp);
          state.iconPositions[id] = { x: el.offsetLeft, y: el.offsetTop };
          saveState();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
      });

      el.addEventListener('dblclick', () => { if (!didDrag) apps.open(id); });
      el.addEventListener('click', (e) => {
        if (didDrag) { didDrag = false; return; }
        document.querySelectorAll('.desk-icon').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
        e.stopPropagation();
      });
      el.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        document.querySelectorAll('.desk-icon').forEach(i => i.classList.remove('selected'));
        el.classList.add('selected');
        showContextMenu(e.clientX, e.clientY, [
          { icon: app.icon, label: `Open ${app.title}`,  action: ()=>apps.open(id) },
          { icon: '📌',     label: 'Reset Position',      action: ()=>{ delete state.iconPositions[id]; saveState(); buildDesktopIcons(); } },
        ]);
      });

      container.appendChild(el);
    });

    document.getElementById('desktop').addEventListener('mousedown', e => {
      if (!e.target.closest('.desk-icon')) {
        document.querySelectorAll('.desk-icon').forEach(i => i.classList.remove('selected'));
      }
    });
  };

  // ── Window snap ──────────────────────────────────────────────────────────
  const initSnap = () => {
    let snapZone = null;
    document.addEventListener('mousemove', e => {
      if (!WM._drag) { if (snapZone) snapZone.classList.remove('active'); return; }
      if (!snapZone) { snapZone = document.createElement('div'); snapZone.className = 'snap-zone'; document.body.appendChild(snapZone); }
      const thr = 20;
      if      (e.clientX < thr)                    { snapZone.style.cssText = `left:0;top:0;width:50%;height:calc(100vh - var(--taskbar-h))`; snapZone.classList.add('active'); snapZone.dataset.snap = 'left'; }
      else if (e.clientX > window.innerWidth - thr) { snapZone.style.cssText = `right:0;top:0;width:50%;height:calc(100vh - var(--taskbar-h))`; snapZone.classList.add('active'); snapZone.dataset.snap = 'right'; }
      else if (e.clientY < thr)                     { snapZone.style.cssText = `left:0;top:0;width:100%;height:calc(100vh - var(--taskbar-h))`; snapZone.classList.add('active'); snapZone.dataset.snap = 'max'; }
      else { snapZone.classList.remove('active'); snapZone.dataset.snap = ''; }
    });
    document.addEventListener('mouseup', () => {
      if (snapZone?.dataset.snap && WM._drag) {
        const id = WM._drag?.id, snap = snapZone.dataset.snap;
        if (id) {
          const w = WM.getWindow(id);
          if (w) {
            const vpW = window.innerWidth, vpH = window.innerHeight - 44;
            if      (snap === 'left')  { w.el.style.cssText = `left:0;top:0;width:${vpW/2}px;height:${vpH}px;`; w.maximized = false; }
            else if (snap === 'right') { w.el.style.cssText = `left:${vpW/2}px;top:0;width:${vpW/2}px;height:${vpH}px;`; w.maximized = false; }
            else if (snap === 'max')   { WM.toggleMaximize(id); }
          }
        }
        snapZone.classList.remove('active'); snapZone.dataset.snap = '';
      }
    });
  };

  // ── Apps ─────────────────────────────────────────────────────────────────
  const apps = {
    open(appId, opts = {}) {
      const def = appRegistry[appId];
      if (!def) { notify('⚠️', 'NormOS', `Unknown app: ${appId}`); return; }

      state.recentApps = [appId, ...state.recentApps.filter(a => a !== appId)].slice(0, 5);
      saveState();
      refreshStartMenuRecent();

      const content = def.create(opts);
      const vpW = window.innerWidth, vpH = window.innerHeight - 44;
      const w   = Math.min(def.width  || 720, vpW - 40);
      const h   = Math.min(def.height || 480, vpH - 40);

      return WM.open({
        appId,
        title:     opts.filePath ? def.title + ' — ' + opts.filePath.split('/').pop() : def.title,
        icon:      def.icon,
        content,
        width:     w,
        height:    h,
        minWidth:  def.minWidth,
        minHeight: def.minHeight,
        resizable: def.resizable,
      });
    },
  };

  // ── Start menu ───────────────────────────────────────────────────────────
  const buildStartMenu = () => {
    const list = document.getElementById('sm-apps-list');
    list.innerHTML = '';
    Object.entries(appRegistry).forEach(([id, def]) => {
      if (def.hidden) return;
      const el = document.createElement('div');
      el.className = 'sm-app-item';
      el.innerHTML = `<span class="sma-icon">${def.icon}</span>${def.title}`;
      el.addEventListener('click', () => { apps.open(id); ui.toggleStartMenu(false); });
      list.appendChild(el);
    });
    document.getElementById('sm-search')?.addEventListener('input', function() {
      const q = this.value.toLowerCase();
      list.querySelectorAll('.sm-app-item').forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
    document.getElementById('sm-settings-btn')?.addEventListener('click', () => { apps.open('settings'); ui.toggleStartMenu(false); });
    document.getElementById('sm-shutdown-btn')?.addEventListener('click', () => { ui.toggleStartMenu(false); runShutdown(); });
    refreshStartMenuRecent();
  };

  const refreshStartMenuRecent = () => {
    const el = document.getElementById('sm-recent');
    if (!el) return;
    if (!state.recentApps.length) { el.innerHTML = '<div class="sm-recent-none">No recent apps</div>'; return; }
    el.innerHTML = state.recentApps.slice(0, 5).map(id => {
      const def = appRegistry[id]; if (!def) return '';
      return `<div class="sm-recent-item" data-app="${id}">${def.icon} ${def.title}</div>`;
    }).join('');
    el.querySelectorAll('[data-app]').forEach(item => {
      item.addEventListener('click', () => { apps.open(item.dataset.app); ui.toggleStartMenu(false); });
    });
  };

  const ui = {
    toggleStartMenu(force) {
      const sm   = document.getElementById('start-menu');
      const show = force !== undefined ? force : sm.style.display !== 'block';
      sm.style.display = show ? 'block' : 'none';
      if (show) { sm.classList.add('open'); setTimeout(() => document.getElementById('sm-search')?.focus(), 50); }
      else sm.classList.remove('open');
    },
  };

  // ── Context menu ─────────────────────────────────────────────────────────
  const showContextMenu = (x, y, items) => {
    const menu = document.getElementById('context-menu');
    menu.innerHTML = '';
    items.forEach(item => {
      if (item.sep) { const sep = document.createElement('div'); sep.className = 'ctx-sep'; menu.appendChild(sep); }
      else {
        const el = document.createElement('div');
        el.className = 'ctx-item' + (item.danger ? ' danger' : '');
        el.innerHTML = `<span class="ctx-icon">${item.icon || ''}</span>${item.label}`;
        el.addEventListener('click', () => { menu.style.display = 'none'; item.action && item.action(); });
        menu.appendChild(el);
      }
    });
    menu.style.display = 'block';
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, window.innerWidth  - rect.width  - 8) + 'px';
    menu.style.top  = Math.min(y, window.innerHeight - rect.height - 8) + 'px';
  };

  // ── Notifications ────────────────────────────────────────────────────────
  let _notifCount = 0;
  const notify = (icon, title, body, duration = 4000) => {
    _notifCount++;
    const tr = document.getElementById('tray-notifs');
    if (tr) tr.title = `Notifications (${_notifCount})`;
    const container = document.getElementById('notification-container');
    const el = document.createElement('div');
    el.className = 'notification';
    el.innerHTML = `<div class="notif-icon">${icon}</div><div><div class="notif-title">${title}</div><div class="notif-body">${body}</div></div>`;
    const dismiss = () => { el.classList.add('out'); setTimeout(() => { if (el.parentNode) el.remove(); }, 500); };
    el.addEventListener('click', dismiss);
    container.appendChild(el);
    if (duration > 0) setTimeout(dismiss, duration);
  };

  // ── Taskbar clock ────────────────────────────────────────────────────────
  const startClock = () => {
    const el = document.getElementById('taskbar-clock');
    const upd = () => {
      const now = new Date();
      el.innerHTML = `${now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true})}<br><span style="font-size:0.6rem">${now.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>`;
    };
    upd(); setInterval(upd, 1000);
  };

  // ── Wallet tray ──────────────────────────────────────────────────────────
  const initWalletTray = () => {
    const tray     = document.getElementById('taskbar-tray');
    const existing = document.getElementById('tray-wallet');
    if (!tray || existing) return;
    const w = document.createElement('span');
    w.className  = 'tray-icon tray-wallet';
    w.id         = 'tray-wallet';
    w.style.cssText = 'font-family:var(--font-mono);font-size:0.65rem;color:var(--green);min-width:60px;text-align:right;cursor:pointer;';
    w.title      = 'Click to open NormStock';
    w.textContent = '$' + Economy.fmt(Economy.state.balance);
    w.addEventListener('click', () => apps.open('stocks'));
    const notifEl = document.getElementById('tray-notifs');
    tray.insertBefore(w, notifEl);
  };

  // ── Theme ────────────────────────────────────────────────────────────────
  const applyTheme = (theme) => {
    document.body.className = document.body.className.replace(/\btheme-\S+/g, '').trim();
    if (theme && theme !== 'dark') document.body.classList.add(`theme-${theme}`);
    state.theme = theme; saveState();
    EventBus.emit('theme:changed', { theme });
  };
  const setTheme = (theme) => applyTheme(theme);

  // ── Shutdown / Reboot ────────────────────────────────────────────────────
  const runShutdown = () => {
    const overlay = document.getElementById('shutdown-overlay');
    overlay.querySelector('.shutdown-text').textContent = 'Shutting down NormOS...';
    overlay.querySelector('.shutdown-sub').textContent  = 'Saving your files and portfolio. (The portfolio part is real.)';
    overlay.style.display = 'flex';
    Economy.save();
    setTimeout(() => { overlay.querySelector('.shutdown-text').textContent = 'It is safe to turn off your computer.'; }, 2000);
    setTimeout(() => { document.getElementById('desktop').style.display = 'none'; }, 3000);
    setTimeout(() => location.reload(), 5000);
  };
  const runReboot = () => {
    const overlay = document.getElementById('shutdown-overlay');
    overlay.querySelector('.shutdown-text').textContent = 'Rebooting NormOS...';
    overlay.querySelector('.shutdown-sub').textContent  = 'daemon.norm is already back.';
    overlay.style.display = 'flex';
    Economy.save();
    setTimeout(() => location.reload(), 3000);
  };

  // ── Tray ─────────────────────────────────────────────────────────────────
  const initTray = () => {
    document.getElementById('tray-net')?.addEventListener('click',     () => apps.open('leaderboard'));
    document.getElementById('tray-sound')?.addEventListener('click',   () => {
      showContextMenu(window.innerWidth - 160, window.innerHeight - 80, [
        { icon:'🎵', label:'NormTunes', action: ()=>apps.open('music') },
        { icon:'🔇', label:'Mute (imaginary)', action: ()=>notify('🔊','Audio','NormOS Audio: all sounds are imagined') },
      ]);
    });
    document.getElementById('tray-battery')?.addEventListener('click', () =>
      notify('🔋', 'Power', `Battery: ${Math.floor(Math.random() * 40 + 60)}% — Plugged in (virtually)`)
    );
    document.getElementById('tray-notifs')?.addEventListener('click',  () => {
      _notifCount = 0;
      const tr = document.getElementById('tray-notifs'); if (tr) tr.title = 'Notifications (0)';
      notify('🔔', 'Notifications', 'All cleared.', 2000);
    });
    document.getElementById('taskbar-clock')?.addEventListener('click', () => apps.open('clock'));
  };

  // ── Init ─────────────────────────────────────────────────────────────────
  const init = () => {
    document.getElementById('start-btn')?.addEventListener('click', () => ui.toggleStartMenu());
    initTray();
    runBoot();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  EventBus.on('os:ready', () => { initWalletTray(); });

  return { state, saveState, apps, ui, notify, setTheme, showContextMenu, login, toggleClockWidget, appRegistry };
})();