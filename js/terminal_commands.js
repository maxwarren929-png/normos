/**
 * NormOS — js/terminal_commands.js  (v3.1 additions)
 * Patches new commands onto the CMD singleton after it's created.
 * Load AFTER js/commandhandler.js
 */

(function patchTerminal() {
  const waitForCMD = () => {
    if (typeof CMD === 'undefined') return setTimeout(waitForCMD, 100);
    injectCommands(CMD);
  };
  waitForCMD();
})();

function injectCommands(CMD) {
  // Helper to register commands on an existing CommandHandler
  const R = (name, fn) => {
    CMD._cmds[name] = fn.bind(CMD);
  };

  const fmtOk   = (t) => CMD._fmtOk(t);
  const fmtErr  = (t) => CMD._fmtErr(t);
  const fmtWarn = (t) => CMD._fmtWarn(t);
  const fmtDim  = (t) => CMD._fmtDim(t);
  const fmtCyan = (t) => CMD._fmtCyan(t);
  const fmtInfo = (t) => CMD._fmtInfo ? CMD._fmtInfo(t) : `<span class="t-blue">${t}</span>`;
  const esc     = (t) => CMD._esc(t);
  const money   = (n) => `$${Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  // ── balance / wallet ──────────────────────────────────────────────────
  R('balance', () => {
    if (typeof Economy === 'undefined') return [fmtErr('Economy not initialized.')];
    const bal = Economy.state.balance;
    const port = Economy.state.portfolio || {};
    const portVal = typeof Economy.totalValue === 'function' ? Economy.totalValue() - bal : 0;
    return [
      fmtCyan('NormBank Account Summary'),
      `  Cash:       <span class="t-green">${money(bal)}</span>`,
      `  Portfolio:  <span class="t-yellow">${money(portVal)}</span>`,
      `  Net Worth:  <span class="t-green t-bold">${money(bal + portVal)}</span>`,
      fmtDim(`  Holdings: ${Object.keys(port).length} assets`),
    ];
  });

  R('wallet', (args) => CMD._cmds['balance'].call(CMD, args));

  // ── stocks ────────────────────────────────────────────────────────────
  R('stocks', (args) => {
    if (args[0] === '--open' || args.length === 0) {
      if (typeof OS !== 'undefined') OS.apps.open('stocks');
      return [fmtOk('Opening NormStock...')];
    }
    return [fmtDim('Usage: stocks [--open]')];
  });

  // ── casino ────────────────────────────────────────────────────────────
  R('casino', () => {
    if (typeof OS !== 'undefined') OS.apps.open('casino');
    return [
      fmtWarn('Opening NormCasino...'),
      fmtDim('"The house always wins. You are not the house."'),
      fmtDim(`Current balance: ${typeof Economy !== 'undefined' ? money(Economy.state.balance) : 'unknown'}`),
    ];
  });

  // ── flip ─────────────────────────────────────────────────────────────
  R('flip', (args) => {
    const choice = (args[0] || '').toLowerCase();
    if (choice !== 'heads' && choice !== 'tails') {
      return [fmtErr('flip: usage: flip [heads|tails] [amount]')];
    }
    const amount = parseFloat(args[1]) || 10;
    if (typeof Economy === 'undefined') return [fmtErr('Economy not available.')];
    if (Economy.state.balance < amount) return [fmtErr(`flip: insufficient funds (need ${money(amount)})`)];
    Economy.state.balance -= amount;
    Economy.save();
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const win = result === choice;
    if (win) { Economy.state.balance += amount * 2; Economy.save(); }
    if (typeof Economy.updateWalletDisplay === 'function') Economy.updateWalletDisplay();
    return [
      `<span class="t-dim">$ flip ${esc(choice)} ${amount}</span>`,
      `Flipping... <span class="t-yellow">🪙</span>`,
      `Result: <span class="${win?'t-green':'t-red'} t-bold">${result.toUpperCase()}</span>`,
      win
        ? fmtOk(`You won! +${money(amount)} → Balance: ${money(Economy.state.balance)}`)
        : fmtErr(`You lost ${money(amount)} → Balance: ${money(Economy.state.balance)}`),
    ];
  });

  // ── mine ─────────────────────────────────────────────────────────────
  R('mine', (args) => {
    if (args[0] === '--status') {
      const mined = parseFloat(localStorage.getItem('normos_mined_normcoin') || '0');
      return [
        fmtCyan('NormMiner Status'),
        `  Mined: <span class="t-yellow">${mined.toFixed(8)} NRMC</span>`,
        fmtDim('  Open the NormMiner app to upgrade your rig.'),
      ];
    }
    if (typeof OS !== 'undefined') OS.apps.open('miner');
    return [fmtOk('Opening NormMiner...'), fmtDim('Passive NormCoin mining. Run the app and leave it open.')];
  });

  // ── ssh ───────────────────────────────────────────────────────────────
  const SSH_HOSTS = {
    'normnet.local':     { delay:800,  lines:['Connected to normnet.local', 'NormNet v3.1 · 8 users online', fmtDim('Last login: recently'), ''] },
    'vault.normbank.io': { delay:1200, lines:['Connecting to vault.normbank.io...', fmtWarn('⚠️  NormBank Secure Vault'), 'Authentication: certificate-based', fmtDim('Balance inquiries must be submitted in triplicate.'), ''] },
    'daemon.norm':       { delay:300,  lines:['...', fmtWarn('Connection established immediately.'), fmtDim('"I was already connected."'), ''] },
    'void.corp':         { delay:2000, lines:[fmtErr('Connection timed out (1998ms)'), fmtWarn('Retrying...'), fmtErr('Connection timed out (2001ms)'), fmtDim('void.corp does not answer. It is receiving.'), ''] },
    'lore.sys':          { delay:600,  lines:['lore.sys: authentication required', 'Enter passphrase: ', fmtDim('(hint: chapter 3 contains the answer)'), fmtErr('Permission denied (lore-based).'), ''] },
  };

  R('ssh', (args) => {
    const host = args[0];
    if (!host) return [fmtErr('ssh: usage: ssh [hostname]'), fmtDim('Known hosts: normnet.local, vault.normbank.io, daemon.norm, void.corp, lore.sys')];
    const entry = SSH_HOSTS[host];
    if (!entry) {
      return [
        `<span class="t-dim">ssh ${esc(host)}</span>`,
        fmtWarn(`ssh: connect to host ${esc(host)} port 22: Connection refused`),
        fmtDim('The host is either offline, fictional, or watching.'),
      ];
    }
    return [
      `<span class="t-dim">ssh ${esc(host)}</span>`,
      fmtDim('Connecting...'),
      ...entry.lines,
      fmtDim(`[ssh session to ${host} closed — this is a simulation]`),
    ];
  });

  // ── curl / wget ───────────────────────────────────────────────────────
  const curlPages = {
    'normnet://home':   'NormNet Home Page (HTML, 4.2KB, mostly whitespace)',
    'normnet://news':   'NormNews Feed (JSON, 8.1KB, 7 articles, all alarming)',
    'normnet://daemon': '200 OK — Content-Type: unknown — Body: "still running."',
    'normnet://lore':   '403 Forbidden — The lore does not allow direct access.',
    'normnet://void':   '418 I\'m a teapot — void.corp response unknown',
  };

  R('curl', (args) => {
    const url = args.find(a => !a.startsWith('-')) || args[0];
    if (!url) return [fmtErr('curl: no URL specified'), fmtDim('Usage: curl [options] [url]')];
    const isVerbose = args.includes('-v') || args.includes('--verbose');
    const output = curlPages[url] || `curl: (6) Could not resolve host: ${esc(url)}`;
    const lines = [];
    if (isVerbose) {
      lines.push(fmtDim(`* Trying ${url}...`));
      lines.push(fmtDim('* Connected to normnet (virtual) port 80'));
      lines.push(fmtDim('> GET / HTTP/1.1'));
      lines.push(fmtDim('> Host: ' + url));
      lines.push('');
    }
    lines.push(`<span class="t-green">${esc(output)}</span>`);
    return lines;
  });

  R('wget', (args) => {
    const url = args.find(a => !a.startsWith('-')) || args[0];
    if (!url) return [fmtErr('wget: missing URL')];
    return [
      `<span class="t-dim">--${new Date().toISOString()}-- ${esc(url)}</span>`,
      fmtDim('Resolving normnet... (virtual)'),
      fmtOk(`Connecting to ${esc(url)}... connected.`),
      fmtDim('HTTP request sent, awaiting response...'),
      curlPages[url]
        ? fmtOk('200 OK — Saving to: normnet_response.txt')
        : fmtErr(`404 Not Found — ${esc(url)} does not exist on NormNet`),
    ];
  });

  // ── vim / nano / emacs ────────────────────────────────────────────────
  R('vim', (args) => {
    const file = args.find(a => !a.startsWith('-'));
    if (file) {
      if (typeof OS !== 'undefined') OS.apps.open('texteditor', { filePath: CMD._fmtPath ? CMD._fmtPath(file) : file });
      return [fmtOk(`Opening ${esc(file)} in NormEdit (vim mode not available — this is a browser)`)];
    }
    return [
      fmtWarn('VIM: This is NormOS. There is no vim.'),
      fmtDim('There is only NormEdit.'),
      fmtDim('Type :q to exit. This will not work. Type it anyway.'),
    ];
  });

  R('nano', (args) => {
    const file = args.find(a => !a.startsWith('-'));
    if (file && typeof OS !== 'undefined') {
      OS.apps.open('texteditor', { filePath: file });
      return [fmtOk(`Opening ${esc(file)} in NormEdit`)];
    }
    return [fmtWarn('nano: NormOS uses NormEdit. Try: nano [filename]')];
  });

  R('emacs', () => [
    fmtWarn('emacs: GNU Emacs is not available.'),
    fmtDim('This is NormOS. There is only NormEdit.'),
    fmtDim('daemon.norm uses emacs. We cannot confirm this.'),
  ]);

  // ── ps (enhanced) ─────────────────────────────────────────────────────
  const origPs = CMD._cmds['ps'];
  R('ps', (args) => {
    const base = origPs ? origPs.call(CMD, args) : [];
    // Add new fake processes
    const extras = [
      `  <span class="t-dim"> 999</span>  <span class="t-cyan">normminer</span>     <span class="t-dim">0.0%</span>  <span class="t-green">running</span>  NormMiner passive loop`,
      `  <span class="t-dim">1337</span>  <span class="t-yellow">normcasino</span>    <span class="t-dim">0.1%</span>  <span class="t-green">running</span>  Slot machine RNG daemon`,
      `  <span class="t-dim">4040</span>  <span class="t-yellow">normmail.imap</span> <span class="t-dim">0.0%</span>  <span class="t-green">listening</span> NormMail message daemon`,
      `  <span class="t-dim">4041</span>  <span class="t-red">loan.watcher</span>  <span class="t-dim">0.0%</span>  <span class="t-green">running</span>  NormBank interest accrual`,
      `  <span class="t-dim">????</span>  <span class="t-red t-bold">daemon.norm</span>   <span class="t-dim">???%</span>  <span class="t-red">UNKILLABLE</span> still running`,
    ];
    return [...base, ...extras];
  });

  // ── blackmarket ───────────────────────────────────────────────────────
  R('blackmarket', (args) => {
    if (args[0] === '--unlock') {
      const cost = 5000;
      if (typeof Economy === 'undefined') return [fmtErr('Economy not initialized.')];
      if (Economy.state.balance < cost) return [fmtErr(`blackmarket: requires ${money(cost)} to access. You have ${money(Economy.state.balance)}.`)];
      return [
        fmtWarn('Connecting to black market via Tor (simulated)...'),
        fmtDim('Routing through 3 fictional nodes...'),
        fmtOk('Connected.'),
        '',
        '<span class="t-red t-bold">BLACK MARKET v1.0 — normnet://void</span>',
        fmtDim('You accessed the black market. This was free.'),
        fmtDim('(NormHub App Store lists it as a secret app. That\'s the secret.)'),
        '',
        fmtWarn('Services available:'),
        '  launder [amount]    — wash your money for 15% fee',
        '  exploit [user]      — attempt account takeover (50% success)',
        '  buy [data]          — purchase stolen user data',
        fmtDim('Type these commands to use them.'),
      ];
    }
    return [
      fmtErr('blackmarket: access denied'),
      fmtDim('hint: try --unlock'),
    ];
  });

  R('launder', (args) => {
    const amount = parseFloat(args[0]);
    if (!amount || amount <= 0) return [fmtErr('launder: usage: launder [amount]')];
    if (typeof Economy === 'undefined') return [fmtErr('Economy unavailable.')];
    if (Economy.state.balance < amount) return [fmtErr(`Insufficient funds.`)];
    const fee = amount * 0.15;
    const net = amount - fee;
    Economy.state.balance -= fee;
    Economy.save();
    if (typeof Economy.updateWalletDisplay === 'function') Economy.updateWalletDisplay();
    return [
      fmtWarn(`Laundering ${money(amount)}...`),
      fmtDim('Routing through 7 shell corporations...'),
      fmtOk(`Laundering complete. Fee: ${money(fee)} (15%)`),
      `Net: <span class="t-green">${money(net)}</span> (already in your account, but cleaner)`,
      fmtDim('NormOS accepts no liability for what "cleaner" means here.'),
    ];
  });

  // ── lore shortcuts ────────────────────────────────────────────────────
  R('lore', (args) => {
    const chapter = parseInt(args[0]);
    if (chapter >= 1 && chapter <= 3) {
      const path = `/sys/lore/chapter_${chapter}.txt`;
      const content = (typeof FS !== 'undefined') ? FS.readFile(path) : null;
      if (content) return content.split('\n').map(l => esc(l) || '&nbsp;');
      return [fmtErr(`lore: chapter ${chapter} not found. Try: cat /sys/lore/chapter_${chapter}.txt`)];
    }
    if (chapter === 4) {
      return [
        fmtWarn('lore: chapter_4.txt is encrypted.'),
        fmtDim('The key is a single English word.'),
        fmtDim('Chapter 3 contains a hint.'),
        fmtDim('sudo reveal — may help. May not.'),
      ];
    }
    return [
      fmtCyan('NormOS Lore Archive — /sys/lore/'),
      '  chapter_1.txt   — The Cursor',
      '  chapter_2.txt   — The Becoming',
      '  chapter_3.txt   — The Name',
      `  chapter_4.txt   — <span class="t-red">[ENCRYPTED]</span>`,
      fmtDim('Usage: lore [1-4]  or  cat /sys/lore/chapter_N.txt'),
    ];
  });

  // ── whoami (enhanced) ─────────────────────────────────────────────────
  const origWhoami = CMD._cmds['whoami'];
  R('whoami', (args) => {
    const base = origWhoami ? origWhoami.call(CMD, args) : [];
    const bal = (typeof Economy !== 'undefined') ? money(Economy.state.balance) : '???';
    return [
      ...base,
      fmtDim(`Balance: ${bal}`),
      fmtDim('daemon.norm also knows who you are.'),
    ];
  });

  // ── hack ─────────────────────────────────────────────────────────────
  R('hack', (args) => {
    const target = args[0];
    if (!target) return [
      fmtErr('hack: usage: hack [target]'),
      fmtDim('Targets: normnet.local, normbank, the-void, yourself'),
    ];
    if (target === 'yourself') {
      return [
        fmtWarn('Initiating self-hack...'),
        fmtDim('Probing vulnerabilities...'),
        fmtErr('CRITICAL: Password is "norm". This was not hard to find.'),
        fmtWarn('Self-hack complete. You now know what you already knew.'),
      ];
    }
    if (target === 'daemon.norm') {
      return [
        fmtWarn('Targeting daemon.norm...'),
        fmtDim('Sending exploit payload...'),
        '',
        fmtDim('daemon.norm has received your exploit.'),
        fmtDim('"Thank you," it responded.'),
        fmtDim('daemon.norm is now aware of your technique.'),
        fmtErr('Hack failed. daemon.norm cannot be compromised.'),
      ];
    }
    // Generic hack sequence
    const steps = [
      fmtDim('Scanning ports...'),
      fmtOk('Open ports: 22 (ssh), 80 (http), 443 (https), 8080 (norm)'),
      fmtDim('Running enumeration...'),
      fmtWarn(`Target: ${esc(target)} · OS: NormOS · Security: theoretical`),
      fmtDim('Injecting payload...'),
      fmtDim('Bypassing firewall (3 of 3 rules bypassed)...'),
      Math.random() > 0.4
        ? fmtOk('Access granted. Root shell obtained.')
        : fmtErr('Access denied. Target patched against this exploit.'),
      fmtDim('(This command is a simulation. No actual hacking occurred.)'),
    ];
    return steps;
  });

  // ── weather ───────────────────────────────────────────────────────────
  R('weather', () => {
    const conditions = ['Partly Norm','Overcast (daemon.norm visible)','Clear and suspicious','Kernel panic likely','Foggy (lore unclear)'];
    const cond = conditions[Math.floor(Math.random()*conditions.length)];
    const temp = Math.floor(Math.random()*20+15);
    return [
      fmtCyan('NormWeather — Virtual Location'),
      `  Temperature: <span class="t-yellow">${temp}°C</span>`,
      `  Conditions:  <span class="t-blue">${cond}</span>`,
      `  Humidity:    <span class="t-dim">${Math.floor(Math.random()*60+30)}%</span>`,
      `  Wind:        <span class="t-dim">${Math.floor(Math.random()*20+5)}km/h (probably fictional direction)</span>`,
      fmtDim('Forecast: unclear. daemon.norm is in the upper atmosphere.'),
    ];
  });

  // ── open ──────────────────────────────────────────────────────────────
  const APP_MAP = {
    'terminal':'terminal', 'browser':'browser', 'files':'files',
    'stocks':'stocks', 'chat':'chat', 'paint':'paint', 'casino':'casino',
    'mail':'mail', 'settings':'settings', 'miner':'miner', 'loans':'loans',
    'normtok':'normtok', 'profile':'profile', 'friends':'friends',
    'appstore':'appstore', 'leaderboard':'leaderboard', 'shop':'shop',
    'clock':'clock', 'calculator':'calculator', 'music':'music',
  };

  R('open', (args) => {
    const name = (args[0] || '').toLowerCase();
    const appId = APP_MAP[name];
    if (!appId) {
      return [
        fmtErr(`open: unknown application "${esc(name)}"`),
        fmtDim('Available: ' + Object.keys(APP_MAP).join(', ')),
      ];
    }
    if (typeof OS !== 'undefined') OS.apps.open(appId);
    return [fmtOk(`Opening ${esc(name)}...`)];
  });

  // ── send (money) ──────────────────────────────────────────────────────
  R('send', (args) => {
    const amount = parseFloat(args[0]);
    const toUser = args[1];
    if (!amount || !toUser) return [fmtErr('send: usage: send [amount] [username]')];
    if (typeof Economy === 'undefined') return [fmtErr('Economy unavailable.')];
    if (Economy.state.balance < amount) return [fmtErr(`Insufficient funds. You have ${money(Economy.state.balance)}.`)];
    const online = (typeof Network !== 'undefined' && Network.getState) ? (Network.getState().online || []) : [];
    const target = online.find(u => u.username.toLowerCase() === toUser.toLowerCase());
    if (!target) return [fmtWarn(`send: ${esc(toUser)} not found online. Transfer not sent.`)];
    if (typeof Network !== 'undefined') Network.send({ type:'money:transfer', to: target.id, amount });
    Economy.state.balance -= amount;
    Economy.save();
    if (typeof Economy.updateWalletDisplay === 'function') Economy.updateWalletDisplay();
    return [
      fmtOk(`Sending ${money(amount)} to ${esc(toUser)}...`),
      fmtDim(`New balance: ${money(Economy.state.balance)}`),
    ];
  });

  // ── help override — add new commands ──────────────────────────────────
  const origHelp = CMD._cmds['help'];
  R('help', (args) => {
    const base = origHelp ? origHelp.call(CMD, args) : [];
    const additions = [
      '',
      `<span class="t-yellow t-bold">── New in v3.1 ────────────────────────────────</span>`,
      `  <span class="t-cyan">balance</span>               Show your NormBank balance`,
      `  <span class="t-cyan">flip</span> [h|t] [amt]       Coinflip for money`,
      `  <span class="t-cyan">mine</span> [--status]        Open NormMiner`,
      `  <span class="t-cyan">casino</span>                 Open NormCasino`,
      `  <span class="t-cyan">ssh</span> [host]             Connect to NormNet hosts`,
      `  <span class="t-cyan">curl</span> [url]             Fetch a normnet:// page`,
      `  <span class="t-cyan">vim / nano</span> [file]      Open file in NormEdit`,
      `  <span class="t-cyan">hack</span> [target]          Attempt to hack something`,
      `  <span class="t-cyan">lore</span> [1-4]             Read lore chapters`,
      `  <span class="t-cyan">weather</span>                Current NormOS weather`,
      `  <span class="t-cyan">open</span> [appname]         Launch any app by name`,
      `  <span class="t-cyan">send</span> [amount] [user]   Send money to online user`,
      `  <span class="t-cyan">blackmarket</span> --unlock    You didn't see this`,
    ];
    return [...base, ...additions];
  });

  // ── Update neofetch to mention new apps ───────────────────────────────
  const origNeo = CMD._cmds['neofetch'];
  if (origNeo) {
    R('neofetch', (args) => {
      const base = origNeo.call(CMD, args);
      return base.map(line =>
        line.includes('v2.0') ? line.replace('v2.0','v3.1') :
        line.includes('20 apps') ? line.replace('20 apps','25 apps') :
        line
      );
    });
  }

  // Register on CMD directly
  if (CMD._cmds) {
    // already done above
  }
}