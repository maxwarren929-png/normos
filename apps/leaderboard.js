/**
 * NormOS — apps/leaderboard.js
 * Rich leaderboard: all users, net worth, DMs, money transfers, virus attacks
 */

const LeaderboardApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;height:100%;background:var(--bg1);color:var(--text1);font-family:var(--font-mono,monospace);overflow:hidden;flex-direction:column;';

    wrap.innerHTML = `
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <span style="font-size:0.95rem;font-weight:bold;color:var(--accent);">🏆 NormNet Leaderboard</span>
          <span id="lb-count" style="font-size:0.7rem;color:var(--text3);margin-left:10px;"></span>
        </div>
        <div style="display:flex;gap:6px;">
          <button id="lb-tab-board" style="font-size:0.7rem;padding:3px 10px;border-radius:4px;border:1px solid var(--accent);background:var(--accent);color:#000;cursor:pointer;">🏆 Board</button>
          <button style="font-size:0.7rem;padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer;" onclick="if(typeof OS!=='undefined')OS.apps.open('social')">💬 Messages →</button>
        </div>
      </div>

      <!-- Leaderboard panel -->
      <div id="lb-panel-board" style="flex:1;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.73rem;">
          <thead>
            <tr style="color:var(--text3);border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg1);z-index:1;">
              <th style="padding:6px 12px;text-align:left;width:36px;">#</th>
              <th style="padding:6px 8px;text-align:left;">User</th>
              <th style="padding:6px 8px;text-align:center;">Status</th>
              <th style="padding:6px 8px;text-align:right;">Balance</th>
              <th style="padding:6px 8px;text-align:right;">Net Worth</th>
              <th style="padding:6px 12px;text-align:center;">Actions</th>
            </tr>
          </thead>
          <tbody id="lb-tbody"></tbody>
        </table>
      </div>

      <!-- Action modal -->
      <div id="lb-modal" style="display:none;position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:100;align-items:center;justify-content:center;">
        <div id="lb-modal-inner" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:20px;min-width:280px;max-width:360px;"></div>
      </div>
    `;

    wrap.style.position = 'relative';

    let leaderboard = [], onlineUsers = [], myId = null;
    let activeDmId = null;

    const fmt = (n) => n != null ? '$' + parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const panelBoard = wrap.querySelector('#lb-panel-board');

    // ── Leaderboard render ─────────────────────────────────────────────────────
    const renderBoard = () => {
      wrap.querySelector('#lb-count').textContent = `${leaderboard.length} users`;
      const tbody    = wrap.querySelector('#lb-tbody');
      const onlineSet = new Set(onlineUsers.map(u => u.id));

      if (!leaderboard.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3);">No users yet.</td></tr>'; return; }

      // Check unlocked viruses
      const unlocks = JSON.parse(localStorage.getItem('normos_unlocks') || '[]');
      const hasRansom = unlocks.includes('virus_ransomware');
      const hasMiner  = unlocks.includes('virus_miner');

      tbody.innerHTML = leaderboard.map((u, i) => {
        const online = onlineSet.has(u.id) || u.online;
        const isMe   = u.id === myId;
        const rank   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
        return `
          <tr style="border-bottom:1px solid var(--border);${isMe ? 'background:rgba(79,158,255,0.07);' : ''}">
            <td style="padding:7px 12px;color:var(--text3);">${rank}</td>
            <td style="padding:7px 8px;">
              <span style="color:${u.color};font-weight:bold;">${esc(u.username)}</span>
              ${isMe ? '<span style="font-size:0.6rem;color:var(--accent);margin-left:5px;">(you)</span>' : ''}
            </td>
            <td style="padding:7px 8px;text-align:center;">
              <span style="font-size:0.65rem;${online ? 'color:#4ade80' : 'color:var(--text3)'};">${online ? '● Online' : '○ Offline'}</span>
            </td>
            <td style="padding:7px 8px;text-align:right;color:var(--text2);">${fmt(u.balance)}</td>
            <td style="padding:7px 8px;text-align:right;${(u.netWorth||0) >= 10000 ? 'color:#4ade80' : 'color:#f87171'};">${fmt(u.netWorth)}</td>
            <td style="padding:7px 12px;text-align:center;">
              ${!isMe ? `
                <div style="display:flex;gap:4px;justify-content:center;">
                  <button class="lb-action-btn" data-action="dm"       data-id="${u.id}" data-name="${esc(u.username)}" title="Send DM"        style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid var(--border);border-radius:3px;color:var(--text2);cursor:pointer;">💬</button>
                  <button class="lb-action-btn" data-action="transfer" data-id="${u.id}" data-name="${esc(u.username)}" title="Send Money"      style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid var(--border);border-radius:3px;color:var(--text2);cursor:pointer;">💸</button>
                  ${online ? `<button class="lb-action-btn" data-action="virus"    data-id="${u.id}" data-name="${esc(u.username)}" title="Deploy Virus" style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid #f87171;border-radius:3px;color:#f87171;cursor:pointer;">☣️</button>` : ''}
                </div>
              ` : ''}
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.lb-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const { action, id, name } = btn.dataset;
          if (action === 'dm')       openDm(id, name);
          if (action === 'transfer') showTransferModal(id, name);
          if (action === 'virus')    showVirusModal(id, name);
        });
      });
    };

    // ── Transfer modal ─────────────────────────────────────────────────────────
    const showTransferModal = (toId, toName) => {
      const modal = wrap.querySelector('#lb-modal');
      const inner = wrap.querySelector('#lb-modal-inner');
      const bal   = typeof Economy !== 'undefined' ? Economy.state.balance : 0;
      inner.innerHTML = `
        <div style="font-size:0.9rem;font-weight:bold;margin-bottom:12px;color:var(--accent);">💸 Send Money</div>
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:10px;">To: <span style="color:var(--text1);">${esc(toName)}</span></div>
        <div style="font-size:0.7rem;color:var(--text3);margin-bottom:6px;">Your balance: $${typeof Economy !== 'undefined' ? Economy.fmt(bal) : '0.00'}</div>
        <input id="transfer-amt" type="number" min="1" placeholder="Amount" value="100"
          style="width:100%;background:var(--bg1);border:1px solid var(--border);border-radius:4px;padding:7px 10px;color:var(--text1);font-size:0.82rem;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:12px;" />
        <div id="transfer-msg" style="font-size:0.72rem;min-height:18px;margin-bottom:8px;"></div>
        <div style="display:flex;gap:8px;">
          <button id="transfer-send" style="flex:1;padding:7px;background:var(--accent);color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-family:inherit;">Send</button>
          <button id="transfer-cancel" style="flex:1;padding:7px;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:4px;cursor:pointer;font-family:inherit;">Cancel</button>
        </div>
      `;
      modal.style.display = 'flex';

      inner.querySelector('#transfer-cancel').addEventListener('click', () => { modal.style.display = 'none'; });
      inner.querySelector('#transfer-send').addEventListener('click', () => {
        const amt = parseFloat(inner.querySelector('#transfer-amt').value) || 0;
        const msgEl = inner.querySelector('#transfer-msg');
        if (amt <= 0) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Enter a valid amount.'; return; }
        if (typeof Economy !== 'undefined' && amt > Economy.state.balance) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Insufficient funds.'; return; }
        Network.send({ type: 'money:transfer', to: toId, amount: amt });
        msgEl.style.color = '#4ade80'; msgEl.textContent = `Sending $${amt.toFixed(2)} to ${toName}...`;
        setTimeout(() => { modal.style.display = 'none'; }, 1200);
      });
    };

    // ── Virus modal ────────────────────────────────────────────────────────────
    const showVirusModal = (toId, toName) => {
      const modal = wrap.querySelector('#lb-modal');
      const inner = wrap.querySelector('#lb-modal-inner');
      const unlocks = JSON.parse(localStorage.getItem('normos_unlocks') || '[]');

      const VIRUSES = [
        { type: 'glitch',     icon: '👾', cost: 100,  drain: '2%',  desc: 'Screen glitch effect',            always: true },
        { type: 'generic',    icon: '🦠', cost: 50,   drain: '5%',  desc: 'Basic balance drain',             always: true },
        { type: 'miner',      icon: '⛏️', cost: 200,  drain: '10%', desc: 'Slow drain over 15s',             unlocked: unlocks.includes('virus_miner') },
        { type: 'ransomware', icon: '🔐', cost: 500,  drain: '25%', desc: 'Heavy instant drain',             unlocked: unlocks.includes('virus_ransomware') },
      ];

      const available = VIRUSES.filter(v => v.always || v.unlocked);

      inner.innerHTML = `
        <div style="font-size:0.9rem;font-weight:bold;margin-bottom:12px;color:#f87171;">☣️ Deploy Virus</div>
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:12px;">Target: <span style="color:var(--text1);">${esc(toName)}</span></div>
        ${available.map(v => `
          <div class="virus-option" data-type="${v.type}" style="padding:10px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;margin-bottom:7px;cursor:pointer;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.82rem;">${v.icon} ${v.type.charAt(0).toUpperCase()+v.type.slice(1)}</span>
              <span style="font-size:0.72rem;color:#f87171;">$${v.cost}</span>
            </div>
            <div style="font-size:0.65rem;color:var(--text3);margin-top:3px;">${v.desc} — drains ${v.drain}</div>
          </div>
        `).join('')}
        ${VIRUSES.filter(v => !v.always && !v.unlocked).map(v => `
          <div style="padding:10px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;margin-bottom:7px;opacity:0.4;">
            <div style="display:flex;justify-content:space-between;">
              <span style="font-size:0.82rem;">🔒 ${v.type.charAt(0).toUpperCase()+v.type.slice(1)}</span>
              <span style="font-size:0.65rem;color:var(--text3);">Buy in NormShop</span>
            </div>
          </div>
        `).join('')}
        <div id="virus-msg" style="font-size:0.72rem;min-height:18px;margin-top:4px;"></div>
        <button id="virus-cancel" style="width:100%;margin-top:8px;padding:7px;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:4px;cursor:pointer;font-family:inherit;">Cancel</button>
      `;
      modal.style.display = 'flex';

      inner.querySelector('#virus-cancel').addEventListener('click', () => { modal.style.display = 'none'; });
      inner.querySelectorAll('.virus-option').forEach(el => {
        el.addEventListener('click', () => {
          const vtype = el.dataset.type;
          const v     = VIRUSES.find(x => x.type === vtype);
          const msgEl = inner.querySelector('#virus-msg');
          if (typeof Economy !== 'undefined' && Economy.state.balance < v.cost) {
            msgEl.style.color = '#f87171'; msgEl.textContent = `Need $${v.cost} to deploy.`; return;
          }
          Network.send({ type: 'virus:send', to: toId, virusType: vtype });
          msgEl.style.color = '#4ade80'; msgEl.textContent = `☣️ ${vtype} deployed against ${toName}!`;
          setTimeout(() => { modal.style.display = 'none'; }, 1200);
        });
      });
    };

    // ── DM: redirect to Social app ────────────────────────────────────────────
    const openDm = (id, name) => {
      if (typeof OS !== 'undefined') OS.apps.open('social');
    };

    // ── Network events ────────────────────────────────────────────────────────
    const onWelcome = (data) => {
      myId        = Network.getState().myId;
      onlineUsers = data.online || [];
      if (data.leaderboard) { leaderboard = data.leaderboard; renderBoard(); }
    };

    const onLeaderboard = (data) => { leaderboard = data.leaderboard || []; renderBoard(); };
    const onOnline      = (users) => { onlineUsers = users; renderBoard(); };
    const onTransferOk  = (data)  => { if (typeof OS !== 'undefined') OS.notify('💸','NormBank',`Sent $${data.amount.toFixed(2)} to ${data.to}`); renderBoard(); };
    const onVirusSent   = (data)  => { if (typeof OS !== 'undefined') OS.notify('☣️','Virus Sent',`${data.virusType} deployed against ${data.to}!`); };

    Network.on('welcome',           onWelcome);
    Network.on('leaderboard:rich',  onLeaderboard);
    Network.on('online:update',     onOnline);
    Network.on('money:transfer:ok', onTransferOk);
    Network.on('virus:sent',        onVirusSent);

    if (Network.isConnected()) {
      const s = Network.getState();
      myId = s.myId; onlineUsers = s.online || [];
      Network.send({ type: 'leaderboard:get' });
    }

    // Sync economy every 5s
    const syncTimer = setInterval(() => {
      if (typeof Economy !== 'undefined' && Network.isConnected()) {
        Network.send({ type: 'economy:sync', balance: Economy.state.balance, netWorth: Economy.totalValue() });
      }
    }, 5000);

    wrap._lbCleanup = () => {
      Network.off('welcome', onWelcome);
      Network.off('leaderboard:rich', onLeaderboard);
      Network.off('online:update', onOnline);
      Network.off('money:transfer:ok', onTransferOk);
      Network.off('virus:sent', onVirusSent);
      clearInterval(syncTimer);
    };

    return wrap;
  },
};
