/**
 * NormOS — apps/normtok.js v4.1
 * NormTok: social feed with text posts + media upload (video/audio)
 * Media is shared with other online players via WebSocket broadcast.
 */

const NormTokApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'normtok-wrap';
    const iid = Math.random().toString(36).slice(2, 6);

    const STORAGE_KEY = 'normos_normtok_posts';
    const loadPosts = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
    const savePosts = (p) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p.slice(0, 200).map(post => ({...post, mediaData: post.mediaData?.length > 500000 ? null : post.mediaData})))); } catch {} };

    const SAMPLE_POSTS = [
      { id: 's1', author: 'daemon.norm', avatar: '😈', text: 'I have been watching the market. VOID is not going to zero. VOID is going somewhere far worse.', likes: 1337, tips: 666, ts: Date.now() - 3600000, mediaType: null },
      { id: 's2', author: 'NormTrader99', avatar: '📈', text: 'Just sold my entire NormCoin stack at peak. Feeling great. No regrets. Please validate me.', likes: 42, tips: 5, ts: Date.now() - 7200000, mediaType: null },
      { id: 's3', author: 'kernel_karen', avatar: '💻', text: "Hot take: Isaac's Tacos ($ITACO) is the most volatile stock and I love it.", likes: 88, tips: 12, ts: Date.now() - 1800000, mediaType: null },
    ];

    let posts = loadPosts();
    if (posts.length === 0) { posts = [...SAMPLE_POSTS]; savePosts(posts); }

    let pendingMedia = null; // { type:'video'|'audio', dataUrl, name }
    let activeTab = 'feed';

    const myName   = () => (typeof OS !== 'undefined' && OS.state) ? OS.state.username : 'Norm';
    const myAvatar = () => { try { return localStorage.getItem('normos_profile_avatar') || '🧑'; } catch { return '🧑'; } };
    const escHtml  = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const timeAgo  = (ts) => {
      const d = Date.now() - ts;
      if (d < 60000) return 'just now';
      if (d < 3600000) return Math.floor(d/60000) + 'm ago';
      if (d < 86400000) return Math.floor(d/3600000) + 'h ago';
      return Math.floor(d/86400000) + 'd ago';
    };

    wrap.innerHTML = `
      <div class="normtok-layout">
        <div class="normtok-sidebar">
          <div class="normtok-logo">📱 NormTok</div>
          <div class="normtok-nav-item ${activeTab==='feed'?'active':''}" data-tab="feed">🏠 For You</div>
          <div class="normtok-nav-item ${activeTab==='trending'?'active':''}" data-tab="trending">🔥 Trending</div>
          <div class="normtok-nav-item ${activeTab==='media'?'active':''}" data-tab="media">🎬 Media</div>
          <div style="margin-top:auto;padding:12px 0;">
            <div class="normtok-post-btn" id="ntok-post-btn-${iid}">+ Post</div>
          </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
          <div class="normtok-feed" id="ntok-feed-${iid}"></div>
          <div class="normtok-composer" id="ntok-composer-${iid}" style="display:none;">
            <div class="ntok-composer-header">🎬 New Post</div>
            <textarea class="ntok-compose-area" id="ntok-textarea-${iid}" placeholder="Share your thoughts... (optional if uploading media)" maxlength="280"></textarea>
            <div id="ntok-media-preview-${iid}" style="margin:6px 0;display:none;"></div>
            <div style="display:flex;gap:6px;margin:8px 0;flex-wrap:wrap;">
              <label style="padding:5px 10px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-size:0.72rem;color:var(--text2);">
                🎵 Upload Audio <input type="file" id="ntok-audio-${iid}" accept="audio/*" style="display:none">
              </label>
              <label style="padding:5px 10px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;cursor:pointer;font-size:0.72rem;color:var(--text2);">
                🎬 Upload Video <input type="file" id="ntok-video-${iid}" accept="video/*" style="display:none">
              </label>
              <span id="ntok-media-name-${iid}" style="font-size:0.68rem;color:#4ade80;align-self:center;"></span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span class="ntok-charcount" id="ntok-chars-${iid}">0/280</span>
              <div style="display:flex;gap:8px;">
                <button class="ntok-cancel-btn" id="ntok-cancel-${iid}">Cancel</button>
                <button class="ntok-submit-btn" id="ntok-submit-${iid}">📤 Post</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const feedEl   = wrap.querySelector(`#ntok-feed-${iid}`);
    const composer = wrap.querySelector(`#ntok-composer-${iid}`);
    const textarea = wrap.querySelector(`#ntok-textarea-${iid}`);

    const renderMedia = (post) => {
      if (!post.mediaData || !post.mediaType) return '';
      if (post.mediaType === 'audio') {
        return `<audio controls style="width:100%;margin:8px 0;border-radius:6px;" src="${post.mediaData}"></audio>`;
      }
      if (post.mediaType === 'video') {
        return `<video controls style="width:100%;max-height:240px;border-radius:6px;margin:8px 0;background:#000;" src="${post.mediaData}"></video>`;
      }
      return '';
    };

    const renderFeed = (filterFn = null) => {
      const shown = filterFn ? posts.filter(filterFn) : posts;
      if (!shown.length) {
        feedEl.innerHTML = '<div class="normtok-empty">No posts yet. Be the first!</div>';
        return;
      }
      feedEl.innerHTML = shown.map((p, i) => `
        <div class="normtok-post" data-id="${escHtml(p.id)}">
          <div class="ntok-post-header">
            <span class="ntok-avatar">${escHtml(p.avatar || '🧑')}</span>
            <div>
              <span class="ntok-author">${escHtml(p.author)}</span>
              <span class="ntok-ts">${timeAgo(p.ts)}</span>
              ${p.mediaType ? `<span style="font-size:0.6rem;color:var(--accent);margin-left:4px;">${p.mediaType==='audio'?'🎵 Audio':'🎬 Video'}</span>` : ''}
            </div>
          </div>
          ${p.text ? `<div class="ntok-post-text">${escHtml(p.text)}</div>` : ''}
          ${renderMedia(p)}
          <div class="ntok-post-actions">
            <button class="ntok-action-btn ntok-like" data-id="${escHtml(p.id)}">❤️ <span>${p.likes}</span></button>
            <button class="ntok-action-btn ntok-tip" data-id="${escHtml(p.id)}">💸 Tip <span>$${(p.tips||0).toFixed(2)}</span></button>
            <span class="ntok-share-btn" data-id="${escHtml(p.id)}">↗️</span>
          </div>
        </div>
      `).join('');

      feedEl.querySelectorAll('.ntok-like').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = posts.find(x => x.id === btn.dataset.id); if (!p) return;
          p.likes++; savePosts(posts); renderFeed(filterFn);
        });
      });
      feedEl.querySelectorAll('.ntok-tip').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = posts.find(x => x.id === btn.dataset.id); if (!p) return;
          if (typeof Economy !== 'undefined') {
            if (Economy.state.balance < 1) { if (typeof OS !== 'undefined') OS.notify('💸','NormTok','Not enough funds!'); return; }
            Economy.state.balance -= 1; Economy.save(); Economy.updateWalletDisplay();
          }
          p.tips = (p.tips||0) + 1; savePosts(posts); renderFeed(filterFn);
          if (typeof OS !== 'undefined') OS.notify('💸','NormTok',`Tipped $1 to ${p.author}`);
        });
      });
    };

    // Tab switching
    wrap.querySelectorAll('.normtok-nav-item').forEach(el => {
      el.addEventListener('click', () => {
        activeTab = el.dataset.tab;
        wrap.querySelectorAll('.normtok-nav-item').forEach(e => e.classList.toggle('active', e.dataset.tab === activeTab));
        if (activeTab === 'feed')     renderFeed();
        if (activeTab === 'trending') renderFeed(p => p.likes > 10 || p.tips > 5);
        if (activeTab === 'media')    renderFeed(p => p.mediaType === 'audio' || p.mediaType === 'video');
      });
    });

    // Composer toggle
    wrap.querySelector(`#ntok-post-btn-${iid}`).addEventListener('click', () => {
      composer.style.display = composer.style.display === 'none' ? 'block' : 'none';
    });
    textarea.addEventListener('input', () => {
      wrap.querySelector(`#ntok-chars-${iid}`).textContent = `${textarea.value.length}/280`;
    });
    wrap.querySelector(`#ntok-cancel-${iid}`).addEventListener('click', () => {
      textarea.value = ''; pendingMedia = null;
      wrap.querySelector(`#ntok-media-name-${iid}`).textContent = '';
      wrap.querySelector(`#ntok-media-preview-${iid}`).style.display = 'none';
      composer.style.display = 'none';
    });

    // Media file handlers
    const handleMedia = (file, type) => {
      if (!file) return;
      const MAX_MB = 25;
      if (file.size > MAX_MB * 1024 * 1024) {
        if (typeof OS !== 'undefined') OS.notify('⚠️','NormTok',`File too large (max ${MAX_MB}MB)`);
        return;
      }
      wrap.querySelector(`#ntok-media-name-${iid}`).textContent = `Loading ${file.name}...`;
      const reader = new FileReader();
      reader.onload = (e) => {
        pendingMedia = { type, dataUrl: e.target.result, name: file.name };
        wrap.querySelector(`#ntok-media-name-${iid}`).textContent = `✅ ${file.name}`;
        const preview = wrap.querySelector(`#ntok-media-preview-${iid}`);
        preview.style.display = 'block';
        if (type === 'audio') {
          preview.innerHTML = `<audio controls style="width:100%;border-radius:6px;" src="${e.target.result}"></audio>`;
        } else {
          preview.innerHTML = `<video controls style="width:100%;max-height:180px;border-radius:6px;" src="${e.target.result}"></video>`;
        }
      };
      reader.readAsDataURL(file);
    };
    wrap.querySelector(`#ntok-audio-${iid}`).addEventListener('change', e => handleMedia(e.target.files[0], 'audio'));
    wrap.querySelector(`#ntok-video-${iid}`).addEventListener('change', e => handleMedia(e.target.files[0], 'video'));

    // Submit post
    wrap.querySelector(`#ntok-submit-${iid}`).addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text && !pendingMedia) { if (typeof OS !== 'undefined') OS.notify('📱','NormTok','Add text or media to post!'); return; }

      const newPost = {
        id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
        author: myName(), avatar: myAvatar(),
        text: text || '',
        likes: 0, tips: 0, ts: Date.now(),
        mediaType: pendingMedia?.type || null,
        mediaData: pendingMedia?.dataUrl || null,
      };

      posts.unshift(newPost);
      savePosts(posts);

      // Broadcast to other players (without giant media data for text posts, with media for small files)
      if (typeof Network !== 'undefined' && Network.isConnected()) {
        const broadcastPost = {...newPost};
        // Only broadcast media data if under 2MB to avoid flooding WebSocket
        if (broadcastPost.mediaData && broadcastPost.mediaData.length > 2*1024*1024) {
          broadcastPost.mediaData = null; // others won't have the media but will see the post
          broadcastPost.mediaNote = `🔒 Media available for ${myName()} only (file too large to share)`;
        }
        Network.send({ type: 'normtok:post', post: broadcastPost });
        Network.send({ type: 'chat:message', channel: '#general',
          text: `📱 ${myName()} posted on NormTok${newPost.mediaType ? ` [${newPost.mediaType}]` : ''}: "${text.slice(0,60)}${text.length>60?'...':''}"` });
      }

      textarea.value = ''; pendingMedia = null;
      wrap.querySelector(`#ntok-media-name-${iid}`).textContent = '';
      wrap.querySelector(`#ntok-media-preview-${iid}`).style.display = 'none';
      wrap.querySelector(`#ntok-audio-${iid}`).value = '';
      wrap.querySelector(`#ntok-video-${iid}`).value = '';
      composer.style.display = 'none';
      renderFeed();
      if (typeof OS !== 'undefined') OS.notify('📱','NormTok','Posted!');
    });

    // Listen for posts from other players
    if (typeof Network !== 'undefined') {
      const onPost = (data) => {
        if (!data.post) return;
        if (posts.some(p => p.id === data.post.id)) return; // dedup
        posts.unshift(data.post);
        savePosts(posts);
        if (typeof OS !== 'undefined') OS.notify('📱','NormTok',`${data.post.author} posted${data.post.mediaType?' ['+data.post.mediaType+']':''}: ${(data.post.text||'').slice(0,40)}`);
        renderFeed();
      };
      Network.on('normtok:post', onPost);
      wrap._ntokCleanup = () => Network.off('normtok:post', onPost);
    }

    renderFeed();

    if (!document.getElementById('normtok-styles')) {
      const s = document.createElement('style');
      s.id = 'normtok-styles';
      s.textContent = `
        .normtok-wrap{height:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--bg1);}
        .normtok-layout{display:flex;height:100%;overflow:hidden;}
        .normtok-sidebar{width:140px;min-width:140px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:12px 0;}
        .normtok-logo{font-size:1rem;font-weight:bold;padding:8px 14px 16px;color:var(--text1);}
        .normtok-nav-item{padding:8px 14px;font-size:0.75rem;color:var(--text2);cursor:pointer;border-radius:4px;margin:1px 6px;}
        .normtok-nav-item:hover,.normtok-nav-item.active{background:var(--bg3);color:var(--text1);}
        .normtok-post-btn{background:var(--accent);color:#fff;text-align:center;padding:8px 10px;border-radius:6px;font-size:0.75rem;cursor:pointer;margin:0 10px;font-weight:600;}
        .normtok-post-btn:hover{opacity:0.85;}
        .normtok-feed{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;}
        .normtok-post{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;}
        .ntok-post-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
        .ntok-avatar{font-size:1.4rem;}
        .ntok-author{font-size:0.8rem;font-weight:600;color:var(--accent);display:block;}
        .ntok-ts{font-size:0.65rem;color:var(--text3);}
        .ntok-post-text{font-size:0.85rem;color:var(--text1);line-height:1.5;margin-bottom:8px;}
        .ntok-post-actions{display:flex;gap:10px;align-items:center;margin-top:8px;}
        .ntok-action-btn{background:var(--bg3);border:1px solid var(--border);border-radius:14px;padding:4px 12px;font-size:0.72rem;cursor:pointer;color:var(--text1);}
        .ntok-action-btn:hover{background:var(--bg1);}
        .ntok-share-btn{font-size:0.72rem;color:var(--text3);cursor:pointer;margin-left:auto;}
        .normtok-composer{padding:14px;background:var(--bg2);border-top:1px solid var(--border);max-height:380px;overflow-y:auto;}
        .ntok-composer-header{font-size:0.8rem;font-weight:bold;margin-bottom:8px;color:var(--text1);}
        .ntok-compose-area{width:100%;height:70px;background:var(--bg1);border:1px solid var(--border);border-radius:6px;color:var(--text1);font-size:0.8rem;padding:8px;resize:none;box-sizing:border-box;}
        .ntok-charcount{font-size:0.65rem;color:var(--text3);}
        .ntok-cancel-btn,.ntok-submit-btn{padding:5px 12px;border-radius:5px;font-size:0.75rem;cursor:pointer;border:1px solid var(--border);}
        .ntok-cancel-btn{background:var(--bg1);color:var(--text2);}
        .ntok-submit-btn{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:600;}
        .normtok-loading,.normtok-empty{text-align:center;color:var(--text3);padding:40px;font-size:0.85rem;}
      `;
      document.head.appendChild(s);
    }
    return wrap;
  }
};
