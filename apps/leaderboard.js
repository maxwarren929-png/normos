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
        <div id="lb-admin-btns" style="display:none;gap:6px;">
          <button id="lb-tab-board" style="font-size:0.7rem;padding:3px 10px;border-radius:4px;border:1px solid var(--accent);background:var(--accent);color:#000;cursor:pointer;">🏆 Board</button>
          <button id="lb-tab-admin" style="font-size:0.7rem;padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer;">🔨 Admin</button>
        </div>
        <div id="lb-normal-btns" style="gap:6px;">
          <button id="lb-tab-board2" style="font-size:0.7rem;padding:3px 10px;border-radius:4px;border:1px solid var(--accent);background:var(--accent);color:#000;cursor:pointer;">🏆 Board</button>
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

      <!-- Admin panel (Ko1 only) -->
      <div id="lb-panel-admin" style="flex:1;display:none;overflow-y:auto;padding:16px;">
        <div style="color:#f59e0b;font-size:0.8rem;font-weight:bold;margin-bottom:12px;">🔨 Admin Panel — Ko1 Only</div>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          <input id="adm-target" placeholder="Username" style="flex:1;min-width:120px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:5px 8px;color:var(--text1);font-size:0.75rem;outline:none;font-family:inherit;" />
          <input id="adm-balance" placeholder="New Balance ($)" type="number" style="flex:1;min-width:120px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:5px 8px;color:var(--text1);font-size:0.75rem;outline:none;font-family:inherit;" />
        </div>
        <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
          <button id="adm-setbal" style="padding:5px 12px;background:#f59e0b;color:#000;border:none;border-radius:4px;cursor:pointer;font-size:0.72rem;font-weight:bold;">💰 Set Balance</button>
          <button id="adm-kick" style="padding:5px 12px;background:#f87171;color:#000;border:none;border-radius:4px;cursor:pointer;font-size:0.72rem;font-weight:bold;">🔨 Kick User</button>
          <button id="adm-realnames" style="padding:5px 12px;background:var(--bg2);color:var(--text1);border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:0.72rem;">👁 View Real Names</button>
        </div>
        <div id="adm-status" style="font-size:0.72rem;min-height:18px;color:#4ade80;margin-bottom:12px;"></div>
        <div id="adm-realnames-list" style="font-size:0.72rem;color:var(--text2);"></div>
      </div>

      <!-- Action modal -->
      <div id="lb-modal" style="display:none;position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:100;align-items:center;justify-content:center;">
        <div id="lb-modal-inner" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:20px;min-width:280px;max-width:360px;"></div>
      </div>
    `;

    wrap.style.position = 'relative';

    let leaderboard = [], onlineUsers = [], myId = null;
    let isAdmin = false;
    let paywallProfiles = {}; // { username: { normtok:{price}, normtunes:{price} } }

    const fmt = (n) => n != null ? '$' + parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const panelBoard = wrap.querySelector('#lb-panel-board');
    const panelAdmin = wrap.querySelector('#lb-panel-admin');

    const switchTab = (t) => {
      panelBoard.style.display = t==='board' ? 'block' : 'none';
      panelAdmin.style.display = t==='admin' ? 'block' : 'none';
    };

    wrap.querySelector('#lb-tab-board2')?.addEventListener('click', () => switchTab('board'));
    wrap.querySelector('#lb-tab-board')?.addEventListener('click', () => switchTab('board'));
    wrap.querySelector('#lb-tab-admin')?.addEventListener('click', () => switchTab('admin'));

    // ── Admin panel ───────────────────────────────────────────────────────────
    const setupAdmin = () => {
      if (!isAdmin) return;
      wrap.querySelector('#lb-admin-btns').style.display = 'flex';
      wrap.querySelector('#lb-normal-btns').style.display = 'none';
      const admStatus = wrap.querySelector('#adm-status');
      wrap.querySelector('#adm-setbal')?.addEventListener('click', () => {
        const t = wrap.querySelector('#adm-target').value.trim();
        const b = parseFloat(wrap.querySelector('#adm-balance').value);
        if (!t || isNaN(b)) { admStatus.style.color='#f87171'; admStatus.textContent='Fill in username and amount.'; return; }
        Network.adminSetBal(t, b);
        admStatus.style.color='#4ade80'; admStatus.textContent=`Setting balance for ${t}...`;
      });
      wrap.querySelector('#adm-kick')?.addEventListener('click', () => {
        const t = wrap.querySelector('#adm-target').value.trim();
        if (!t) { admStatus.style.color='#f87171'; admStatus.textContent='Enter a username to kick.'; return; }
        if (!confirm(`Kick ${t}?`)) return;
        Network.adminKick(t, 'Kicked by admin.');
        admStatus.style.color='#4ade80'; admStatus.textContent=`Kicked ${t}.`;
      });
      wrap.querySelector('#adm-realnames')?.addEventListener('click', () => {
        Network.adminGetNames();
      });
      Network.on('admin:ok', (d) => { admStatus.style.color='#4ade80'; admStatus.textContent=`✅ Done: ${d.action} on ${d.target}`; });
      Network.on('admin:fail', (d) => { admStatus.style.color='#f87171'; admStatus.textContent=`❌ ${d.reason}`; });
      Network.on('admin:realnames', (d) => {
        const list = wrap.querySelector('#adm-realnames-list');
        if (!list) return;
        list.innerHTML = '<div style="color:var(--text3);margin-bottom:6px;font-size:0.68rem;">REAL NAMES (Ko1 eyes only):</div>' +
          (d.names||[]).map(n=>`<div style="padding:3px 0;border-bottom:1px solid var(--border)">${esc(n.username)}: <span style="color:#f59e0b">${esc(n.realName||'(not provided)')}</span></div>`).join('');
      });
    };

    // ── Leaderboard render ─────────────────────────────────────────────────────
    const renderBoard = () => {
      wrap.querySelector('#lb-count').textContent = `${leaderboard.length} entries`;
      const tbody    = wrap.querySelector('#lb-tbody');
      const onlineSet = new Set(onlineUsers.map(u => u.id));

      if (!leaderboard.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3);">No users yet.</td></tr>'; return; }

      // Check unlocked viruses
      const unlocks = JSON.parse(localStorage.getItem('normos_unlocks') || '[]');
      const hasRansom = unlocks.includes('virus_ransomware');
      const hasMiner  = unlocks.includes('virus_miner');

      tbody.innerHTML = leaderboard.map((u, i) => {
        const isBank = u.isBank === true;
        const online = isBank ? true : (onlineSet.has(u.id) || u.online);
        const isMe   = u.id === myId;
        const rank   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;

        if (isBank) {
          // Special NormBank row
          return `
            <tr style="border-bottom:2px solid #4ade8044;background:rgba(74,222,128,0.04);">
              <td style="padding:7px 12px;color:var(--text3);">${rank}</td>
              <td style="padding:7px 8px;">
                <span style="color:#4ade80;font-weight:bold;">🏦 NormBank</span>
                <span style="font-size:0.58rem;color:var(--text3);display:block;margin-top:1px;">Community vault — all deposited funds</span>
              </td>
              <td style="padding:7px 8px;text-align:center;">
                <span style="font-size:0.65rem;color:#4ade80;">● Always Online</span>
              </td>
              <td style="padding:7px 8px;text-align:right;color:#4ade80;font-weight:bold;">${fmt(u.balance)}</td>
              <td style="padding:7px 8px;text-align:right;color:#4ade80;font-weight:bold;">${fmt(u.netWorth)}</td>
              <td style="padding:7px 12px;text-align:center;">
                <button class="lb-action-btn" data-action="hackbank" title="Attempt to hack NormBank (2% chance)" style="font-size:0.6rem;padding:3px 8px;background:rgba(248,113,113,0.15);border:1px solid #f87171;border-radius:3px;color:#f87171;cursor:pointer;">💀 Hack (2%)</button>
              </td>
            </tr>
          `;
        }

        // paywall icons
        const pw = paywallProfiles[u.username] || {};
        const tokLock  = pw.normtok  ? `<span title="NormTok locked: $${pw.normtok.price}" style="font-size:0.6rem;color:#f59e0b;margin-left:4px;">🔒📱</span>` : '';
        const tuneLock = pw.normtunes? `<span title="NormTunes locked: $${pw.normtunes.price}" style="font-size:0.6rem;color:#f59e0b;margin-left:4px;">🔒🎵</span>` : '';

        return `
          <tr style="border-bottom:1px solid var(--border);${isMe ? 'background:rgba(79,158,255,0.07);' : ''}">
            <td style="padding:7px 12px;color:var(--text3);">${rank}</td>
            <td style="padding:7px 8px;">
              <span style="color:${u.color};font-weight:bold;">${esc(u.username)}</span>${tokLock}${tuneLock}
              ${isMe ? '<span style="font-size:0.6rem;color:var(--accent);margin-left:5px;">(you)</span>' : ''}
            </td>
            <td style="padding:7px 8px;text-align:center;">
              <span style="font-size:0.65rem;${online ? 'color:#4ade80' : 'color:var(--text3)'};">${online ? '● Online' : '○ Offline'}</span>
            </td>
            <td style="padding:7px 8px;text-align:right;color:var(--text2);">${fmt(u.balance)}</td>
            <td style="padding:7px 8px;text-align:right;${(u.netWorth||0) >= 10000 ? 'color:#4ade80' : 'color:#f87171'};">${fmt(u.netWorth)}</td>
            <td style="padding:7px 12px;text-align:center;">
              ${!isMe ? `
                <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
                  <button class="lb-action-btn" data-action="transfer" data-id="${u.id}" data-name="${esc(u.username)}" title="Send Money" style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid var(--border);border-radius:3px;color:var(--text2);cursor:pointer;">💸</button>
                  ${online ? `<button class="lb-action-btn" data-action="virus" data-id="${u.id}" data-name="${esc(u.username)}" title="Deploy Virus" style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid #f87171;border-radius:3px;color:#f87171;cursor:pointer;">☣️</button>` : ''}
                  ${pw.normtok  ? `<button class="lb-action-btn" data-action="unlock-normtok"   data-name="${esc(u.username)}" data-price="${pw.normtok.price}"  title="Unlock NormTok ($${pw.normtok.price})"  style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid #f59e0b;border-radius:3px;color:#f59e0b;cursor:pointer;">🔓📱</button>` : ''}
                  ${pw.normtunes? `<button class="lb-action-btn" data-action="unlock-normtunes" data-name="${esc(u.username)}" data-price="${pw.normtunes.price}" title="Unlock NormTunes ($${pw.normtunes.price})" style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid #f59e0b;border-radius:3px;color:#f59e0b;cursor:pointer;">🔓🎵</button>` : ''}
                </div>
              ` : ''}
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.lb-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const { action, id, name, price } = btn.dataset;
          if (action === 'transfer') showTransferModal(id, name);
          if (action === 'virus')    showVirusModal(id, name);
          if (action === 'hackbank') showBankHackModal();
          if (action === 'unlock-normtok')   showUnlockModal(name, 'normtok',   parseFloat(price));
          if (action === 'unlock-normtunes') showUnlockModal(name, 'normtunes', parseFloat(price));
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

    // ── Bank Hack modal ────────────────────────────────────────────────────────
    const showBankHackModal = () => {
      const modal = wrap.querySelector('#lb-modal');
      const inner = wrap.querySelector('#lb-modal-inner');
      const unlocks = JSON.parse(localStorage.getItem('normos_unlocks') || '[]');
      const VIRUSES = [
        { type:'generic',    icon:'🦠', drain:'3%',  always:true },
        { type:'glitch',     icon:'👾', drain:'5%',  always:true },
        { type:'miner',      icon:'⛏️', drain:'10%', unlocked:unlocks.includes('virus_miner') },
        { type:'ransomware', icon:'🔐', drain:'20%', unlocked:unlocks.includes('virus_ransomware') },
      ].filter(v=>v.always||v.unlocked);

      inner.innerHTML = `
        <div style="font-size:0.9rem;font-weight:bold;margin-bottom:8px;color:#f87171;">💀 Hack NormBank</div>
        <div style="font-size:0.72rem;color:#f59e0b;background:rgba(245,158,11,0.1);border:1px solid #f59e0b44;border-radius:5px;padding:8px;margin-bottom:12px;line-height:1.5;">
          ⚠️ <strong>2% success rate.</strong> NormBank holds ALL deposited money.<br>
          If it works, stolen funds are split proportionally among all depositors.<br>
          NormBank's firewall is formidable. You've been warned.
        </div>
        <div style="font-size:0.72rem;color:var(--text2);margin-bottom:8px;">Choose your weapon:</div>
        ${VIRUSES.map(v=>`
          <div class="bank-virus-opt" data-type="${v.type}" style="padding:8px 12px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;margin-bottom:6px;cursor:pointer;display:flex;align-items:center;gap:10px;">
            <span>${v.icon}</span>
            <span style="font-size:0.78rem;font-weight:bold;flex:1;">${v.type.charAt(0).toUpperCase()+v.type.slice(1)}</span>
            <span style="font-size:0.68rem;color:#f87171;">drains ${v.drain} of vault</span>
          </div>
        `).join('')}
        <div id="bank-hack-msg" style="font-size:0.72rem;min-height:18px;margin-top:6px;"></div>
        <button id="bank-hack-cancel" style="width:100%;margin-top:8px;padding:7px;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:4px;cursor:pointer;font-family:inherit;">Cancel</button>
      `;
      modal.style.display = 'flex';
      inner.querySelector('#bank-hack-cancel').addEventListener('click', () => { modal.style.display = 'none'; });
      inner.querySelectorAll('.bank-virus-opt').forEach(el => {
        el.addEventListener('click', () => {
          const vtype = el.dataset.type;
          const msgEl = inner.querySelector('#bank-hack-msg');
          if (typeof Network !== 'undefined') Network.hackBank(vtype);
          msgEl.style.color = '#f59e0b'; msgEl.textContent = `☣️ ${vtype} sent to NormBank... rolling the dice (2% chance)...`;
          setTimeout(() => { modal.style.display = 'none'; }, 2000);
        });
      });
      Network.on('virus:bank:success', (d) => {
        if (typeof OS !== 'undefined') OS.notify('🏦💰','BANK HEIST',`You stole $${(d.stolen||0).toFixed(2)}!`);
      });
      Network.on('virus:fail', (d) => {
        if (d.reason && d.reason.includes('NormBank')) {
          if (typeof OS !== 'undefined') OS.notify('🏦🛡️','Bank Firewall', d.reason);
        }
      });
    };

    // ── Paywall unlock modal ───────────────────────────────────────────────────
    const showUnlockModal = (owner, mediaType, price) => {
      const modal = wrap.querySelector('#lb-modal');
      const inner = wrap.querySelector('#lb-modal-inner');
      const label = mediaType === 'normtok' ? '📱 NormTok' : '🎵 NormTunes';
      const bal   = typeof Economy !== 'undefined' ? Economy.state.balance : 0;
      inner.innerHTML = `
        <div style="font-size:0.9rem;font-weight:bold;margin-bottom:12px;color:#f59e0b;">🔓 Unlock ${label}</div>
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:8px;">${esc(owner)}'s ${label} is subscriber-only.</div>
        <div style="font-size:1.1rem;font-weight:bold;color:var(--text1);text-align:center;padding:12px;background:var(--bg1);border-radius:6px;margin-bottom:12px;">
          💰 $${price.toFixed(2)} one-time access
        </div>
        <div style="font-size:0.68rem;color:var(--text3);margin-bottom:12px;">Your balance: $${bal.toFixed(2)}</div>
        <div id="unlock-msg" style="font-size:0.72rem;min-height:18px;margin-bottom:8px;"></div>
        <div style="display:flex;gap:8px;">
          <button id="unlock-pay" style="flex:1;padding:7px;background:#f59e0b;color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-family:inherit;">Pay & Unlock</button>
          <button id="unlock-cancel" style="flex:1;padding:7px;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:4px;cursor:pointer;font-family:inherit;">Cancel</button>
        </div>
      `;
      modal.style.display = 'flex';
      inner.querySelector('#unlock-cancel').addEventListener('click', () => { modal.style.display = 'none'; });
      inner.querySelector('#unlock-pay').addEventListener('click', () => {
        const msgEl = inner.querySelector('#unlock-msg');
        if (bal < price) { msgEl.style.color='#f87171'; msgEl.textContent=`Need $${price.toFixed(2)}.`; return; }
        if (typeof Network !== 'undefined') Network.unlockPaywall(owner, mediaType);
        msgEl.style.color = '#4ade80'; msgEl.textContent = 'Paying...';
        Network.on('media:paywall:unlock:ok', (d) => {
          msgEl.textContent = `✅ Unlocked! Opening ${label}...`;
          // Store unlock locally so the app opens
          try {
            const key = `normos_paywall_unlocked_${owner}_${mediaType}`;
            localStorage.setItem(key, '1');
          } catch {}
          setTimeout(() => { modal.style.display = 'none'; }, 1000);
        });
        Network.on('media:paywall:unlock:fail', (d) => {
          msgEl.style.color='#f87171'; msgEl.textContent = d.reason || 'Failed.';
        });
      });
    };

    // ── Network events ────────────────────────────────────────────────────────
    const onWelcome = (data) => {
      const s = Network.getState();
      myId        = s.myId;
      isAdmin     = s.isAdmin || (s.username && s.username.toLowerCase()==='ko1');
      onlineUsers = (data.online || []).filter(u => u.username !== 'daemon.norm');
      if (data.leaderboard) { leaderboard = data.leaderboard.filter(u => u.username !== 'daemon.norm'); renderBoard(); }
      setupAdmin();
    };

    const onLeaderboard = (data) => { leaderboard = (data.leaderboard || []).filter(u => u.username !== 'daemon.norm'); renderBoard(); };
    const onOnline      = (users) => { onlineUsers = users.filter(u=>u.username!=='daemon.norm'); renderBoard(); };
    const onTransferOk  = (data)  => { if (typeof OS !== 'undefined') OS.notify('💸','NormBank',`Sent $${data.amount.toFixed(2)} to ${data.to}`); renderBoard(); };
    const onVirusSent   = (data)  => { if (typeof OS !== 'undefined') OS.notify('☣️','Virus Sent',`${data.virusType} deployed against ${data.to}!`); };
    const onPaywallProfiles = (data) => {
      paywallProfiles = {};
      (data.profiles||[]).forEach(p => { paywallProfiles[p.username] = p.paywalls; });
      renderBoard();
    };

    Network.on('welcome',                onWelcome);
    Network.on('leaderboard:rich',       onLeaderboard);
    Network.on('online:update',          onOnline);
    Network.on('money:transfer:ok',      onTransferOk);
    Network.on('virus:sent',             onVirusSent);
    Network.on('media:paywall:profiles', onPaywallProfiles);

    if (Network.isConnected()) {
      const s = Network.getState();
      myId = s.myId; isAdmin = s.isAdmin || (s.username && s.username.toLowerCase()==='ko1');
      onlineUsers = (s.online || []).filter(u=>u.username!=='daemon.norm');
      Network.send({ type: 'leaderboard:get' });
      Network.getPaywalls();
      setupAdmin();
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
      Network.off('media:paywall:profiles', onPaywallProfiles);
      clearInterval(syncTimer);
    };

    return wrap;
  },
};
