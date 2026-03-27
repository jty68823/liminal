"use strict";
/**
 * Liminal Desktop — Electron main process.
 *
 * Startup sequence:
 *   1. Show splash window immediately
 *   2. Start API server (apps/api/dist/index.js)
 *   3. Start Next.js standalone server (apps/web/standalone/server.js)
 *   4. Wait for both servers to be ready
 *   5. Open main window, close splash
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ollama_manager_js_1 = require("./ollama-manager.js");
// ── Constants ──────────────────────────────────────────────────────────────
const API_PORT = parseInt(process.env['API_PORT'] ?? '3001', 10);
const WEB_PORT = parseInt(process.env['WEB_PORT'] ?? '3000', 10);
const isDev = !electron_1.app.isPackaged;
let mainWindow = null;
let splashWindow = null;
let tray = null;
let apiProcess = null;
let webProcess = null;
const ollamaManager = new ollama_manager_js_1.OllamaManager();
// ── User settings persistence ───────────────────────────────────────────────
function loadUserSettings() {
    try {
        const configPath = path_1.default.join(electron_1.app.getPath('userData'), 'liminal-settings.json');
        if (fs_1.default.existsSync(configPath)) {
            return JSON.parse(fs_1.default.readFileSync(configPath, 'utf-8'));
        }
    }
    catch { /* non-fatal */ }
    return {};
}
// ── Path helpers ───────────────────────────────────────────────────────────
function getResourcePath(...segments) {
    if (isDev) {
        // In dev, resolve from repo root (two levels up from apps/desktop)
        return path_1.default.resolve(__dirname, '..', '..', '..', ...segments);
    }
    // In production, resources are bundled under process.resourcesPath/app/
    return path_1.default.join(process.resourcesPath, 'app', ...segments);
}
function getIconPath() {
    const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
    // Try packaged location first, then dev location
    const packaged = path_1.default.join(__dirname, '..', 'assets', iconFile);
    const dev = path_1.default.resolve(__dirname, '..', '..', '..', 'apps', 'desktop', 'assets', iconFile);
    return fs_1.default.existsSync(packaged) ? packaged : dev;
}
// ── Splash window ──────────────────────────────────────────────────────────
function createSplash() {
    splashWindow = new electron_1.BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    // Inline HTML splash screen — no external files needed
    const splashHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 400px; height: 300px;
    background: #0d0b09;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: -apple-system, 'Segoe UI', sans-serif;
    color: #e8e0d8;
    border-radius: 12px;
    border: 1px solid rgba(212,149,107,0.3);
    user-select: none;
  }
  .logo {
    width: 72px; height: 72px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 20px;
  }
  .logo svg { width: 64px; height: 64px; filter: drop-shadow(0 0 12px rgba(212,149,107,0.4)); }
  h1 { font-size: 28px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 8px; }
  .subtitle { font-size: 13px; color: #7a6a5e; margin-bottom: 32px; }
  .status { font-size: 12px; color: #7a6a5e; }
  .dots { display: inline-block; }
  .dots::after {
    content: '';
    animation: dots 1.5s steps(4, end) infinite;
  }
  @keyframes dots {
    0%  { content: ''; }
    25% { content: '.'; }
    50% { content: '..'; }
    75% { content: '...'; }
  }
</style>
</head>
<body>
  <div class="logo">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
      <path d="M30 30 L270 30 A240 240 0 0 1 30 270 Z" fill="#d4956b"/>
      <rect x="30" y="290" width="195" height="190" rx="50" fill="#d4956b"/>
      <path d="M290 480 L290 155 A95 95 0 0 1 385 60 A95 95 0 0 1 480 155 L480 480 Z" fill="#d4956b"/>
    </svg>
  </div>
  <h1>Liminal</h1>
  <div class="subtitle">Local AI Interface</div>
  <div class="status">Starting<span class="dots"></span></div>
</body>
</html>`;
    splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
    splashWindow.center();
    splashWindow.show();
}
// ── Main window ────────────────────────────────────────────────────────────
function createWindow() {
    const iconPath = getIconPath();
    const icon = fs_1.default.existsSync(iconPath) ? electron_1.nativeImage.createFromPath(iconPath) : electron_1.nativeImage.createEmpty();
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        title: 'Liminal',
        backgroundColor: '#0d0b09',
        show: false, // shown after ready-to-show
        icon: icon.isEmpty() ? undefined : icon,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js'),
        },
    });
    mainWindow.loadURL(`http://localhost:${WEB_PORT}`);
    mainWindow.once('ready-to-show', () => {
        // Close splash and show main window
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
            splashWindow = null;
        }
        mainWindow.show();
    });
    mainWindow.on('closed', () => { mainWindow = null; });
    mainWindow.on('close', (e) => {
        // Minimize to tray instead of closing
        if (tray && mainWindow) {
            e.preventDefault();
            mainWindow.hide();
        }
    });
}
// ── System tray ────────────────────────────────────────────────────────────
function createTray() {
    const iconPath = getIconPath();
    const icon = fs_1.default.existsSync(iconPath)
        ? electron_1.nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
        : electron_1.nativeImage.createEmpty();
    tray = new electron_1.Tray(icon);
    const menu = electron_1.Menu.buildFromTemplate([
        { label: 'Show Liminal', click: () => mainWindow?.show() },
        { type: 'separator' },
        {
            label: 'Ollama Status',
            click: async () => {
                const status = await ollamaManager.getStatus();
                electron_1.dialog.showMessageBox({
                    title: 'Ollama Status',
                    message: status.running
                        ? `Ollama is running\nModels: ${status.models?.join(', ') || 'none'}`
                        : `Ollama is not running\n${status.error ?? ''}`,
                });
            },
        },
        { type: 'separator' },
        {
            label: 'Quit Liminal',
            click: () => {
                tray = null;
                electron_1.app.quit();
            },
        },
    ]);
    tray.setToolTip('Liminal AI');
    tray.setContextMenu(menu);
    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
        else
            createWindow();
    });
}
// ── Server management ──────────────────────────────────────────────────────
async function waitForHttp(url, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(800) });
            if (res.ok || res.status < 500)
                return true;
        }
        catch { /* not ready yet */ }
        await new Promise((r) => setTimeout(r, 300));
    }
    return false;
}
async function startApiServer() {
    const apiEntry = getResourcePath('apps', 'api', 'dist', 'index.js');
    if (!fs_1.default.existsSync(apiEntry)) {
        console.warn('[desktop] API not found:', apiEntry, '— skipping (dev mode?)');
        return false;
    }
    apiProcess = (0, child_process_1.spawn)(process.execPath, [apiEntry], {
        env: {
            ...process.env,
            ...loadUserSettings(),
            API_PORT: String(API_PORT),
            DATABASE_PATH: path_1.default.join(electron_1.app.getPath('userData'), 'liminal.db'),
            NODE_ENV: 'production',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    apiProcess.stdout?.on('data', (d) => console.log('[api]', d.toString().trim()));
    apiProcess.stderr?.on('data', (d) => console.error('[api]', d.toString().trim()));
    apiProcess.on('exit', (code) => console.log(`[api] exited with code ${code}`));
    const ready = await waitForHttp(`http://localhost:${API_PORT}/health`);
    console.log(`[desktop] API server ${ready ? 'ready' : 'timed out'}`);
    return ready;
}
async function startWebServer() {
    // In dev mode, Next.js dev server is run separately
    if (isDev) {
        const devReady = await waitForHttp(`http://localhost:${WEB_PORT}`, 5_000);
        console.log(`[desktop] Web server (dev) ${devReady ? 'found' : 'not running — start pnpm dev:web'}`);
        return true; // Load anyway
    }
    // In production, use Next.js standalone server
    const standaloneServer = getResourcePath('apps', 'web', 'standalone', 'apps', 'web', 'server.js');
    if (!fs_1.default.existsSync(standaloneServer)) {
        console.warn('[desktop] Standalone web server not found:', standaloneServer);
        return false;
    }
    webProcess = (0, child_process_1.spawn)(process.execPath, [standaloneServer], {
        env: {
            ...process.env,
            PORT: String(WEB_PORT),
            NODE_ENV: 'production',
            HOSTNAME: '127.0.0.1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    webProcess.stdout?.on('data', (d) => console.log('[web]', d.toString().trim()));
    webProcess.stderr?.on('data', (d) => console.error('[web]', d.toString().trim()));
    webProcess.on('exit', (code) => console.log(`[web] exited with code ${code}`));
    const ready = await waitForHttp(`http://localhost:${WEB_PORT}`, 30_000);
    console.log(`[desktop] Web server ${ready ? 'ready' : 'timed out'}`);
    return ready;
}
// ── IPC handlers ───────────────────────────────────────────────────────────
function registerIpcHandlers() {
    electron_1.ipcMain.handle('dialog:openFile', async () => {
        if (!mainWindow)
            return null;
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'csv', 'xlsx', 'json'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });
        return result.canceled ? null : result.filePaths[0];
    });
    electron_1.ipcMain.handle('dialog:saveFile', async (_event, content, defaultName) => {
        if (!mainWindow)
            return false;
        const result = await electron_1.dialog.showSaveDialog(mainWindow, {
            defaultPath: defaultName,
            filters: [{ name: 'All Files', extensions: ['*'] }],
        });
        if (result.canceled || !result.filePath)
            return false;
        fs_1.default.writeFileSync(result.filePath, content, 'utf-8');
        return true;
    });
    electron_1.ipcMain.handle('ollama:status', () => ollamaManager.getStatus());
    electron_1.ipcMain.handle('app:version', () => electron_1.app.getVersion());
    electron_1.ipcMain.handle('settings:save', (_event, settings) => {
        try {
            const configPath = path_1.default.join(electron_1.app.getPath('userData'), 'liminal-settings.json');
            fs_1.default.writeFileSync(configPath, JSON.stringify(settings, null, 2), 'utf-8');
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: String(e) };
        }
    });
    electron_1.ipcMain.handle('settings:load', () => {
        return loadUserSettings();
    });
}
// ── Single instance lock ───────────────────────────────────────────────────
const gotLock = electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
    // Another instance is already running — focus it and exit
    electron_1.app.quit();
    process.exit(0);
}
electron_1.app.on('second-instance', () => {
    // When user tries to open a second instance, focus the existing window
    if (mainWindow) {
        if (mainWindow.isMinimized())
            mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
});
// ── App lifecycle ──────────────────────────────────────────────────────────
electron_1.app.whenReady().then(async () => {
    registerIpcHandlers();
    createSplash();
    // Start Ollama in background — do NOT await (can take 10s on cold start)
    // Servers and UI don't depend on Ollama being ready at launch
    ollamaManager.ensureRunning().catch(() => { });
    // Start API + Web servers in parallel
    const [apiOk, webOk] = await Promise.all([
        startApiServer(),
        startWebServer(),
    ]);
    if (!apiOk)
        console.warn('[desktop] API server not ready — some features may not work');
    if (!webOk)
        console.warn('[desktop] Web server not ready');
    createWindow();
    createTray();
});
electron_1.app.on('window-all-closed', () => {
    // On macOS, keep app running when all windows are closed
    if (process.platform !== 'darwin') {
        // On Windows/Linux, only quit if tray is gone
        if (!tray)
            electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null)
        createWindow();
    else
        mainWindow.show();
});
electron_1.app.on('before-quit', () => {
    tray = null; // Allow proper quit
    if (apiProcess && !apiProcess.killed)
        apiProcess.kill();
    if (webProcess && !webProcess.killed)
        webProcess.kill();
    ollamaManager.stop();
});
//# sourceMappingURL=main.js.map