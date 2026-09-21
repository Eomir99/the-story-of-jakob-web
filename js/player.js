// player.js — movement, gravity, jump, ground collision, shooting,
// damage/death/respawn.

import { PLAYER, PROJECTILE, WORLD, PICKUP, BARK, DAMAGE_FLASH } from './config.js';
import { getImage } from './assets.js';
import { isActionDown, wasActionPressed } from './input.js';

const PLAYER_SPRITES = {
  none: 'assets/player/base.png',
  studentmossa: 'assets/player/studentmossa.png',
  suit: 'assets/player/suit.png',
  armour: 'assets/player/armour.png',
};

const PLAYER_ANIMATION_SHEETS = {
  none: 'assets/player/base-animation.png',
  studentmossa: 'assets/player/studentmossa-animation.png',
  suit: 'assets/player/suit-animation.png',
};

// Every prepared variant keeps the same 128px canvas and foot pivot. These
// are authored asset coordinates, not gameplay tuning: anchoring this point
// to the existing hitbox's bottom-centre keeps every outfit planted without
// changing the collision box or world position.
const SPRITE_FOOT_X = 66;
const SPRITE_FOOT_Y = 120;
const SPRITE_VISIBLE_TOP_Y = 14;
const SPRITE_FRAME_SIZE = 128;
const SPRITE_SHEET_COLUMNS = 5;

export function createPlayer(x, y) {
  return {
    x,
    y,
    width: PLAYER.width,
    height: PLAYER.height,
    vx: 0,
    vy: 0,
    facing: 1, // 1 = right, -1 = left
    onGround: false,
    // Coyote time (PLAYER.coyoteTime): counts down from the moment the
    // player stops being on the ground. A jump is allowed while it is
    // still running, so stepping off a ledge and pressing jump a frame or
    // two late still jumps.
    coyoteTimer: 0,
    // Jump buffering (PLAYER.jumpBufferTime): a jump pressed while still
    // in the air is held here and spent on landing.
    jumpBufferTimer: 0,
    // Landing squash (PLAYER.landSquash): counts down after a hard
    // landing and drives the draw-time scale. Visual only.
    landSquashTimer: 0,
    // Damage flash (DAMAGE_FLASH.playerDuration): a short, opaque colour
    // pop the instant damage lands, separate from the longer
    // invulnerability blink that follows it.
    hitFlashTimer: 0,
    fireCooldown: 0,
    animationTime: 0,
    hp: PLAYER.maxHp,
    invulnerableFor: 0,
    dead: false,
    respawnTimer: 0,
    // Current outfit: 'none' | 'studentmossa' | 'suit' | 'armour'. A single
    // value, not a stacking inventory -- the suit replaces the
    // studentmössa (AGENTS.md §3/§6). Never reset on respawn: pickups are
    // permanent progress.
    outfit: 'none',
    // The utspring sequence (PLAN.md task 3.5) sets these for its four to
    // six seconds and clears them again. autoRun is a horizontal speed in
    // px/s that overrides whatever input says; invincible means damage is
    // ignored outright, so the player cannot be hurt and cannot die while
    // the game is playing itself.
    autoRun: null,
    invincible: false,
    barks: [], // active kill barks (task 3.9): { text, timer }
    barkCounts: {}, // per-enemy-type kill count, so lines cycle instead of repeating
  };
}

// Called by game.js the instant a kill lands. Never pauses the game
// (AGENTS.md §4) -- it only queues text to float above the player.
export function spawnBark(player, enemyType) {
  const lines = BARK.lines[enemyType];
  if (!lines || lines.length === 0) return;
  const count = player.barkCounts[enemyType] || 0;
  player.barkCounts[enemyType] = count + 1;
  player.barks.push({ text: lines[count % lines.length], timer: BARK.displayDuration });
}

function updateBarks(player, dt) {
  for (const bark of player.barks) bark.timer -= dt;
  player.barks = player.barks.filter((bark) => bark.timer > 0);
}

// Called by game.js when the player overlaps a pickup entity.
export function applyPickup(player, outfit) {
  player.outfit = outfit;
}

// spawnPoint is the last checkpoint. Milestone 3 (level.js) starts setting
// this to something other than the initial spawn as checkpoints are added.
// platforms (task C) are one-way: landable from above while falling, never
// solid from below or the sides, so a missed jump just drops the player
// back onto the ground below -- there is no gap to fall out of the level
// through. Returns any projectiles spawned this step, so game.js can own
// the projectile list rather than player.js reaching into shared state.
export function updatePlayer(player, dt, spawnPoint, platforms = []) {
  updateBarks(player, dt);

  if (player.dead) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) respawnPlayer(player, spawnPoint);
    return [];
  }

  player.animationTime += dt;

  const left = isActionDown('left');
  const right = isActionDown('right');
  const shooting = isActionDown('shoot');

  player.vx = 0;
  if (left && !right) player.vx = -PLAYER.moveSpeed;
  else if (right && !left) player.vx = PLAYER.moveSpeed;

  // Facing tracks movement, except while actively shooting: then it holds
  // steady so you can strafe/reposition around a boss without your shots
  // swinging away from it. Released shoot, facing resumes following movement.
  if (!shooting) {
    if (left && !right) player.facing = -1;
    else if (right && !left) player.facing = 1;
  }

  // Scripted auto-run (the utspring, task 3.5) overrides input-derived
  // movement. Input is already suppressed upstream in input.js, so this
  // is simply what moves the player while the sequence owns them.
  if (player.autoRun !== null) {
    player.vx = player.autoRun;
    player.facing = 1;
  }

  player.vy += WORLD.gravity * dt;
  if (player.vy > PLAYER.maxFallSpeed) player.vy = PLAYER.maxFallSpeed;

  // Coyote time. Refreshed every step the player is standing on
  // something, so the window always starts the moment they stop standing
  // on it -- whether they walked off a ledge or the ledge ended.
  if (player.onGround) player.coyoteTimer = PLAYER.coyoteTime;
  else if (player.coyoteTimer > 0) player.coyoteTimer -= dt;

  // Jump buffering. The press is recorded whenever it happens; whether it
  // can be spent is decided below, so an early press survives until the
  // player actually lands.
  if (wasActionPressed('jump')) player.jumpBufferTimer = PLAYER.jumpBufferTime;
  else if (player.jumpBufferTimer > 0) player.jumpBufferTimer -= dt;

  if (player.jumpBufferTimer > 0 && (player.onGround || player.coyoteTimer > 0)) {
    player.vy = PLAYER.jumpVelocity;
    player.onGround = false;
    player.coyoteTimer = 0; // spent -- one jump per departure from the ground
    player.jumpBufferTimer = 0; // spent -- one jump per press
  }

  // Variable jump height: while rising with jump not held, the climb is
  // capped. Height already gained is kept, so releasing later gives a
  // taller hop -- which is what makes it feel like a dial rather than two
  // fixed jumps.
  if (!isActionDown('jump') && player.vy < 0) {
    const cutVelocity = PLAYER.jumpVelocity * PLAYER.jumpCutMultiplier;
    if (player.vy < cutVelocity) player.vy = cutVelocity;
  }

  if (player.landSquashTimer > 0) player.landSquashTimer -= dt;
  if (player.hitFlashTimer > 0) player.hitFlashTimer -= dt;

  // Captured before collision resolution zeroes it: how hard this step's
  // landing, if there is one, actually was.
  const impactSpeed = player.vy;
  const wasOnGround = player.onGround;

  const feetBefore = player.y + player.height;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const feetAfter = player.y + player.height;

  // Platforms first: only while falling (vy >= 0) and only when this step
  // crossed the platform's top surface from above it -- a one-way landing,
  // never a ceiling, so jumping up through one from below is unobstructed.
  let landedOnPlatform = false;
  if (player.vy >= 0) {
    for (const platform of platforms) {
      const withinX = player.x + player.width > platform.x && player.x < platform.x + platform.width;
      if (withinX && feetBefore <= platform.y && feetAfter >= platform.y) {
        player.y = platform.y - player.height;
        player.vy = 0;
        landedOnPlatform = true;
        break;
      }
    }
  }

  const groundTop = WORLD.groundY - player.height;
  if (!landedOnPlatform && player.y >= groundTop) {
    player.y = groundTop;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = landedOnPlatform;
  }

  if (!wasOnGround && player.onGround && impactSpeed >= PLAYER.landSquash.minImpactSpeed) {
    player.landSquashTimer = PLAYER.landSquash.duration;
  }

  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (player.invulnerableFor > 0) player.invulnerableFor -= dt;

  const spawned = [];
  if (shooting && player.fireCooldown <= 0) {
    player.fireCooldown = PROJECTILE.fireCooldown;
    spawned.push(spawnProjectile(player));
  }
  return spawned;
}

function spawnProjectile(player) {
  const dir = player.facing;
  return {
    x: dir > 0 ? player.x + player.width : player.x - PROJECTILE.width,
    y: player.y + player.height / 2 - PROJECTILE.height / 2,
    width: PROJECTILE.width,
    height: PROJECTILE.height,
    vx: PROJECTILE.speed * dir,
    vy: 0,
    life: PROJECTILE.lifetime,
    owner: 'player',
    color: PROJECTILE.color,
  };
}

// Infinite lives: death costs a brief respawn, never a replay. Ignored while
// already invulnerable or mid-respawn, so contact with an enemy can't stack
// multiple hits in one graze.
export function damagePlayer(player, amount) {
  if (player.dead || player.invincible || player.invulnerableFor > 0) return;
  player.hp -= amount;
  player.hitFlashTimer = DAMAGE_FLASH.playerDuration;
  player.invulnerableFor = PLAYER.invulnerabilityDuration;
  if (player.hp <= 0) {
    player.dead = true;
    player.respawnTimer = PLAYER.respawnDelay;
  }
}

function respawnPlayer(player, spawnPoint) {
  player.x = spawnPoint.x;
  player.y = spawnPoint.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.coyoteTimer = 0;
  player.jumpBufferTimer = 0;
  player.landSquashTimer = 0;
  player.hitFlashTimer = 0;
  player.hp = PLAYER.maxHp;
  player.dead = false;
  player.invulnerableFor = PLAYER.invulnerabilityDuration;
  // Barks belong to the run that earned them: one still floating at the
  // moment of death would otherwise reappear above the player at the
  // checkpoint, hundreds of pixels from the kill it describes.
  player.barks.length = 0;
}

export function drawPlayer(ctx, player) {
  if (player.dead) return;
  // Blink while invulnerable so the grace period reads clearly. Fading
  // rather than flashing white, which would be hard to read against the
  // white studentmössa overlay.
  const blinking =
    player.invulnerableFor > 0 && Math.floor(player.invulnerableFor * PLAYER.invulnerableBlinkRate) % 2 === 0;
  const flashing = player.hitFlashTimer > 0;
  ctx.globalAlpha = blinking && !flashing ? PLAYER.invulnerableBlinkAlpha : 1;

  // Landing squash, applied around the feet so the character stays planted
  // on the ground while the top of it compresses. The studentmössa rides
  // along inside the same transform; barks deliberately do not, since text
  // stretching with a landing would just look broken.
  ctx.save();
  applyLandSquash(ctx, player);
  const image = getImage(PLAYER_SPRITES[player.outfit] || PLAYER_SPRITES.none);
  const animationPath = PLAYER_ANIMATION_SHEETS[player.outfit];
  const animationImage = animationPath ? getImage(animationPath) : undefined;
  if (animationImage) {
    drawPlayerSprite(ctx, player, animationImage, flashing, getAnimationFrame(player));
  } else if (image) drawPlayerSprite(ctx, player, image, flashing);
  else drawPlayerFallback(ctx, player, flashing);
  ctx.restore();
  ctx.globalAlpha = 1;

  drawBarks(ctx, player);
}

function getAnimationFrame(player) {
  if (player.hitFlashTimer > 0) return 9;

  const shootElapsed = PROJECTILE.fireCooldown - player.fireCooldown;
  const shootDuration = PLAYER.animation.shootFrameDuration * 2;
  if (player.fireCooldown > 0 && shootElapsed >= 0 && shootElapsed < shootDuration) {
    return 7 + Math.min(1, Math.floor(shootElapsed / PLAYER.animation.shootFrameDuration));
  }
  if (!player.onGround) return 6;
  if (Math.abs(player.vx) > 0) {
    return 2 + Math.floor(player.animationTime / PLAYER.animation.runFrameDuration) % 4;
  }
  return Math.floor(player.animationTime / PLAYER.animation.idleFrameDuration) % 2;
}

function drawPlayerSprite(ctx, player, image, flashing, frame = null) {
  const feetCenterX = Math.round(player.x + player.width / 2);
  const feetY = Math.round(player.y + player.height);
  ctx.translate(feetCenterX, feetY);
  ctx.scale(player.facing, 1);
  drawSpriteImage(ctx, image, frame);
  // Preserve the existing hit-flash feedback without replacing the sprite
  // with its former block: a second screen-blended draw brightens only the
  // non-transparent character pixels.
  if (flashing) {
    ctx.globalCompositeOperation = 'screen';
    drawSpriteImage(ctx, image, frame);
  }
}

function drawSpriteImage(ctx, image, frame) {
  if (frame === null) {
    ctx.drawImage(image, -SPRITE_FOOT_X, -SPRITE_FOOT_Y);
    return;
  }
  const sourceX = (frame % SPRITE_SHEET_COLUMNS) * SPRITE_FRAME_SIZE;
  const sourceY = Math.floor(frame / SPRITE_SHEET_COLUMNS) * SPRITE_FRAME_SIZE;
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    SPRITE_FRAME_SIZE,
    SPRITE_FRAME_SIZE,
    -SPRITE_FOOT_X,
    -SPRITE_FOOT_Y,
    SPRITE_FRAME_SIZE,
    SPRITE_FRAME_SIZE,
  );
}

// A failed image load must not make the player invisible. This is only a
// resilience fallback; a normal successful load always draws the real art.
function drawPlayerFallback(ctx, player, flashing) {
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  ctx.fillStyle = flashing ? DAMAGE_FLASH.playerColor : PICKUP.colors[player.outfit] || PLAYER.color;
  ctx.fillRect(x, y, player.width, player.height);
  ctx.strokeStyle = PLAYER.outlineColor;
  ctx.lineWidth = PLAYER.outlineWidth;
  ctx.strokeRect(x, y, player.width, player.height);
}

function applyLandSquash(ctx, player) {
  if (player.landSquashTimer <= 0) return;
  const squash = PLAYER.landSquash;
  const t = player.landSquashTimer / squash.duration; // 1 at impact, 0 when done
  const scaleX = 1 + (squash.scaleX - 1) * t;
  const scaleY = 1 + (squash.scaleY - 1) * t;
  const centerX = player.x + player.width / 2;
  const feetY = player.y + player.height;
  ctx.translate(centerX, feetY);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-centerX, -feetY);
}

// Floats upward and fades over its lifetime; drawn above the player, never
// touching game state or input, so it can never pause anything (AGENTS.md §4).
function drawBarks(ctx, player) {
  if (player.barks.length === 0) return;
  const centerX = Math.round(player.x + player.width / 2);
  const visualTop = player.y + player.height - SPRITE_FOOT_Y + SPRITE_VISIBLE_TOP_Y;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = BARK.font;
  for (const bark of player.barks) {
    const age = 1 - bark.timer / BARK.displayDuration; // 0 at spawn, 1 at expiry
    const y = Math.round(visualTop - BARK.offsetAboveHead - BARK.floatDistance * age);
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.fillStyle = BARK.color;
    ctx.fillText(bark.text, centerX, y);
  }
  ctx.globalAlpha = 1;
}
