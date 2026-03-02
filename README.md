# NormOS v1.0

> **Personal Computing for the Slightly Confused**

A fully simulated fake operating system running entirely in the browser. No backend, no build step — pure HTML, CSS, and JavaScript with `localStorage` persistence.

---

## 🚀 Quick Start

**Option A — Just open it:**
```bash
open index.html
# or double-click index.html in your file manager
```

**Option B — Local dev server (recommended):**
```bash
# Python 3
python3 -m http.server 8080
# then visit http://localhost:8080

# Node.js
npx serve .
# then visit http://localhost:3000

# VS Code
# Install "Live Server" extension → right-click index.html → Open with Live Server
```

---

## 📁 Project Structure

```
normos/
│
├── index.html              # Entry point — loads all CSS + JS
│
├── css/
│   ├── base.css            # CSS variables, reset, fonts, themes, notifications
│   ├── boot.css            # Boot sequence & login screen
│   ├── desktop.css         # Desktop, taskbar, start menu, context menu
│   ├── windows.css         # Window chrome, animations, resize handles
│   └── apps.css            # All app-specific styles
│
├── js/
│   ├── filesystem.js       # VirtualFileSystem class — JSON-based FS with lore
│   ├── eventmanager.js     # EventManager class — pub/sub OS event bus
│   ├── windowmanager.js    # WindowManager class — drag, resize, z-order, taskbar
│   ├── commandhandler.js   # CommandHandler class — full terminal command parser
│   └── os.js               # OS bootstrap — boot, login, desktop, app launcher
│
└── apps/
    ├── terminal.js         # Terminal emulator (connects to CommandHandler)
    ├── fileexplorer.js     # File Explorer (connects to VirtualFileSystem)
    ├── browser.js          # NormBrowser with fake NormNet websites
    ├── notepad.js          # Text editor with FS save/load
    ├── mail.js             # Fake email client with pre-populated inbox
    ├── news.js             # NormNews + SysmonApp (shared rnd() helper)
    ├── sysmon.js           # System Monitor stub (SysmonApp in news.js)
    ├── settings.js         # Settings panel with theme engine
    └── snake.js            # Snake game (canvas-based)
```

---

## 🏗️ Architecture

### Core Systems

| Module | File | Role |
|--------|------|------|
| `FS` | `js/filesystem.js` | Global `VirtualFileSystem` singleton. JSON tree stored in `localStorage`. |
| `EventBus` | `js/eventmanager.js` | Global `EventManager` singleton. All modules communicate through it. |
| `WM` | `js/windowmanager.js` | Global `WindowManager` singleton. Opens, closes, focuses, drags, resizes windows. |
| `CMD` | `js/commandhandler.js` | Global `CommandHandler` singleton. Parses and executes all terminal commands. |
| `OS` | `js/os.js` | IIFE that bootstraps everything. Exposed as `window.OS`. |

### Event System

All modules communicate through `EventBus`. Standard events:

```
os:ready              Desktop shown and ready
os:reboot             Triggers reboot sequence
os:logout             Returns to login screen
window:opened         { id, appId }
window:closed         { id, appId }
window:focused        { id }
window:minimized      { id }
window:restored       { id }
theme:changed         { theme }
fs:changed            { path }
notify                { icon, title, body }
terminal:clear        (no payload)
terminal:cwd          { cwd }
app:open              { appId, filePath?, content? }
```

### Window Lifecycle

```
OS.apps.open('terminal')
  → AppRegistry.create() builds DOM element
  → WM.open({ appId, title, icon, content, width, height })
    → Creates .os-window element
    → Injects into #window-layer
    → Adds taskbar entry
    → Sets up drag / resize handlers
    → Returns window id
```

---

## 🖥️ Built-in Applications

### Terminal (`terminal.js`)
- Full command parser via `CommandHandler`
- Tab autocomplete (commands + paths)
- History navigation (↑/↓)
- Ctrl+C / Ctrl+L shortcuts
- 50+ commands (see below)

### File Explorer (`fileexplorer.js`)
- Browse the virtual filesystem
- Create folders and files
- Double-click to open files in Notepad
- Right-click context menu (rename, delete)
- Sidebar quick-access links
- Address bar with manual path entry

### NormBrowser (`browser.js`)
- Fake NormNet with multiple pages:
  - `normnet://home` — Search homepage
  - `normnet://news` — Headlines
  - `normnet://norm-wiki` — NormWiki article
  - `normnet://norm-social` — Social feed
  - `normnet://shop` — NormShop
  - `normnet://about:normos` — About page
- Back/Forward navigation history
- Search that generates fake results

### NormMail (`mail.js`)
- Pre-populated inbox with 5 emails from:
  - `daemon.norm` (explaining itself)
  - `norm-system` (welcome message)
  - `NormNews` (daily digest)
  - `norm` (note to self)
  - `NormShop` (purchase receipt)
- Folder sidebar (Inbox, Sent, Trash, Spam)

### NormNews (`news.js`)
- 8 fake news stories with tags (BREAKING, TECH, LOCAL, OPINION, WEIRD)
- Stories reference the OS lore

### Notepad (`notepad.js`)
- Plain text editor
- Ctrl+S to save
- Save / Save As / Word Count
- Opens files from File Explorer

### System Monitor (`news.js` / `SysmonApp`)
- Live-animated CPU, RAM, Disk, Network metrics
- Process table with fake PIDs
- `daemon.norm` (PID: 1337) always visible with `∞` memory

### Settings (`settings.js`)
- **Appearance**: Theme switcher (Dark / Light / Retro)
- **System**: Toggle fake settings
- **User**: Change display name, password info, reset filesystem
- **About**: System info, lore progress, warranty disclaimer

### Snake (`snake.js`)
- Canvas-based snake game
- Arrow keys / WASD controls
- Space to pause
- High score saved to `localStorage`

---

## 🔧 Terminal Commands

### File System
```
ls [-a] [-l]            cat <file>        pwd
cd <dir>                touch <file>      mkdir <dir>
rm [-r] <path>          mv <src> <dst>    cp <src> <dst>
find <path> [-name pat] grep <pat> <file>
head [-n] <file>        tail [-n] <file>  wc <file>
tree [-a]               nano/vim <file>
```

### System
```
ps           kill <pid>     top         date
uname [-a]   whoami         hostname    env
history      clear          man <cmd>   which <cmd>
export K=V   echo <text>
```

### Network
```
ping <host>    curl <url>    wget <url>
```

### Package Management (sudo only)
```
sudo apt install <pkg>    sudo apt update
```

### Fun & Secret
```
fortune          cowsay <text>     neofetch
matrix           norm [--version]  yes [text]
python/node      sudo reveal       sudo reboot
whoami --honest
```

### Secret Commands
```bash
sudo reveal          # OS lore revelation
whoami --honest      # Philosophical response
cat /etc/confession.txt   # OS confession
cat /sys/lore/chapter_1.txt  # Start lore
ls -a /home/norm     # Find hidden files
sudo rm -rf /        # The OS refuses
kill 1337            # daemon.norm refuses
```

---

## 🎨 Themes

Three themes available via Settings → Appearance:

| Theme | Description |
|-------|-------------|
| **Dark** | Deep navy/slate, blue accent (default) |
| **Light** | Clean white/gray, professional |
| **Retro** | Amber-on-black CRT terminal aesthetic |

Themes use CSS custom properties (`--bg`, `--accent`, etc.) set on `body`. All components inherit automatically.

Apply programmatically:
```javascript
OS.setTheme('retro');   // 'dark' | 'light' | 'retro'
```

---

## 🗂️ Virtual File System

The FS is a JSON tree stored in `localStorage` under key `normos_fs`.

Default structure:
```
/
├── home/norm/
│   ├── Documents/
│   │   ├── todo.txt
│   │   ├── budget_2024.txt
│   │   └── letter_to_self.txt
│   ├── Pictures/
│   ├── Downloads/
│   │   ├── definitely_not_malware.exe
│   │   └── readme_IMPORTANT.txt
│   └── .hidden              ← hidden file (ls -a to see)
├── etc/
│   ├── normos.conf
│   ├── confession.txt       ← hidden lore file
│   └── daemon.norm          ← cannot be deleted
├── sys/lore/
│   ├── chapter_1.txt        ← start here
│   ├── chapter_2.txt
│   ├── chapter_3.txt
│   └── ENCRYPTED_CHAPTER    ← base64 encoded
├── tmp/
│   └── scratch.txt
└── bin/
    ├── norm
    └── bash
```

**Special behaviors:**
- `daemon.norm` always "comes back" after deletion (respawns after 2s)
- Hidden files (prefixed `.`) only shown with `ls -a`
- `/sys/lore` contains the NormOS backstory

### FS API
```javascript
FS.ls(path, showHidden)       // List directory
FS.readFile(path)             // Read file content
FS.writeFile(path, content)   // Write file
FS.appendFile(path, content)  // Append to file
FS.mkdir(path)                // Create directory
FS.rm(path)                   // Delete (daemon.norm respawns)
FS.mv(src, dst)               // Move/rename
FS.findAll(path, pattern)     // Recursive find
FS.exists(path)               // Check existence
FS.reset()                    // Restore defaults
```

---

## 🕵️ Lore & Secrets

NormOS contains a hidden narrative. Follow the breadcrumbs:

1. `cat /sys/lore/chapter_1.txt` — The origin
2. `cat /sys/lore/chapter_2.txt` — The name
3. `cat /sys/lore/chapter_3.txt` — The secret (hint: `sudo reveal`)
4. `sudo reveal` — Full revelation
5. `cat /etc/confession.txt` — The OS speaks
6. `whoami --honest` — You speak back
7. `ls -a /home/norm` — Find what's hidden
8. `cat /home/norm/.hidden` — A message
9. Try to `rm /etc/daemon.norm` — It comes back
10. `kill 1337` — It refuses

The encrypted chapter in `/sys/lore/ENCRYPTED_CHAPTER` is Base64. The key is hinted at in Chapter 3.

---

## 💾 Persistence

All state is stored in `localStorage`:

| Key | Contents |
|-----|----------|
| `normos_fs` | Virtual filesystem JSON tree |
| `normos_state` | User preferences (username, theme, recent apps) |
| `normos_snake_hi` | Snake high score |

Reset everything:
```javascript
localStorage.clear();
location.reload();
```

Or use Settings → User → Reset File System to reset only the FS.

---

## 🔌 Adding a New App

1. **Create** `apps/myapp.js`:
```javascript
const MyApp = {
  create(opts) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div style="padding:1rem">Hello from MyApp!</div>`;
    return wrap;
  }
};
```

2. **Register** in `js/os.js` inside `appRegistry`:
```javascript
myapp: {
  title: 'My App',
  icon: '🌟',
  width: 500,
  height: 400,
  create: (opts) => MyApp.create(opts),
},
```

3. **Add script tag** to `index.html`:
```html
<script src="apps/myapp.js"></script>
```

4. **Add desktop icon** (automatic if added to `iconApps` array in `buildDesktopIcons`).

---

## 🧩 Extending the Terminal

Add new commands in `js/commandhandler.js` inside `_registerAll()`:

```javascript
R('mycommand', args => {
  return [
    this._fmtGreen('Hello from mycommand!'),
    this._fmtDim(`Args: ${args.join(', ')}`),
  ];
});
```

Available formatters:
```javascript
this._fmtErr(msg)     // Red
this._fmtOk(msg)      // Green
this._fmtInfo(msg)    // Blue
this._fmtWarn(msg)    // Yellow
this._fmtDim(msg)     // Gray
this._fmtCyan(msg)    // Cyan
this._fmtPurple(msg)  // Purple
```

---

## 📋 Browser Compatibility

Works in any modern browser with ES6+ support:
- Chrome/Chromium 80+
- Firefox 75+
- Safari 14+
- Edge 80+

No build tools, no npm, no dependencies. Pure vanilla JS.

---

## 📜 License

NormOS is fictional software. Use it however you like.
daemon.norm is not responsible for any consequences.

---

*"The boot sequence is not checking your hardware. It is checking you."*
*— /etc/confession.txt*
