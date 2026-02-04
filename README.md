# Deezer Overlay for Gaming

A lightweight, always-on-top overlay that displays the currently playing track from Deezer Desktop. Perfect for gamers who want to see what's playing without leaving their game.

![macOS](https://img.shields.io/badge/macOS-000000?style=flat&logo=apple&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=flat&logo=electron&logoColor=white)

## Features

- **Always-on-top overlay** - Stays visible even during games (windowed/borderless mode)
- **Track info display** - Shows song title, artist, and album artwork
- **Playback controls** - Play/Pause, Next, Previous buttons
- **Auto-launch** - Automatically starts when Deezer opens
- **Auto-close** - Automatically closes when Deezer quits
- **Click-through mode** - Doesn't interfere with your game by default
- **No external dependencies** - Works out of the box on any Mac

## Installation

1. Download the latest release (`Deezer Overlay.app`)
2. Move it to your `/Applications` folder
3. Launch the app
4. Grant **Accessibility** permission when prompted:
   - Go to **System Preferences** → **Privacy & Security** → **Accessibility**
   - Add **Deezer Overlay** to the list

## Usage

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd + Shift + I` | Toggle interactive mode (enable clicking on buttons) |
| `Cmd + Shift + M` | Show/hide the overlay |
| `Cmd + Q` | Quit the overlay |

### How to Use

1. Launch **Deezer Desktop** and play some music
2. The overlay will appear in the top-left corner of your screen
3. By default, clicks pass through the overlay (won't interfere with your game)
4. Press `Cmd + Shift + I` to enable interactive mode and click the controls
5. Press `Cmd + Shift + I` again to disable interactive mode

## Auto-Launch Setup (Optional)

To make the overlay automatically start when Deezer opens, create a Launch Agent:

1. Create the file `~/Library/LaunchAgents/com.deezer-overlay-watcher.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.deezer-overlay-watcher</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>
        while true; do
            if pgrep -x "Deezer" > /dev/null; then
                if ! pgrep -f "Deezer Overlay" > /dev/null; then
                    open -a "Deezer Overlay"
                fi
            fi
            sleep 5
        done
        </string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

2. Load it with:
```bash
launchctl load ~/Library/LaunchAgents/com.deezer-overlay-watcher.plist
```

## Requirements

- macOS 11.0 or later
- Deezer Desktop app
- Accessibility permission (for reading window titles and sending keyboard shortcuts)

## Limitations

- Only works with **Deezer Desktop** app (not the web version)
- Overlay may not appear over games running in **exclusive fullscreen** mode (rare on macOS)
- Works best with games in **Windowed** or **Borderless Windowed** mode

## Building from Source

```bash
# Clone the repository
git clone https://github.com/Luluri/Overlay-Musique.git
cd Overlay-Musique

# Install dependencies
npm install

# Run in development mode
npm start

# Build the app
npm run pack
```

The built app will be in `dist/mac-arm64/Deezer Overlay.app`

## License

MIT
