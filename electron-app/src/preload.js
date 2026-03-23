const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('streamerApi', {
  searchTitle: (query) => ipcRenderer.invoke('search-title', query),
  selectTitle: (query, match) => ipcRenderer.invoke('select-title', { query, match })
});
