/**
 * NormOS — apps/normsheet.js
 * NormSheet — A minimal spreadsheet with formula support.
 * Supports: SUM, AVG, MIN, MAX, COUNT, IF, basic math
 */

const NormSheetApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';

    const ROWS = 30;
    const COLS = 12; // A–L
    const COL_LABELS = 'ABCDEFGHIJKL'.split('');

    // Data store: 'A1' → raw string value
    const data = {};
    // Cell DOM refs
    const cells = {};

    wrap.innerHTML = `
      <div class="sheet-toolbar">
        <button class="sheet-btn" id="sheet-save">💾 Save</button>
        <button class="sheet-btn" id="sheet-open">📂 Open</button>
        <button class="sheet-btn" id="sheet-clear">🗑️ Clear</button>
        <div class="sheet-toolbar-sep"></div>
        <span class="sheet-cell-label" id="sheet-cell-ref">A1</span>
        <input class="sheet-formula-bar" id="sheet-formula-bar" placeholder="Value or =formula" />
        <div class="sheet-toolbar-sep"></div>
        <span class="sheet-status" id="sheet-status">NormSheet v1.0 — Formulas: =SUM, =AVG, =MIN, =MAX, =COUNT, =IF</span>
      </div>
      <div class="sheet-container">
        <table class="sheet-table" id="sheet-table" cellspacing="0" cellpadding="0"></table>
      </div>
    `;

    const table      = wrap.querySelector('#sheet-table');
    const formulaBar = wrap.querySelector('#sheet-formula-bar');
    const cellRef    = wrap.querySelector('#sheet-cell-ref');
    const statusEl   = wrap.querySelector('#sheet-status');

    let activeCell = null; // { row, col, key }
    let editMode   = false;

    // ── Build table ────────────────────────────────────────────────────
    const buildTable = () => {
      table.innerHTML = '';

      // Header row
      const headRow = document.createElement('tr');
      headRow.appendChild(Object.assign(document.createElement('th'), { className: 'sheet-corner' }));
      COL_LABELS.forEach(c => {
        const th = document.createElement('th');
        th.className = 'sheet-col-header';
        th.textContent = c;
        headRow.appendChild(th);
      });
      table.appendChild(headRow);

      // Data rows
      for (let r = 1; r <= ROWS; r++) {
        const tr = document.createElement('tr');
        const rh = document.createElement('td');
        rh.className = 'sheet-row-header';
        rh.textContent = r;
        tr.appendChild(rh);

        COL_LABELS.forEach((c, ci) => {
          const key = c + r;
          const td  = document.createElement('td');
          td.className   = 'sheet-cell';
          td.dataset.key = key;
          td.dataset.row = r;
          td.dataset.col = ci;
          td.tabIndex    = 0;

          td.addEventListener('click', () => selectCell(key, r, ci, td));
          td.addEventListener('dblclick', () => startEdit(key, td));
          td.addEventListener('keydown', (e) => handleCellKey(e, key, r, ci, td));

          cells[key] = td;
          tr.appendChild(td);
        });

        table.appendChild(tr);
      }
    };

    // ── Cell selection ─────────────────────────────────────────────────
    const selectCell = (key, row, col, td) => {
      // Deselect previous
      if (activeCell) {
        cells[activeCell.key]?.classList.remove('selected');
        if (editMode) commitEdit(activeCell.key, cells[activeCell.key]);
      }
      editMode = false;
      activeCell = { key, row, col };
      td.classList.add('selected');
      cellRef.textContent = key;
      formulaBar.value = data[key] || '';
      td.focus();
    };

    const startEdit = (key, td) => {
      editMode = true;
      formulaBar.focus();
      formulaBar.select();
    };

    const commitEdit = (key, td) => {
      const val = formulaBar.value;
      if (val === '') {
        delete data[key];
      } else {
        data[key] = val;
      }
      renderCell(key);
      recalcAll();
      editMode = false;
    };

    formulaBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (activeCell) {
          commitEdit(activeCell.key, cells[activeCell.key]);
          // Move down
          const nextKey = COL_LABELS[activeCell.col] + (activeCell.row + 1);
          if (cells[nextKey]) cells[nextKey].click();
        }
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        formulaBar.value = data[activeCell?.key] || '';
        editMode = false;
      }
    });

    formulaBar.addEventListener('input', () => {
      if (activeCell) {
        data[activeCell.key] = formulaBar.value || undefined;
        if (!formulaBar.value) delete data[activeCell.key];
        renderCell(activeCell.key);
        recalcAll();
      }
    });

    // ── Keyboard nav ───────────────────────────────────────────────────
    const handleCellKey = (e, key, row, col, td) => {
      const moves = {
        ArrowUp:    { dr: -1, dc:  0 },
        ArrowDown:  { dr:  1, dc:  0 },
        ArrowLeft:  { dr:  0, dc: -1 },
        ArrowRight: { dr:  0, dc:  1 },
        Tab:        { dr:  0, dc:  1 },
      };

      if (moves[e.key]) {
        const { dr, dc } = moves[e.key];
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 1 && nr <= ROWS && nc >= 0 && nc < COLS) {
          const nk = COL_LABELS[nc] + nr;
          cells[nk]?.click();
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        delete data[key];
        formulaBar.value = '';
        renderCell(key);
        recalcAll();
        return;
      }

      if (e.key === 'Enter') {
        startEdit(key, td);
        return;
      }

      // Start typing → go to formula bar
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        if (!editMode) {
          delete data[key];
          formulaBar.value = e.key;
          formulaBar.dispatchEvent(new Event('input'));
          startEdit(key, td);
        }
      }
    };

    // ── Formula engine ─────────────────────────────────────────────────
    const evalCell = (key, visited = new Set()) => {
      const raw = data[key];
      if (!raw) return '';
      if (!raw.startsWith('=')) return isNaN(raw) ? raw : Number(raw);

      if (visited.has(key)) return '#CIRC!';
      visited.add(key);

      const expr = raw.slice(1).toUpperCase().trim();

      // Resolve a range like A1:A5 → array of values
      const resolveRange = (rangeStr) => {
        const m = rangeStr.match(/^([A-L])(\d+):([A-L])(\d+)$/);
        if (!m) return null;
        const [, c1, r1, c2, r2] = m;
        const ci1 = COL_LABELS.indexOf(c1), ci2 = COL_LABELS.indexOf(c2);
        const ri1 = parseInt(r1), ri2 = parseInt(r2);
        const vals = [];
        for (let r = ri1; r <= ri2; r++) {
          for (let ci = ci1; ci <= ci2; ci++) {
            const k = COL_LABELS[ci] + r;
            const v = evalCell(k, new Set(visited));
            const n = parseFloat(v);
            if (!isNaN(n)) vals.push(n);
          }
        }
        return vals;
      };

      // Resolve individual cell ref
      const resolveRef = (ref) => {
        const k = ref.toUpperCase();
        if (cells[k] !== undefined) {
          const v = evalCell(k, new Set(visited));
          return isNaN(v) ? (v || 0) : parseFloat(v);
        }
        return NaN;
      };

      try {
        // Built-in functions
        const fnMatch = expr.match(/^(SUM|AVG|AVERAGE|MIN|MAX|COUNT|IF)\((.+)\)$/);
        if (fnMatch) {
          const fn  = fnMatch[1];
          const arg = fnMatch[2];

          if (fn === 'IF') {
            // IF(condition, true_val, false_val)
            const parts = arg.split(',').map(s => s.trim());
            if (parts.length < 2) return '#ERR!';
            const cond = evalExpr(parts[0], visited);
            return cond ? evalExpr(parts[1], visited) : evalExpr(parts[2] || '0', visited);
          }

          const range = resolveRange(arg);
          const nums  = range || arg.split(',').map(a => {
            const v = evalCell(a.trim(), new Set(visited));
            return parseFloat(v);
          }).filter(n => !isNaN(n));

          if (!nums.length) return fn === 'COUNT' ? 0 : '';
          switch (fn) {
            case 'SUM':     return nums.reduce((a, b) => a + b, 0);
            case 'AVG':
            case 'AVERAGE': return nums.reduce((a, b) => a + b, 0) / nums.length;
            case 'MIN':     return Math.min(...nums);
            case 'MAX':     return Math.max(...nums);
            case 'COUNT':   return nums.length;
          }
        }

        return evalExpr(expr, visited);
      } catch {
        return '#ERR!';
      }
    };

    const evalExpr = (expr, visited) => {
      // Replace cell refs with their values
      const resolved = expr.replace(/\b([A-L]\d+)\b/g, (_, ref) => {
        const v = evalCell(ref, new Set(visited));
        return (v === '' || v === undefined) ? '0' : v;
      });
      // Evaluate safely
      try {
        // eslint-disable-next-line no-new-func
        const result = Function('"use strict"; return (' + resolved + ')')();
        return typeof result === 'number' ? (Number.isFinite(result) ? +result.toFixed(10) : '#∞!') : result;
      } catch {
        return '#ERR!';
      }
    };

    // ── Render ─────────────────────────────────────────────────────────
    const renderCell = (key) => {
      const td = cells[key];
      if (!td) return;
      const raw = data[key];
      if (!raw) { td.textContent = ''; td.classList.remove('formula', 'error', 'number'); return; }

      const val = evalCell(key);
      const str = val === undefined || val === '' ? '' : String(val);

      td.classList.toggle('formula', raw.startsWith('='));
      td.classList.toggle('error',   str.includes('#'));
      td.classList.toggle('number',  !isNaN(val) && val !== '' && !raw.startsWith('='));
      td.textContent = str;

      // Update formula bar if this is active
      if (activeCell?.key === key) formulaBar.value = raw;
    };

    const recalcAll = () => {
      Object.keys(cells).forEach(k => renderCell(k));
    };

    // ── Toolbar actions ─────────────────────────────────────────────────
    wrap.querySelector('#sheet-save').addEventListener('click', () => {
      const name = prompt('Save spreadsheet as:', 'sheet.normsv') || 'sheet.normsv';
      const path = '/home/norm/Documents/' + name;
      const json = JSON.stringify(data, null, 2);
      if (typeof FS !== 'undefined') {
        FS.writeFile(path, json);
        EventBus?.emit('fs:changed', { path });
        OS.notify('💾', 'NormSheet', `Saved: ${name}`);
        statusEl.textContent = `Saved to ${path}`;
      }
    });

    wrap.querySelector('#sheet-open').addEventListener('click', () => {
      const path = prompt('Open file path:', '/home/norm/Documents/sheet.normsv');
      if (!path) return;
      if (typeof FS !== 'undefined') {
        const content = FS.readFile(path);
        if (!content) { OS.notify('⚠️', 'NormSheet', 'File not found: ' + path); return; }
        try {
          const loaded = JSON.parse(content);
          Object.keys(data).forEach(k => delete data[k]);
          Object.assign(data, loaded);
          recalcAll();
          statusEl.textContent = `Loaded ${path}`;
        } catch { OS.notify('⚠️', 'NormSheet', 'Failed to parse file.'); }
      }
    });

    wrap.querySelector('#sheet-clear').addEventListener('click', () => {
      if (!confirm('Clear all cells?')) return;
      Object.keys(data).forEach(k => delete data[k]);
      recalcAll();
      formulaBar.value = '';
      statusEl.textContent = 'Cleared.';
    });

    // ── Seed with some demo data ───────────────────────────────────────
    const seed = {
      A1: 'Month', B1: 'Revenue', C1: 'Expenses', D1: 'Profit',
      A2: 'Jan',   B2: '42000',   C2: '18000',    D2: '=B2-C2',
      A3: 'Feb',   B3: '47500',   C3: '19200',    D3: '=B3-C3',
      A4: 'Mar',   B4: '51000',   C4: '21000',    D4: '=B4-C4',
      A5: 'Apr',   B5: '38000',   C5: '17500',    D5: '=B5-C5',
      A6: 'May',   B6: '63000',   C6: '24000',    D6: '=B6-C6',
      A7: 'Totals',B7: '=SUM(B2:B6)', C7: '=SUM(C2:C6)', D7: '=SUM(D2:D6)',
      A9: 'Avg Revenue:', B9: '=AVG(B2:B6)',
      A10:'Max Profit:',  B10: '=MAX(D2:D6)',
    };
    Object.assign(data, seed);

    buildTable();
    recalcAll();

    // Select A1 by default
    setTimeout(() => cells['A1']?.click(), 50);

    return wrap;
  },
};