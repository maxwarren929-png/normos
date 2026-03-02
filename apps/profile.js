/**
 * NormOS — apps/profile.js
 * User Profile: bio, avatar emoji, join date, net worth history, badge showcase
 */

const ProfileApp = {
  create(targetUser) {
    const wrap = document.createElement('div');
    wrap.className = 'profile-wrap';
    const iid = Math.random().toString(36).slice(2, 6);

    const PROFILE_KEY = 'normos_profile';
    const NET_HIST_KEY = 'normos_net_worth_history';

    const loadProfile = () => {
      try {
        return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      } catch { return {}; }
    };
    const saveProfile = (p) => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {} };

    const loadNetHistory = () => {
      try { return JSON.parse(localStorage.getItem(NET_HIST_KEY) || '[]'); } catch { return []; }
    };
    const appendNetHistory = (val) => {
      const h = loadNetHistory();
      h.push({ v: val, t: Date.now() });
      if (h.length > 50) h.shift();
      try { localStorage.setItem(NET_HIST_KEY, JSON.stringify(h)); } catch {}
    };

    const myName = () => (typeof OS !== 'undefined' && OS.state) ? OS.state.username : 'Norm';

    const BADGES = [
      { id: 'first_trade',   icon: '📊', name: 'First Trade',       desc: 'Made your first stock trade' },
      { id: 'millionaire',   icon: '💰', name: 'Millionaire',       desc: 'Reached $1,000,000 net worth' },
      { id: 'risk_taker',    icon: '🎲', name: 'Risk Taker',        desc: 'Held VOID stock for 10 mins' },
      { id: 'social',        icon: '💬', name: 'Social Butterfly',  desc: 'Sent 10+ chat messages' },
      { id: 'normtok_star',  icon: '📱', name: 'NormTok Star',      desc: 'Got 50+ likes on a post' },
      { id: 'loan_shark',    icon: '🦈', name: 'Loan Taken',        desc: 'Borrowed from NormBank' },
      { id: 'miner',         icon: '⛏️', name: 'NormMiner',         desc: 'Mined NormCoin passively' },
      { id: 'bankrupt',      icon: '📉', name: 'Defaulted',         desc: 'Defaulted on a loan' },
    ];

    const EMOJI_LIST = ['🧑','👨','👩','🧔','👴','👵','🧒','🐱','🐶','🦊','🐼','🤖','👾','🎭','🧙','🧛','🧟','🧜','🎅','🦸'];

    const profile = loadProfile();
    if (!profile.avatar) profile.avatar = '🧑';
    if (!profile.bio) profile.bio = '';
    if (!profile.joinDate) { profile.joinDate = Date.now(); saveProfile(profile); }
    if (!profile.badges) profile.badges = ['first_trade'];

    const netWorth = () => (typeof Economy !== 'undefined') ? Economy.totalValue() : 0;
    appendNetHistory(netWorth());

    const escHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const render = () => {
      const hist = loadNetHistory();
      const nw = netWorth();
      const joinDate = new Date(profile.joinDate).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
      const balance = (typeof Economy !== 'undefined') ? Economy.state.balance : 0;
      const portfolioVal = (typeof Economy !== 'undefined') ? Economy.portfolioValue() : 0;

      const histMin = Math.min(...hist.map(h=>h.v), 0);
      const histMax = Math.max(...hist.map(h=>h.v), 1);
      const histNorm = hist.map(h => ((h.v - histMin) / (histMax - histMin + 0.001)) * 60);
      const sparkPoints = hist.map((h, i) => `${(i/(hist.length-1||1))*200},${60 - histNorm[i]}`).join(' ');

      wrap.innerHTML = `
        <div class="prof-layout">
          <div class="prof-sidebar">
            <div class="prof-avatar-big" id="prof-avatar-${iid}">${escHtml(profile.avatar)}</div>
            <div class="prof-username">${escHtml(myName())}</div>
            <div class="prof-joindate">📅 Joined ${joinDate}</div>
            <div class="prof-status-tag" id="prof-status-tag-${iid}">${escHtml(localStorage.getItem('normos_status') || '✨ Just here to vibe')}</div>
            <button class="prof-edit-btn" id="prof-edit-btn-${iid}">✏️ Edit Profile</button>
            <div style="margin-top:16px;">
              <div class="prof-stat-row"><span>💵 Cash</span><span>$${balance.toFixed(2)}</span></div>
              <div class="prof-stat-row"><span>📊 Portfolio</span><span>$${portfolioVal.toFixed(2)}</span></div>
              <div class="prof-stat-row" style="font-weight:bold;color:var(--accent);"><span>🏦 Net Worth</span><span>$${nw.toFixed(2)}</span></div>
            </div>
          </div>
          <div class="prof-main">
            <div class="prof-section">
              <div class="prof-section-title">📝 Bio</div>
              <div class="prof-bio-text" id="prof-bio-${iid}">${escHtml(profile.bio) || '<em style="color:var(--text3)">No bio yet. Click Edit Profile to add one.</em>'}</div>
            </div>
            <div class="prof-section">
              <div class="prof-section-title">📈 Net Worth History</div>
              <div class="prof-sparkline-wrap">
                <svg width="200" height="60" viewBox="0 0 200 60" style="overflow:visible;">
                  <polyline points="${sparkPoints}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
                  ${hist.length > 0 ? `<circle cx="${(hist.length-1)/(hist.length-1||1)*200}" cy="${60-histNorm[hist.length-1]}" r="3" fill="var(--accent)"/>` : ''}
                </svg>
                <div class="prof-sparkline-labels">
                  <span>$${histMin.toFixed(0)}</span>
                  <span>$${histMax.toFixed(0)}</span>
                </div>
              </div>
            </div>
            <div class="prof-section">
              <div class="prof-section-title">🏅 Badges</div>
              <div class="prof-badges">
                ${BADGES.map(b => {
                  const earned = profile.badges.includes(b.id);
                  return `<div class="prof-badge ${earned ? 'earned' : 'locked'}" title="${escHtml(b.desc)}">
                    <span class="prof-badge-icon">${b.icon}</span>
                    <span class="prof-badge-name">${escHtml(b.name)}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Edit Modal -->
        <div class="prof-modal" id="prof-modal-${iid}" style="display:none;">
          <div class="prof-modal-inner">
            <div class="prof-modal-title">✏️ Edit Profile</div>
            <div class="prof-modal-label">Avatar Emoji</div>
            <div class="prof-emoji-grid" id="prof-emoji-grid-${iid}">
              ${EMOJI_LIST.map(e => `<span class="prof-emoji-opt ${e===profile.avatar?'selected':''}" data-emoji="${e}">${e}</span>`).join('')}
            </div>
            <div class="prof-modal-label">Bio</div>
            <textarea class="prof-bio-input" id="prof-bio-inp-${iid}" maxlength="160">${escHtml(profile.bio)}</textarea>
            <div class="prof-modal-label">Status Message</div>
            <input class="prof-status-input" id="prof-status-inp-${iid}" maxlength="60" value="${escHtml(localStorage.getItem('normos_status') || '')}" placeholder="📈 Going all in on VOID"/>
            <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
              <button class="ntok-cancel-btn" id="prof-modal-cancel-${iid}">Cancel</button>
              <button class="ntok-submit-btn" id="prof-modal-save-${iid}">💾 Save</button>
            </div>
          </div>
        </div>
      `;

      // Edit button
      wrap.querySelector(`#prof-edit-btn-${iid}`).addEventListener('click', () => {
        wrap.querySelector(`#prof-modal-${iid}`).style.display = 'flex';
      });

      // Emoji selection
      wrap.querySelectorAll('.prof-emoji-opt').forEach(el => {
        el.addEventListener('click', () => {
          wrap.querySelectorAll('.prof-emoji-opt').forEach(e => e.classList.remove('selected'));
          el.classList.add('selected');
        });
      });

      wrap.querySelector(`#prof-modal-cancel-${iid}`).addEventListener('click', () => {
        wrap.querySelector(`#prof-modal-${iid}`).style.display = 'none';
      });

      wrap.querySelector(`#prof-modal-save-${iid}`).addEventListener('click', () => {
        const sel = wrap.querySelector('.prof-emoji-opt.selected');
        if (sel) { profile.avatar = sel.dataset.emoji; localStorage.setItem('normos_profile_avatar', profile.avatar); }
        profile.bio = wrap.querySelector(`#prof-bio-inp-${iid}`).value;
        const status = wrap.querySelector(`#prof-status-inp-${iid}`).value;
        localStorage.setItem('normos_status', status);
        saveProfile(profile);
        wrap.querySelector(`#prof-modal-${iid}`).style.display = 'none';
        render();
        if (typeof OS !== 'undefined') OS.notify('👤', 'Profile', 'Profile saved!');
      });
    };

    render();

    // Inject styles
    if (!document.getElementById('profile-styles')) {
      const s = document.createElement('style');
      s.id = 'profile-styles';
      s.textContent = `
        .profile-wrap { height:100%; overflow:hidden; background:var(--bg1); position:relative; display:flex; flex-direction:column; }
        .prof-layout { display:flex; height:100%; overflow:hidden; }
        .prof-sidebar { width:200px; min-width:200px; background:var(--bg2); border-right:1px solid var(--border); padding:20px 14px; display:flex; flex-direction:column; align-items:center; overflow-y:auto; }
        .prof-avatar-big { font-size:3.5rem; margin-bottom:10px; cursor:pointer; }
        .prof-username { font-size:1rem; font-weight:bold; color:var(--text1); margin-bottom:4px; }
        .prof-joindate { font-size:0.68rem; color:var(--text3); margin-bottom:8px; }
        .prof-status-tag { font-size:0.7rem; color:var(--accent); background:var(--bg3); border-radius:10px; padding:3px 10px; margin-bottom:12px; text-align:center; }
        .prof-edit-btn { background:var(--bg3); border:1px solid var(--border); border-radius:5px; padding:5px 14px; font-size:0.73rem; cursor:pointer; color:var(--text1); width:100%; }
        .prof-edit-btn:hover { background:var(--accent); color:#fff; border-color:var(--accent); }
        .prof-stat-row { display:flex; justify-content:space-between; font-size:0.72rem; padding:4px 0; border-bottom:1px solid var(--border); color:var(--text2); width:100%; }
        .prof-main { flex:1; overflow-y:auto; padding:16px; }
        .prof-section { margin-bottom:20px; }
        .prof-section-title { font-size:0.78rem; font-weight:bold; color:var(--text2); margin-bottom:8px; border-bottom:1px solid var(--border); padding-bottom:4px; }
        .prof-bio-text { font-size:0.82rem; color:var(--text1); line-height:1.6; }
        .prof-sparkline-wrap { background:var(--bg2); border:1px solid var(--border); border-radius:6px; padding:10px 12px; display:flex; gap:10px; align-items:center; }
        .prof-sparkline-labels { display:flex; flex-direction:column; justify-content:space-between; font-size:0.6rem; color:var(--text3); height:60px; }
        .prof-badges { display:flex; flex-wrap:wrap; gap:8px; }
        .prof-badge { display:flex; flex-direction:column; align-items:center; padding:8px 10px; border-radius:8px; border:1px solid var(--border); background:var(--bg2); min-width:70px; }
        .prof-badge.locked { opacity:0.35; filter:grayscale(1); }
        .prof-badge.earned { border-color:var(--accent); }
        .prof-badge-icon { font-size:1.4rem; }
        .prof-badge-name { font-size:0.6rem; color:var(--text2); text-align:center; margin-top:4px; }
        .prof-modal { position:absolute; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:100; }
        .prof-modal-inner { background:var(--bg2); border:1px solid var(--border); border-radius:10px; padding:20px; width:340px; max-width:90%; }
        .prof-modal-title { font-size:0.9rem; font-weight:bold; margin-bottom:14px; color:var(--text1); }
        .prof-modal-label { font-size:0.72rem; color:var(--text2); margin:10px 0 6px; }
        .prof-emoji-grid { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
        .prof-emoji-opt { font-size:1.3rem; cursor:pointer; padding:3px; border-radius:4px; border:2px solid transparent; }
        .prof-emoji-opt.selected,.prof-emoji-opt:hover { border-color:var(--accent); }
        .prof-bio-input { width:100%; height:64px; background:var(--bg1); border:1px solid var(--border); border-radius:5px; color:var(--text1); font-size:0.8rem; padding:6px; resize:none; box-sizing:border-box; }
        .prof-status-input { width:100%; background:var(--bg1); border:1px solid var(--border); border-radius:5px; color:var(--text1); font-size:0.8rem; padding:6px 8px; box-sizing:border-box; }
      `;
      document.head.appendChild(s);
    }

    return wrap;
  }
};






