/**
 * NormOS — apps/texteditor.js
 * Markdown editor with live preview and split view
 */
const TextEditorApp = {
  create(filePath, content) {
    const wrap = document.createElement('div');
    wrap.className = 'txtedit-wrap';

    let viewMode = 'edit'; // edit | preview | split
    let wordCount = 0;
    let modified = false;

    const defaultContent = content || `# Welcome to NormEdit

A **markdown editor** with live preview.

## Features
- Real-time markdown rendering
- Split view mode
- Word count
- Auto-save to NormOS filesystem

## Markdown Tips
Type here and see your content rendered in preview mode.

\`\`\`js
// code blocks work too
console.log("hello, norm");
\`\`\`

> Blockquotes look like this

---

**Bold**, *italic*, ~~strikethrough~~

1. Ordered lists
2. Work as expected

- Unordered
- Lists too
`;

    wrap.innerHTML = `
      <div class="txtedit-toolbar">
        <button class="txtedit-btn" id="te-bold" title="Bold">B</button>
        <button class="txtedit-btn" id="te-italic" title="Italic" style="font-style:italic;">I</button>
        <button class="txtedit-btn" id="te-code" title="Code">&lt;&gt;</button>
        <button class="txtedit-btn" id="te-link" title="Link">🔗</button>
        <button class="txtedit-btn" id="te-h1" title="Heading">H1</button>
        <button class="txtedit-btn" id="te-quote" title="Blockquote">"</button>
        <button class="txtedit-btn" id="te-hr" title="Divider">—</button>
        <span style="flex:1;"></span>
        <button class="txtedit-btn ${viewMode==='edit'?'active':''}" id="te-view-edit">Edit</button>
        <button class="txtedit-btn ${viewMode==='split'?'active':''}" id="te-view-split">Split</button>
        <button class="txtedit-btn ${viewMode==='preview'?'active':''}" id="te-view-preview">Preview</button>
        <span style="width:1px;background:var(--border);height:20px;margin:0 0.2rem;"></span>
        <button class="txtedit-btn primary" id="te-save" style="background:var(--accent);color:#fff;border-color:var(--accent);">Save</button>
      </div>
      <div class="txtedit-body" id="te-body">
        <textarea class="txtedit-editor" id="te-editor" spellcheck="true">${defaultContent}</textarea>
        <div class="txtedit-preview" id="te-preview"></div>
      </div>
      <div class="txtedit-status">
        <span id="te-path">${filePath || 'Untitled.md'}</span>
        <span id="te-stats">0 words · 0 chars</span>
      </div>
    `;

    const editor = wrap.querySelector('#te-editor');
    const preview = wrap.querySelector('#te-preview');
    const body = wrap.querySelector('#te-body');
    const stats = wrap.querySelector('#te-stats');

    // Simple markdown renderer
    const renderMD = (md) => {
      let html = md
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/^#{6} (.+)$/gm,'<h6>$1</h6>')
        .replace(/^#{5} (.+)$/gm,'<h5>$1</h5>')
        .replace(/^#{4} (.+)$/gm,'<h4>$1</h4>')
        .replace(/^### (.+)$/gm,'<h3>$1</h3>')
        .replace(/^## (.+)$/gm,'<h2>$1</h2>')
        .replace(/^# (.+)$/gm,'<h1>$1</h1>')
        .replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>')
        .replace(/^---+$/gm,'<hr>')
        .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,'<em>$1</em>')
        .replace(/~~(.+?)~~/g,'<del>$1</del>')
        .replace(/`(.+?)`/g,'<code>$1</code>')
        .replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" style="color:var(--accent);">$1</a>')
        .replace(/^(\d+)\. (.+)$/gm,'<li data-ol>$2</li>')
        .replace(/^- (.+)$/gm,'<li>$2</li>')
        .replace(/(<li[^>]*>.*<\/li>)\n/g,'$1')
        .replace(/\n/g,'<br>');
      return html;
    };

    const updatePreview = () => {
      preview.innerHTML = renderMD(editor.value);
    };
    const updateStats = () => {
      const text = editor.value;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      stats.textContent = `${words} words · ${chars} chars`;
    };

    editor.addEventListener('input', () => {
      updatePreview(); updateStats(); modified = true;
    });

    // View modes
    const setView = (mode) => {
      viewMode = mode;
      wrap.querySelectorAll('#te-view-edit,#te-view-split,#te-view-preview').forEach(b => b.classList.remove('active'));
      wrap.querySelector(`#te-view-${mode}`).classList.add('active');
      if (mode === 'edit') { editor.style.display = ''; preview.classList.remove('visible'); body.classList.remove('txtedit-split'); }
      else if (mode === 'preview') { editor.style.display = 'none'; preview.classList.add('visible'); body.classList.remove('txtedit-split'); }
      else { editor.style.display = ''; preview.classList.add('visible'); body.classList.add('txtedit-split'); }
    };
    wrap.querySelector('#te-view-edit').addEventListener('click', () => setView('edit'));
    wrap.querySelector('#te-view-split').addEventListener('click', () => setView('split'));
    wrap.querySelector('#te-view-preview').addEventListener('click', () => setView('preview'));

    // Toolbar formatting
    const insertAt = (before, after='') => {
      const start = editor.selectionStart, end = editor.selectionEnd;
      const sel = editor.value.substring(start, end);
      editor.value = editor.value.substring(0,start) + before + sel + after + editor.value.substring(end);
      editor.selectionStart = start + before.length;
      editor.selectionEnd = start + before.length + sel.length;
      editor.focus(); updatePreview(); updateStats();
    };
    wrap.querySelector('#te-bold').addEventListener('click', () => insertAt('**','**'));
    wrap.querySelector('#te-italic').addEventListener('click', () => insertAt('*','*'));
    wrap.querySelector('#te-code').addEventListener('click', () => insertAt('`','`'));
    wrap.querySelector('#te-link').addEventListener('click', () => { const url = prompt('URL:', 'https://'); if(url) insertAt('[',']('+url+')'); });
    wrap.querySelector('#te-h1').addEventListener('click', () => insertAt('# '));
    wrap.querySelector('#te-quote').addEventListener('click', () => insertAt('> '));
    wrap.querySelector('#te-hr').addEventListener('click', () => insertAt('\n---\n'));

    // Save
    wrap.querySelector('#te-save').addEventListener('click', () => {
      const path = filePath || '/home/norm/document.md';
      try { FS.write(path, editor.value); OS.notify('📝', 'NormEdit', `Saved to ${path}`); modified = false; }
      catch(e) { OS.notify('⚠️', 'NormEdit', 'Could not save: ' + e.message); }
    });

    // Tab key
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        insertAt('  ');
      }
    });

    // Init
    updatePreview(); updateStats();
    return wrap;
  }
};