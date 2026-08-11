const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1720,
    height: 1000,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#04060c',
    title: 'SYNTHESIS AI DJ COMMAND SYSTEM',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (process.env.SYNTH_SMOKE === '1') {
    runSmokeTest(mainWindow);
  }
  if (process.env.SYNTH_CAPTURE === '1') {
    runCapture(mainWindow);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function runSmokeTest(win) {
  win.webContents.on('console-message', (event) => {
    console.log(`[renderer:${event.level}]`, event.message);
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.log('DID_FAIL_LOAD', code, desc);
    app.exit(1);
  });
  win.webContents
    .executeJavaScript(
      `(async () => {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const sr = 22050, dur = 20, bpm = 128, beat = 60 / bpm, n = sr * dur;
          const buf = ctx.createBuffer(1, n, sr);
          const d = buf.getChannelData(0);
          for (let k = 0; k < dur / beat; k++) {
            const s = Math.floor(k * beat * sr), l = Math.floor(0.12 * sr);
            for (let i = 0; i < l && s + i < n; i++) d[s + i] += 0.9 * Math.sin(2 * Math.PI * 62 * i / sr) * Math.pow(1 - i / l, 3);
          }
          for (let i = 0; i < n; i++) { const t = i / sr; d[i] += 0.2 * Math.sin(2 * Math.PI * 110 * t); }
          const mod = await import('./js/analyzer.js');
          const res = await mod.analyzeAudioBuffer(buf, () => {});
          console.log('[SMOKE-ANALYSIS] BPM=' + res.bpm.toFixed(2) + ' KEY=' + res.key.name.toUpperCase() + ' CAMELOT=' + res.key.camelot + ' BEATS=' + res.beatTimes.length + ' DROPS=' + res.energy.peaks.length);
          console.log('[SMOKE-ANALYSIS] OK');
        } catch (e) {
          console.log('[SMOKE-ANALYSIS] ERROR ' + e.message);
        }
      })();`,
    )
    .catch((e) => console.log('[SMOKE-ANALYSIS] ERROR ' + e.message));
  setTimeout(() => {
    console.log('SMOKE_COMPLETE');
    app.exit(0);
  }, 10000);
}

async function runCapture(win) {
  const shotDir = path.join(__dirname, '..', '..', 'assets', 'screenshots');
  fs.mkdirSync(shotDir, { recursive: true });
  const waitFor = async (expr, tries = 150) => {
    for (let i = 0; i < tries; i++) {
      try {
        if (await win.webContents.executeJavaScript(expr)) return true;
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  };
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.log('DID_FAIL_LOAD', code, desc);
    app.exit(1);
  });

  await new Promise((r) => setTimeout(r, 600));
  await waitFor('window.__captureReady === true');
  await new Promise((r) => setTimeout(r, 1500));
  let img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(shotDir, 'command-center.png'), img.toPNG());
  console.log('CAPTURED command-center.png');

  await win.webContents
    .executeJavaScript('window.__captureStage2 ? window.__captureStage2() : null')
    .catch(() => {});
  await waitFor('window.__captureStage2Done === true');
  await new Promise((r) => setTimeout(r, 1800));
  img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(shotDir, 'autonomous-mix.png'), img.toPNG());
  console.log('CAPTURED autonomous-mix.png');

  img = await win.webContents.capturePage({ x: 0, y: 0, width: 1720, height: 400 });
  fs.writeFileSync(path.join(shotDir, 'command-bar.png'), img.toPNG());
  console.log('CAPTURED command-bar.png');

  await renderLogoPng();
  console.log('CAPTURE_COMPLETE');
  app.exit(0);
}

async function renderLogoPng() {
  const out = path.join(__dirname, '..', '..', 'assets', 'logo.png');
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    transparent: true,
    frame: false,
    show: false,
    webPreferences: { sandbox: true },
  });
  await win.loadFile(path.join(__dirname, '..', '..', 'assets', 'logo.svg'));
  await new Promise((r) => setTimeout(r, 500));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(out, img.toPNG());
  win.destroy();
  console.log('CAPTURED logo.png');
}

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'mp4', 'aiff', 'wma', 'opus'];

ipcMain.handle('dialog:openAudio', async (_event, allowMultiple) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Load tracks into the SYNTHESIS command system',
    properties: allowMultiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [
      { name: 'Audio', extensions: AUDIO_EXTENSIONS },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return [];

  return result.filePaths.map((fp) => {
    const data = fs.readFileSync(fp);
    return {
      name: path.basename(fp),
      path: fp,
      size: data.byteLength,
      data: new Uint8Array(data),
    };
  });
});

ipcMain.handle('shell:openExternal', (_event, url) => {
  shell.openExternal(url);
});

const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Load Tracks',
        accelerator: 'CmdOrCtrl+O',
        click: () => mainWindow && mainWindow.webContents.send('menu:load'),
      },
      { type: 'separator' },
      { role: 'quit', label: 'Exit' },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload', label: 'Reload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Fullscreen' },
    ],
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'About SYNTHESIS',
        click: () =>
          dialog.showMessageBox(mainWindow, {
            title: 'SYNTHESIS',
            message: 'SYNTHESIS AI DJ Command System',
            detail:
              'Military-grade autonomous music intelligence platform.\n\nBuilt on Web Audio + Electron. Real-time beat, key and energy analysis with an AI transition director.',
          }),
      },
    ],
  },
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
