/**
 * NormOS — apps/normarket.js
 * NorMarket: player-to-player marketplace. Sell text, stories, music, video.
 * Supports paywalls, free posts, and bounties (pay for requested work).
 */

const NorMarketApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'nm-wrap';
    const iid = Math.random().toString(36).slice(2, 6);

    let listings = [];
    let view = 'browse'; // 'browse' | 'sell' | 'mine' | 'bounties'
    let filterType = 'all';
    let bountyInbox = []; // bounty submissions received

    const myName  = () => (typeof OS !== 'undefined' && OS.state) ? OS.state.username : 'Norm';
    const myBal   = () => (typeof Economy !== 'undefined') ? Economy.state.balance : 0;
    const fmt     = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
    const esc     = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const relTime = (iso) => {
      const d = Date.now() - new Date(iso).getTime();
      if (d < 60000)   return 'just now';
      if (d < 3600000) return Math.floor(d/60000) + 'm ago';
      if (d < 86400000)return Math.floor(d/3600000) + 'h ago';
      return Math.floor(d/86400000) + 'd ago';
    };

    const TYPE_META = {
      text:  { icon:'📝', label:'Story / Text',  color:'#4f9eff' },
      music: { icon:'🎵', label:'Music',          color:'#a78bfa' },
      video: { icon:'🎬', label:'Video',          color:'#f59e0b' },
      image: { icon:'🖼️', label:'Image / Art',    color:'#34d399' },
    };

    const showToast = (msg, color = '#4ade80') => {
      const t = document.createElement('div');
      t.style.cssText = `position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:#1a1d23;border:1px solid ${color};color:${color};padding:0.6rem 1.4rem;border-radius:8px;font-size:0.76rem;z-index:9999;pointer-events:none;font-family:var(--font-mono);box-shadow:0 4px 20px rgba(0,0,0,0.5);white-space:nowrap;`;
      t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
    };

    // ── Render helpers ────────────────────────────────────────────────────────
    const renderCard = (l) => {
      const tm = TYPE_META[l.type] || TYPE_META.text;
      const isFree = l.price === 0 && l.bounty === 0;
      const hasBounty = l.bounty > 0;
      const isLocked = l.price > 0 && !l.hasBought && !l.isMine;

      let previewContent = '';
      if (l.content && !isLocked) {
        if (l.type === 'text') {
          previewContent = `<div class="nm-preview-text">${esc(l.content).slice(0, 300)}${l.content.length > 300 ? '…' : ''}</div>`;
        } else if (l.type === 'music') {
          previewContent = `<div class="nm-preview-media"><div class="nm-music-player" data-src="${esc(l.content)}">
            <div class="nm-music-icon">🎵</div>
            <div class="nm-music-info"><div class="nm-music-title">${esc(l.title)}</div><div class="nm-music-sub">Audio file</div></div>
            <button class="nm-play-btn" data-src="${esc(l.content)}">▶ Play</button>
          </div></div>`;
        } else if (l.type === 'video') {
          // Detect YouTube / embed URL
          const ytMatch = l.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (ytMatch) {
            previewContent = `<div class="nm-preview-media"><iframe style="width:100%;aspect-ratio:16/9;border:none;border-radius:6px;" src="https://www.youtube.com/embed/${ytMatch[1]}" allowfullscreen></iframe></div>`;
          } else {
            previewContent = `<div class="nm-preview-media"><video style="width:100%;max-height:200px;border-radius:6px;" controls src="${esc(l.content)}"></video></div>`;
          }
        } else if (l.type === 'image') {
          previewContent = `<div class="nm-preview-media"><img src="${esc(l.content)}" style="max-width:100%;max-height:240px;border-radius:6px;object-fit:contain;" alt="${esc(l.title)}" onerror="this.style.display='none'" /></div>`;
        }
      } else if (isLocked) {
        previewContent = `<div class="nm-locked-preview"><div class="nm-lock-icon">🔒</div><div>Purchase to unlock ${tm.label.toLowerCase()}</div></div>`;
      }

      const tags = l.tags ? l.tags.split(',').filter(Boolean).map(t => `<span class="nm-tag">${esc(t.trim())}</span>`).join('') : '';

      return `<div class="nm-card" data-id="${l.id}">
        <div class="nm-card-header">
          <div class="nm-card-type" style="color:${tm.color}">${tm.icon} ${tm.label}</div>
          <div class="nm-card-meta">
            ${hasBounty ? `<span class="nm-badge-bounty">💰 $${fmt(l.bounty)} bounty</span>` : ''}
            ${isFree    ? `<span class="nm-badge-free">FREE</span>` : ''}
            ${l.price > 0 ? `<span class="nm-badge-price">$${fmt(l.price)}</span>` : ''}
            ${l.isMine  ? `<span class="nm-badge-mine">YOURS</span>` : ''}
            ${l.hasBought ? `<span class="nm-badge-owned">OWNED</span>` : ''}
          </div>
        </div>
        <div class="nm-card-title">${esc(l.title)}</div>
        ${l.description ? `<div class="nm-card-desc">${esc(l.description)}</div>` : ''}
        ${tags ? `<div class="nm-tags">${tags}</div>` : ''}
        ${previewContent}
        <div class="nm-card-footer">
          <div class="nm-seller">
            <span style="color:${l.sellerColor};font-weight:700">${esc(l.sellerName)}</span>
            <span class="nm-foot-dot">·</span>
            <span>${l.buyerCount} buyer${l.buyerCount !== 1 ? 's' : ''}</span>
            <span class="nm-foot-dot">·</span>
            <span>${relTime(l.createdAt)}</span>
          </div>
          <div class="nm-card-actions">
            ${l.isMine ? `
              <button class="nm-btn nm-btn-red nm-del-btn" data-id="${l.id}">🗑️ Delete</button>
            ` : hasBounty ? `
              <button class="nm-btn nm-btn-bounty nm-bounty-btn" data-id="${l.id}" data-title="${esc(l.title)}" data-bounty="${l.bounty}" data-seller="${esc(l.sellerName)}">💰 Submit for Bounty</button>
            ` : isLocked ? `
              <button class="nm-btn nm-btn-buy nm-buy-btn" data-id="${l.id}" data-price="${l.price}">💳 Buy for $${fmt(l.price)}</button>
            ` : ''}
          </div>
        </div>
      </div>`;
    };

    // ── Sell form ─────────────────────────────────────────────────────────────
    const renderSellForm = () => `
      <div class="nm-sell-wrap">
        <h2 class="nm-sell-title">🏪 Create a Listing</h2>
        <div class="nm-sell-form">
          <div class="nm-form-row">
            <label class="nm-label">Content Type</label>
            <div class="nm-type-picker" id="nm-type-pick-${iid}">
              ${Object.entries(TYPE_META).map(([k,v]) => `
                <div class="nm-type-opt ${k==='text'?'active':''}" data-type="${k}">
                  <span>${v.icon}</span><span>${v.label}</span>
                </div>`).join('')}
            </div>
          </div>
          <div class="nm-form-row">
            <label class="nm-label">Title <span class="nm-req">*</span></label>
            <input id="nm-inp-title-${iid}" class="nm-input" placeholder="Give your listing a title..." maxlength="80" />
          </div>
          <div class="nm-form-row">
            <label class="nm-label">Description</label>
            <textarea id="nm-inp-desc-${iid}" class="nm-input nm-textarea" placeholder="Describe what you're selling..." maxlength="500" rows="2"></textarea>
          </div>
          <div class="nm-form-row">
            <label class="nm-label" id="nm-content-label-${iid}">Content <span class="nm-req">*</span></label>
            <textarea id="nm-inp-content-${iid}" class="nm-input nm-textarea nm-content-area" placeholder="Write your story, paste a URL, or enter content..." rows="6"></textarea>
            <div class="nm-content-hint" id="nm-content-hint-${iid}">For music/video: paste a URL (YouTube, direct link, etc). For images: paste an image URL.</div>
          </div>
          <div class="nm-form-row">
            <label class="nm-label">Tags <span class="nm-hint-inline">(comma separated)</span></label>
            <input id="nm-inp-tags-${iid}" class="nm-input" placeholder="e.g. fiction, chill, horror" maxlength="100" />
          </div>
          <div class="nm-price-row">
            <div class="nm-form-half">
              <label class="nm-label">💳 Price ($)</label>
              <input id="nm-inp-price-${iid}" class="nm-input" type="number" min="0" step="0.01" placeholder="0 = free" value="0" />
              <div class="nm-hint-inline" style="font-size:0.6rem;color:var(--text3);margin-top:4px">Buyers pay you directly</div>
            </div>
            <div class="nm-form-half">
              <label class="nm-label">💰 Bounty ($)</label>
              <input id="nm-inp-bounty-${iid}" class="nm-input" type="number" min="0" step="0.01" placeholder="0 = no bounty" value="0" />
              <div class="nm-hint-inline" style="font-size:0.6rem;color:var(--text3);margin-top:4px">Request work, pay on acceptance</div>
            </div>
          </div>
          <div id="nm-sell-msg-${iid}" class="nm-msg"></div>
          <button class="nm-btn nm-btn-primary nm-submit-btn" id="nm-sell-submit-${iid}">🚀 Publish Listing</button>
        </div>
      </div>`;

    // ── Bounty inbox ──────────────────────────────────────────────────────────
    const renderBountyInbox = () => `
      <div class="nm-bounty-inbox">
        <h2 class="nm-sell-title">💰 Bounty Inbox</h2>
        ${bountyInbox.length === 0
          ? `<div class="nm-empty">No bounty submissions yet.<br><span style="font-size:0.7rem;color:var(--text3)">Post a listing with a bounty and others will submit work here.</span></div>`
          : bountyInbox.map((s, i) => `
            <div class="nm-bounty-item" data-idx="${i}">
              <div class="nm-bounty-from">
                <span style="color:${s.fromColor};font-weight:700">${esc(s.fromName)}</span>
                <span class="nm-foot-dot">·</span>
                <span>for "${esc(s.listingTitle)}"</span>
                <span class="nm-badge-bounty" style="margin-left:auto">💰 $${fmt(s.bounty)}</span>
              </div>
              <div class="nm-bounty-submission">${esc(s.submission).slice(0, 600)}</div>
              <div class="nm-bounty-actions">
                <button class="nm-btn nm-btn-primary nm-pay-bounty-btn" data-idx="${i}" data-to="${esc(s.fromName)}" data-amount="${s.bounty}">✅ Accept & Pay $${fmt(s.bounty)}</button>
                <button class="nm-btn nm-btn-red nm-dismiss-btn" data-idx="${i}">❌ Dismiss</button>
              </div>
            </div>`).join('')}
      </div>`;

    // ── Main render ───────────────────────────────────────────────────────────
    const renderMain = () => {
      const main = wrap.querySelector(`#nm-main-${iid}`);
      if (!main) return;

      if (view === 'sell') {
        main.innerHTML = renderSellForm();
        bindSellForm();
        return;
      }
      if (view === 'mine') {
        const mine = listings.filter(l => l.isMine);
        main.innerHTML = mine.length === 0
          ? `<div class="nm-empty">You haven't listed anything yet.<br><button class="nm-btn nm-btn-primary" onclick="this.closest('.nm-wrap')._setView('sell')" style="margin-top:1rem">+ Create Listing</button></div>`
          : `<div class="nm-listings">${mine.map(renderCard).join('')}</div>`;
        bindCardEvents(main);
        return;
      }
      if (view === 'bounties') {
        main.innerHTML = renderBountyInbox();
        bindBountyInbox(main);
        return;
      }

      // Browse
      let filtered = listings;
      if (filterType !== 'all') filtered = listings.filter(l => l.type === filterType);

      main.innerHTML = filtered.length === 0
        ? `<div class="nm-empty">Nothing here yet. Be the first to post!</div>`
        : `<div class="nm-listings">${filtered.map(renderCard).join('')}</div>`;
      bindCardEvents(main);
    };

    const bindCardEvents = (main) => {
      main.querySelectorAll('.nm-buy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const price = parseFloat(btn.dataset.price);
          if (!confirm(`Buy this listing for $${fmt(price)}?`)) return;
          if (myBal() < price) { showToast('Insufficient funds', '#f87171'); return; }
          if (typeof Network !== 'undefined' && Network.isConnected()) {
            Network.send({ type:'market:list:buy', id });
            btn.textContent = '⏳ Purchasing...'; btn.disabled = true;
          } else showToast('Not connected', '#f87171');
        });
      });
      main.querySelectorAll('.nm-del-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!confirm('Delete this listing?')) return;
          if (typeof Network !== 'undefined' && Network.isConnected()) {
            Network.send({ type:'market:list:delete', id: btn.dataset.id });
          }
        });
      });
      main.querySelectorAll('.nm-bounty-btn').forEach(btn => {
        btn.addEventListener('click', () => showBountySubmitModal(btn.dataset.id, btn.dataset.title, btn.dataset.bounty, btn.dataset.seller));
      });
    };

    const bindBountyInbox = (main) => {
      main.querySelectorAll('.nm-pay-bounty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const to = btn.dataset.to;
          const amount = parseFloat(btn.dataset.amount);
          if (!confirm(`Pay $${fmt(amount)} to ${to} for their work?`)) return;
          if (myBal() < amount) { showToast('Insufficient funds', '#f87171'); return; }
          if (typeof Network !== 'undefined' && Network.isConnected()) {
            Network.send({ type:'market:bounty:pay', toUsername: to, amount });
            const idx = parseInt(btn.dataset.idx);
            bountyInbox.splice(idx, 1);
            renderMain();
          }
        });
      });
      main.querySelectorAll('.nm-dismiss-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          bountyInbox.splice(idx, 1);
          renderMain();
        });
      });
    };

    const bindSellForm = () => {
      const main = wrap.querySelector(`#nm-main-${iid}`);
      if (!main) return;
      let selectedType = 'text';

      const HINTS = {
        text:  'Write your story, poem, essay, or any text content directly here.',
        music: 'Paste a direct audio URL (.mp3, .ogg) or a link to your track.',
        video: 'Paste a YouTube URL or direct video link (e.g. youtu.be/... or https://...).',
        image: 'Paste a direct image URL (.jpg, .png, .gif, etc).',
      };

      main.querySelectorAll('.nm-type-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          main.querySelectorAll('.nm-type-opt').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          selectedType = opt.dataset.type;
          const hintEl = main.querySelector(`#nm-content-hint-${iid}`);
          if (hintEl) hintEl.textContent = HINTS[selectedType];
        });
      });

      main.querySelector(`#nm-sell-submit-${iid}`)?.addEventListener('click', () => {
        const title   = main.querySelector(`#nm-inp-title-${iid}`)?.value.trim() || '';
        const desc    = main.querySelector(`#nm-inp-desc-${iid}`)?.value.trim() || '';
        const content = main.querySelector(`#nm-inp-content-${iid}`)?.value.trim() || '';
        const tags    = main.querySelector(`#nm-inp-tags-${iid}`)?.value.trim() || '';
        const price   = Math.max(0, parseFloat(main.querySelector(`#nm-inp-price-${iid}`)?.value) || 0);
        const bounty  = Math.max(0, parseFloat(main.querySelector(`#nm-inp-bounty-${iid}`)?.value) || 0);
        const msgEl   = main.querySelector(`#nm-sell-msg-${iid}`);

        if (title.length < 2) { if(msgEl){msgEl.textContent='Title required (min 2 chars)';msgEl.style.color='#f87171';} return; }
        if (!content && selectedType !== 'text') { if(msgEl){msgEl.textContent='Content/URL required';msgEl.style.color='#f87171';} return; }
        if (!content && selectedType === 'text') { if(msgEl){msgEl.textContent='Write some content!';msgEl.style.color='#f87171';} return; }

        if (typeof Network !== 'undefined' && Network.isConnected()) {
          Network.send({ type:'market:list:create', title, description:desc, contentType:selectedType, content, price, bounty, tags });
          if(msgEl){msgEl.textContent='Publishing...';msgEl.style.color='var(--text3)';}
        } else { if(msgEl){msgEl.textContent='Not connected to server';msgEl.style.color='#f87171';} }
      });
    };

    // ── Bounty submit modal ───────────────────────────────────────────────────
    const showBountySubmitModal = (id, title, bounty, sellerName) => {
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
      ov.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:1.5rem;width:480px;max-width:92vw;">
        <div style="font-size:0.95rem;font-weight:700;color:#f59e0b;margin-bottom:0.5rem">💰 Submit for Bounty</div>
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:1rem">For: <b>${esc(title)}</b> · Posted by ${esc(sellerName)} · $${fmt(bounty)} reward</div>
        <textarea id="nm-bounty-text" style="width:100%;background:var(--bg1);border:1px solid var(--border);color:var(--text1);border-radius:7px;padding:0.6rem;font-size:0.8rem;resize:vertical;min-height:100px;outline:none;font-family:var(--font-mono);box-sizing:border-box;" placeholder="Submit your work, link, or response here..."></textarea>
        <div id="nm-bounty-msg" style="font-size:0.68rem;min-height:1em;margin:.4rem 0;"></div>
        <div style="display:flex;gap:0.6rem;margin-top:0.75rem">
          <button id="nm-bounty-send" style="flex:1;padding:0.55rem;background:#f59e0b;color:#000;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.78rem">Submit</button>
          <button id="nm-bounty-cancel" style="flex:1;padding:0.55rem;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:6px;cursor:pointer;font-size:0.78rem">Cancel</button>
        </div>
      </div>`;
      document.body.appendChild(ov);
      ov.querySelector('#nm-bounty-cancel').onclick = () => ov.remove();
      ov.querySelector('#nm-bounty-send').onclick = () => {
        const submission = ov.querySelector('#nm-bounty-text').value.trim();
        const msgEl = ov.querySelector('#nm-bounty-msg');
        if (!submission) { msgEl.textContent = 'Enter your submission'; msgEl.style.color = '#f87171'; return; }
        if (typeof Network !== 'undefined' && Network.isConnected()) {
          Network.send({ type:'market:bounty:submit', id, submission });
          msgEl.textContent = 'Submitted!'; msgEl.style.color = '#4ade80';
          setTimeout(() => ov.remove(), 1200);
        } else { msgEl.textContent = 'Not connected'; msgEl.style.color = '#f87171'; }
      };
    };

    // ── Shell ─────────────────────────────────────────────────────────────────
    const render = () => {
      wrap.innerHTML = `
        <div class="nm-layout">
          <div class="nm-sidebar">
            <div class="nm-sidebar-top">
              <div class="nm-brand">🏪 NorMarket</div>
              <div class="nm-bal-card">
                <div class="nm-bal-label">Your Balance</div>
                <div class="nm-bal-val" id="nm-bal-${iid}">$${fmt(myBal())}</div>
              </div>
            </div>
            <nav class="nm-nav">
              <div class="nm-nav-item ${view==='browse'?'active':''}" data-view="browse">🔍 Browse</div>
              <div class="nm-nav-item ${view==='sell'?'active':''}" data-view="sell">➕ Sell Something</div>
              <div class="nm-nav-item ${view==='mine'?'active':''}" data-view="mine">📦 My Listings</div>
              <div class="nm-nav-item ${view==='bounties'?'active':''}" data-view="bounties">💰 Bounty Inbox ${bountyInbox.length > 0 ? `<span class="nm-inbox-badge">${bountyInbox.length}</span>` : ''}</div>
            </nav>
            ${view === 'browse' ? `
              <div class="nm-filters">
                <div class="nm-filters-label">Filter by type</div>
                ${[['all','🔀','All'],['text','📝','Stories'],['music','🎵','Music'],['video','🎬','Video'],['image','🖼️','Images']].map(([k,i,l]) =>
                  `<div class="nm-filter-btn ${filterType===k?'active':''}" data-filter="${k}">${i} ${l}</div>`
                ).join('')}
              </div>` : ''}
            <div class="nm-sidebar-stats">
              <div class="nm-stat-row"><span>Listings</span><span>${listings.length}</span></div>
              <div class="nm-stat-row"><span>My Sales</span><span>${listings.filter(l=>l.isMine).reduce((s,l)=>s+l.buyerCount,0)}</span></div>
            </div>
          </div>
          <div class="nm-main" id="nm-main-${iid}"></div>
        </div>`;

      wrap._setView = (v) => { view = v; render(); };

      wrap.querySelectorAll('.nm-nav-item').forEach(item => {
        item.addEventListener('click', () => { view = item.dataset.view; render(); });
      });
      wrap.querySelectorAll('.nm-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => { filterType = btn.dataset.filter; render(); });
      });

      renderMain();
    };

    // ── Network ───────────────────────────────────────────────────────────────
    const onListData = (msg) => {
      listings = msg.listings || [];
      const balEl = wrap.querySelector(`#nm-bal-${iid}`);
      if (balEl) balEl.textContent = '$' + fmt(myBal());
      renderMain();
    };
    const onListNew = (msg) => {
      if (msg.listing) { listings.unshift(msg.listing); renderMain(); }
    };
    const onListCreated = () => {
      showToast('✅ Listing published!', '#4ade80');
      view = 'browse';
      if (typeof Network !== 'undefined' && Network.isConnected()) Network.send({ type:'market:list:get' });
      render();
    };
    const onListBought = (msg) => {
      const l = listings.find(x => x.id === msg.id);
      if (l) { l.hasBought = true; l.content = msg.content; l.buyerCount = (l.buyerCount||0) + 1; }
      const balEl = wrap.querySelector(`#nm-bal-${iid}`);
      if (balEl) balEl.textContent = '$' + fmt(myBal());
      renderMain();
      showToast('✅ Purchased!', '#4ade80');
    };
    const onListDeleted = (msg) => {
      listings = listings.filter(l => l.id !== msg.id);
      renderMain();
      showToast('Listing deleted', '#f87171');
    };
    const onListRemoved = (msg) => {
      listings = listings.filter(l => l.id !== msg.id);
      renderMain();
    };
    const onBountyReceived = (msg) => {
      bountyInbox.unshift(msg);
      // Update badge in nav if sidebar is visible
      const badge = wrap.querySelector('.nm-inbox-badge');
      if (badge) badge.textContent = bountyInbox.length;
      else render();
    };
    const onBountySubmitted = (msg) => {
      showToast(msg.message || 'Submitted!', '#f59e0b');
    };
    const onBountyPayOk = (msg) => {
      showToast(`Paid $${fmt(msg.amount)} to ${msg.toName}`, '#4ade80');
      const balEl = wrap.querySelector(`#nm-bal-${iid}`);
      if (balEl) balEl.textContent = '$' + fmt(myBal());
    };
    const onError = (msg) => {
      showToast(msg.message || 'Error', '#f87171');
    };

    if (typeof Network !== 'undefined') {
      Network.on('market:list:data',     onListData);
      Network.on('market:list:new',      onListNew);
      Network.on('market:list:created',  onListCreated);
      Network.on('market:list:bought',   onListBought);
      Network.on('market:list:deleted',  onListDeleted);
      Network.on('market:list:removed',  onListRemoved);
      Network.on('market:bounty:received', onBountyReceived);
      Network.on('market:bounty:submitted', onBountySubmitted);
      Network.on('market:bounty:pay:ok', onBountyPayOk);
      Network.on('market:error',         onError);

      Network.send({ type:'market:list:get' });
    }

    wrap._cleanup = () => {
      if (typeof Network === 'undefined') return;
      Network.off('market:list:data',     onListData);
      Network.off('market:list:new',      onListNew);
      Network.off('market:list:created',  onListCreated);
      Network.off('market:list:bought',   onListBought);
      Network.off('market:list:deleted',  onListDeleted);
      Network.off('market:list:removed',  onListRemoved);
      Network.off('market:bounty:received', onBountyReceived);
      Network.off('market:bounty:submitted', onBountySubmitted);
      Network.off('market:bounty:pay:ok', onBountyPayOk);
      Network.off('market:error',         onError);
    };

    EventBus.on('window:closed', ({ appId }) => {
      if (appId === 'normarket' && wrap._cleanup) wrap._cleanup();
    });

    // ── Inject styles ─────────────────────────────────────────────────────────
    if (!document.getElementById('nm-styles')) {
      const st = document.createElement('style'); st.id = 'nm-styles';
      st.textContent = `
        .nm-wrap{height:100%;overflow:hidden;background:var(--bg1);font-family:var(--font-mono)}
        .nm-layout{display:flex;height:100%;overflow:hidden}
        .nm-sidebar{width:220px;flex-shrink:0;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
        .nm-sidebar-top{padding:.85rem 1rem .5rem}
        .nm-brand{font-size:.9rem;font-weight:800;color:var(--text1);margin-bottom:.65rem}
        .nm-bal-card{background:var(--bg1);border:1px solid var(--border);border-radius:8px;padding:.6rem .85rem;margin-bottom:.5rem}
        .nm-bal-label{font-size:.59rem;color:var(--text3);margin-bottom:2px}
        .nm-bal-val{font-size:1.2rem;font-weight:700;color:#4ade80;font-family:var(--font-mono)}
        .nm-nav{padding:.3rem .5rem;display:flex;flex-direction:column;gap:.18rem}
        .nm-nav-item{display:flex;align-items:center;gap:.45rem;padding:.55rem .7rem;border-radius:6px;cursor:pointer;font-size:.74rem;color:var(--text2);border:1px solid transparent;transition:background .12s;position:relative}
        .nm-nav-item:hover{background:var(--bg3);color:var(--text1)}
        .nm-nav-item.active{background:var(--bg3);color:var(--text1);border-color:rgba(79,158,255,.25)}
        .nm-inbox-badge{background:#f59e0b;color:#000;font-size:.52rem;padding:.08rem .3rem;border-radius:10px;font-weight:700;margin-left:auto}
        .nm-filters{padding:.5rem .7rem;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:.15rem}
        .nm-filters-label{font-size:.58rem;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem}
        .nm-filter-btn{font-size:.68rem;padding:.3rem .55rem;border-radius:5px;cursor:pointer;color:var(--text3);transition:background .1s,color .1s}
        .nm-filter-btn:hover{background:var(--bg3);color:var(--text1)}
        .nm-filter-btn.active{background:var(--bg3);color:var(--accent)}
        .nm-sidebar-stats{margin-top:auto;padding:.6rem 1rem;border-top:1px solid var(--border)}
        .nm-stat-row{display:flex;justify-content:space-between;font-size:.62rem;color:var(--text3);padding:.1rem 0}
        .nm-main{flex:1;overflow-y:auto;min-width:0;padding:1rem}
        .nm-listings{display:flex;flex-direction:column;gap:.85rem;max-width:700px;margin:0 auto}
        .nm-card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:1rem;display:flex;flex-direction:column;gap:.55rem;transition:border-color .15s}
        .nm-card:hover{border-color:rgba(79,158,255,.3)}
        .nm-card-header{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
        .nm-card-type{font-size:.68rem;font-weight:700}
        .nm-card-meta{display:flex;gap:.35rem;align-items:center;flex-wrap:wrap}
        .nm-badge-price{background:rgba(79,158,255,.15);color:#4f9eff;border:1px solid rgba(79,158,255,.3);font-size:.62rem;padding:.12rem .42rem;border-radius:4px;font-weight:700}
        .nm-badge-free{background:rgba(74,222,128,.15);color:#4ade80;border:1px solid rgba(74,222,128,.3);font-size:.62rem;padding:.12rem .42rem;border-radius:4px;font-weight:700}
        .nm-badge-bounty{background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);font-size:.62rem;padding:.12rem .42rem;border-radius:4px;font-weight:700}
        .nm-badge-mine{background:rgba(192,132,252,.15);color:#c084fc;border:1px solid rgba(192,132,252,.3);font-size:.62rem;padding:.12rem .42rem;border-radius:4px;font-weight:700}
        .nm-badge-owned{background:rgba(52,211,153,.15);color:#34d399;border:1px solid rgba(52,211,153,.3);font-size:.62rem;padding:.12rem .42rem;border-radius:4px;font-weight:700}
        .nm-card-title{font-size:.92rem;font-weight:700;color:var(--text1);line-height:1.35}
        .nm-card-desc{font-size:.72rem;color:var(--text2);line-height:1.55}
        .nm-tags{display:flex;gap:.3rem;flex-wrap:wrap}
        .nm-tag{font-size:.6rem;background:var(--bg3);color:var(--text3);padding:.15rem .45rem;border-radius:3px}
        .nm-preview-text{font-size:.76rem;color:var(--text2);line-height:1.65;background:var(--bg1);border:1px solid var(--border);border-radius:7px;padding:.8rem 1rem;white-space:pre-wrap;word-break:break-word}
        .nm-preview-media{border-radius:8px;overflow:hidden}
        .nm-locked-preview{background:var(--bg1);border:1px dashed var(--border);border-radius:8px;padding:1.25rem;text-align:center;color:var(--text3);font-size:.74rem;display:flex;flex-direction:column;align-items:center;gap:.4rem}
        .nm-lock-icon{font-size:1.6rem}
        .nm-music-player{display:flex;align-items:center;gap:.75rem;background:var(--bg1);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem}
        .nm-music-icon{font-size:1.4rem}
        .nm-music-info{flex:1}
        .nm-music-title{font-size:.78rem;font-weight:700}
        .nm-music-sub{font-size:.62rem;color:var(--text3)}
        .nm-play-btn{background:var(--accent);color:#fff;border:none;border-radius:5px;padding:.35rem .75rem;font-size:.7rem;cursor:pointer;font-weight:700}
        .nm-card-footer{display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:.5rem;margin-top:.1rem}
        .nm-seller{display:flex;align-items:center;gap:.3rem;font-size:.64rem;color:var(--text3);flex-wrap:wrap}
        .nm-foot-dot{color:var(--border)}
        .nm-card-actions{display:flex;gap:.4rem}
        .nm-btn{border:none;border-radius:6px;padding:.42rem .9rem;font-size:.7rem;cursor:pointer;font-weight:700;transition:opacity .12s;white-space:nowrap}
        .nm-btn:hover:not([disabled]){opacity:.82}
        .nm-btn[disabled]{opacity:.4;cursor:not-allowed}
        .nm-btn-primary{background:var(--accent);color:#fff}
        .nm-btn-buy{background:#4f9eff;color:#fff}
        .nm-btn-bounty{background:#f59e0b;color:#000}
        .nm-btn-red{background:#ef4444;color:#fff}
        .nm-empty{text-align:center;color:var(--text3);padding:3rem 1rem;font-size:.8rem;line-height:1.8}
        .nm-sell-wrap{max-width:640px;margin:0 auto;padding:.5rem 0}
        .nm-sell-title{font-size:1rem;font-weight:700;margin-bottom:1.2rem;color:var(--text1)}
        .nm-sell-form{display:flex;flex-direction:column;gap:.9rem}
        .nm-form-row{display:flex;flex-direction:column;gap:.3rem}
        .nm-label{font-size:.66rem;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
        .nm-req{color:#f87171}
        .nm-hint-inline{font-size:.62rem;color:var(--text3)}
        .nm-input{background:var(--bg2);border:1.5px solid var(--border);border-radius:7px;color:var(--text1);font-size:.82rem;padding:.55rem .8rem;outline:none;font-family:var(--font-mono);transition:border-color .12s;width:100%;box-sizing:border-box}
        .nm-input:focus{border-color:var(--accent)}
        .nm-textarea{resize:vertical;min-height:70px}
        .nm-content-area{min-height:120px}
        .nm-content-hint{font-size:.62rem;color:var(--text3);line-height:1.5}
        .nm-type-picker{display:flex;gap:.4rem;flex-wrap:wrap}
        .nm-type-opt{display:flex;align-items:center;gap:.35rem;padding:.45rem .75rem;border-radius:7px;cursor:pointer;border:1.5px solid var(--border);font-size:.73rem;color:var(--text2);transition:border-color .12s,color .12s}
        .nm-type-opt:hover{border-color:var(--accent);color:var(--text1)}
        .nm-type-opt.active{border-color:var(--accent);color:var(--accent);background:rgba(79,158,255,.08)}
        .nm-price-row{display:grid;grid-template-columns:1fr 1fr;gap:.85rem}
        .nm-form-half{display:flex;flex-direction:column;gap:.3rem}
        .nm-msg{font-size:.68rem;min-height:1em;font-family:var(--font-mono)}
        .nm-bounty-inbox{max-width:640px;margin:0 auto;padding:.5rem 0}
        .nm-bounty-item{background:var(--bg2);border:1px solid rgba(245,158,11,.3);border-radius:10px;padding:1rem;display:flex;flex-direction:column;gap:.65rem;margin-bottom:.85rem}
        .nm-bounty-from{display:flex;align-items:center;gap:.4rem;font-size:.72rem;flex-wrap:wrap}
        .nm-bounty-submission{font-size:.76rem;color:var(--text2);background:var(--bg1);border:1px solid var(--border);border-radius:7px;padding:.75rem;line-height:1.65;white-space:pre-wrap;word-break:break-word}
        .nm-bounty-actions{display:flex;gap:.5rem}
      `;
      document.head.appendChild(st);
    }

    render();
    return wrap;
  }
};
