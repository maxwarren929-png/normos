/**
 * NormOS — apps/music.js v4.1
 * NormTunes: music player + upload real audio tracks shared with other players
 */
const MusicApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'music-wrap';

    const BUILTIN_TRACKS = [
      { id:'b1', title: 'daemon.norm (Radio Edit)', artist: 'The Processes', dur: 214, icon: '🎵', color: '#4f9eff', dataUrl: null },
      { id:'b2', title: 'Virtual Filesystem Blues', artist: 'rm -rf', dur: 187, icon: '🎸', color: '#34d399', dataUrl: null },
      { id:'b3', title: 'normbash Nights', artist: 'Shell Shock', dur: 246, icon: '🎹', color: '#a78bfa', dataUrl: null },
      { id:'b4', title: 'NaN (feat. undefined)', artist: 'Type Error', dur: 198, icon: '🎺', color: '#fbbf24', dataUrl: null },
      { id:'b5', title: 'Segfault Serenade', artist: 'Memory Leak', dur: 231, icon: '🥁', color: '#fb923c', dataUrl: null },
    ];

    // Load user-uploaded tracks from localStorage
    const loadUserTracks = () => { try { return JSON.parse(localStorage.getItem('normos_music_tracks') || '[]'); } catch { return []; } };
    const saveUserTracks = (t) => { try { localStorage.setItem('normos_music_tracks', JSON.stringify(t.slice(0,50))); } catch {} };

    let userTracks = loadUserTracks();
    let tracks = [...BUILTIN_TRACKS, ...userTracks];
    let currentTrack = 0;
    let isPlaying = false;
    let elapsed = 0;
    let progress = 0;
    let playInterval = null;
    let audioEl = null; // real Audio element for uploaded tracks
    let volume = 0.8;

    const fmtTime = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const stopAudio = () => {
      clearInterval(playInterval);
      if (audioEl) { try { audioEl.pause(); } catch {} }
    };

    const render = () => {
      const t = tracks[currentTrack] || tracks[0];
      const isReal = !!t?.dataUrl;
      wrap.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
          <div class="music-album ${isPlaying ? 'playing' : ''}" id="music-album">
            <span style="font-size:2.4rem;">${t?.icon || '🎵'}</span>
            ${isReal ? '<span style="font-size:0.6rem;color:#4ade80;display:block;margin-top:4px;">REAL AUDIO</span>' : ''}
          </div>
          <div class="music-title">${esc(t?.title || 'No Track')}</div>
          <div class="music-artist">${esc(t?.artist || '')}</div>
          <div class="music-progress-wrap">
            <div class="music-progress" id="music-progress">
              <div class="music-progress-fill" id="music-fill" style="width:${progress}%;"></div>
            </div>
            <div class="music-time">
              <span id="music-elapsed">${fmtTime(elapsed)}</span>
              <span>${isReal && audioEl ? fmtTime(Math.floor(audioEl.duration)||0) : fmtTime(t?.dur||0)}</span>
            </div>
          </div>
          <div class="music-controls">
            <button class="music-ctrl" id="mc-prev">⏮</button>
            <button class="music-ctrl" id="mc-shuf">🔀</button>
            <button class="music-ctrl play" id="mc-play">${isPlaying ? '⏸' : '▶'}</button>
            <button class="music-ctrl" id="mc-repeat">🔁</button>
            <button class="music-ctrl" id="mc-next">⏭</button>
          </div>
          <div class="music-volume">
            <span style="font-size:0.8rem">🔈</span>
            <input type="range" id="music-vol" min="0" max="100" value="${Math.round(volume*100)}" />
            <span style="font-size:0.8rem">🔊</span>
          </div>

          <!-- Upload section -->
          <div style="padding:6px 10px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <label style="font-size:0.7rem;padding:4px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:5px;cursor:pointer;color:var(--text2);white-space:nowrap;">
              🎵 Upload Track <input type="file" id="music-upload" accept="audio/*" style="display:none">
            </label>
            <span id="music-upload-status" style="font-size:0.68rem;color:#4ade80;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;"></span>
          </div>

          <div class="music-playlist" style="flex:1;overflow-y:auto;">
            ${tracks.map((tr, i) => `
              <div class="music-track ${i === currentTrack ? 'active' : ''}" data-idx="${i}">
                <span class="music-track-num">${i+1}</span>
                <span class="music-track-icon">${i === currentTrack && isPlaying ? '▶' : (tr.icon||'🎵')}</span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.72rem;">${esc(tr.title)}${tr.dataUrl?'<span style="color:#4ade80;font-size:0.55rem;margin-left:4px;">●</span>':''}</span>
                ${i >= BUILTIN_TRACKS.length ? `<span class="music-del-btn" data-idx="${i}" style="color:var(--text3);cursor:pointer;padding:0 4px;font-size:0.7rem;" title="Remove">✕</span>` : ''}
                <span style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text3);">${fmtTime(tr.dur)}</span>
              </div>`).join('')}
          </div>
        </div>
      `;

      wrap.querySelector('#mc-play').addEventListener('click', togglePlay);
      wrap.querySelector('#mc-next').addEventListener('click', nextTrack);
      wrap.querySelector('#mc-prev').addEventListener('click', prevTrack);
      wrap.querySelector('#mc-shuf').addEventListener('click', () => {
        currentTrack = Math.floor(Math.random() * tracks.length);
        elapsed = 0; progress = 0; stopAudio(); render();
      });
      wrap.querySelector('#music-vol').addEventListener('input', (e) => {
        volume = e.target.value / 100;
        if (audioEl) audioEl.volume = volume;
      });
      wrap.querySelectorAll('.music-track').forEach(el => {
        el.addEventListener('click', () => {
          currentTrack = parseInt(el.dataset.idx);
          elapsed = 0; progress = 0; stopAudio();
          isPlaying = true; startPlay(); render();
        });
      });
      wrap.querySelectorAll('.music-del-btn').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(el.dataset.idx);
          userTracks = userTracks.filter((_, i) => i !== (idx - BUILTIN_TRACKS.length));
          saveUserTracks(userTracks);
          tracks = [...BUILTIN_TRACKS, ...userTracks];
          if (currentTrack >= tracks.length) currentTrack = 0;
          render();
        });
      });

      // File upload
      wrap.querySelector('#music-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 30 * 1024 * 1024) {
          if (typeof OS !== 'undefined') OS.notify('⚠️','NormTunes','Max 30MB per track');
          return;
        }
        const statusEl = wrap.querySelector('#music-upload-status');
        statusEl.textContent = 'Loading...';
        const reader = new FileReader();
        reader.onload = (ev) => {
          const name = file.name.replace(/\.[^.]+$/, '');
          const newTrack = {
            id: 'u_' + Date.now(),
            title: name,
            artist: typeof OS !== 'undefined' ? OS.state.username : 'You',
            dur: 0, icon: '🎵', color: '#4ade80',
            dataUrl: ev.target.result,
          };
          // Get real duration
          const tmp = new Audio(ev.target.result);
          tmp.addEventListener('loadedmetadata', () => {
            newTrack.dur = Math.floor(tmp.duration) || 0;
            userTracks.push(newTrack);
            saveUserTracks(userTracks);
            tracks = [...BUILTIN_TRACKS, ...userTracks];
            statusEl.textContent = `✅ ${name} added!`;

            // Share with other players if under 2MB
            if (typeof Network !== 'undefined' && Network.isConnected()) {
              const shareTrack = {...newTrack};
              if (shareTrack.dataUrl.length > 2*1024*1024) {
                shareTrack.dataUrl = null;
                shareTrack.shareNote = `${newTrack.artist} uploaded "${newTrack.title}" (too large to stream)`;
              }
              Network.send({ type: 'normtunes:upload', track: shareTrack });
            }
            render();
          });
          tmp.load();
        };
        reader.readAsDataURL(file);
      });
    };

    const startPlay = () => {
      const t = tracks[currentTrack];
      if (!t) return;

      if (t.dataUrl) {
        // Real audio
        stopAudio();
        audioEl = new Audio(t.dataUrl);
        audioEl.volume = volume;
        audioEl.play().catch(() => {});
        audioEl.addEventListener('timeupdate', () => {
          elapsed = Math.floor(audioEl.currentTime);
          progress = audioEl.duration ? (audioEl.currentTime / audioEl.duration) * 100 : 0;
          const fillEl = wrap.querySelector('#music-fill');
          const elapsedEl = wrap.querySelector('#music-elapsed');
          if (fillEl) fillEl.style.width = progress + '%';
          if (elapsedEl) elapsedEl.textContent = fmtTime(elapsed);
        });
        audioEl.addEventListener('ended', nextTrack);
      } else {
        // Simulated playback
        playInterval = setInterval(() => {
          elapsed++;
          progress = t.dur ? (elapsed / t.dur) * 100 : 0;
          if (elapsed >= t.dur) { nextTrack(); return; }
          const fillEl = wrap.querySelector('#music-fill');
          const elapsedEl = wrap.querySelector('#music-elapsed');
          if (fillEl) fillEl.style.width = progress + '%';
          if (elapsedEl) elapsedEl.textContent = fmtTime(elapsed);
        }, 1000);
      }
    };

    const togglePlay = () => {
      isPlaying = !isPlaying;
      if (isPlaying) {
        if (audioEl && tracks[currentTrack]?.dataUrl) { audioEl.play().catch(()=>{}); }
        else startPlay();
      } else {
        stopAudio();
      }
      render();
    };
    const nextTrack = () => {
      currentTrack = (currentTrack + 1) % tracks.length;
      elapsed = 0; progress = 0; stopAudio(); audioEl = null;
      if (isPlaying) startPlay(); render();
    };
    const prevTrack = () => {
      if (elapsed > 3) { elapsed = 0; progress = 0; if (audioEl) audioEl.currentTime = 0; }
      else { currentTrack = (currentTrack - 1 + tracks.length) % tracks.length; elapsed = 0; progress = 0; stopAudio(); audioEl = null; }
      if (isPlaying) startPlay(); render();
    };

    // Listen for tracks shared by other players
    if (typeof Network !== 'undefined') {
      const onTrack = (data) => {
        if (!data.track) return;
        if (tracks.some(t => t.id === data.track.id)) return;
        const t = data.track;
        if (t.dataUrl) {
          userTracks.push(t);
          saveUserTracks(userTracks);
          tracks = [...BUILTIN_TRACKS, ...userTracks];
          if (typeof OS !== 'undefined') OS.notify('🎵','NormTunes',`${t.artist} shared "${t.title}"!`);
          render();
        } else if (t.shareNote) {
          if (typeof OS !== 'undefined') OS.notify('🎵','NormTunes', t.shareNote);
        }
      };
      Network.on('normtunes:track', onTrack);
      wrap._musicCleanup = () => { stopAudio(); Network.off('normtunes:track', onTrack); };
    } else {
      wrap._musicCleanup = () => stopAudio();
    }

    render();

    // Music CSS
    if (!document.getElementById('music-styles')) {
      const s = document.createElement('style');
      s.id = 'music-styles';
      s.textContent = `
        .music-wrap{height:100%;display:flex;flex-direction:column;background:var(--bg1);overflow:hidden;padding:0;}
        .music-album{width:100px;height:100px;margin:16px auto 10px;background:var(--bg2);border:2px solid var(--border);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;}
        .music-album.playing{animation:music-spin 8s linear infinite;}
        @keyframes music-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        .music-title{text-align:center;font-size:0.9rem;font-weight:bold;color:var(--text1);padding:0 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .music-artist{text-align:center;font-size:0.72rem;color:var(--text3);margin-bottom:12px;}
        .music-progress-wrap{padding:0 14px;margin-bottom:10px;}
        .music-progress{height:5px;background:var(--bg2);border-radius:5px;cursor:pointer;overflow:hidden;}
        .music-progress-fill{height:100%;background:var(--accent);border-radius:5px;transition:width 0.3s;}
        .music-time{display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text3);margin-top:4px;}
        .music-controls{display:flex;justify-content:center;gap:8px;padding:6px 10px;}
        .music-ctrl{background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:7px 12px;font-size:0.85rem;cursor:pointer;color:var(--text1);}
        .music-ctrl:hover{background:var(--bg3);}
        .music-ctrl.play{background:var(--accent);color:#fff;border-color:var(--accent);padding:7px 18px;}
        .music-volume{display:flex;align-items:center;gap:8px;padding:4px 14px 8px;}
        .music-volume input{flex:1;}
        .music-playlist{overflow-y:auto;border-top:1px solid var(--border);}
        .music-track{display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.73rem;}
        .music-track:hover{background:var(--bg2);}
        .music-track.active{background:var(--bg2);color:var(--accent);}
        .music-track-num{font-size:0.62rem;color:var(--text3);width:16px;text-align:center;}
        .music-track-icon{font-size:0.8rem;}
      `;
      document.head.appendChild(s);
    }

    return wrap;
  }
};
