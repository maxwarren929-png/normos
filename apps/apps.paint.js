/**
 * NormOS — apps/paint.js
 * Canvas drawing application.
 * Supports: pencil, eraser, line, rect, ellipse, fill, eyedropper
 * Can save as .norm image (base64) to the filesystem.
 */

const PaintApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'paint-wrap';

    wrap.innerHTML = `
      <div class="paint-toolbar">
        <!-- Tools -->
        <div class="paint-tool-group">
          <button class="paint-tool active" data-tool="pencil"     title="Pencil (P)">✏️</button>
          <button class="paint-tool"        data-tool="eraser"     title="Eraser (E)">🧹</button>
          <button class="paint-tool"        data-tool="fill"       title="Fill (F)">🪣</button>
          <button class="paint-tool"        data-tool="eyedropper" title="Eyedropper (I)">💉</button>
          <button class="paint-tool"        data-tool="line"       title="Line (L)">╱</button>
          <button class="paint-tool"        data-tool="rect"       title="Rectangle (R)">▭</button>
          <button class="paint-tool"        data-tool="ellipse"    title="Ellipse (O)">⬭</button>
          <button class="paint-tool"        data-tool="select"     title="Select (S)">⬚</button>
        </div>

        <div class="paint-toolbar-sep"></div>

        <!-- Sizes -->
        <div class="paint-tool-group">
          <select class="paint-size-select" id="paint-size">
            <option value="1">1px</option>
            <option value="2">2px</option>
            <option value="4" selected>4px</option>
            <option value="8">8px</option>
            <option value="16">16px</option>
            <option value="32">32px</option>
          </select>
        </div>

        <div class="paint-toolbar-sep"></div>

        <!-- Colors -->
        <div class="paint-tool-group" style="align-items:center;gap:4px;">
          <div class="paint-color-preview" id="paint-color-preview" style="background:#000000;"></div>
          <input type="color" id="paint-color-picker" value="#000000" style="width:28px;height:28px;border:none;cursor:pointer;background:none;padding:0;" title="Color">
          <div class="paint-palette" id="paint-palette"></div>
        </div>

        <div class="paint-toolbar-sep"></div>

        <!-- Actions -->
        <div class="paint-tool-group">
          <button class="paint-action-btn" id="paint-clear"  title="Clear canvas">🗑️</button>
          <button class="paint-action-btn" id="paint-undo"   title="Undo (Ctrl+Z)">↩️</button>
          <button class="paint-action-btn" id="paint-save"   title="Save to filesystem">💾</button>
          <button class="paint-action-btn" id="paint-export" title="Export PNG">📤</button>
        </div>

        <!-- Status -->
        <div class="paint-toolbar-sep"></div>
        <span class="paint-status" id="paint-status">800 × 540 · pencil · 4px</span>
      </div>

      <div class="paint-canvas-area" id="paint-canvas-area">
        <canvas id="paint-canvas" width="800" height="500"></canvas>
        <canvas id="paint-overlay" width="800" height="500"></canvas>
      </div>
    `;

    // ── Setup ──────────────────────────────────────────────────────────
    const canvas  = wrap.querySelector('#paint-canvas');
    const overlay = wrap.querySelector('#paint-overlay');
    const ctx     = canvas.getContext('2d');
    const octx    = overlay.getContext('2d');
    const status  = wrap.querySelector('#paint-status');

    let tool     = 'pencil';
    let size     = 4;
    let color    = '#000000';
    let drawing  = false;
    let lastX    = 0;
    let lastY    = 0;
    let startX   = 0;
    let startY   = 0;
    let history  = [];
    const MAX_HISTORY = 20;

    // Palette colors
    const PALETTE = [
      '#000000','#404040','#808080','#c0c0c0','#ffffff',
      '#ff0000','#ff8000','#ffff00','#00ff00','#00ffff',
      '#0000ff','#8000ff','#ff00ff','#ff6680','#804000',
      '#004080','#008040','#400080','#ff9900','#336633',
    ];

    const palette = wrap.querySelector('#paint-palette');
    PALETTE.forEach(c => {
      const swatch = document.createElement('div');
      swatch.className = 'paint-swatch';
      swatch.style.background = c;
      swatch.title = c;
      swatch.addEventListener('click', () => setColor(c));
      palette.appendChild(swatch);
    });

    // ── Color ──────────────────────────────────────────────────────────
    const colorPicker = wrap.querySelector('#paint-color-picker');
    const colorPreview = wrap.querySelector('#paint-color-preview');

    const setColor = (c) => {
      color = c;
      colorPicker.value = c;
      colorPreview.style.background = c;
    };

    colorPicker.addEventListener('input', () => setColor(colorPicker.value));

    // ── Tool selection ─────────────────────────────────────────────────
    wrap.querySelectorAll('.paint-tool').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.paint-tool').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tool = btn.dataset.tool;
        overlay.style.cursor = tool === 'fill' ? 'cell' : tool === 'eyedropper' ? 'crosshair' : 'crosshair';
        updateStatus();
      });
    });

    wrap.querySelector('#paint-size').addEventListener('change', (e) => {
      size = parseInt(e.target.value);
      updateStatus();
    });

    // ── History ────────────────────────────────────────────────────────
    const saveHistory = () => {
      history.push(canvas.toDataURL());
      if (history.length > MAX_HISTORY) history.shift();
    };

    const undo = () => {
      if (!history.length) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = history.pop();
    };

    // ── Canvas coords ──────────────────────────────────────────────────
    const getPos = (e) => {
      const rect = overlay.getBoundingClientRect();
      const scaleX = overlay.width  / rect.width;
      const scaleY = overlay.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top)  * scaleY,
      };
    };

    // ── Fill (flood fill) ──────────────────────────────────────────────
    const hexToRgba = (hex) => {
      const r = parseInt(hex.slice(1,3),16);
      const g = parseInt(hex.slice(3,5),16);
      const b = parseInt(hex.slice(5,7),16);
      return [r, g, b, 255];
    };

    const floodFill = (startX, startY, fillColor) => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      const px = (x, y) => (y * width + x) * 4;

      const targetIdx = px(Math.floor(startX), Math.floor(startY));
      const targetR = data[targetIdx], targetG = data[targetIdx+1], targetB = data[targetIdx+2], targetA = data[targetIdx+3];
      const [fillR, fillG, fillB, fillA] = hexToRgba(fillColor);

      if (targetR === fillR && targetG === fillG && targetB === fillB) return;

      const match = (i) => data[i]===targetR && data[i+1]===targetG && data[i+2]===targetB && data[i+3]===targetA;
      const stack = [[Math.floor(startX), Math.floor(startY)]];

      while (stack.length) {
        const [x, y] = stack.pop();
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const i = px(x, y);
        if (!match(i)) continue;
        data[i] = fillR; data[i+1] = fillG; data[i+2] = fillB; data[i+3] = fillA;
        stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
      }
      ctx.putImageData(imageData, 0, 0);
    };

    // ── Eyedropper ─────────────────────────────────────────────────────
    const pickColor = (x, y) => {
      const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      const hex = '#' + [d[0],d[1],d[2]].map(v => v.toString(16).padStart(2,'0')).join('');
      setColor(hex);
    };

    // ── Drawing logic ──────────────────────────────────────────────────
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    overlay.addEventListener('mousedown', (e) => {
      const pos = getPos(e);
      lastX = startX = pos.x;
      lastY = startY = pos.y;

      if (tool === 'fill') {
        saveHistory();
        floodFill(pos.x, pos.y, color);
        return;
      }
      if (tool === 'eyedropper') {
        pickColor(pos.x, pos.y);
        return;
      }

      saveHistory();
      drawing = true;

      if (tool === 'pencil' || tool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      }
    });

    overlay.addEventListener('mousemove', (e) => {
      const pos = getPos(e);
      updateStatus(pos.x, pos.y);
      if (!drawing) return;

      if (tool === 'pencil') {
        ctx.lineCap  = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = size;
        ctx.strokeStyle = color;
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === 'eraser') {
        ctx.lineCap  = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = size * 2;
        ctx.strokeStyle = '#ffffff';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else {
        // Preview on overlay
        octx.clearRect(0, 0, overlay.width, overlay.height);
        octx.strokeStyle = color;
        octx.lineWidth   = size;
        octx.setLineDash([]);

        if (tool === 'line') {
          octx.beginPath();
          octx.moveTo(startX, startY);
          octx.lineTo(pos.x, pos.y);
          octx.stroke();
        } else if (tool === 'rect') {
          octx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
        } else if (tool === 'ellipse') {
          const rx = Math.abs(pos.x - startX) / 2;
          const ry = Math.abs(pos.y - startY) / 2;
          const cx = startX + (pos.x - startX) / 2;
          const cy = startY + (pos.y - startY) / 2;
          octx.beginPath();
          octx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          octx.stroke();
        }
      }

      lastX = pos.x;
      lastY = pos.y;
    });

    const stopDrawing = (e) => {
      if (!drawing) return;
      drawing = false;
      const pos = getPos(e);

      if (tool === 'line') {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth   = size;
        ctx.lineCap     = 'round';
        ctx.moveTo(startX, startY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.strokeStyle = color;
        ctx.lineWidth   = size;
        ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
      } else if (tool === 'ellipse') {
        const rx = Math.abs(pos.x - startX) / 2;
        const ry = Math.abs(pos.y - startY) / 2;
        const cx = startX + (pos.x - startX) / 2;
        const cy = startY + (pos.y - startY) / 2;
        ctx.strokeStyle = color;
        ctx.lineWidth   = size;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === 'pencil' || tool === 'eraser') {
        ctx.beginPath(); // reset path
      }

      octx.clearRect(0, 0, overlay.width, overlay.height);
    };

    overlay.addEventListener('mouseup',    stopDrawing);
    overlay.addEventListener('mouseleave', stopDrawing);

    // ── Actions ────────────────────────────────────────────────────────
    wrap.querySelector('#paint-clear').addEventListener('click', () => {
      if (!confirm('Clear the canvas?')) return;
      saveHistory();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    wrap.querySelector('#paint-undo').addEventListener('click', undo);

    wrap.querySelector('#paint-save').addEventListener('click', () => {
      const name = prompt('Save as:', 'drawing.png') || 'drawing.png';
      const path = '/home/norm/Documents/' + name;
      const dataUrl = canvas.toDataURL('image/png');
      if (typeof FS !== 'undefined') {
        FS.writeFile(path, dataUrl);
        if (typeof EventBus !== 'undefined') EventBus.emit('fs:changed', { path });
        OS.notify('💾', 'Paint', `Saved: ${name}`);
      }
    });

    wrap.querySelector('#paint-export').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href     = canvas.toDataURL('image/png');
      a.download = 'normpaint.png';
      a.click();
    });

    // ── Keyboard shortcuts ─────────────────────────────────────────────
    wrap.setAttribute('tabindex', '0');
    wrap.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
      const toolKeys = { p:'pencil', e:'eraser', f:'fill', i:'eyedropper', l:'line', r:'rect', o:'ellipse' };
      if (toolKeys[e.key.toLowerCase()]) {
        const t = toolKeys[e.key.toLowerCase()];
        wrap.querySelectorAll('.paint-tool').forEach(b => {
          b.classList.toggle('active', b.dataset.tool === t);
        });
        tool = t;
        updateStatus();
      }
    });

    // ── Status ─────────────────────────────────────────────────────────
    const updateStatus = (x, y) => {
      const coord = (x !== undefined) ? ` · ${Math.floor(x)},${Math.floor(y)}` : '';
      status.textContent = `${canvas.width} × ${canvas.height} · ${tool} · ${size}px${coord}`;
    };

    updateStatus();
    return wrap;
  },
};