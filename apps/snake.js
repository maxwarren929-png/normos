/**
 * NormOS — apps/snake.js
 * Snake mini-game using Canvas.
 * Arrow keys / WASD to move. Space to pause.
 */

const SnakeApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'snake-wrap';

    const GRID = 20, SIZE = 14;
    const W = GRID * SIZE, H = GRID * SIZE;

    wrap.innerHTML = `
      <div class="snake-score-row">
        <span>Score: <span class="snake-score-val" id="sn-score">0</span></span>
        <span>High Score: <span class="snake-score-val" id="sn-hi">0</span></span>
      </div>
      <canvas id="snake-canvas" width="${W}" height="${H}"></canvas>
      <div class="snake-controls">
        <button class="snake-btn" id="sn-start">▶ Start</button>
        <button class="snake-btn secondary" id="sn-pause">⏸ Pause</button>
      </div>
      <div class="snake-message" id="sn-msg">Press Start to play — Arrow keys / WASD to move</div>
    `;

    const canvas = wrap.querySelector('#snake-canvas');
    const ctx    = canvas.getContext('2d');
    const scoreEl= wrap.querySelector('#sn-score');
    const hiEl   = wrap.querySelector('#sn-hi');
    const msgEl  = wrap.querySelector('#sn-msg');

    let snake, dir, nextDir, food, score, running, paused, interval;
    let highScore = parseInt(localStorage.getItem('normos_snake_hi') || '0');
    hiEl.textContent = highScore;

    const COLORS = {
      bg:       '#060910',
      grid:     '#0d1520',
      snake:    '#4f9eff',
      snakeHd:  '#a8d4ff',
      food:     '#34d399',
      foodGlow: 'rgba(52,211,153,0.3)',
    };

    const draw = () => {
      // Background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= W; x += SIZE) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y <= H; y += SIZE) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

      if (!snake) return;

      // Food
      ctx.fillStyle = COLORS.foodGlow;
      ctx.beginPath(); ctx.arc(food.x*SIZE+SIZE/2, food.y*SIZE+SIZE/2, SIZE*0.7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = COLORS.food;
      ctx.fillRect(food.x*SIZE+2, food.y*SIZE+2, SIZE-4, SIZE-4);

      // Snake
      snake.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? COLORS.snakeHd : COLORS.snake;
        ctx.globalAlpha = i === 0 ? 1 : Math.max(0.4, 1 - (i / snake.length) * 0.5);
        ctx.fillRect(seg.x*SIZE+1, seg.y*SIZE+1, SIZE-2, SIZE-2);
      });
      ctx.globalAlpha = 1;
    };

    const placeFood = () => {
      let pos;
      do { pos = { x: Math.floor(Math.random()*GRID), y: Math.floor(Math.random()*GRID) }; }
      while (snake.some(s => s.x===pos.x && s.y===pos.y));
      food = pos;
    };

    const init = () => {
      snake   = [{ x:10, y:10 }, { x:9, y:10 }, { x:8, y:10 }];
      dir     = { x:1, y:0 };
      nextDir = { x:1, y:0 };
      score   = 0;
      scoreEl.textContent = '0';
      placeFood();
      draw();
      msgEl.textContent = '';
    };

    const step = () => {
      if (!running || paused) return;
      dir = { ...nextDir };
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      // Wall collision
      if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) return gameOver();
      // Self collision
      if (snake.some(s => s.x===head.x && s.y===head.y)) return gameOver();

      snake.unshift(head);
      if (head.x===food.x && head.y===food.y) {
        score++;
        scoreEl.textContent = score;
        if (score > highScore) { highScore = score; hiEl.textContent = highScore; localStorage.setItem('normos_snake_hi', highScore); }
        placeFood();
      } else {
        snake.pop();
      }
      draw();
    };

    const gameOver = () => {
      running = false;
      clearInterval(interval);
      msgEl.textContent = `Game over! Score: ${score}. ${score >= 10 ? 'Not bad.' : score >= 5 ? 'Getting there.' : 'The daemon saw that.'}`;
      // Flicker effect
      ctx.fillStyle = 'rgba(248,113,113,0.15)';
      ctx.fillRect(0,0,W,H);
    };

    const startGame = () => {
      clearInterval(interval);
      running = true; paused = false;
      init();
      interval = setInterval(step, 130);
    };

    wrap.querySelector('#sn-start').addEventListener('click', startGame);
    wrap.querySelector('#sn-pause').addEventListener('click', () => {
      if (!running) return;
      paused = !paused;
      wrap.querySelector('#sn-pause').textContent = paused ? '▶ Resume' : '⏸ Pause';
      msgEl.textContent = paused ? 'Paused. The daemon is also waiting.' : '';
    });

    // Key handling — attach to document, cleaned up when window closes
    const onKey = (e) => {
      if (!running) return;
      const map = {
        ArrowUp:   {x:0,y:-1}, ArrowDown: {x:0,y:1},
        ArrowLeft: {x:-1,y:0}, ArrowRight:{x:1,y:0},
        w: {x:0,y:-1}, s: {x:0,y:1}, a: {x:-1,y:0}, d: {x:1,y:0},
      };
      const nd = map[e.key];
      if (nd) {
        // Prevent reversing
        if (nd.x === -dir.x && nd.y === -dir.y) return;
        nextDir = nd;
        e.preventDefault();
      }
      if (e.key === ' ') { e.preventDefault(); wrap.querySelector('#sn-pause').click(); }
    };
    document.addEventListener('keydown', onKey);

    // Cleanup — only clean up when the snake window itself is closed
    EventBus.on('window:closed', ({ appId }) => {
      if (appId !== 'snake') return;
      clearInterval(interval);
      document.removeEventListener('keydown', onKey);
    });

    draw();
    return wrap;
  },
};
