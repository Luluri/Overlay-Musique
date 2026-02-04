const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deezerOverlay', {
  // Playback controls
  togglePlayPause: () => ipcRenderer.invoke('toggle-play-pause'),
  nextTrack: () => ipcRenderer.invoke('next-track'),
  previousTrack: () => ipcRenderer.invoke('previous-track'),

  // Mouse interaction control
  setIgnoreMouse: (ignore) => ipcRenderer.invoke('set-ignore-mouse', ignore),

  // Visibility toggle
  toggleVisibility: () => ipcRenderer.invoke('toggle-visibility'),

  // Listen for now playing updates
  onNowPlayingUpdate: (callback) => {
    ipcRenderer.on('now-playing-update', (event, data) => {
      callback(data);
    });
  },

  // Listen for interactive mode changes
  onInteractiveModeChanged: (callback) => {
    ipcRenderer.on('interactive-mode-changed', (event, isInteractive) => {
      callback(isInteractive);
    });
  }
});
