const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

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

// Check and install nowplaying-cli if needed
async function ensureNowPlayingCli() {
  const possiblePaths = [
    '/opt/homebrew/bin/nowplaying-cli',
    '/usr/local/bin/nowplaying-cli'
  ];

  // Check if nowplaying-cli already exists
  for (const cliPath of possiblePaths) {
    if (fs.existsSync(cliPath)) {
      return cliPath;
    }
  }

  // Check if Homebrew is installed
  const homebrewPaths = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'];
  let brewPath = null;
  for (const bp of homebrewPaths) {
    if (fs.existsSync(bp)) {
      brewPath = bp;
      break;
    }
  }

  if (!brewPath) {
    // Homebrew not installed - show error dialog
    dialog.showErrorBox(
      'Homebrew Required',
      'This app requires Homebrew to install dependencies.\n\n' +
      'Please install Homebrew first:\n' +
      'Visit https://brew.sh and follow the instructions.\n\n' +
      'Then restart the app.'
    );
    app.quit();
    return null;
  }

  // Ask user permission to install
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Install', 'Cancel'],
    defaultId: 0,
    title: 'Install Required Dependency',
    message: 'nowplaying-cli is required for playback controls.',
    detail: 'Would you like to install it now via Homebrew?\n\nThis will run: brew install nowplaying-cli'
  });

  if (result.response === 1) {
    // User cancelled
    dialog.showErrorBox(
      'Installation Cancelled',
      'The app cannot function without nowplaying-cli.\n\n' +
      'You can install it manually with:\nbrew install nowplaying-cli'
    );
    app.quit();
    return null;
  }

  // Show installing dialog
  const installWindow = new BrowserWindow({
    width: 300,
    height: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false }
  });

  installWindow.loadURL(`data:text/html,
    <html>
      <body style="font-family: -apple-system, sans-serif; background: rgba(30,30,35,0.95);
                   color: white; display: flex; align-items: center; justify-content: center;
                   height: 100vh; margin: 0; border-radius: 12px;">
        <div style="text-align: center;">
          <p style="margin: 0;">Installing nowplaying-cli...</p>
          <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.6;">This may take a moment</p>
        </div>
      </body>
    </html>
  `);

  try {
    // Run brew install
    execSync(`${brewPath} install nowplaying-cli`, {
      encoding: 'utf8',
      timeout: 120000, // 2 minute timeout
      stdio: 'pipe'
    });

    installWindow.close();

    // Check again for the installed path
    for (const cliPath of possiblePaths) {
      if (fs.existsSync(cliPath)) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Installation Complete',
          message: 'nowplaying-cli has been installed successfully!',
          buttons: ['OK']
        });
        return cliPath;
      }
    }

    throw new Error('Installation completed but binary not found');
  } catch (error) {
    installWindow.close();
    dialog.showErrorBox(
      'Installation Failed',
      `Failed to install nowplaying-cli:\n${error.message}\n\n` +
      'Please try installing manually:\nbrew install nowplaying-cli'
    );
    app.quit();
    return null;
  }
}

let NOWPLAYING_CLI = '/opt/homebrew/bin/nowplaying-cli';

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

app.whenReady().then(async () => {
  // Check and install nowplaying-cli if needed
  const cliPath = await ensureNowPlayingCli();
  if (!cliPath) return; // App will quit if installation failed
  NOWPLAYING_CLI = cliPath;

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
