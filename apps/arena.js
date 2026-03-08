/**
 * NormOS — apps/arena.js
 * NormArena: Real-time PvP Chess & Checkers with money stakes.
 * Uses NormOS Network layer for all game state sync.
 */

const ArenaApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'arena-wrap';
    const iid = Math.random().toString(36).slice(2, 6);

    const myName  = () => {
      try { return OS?.state?.username || (typeof Network !== 'undefined' && Network.getState().username) || 'Player'; } catch { return 'Player'; }
    };
    const myBal   = () => (typeof Economy !== 'undefined') ? Economy.state.balance : 0;
    const fmt     = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const send    = msg => { if (typeof Network !== 'undefined') Network.send(msg); };

    // ── State ─────────────────────────────────────────────────────────────────
    let screen = 'lobby';      // lobby | waiting | game
    let gameState = null;      // full game obj from server
    let selectedSquare = null;
    let validMoves = [];
    let gameResult = null;     // null | 'win' | 'lose' | 'draw'

    // ── Chess Logic (client-side move validation + rendering) ─────────────────
    const CHESS = (() => {
      const PIECES = {
        'wK':'♔','wQ':'♕','wR':'♖','wB':'♗','wN':'♘','wP':'♙',
        'bK':'♚','bQ':'♛','bR':'♜','bB':'♝','bN':'♞','bP':'♟',
      };
      const initBoard = () => {
        const b = Array(8).fill(null).map(() => Array(8).fill(null));
        const order = ['R','N','B','Q','K','B','N','R'];
        for (let c = 0; c < 8; c++) { b[0][c]='b'+order[c]; b[7][c]='w'+order[c]; b[1][c]='bP'; b[6][c]='wP'; }
        return b;
      };
      const inBounds = (r,c) => r>=0&&r<8&&c>=0&&c<8;
      const colorOf = p => p ? p[0] : null;
      const typeOf  = p => p ? p[1] : null;

      const getMoves = (board, r, c, enPassant, castling) => {
        const p = board[r][c]; if (!p) return [];
        const col = colorOf(p), type = typeOf(p);
        const moves = [];
        const add = (tr,tc,special) => { if(inBounds(tr,tc)&&colorOf(board[tr][tc])!==col) moves.push({fr:r,fc:c,tr,tc,special}); };

        if (type === 'P') {
          const dir = col==='w' ? -1 : 1, startRow = col==='w' ? 6 : 1;
          if (inBounds(r+dir,c) && !board[r+dir][c]) {
            moves.push({fr:r,fc:c,tr:r+dir,tc:c});
            if (r===startRow && !board[r+2*dir][c]) moves.push({fr:r,fc:c,tr:r+2*dir,tc:c,special:'double'});
          }
          for (const dc of [-1,1]) {
            if (inBounds(r+dir,c+dc)) {
              if (colorOf(board[r+dir][c+dc])&&colorOf(board[r+dir][c+dc])!==col) moves.push({fr:r,fc:c,tr:r+dir,tc:c+dc});
              if (enPassant&&enPassant[0]===r+dir&&enPassant[1]===c+dc) moves.push({fr:r,fc:c,tr:r+dir,tc:c+dc,special:'ep'});
            }
          }
        } else if (type === 'N') {
          for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r+dr,c+dc);
        } else if (type === 'K') {
          for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) add(r+dr,c+dc);
          if (castling) {
            if (castling[col+'K'] && !board[r][5] && !board[r][6]) moves.push({fr:r,fc:c,tr:r,tc:6,special:'castleK'});
            if (castling[col+'Q'] && !board[r][1] && !board[r][2] && !board[r][3]) moves.push({fr:r,fc:c,tr:r,tc:2,special:'castleQ'});
          }
        } else {
          const dirs = type==='R'?[[0,1],[0,-1],[1,0],[-1,0]]:type==='B'?[[1,1],[1,-1],[-1,1],[-1,-1]]:[[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
          for (const [dr,dc] of dirs) {
            let nr=r+dr,nc=c+dc;
            while(inBounds(nr,nc)){
              if (board[nr][nc]) { if(colorOf(board[nr][nc])!==col) moves.push({fr:r,fc:c,tr:nr,tc:nc}); break; }
              moves.push({fr:r,fc:c,tr:nr,tc:nc}); nr+=dr; nc+=dc;
            }
          }
        }
        return moves;
      };

      const applyMove = (board, move) => {
        const nb = board.map(r=>[...r]);
        const p = nb[move.fr][move.fc];
        nb[move.tr][move.tc] = p; nb[move.fr][move.fc] = null;
        if (move.special === 'ep') nb[move.fr][move.tc] = null;
        if (move.special === 'castleK') { nb[move.tr][5]=nb[move.tr][7]; nb[move.tr][7]=null; }
        if (move.special === 'castleQ') { nb[move.tr][3]=nb[move.tr][0]; nb[move.tr][0]=null; }
        // Pawn promotion to queen
        const col = colorOf(p);
        if (typeOf(p)==='P') { if (move.tr===0&&col==='w') nb[0][move.tc]='wQ'; if (move.tr===7&&col==='b') nb[7][move.tc]='bQ'; }
        return nb;
      };

      const isInCheck = (board, col) => {
        let kr=-1, kc=-1;
        for (let r=0;r<8;r++) for (let c=0;c<8;c++) if(board[r][c]===col+'K'){kr=r;kc=c;}
        const opp = col==='w'?'b':'w';
        for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
          if (colorOf(board[r][c])===opp) {
            const ms = getMoves(board,r,c,null,null);
            if (ms.some(m=>m.tr===kr&&m.tc===kc)) return true;
          }
        }
        return false;
      };

      const getLegalMoves = (board, r, c, enPassant, castling) => {
        const p = board[r][c]; if (!p) return [];
        const col = colorOf(p);
        return getMoves(board,r,c,enPassant,castling).filter(m => !isInCheck(applyMove(board,m),col));
      };

      const getAllLegal = (board, col, enPassant, castling) => {
        const all = [];
        for (let r=0;r<8;r++) for (let c=0;c<8;c++) if(colorOf(board[r][c])===col) all.push(...getLegalMoves(board,r,c,enPassant,castling));
        return all;
      };

      return { initBoard, getLegalMoves, getAllLegal, applyMove, isInCheck, PIECES };
    })();

    // ── Checkers Logic ────────────────────────────────────────────────────────
    const CHECKERS = (() => {
      const initBoard = () => {
        const b = Array(8).fill(null).map(() => Array(8).fill(null));
        for (let r=0; r<3; r++) for (let c=0; c<8; c++) if ((r+c)%2===1) b[r][c]='b';
        for (let r=5; r<8; r++) for (let c=0; c<8; c++) if ((r+c)%2===1) b[r][c]='w';
        return b;
      };
      const getJumps = (board, r, c, col) => {
        const piece = board[r][c]; if (!piece) return [];
        const king = piece.length>1;
        const dirs = col==='w'?[[-1,-1],[-1,1]]:[[1,-1],[1,1]];
        const allDirs = king?[[-1,-1],[-1,1],[1,-1],[1,1]]:dirs;
        const jumps = [];
        const opp = col==='w'?'b':'w';
        for (const [dr,dc] of allDirs) {
          const mr=r+dr, mc=c+dc, jr=r+2*dr, jc=c+2*dc;
          if (mr>=0&&mr<8&&mc>=0&&mc<8&&jr>=0&&jr<8&&jc>=0&&jc<8) {
            if (board[mr][mc]&&board[mr][mc][0]===opp&&!board[jr][jc]) jumps.push({fr:r,fc:c,tr:jr,tc:jc,cap:[mr,mc]});
          }
        }
        return jumps;
      };
      const getMoves = (board, col) => {
        const moves=[]; const jumps=[];
        for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
          if (!board[r][c]||board[r][c][0]!==col) continue;
          jumps.push(...getJumps(board,r,c,col));
          if (!jumps.length) {
            const piece=board[r][c]; const king=piece.length>1;
            const dirs=col==='w'?[[-1,-1],[-1,1]]:[[1,-1],[1,1]];
            const allDirs=king?[[-1,-1],[-1,1],[1,-1],[1,1]]:dirs;
            for (const [dr,dc] of allDirs) { const nr=r+dr,nc=c+dc; if(nr>=0&&nr<8&&nc>=0&&nc<8&&!board[nr][nc]) moves.push({fr:r,fc:c,tr:nr,tc:nc}); }
          }
        }
        return jumps.length ? jumps : moves;
      };
      const applyMove = (board, move) => {
        const nb = board.map(r=>[...r]);
        nb[move.tr][move.tc]=nb[move.fr][move.fc]; nb[move.fr][move.fc]=null;
        if (move.cap) nb[move.cap[0]][move.cap[1]]=null;
        if (nb[move.tr][move.tc]==='w'&&move.tr===0) nb[move.tr][move.tc]='wK';
        if (nb[move.tr][move.tc]==='b'&&move.tr===7) nb[move.tr][move.tc]='bK';
        return nb;
      };
      const getPieceMoves = (board, r, c, col) => {
        const allMoves = getMoves(board, col);
        const hasJumps = allMoves.some(m=>m.cap);
        if (hasJumps) return allMoves.filter(m=>m.fr===r&&m.fc===c&&m.cap);
        return allMoves.filter(m=>m.fr===r&&m.fc===c);
      };
      return { initBoard, getMoves, applyMove, getPieceMoves };
    })();

    // ── CSS ───────────────────────────────────────────────────────────────────
    const styleId = 'arena-styles-'+iid;
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = `
      .arena-wrap { display:flex; flex-direction:column; height:100%; background:var(--bg1); color:var(--text1); font-family:var(--font-mono); overflow:hidden; }
      .arena-header { display:flex; align-items:center; gap:0.75rem; padding:0.6rem 1rem; background:var(--bg2); border-bottom:1px solid var(--border); flex-shrink:0; }
      .arena-title { font-size:1rem; font-weight:700; color:#f59e0b; }
      .arena-bal { margin-left:auto; font-size:0.7rem; color:var(--text3); }
      .arena-body { flex:1; overflow-y:auto; padding:1rem; display:flex; gap:1rem; }
      .arena-lobby { flex:1; display:flex; flex-direction:column; gap:0.75rem; max-width:700px; margin:0 auto; width:100%; }
      .arena-lobby h2 { font-size:0.9rem; color:#f59e0b; margin:0 0 0.25rem; }
      .arena-section { background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:0.9rem; }
      .arena-section h3 { font-size:0.75rem; color:var(--text3); margin:0 0 0.7rem; text-transform:uppercase; letter-spacing:1px; }
      .arena-game-types { display:flex; gap:0.6rem; flex-wrap:wrap; }
      .arena-game-type { flex:1; min-width:140px; padding:0.8rem; background:var(--bg3); border:2px solid var(--border); border-radius:8px; cursor:pointer; text-align:center; transition:border-color 0.15s; }
      .arena-game-type:hover,.arena-game-type.active { border-color:#f59e0b; }
      .arena-game-type .agt-icon { font-size:1.8rem; }
      .arena-game-type .agt-name { font-size:0.8rem; font-weight:700; margin-top:0.3rem; }
      .arena-game-type .agt-desc { font-size:0.62rem; color:var(--text3); margin-top:0.2rem; }
      .arena-stake-row { display:flex; gap:0.5rem; align-items:center; margin-top:0.5rem; flex-wrap:wrap; }
      .arena-stake-btn { padding:0.3rem 0.75rem; background:var(--bg3); border:1px solid var(--border); border-radius:5px; color:var(--text2); font-size:0.72rem; cursor:pointer; font-family:var(--font-mono); }
      .arena-stake-btn:hover,.arena-stake-btn.active { background:#f59e0b22; border-color:#f59e0b; color:#f59e0b; }
      .arena-stake-custom { flex:1; min-width:80px; padding:0.3rem 0.5rem; background:var(--bg3); border:1px solid var(--border); border-radius:5px; color:var(--text1); font-size:0.72rem; font-family:var(--font-mono); outline:none; }
      .arena-primary-btn { padding:0.55rem 1.4rem; background:#f59e0b; color:#000; border:none; border-radius:6px; font-weight:700; cursor:pointer; font-size:0.8rem; font-family:var(--font-mono); transition:opacity 0.15s; }
      .arena-primary-btn:hover { opacity:0.88; }
      .arena-primary-btn:disabled { opacity:0.4; cursor:not-allowed; }
      .arena-rooms { display:flex; flex-direction:column; gap:0.4rem; }
      .arena-room { display:flex; align-items:center; gap:0.75rem; padding:0.55rem 0.75rem; background:var(--bg3); border:1px solid var(--border); border-radius:6px; }
      .arena-room-info { flex:1; }
      .arena-room-name { font-size:0.78rem; font-weight:600; }
      .arena-room-meta { font-size:0.62rem; color:var(--text3); margin-top:1px; }
      .arena-join-btn { padding:0.3rem 0.8rem; background:#4f9eff22; border:1px solid #4f9eff; color:#4f9eff; border-radius:5px; font-size:0.7rem; cursor:pointer; font-family:var(--font-mono); }
      .arena-join-btn:hover { background:#4f9eff44; }
      .arena-empty { text-align:center; color:var(--text3); font-size:0.75rem; padding:1.5rem; }
      .arena-waiting { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; }
      .arena-waiting-icon { font-size:3rem; animation:arena-spin 2s linear infinite; }
      @keyframes arena-spin { to { transform:rotate(360deg); } }
      .arena-waiting-title { font-size:1rem; font-weight:700; color:#f59e0b; }
      .arena-waiting-sub { font-size:0.75rem; color:var(--text3); text-align:center; max-width:300px; }
      .arena-cancel-btn { padding:0.45rem 1.2rem; background:transparent; border:1px solid #f87171; color:#f87171; border-radius:6px; cursor:pointer; font-size:0.75rem; font-family:var(--font-mono); }
      .arena-game { flex:1; display:flex; gap:1rem; overflow:hidden; }
      .arena-board-wrap { display:flex; flex-direction:column; align-items:center; gap:0.5rem; flex-shrink:0; }
      .arena-board { display:grid; grid-template-columns:repeat(8,1fr); border:2px solid #f59e0b44; border-radius:4px; overflow:hidden; user-select:none; }
      .arena-sq { width:56px; height:56px; display:flex; align-items:center; justify-content:center; font-size:1.75rem; cursor:pointer; position:relative; transition:filter 0.1s; }
      .arena-sq.light { background:#f0d9b5; }
      .arena-sq.dark  { background:#b58863; }
      .arena-sq.selected { outline:3px solid #f59e0b; outline-offset:-3px; }
      .arena-sq.valid-move::after { content:''; position:absolute; width:28%; height:28%; background:rgba(0,0,0,0.2); border-radius:50%; pointer-events:none; }
      .arena-sq.valid-capture { outline:3px solid #f87171; outline-offset:-3px; }
      .arena-sq.last-move { background:#cdd92e66; }
      .arena-sq.in-check { background:#f8717155 !important; }
      .arena-coord-row { display:flex; gap:0; }
      .arena-coord { width:56px; text-align:center; font-size:0.6rem; color:var(--text3); font-family:var(--font-mono); }
      .arena-sidebar { flex:1; display:flex; flex-direction:column; gap:0.6rem; min-width:160px; max-width:240px; overflow-y:auto; }
      .arena-player-card { padding:0.6rem 0.75rem; background:var(--bg2); border:1px solid var(--border); border-radius:7px; }
      .arena-player-card.active-turn { border-color:#4ade80; box-shadow:0 0 8px #4ade8033; }
      .arena-player-name { font-size:0.8rem; font-weight:700; }
      .arena-player-color { font-size:0.62rem; color:var(--text3); margin-top:2px; }
      .arena-timer { font-size:1.1rem; font-weight:700; color:#4ade80; font-variant-numeric:tabular-nums; }
      .arena-timer.low { color:#f87171; animation:arena-pulse 0.5s infinite; }
      @keyframes arena-pulse { 50% { opacity:0.5; } }
      .arena-stake-display { background:var(--bg2); border:1px solid #f59e0b44; border-radius:7px; padding:0.6rem; text-align:center; }
      .arena-stake-display .asd-label { font-size:0.62rem; color:var(--text3); margin-bottom:2px; }
      .arena-stake-display .asd-val { font-size:1.1rem; font-weight:700; color:#f59e0b; }
      .arena-move-log { flex:1; background:var(--bg2); border:1px solid var(--border); border-radius:7px; padding:0.5rem; overflow-y:auto; min-height:80px; }
      .arena-move-log-title { font-size:0.62rem; color:var(--text3); text-transform:uppercase; letter-spacing:1px; margin-bottom:0.4rem; }
      .arena-move-entry { font-size:0.68rem; color:var(--text2); line-height:1.8; }
      .arena-resign-btn { padding:0.4rem; background:transparent; border:1px solid #f87171; color:#f87171; border-radius:5px; cursor:pointer; font-size:0.7rem; font-family:var(--font-mono); width:100%; }
      .arena-resign-btn:hover { background:#f8717122; }
      .arena-result-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; z-index:100; border-radius:4px; backdrop-filter:blur(4px); }
      .arena-result-card { background:var(--bg2); border:2px solid #f59e0b; border-radius:12px; padding:2rem; text-align:center; max-width:280px; }
      .arena-result-icon { font-size:3rem; margin-bottom:0.5rem; }
      .arena-result-title { font-size:1.2rem; font-weight:700; margin-bottom:0.3rem; }
      .arena-result-sub { font-size:0.75rem; color:var(--text3); margin-bottom:1.2rem; }
      .arena-result-payout { font-size:1.1rem; font-weight:700; color:#4ade80; margin-bottom:1rem; }
      .arena-checkers-piece { width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.1rem; border:3px solid rgba(0,0,0,0.3); box-shadow:0 2px 4px rgba(0,0,0,0.4); }
      .arena-checkers-piece.white { background:radial-gradient(circle at 35% 35%, #fff, #ccc); }
      .arena-checkers-piece.black { background:radial-gradient(circle at 35% 35%, #555, #111); color:#fff; }
      .arena-checkers-piece.king::after { content:'♛'; font-size:0.9rem; }
      .arena-badge { display:inline-block; padding:0.15rem 0.5rem; border-radius:4px; font-size:0.62rem; font-weight:700; background:#f59e0b22; color:#f59e0b; border:1px solid #f59e0b44; }
      `;
      document.head.appendChild(st);
    }

    // ── Render ────────────────────────────────────────────────────────────────
    wrap.innerHTML = `
      <div class="arena-header">
        <span style="font-size:1.3rem">🏆</span>
        <span class="arena-title">NormArena</span>
        <span class="arena-badge" id="ar-status-${iid}">Lobby</span>
        <span class="arena-bal" id="ar-bal-${iid}">$${fmt(myBal())}</span>
      </div>
      <div class="arena-body" id="ar-body-${iid}"></div>
    `;

    const body = wrap.querySelector(`#ar-body-${iid}`);
    const setStatus = t => { const el = wrap.querySelector(`#ar-status-${iid}`); if (el) el.textContent = t; };
    const setBal = () => { const el = wrap.querySelector(`#ar-bal-${iid}`); if (el) el.textContent = `$${fmt(myBal())}`; };

    // ── Lobby screen ──────────────────────────────────────────────────────────
    let selectedGame = 'chess';
    let selectedStake = 100;
    let openRooms = [];

    const renderLobby = () => {
      screen = 'lobby'; setStatus('Lobby');
      body.innerHTML = `
        <div class="arena-lobby">
          <h2>⚔️ Challenge another player</h2>
          <div class="arena-section">
            <h3>Game Type</h3>
            <div class="arena-game-types">
              <div class="arena-game-type ${selectedGame==='chess'?'active':''}" data-game="chess">
                <div class="agt-icon">♟️</div>
                <div class="agt-name">Chess</div>
                <div class="agt-desc">Classic strategy, 10min each</div>
              </div>
              <div class="arena-game-type ${selectedGame==='checkers'?'active':''}" data-game="checkers">
                <div class="agt-icon">⚫</div>
                <div class="agt-name">Checkers</div>
                <div class="agt-desc">Fast tactical jumps</div>
              </div>
            </div>
          </div>
          <div class="arena-section">
            <h3>Stake</h3>
            <div class="arena-stake-row">
              ${[50,100,250,500,1000].map(s=>`<button class="arena-stake-btn ${selectedStake===s?'active':''}" data-stake="${s}">$${s}</button>`).join('')}
              <input class="arena-stake-custom" id="ar-custom-stake-${iid}" type="number" min="1" placeholder="Custom" value="" />
            </div>
            <div style="font-size:0.62rem;color:var(--text3);margin-top:0.5rem">You have: $${fmt(myBal())} — Winner takes both stakes</div>
          </div>
          <div style="display:flex;gap:0.6rem;align-items:center;">
            <button class="arena-primary-btn" id="ar-create-${iid}">+ Create Room</button>
            <button class="arena-primary-btn" style="background:#4f9eff;margin-left:0;" id="ar-refresh-${iid}">↻ Refresh Rooms</button>
          </div>
          <div class="arena-section">
            <h3>Open Rooms</h3>
            <div id="ar-rooms-${iid}" class="arena-rooms">
              <div class="arena-empty">Loading rooms…</div>
            </div>
          </div>
        </div>`;

      body.querySelectorAll('.arena-game-type').forEach(el => {
        el.addEventListener('click', () => {
          selectedGame = el.dataset.game;
          body.querySelectorAll('.arena-game-type').forEach(e => e.classList.toggle('active', e.dataset.game === selectedGame));
        });
      });
      body.querySelectorAll('.arena-stake-btn').forEach(el => {
        el.addEventListener('click', () => {
          selectedStake = parseInt(el.dataset.stake);
          body.querySelector(`#ar-custom-stake-${iid}`).value = '';
          body.querySelectorAll('.arena-stake-btn').forEach(e => e.classList.toggle('active', parseInt(e.dataset.stake) === selectedStake));
        });
      });
      body.querySelector(`#ar-custom-stake-${iid}`).addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && v > 0) { selectedStake = v; body.querySelectorAll('.arena-stake-btn').forEach(el => el.classList.remove('active')); }
      });
      body.querySelector(`#ar-create-${iid}`).addEventListener('click', () => {
        if (myBal() < selectedStake) { showToast('Insufficient funds for this stake', '#f87171'); return; }
        send({ type:'arena:create', game: selectedGame, stake: selectedStake });
        renderWaiting();
      });
      body.querySelector(`#ar-refresh-${iid}`).addEventListener('click', () => send({ type:'arena:rooms:get' }));
      send({ type:'arena:rooms:get' });
    };

    const renderRooms = () => {
      const el = body.querySelector(`#ar-rooms-${iid}`);
      if (!el) return;
      if (!openRooms.length) { el.innerHTML = '<div class="arena-empty">No open rooms — create one!</div>'; return; }
      el.innerHTML = openRooms.map(r => `
        <div class="arena-room">
          <div class="arena-room-info">
            <div class="arena-room-name">${r.gameType==='chess'?'♟️':'⚫'} ${r.gameType} · <span style="color:#f59e0b">$${fmt(r.stake)} stake</span></div>
            <div class="arena-room-meta">Hosted by <span style="color:${r.hostColor}">${r.hostName}</span></div>
          </div>
          <button class="arena-join-btn" data-id="${r.id}" ${r.hostName===myName()?'disabled style="opacity:0.4"':''}>Join</button>
        </div>`).join('');
      el.querySelectorAll('.arena-join-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const room = openRooms.find(r => r.id === id);
          if (!room) return;
          if (myBal() < room.stake) { showToast('Insufficient funds to join this room', '#f87171'); return; }
          send({ type:'arena:join', roomId: id });
          renderWaiting(true);
        });
      });
    };

    // ── Waiting screen ────────────────────────────────────────────────────────
    const renderWaiting = (isJoining = false) => {
      screen = 'waiting'; setStatus('Waiting…');
      body.innerHTML = `
        <div class="arena-waiting">
          <div class="arena-waiting-icon">⏳</div>
          <div class="arena-waiting-title">${isJoining ? 'Joining game…' : 'Waiting for opponent'}</div>
          <div class="arena-waiting-sub">${isJoining ? 'Connecting you to the game.' : 'Your room is open. Share your username so friends can join, or wait for someone to challenge you.'}</div>
          <button class="arena-cancel-btn" id="ar-cancel-${iid}">✕ Cancel</button>
        </div>`;
      body.querySelector(`#ar-cancel-${iid}`).addEventListener('click', () => {
        send({ type:'arena:cancel' });
        renderLobby();
      });
    };

    // ── Game screen ───────────────────────────────────────────────────────────
    let timerInterval = null;
    let timers = { w: 600, b: 600 };

    const renderGame = () => {
      screen = 'game';
      if (!gameState) return;
      const gs = gameState;
      const isChess = gs.gameType === 'chess';
      const myColor = gs.players.w === myName() ? 'w' : 'b';
      const myTurn = gs.turn === myColor;
      const oppName = myColor === 'w' ? gs.players.b : gs.players.w;
      const oppColor = myColor === 'w' ? 'b' : 'w';
      timers = gs.timers ? { ...gs.timers } : { w:600, b:600 };

      setStatus(myTurn ? 'Your Turn' : `${oppName}'s Turn`);

      body.innerHTML = `
        <div class="arena-game">
          <div class="arena-board-wrap">
            <div id="ar-board-${iid}" class="arena-board" style="position:relative;"></div>
            <div class="arena-coord-row">${['a','b','c','d','e','f','g','h'].map(l=>`<div class="arena-coord">${l}</div>`).join('')}</div>
            ${gameResult ? '' : ''}
          </div>
          <div class="arena-sidebar">
            <div class="arena-player-card ${!myTurn?'active-turn':''}">
              <div class="arena-player-name" style="color:${gs.colors?.[oppColor]||'#aaa'}">${oppName}</div>
              <div class="arena-player-color">${isChess?(oppColor==='w'?'White':'Black'):(oppColor==='w'?'⚪ Light':'⚫ Dark')}</div>
              <div class="arena-timer ${timers[oppColor]<30?'low':''}" id="ar-timer-${oppColor}-${iid}">${fmtTime(timers[oppColor])}</div>
            </div>
            <div class="arena-stake-display">
              <div class="asd-label">Stakes on the line</div>
              <div class="asd-val">$${fmt(gs.stake * 2)}</div>
              <div style="font-size:0.6rem;color:var(--text3);margin-top:2px">Your bet: $${fmt(gs.stake)}</div>
            </div>
            <div class="arena-player-card ${myTurn?'active-turn':''}">
              <div class="arena-player-name" style="color:${gs.colors?.[myColor]||'#aaa'}">${myName()} (You)</div>
              <div class="arena-player-color">${isChess?(myColor==='w'?'White':'Black'):(myColor==='w'?'⚪ Light':'⚫ Dark')}</div>
              <div class="arena-timer ${timers[myColor]<30?'low':''}" id="ar-timer-${myColor}-${iid}">${fmtTime(timers[myColor])}</div>
            </div>
            <div class="arena-move-log" id="ar-log-${iid}">
              <div class="arena-move-log-title">Move Log</div>
              ${(gs.moveLog||[]).map(m=>`<div class="arena-move-entry">${m}</div>`).join('')}
            </div>
            ${!gameResult ? `<button class="arena-resign-btn" id="ar-resign-${iid}">🏳️ Resign</button>` : ''}
          </div>
        </div>`;

      drawBoard(isChess, myColor, gs);

      if (!gameResult) {
        body.querySelector(`#ar-resign-${iid}`)?.addEventListener('click', () => {
          if (confirm('Resign and forfeit the stake?')) send({ type:'arena:resign', roomId: gs.id });
        });
        startTimerTick(gs);
      }

      if (gameResult) showResultOverlay();
    };

    const fmtTime = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

    const startTimerTick = (gs) => {
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        if (!gameState || gameResult) { clearInterval(timerInterval); return; }
        const cur = gameState.turn;
        timers[cur] = Math.max(0, timers[cur] - 1);
        const el = body.querySelector(`#ar-timer-${cur}-${iid}`);
        if (el) { el.textContent = fmtTime(timers[cur]); el.classList.toggle('low', timers[cur] < 30); }
        if (timers[cur] === 0) { send({ type:'arena:timeout', roomId: gameState.id }); clearInterval(timerInterval); }
      }, 1000);
    };

    // ── Board drawing ─────────────────────────────────────────────────────────
    const drawBoard = (isChess, myColor, gs) => {
      const boardEl = body.querySelector(`#ar-board-${iid}`);
      if (!boardEl) return;
      boardEl.innerHTML = '';
      const board = gs.board;
      const flip = myColor === 'b';
      const rows = flip ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
      const cols = flip ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

      // result overlay inside board wrap
      if (gameResult) {
        const ov = document.createElement('div');
        ov.className = 'arena-result-overlay';
        ov.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.82);display:flex;align-items:center;justify-content:center;z-index:100;border-radius:4px;';
        boardEl.parentElement.style.position = 'relative';
        boardEl.parentElement.appendChild(ov);
      }

      for (const r of rows) {
        for (const c of cols) {
          const sq = document.createElement('div');
          const isLight = (r + c) % 2 === 0;
          sq.className = `arena-sq ${isLight ? 'light' : 'dark'}`;
          sq.dataset.r = r; sq.dataset.c = c;

          // Highlights
          if (selectedSquare && selectedSquare[0]===r && selectedSquare[1]===c) sq.classList.add('selected');
          if (validMoves.some(m=>m.tr===r&&m.tc===c)) {
            if (isChess && board[r][c]) sq.classList.add('valid-capture');
            else sq.classList.add('valid-move');
          }
          if (gs.lastMove && ((gs.lastMove.fr===r&&gs.lastMove.fc===c)||(gs.lastMove.tr===r&&gs.lastMove.tc===c))) sq.classList.add('last-move');
          if (isChess && gs.inCheck && board[r][c]===gs.turn+'K') sq.classList.add('in-check');

          // Piece
          const piece = board[r][c];
          if (piece) {
            if (isChess) {
              sq.textContent = CHESS.PIECES[piece] || '';
              sq.style.color = piece[0]==='w' ? '#fffde7' : '#1a1a2e';
              sq.style.textShadow = piece[0]==='w' ? '0 1px 3px rgba(0,0,0,0.8)' : '0 1px 3px rgba(255,255,255,0.2)';
            } else {
              const pc = document.createElement('div');
              pc.className = `arena-checkers-piece ${piece[0]==='w'?'white':'black'}${piece.length>1?' king':''}`;
              if (piece.length > 1) pc.textContent = '♛';
              sq.appendChild(pc);
            }
          }

          sq.addEventListener('click', () => onSquareClick(r, c, isChess, myColor, gs));
          boardEl.appendChild(sq);
        }
      }
    };

    const onSquareClick = (r, c, isChess, myColor, gs) => {
      if (gameResult) return;
      if (gs.turn !== myColor) { showToast("It's not your turn", '#6b7280'); return; }
      const board = gs.board;

      if (selectedSquare) {
        const move = validMoves.find(m => m.tr===r && m.tc===c);
        if (move) {
          send({ type:'arena:move', roomId: gs.id, move });
          selectedSquare = null; validMoves = [];
          drawBoard(isChess, myColor, gs);
          return;
        }
      }

      if (board[r][c] && (isChess ? board[r][c][0]===myColor : board[r][c][0]===myColor)) {
        selectedSquare = [r, c];
        if (isChess) {
          validMoves = CHESS.getLegalMoves(board, r, c, gs.enPassant, gs.castling);
        } else {
          validMoves = CHECKERS.getPieceMoves(board, r, c, myColor);
        }
        drawBoard(isChess, myColor, gs);
      } else {
        selectedSquare = null; validMoves = [];
        drawBoard(isChess, myColor, gs);
      }
    };

    const showResultOverlay = () => {
      const boardWrap = body.querySelector(`#ar-board-${iid}`)?.parentElement;
      if (!boardWrap) return;
      boardWrap.style.position = 'relative';
      const existing = boardWrap.querySelector('.arena-result-overlay');
      if (existing) existing.remove();
      const ov = document.createElement('div');
      ov.className = 'arena-result-overlay';
      const isWin = gameResult === 'win';
      const isDraw = gameResult === 'draw';
      const payout = isDraw ? 0 : (gameState?.stake || 0);
      ov.innerHTML = `
        <div class="arena-result-card">
          <div class="arena-result-icon">${isDraw?'🤝':isWin?'🏆':'💀'}</div>
          <div class="arena-result-title" style="color:${isDraw?'#f59e0b':isWin?'#4ade80':'#f87171'}">${isDraw?'Draw!':isWin?'You Win!':'You Lose'}</div>
          <div class="arena-result-sub">${isDraw?'Stakes returned':'Winner takes all'}</div>
          ${!isDraw?`<div class="arena-result-payout">${isWin?'+':'−'}$${fmt(payout)}</div>`:''}
          <button class="arena-primary-btn" id="ar-back-lobby-${iid}">Back to Lobby</button>
        </div>`;
      boardWrap.appendChild(ov);
      ov.querySelector(`#ar-back-lobby-${iid}`).addEventListener('click', () => {
        gameState = null; gameResult = null; selectedSquare = null; validMoves = [];
        if (timerInterval) clearInterval(timerInterval);
        renderLobby();
      });
    };

    // ── Toast ─────────────────────────────────────────────────────────────────
    const showToast = (msg, color='#4ade80') => {
      const t = document.createElement('div');
      t.style.cssText = `position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#1a1d23;border:1px solid ${color};color:${color};padding:0.5rem 1.2rem;border-radius:7px;font-size:0.73rem;z-index:9999;pointer-events:none;font-family:var(--font-mono);box-shadow:0 4px 20px rgba(0,0,0,0.5);`;
      t.textContent = msg; document.body.appendChild(t); setTimeout(()=>t.remove(), 2800);
    };

    // ── Network events ────────────────────────────────────────────────────────
    const handlers = {};
    const onNet = (type, fn) => { handlers[type] = fn; if (typeof Network !== 'undefined') Network.on(type, fn); };

    onNet('arena:rooms', msg => {
      openRooms = msg.rooms || [];
      if (screen === 'lobby') renderRooms();
    });

    onNet('arena:waiting', msg => {
      if (screen !== 'waiting') renderWaiting();
    });

    onNet('arena:start', msg => {
      gameState = msg.game;
      gameResult = null;
      selectedSquare = null;
      validMoves = [];
      renderGame();
      showToast(`⚔️ Game started vs ${gameState.players.w === myName() ? gameState.players.b : gameState.players.w}!`, '#f59e0b');
    });

    onNet('arena:state', msg => {
      gameState = msg.game;
      if (screen === 'game') {
        const isChess = gameState.gameType === 'chess';
        const myColor = gameState.players.w === myName() ? 'w' : 'b';
        selectedSquare = null; validMoves = [];
        timers = gameState.timers ? { ...gameState.timers } : timers;
        drawBoard(isChess, myColor, gameState);
        // Update move log
        const logEl = body.querySelector(`#ar-log-${iid}`);
        if (logEl) logEl.innerHTML = `<div class="arena-move-log-title">Move Log</div>${(gameState.moveLog||[]).map(m=>`<div class="arena-move-entry">${m}</div>`).join('')}`;
        // Update status
        const myTurn = gameState.turn === myColor;
        const oppName = myColor === 'w' ? gameState.players.b : gameState.players.w;
        setStatus(myTurn ? 'Your Turn' : `${oppName}'s Turn`);
        // Update active-turn card
        body.querySelectorAll('.arena-player-card').forEach(el => el.classList.remove('active-turn'));
        // Re-set timers
        if (gameState.timers) {
          ['w','b'].forEach(col => {
            const el = body.querySelector(`#ar-timer-${col}-${iid}`);
            if (el) { el.textContent = fmtTime(gameState.timers[col]); el.classList.toggle('low', gameState.timers[col] < 30); }
          });
        }
        if (timerInterval) clearInterval(timerInterval);
        startTimerTick(gameState);
      }
    });

    onNet('arena:end', msg => {
      if (timerInterval) clearInterval(timerInterval);
      gameState = msg.game || gameState;
      const won = msg.winner === myName();
      const drew = !msg.winner;
      gameResult = drew ? 'draw' : (won ? 'win' : 'lose');
      setStatus(drew ? 'Draw' : (won ? 'You Won!' : 'You Lost'));
      if (typeof Economy !== 'undefined' && msg.newBalance !== undefined) {
        Economy.state.balance = msg.newBalance; Economy.save(); Economy.updateWalletDisplay(); setBal();
      }
      if (screen === 'game') showResultOverlay();
    });

    onNet('arena:opponent:left', msg => {
      if (timerInterval) clearInterval(timerInterval);
      if (screen === 'game') {
        gameResult = 'win';
        if (typeof Economy !== 'undefined' && msg.newBalance !== undefined) {
          Economy.state.balance = msg.newBalance; Economy.save(); Economy.updateWalletDisplay(); setBal();
        }
        showResultOverlay();
        showToast('Opponent disconnected — you win!', '#4ade80');
      }
    });

    onNet('arena:error', msg => showToast(msg.message || 'Arena error', '#f87171'));

    onNet('money:received', () => setBal());
    onNet('market:trade:ok', () => setBal());

    // ── Cleanup on close ──────────────────────────────────────────────────────
    wrap._arenaCleanup = () => {
      if (timerInterval) clearInterval(timerInterval);
      Object.entries(handlers).forEach(([type, fn]) => { if (typeof Network !== 'undefined') Network.off(type, fn); });
    };

    // ── Boot ──────────────────────────────────────────────────────────────────
    renderLobby();

    return wrap;
  }
};
