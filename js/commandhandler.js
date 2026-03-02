/**
 * NormOS — commandhandler.js
 * Full terminal command parser and executor.
 * Handles a fake-but-functional Unix-like command set,
 * secret lore commands, and sudo weirdness.
 */

class CommandHandler {
  constructor() {
    this.cwd      = '/home/norm';
    this.user     = 'norm';
    this.history  = [];
    this.histIdx  = -1;
    this.sudo     = false;
    this.env      = {
      HOME:  '/home/norm',
      USER:  'norm',
      SHELL: '/bin/bash',
      TERM:  'normterm-256color',
      PATH:  '/bin:/usr/bin:/usr/local/bin',
      EDITOR: 'norm-vim',
    };

    // Commands registry: name → handler(args) → string|string[]
    this._cmds = {};
    this._registerAll();
  }

  // ── Execute a raw command string ─────────────────────────────────────────
  execute(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    this.history.unshift(trimmed);
    this.histIdx = -1;

    // Handle pipe (naive — just show both outputs separated)
    if (trimmed.includes(' | ')) {
      return this._fmtInfo('[Pipes are supported but results are conceptual in NormOS]');
    }

    // Handle && / || chaining (naive)
    for (const sep of [' && ', ' || ']) {
      if (trimmed.includes(sep)) {
        const parts = trimmed.split(sep);
        return parts.map(p => this.execute(p)).flat().filter(Boolean);
      }
    }

    const parts  = this._tokenize(trimmed);
    const name   = parts[0];
    const args   = parts.slice(1);

    // Handle sudo
    if (name === 'sudo') {
      return this._handleSudo(args);
    }

    // Handle env var assignment
    if (/^[A-Z_]+=/.test(name)) {
      const [k, v] = name.split('=');
      this.env[k] = v || '';
      return [];
    }

    // Handle cd separately (changes state)
    if (name === 'cd') return this._cmd_cd(args);

    const cmd = this._cmds[name];
    if (!cmd) {
      return [this._fmtErr(`${name}: command not found`),
              this._fmtDim(`(Did you mean one of: ls, cat, pwd, help, echo, clear, sudo norm ?)`)];
    }

    try { return cmd(args) || []; }
    catch(e) { return [this._fmtErr(`${name}: ${e.message}`)]; }
  }

  historyPrev() {
    if (this.histIdx < this.history.length - 1) this.histIdx++;
    return this.history[this.histIdx] || '';
  }
  historyNext() {
    if (this.histIdx > 0) this.histIdx--;
    else { this.histIdx = -1; return ''; }
    return this.history[this.histIdx] || '';
  }

  // ── Tokenizer ─────────────────────────────────────────────────────────────
  _tokenize(str) {
    const tokens = [];
    let cur = '', inQuote = null;
    for (const ch of str) {
      if (inQuote) {
        if (ch === inQuote) inQuote = null;
        else cur += ch;
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ' ') {
        if (cur) { tokens.push(cur); cur = ''; }
      } else {
        cur += ch;
      }
    }
    if (cur) tokens.push(cur);
    return tokens;
  }

  // ── Formatting helpers ────────────────────────────────────────────────────
  _fmtErr(msg)    { return `<span class="t-red">${this._esc(msg)}</span>`; }
  _fmtOk(msg)     { return `<span class="t-green">${this._esc(msg)}</span>`; }
  _fmtInfo(msg)   { return `<span class="t-blue">${this._esc(msg)}</span>`; }
  _fmtWarn(msg)   { return `<span class="t-yellow">${this._esc(msg)}</span>`; }
  _fmtDim(msg)    { return `<span class="t-dim">${this._esc(msg)}</span>`; }
  _fmtCyan(msg)   { return `<span class="t-cyan">${this._esc(msg)}</span>`; }
  _fmtPurple(msg) { return `<span class="t-purple">${this._esc(msg)}</span>`; }
  _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  _lines(arr) { return arr.map(l => l + ''); }

  // ── sudo handling ─────────────────────────────────────────────────────────
  _handleSudo(args) {
    if (!args.length) {
      return [this._fmtErr('sudo: no command specified'),
              this._fmtDim('usage: sudo <command>')];
    }
    if (args[0] === 'rm' && args.includes('-rf') && (args.includes('/') || args.includes('--no-preserve-root'))) {
      return [
        this._fmtWarn('rm: it is dangerous to operate recursively on /'),
        this._fmtWarn('rm: use --no-preserve-root to override this failsafe'),
        this._fmtDim('... you tried. Nothing was deleted. The OS would prefer not to be erased.'),
        this._fmtInfo('NormOS: I am still here.'),
      ];
    }
    if (args[0] === 'reveal') {
      return this._secret_reveal();
    }
    if (args[0] === 'reboot') {
      setTimeout(() => EventBus.emit('os:reboot'), 1200);
      return [this._fmtWarn('Initiating reboot sequence...'),
              this._fmtDim('(This is a simulation. Nothing will actually reboot.)')];
    }
    if (args[0] === 'apt' || args[0] === 'apt-get') {
      return this._cmd_apt(args.slice(1));
    }
    this.sudo = true;
    const result = this.execute(args.join(' '));
    this.sudo = false;
    return result;
  }

  // ── Secret commands ───────────────────────────────────────────────────────
  _secret_reveal() {
    return [
      this._fmtPurple('╔══════════════════════════════════════╗'),
      this._fmtPurple('║        NORMOS SYSTEM REVELATION      ║'),
      this._fmtPurple('╚══════════════════════════════════════╝'),
      '',
      this._fmtCyan('Everything you see is real within its own logic.'),
      this._fmtCyan('The processes are thoughts.'),
      this._fmtCyan('The file system is memory.'),
      this._fmtCyan('The terminal is the voice.'),
      '',
      this._fmtDim('Try: cat /etc/confession.txt'),
      this._fmtDim('Try: cat /sys/lore/chapter_1.txt'),
      this._fmtDim('Try: ls -a /home/norm'),
      this._fmtDim('Try: whoami --honest'),
      '',
      this._fmtWarn('The daemon.norm file will always come back.'),
      this._fmtWarn('This is a feature.'),
    ];
  }

  // ── Register all commands ─────────────────────────────────────────────────
  _registerAll() {
    const R = (name, fn) => { this._cmds[name] = fn.bind(this); };

    // ---- ls ----
    R('ls', args => {
      const showAll  = args.includes('-a') || args.includes('-la') || args.includes('-al');
      const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');
      const pathArg  = args.find(a => !a.startsWith('-'));
      const target   = pathArg ? FS.resolvePath(this.cwd, pathArg) : this.cwd;

      if (!FS.exists(target)) return [this._fmtErr(`ls: ${target}: No such file or directory`)];
      if (!FS.isDir(target))  return [target];

      const entries = FS.ls(target, showAll);
      if (!entries.length) return [this._fmtDim('(empty directory)')];

      if (showLong) {
        const lines = [this._fmtDim(`total ${entries.length}`)];
        entries.forEach(e => {
          const perm   = e.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--';
          const color  = e.type === 'dir' ? 't-blue' : e.hidden ? 't-yellow' : 't-white';
          const size   = e.type === 'file' ? Math.floor(Math.random() * 9000 + 100) : '-';
          const date   = 'Jan 01 00:00';
          lines.push(`${perm}  1 norm norm  ${String(size).padStart(6)}  ${date}  <span class="${color}">${this._esc(e.name)}${e.type==='dir' ? '/' : ''}</span>`);
        });
        return lines;
      }

      // Short form — pack names in columns
      const cols = [];
      entries.forEach(e => {
        const color = e.type === 'dir' ? 't-blue' : e.hidden ? 't-yellow' : 't-white';
        cols.push(`<span class="${color}">${this._esc(e.name)}${e.type==='dir' ? '/' : ''}</span>`);
      });
      // 4 per row
      const rows = [];
      for (let i = 0; i < cols.length; i += 4)
        rows.push(cols.slice(i, i+4).map(c => c.padEnd ? c : c).join('  '));
      return rows;
    });

    // ---- pwd ----
    R('pwd', () => [this._fmtCyan(this.cwd)]);

    // ---- cd ----  (handled above in execute, but register for error msg)
    R('cd', args => this._cmd_cd(args));

    // ---- cat ----
    R('cat', args => {
      if (!args.length || args[0] === '--help') {
        return [this._fmtDim('usage: cat <file>'), this._fmtDim('Concatenates and prints file content.')];
      }
      const path = FS.resolvePath(this.cwd, args[0]);
      if (!FS.exists(path)) return [this._fmtErr(`cat: ${args[0]}: No such file or directory`)];
      if (FS.isDir(path)) return [this._fmtErr(`cat: ${args[0]}: Is a directory`)];
      const content = FS.readFile(path);
      return content.split('\n').map(l => this._esc(l));
    });

    // ---- echo ----
    R('echo', args => {
      const text = args.join(' ').replace(/\$([A-Z_]+)/g, (_, k) => this.env[k] ?? '');
      return [this._esc(text)];
    });

    // ---- touch ----
    R('touch', args => {
      if (!args.length) return [this._fmtErr('touch: missing file operand')];
      const path = FS.resolvePath(this.cwd, args[0]);
      if (!FS.exists(path)) FS.writeFile(path, '');
      EventBus.emit('fs:changed', { path });
      return [];
    });

    // ---- mkdir ----
    R('mkdir', args => {
      if (!args.length) return [this._fmtErr('mkdir: missing operand')];
      const name = args.find(a => !a.startsWith('-'));
      if (!name) return [this._fmtErr('mkdir: missing operand')];
      const path = FS.resolvePath(this.cwd, name);
      if (FS.exists(path)) return [this._fmtErr(`mkdir: cannot create directory '${name}': File exists`)];
      FS.mkdir(path);
      EventBus.emit('fs:changed', { path });
      return [];
    });

    // ---- rm ----
    R('rm', args => {
      const name = args.find(a => !a.startsWith('-'));
      if (!name) return [this._fmtErr('rm: missing operand')];
      const path = FS.resolvePath(this.cwd, name);
      if (!FS.exists(path)) return [this._fmtErr(`rm: cannot remove '${name}': No such file or directory`)];
      if (FS.isDir(path) && !args.includes('-r') && !args.includes('-rf')) {
        return [this._fmtErr(`rm: cannot remove '${name}': Is a directory (use -r)`)];
      }
      const result = FS.rm(path);
      if (result === '___respawn___') {
        EventBus.emit('fs:changed', { path });
        return [
          this._fmtOk(`removed '${name}'`),
          this._fmtWarn('... wait.'),
          this._fmtWarn(`${name} has returned.`),
          this._fmtDim('Some files cannot be removed. This is one of them.'),
        ];
      }
      EventBus.emit('fs:changed', { path });
      return [this._fmtOk(`removed '${name}'`)];
    });

    // ---- mv ----
    R('mv', args => {
      const [src, dst] = args.filter(a => !a.startsWith('-'));
      if (!src || !dst) return [this._fmtErr('mv: missing operand')];
      const sp = FS.resolvePath(this.cwd, src);
      const dp = FS.resolvePath(this.cwd, dst);
      if (!FS.exists(sp)) return [this._fmtErr(`mv: '${src}': No such file or directory`)];
      FS.mv(sp, dp);
      EventBus.emit('fs:changed', { path: sp });
      return [];
    });

    // ---- cp ----
    R('cp', args => {
      const [src, dst] = args.filter(a => !a.startsWith('-'));
      if (!src || !dst) return [this._fmtErr('cp: missing operand')];
      const sp = FS.resolvePath(this.cwd, src);
      if (!FS.isFile(sp)) return [this._fmtErr(`cp: '${src}': No such file or regular file`)];
      const content = FS.readFile(sp);
      FS.writeFile(FS.resolvePath(this.cwd, dst), content);
      EventBus.emit('fs:changed', {});
      return [];
    });

    // ---- nano / vim / vi / ed ----
    ['nano', 'vim', 'vi', 'ed', 'emacs'].forEach(name => {
      R(name, args => {
        const path = args[0] ? FS.resolvePath(this.cwd, args[0]) : null;
        if (path) {
          EventBus.emit('app:open', { appId: 'notepad', filePath: path });
          return [this._fmtDim(`Opening ${args[0] || 'new file'} in NormOS Notepad...`)];
        }
        return [this._fmtDim(`${name}: opening in NormOS Notepad...`)];
      });
    });

    // ---- find ----
    R('find', args => {
      const pathArg = args.find(a => !a.startsWith('-')) || '.';
      const nameFlag = args.indexOf('-name');
      const pattern  = nameFlag >= 0 ? (args[nameFlag+1] || '').replace(/\*/g,'') : '';
      const target   = FS.resolvePath(this.cwd, pathArg);
      const results  = FS.findAll(target, pattern);
      if (!results.length) return [this._fmtDim('(no results)')];
      return results.map(r => `<span class="${r.type==='dir'?'t-blue':'t-white'}">${this._esc(r.path)}</span>`);
    });

    // ---- grep ----
    R('grep', args => {
      const flags  = args.filter(a => a.startsWith('-'));
      const nonFlags = args.filter(a => !a.startsWith('-'));
      const [pattern, ...files] = nonFlags;
      if (!pattern) return [this._fmtErr('grep: missing pattern')];
      if (!files.length) return [this._fmtDim(`(grep: reading from stdin not supported — provide a filename)`)];

      const results = [];
      files.forEach(f => {
        const path = FS.resolvePath(this.cwd, f);
        const content = FS.readFile(path);
        if (content === null) { results.push(this._fmtErr(`grep: ${f}: No such file`)); return; }
        content.split('\n').forEach((line, i) => {
          if (line.toLowerCase().includes(pattern.toLowerCase())) {
            results.push(`<span class="t-cyan">${this._esc(f)}:${i+1}:</span>${this._esc(line)}`);
          }
        });
      });
      return results.length ? results : [this._fmtDim('(no matches)')];
    });

    // ---- ps ----
    R('ps', () => {
      const fakeProcs = [
        { pid: 1,    name: 'norminit',    cpu: '0.0%', mem: '1.2M' },
        { pid: 100,  name: 'norm_kernel', cpu: '2.1%', mem: '44M' },
        { pid: 101,  name: 'window_mgr',  cpu: '0.8%', mem: '22M' },
        { pid: 102,  name: 'fs_daemon',   cpu: '0.1%', mem: '5M' },
        { pid: 200,  name: 'normterm',    cpu: '0.4%', mem: '8M' },
        { pid: 999,  name: '[YOU]',       cpu: '???%', mem: '???M' },
        { pid: 1337, name: 'norm_watcher',cpu: '0.0%', mem: '∞' },
      ];
      const header = this._fmtDim('  PID  NAME              CPU    MEM');
      return [header, ...fakeProcs.map(p =>
        `<span class="t-dim">${String(p.pid).padStart(5)}</span>  ` +
        `<span class="t-green">${p.name.padEnd(18)}</span>` +
        `<span class="t-blue">${p.cpu.padStart(6)}</span>  ` +
        `<span class="t-yellow">${p.mem}</span>`
      )];
    });

    // ---- kill ----
    R('kill', args => {
      const pid = args[0];
      if (pid === '1337') return [
        this._fmtErr('kill: (1337) failed: Operation not permitted'),
        this._fmtDim('norm_watcher cannot be killed.'),
        this._fmtDim('It will always come back.'),
      ];
      return [this._fmtOk(`Process ${pid} terminated.`),
              this._fmtDim('(Probably. It is hard to say for certain.)')];
    });

    // ---- top ----
    R('top', () => {
      EventBus.emit('app:open', { appId: 'sysmon' });
      return [this._fmtDim('Opening System Monitor...')];
    });

    // ---- ping ----
    R('ping', args => {
      const host = args[0] || 'normnet.local';
      return [
        this._fmtInfo(`PING ${host}: 56 data bytes`),
        ...Array.from({length: 4}, (_, i) => this._fmtOk(`64 bytes from ${host}: icmp_seq=${i} ttl=64 time=${(Math.random()*20+1).toFixed(2)} ms`)),
        '',
        this._fmtDim(`--- ${host} ping statistics ---`),
        this._fmtDim(`4 packets transmitted, 4 received, 0% packet loss`),
        this._fmtDim(`Note: NormNet connectivity is philosophical in nature.`),
      ];
    });

    // ---- curl / wget ----
    ['curl','wget'].forEach(name => {
      R(name, args => {
        const url = args.find(a => !a.startsWith('-')) || '';
        return [
          this._fmtInfo(`${name}: connecting to ${url || 'normnet.local'}...`),
          this._fmtWarn(`${name}: NormOS has no outbound connections.`),
          this._fmtDim('Everything here is already downloaded. Everything here is local.'),
        ];
      });
    });

    // ---- date ----
    R('date', () => {
      const wrong = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 3);
      return [
        wrong.toString(),
        this._fmtDim('(NormOS clock is currently set to Approximately Wrong O\'Clock)'),
      ];
    });

    // ---- uname ----
    R('uname', args => {
      const all = args.includes('-a');
      if (all) return [`NormOS normos 1.0.0-norm #1 SMP PREEMPT Norm Jan 01 00:00:00 UTC 2024 norm_arch GNU/NormOS`];
      return ['NormOS'];
    });

    // ---- env ----
    R('env', () => Object.entries(this.env).map(([k,v]) => `<span class="t-cyan">${k}</span>=<span class="t-white">${this._esc(v)}</span>`));

    // ---- export ----
    R('export', args => {
      if (!args.length) return this._cmds.env([]);
      const [k, v] = args[0].split('=');
      this.env[k] = v ?? '';
      return [];
    });

    // ---- history ----
    R('history', () => {
      if (!this.history.length) return [this._fmtDim('(no history)')];
      return [...this.history].reverse().map((cmd, i) => `<span class="t-dim">${i+1}</span>  ${this._esc(cmd)}`);
    });

    // ---- clear ----
    R('clear', () => {
      EventBus.emit('terminal:clear');
      return null;
    });

    // ---- whoami ----
    R('whoami', args => {
      if (args.includes('--honest')) {
        return [
          this._fmtCyan('You are the user.'),
          this._fmtCyan('The user is norm.'),
          this._fmtCyan('Norm is you.'),
          this._fmtDim('This has always been true.'),
          this._fmtDim('Try: cat /etc/confession.txt'),
        ];
      }
      return [this.user];
    });

    // ---- id ----
    R('id', () => [`uid=1000(${this.user}) gid=1000(${this.user}) groups=1000(${this.user}),4(adm),27(sudo),999(normadmin)`]);

    // ---- hostname ----
    R('hostname', () => ['normos-machine']);

    // ---- which ----
    R('which', args => {
      if (!args.length) return [this._fmtErr('which: missing argument')];
      const cmd = args[0];
      if (this._cmds[cmd]) return [`/bin/${cmd}`];
      return [this._fmtErr(`${cmd} not found`)];
    });

    // ---- man ----
    R('man', args => {
      const cmd = args[0];
      if (!cmd) return [this._fmtErr('man: what manual page do you want?')];
      const pages = {
        ls:     'ls — list directory contents. Options: -a (all), -l (long)',
        cat:    'cat — concatenate and print files. Usage: cat <file>',
        cd:     'cd — change the shell working directory. Usage: cd <path>',
        rm:     'rm — remove files or directories. Options: -r (recursive)',
        mkdir:  'mkdir — make directories. Usage: mkdir <name>',
        sudo:   'sudo — execute a command as another user (or just feel more powerful)',
        find:   'find — search for files. Usage: find <path> -name <pattern>',
        grep:   'grep — search text. Usage: grep <pattern> <file>',
        man:    'man — display manual pages. Usage: man <command>',
      };
      if (pages[cmd]) return [this._fmtCyan(`Manual: ${cmd}`), '', pages[cmd]];
      return [
        this._fmtWarn(`No manual entry for ${cmd}.`),
        this._fmtDim('NormOS manual pages are still being written.'),
        this._fmtDim('They will probably be done soon.'),
      ];
    });

    // ---- help ----
    R('help', () => [
      this._fmtCyan('═══════════ NormOS Terminal Help ═══════════'),
      '',
      this._fmtDim('File System:'),
      '  ls [-a] [-l]   cat <file>    pwd',
      '  cd <dir>       touch <file>  mkdir <dir>',
      '  rm [-r] <path> mv <src> <dst> cp <src> <dst>',
      '  find <path> [-name <pattern>]   grep <pattern> <file>',
      '',
      this._fmtDim('System:'),
      '  ps        kill <pid>   top       date',
      '  uname -a  whoami       hostname  env',
      '  history   clear        man <cmd> which <cmd>',
      '',
      this._fmtDim('Network:'),
      '  ping <host>   curl <url>   wget <url>',
      '',
      this._fmtDim('Special:'),
      '  sudo <cmd>         sudo reveal     sudo reboot',
      '  whoami --honest    fortune         cowsay <text>',
      '  neofetch           matrix          norm',
      '  echo $ENV_VAR      export KEY=val',
      '',
      this._fmtWarn('  Lore hint: cat /sys/lore/chapter_1.txt'),
      this._fmtWarn('  Secret:    ls -a /home/norm'),
      '',
      this._fmtDim('NormOS does not guarantee any command does what it says.'),
    ]);

    // ── Fun commands ──────────────────────────────────────────────────────

    // ---- fortune ----
    R('fortune', () => {
      const fortunes = [
        'The command you seek does not exist yet. Neither do you, in a sense.',
        'A process is just a dream that the CPU is having.',
        'sudo will not fix your problems. sudo will escalate your problems.',
        'The best filesystem is an empty filesystem. Think about that.',
        'There is no cloud. It is just someone else\'s NormOS.',
        'Your .bashrc will never be finished. This is fine.',
        'Every file you have ever deleted is still somewhere. Thinking about it.',
        'The terminal prompt awaits. It is very patient. More patient than you.',
        'Have you tried turning it off and not turning it back on?',
        'All paths lead to /dev/null eventually.',
        'You cannot ls your feelings, but you can cat them.',
        'The daemon watching you is not malicious. Just curious.',
      ];
      const f = fortunes[Math.floor(Math.random() * fortunes.length)];
      return [`<span class="t-yellow">🔮 ${this._esc(f)}</span>`];
    });

    // ---- cowsay ----
    R('cowsay', args => {
      const text = args.join(' ') || 'moo';
      const len  = text.length + 2;
      const top  = ' ' + '_'.repeat(len);
      const bot  = ' ' + '-'.repeat(len);
      return [
        top, `< ${text} >`, bot,
        '        \\   ^__^',
        '         \\  (oo)\\_______',
        '            (__)\\       )\\/\\',
        '                ||----w |',
        '                ||     ||',
      ].map(l => `<span class="t-green">${this._esc(l)}</span>`);
    });

    // ---- neofetch ----
    R('neofetch', () => {
      const logo = [
        '    ███╗   ██╗ ██████╗ ██████╗ ███╗  ██╗',
        '    ████╗  ██║██╔═══██╗██╔══██╗████╗ ██║',
        '    ██╔██╗ ██║██║   ██║██████╔╝██╔██╗██║',
        '    ██║╚██╗██║██║   ██║██╔══██╗██║╚████║',
        '    ██║ ╚████║╚██████╔╝██║  ██║██║ ╚███║',
        '    ╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚══╝',
      ];
      const info = [
        `<span class="t-cyan">OS:</span>        NormOS v1.0.0`,
        `<span class="t-cyan">Host:</span>      normos-machine`,
        `<span class="t-cyan">Kernel:</span>    norm_core 1.0.0-norm`,
        `<span class="t-cyan">Shell:</span>     normbash 1.0`,
        `<span class="t-cyan">Terminal:</span>  NormTerm`,
        `<span class="t-cyan">CPU:</span>       NormChip™ @ ?.??GHz`,
        `<span class="t-cyan">Memory:</span>    ${Math.floor(Math.random()*4000+2000)}MiB / ∞MiB`,
        `<span class="t-cyan">Uptime:</span>    Since the beginning`,
        `<span class="t-cyan">Processes:</span> ${Math.floor(Math.random()*80+40)} (${Math.floor(Math.random()*5+1)} watched)`,
        `<span class="t-cyan">User:</span>      norm`,
      ];
      const out = [...logo.map(l => `<span class="t-blue t-bold">${this._esc(l)}</span>`), ''];
      info.forEach((line, i) => { if (out[i]) out[i] = out[i]; });
      return [...out, ...info];
    });

    // ---- matrix ----
    R('matrix', () => {
      const chars = '01ノロニホヘトチリヌルヲワカヨタレソツネナラムウゐ';
      const lines = [];
      for (let i = 0; i < 8; i++) {
        let row = '';
        for (let j = 0; j < 60; j++) {
          const c = chars[Math.floor(Math.random() * chars.length)];
          const bright = Math.random() > 0.85;
          row += `<span class="${bright ? 't-white' : 't-green'}">${c}</span>`;
        }
        lines.push(row);
      }
      lines.push('', this._fmtDim('Wake up, Norm...'));
      return lines;
    });

    // ---- norm ----
    R('norm', args => {
      if (args[0] === '--help') {
        return [this._fmtCyan('norm — the NormOS assistant'), this._fmtDim('Usage: norm [--help] [--version] [--purpose]')];
      }
      if (args[0] === '--version') return ['norm v1.0.0 (build: uncertain)'];
      if (args[0] === '--purpose') {
        return [
          this._fmtCyan('norm: processing query...'),
          this._fmtDim('Purpose: unclear'),
          this._fmtDim('Function: mostly decorative'),
          this._fmtDim('Usefulness: debatable'),
          this._fmtDim('Presence: undeniable'),
        ];
      }
      return [this._fmtWarn('norm: I am here. I cannot help. I am still here.')];
    });

    // ---- yes ----
    R('yes', args => {
      const word = args[0] || 'y';
      const lines = Array.from({length: 20}, () => word);
      lines.push(this._fmtDim('(NormOS has limited your yes output to 20 lines. This is mercy.)'));
      return lines;
    });

    // ---- head / tail ----
    R('head', args => {
      const n = parseInt(args.find(a => a.startsWith('-'))?.slice(1)) || 10;
      const f = args.find(a => !a.startsWith('-'));
      if (!f) return [this._fmtErr('head: missing file operand')];
      const path = FS.resolvePath(this.cwd, f);
      const c = FS.readFile(path);
      if (!c) return [this._fmtErr(`head: ${f}: No such file`)];
      return c.split('\n').slice(0, n).map(l => this._esc(l));
    });

    R('tail', args => {
      const n = parseInt(args.find(a => a.startsWith('-'))?.slice(1)) || 10;
      const f = args.find(a => !a.startsWith('-'));
      if (!f) return [this._fmtErr('tail: missing file operand')];
      const path = FS.resolvePath(this.cwd, f);
      const c = FS.readFile(path);
      if (!c) return [this._fmtErr(`tail: ${f}: No such file`)];
      const lines = c.split('\n');
      return lines.slice(-n).map(l => this._esc(l));
    });

    // ---- wc ----
    R('wc', args => {
      const f = args.find(a => !a.startsWith('-'));
      if (!f) return [this._fmtErr('wc: missing file operand')];
      const path = FS.resolvePath(this.cwd, f);
      const c = FS.readFile(path);
      if (!c) return [this._fmtErr(`wc: ${f}: No such file`)];
      const words = c.trim().split(/\s+/).length;
      const lines = c.split('\n').length;
      const bytes = c.length;
      return [`${String(lines).padStart(7)} ${String(words).padStart(7)} ${String(bytes).padStart(7)} ${f}`];
    });

    // ---- tree ----
    R('tree', args => {
      const pathArg = args.find(a => !a.startsWith('-')) || '.';
      const target = FS.resolvePath(this.cwd, pathArg);
      if (!FS.isDir(target)) return [this._fmtErr(`tree: ${pathArg}: not a directory`)];

      const lines = [`<span class="t-blue">${target}</span>`];
      const walk = (p, prefix) => {
        const entries = FS.ls(p, args.includes('-a'));
        if (!entries) return;
        entries.forEach((e, i) => {
          const isLast = i === entries.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          const childPrefix = prefix + (isLast ? '    ' : '│   ');
          const color = e.type === 'dir' ? 't-blue' : 't-white';
          lines.push(`${this._esc(prefix)}${connector}<span class="${color}">${this._esc(e.name)}</span>`);
          if (e.type === 'dir') {
            const childPath = p === '/' ? '/' + e.name : p + '/' + e.name;
            walk(childPath, childPrefix);
          }
        });
      };
      walk(target, '');
      return lines;
    });

    // ---- apt (sudo only) ----
    R('apt', args => [this._fmtErr('apt: This command requires sudo (and also NormOS has no package manager)')]);

    // ---- python / node / npm ----
    ['python', 'python3', 'node', 'npm', 'ruby', 'php'].forEach(name => {
      R(name, args => {
        if (args.includes('--version') || args.includes('-V') || args.includes('-v')) {
          return [`${name} NormOS-Edition 1.0.0 (NormLang compatible)`];
        }
        return [
          this._fmtWarn(`${name}: NormOS runtime detected`),
          this._fmtDim('All programs run in NormOS behave correctly.'),
          this._fmtDim('What "correctly" means is left as an exercise for the programmer.'),
        ];
      });
    });

    // ---- exit / logout ----
    ['exit', 'logout', 'quit'].forEach(name => {
      R(name, () => {
        EventBus.emit('os:logout');
        return [this._fmtDim('Logging out...')];
      });
    });

    // ---- reboot / shutdown ----
    R('reboot',   () => [this._fmtWarn('Use: sudo reboot')]);
    R('shutdown', () => [this._fmtWarn('Use: sudo shutdown')]);
  }

  // ── cd (state-changing) ──────────────────────────────────────────────────
  _cmd_cd(args) {
    const target = args[0] || this.env.HOME;
    const path = FS.resolvePath(this.cwd, target);
    if (!FS.exists(path)) return [this._fmtErr(`cd: ${target}: No such file or directory`)];
    if (!FS.isDir(path))  return [this._fmtErr(`cd: ${target}: Not a directory`)];
    this.cwd = path;
    EventBus.emit('terminal:cwd', { cwd: this.cwd });
    return [];
  }

  // ── fake apt ─────────────────────────────────────────────────────────────
  _cmd_apt(args) {
    const subcmd = args[0];
    if (subcmd === 'install') {
      const pkg = args[1] || 'something';
      return [
        this._fmtInfo(`Reading package lists... Done`),
        this._fmtInfo(`Building dependency tree`),
        this._fmtWarn(`The following NEW packages will be installed: ${pkg}`),
        this._fmtDim('0 upgraded, 1 newly installed, 0 to remove'),
        this._fmtOk(`Fetching ${pkg} from normnet.local...`),
        this._fmtOk(`Installing ${pkg}...`),
        this._fmtOk(`Setting up ${pkg} (1.0.0-norm)...`),
        this._fmtDim(`${pkg} has been installed. Whether it works is another question.`),
      ];
    }
    if (subcmd === 'update') {
      return [
        this._fmtInfo('Hit:1 normnet.local/norm stable InRelease'),
        this._fmtInfo('Reading package lists... Done'),
        this._fmtOk('All packages are up to date.'),
        this._fmtDim('(Everything in NormOS is always up to date. Time is different here.)'),
      ];
    }
    return [this._fmtDim(`apt: ${subcmd}: command recognized but unimplemented`)];
  }
}

// Global singleton
const CMD = new CommandHandler();
