// DOM Elements
const overlay = document.getElementById('overlay');
const artwork = document.getElementById('artwork');
const artworkPlaceholder = document.getElementById('artwork-placeholder');
const titleEl = document.getElementById('title');
const artistEl = document.getElementById('artist');
const progressFill = document.getElementById('progress-fill');
const elapsedEl = document.getElementById('elapsed');
const durationEl = document.getElementById('duration');
const playPauseBtn = document.getElementById('play-pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

// State
let currentInfo = null;
let isInteractive = false;

// Update the UI with now playing info
function updateUI(info) {
  if (!info || !info.title) {
    overlay.classList.add('no-music');
    overlay.classList.remove('playing');

    if (info && info.error) {
      if (info.error.includes('Deezer not found')) {
        titleEl.textContent = 'Deezer non détecté';
        artistEl.textContent = 'Lancez Deezer pour commencer';
      } else {
        titleEl.textContent = 'Permission requise';
        artistEl.textContent = 'Activez "Enregistrement d\'écran" dans Préférences Système';
      }
    } else if (info && info.window_title) {
      titleEl.textContent = 'En attente...';
      artistEl.textContent = 'Jouez une musique sur Deezer';
    } else {
      titleEl.textContent = 'Aucune musique';
      artistEl.textContent = 'Lancez Deezer';
    }

    playPauseBtn.textContent = '▶';
    progressFill.style.width = '0%';
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

  titleEl.textContent = info.title || 'Unknown';
  artistEl.textContent = info.artist || 'Unknown';

  // Update artwork from Deezer API URL
  if (info.artwork) {
    artwork.src = info.artwork;
    artwork.classList.add('visible');
    artworkPlaceholder.classList.add('hidden');
  } else {
    artwork.classList.remove('visible');
    artworkPlaceholder.classList.remove('hidden');
  }

  // No progress available
  progressFill.style.width = '0%';
  elapsedEl.textContent = '';
  durationEl.textContent = '';

  currentInfo = info;
}

// Control handlers
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

// Listen for interactive mode changes
window.deezerOverlay.onInteractiveModeChanged((interactive) => {
  isInteractive = interactive;
  if (interactive) {
    overlay.classList.add('interactive');
  } else {
    overlay.classList.remove('interactive');
  }
});

// Listen for updates from main process
window.deezerOverlay.onNowPlayingUpdate((info) => {
  updateUI(info);
});

// Initial state
updateUI(null);
