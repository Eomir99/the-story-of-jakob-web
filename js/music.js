// music.js — background music (PLAN.md task 7.2).
//
// Deliberately small: one <audio> element per track in config.js
// MUSIC.tracks, created once and reused for the whole game, so a track can
// never be playing twice. game.js decides WHICH track should be playing
// (updateMusic, every frame) and fires the one-off cue (playMusicCue);
// this file only fades between them.
//
// - A track that fades out is paused, not rewound, so a track that comes
//   back (exploration, after each temporary track) picks up where it left
//   off instead of restarting.
// - A cue (loop: false) plays once over the wanted track, which fades back
//   in the moment the cue has finished.
// - Mute (ui.js) silences the elements but lets them keep playing, like a
//   radio -- unmuting never restarts anything.
// - Tabbing away / unfocusing pauses everything, alongside the game's own
//   freeze (game.js isUnfocused); focus back resumes the same elements.
// - Autoplay: nothing exists until Start is clicked (unlockMusic). If a
//   browser still refuses a play() outside a click, the next click or key
//   press -- the player is pressing keys constantly -- retries it.

import { MUSIC } from './config.js';

const players = new Map(); // track id -> { audio, level (0..1 fade gain), pending }
let cue = null; // id of the one-off cue playing over the wanted track, or null
let audibleId = null; // the track that should currently be heard
let muted = false;
let suspended = false;
let blocked = false; // a play() was refused by the browser's autoplay policy
let lastTime = null;
let volume = 1; // the player's volume control (ui.js), 0..1, on top of MUSIC.volume

// Called from the Start click (ui.js). Creating the elements here rather
// than at boot also keeps the soundtrack out of the title-screen load.
export function unlockMusic() {
  if (players.size > 0) return;
  for (const [id, spec] of Object.entries(MUSIC.tracks)) {
    const audio = new Audio(spec.path);
    audio.loop = spec.loop;
    audio.preload = 'auto';
    audio.muted = muted;
    audio.volume = 0;
    players.set(id, { audio, level: 0, pending: false });
  }
  window.addEventListener('pointerdown', retryBlocked, true);
  window.addEventListener('keydown', retryBlocked, true);
}

// value: the slider's 0..1. Squared for the same reason as the fades
// (updateMusic), so each notch of the slider sounds like an even step.
export function setMusicVolume(value) {
  volume = value * value;
}

export function setMusicMuted(value) {
  muted = value;
  for (const player of players.values()) player.audio.muted = muted;
}

// Plays a one-off cue, from startAt s into it (default: its start). The
// wanted track fades out under it and resumes when it ends.
export function playMusicCue(id, startAt = 0) {
  const player = players.get(id);
  if (!player) return;
  player.audio.currentTime = startAt;
  cue = id;
}

// Called every rendered frame by game.js. trackId: the track that should
// be playing now (null = silence). isSuspended: the page is hidden or
// unfocused.
export function updateMusic(trackId, isSuspended) {
  const now = performance.now();
  const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (players.size === 0) return;

  if (isSuspended) {
    if (!suspended) {
      suspended = true;
      for (const player of players.values()) player.audio.pause();
    }
    return;
  }
  suspended = false;

  if (cue !== null && players.get(cue).audio.ended) {
    players.get(cue).level = 0; // finished: never fade it "out" (that would replay it)
    cue = null;
  }
  audibleId = cue ?? trackId;
  const fadeOut = (audibleId && MUSIC.tracks[audibleId].fadeOutPrevious) || MUSIC.fadeOutDuration;

  for (const [id, player] of players) {
    const fadeIn = MUSIC.tracks[id].fadeIn;
    if (id === audibleId) {
      player.level = fadeIn > 0 ? Math.min(1, player.level + dt / fadeIn) : 1;
    } else {
      player.level = Math.max(0, player.level - dt / fadeOut);
    }
    // Squared, because hearing is logarithmic: a straight-line volume fade
    // jumps in loudness at the start of a fade-in and hangs on at the end
    // of a fade-out. This one sounds even.
    player.audio.volume = player.level * player.level * MUSIC.volume * volume;

    const shouldPlay = id === audibleId || player.level > 0;
    if (shouldPlay && !player.audio.ended) ensurePlaying(player);
    else if (!shouldPlay && !player.audio.paused) player.audio.pause();
  }
}

function ensurePlaying(player) {
  if (!player.audio.paused || player.pending || blocked) return;
  player.pending = true;
  player.audio.play().then(
    () => {
      player.pending = false;
    },
    (error) => {
      player.pending = false;
      // AbortError is just a pause() landing before play() resolved.
      if (error.name === 'NotAllowedError') blocked = true;
    },
  );
}

// Inside a click/key handler, so the browser counts it as user-started.
function retryBlocked() {
  if (!blocked || suspended) return;
  blocked = false;
  const player = players.get(audibleId);
  if (player && !player.audio.ended) ensurePlaying(player);
}
