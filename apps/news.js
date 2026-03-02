/**
 * NormOS — apps/news.js
 * Fake news app (NormNews).
 */

const NewsApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'news-wrap';

    const stories = [
      { tag: 'breaking', label: 'BREAKING', title: 'daemon.norm Returns For 47th Time This Session, "Has Updates"', snippet: 'The un-deletable system process returned shortly after the latest attempted removal, reportedly carrying a message. The contents are classified.', time: '0 seconds ago' },
      { tag: 'tech', label: 'TECH', title: 'New Study Finds NormOS Users Spend Average 3hrs/Day Staring at Terminal', snippet: 'Researchers at the Institute for Fake Studies cannot explain the appeal, but note elevated signs of "existential engagement."', time: '12 minutes ago' },
      { tag: 'local', label: 'LOCAL', title: 'Local /tmp Directory Reports "Things Getting Weird"', snippet: 'The temporary directory, which holds scratch.txt and several unidentifiable processes, described the recent activity as "a lot."', time: '34 minutes ago' },
      { tag: 'opinion', label: 'OPINION', title: 'It\'s Time We Had a Conversation About /etc/confession.txt', snippet: 'The file has been there the whole time. No one is reading it. Or maybe everyone is. I checked and now I need to sit down.', time: '1 hour ago' },
      { tag: 'weird', label: 'WEIRD', title: 'Man Types "whoami" Into Terminal, Receives Unexpected Answer', snippet: '"I asked a simple question," said Norm, 32. "I did not expect it to ask one back."', time: '2 hours ago' },
      { tag: 'tech', label: 'TECH', title: 'NormOS Clock Accuracy: An Investigation', snippet: 'The NormOS system clock has never shown the correct time. We asked why. The clock did not respond. The daemon did.', time: '3 hours ago' },
      { tag: 'breaking', label: 'BREAKING', title: 'Password "norm" Confirmed Secure By No Standards Whatsoever', snippet: 'Security researchers have concluded that the NormOS default password provides no security, but has a certain philosophical integrity.', time: '1 day ago' },
      { tag: 'weird', label: 'WEIRD', title: 'Lore Chapter 4 Reportedly Exists; Key Unknown', snippet: 'The encrypted chapter in /sys/lore has been confirmed to exist by the OS itself, which is suspicious. A hint was found in chapter 3.', time: '2 days ago' },
    ];

    const tagColors = { breaking: 'tag-breaking', tech: 'tag-tech', local: 'tag-local', opinion: 'tag-opinion', weird: 'tag-weird' };

    const [featured, ...rest] = stories;
    const grid = rest.slice(0, 6);

    wrap.innerHTML = `
      <div class="news-masthead">
        <div class="news-masthead-title">📰 NormNews</div>
        <div class="news-masthead-sub">All the news that fits, and some that doesn't</div>
      </div>
      <div class="news-featured">
        <span class="news-tag ${tagColors[featured.tag]}">${featured.label}</span>
        <div class="news-item-title">${featured.title}</div>
        <div class="news-item-snippet">${featured.snippet}</div>
        <div class="news-item-time">${featured.time}</div>
      </div>
      <div class="news-grid">
        ${grid.map(s => `
          <div class="news-grid-item">
            <span class="news-tag ${tagColors[s.tag]}">${s.label}</span>
            <div class="news-item-title">${s.title}</div>
            <div class="news-item-snippet">${s.snippet}</div>
            <div class="news-item-time">${s.time}</div>
          </div>`).join('')}
      </div>`;

    return wrap;
  },
};

// ============================================================
/**
 * NormOS — apps/sysmon.js
 * Fake system monitor with animated metrics and process list.
 */

const SysmonApp = {
  _interval: null,

  create() {
    const wrap = document.createElement('div');
    wrap.className = 'sysmon-wrap';

    const processes = [
      { pid: 1,    name: 'norminit',         cpu: () => 0,              mem: () => 1.2 },
      { pid: 100,  name: 'norm_kernel',      cpu: () => rnd(1, 4),      mem: () => rnd(40, 50) },
      { pid: 101,  name: 'window_mgr',       cpu: () => rnd(0.5, 3),    mem: () => rnd(18, 28) },
      { pid: 102,  name: 'fs_daemon',        cpu: () => rnd(0, 1),      mem: () => 5 },
      { pid: 200,  name: 'normterm',         cpu: () => rnd(0.2, 0.8),  mem: () => rnd(7, 10) },
      { pid: 201,  name: 'norm_browser',     cpu: () => rnd(0.5, 2),    mem: () => rnd(30, 60) },
      { pid: 300,  name: 'sysmon (this)',    cpu: () => rnd(0.3, 1),    mem: () => rnd(5, 8) },
      { pid: 999,  name: '[NORM_WATCHER]',   cpu: () => 0,              mem: () => Infinity },
      { pid: 1337, name: 'daemon.norm',      cpu: () => 0,              mem: () => '∞' },
    ];

    wrap.innerHTML = `
      <div class="sysmon-grid">
        <div class="sm-card"><div class="sm-card-label">CPU Usage</div><div class="sm-card-val t-blue" id="sm-cpu-val">--</div><div class="sm-bar"><div class="sm-bar-fill bar-cpu" id="sm-cpu-bar" style="width:0%"></div></div></div>
        <div class="sm-card"><div class="sm-card-label">Memory</div><div class="sm-card-val t-green" id="sm-ram-val">--</div><div class="sm-bar"><div class="sm-bar-fill bar-ram" id="sm-ram-bar" style="width:0%"></div></div></div>
        <div class="sm-card"><div class="sm-card-label">Disk I/O</div><div class="sm-card-val t-purple" id="sm-disk-val">--</div><div class="sm-bar"><div class="sm-bar-fill bar-disk" id="sm-disk-bar" style="width:0%"></div></div></div>
        <div class="sm-card"><div class="sm-card-label">Network</div><div class="sm-card-val t-yellow" id="sm-net-val">--</div><div class="sm-bar"><div class="sm-bar-fill bar-net" id="sm-net-bar" style="width:0%"></div></div></div>
      </div>
      <div style="font-size:0.62rem;color:var(--text3);margin-bottom:0.4rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;">Running Processes</div>
      <table class="sm-process-table" id="sm-proc-table">
        <thead><tr><th>PID</th><th>NAME</th><th>CPU</th><th>MEM</th></tr></thead>
        <tbody id="sm-proc-body"></tbody>
      </table>`;

    const update = () => {
      const cpu  = rnd(5, 35);
      const ram  = rnd(40, 75);
      const disk = rnd(2, 20);
      const net  = rnd(0, 8);
      wrap.querySelector('#sm-cpu-val').textContent  = cpu.toFixed(1) + '%';
      wrap.querySelector('#sm-ram-val').textContent  = ram.toFixed(0) + '%';
      wrap.querySelector('#sm-disk-val').textContent = disk.toFixed(1) + ' MB/s';
      wrap.querySelector('#sm-net-val').textContent  = net.toFixed(2) + ' KB/s';
      wrap.querySelector('#sm-cpu-bar').style.width  = cpu + '%';
      wrap.querySelector('#sm-ram-bar').style.width  = ram + '%';
      wrap.querySelector('#sm-disk-bar').style.width = disk * 5 + '%';
      wrap.querySelector('#sm-net-bar').style.width  = net * 10 + '%';

      const tbody = wrap.querySelector('#sm-proc-body');
      tbody.innerHTML = processes.map(p => {
        const c = p.cpu(); const m = p.mem();
        return `<tr>
          <td class="pid-col">${p.pid}</td>
          <td style="color:var(--text)">${p.name}</td>
          <td class="cpu-col">${typeof c === 'number' ? c.toFixed(1)+'%' : c}</td>
          <td class="mem-col">${typeof m === 'number' ? (m < 1000 ? m.toFixed(0)+'M' : (m/1024).toFixed(1)+'G') : m}</td>
        </tr>`;
      }).join('');
    };

    update();
    const interval = setInterval(update, 2000);
    // Clean up on window close
    EventBus.on('window:closed', () => clearInterval(interval));
    return wrap;
  },
};

