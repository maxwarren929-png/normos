/**
 * NormOS — apps/notepad.js
 * Simple text editor with file system integration.
 */

const NotepadApp = {
  create(filePath, initialContent) {
    const wrap = document.createElement('div');
    wrap.className = 'np-wrap';

    const path    = filePath || null;
    const content = initialContent ?? (path ? (FS.readFile(path) || '') : '');

    wrap.innerHTML = `
      <div class="np-menubar">
        <button class="np-menu-btn" id="np-save">💾 Save</button>
        <button class="np-menu-btn" id="np-saveas">Save As…</button>
        <button class="np-menu-btn" id="np-clear">Clear</button>
        <button class="np-menu-btn" id="np-wordcount">Word Count</button>
      </div>
      <textarea class="np-editor" id="np-textarea" placeholder="Start typing…" spellcheck="false"></textarea>
      <div class="np-statusbar">
        <span id="np-file-label">${path ? escHtml(path) : 'Untitled'}</span>
        <span id="np-cursor-pos">Ln 1, Col 1</span>
      </div>
    `;

    const ta     = wrap.querySelector('#np-textarea');
    const lbl    = wrap.querySelector('#np-file-label');
    const cursor = wrap.querySelector('#np-cursor-pos');

    ta.value = content;
    ta.addEventListener('input', () => updateStatus());
    ta.addEventListener('keyup',  () => updateStatus());
    ta.addEventListener('click',  () => updateStatus());

    const updateStatus = () => {
      const lines = ta.value.substring(0, ta.selectionStart).split('\n');
      cursor.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
    };

    const save = (savePath) => {
      const target = savePath || path;
      if (!target) {
        const name = prompt('Save as:', 'untitled.txt');
        if (!name) return;
        const p = '/home/norm/Documents/' + name;
        FS.writeFile(p, ta.value);
        lbl.textContent = p;
        EventBus.emit('fs:changed', { path: p });
        OS.notify('💾', 'Notepad', `Saved: ${name}`);
      } else {
        FS.writeFile(target, ta.value);
        EventBus.emit('fs:changed', { path: target });
        OS.notify('💾', 'Notepad', 'File saved.');
      }
    };

    wrap.querySelector('#np-save').addEventListener('click', () => save());
    wrap.querySelector('#np-saveas').addEventListener('click', () => save(null));
    wrap.querySelector('#np-clear').addEventListener('click', () => {
      if (confirm('Clear all text?')) { ta.value = ''; updateStatus(); }
    });
    wrap.querySelector('#np-wordcount').addEventListener('click', () => {
      const words = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
      const lines = ta.value.split('\n').length;
      const chars = ta.value.length;
      alert(`Words: ${words}\nLines: ${lines}\nChars: ${chars}`);
    });

    ta.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); save(); }
    });

    return wrap;
  },
};

