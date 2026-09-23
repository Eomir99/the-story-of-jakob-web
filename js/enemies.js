// enemies.js — the enemy roster (AGENTS.md §3). Three behaviours total:
//
//   mathbook stationary, killable, fires a slow telegraphed projectile on
//            a repeating cycle. The game's first enemy and its shooting
//            tutorial -- one behaviour, placed three times in Lund
//            (level.js), each placement teaching something different
//            (task 3.6).
//   inbox    stationary, cannot be shot down -- the "admin summer job
//            never ends" is represented literally: go around it, not
//            through it.
//   helmet   the American football helmet (USA, exchange semester): idles
//            facing the player, telegraphs, charges in a straight line
//            until it hits a bound, then recovers dazed -- the only time
//            it can be hurt. Teaches "dodge, then punish".

import { ENEMY_MATHBOOK, ENEMY_INBOX, ENEMY_HELMET, TELEGRAPH, DAMAGE_FLASH, HAZARD, ACTIVATION } from './config.js';
import { getImage } from './assets.js';

// AGENTS.md §4: every attack's wind-up must be 0.8-1.0s -- the rule applies
// to enemies, not only bosses. Same guard bosses.js runs over its own
// patterns, checked once at load time so this can't silently ship outside
// the range.
for (const [name, duration] of [
  ['mathbook', ENEMY_MATHBOOK.telegraphDuration],
  ['helmet', ENEMY_HELMET.telegraphDuration],
]) {
  if (duration < TELEGRAPH.minDuration || duration > TELEGRAPH.maxDuration) {
    throw new Error(
      `enemies.js: "${name}" has telegraphDuration ${duration}s, outside the required ${TELEGRAPH.minDuration}-${TELEGRAPH.maxDuration}s range (AGENTS.md §4).`
    );
  }
}

// `overrides` (task 1): level data may override hp and idleDuration per
// instance -- used to keep the first, tutorial placement at its old,
// gentler values while the other two pick up the new default tuning.
export function createMathbookEnemy(x, y, overrides = {}) {
  return {
    type: 'mathbook',
    x,
    y,
    width: ENEMY_MATHBOOK.width,
    height: ENEMY_MATHBOOK.height,
    hp: overrides.hp ?? ENEMY_MATHBOOK.hp,
    idleDuration: overrides.idleDuration ?? ENEMY_MATHBOOK.idleDuration,
    alive: true,
    hitFlash: 0,
    // Dormant until the player is within ACTIVATION.enemyLeadDistance
    // (config.js) -- see the note there. Nothing below runs until then
    // (updateEnemy); activateEnemy starts the first wind-up the instant it
    // does.
    active: false,
    activationX: x - ACTIVATION.enemyLeadDistance,
    // Repeating fire cycle: idle countdown, then a visible wind-up
    // (telegraph), then one shot, then back to idle. `telegraph` is null
    // between wind-ups and { timer, duration } while one is running.
    cycleTimer: ENEMY_MATHBOOK.firstShotDelay,
    telegraph: null,
  };
}

export function createInboxEnemy(x, y) {
  return {
    type: 'inbox',
    x,
    y,
    width: ENEMY_INBOX.width,
    height: ENEMY_INBOX.height,
    alive: true, // never dies; damageEnemy is a no-op for this type
    hitFlash: 0, // read by the shared update/draw path; stays 0 forever here
  };
}

export function createFootballHelmetEnemy(x, y) {
  return {
    type: 'helmet',
    x,
    y,
    width: ENEMY_HELMET.width,
    height: ENEMY_HELMET.height,
    hp: ENEMY_HELMET.hp,
    alive: true,
    hitFlash: 0,
    // Dormant until activation, same as the maths book above.
    active: false,
    activationX: x - ACTIVATION.enemyLeadDistance,
    facing: 1, // 1 = right, -1 = left; re-faces the player every idle frame
    // 'idle' | 'telegraph' | 'charging' | 'recovering'.
    state: 'idle',
    stateTimer: 0,
    vx: 0,
    // The room it may charge within, centred on its spawn -- the level-data
    // equivalent of "the edge of its platform" (AGENTS.md §5: placements,
    // including how much room an enemy has, belong in level data, not code).
    minX: x - ENEMY_HELMET.chargeRange / 2,
    maxX: x + ENEMY_HELMET.chargeRange / 2,
  };
}

// Returns any projectiles fired this step, so game.js can own the shared
// projectile list the same way it already does for boss attacks
// (bosses.js's updateResearchGolem/updateGraduationBoss). `player` is only
// read by the helmet, which needs to know where the player is to face them
// while idle and to lock in a charge direction.
export function updateEnemy(enemy, dt, player) {
  if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
  if (!enemy.alive) return [];
  // task 1: dormant until activated (game.js's activateEnemyIfReached).
  // The inbox has no `active` field and is exempt -- it never attacks, so
  // there is no cycle for it to wake up into.
  if (enemy.active === false) return [];

  if (enemy.type === 'mathbook') return updateMathbookEnemy(enemy, dt);
  if (enemy.type === 'helmet') return updateHelmetEnemy(enemy, dt, player);
  return [];
}

// Called once by game.js the instant the player crosses activationX. Skips
// straight to the wind-up instead of a full idle/cooldown, so the first
// attack lands roughly one telegraph duration after activation -- see
// config.js ACTIVATION.
export function activateEnemy(enemy) {
  enemy.active = true;
  if (enemy.type === 'mathbook') {
    enemy.telegraph = { timer: ENEMY_MATHBOOK.telegraphDuration, duration: ENEMY_MATHBOOK.telegraphDuration };
  } else if (enemy.type === 'helmet') {
    // Still passes through one idle tick so facing and the point-blank
    // check run normally -- stateTimer is preset to already satisfy
    // idleMinDuration, so that tick falls straight through to telegraph.
    enemy.state = 'idle';
    enemy.stateTimer = ENEMY_HELMET.idleMinDuration;
  }
}

function updateMathbookEnemy(enemy, dt) {
  if (enemy.telegraph) {
    enemy.telegraph.timer -= dt;
    if (enemy.telegraph.timer <= 0) {
      enemy.telegraph = null;
      enemy.cycleTimer = enemy.idleDuration;
      return [fireMathbookProjectile(enemy)];
    }
    return [];
  }

  enemy.cycleTimer -= dt;
  if (enemy.cycleTimer <= 0) {
    enemy.telegraph = { timer: ENEMY_MATHBOOK.telegraphDuration, duration: ENEMY_MATHBOOK.telegraphDuration };
  }
  return [];
}

// Straight ahead, horizontal, always leftward -- see the roster comment
// above for why "ahead" has a fixed direction here.
function fireMathbookProjectile(enemy) {
  return {
    x: enemy.x - ENEMY_MATHBOOK.projectileWidth,
    y: enemy.y + enemy.height / 2 - ENEMY_MATHBOOK.projectileHeight / 2,
    width: ENEMY_MATHBOOK.projectileWidth,
    height: ENEMY_MATHBOOK.projectileHeight,
    vx: -ENEMY_MATHBOOK.projectileSpeed,
    vy: 0,
    life: ENEMY_MATHBOOK.projectileLifetime,
    owner: 'enemy',
    contactDamage: ENEMY_MATHBOOK.contactDamage,
    color: ENEMY_MATHBOOK.projectileColor,
  };
}

// The charge cycle (the enemy-behaviours brief): idle facing the player,
// telegraph, a straight-line charge that stops dead at its room's edge,
// then a dazed recovery -- the only window it can be hurt in. No steering
// and no pathfinding: once a charge starts, facing is locked and it moves
// in that direction until it hits a bound or the max duration runs out.
function updateHelmetEnemy(enemy, dt, player) {
  if (enemy.state === 'idle') {
    const enemyCenterX = enemy.x + enemy.width / 2;
    const playerCenterX = player.x + player.width / 2;
    enemy.facing = playerCenterX >= enemyCenterX ? 1 : -1;

    enemy.stateTimer += dt;
    if (enemy.stateTimer < ENEMY_HELMET.idleMinDuration) return [];
    // AGENTS.md brief: never wind up while the player is directly overhead
    // at point-blank range -- the tell would be unreadable. Just keep
    // idling (re-facing) until that's no longer true.
    if (isPlayerPointBlank(enemy, player)) return [];

    enemy.state = 'telegraph';
    enemy.stateTimer = ENEMY_HELMET.telegraphDuration;
    return [];
  }

  if (enemy.state === 'telegraph') {
    enemy.stateTimer -= dt;
    if (enemy.stateTimer <= 0) {
      enemy.state = 'charging';
      enemy.stateTimer = ENEMY_HELMET.chargeMaxDuration;
      enemy.vx = ENEMY_HELMET.chargeSpeed * enemy.facing;
    }
    return [];
  }

  if (enemy.state === 'charging') {
    enemy.stateTimer -= dt;
    enemy.x += enemy.vx * dt;

    let hitBound = false;
    if (enemy.x <= enemy.minX) {
      enemy.x = enemy.minX;
      hitBound = true;
    } else if (enemy.x >= enemy.maxX) {
      enemy.x = enemy.maxX;
      hitBound = true;
    }

    if (hitBound || enemy.stateTimer <= 0) {
      enemy.vx = 0;
      enemy.state = 'recovering';
      enemy.stateTimer = ENEMY_HELMET.recoveryDuration;
    }
    return [];
  }

  // recovering: cannot act, deals no contact damage (contactDamageFor),
  // and is the only state damageEnemy accepts a hit in.
  enemy.stateTimer -= dt;
  if (enemy.stateTimer <= 0) {
    enemy.state = 'idle';
    enemy.stateTimer = 0;
  }
  return [];
}

function isPlayerPointBlank(enemy, player) {
  const dx = Math.abs(player.x + player.width / 2 - (enemy.x + enemy.width / 2));
  if (dx > ENEMY_HELMET.noChargeHorizontalRange) return false;
  const playerBottom = player.y + player.height;
  return enemy.y - playerBottom < ENEMY_HELMET.noChargeVerticalRange;
}

// Returns true when this call is the hit that killed the enemy, so game.js
// can trigger a kill bark (task 3.9) exactly once per death.
export function damageEnemy(enemy, amount) {
  if (!enemy.alive || enemy.type === 'inbox') return false;
  // task 1: same guarantee as the bosses' damage functions -- a shot fired
  // from beyond activationX, before the enemy has woken up, must not be
  // able to chip it for free. Both affected types have a long enough
  // projectile range (PROJECTILE.lifetime * .speed) to otherwise reach an
  // enemy that hasn't activated yet.
  if (enemy.active === false) return false;
  // The helmet is invulnerable outside recovery -- charging (and idling,
  // and telegraphing) cannot be interrupted by damage.
  if (enemy.type === 'helmet' && enemy.state !== 'recovering') return false;
  const config = enemy.type === 'helmet' ? ENEMY_HELMET : ENEMY_MATHBOOK;
  enemy.hp -= amount;
  enemy.hitFlash = config.hitFlashDuration;
  if (enemy.hp <= 0) {
    enemy.alive = false;
    return true;
  }
  return false;
}

export function contactDamageFor(enemy) {
  if (enemy.type === 'inbox') return ENEMY_INBOX.contactDamage;
  // Dazed and harmless while recovering -- "does not damage the player
  // during it" (the enemy-behaviours brief).
  if (enemy.type === 'helmet') return enemy.state === 'recovering' ? 0 : ENEMY_HELMET.contactDamage;
  return ENEMY_MATHBOOK.contactDamage;
}

const COLOR = {
  mathbook: ENEMY_MATHBOOK.color,
  inbox: ENEMY_INBOX.color,
  helmet: ENEMY_HELMET.color,
};

// Only the two killable types ever flash; the inbox cannot be damaged.
const HIT_FLASH_DURATION = {
  mathbook: ENEMY_MATHBOOK.hitFlashDuration,
  helmet: ENEMY_HELMET.hitFlashDuration,
};

// The maths book and the football helmet draw their authored artwork
// (art-source/enemies/*, config.js ENEMY_MATHBOOK.sprite /
// ENEMY_HELMET.sprite). The Endless Inbox has no art yet and keeps the
// grey-box body below, so this stays two sprites fitted to the entities
// the fight already runs on -- not a general enemy renderer.
const SPRITE = {
  mathbook: ENEMY_MATHBOOK.sprite,
  helmet: ENEMY_HELMET.sprite,
};

export function drawEnemy(ctx, enemy) {
  if (!enemy.alive) return;

  const spec = SPRITE[enemy.type];
  const image = spec ? getImage(spritePathFor(enemy, spec)) : undefined;
  // Only if the real asset genuinely failed to load -- a normal
  // successful load always draws the artwork (same resilience rule as
  // the player's and the Research Golem's sprite fallbacks).
  if (!image) {
    drawEnemyBox(ctx, enemy);
    return;
  }

  // Anchored to the gameplay entity, not the other way round: centred on
  // the footprint, read from enemy.x/y/width/height every frame, so the
  // art cannot drift on a hit, a wind-up or a charge.
  const x = Math.round(enemy.x + enemy.width / 2 - spec.displayWidth / 2 + spec.offsetX);
  const y = Math.round(enemy.y + enemy.height / 2 - spec.displayHeight / 2 + spec.offsetY);

  // The helmet's art faces left; flip it when it is facing right so it
  // keeps looking at the player and its charge direction stays readable.
  const flip = enemy.type === 'helmet' && enemy.facing === 1;
  ctx.save();
  if (flip) {
    ctx.translate(x + spec.displayWidth, y);
    ctx.scale(-1, 1);
    ctx.drawImage(image, 0, 0, spec.displayWidth, spec.displayHeight);
  } else {
    ctx.drawImage(image, x, y, spec.displayWidth, spec.displayHeight);
  }

  // The same tells as before, in the same order -- state wash first, then
  // the damage flash over the top of it, so a hit landing mid-wind-up
  // cannot wipe out the tell the player is reading. They just wash the
  // sprite's own pixels now instead of a rectangle.
  const drawX = flip ? 0 : x;
  const drawY = flip ? 0 : y;
  const state = stateTint(enemy, spec);
  if (state) drawSpriteTint(ctx, image, drawX, drawY, spec, state.color, state.alpha);
  if (enemy.hitFlash > 0) {
    const strength = Math.min(1, enemy.hitFlash / HIT_FLASH_DURATION[enemy.type]);
    drawSpriteTint(ctx, image, drawX, drawY, spec, DAMAGE_FLASH.enemyColor, strength * spec.hitFlashTintAlpha);
  }
  ctx.restore();
}

// Which of the two delivered states this enemy is in. Both types swap on
// their wind-up, which is why the sprite pair shares one canvas origin.
function spritePathFor(enemy, spec) {
  if (enemy.type === 'mathbook') return enemy.telegraph ? spec.telegraphPath : spec.idlePath;
  return enemy.state === 'telegraph' ? spec.telegraphPath : spec.idlePath;
}

function stateTint(enemy, spec) {
  if (enemy.type === 'mathbook' && enemy.telegraph) {
    const progress = 1 - enemy.telegraph.timer / enemy.telegraph.duration;
    return { color: ENEMY_MATHBOOK.telegraphColor, alpha: progress * spec.telegraphTintAlpha };
  }
  if (enemy.type === 'helmet' && enemy.state === 'telegraph') {
    const progress = 1 - enemy.stateTimer / ENEMY_HELMET.telegraphDuration;
    return { color: ENEMY_HELMET.telegraphColor, alpha: progress * spec.telegraphTintAlpha };
  }
  if (enemy.type === 'helmet' && enemy.state === 'recovering') {
    // Dazed and vulnerable -- visibly different from every other state so
    // "hit it now" reads at a glance, not just "it stopped moving".
    return { color: ENEMY_HELMET.recoveryColor, alpha: spec.recoveryTintAlpha };
  }
  return null;
}

// Washes a flat colour over the sprite's own opaque pixels, at the same
// place and size the sprite was just drawn, so a tell can never nudge the
// artwork. Same technique and the same per-colour cache as bosses.js --
// the colours are all config.js constants and this runs every frame of
// every wind-up.
const silhouetteCache = new Map(); // `${path}|${color}` -> offscreen canvas

function drawSpriteTint(ctx, image, x, y, spec, color, alpha) {
  if (alpha <= 0) return;
  const key = `${image.src}|${color}`;
  let silhouette = silhouetteCache.get(key);
  if (!silhouette) {
    silhouette = document.createElement('canvas');
    silhouette.width = image.width;
    silhouette.height = image.height;
    const tintCtx = silhouette.getContext('2d');
    tintCtx.drawImage(image, 0, 0);
    tintCtx.globalCompositeOperation = 'source-in';
    tintCtx.fillStyle = color;
    tintCtx.fillRect(0, 0, silhouette.width, silhouette.height);
    silhouetteCache.set(key, silhouette);
  }
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(silhouette, x, y, spec.displayWidth, spec.displayHeight);
  ctx.restore();
}

// The grey-box body: the Endless Inbox's normal look, and the fallback
// for the other two if their art fails to load.
function drawEnemyBox(ctx, enemy) {
  let color = stateColor(enemy);
  if (enemy.hitFlash > 0) {
    const strength = Math.min(1, enemy.hitFlash / HIT_FLASH_DURATION[enemy.type]);
    color = lerpColor(color, DAMAGE_FLASH.enemyColor, strength);
  }
  const x = Math.round(enemy.x);
  const y = Math.round(enemy.y);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, enemy.width, enemy.height);
  // Every enemy in the game deals contact damage, so every enemy carries
  // the hazard rim (config.js HAZARD). It is what keeps the Endless Inbox
  // from reading as scenery.
  ctx.strokeStyle = HAZARD.outlineColor;
  ctx.lineWidth = HAZARD.bodyOutlineWidth;
  ctx.strokeRect(x, y, enemy.width, enemy.height);
}

function stateColor(enemy) {
  if (enemy.type === 'mathbook' && enemy.telegraph) {
    // Visible tell: the book opens/glows toward telegraphColor as the
    // wind-up nears completion, so the shot is never a surprise
    // (AGENTS.md §4 applies to enemies, not only bosses).
    const progress = 1 - enemy.telegraph.timer / enemy.telegraph.duration;
    return lerpColor(COLOR.mathbook, ENEMY_MATHBOOK.telegraphColor, progress);
  }
  if (enemy.type === 'helmet' && enemy.state === 'telegraph') {
    const progress = 1 - enemy.stateTimer / ENEMY_HELMET.telegraphDuration;
    return lerpColor(COLOR.helmet, ENEMY_HELMET.telegraphColor, progress);
  }
  if (enemy.type === 'helmet' && enemy.state === 'recovering') {
    // Dazed and vulnerable -- visibly different from every other state so
    // "hit it now" reads at a glance, not just "it stopped moving".
    return ENEMY_HELMET.recoveryColor;
  }
  return COLOR[enemy.type];
}

function lerpColor(fromHex, toHex, t) {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
