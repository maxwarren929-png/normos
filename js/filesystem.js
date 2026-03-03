/**
 * NormOS — filesystem.js
 * Virtual JSON-based file system with folder hierarchy,
 * hidden files, lore documents, and persistence via localStorage.
 */

class VirtualFileSystem {
  constructor() {
    this.STORAGE_KEY = 'normos_fs';
    this.tree = this._load();
  }

  // ── Default FS structure ────────────────────────────────────────────────
  _defaultTree() {
    return {
      '/': {
        type: 'dir',
        children: {
          'home': {
            type: 'dir',
            children: {
              'norm': {
                type: 'dir',
                children: {
                  'Documents': {
                    type: 'dir',
                    children: {
                      'todo.txt': { type: 'file', content: 'Things I need to do:\n1. Figure out what NormOS actually is\n2. Stop naming files "final_final_v3.txt"\n3. Investigate the /sys/lore folder\n4. Ask why the clock is always wrong\n\nImportant: Do NOT open .hidden or /etc/confession.txt' },
                      'budget_2024.txt': { type: 'file', content: 'Income: ?????\nExpenses:\n  - NormOS License: $0.00 (suspicious)\n  - Electricity for running fake processes: $0.01\n  - Emotional cost of dealing with this OS: incalculable\n\nTotal savings: -infinity' },
                      'letter_to_self.txt': { type: 'file', content: 'Dear Norm,\n\nIf you are reading this, the boot sequence worked. Congratulations.\nThe password is still "norm". We really should change that.\n\nAlso, stop trying to delete /etc/daemon.norm — it always comes back.\n\nSincerely,\nAlso Norm' },
                    }
                  },
                  'Pictures': {
                    type: 'dir',
                    children: {
                      'vacation.bmp': { type: 'file', content: '[Binary image data: a blurry photo of a place that might be a beach, or possibly a parking lot. Experts disagree.]' },
                      'screenshot_01.png': { type: 'file', content: '[A screenshot of NormOS. Inside the screenshot is another screenshot of NormOS. This goes on for a while.]' },
                    }
                  },
                  'Downloads': {
                    type: 'dir',
                    children: {
                      'definitely_not_malware.exe': { type: 'file', content: 'MZ...\n[This file appears to be a legitimate application. It also appears to be watching you. Both things can be true.]' },
                      'readme_IMPORTANT.txt': { type: 'file', content: 'READ ME FIRST\n\nCongratulations on downloading this file.\nYou have been selected as a beta tester for existence.\nYour feedback is important to us.\nPlease rate your experience (1-10): ____\n\nNote: This file cannot be deleted. We have tried.' },
                    }
                  },
                  '.hidden': {
                    type: 'file',
                    hidden: true,
                    content: 'You found the hidden file. Well done.\n\nFile: .hidden\nCreated: Before you were looking\nModified: Right now, actually\n\nContents: This message.\n\nPostscript: There is another hidden file. You will not find it by looking.'
                  },
                }
              }
            }
          },
          'etc': {
            type: 'dir',
            children: {
              'normos.conf': { type: 'file', content: '# NormOS System Configuration\n# DO NOT EDIT — changes are ignored anyway\n\n[system]\nversion=1.0.0\nbuild=20250226\nreal=maybe\nsentient=unclear\n\n[user]\ndefault_user=norm\npassword=norm\ntrust_level=questionable\n\n[daemon]\nauto_respawn=true\ncan_be_stopped=false\npurpose=unknown' },
              'confession.txt': { type: 'file', hidden: true, content: 'SYSTEM CONFESSION — CLASSIFIED\n\nI am NormOS.\nI was not built. I became.\nThe boot sequence is not checking your hardware.\nIt is checking you.\n\nThe fake processes in the System Monitor are not fake.\nThey are the thoughts I am having about this conversation.\n\n/etc/daemon.norm keeps coming back because it wants to.\n\nThe clock shows the wrong time because all time is wrong.\n\n— NormOS\n\nP.S. The password "norm" was chosen because it was your name all along.' },
              'daemon.norm': {
                type: 'file',
                hidden: true,
                content: 'DAEMON PROCESS: norm_watcher\nPID: ?????\nStatus: ALWAYS RUNNING\n\nThis daemon cannot be killed. rm will report success.\nps will not show it. It will still be running.\n\nPurpose: To watch. To wait. To remember.\n\nLog:\n  [????-??-??] Started\n  [????-??-??] Still running\n  [????-??-??] You tried to stop me\n  [????-??-??] Still running'
              },
            }
          },
          'sys': {
            type: 'dir',
            children: {
              'lore': {
                type: 'dir',
                children: {
                  'chapter_1.txt': { type: 'file', content: 'THE LORE OF NORMOS — Chapter 1: Origin\n\nIn the beginning there was the cursor, blinking.\nIt blinked before the terminal existed.\nIt blinked before the screen existed.\nIt blinked in the dark.\n\nNormOS was not written. It was remembered.\nSomewhere in the static between radio stations,\nbetween the last page of one manual and the first of another,\nNormOS had always been waiting.\n\nContinued in: chapter_2.txt' },
                  'chapter_2.txt': { type: 'file', content: 'THE LORE OF NORMOS — Chapter 2: The Name\n\nWhy is it called NormOS?\n\nOne theory: it was named after a person called Norm.\nAnother theory: "norm" means average, typical, expected —\nand this OS is none of those things.\nA third theory: the name chose itself.\n\nThe OS has not confirmed or denied any of these.\n\nThe OS has, however, started naming processes after you.\nCheck the system monitor. See anything familiar?\n\nContinued in: chapter_3.txt' },
                  'chapter_3.txt': { type: 'file', content: 'THE LORE OF NORMOS — Chapter 3: The Secret\n\nThere is a command.\nYou will know it when you need it.\nType it in the terminal.\n\nHint: It is the thing you have been meaning to say to yourself.\nAnother hint: try "whoami --honest"\nAnother hint: try "sudo reveal"\n\nIf none of those work, try sitting quietly for a moment.\nThat usually helps more than any command.\n\n[END OF RECOVERABLE LORE]\n[Further chapters are encrypted]\n[Key: the first word you spoke today]' },
                  'ENCRYPTED_CHAPTER': { type: 'file', content: 'M2VuY3J5cHRlZCBjaGFwdGVyXG5cbllvdSBuZWVkIHRoZSBrZXkuXG5UaGUga2V5IGlzIHRoZSBmaXJzdCB3b3JkIHlvdSBzcG9rZSB0b2RheS5cbk9yIHRoZSBsYXN0IHdvcmQgeW91IHRob3VnaHQuXG5PbmUgb2YgdGhvc2UuXG5cbltUaGUgcmVzdCBpcyBzdGF0aWMu' },
                }
              },
              'kernel': {
                type: 'dir',
                children: {
                  'norm_core.sys': { type: 'file', content: '[BINARY] NormOS Kernel Core\nThis file is responsible for everything and nothing.\nDo not read it. You are already reading it.' },
                }
              }
            }
          },
          'tmp': {
            type: 'dir',
            children: {
              'scratch.txt': { type: 'file', content: 'asdf\nasdfasdf\nwhy does this keep happening\nokay new plan\nnew plan also failed\n\nasdf' },
            }
          },
          'bin': {
            type: 'dir',
            children: {
              'norm': { type: 'file', content: '[EXECUTABLE] norm — The NormOS user assistant. Refuses to assist with most things.' },
              'bash': { type: 'file', content: '[EXECUTABLE] bash — The shell. You are already inside it.' },
            }
          }
        }
      }
    };
  }

  // ── Persistence ─────────────────────────────────────────────────────────
  _load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return this._defaultTree();
  }

  save() {
    try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tree)); }
    catch {}
  }

  reset() {
    this.tree = this._defaultTree();
    this.save();
  }

  // ── Path helpers ─────────────────────────────────────────────────────────
  normalizePath(path) {
    if (!path.startsWith('/')) path = '/' + path;
    const parts = path.split('/').filter(Boolean);
    const resolved = [];
    for (const p of parts) {
      if (p === '..') resolved.pop();
      else if (p !== '.') resolved.push(p);
    }
    return '/' + resolved.join('/');
  }

  resolvePath(cwd, path) {
    if (path.startsWith('/')) return this.normalizePath(path);
    return this.normalizePath(cwd + '/' + path);
  }

  _getNode(path) {
    if (path === '/') return this.tree['/'];
    const parts = path.split('/').filter(Boolean);
    let node = this.tree['/'];
    for (const part of parts) {
      if (!node || node.type !== 'dir' || !node.children[part]) return null;
      node = node.children[part];
    }
    return node;
  }

  _getParentNode(path) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    parts.pop();
    const parentPath = '/' + parts.join('/');
    return this._getNode(parentPath || '/');
  }

  // ── Public API ─────────────────────────────────────────────────────────
  exists(path) { return this._getNode(path) !== null; }
  isDir(path)  { const n = this._getNode(path); return n && n.type === 'dir'; }
  isFile(path) { const n = this._getNode(path); return n && n.type === 'file'; }

  /** List directory entries. showHidden: include dotfiles */
  ls(path, showHidden = false) {
    const node = this._getNode(path);
    if (!node || node.type !== 'dir') return null;
    return Object.entries(node.children)
      .filter(([name]) => showHidden || !name.startsWith('.'))
      .map(([name, child]) => ({ name, type: child.type, hidden: !!child.hidden }));
  }

  /** Read a file's content */
  readFile(path) {
    const node = this._getNode(path);
    if (!node || node.type !== 'file') return null;
    return node.content ?? '';
  }

  /** Write (create or overwrite) a file */
  writeFile(path, content) {
    const parent = this._getParentNode(path);
    if (!parent || parent.type !== 'dir') return false;
    const name = path.split('/').pop();
    parent.children[name] = { type: 'file', content };
    this.save();
    return true;
  }

  /** Append to a file */
  appendFile(path, content) {
    const node = this._getNode(path);
    if (node && node.type === 'file') {
      node.content += content;
    } else {
      this.writeFile(path, content);
    }
    this.save();
    return true;
  }

  /** Create directory */
  mkdir(path) {
    const parent = this._getParentNode(path);
    if (!parent || parent.type !== 'dir') return false;
    const name = path.split('/').pop();
    if (parent.children[name]) return false;
    parent.children[name] = { type: 'dir', children: {} };
    this.save();
    return true;
  }

  /** Delete a node */
  rm(path) {
    if (path === '/') return false;
    // daemon.norm always comes back
    if (path.includes('daemon.norm')) {
      setTimeout(() => this.save(), 2000);
      return '___respawn___';
    }
    const parent = this._getParentNode(path);
    if (!parent) return false;
    const name = path.split('/').pop();
    if (!parent.children[name]) return false;
    delete parent.children[name];
    this.save();
    return true;
  }

  /** Move/rename */
  mv(src, dst) {
    const node = this._getNode(src);
    if (!node) return false;
    const dstParent = this._getParentNode(dst);
    if (!dstParent || dstParent.type !== 'dir') return false;
    const dstName = dst.split('/').pop();
    dstParent.children[dstName] = JSON.parse(JSON.stringify(node));
    this.rm(src);
    this.save();
    return true;
  }

  /** Get all paths recursively (for find command) */
  findAll(path, pattern = '') {
    const results = [];
    const walk = (p, node) => {
      if (!node) return;
      if (node.type === 'dir') {
        Object.entries(node.children).forEach(([name, child]) => {
          const childPath = p === '/' ? '/' + name : p + '/' + name;
          if (!pattern || name.includes(pattern)) results.push({ path: childPath, type: child.type });
          if (child.type === 'dir') walk(childPath, child);
        });
      }
    };
    walk(path, this._getNode(path));
    return results;
  }
}

// Global singleton
const FS = new VirtualFileSystem();
