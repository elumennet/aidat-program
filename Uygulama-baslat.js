// Chrome/Edge ile uygulama gibi (tam ekran, ayrı pencere) açan başlatıcı
// (C) 2026 Cemal Solmaz — Tüm hakları saklıdır.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

const root = __dirname;
const file = 'file:///' + path.join(root, 'index.html').replace(/\\/g, '/');

const adaylar = [
  path.join(process.env['PROGRAMFILES'] || '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['LOCALAPPDATA'] || '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['PROGRAMFILES'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft/Edge/Application/msedge.exe')
].filter(Boolean);

const tarayici = adaylar.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
const profil = path.join(process.env['LOCALAPPDATA'] || os.tmpdir(), 'AidatProgram');

if (tarayici) {
  const p = spawn(tarayici, [
    '--app=' + file,
    '--user-data-dir=' + profil,
    '--window-size=520,900',
    '--no-first-run',
    '--no-default-browser-check'
  ], { detached: true, stdio: 'ignore' });
  p.unref();
  process.exit(0);
}

// Chrome/Edge yoksa varsayılan tarayıcıda aç
const p = spawn('cmd', ['/c', 'start', '', 'index.html'], { cwd: root, detached: true, stdio: 'ignore' });
p.unref();
