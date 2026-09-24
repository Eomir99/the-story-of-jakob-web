// bosses.js — the Research Golem and Graduation (AGENTS.md §4). No
// generalised multi-boss framework: each boss's state machine (phases,
// telegraph/cycle orchestration) is written out specifically for it, per
// AGENTS.md's instruction not to invent one ahead of need. Each boss has
// its own attacks as data (RESEARCH_GOLEM.patterns, GRADUATION.abilities).
// What's shared is only presentation with no boss-specific decisions in
// it: the HP bar, the pose-sheet frame choice and the sprite tint. The claim phase is
// never touched by Graduation: AGENTS.md is explicit that mechanic is
// Research-Golem-only.

import { RESEARCH_GOLEM, GRADUATION, WORLD, TELEGRAPH, CLAIM_PHASE, PLAYER, PROJECTILE, BOSS_PROJECTILE_LIFETIME, DAMAGE_FLASH, HAZARD } from './config.js';
import { getImage } from './assets.js';

// AGENTS.md §4: every attack's wind-up must be 0.8-1.0s. Enforced once at
// load time so a future pattern can't silently ship without a fair tell.
for (const [patternId, pattern] of Object.entries(RESEARCH_GOLEM.patterns)) {
  const d = pattern.telegraphDuration;
  if (d < TELEGRAPH.minDuration || d > TELEGRAPH.maxDuration) {
    throw new Error(
      `bosses.js: pattern "${patternId}" has telegraphDuration ${d}s, outside the required ${TELEGRAPH.minDuration}-${TELEGRAPH.maxDuration}s range (AGENTS.md §4).`
    );
  }
}

export function createResearchGolem(x, y, activationX) {
  return {
    x,
    y,
    width: RESEARCH_GOLEM.width,
    height: RESEARCH_GOLEM.height,
    hp: RESEARCH_GOLEM.maxHp,
    alive: true,
    // Dormant until the player reaches activationX (task B, level data):
    // no thinking, no firing, no attack-pattern advancement until then.
    active: false,
    activationX,
    hitFlash: 0,
    // 'phaseA' | 'claim' | 'phaseB' | 'dead'.
    phase: 'phaseA',
    cycleTimer: RESEARCH_GOLEM.phaseA.cycleInterval,
    cycleIndex: 0,
    // Active wind-up, or null between attacks.
    telegraph: null,
    // How many of the (max two) claim phases have been entered so far.
    claimPhasesUsed: 0,
    // Set while phase === 'claim': array of { text, correct, x, y, width,
    // height }. Null otherwise.
    claims: null,
    claimClock: 0, // s, for the evidence marker's floating bob
    lastClaimTaunt: null, // shown briefly after a wrong shot
    tauntTimer: 0,

    // Presentation only, read by drawResearchGolem and nothing else. The
    // fight's own timers drive which pose is on screen, so these three
    // cannot put the animation out of step with what the boss is doing:
    // animationClock walks the idle cycle, and the strike pair holds the
    // strike and follow-through poses for a moment after a shot leaves.
    animationClock: 0, // s, free-running
    strikeTimer: 0, // s remaining of strike + follow-through
    strikePatternId: null, // which sequence that strike belongs to
  };
}

// Returns any hostile projectiles fired this step, so game.js can own the
// shared projectile list rather than bosses.js reaching into it.
export function updateResearchGolem(boss, dt) {
  if (!boss.active) return []; // task B: sits idle until the player arrives
  if (boss.hitFlash > 0) boss.hitFlash -= dt;
  if (boss.tauntTimer > 0) boss.tauntTimer -= dt;
  // Presentation clocks (see createResearchGolem). Advanced before the
  // alive check so a dying frame still ticks, and outside every phase
  // branch so the idle keeps breathing during the claim phase.
  boss.animationClock += dt;
  if (boss.strikeTimer > 0) boss.strikeTimer -= dt;
  if (!boss.alive) return [];

  if (boss.phase === 'claim') {
    boss.claimClock += dt; // drives the evidence marker's floating bob
    return [];
  }

  const phaseData = RESEARCH_GOLEM[boss.phase];
  if (!phaseData) return []; // e.g. 'dead'

  if (boss.telegraph) {
    boss.telegraph.timer -= dt;
    if (boss.telegraph.timer <= 0) {
      const patternId = boss.telegraph.patternId;
      boss.telegraph = null;
      boss.cycleTimer = phaseData.cycleInterval;
      // Hold that pattern's strike and follow-through poses while the
      // shot travels (presentation only -- see createResearchGolem).
      const sprite = RESEARCH_GOLEM.sprite;
      boss.strikeTimer = sprite.strikeDuration + sprite.recoverDuration;
      boss.strikePatternId = patternId;
      return fireAttack(boss, patternId, RESEARCH_GOLEM.patterns, RESEARCH_GOLEM.contactDamage);
    }
    return [];
  }

  boss.cycleTimer -= dt;
  if (boss.cycleTimer <= 0) {
    const patternId = phaseData.cyclePatterns[boss.cycleIndex % phaseData.cyclePatterns.length];
    boss.cycleIndex += 1;
    const pattern = RESEARCH_GOLEM.patterns[patternId];
    boss.telegraph = { patternId, timer: pattern.telegraphDuration, duration: pattern.telegraphDuration };
  }
  return [];
}

// Called once by game.js the instant the player crosses activationX (task
// 1, config.js ACTIVATION note): starts the first wind-up immediately
// instead of leaving boss.cycleTimer to run out a full cycleInterval from
// scratch, which is what made the first attack of every fight land
// several seconds later than it should have.
export function activateResearchGolem(boss) {
  boss.active = true;
  const patternId = RESEARCH_GOLEM.phaseA.cyclePatterns[0];
  boss.cycleIndex = 1;
  const pattern = RESEARCH_GOLEM.patterns[patternId];
  boss.telegraph = { patternId, timer: pattern.telegraphDuration, duration: pattern.telegraphDuration };
}

// Fires one of the Research Golem's attack patterns (AGENTS.md §5:
// projectile type, angle, speed, delay, telegraph duration, repeat count,
// all as data). Graduation used to fire these too; it now has its own
// abilities (strikeGraduation below), so only the golem calls this.
function fireAttack(boss, patternId, patterns, contactDamage) {
  const pattern = patterns[patternId];
  const originX = boss.x;

  if (patternId === 'ground-shot') {
    // Travels at floor level -- the player has to jump over it.
    return [
      {
        x: originX,
        y: WORLD.groundY - pattern.projectileHeight,
        width: pattern.projectileWidth,
        height: pattern.projectileHeight,
        vx: -pattern.projectileSpeed,
        vy: 0,
        life: BOSS_PROJECTILE_LIFETIME,
        owner: 'boss',
        contactDamage,
        color: pattern.color,
        // Presentation only: which authored row the renderer animates
        // (config.js RESEARCH_GOLEM.projectileSprite). `age` is its clock.
        patternId,
        age: 0,
      },
    ];
  }

  if (patternId === 'high-arc') {
    // Launched up and out, arcs back down under gravity -- the player has
    // to reposition out from under where it will land.
    return [
      {
        x: originX,
        y: boss.y + pattern.spawnHeightOffset,
        width: pattern.projectileWidth,
        height: pattern.projectileHeight,
        vx: -pattern.projectileSpeed,
        vy: pattern.launchVy,
        gravity: pattern.gravity,
        life: BOSS_PROJECTILE_LIFETIME,
        owner: 'boss',
        contactDamage,
        color: pattern.color,
        // Presentation only: which authored row the renderer animates
        // (config.js RESEARCH_GOLEM.projectileSprite). `age` is its clock.
        patternId,
        age: 0,
      },
    ];
  }

  if (patternId === 'spread-burst') {
    // A fan of shots -- the player has to find the gap.
    const n = pattern.repeatCount;
    const half = pattern.spreadAngleDeg / 2;
    const originY = boss.y + boss.height / 2;
    const list = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const angleDeg = 180 - half + t * pattern.spreadAngleDeg; // fanned around leftward (180deg)
      const rad = (angleDeg * Math.PI) / 180;
      list.push({
        x: originX,
        y: originY,
        width: pattern.projectileWidth,
        height: pattern.projectileHeight,
        vx: Math.cos(rad) * pattern.projectileSpeed,
        vy: Math.sin(rad) * pattern.projectileSpeed,
        life: BOSS_PROJECTILE_LIFETIME,
        owner: 'boss',
        contactDamage,
        color: pattern.color,
        // Presentation only: which authored row the renderer animates
        // (config.js RESEARCH_GOLEM.projectileSprite). `age` is its clock.
        patternId,
        age: 0,
      });
    }
    return list;
  }

  return [];
}

export function damageResearchGolem(boss, amount) {
  // task B: dormant means dormant -- a shot fired from outside the arena,
  // before the player has crossed activationX, must not be able to chip
  // a sleeping boss for free. Projectile range/culling should normally
  // prevent this anyway, but this is the correctness guarantee.
  if (!boss.active || !boss.alive || boss.phase === 'claim') return;
  boss.hp -= amount;
  boss.hitFlash = RESEARCH_GOLEM.hitFlashDuration;
  if (boss.hp <= 0) {
    boss.hp = 0;
    boss.alive = false;
    boss.phase = 'dead';
    return;
  }
  maybeEnterClaimPhase(boss);
}

// ---------------------------------------------------------------------
// Graduation (AGENTS.md §4, task 3.7): an endurance finish with four
// abilities of his own, all defined as data in config.js
// GRADUATION.abilities. Written out for this one boss, like the Research
// Golem's machine above -- no shared boss framework. No claim phase: that
// mechanic is Research-Golem-only and is never reused here.
//
// One cycle: a wind-up (boss.telegraph, the ability's telegraphDuration,
// during which the ready and wind-up poses play and any floor warning is
// shown), the strike, then the ability's cooldown. Anything an ability
// sets off with a delay -- a shot later in the volley -- waits in
// boss.pendingShots, so a player death can clear it in one place
// (clearGraduationHazards).
// ---------------------------------------------------------------------

// AGENTS.md §4, same load-time guarantee as the Research Golem's patterns:
// no ability can ship without a fair wind-up.
for (const [abilityId, ability] of Object.entries(GRADUATION.abilities)) {
  const d = ability.telegraphDuration;
  if (d < TELEGRAPH.minDuration || d > TELEGRAPH.maxDuration) {
    throw new Error(
      `bosses.js: Graduation ability "${abilityId}" has telegraphDuration ${d}s, outside the required ${TELEGRAPH.minDuration}-${TELEGRAPH.maxDuration}s range (AGENTS.md §4).`
    );
  }
}

// damageGraduationBoss relies on stage 2's rotation being stage 1's with
// the new abilities after it. Checked so a reordering in config.js can't
// silently skip part of the opening.
if (!GRADUATION.stage1.rotation.every((id, i) => GRADUATION.stage2.rotation[i] === id)) {
  throw new Error('bosses.js: GRADUATION.stage2.rotation must start with stage1.rotation, in the same order.');
}

// Staff slam's waves must be jumpable one after another without precise
// timing: the time between two waves has to cover a full jump (up and
// back down, from the real jump values) plus minLandingSlack on the
// ground. Checked here so retuning either the jump or the waves can't
// quietly make the attack a timing test.
{
  const slam = GRADUATION.abilities['staff-slam'];
  if (slam) {
    const airtime = (2 * -PLAYER.jumpVelocity) / WORLD.gravity;
    const interval = slam.waveSpacing / slam.waveSpeed;
    if (interval < airtime + slam.minLandingSlack) {
      throw new Error(
        `bosses.js: staff-slam waves are ${interval.toFixed(2)}s apart, but a jump takes ${airtime.toFixed(2)}s and minLandingSlack is ${slam.minLandingSlack}s -- widen waveSpacing.`
      );
    }
  }
}

export function createGraduationBoss(x, y, activationX) {
  return {
    x,
    y,
    width: GRADUATION.width,
    height: GRADUATION.height,
    hp: GRADUATION.maxHp,
    alive: true,
    // Dormant until the player reaches activationX (task B) -- same as
    // the Research Golem. activationX is also the arena's left wall: the
    // floor the abilities cover runs from there to the boss.
    active: false,
    activationX,
    hitFlash: 0,
    // 'stage1' | 'stage2' | 'dead'.
    stage: 'stage1',
    cycleTimer: 0,
    cycleIndex: 0,
    // Active wind-up, or null: { patternId, timer, duration }. patternId
    // is the ability id -- the name bossSpriteFrame reads.
    telegraph: null,
    // Delayed shots from the last strike: [{ timer, projectile }].
    pendingShots: [],
    // Book rain's landing shadows: [{ x, width, timer, duration }], timer
    // counting down to the moment that book lands.
    bookShadows: [],
    // Rising slabs: [{ x, width, age, cracks }], age counting up from the
    // start of the wind-up (see slabHeight).
    slabs: [],

    // Presentation only, read by drawGraduationBoss -- the same three
    // clocks as the Research Golem's (see createResearchGolem).
    animationClock: 0, // s, free-running
    strikeTimer: 0, // s remaining of strike + follow-through
    strikePatternId: null,
  };
}

// Same fix as activateResearchGolem above, for the same reason: the first
// wind-up starts the instant the fight does.
export function activateGraduationBoss(boss, player) {
  boss.active = true;
  beginGraduationWindUp(boss, player);
}

export function updateGraduationBoss(boss, dt, player) {
  if (!boss.active) return []; // task B: sits idle until the player arrives
  if (boss.hitFlash > 0) boss.hitFlash -= dt;
  boss.animationClock += dt;
  if (boss.strikeTimer > 0) boss.strikeTimer -= dt;
  if (!boss.alive) return [];

  const fired = [];
  for (const pending of boss.pendingShots) {
    pending.timer -= dt;
    if (pending.timer <= 0) fired.push(pending.projectile);
  }
  boss.pendingShots = boss.pendingShots.filter((pending) => pending.timer > 0);
  for (const shadow of boss.bookShadows) shadow.timer -= dt;
  boss.bookShadows = boss.bookShadows.filter((shadow) => shadow.timer > 0);
  const slabSpec = GRADUATION.abilities['rising-slabs'];
  for (const slab of boss.slabs) slab.age += dt;
  boss.slabs = boss.slabs.filter((slab) => slab.age < slabLifetime(slabSpec));

  if (boss.telegraph) {
    boss.telegraph.timer -= dt;
    if (boss.telegraph.timer <= 0) {
      const telegraph = boss.telegraph;
      const abilityId = telegraph.patternId;
      boss.telegraph = null;
      boss.strikeTimer = GRADUATION.sprite.strikeDuration + GRADUATION.sprite.recoverDuration;
      boss.strikePatternId = abilityId;
      boss.cycleTimer = graduationCooldown(boss, abilityId);
      fired.push(...strikeGraduation(boss, abilityId, telegraph));
    }
    return fired;
  }

  boss.cycleTimer -= dt;
  if (boss.cycleTimer <= 0) beginGraduationWindUp(boss, player);
  return fired;
}

function beginGraduationWindUp(boss, player) {
  const rotation = GRADUATION[boss.stage].rotation;
  const abilityId = rotation[boss.cycleIndex % rotation.length];
  boss.cycleIndex += 1;
  const ability = GRADUATION.abilities[abilityId];
  boss.telegraph = { patternId: abilityId, timer: ability.telegraphDuration, duration: ability.telegraphDuration };

  // Abilities with a floor warning decide where they will land NOW, at
  // the start of the wind-up, so the warning covers the whole wind-up.
  if (abilityId === 'book-rain') {
    boss.telegraph.books = planBookRain(boss, ability);
    const fallTime = (ability.spawnHeight - ability.bookHeight) / ability.fallSpeed;
    for (const book of boss.telegraph.books) {
      const duration = ability.telegraphDuration + book.delay + fallTime;
      boss.bookShadows.push({ x: book.x, width: ability.bookWidth, timer: duration, duration });
    }
  }
  if (abilityId === 'rising-slabs') {
    for (const x of planSlabs(boss, ability, player)) {
      // The crack's zigzag, decided once so it doesn't flicker: one
      // up-or-down offset per segment boundary.
      const cracks = [];
      for (let i = 0; i <= ability.warning.crackSegments; i++) cracks.push(Math.random() * 2 - 1);
      boss.slabs.push({ x, width: ability.slabWidth, age: 0, cracks });
    }
  }
}

// Where the slabs rise: the first centred under the player (clamped to
// the floor between the arena wall and the boss), then outward from it,
// alternating sides, one every slabWidth + safeGapWidth, for as many as
// fit up to slabCount.
function planSlabs(boss, ability, player) {
  const left = boss.activationX;
  const right = boss.x - ability.slabWidth;
  const clamp = (x) => Math.min(Math.max(x, left), right);
  const first = clamp(player.x + player.width / 2 - ability.slabWidth / 2);
  const step = ability.slabWidth + ability.safeGapWidth;
  const spots = [first];
  for (let k = 1; spots.length < ability.slabCount && k * step <= right - left; k++) {
    for (const x of [first + k * step, first - k * step]) {
      if (spots.length < ability.slabCount && x >= left && x <= right) spots.push(x);
    }
  }
  return spots;
}

// A slab's life, from the start of the wind-up: warning (as long as the
// wind-up), rise, hold, slam back down, gone.
function slabLifetime(ability) {
  return ability.telegraphDuration + ability.riseDuration + ability.holdDuration + ability.slamDuration;
}

// How far a slab stands out of the floor at this point in its life, in
// px. Zero through the warning -- a slab can only hurt once it is up.
function slabHeight(slab, ability) {
  let t = slab.age - ability.telegraphDuration;
  if (t < 0) return 0;
  if (t < ability.riseDuration) return ability.slabHeight * (t / ability.riseDuration);
  t -= ability.riseDuration;
  if (t < ability.holdDuration) return ability.slabHeight;
  t -= ability.holdDuration;
  if (t < ability.slamDuration) return ability.slabHeight * (1 - t / ability.slamDuration);
  return 0;
}

// Called by game.js every step: true if a risen slab overlaps the player.
// The slab is only a damage zone -- it never pushes, blocks or carries the
// player, and damagePlayer's own invulnerability decides whether it hurts.
export function graduationSlabHitsPlayer(boss, player) {
  if (!boss || !boss.alive) return false;
  const ability = GRADUATION.abilities['rising-slabs'];
  if (!ability) return false;
  for (const slab of boss.slabs) {
    const height = slabHeight(slab, ability);
    if (height <= 0) continue;
    const zone = { x: slab.x, y: WORLD.groundY - height, width: slab.width, height };
    if (aabbOverlap(zone, player)) return true;
  }
  return false;
}

// Where the books land: one every bookSpacing across the floor, from a
// random starting offset, skipping every book that would fall inside one
// randomly placed stretch of safeGapWidth -- which is therefore always
// completely clear. Each book also gets its own small random drop delay,
// so they arrive as rain rather than as a single sheet.
function planBookRain(boss, ability) {
  const left = boss.activationX;
  const right = boss.x;
  const gapLeft = left + Math.random() * Math.max(0, right - left - ability.safeGapWidth);
  const gapRight = gapLeft + ability.safeGapWidth;
  const books = [];
  for (let centre = left + Math.random() * ability.bookSpacing; centre < right; centre += ability.bookSpacing) {
    const x = Math.min(Math.max(centre - ability.bookWidth / 2, left), right - ability.bookWidth);
    if (x + ability.bookWidth > gapLeft && x < gapRight) continue;
    books.push({ x, delay: Math.random() * ability.dropStagger });
  }
  return books;
}

function graduationCooldown(boss, abilityId) {
  const scale = boss.stage === 'stage2' ? GRADUATION.stage2.cooldownScale : 1;
  return GRADUATION.abilities[abilityId].cooldown * scale;
}

// The attack itself, the instant the wind-up ends. Returns projectiles to
// fire now; anything later goes into boss.pendingShots.
function strikeGraduation(boss, abilityId, telegraph) {
  const ability = GRADUATION.abilities[abilityId];

  if (abilityId === 'book-rain') {
    // Exactly the books the shadows were drawn for (planned at wind-up).
    for (const book of telegraph.books) {
      queueGraduationShot(boss, book.delay, {
        x: book.x,
        y: WORLD.groundY - ability.spawnHeight,
        width: ability.bookWidth,
        height: ability.bookHeight,
        vx: 0,
        vy: ability.fallSpeed,
        // Gone the moment it reaches the floor (game.js updateProjectiles)
        // -- a book lands, it doesn't sink into the ground.
        removeOnLanding: true,
        color: ability.color,
        pageColor: ability.pageColor,
        visualScale: ability.visualScale,
        graduationShape: 'book',
      });
    }
    return [];
  }

  if (abilityId === 'staff-slam') {
    // Floor-level waves from his front edge, one every waveSpacing.
    for (let i = 0; i < ability.waveCount; i++) {
      queueGraduationShot(boss, (i * ability.waveSpacing) / ability.waveSpeed, {
        x: boss.x - ability.waveWidth,
        y: WORLD.groundY - ability.waveHeight,
        width: ability.waveWidth,
        height: ability.waveHeight,
        vx: -ability.waveSpeed,
        vy: 0,
        color: ability.color,
        visualScale: ability.visualScale,
        // Drawn standing on the floor, not centred on the hitbox.
        anchorBottom: true,
        graduationShape: 'wave',
      });
    }
    return [];
  }

  if (abilityId === 'volley') {
    for (const shot of ability.shots) {
      queueGraduationShot(boss, shot.delay, {
        x: boss.x - ability.projectileWidth,
        y: WORLD.groundY - shot.height - ability.projectileHeight / 2,
        width: ability.projectileWidth,
        height: ability.projectileHeight,
        vx: -ability.projectileSpeed,
        vy: 0,
        color: ability.color,
        visualScale: ability.visualScale,
        graduationShape: 'bolt',
      });
    }
    return [];
  }

  return [];
}

// Every Graduation projectile goes through here, so they all carry the
// same hostile fields game.js reads.
function queueGraduationShot(boss, delay, fields) {
  boss.pendingShots.push({
    timer: delay,
    projectile: {
      life: GRADUATION.projectileLifetime,
      owner: 'boss',
      contactDamage: GRADUATION.contactDamage,
      ...fields,
    },
  });
}

// AGENTS.md §4 Failure: on the player's death, everything the boss has
// set in motion goes -- game.js clears the projectiles already flying,
// this clears what is still to come -- and he waits respawnGrace before
// winding up again. HP, stage and his place in the rotation are kept.
export function clearGraduationHazards(boss) {
  if (!boss || !boss.active || !boss.alive) return;
  boss.pendingShots = [];
  boss.bookShadows = [];
  boss.slabs = [];
  boss.telegraph = null;
  boss.strikeTimer = 0;
  boss.cycleTimer = GRADUATION.respawnGrace;
}

export function damageGraduationBoss(boss, amount) {
  if (!boss.active || !boss.alive) return; // task B, same reasoning as the Research Golem's
  boss.hp -= amount;
  boss.hitFlash = GRADUATION.hitFlashDuration;
  if (boss.hp <= 0) {
    boss.hp = 0;
    boss.alive = false;
    boss.stage = 'dead';
    boss.pendingShots = [];
    boss.bookShadows = [];
    boss.slabs = [];
    return;
  }
  if (boss.stage === 'stage1' && boss.hp <= GRADUATION.maxHp * GRADUATION.stage2Threshold) {
    // The slabs join the rotation (config.js: stage 2's rotation is stage
    // 1's plus the slabs at the end). If the opening three haven't all
    // been shown yet, carry on through them at the same index; if they
    // have, the slabs come next. An attack already winding up finishes.
    boss.stage = 'stage2';
    const opening = GRADUATION.stage1.rotation.length;
    boss.cycleIndex = Math.min(boss.cycleIndex, opening);
  }
}

// Graduation's projectiles, drawn by shape (game.js drawProjectiles hands
// them here first). Plain canvas shapes: there is no projectile art for
// this boss. Every one keeps the hazard rim.
export function drawGraduationProjectile(ctx, projectile, x, y) {
  const shape = projectile.graduationShape;
  if (!shape) return false;
  // Drawn larger than the hitbox, around its centre (visualScale): a
  // player who sees the edge of the drawing is only ever hit by its core,
  // never the other way round -- same direction as the golem's art.
  const scale = projectile.visualScale || 1;
  const w = projectile.width * scale;
  const h = projectile.height * scale;
  x = Math.round(x + (projectile.width - w) / 2);
  y = Math.round(projectile.anchorBottom ? y + projectile.height - h : y + (projectile.height - h) / 2);
  ctx.strokeStyle = HAZARD.outlineColor;
  ctx.lineWidth = HAZARD.projectileOutlineWidth;
  ctx.fillStyle = projectile.color;

  if (shape === 'bolt') {
    // A pointed bolt, point first (leftward).
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + h / 2, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + h / 2, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return true;
  }

  if (shape === 'wave') {
    // A shockwave: a dome standing on the floor. Wider than the drawing
    // box (0.65 of its width either side, not 0.5) so the dome's curve
    // still covers the hitbox's top corners -- anything that can hit is
    // inside the drawing.
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h, w * 0.65, h, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return true;
  }

  if (shape === 'book') {
    // A closed book falling flat: cover, with the page block showing
    // along its lower edge and a spine down the left.
    const pages = Math.max(3, Math.round(h * 0.25));
    const spine = Math.max(3, Math.round(w * 0.12));
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = projectile.pageColor;
    ctx.fillRect(x + spine, y + h - pages - 2, w - spine - 2, pages);
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath();
    ctx.moveTo(x + spine, y);
    ctx.lineTo(x + spine, y + h);
    ctx.stroke();
    return true;
  }

  return false;
}

// Graduation's floor warnings, drawn on the floor under everything that
// moves (game.js render, straight after the platforms): book rain's
// landing shadows, and the rising slabs -- their glowing, cracked spots
// through the wind-up, then the slabs themselves.
export function drawGraduationFloorWarnings(ctx, boss) {
  if (!boss || !boss.alive) return;
  const slabs = GRADUATION.abilities['rising-slabs'];
  if (slabs) {
    for (const slab of boss.slabs) {
      const height = slabHeight(slab, slabs);
      if (height > 0) drawSlab(ctx, slab, height, slabs);
      else drawSlabWarning(ctx, slab, slabs);
    }
  }
  const rain = GRADUATION.abilities['book-rain'];
  if (rain) {
    const spec = rain.shadow;
    for (const shadow of boss.bookShadows) {
      const progress = 1 - shadow.timer / shadow.duration;
      const cx = shadow.x + shadow.width / 2;
      const rx = (shadow.width * spec.widthScale) / 2;
      ctx.save();
      ctx.globalAlpha = spec.startAlpha + (spec.endAlpha - spec.startAlpha) * progress;
      ctx.fillStyle = spec.color;
      ctx.beginPath();
      ctx.ellipse(cx, WORLD.groundY, rx, spec.radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = spec.ringColor;
      ctx.lineWidth = spec.ringWidth;
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Through the wind-up: a strip of hazard-coloured glow on the floor,
// brightening as the wind-up runs out and pulsing on top of that, with a
// dark crack zigzagging across it.
function drawSlabWarning(ctx, slab, ability) {
  const spec = ability.warning;
  const progress = Math.min(1, slab.age / ability.telegraphDuration);
  const pulse = Math.sin(slab.age * spec.pulseRate) * spec.pulseDepth;
  const alpha = Math.max(0, Math.min(1, spec.startAlpha + (spec.endAlpha - spec.startAlpha) * progress + pulse));
  const floor = WORLD.groundY;
  ctx.save();
  const glow = ctx.createLinearGradient(0, floor - spec.glowHeight, 0, floor);
  glow.addColorStop(0, 'rgba(0, 0, 0, 0)');
  glow.addColorStop(1, spec.glowColor);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = glow;
  ctx.fillRect(slab.x, floor - spec.glowHeight, slab.width, spec.glowHeight);
  ctx.fillStyle = spec.glowColor;
  ctx.fillRect(slab.x, floor - spec.bandHeight / 2, slab.width, spec.bandHeight);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = spec.crackColor;
  ctx.lineWidth = spec.crackWidth;
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  const segment = slab.width / spec.crackSegments;
  for (let i = 0; i <= spec.crackSegments; i++) {
    const x = slab.x + i * segment;
    const y = floor + slab.cracks[i] * spec.crackDepth * progress;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

// A risen slab: a stone block standing out of the floor, height px tall,
// with the hazard colour along its top edge and the usual hazard rim.
function drawSlab(ctx, slab, height, ability) {
  const x = Math.round(slab.x);
  const y = Math.round(WORLD.groundY - height);
  const h = Math.round(height);
  ctx.fillStyle = ability.slabColor;
  ctx.fillRect(x, y, slab.width, h);
  ctx.fillStyle = ability.slabShadeColor;
  ctx.fillRect(x + slab.width * 0.7, y, slab.width * 0.3, h);
  ctx.fillStyle = ability.slabEdgeColor;
  ctx.fillRect(x, y, slab.width, Math.min(h, ability.slabEdgeHeight));
  ctx.strokeStyle = HAZARD.outlineColor;
  ctx.lineWidth = HAZARD.projectileOutlineWidth;
  ctx.strokeRect(x, y, slab.width, h);
}

// AGENTS.md §4: max two claim phases per fight, triggered by HP crossing a
// threshold. Cancels any in-progress wind-up so a telegraphed attack can't
// land while the boss is meant to be invulnerable and the player is reading
// claims. The claim content itself (task 2.5) populates boss.claims etc.
function maybeEnterClaimPhase(boss) {
  const used = boss.claimPhasesUsed;
  if (used >= RESEARCH_GOLEM.claimThresholds.length) return;
  const thresholdFraction = RESEARCH_GOLEM.claimThresholds[used];
  if (boss.hp <= RESEARCH_GOLEM.maxHp * thresholdFraction) {
    boss.phase = 'claim';
    boss.claimPhasesUsed = used + 1;
    boss.telegraph = null;
    boss.claimClock = 0;
    boss.claims = buildClaims(boss, used); // `used` is this claim phase's set index
  }
}

function shuffled(entries) {
  const copy = entries.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// The height range a horizontal shot can actually be fired at, derived from
// real jump physics (not hand-picked) so it can't silently drift out of
// sync if jump feel gets retuned later. `top` is the smallest y (apex,
// highest up); `bottom` is the largest y (standing).
function computeReachableShotYBand() {
  const apexHeight = (PLAYER.jumpVelocity * PLAYER.jumpVelocity) / (2 * WORLD.gravity);
  const shotOffset = PLAYER.height - PLAYER.shotHeight - PROJECTILE.height / 2;
  const bottom = WORLD.groundY - PLAYER.height + shotOffset; // standing
  const top = WORLD.groundY - PLAYER.height - apexHeight + shotOffset; // jump apex
  return { top, bottom };
}

function buildClaims(boss, setIndex) {
  // Shuffled so which slot (top/middle/bottom, easiest to hardest timing)
  // holds the correct claim isn't fixed -- otherwise "always jump to the
  // top one" would beat the phase without reading anything.
  const claimSet = CLAIM_PHASE.sets[setIndex % CLAIM_PHASE.sets.length];
  boss.claimQuestion = claimSet.question ?? CLAIM_PHASE.promptText;
  const set = shuffled(claimSet.claims);
  const x = boss.x + boss.width / 2 - CLAIM_PHASE.claimWidth / 2;

  // One column, stacked inside the reachable band with an inset margin so
  // no claim requires frame-perfect timing, divided evenly with gaps.
  const band = computeReachableShotYBand();
  const usableTop = band.top + CLAIM_PHASE.reachableBandInset;
  const usableBottom = band.bottom - CLAIM_PHASE.reachableBandInset;
  const n = set.length;
  const totalGap = (n - 1) * CLAIM_PHASE.claimGapY;
  const slotHeight = (usableBottom - usableTop - totalGap) / n;
  const claimHeight = Math.min(CLAIM_PHASE.claimHeight, slotHeight);

  return set.map((entry, i) => {
    const slotTop = usableTop + i * (slotHeight + CLAIM_PHASE.claimGapY);
    const slotCenter = slotTop + slotHeight / 2;
    return {
      text: entry.text,
      correct: entry.correct,
      x,
      y: slotCenter - claimHeight / 2,
      width: CLAIM_PHASE.claimWidth,
      height: claimHeight,
    };
  });
}

// Called by game.js when a player projectile overlaps a claim's hitbox.
//
// Audit finding A11: holding fire down used to resolve the phase without
// ever reading a claim, because a wrong shot only healed the boss a
// little and left all three claims standing -- rapid fire kept hitting
// them until one turned out correct. While boss.tauntTimer is running
// (set by a wrong shot below) every claim is unhittable, not just the one
// that was wrong, so a spray of shots gets one hit and then two seconds
// of nothing no matter how fast it keeps firing.
export function findResearchGolemClaimHit(boss, projectile) {
  if (boss.phase !== 'claim' || !boss.claims || boss.tauntTimer > 0) return null;
  return boss.claims.find((claim) => aabbOverlap(projectile, claim)) || null;
}

// Resolves a claim shot: correct breaks the shield and resumes the fight in
// phase B (faster, per AGENTS.md §4); wrong heals the boss slightly and
// taunts, but never undoes meaningful progress -- the player can keep
// trying the remaining claims. boss.claims is never touched here on a
// wrong shot: the same three claims, in the same positions, reappear once
// the lockout (tauntTimer, see findResearchGolemClaimHit) runs out, so
// nothing about the puzzle itself resets.
export function resolveClaimShot(boss, claim) {
  if (claim.correct) {
    boss.phase = 'phaseB';
    boss.cycleTimer = RESEARCH_GOLEM.phaseB.cycleInterval;
    boss.claims = null;
  } else {
    boss.hp = Math.min(
      RESEARCH_GOLEM.maxHp,
      boss.hp + RESEARCH_GOLEM.maxHp * CLAIM_PHASE.wrongAnswerHealFraction
    );
    boss.lastClaimTaunt = CLAIM_PHASE.taunts[Math.floor(Math.random() * CLAIM_PHASE.taunts.length)];
    // Also the claim lockout (findResearchGolemClaimHit): closes all
    // three claims, not just the wrong one, for this long.
    boss.tauntTimer = CLAIM_PHASE.tauntDuration;
  }
}

function aabbOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Body and HP bar rendering is identical, data-driven presentation for
// both bosses -- no boss-specific decisions in it -- so it's a shared
// helper rather than copy-pasted per boss. The state machines that decide
// *what* to draw (phase, telegraph, claims) stay boss-specific above.
function drawBossBody(ctx, boss, spec) {
  if (!boss.alive) return;

  let color = spec.color;
  if (boss.telegraph) {
    // Visible tell: the boss glows toward telegraphColor as the wind-up
    // nears completion, so an attack is never a surprise (AGENTS.md §4).
    const progress = 1 - boss.telegraph.timer / boss.telegraph.duration;
    color = lerpColor(spec.color, spec.telegraphColor, progress);
  }
  // Blended over whatever the state colour is, so sustained fire reads as
  // a series of hits rather than as a strobing white slab, and never
  // covers up a wind-up the player is trying to read.
  if (boss.hitFlash > 0) {
    color = lerpColor(color, DAMAGE_FLASH.enemyColor, Math.min(1, boss.hitFlash / spec.hitFlashDuration));
  }
  const x = Math.round(boss.x);
  const y = Math.round(boss.y);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, boss.width, boss.height);
  // Same hazard rim as the enemies (config.js HAZARD). The Research
  // Golem's tan body sat almost exactly on the Handels columns' gold
  // without it.
  ctx.strokeStyle = HAZARD.outlineColor;
  ctx.lineWidth = HAZARD.bodyOutlineWidth;
  ctx.strokeRect(x, y, boss.width, boss.height);
}

function drawBossHpBar(ctx, boss, spec) {
  if (!boss.alive) return;
  const bar = spec.hpBar;
  const x = Math.round(boss.x + boss.width / 2 - bar.width / 2);
  const y = Math.round(boss.y - bar.offsetY);

  ctx.fillStyle = bar.backgroundColor;
  ctx.fillRect(x, y, bar.width, bar.height);

  const fillWidth = Math.round(bar.width * Math.max(0, boss.hp / spec.maxHp));
  ctx.fillStyle = bar.fillColor;
  ctx.fillRect(x, y, fillWidth, bar.height);

  ctx.strokeStyle = bar.borderColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, bar.width, bar.height);
}

// The Research Golem draws its authored artwork (art-source/research-golem,
// config.js RESEARCH_GOLEM.sprite). Boss-specific on purpose: Graduation
// still uses the grey-box body below and gets its own art in a later task,
// so there is no generalised layered-boss renderer here -- one boss, one
// sheet, drawn from the same entity the fight already runs on.
export function drawResearchGolem(ctx, boss) {
  if (!boss.alive) return;
  const image = getImage(RESEARCH_GOLEM.sprite.path);
  // Only if the real asset genuinely failed to load. A normal successful
  // load always draws the artwork -- same resilience rule as the player's
  // sprite fallback (player.js drawPlayerFallback).
  if (!image) {
    drawBossBody(ctx, boss, RESEARCH_GOLEM);
    return;
  }

  const spec = RESEARCH_GOLEM.sprite;
  // Anchored to the gameplay entity, not the other way round: centred on
  // the footprint's horizontal centre, with the cell's foot line standing
  // on its bottom edge. Both are read from boss.x/y/width/height every
  // frame, so the art cannot drift on a phase change, a hit or a
  // telegraph -- none of those touch the boss's position.
  const x = Math.round(boss.x + boss.width / 2 - spec.cellWidth / 2 + spec.offsetX);
  const y = Math.round(boss.y + boss.height - spec.footY + spec.offsetY);
  const frame = bossSpriteFrame(boss, spec);
  const sourceX = (frame % spec.columns) * spec.cellWidth;
  const sourceY = Math.floor(frame / spec.columns) * spec.cellHeight;
  ctx.drawImage(image, sourceX, sourceY, spec.cellWidth, spec.cellHeight,
                x, y, spec.cellWidth, spec.cellHeight);

  if (boss.telegraph) {
    // The wind-up tell, unchanged in timing and meaning -- it washes the
    // sprite rather than a rectangle (AGENTS.md §4: never cut this). The
    // golem now also RAISES AN ARM through the wind-up, which is what
    // §4 actually asks for; the tint reinforces it instead of being the
    // whole tell, which is why its peak alpha is lower than it was.
    const progress = 1 - boss.telegraph.timer / boss.telegraph.duration;
    drawSpriteTint(ctx, image, spec, sourceX, sourceY, x, y, spec.cellWidth, spec.cellHeight,
                   RESEARCH_GOLEM.telegraphColor, progress * spec.telegraphTintAlpha);
  }
  if (boss.hitFlash > 0) {
    const strength = Math.min(1, boss.hitFlash / RESEARCH_GOLEM.hitFlashDuration);
    drawSpriteTint(ctx, image, spec, sourceX, sourceY, x, y, spec.cellWidth, spec.cellHeight,
                   DAMAGE_FLASH.enemyColor, strength * spec.hitFlashTintAlpha);
  }
}

// Which cell of its sheet a boss is on this frame. Used by both bosses:
// the Research Golem's sixteen cells and Graduation's twenty, each read
// through its own config.js sprite spec.
//
// Driven entirely by state the fight already keeps -- the wind-up's own
// timer, and a strike clock started when the shot leaves -- so the
// animation cannot disagree with what the boss is actually doing. There
// is no separate animation state machine to fall out of sync.
function bossSpriteFrame(boss, spec) {
  if (boss.telegraph) {
    const frames = spec.attackFrames[boss.telegraph.patternId];
    if (frames) {
      const progress = 1 - boss.telegraph.timer / boss.telegraph.duration;
      return progress < spec.readyFraction ? frames[0] : frames[1];
    }
  }
  if (boss.strikeTimer > 0) {
    const frames = spec.attackFrames[boss.strikePatternId];
    if (frames) {
      return boss.strikeTimer > spec.recoverDuration ? frames[2] : frames[3];
    }
  }
  const idle = spec.idleFrames;
  return idle[Math.floor(boss.animationClock / spec.idleFrameDuration) % idle.length];
}

// Washes a flat colour over the sprite's own opaque pixels, at the same
// place and size the sprite was just drawn, so a tell can never nudge the
// artwork. Built the same way game.js tints a background layer
// ('source-in' keeps the source's alpha and replaces the RGB under it) and
// cached per sheet and colour for the same reason -- two colours, both
// config.js constants, and this runs every frame of every wind-up.
//
// The whole sheet is tinted once per colour, not the current cell, so
// changing pose mid-wind-up costs nothing and the cache stays two entries
// per sheet rather than one per cell per colour. Keyed by the sheet's path
// as well as the colour: both bosses wind up in the same amber, and a
// colour-only key would hand one boss the other's silhouette.
const silhouetteCache = new Map(); // `${path}|${color}` -> offscreen canvas

function drawSpriteTint(ctx, image, spec, sourceX, sourceY, x, y, width, height, color, alpha) {
  if (alpha <= 0) return;
  const key = `${spec.path}|${color}`;
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
  ctx.drawImage(silhouette, sourceX, sourceY, spec.cellWidth, spec.cellHeight,
                x, y, width, height);
  ctx.restore();
}

export function drawResearchGolemHpBar(ctx, boss) {
  drawBossHpBar(ctx, boss, RESEARCH_GOLEM);
}

// Graduation's authored pose sheet (config.js GRADUATION.sprite), drawn
// the same way as the Research Golem's above: anchored to the gameplay
// footprint every frame, pose chosen by bossSpriteFrame from the fight's
// own timers, and the same amber wind-up wash and hit flash over the
// sprite's own pixels. The one difference is the sheet's shared pivot and
// draw scale -- the pivot (centre between the feet, on the foot line)
// lands on the footprint's bottom centre.
export function drawGraduationBoss(ctx, boss) {
  if (!boss.alive) return;
  const image = getImage(GRADUATION.sprite.path);
  if (!image) {
    drawBossBody(ctx, boss, GRADUATION);
    return;
  }

  const spec = GRADUATION.sprite;
  const width = Math.round(spec.cellWidth * spec.scale);
  const height = Math.round(spec.cellHeight * spec.scale);
  const x = Math.round(boss.x + boss.width / 2 - spec.pivotX * spec.scale + spec.offsetX);
  const y = Math.round(boss.y + boss.height - spec.footY * spec.scale + spec.offsetY);
  const frame = bossSpriteFrame(boss, spec);
  const sourceX = (frame % spec.columns) * spec.cellWidth;
  const sourceY = Math.floor(frame / spec.columns) * spec.cellHeight;
  ctx.drawImage(image, sourceX, sourceY, spec.cellWidth, spec.cellHeight, x, y, width, height);

  if (boss.telegraph) {
    const progress = 1 - boss.telegraph.timer / boss.telegraph.duration;
    drawSpriteTint(ctx, image, spec, sourceX, sourceY, x, y, width, height,
                   GRADUATION.telegraphColor, progress * spec.telegraphTintAlpha);
  }
  if (boss.hitFlash > 0) {
    const strength = Math.min(1, boss.hitFlash / GRADUATION.hitFlashDuration);
    drawSpriteTint(ctx, image, spec, sourceX, sourceY, x, y, width, height,
                   DAMAGE_FLASH.enemyColor, strength * spec.hitFlashTintAlpha);
  }
}

export function drawGraduationBossHpBar(ctx, boss) {
  drawBossHpBar(ctx, boss, GRADUATION);
}

export function drawResearchGolemClaims(ctx, boss) {
  if (boss.phase !== 'claim' || !boss.claims) return;

  const claimsTop = boss.claims[0].y;
  const claimsCenterX = boss.x + boss.width / 2;
  // Locked out after a wrong shot (findResearchGolemClaimHit, audit
  // finding A11): the boxes, the text and the evidence marker all
  // disappear -- not just the one that was wrong -- so there is nothing
  // to spray fire at. Positions are kept (boss.claims is untouched) so
  // they reappear exactly where they were the moment the lockout ends.
  const locked = boss.tauntTimer > 0;

  if (!locked) {
    for (const claim of boss.claims) {
      ctx.fillStyle = CLAIM_PHASE.boxFillColor;
      ctx.fillRect(Math.round(claim.x), Math.round(claim.y), claim.width, claim.height);
      ctx.strokeStyle = CLAIM_PHASE.boxBorderColor;
      ctx.lineWidth = CLAIM_PHASE.boxBorderWidth;
      ctx.strokeRect(Math.round(claim.x), Math.round(claim.y), claim.width, claim.height);

      ctx.fillStyle = CLAIM_PHASE.textColor;
      ctx.font = CLAIM_PHASE.textFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(claim.text, Math.round(claim.x + claim.width / 2), Math.round(claim.y + claim.height / 2));

      if (claim.correct) {
        // Floating evidence marker: visually unmistakable which claim is
        // supported (AGENTS.md §4), independent of reading the text.
        const bob = Math.sin(boss.claimClock * CLAIM_PHASE.evidenceBobSpeed) * CLAIM_PHASE.evidenceBobAmplitude;
        const markerX = claim.x - CLAIM_PHASE.evidenceMarkerGapX + bob;
        const markerY = claim.y + claim.height / 2;
        ctx.fillStyle = CLAIM_PHASE.evidenceMarkerColor;
        ctx.beginPath();
        ctx.arc(markerX, markerY, CLAIM_PHASE.evidenceMarkerSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawClaimBanner(ctx, boss.claimQuestion ?? CLAIM_PHASE.promptText, CLAIM_PHASE.questionColor, claimsCenterX, claimsTop);
  }

  // The taunt takes the question's panel while the claims are locked out.
  if (boss.tauntTimer > 0 && boss.lastClaimTaunt) {
    drawClaimBanner(ctx, boss.lastClaimTaunt, CLAIM_PHASE.tauntColor, claimsCenterX, claimsTop);
  }
}

// One line of text on a dark panel directly above the claim column: the
// question, or the taunt after a wrong shot. The panel is what makes it
// readable over the golem's white paper body.
function drawClaimBanner(ctx, text, color, centerX, claimsTop) {
  ctx.font = CLAIM_PHASE.questionFont;
  const width = Math.ceil(ctx.measureText(text).width) + CLAIM_PHASE.questionBoxPaddingX * 2;
  const height = CLAIM_PHASE.questionBoxHeight;
  const x = Math.round(centerX - width / 2);
  const y = Math.round(claimsTop - CLAIM_PHASE.questionGapAboveClaims - height);
  ctx.fillStyle = CLAIM_PHASE.boxFillColor;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = CLAIM_PHASE.boxBorderColor;
  ctx.lineWidth = CLAIM_PHASE.boxBorderWidth;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, Math.round(centerX), Math.round(y + height / 2));
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
