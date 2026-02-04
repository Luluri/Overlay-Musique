const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const { execSync, exec } = require('child_process');
const path = require('path');

// Suppress EPIPE errors
process.stdout.on('error', () => {});
process.stderr.on('error', () => {});
process.on('uncaughtException', (err) => {
  if (err.code !== 'EPIPE') {
    try { console.error('Uncaught:', err.message); } catch (e) {}
  }
});

let mainWindow;
let isInteractive = false;
let pollingInterval;
let alwaysOnTopInterval;
let lastTrackKey = '';
let isCurrentlyPlaying = true;

const artworkCache = new Map();

function createWindow() {
  if (app.dock) {
    app.dock.hide();
  }

  mainWindow = new BrowserWindow({
    width: 320,
    height: 120,
    x: 20,
    y: 20,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Periodically reinforce always-on-top
  alwaysOnTopInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
  }, 2000);

  startPolling();
}

function getAlbumArt(title, artist) {
  const cacheKey = `${title}|${artist}`;
  if (artworkCache.has(cacheKey)) {
    return Promise.resolve(artworkCache.get(cacheKey));
  }

  return new Promise((resolve) => {
    const query = encodeURIComponent(`${title} ${artist}`);
    const url = `https://api.deezer.com/search?q=${query}&limit=1`;
    const https = require('https');

    const req = https.get(url, { timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data.length > 0) {
            const coverUrl = json.data[0]?.album?.cover_medium;
            if (coverUrl) {
              artworkCache.set(cacheKey, coverUrl);
              resolve(coverUrl);
              return;
            }
          }
        } catch (e) {}
        resolve(null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function getDeezerInfo() {
  try {
    const script = `
      tell application "System Events"
        if exists (process "Deezer") then
          try
            set windowTitle to name of first window of (first process whose name is "Deezer")
            return windowTitle
          on error
            return "DEEZER_RUNNING_NO_WINDOW"
          end try
        else
          return "DEEZER_NOT_FOUND"
        end if
      end tell
    `;

    const result = execSync(`osascript -e '${script}'`, {
      encoding: 'utf8',
      timeout: 2000
    }).trim();

    if (result === 'DEEZER_NOT_FOUND') {
      return { title: null, artist: null, playing: false, artwork: null, error: 'Deezer not found' };
    }

    if (result === 'DEEZER_RUNNING_NO_WINDOW') {
      return { title: null, artist: null, playing: false, artwork: null, deezer_found: true };
    }

    if (result && result.includes(' - Deezer')) {
      const trackPart = result.replace(/ - Deezer$/, '').trim();

      if (trackPart.includes(' - ')) {
        const parts = trackPart.split(' - ');
        const song = parts[0].trim();
        const artist = parts.slice(1).join(' - ').trim();
        return { title: song, artist: artist, playing: isCurrentlyPlaying, artwork: null };
      } else {
        return { title: trackPart, artist: 'Unknown', playing: isCurrentlyPlaying, artwork: null };
      }
    }

    return { title: null, artist: null, playing: false, artwork: null, window_title: result };
  } catch (error) {
    return { title: null, artist: null, playing: false, artwork: null, error: error.message };
  }
}

async function fetchAndSendInfo() {
  const info = getDeezerInfo();

  // Quit overlay if Deezer is closed
  if (info.error && info.error.includes('Deezer not found')) {
    app.quit();
    return;
  }

  // Fetch artwork if we have a track
  if (info.title && info.artist) {
    const trackKey = `${info.title}|${info.artist}`;
    if (trackKey !== lastTrackKey || !info.artwork) {
      lastTrackKey = trackKey;
      info.artwork = await getAlbumArt(info.title, info.artist);
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('now-playing-update', info);
  }
}

function startPolling() {
  pollingInterval = setInterval(fetchAndSendInfo, 1500);
  setTimeout(fetchAndSendInfo, 500);
}

const NOWPLAYING_CLI = '/opt/homebrew/bin/nowplaying-cli';

function mediaControl(action) {
  return new Promise((resolve, reject) => {
    let command;
    switch (action) {
      case 'playpause':
        command = `${NOWPLAYING_CLI} togglePlayPause`;
        break;
      case 'next':
        command = `${NOWPLAYING_CLI} next`;
        break;
      case 'previous':
        command = `${NOWPLAYING_CLI} previous`;
        break;
      default:
        reject(new Error('Unknown action'));
        return;
    }

    exec(command, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// IPC handlers
ipcMain.handle('toggle-play-pause', async () => {
  try {
    await mediaControl('playpause');
    isCurrentlyPlaying = !isCurrentlyPlaying;
    fetchAndSendInfo();
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('next-track', async () => {
  try {
    await mediaControl('next');
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('previous-track', async () => {
  try {
    await mediaControl('previous');
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('set-ignore-mouse', (event, ignore) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

app.whenReady().then(() => {
  createWindow();

  // Cmd+Q: Quit the app
  globalShortcut.register('CommandOrControl+Q', () => {
    app.quit();
  });

  // Cmd+Shift+I: Toggle interactive mode
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    isInteractive = !isInteractive;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(!isInteractive, { forward: true });
      mainWindow.webContents.send('interactive-mode-changed', isInteractive);

      if (isInteractive) {
        mainWindow.setFocusable(true);
        mainWindow.focus();
      } else {
        mainWindow.setFocusable(false);
      }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (pollingInterval) clearInterval(pollingInterval);
  if (alwaysOnTopInterval) clearInterval(alwaysOnTopInterval);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
