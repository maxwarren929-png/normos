/**
 * NormOS — apps/fileexplorer.js
 * Virtual file system explorer with sidebar, address bar,
 * file grid, context menus, and create/delete operations.
 */

const FileExplorerApp = {
  // State is per-instance (stored on the element)
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'fe-wrap';

    const state = { cwd: '/home/norm', selected: null };

    wrap.innerHTML = `
      <div class="fe-sidebar">
        <div class="fe-sidebar-section">Quick Access</div>
        <div class="fe-sidebar-item" data-path="/home/norm">🏠 Home</div>
        <div class="fe-sidebar-item" data-path="/home/norm/Documents">📄 Documents</div>
        <div class="fe-sidebar-item" data-path="/home/norm/Downloads">⬇️ Downloads</div>
        <div class="fe-sidebar-item" data-path="/home/norm/Pictures">🖼️ Pictures</div>
        <div class="fe-sidebar-section">System</div>
        <div class="fe-sidebar-item" data-path="/">/</div>
        <div class="fe-sidebar-item" data-path="/etc">/etc</div>
        <div class="fe-sidebar-item" data-path="/sys/lore">/sys/lore</div>
        <div class="fe-sidebar-item" data-path="/tmp">/tmp</div>
      </div>
      <div class="fe-main">
        <div class="fe-address-bar">
          <button class="os-btn" id="fe-btn-back">◀</button>
          <button class="os-btn" id="fe-btn-up">▲</button>
          <input class="fe-address-input" id="fe-addr" type="text" value="/home/norm" />
          <button class="os-btn" id="fe-btn-go">Go</button>
          <button class="os-btn" id="fe-btn-new-folder">+ Folder</button>
          <button class="os-btn" id="fe-btn-new-file">+ File</button>
        </div>
        <div class="fe-files-area" id="fe-files"></div>
        <div class="fe-statusbar">
          <span id="fe-status-items">0 items</span>
          <span id="fe-status-sel">Nothing selected</span>
        </div>
      </div>
    `;

    const backStack = [];

    const navigate = (path, pushBack = true) => {
      if (pushBack && state.cwd !== path) backStack.push(state.cwd);
      state.cwd     = path;
      state.selected = null;
      wrap.querySelector('#fe-addr').value = path;
      updateSidebarActive();
      renderFiles();
    };

    const updateSidebarActive = () => {
      wrap.querySelectorAll('.fe-sidebar-item').forEach(el => {
        el.classList.toggle('active', el.dataset.path === state.cwd);
      });
    };

    const renderFiles = () => {
      const area   = wrap.querySelector('#fe-files');
      const status = wrap.querySelector('#fe-status-items');
      area.innerHTML = '';

      if (!FS.isDir(state.cwd)) {
        area.innerHTML = `<div style="color:var(--text3);font-size:0.8rem;padding:1rem;">Not a directory.</div>`;
        return;
      }

      // Add parent dir shortcut (not for root)
      if (state.cwd !== '/') {
        const up = makeFileItem('..', 'dir', '⬆️');
        up.addEventListener('dblclick', () => navigate(state.cwd.split('/').slice(0,-1).join('/') || '/'));
        area.appendChild(up);
      }

      const entries = FS.ls(state.cwd, false) || [];
      status.textContent = `${entries.length} item${entries.length !== 1 ? 's' : ''}`;

      entries.forEach(entry => {
        const icon = entry.type === 'dir' ? '📁' : getFileIcon(entry.name);
        const el   = makeFileItem(entry.name, entry.type, icon);

        el.addEventListener('click', () => {
          wrap.querySelectorAll('.fe-file-item').forEach(x => x.classList.remove('selected'));
          el.classList.add('selected');
          state.selected = entry.name;
          wrap.querySelector('#fe-status-sel').textContent = `Selected: ${entry.name}`;
        });

        el.addEventListener('dblclick', () => {
          const path = state.cwd === '/' ? '/' + entry.name : state.cwd + '/' + entry.name;
          if (entry.type === 'dir') {
            navigate(path);
          } else {
            openFile(path, entry.name);
          }
        });

        el.addEventListener('contextmenu', e => {
          e.preventDefault();
          const path = state.cwd === '/' ? '/' + entry.name : state.cwd + '/' + entry.name;
          showFileContextMenu(e, path, entry.name, entry.type, renderFiles);
        });

        area.appendChild(el);
      });
    };

    const makeFileItem = (name, type, icon) => {
      const el = document.createElement('div');
      el.className = 'fe-file-item';
      el.innerHTML = `<div class="fe-file-icon">${icon}</div><div class="fe-file-name">${escHtml(name)}</div>`;
      return el;
    };

    // Toolbar events
    wrap.querySelector('#fe-btn-back').addEventListener('click', () => {
      if (backStack.length) navigate(backStack.pop(), false);
    });
    wrap.querySelector('#fe-btn-up').addEventListener('click', () => {
      const up = state.cwd.split('/').slice(0,-1).join('/') || '/';
      navigate(up);
    });
    wrap.querySelector('#fe-btn-go').addEventListener('click', () => {
      navigate(wrap.querySelector('#fe-addr').value.trim());
    });
    wrap.querySelector('#fe-addr').addEventListener('keydown', e => {
      if (e.key === 'Enter') navigate(e.target.value.trim());
    });
    wrap.querySelector('#fe-btn-new-folder').addEventListener('click', () => {
      const name = prompt('New folder name:');
      if (!name) return;
      const path = state.cwd === '/' ? '/' + name : state.cwd + '/' + name;
      if (!FS.mkdir(path)) { OS.notify('📁', 'Files', 'Could not create folder.'); return; }
      renderFiles();
    });
    wrap.querySelector('#fe-btn-new-file').addEventListener('click', () => {
      const name = prompt('New file name:');
      if (!name) return;
      const path = state.cwd === '/' ? '/' + name : state.cwd + '/' + name;
      FS.writeFile(path, '');
      renderFiles();
    });

    // Sidebar clicks
    wrap.querySelectorAll('.fe-sidebar-item').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.path));
    });

    // FS change updates
    EventBus.on('fs:changed', () => renderFiles());

    // ── File opener — routes to correct app by extension ────────────────────
    const openFile = (path, name) => {
      const ext = (name.split('.').pop() || '').toLowerCase();
      const imageExts = ['png','jpg','jpeg','bmp','gif','webp','svg'];
      const textExts  = ['txt','md','js','py','html','css','json','sh','conf','csv','norm'];

      if (ext === 'norm' || name === 'draw.png') {
        // draw.png or .norm files open in paint
        EventBus.emit('app:open', { appId: 'paint', filePath: path });
        return;
      }
      if (imageExts.includes(ext)) {
        // Image files open in image viewer
        const fileContent = FS.readFile(path) || '';
        // If content is a data URL, open in imagedrop
        if (fileContent.startsWith('data:')) {
          EventBus.emit('app:open', { appId: 'imagedrop', filePath: path, content: fileContent });
        } else {
          // Open in paint for editing
          EventBus.emit('app:open', { appId: 'paint', filePath: path });
        }
        return;
      }
      if (textExts.includes(ext) || !ext) {
        const fileContent = FS.readFile(path) || '';
        EventBus.emit('app:open', { appId: 'texteditor', filePath: path, content: fileContent });
        return;
      }
      // Default: open in text editor
      const fileContent = FS.readFile(path) || '';
      EventBus.emit('app:open', { appId: 'texteditor', filePath: path, content: fileContent });
    };

    // Initial render
    navigate('/home/norm', false);
    return wrap;
  },
};

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    txt: '📄', md: '📝', js: '⚙️', py: '🐍', html: '🌐',
    css: '🎨', json: '📋', png: '🖼️', jpg: '🖼️', bmp: '🖼️',
    exe: '⚡', sys: '🔧', conf: '⚙️', sh: '💻', zip: '📦',
    norm: '👁️',
  };
  return map[ext] || '📄';
}

function showFileContextMenu(e, path, name, type, onAction) {
  const items = [
    { icon: '📂', label: type === 'dir' ? 'Open' : 'Open', action: () => {
      if (type !== 'dir') openFile(path, name);
    }},
    { sep: true },
    { icon: '✏️', label: 'Rename', action: () => {
      const newName = prompt('Rename to:', name);
      if (!newName || newName === name) return;
      const dir     = path.split('/').slice(0,-1).join('/') || '/';
      const newPath = dir === '/' ? '/' + newName : dir + '/' + newName;
      FS.mv(path, newPath);
      onAction();
    }},
    { icon: '🗑️', label: 'Delete', danger: true, action: () => {
      if (!confirm(`Delete "${name}"?`)) return;
      const result = FS.rm(path);
      if (result === '___respawn___') {
        OS.notify('👁️', 'Files', `${name} cannot be deleted.`);
      }
      onAction();
    }},
  ];
  OS.showContextMenu(e.clientX, e.clientY, items);
}
