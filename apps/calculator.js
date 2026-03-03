/**
 * NormOS — apps/calculator.js
 * Scientific-ish calculator with history
 */
const CalculatorApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'calc-wrap';

    let display = '0';
    let expression = '';
    let lastResult = null;
    let history = [];

    const buttons = [
      { label: 'AC', cls: 'clr', action: 'clear' },
      { label: '+/-', cls: '', action: 'negate' },
      { label: '%', cls: 'op', action: 'percent' },
      { label: '÷', cls: 'op', action: 'op:/' },
      { label: '7', action: 'num:7' },
      { label: '8', action: 'num:8' },
      { label: '9', action: 'num:9' },
      { label: '×', cls: 'op', action: 'op:*' },
      { label: '4', action: 'num:4' },
      { label: '5', action: 'num:5' },
      { label: '6', action: 'num:6' },
      { label: '−', cls: 'op', action: 'op:-' },
      { label: '1', action: 'num:1' },
      { label: '2', action: 'num:2' },
      { label: '3', action: 'num:3' },
      { label: '+', cls: 'op', action: 'op:+' },
      { label: '0', cls: 'span2', action: 'num:0' },
      { label: '.', action: 'dot' },
      { label: '=', cls: 'eq', action: 'equals' },
    ];

    wrap.innerHTML = `
      <div class="calc-display">
        <div class="calc-expr" id="calc-expr"></div>
        <div class="calc-val" id="calc-val">0</div>
      </div>
      <div class="calc-grid" id="calc-grid"></div>
    `;

    const grid = wrap.querySelector('#calc-grid');
    const valEl = wrap.querySelector('#calc-val');
    const exprEl = wrap.querySelector('#calc-expr');

    const updateDisplay = () => {
      valEl.textContent = display.length > 10 ? parseFloat(display).toExponential(4) : display;
      exprEl.textContent = expression;
    };

    let pendingOp = null;
    let pendingVal = null;
    let justCalc = false;

    const handleAction = (action) => {
      if (action.startsWith('num:')) {
        const d = action.split(':')[1];
        if (justCalc) { display = d; justCalc = false; }
        else display = display === '0' ? d : (display.length < 12 ? display + d : display);
      } else if (action === 'dot') {
        if (justCalc) { display = '0.'; justCalc = false; }
        else if (!display.includes('.')) display += '.';
      } else if (action === 'clear') {
        display = '0'; expression = ''; pendingOp = null; pendingVal = null; justCalc = false;
      } else if (action === 'negate') {
        display = display.startsWith('-') ? display.slice(1) : (display === '0' ? '0' : '-' + display);
      } else if (action === 'percent') {
        display = String(parseFloat(display) / 100);
      } else if (action.startsWith('op:')) {
        const op = action.split(':')[1];
        pendingVal = parseFloat(display);
        pendingOp = op;
        const opSym = { '+':'+', '-':'−', '*':'×', '/':'÷' }[op] || op;
        expression = `${pendingVal} ${opSym}`;
        justCalc = true;
      } else if (action === 'equals') {
        if (pendingOp && pendingVal !== null) {
          const cur = parseFloat(display);
          let res;
          try {
            switch(pendingOp) {
              case '+': res = pendingVal + cur; break;
              case '-': res = pendingVal - cur; break;
              case '*': res = pendingVal * cur; break;
              case '/': res = cur === 0 ? 'Error' : pendingVal / cur; break;
            }
          } catch(e) { res = 'Error'; }
          const opSym = { '+':'+', '-':'−', '*':'×', '/':'÷' }[pendingOp] || pendingOp;
          expression = `${pendingVal} ${opSym} ${cur} =`;
          history.unshift(expression + ' ' + res);
          history = history.slice(0, 10);
          display = typeof res === 'number' ? String(parseFloat(res.toFixed(10))) : res;
          pendingOp = null; pendingVal = null; lastResult = display; justCalc = true;
        }
      }
      updateDisplay();
    };

    buttons.forEach(btn => {
      const el = document.createElement('button');
      el.className = 'calc-btn' + (btn.cls ? ' ' + btn.cls : '');
      el.textContent = btn.label;
      el.dataset.action = btn.action;
      el.addEventListener('click', () => handleAction(btn.action));
      grid.appendChild(el);
    });

    // Keyboard support
    wrap.setAttribute('tabindex', '0');
    wrap.addEventListener('keydown', (e) => {
      const map = { '0':'num:0','1':'num:1','2':'num:2','3':'num:3','4':'num:4',
                    '5':'num:5','6':'num:6','7':'num:7','8':'num:8','9':'num:9',
                    '+':'op:+','-':'op:-','*':'op:*','/':'op:/',
                    'Enter':'equals','=':'equals','.':'dot',
                    'Escape':'clear','Backspace':'backspace' };
      if (e.key in map) {
        if (map[e.key] === 'backspace') {
          display = display.length > 1 ? display.slice(0,-1) : '0';
          updateDisplay();
        } else {
          handleAction(map[e.key]);
        }
        e.preventDefault();
      }
    });

    return wrap;
  }
};