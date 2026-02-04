const overlay = document.getElementById('overlay');
const artwork = document.getElementById('artwork');
const artworkPlaceholder = document.getElementById('artwork-placeholder');
const titleEl = document.getElementById('title');
const artistEl = document.getElementById('artist');
const playPauseBtn = document.getElementById('play-pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

function updateUI(info) {
  if (!info || !info.title) {
    overlay.classList.add('no-music');
    overlay.classList.remove('playing');

    if (info && info.error) {
      if (info.error.includes('Deezer not found')) {
        titleEl.textContent = 'Deezer not detected';
        artistEl.textContent = 'Launch Deezer to start';
      } else {
        titleEl.textContent = 'Permission required';
        artistEl.textContent = 'Enable Accessibility in System Preferences';
      }
    } else if (info && info.window_title) {
      titleEl.textContent = 'Waiting...';
      artistEl.textContent = 'Play a song on Deezer';
    } else {
      titleEl.textContent = 'No music';
      artistEl.textContent = 'Launch Deezer';
    }

    playPauseBtn.textContent = '▶';
    artwork.classList.remove('visible');
    artworkPlaceholder.classList.remove('hidden');
    return;
  }

  overlay.classList.remove('no-music');

  if (info.playing) {
    overlay.classList.add('playing');
    playPauseBtn.textContent = '⏸';
  } else {
    overlay.classList.remove('playing');
    playPauseBtn.textContent = '▶';
  }

  titleEl.textContent = info.title;
  artistEl.textContent = info.artist;

  if (info.artwork) {
    artwork.src = info.artwork;
    artwork.classList.add('visible');
    artworkPlaceholder.classList.add('hidden');
  } else {
    artwork.classList.remove('visible');
    artworkPlaceholder.classList.remove('hidden');
  }
}

playPauseBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  await window.deezerOverlay.togglePlayPause();
});

prevBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  await window.deezerOverlay.previousTrack();
});

nextBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  await window.deezerOverlay.nextTrack();
});

window.deezerOverlay.onInteractiveModeChanged((interactive) => {
  overlay.classList.toggle('interactive', interactive);
});

window.deezerOverlay.onNowPlayingUpdate(updateUI);

updateUI(null);
