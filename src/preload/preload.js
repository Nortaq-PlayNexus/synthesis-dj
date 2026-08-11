const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('synthesis', {
  openAudio: (allowMultiple) => ipcRenderer.invoke('dialog:openAudio', !!allowMultiple),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  onMenuLoad: (cb) => ipcRenderer.on('menu:load', () => cb()),
  captureMode: process.env.SYNTH_CAPTURE === '1',
  platform: process.platform,
});
