// reception.js — the Clinic reception encounter (admin summer job).
//
// PROTOTYPE, built in small playtested steps. Three rounds that grow from
// simple reception work, through multitasking, into controlled chaos:
//   Round 1  move and jump to collect files, one at a time, against a clock
//   Round 2  the same, plus dragging cards into matching boxes with the
//            mouse at the same time
//   Round 3  the overload: a fourth tier of blocks, eight tasks appearing
//            in pairs across every tier, the cards as a deck (only the top
//            one moves), time lost for mistakes.
//            Deliberately barely possible. Failing it does not restart it:
//            the encounter ends with a friendly jab and an optional Retry.
//
// One hardcoded encounter, the same way the utspring and the boss approach
// are one hardcoded sequence each (AGENTS.md §7.10) -- not a minigame
// framework. Layout comes from its level.js entry; timings and looks from
// config.js RECEPTION. game.js calls in at a handful of fixed points:
//   updateReception         once per step, before the player moves
//   applyReceptionWalls     after the player moves
//   receptionPlatforms      extra platforms to collide with, once shown
//   receptionCameraFraming  camera override while the encounter runs
//   drawReception...        world-space scenery, bubbles, and the HUD
// ui.js calls in for the two DOM pieces:
//   subscribeToReceptionChoice, chooseReceptionOption  "Try again / Skip"
//   subscribeToReceptionRetry, requestReceptionRetry    Round 3's Retry
//
// The phases, in order:
//   IDLE      waiting for the player to reach the trigger
//   THINK     control taken; Jakob wonders how hard admin can be
//   FRAME     camera pulls out to frame the arena; the desk welcomes him
//   READY     platforms pop in, "Let's go!"
//   ROUND     control back (no shooting); do the round's jobs in time
//   FAILED    ran out of time: a short line, then the round restarts --
//             or, in Round 3, the arena opens up (DONE, Retry offered)
//   CHOICE    ran out of time again: "Try again / Skip this round" (DOM)
//   CLEARED   jobs done (or skipped): a short line, then the next round's
//   INTRO     control taken; the next round's new job is shown and explained
//   DONE      walls open, camera released, shooting back. Only re-entered
//             through Round 3's Retry.

import { CANVAS, WORLD, PLATFORM, PLAYER, RECEPTION } from './config.js';
import { setInputSuppressed, getPointer } from './input.js';
import { getImage } from './assets.js';

const PHASE = {
  IDLE: 'idle',
  THINK: 'think',
  FRAME: 'frame',
  READY: 'ready',
  ROUND: 'round',
  FAILED: 'failed',
  CHOICE: 'choice',
  CLEARED: 'cleared',
  INTRO: 'intro',
  DONE: 'done',
};

// --- The two DOM pieces (ui.js) ---------------------------------------------
// Whether the encounter is running (takeover to done). ui.js hides the
// Skip to application control meanwhile: it sits in the bottom-left
// corner, over the card tray, where a click meant for a card could leave
// the game.
let encounterListener = null;
export function subscribeToReceptionRunning(listener) {
  encounterListener = listener;
}

// Same one-listener shape as game.js's title card: this file owns when each
// shows, ui.js owns the elements and hands the answers back.
let choiceListener = null;
let pendingChoice = null; // 'retry' | 'skip', picked up on the next step
export function subscribeToReceptionChoice(listener) {
  choiceListener = listener;
}
export function chooseReceptionOption(option) {
  pendingChoice = option;
}
function showChoice(visible) {
  if (choiceListener) choiceListener(visible);
}

let retryListener = null;
let pendingRetry = false;
export function subscribeToReceptionRetry(listener) {
  retryListener = listener;
}
export function requestReceptionRetry() {
  pendingRetry = true;
}
function showRetry(visible) {
  if (retryListener) retryListener(visible);
}

// Converts one of level.js's { dx, clearance } placements (dx from the
// arena's left edge, clearance = height of the top surface above the
// ground) into world coordinates.
function platformFromLayout(arenaLeftX, placement) {
  return {
    x: arenaLeftX + placement.dx,
    y: WORLD.groundY - placement.clearance,
    width: PLATFORM.width,
    height: PLATFORM.height,
    walkway: false,
    shownAt: null, // encounter clock when it popped in; null = not yet
  };
}

function itemFromLayout(arenaLeftX, placement) {
  const spec = RECEPTION.item;
  return {
    x: arenaLeftX + placement.dx - spec.width / 2,
    y: WORLD.groundY - placement.clearance - spec.hoverAboveSurface - spec.height,
    width: spec.width,
    height: spec.height,
    kind: placement.kind ?? 'file',
    collected: false,
  };
}

export function createReception(entry) {
  const items = (list) => list.map((placement) => itemFromLayout(entry.arenaLeftX, placement));
  const platforms = (list) => list.map((placement) => platformFromLayout(entry.arenaLeftX, placement));
  const basePlatforms = platforms(entry.platforms);
  const round3Platforms = platforms(entry.round3Platforms);
  return {
    phase: PHASE.IDLE,
    timer: 0, // time spent in the current phase
    clock: 0, // total time since the encounter started -- drives animation
    triggerX: entry.triggerX,
    arenaLeftX: entry.arenaLeftX,
    arenaRightX: entry.arenaRightX,
    signX: entry.signX,
    walkInX: entry.walkInX,
    // The left wall closes only once Jakob has walked in: control is taken
    // outside the arena (level.js RECEPTION_TRIGGER_X).
    insideArena: false,
    deskX: entry.deskX,
    basePlatforms,
    platforms: [...basePlatforms, ...round3Platforms],
    // The rounds, in order: what each asks for. Three entries, not a system.
    rounds: [
      {
        items: items(entry.round1Items),
        batchSize: 1, // items appear this many at a time, in list order
        itemLabel: 'Files',
        cards: [],
        timeLimit: RECEPTION.round1.timeLimit,
        task: RECEPTION.lines.round1Task,
        hint: RECEPTION.lines.round1Hint,
        cleared: RECEPTION.lines.round1Cleared,
      },
      {
        items: items(entry.round2Items),
        batchSize: 1,
        itemLabel: 'Files',
        cards: entry.round2Cards,
        timeLimit: RECEPTION.round2.timeLimit,
        introDuration: RECEPTION.round2.introDuration,
        task: RECEPTION.lines.round2Task,
        hint: RECEPTION.lines.round2Hint,
        cleared: RECEPTION.lines.round2Cleared,
        intro: RECEPTION.lines.round2Intro,
        sortTooltip: RECEPTION.lines.sortTooltip,
      },
      {
        items: items(entry.round3Items),
        batchSize: 2, // in pairs
        itemLabel: 'Tasks',
        cards: entry.round3Cards,
        deck: true, // one face-up pile, only the top card can be moved
        wrongDropPenalty: RECEPTION.round3.wrongDropPenalty,
        timeLimit: RECEPTION.round3.timeLimit,
        introDuration: RECEPTION.round3.introDuration,
        newPlatforms: round3Platforms, // pop in during this round's intro
        task: RECEPTION.lines.round3Task,
        hint: RECEPTION.lines.round3Hint,
        cleared: RECEPTION.lines.round3Cleared,
        intro: RECEPTION.lines.round3Intro,
        sortTooltip: RECEPTION.lines.round3SortTooltip,
        failEnds: true, // no restart, no Try again/Skip -- see FAILED below
      },
    ],
    roundIndex: 0,
    failCount: 0, // failed attempts at the current round
    cards: [], // the current round's cards: { color, x, y, homeX, homeY, sorted }
    sortTray: false, // tray and boxes on screen (from the first sorting round on)
    tooltipDone: false, // the current round's tooltip is gone (first correct sort)
    dragging: null, // { card, offsetX, offsetY } while a card is held
    binFlashes: {}, // color -> { timer, right }
    penaltyTimer: 0, // the floating "-2 s" after a wrong drop
    roundTimeLeft: 0,
    retryOffered: false, // Round 3 failed and the Retry button is up
    // Development shortcut only (game.js applyDebugStart, ?round=N): skip
    // straight to round N once the intro has played. 1 = normal.
    debugStartRound: 1,
    // At most one line per speaker at a time: { text, timer } or null.
    // timer null means "until replaced or cleared".
    playerLine: null,
    deskLine: null,
  };
}

function currentRound(reception) {
  return reception.rounds[reception.roundIndex];
}

function enterPhase(reception, phase) {
  reception.phase = phase;
  reception.timer = 0;
  if (encounterListener) encounterListener(encounterRunning(reception));
}

function say(reception, speaker, text, duration = null) {
  const line = { text, timer: duration };
  if (speaker === 'player') reception.playerLine = line;
  else reception.deskLine = line;
}

function updateLines(reception, dt) {
  for (const key of ['playerLine', 'deskLine']) {
    const line = reception[key];
    if (!line || line.timer === null) continue;
    line.timer -= dt;
    if (line.timer <= 0) reception[key] = null;
  }
}

function aabbOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function showPlatforms(reception, platforms) {
  platforms.forEach((platform, index) => {
    platform.shownAt = reception.clock + index * RECEPTION.platformPopStagger;
  });
}

// --- Sorting geometry (screen space; see config.js RECEPTION.sorting) ------

function trayCardHome(index) {
  const spec = RECEPTION.sorting;
  return { x: spec.trayX + index * (spec.cardWidth + spec.cardGap), y: spec.trayY };
}

function binRect(color) {
  const spec = RECEPTION.sorting;
  const index = spec.binOrder.indexOf(color);
  return { x: spec.binX + index * (spec.binWidth + spec.binGap), y: spec.binY, width: spec.binWidth, height: spec.binHeight };
}

function pointInRect(x, y, rect, padding = 0) {
  return x >= rect.x - padding && x <= rect.x + rect.width + padding && y >= rect.y - padding && y <= rect.y + rect.height + padding;
}

// Where each unsorted card rests: side by side in the tray, or -- in a
// deck round -- piled at the tray's first slot, each card under the top
// one peeking out a little further down and right. Called again after
// every sort, so a deck closes up and the rest ease into their new places.
function layoutCards(reception) {
  const spec = RECEPTION.sorting;
  const deck = currentRound(reception).deck;
  let depth = 0;
  reception.cards.forEach((card, index) => {
    if (card.sorted) return;
    const home = trayCardHome(deck ? 0 : index);
    card.homeX = home.x + (deck ? depth * spec.deckStackOffsetX : 0);
    card.homeY = home.y + (deck ? depth * spec.deckStackOffsetY : 0);
    depth += 1;
  });
}

function dealCards(reception) {
  reception.cards = currentRound(reception).cards.map((color) => ({ color, x: 0, y: 0, homeX: 0, homeY: 0, sorted: false }));
  layoutCards(reception);
  for (const card of reception.cards) {
    card.x = card.homeX;
    card.y = card.homeY;
  }
}

// The cards that can be picked up right now: every unsorted one, or only
// the top of the deck.
function movableCards(reception) {
  const unsorted = reception.cards.filter((card) => !card.sorted);
  return currentRound(reception).deck ? unsorted.slice(0, 1) : unsorted;
}

// Sets the round up from scratch -- also how a failed round restarts.
function startRound(reception) {
  const round = currentRound(reception);
  for (const item of round.items) item.collected = false;
  reception.roundTimeLeft = round.timeLimit;
  reception.dragging = null;
  reception.penaltyTimer = 0;
  dealCards(reception);
  say(reception, 'desk', round.task);
  enterPhase(reception, PHASE.ROUND);
}

// The items the player can see and collect right now: the uncollected
// ones in the current batch (round.batchSize at a time, in list order).
// The next batch appears only once every item in this one is collected.
function liveItems(reception) {
  const round = currentRound(reception);
  const firstLeft = round.items.findIndex((item) => !item.collected);
  if (firstLeft === -1) return [];
  const batchStart = Math.floor(firstLeft / round.batchSize) * round.batchSize;
  return round.items.slice(batchStart, batchStart + round.batchSize).filter((item) => !item.collected);
}

// The stretch just before a round, with control still taken: the pop-in
// before Round 1 (READY) and each later round's intro (INTRO). The round's
// hint and its first pickups are already shown then, so there is time to
// take in what to do -- but the clock only starts with the round itself.
function roundPreview(reception) {
  return reception.phase === PHASE.READY || reception.phase === PHASE.INTRO;
}

function roundComplete(reception) {
  const round = currentRound(reception);
  return round.items.every((item) => item.collected) && reception.cards.every((card) => card.sorted);
}

function clearRound(reception, line) {
  reception.dragging = null;
  say(reception, 'desk', line, RECEPTION.roundClearedDuration);
  enterPhase(reception, PHASE.CLEARED);
}

// Picking up, carrying and dropping cards. Runs during ROUND only, so the
// keyboard and the mouse are both live at the same time -- the whole point.
function updateSorting(reception, dt) {
  const spec = RECEPTION.sorting;
  const round = currentRound(reception);
  const pointer = getPointer();

  if (!reception.dragging && pointer.pressed) {
    // Topmost first: in the tray, cards later in the list are drawn on top.
    const candidates = movableCards(reception).reverse();
    for (const card of candidates) {
      if (pointInRect(pointer.pressX, pointer.pressY, { x: card.x, y: card.y, width: spec.cardWidth, height: spec.cardHeight })) {
        reception.dragging = { card, offsetX: pointer.pressX - card.x, offsetY: pointer.pressY - card.y };
        break;
      }
    }
  }

  if (reception.dragging) {
    const { card, offsetX, offsetY } = reception.dragging;
    card.x = pointer.x - offsetX;
    card.y = pointer.y - offsetY;
    if (!pointer.down) {
      // Dropped. Judged by where the pointer is, not the card's corner.
      reception.dragging = null;
      for (const color of spec.binOrder) {
        if (!pointInRect(pointer.x, pointer.y, binRect(color), spec.dropPadding)) continue;
        const right = color === card.color;
        reception.binFlashes[color] = { timer: spec.flashDuration, right };
        if (right) {
          card.sorted = true;
          reception.tooltipDone = true;
          layoutCards(reception);
        } else if (round.wrongDropPenalty) {
          reception.roundTimeLeft -= round.wrongDropPenalty;
          reception.penaltyTimer = spec.penaltyDuration;
        }
        break;
      }
    }
  }

  // Anything not held and not sorted eases back to its place in the tray.
  const ease = 1 - Math.exp(-spec.snapBackSpeed * dt);
  for (const card of reception.cards) {
    if (card.sorted || (reception.dragging && reception.dragging.card === card)) continue;
    card.x += (card.homeX - card.x) * ease;
    card.y += (card.homeY - card.y) * ease;
  }
}

function updateBinFlashes(reception, dt) {
  for (const color of Object.keys(reception.binFlashes)) {
    reception.binFlashes[color].timer -= dt;
    if (reception.binFlashes[color].timer <= 0) delete reception.binFlashes[color];
  }
  if (reception.penaltyTimer > 0) reception.penaltyTimer -= dt;
}

// Opens the arena back up: walls gone, camera released, the player's own
// verbs back. Everything the player built (platforms) stays.
function endEncounter(reception, player) {
  player.invincible = false;
  player.shootingDisabled = false;
  reception.dragging = null;
  reception.sortTray = false;
  reception.cards = [];
  enterPhase(reception, PHASE.DONE);
}

// Starts a round's INTRO: control taken so the new job can be read before
// the clock starts. Used both for moving on and for Round 3's Retry.
function beginIntro(reception, player) {
  const round = currentRound(reception);
  // Fresh before the intro shows them (roundPreview), not only at the start.
  for (const item of round.items) item.collected = false;
  setInputSuppressed(true);
  player.invincible = true;
  player.shootingDisabled = true;
  reception.failCount = 0;
  reception.tooltipDone = false;
  if (round.cards.length > 0) reception.sortTray = true;
  dealCards(reception);
  if (round.newPlatforms && round.newPlatforms[0].shownAt === null) showPlatforms(reception, round.newPlatforms);
  say(reception, 'desk', round.intro ?? round.task, round.introDuration);
  enterPhase(reception, PHASE.INTRO);
}

// Called first in every step, before updatePlayer, so control and shooting
// are already set for this step by the time the player reads input.
export function updateReception(reception, dt, player) {
  if (!reception) return;

  if (reception.phase === PHASE.DONE) {
    reception.clock += dt;
    updateLines(reception, dt);
    if (!reception.retryOffered) return;
    // Retry stays on offer until the player walks on past the desk.
    if (player.x >= reception.deskX + RECEPTION.desk.width) {
      reception.retryOffered = false;
      showRetry(false);
      return;
    }
    if (pendingRetry) {
      pendingRetry = false;
      reception.retryOffered = false;
      showRetry(false);
      beginIntro(reception, player);
    }
    return;
  }

  if (reception.phase === PHASE.IDLE) {
    if (player.x < reception.triggerX) return;
    // Control taken: stop dead, nothing hurts, nothing fires. Shooting
    // stays off for the whole encounter, not only the cutscene parts --
    // during the rounds the fire button is not a verb that exists.
    setInputSuppressed(true);
    player.invincible = true;
    player.shootingDisabled = true;
    say(reception, 'player', RECEPTION.lines.think, RECEPTION.thinkDuration);
    enterPhase(reception, PHASE.THINK);
    return;
  }

  reception.timer += dt;
  reception.clock += dt;
  updateLines(reception, dt);
  updateBinFlashes(reception, dt);

  if (reception.phase === PHASE.THINK) {
    if (reception.timer >= RECEPTION.thinkDuration) {
      say(reception, 'desk', RECEPTION.lines.welcome, RECEPTION.frameDuration);
      enterPhase(reception, PHASE.FRAME);
    }
    return;
  }

  if (reception.phase === PHASE.FRAME) {
    walkIn(reception, player);
    if (reception.timer >= RECEPTION.frameDuration) {
      showPlatforms(reception, reception.basePlatforms);
      say(reception, 'player', RECEPTION.lines.ready, RECEPTION.readyDuration);
      enterPhase(reception, PHASE.READY);
    }
    return;
  }

  if (reception.phase === PHASE.READY) {
    // Normally already there: the walk fits inside frameDuration.
    if (!walkIn(reception, player)) return;
    if (reception.timer < RECEPTION.readyDuration) return;
    if (reception.debugStartRound > 1) {
      reception.roundIndex = Math.min(reception.debugStartRound, reception.rounds.length) - 1;
      beginIntro(reception, player);
      return;
    }
    setInputSuppressed(false);
    startRound(reception);
    return;
  }

  if (reception.phase === PHASE.ROUND) {
    const round = currentRound(reception);
    if (!player.dead) {
      for (const item of liveItems(reception)) {
        if (aabbOverlap(player, item)) item.collected = true;
      }
    }
    updateSorting(reception, dt);
    if (roundComplete(reception)) {
      clearRound(reception, round.cleared);
      return;
    }
    reception.roundTimeLeft -= dt;
    if (reception.roundTimeLeft <= 0) {
      reception.roundTimeLeft = 0;
      reception.dragging = null;
      reception.failCount += 1;
      if (round.failEnds) {
        // Round 3's "good try" lands while the arena is still framed, so
        // the desk it comes from is on screen; it stays up after the
        // arena opens (round3FailedHold + round3FailedLineDuration).
        say(reception, 'desk', RECEPTION.lines.round3Failed, RECEPTION.round3FailedHold + RECEPTION.round3FailedLineDuration);
      } else {
        say(reception, 'desk', RECEPTION.lines.roundFailed, RECEPTION.roundFailedDuration);
      }
      enterPhase(reception, PHASE.FAILED);
    }
    return;
  }

  if (reception.phase === PHASE.FAILED) {
    const round = currentRound(reception);
    if (round.failEnds) {
      // Round 3: the point was to feel the chaos, not to pass. Hold the
      // "time's up" moment, then let the player go -- with a friendly jab
      // and a Retry button for anyone who wants to prove it can be done.
      if (reception.timer < RECEPTION.round3FailedHold) return;
      endEncounter(reception, player);
      reception.retryOffered = true;
      pendingRetry = false;
      showRetry(true);
      return;
    }
    // The player keeps control through this beat; only the clock stops.
    if (reception.timer < RECEPTION.roundFailedDuration) return;
    if (reception.failCount >= RECEPTION.failsBeforeChoice) {
      // Held still while the DOM choice is up.
      setInputSuppressed(true);
      pendingChoice = null;
      showChoice(true);
      enterPhase(reception, PHASE.CHOICE);
      return;
    }
    startRound(reception);
    return;
  }

  if (reception.phase === PHASE.CHOICE) {
    if (!pendingChoice) return;
    const choice = pendingChoice;
    pendingChoice = null;
    showChoice(false);
    setInputSuppressed(false);
    if (choice === 'skip') {
      clearRound(reception, RECEPTION.lines.roundSkipped);
    } else {
      startRound(reception);
    }
    return;
  }

  if (reception.phase === PHASE.CLEARED) {
    if (reception.timer < RECEPTION.roundClearedDuration) return;
    if (!reception.rounds[reception.roundIndex + 1]) {
      endEncounter(reception, player);
      return;
    }
    reception.roundIndex += 1;
    beginIntro(reception, player);
    return;
  }

  if (reception.phase === PHASE.INTRO) {
    if (reception.timer >= currentRound(reception).introDuration) {
      setInputSuppressed(false);
      startRound(reception);
    }
  }
}

// Development shortcut only (game.js applyDebugStart, ?start= past the
// Clinic): the encounter counts as already done, so starting beyond it
// doesn't set it off the moment the player spawns.
export function skipReception(reception) {
  enterPhase(reception, PHASE.DONE);
}

// The walk in from the takeover, during the camera pull-out: at normal
// walking speed until he reaches walkInX, then standing (input is still
// off until READY hands it back). Returns true once he is there.
function walkIn(reception, player) {
  if (player.x < reception.walkInX) {
    player.autoRun = PLAYER.moveSpeed;
    return false;
  }
  player.autoRun = null;
  return true;
}

function encounterRunning(reception) {
  return reception && reception.phase !== PHASE.IDLE && reception.phase !== PHASE.DONE;
}

// The arena's two edges are invisible walls while the encounter runs: the
// left one behind the sign, the right one at the desk's front. Both lift
// at DONE.
export function applyReceptionWalls(reception, player) {
  if (!encounterRunning(reception)) return;
  if (player.x >= reception.arenaLeftX) reception.insideArena = true;
  if (reception.insideArena && player.x < reception.arenaLeftX) player.x = reception.arenaLeftX;
  const maxX = reception.deskX - player.width;
  if (player.x > maxX) player.x = maxX;
}

// Extra one-way platforms, solid from the moment they pop in and for the
// rest of the level (they are the reception's furniture, not a round prop).
export function receptionPlatforms(reception) {
  if (!reception || reception.phase === PHASE.IDLE) return null;
  return reception.platforms.filter((platform) => platform.shownAt !== null && reception.clock >= platform.shownAt);
}

// While the encounter runs (from FRAME onward), the camera holds a framing
// of the whole arena: zoomed out so arenaLeftX..arenaRightX exactly fills
// the screen width, and pitched so the ground sits at groundScreenY.
// null means "no override" -- normal follow camera.
export function receptionCameraFraming(reception) {
  if (!encounterRunning(reception) || reception.phase === PHASE.THINK) return null;
  const width = reception.arenaRightX - reception.arenaLeftX;
  const zoom = CANVAS.width / width;
  const x = (reception.arenaLeftX + reception.arenaRightX) / 2 - CANVAS.width / 2;
  // The render transform puts world y at screen (y - camera.y - H/2) * zoom
  // + H/2. Solving that for the ground landing on groundScreenY:
  const y = WORLD.groundY - (RECEPTION.groundScreenY - CANVAS.height / 2) / zoom - CANVAS.height / 2;
  return { x, y, zoom };
}

// --- Drawing ---------------------------------------------------------------

// Behind the player: sign, desk, platforms, the live items.
export function drawReceptionScenery(ctx, reception) {
  if (!reception) return;
  drawSign(ctx, reception);
  drawDesk(ctx, reception);
  drawPlatforms(ctx, reception);
  if (reception.phase === PHASE.ROUND) {
    for (const item of liveItems(reception)) drawItem(ctx, reception, item);
  } else if (roundPreview(reception)) {
    // Fading in alongside the platforms popping in.
    const fade = Math.min(1, reception.timer / RECEPTION.platformPopDuration);
    for (const item of liveItems(reception)) drawItem(ctx, reception, item, fade);
  }
}

function drawSign(ctx, reception) {
  const spec = RECEPTION.sign;
  const postX = Math.round(reception.signX - spec.postWidth / 2);
  const postTop = WORLD.groundY - spec.postHeight;
  ctx.fillStyle = spec.postColor;
  ctx.fillRect(postX, postTop, spec.postWidth, spec.postHeight);
  const boardX = Math.round(reception.signX - spec.boardSize / 2);
  const boardY = postTop - spec.boardSize;
  ctx.fillStyle = spec.boardColor;
  ctx.fillRect(boardX, boardY, spec.boardSize, spec.boardSize);
  ctx.strokeStyle = '#0d1117';
  ctx.lineWidth = 2;
  ctx.strokeRect(boardX, boardY, spec.boardSize, spec.boardSize);
  // Red cross: two bars, a third of the board thick.
  const bar = spec.boardSize / 3;
  const inset = spec.boardSize / 6;
  ctx.fillStyle = spec.crossColor;
  ctx.fillRect(boardX + bar, boardY + inset, bar, spec.boardSize - inset * 2);
  ctx.fillRect(boardX + inset, boardY + bar, spec.boardSize - inset * 2, bar);
}

function drawDesk(ctx, reception) {
  const spec = RECEPTION.desk;
  const x = Math.round(reception.deskX);
  // The authored counter (config.js RECEPTION.desk.sprite), left end at
  // the wall. The box below is only a fallback if it failed to load.
  const image = getImage(spec.sprite.path);
  if (image) {
    ctx.drawImage(image, x, WORLD.groundY - spec.sprite.height, spec.sprite.width, spec.sprite.height);
    return;
  }
  const y = WORLD.groundY - spec.height;
  ctx.fillStyle = spec.color;
  ctx.fillRect(x, y, spec.width, spec.height);
  ctx.fillStyle = spec.topColor;
  ctx.fillRect(x - 8, y, spec.width + 16, 12);
  ctx.strokeStyle = spec.outlineColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, spec.width, spec.height);
  ctx.strokeRect(x - 8, y, spec.width + 16, 12);
  ctx.fillStyle = spec.labelColor;
  ctx.font = spec.labelFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(spec.label, x + spec.width / 2, y + 12 + (spec.height - 12) / 2);
}

function drawPlatforms(ctx, reception) {
  for (const platform of reception.platforms) {
    if (platform.shownAt === null) continue;
    // Pop in: grows from its own centre, with a small overshoot.
    const age = reception.clock - platform.shownAt;
    if (age <= 0) continue;
    const t = Math.min(1, age / RECEPTION.platformPopDuration);
    const scale = t < 1 ? 1 + 0.25 * Math.sin(t * Math.PI) - 0.25 * (1 - t) : 1;
    const width = platform.width * scale;
    const height = platform.height * scale;
    const x = Math.round(platform.x + platform.width / 2 - width / 2);
    const y = Math.round(platform.y + platform.height / 2 - height / 2);
    const style = RECEPTION.platformStyle;
    ctx.globalAlpha = t;
    ctx.fillStyle = style.shadowColor;
    ctx.fillRect(x + style.shadowOffset, y + style.shadowOffset, width, height);
    ctx.fillStyle = style.color;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = style.topColor;
    ctx.fillRect(x, y, width, style.topHeight);
    ctx.strokeStyle = style.outlineColor;
    ctx.lineWidth = style.outlineWidth;
    ctx.strokeRect(x, y, width, height);
    ctx.globalAlpha = 1;
  }
}

// Placeholder task art, bobbing gently inside a soft glow so it reads as
// "grab me": a sheet of paper (file), an unhappy face (complaint) or a
// globe (non-EU patient).
// alpha: the item's overall opacity (the fade-in before a round starts).
function drawItem(ctx, reception, item, alpha = 1) {
  const spec = RECEPTION.item;
  ctx.globalAlpha = alpha;
  const bob = Math.sin(reception.clock * spec.bobSpeed) * spec.bobAmplitude;
  const x = Math.round(item.x);
  const y = Math.round(item.y + bob);
  const pad = spec.glowPadding;
  ctx.fillStyle = spec.backingColor;
  ctx.fillRect(x - pad, y - pad, item.width + pad * 2, item.height + pad * 2);
  const pulse = (1 + Math.sin(reception.clock * spec.borderPulseSpeed)) / 2;
  ctx.globalAlpha = alpha * (spec.borderMinAlpha + (1 - spec.borderMinAlpha) * pulse);
  ctx.strokeStyle = spec.borderColor;
  ctx.lineWidth = spec.borderWidth;
  ctx.strokeRect(x - pad, y - pad, item.width + pad * 2, item.height + pad * 2);
  ctx.globalAlpha = alpha;

  if (item.kind === 'file') {
    // The sheet, sticking up out of the folder, with its lines of text.
    const tab = spec.folderTabHeight;
    ctx.fillStyle = spec.paperColor;
    ctx.fillRect(x + 4, y, item.width - 8, item.height - tab);
    ctx.fillStyle = spec.lineColor;
    for (let i = 0; i < 2; i++) ctx.fillRect(x + 8, y + 5 + i * 5, item.width - 16, 2);
    // The folder: a tab on its top-left, then the front cover.
    const coverY = y + item.height * 0.4;
    ctx.fillStyle = spec.folderColor;
    ctx.fillRect(x, coverY - tab, item.width * 0.45, tab);
    ctx.fillRect(x, coverY, item.width, y + item.height - coverY);
    ctx.strokeStyle = spec.outlineColor;
    ctx.lineWidth = spec.outlineWidth;
    ctx.strokeRect(x + 4, y, item.width - 8, coverY - y);
    ctx.strokeRect(x, coverY, item.width, y + item.height - coverY);
    ctx.globalAlpha = 1;
    return;
  }

  const cx = x + item.width / 2;
  const cy = y + item.height / 2;
  const r = item.width / 2 + 2;
  ctx.fillStyle = item.kind === 'complaint' ? spec.complaintColor : spec.globeColor;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = spec.outlineColor;
  ctx.lineWidth = spec.outlineWidth;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = spec.badgeDetailColor;
  ctx.fillStyle = spec.badgeDetailColor;
  if (item.kind === 'complaint') {
    // Two eyes and a frown.
    ctx.fillRect(cx - 7, cy - 6, 4, 4);
    ctx.fillRect(cx + 3, cy - 6, 4, 4);
    ctx.beginPath();
    ctx.arc(cx, cy + 10, 7, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else {
    // A meridian and two parallels.
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.45, r, 0, 0, Math.PI * 2);
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx - r * 0.85, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.85, cy - r * 0.5);
    ctx.moveTo(cx - r * 0.85, cy + r * 0.5);
    ctx.lineTo(cx + r * 0.85, cy + r * 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// After the player: speech bubbles, so they are never hidden behind him.
// Drawn in world space but sized against the camera zoom, so their text is
// the same on-screen size whether the camera is framed out or not.
export function drawReceptionSpeech(ctx, reception, player, zoom, view) {
  if (!reception) return;
  const spec = RECEPTION.bubble;
  if (reception.playerLine && !player.dead) {
    // The sprite's visible head sits about 42px above the hitbox top.
    drawBubble(ctx, view, reception.playerLine.text, player.x + player.width / 2, player.y - 42 - spec.gapAboveSpeaker / zoom, zoom);
  }
  if (reception.deskLine) {
    const deskTop = WORLD.groundY - RECEPTION.desk.height;
    drawBubble(ctx, view, reception.deskLine.text, reception.deskX + RECEPTION.desk.width / 2, deskTop - spec.gapAboveSpeaker / zoom, zoom);
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Tail tip at (tipX, tipY); the bubble sits above it, slid sideways as far
// as needed to stay inside what is actually on screen right now (view:
// game.js visibleWorldRect) -- the desk stands near the right edge, and
// while the camera is still pulling out the arena's edge isn't in view
// yet. Long lines wrap onto more lines (bubble.maxWidth) rather than
// growing wider. The tail stays on the speaker either way.
function drawBubble(ctx, view, text, tipX, tipY, zoom) {
  const spec = RECEPTION.bubble;
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.scale(1 / zoom, 1 / zoom); // from here on, units are screen pixels
  ctx.font = spec.font;
  const lines = wrapText(ctx, text, spec.maxWidth);
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const width = textWidth + spec.paddingX * 2;
  const height = lines.length * spec.lineHeight + spec.paddingY * 2;
  const margin = spec.paddingX;
  const minLeft = (view.left - tipX) * zoom + margin;
  const maxLeft = (view.left + view.width - tipX) * zoom - margin - width;
  const left = Math.max(minLeft, Math.min(maxLeft, -width / 2));
  const top = -spec.tail - height;

  // The tail only makes sense while the speaker is under the body -- during
  // the camera pull-out the desk can still be off screen, and then the
  // bubble just waits at the edge without pointing anywhere.
  const tailFits = left + spec.radius + spec.tail <= 0 && 0 <= left + width - spec.radius - spec.tail;
  ctx.beginPath();
  ctx.roundRect(left, top, width, height, spec.radius);
  if (tailFits) {
    ctx.moveTo(-spec.tail, top + height);
    ctx.lineTo(0, 0);
    ctx.lineTo(spec.tail, top + height);
  }
  ctx.fillStyle = spec.fill;
  ctx.fill();
  ctx.strokeStyle = spec.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Cover the border line where the tail joins the body.
  if (tailFits) ctx.fillRect(-spec.tail + 2, top + height - 3, spec.tail * 2 - 4, 4);

  ctx.fillStyle = spec.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, left + width / 2, top + spec.paddingY + i * spec.lineHeight + 2));
  ctx.restore();
}

// --- Screen-space HUD ------------------------------------------------------

// Top centre: what to do, in plain words, for the whole round. Top right
// (the bottom right belongs to the persistent Skip/Mute controls): the
// round clock, and how much of each job is done. Bottom: the sorting tray
// and boxes, once a round has introduced them.
export function drawReceptionHud(ctx, reception) {
  if (!reception) return;
  if (reception.sortTray) drawSorting(ctx, reception);
  const inRound = reception.phase === PHASE.ROUND || reception.phase === PHASE.FAILED || reception.phase === PHASE.CHOICE;
  const preview = roundPreview(reception);
  if (!inRound && !preview) return;
  const round = currentRound(reception);
  const spec = RECEPTION.hud;
  drawHint(ctx, round.hint);

  // Before the round starts the clock shows its full time, standing still.
  const timeLeft = preview ? round.timeLimit : reception.roundTimeLeft;
  const seconds = Math.ceil(timeLeft);
  const right = CANVAS.width - spec.marginX;
  const baseline = spec.marginY + 26; // baseline of the clock line

  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = spec.shadowColor;
  ctx.shadowBlur = 6;

  ctx.font = spec.font;
  ctx.fillStyle = timeLeft <= spec.warnBelow ? spec.warnColor : spec.color;
  const clockText = `${seconds} s`;
  ctx.fillText(clockText, right, baseline);
  drawHourglass(ctx, right - ctx.measureText(clockText).width - 26, baseline - 24, ctx.fillStyle);

  // A wrong drop's time penalty floats up off the clock and fades.
  if (reception.penaltyTimer > 0 && round.wrongDropPenalty) {
    const sorting = RECEPTION.sorting;
    const life = reception.penaltyTimer / sorting.penaltyDuration; // 1 -> 0
    ctx.globalAlpha = life;
    ctx.font = sorting.penaltyFont;
    ctx.fillStyle = sorting.penaltyColor;
    ctx.fillText(`-${round.wrongDropPenalty} s`, right - 90, baseline - 10 * (1 - life));
    ctx.globalAlpha = 1;
  }

  ctx.font = spec.smallFont;
  ctx.fillStyle = spec.color;
  const collected = round.items.filter((item) => item.collected).length;
  ctx.fillText(`${round.itemLabel} ${collected}/${round.items.length}`, right, baseline + 26);
  if (reception.cards.length > 0) {
    const sorted = reception.cards.filter((card) => card.sorted).length;
    ctx.fillText(`Cards ${sorted}/${reception.cards.length}`, right, baseline + 48);
  }
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function drawHint(ctx, text) {
  const spec = RECEPTION.hud;
  ctx.font = spec.hintFont;
  const textWidth = ctx.measureText(text).width;
  const width = textWidth + spec.hintPaddingX * 2;
  const height = spec.hintLineHeight + spec.hintPaddingY * 2;
  const left = Math.round(CANVAS.width / 2 - width / 2);
  ctx.beginPath();
  ctx.roundRect(left, spec.hintTop, width, height, 10);
  ctx.fillStyle = spec.hintFill;
  ctx.fill();
  ctx.strokeStyle = spec.hintBorder;
  ctx.lineWidth = spec.hintBorderWidth;
  ctx.stroke();
  ctx.fillStyle = spec.hintColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, CANVAS.width / 2, spec.hintTop + height / 2 + 1);
}

function drawHourglass(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 16, y);
  ctx.lineTo(x + 8, y + 12);
  ctx.lineTo(x + 16, y + 24);
  ctx.lineTo(x, y + 24);
  ctx.lineTo(x + 8, y + 12);
  ctx.closePath();
  ctx.fill();
}

function drawSorting(ctx, reception) {
  const spec = RECEPTION.sorting;
  const pad = spec.panelPadding;

  // Tray panel, sized to however many cards this round deals -- or, for a
  // deck, to one card plus the height of the full pile.
  const deck = currentRound(reception).deck;
  const trayCount = Math.max(1, reception.cards.length);
  const pileX = deck ? (trayCount - 1) * spec.deckStackOffsetX : 0;
  const pileY = deck ? (trayCount - 1) * spec.deckStackOffsetY : 0;
  const trayWidth = deck ? spec.cardWidth + pileX : trayCount * spec.cardWidth + (trayCount - 1) * spec.cardGap;
  ctx.fillStyle = spec.panelColor;
  ctx.beginPath();
  ctx.roundRect(spec.trayX - pad, spec.trayY - pad, trayWidth + pad * 2, spec.cardHeight + pileY + pad * 2, 8);
  ctx.fill();

  // Boxes, each with its colour, its symbol, and any flash.
  for (const color of spec.binOrder) {
    const rect = binRect(color);
    const colorSpec = spec.colors[color];
    ctx.fillStyle = spec.panelColor;
    ctx.beginPath();
    ctx.roundRect(rect.x - pad / 2, rect.y - pad / 2, rect.width + pad, rect.height + pad, 8);
    ctx.fill();
    ctx.fillStyle = colorSpec.fill;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colorSpec.fill;
    ctx.lineWidth = 4;
    ctx.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
    drawSymbol(ctx, colorSpec.symbol, rect.x + rect.width / 2, rect.y + rect.height / 2, 14, colorSpec.fill);
    const flash = reception.binFlashes[color];
    if (flash) {
      ctx.globalAlpha = flash.timer / spec.flashDuration;
      ctx.fillStyle = flash.right ? spec.rightFlashColor : spec.wrongFlashColor;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.globalAlpha = 1;
    }
  }

  // Cards: resting ones first, the held one last so it is on top. A deck
  // is listed top card first, so it is drawn back to front.
  const held = reception.dragging ? reception.dragging.card : null;
  const resting = reception.cards.filter((card) => !card.sorted && card !== held);
  for (const card of deck ? resting.reverse() : resting) drawCard(ctx, card);
  if (held) drawCard(ctx, held, true);
  if (deck && resting.length + (held ? 1 : 0) > 0) {
    // How many are left in the pile, beside it.
    const left = resting.length + (held ? 1 : 0);
    ctx.font = RECEPTION.hud.smallFont;
    ctx.fillStyle = RECEPTION.hud.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`× ${left}`, spec.trayX + trayWidth + pad + 8, spec.trayY + spec.cardHeight / 2);
  }

  // The round's tooltip, until its first correct sort.
  const showing = reception.phase === PHASE.INTRO || reception.phase === PHASE.ROUND;
  const tooltip = currentRound(reception).sortTooltip;
  if (showing && tooltip && !reception.tooltipDone) drawSortTooltip(ctx, reception, tooltip, trayWidth);
}

function drawCard(ctx, card, lifted = false) {
  const spec = RECEPTION.sorting;
  const colorSpec = spec.colors[card.color];
  const x = Math.round(card.x);
  const y = Math.round(card.y);
  if (lifted) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(x + 5, y + 6, spec.cardWidth, spec.cardHeight);
  }
  ctx.fillStyle = colorSpec.fill;
  ctx.beginPath();
  ctx.roundRect(x, y, spec.cardWidth, spec.cardHeight, 5);
  ctx.fill();
  ctx.strokeStyle = spec.outlineColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawSymbol(ctx, colorSpec.symbol, x + spec.cardWidth / 2, y + spec.cardHeight / 2, 10, spec.symbolColor);
}

function drawSymbol(ctx, symbol, cx, cy, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (symbol === 'circle') {
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
  } else if (symbol === 'triangle') {
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy + size * 0.8);
    ctx.lineTo(cx - size, cy + size * 0.8);
    ctx.closePath();
  } else {
    ctx.rect(cx - size * 0.85, cy - size * 0.85, size * 1.7, size * 1.7);
  }
  ctx.fill();
}

function drawSortTooltip(ctx, reception, text, trayWidth) {
  const spec = RECEPTION.sorting;
  const bob = Math.sin(reception.clock * spec.tooltipBobSpeed) * spec.tooltipBobAmplitude;
  ctx.font = spec.tooltipFont;
  const width = ctx.measureText(text).width + 24;
  const height = 32;
  const centerX = spec.trayX + trayWidth / 2;
  const bottom = spec.trayY - spec.panelPadding - 12 + bob;
  const left = Math.max(8, centerX - width / 2);
  ctx.fillStyle = spec.tooltipFill;
  ctx.beginPath();
  ctx.roundRect(left, bottom - height, width, height, 8);
  ctx.moveTo(centerX - 9, bottom);
  ctx.lineTo(centerX, bottom + 9);
  ctx.lineTo(centerX + 9, bottom);
  ctx.fill();
  ctx.strokeStyle = spec.outlineColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = spec.tooltipTextColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + width / 2, bottom - height / 2 + 1);
}
