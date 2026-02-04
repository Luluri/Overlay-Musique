const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deezerOverlay', {
  togglePlayPause: () => ipcRenderer.invoke('toggle-play-pause'),
  nextTrack: () => ipcRenderer.invoke('next-track'),
  previousTrack: () => ipcRenderer.invoke('previous-track'),
  setIgnoreMouse: (ignore) => ipcRenderer.invoke('set-ignore-mouse', ignore),
  onNowPlayingUpdate: (callback) => {
    ipcRenderer.on('now-playing-update', (event, data) => callback(data));
  },
  onInteractiveModeChanged: (callback) => {
    ipcRenderer.on('interactive-mode-changed', (event, isInteractive) => callback(isInteractive));
  }
});
