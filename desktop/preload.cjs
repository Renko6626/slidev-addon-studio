const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('studioDesktop', {
  perform: action => ipcRenderer.invoke('studio:project', action),
  studioUpdate: () => ipcRenderer.invoke('studio:updates'),
  onStatus(callback) {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('studio:status', listener)
    return () => ipcRenderer.removeListener('studio:status', listener)
  },
})
