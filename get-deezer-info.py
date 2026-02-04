#!/usr/bin/env python3
"""
Get Deezer window title and extract track info.
Fetches album art from Deezer API.
Requires Screen Recording permission on macOS.
"""
import json
import sys
import urllib.request
import urllib.parse

try:
    from Quartz import CGWindowListCopyWindowInfo, kCGWindowListOptionOnScreenOnly, kCGNullWindowID
except ImportError:
    print(json.dumps({"error": "Quartz not installed"}))
    sys.exit(1)

# Cache for album art to avoid repeated API calls
_artwork_cache = {}

def get_album_art(title, artist):
    """Fetch album art URL from Deezer API"""
    cache_key = f"{title}|{artist}"
    if cache_key in _artwork_cache:
        return _artwork_cache[cache_key]

    try:
        # Search for the track on Deezer
        query = urllib.parse.quote(f"{title} {artist}")
        url = f"https://api.deezer.com/search?q={query}&limit=1"

        req = urllib.request.Request(url, headers={'User-Agent': 'DeezerOverlay/1.0'})
        with urllib.request.urlopen(req, timeout=2) as response:
            data = json.loads(response.read().decode('utf-8'))

            if data.get('data') and len(data['data']) > 0:
                track = data['data'][0]
                # Get medium size cover (250x250)
                cover_url = track.get('album', {}).get('cover_medium')
                if cover_url:
                    _artwork_cache[cache_key] = cover_url
                    return cover_url
    except Exception:
        pass

    return None

def get_deezer_info():
    windows = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID)

    for win in windows:
        owner = win.get('kCGWindowOwnerName', '')
        if owner == 'Deezer':
            title = win.get('kCGWindowName', '')

            # Check for track info in title
            # Format: "Song - Artist - Deezer" or "Song - Artist, Artist2 - Deezer"
            if title and ' - Deezer' in title:
                # Remove " - Deezer" suffix
                track_part = title.rsplit(' - Deezer', 1)[0].strip()

                if ' - ' in track_part:
                    # Split into song and artist (song is first, artist is second)
                    parts = track_part.split(' - ', 1)
                    song = parts[0].strip()
                    artist = parts[1].strip() if len(parts) > 1 else 'Unknown'

                    # Fetch album art
                    artwork_url = get_album_art(song, artist)

                    return {
                        "title": song,
                        "artist": artist,
                        "playing": True,
                        "artwork": artwork_url
                    }
                else:
                    artwork_url = get_album_art(track_part, "")
                    return {
                        "title": track_part,
                        "artist": "Unknown",
                        "playing": True,
                        "artwork": artwork_url
                    }

            # Also check for " | Deezer" format (just in case)
            elif title and ' | Deezer' in title:
                track_part = title.replace(' | Deezer', '').strip()
                if ' - ' in track_part:
                    parts = track_part.split(' - ', 1)
                    song = parts[1].strip() if len(parts) > 1 else parts[0]
                    artist = parts[0].strip()
                    artwork_url = get_album_art(song, artist)
                    return {
                        "title": song,
                        "artist": artist,
                        "playing": True,
                        "artwork": artwork_url
                    }
                else:
                    return {
                        "title": track_part,
                        "artist": "Unknown",
                        "playing": True,
                        "artwork": None
                    }

            elif title:
                # Window exists but no track info - Deezer is open but not playing
                return {
                    "title": None,
                    "artist": None,
                    "playing": False,
                    "artwork": None,
                    "window_title": title
                }
            else:
                # Empty title - Deezer running but no window title access
                return {
                    "title": None,
                    "artist": None,
                    "playing": False,
                    "artwork": None,
                    "deezer_found": True
                }

    return {"title": None, "artist": None, "playing": False, "artwork": None, "error": "Deezer not found"}

if __name__ == "__main__":
    info = get_deezer_info()
    print(json.dumps(info))
