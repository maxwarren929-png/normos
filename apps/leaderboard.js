/**
 * NormOS — apps/leaderboard.js v5
 * Fixes: removed DM tab, virus modal double-click prevention, reliable updates
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
        <div style="display:flex;gap:6px;align-items:center;">
          <span id="lb-refresh-indicator" style="font-size:0.6rem;color:var(--text3);"></span>
          <button id="lb-refresh-btn" style="font-size:0.7rem;padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer;">🔄 Refresh</button>
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

    let leaderboard = [], onlineUsers = [], myId = null, isAdmin = false;

    const fmt = (n) => n != null ? '$' + parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // ── Leaderboard render ─────────────────────────────────────────────────────
    const renderBoard = () => {
      wrap.querySelector('#lb-count').textContent = `${leaderboard.length} users`;
      const tbody     = wrap.querySelector('#lb-tbody');
      const onlineSet = new Set(onlineUsers.map(u => u.id));

      if (!leaderboard.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3);">No users yet.</td></tr>';
        return;
      }

      const unlocks = JSON.parse(localStorage.getItem('normos_unlocks') || '[]');

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
              ${isAdmin && !isMe ? '<span style="font-size:0.55rem;color:#f59e0b;margin-left:4px;">⚙</span>' : ''}
            </td>
            <td style="padding:7px 8px;text-align:center;">
              <span style="font-size:0.65rem;${online ? 'color:#4ade80' : 'color:var(--text3)'};">${online ? '● Online' : '○ Offline'}</span>
            </td>
            <td style="padding:7px 8px;text-align:right;color:var(--text2);">${fmt(u.balance)}</td>
            <td style="padding:7px 8px;text-align:right;${(u.netWorth||0) >= 10000 ? 'color:#4ade80' : 'color:#f87171'};">${fmt(u.netWorth)}</td>
            <td style="padding:7px 12px;text-align:center;">
              ${!isMe ? `
                <div style="display:flex;gap:4px;justify-content:center;">
                  <button class="lb-action-btn" data-action="transfer" data-id="${u.id}" data-name="${esc(u.username)}" title="Send Money" style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid var(--border);border-radius:3px;color:var(--text2);cursor:pointer;">💸</button>
                  ${online ? `<button class="lb-action-btn" data-action="virus" data-id="${u.id}" data-name="${esc(u.username)}" title="Deploy Virus" style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid #f87171;border-radius:3px;color:#f87171;cursor:pointer;">☣️</button>` : ''}
                  ${isAdmin ? `<button class="lb-action-btn" data-action="admin" data-id="${u.id}" data-name="${esc(u.username)}" title="Admin" style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid #f59e0b;border-radius:3px;color:#f59e0b;cursor:pointer;">👑</button>` : ''}
                </div>
              ` : ''}
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.lb-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const { action, id, name } = btn.dataset;
          if (action === 'transfer') showTransferModal(id, name);
          if (action === 'virus')    showVirusModal(id, name);
          if (action === 'admin')    showAdminModal(id, name);
        });
      });

      // Update refresh indicator
      const indEl = wrap.querySelector('#lb-refresh-indicator');
      if (indEl) indEl.textContent = `Updated ${new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}`;
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
        // Send by username (toId is actually user id, need username — use toName which is username)
        Network.send({ type: 'money:transfer', to: toName, amount: amt });
        msgEl.style.color = '#4ade80'; msgEl.textContent = `Sending $${amt.toFixed(2)} to ${toName}...`;
        setTimeout(() => { modal.style.display = 'none'; }, 1200);
      });
    };

    // ── Virus modal — prevent double-click exploit ─────────────────────────────
    const showVirusModal = (toId, toName) => {
      const modal = wrap.querySelector('#lb-modal');
      const inner = wrap.querySelector('#lb-modal-inner');
      const unlocks = JSON.parse(localStorage.getItem('normos_unlocks') || '[]');

      const VIRUSES = [
        { type: 'glitch',     icon: '👾', cost: 100,  drain: '2%',  desc: 'Screen glitch effect',   always: true },
        { type: 'generic',    icon: '🦠', cost: 50,   drain: '5%',  desc: 'Basic balance drain',    always: true },
        { type: 'miner',      icon: '⛏️', cost: 200,  drain: '10%', desc: 'Slow drain over 15s',    unlocked: unlocks.includes('virus_miner') },
        { type: 'ransomware', icon: '🔐', cost: 500,  drain: '25%', desc: 'Heavy instant drain',    unlocked: unlocks.includes('virus_ransomware') },
      ];

      const available = VIRUSES.filter(v => v.always || v.unlocked);

      inner.innerHTML = `
        <div style="font-size:0.9rem;font-weight:bold;margin-bottom:12px;color:#f87171;">☣️ Deploy Virus</div>
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:12px;">Target: <span style="color:var(--text1);">${esc(toName)}</span></div>
        ${available.map(v => `
          <div class="virus-option" data-type="${v.type}" data-cost="${v.cost}" style="padding:10px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;margin-bottom:7px;cursor:pointer;transition:opacity .15s;">
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

      // Prevent multiple clicks: disable all options immediately on first click
      inner.querySelectorAll('.virus-option').forEach(el => {
        let clicked = false;
        el.addEventListener('click', () => {
          if (clicked) return; // prevent double-click
          const vtype = el.dataset.type;
          const vcost = parseInt(el.dataset.cost) || 0;
          const v     = VIRUSES.find(x => x.type === vtype);
          const msgEl = inner.querySelector('#virus-msg');
          if (typeof Economy !== 'undefined' && Economy.state.balance < vcost) {
            msgEl.style.color = '#f87171'; msgEl.textContent = `Need $${vcost} to deploy.`; return;
          }

          clicked = true;
          // Disable all virus options visually
          inner.querySelectorAll('.virus-option').forEach(opt => {
            opt.style.opacity = '0.4'; opt.style.pointerEvents = 'none';
          });

          const sent = Network.sendVirus(toId, vtype);
          if (sent) {
            msgEl.style.color = '#4ade80'; msgEl.textContent = `☣️ ${vtype} deployed against ${toName}!`;
          } else {
            msgEl.style.color = '#f87171'; msgEl.textContent = 'Hack on cooldown or failed.';
          }
          setTimeout(() => { modal.style.display = 'none'; }, 1200);
        });
      });
    };

    // ── Admin modal ────────────────────────────────────────────────────────────
    let adminUsersCache = [];

    const showAdminModal = (targetId, targetName) => {
      if (!isAdmin) return;
      const modal = wrap.querySelector('#lb-modal');
      const inner = wrap.querySelector('#lb-modal-inner');

      // Find real name from cache if available
      const cached = adminUsersCache.find(u => u.username.toLowerCase() === targetName.toLowerCase());
      const realName = cached?.realName || '(not loaded)';
      const balance  = cached?.balance != null ? `$${cached.balance.toFixed(2)}` : '—';

      inner.innerHTML = `
        <div style="font-size:0.9rem;font-weight:bold;margin-bottom:4px;color:#f59e0b;">👑 Admin: ${esc(targetName)}</div>
        <div style="font-size:0.68rem;color:var(--text3);margin-bottom:12px;">Real name: <strong style="color:var(--text2)">${esc(realName)}</strong> · Balance: <strong style="color:#4ade80">${balance}</strong></div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
          <div>
            <div style="font-size:0.7rem;color:var(--text3);margin-bottom:4px;">Set Balance ($)</div>
            <div style="display:flex;gap:6px;">
              <input id="admin-balance-input" type="number" min="0" placeholder="New balance"
                style="flex:1;background:var(--bg1);border:1px solid var(--border);border-radius:4px;padding:6px 8px;color:var(--text1);font-size:0.78rem;outline:none;font-family:inherit;" />
              <button id="admin-setbal-btn" style="padding:6px 10px;background:#f59e0b;color:#000;border:none;border-radius:4px;cursor:pointer;font-size:0.72rem;font-weight:bold;">Set</button>
            </div>
          </div>
          <button id="admin-kick-btn" style="padding:8px;background:#374151;color:#fff;border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:bold;">🚪 Kick Player</button>
          <button id="admin-delete-btn" style="padding:8px;background:#7f1d1d;color:#f87171;border:1px solid #f8717166;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:bold;">🗑️ Delete Account</button>
        </div>
        <div id="admin-msg" style="font-size:0.72rem;min-height:18px;color:var(--text3);margin-bottom:8px;"></div>
        <button id="admin-close" style="width:100%;padding:7px;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:4px;cursor:pointer;font-family:inherit;">Close</button>
      `;
      modal.style.display = 'flex';

      inner.querySelector('#admin-close').addEventListener('click', () => { modal.style.display = 'none'; });

      inner.querySelector('#admin-kick-btn').addEventListener('click', () => {
        if (!confirm(`Kick ${targetName}?`)) return;
        Network.adminKick(targetName);
        inner.querySelector('#admin-msg').textContent = `Kicked ${targetName}.`;
        inner.querySelector('#admin-msg').style.color = '#4ade80';
        setTimeout(() => { modal.style.display = 'none'; }, 1000);
      });

      inner.querySelector('#admin-setbal-btn').addEventListener('click', () => {
        const val = parseFloat(inner.querySelector('#admin-balance-input').value);
        if (isNaN(val) || val < 0) {
          inner.querySelector('#admin-msg').textContent = 'Invalid balance.';
          inner.querySelector('#admin-msg').style.color = '#f87171';
          return;
        }
        Network.adminSetBalance(targetName, val);
        inner.querySelector('#admin-msg').textContent = `Balance set to $${val.toFixed(2)}.`;
        inner.querySelector('#admin-msg').style.color = '#4ade80';
        setTimeout(() => { modal.style.display = 'none'; }, 1200);
      });

      inner.querySelector('#admin-delete-btn').addEventListener('click', () => {
        if (!confirm(`PERMANENTLY DELETE account "${targetName}"?\n\nThis cannot be undone. All their data will be erased.`)) return;
        if (typeof Network !== 'undefined') Network.send({ type:'admin:deleteaccount', username:targetName });
        inner.querySelector('#admin-msg').textContent = `Deleting ${targetName}...`;
        inner.querySelector('#admin-msg').style.color = '#f87171';
        setTimeout(() => { modal.style.display = 'none'; }, 1200);
      });
    };

    // ── All users panel (admin only) ──────────────────────────────────────────
    const showAllUsersModal = () => {
      if (!isAdmin) return;
      const modal = wrap.querySelector('#lb-modal');
      const inner = wrap.querySelector('#lb-modal-inner');

      const renderUsers = () => {
        if (!adminUsersCache.length) {
          inner.innerHTML = `<div style="font-size:0.82rem;font-weight:700;color:#f59e0b;margin-bottom:10px;">👑 All Accounts</div>
            <div style="font-size:0.7rem;color:var(--text3)">Loading...</div>
            <button id="auc-close" style="margin-top:12px;width:100%;padding:7px;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:4px;cursor:pointer;">Close</button>`;
          inner.querySelector('#auc-close').addEventListener('click', () => { modal.style.display = 'none'; });
          return;
        }
        inner.innerHTML = `
          <div style="font-size:0.82rem;font-weight:700;color:#f59e0b;margin-bottom:8px;">👑 All Accounts (${adminUsersCache.length})</div>
          <div style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-bottom:10px;">
            ${adminUsersCache.map(u => `
              <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg1);border-radius:5px;border:1px solid var(--border);font-size:0.68rem;">
                <span style="width:10px;height:10px;border-radius:50%;background:${u.online?'#4ade80':'#6b7280'};flex-shrink:0;"></span>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:600;color:var(--text1)">${esc(u.username)}</div>
                  <div style="color:var(--text3);font-size:0.6rem">${esc(u.realName)}</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <div style="color:#4ade80;font-family:var(--font-mono)">$${Number(u.balance).toFixed(0)}</div>
                  ${u.hasLoan ? '<div style="color:#f87171;font-size:0.58rem">LOAN</div>' : ''}
                </div>
              </div>`).join('')}
          </div>
          <button id="auc-close" style="width:100%;padding:7px;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:4px;cursor:pointer;">Close</button>
        `;
        inner.querySelector('#auc-close').addEventListener('click', () => { modal.style.display = 'none'; });
      };

      modal.style.display = 'flex';
      renderUsers();

      if (typeof Network !== 'undefined') Network.send({ type:'admin:getusers' });
    };

    // ── Network events ────────────────────────────────────────────────────────
    const onWelcome = (data) => {
      const s = Network.getState();
      myId    = s.myId;
      isAdmin = s.isAdmin || false;
      onlineUsers = (data.online || []).filter(u => u.username !== 'daemon.norm');
      if (data.leaderboard) { leaderboard = data.leaderboard.filter(u => u.username !== 'daemon.norm'); renderBoard(); }
      // Inject All Users button for admin
      if (isAdmin && !wrap.querySelector('#lb-allusers-btn')) {
        const header = wrap.querySelector('.lb-header');
        if (header) {
          const allBtn = document.createElement('button');
          allBtn.id = 'lb-allusers-btn';
          allBtn.textContent = '👑 All Users';
          allBtn.style.cssText = 'padding:4px 10px;background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b44;border-radius:4px;cursor:pointer;font-size:0.68rem;font-weight:600;margin-left:6px;';
          allBtn.addEventListener('click', showAllUsersModal);
          header.appendChild(allBtn);
        }
      }
    };

    const onLeaderboard = (data) => {
      leaderboard = (data.leaderboard || []).filter(u => u.username !== 'daemon.norm');
      renderBoard();
    };
    const onOnline = (users) => { onlineUsers = users; renderBoard(); };
    const onTransferOk = (data) => {
      if (typeof OS !== 'undefined') OS.notify('💸','NormBank',`Sent $${data.amount.toFixed(2)} to ${data.to}`);
      renderBoard();
    };
    const onVirusSent = (data) => {
      if (typeof OS !== 'undefined') OS.notify('☣️','Virus Sent',`${data.virusType} deployed against ${data.to}!`);
    };
    const onVirusFail = (data) => {
      if (typeof OS !== 'undefined') OS.notify('☣️','Hack Failed', data.reason || 'Failed.');
    };
    const onAdminOk  = (data) => { if(typeof OS!=='undefined') OS.notify('👑','Admin',data.message||'Done'); };
    const onAdminErr = (data) => { if(typeof OS!=='undefined') OS.notify('👑','Admin Error',data.message||'Error'); };
    const onAdminUsers = (data) => {
      adminUsersCache = data.users || [];
      // If all-users modal is open, re-render it
      const modal = wrap.querySelector('#lb-modal');
      if (modal?.style.display !== 'none') {
        const inner = wrap.querySelector('#lb-modal-inner');
        if (inner?.querySelector('#auc-close')) showAllUsersModal();
      }
    };

    Network.on('welcome',           onWelcome);
    Network.on('leaderboard:rich',  onLeaderboard);
    Network.on('online:update',     onOnline);
    Network.on('money:transfer:ok', onTransferOk);
    Network.on('virus:sent',        onVirusSent);
    Network.on('virus:fail',        onVirusFail);
    Network.on('admin:ok',          onAdminOk);
    Network.on('admin:error',       onAdminErr);
    Network.on('admin:users',       onAdminUsers);

    // Refresh button
    wrap.querySelector('#lb-refresh-btn').addEventListener('click', () => {
      if (Network.isConnected()) Network.send({type:'leaderboard:get'});
    });

    if (Network.isConnected()) {
      const s = Network.getState();
      myId    = s.myId;
      isAdmin = s.isAdmin || false;
      onlineUsers = s.online || [];
      Network.send({type:'leaderboard:get'});
    }

    // Auto-refresh every 15s
    const refreshTimer = setInterval(() => {
      if (document.body.contains(wrap) && Network.isConnected()) {
        Network.send({type:'leaderboard:get'});
      } else if (!document.body.contains(wrap)) {
        clearInterval(refreshTimer);
      }
    }, 15000);

    wrap._lbCleanup = () => {
      Network.off('welcome', onWelcome);
      Network.off('leaderboard:rich', onLeaderboard);
      Network.off('online:update', onOnline);
      Network.off('money:transfer:ok', onTransferOk);
      Network.off('virus:sent', onVirusSent);
      Network.off('virus:fail', onVirusFail);
      Network.off('admin:ok', onAdminOk);
      Network.off('admin:error', onAdminErr);
      Network.off('admin:users', onAdminUsers);
      clearInterval(refreshTimer);
    };

    return wrap;
  },
};
