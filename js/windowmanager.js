/**
 * NormOS — windowmanager.js
 * Manages all OS windows: creation, destruction, dragging,
 * resizing, z-order, minimise/maximise, and taskbar integration.
 */

class WindowManager {
  constructor() {
    this._windows   = {};
    this._zCounter  = 100;
    this._focusedId = null;
    this._drag      = null;
    this._resize    = null;

    document.addEventListener('mousemove', this._onMouseMove.bind(this));
    document.addEventListener('mouseup',   this._onMouseUp.bind(this));
  }

  // Lazy DOM getters — safe regardless of script load order
  get _layer()   { return document.getElementById('window-layer'); }
  get _taskbar() { return document.getElementById('taskbar-windows'); }

  // ── Public: open a window ────────────────────────────────────────────────
  open(opts) {
    // If window for this appId already exists, restore + focus it
    const existing = Object.values(this._windows).find(w => w.appId === opts.appId);
    if (existing) {
      this.restore(existing.id);
      this.focus(existing.id);
      return existing.id;
    }

    const id      = 'win_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const width   = opts.width  || 720;
    const height  = opts.height || 480;
    const vpW     = this._layer ? this._layer.clientWidth  : window.innerWidth;
    const vpH     = this._layer ? this._layer.clientHeight : window.innerHeight;
    const offset  = (Object.keys(this._windows).length % 8) * 24;
    const x       = opts.x ?? Math.max(20, (vpW - width)  / 2 + offset);
    const y       = opts.y ?? Math.max(20, (vpH - height) / 2 + offset);

    const win = document.createElement('div');
    win.className = 'os-window';
    win.dataset.id = id;
    win.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;`;

    win.innerHTML = `
      <div class="win-titlebar" data-drag="${id}">
        <div class="win-controls">
          <button class="win-btn close"    title="Close"    data-action="close"    data-id="${id}"></button>
          <button class="win-btn minimize" title="Minimize" data-action="minimize" data-id="${id}"></button>
          <button class="win-btn maximize" title="Maximize" data-action="maximize" data-id="${id}"></button>
        </div>
        <span class="win-icon">${opts.icon || '🪟'}</span>
        <span class="win-title">${opts.title || 'Window'}</span>
      </div>
      <div class="win-body" id="wb_${id}"></div>
      ${opts.resizable !== false ? `<div class="win-resize-handle" data-resize="${id}"></div>` : ''}
    `;

    // Inject content
    const body = win.querySelector(`#wb_${id}`);
    if (typeof opts.content === 'string') {
      body.innerHTML = opts.content;
    } else if (opts.content instanceof Element) {
      body.appendChild(opts.content);
    }

    // Titlebar button events
    win.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'close')    this.close(id);
        if (action === 'minimize') this.minimize(id);
        if (action === 'maximize') this.toggleMaximize(id);
      });
    });

    // Focus on click
    win.addEventListener('mousedown', () => this.focus(id));

    // Drag start
    win.querySelector('[data-drag]').addEventListener('mousedown', e => {
      if (e.target.closest('[data-action]')) return;
      const rect = win.getBoundingClientRect();
      this._drag = { id, startX: e.clientX - rect.left, startY: e.clientY - rect.top };
      this.focus(id);
    });

    // Resize start
    const resizeHandle = win.querySelector('[data-resize]');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', e => {
        e.stopPropagation();
        const rect = win.getBoundingClientRect();
        this._resize = {
          id,
          startX: e.clientX, startY: e.clientY,
          startW: rect.width, startH: rect.height,
          minW: opts.minWidth  || 280,
          minH: opts.minHeight || 180,
        };
        this.focus(id);
      });
    }

    this._layer.appendChild(win);
    this._windows[id] = {
      id, el: win, appId: opts.appId,
      title: opts.title, icon: opts.icon || '🪟',
      minimized: false, maximized: false,
      savedRect: null,
    };

    this.focus(id);
    this._addTaskbarItem(id);
    EventBus.emit('window:opened', { id, appId: opts.appId });
    return id;
  }

  // ── Close ────────────────────────────────────────────────────────────────
  close(id) {
    const w = this._windows[id];
    if (!w) return;

    w.el.classList.add('closing');
    w.el.addEventListener('animationend', () => { if (w.el.parentNode) w.el.remove(); }, { once: true });
    setTimeout(() => { if (w.el.parentNode) w.el.remove(); }, 300);

    this._removeTaskbarItem(id);
    delete this._windows[id];
    EventBus.emit('window:closed', { id, appId: w.appId });

    const remaining = Object.keys(this._windows);
    if (remaining.length) this.focus(remaining[remaining.length - 1]);
    else this._focusedId = null;
  }

  // ── Minimize ─────────────────────────────────────────────────────────────
  minimize(id) {
    const w = this._windows[id];
    if (!w || w.minimized) return;
    w.minimized = true;
    w.el.classList.add('minimizing');
    w.el.addEventListener('animationend', () => {
      w.el.style.display = 'none';
      w.el.classList.remove('minimizing');
    }, { once: true });
    this._updateTaskbarItem(id);
    EventBus.emit('window:minimized', { id });
    const visible = Object.values(this._windows).filter(x => !x.minimized && x.id !== id);
    if (visible.length) this.focus(visible[visible.length - 1].id);
  }

  // ── Restore ──────────────────────────────────────────────────────────────
  restore(id) {
    const w = this._windows[id];
    if (!w || !w.minimized) return;
    w.minimized = false;
    w.el.style.display = 'flex';
    w.el.classList.add('restoring');
    w.el.addEventListener('animationend', () => w.el.classList.remove('restoring'), { once: true });
    this._updateTaskbarItem(id);
    EventBus.emit('window:restored', { id });
  }

  // ── Toggle Maximize ──────────────────────────────────────────────────────
  toggleMaximize(id) {
    const w = this._windows[id];
    if (!w) return;
    if (w.maximized) {
      const r = w.savedRect || {};
      w.el.style.left   = (r.left   || 100) + 'px';
      w.el.style.top    = (r.top    || 80)  + 'px';
      w.el.style.width  = (r.width  || 720) + 'px';
      w.el.style.height = (r.height || 480) + 'px';
      w.el.classList.remove('maximized');
      w.maximized = false;
    } else {
      const rect = w.el.getBoundingClientRect();
      w.savedRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      w.el.classList.add('maximized');
      w.maximized = true;
    }
  }

  // ── Focus ────────────────────────────────────────────────────────────────
  focus(id) {
    if (!this._windows[id]) return;
    Object.values(this._windows).forEach(w => {
      w.el.classList.remove('focused');
      this._setTaskbarFocus(w.id, false);
    });
    const w = this._windows[id];
    w.el.style.zIndex = ++this._zCounter;
    w.el.classList.add('focused');
    this._focusedId = id;
    this._setTaskbarFocus(id, true);
    EventBus.emit('window:focused', { id });
  }

  getFocusedId() { return this._focusedId; }
  getWindow(id)  { return this._windows[id] || null; }
  getAllWindows() { return Object.values(this._windows); }

  // ── Taskbar ──────────────────────────────────────────────────────────────
  _addTaskbarItem(id) {
    const w = this._windows[id];
    if (!this._taskbar) return;
    const item = document.createElement('div');
    item.className = 'tb-item';
    item.id = 'tb_' + id;
    item.innerHTML = `<span class="tb-item-icon">${w.icon}</span><span class="tb-item-title">${w.title}</span>`;
    item.addEventListener('click', () => {
      if (w.minimized)           { this.restore(id); this.focus(id); }
      else if (this._focusedId === id) { this.minimize(id); }
      else                             { this.focus(id); }
    });
    this._taskbar.appendChild(item);
  }

  _removeTaskbarItem(id) {
    const el = document.getElementById('tb_' + id);
    if (el) el.remove();
  }

  _updateTaskbarItem(id) {
    const w    = this._windows[id];
    const item = document.getElementById('tb_' + id);
    if (!item) return;
    item.classList.toggle('minimized', w.minimized);
  }

  _setTaskbarFocus(id, focused) {
    const item = document.getElementById('tb_' + id);
    if (!item) return;
    item.classList.toggle('focused', focused);
  }

  // ── Mouse drag / resize ──────────────────────────────────────────────────
  _onMouseMove(e) {
    if (this._drag) {
      const w = this._windows[this._drag.id];
      if (!w || w.maximized) return;
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;
      let newX = e.clientX - this._drag.startX;
      let newY = e.clientY - this._drag.startY;
      newX = Math.max(-w.el.offsetWidth + 60, Math.min(vpW - 60, newX));
      newY = Math.max(0, Math.min(vpH - 30, newY));
      w.el.style.left = newX + 'px';
      w.el.style.top  = newY + 'px';
    }

    if (this._resize) {
      const r = this._resize;
      const w = this._windows[r.id];
      if (!w) return;
      const newW = Math.max(r.minW, r.startW + (e.clientX - r.startX));
      const newH = Math.max(r.minH, r.startH + (e.clientY - r.startY));
      w.el.style.width  = newW + 'px';
      w.el.style.height = newH + 'px';
    }
  }

  _onMouseUp() {
    this._drag   = null;
    this._resize = null;
  }
}

const WM = new WindowManager();