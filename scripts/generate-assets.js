const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const electron = require('electron');

console.log('Rendering screenshots and logo via Electron capture mode...');

const result = spawnSync(electron, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, SYNTH_CAPTURE: '1' },
});

process.exit(result.status ?? 1);
