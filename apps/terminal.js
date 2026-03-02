/**
 * NormOS — apps/terminal.js
 * Terminal emulator: renders output, handles input, autocomplete,
 * history navigation, and connects to CommandHandler.
 */

const TerminalApp = {
  // ── Create terminal content element ─────────────────────────────────────
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'terminal-wrap';
    wrap.innerHTML = `
      <div class="terminal-output" id="term-output"></div>
      <div class="terminal-input-row">
        <span class="term-prompt" id="term-prompt-label">norm@normos:<span class="term-cwd" id="term-cwd-label">~</span>$</span>
        <input class="term-input-field" id="term-input" type="text" autocomplete="off" spellcheck="false" />
      </div>
    `;

    // Wait for DOM insertion
    requestAnimationFrame(() => {
      const output = wrap.querySelector('#term-output');
      const input  = wrap.querySelector('#term-input');
      const cwdLbl = wrap.querySelector('#term-cwd-label');

      // Welcome banner
      TerminalApp._printBanner(output);

      // Focus input when clicking anywhere in terminal
      wrap.addEventListener('click', () => input.focus());
      input.focus();

      // Update CWD label
      const updateCwd = ({ cwd }) => {
        const home = CMD.env.HOME;
        cwdLbl.textContent = cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd;
      };
      updateCwd({ cwd: CMD.cwd });
      EventBus.on('terminal:cwd', updateCwd);

      // Clear event
      EventBus.on('terminal:clear', () => { output.innerHTML = ''; });

      // Keydown handler
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const raw = input.value;
          // Echo the command
          const prompt = `<span class="t-green">norm@normos</span><span class="t-dim">:</span><span class="t-blue">${TerminalApp._getCwdDisplay()}</span><span class="t-dim">$</span> `;
          TerminalApp._appendLine(output, prompt + TerminalApp._esc(raw));
          input.value = '';

          if (raw.trim()) {
            const result = CMD.execute(raw);
            if (Array.isArray(result)) {
              result.forEach(line => TerminalApp._appendLine(output, line));
            } else if (typeof result === 'string') {
              TerminalApp._appendLine(output, result);
            }
            updateCwd({ cwd: CMD.cwd });
          }
          TerminalApp._scrollBottom(output);

        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          input.value = CMD.historyPrev();
          TerminalApp._moveCursorToEnd(input);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          input.value = CMD.historyNext();
          TerminalApp._moveCursorToEnd(input);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          TerminalApp._autocomplete(input, output, updateCwd);
        } else if (e.key === 'c' && e.ctrlKey) {
          TerminalApp._appendLine(output, '^C');
          input.value = '';
        } else if (e.key === 'l' && e.ctrlKey) {
          e.preventDefault();
          output.innerHTML = '';
        }
      });
    });

    return wrap;
  },

  _getCwdDisplay() {
    const home = CMD.env.HOME;
    const cwd  = CMD.cwd;
    const display = cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd;
    return TerminalApp._esc(display);
  },

  _printBanner(output) {
    const lines = [
      `<span class="t-blue t-bold">NormOS Terminal v1.0</span>  <span class="t-dim">(normbash 1.0.0)</span>`,
      `<span class="t-dim">Type </span><span class="t-cyan">help</span><span class="t-dim"> for available commands.</span>`,
      `<span class="t-dim">Type </span><span class="t-cyan">neofetch</span><span class="t-dim"> for system info. </span><span class="t-yellow">sudo reveal</span><span class="t-dim"> for secrets.</span>`,
      '',
    ];
    lines.forEach(l => TerminalApp._appendLine(output, l));
  },

  _appendLine(output, html) {
    const line = document.createElement('div');
    line.className = 't-line';
    line.innerHTML = (html === '' || html == null) ? '&nbsp;' : html;
    output.appendChild(line);
  },

  _scrollBottom(output) {
    output.scrollTop = output.scrollHeight;
  },

  _moveCursorToEnd(input) {
    requestAnimationFrame(() => {
      input.selectionStart = input.selectionEnd = input.value.length;
    });
  },

  _esc(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  },

  // Basic tab-autocomplete for paths and command names
  _autocomplete(input, output, updateCwd) {
    const val   = input.value;
    const parts = val.split(' ');
    const last  = parts[parts.length - 1];

    if (parts.length === 1) {
      // Autocomplete command names
      const cmdNames = Object.keys(CMD._cmds).filter(c => c.startsWith(last));
      if (cmdNames.length === 1) {
        input.value = cmdNames[0] + ' ';
      } else if (cmdNames.length > 1) {
        TerminalApp._appendLine(output, cmdNames.join('  '));
        TerminalApp._scrollBottom(output);
      }
    } else {
      // Autocomplete paths
      const dir   = last.includes('/') ? FS.resolvePath(CMD.cwd, last.substring(0, last.lastIndexOf('/') + 1)) : CMD.cwd;
      const stub  = last.includes('/') ? last.split('/').pop() : last;
      const entries = FS.ls(dir, true) || [];
      const matches = entries.filter(e => e.name.startsWith(stub));

      if (matches.length === 1) {
        const completed = last.substring(0, last.lastIndexOf('/') + 1) + matches[0].name + (matches[0].type === 'dir' ? '/' : ' ');
        parts[parts.length - 1] = completed;
        input.value = parts.join(' ');
      } else if (matches.length > 1) {
        TerminalApp._appendLine(output, matches.map(m => m.name).join('  '));
        TerminalApp._scrollBottom(output);
      }
    }
  },
};

// Listen for "open file in terminal editor" events
EventBus.on('app:open', ({ appId, filePath }) => {
  // handled by OS.apps.open
});
