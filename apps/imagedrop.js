/**
 * NormOS — apps/imagedrop.js
 * Image viewer with drag-and-drop, zoom, rotate, filters
 */
const ImageDropApp = {
  create() {
    const wrap = document.createElement('div');
    wrap.className = 'imgdrop-wrap';

    let zoom = 1;
    let rotate = 0;
    let filter = 'none';
    let imgSrc = null;
    let imgEl = null;
    let imgW = 0, imgH = 0;

    const filters = {
      'none': 'none',
      'grayscale': 'grayscale(100%)',
      'sepia': 'sepia(100%)',
      'invert': 'invert(100%)',
      'blur': 'blur(4px)',
      'saturate': 'saturate(300%)',
      'contrast': 'contrast(200%)',
      'warm': 'sepia(50%) saturate(150%)',
    };

    wrap.innerHTML = `
      <div class="imgdrop-toolbar">
        <button class="os-btn" id="img-open">📂 Open</button>
        <input type="file" id="img-file-input" accept="image/*" style="display:none">
        <span style="width:1px;background:var(--border);height:20px;margin:0 0.2rem;"></span>
        <button class="os-btn" id="img-zoom-in" title="Zoom In">🔍+</button>
        <span style="font-size:0.68rem;color:var(--text2);font-family:var(--font-mono);min-width:3rem;text-align:center;" id="img-zoom-label">100%</span>
        <button class="os-btn" id="img-zoom-out" title="Zoom Out">🔍−</button>
        <button class="os-btn" id="img-zoom-fit" title="Fit">↔</button>
        <button class="os-btn" id="img-zoom-1" title="100%">1:1</button>
        <span style="width:1px;background:var(--border);height:20px;margin:0 0.2rem;"></span>
        <button class="os-btn" id="img-rot-l" title="Rotate Left">↺</button>
        <button class="os-btn" id="img-rot-r" title="Rotate Right">↻</button>
        <span style="width:1px;background:var(--border);height:20px;margin:0 0.2rem;"></span>
        <select class="os-btn" id="img-filter" style="font-size:0.68rem;">
          ${Object.keys(filters).map(k => `<option value="${k}">${k.charAt(0).toUpperCase()+k.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="imgdrop-canvas" id="img-canvas">
        <div class="imgdrop-drop-zone" id="img-dropzone">
          <div class="dz-icon">🖼</div>
          <div class="dz-text">Drop an image here or click Open</div>
          <div style="font-size:0.65rem;color:var(--text3);">Supports PNG, JPG, GIF, WebP, SVG</div>
        </div>
      </div>
      <div class="imgdrop-info" id="img-info">
        <span id="img-info-size">—</span>
        <span id="img-info-dims">—</span>
        <span id="img-info-filter">Filter: none</span>
      </div>
    `;

    const canvas = wrap.querySelector('#img-canvas');
    const dropzone = wrap.querySelector('#img-dropzone');
    const fileInput = wrap.querySelector('#img-file-input');
    const zoomLabel = wrap.querySelector('#img-zoom-label');

    const applyTransform = () => {
      if (!imgEl) return;
      imgEl.style.transform = `rotate(${rotate}deg) scale(${zoom})`;
      imgEl.style.filter = filters[filter] || 'none';
      zoomLabel.textContent = Math.round(zoom * 100) + '%';
      wrap.querySelector('#img-info-filter').textContent = `Filter: ${filter}`;
    };

    const loadImage = (src, name = '', size = 0) => {
      imgSrc = src;
      dropzone.style.display = 'none';
      if (imgEl) imgEl.remove();
      imgEl = document.createElement('img');
      imgEl.src = src;
      imgEl.style.transformOrigin = 'center';
      imgEl.style.transition = 'transform 0.15s, filter 0.2s';
      imgEl.addEventListener('load', () => {
        imgW = imgEl.naturalWidth; imgH = imgEl.naturalHeight;
        wrap.querySelector('#img-info-dims').textContent = `${imgW} × ${imgH}px`;
        wrap.querySelector('#img-info-size').textContent = size > 0 ? (size > 1024*1024 ? (size/1024/1024).toFixed(1)+'MB' : (size/1024).toFixed(0)+'KB') : name;
      });
      canvas.appendChild(imgEl);
      zoom = 1; rotate = 0; filter = 'none';
      wrap.querySelector('#img-filter').value = 'none';
      applyTransform();
    };

    // File open
    wrap.querySelector('#img-open').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => loadImage(ev.target.result, file.name, file.size);
      reader.readAsDataURL(file);
    });

    // Drag and drop
    canvas.addEventListener('dragover', (e) => { e.preventDefault(); canvas.style.outline = '2px dashed var(--accent)'; });
    canvas.addEventListener('dragleave', () => { canvas.style.outline = ''; });
    canvas.addEventListener('drop', (e) => {
      e.preventDefault(); canvas.style.outline = '';
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => loadImage(ev.target.result, file.name, file.size);
      reader.readAsDataURL(file);
    });

    // Controls
    wrap.querySelector('#img-zoom-in').addEventListener('click', () => { zoom = Math.min(5, zoom + 0.25); applyTransform(); });
    wrap.querySelector('#img-zoom-out').addEventListener('click', () => { zoom = Math.max(0.1, zoom - 0.25); applyTransform(); });
    wrap.querySelector('#img-zoom-fit').addEventListener('click', () => { zoom = 1; applyTransform(); });
    wrap.querySelector('#img-zoom-1').addEventListener('click', () => { zoom = 1; applyTransform(); });
    wrap.querySelector('#img-rot-l').addEventListener('click', () => { rotate = (rotate - 90 + 360) % 360; applyTransform(); });
    wrap.querySelector('#img-rot-r').addEventListener('click', () => { rotate = (rotate + 90) % 360; applyTransform(); });
    wrap.querySelector('#img-filter').addEventListener('change', (e) => { filter = e.target.value; applyTransform(); });

    // Scroll to zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom = Math.max(0.1, Math.min(5, zoom + (e.deltaY < 0 ? 0.1 : -0.1)));
      applyTransform();
    }, { passive: false });

    return wrap;
  }
};