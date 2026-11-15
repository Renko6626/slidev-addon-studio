const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('studioDesktop', {
  perform: action => ipcRenderer.invoke('studio:project', action),
  onStatus(callback) {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('studio:status', listener)
    return () => ipcRenderer.removeListener('studio:status', listener)
  },
})
