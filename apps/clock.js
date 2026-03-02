/**
 * NormOS — apps/clock.js
 * Clock + Stopwatch + Timer
 */
const ClockApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'clock-wrap';

    wrap.innerHTML = `
      <div class="clock-tabs">
        <div class="clock-tab active" data-tab="clock">🕐 Clock</div>
        <div class="clock-tab" data-tab="stopwatch">⏱ Stopwatch</div>
        <div class="clock-tab" data-tab="timer">⏲ Timer</div>
      </div>

      <!-- Clock Panel -->
      <div class="clock-panel active" id="clock-panel-clock">
        <div class="clock-big" id="clock-display">00:00:00</div>
        <div class="clock-small-date" id="clock-date"></div>
        <div style="display:flex;gap:0.5rem;font-size:0.7rem;color:var(--text3);font-family:var(--font-mono);margin-top:0.5rem;">
          <span id="clock-tz"></span>
        </div>
      </div>

      <!-- Stopwatch Panel -->
      <div class="clock-panel" id="clock-panel-stopwatch">
        <div class="stopwatch-display" id="sw-display">00:00.00</div>
        <div class="clock-btn-row">
          <button class="os-btn primary" id="sw-start">Start</button>
          <button class="os-btn" id="sw-lap">Lap</button>
          <button class="os-btn" id="sw-reset">Reset</button>
        </div>
        <div class="lap-list" id="sw-laps"></div>
      </div>

      <!-- Timer Panel -->
      <div class="clock-panel" id="clock-panel-timer">
        <div class="timer-inputs" id="timer-setup">
          <div style="text-align:center;">
            <input class="timer-input" id="timer-h" type="number" min="0" max="23" value="0" />
            <div style="font-size:0.6rem;color:var(--text3);">HH</div>
          </div>
          <span style="font-size:1.5rem;color:var(--text2);font-family:var(--font-mono);">:</span>
          <div style="text-align:center;">
            <input class="timer-input" id="timer-m" type="number" min="0" max="59" value="5" />
            <div style="font-size:0.6rem;color:var(--text3);">MM</div>
          </div>
          <span style="font-size:1.5rem;color:var(--text2);font-family:var(--font-mono);">:</span>
          <div style="text-align:center;">
            <input class="timer-input" id="timer-s" type="number" min="0" max="59" value="0" />
            <div style="font-size:0.6rem;color:var(--text3);">SS</div>
          </div>
        </div>
        <div class="timer-display" id="timer-display" style="display:none;">05:00</div>
        <div class="clock-btn-row">
          <button class="os-btn primary" id="timer-start">Start</button>
          <button class="os-btn" id="timer-reset">Reset</button>
        </div>
      </div>
    `;

    // Tab switching
    wrap.querySelectorAll('.clock-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        wrap.querySelectorAll('.clock-tab').forEach(t => t.classList.remove('active'));
        wrap.querySelectorAll('.clock-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        wrap.querySelector(`#clock-panel-${tab.dataset.tab}`).classList.add('active');
      });
    });

    // ── Clock ──
    const clockDisplay = wrap.querySelector('#clock-display');
    const clockDate = wrap.querySelector('#clock-date');
    const clockTz = wrap.querySelector('#clock-tz');
    const updateClock = () => {
      const now = new Date();
      clockDisplay.textContent = now.toLocaleTimeString('en-US', { hour12: false });
      clockDate.textContent = now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      clockTz.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
    };
    updateClock();
    const clockInt = setInterval(updateClock, 1000);

    // ── Stopwatch ──
    let swRunning = false, swStart = 0, swElapsed = 0, swLaps = [], swAnim;
    const swDisplay = wrap.querySelector('#sw-display');
    const swLapList = wrap.querySelector('#sw-laps');
    const fmtSw = (ms) => {
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const cs = Math.floor((ms % 1000) / 10);
      return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
    };
    const swTick = () => {
      swDisplay.textContent = fmtSw(swElapsed + Date.now() - swStart);
      if (swRunning) swAnim = requestAnimationFrame(swTick);
    };
    wrap.querySelector('#sw-start').addEventListener('click', function() {
      if (!swRunning) {
        swRunning = true; swStart = Date.now(); this.textContent = 'Stop';
        swAnim = requestAnimationFrame(swTick);
      } else {
        swRunning = false; swElapsed += Date.now() - swStart;
        cancelAnimationFrame(swAnim); this.textContent = 'Start';
      }
    });
    wrap.querySelector('#sw-lap').addEventListener('click', () => {
      if (!swRunning && swElapsed === 0) return;
      const cur = swElapsed + (swRunning ? Date.now() - swStart : 0);
      swLaps.unshift(cur);
      swLapList.innerHTML = swLaps.map((l, i) =>
        `<div class="lap-item"><span>Lap ${swLaps.length - i}</span><span>${fmtSw(l)}</span></div>`
      ).join('');
    });
    wrap.querySelector('#sw-reset').addEventListener('click', () => {
      swRunning = false; cancelAnimationFrame(swAnim);
      swElapsed = 0; swLaps = [];
      swDisplay.textContent = '00:00.00'; swLapList.innerHTML = '';
      wrap.querySelector('#sw-start').textContent = 'Start';
    });

    // ── Timer ──
    let timerRunning = false, timerRemaining = 0, timerInterval;
    const timerDisplay = wrap.querySelector('#timer-display');
    const timerSetup = wrap.querySelector('#timer-setup');
    const fmtTimer = (s) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sc = s % 60;
      return h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
        : `${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
    };
    wrap.querySelector('#timer-start').addEventListener('click', function() {
      if (!timerRunning) {
        if (timerRemaining === 0) {
          const h = parseInt(wrap.querySelector('#timer-h').value) || 0;
          const m = parseInt(wrap.querySelector('#timer-m').value) || 0;
          const s = parseInt(wrap.querySelector('#timer-s').value) || 0;
          timerRemaining = h*3600 + m*60 + s;
          if (timerRemaining <= 0) return;
        }
        timerRunning = true; this.textContent = 'Pause';
        timerSetup.style.display = 'none';
        timerDisplay.style.display = 'block';
        timerDisplay.classList.remove('alert');
        timerInterval = setInterval(() => {
          timerRemaining--;
          timerDisplay.textContent = fmtTimer(timerRemaining);
          if (timerRemaining <= 0) {
            clearInterval(timerInterval); timerRunning = false;
            timerDisplay.classList.add('alert');
            timerDisplay.textContent = '⏰ Done!';
            wrap.querySelector('#timer-start').textContent = 'Start';
            if (typeof OS !== 'undefined') OS.notify('⏲', 'Timer', 'Timer finished!');
          }
        }, 1000);
        timerDisplay.textContent = fmtTimer(timerRemaining);
      } else {
        timerRunning = false; clearInterval(timerInterval);
        this.textContent = 'Resume';
      }
    });
    wrap.querySelector('#timer-reset').addEventListener('click', () => {
      timerRunning = false; clearInterval(timerInterval);
      timerRemaining = 0; timerDisplay.style.display = 'none';
      timerSetup.style.display = 'flex';
      wrap.querySelector('#timer-start').textContent = 'Start';
      timerDisplay.classList.remove('alert');
    });

    // Clean up on close
    EventBus.on('window:closed', () => {
      clearInterval(clockInt);
      cancelAnimationFrame(swAnim);
      clearInterval(timerInterval);
    });

    return wrap;
  }
};