/**
 * NormOS — apps/normtok.js
 * NormTok: text "video" social feed with likes and tips
 */

const NormTokApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'normtok-wrap';
    const iid = Math.random().toString(36).slice(2, 6);

    // Local post storage
    const STORAGE_KEY = 'normos_normtok_posts';
    const loadPosts = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
    const savePosts = (p) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p.slice(0, 200))); } catch {} };

    const SAMPLE_POSTS = [
      { id: 's1', author: 'daemon.norm', avatar: '😈', text: 'I have been watching the market. VOID is not going to zero. VOID is going somewhere far worse.', likes: 1337, tips: 666, ts: Date.now() - 3600000 },
      { id: 's2', author: 'NormTrader99', avatar: '📈', text: 'Just sold my entire NormCoin stack at peak. Feeling great. No regrets. Please validate me.', likes: 42, tips: 5, ts: Date.now() - 7200000 },
      { id: 's3', author: 'kernel_karen', avatar: '💻', text: 'Hot take: KernelCash is undervalued and everyone sleeping on it is going to feel very normal about this later.', likes: 88, tips: 12, ts: Date.now() - 1800000 },
    ];

    let posts = loadPosts();
    if (posts.length === 0) { posts = [...SAMPLE_POSTS]; savePosts(posts); }

    const myName = () => (typeof OS !== 'undefined' && OS.state) ? OS.state.username : 'Norm';
    const myAvatar = () => { try { return localStorage.getItem('normos_profile_avatar') || '🧑'; } catch { return '🧑'; } };

    wrap.innerHTML = `
      <div class="normtok-layout">
        <div class="normtok-sidebar">
          <div class="normtok-logo">📱 NormTok</div>
          <div class="normtok-nav-item active" data-tab="feed">🏠 For You</div>
          <div class="normtok-nav-item" data-tab="following">👥 Following</div>
          <div class="normtok-nav-item" data-tab="trending">🔥 Trending</div>
          <div style="margin-top:auto;padding:12px 0;">
            <div class="normtok-post-btn" id="ntok-post-btn-${iid}">+ Post Video</div>
          </div>
        </div>
        <div class="normtok-feed" id="ntok-feed-${iid}">
          <div class="normtok-loading">Loading feed...</div>
        </div>
        <div class="normtok-composer" id="ntok-composer-${iid}" style="display:none;">
          <div class="ntok-composer-header">🎬 New Text Video</div>
          <div style="font-size:0.7rem;color:var(--text3);margin-bottom:8px;">1–3 sentences. Make it iconic.</div>
          <textarea class="ntok-compose-area" id="ntok-textarea-${iid}" placeholder="Share your thoughts with NormTok..." maxlength="280"></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
            <span class="ntok-charcount" id="ntok-chars-${iid}">0/280</span>
            <div style="display:flex;gap:8px;">
              <button class="ntok-cancel-btn" id="ntok-cancel-${iid}">Cancel</button>
              <button class="ntok-submit-btn" id="ntok-submit-${iid}">📤 Post</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const feedEl   = wrap.querySelector(`#ntok-feed-${iid}`);
    const composer = wrap.querySelector(`#ntok-composer-${iid}`);
    const textarea = wrap.querySelector(`#ntok-textarea-${iid}`);
    const charCount = wrap.querySelector(`#ntok-chars-${iid}`);

    const timeAgo = (ts) => {
      const d = Date.now() - ts;
      if (d < 60000) return 'just now';
      if (d < 3600000) return Math.floor(d/60000) + 'm ago';
      if (d < 86400000) return Math.floor(d/3600000) + 'h ago';
      return Math.floor(d/86400000) + 'd ago';
    };

    const escHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const renderFeed = () => {
      if (!posts.length) {
        feedEl.innerHTML = '<div class="normtok-empty">No posts yet. Be the first!</div>';
        return;
      }
      feedEl.innerHTML = posts.map((p, i) => `
        <div class="normtok-post" data-idx="${i}">
          <div class="ntok-post-header">
            <span class="ntok-avatar">${escHtml(p.avatar || '🧑')}</span>
            <div>
              <span class="ntok-author">${escHtml(p.author)}</span>
              <span class="ntok-ts">${timeAgo(p.ts)}</span>
            </div>
          </div>
          <div class="ntok-post-text">${escHtml(p.text)}</div>
          <div class="ntok-post-actions">
            <button class="ntok-action-btn ntok-like" data-idx="${i}">
              ❤️ <span>${p.likes}</span>
            </button>
            <button class="ntok-action-btn ntok-tip" data-idx="${i}">
              💸 Tip <span>$${(p.tips || 0).toFixed(2)}</span>
            </button>
            <span class="ntok-share-btn" data-idx="${i}">↗️ Share</span>
          </div>
        </div>
      `).join('');

      wrap.querySelectorAll('.ntok-like').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = +btn.dataset.idx;
          posts[idx].likes++;
          savePosts(posts);
          renderFeed();
        });
      });

      wrap.querySelectorAll('.ntok-tip').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = +btn.dataset.idx;
          const tipAmt = 1.00;
          if (typeof Economy !== 'undefined') {
            if (Economy.state.balance < tipAmt) {
              if (typeof OS !== 'undefined') OS.notify('💸', 'NormTok', 'Insufficient funds to tip!');
              return;
            }
            Economy.state.balance -= tipAmt;
            Economy.save();
            Economy.updateWalletDisplay();
          }
          posts[idx].tips = (posts[idx].tips || 0) + tipAmt;
          savePosts(posts);
          renderFeed();
          if (typeof OS !== 'undefined') OS.notify('💸', 'NormTok', `Tipped $${tipAmt.toFixed(2)} to ${posts[idx].author}`);
        });
      });
    };

    // Composer
    wrap.querySelector(`#ntok-post-btn-${iid}`).addEventListener('click', () => {
      composer.style.display = composer.style.display === 'none' ? 'block' : 'none';
    });

    textarea.addEventListener('input', () => {
      charCount.textContent = `${textarea.value.length}/280`;
    });

    wrap.querySelector(`#ntok-cancel-${iid}`).addEventListener('click', () => {
      textarea.value = ''; composer.style.display = 'none';
    });

    wrap.querySelector(`#ntok-submit-${iid}`).addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) return;
      const newPost = {
        id: 'u_' + Date.now(),
        author: myName(),
        avatar: myAvatar(),
        text,
        likes: 0,
        tips: 0,
        ts: Date.now(),
      };
      posts.unshift(newPost);
      savePosts(posts);
      textarea.value = '';
      composer.style.display = 'none';
      renderFeed();
      if (typeof OS !== 'undefined') OS.notify('📱', 'NormTok', 'Your video was posted!');
      if (typeof Network !== 'undefined') {
        Network.send({ type: 'chat:message', channel: '#normtok', text: `NTOK:${JSON.stringify(newPost)}` });
      }
    });

    renderFeed();

    // ── Network sync ──────────────────────────────────────────────────
    if (typeof Network !== 'undefined') {
      const parseNtokMsg = (msg) => {
        try {
          if (msg.text && msg.text.startsWith('NTOK:')) return JSON.parse(msg.text.slice(5));
        } catch {}
        return null;
      };
      const onChatMsg = (data) => {
        if (data.channel !== '#normtok') return;
        const p = parseNtokMsg(data.message || {});
        if (!p || posts.find(x => x.id === p.id)) return;
        posts.unshift(p);
        savePosts(posts);
        renderFeed();
      };
      const onChatHistory = (data) => {
        if (data.channel !== '#normtok') return;
        let changed = false;
        (data.messages || []).forEach(msg => {
          const p = parseNtokMsg(msg);
          if (p && !posts.find(x => x.id === p.id)) { posts.push(p); changed = true; }
        });
        if (changed) { posts.sort((a, b) => b.ts - a.ts); savePosts(posts); renderFeed(); }
      };
      Network.on('chat:message', onChatMsg);
      Network.on('chat:history', onChatHistory);
      if (Network.isConnected()) Network.joinChannel('#normtok');
    }

    // Style injection
    if (!document.getElementById('normtok-styles')) {
      const s = document.createElement('style');
      s.id = 'normtok-styles';
      s.textContent = `
        .normtok-wrap { height:100%; display:flex; flex-direction:column; overflow:hidden; background:var(--bg1); }
        .normtok-layout { display:flex; height:100%; overflow:hidden; }
        .normtok-sidebar { width:140px; min-width:140px; background:var(--bg2); border-right:1px solid var(--border); display:flex; flex-direction:column; padding:12px 0; }
        .normtok-logo { font-size:1rem; font-weight:bold; padding:8px 14px 16px; color:var(--text1); }
        .normtok-nav-item { padding:8px 14px; font-size:0.75rem; color:var(--text2); cursor:pointer; border-radius:4px; margin:1px 6px; }
        .normtok-nav-item:hover,.normtok-nav-item.active { background:var(--bg3); color:var(--text1); }
        .normtok-post-btn { background:var(--accent); color:#fff; text-align:center; padding:8px 10px; border-radius:6px; font-size:0.75rem; cursor:pointer; margin:0 10px; font-weight:600; }
        .normtok-post-btn:hover { opacity:0.85; }
        .normtok-feed { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:10px; }
        .normtok-post { background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:14px; }
        .ntok-post-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
        .ntok-avatar { font-size:1.4rem; }
        .ntok-author { font-size:0.8rem; font-weight:600; color:var(--accent); display:block; }
        .ntok-ts { font-size:0.65rem; color:var(--text3); }
        .ntok-post-text { font-size:0.85rem; color:var(--text1); line-height:1.5; margin-bottom:12px; }
        .ntok-post-actions { display:flex; gap:10px; align-items:center; }
        .ntok-action-btn { background:var(--bg3); border:1px solid var(--border); border-radius:14px; padding:4px 12px; font-size:0.72rem; cursor:pointer; color:var(--text1); transition:background 0.15s; }
        .ntok-action-btn:hover { background:var(--bg1); }
        .ntok-share-btn { font-size:0.72rem; color:var(--text3); cursor:pointer; margin-left:auto; }
        .ntok-share-btn:hover { color:var(--text1); }
        .normtok-composer { padding:14px; background:var(--bg2); border-top:1px solid var(--border); }
        .ntok-composer-header { font-size:0.8rem; font-weight:bold; margin-bottom:6px; color:var(--text1); }
        .ntok-compose-area { width:100%; height:80px; background:var(--bg1); border:1px solid var(--border); border-radius:6px; color:var(--text1); font-size:0.8rem; padding:8px; resize:none; box-sizing:border-box; }
        .ntok-charcount { font-size:0.65rem; color:var(--text3); }
        .ntok-cancel-btn,.ntok-submit-btn { padding:5px 12px; border-radius:5px; font-size:0.75rem; cursor:pointer; border:1px solid var(--border); }
        .ntok-cancel-btn { background:var(--bg1); color:var(--text2); }
        .ntok-submit-btn { background:var(--accent); color:#fff; border-color:var(--accent); font-weight:600; }
        .normtok-loading,.normtok-empty { text-align:center; color:var(--text3); padding:40px; font-size:0.85rem; }
      `;
      document.head.appendChild(s);
    }

    return wrap;
  }
};
