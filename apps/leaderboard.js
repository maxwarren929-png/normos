/**
 * NormOS — apps/leaderboard.js v4.2
 * Rich leaderboard: users, NormBank hacking, paywall unlocks, transfers, viruses
 */

const LeaderboardApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;height:100%;background:var(--bg1);color:var(--text1);font-family:var(--font-mono,monospace);overflow:hidden;flex-direction:column;position:relative;';

    wrap.innerHTML = `
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <span style="font-size:0.95rem;font-weight:bold;color:var(--accent);">🏆 NormNet Leaderboard</span>
          <span id="lb-count" style="font-size:0.7rem;color:var(--text3);margin-left:10px;"></span>
        </div>
        <div style="display:flex;gap:6px;">
          <button id="lb-tab-board" style="font-size:0.7rem;padding:3px 10px;border-radius:4px;border:1px solid var(--accent);background:var(--accent);color:#000;cursor:pointer;">🏆 Board</button>
          <button id="lb-tab-admin" style="display:none;font-size:0.7rem;padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer;">🔨 Admin</button>
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
          <tbody id="lb-tbody"><tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3);">Connecting…</td></tr></tbody>
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

    let leaderboard   = [];
    let onlineUsers   = [];
    let myId          = null;
    let isAdmin       = false;
    let paywallProfiles = {};  // { username: { normtok:{price}, normtunes:{price} } }

    const fmt = (n) => n != null ? '$' + parseFloat(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
    const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const closeModal = () => { wrap.querySelector('#lb-modal').style.display = 'none'; };

    // ── Tab switching ──────────────────────────────────────────────────────────
    wrap.querySelector('#lb-tab-board').addEventListener('click', () => {
      wrap.querySelector('#lb-panel-board').style.display = '';
      wrap.querySelector('#lb-panel-admin').style.display = 'none';
      wrap.querySelector('#lb-tab-board').style.background = 'var(--accent)';
      wrap.querySelector('#lb-tab-board').style.color = '#000';
      wrap.querySelector('#lb-tab-admin').style.background = 'transparent';
      wrap.querySelector('#lb-tab-admin').style.color = 'var(--text2)';
    });
    wrap.querySelector('#lb-tab-admin').addEventListener('click', () => {
      wrap.querySelector('#lb-panel-board').style.display = 'none';
      wrap.querySelector('#lb-panel-admin').style.display = '';
      wrap.querySelector('#lb-tab-admin').style.background = '#f59e0b';
      wrap.querySelector('#lb-tab-admin').style.color = '#000';
      wrap.querySelector('#lb-tab-board').style.background = 'transparent';
      wrap.querySelector('#lb-tab-board').style.color = 'var(--text2)';
    });

    // ── Admin panel setup ──────────────────────────────────────────────────────
    const setupAdmin = () => {
      if (!isAdmin) return;
      wrap.querySelector('#lb-tab-admin').style.display = '';
      const admStatus = wrap.querySelector('#adm-status');
      wrap.querySelector('#adm-setbal').addEventListener('click', () => {
        const t = wrap.querySelector('#adm-target').value.trim();
        const b = parseFloat(wrap.querySelector('#adm-balance').value);
        if (!t || isNaN(b)) { admStatus.style.color='#f87171'; admStatus.textContent='Fill in username and amount.'; return; }
        if (typeof Network !== 'undefined') Network.adminSetBal(t, b);
        admStatus.style.color='#4ade80'; admStatus.textContent=`Setting balance for ${t}...`;
      });
      wrap.querySelector('#adm-kick').addEventListener('click', () => {
        const t = wrap.querySelector('#adm-target').value.trim();
        if (!t) { admStatus.style.color='#f87171'; admStatus.textContent='Enter a username to kick.'; return; }
        if (!confirm(`Kick ${t}?`)) return;
        if (typeof Network !== 'undefined') Network.adminKick(t,'Kicked by admin.');
        admStatus.style.color='#4ade80'; admStatus.textContent=`Kicked ${t}.`;
      });
      wrap.querySelector('#adm-realnames').addEventListener('click', () => {
        if (typeof Network !== 'undefined') Network.adminGetNames();
      });
    };

    // ── Render leaderboard ─────────────────────────────────────────────────────
    const renderBoard = () => {
      const tbody = wrap.querySelector('#lb-tbody');
      if (!tbody) return;
      const onlineSet = new Set(onlineUsers.map(u => u.id));
      const unlocks   = (() => { try { return JSON.parse(localStorage.getItem('normos_unlocks')||'[]'); } catch { return []; } })();

      wrap.querySelector('#lb-count').textContent = `${leaderboard.length} entries`;

      if (!leaderboard.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3);">No users yet.</td></tr>';
        return;
      }

      tbody.innerHTML = leaderboard.map((u, i) => {
        const isBank = u.isBank === true;
        const isMe   = u.id === myId;
        const rank   = i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`;

        if (isBank) {
          return `
            <tr style="border-bottom:2px solid rgba(74,222,128,0.25);background:rgba(74,222,128,0.04);">
              <td style="padding:7px 12px;color:var(--text3);">${rank}</td>
              <td style="padding:7px 8px;">
                <span style="color:#4ade80;font-weight:bold;">🏦 NormBank</span>
                <span style="font-size:0.58rem;color:var(--text3);display:block;">Community vault — all deposits</span>
              </td>
              <td style="padding:7px 8px;text-align:center;"><span style="font-size:0.65rem;color:#4ade80;">● Always On</span></td>
              <td style="padding:7px 8px;text-align:right;color:#4ade80;font-weight:bold;">${fmt(u.balance)}</td>
              <td style="padding:7px 8px;text-align:right;color:#4ade80;font-weight:bold;">${fmt(u.netWorth)}</td>
              <td style="padding:7px 12px;text-align:center;">
                <button class="lb-action-btn" data-action="hackbank" style="font-size:0.6rem;padding:3px 8px;background:rgba(248,113,113,0.15);border:1px solid #f87171;border-radius:3px;color:#f87171;cursor:pointer;">💀 Hack (2%)</button>
              </td>
            </tr>`;
        }

        const online = onlineSet.has(u.id);
        const pw     = paywallProfiles[u.username] || {};
        const tokLock  = pw.normtok   ? `<span title="NormTok locked $${pw.normtok.price}"   style="font-size:0.58rem;color:#f59e0b;margin-left:3px;">🔒📱</span>` : '';
        const tuneLock = pw.normtunes ? `<span title="NormTunes locked $${pw.normtunes.price}" style="font-size:0.58rem;color:#f59e0b;margin-left:3px;">🔒🎵</span>` : '';

        return `
          <tr style="border-bottom:1px solid var(--border);${isMe?'background:rgba(79,158,255,0.06);':''}">
            <td style="padding:7px 12px;color:var(--text3);">${rank}</td>
            <td style="padding:7px 8px;">
              <span style="color:${u.color||'var(--accent)'};font-weight:bold;">${esc(u.username)}</span>
              ${tokLock}${tuneLock}
              ${isMe?'<span style="font-size:0.58rem;color:var(--accent);margin-left:4px;">(you)</span>':''}
            </td>
            <td style="padding:7px 8px;text-align:center;">
              <span style="font-size:0.63rem;${online?'color:#4ade80':'color:var(--text3)'};">${online?'● Online':'○ Offline'}</span>
            </td>
            <td style="padding:7px 8px;text-align:right;color:var(--text2);">${fmt(u.balance)}</td>
            <td style="padding:7px 8px;text-align:right;${(u.netWorth||0)>=10000?'color:#4ade80':'color:#f87171'};">${fmt(u.netWorth)}</td>
            <td style="padding:7px 12px;text-align:center;">
              ${!isMe?`<div style="display:flex;gap:3px;justify-content:center;flex-wrap:wrap;">
                <button class="lb-action-btn" data-action="transfer" data-id="${esc(u.id)}" data-name="${esc(u.username)}" title="Send Money" style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid var(--border);border-radius:3px;color:var(--text2);cursor:pointer;">💸</button>
                ${online?`<button class="lb-action-btn" data-action="virus" data-id="${esc(u.id)}" data-name="${esc(u.username)}" title="Deploy Virus" style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid #f87171;border-radius:3px;color:#f87171;cursor:pointer;">☣️</button>`:''}
                ${pw.normtok  ?`<button class="lb-action-btn" data-action="unlock" data-name="${esc(u.username)}" data-mtype="normtok"   data-price="${pw.normtok.price}"   style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid #f59e0b;border-radius:3px;color:#f59e0b;cursor:pointer;">🔓📱</button>`:''}
                ${pw.normtunes?`<button class="lb-action-btn" data-action="unlock" data-name="${esc(u.username)}" data-mtype="normtunes" data-price="${pw.normtunes.price}" style="font-size:0.6rem;padding:2px 6px;background:transparent;border:1px solid #f59e0b;border-radius:3px;color:#f59e0b;cursor:pointer;">🔓🎵</button>`:''}
              </div>`:''}
            </td>
          </tr>`;
      }).join('');

      tbody.querySelectorAll('.lb-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const {action,id,name,mtype,price} = btn.dataset;
          if (action==='transfer') showTransferModal(id, name);
          if (action==='virus')    showVirusModal(id, name);
          if (action==='hackbank') showBankHackModal();
          if (action==='unlock')   showUnlockModal(name, mtype, parseFloat(price)||0);
        });
      });
    };

    // ── Transfer modal ─────────────────────────────────────────────────────────
    const showTransferModal = (toId, toName) => {
      const inner = wrap.querySelector('#lb-modal-inner');
      const bal   = typeof Economy !== 'undefined' ? Economy.state.balance : 0;
      inner.innerHTML = `
        <div style="font-size:0.9rem;font-weight:bold;margin-bottom:12px;color:var(--accent);">💸 Send Money to ${esc(toName)}</div>
        <div style="font-size:0.7rem;color:var(--text3);margin-bottom:6px;">Your balance: ${fmt(bal)}</div>
        <input id="tr-amt" type="number" min="1" placeholder="Amount" value="100"
          style="width:100%;background:var(--bg1);border:1px solid var(--border);border-radius:4px;padding:7px 10px;color:var(--text1);font-size:0.82rem;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:10px;" />
        <div id="tr-msg" style="font-size:0.72rem;min-height:16px;margin-bottom:8px;"></div>
        <div style="display:flex;gap:8px;">
          <button id="tr-send" style="flex:1;padding:7px;background:var(--accent);color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-family:inherit;">Send</button>
          <button id="tr-cancel" style="flex:1;padding:7px;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:4px;cursor:pointer;font-family:inherit;">Cancel</button>
        </div>`;
      wrap.querySelector('#lb-modal').style.display = 'flex';
      inner.querySelector('#tr-cancel').addEventListener('click', closeModal);
      inner.querySelector('#tr-send').addEventListener('click', () => {
        const amt = parseFloat(inner.querySelector('#tr-amt').value)||0;
        const msgEl = inner.querySelector('#tr-msg');
        if (amt<=0) { msgEl.style.color='#f87171'; msgEl.textContent='Enter valid amount.'; return; }
        if (typeof Economy !== 'undefined' && amt > Economy.state.balance) { msgEl.style.color='#f87171'; msgEl.textContent='Insufficient funds.'; return; }
        // Send by username (server looks up by username)
        if (typeof Network !== 'undefined') Network.transferMoney(toName, amt);
        msgEl.style.color='#4ade80'; msgEl.textContent=`Sending ${fmt(amt)} to ${toName}…`;
        setTimeout(closeModal, 1200);
      });
    };

    // ── Virus modal ────────────────────────────────────────────────────────────
    const showVirusModal = (toId, toName) => {
      const inner = wrap.querySelector('#lb-modal-inner');
      const unlocks = (() => { try { return JSON.parse(localStorage.getItem('normos_unlocks')||'[]'); } catch { return []; } })();
      const VIRUSES = [
        {type:'generic',   icon:'🦠', drain:'5%',  always:true},
        {type:'glitch',    icon:'👾', drain:'2%',  always:true},
        {type:'miner',     icon:'⛏️', drain:'10%', unlocked:unlocks.includes('virus_miner')},
        {type:'ransomware',icon:'🔐', drain:'25%', unlocked:unlocks.includes('virus_ransomware')},
      ];
      const avail = VIRUSES.filter(v=>v.always||v.unlocked);
      const locked = VIRUSES.filter(v=>!v.always&&!v.unlocked);
      inner.innerHTML = `
        <div style="font-size:0.9rem;font-weight:bold;margin-bottom:10px;color:#f87171;">☣️ Deploy Virus → ${esc(toName)}</div>
        ${avail.map(v=>`
          <div class="vi-opt" data-type="${v.type}" style="padding:10px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;margin-bottom:6px;cursor:pointer;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:0.82rem;">${v.icon} ${v.type.charAt(0).toUpperCase()+v.type.slice(1)}</span>
              <span style="font-size:0.68rem;color:#f87171;">drains ${v.drain}</span>
            </div>
          </div>`).join('')}
        ${locked.map(v=>`<div style="padding:8px 10px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;margin-bottom:6px;opacity:0.4;font-size:0.72rem;">🔒 ${v.type} — buy in NormShop</div>`).join('')}
        <div id="vi-msg" style="font-size:0.72rem;min-height:16px;margin-top:4px;"></div>
        <button id="vi-cancel" style="width:100%;margin-top:8px;padding:7px;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:4px;cursor:pointer;font-family:inherit;">Cancel</button>`;
      wrap.querySelector('#lb-modal').style.display = 'flex';
      inner.querySelector('#vi-cancel').addEventListener('click', closeModal);
      inner.querySelectorAll('.vi-opt').forEach(el => {
        el.addEventListener('click', () => {
          if (typeof Network !== 'undefined') Network.sendVirus(toId, el.dataset.type);
          inner.querySelector('#vi-msg').style.color='#4ade80';
          inner.querySelector('#vi-msg').textContent=`☣️ ${el.dataset.type} deployed!`;
          setTimeout(closeModal, 1200);
        });
      });
    };

    // ── Bank hack modal ────────────────────────────────────────────────────────
    const showBankHackModal = () => {
      const inner = wrap.querySelector('#lb-modal-inner');
      const unlocks = (() => { try { return JSON.parse(localStorage.getItem('normos_unlocks')||'[]'); } catch { return []; } })();
      const VIRUSES = [
        {type:'generic',   icon:'🦠', drain:'3%',  always:true},
        {type:'glitch',    icon:'👾', drain:'5%',  always:true},
        {type:'miner',     icon:'⛏️', drain:'10%', unlocked:unlocks.includes('virus_miner')},
        {type:'ransomware',icon:'🔐', drain:'20%', unlocked:unlocks.includes('virus_ransomware')},
      ].filter(v=>v.always||v.unlocked);
      inner.innerHTML = `
        <div style="font-size:0.9rem;font-weight:bold;margin-bottom:8px;color:#f87171;">💀 Hack NormBank</div>
        <div style="font-size:0.7rem;color:#f59e0b;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:5px;padding:8px;margin-bottom:12px;line-height:1.5;">
          ⚠️ <strong>2% success rate.</strong> NormBank holds ALL deposited money.<br>
          If successful, stolen funds split proportionally from all depositors.
        </div>
        ${VIRUSES.map(v=>`
          <div class="bh-opt" data-type="${v.type}" style="padding:8px 12px;background:var(--bg1);border:1px solid var(--border);border-radius:5px;margin-bottom:6px;cursor:pointer;display:flex;align-items:center;gap:10px;">
            <span>${v.icon}</span>
            <span style="font-size:0.78rem;font-weight:bold;flex:1;">${v.type}</span>
            <span style="font-size:0.65rem;color:#f87171;">drains ${v.drain}</span>
          </div>`).join('')}
        <div id="bh-msg" style="font-size:0.72rem;min-height:16px;margin-top:6px;"></div>
        <button id="bh-cancel" style="width:100%;margin-top:8px;padding:7px;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:4px;cursor:pointer;font-family:inherit;">Cancel</button>`;
      wrap.querySelector('#lb-modal').style.display = 'flex';
      inner.querySelector('#bh-cancel').addEventListener('click', closeModal);
      inner.querySelectorAll('.bh-opt').forEach(el => {
        el.addEventListener('click', () => {
          if (typeof Network !== 'undefined') Network.hackBank(el.dataset.type);
          inner.querySelector('#bh-msg').style.color='#f59e0b';
          inner.querySelector('#bh-msg').textContent='☣️ Attack sent… (2% chance)…';
          setTimeout(closeModal, 2000);
        });
      });
    };

    // ── Paywall unlock modal ───────────────────────────────────────────────────
    const showUnlockModal = (owner, mediaType, price) => {
      const inner = wrap.querySelector('#lb-modal-inner');
      const label = mediaType==='normtok' ? '📱 NormTok' : '🎵 NormTunes';
      const bal   = typeof Economy !== 'undefined' ? Economy.state.balance : 0;
      // Check if already unlocked locally
      const alreadyUnlocked = (() => { try { return localStorage.getItem(`normos_paywall_unlocked_${owner}_${mediaType}`)==='1'; } catch { return false; } })();
      if (alreadyUnlocked) { if (typeof OS!=='undefined') OS.notify('🔓',label,`You already have access to ${owner}'s ${label}`); return; }
      inner.innerHTML = `
        <div style="font-size:0.9rem;font-weight:bold;margin-bottom:12px;color:#f59e0b;">🔓 Unlock ${label}</div>
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:8px;">${esc(owner)}'s ${label} is subscriber-only.</div>
        <div style="font-size:1.1rem;font-weight:bold;color:var(--text1);text-align:center;padding:12px;background:var(--bg1);border-radius:6px;margin-bottom:10px;">💰 ${fmt(price)} one-time</div>
        <div style="font-size:0.68rem;color:var(--text3);margin-bottom:10px;">Your balance: ${fmt(bal)}</div>
        <div id="ul-msg" style="font-size:0.72rem;min-height:16px;margin-bottom:8px;"></div>
        <div style="display:flex;gap:8px;">
          <button id="ul-pay" style="flex:1;padding:7px;background:#f59e0b;color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-family:inherit;">Pay & Unlock</button>
          <button id="ul-cancel" style="flex:1;padding:7px;background:transparent;border:1px solid var(--border);color:var(--text2);border-radius:4px;cursor:pointer;font-family:inherit;">Cancel</button>
        </div>`;
      wrap.querySelector('#lb-modal').style.display = 'flex';
      inner.querySelector('#ul-cancel').addEventListener('click', closeModal);
      inner.querySelector('#ul-pay').addEventListener('click', () => {
        const msgEl = inner.querySelector('#ul-msg');
        if (bal < price) { msgEl.style.color='#f87171'; msgEl.textContent=`Need ${fmt(price)}.`; return; }
        if (typeof Network !== 'undefined') Network.unlockPaywall(owner, mediaType);
        msgEl.style.color='#4ade80'; msgEl.textContent='Processing…';
        // Optimistically mark unlocked after short delay
        setTimeout(() => {
          try { localStorage.setItem(`normos_paywall_unlocked_${owner}_${mediaType}`, '1'); } catch {}
          setTimeout(closeModal, 400);
        }, 800);
      });
    };

    // ── Network event handlers ─────────────────────────────────────────────────
    const onWelcome = (data) => {
      const s = typeof Network !== 'undefined' ? Network.getState() : {};
      myId        = s.myId;
      isAdmin     = !!(s.isAdmin || (s.username && s.username.toLowerCase()==='ko1'));
      onlineUsers = (data.online || []).filter(u => u.username !== 'daemon.norm');
      if (data.leaderboard) {
        leaderboard = data.leaderboard.filter(u => u.username !== 'daemon.norm');
        renderBoard();
      }
      setupAdmin();
    };

    const onLeaderboard = (data) => {
      leaderboard = (data.leaderboard || []).filter(u => u.username !== 'daemon.norm');
      renderBoard();
    };

    const onOnline = (users) => {
      onlineUsers = (users || []).filter(u => u.username !== 'daemon.norm');
      renderBoard();
    };

    const onTransferOk = (data) => {
      if (typeof OS !== 'undefined') OS.notify('💸','Transfer',`Sent ${fmt(data.amount)} to ${data.to}`);
    };

    const onVirusSent = (data) => {
      if (typeof OS !== 'undefined') OS.notify('☣️','Virus Sent',`${data.virusType} → ${data.to}!`);
    };

    const onPaywallProfiles = (data) => {
      paywallProfiles = {};
      (data.profiles||[]).forEach(p => { paywallProfiles[p.username] = p.paywalls || {}; });
      renderBoard();
    };

    const onAdminOk = (d) => {
      const s = wrap.querySelector('#adm-status');
      if (s) { s.style.color='#4ade80'; s.textContent=`✅ ${d.action} on ${d.target}`; }
    };
    const onAdminFail = (d) => {
      const s = wrap.querySelector('#adm-status');
      if (s) { s.style.color='#f87171'; s.textContent=`❌ ${d.reason}`; }
    };
    const onAdminRealnames = (d) => {
      const list = wrap.querySelector('#adm-realnames-list');
      if (!list) return;
      list.innerHTML = '<div style="color:var(--text3);margin-bottom:6px;font-size:0.68rem;">REAL NAMES:</div>' +
        (d.names||[]).map(n=>`<div style="padding:3px 0;border-bottom:1px solid var(--border);">${esc(n.username)}: <span style="color:#f59e0b;">${esc(n.realName||'(none)')}</span></div>`).join('');
    };

    if (typeof Network !== 'undefined') {
      Network.on('welcome',                onWelcome);
      Network.on('leaderboard:rich',       onLeaderboard);
      Network.on('online:update',          onOnline);
      Network.on('money:transfer:ok',      onTransferOk);
      Network.on('virus:sent',             onVirusSent);
      Network.on('media:paywall:profiles', onPaywallProfiles);
      Network.on('admin:ok',               onAdminOk);
      Network.on('admin:fail',             onAdminFail);
      Network.on('admin:realnames',        onAdminRealnames);

      // If already connected, seed from current state
      if (Network.isConnected()) {
        const s = Network.getState();
        myId        = s.myId;
        isAdmin     = !!(s.isAdmin || (s.username && s.username.toLowerCase()==='ko1'));
        onlineUsers = (s.online || []).filter(u => u.username !== 'daemon.norm');
        Network.send({ type:'leaderboard:get' });
        // Request paywall profiles (safe to call even if server doesn't support it yet)
        try { Network.getPaywalls(); } catch {}
        setupAdmin();
      }
    }

    // Periodic economy sync
    const syncTimer = setInterval(() => {
      if (typeof Economy !== 'undefined' && typeof Network !== 'undefined' && Network.isConnected()) {
        Network.send({ type:'economy:sync', balance:Economy.state.balance, netWorth:Economy.totalValue() });
      }
    }, 5000);

    wrap._lbCleanup = () => {
      if (typeof Network === 'undefined') return;
      Network.off('welcome',                onWelcome);
      Network.off('leaderboard:rich',       onLeaderboard);
      Network.off('online:update',          onOnline);
      Network.off('money:transfer:ok',      onTransferOk);
      Network.off('virus:sent',             onVirusSent);
      Network.off('media:paywall:profiles', onPaywallProfiles);
      Network.off('admin:ok',               onAdminOk);
      Network.off('admin:fail',             onAdminFail);
      Network.off('admin:realnames',        onAdminRealnames);
      clearInterval(syncTimer);
    };

    return wrap;
  },
};
