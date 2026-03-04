/**
 * NormOS — apps/chat.js
 * IRC-style multiplayer chat client.
 * Requires: js/network.js to be loaded.
 */

const ChatApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'chat-wrap';

    const DEFAULT_CHANNEL = '#general';
    let   activeChannel   = DEFAULT_CHANNEL;

    // Unique ID to scope event listeners to this instance
    const instanceId = Math.random().toString(36).slice(2, 6);

    wrap.innerHTML = `
      <div class="chat-sidebar">
        <div class="chat-sidebar-section">CHANNELS</div>
        <div id="chat-channels-${instanceId}" class="chat-channel-list"></div>
        <div class="chat-sidebar-section" style="margin-top:0.75rem;">ONLINE</div>
        <div id="chat-users-${instanceId}" class="chat-user-list"></div>
        <div class="chat-sidebar-footer">
          <div id="chat-status-${instanceId}" class="chat-conn-status">⬤ Connecting…</div>
        </div>
      </div>
      <div class="chat-main">
        <div class="chat-header">
          <span class="chat-active-channel" id="chat-active-ch-${instanceId}">${DEFAULT_CHANNEL}</span>
          <span class="chat-header-sub">NormNet IRC — Be nice. daemon.norm is watching.</span>
        </div>
        <div class="chat-messages" id="chat-messages-${instanceId}"></div>
        <div class="chat-input-row">
          <span class="chat-prompt" id="chat-nick-${instanceId}" style="color:var(--accent);font-size:0.75rem;white-space:nowrap;">norm</span>
          <span style="color:var(--text3);margin:0 4px;font-size:0.75rem;">&gt;</span>
          <input class="chat-input" id="chat-input-${instanceId}" placeholder="Type a message… /nick [name] to rename" autocomplete="off" />
          <button class="chat-send-btn" id="chat-send-${instanceId}">Send</button>
        </div>
      </div>
    `;

    const $ = (id) => wrap.querySelector('#' + id + '-' + instanceId);

    const channelList = $('chat-channels');
    const userList    = $('chat-users');
    const messages    = $('chat-messages');
    const input       = $('chat-input');
    const nickLabel   = $('chat-nick');
    const statusEl    = $('chat-status');
    const activeChEl  = $('chat-active-ch');

    let channels = ['#general', '#norm-talk', '#daemon-watch'];
    let onlineUsers = [];

    // ── Render ────────────────────────────────────────────────────────
    const renderChannels = () => {
      channelList.innerHTML = channels.map(ch => `
        <div class="chat-channel-item ${ch === activeChannel ? 'active' : ''}" data-ch="${escHtml(ch)}">${escHtml(ch)}</div>
      `).join('');
      channelList.querySelectorAll('.chat-channel-item').forEach(el => {
        el.addEventListener('click', () => switchChannel(el.dataset.ch));
      });
    };

    const renderUsers = () => {
      if (!onlineUsers.length) {
        userList.innerHTML = '<div class="chat-user-item" style="color:var(--text3);font-style:italic;">No one else online</div>';
        return;
      }
      userList.innerHTML = onlineUsers.map(u => `
        <div class="chat-user-item">
          <span class="chat-user-dot" style="color:${u.color}">⬤</span>
          <span style="color:${u.color};font-size:0.72rem;">${escHtml(u.username)}</span>
        </div>
      `).join('');
    };

    const appendMessage = (msg, channel) => {
      if (channel && channel !== activeChannel) return;

      const el = document.createElement('div');
      el.className = 'chat-msg';

      const isDaemon  = msg.username === 'daemon.norm';
      const isSystem  = msg.username === 'System';
      const nameColor = msg.color || (isDaemon ? '#f87171' : '#4f9eff');

      if (isSystem) {
        el.innerHTML = `<span class="chat-msg-system">${escHtml(msg.text)}</span>`;
      } else {
        el.innerHTML = `
          <span class="chat-msg-ts">${escHtml(msg.ts || '')}</span>
          <span class="chat-msg-nick" style="color:${nameColor};">${escHtml(msg.username)}</span>
          <span class="chat-msg-sep">:</span>
          <span class="chat-msg-text ${isDaemon ? 'daemon-text' : ''}">${escHtml(msg.text)}</span>
        `;
      }

      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;
    };

    const switchChannel = (ch) => {
      activeChannel = ch;
      activeChEl.textContent = ch;
      messages.innerHTML = '';
      renderChannels();
      Network.joinChannel(ch);
    };

    const systemMsg = (text) => appendMessage({ username: 'System', text }, null);

    // ── Network Events ─────────────────────────────────────────────────
    const onWelcome = (data) => {
      statusEl.textContent  = '⬤ Connected';
      statusEl.style.color  = '#4ade80';
      onlineUsers = (data.online || []).filter(u => u.username !== 'daemon.norm');
      channels = data.channels || channels;
      nickLabel.textContent = Network.getState().username || 'norm';
      renderChannels();
      renderUsers();
      systemMsg(`Connected to NormNet. Welcome to ${activeChannel}.`);
      Network.joinChannel(activeChannel);
    };

    const onConnected = () => {
      statusEl.textContent = '⬤ Connected';
      statusEl.style.color = '#4ade80';
    };

    const onDisconnected = () => {
      statusEl.textContent = '⬤ Offline';
      statusEl.style.color = '#f87171';
      systemMsg('Disconnected from NormNet. Attempting to reconnect…');
    };

    const onChatMessage = ({ channel, message }) => {
      appendMessage(message, channel);
    };

    const onChatHistory = ({ channel, messages: msgs }) => {
      if (channel !== activeChannel) return;
      messages.innerHTML = '';
      msgs.forEach(m => appendMessage(m, null));
      systemMsg(`— ${msgs.length} messages loaded —`);
    };

    const onUserJoin = (user) => {
      onlineUsers.push(user);
      renderUsers();
      appendMessage({ username: 'System', text: `${user.username} joined the network.` }, null);
    };

    const onUserLeave = ({ id, username }) => {
      onlineUsers = onlineUsers.filter(u => u.id !== id);
      renderUsers();
      appendMessage({ username: 'System', text: `${username} left the network.` }, null);
    };

    const onUserRename = ({ oldName, newName }) => {
      const u = onlineUsers.find(u => u.username === newName);
      renderUsers();
      appendMessage({ username: 'System', text: `${oldName} is now known as ${newName}.` }, null);
    };

    const onOnlineUpdate = (users) => {
      onlineUsers = (users || []).filter(u => u.username !== 'daemon.norm');
      renderUsers();
    };

    // ── Register events ────────────────────────────────────────────────
    Network.on('welcome',       onWelcome);
    Network.on('connected',     onConnected);
    Network.on('disconnected',  onDisconnected);
    Network.on('chat:message',  onChatMessage);
    Network.on('chat:history',  onChatHistory);
    Network.on('user:join',     onUserJoin);
    Network.on('user:leave',    onUserLeave);
    Network.on('user:rename',   onUserRename);
    Network.on('online:update', onOnlineUpdate);

    // If already connected, populate from current state
    if (Network.isConnected()) {
      const s = Network.getState();
      onlineUsers = (s.online || []).filter(u => u.username !== 'daemon.norm');
      channels = s.channels.length ? s.channels : channels;
      nickLabel.textContent = s.username || 'norm';
      statusEl.textContent  = '⬤ Connected';
      statusEl.style.color  = '#4ade80';
      renderChannels();
      renderUsers();
      Network.joinChannel(activeChannel);
    } else {
      renderChannels();
      renderUsers();
      systemMsg('Not connected to NormNet. Is the server running? (node server.js)');
    }

    // ── Input handling ─────────────────────────────────────────────────
    const handleSend = () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      // Commands
      if (text.startsWith('/nick ')) {
        const newName = text.slice(6).trim();
        if (newName) {
          Network.setUsername(newName);
          nickLabel.textContent = newName;
          systemMsg(`You are now known as ${newName}.`);
        }
        return;
      }
      if (text.startsWith('/join ')) {
        const ch = text.slice(6).trim();
        if (ch) {
          if (!channels.includes(ch)) channels.push(ch);
          switchChannel(ch);
        }
        return;
      }
      if (text === '/users') {
        systemMsg('Online: ' + onlineUsers.map(u => u.username).join(', '));
        return;
      }
      if (text === '/help') {
        systemMsg('Commands: /nick [name], /join [#channel], /users, /clear, /help');
        return;
      }
      if (text === '/clear') {
        messages.innerHTML = '';
        return;
      }

      Network.sendChat(activeChannel, text);

      // Echo locally if not connected (offline mode)
      if (!Network.isConnected()) {
        const s = Network.getState();
        appendMessage({
          username: s.username || 'norm',
          color: s.myColor,
          text,
          ts: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        }, activeChannel);
      }
    };

    $('chat-send').addEventListener('click', handleSend);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend(); });

    // Cleanup on window close
    wrap._chatCleanup = () => {
      Network.off('welcome',       onWelcome);
      Network.off('connected',     onConnected);
      Network.off('disconnected',  onDisconnected);
      Network.off('chat:message',  onChatMessage);
      Network.off('chat:history',  onChatHistory);
      Network.off('user:join',     onUserJoin);
      Network.off('user:leave',    onUserLeave);
      Network.off('user:rename',   onUserRename);
      Network.off('online:update', onOnlineUpdate);
    };

    return wrap;
  },
};