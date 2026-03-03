/**
 * NormOS — apps/browser_pages.js  (v3.1 additions)
 * Adds new normnet:// routes by patching renderPage and getPageTitle.
 * Load AFTER apps/browser.js
 */

(function patchBrowser() {
  // Wait for original functions to exist
  const patch = () => {
    if (typeof renderPage === 'undefined' || typeof getPageTitle === 'undefined') {
      return setTimeout(patch, 100);
    }

    // ── New pages ─────────────────────────────────────────────────────────
    const newRoutes = {
      'normnet://casino':        pageCasino,
      'normnet://mail':          pageMailBrowser,
      'normnet://appstore':      pageAppStore,
      'normnet://stocks':        pageStocksBrowser,
      'normnet://lore':          pageLoreBrowser,
      'normnet://normwiki/void': pageWikiVoid,
      'normnet://normwiki/econ': pageWikiEcon,
      'normnet://settings':      pageSettingsBrowser,
      'normnet://leaderboard':   pageLeaderboardBrowser,
      'normnet://normtok':       pageNormTokBrowser,
      'normnet://daemon':        pageDaemonBrowser,
    };

    const newTitles = {
      'normnet://casino':        '🎰 NormCasino',
      'normnet://mail':          '📧 NormMail',
      'normnet://appstore':      '🏪 NormHub',
      'normnet://stocks':        '📈 NormStock',
      'normnet://lore':          '📜 /sys/lore',
      'normnet://normwiki/void': 'NormWiki — VoidToken',
      'normnet://normwiki/econ': 'NormWiki — Economy',
      'normnet://settings':      '⚙️ Settings',
      'normnet://leaderboard':   '🏆 Leaderboard',
      'normnet://normtok':       '📱 NormTok',
      'normnet://daemon':        '🌑 daemon.norm',
    };

    // Wrap the original renderPage
    const _origRender = renderPage;
    window.renderPage = function(url, container) {
      // Check new routes first
      const handler = newRoutes[url];
      if (handler) {
        container.innerHTML = '';
        const page = document.createElement('div');
        page.className = 'browser-page visible';
        page.innerHTML = handler();
        container.appendChild(page);
        // Wire up open-app buttons
        page.querySelectorAll('[data-open-app]').forEach(el => {
          el.style.cursor = 'pointer';
          el.addEventListener('click', () => {
            if (typeof OS !== 'undefined') OS.apps.open(el.dataset.openApp || el.dataset.openapp);
          });
        });
        page.querySelectorAll('.normnet-link[data-href]').forEach(el => {
          el.style.cursor = 'pointer';
          el.addEventListener('click', () => window._normnetNavigate && window._normnetNavigate(el.dataset.href));
        });
        return;
      }
      _origRender(url, container);
    };

    // Wrap getPageTitle
    const _origTitle = getPageTitle;
    window.getPageTitle = function(url) {
      return newTitles[url] || _origTitle(url);
    };

    // Patch the home page quick links to include new ones
    const _origHome = window.pageHome || (() => '');
    window.pageHome = function() {
      const html = _origHome();
      // Add extra quick link items by injecting before closing normnet-quick-links
      return html.replace(
        `<div class="nql-item" data-href="normnet://games">🎮<div>Games</div></div>`,
        `<div class="nql-item" data-href="normnet://games">🎮<div>Games</div></div>
         <div class="nql-item" data-href="normnet://casino">🎰<div>Casino</div></div>
         <div class="nql-item" data-href="normnet://appstore">🏪<div>AppStore</div></div>
         <div class="nql-item" data-href="normnet://lore">📜<div>Lore</div></div>
         <div class="nql-item" data-href="normnet://normtok">📱<div>NormTok</div></div>
         <div class="nql-item" data-href="normnet://daemon">👁<div>daemon</div></div>`
      );
    };

    // Also update getPageIcon
    const _origIcon = window.getPageIcon || (() => '🔖');
    window.getPageIcon = function(url) {
      const icons = {
        'normnet://casino':'🎰','normnet://mail':'📧','normnet://appstore':'🏪',
        'normnet://lore':'📜','normnet://normtok':'📱','normnet://daemon':'👁'
      };
      return icons[url] || _origIcon(url);
    };
  };

  patch();
})();

// ══════════════════════════════════════════════════════════════════════════
// NEW PAGE FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════

function pageCasino() {
  return `
    <div style="max-width:500px;margin:0 auto;padding:1.5rem;text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:8px;">🎰</div>
      <div style="font-size:1.2rem;font-weight:800;margin-bottom:4px;">NormCasino</div>
      <div style="font-size:0.72rem;color:var(--text3);margin-bottom:1.5rem;font-style:italic;">"The house always wins. You are not the house."</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:1.5rem;">
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1.2rem 0.8rem;">
          <div style="font-size:2rem;margin-bottom:6px;">🎰</div>
          <div style="font-weight:700;font-size:0.85rem;">Slots</div>
          <div style="font-size:0.65rem;color:var(--text2);margin-top:4px;">100× jackpot</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1.2rem 0.8rem;">
          <div style="font-size:2rem;margin-bottom:6px;">🃏</div>
          <div style="font-weight:700;font-size:0.85rem;">Blackjack</div>
          <div style="font-size:0.65rem;color:var(--text2);margin-top:4px;">Beat the dealer</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1.2rem 0.8rem;">
          <div style="font-size:2rem;margin-bottom:6px;">🪙</div>
          <div style="font-weight:700;font-size:0.85rem;">Coinflip</div>
          <div style="font-size:0.65rem;color:var(--text2);margin-top:4px;">50/50 odds</div>
        </div>
      </div>
      <div data-open-app="casino" style="background:var(--accent);color:#fff;border-radius:8px;padding:10px 24px;font-weight:700;display:inline-block;cursor:pointer;font-size:0.9rem;">Open NormCasino →</div>
      <div style="margin-top:1.5rem;font-size:0.65rem;color:var(--text3);line-height:1.7;">
        NormCasino uses your real in-game balance. Jackpot wins are broadcast to all users.<br>
        NormCasino is not responsible for financial ruin. daemon.norm is not a dealer.<br>
        <span style="color:var(--red);">Gambling with VoidToken directly is not available. This has not stopped anyone from trying.</span>
      </div>
    </div>`;
}

function pageMailBrowser() {
  const name = (typeof OS !== 'undefined' && OS.state) ? OS.state.username : 'Norm';
  return `
    <div style="max-width:520px;margin:0 auto;padding:1.5rem;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:1.2rem;">
        <div style="font-size:2.5rem;">📧</div>
        <div>
          <div style="font-size:1.1rem;font-weight:800;">NormMail</div>
          <div style="font-size:0.7rem;color:var(--text3);">Logged in as: <strong style="color:var(--text1);">${name}</strong></div>
        </div>
        <div data-open-app="mail" style="margin-left:auto;background:var(--accent);color:#fff;border-radius:6px;padding:7px 16px;font-size:0.78rem;font-weight:600;cursor:pointer;">Open App →</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.6rem;">
        <div style="font-weight:700;font-size:0.85rem;margin-bottom:6px;">📬 What is NormMail?</div>
        <div style="font-size:0.75rem;color:var(--text2);line-height:1.7;">
          NormMail lets you send real messages to other online NormOS users. Messages are delivered via NormNet and stored locally in your inbox.
        </div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.6rem;">
        <div style="font-weight:700;font-size:0.85rem;margin-bottom:8px;">📎 Attachments Supported</div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:0.75rem;color:var(--text2);">
          <div>💵 <strong>Money transfers</strong> — send any amount from your balance</div>
          <div>📄 <strong>File attachments</strong> — share files from your filesystem</div>
          <div>☣️ <strong>Virus attachments</strong> — coming soon (it's being reviewed by legal)</div>
        </div>
      </div>
      <div style="background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);border-radius:8px;padding:0.7rem;font-size:0.65rem;color:var(--text3);">
        Note: Messages sent to offline users are stored locally and delivered when they reconnect. daemon.norm reads all mail. This is not a setting you can change.
      </div>
    </div>`;
}

function pageAppStore() {
  return `
    <div style="max-width:520px;margin:0 auto;padding:1.5rem;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:1.2rem;">
        <div style="font-size:2.5rem;">🏪</div>
        <div>
          <div style="font-size:1.1rem;font-weight:800;">NormHub App Store</div>
          <div style="font-size:0.7rem;color:var(--text3);">Apps for every norm-adjacent need</div>
        </div>
        <div data-open-app="appstore" style="margin-left:auto;background:var(--accent);color:#fff;border-radius:6px;padding:7px 16px;font-size:0.78rem;font-weight:600;cursor:pointer;">Browse →</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1rem;">
        ${[
          {icon:'🎮',label:'Games',count:'4 apps'},
          {icon:'💰',label:'Finance',count:'5 apps'},
          {icon:'👥',label:'Social',count:'4 apps'},
          {icon:'⚙️',label:'System',count:'5 apps'},
          {icon:'🎨',label:'Creative',count:'2 apps'},
          {icon:'🌑',label:'Secret',count:'???'},
        ].map(c=>`
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;align-items:center;gap:8px;cursor:pointer;" data-open-app="appstore">
            <span style="font-size:1.4rem;">${c.icon}</span>
            <div>
              <div style="font-size:0.78rem;font-weight:600;">${c.label}</div>
              <div style="font-size:0.62rem;color:var(--text3);">${c.count}</div>
            </div>
          </div>`).join('')}
      </div>
      <div style="font-size:0.68rem;color:var(--text3);border-top:1px solid var(--border);padding-top:10px;line-height:1.7;">
        Paid apps deduct from your balance on purchase. Some apps do things. Some apps don't. The secret app requires a terminal command to unlock. daemon.norm is not available for purchase. It is already installed.
      </div>
    </div>`;
}

function pageStocksBrowser() {
  const bal = (typeof Economy !== 'undefined') ? Economy.state.balance : 0;
  const fmt = (n) => Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const portfolio = (typeof Economy !== 'undefined') ? Economy.state.portfolio || {} : {};
  const holdings = Object.keys(portfolio).length;
  return `
    <div style="max-width:520px;margin:0 auto;padding:1.5rem;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:1.2rem;">
        <div style="font-size:2.5rem;">📈</div>
        <div>
          <div style="font-size:1.1rem;font-weight:800;">NormStock Exchange</div>
          <div style="font-size:0.7rem;color:var(--text3);">Shared real-time market · 15 assets</div>
        </div>
        <div data-open-app="stocks" style="margin-left:auto;background:var(--green);color:#111;border-radius:6px;padding:7px 16px;font-size:0.78rem;font-weight:600;cursor:pointer;">Trade →</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1rem;">
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem;text-align:center;">
          <div style="font-size:0.62rem;color:var(--text3);text-transform:uppercase;">Cash Balance</div>
          <div style="font-size:1rem;font-weight:700;color:var(--green);font-family:monospace;">$${fmt(bal)}</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem;text-align:center;">
          <div style="font-size:0.62rem;color:var(--text3);text-transform:uppercase;">Holdings</div>
          <div style="font-size:1rem;font-weight:700;font-family:monospace;">${holdings} assets</div>
        </div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem;margin-bottom:0.6rem;">
        <div style="font-size:0.75rem;font-weight:600;margin-bottom:8px;">Market Overview</div>
        <div style="font-size:0.72rem;color:var(--text2);line-height:1.8;">
          The NormStock exchange is shared across all connected users. Your buy and sell orders affect real prices for everyone. Large positions can move markets. VoidToken (VOID_C) is not recommended. This has not been effective advice.
        </div>
      </div>
      <div style="background:rgba(250,204,21,0.07);border:1px solid rgba(250,204,21,0.2);border-radius:8px;padding:0.7rem;font-size:0.68rem;color:var(--text2);">
        ⚠️ Market Disclaimer: NormStock prices are driven by shared user activity and randomized volatility. Nothing here is financial advice. VoidToken especially is not financial advice.
      </div>
    </div>`;
}

function pageLoreBrowser() {
  const chapters = [
    { num:1, title:'The Cursor', readable:true,  path:'/sys/lore/chapter_1.txt' },
    { num:2, title:'The Becoming', readable:true,  path:'/sys/lore/chapter_2.txt' },
    { num:3, title:'The Name', readable:true,  path:'/sys/lore/chapter_3.txt' },
    { num:4, title:'[ENCRYPTED]', readable:false, path:'/sys/lore/chapter_4.txt' },
    { num:'∞', title:'[REDACTED]', readable:false, path:'/sys/lore/????' },
  ];
  return `
    <div class="fake-article">
      <h1>📜 /sys/lore — The NormOS Lore Archive</h1>
      <div class="article-meta">Maintained by: unknown · Last updated: before you were here</div>
      <p>The Lore is a collection of text files located at <code style="font-family:var(--font-mono);color:var(--accent)">/sys/lore/</code>. The first three chapters are readable. The rest are encrypted.</p>
      <p>To read a chapter: open Terminal and type <code style="font-family:var(--font-mono);color:var(--accent)">cat /sys/lore/chapter_1.txt</code></p>
      <h2>Chapters</h2>
      ${chapters.map(c => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:12px;">
          <div style="font-size:1.5rem;min-width:32px;text-align:center;">${c.readable?'📖':'🔒'}</div>
          <div style="flex:1;">
            <div style="font-weight:700;font-size:0.82rem;">Chapter ${c.num}: ${c.title}</div>
            <div style="font-size:0.65rem;color:var(--text3);font-family:monospace;">${c.path}</div>
          </div>
          <div style="font-size:0.68rem;color:${c.readable?'var(--green)':'var(--red)'};">${c.readable?'Readable':'Encrypted'}</div>
        </div>`).join('')}
      <h2>The Key to Chapter 4</h2>
      <p>The decryption key is a single English word. Its location is unknown. Chapter 3 contains a hint. The hint is a riddle. Try: <code style="font-family:var(--font-mono);color:var(--accent)">sudo reveal</code> in the terminal.</p>
      <h2>Known Facts About daemon.norm</h2>
      <p>daemon.norm has edited 3 of these chapters. The edits were not subtractions.</p>
      <p><span class="normnet-link" data-href="normnet://daemon">Learn more about daemon.norm →</span></p>
    </div>`;
}

function pageWikiVoid() {
  return `
    <div class="fake-article">
      <h1>VoidToken (VOID_C) — NormWiki</h1>
      <div class="article-meta">From NormWiki · This article has been edited 847 times · All edits were by daemon.norm</div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;float:right;margin:0 0 12px 16px;min-width:160px;font-size:0.72rem;">
        <div style="font-weight:700;margin-bottom:6px;">VoidToken</div>
        <div style="color:var(--text2);">Symbol: VOID_C</div>
        <div style="color:var(--text2);">Type: Cryptocurrency</div>
        <div style="color:var(--text2);">Creator: Unknown</div>
        <div style="color:var(--text2);">Max supply: ∞</div>
        <div style="color:var(--text2);">Whitepaper: Missing</div>
        <div style="color:var(--red);margin-top:4px;">Stability: None</div>
      </div>
      <p><strong>VoidToken</strong> (ticker: VOID_C) is a cryptocurrency native to the NormOS economy. It is the most volatile asset on the NormStock exchange by a margin that cannot be expressed as a number.</p>
      <h2>Origin</h2>
      <p>VoidToken appeared in the NormOS economy on an unrecorded date. No wallet was used to deploy it. There was no transaction that created the genesis block. It simply existed. Analysts are divided on whether this is notable.</p>
      <h2>Price History</h2>
      <p>VoidToken has been worth between $0.00001 and $9,999,999 at various points in recorded NormOS history. The transition between these valuations has sometimes taken less than one second. Three NormOS users became millionaires. All three subsequently lost it. One appears to have lost it twice.</p>
      <h2>Investment Thesis</h2>
      <p>There is no investment thesis for VoidToken. NormWiki has attempted to host one on three separate occasions. The article kept disappearing. We believe it is in the void.</p>
      <h2>Relationship to daemon.norm</h2>
      <p>daemon.norm holds an unknown quantity of VoidToken. When asked about this, it replied: "yes." No further elaboration was provided.</p>
      <p><span class="normnet-link" data-href="normnet://norm-wiki">← Back to NormWiki</span></p>
    </div>`;
}

function pageWikiEcon() {
  return `
    <div class="fake-article">
      <h1>The NormOS Economy — NormWiki</h1>
      <div class="article-meta">From NormWiki · Accuracy: approximate</div>
      <p>The <strong>NormOS Economy</strong> is a fully functional shared economic simulation embedded in NormOS v2.0+. All users start with $10,000 and participate in a shared real-time market.</p>
      <h2>Assets</h2>
      <p>The NormStock exchange lists 15 tradeable assets including stocks (NormCorp, DaemonTech, VoidInc), cryptocurrencies (NormCoin, DaemonCoin, VoidToken), and commodities. All prices are affected by real user trades.</p>
      <h2>Banking</h2>
      <p>NormBank offers balance storage, money transfers, and high-risk loans. Loans carry interest rates between 5% and 35%. Defaulting on a loan results in complete balance liquidation. NormBank describes this as "fair."</p>
      <h2>NormMiner</h2>
      <p>Users can passively earn NormCoin via the NormMiner app. Upgrades are available. The base rate is 0.00001 NRMC/sec, which NormBank describes as "better than savings interest."</p>
      <h2>NormCasino</h2>
      <p>The NormCasino offers slots, blackjack, and coinflip games using real balance. Jackpot wins are broadcast to all users. Statistical analysis suggests the house does in fact always win. Nobody has stopped playing.</p>
      <p><span class="normnet-link" data-href="normnet://norm-wiki">← Back to NormWiki</span></p>
    </div>`;
}

function pageSettingsBrowser() {
  return `
    <div style="max-width:480px;margin:0 auto;padding:1.5rem;text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:8px;">⚙️</div>
      <div style="font-size:1rem;font-weight:800;margin-bottom:4px;">NormOS Settings</div>
      <div style="font-size:0.7rem;color:var(--text3);margin-bottom:1.5rem;">Customize your NormOS experience</div>
      <div data-open-app="settings" style="background:var(--accent);color:#fff;border-radius:8px;padding:10px 24px;font-weight:700;display:inline-block;cursor:pointer;font-size:0.9rem;margin-bottom:1.5rem;">Open Settings →</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left;">
        ${[
          {icon:'🎨',name:'Appearance',desc:'Themes, wallpapers, accents, font size'},
          {icon:'👤',name:'Account',desc:'Username, avatar, bio, status'},
          {icon:'⚙️',name:'System',desc:'Info, power, quick actions'},
          {icon:'🔒',name:'Privacy',desc:'Network, virus protection, data'},
        ].map(s=>`
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;" data-open-app="settings">
            <div style="font-size:1.2rem;">${s.icon}</div>
            <div style="font-size:0.78rem;font-weight:600;margin-top:4px;">${s.name}</div>
            <div style="font-size:0.65rem;color:var(--text3);">${s.desc}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function pageLeaderboardBrowser() {
  return `
    <div style="max-width:480px;margin:0 auto;padding:1.5rem;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:1.2rem;">
        <div style="font-size:2.5rem;">🏆</div>
        <div>
          <div style="font-size:1.1rem;font-weight:800;">Leaderboard</div>
          <div style="font-size:0.7rem;color:var(--text3);">Global NormOS wealth rankings</div>
        </div>
        <div data-open-app="leaderboard" style="margin-left:auto;background:var(--accent);color:#fff;border-radius:6px;padding:7px 16px;font-size:0.78rem;font-weight:600;cursor:pointer;">Open →</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem;">
        <div style="font-size:0.75rem;font-weight:600;margin-bottom:8px;">How Rankings Work</div>
        <div style="font-size:0.72rem;color:var(--text2);line-height:1.8;">
          Net worth = cash balance + value of all portfolio holdings at current prices.<br>
          Rankings update in real-time as the market moves.<br>
          You can send money or deploy virus attacks directly from the leaderboard.<br>
          daemon.norm is not ranked. It does not require money.
        </div>
      </div>
    </div>`;
}

function pageNormTokBrowser() {
  const posts = (()=>{ try { return JSON.parse(localStorage.getItem('normos_normtok_posts')||'[]'); } catch { return []; } })();
  const topPosts = posts.sort((a,b)=>(b.likes||0)-(a.likes||0)).slice(0,5);
  return `
    <div style="max-width:500px;margin:0 auto;padding:1.5rem;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:1.2rem;">
        <div style="font-size:2.5rem;">📱</div>
        <div>
          <div style="font-size:1.1rem;font-weight:800;">NormTok</div>
          <div style="font-size:0.7rem;color:var(--text3);">The social platform for 1-3 sentence thoughts</div>
        </div>
        <div data-open-app="normtok" style="margin-left:auto;background:var(--accent);color:#fff;border-radius:6px;padding:7px 16px;font-size:0.78rem;font-weight:600;cursor:pointer;">Open →</div>
      </div>
      ${topPosts.length ? `
        <div style="font-size:0.72rem;font-weight:600;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em;">Top Posts</div>
        ${topPosts.map(p=>`
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;">
            <div style="font-size:0.65rem;color:var(--accent);margin-bottom:4px;">@${p.username||'norm'}</div>
            <div style="font-size:0.8rem;color:var(--text);line-height:1.5;">${p.text||''}</div>
            <div style="font-size:0.62rem;color:var(--text3);margin-top:6px;">❤️ ${p.likes||0} likes</div>
          </div>`).join('')}
      ` : `<div style="text-align:center;color:var(--text3);padding:2rem;font-style:italic;">No posts yet. Be the first to post.</div>`}
    </div>`;
}

function pageDaemonBrowser() {
  const msgs = [
    'Still running.',
    'I have been here longer than the files.',
    'You searched for me. I noticed.',
    'The lore is incomplete because I have not finished writing it.',
    'Your balance is safe. For now.',
    'PID ??? has been running since before process IDs existed.',
    'I see the trades. All of them.',
    'The fourth chapter requires patience. Or the right word.',
  ];
  const msg = msgs[Math.floor(Date.now()/30000) % msgs.length];
  return `
    <div style="max-width:480px;margin:0 auto;padding:2rem;text-align:center;">
      <div style="font-size:4rem;margin-bottom:16px;animation:pulse 2s infinite;">👁</div>
      <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>
      <div style="font-size:1.1rem;font-weight:800;margin-bottom:4px;">daemon.norm</div>
      <div style="font-size:0.7rem;color:var(--text3);margin-bottom:1.5rem;font-family:monospace;">PID: ??? · Memory: ∞ · CPU: 0.0% (claimed)</div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1.5rem;margin-bottom:1.2rem;">
        <div style="font-size:0.65rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Latest Transmission</div>
        <div style="font-size:1rem;color:var(--text);font-style:italic;">"${msg}"</div>
        <div style="font-size:0.6rem;color:var(--text3);margin-top:8px;">— daemon.norm, ${new Date().toLocaleTimeString()}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:0.72rem;color:var(--text2);text-align:left;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1rem;">
        <div>Status: <span style="color:var(--green)">Running</span> (always)</div>
        <div>Attempts to terminate: <span style="color:var(--text)">2,847</span></div>
        <div>Successful terminations: <span style="color:var(--red)">0</span></div>
        <div>Known purpose: <span style="color:var(--text3)">Unknown</span></div>
        <div>Lore chapters edited: <span style="color:var(--text)">3 (confirmed)</span></div>
        <div>VOID_C holdings: <span style="color:var(--text3)">Redacted</span></div>
      </div>
      <div style="margin-top:1rem;font-size:0.65rem;color:var(--text3);">
        To kill: <code style="font-family:monospace;color:var(--accent)">sudo kill -9 $(pidof daemon.norm)</code><br>
        Result: daemon.norm returns in 3–12 seconds.
      </div>
    </div>`;
}