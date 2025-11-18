const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.sendSync('storage:load'),
  saveData: (data) => ipcRenderer.send('storage:save', data),
});
