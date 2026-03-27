/**
 * build-desktop.mjs
 *
 * Full desktop packaging script:
 *   1. Build all workspace packages (turbo)
 *   2. Copy Next.js static assets to standalone
 *   3. Run electron-builder to produce .exe installer
 *
 * Usage:
 *   node scripts/build-desktop.mjs          # NSIS installer
 *   node scripts/build-desktop.mjs --dir    # Unpacked dir (faster, for testing)
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const DESKTOP = path.resolve(__dirname, '..');
const WEB = path.resolve(ROOT, 'apps', 'web');
const API = path.resolve(ROOT, 'apps', 'api');

const isDirOnly = process.argv.includes('--dir');

function run(cmd, cwd = ROOT) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: process.platform === 'win32' ? 'cmd.exe' : true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠ skip copy: ${src} not found`);
    return;
  }
  fs.cpSync(src, dest, { recursive: true, force: true });
  console.log(`  ✓ copied ${path.relative(ROOT, src)} → ${path.relative(ROOT, dest)}`);
}

console.log('═══════════════════════════════════════════════');
console.log('  Liminal Desktop Builder');
console.log('═══════════════════════════════════════════════\n');

// ── Step 1: Build all packages ────────────────────────────────────────────
console.log('Step 1/5: Building all workspace packages...');
run('pnpm build --filter=!@liminal/desktop');

// ── Step 2.5: Bundle API into a single self-contained file ─────────────────
console.log('\nStep 2.5/5: Bundling API with esbuild (single-file, all deps inlined)...');

// Find esbuild dynamically — don't hardcode version
let esbuildBin;
const pnpmDir = path.join(ROOT, 'node_modules', '.pnpm');
if (fs.existsSync(pnpmDir)) {
  const esbuildDirs = fs.readdirSync(pnpmDir).filter(d => d.startsWith('esbuild@')).sort();
  if (esbuildDirs.length > 0) {
    esbuildBin = path.join(pnpmDir, esbuildDirs[esbuildDirs.length - 1], 'node_modules', 'esbuild', 'bin', 'esbuild');
  }
}
const apiEntry = path.join(API, 'dist', 'index.js');
const apiBundle = path.join(API, 'dist', 'bundle.cjs');

// Remove old node_modules copy (no longer needed)
const apiNodeModulesDest = path.join(API, 'dist', 'node_modules');
if (fs.existsSync(apiNodeModulesDest)) {
  fs.rmSync(apiNodeModulesDest, { recursive: true, force: true });
}

if (fs.existsSync(esbuildBin) && fs.existsSync(apiEntry)) {
  // Bundle all JS dependencies; externalize native addons and pino-pretty (worker transport)
  // Define NODE_ENV=production to disable pino-pretty transport in the bundle
  const bundleCmd = `node "${esbuildBin}" "${apiEntry}" --bundle --platform=node --format=cjs --outfile="${apiBundle}" --external:better-sqlite3 --external:@jitsi/robotjs --external:@napi-rs/canvas --external:cpu-features --define:process.env.NODE_ENV=\\"production\\" --log-level=warning`;
  run(bundleCmd, ROOT);
  console.log(`  ✓ API bundled → dist/bundle.cjs`);
} else {
  console.warn('  ⚠ esbuild not found or API not built — skipping bundle step');
}

// Copy native addons alongside the bundle
const pnpmStore = path.join(ROOT, 'node_modules', '.pnpm');
const betterSqlite3Dir = fs.readdirSync(pnpmStore).find(d => d.startsWith('better-sqlite3@'));
const nativeAddons = betterSqlite3Dir ? [
  {
    src: path.join(pnpmStore, betterSqlite3Dir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    dest: path.join(API, 'dist', 'better_sqlite3.node'),
  },
] : [];

for (const addon of nativeAddons) {
  if (fs.existsSync(addon.src)) {
    fs.copyFileSync(addon.src, addon.dest);
    console.log(`  ✓ Copied native addon: ${path.basename(addon.dest)}`);
  } else {
    console.warn(`  ⚠ Native addon not found: ${addon.src}`);
  }
}

// ── Step 3: Fix Next.js standalone static assets ─────────────────────────
console.log('\nStep 3/5: Fixing Next.js standalone static assets...');

const standaloneDir = path.join(WEB, '.next', 'standalone');
const standaloneStaticDest = path.join(standaloneDir, 'apps', 'web', '.next', 'static');
const standalonePublicDest = path.join(standaloneDir, 'apps', 'web', 'public');
const standaloneStaticSrc = path.join(WEB, '.next', 'static');
const publicSrc = path.join(WEB, 'public');

// Next.js standalone doesn't copy these automatically
copyDir(standaloneStaticSrc, standaloneStaticDest);
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, standalonePublicDest);
} else {
  // Create empty public dir to prevent electron-builder warnings
  fs.mkdirSync(standalonePublicDest, { recursive: true });
}

// ── Step 3: Compile desktop TypeScript ───────────────────────────────────
console.log('\nStep 4/5: Compiling desktop TypeScript...');
run('pnpm tsc', DESKTOP);

// ── Step 5: Package with electron-builder ────────────────────────────────
const buildTarget = isDirOnly ? '--dir' : '--win';
console.log(`\nStep 5/5: Packaging with electron-builder (${isDirOnly ? 'directory' : 'NSIS installer'})...`);
run(`pnpm node_modules/.bin/electron-builder ${buildTarget} --config electron-builder.yml`, DESKTOP);

// ── Done ──────────────────────────────────────────────────────────────────
const releaseDir = path.join(DESKTOP, 'release');
console.log('\n═══════════════════════════════════════════════');
console.log('  Build complete!');
if (fs.existsSync(releaseDir)) {
  const files = fs.readdirSync(releaseDir)
    .filter(f => f.endsWith('.exe') || f.endsWith('.zip') || fs.statSync(path.join(releaseDir, f)).isDirectory())
    .map(f => `  → ${f}`);
  if (files.length) {
    console.log('\n  Output files:');
    files.forEach(f => console.log(f));
  }
}
console.log(`\n  Installer: ${path.join(DESKTOP, 'release')}`);
console.log('═══════════════════════════════════════════════\n');
