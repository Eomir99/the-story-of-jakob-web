// bosses.js — the Research Golem and Graduation (AGENTS.md §4). No
// generalised multi-boss framework: each boss's state machine (phases,
// telegraph/cycle orchestration) is written out specifically for it, per
// AGENTS.md's instruction not to invent one ahead of need. What's shared
// between the two is only what the spec itself calls for reusing --
// Graduation fires "the same patterns" (literally RESEARCH_GOLEM.patterns)
// and the two bosses' HP bar/body rendering is identical, data-driven
// presentation with no boss-specific decisions in it. The claim phase is
// never touched by Graduation: AGENTS.md is explicit that mechanic is
// Research-Golem-only.

import { RESEARCH_GOLEM, GRADUATION, WORLD, TELEGRAPH, CLAIM_PHASE, PLAYER, PROJECTILE, BOSS_PROJECTILE_LIFETIME } from './config.js';

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
  };
}

// Returns any hostile projectiles fired this step, so game.js can own the
// shared projectile list rather than bosses.js reaching into it.
export function updateResearchGolem(boss, dt) {
  if (!boss.active) return []; // task B: sits idle until the player arrives
  if (boss.hitFlash > 0) boss.hitFlash -= dt;
  if (boss.tauntTimer > 0) boss.tauntTimer -= dt;
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

// Fires one of the shared attack patterns (AGENTS.md §5: projectile type,
// angle, speed, delay, telegraph duration, repeat count, all as data).
// Takes the patterns map and contactDamage explicitly so Graduation can
// fire "the same patterns" (literally RESEARCH_GOLEM.patterns) with its
// own contact damage, without this function knowing which boss called it.
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
// Graduation (AGENTS.md §4, task 3.7): an endurance finish. No new
// mechanics -- the same three patterns as the Research Golem, cycled
// faster and denser, over a shorter fight (lower maxHp). No claim phase:
// that mechanic is Research-Golem-only and is never reused here.
// ---------------------------------------------------------------------

export function createGraduationBoss(x, y, activationX) {
  return {
    x,
    y,
    width: GRADUATION.width,
    height: GRADUATION.height,
    hp: GRADUATION.maxHp,
    alive: true,
    // Dormant until the player reaches activationX (task B) -- same as
    // the Research Golem.
    active: false,
    activationX,
    hitFlash: 0,
    // 'stage1' | 'stage2' | 'dead'.
    stage: 'stage1',
    cycleTimer: GRADUATION.stage1.cycleInterval,
    cycleIndex: 0,
    telegraph: null,
  };
}

export function updateGraduationBoss(boss, dt) {
  if (!boss.active) return []; // task B: sits idle until the player arrives
  if (boss.hitFlash > 0) boss.hitFlash -= dt;
  if (!boss.alive) return [];

  const stageData = GRADUATION[boss.stage];
  if (!stageData) return []; // 'dead'

  if (boss.telegraph) {
    boss.telegraph.timer -= dt;
    if (boss.telegraph.timer <= 0) {
      const patternId = boss.telegraph.patternId;
      boss.telegraph = null;
      boss.cycleTimer = stageData.cycleInterval;
      return fireAttack(boss, patternId, RESEARCH_GOLEM.patterns, GRADUATION.contactDamage);
    }
    return [];
  }

  boss.cycleTimer -= dt;
  if (boss.cycleTimer <= 0) {
    const patternId = stageData.cyclePatterns[boss.cycleIndex % stageData.cyclePatterns.length];
    boss.cycleIndex += 1;
    const pattern = RESEARCH_GOLEM.patterns[patternId];
    boss.telegraph = { patternId, timer: pattern.telegraphDuration, duration: pattern.telegraphDuration };
  }
  return [];
}

export function damageGraduationBoss(boss, amount) {
  if (!boss.active || !boss.alive) return; // task B, same reasoning as the Research Golem's
  boss.hp -= amount;
  boss.hitFlash = GRADUATION.hitFlashDuration;
  if (boss.hp <= 0) {
    boss.hp = 0;
    boss.alive = false;
    boss.stage = 'dead';
    return;
  }
  if (boss.stage === 'stage1' && boss.hp <= GRADUATION.maxHp * GRADUATION.stage2Threshold) {
    boss.stage = 'stage2';
  }
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
  const shotOffset = PLAYER.height / 2 - PROJECTILE.height / 2;
  const bottom = WORLD.groundY - PLAYER.height + shotOffset; // standing
  const top = WORLD.groundY - PLAYER.height - apexHeight + shotOffset; // jump apex
  return { top, bottom };
}

function buildClaims(boss, setIndex) {
  // Shuffled so which slot (top/middle/bottom, easiest to hardest timing)
  // holds the correct claim isn't fixed -- otherwise "always jump to the
  // top one" would beat the phase without reading anything.
  const set = shuffled(CLAIM_PHASE.sets[setIndex % CLAIM_PHASE.sets.length]);
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
export function findResearchGolemClaimHit(boss, projectile) {
  if (boss.phase !== 'claim' || !boss.claims) return null;
  return boss.claims.find((claim) => aabbOverlap(projectile, claim)) || null;
}

// Resolves a claim shot: correct breaks the shield and resumes the fight in
// phase B (faster, per AGENTS.md §4); wrong heals the boss slightly and
// taunts, but never undoes meaningful progress -- the player can keep
// trying the remaining claims.
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
    boss.tauntTimer = 1.5;
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
  if (boss.hitFlash > 0) {
    color = '#ffffff';
  } else if (boss.telegraph) {
    // Visible tell: the boss glows toward telegraphColor as the wind-up
    // nears completion, so an attack is never a surprise (AGENTS.md §4).
    const progress = 1 - boss.telegraph.timer / boss.telegraph.duration;
    color = lerpColor(spec.color, spec.telegraphColor, progress);
  }
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(boss.x), Math.round(boss.y), boss.width, boss.height);
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

export function drawResearchGolem(ctx, boss) {
  drawBossBody(ctx, boss, RESEARCH_GOLEM);
}

export function drawResearchGolemHpBar(ctx, boss) {
  drawBossHpBar(ctx, boss, RESEARCH_GOLEM);
}

export function drawGraduationBoss(ctx, boss) {
  drawBossBody(ctx, boss, GRADUATION);
}

export function drawGraduationBossHpBar(ctx, boss) {
  drawBossHpBar(ctx, boss, GRADUATION);
}

export function drawResearchGolemClaims(ctx, boss) {
  if (boss.phase !== 'claim' || !boss.claims) return;

  for (const claim of boss.claims) {
    ctx.fillStyle = '#1b2333';
    ctx.fillRect(Math.round(claim.x), Math.round(claim.y), claim.width, claim.height);
    ctx.strokeStyle = '#f7f3e3';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(claim.x), Math.round(claim.y), claim.width, claim.height);

    ctx.fillStyle = '#f7f3e3';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(claim.text, Math.round(claim.x + claim.width / 2), Math.round(claim.y + claim.height / 2));

    if (claim.correct) {
      // Floating evidence marker: visually unmistakable which claim is
      // supported (AGENTS.md §4), independent of reading the text. Sits to
      // the side, not above -- claims stack tightly, so "above" could land
      // inside the claim stacked on top of this one.
      const bob = Math.sin(boss.claimClock * CLAIM_PHASE.evidenceBobSpeed) * CLAIM_PHASE.evidenceBobAmplitude;
      const markerX = claim.x - 22 + bob;
      const markerY = claim.y + claim.height / 2;
      ctx.fillStyle = CLAIM_PHASE.evidenceMarkerColor;
      ctx.beginPath();
      ctx.arc(markerX, markerY, CLAIM_PHASE.evidenceMarkerSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const claimsTop = boss.claims[0].y;
  const claimsCenterX = boss.x + boss.width / 2;

  ctx.fillStyle = '#f7f3e3';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(CLAIM_PHASE.promptText, Math.round(claimsCenterX), Math.round(claimsTop - CLAIM_PHASE.promptGapAboveClaims));

  if (boss.tauntTimer > 0 && boss.lastClaimTaunt) {
    ctx.fillStyle = '#f0806f';
    ctx.fillText(boss.lastClaimTaunt, Math.round(claimsCenterX), Math.round(claimsTop - CLAIM_PHASE.tauntGapAboveClaims));
  }
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
