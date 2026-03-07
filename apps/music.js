/**
 * NormOS — apps/music.js
 * Fake music player with playback simulation and visualizer
 */
const MusicApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'music-wrap';

    const tracks = [
      { title: 'daemon.norm (Radio Edit)', artist: 'The Processes', dur: 214, icon: '🎵', color: '#4f9eff' },
      { title: 'Virtual Filesystem Blues', artist: 'rm -rf', dur: 187, icon: '🎸', color: '#34d399' },
      { title: 'normbash Nights', artist: 'Shell Shock', dur: 246, icon: '🎹', color: '#a78bfa' },
      { title: 'NaN (feat. undefined)', artist: 'Type Error', dur: 198, icon: '🎺', color: '#fbbf24' },
      { title: 'Segfault Serenade', artist: 'Memory Leak', dur: 231, icon: '🥁', color: '#fb923c' },
      { title: '/dev/null Ballad', artist: 'The Voids', dur: 178, icon: '🎷', color: '#f472b6' },
      { title: 'chmod 777 (Disco Mix)', artist: 'Root Access', dur: 203, icon: '🎻', color: '#22d3ee' },
    ];

    let currentTrack = 0;
    let isPlaying = false;
    let progress = 0;
    let elapsed = 0;
    let playInterval = null;
    let volume = 0.8;

    const fmtTime = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

    const render = () => {
      const t = tracks[currentTrack];
      wrap.innerHTML = `
        <div class="music-album ${isPlaying ? 'playing' : ''}" id="music-album">
          <span style="font-size:3rem;">${t.icon}</span>
        </div>
        <div class="music-title">${t.title}</div>
        <div class="music-artist">${t.artist}</div>
        <div class="music-progress-wrap">
          <div class="music-progress" id="music-progress">
            <div class="music-progress-fill" id="music-fill" style="width:${progress}%;"></div>
          </div>
          <div class="music-time">
            <span id="music-elapsed">${fmtTime(elapsed)}</span>
            <span>${fmtTime(t.dur)}</span>
          </div>
        </div>
        <div class="music-controls">
          <button class="music-ctrl" id="mc-prev" title="Previous">⏮</button>
          <button class="music-ctrl" id="mc-shuf" title="Shuffle">🔀</button>
          <button class="music-ctrl play" id="mc-play">${isPlaying ? '⏸' : '▶'}</button>
          <button class="music-ctrl" id="mc-repeat" title="Repeat">🔁</button>
          <button class="music-ctrl" id="mc-next" title="Next">⏭</button>
        </div>
        <div class="music-volume">
          <span style="font-size:0.8rem">🔈</span>
          <input type="range" id="music-vol" min="0" max="100" value="${Math.round(volume*100)}" />
          <span style="font-size:0.8rem">🔊</span>
        </div>
        <div class="music-playlist">
          ${tracks.map((tr, i) => `
            <div class="music-track ${i === currentTrack ? 'active' : ''}" data-idx="${i}">
              <span class="music-track-num">${i+1}</span>
              <span class="music-track-icon">${i === currentTrack && isPlaying ? '▶' : tr.icon}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tr.title}</span>
              <span style="font-family:var(--font-mono);font-size:0.62rem;color:var(--text3);">${fmtTime(tr.dur)}</span>
            </div>`).join('')}
        </div>
      `;

      // Events
      wrap.querySelector('#mc-play').addEventListener('click', togglePlay);
      wrap.querySelector('#mc-next').addEventListener('click', () => { nextTrack(); });
      wrap.querySelector('#mc-prev').addEventListener('click', () => { prevTrack(); });
      wrap.querySelector('#mc-shuf').addEventListener('click', () => {
        currentTrack = Math.floor(Math.random() * tracks.length);
        elapsed = 0; progress = 0; stopPlay(); render();
      });
      wrap.querySelector('#music-progress').addEventListener('click', (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        elapsed = Math.floor(pct * tracks[currentTrack].dur);
        progress = pct * 100;
        if (wrap.querySelector('#music-fill')) wrap.querySelector('#music-fill').style.width = progress + '%';
        if (wrap.querySelector('#music-elapsed')) wrap.querySelector('#music-elapsed').textContent = fmtTime(elapsed);
      });
      wrap.querySelector('#music-vol').addEventListener('input', (e) => { volume = e.target.value / 100; });
      wrap.querySelectorAll('.music-track').forEach(el => {
        el.addEventListener('click', () => {
          currentTrack = parseInt(el.dataset.idx);
          elapsed = 0; progress = 0; stopPlay();
          isPlaying = true; startPlay(); render();
        });
        el.addEventListener('dblclick', () => {
          currentTrack = parseInt(el.dataset.idx);
          elapsed = 0; progress = 0; stopPlay();
          isPlaying = true; startPlay(); render();
        });
      });
    };

    const startPlay = () => {
      playInterval = setInterval(() => {
        const t = tracks[currentTrack];
        elapsed++;
        progress = (elapsed / t.dur) * 100;
        if (elapsed >= t.dur) {
          nextTrack();
          return;
        }
        const fillEl = wrap.querySelector('#music-fill');
        const elapsedEl = wrap.querySelector('#music-elapsed');
        if (fillEl) fillEl.style.width = progress + '%';
        if (elapsedEl) elapsedEl.textContent = fmtTime(elapsed);
      }, 1000);
    };
    const stopPlay = () => { clearInterval(playInterval); };
    const togglePlay = () => {
      isPlaying = !isPlaying;
      if (isPlaying) { startPlay(); }
      else { stopPlay(); }
      render();
    };
    const nextTrack = () => {
      currentTrack = (currentTrack + 1) % tracks.length;
      elapsed = 0; progress = 0; stopPlay();
      if (isPlaying) startPlay();
      render();
    };
    const prevTrack = () => {
      if (elapsed > 3) { elapsed = 0; progress = 0; }
      else { currentTrack = (currentTrack - 1 + tracks.length) % tracks.length; elapsed = 0; progress = 0; }
      stopPlay(); if (isPlaying) startPlay(); render();
    };

    render();
    EventBus.on('window:closed', ({ appId }) => { if (appId === 'music') stopPlay(); });
    return wrap;
  }
};
