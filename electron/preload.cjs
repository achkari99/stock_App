const { contextBridge } = require('electron');

// Expose a minimal safe API surface for renderer processes.
contextBridge.exposeInMainWorld('electronAPI', {});
