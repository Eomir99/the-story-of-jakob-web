// ui.js — DOM screens layered over the canvas (AGENTS.md §5: menus,
// narrative copy and application text are never drawn on canvas). This
// file owns showing and hiding them and wiring their controls back into
// game.js. game.js never touches the DOM itself.

import { startFromTitle, subscribeToStateChange, subscribeToTitleCard, subscribeToTutorialVisibility, subscribeToResumeHint, STATE } from './game.js';
import { loadAssets } from './assets.js';
import { initComicViewer, showComic, hideComic } from './comics.js';
import { unlockMusic, setMusicMuted, setMusicVolume } from './music.js';
import { subscribeToReceptionChoice, chooseReceptionOption, subscribeToReceptionRetry, requestReceptionRetry, subscribeToReceptionRunning } from './reception.js';

export function initUI() {
  initTitleScreen();
  initComicViewer();
  initPersistentControls();
  initStudentmossaCard();
  initTutorialHints();
  initResumeHint();
  initReceptionChoice();

  const persistentControls = document.querySelector('#persistent-controls');

  // One subscription (subscribeToStateChange only ever holds the latest
  // listener) drives every DOM screen that reacts to game.js's state:
  // - the comic screen shows/hides itself in lockstep with COMIC, entered
  //   from the title screen and, mid-level, from level.js's comic-trigger
  //   entries (game.js's checkComicTriggers).
  // - persistent controls (task 4.4) are present during gameplay and
  //   comics, but not on TITLE, which already has its own Skip link.
  // - APPLICATION (task 4.9) isn't a screen -- finishing the game lands
  //   on the real application.html, ending the page here.
  subscribeToStateChange((state, info) => {
    if (state === STATE.COMIC) {
      showComic(info.comicId);
    } else {
      hideComic();
    }

    if (persistentControls) persistentControls.hidden = state === STATE.TITLE;
    if (state !== STATE.PLAYING) {
      const hints = document.querySelector('#tutorial-hints');
      if (hints) hints.hidden = true;
    }

    if (state === STATE.APPLICATION) window.location.href = './application.html';
  });
}

// The utspring title card (task 3.5). game.js owns every timing; this
// only shows the element and applies the opacity it is handed, which is
// computed from simulation time and so pauses with the game.
function initStudentmossaCard() {
  const card = document.querySelector('#studentmossa-card');
  if (!card) return;

  subscribeToTitleCard((visible, opacity) => {
    card.hidden = !visible;
    card.style.opacity = String(opacity);
  });
}

function initTutorialHints() {
  const hints = document.querySelector('#tutorial-hints');
  if (!hints) return;
  subscribeToTutorialVisibility((visible) => {
    hints.hidden = !visible;
  });
}

// The focus/visibility hint (task 3.10). Not a pause menu -- task 3.10
// forbids one -- and not interactive: game.js shows it over the frozen
// frame and hides it again the moment focus returns, and the stylesheet
// keeps pointer events off it so the click that restores focus goes
// straight through to the canvas.
function initResumeHint() {
  const hint = document.querySelector('#resume-hint');
  if (!hint) return;

  subscribeToResumeHint((visible) => {
    hint.hidden = !visible;
  });
}

// The Clinic reception's "Try again / Skip this round" choice
// (reception.js). reception.js decides when it shows and holds the game
// still meanwhile; this only shows the element and hands the answer back.
function initReceptionChoice() {
  const panel = document.querySelector('#reception-choice');
  const retry = document.querySelector('#reception-retry');
  const skip = document.querySelector('#reception-skip');
  if (!panel || !retry || !skip) return;

  subscribeToReceptionChoice((visible) => {
    panel.hidden = !visible;
    if (visible) retry.focus();
  });
  retry.addEventListener('click', () => chooseReceptionOption('retry'));
  skip.addEventListener('click', () => chooseReceptionOption('skip'));

  // Round 3's optional Retry, offered after it has been failed.
  const retryFinal = document.querySelector('#reception-retry-final');
  if (!retryFinal) return;
  subscribeToReceptionRetry((visible) => {
    retryFinal.hidden = !visible;
  });
  retryFinal.addEventListener('click', () => {
    requestReceptionRetry();
    // Hand focus back to the page, so Space/arrows reach the game rather
    // than "pressing" this button again.
    retryFinal.blur();
  });
}

// Mute/Unmute (task 4.4). Silences the music (music.js); anything that
// plays sound later reads isMuted() too. The volume slider beside it sets
// the music level, remembered in this browser when storage allows.
let muted = false;
export function isMuted() {
  return muted;
}

const VOLUME_STORAGE_KEY = 'story-of-jakob-volume';

function initPersistentControls() {
  initVolumeSlider();
  // Hidden (not removed, so volume and mute keep their place) while the
  // Clinic reception runs -- see reception.js subscribeToReceptionRunning.
  const skipControl = document.querySelector('.skip-control');
  if (skipControl) {
    subscribeToReceptionRunning((running) => {
      skipControl.style.visibility = running ? 'hidden' : '';
    });
  }
  const muteButton = document.querySelector('#mute-button');
  if (!muteButton) return;

  muteButton.addEventListener('click', () => {
    muted = !muted;
    muteButton.textContent = muted ? 'Unmute' : 'Mute';
    setMusicMuted(muted);
  });
}

function initVolumeSlider() {
  const slider = document.querySelector('#volume-slider');
  if (!slider) return;

  try {
    const saved = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    if (saved !== null && !Number.isNaN(Number(saved))) slider.value = saved;
  } catch {
    // Storage blocked (private window, settings): the slider still works.
  }
  setMusicVolume(Number(slider.value) / 100);

  slider.addEventListener('input', () => {
    setMusicVolume(Number(slider.value) / 100);
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, slider.value);
    } catch {
      // Not remembered, that's all.
    }
  });
  // Hand focus back to the page after a drag, so the arrow keys move
  // Jakob again instead of the slider.
  slider.addEventListener('pointerup', () => slider.blur());
}

function initTitleScreen() {
  const screen = document.querySelector('#title-screen');
  const startButton = document.querySelector('#start-button');
  const loadingStatus = document.querySelector('#loading-status');
  const loadingPercent = document.querySelector('#loading-percent');
  if (!screen || !startButton) return;

  startButton.addEventListener('click', () => {
    screen.hidden = true;
    // Inside the click, so browsers allow the music to start (autoplay).
    unlockMusic();
    startFromTitle();
  });

  // Task 4.2: title is already visible (no blank wait); Start stays
  // disabled and shows a percentage until the manifest has loaded.
  loadAssets((fraction) => {
    if (loadingPercent) loadingPercent.textContent = `${Math.round(fraction * 100)}%`;
  }).then(() => {
    startButton.disabled = false;
    startButton.focus();
    if (loadingStatus) loadingStatus.hidden = true;
  });
}
