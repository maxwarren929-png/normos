/**
 * NormOS — apps/snake.js  (v4.0 — purchasable real game)
 */
const SnakeApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'snake-wrap';

    // Check if purchased
    const INSTALLS_KEY = 'normos_appstore_installs';
    const installs = (() => { try { return JSON.parse(localStorage.getItem(INSTALLS_KEY)||'{}'); } catch { return {}; } })();

    if (!installs['snake']) {
      wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;background:var(--bg1);flex-direction:column;gap:12px;';
      wrap.innerHTML = `
        <div style="font-size:3rem">🐍</div>
        <div style="font-size:1rem;font-weight:bold;color:var(--text1)">Snake</div>
        <div style="font-size:0.78rem;color:var(--text2)">Purchase Snake from NormHub to unlock.</div>
        <button style="padding:8px 20px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;font-weight:600;" onclick="if(typeof OS!=='undefined')OS.apps.open('hub')">Open NormHub ($500)</button>`;
      return wrap;
    }

    const GRID = 20, CELL = 18, W = GRID * CELL, H = GRID * CELL;
    wrap.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#0a0a0a;user-select:none;`;

    wrap.innerHTML = `
      <div style="font-size:0.75rem;color:#4ade80;font-family:monospace;margin-bottom:6px;">
        🐍 SNAKE &nbsp;|&nbsp; Score: <span id="snake-score">0</span> &nbsp;|&nbsp; Hi: <span id="snake-hi">0</span>
      </div>
      <canvas id="snake-canvas" width="${W}" height="${H}" style="border:2px solid #4ade80;border-radius:4px;display:block;"></canvas>
      <div id="snake-msg" style="font-size:0.8rem;color:#facc15;margin-top:8px;font-family:monospace;min-height:20px;text-align:center;"></div>
      <div style="font-size:0.65rem;color:#374151;margin-top:4px;font-family:monospace;">Arrow keys / WASD to move · P to pause</div>`;

    const canvas  = wrap.querySelector('#snake-canvas');
    const ctx     = canvas.getContext('2d');
    const scoreEl = wrap.querySelector('#snake-score');
    const hiEl    = wrap.querySelector('#snake-hi');
    const msgEl   = wrap.querySelector('#snake-msg');

    const HI_KEY = 'normos_snake_hi';
    let hi = parseInt(localStorage.getItem(HI_KEY)||'0');
    hiEl.textContent = hi;

    let snake, dir, nextDir, food, score, running, paused, gameLoop;

    const rand = (n) => Math.floor(Math.random() * n);
    const spawnFood = () => {
      let pos;
      do { pos = {x:rand(GRID), y:rand(GRID)}; }
      while (snake.some(s => s.x===pos.x && s.y===pos.y));
      return pos;
    };

    const init = () => {
      snake   = [{x:10,y:10},{x:9,y:10},{x:8,y:10}];
      dir     = {x:1,y:0};
      nextDir = {x:1,y:0};
      food    = spawnFood();
      score   = 0; running = true; paused = false;
      scoreEl.textContent = 0;
      msgEl.textContent   = '';
      if (gameLoop) clearInterval(gameLoop);
      gameLoop = setInterval(step, 120);
    };

    const step = () => {
      if (!running || paused) return;
      dir = {...nextDir};
      const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};

      // Wall collision
      if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) { endGame(); return; }
      // Self collision
      if (snake.some(s => s.x===head.x && s.y===head.y)) { endGame(); return; }

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score++;
        scoreEl.textContent = score;
        if (score > hi) { hi = score; hiEl.textContent = hi; localStorage.setItem(HI_KEY, String(hi)); }
        food = spawnFood();
      } else {
        snake.pop();
      }
      draw();
    };

    const draw = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);

      // Grid dots
      ctx.fillStyle = '#111';
      for (let x=0;x<GRID;x++) for (let y=0;y<GRID;y++) {
        ctx.fillRect(x*CELL+CELL/2-1, y*CELL+CELL/2-1, 2, 2);
      }

      // Food
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.arc(food.x*CELL+CELL/2, food.y*CELL+CELL/2, CELL/2-2, 0, Math.PI*2);
      ctx.fill();

      // Snake
      snake.forEach((seg, i) => {
        const t = i === 0 ? 1 : Math.max(0.3, 1 - i/snake.length * 0.7);
        ctx.fillStyle = i===0 ? '#4ade80' : `rgba(74,222,128,${t})`;
        const pad = i===0 ? 1 : 2;
        ctx.fillRect(seg.x*CELL+pad, seg.y*CELL+pad, CELL-pad*2, CELL-pad*2);
      });
    };

    const endGame = () => {
      running = false;
      clearInterval(gameLoop);
      msgEl.textContent = `💀 Game Over! Score: ${score}  —  Press Enter or Space to restart`;
      // Flash red
      ctx.fillStyle = 'rgba(248,113,113,0.2)';
      ctx.fillRect(0,0,W,H);
    };

    const onKey = (e) => {
      if (!document.body.contains(wrap)) { document.removeEventListener('keydown', onKey); clearInterval(gameLoop); return; }
      const k = e.key;
      if ((k==='Enter'||k===' ') && !running) { init(); return; }
      if (k==='p'||k==='P') { paused=!paused; msgEl.textContent=paused?'⏸ Paused':''; return; }
      const dirs = {
        ArrowUp:{x:0,y:-1}, ArrowDown:{x:0,y:1}, ArrowLeft:{x:-1,y:0}, ArrowRight:{x:1,y:0},
        w:{x:0,y:-1}, s:{x:0,y:1}, a:{x:-1,y:0}, d:{x:1,y:0},
        W:{x:0,y:-1}, S:{x:0,y:1}, A:{x:-1,y:0}, D:{x:1,y:0},
      };
      const nd = dirs[k];
      if (nd && !(nd.x===-dir.x && nd.y===-dir.y)) { nextDir=nd; e.preventDefault(); }
    };

    document.addEventListener('keydown', onKey);
    init(); draw();

    if (!document.getElementById('snake-styles')) {
      const st = document.createElement('style');
      st.id = 'snake-styles';
      st.textContent = `.snake-wrap{outline:none;}`;
      document.head.appendChild(st);
    }

    wrap.setAttribute('tabindex','0');
    wrap.addEventListener('click', () => wrap.focus());
    return wrap;
  }
};
