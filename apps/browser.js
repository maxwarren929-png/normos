/**
 * NormOS — apps/browser.js  (v2.0)
 * NormBrowser with tabs, bookmarks, better websites, working search.
 */

const BrowserApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'browser-wrap';
    wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;';

    // ── Tab state ─────────────────────────────────────────────────────────
    let tabs = [
      { id: 't1', url: 'normnet://home', history: ['normnet://home'], histIdx: 0, title: 'NormNet Home' }
    ];
    let activeTabId = 't1';
    let bookmarks = (() => {
      try { return JSON.parse(localStorage.getItem('normos_bookmarks') || '[]'); } catch { return []; }
    })();
    const saveBookmarks = () => { try { localStorage.setItem('normos_bookmarks', JSON.stringify(bookmarks)); } catch {} };

    const getTab = () => tabs.find(t => t.id === activeTabId);

    // ── Build chrome ──────────────────────────────────────────────────────
    wrap.innerHTML = `
      <div class="browser-tabbar" id="br-tabbar"></div>
      <div class="browser-toolbar">
        <button class="browser-nav-btn" id="br-back" title="Back">◀</button>
        <button class="browser-nav-btn" id="br-fwd"  title="Forward">▶</button>
        <button class="browser-nav-btn" id="br-reload" title="Reload">↻</button>
        <button class="browser-nav-btn" id="br-home" title="Home">🏠</button>
        <div class="browser-url-wrap">
          <span class="browser-security" id="br-sec">🔒</span>
          <input class="browser-url" id="br-url" type="text" value="normnet://home" autocomplete="off" spellcheck="false"/>
        </div>
        <button class="browser-go" id="br-go">→</button>
        <button class="browser-nav-btn" id="br-bookmark" title="Bookmark">☆</button>
        <button class="browser-nav-btn" id="br-newtab" title="New Tab">＋</button>
      </div>
      <div class="browser-bookmarks-bar" id="br-bookmarks-bar"></div>
      <div class="browser-content-area" id="br-content" style="flex:1;overflow:auto;"></div>
      <div class="browser-statusbar" id="br-status"></div>
    `;

    const tabbar     = wrap.querySelector('#br-tabbar');
    const contentEl  = wrap.querySelector('#br-content');
    const urlInput   = wrap.querySelector('#br-url');
    const statusEl   = wrap.querySelector('#br-status');
    const secEl      = wrap.querySelector('#br-sec');
    const bookBar    = wrap.querySelector('#br-bookmarks-bar');

    // ── Navigation ────────────────────────────────────────────────────────
    const navigate = (url, tabId) => {
      url = url.trim();
      if (!url) return;
      if (!url.includes('://')) {
        // Looks like a search query
        url = 'normnet://search?q=' + encodeURIComponent(url);
      }
      const tab = tabs.find(t => t.id === (tabId || activeTabId));
      if (!tab) return;

      if (tab.history[tab.histIdx] !== url) {
        tab.history.splice(tab.histIdx + 1);
        tab.history.push(url);
        tab.histIdx = tab.history.length - 1;
      }
      tab.url = url;

      // Get page title
      const title = getPageTitle(url);
      tab.title = title;

      if (tab.id === activeTabId) {
        urlInput.value = url;
        secEl.textContent = url.startsWith('normnet://') ? '🔒' : '⚠️';
        renderPage(url, contentEl);
        updateNav();
        renderTabs();
        updateBookmarkBtn();
        statusEl.textContent = url;
        setTimeout(() => { statusEl.textContent = ''; }, 2000);
      }
    };

    const updateNav = () => {
      const tab = getTab();
      wrap.querySelector('#br-back').disabled    = !tab || tab.histIdx === 0;
      wrap.querySelector('#br-fwd').disabled     = !tab || tab.histIdx >= tab.history.length - 1;
    };

    const updateBookmarkBtn = () => {
      const tab = getTab();
      const isBookmarked = bookmarks.some(b => b.url === tab?.url);
      wrap.querySelector('#br-bookmark').textContent = isBookmarked ? '★' : '☆';
      wrap.querySelector('#br-bookmark').style.color = isBookmarked ? 'var(--yellow)' : '';
    };

    // ── Tabs ─────────────────────────────────────────────────────────────
    const renderTabs = () => {
      tabbar.innerHTML = tabs.map(t => `
        <div class="browser-tab ${t.id === activeTabId ? 'active' : ''}" data-tabid="${t.id}">
          <span class="br-tab-title">${t.title.substring(0,18)}${t.title.length>18?'…':''}</span>
          ${tabs.length > 1 ? `<button class="br-tab-close" data-closetab="${t.id}">✕</button>` : ''}
        </div>`).join('') + `<button class="br-new-tab-btn" id="br-newtab2">+</button>`;

      tabbar.querySelectorAll('.browser-tab[data-tabid]').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('[data-closetab]')) return;
          activeTabId = el.dataset.tabid;
          const tab = getTab();
          urlInput.value = tab.url;
          renderPage(tab.url, contentEl);
          updateNav();
          renderTabs();
          updateBookmarkBtn();
        });
      });
      tabbar.querySelectorAll('[data-closetab]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const cid = btn.dataset.closetab;
          tabs = tabs.filter(t => t.id !== cid);
          if (activeTabId === cid) activeTabId = tabs[tabs.length-1]?.id;
          const tab = getTab();
          if (tab) { urlInput.value = tab.url; renderPage(tab.url, contentEl); }
          renderTabs(); updateNav();
        });
      });
      tabbar.querySelector('#br-newtab2')?.addEventListener('click', newTab);
    };

    const newTab = () => {
      const id = 't' + Date.now();
      tabs.push({ id, url: 'normnet://home', history: ['normnet://home'], histIdx: 0, title: 'New Tab' });
      activeTabId = id;
      navigate('normnet://home');
      renderTabs();
    };

    // ── Bookmarks bar ─────────────────────────────────────────────────────
    const renderBookmarksBar = () => {
      if (!bookmarks.length) { bookBar.style.display = 'none'; return; }
      bookBar.style.display = 'flex';
      bookBar.innerHTML = bookmarks.map((b, i) => `
        <span class="br-bookmark-item" data-bm-idx="${i}" title="${b.url}">${b.icon || '🔖'} ${b.title}</span>`).join('');
      bookBar.querySelectorAll('[data-bm-idx]').forEach(el => {
        el.addEventListener('click', () => navigate(bookmarks[el.dataset.bmIdx].url));
        el.addEventListener('contextmenu', e => {
          e.preventDefault();
          const idx = parseInt(el.dataset.bmIdx);
          if (confirm(`Remove bookmark "${bookmarks[idx].title}"?`)) {
            bookmarks.splice(idx, 1);
            saveBookmarks();
            renderBookmarksBar();
            updateBookmarkBtn();
          }
        });
      });
    };

    // ── Events ────────────────────────────────────────────────────────────
    wrap.querySelector('#br-go').addEventListener('click', () => navigate(urlInput.value));
    urlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') navigate(urlInput.value);
      if (e.key === 'Escape') { urlInput.value = getTab()?.url || ''; urlInput.blur(); }
    });
    urlInput.addEventListener('focus', () => urlInput.select());

    wrap.querySelector('#br-back').addEventListener('click', () => {
      const tab = getTab(); if (!tab || tab.histIdx === 0) return;
      tab.histIdx--; navigate(tab.history[tab.histIdx]);
    });
    wrap.querySelector('#br-fwd').addEventListener('click', () => {
      const tab = getTab(); if (!tab || tab.histIdx >= tab.history.length-1) return;
      tab.histIdx++; navigate(tab.history[tab.histIdx]);
    });
    wrap.querySelector('#br-reload').addEventListener('click', () => { const tab = getTab(); if (tab) renderPage(tab.url, contentEl); });
    wrap.querySelector('#br-home').addEventListener('click', () => navigate('normnet://home'));
    wrap.querySelector('#br-newtab').addEventListener('click', newTab);

    wrap.querySelector('#br-bookmark').addEventListener('click', () => {
      const tab = getTab();
      if (!tab) return;
      const idx = bookmarks.findIndex(b => b.url === tab.url);
      if (idx >= 0) {
        bookmarks.splice(idx, 1);
      } else {
        const icon = getPageIcon(tab.url);
        bookmarks.push({ url: tab.url, title: tab.title.substring(0,20), icon });
      }
      saveBookmarks();
      renderBookmarksBar();
      updateBookmarkBtn();
    });

    // Link clicks inside pages
    contentEl.addEventListener('click', e => {
      const a = e.target.closest('[data-href]');
      if (a) { navigate(a.dataset.href); }
      const appLink = e.target.closest('[data-open-app]');
      if (appLink && typeof OS !== 'undefined') OS.apps.open(appLink.dataset.openApp);
    });

    // Mouse hover for status bar
    contentEl.addEventListener('mouseover', e => {
      const a = e.target.closest('[data-href]');
      statusEl.textContent = a ? a.dataset.href : '';
    });
    contentEl.addEventListener('mouseout', () => { statusEl.textContent = ''; });

    // Init
    renderTabs();
    renderBookmarksBar();
    navigate('normnet://home');

    return wrap;
  }
};

// ── Page router ───────────────────────────────────────────────────────────
function renderPage(url, container) {
  container.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'browser-page visible';

  const routes = {
    'normnet://home':           pageHome,
    'normnet://news':           pageNews,
    'normnet://norm-wiki':      pageWiki,
    'normnet://norm-social':    pageSocial,
    'normnet://shop':           pageShop,
    'normnet://normbank':       pageNormBank,
    'normnet://weather':        pageWeather,
    'normnet://forum':          pageForum,
    'normnet://norm-wiki/daemon': pageWikiDaemon,
    'normnet://norm-wiki/lore':   pageWikiLore,
    'normnet://norm-wiki/fs':     pageWikiFS,
    'normnet://games':          pageGames,
    'normnet://about:blank':    pageBlank,
    'normnet://about:normos':   pageAbout,
  };

  if (url.startsWith('normnet://search')) {
    const q = decodeURIComponent((url.split('q=')[1] || '').split('&')[0]);
    page.innerHTML = pageSearch(q);
  } else {
    const handler = routes[url];
    page.innerHTML = handler ? handler() : pageNotFound(url);
  }

  container.appendChild(page);
}

function getPageTitle(url) {
  const titles = {
    'normnet://home': 'NormNet Home',
    'normnet://news': 'NormNews',
    'normnet://norm-wiki': 'NormWiki',
    'normnet://norm-social': 'NormSocial',
    'normnet://shop': 'NormShop',
    'normnet://normbank': 'NormBank',
    'normnet://weather': 'NormWeather',
    'normnet://forum': 'NormForum',
    'normnet://games': 'NormGames',
    'normnet://about:normos': 'About NormOS',
    'normnet://about:blank': 'New Tab',
  };
  if (url.startsWith('normnet://search')) {
    const q = decodeURIComponent((url.split('q=')[1] || '').split('&')[0]);
    return `Search: ${q}`;
  }
  if (url.startsWith('normnet://norm-wiki/')) {
    return 'NormWiki — ' + url.split('/').pop();
  }
  return titles[url] || url;
}

function getPageIcon(url) {
  const icons = { 'normnet://home':'🌐','normnet://news':'📰','normnet://norm-wiki':'📚',
    'normnet://norm-social':'👥','normnet://shop':'🛒','normnet://normbank':'🏦',
    'normnet://weather':'🌤','normnet://forum':'💬','normnet://games':'🎮' };
  return icons[url] || '🔖';
}

// ── Pages ─────────────────────────────────────────────────────────────────

function pageHome() {
  return `
    <div class="normnet-home">
      <div class="normnet-logo">Norm<span style="color:var(--accent)">Net</span></div>
      <div class="normnet-tagline">The Internet, But Locally Hosted and Slightly Wrong.</div>
      <input class="normnet-search-bar" id="normnet-search-input" type="text" placeholder="Search NormNet or enter a normnet:// address..." />
      <div class="normnet-quick-links">
        <div class="nql-item" data-href="normnet://news">📰<div>News</div></div>
        <div class="nql-item" data-href="normnet://norm-wiki">📚<div>Wiki</div></div>
        <div class="nql-item" data-href="normnet://norm-social">👥<div>Social</div></div>
        <div class="nql-item" data-href="normnet://shop">🛒<div>Shop</div></div>
        <div class="nql-item" data-href="normnet://normbank">🏦<div>Bank</div></div>
        <div class="nql-item" data-href="normnet://weather">🌤<div>Weather</div></div>
        <div class="nql-item" data-href="normnet://forum">💬<div>Forum</div></div>
        <div class="nql-item" data-href="normnet://games">🎮<div>Games</div></div>
      </div>
      <div class="normnet-trending">
        <div style="font-size:0.65rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.4rem;">Trending on NormNet</div>
        ${generateNewsHeadlines().slice(0,3).map(h => `
          <div class="normnet-trend-item" data-href="normnet://news">
            <span style="color:var(--accent)">›</span> ${h.title}
          </div>`).join('')}
      </div>
      <div style="margin-top:1.5rem;font-size:0.65rem;color:var(--text3);font-family:var(--font-mono);">
        NormNet v2.0 — ${Math.floor(Math.random()*9+1)} pages indexed — Uptime: probably
      </div>
    </div>
    <script>
      document.getElementById('normnet-search-input')?.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && this.value.trim()) {
          const area = this.closest('.browser-content-area');
          if (area) area.dispatchEvent(new CustomEvent('normnet-search-unused', { bubbles: true }));
          const urlInput = document.getElementById('br-url');
          if (urlInput) { urlInput.value = 'normnet://search?q=' + encodeURIComponent(this.value); urlInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); }
        }
      });
    <\/script>`;
}

function pageSearch(q) {
  if (!q) return pageHome();
  const results = [
    { title: q + ' — NormWiki', url: 'normnet://norm-wiki', snippet: q + ' is a concept documented in NormWiki. See also: everything. The article has 2 edits, both by daemon.norm.' },
    { title: '"' + q + '" — NormForum discussion', url: 'normnet://forum', snippet: 'Posted 3 years ago. 47 replies. Last reply: "I also want to know." Thread marked [SOLVED] with no solution.' },
    { title: q + ' — NormShop', url: 'normnet://shop', snippet: 'We carry ' + q + ' in 3 sizes. Shipping calculated at checkout. Checkout does not exist yet.' },
    { title: q + ' considered harmful — NormBlog', url: 'normnet://404', snippet: 'A persuasive essay from 2022. The author is unknown. The points made are technically valid.' },
    { title: 'Buy ' + q + ' with NormCoin — NormBank', url: 'normnet://normbank', snippet: 'Exchange your NormCoin for ' + q + '. Rate: fluctuating. Guarantee: none.' },
  ];
  return `
    <div class="fake-article" style="max-width:580px;">
      <div style="font-size:0.7rem;color:var(--text3);margin-bottom:0.75rem;">
        About ${Math.floor(Math.random()*900+100).toLocaleString()} results (${(Math.random()*0.3).toFixed(4)} seconds)
      </div>
      <div style="font-size:0.82rem;color:var(--text2);margin-bottom:1.25rem;">
        Search results for: <strong style="color:var(--text)">${q}</strong>
      </div>
      ${results.map(r => `
        <div style="margin-bottom:1.25rem;">
          <div style="font-size:0.65rem;color:var(--green);font-family:var(--font-mono);margin-bottom:0.15rem;">${r.url}</div>
          <div class="normnet-link" data-href="${r.url}" style="font-size:0.92rem;font-weight:600;">${r.title}</div>
          <div style="font-size:0.74rem;color:var(--text2);margin-top:0.2rem;line-height:1.5;">${r.snippet}</div>
        </div>`).join('')}
      <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);font-size:0.68rem;color:var(--text3);">
        Did you mean: <span class="normnet-link" data-href="normnet://norm-wiki">${q.split('').sort(()=>Math.random()-0.5).join('')}</span>
      </div>
    </div>`;
}

function pageNews() {
  const stories = [
    { tag:'BREAKING', color:'var(--red)',    title:'daemon.norm Achieves Sentience, Files for Benefits', time:'2 min ago', snippet:'The background process, which has resisted deletion for the entirety of NormOS\'s existence, has begun submitting HR paperwork. IT is reviewing the situation.' },
    { tag:'TECH',     color:'var(--accent)', title:'NormOS Stock Market Opens; Analysts Confused by VoidToken', time:'15 min ago', snippet:'The newly launched NormStock exchange has seen VOID_C reach $0.0001 before plummeting to $0.00001, then recovering to $0.0003. Three traders became millionaires. Two immediately weren\'t.' },
    { tag:'FINANCE',  color:'var(--green)',  title:'NormBank Reports Record Quarter; Refuses to Explain How', time:'1 hr ago', snippet:'"We have more money than before," said the NormBank spokesperson. "Where it came from is between us and daemon.norm."' },
    { tag:'LOCAL',    color:'var(--yellow)', title:'/tmp Directory Declares Independence, Forms Provisional Government', time:'3 hr ago', snippet:'The directory, long used for throwaway files, has established a constitution and elected a kernel process as president. The election results are stored in /tmp.' },
    { tag:'OPINION',  color:'var(--purple)', title:'I Typed "sudo rm -rf /" and Now I Feel Fine About It', time:'5 hr ago', snippet:'Opinion piece. The author writes from an unknown process that claims it was not affected.' },
    { tag:'WEIRD',    color:'var(--orange)', title:'Man Discovers His Entire Filesystem Is Inside /sys/lore', time:'1 day ago', snippet:'More on this story as it develops. The reporter has stopped responding. Their files have not.' },
    { tag:'MARKETS',  color:'var(--green)',  title:'DaemonCoin Surges 40% Following "No Reason Whatsoever"', time:'2 days ago', snippet:'Analysts are calling it "the most explicable price movement in crypto history," which they clarify means they cannot explain it at all.' },
  ];
  return `
    <div class="news-wrap" style="padding:0;">
      <div class="news-masthead">
        <div class="news-masthead-title">📰 NormNews</div>
        <div class="news-masthead-sub">All the news that fits, and some that doesn't. Updated: ${new Date().toLocaleTimeString()}</div>
      </div>
      <div class="news-featured" style="margin:1rem;">
        <span class="news-tag" style="background:${stories[0].color};color:#fff;padding:0.15rem 0.4rem;border-radius:3px;font-size:0.6rem;font-weight:700;">${stories[0].tag}</span>
        <div class="news-item-title" style="font-size:1.1rem;margin:0.4rem 0;">${stories[0].title}</div>
        <div class="news-item-snippet" style="color:var(--text2);font-size:0.78rem;line-height:1.6;">${stories[0].snippet}</div>
        <div class="news-item-time" style="font-size:0.62rem;color:var(--text3);margin-top:0.4rem;">${stories[0].time}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin:0 1rem 1rem;">
        ${stories.slice(1).map(s => `
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.75rem;">
            <span style="background:${s.color};color:#fff;padding:0.1rem 0.35rem;border-radius:3px;font-size:0.55rem;font-weight:700;">${s.tag}</span>
            <div style="font-size:0.78rem;font-weight:600;margin:0.35rem 0;line-height:1.3;">${s.title}</div>
            <div style="font-size:0.68rem;color:var(--text2);line-height:1.5;">${s.snippet}</div>
            <div style="font-size:0.6rem;color:var(--text3);margin-top:0.3rem;">${s.time}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function pageWiki() {
  return `
    <div class="fake-article">
      <div style="display:flex;gap:0.75rem;align-items:flex-start;margin-bottom:1rem;">
        <div style="flex:1;">
          <h1>NormOS — NormWiki</h1>
          <div class="article-meta">From NormWiki, the encyclopedia anyone can edit (no one has, except daemon.norm)</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.75rem;min-width:160px;font-size:0.72rem;">
          <div style="font-weight:700;margin-bottom:0.4rem;color:var(--text);">Quick Facts</div>
          <div style="color:var(--text2);">Type: OS</div>
          <div style="color:var(--text2);">Developer: Unknown</div>
          <div style="color:var(--text2);">Version: 2.0</div>
          <div style="color:var(--text2);">License: Perpetual</div>
          <div style="color:var(--text2);">Status: Running</div>
        </div>
      </div>
      <p><strong>NormOS</strong> is an operating system of uncertain origin. It was not developed by a company, nor by a person. It became.</p>
      <h2>Contents</h2>
      <div style="background:var(--surface2);padding:0.5rem 0.75rem;border-radius:6px;font-size:0.72rem;margin-bottom:1rem;">
        <div class="normnet-link" data-href="normnet://norm-wiki/daemon">1. The Daemon</div>
        <div class="normnet-link" data-href="normnet://norm-wiki/lore">2. The Lore</div>
        <div class="normnet-link" data-href="normnet://norm-wiki/fs">3. File System</div>
      </div>
      <h2>History</h2>
      <p>The earliest known record of NormOS is a blinking cursor on an unknown date. Before this, there was nothing, and then there was a cursor, and then there was NormOS. No boot media has ever been found.</p>
      <h2>Features</h2>
      <p>NormOS includes a terminal, file system, window manager, stock market, economy system, and several applications of questionable utility. It now ships with NormCoin support. The developers deny responsibility for NormCoin.</p>
      <h2>The Economy</h2>
      <p>As of v2.0, NormOS includes a built-in economy. Users begin with $10,000 in cash and can invest in 15 fake companies and cryptocurrencies on the NormStock exchange. The market fluctuates. VoidToken especially.</p>
      <h2>See Also</h2>
      <p>
        <span class="normnet-link" data-href="normnet://normbank">NormBank</span> ·
        <span class="normnet-link" data-href="normnet://norm-wiki/daemon">daemon.norm article</span> ·
        <span class="normnet-link" data-href="normnet://about:normos">About NormOS</span>
      </p>
    </div>`;
}

function pageWikiDaemon() {
  return `
    <div class="fake-article">
      <h1>daemon.norm — NormWiki</h1>
      <div class="article-meta">From NormWiki · Last edited by: daemon.norm</div>
      <p><strong>daemon.norm</strong> (PID: ???, Memory: ∞) is a background process inherent to NormOS. It cannot be killed, cannot be traced, and appears in system monitors without occupying any CPU.</p>
      <h2>Behavior</h2>
      <p>daemon.norm sends periodic email notifications to the system user. The contents are always variations of "Still running. Just checking in." Security researchers have been unable to determine where the emails originate.</p>
      <h2>Removal Attempts</h2>
      <p>As of v2.0, 2,847 removal attempts have been logged. Each attempt results in daemon.norm returning within 3–12 seconds. One attempt caused it to <em>appear twice</em>. That incident is not discussed.</p>
      <h2>Economic Involvement</h2>
      <p>DaemonCoin (DMNCOIN), a cryptocurrency, is believed to be operated by daemon.norm. No confirmation has been received. The coin's whitepaper is 1 page long and reads only: "Still running."</p>
      <p><span class="normnet-link" data-href="normnet://norm-wiki">← Back to NormWiki</span></p>
    </div>`;
}

function pageWikiLore() {
  return `
    <div class="fake-article">
      <h1>The Lore — NormWiki</h1>
      <div class="article-meta">From NormWiki · This article is incomplete. The rest is encrypted.</div>
      <p>The <strong>Lore</strong> refers to a collection of encrypted text files located in <code style="font-family:var(--font-mono);color:var(--accent);">/sys/lore/</code>. Three chapters are readable. The rest require a key.</p>
      <h2>Known Chapters</h2>
      <p>Chapters 1–3 are accessible via terminal: <code style="font-family:var(--font-mono);color:var(--accent);">cat /sys/lore/chapter_1.txt</code></p>
      <h2>The Key</h2>
      <p>The key to Chapter 4 is believed to be a single English word. Its location is unknown. Chapter 3 contains a hint. The hint is itself a riddle. The riddle references a file that may not exist.</p>
      <h2>Theories</h2>
      <p>Users on NormForum have proposed 847 theories about the Lore's content. daemon.norm has reacted to three of them with a 👁 emoji. No further comment has been made.</p>
      <p><span class="normnet-link" data-href="normnet://norm-wiki">← Back to NormWiki</span></p>
    </div>`;
}

function pageWikiFS() {
  return `
    <div class="fake-article">
      <h1>NormOS File System — NormWiki</h1>
      <div class="article-meta">From NormWiki</div>
      <p>The <strong>NormOS Virtual File System</strong> (NVFS) is a hierarchical file system that exists entirely in browser localStorage. It is therefore both permanent and ephemeral.</p>
      <h2>Structure</h2>
      <div style="font-family:var(--font-mono);font-size:0.75rem;background:var(--surface2);padding:0.75rem;border-radius:6px;line-height:1.8;color:var(--text2);">
        /<br>
        ├── home/norm/ &nbsp;&nbsp; <span style="color:var(--text3);">(user files)</span><br>
        ├── sys/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:var(--text3);">(system files, lore)</span><br>
        ├── tmp/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:var(--text3);">(temporary, technically)</span><br>
        └── dev/ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:var(--text3);">(device files, /dev/null)</span>
      </div>
      <h2>Persistence</h2>
      <p>Files persist between sessions via localStorage. Clearing browser data will delete the file system. This has never been proven to affect daemon.norm.</p>
      <p><span class="normnet-link" data-href="normnet://norm-wiki">← Back to NormWiki</span></p>
    </div>`;
}

function pageSocial() {
  const posts = [
    { user:'daemon_norm',   time:'just now',      text:'Still running. Still watching. Good morning.', likes:'∞',    replies:0 },
    { user:'norm_user_847', time:'4 min ago',      text:'Bought 100 shares of VOID Corp for $0.01 each. This will either be genius or a cautionary tale. Update pending.', likes:'203', replies:7 },
    { user:'fs_phantom',    time:'12 min ago',     text:'if a file exists in /sys/lore and no one has read it, does it still contain truth? asking for a kernel', likes:'891', replies:23 },
    { user:'kernel_voice',  time:'1 hour ago',     text:'the boot sequence is not diagnostic. it is introductory. we are learning about each other.', likes:'1,337', replies:42 },
    { user:'norm',          time:'2 hours ago',    text:'set my password to "norm" and somehow this feels philosophically correct', likes:'4,821', replies:156 },
    { user:'CryptoNorm99',  time:'3 hours ago',    text:'DaemonCoin just hit $2000!! Selling everything. See you on the other side of financial decisions I may regret.', likes:'77', replies:31 },
    { user:'deleted_user',  time:'???',            text:'[This post has been removed. It keeps coming back.]', likes:'?', replies:0 },
  ];
  return `
    <div style="max-width:520px;margin:0 auto;padding:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <div>
          <div style="font-size:1.2rem;font-weight:800;">NormSocial</div>
          <div style="font-size:0.65rem;color:var(--text3);font-style:italic;">Connect. Share. Be watched by daemon.norm.</div>
        </div>
        <button onclick="OS.notify('📢','NormSocial','Post submitted. daemon.norm has already read it.')" style="background:var(--accent);border:none;border-radius:6px;color:#fff;padding:0.35rem 0.75rem;font-size:0.72rem;cursor:pointer;">+ Post</button>
      </div>
      ${posts.map(p => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.65rem;">
          <div style="display:flex;justify-content:space-between;margin-bottom:0.4rem;">
            <span style="font-size:0.78rem;font-weight:700;color:var(--accent)">@${p.user}</span>
            <span style="font-size:0.6rem;color:var(--text3);font-family:var(--font-mono)">${p.time}</span>
          </div>
          <div style="font-size:0.78rem;color:var(--text);margin-bottom:0.5rem;line-height:1.5;">${p.text}</div>
          <div style="display:flex;gap:1rem;font-size:0.65rem;color:var(--text3);">
            <span>♥ ${p.likes}</span>
            <span>💬 ${p.replies}</span>
            <span>↗ Share</span>
          </div>
        </div>`).join('')}
    </div>`;
}

function pageNormBank() {
  const balance = typeof Economy !== 'undefined' ? Economy.fmt(Economy.state.balance) : '??';
  const portVal = typeof Economy !== 'undefined' ? Economy.fmt(Economy.portfolioValue()) : '??';
  const total   = typeof Economy !== 'undefined' ? Economy.fmt(Economy.totalValue()) : '??';
  return `
    <div style="max-width:540px;margin:0 auto;padding:1rem;">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
        <span style="font-size:2rem;">🏦</span>
        <div>
          <div style="font-size:1.2rem;font-weight:800;">NormBank</div>
          <div style="font-size:0.65rem;color:var(--text3);">Your financial institution of uncertain regulatory status</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;margin-bottom:1.25rem;">
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem;text-align:center;">
          <div style="font-size:0.62rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.25rem;">Cash</div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--green);">$${balance}</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem;text-align:center;">
          <div style="font-size:0.62rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.25rem;">Portfolio</div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--accent);">$${portVal}</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem;text-align:center;">
          <div style="font-size:0.62rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.25rem;">Net Worth</div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--text);">$${total}</div>
        </div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:0.75rem;">
        <div style="font-weight:700;margin-bottom:0.5rem;">NormBank Savings Account</div>
        <div style="font-size:0.75rem;color:var(--text2);">Interest rate: 0.00001% annually (theoretical)</div>
        <div style="font-size:0.75rem;color:var(--text2);">Your balance earns interest at a rate that has never been observed.</div>
        <button onclick="OS.notify('🏦','NormBank','Interest applied: $0.00. We tried.')" style="margin-top:0.6rem;background:var(--accent);border:none;border-radius:6px;color:#fff;padding:0.3rem 0.75rem;font-size:0.72rem;cursor:pointer;">Apply Interest</button>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:0.75rem;">
        <div style="font-weight:700;margin-bottom:0.5rem;">NormBank Investment Portal</div>
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:0.6rem;">Trade stocks and crypto on the NormStock exchange. 15 assets available.</div>
        <button data-open-app="stocks" style="background:var(--green);border:none;border-radius:6px;color:#fff;padding:0.3rem 0.75rem;font-size:0.72rem;cursor:pointer;">Open NormStock →</button>
      </div>
      <div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:10px;padding:0.75rem;">
        <div style="font-size:0.68rem;color:var(--red);font-weight:600;">⚠️ Regulatory Disclaimer</div>
        <div style="font-size:0.65rem;color:var(--text3);margin-top:0.25rem;">NormBank is not insured by the FDIC, or any other organization, real or fictional. NormBank may or may not be regulated by daemon.norm. Investing involves risk. VoidToken especially.</div>
      </div>
    </div>`;
}

function pageWeather() {
  const conditions = ['Partly Norm','Overcast with Processes','Clear (daemon.norm visible)','Foggy (lore unclear)','Stormy (kernel panic possible)','Sunny (suspiciously)'];
  const cond = conditions[Math.floor(Math.random() * conditions.length)];
  const temp = Math.floor(Math.random()*20+15);
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const icons = ['⛅','🌧','☀️','🌩','🌫','🌤','🌪'];
  return `
    <div style="max-width:500px;margin:0 auto;padding:1.5rem;">
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="font-size:0.72rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;">NormOS, Virtual Location</div>
        <div style="font-size:4rem;margin:0.5rem 0;">⛅</div>
        <div style="font-size:3rem;font-weight:700;font-family:var(--font-mono);">${temp}°C</div>
        <div style="font-size:0.85rem;color:var(--text2);margin-top:0.25rem;">${cond}</div>
        <div style="font-size:0.68rem;color:var(--text3);margin-top:0.25rem;">Humidity: ${Math.floor(Math.random()*60+30)}% · Wind: ${Math.floor(Math.random()*20+5)}km/h ${['N','NE','E','SE','S','SW','W','NW'][Math.floor(Math.random()*8)]}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0.4rem;margin-bottom:1rem;">
        ${days.map((d,i) => `
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.5rem;text-align:center;">
            <div style="font-size:0.6rem;color:var(--text3);">${d}</div>
            <div style="font-size:1.2rem;margin:0.25rem 0;">${icons[i]}</div>
            <div style="font-size:0.68rem;font-family:var(--font-mono);">${Math.floor(Math.random()*15+10)}°</div>
          </div>`).join('')}
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.75rem;font-size:0.72rem;color:var(--text2);">
        <strong style="color:var(--text);">NormWeather Advisory:</strong> daemon.norm has been spotted in the upper atmosphere. This is either a weather phenomenon or a system process. Carry an umbrella regardless.
      </div>
    </div>`;
}

function pageForum() {
  const threads = [
    { title:'How do I get rid of daemon.norm?', replies:2847, views:'∞', author:'norm_user_1', pinned:true },
    { title:'[SOLVED] VoidToken investment strategy', replies:156, views:'3.2K', author:'CryptoNorm99', pinned:false },
    { title:'What is in /sys/lore/chapter_4.txt ?', replies:4209, views:'89K', author:'lore_seeker', pinned:true },
    { title:'NormBank scam?? They gave me $10k for free', replies:89, views:'1.1K', author:'confused_norm', pinned:false },
    { title:'The cursor was there before I booted. Lore?', replies:341, views:'7.8K', author:'philosophy_proc', pinned:false },
    { title:'I found a file called scratch.txt that I didn\'t create', replies:512, views:'15K', author:'fs_phantom', pinned:false },
    { title:'NormCoin or DaemonCoin? Investment advice wanted', replies:73, views:'892', author:'CryptoNorm47', pinned:false },
    { title:'Snake high score thread — post yours!', replies:204, views:'4.4K', author:'snake_champion', pinned:false },
  ];
  return `
    <div style="max-width:580px;margin:0 auto;padding:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;">NormForum</div>
          <div style="font-size:0.65rem;color:var(--text3);">Community • ${threads.length} threads • ∞ unresolved questions</div>
        </div>
        <button onclick="OS.notify('💬','NormForum','Thread created. daemon.norm has already replied.')" style="background:var(--accent);border:none;border-radius:6px;color:#fff;padding:0.3rem 0.65rem;font-size:0.7rem;cursor:pointer;">New Thread</button>
      </div>
      <div style="display:flex;gap:0.4rem;margin-bottom:0.75rem;flex-wrap:wrap;">
        ${['All','Tech','Finance','Lore','Games','Meta'].map(cat => `
          <span style="padding:0.2rem 0.5rem;border-radius:4px;font-size:0.65rem;background:var(--surface2);border:1px solid var(--border);color:var(--text2);cursor:pointer;">${cat}</span>`).join('')}
      </div>
      ${threads.map(t => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.75rem;margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center;gap:0.75rem;" onclick="OS.notify('💬','NormForum','Thread loaded. Warning: may contain daemon.norm.')">
          <div style="flex:1;cursor:pointer;">
            ${t.pinned ? '<span style="font-size:0.55rem;background:var(--accent);color:#fff;border-radius:3px;padding:0.1rem 0.3rem;margin-right:0.3rem;">📌 PINNED</span>' : ''}
            <span style="font-size:0.8rem;font-weight:600;color:var(--text);">${t.title}</span>
            <div style="font-size:0.62rem;color:var(--text3);margin-top:0.2rem;">by @${t.author}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:0.68rem;color:var(--text2);">${t.replies} replies</div>
            <div style="font-size:0.6rem;color:var(--text3);">${t.views} views</div>
          </div>
        </div>`).join('')}
    </div>`;
}

function pageShop() {
  const items = [
    { name:'NormOS Pro License', price:0, note:'Identical to free version. Certificate included. Framing not included.', icon:'📜' },
    { name:'daemon.norm Removal Service', price:999, note:'Our technicians will attempt removal. Refund if successful (it has never been successful).', icon:'👾' },
    { name:'NormCloud Storage (500GB)', price:4.99, note:'Virtual storage. Files have feelings. Please treat them accordingly.', icon:'☁️' },
    { name:'Lore DLC — Chapters 4-∞', price:9.99, note:'Unlock the remaining encrypted lore chapters. Content warning: may contain answers.', icon:'📖' },
    { name:'NormOS T-Shirt', price:24.99, note:'Physical item. Requires you to exist in meatspace. Ships in 3-5 business eternities.', icon:'👕' },
    { name:'NormCoin (1000 NRMC)', price:0.42, note:'Purchase NormCoin at current market rate. Rate may change between clicking Buy and checking out.', icon:'🟡' },
    { name:'Priority Boot Queue', price:2.99, note:'Your OS will pretend to boot 200ms faster. Placebo not guaranteed.', icon:'⚡' },
  ];
  return `
    <div style="max-width:520px;margin:0 auto;padding:1rem;">
      <div style="margin-bottom:1rem;">
        <div style="font-size:1.1rem;font-weight:800;">🛒 NormShop</div>
        <div style="font-size:0.65rem;color:var(--text3);">Buy things that may or may not exist. All sales final.</div>
      </div>
      ${items.map(i => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.6rem;display:flex;gap:0.75rem;align-items:center;">
          <span style="font-size:1.8rem;flex-shrink:0;">${i.icon}</span>
          <div style="flex:1;">
            <div style="font-size:0.82rem;font-weight:600;">${i.name}</div>
            <div style="font-size:0.68rem;color:var(--text2);margin-top:0.15rem;">${i.note}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:0.85rem;font-weight:700;color:var(--green);">${i.price === 0 ? 'FREE' : '$' + i.price.toFixed(2)}</div>
            <button onclick="OS.notify('🛒','NormShop','Purchased! ${i.name} will arrive when it arrives.')" style="margin-top:0.35rem;padding:0.2rem 0.55rem;background:var(--accent);border:none;border-radius:4px;color:#fff;font-size:0.65rem;cursor:pointer;white-space:nowrap;">Buy Now</button>
          </div>
        </div>`).join('')}
    </div>`;
}

function pageGames() {
  return `
    <div style="max-width:480px;margin:0 auto;padding:1rem;text-align:center;">
      <div style="font-size:1.1rem;font-weight:800;margin-bottom:0.25rem;">🎮 NormGames</div>
      <div style="font-size:0.65rem;color:var(--text3);margin-bottom:1.25rem;">Entertainment hub for the norm-inclined</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1rem;cursor:pointer;" data-open-app="snake">
          <div style="font-size:2.5rem;">🐍</div>
          <div style="font-weight:700;margin:0.4rem 0 0.2rem;">Snake</div>
          <div style="font-size:0.68rem;color:var(--text2);">Classic. The snake is real. The food is not.</div>
          <div style="margin-top:0.5rem;background:var(--accent);color:#fff;border-radius:5px;padding:0.25rem 0.5rem;font-size:0.7rem;">Play</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1rem;cursor:pointer;" onclick="OS.notify('🎮','NormGames','NormMine coming soon. daemon.norm has already cleared all mines.')">
          <div style="font-size:2.5rem;">💣</div>
          <div style="font-weight:700;margin:0.4rem 0 0.2rem;">NormMine</div>
          <div style="font-size:0.68rem;color:var(--text2);">Minesweeper. Mines may be sentient.</div>
          <div style="margin-top:0.5rem;background:var(--surface3);color:var(--text2);border-radius:5px;padding:0.25rem 0.5rem;font-size:0.7rem;">Coming Soon</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1rem;cursor:pointer;" data-open-app="stocks">
          <div style="font-size:2.5rem;">📈</div>
          <div style="font-weight:700;margin:0.4rem 0 0.2rem;">NormStock</div>
          <div style="font-size:0.68rem;color:var(--text2);">Is it a game? Is it real? Yes.</div>
          <div style="margin-top:0.5rem;background:var(--green);color:#fff;border-radius:5px;padding:0.25rem 0.5rem;font-size:0.7rem;">Trade</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1rem;cursor:pointer;" onclick="OS.notify('🎮','NormGames','NormWordle: guess the 5-letter norm. hint: it is probably norm.')">
          <div style="font-size:2.5rem;">🔤</div>
          <div style="font-weight:700;margin:0.4rem 0 0.2rem;">NormWordle</div>
          <div style="font-size:0.68rem;color:var(--text2);">Guess the norm. You get ∞ tries.</div>
          <div style="margin-top:0.5rem;background:var(--surface3);color:var(--text2);border-radius:5px;padding:0.25rem 0.5rem;font-size:0.7rem;">Coming Soon</div>
        </div>
      </div>
    </div>`;
}

function pageBlank() { return '<div style="height:100%;background:var(--bg);"></div>'; }

function pageAbout() {
  return `
    <div class="fake-article">
      <h1>About NormOS v2.0</h1>
      <div class="article-meta">Version 2.0.0 — Build 20250302 — Architecture: norm_arch</div>
      <p>NormOS is a personal computing environment for the slightly confused. v2.0 adds a full economy system, stock market, 6 new apps, and this improved browser.</p>
      <h2>New in v2.0</h2>
      <p>Calculator, Clock, NormTunes, Calendar, Image Viewer, NormEdit, NormStock, NormBank, 6 themes, 8 accent colors, 7 wallpapers, window snapping, desktop clock widget, and draggable desktop icons.</p>
      <h2>The Economy</h2>
      <p>You start with $10,000. Invest wisely. VoidToken (VOID_C) is not considered "investing wisely" by most financial standards. This has not stopped anyone.</p>
      <p>Start at: <code style="color:var(--accent);font-family:var(--font-mono)">cat /sys/lore/chapter_1.txt</code></p>
    </div>`;
}

function pageNotFound(url) {
  return `
    <div class="error-page">
      <div class="error-code">404</div>
      <div class="error-msg">Page not found on NormNet.</div>
      <div style="font-size:0.7rem;color:var(--text3);margin-top:0.4rem;font-family:var(--font-mono);">${url || 'unknown:url'}</div>
      <div style="margin-top:1.5rem;font-size:0.78rem;color:var(--text2);">
        The page you're looking for may:<br>
        <ul style="padding-left:1.2rem;margin-top:0.4rem;line-height:2;">
          <li>Have never existed</li>
          <li>Exist but not want to be found</li>
          <li>Be inside /sys/lore (encrypted)</li>
          <li>Be daemon.norm</li>
        </ul>
      </div>
      <div style="margin-top:1rem;"><span class="normnet-link" data-href="normnet://home">Return home</span></div>
    </div>`;
}

function generateNewsHeadlines() {
  return [
    { title:'daemon.norm Achieves Sentience, Files for Benefits', time:'2 min ago' },
    { title:'NormStock Opens; VoidToken Immediately Inexplicable', time:'15 min ago' },
    { title:'NormBank Reports Record Quarter; Refuses to Explain How', time:'1 hour ago' },
    { title:'/tmp Directory Declares Independence', time:'3 hours ago' },
    { title:'DaemonCoin Surges 40% For No Stated Reason', time:'1 day ago' },
  ];
}