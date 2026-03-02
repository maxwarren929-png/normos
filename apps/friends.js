/**
 * NormOS — apps/friends.js
 * Friends List: add friends, see online status, get join notifications
 */

const FriendsApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'friends-wrap';
    const iid = Math.random().toString(36).slice(2, 6);

    const FRIENDS_KEY = 'normos_friends';
    const loadFriends = () => { try { return JSON.parse(localStorage.getItem(FRIENDS_KEY) || '[]'); } catch { return []; } };
    const saveFriends = (f) => { try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(f)); } catch {} };

    let friends = loadFriends();

    const escHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    wrap.innerHTML = `
      <div class="friends-layout">
        <div class="friends-header">
          <span style="font-size:1rem;font-weight:bold;color:var(--text1);">👥 Friends List</span>
          <div class="friends-add-row">
            <input class="friends-add-input" id="fr-add-inp-${iid}" placeholder="Enter username to add..." maxlength="32"/>
            <button class="friends-add-btn" id="fr-add-btn-${iid}">+ Add</button>
          </div>
        </div>
        <div class="friends-sections">
          <div class="friends-section-label">ONLINE</div>
          <div id="fr-online-${iid}" class="friends-list"></div>
          <div class="friends-section-label" style="margin-top:10px;">FRIENDS</div>
          <div id="fr-all-${iid}" class="friends-list"></div>
        </div>
      </div>
    `;

    const onlineEl = wrap.querySelector(`#fr-online-${iid}`);
    const allEl    = wrap.querySelector(`#fr-all-${iid}`);

    const getOnline = () => {
      try { return (typeof Network !== 'undefined' && Network.getState) ? (Network.getState().online || []) : []; }
      catch { return []; }
    };

    let onlineUsers = getOnline();

    const renderFriends = () => {
      const online = getOnline();
      const onlineNames = online.map(u => u.username.toLowerCase());

      const onlineFriends = friends.filter(f => onlineNames.includes(f.toLowerCase()));
      const offlineFriends = friends.filter(f => !onlineNames.includes(f.toLowerCase()));

      if (onlineFriends.length === 0) {
        onlineEl.innerHTML = '<div class="friends-empty">No friends online</div>';
      } else {
        onlineEl.innerHTML = onlineFriends.map(f => {
          const user = online.find(u => u.username.toLowerCase() === f.toLowerCase());
          return `
            <div class="friends-item online">
              <span class="friends-dot" style="color:${user?.color || '#4ade80'}">⬤</span>
              <span class="friends-name" style="color:${user?.color || '#4ade80'}">${escHtml(f)}</span>
              <span class="friends-online-badge">ONLINE</span>
              <span class="friends-remove" data-name="${escHtml(f)}" title="Remove">✕</span>
            </div>`;
        }).join('');
      }

      if (offlineFriends.length === 0 && onlineFriends.length === 0) {
        allEl.innerHTML = '<div class="friends-empty">No friends yet. Add someone!</div>';
      } else if (offlineFriends.length === 0) {
        allEl.innerHTML = '<div class="friends-empty">All friends are online! 🎉</div>';
      } else {
        allEl.innerHTML = offlineFriends.map(f => `
          <div class="friends-item offline">
            <span class="friends-dot" style="color:var(--text3)">⬤</span>
            <span class="friends-name">${escHtml(f)}</span>
            <span class="friends-offline-badge">OFFLINE</span>
            <span class="friends-remove" data-name="${escHtml(f)}" title="Remove">✕</span>
          </div>`).join('');
      }

      wrap.querySelectorAll('.friends-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          friends = friends.filter(f => f !== btn.dataset.name);
          saveFriends(friends);
          renderFriends();
        });
      });
    };

    // Add friend
    wrap.querySelector(`#fr-add-btn-${iid}`).addEventListener('click', () => {
      const inp = wrap.querySelector(`#fr-add-inp-${iid}`);
      const name = inp.value.trim();
      if (!name) return;
      if (friends.find(f => f.toLowerCase() === name.toLowerCase())) {
        if (typeof OS !== 'undefined') OS.notify('👥', 'Friends', `${name} is already your friend!`);
        return;
      }
      friends.push(name);
      saveFriends(friends);
      inp.value = '';
      renderFriends();
      if (typeof OS !== 'undefined') OS.notify('👥', 'Friends', `Added ${name} as a friend!`);
    });

    wrap.querySelector(`#fr-add-inp-${iid}`).addEventListener('keydown', e => {
      if (e.key === 'Enter') wrap.querySelector(`#fr-add-btn-${iid}`).click();
    });

    renderFriends();

    // Listen for online updates
    let unsubOnline = null;
    if (typeof Network !== 'undefined') {
      const onOnline = (users) => {
        const names = users.map(u => u.username);
        const prevNames = onlineUsers.map(u => u.username);
        names.forEach(name => {
          if (!prevNames.includes(name) && friends.find(f => f.toLowerCase() === name.toLowerCase())) {
            if (typeof OS !== 'undefined') OS.notify('👥', 'Friends', `${name} just came online!`);
          }
        });
        onlineUsers = users;
        renderFriends();
      };
      Network.on('online:update', onOnline);
      unsubOnline = () => Network.off('online:update', onOnline);
    }

    // Cleanup on window close
    const observer = new MutationObserver(() => {
      if (!document.body.contains(wrap)) {
        if (unsubOnline) unsubOnline();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Styles
    if (!document.getElementById('friends-styles')) {
      const s = document.createElement('style');
      s.id = 'friends-styles';
      s.textContent = `
        .friends-wrap { height:100%; display:flex; flex-direction:column; background:var(--bg1); overflow:hidden; }
        .friends-layout { display:flex; flex-direction:column; height:100%; }
        .friends-header { padding:14px; background:var(--bg2); border-bottom:1px solid var(--border); }
        .friends-add-row { display:flex; gap:8px; margin-top:10px; }
        .friends-add-input { flex:1; background:var(--bg1); border:1px solid var(--border); border-radius:5px; color:var(--text1); font-size:0.8rem; padding:6px 10px; }
        .friends-add-btn { background:var(--accent); color:#fff; border:none; border-radius:5px; padding:6px 14px; font-size:0.78rem; cursor:pointer; font-weight:600; }
        .friends-add-btn:hover { opacity:0.85; }
        .friends-sections { flex:1; overflow-y:auto; padding:12px; }
        .friends-section-label { font-size:0.65rem; font-weight:bold; color:var(--text3); letter-spacing:0.08em; margin-bottom:6px; }
        .friends-list { display:flex; flex-direction:column; gap:4px; min-height:24px; }
        .friends-item { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:6px; background:var(--bg2); border:1px solid var(--border); }
        .friends-item.online { border-color: rgba(74,222,128,0.3); }
        .friends-dot { font-size:0.6rem; }
        .friends-name { font-size:0.8rem; color:var(--text1); flex:1; }
        .friends-online-badge { font-size:0.6rem; color:#4ade80; font-weight:bold; }
        .friends-offline-badge { font-size:0.6rem; color:var(--text3); }
        .friends-remove { font-size:0.65rem; color:var(--text3); cursor:pointer; padding:2px 5px; border-radius:3px; }
        .friends-remove:hover { background:var(--red); color:#fff; }
        .friends-empty { font-size:0.75rem; color:var(--text3); padding:10px; font-style:italic; }
      `;
      document.head.appendChild(s);
    }

    return wrap;
  }
};