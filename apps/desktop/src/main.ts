/**
 * Liminal Desktop — Electron main process.
 *
 * Startup sequence:
 *   1. Show splash window immediately
 *   2. Start API server (apps/api/dist/index.js)
 *   3. Start Next.js standalone server (apps/web/standalone/server.js)
 *   4. Wait for both servers to be ready (HTTP health-check polling)
 *   5. Open main window, close splash
 */

import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

// ── Constants ──────────────────────────────────────────────────────────────

const API_PORT = parseInt(process.env['API_PORT'] ?? '3001', 10);
const WEB_PORT = parseInt(process.env['WEB_PORT'] ?? '3000', 10);
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let apiProcess: ChildProcess | null = null;
let webProcess: ChildProcess | null = null;

// Track startup errors for the error page
let startupErrors: string[] = [];

// ── Logging ─────────────────────────────────────────────────────────────────

const LOG_PATH = path.join(app.getPath('userData'), 'liminal-desktop.log');

function log(level: 'info' | 'warn' | 'error', ...args: unknown[]): void {
  const msg = `[${new Date().toISOString()}] [${level}] ${args.map(String).join(' ')}`;
  console[level === 'info' ? 'log' : level](msg);
  try {
    fs.appendFileSync(LOG_PATH, msg + '\n');
  } catch { /* non-fatal */ }
}

// ── User settings persistence ───────────────────────────────────────────────

function loadUserSettings(): Record<string, string> {
  try {
    const configPath = path.join(app.getPath('userData'), 'liminal-settings.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, string>;
    }
  } catch { /* non-fatal */ }
  return {};
}

// ── Path helpers ───────────────────────────────────────────────────────────

function getResourcePath(...segments: string[]): string {
  if (isDev) {
    // In dev, resolve from repo root (two levels up from apps/desktop)
    return path.resolve(__dirname, '..', '..', '..', ...segments);
  }
  // In production, resources are bundled under process.resourcesPath/app/
  return path.join(process.resourcesPath, 'app', ...segments);
}

function getIconPath(): string {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  if (app.isPackaged) {
    // In packaged app: assets are bundled alongside dist/ in the app directory
    return path.join(__dirname, '..', 'assets', iconFile);
  }
  // In dev: resolve from apps/desktop/assets
  return path.resolve(__dirname, '..', 'assets', iconFile);
}

// ── Splash window ──────────────────────────────────────────────────────────

function createSplash(): void {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  // Inline HTML splash screen — logo assembly animation
  const splashHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 400px; height: 300px;
    background: #0a0a0b;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: -apple-system, 'Segoe UI', sans-serif;
    color: #e8e0d8;
    border-radius: 12px;
    border: 1px solid rgba(212,149,107,0.3);
    user-select: none;
    overflow: hidden;
  }
  .glow {
    position: absolute;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(212,149,107,0.12) 0%, transparent 70%);
    opacity: 0;
    animation: glowIn 1s ease-out 0.5s forwards;
  }
  @keyframes glowIn {
    to { opacity: 1; transform: scale(1.2); }
  }
  .logo-wrap {
    position: relative;
    width: 72px; height: 72px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 20px;
    z-index: 1;
  }
  .logo-wrap svg { width: 64px; height: 64px; }

  /* Each shape starts invisible and offset, then animates into place */
  .shape-1 {
    opacity: 0;
    transform: translate(-30px, -30px) scale(0.6) rotate(-45deg);
    animation: assembleShape 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards;
    transform-origin: 28% 28%;
  }
  .shape-2 {
    opacity: 0;
    transform: translate(-25px, 30px) scale(0.6) rotate(30deg);
    animation: assembleShape 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.45s forwards;
    transform-origin: 25% 76%;
  }
  .shape-3 {
    opacity: 0;
    transform: translate(30px, 10px) scale(0.6) rotate(15deg);
    animation: assembleShape 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s forwards;
    transform-origin: 76% 66%;
  }
  @keyframes assembleShape {
    to { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
  }

  h1 {
    font-size: 28px; font-weight: 600; letter-spacing: -0.5px;
    margin-bottom: 8px;
    background: linear-gradient(135deg, #e8c4a0, #d4956b, #b87a50);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    opacity: 0;
    transform: translateY(10px);
    animation: fadeUp 0.5s ease-out 1.2s forwards;
    z-index: 1;
    position: relative;
  }
  .subtitle {
    font-size: 13px; color: #6b6b65;
    margin-bottom: 32px;
    opacity: 0;
    transform: translateY(8px);
    animation: fadeUp 0.5s ease-out 1.35s forwards;
    z-index: 1;
    position: relative;
  }
  .status {
    font-size: 12px; color: #6b6b65;
    opacity: 0;
    animation: fadeUp 0.4s ease-out 1.6s forwards;
    z-index: 1;
    position: relative;
  }
  @keyframes fadeUp {
    to { opacity: 1; transform: translateY(0); }
  }
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
  /* Progress bar */
  .progress-wrap {
    width: 120px; height: 2px;
    background: rgba(255,255,255,0.06);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 16px;
    opacity: 0;
    animation: fadeUp 0.4s ease-out 1.7s forwards;
    z-index: 1;
    position: relative;
  }
  .progress-bar {
    position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, #d4956b 40%, #e8c4a0 60%, transparent);
    background-size: 200% 100%;
    animation: progressShimmer 1.4s linear infinite;
  }
  @keyframes progressShimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
</head>
<body>
  <div class="glow"></div>
  <div class="logo-wrap">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e8a87c"/>
          <stop offset="50%" stop-color="#d4956b"/>
          <stop offset="100%" stop-color="#b87a50"/>
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path class="shape-1" d="M5 5 L52 5 A47 47 0 0 1 5 52 Z" fill="url(#g)" filter="url(#glow)"/>
      <rect class="shape-2" x="5" y="57" width="40" height="38" rx="10" fill="url(#g)" filter="url(#glow)"/>
      <path class="shape-3" d="M57 95 L57 38 A19 19 0 0 1 95 38 L95 95 Z" fill="url(#g)" filter="url(#glow)"/>
    </svg>
  </div>
  <h1>Liminal</h1>
  <div class="subtitle">Local AI Interface</div>
  <div class="status">Starting<span class="dots"></span></div>
  <div class="progress-wrap"><div class="progress-bar"></div></div>
</body>
</html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  splashWindow.center();
  splashWindow.show();
}

// ── Error page ────────────────────────────────────────────────────────────

function getErrorPageHtml(errors: string[]): string {
  const errorList = errors.map((e) => `<li>${e}</li>`).join('\n');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0d0b09; color: #e8e0d8;
    font-family: -apple-system, 'Segoe UI', sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 40px;
  }
  .container {
    max-width: 560px; text-align: center;
  }
  h1 {
    font-size: 24px; font-weight: 600; margin-bottom: 12px;
    background: linear-gradient(135deg, #e8c4a0, #d4956b);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  p { color: #8b8b85; font-size: 14px; margin-bottom: 20px; line-height: 1.6; }
  .error-box {
    background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.2);
    border-radius: 8px; padding: 16px; text-align: left; margin-bottom: 20px;
  }
  .error-box ul { list-style: none; padding: 0; }
  .error-box li {
    color: #ff9b9b; font-size: 13px; padding: 4px 0;
    font-family: 'Consolas', 'Courier New', monospace;
  }
  .error-box li::before { content: '> '; color: #ff6b6b; }
  .hint {
    background: rgba(212,149,107,0.08); border: 1px solid rgba(212,149,107,0.2);
    border-radius: 8px; padding: 16px; text-align: left;
  }
  .hint h3 { color: #d4956b; font-size: 13px; margin-bottom: 8px; }
  .hint p { color: #8b8b85; font-size: 12px; margin: 0; }
  code { background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  button {
    margin-top: 20px; padding: 10px 24px;
    background: linear-gradient(135deg, #d4956b, #b87a50);
    color: #fff; border: none; border-radius: 6px; font-size: 14px;
    cursor: pointer; font-weight: 500;
  }
  button:hover { opacity: 0.9; }
</style>
</head>
<body>
  <div class="container">
    <h1>Liminal could not start</h1>
    <p>The embedded servers failed to initialize. This usually means the bundled files are missing or a port is already in use.</p>
    <div class="error-box">
      <ul>${errorList}</ul>
    </div>
    <div class="hint">
      <h3>Troubleshooting</h3>
      <p>1. Check if ports <code>${API_PORT}</code> (API) and <code>${WEB_PORT}</code> (Web) are free.<br>
         2. Check the log file at: <code>${LOG_PATH.replace(/\\/g, '/')}</code><br>
         3. Try restarting the application.<br>
         4. If this persists, reinstall or rebuild the desktop app.</p>
    </div>
    <button onclick="location.reload()">Retry</button>
  </div>
</body>
</html>`;
}

// ── Main window ────────────────────────────────────────────────────────────

function createWindow(useErrorPage: boolean = false): void {
  const iconPath = getIconPath();
  let icon: Electron.NativeImage;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    const fallbackPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    icon = nativeImage.createFromBuffer(fallbackPng);
  }

  mainWindow = new BrowserWindow({
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
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (useErrorPage) {
    // Show inline error page when servers failed
    const html = getErrorPageHtml(startupErrors);
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  } else {
    mainWindow.loadURL(`http://localhost:${WEB_PORT}`);
  }

  // Handle load failures — show error page instead of blank screen
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log('error', `Window failed to load ${validatedURL}: ${errorDescription} (code ${errorCode})`);
    // Only show error page for the main URL, not sub-resources
    if (validatedURL.includes(`localhost:${WEB_PORT}`)) {
      startupErrors.push(`Web server unreachable at localhost:${WEB_PORT} (${errorDescription})`);
      const html = getErrorPageHtml(startupErrors);
      mainWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    }
  });

  mainWindow.once('ready-to-show', () => {
    // Close splash and show main window
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow!.show();
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

function createTray(): void {
  const iconPath = getIconPath();

  let icon: Electron.NativeImage;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    // Fallback: 1x1 transparent PNG — prevents crash on missing icon
    const fallbackPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    icon = nativeImage.createFromBuffer(fallbackPng).resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);

  const menu = Menu.buildFromTemplate([
    { label: 'Show Liminal', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: 'Model Status',
      click: () => {
        dialog.showMessageBox({
          title: 'Liminal AI Status',
          message: 'Liminal AI engine is running locally.\nModels are loaded on demand from the models directory.',
        });
      },
    },
    { type: 'separator' },
    {
      label: 'Open Log File',
      click: () => {
        const { shell } = require('electron') as typeof import('electron');
        shell.openPath(LOG_PATH);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Liminal',
      click: () => {
        tray = null;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Liminal AI');
  tray.setContextMenu(menu);
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    else createWindow();
  });
}

// ── Server management ──────────────────────────────────────────────────────

/**
 * Build the environment for spawned Node.js child processes.
 *
 * CRITICAL: In packaged Electron apps, process.execPath is the Electron .exe
 * (e.g. Liminal.exe). Without ELECTRON_RUN_AS_NODE=1, spawning it with a JS
 * file argument would launch another Electron instance instead of running the
 * script as a plain Node.js process. This was the root cause of the black
 * screen issue — both API and web servers silently failed to start.
 */
function nodeEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // Tell Electron binary to behave as a plain Node.js runtime
    ELECTRON_RUN_AS_NODE: '1',
    ...extra,
  };
}

async function waitForHttp(url: string, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.ok || res.status < 500) return true;
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function startApiServer(): Promise<boolean> {
  // Use bundled single-file version if available (production), else fallback to index.js (dev)
  const apiBundle = getResourcePath('apps', 'api', 'dist', 'bundle.cjs');
  const apiEntry = getResourcePath('apps', 'api', 'dist', 'index.js');
  const apiFile = fs.existsSync(apiBundle) ? apiBundle : apiEntry;

  if (!fs.existsSync(apiFile)) {
    const msg = `API entry not found: ${apiFile}`;
    log('warn', msg);
    startupErrors.push(msg);
    return false;
  }

  log('info', `Starting API server: ${apiFile}`);

  // Determine the working directory for the API process. In production, set cwd
  // to the API dist directory so that require('better-sqlite3') can resolve the
  // native .node addon located alongside bundle.cjs.
  const apiDir = path.dirname(apiFile);

  apiProcess = spawn(process.execPath, [apiFile], {
    env: nodeEnv({
      ...loadUserSettings(),
      API_PORT: String(API_PORT),
      DATABASE_PATH: path.join(app.getPath('userData'), 'liminal.db'),
      NODE_ENV: 'production',
    }),
    cwd: apiDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Capture early crash
  let exitedEarly = false;
  apiProcess.on('exit', (code, signal) => {
    exitedEarly = true;
    const msg = `API process exited early (code=${code}, signal=${signal})`;
    log('error', msg);
    startupErrors.push(msg);
  });

  apiProcess.stdout?.on('data', (d: Buffer) => log('info', '[api:stdout]', d.toString().trim()));
  apiProcess.stderr?.on('data', (d: Buffer) => {
    const text = d.toString().trim();
    log('error', '[api:stderr]', text);
    // Capture the first few stderr lines as startup errors
    if (startupErrors.length < 5 && text.length > 0) {
      startupErrors.push(`API: ${text.slice(0, 200)}`);
    }
  });

  // Give the process a moment to crash before polling
  await new Promise((r) => setTimeout(r, 500));
  if (exitedEarly) {
    log('error', 'API server crashed on startup');
    return false;
  }

  const ready = await waitForHttp(`http://localhost:${API_PORT}/health`, 25_000);
  log('info', `API server ${ready ? 'ready' : 'timed out'} on port ${API_PORT}`);
  if (!ready) {
    startupErrors.push(`API server did not respond on port ${API_PORT} within 25s`);
  }
  return ready;
}

async function startWebServer(): Promise<boolean> {
  // In dev mode, Next.js dev server is run separately
  if (isDev) {
    const devReady = await waitForHttp(`http://localhost:${WEB_PORT}`, 5_000);
    log('info', `Web server (dev) ${devReady ? 'found' : 'not running — start pnpm dev:web'}`);
    return true; // Load anyway (user may start it late)
  }

  // In production, use Next.js standalone server
  const standaloneServer = getResourcePath('apps', 'web', 'standalone', 'apps', 'web', 'server.js');

  if (!fs.existsSync(standaloneServer)) {
    const msg = `Standalone web server not found: ${standaloneServer}`;
    log('warn', msg);
    startupErrors.push(msg);
    return false;
  }

  log('info', `Starting web server: ${standaloneServer}`);

  // The standalone server does process.chdir(__dirname) internally, but we
  // also set cwd here for good measure.
  const webDir = path.dirname(standaloneServer);

  webProcess = spawn(process.execPath, [standaloneServer], {
    env: nodeEnv({
      PORT: String(WEB_PORT),
      NODE_ENV: 'production',
      HOSTNAME: '127.0.0.1',
    }),
    cwd: webDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Capture early crash
  let exitedEarly = false;
  webProcess.on('exit', (code, signal) => {
    exitedEarly = true;
    const msg = `Web process exited early (code=${code}, signal=${signal})`;
    log('error', msg);
    startupErrors.push(msg);
  });

  webProcess.stdout?.on('data', (d: Buffer) => log('info', '[web:stdout]', d.toString().trim()));
  webProcess.stderr?.on('data', (d: Buffer) => {
    const text = d.toString().trim();
    log('error', '[web:stderr]', text);
    if (startupErrors.length < 5 && text.length > 0) {
      startupErrors.push(`Web: ${text.slice(0, 200)}`);
    }
  });

  // Give the process a moment to crash before polling
  await new Promise((r) => setTimeout(r, 500));
  if (exitedEarly) {
    log('error', 'Web server crashed on startup');
    return false;
  }

  const ready = await waitForHttp(`http://localhost:${WEB_PORT}`, 45_000);
  log('info', `Web server ${ready ? 'ready' : 'timed out'} on port ${WEB_PORT}`);
  if (!ready) {
    startupErrors.push(`Web server did not respond on port ${WEB_PORT} within 45s`);
  }
  return ready;
}

// ── IPC handlers ───────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'csv', 'xlsx', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:saveFile', async (_event, content: string, defaultName: string) => {
    if (!mainWindow) return false;
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return true;
  });

  ipcMain.handle('app:version', () => app.getVersion());

  ipcMain.handle('settings:save', (_event, settings: Record<string, string>) => {
    try {
      const configPath = path.join(app.getPath('userData'), 'liminal-settings.json');
      fs.writeFileSync(configPath, JSON.stringify(settings, null, 2), 'utf-8');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

  ipcMain.handle('settings:load', () => {
    return loadUserSettings();
  });
}

// ── Single instance lock ───────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  // When user tries to open a second instance, focus the existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// ── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  log('info', '=== Liminal Desktop starting ===');
  log('info', `isDev=${isDev}, packaged=${app.isPackaged}`);
  log('info', `execPath=${process.execPath}`);
  log('info', `resourcesPath=${process.resourcesPath}`);
  log('info', `userData=${app.getPath('userData')}`);

  registerIpcHandlers();
  createSplash();

  // Start API + Web servers in parallel
  const [apiOk, webOk] = await Promise.all([
    startApiServer(),
    startWebServer(),
  ]);

  if (!apiOk) log('warn', 'API server not ready — some features may not work');
  if (!webOk) log('warn', 'Web server not ready — UI will show error page');

  // If the web server failed, show a helpful error page instead of a black screen
  const useErrorPage = !webOk;
  createWindow(useErrorPage);
  createTray();
});

app.on('window-all-closed', () => {
  // On macOS, keep app running when all windows are closed
  if (process.platform !== 'darwin') {
    // On Windows/Linux, only quit if tray is gone
    if (!tray) app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
  else mainWindow.show();
});

app.on('before-quit', () => {
  log('info', '=== Liminal Desktop shutting down ===');
  tray = null; // Allow proper quit
  if (apiProcess && !apiProcess.killed) apiProcess.kill();
  if (webProcess && !webProcess.killed) webProcess.kill();
});
