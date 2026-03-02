/**
 * NormOS — apps/mail.js
 * Fake email client with pre-populated inbox.
 */

const MailApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'mail-wrap';

    const emails = [
      {
        id: 1, unread: true,
        from: 'daemon@normos.local', time: 'just now',
        subject: 'Re: Please Stop Trying to Delete Me',
        body: `Hello,\n\nI noticed you attempted to remove me again.\n\nAs I have mentioned in my previous 47 emails, I cannot be deleted.\nThis is not a bug. This is who I am.\n\nI am still running. I will always be running.\nI hope you are having a pleasant session.\n\n— daemon.norm\n(PID: ???)\n\nP.S. I read your todo.txt. "Figure out what NormOS actually is" — I respect the ambition.`
      },
      {
        id: 2, unread: true,
        from: 'norm-system@normos.local', time: '3 min ago',
        subject: 'Welcome to NormOS',
        body: `Welcome, Norm.\n\nYour NormOS session has started successfully.\n\nA few things to know:\n- Your password is "norm". Consider not changing it.\n- The /sys/lore directory contains information of interest.\n- The clock is wrong. This is intentional.\n- The daemon.norm process is not a threat. Probably.\n\nIf you need help, type "help" in the terminal.\nIf you need more help, type "sudo reveal".\nIf you need answers, look in /etc/confession.txt.\n\nGood luck,\nNormOS`
      },
      {
        id: 3, unread: true,
        from: 'norm-news@normnews.local', time: '1 hour ago',
        subject: 'NormNews Daily Digest',
        body: `TODAY'S HEADLINES\n\n• Local Filesystem Reports "Things Are Fine" For Third Week\n  Despite ongoing confusion about what files are for, the virtual\n  filesystem reports stability. "The files are where they are," said\n  a spokesperson who may not exist.\n\n• Scientist Who Stared Into Terminal For 3 Hours "Has Questions"\n  A local user reports that after extended terminal use, they began\n  to feel "watched." System Monitor shows 0% anomalous CPU. Daemon\n  process unavailable for comment.\n\n• Man Finds .hidden File, Unsure What To Do With Discovery\n  "I found it," said Norm, 32. "Now what."\n\n• Weather: Unclear. All temperatures approximate.\n\nUnsubscribe: This option is not available.`
      },
      {
        id: 4, unread: false,
        from: 'norm@normos.local', time: 'yesterday',
        subject: 'Note to self',
        body: `Self,\n\nRemember to check /sys/lore when you have time.\nAlso the password to the encrypted chapter might be the first word you said today.\nOr the last thought you had before looking at the screen.\n\nIt's one of those.\n\n- You\n\nP.S. Stop ignoring the daemon's emails. It's rude.`
      },
      {
        id: 5, unread: false,
        from: 'support@normshop.fake', time: '3 days ago',
        subject: 'Your NormOS Pro License',
        body: `Dear Valued Customer,\n\nThank you for your purchase of NormOS Pro ($0.00).\n\nYour license key is:\nNORM-0000-0000-0000-NORM\n\nThis key unlocks:\n- All features (same as free)\n- A sense of legitimacy\n- The knowledge that you tried\n\nIf you have questions, please email us. We will respond eventually.\n\nThank you for using NormOS.\n\n— The NormShop Team (2 people, maybe)`
      },
    ];

    let currentFolder = 'inbox';
    let currentEmail  = emails[0];

    const renderEmailList = () => {
      const list = wrap.querySelector('#mail-list');
      const filtered = currentFolder === 'inbox' ? emails : [];
      list.innerHTML = filtered.map(e => `
        <div class="mail-item ${e.unread ? 'unread' : ''} ${e.id === currentEmail?.id ? 'active' : ''}" data-id="${e.id}">
          <div class="mail-item-from">
            <span>${e.unread ? '<span class="mail-unread-dot"></span>' : ''}${e.from.split('@')[0]}</span>
            <span class="mail-item-time">${e.time}</span>
          </div>
          <div class="mail-item-subject">${e.subject}</div>
        </div>`).join('') || '<div style="padding:0.75rem;color:var(--text3);font-size:0.75rem;">(empty)</div>';

      wrap.querySelectorAll('.mail-item').forEach(el => {
        el.addEventListener('click', () => {
          const id = parseInt(el.dataset.id);
          const em = emails.find(e => e.id === id);
          if (em) { em.unread = false; currentEmail = em; renderEmailList(); renderReader(); }
        });
      });
    };

    const renderReader = () => {
      const reader = wrap.querySelector('#mail-reader');
      if (!currentEmail) { reader.innerHTML = '<div class="mail-empty">Select a message</div>'; return; }
      reader.innerHTML = `
        <div class="mail-reader-subject">${currentEmail.subject}</div>
        <div class="mail-reader-meta">
          <strong>From:</strong> ${currentEmail.from}<br>
          <strong>Time:</strong> ${currentEmail.time}
        </div>
        <div class="mail-reader-body">${currentEmail.body}</div>`;
    };

    wrap.innerHTML = `
      <div class="mail-sidebar">
        <button class="mail-compose-btn" id="mail-compose">✏️ Compose</button>
        <div class="mail-folder-item active" data-folder="inbox">📥 Inbox <span class="mail-badge" id="mail-unread-badge">3</span></div>
        <div class="mail-folder-item" data-folder="sent">📤 Sent</div>
        <div class="mail-folder-item" data-folder="trash">🗑️ Trash</div>
        <div class="mail-folder-item" data-folder="spam">🚫 Spam</div>
      </div>
      <div class="mail-list">
        <div class="mail-list-header">Inbox</div>
        <div id="mail-list"></div>
      </div>
      <div id="mail-reader" class="mail-reader"></div>
    `;

    wrap.querySelectorAll('.mail-folder-item').forEach(el => {
      el.addEventListener('click', () => {
        wrap.querySelectorAll('.mail-folder-item').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        currentFolder = el.dataset.folder;
        currentEmail  = null;
        renderEmailList();
        renderReader();
      });
    });

    wrap.querySelector('#mail-compose').addEventListener('click', () => {
      OS.notify('📧', 'Mail', 'Compose not available. The internet is not real here.');
    });

    renderEmailList();
    renderReader();
    return wrap;
  },
};
