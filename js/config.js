// config.js — every tunable gameplay value lives here (AGENTS.md §5).
// If a number affects how the game plays and it is not in this file,
// that is a bug.

export const CANVAS = {
  width: 1280,
  height: 720,
};

// Not a gameplay value -- application.html (a separate static page) reads
// this directly to show/hide its "DRAFT -- NOT FOR SEND" band. It lives
// here anyway on explicit direction (project chat, PLAN.md task 4.5): one
// flag, one obvious place, same as every other tunable in this file.
// Stays true until task 8.2's final content pass flips it.
export const DRAFT_COPY = true;

export const TIMESTEP = {
  hz: 60, // fixed simulation rate
  maxFrameDelta: 0.25, // seconds; clamps huge gaps (e.g. tab was backgrounded)
};

export const WORLD = {
  gravity: 2200, // px/s^2
  // Temporary flat ground for grey-box testing. Real terrain variation is
  // future art/level work; the ground itself stays one continuous surface.
  groundY: 620,

  // How far below groundY the ground is actually filled in. This is not
  // cosmetic detail: the camera's vertical dead zone settles about 158px
  // down, and the utspring pull-back widens the view further, so a ground
  // slab only as deep as the canvas (100px) left roughly a fifth of every
  // frame showing the sky gradient BELOW the floor, for the entire game.
  // 600 covers the resting camera, the widened view and the screen shake
  // together, with room to spare -- and a taller fill costs nothing.
  groundDepth: 600,
  groundColor: '#1b2333',

  // The shared outdoor ground art (cobblestone road over dirt). It is the
  // VISUAL only: groundY above is still the collision surface and nothing
  // about it moved to fit the art -- the art was anchored to it instead.
  //
  // Drawn 1:1 at its native size and repeated horizontally from world x 0
  // (game.js drawGround), never stretched across the level: no runtime
  // scaling means no resampling and no soft pixels. The image's own top
  // row IS the top of the cobblestones, so its top edge sits exactly on
  // groundY and the player stands on the stones.
  //
  // groundColor stays as the base fill drawn beneath the tiles, for the
  // frames before the asset has loaded and for anything deeper than
  // tileHeight.
  groundTexture: {
    path: 'assets/backgrounds/world-ground-v2.webp',
    tileWidth: 1561,
    tileHeight: 415,
  },
  // The Research Golem arena's own floor. Same rules as groundTexture;
  // game.js drawGround swaps to it only while researchGolemInterior().
  arenaGroundTexture: {
    path: 'assets/backgrounds/arena1-ground.webp',
    tileWidth: 1962,
    tileHeight: 415,
  },
  // The Graduation arena's floor: the floating stone ledge the arena art
  // stands on (art-source/backgrounds/ground-boss-2-v2.png). Same rules again,
  // swapped in only while graduationInterior() (game.js drawGround), with
  // two differences: its tiling starts at the arena art's own left edge
  // instead of world x 0, and the tile is wider than the arena frame, so
  // exactly one piece of ledge is ever on screen -- no visible repeat.
  // fillColor replaces groundColor underneath it: the ledge floats in the
  // sky, so what shows through its ragged bottom edge is cloud haze (the
  // gu-ceremony gradient's bottom colour), not the dark earth slab.
  // The Clinic's floor: polished tiles over rocky earth
  // (clinic-ground-v2.png). Same rules as groundTexture, but drawn only
  // across the Clinic section's own x range (level.js background-section
  // `ground`), tiled from its start.
  clinicGroundTexture: {
    path: 'assets/backgrounds/clinic-ground.webp',
    tileWidth: 1742,
    tileHeight: 363,
  },
  graduationGroundTexture: {
    path: 'assets/backgrounds/graduation-ground.webp',
    tileWidth: 1980,
    tileHeight: 387,
    // px of the tile drawn above groundY. The tile starts at the tops of
    // the capstones, but the flat ledge the player walks on is 6px lower;
    // drawn level with groundY, the ledge between the capstones read as a
    // step down below everyone's feet. Raised by 6, the ledge IS the
    // floor line and only the capstones stand above it.
    raise: 6,
    // px below groundY the arena camera shows (level.js
    // GRADUATION_ARENA_FRAME). The balustrade's stone is solid to ~252px
    // below the tile's top edge -- ~246px below groundY once raised --
    // and below that is its ragged bottom edge and empty sky, which must
    // stay out of shot. Larger zooms the camera out, smaller zooms it in.
    visibleDepth: 244,
    fillColor: '#c9d3f0',
  },
};

// Background sections (PLAN.md task 6.8, brought forward). One continuous
// level, no loading break (AGENTS.md §3) -- only the scenery changes, and
// it changes because a player cannot judge distance against unchanging
// scenery. Changing scenery is what communicates progress.
//
// WHERE each section starts and ends is level layout, so it lives in
// level.js. WHAT it looks like is a tunable, so it lives here. Adding a
// section means one entry in each: a range there, a look here.
//
// Every look is a stack of exactly three layers, far to near, each with
// its own parallax factors and its own source. Explicit depth names control
// draw order independently of parallax; background strips stay continuous behind terrain.
// `parallax` applies to both
// axes; `parallaxX`/`parallaxY` override either axis independently.
//
//   { type: 'color',      color }             flat field
//   { type: 'gradient',   from, to }          vertical, sky-top to ground
//   { type: 'silhouette', color, tileWidth, heights }
//   { type: 'image', path, tileWidth, baselineY, color }
//
// A silhouette is one strip of bars standing on the ground line, repeated
// across the whole section -- `heights` are pixel heights spread evenly
// across `tileWidth`, and a 0 is a gap. Everything TILES horizontally:
// there are no oversized images now and there must be none later, so a
// section of any length costs the same.
//
// These are placeholders, deliberately flat and obvious. When the real
// artwork arrives it drops in as image source data, with the tiling,
// vertical placement and parallax already handled.
export const BACKGROUND = {
  // px, centred on each boundary: the band over which the outgoing
  // section fades into the incoming one. A hard cut mid-run is jarring.
  blendBandWidth: 400,
};

// Standard parallax trio. Per-layer values below so any one section can
// deviate, but keeping them equal is what makes the level feel coherent.
const FAR = 0.15;
const MID = 0.35;
const NEAR = 0.6;

export const BACKGROUNDS = {
  // 1 -- Lund, the town. The sky remains an opaque full-view base for
  // section crossfades; the approved strips are authored full-colour PNGs.
  'lund-town': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#161d2b' } },
      { depth: 'far', parallaxX: FAR, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/lund-town-far.webp', tileWidth: 1774, displayHeight: 887, baselineY: 887, colorMode: 'full-color' } },
      { depth: 'mid', parallaxX: MID, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/lund-town-mid.webp', tileWidth: 1774, displayHeight: 887, baselineY: 781, colorMode: 'full-color' } },
    ],
  },

  // 2 -- Polhem, the school. It shares Lund's far strip and swaps in the
  // approved school-specific mid strip.
  'polhem-school': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#2a2029' } },
      { depth: 'far', parallaxX: FAR, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/lund-town-far.webp', tileWidth: 1774, displayHeight: 887, baselineY: 887, colorMode: 'full-color' } },
      { depth: 'mid', parallaxX: MID, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/polhem-school-mid.webp', tileWidth: 1774, displayHeight: 887, baselineY: 733, colorMode: 'full-color' } },
    ],
  },

  // 3 -- Utspring: back to Lund town's own far and mid strips. The school
  // is no longer a repeating mid strip -- Polhemskolan and the staircase
  // are placed world-plane landmarks in front of these (LANDMARK.types
  // 'utspring-polhem' / 'utspring-staircase', level.js), so the town reads
  // as the distance behind the school and the stair takes over the frame.
  'lund-utspring': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#24304a' } },
      { depth: 'far', parallaxX: FAR, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/lund-town-far.webp', tileWidth: 1774, displayHeight: 887, baselineY: 887, colorMode: 'full-color' } },
      { depth: 'mid', parallaxX: MID, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/lund-town-mid.webp', tileWidth: 1774, displayHeight: 887, baselineY: 781, colorMode: 'full-color' } },
    ],
  },

  // 4 -- Göteborg. Approved far/mid strips (BACKGROUND-ASSET-SPEC.md); no
  // near layer -- the placeholder silhouette read as stray flat rectangles
  // against the new full-colour art and was removed rather than kept as a
  // mismatched filler.
  //
  // Background-transition repair: both strips' source art was cropped to
  // its own content bounds (scripts/runtime-assets.py), shrinking tileWidth
  // from 1774 to 1720 (far) / 1728 (mid) -- they carried far more
  // transparent edge padding than the spec's 96px minimum actually needs.
  // That alone only shrinks the gap at a mirror seam; it does not stop one
  // happening, because far and mid still tile at nearly the same period and
  // both originate at world x 0, so their seams (and thus both layers'
  // transparent edges) kept landing at the same world x -- a seam in mid was
  // never covered by far, because far had a seam of its own at that exact
  // spot. `tileOffset` (game.js drawImageTile) shifts far's tiling phase by
  // half its own tileWidth, so its seams fall in the middle of mid's tiles
  // instead: whichever layer is at a seam, the other is showing solid
  // artwork over it.
  'goteborg-city': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#131c2e' } },
      { depth: 'far', parallaxX: FAR, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/goteborg-city-far.webp', tileWidth: 1720, tileOffset: 860, displayHeight: 887, baselineY: 734, colorMode: 'full-color' } },
      { depth: 'mid', parallaxX: MID, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/goteborg-city-mid.webp', tileWidth: 1728, displayHeight: 887, baselineY: 741, colorMode: 'full-color' } },
    ],
  },

  // 5 -- Handels, the Research Golem arena. An interior, so the far layer
  // is a flat wall and NOT a sky gradient -- that alone reads as "indoors"
  // after four outdoor sections.
  //
  // This flat colour is only ever a fallback now: the actual enclosed hall
  // (chandeliers, twin staircases, bookshelves, a globe at its centre) is
  // the boss-specific `research-golem-arena` landmark below, placed once as
  // a single non-tiled image (level.js) rather than a repeating strip --
  // AGENTS.md §6, BACKGROUND-ASSET-SPEC.md's scope exception. This colour
  // is sampled from that art's own shaded stonework, so any sliver not
  // covered by the landmark (its transparent top margin, or the moment
  // before it has scrolled into view) still reads as the same room instead
  // of a mismatched placeholder tone.
  'handels-interior': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#2a2733' } },
    ],
  },

  // 5b -- Haga, the short post-Research-Golem Göteborg exterior (NEW LEVEL
  // FLOW). Reuses the approved Göteborg far strip -- it is still Göteborg,
  // just a different street -- with the approved `goteborg-haga-mid.png`
  // strip (BACKGROUND-ASSET-SPEC.md). Its decorative "HAGA" banners are an
  // explicit, approved exception to the no-text-in-strips rule -- see that
  // spec's Haga entry.
  'goteborg-haga': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#131c2e' } },
      // Same source as goteborg-city's far layer above -- tileWidth/tileOffset
      // must match it or this section would stretch the now-cropped art back
      // toward its old, wider box.
      { depth: 'far', parallaxX: FAR, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/goteborg-city-far.webp', tileWidth: 1720, tileOffset: 860, displayHeight: 887, baselineY: 734, colorMode: 'full-color' } },
      { depth: 'mid', parallaxX: MID, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/goteborg-haga-mid.webp', tileWidth: 1774, displayHeight: 887, baselineY: 676, colorMode: 'full-color' } },
    ],
  },

  // 8b -- Haga again: the short lead-in to the Graduation portal. The same
  // two strips as 'goteborg-haga' above, with one difference: the mid
  // strip opens on an unmirrored tile at the section's own start
  // (openingPath, the USA mechanism in game.js drawImageTile). Ordinary
  // repeats alternate mirrored/unmirrored by world position, and the tile
  // behind the portal reveal happened to be a mirrored one -- the HAGA
  // bunting read "AGAH". Anchoring to the section keeps it readable
  // wherever the section is moved to.
  'goteborg-haga-portal': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#131c2e' } },
      { depth: 'far', parallaxX: FAR, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/goteborg-city-far.webp', tileWidth: 1720, tileOffset: 860, displayHeight: 887, baselineY: 734, colorMode: 'full-color' } },
      { depth: 'mid', parallaxX: MID, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/goteborg-haga-mid.webp', openingPath: 'assets/backgrounds/goteborg-haga-mid.webp', tileWidth: 1774, displayHeight: 887, baselineY: 676, colorMode: 'full-color' } },
    ],
  },

  // 6 -- the clinic reception: the hospital interior strip
  // (clinic-background-v2.png, cropped to its content columns so repeats
  // abut: 1632x948) over a soft sky colour taken from its own windows.
  // Drawn 5% larger than its source (1713x995) so that in the reception's
  // zoomed-out shot one copy spans the whole 1700px arena and the side
  // wings reach the top of the screen. baselineY is its floor edge (source
  // row 888, scaled: 932) less 7px, which tucks the art's dark bottom
  // outline behind the floor tiles -- left showing, it doubled up with the
  // tiles' own top edge into a thick dark seam. tileOffset centres one copy on that shot: it is
  // (layer-space arena centre - tileWidth / 2) mod tileWidth, where the
  // layer-space centre is arenaCentre - (arenaCentre - 640) * (1 - MID);
  // recompute it if the Clinic moves.
  'clinic-reception': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#9db7cc' } },
      { depth: 'mid', parallaxX: MID, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/clinic-mid.webp', tileWidth: 1713, tileOffset: 489, displayHeight: 995, baselineY: 925, colorMode: 'full-color' } },
    ],
  },

  // 7 -- USA, the exchange semester. Approved far/mid strips; the
  // placeholder gradient and stadium-bowl silhouette are gone, for the
  // same reason Göteborg's were -- flat rectangles read as debris next to
  // full-colour art.
  //
  // The mid layer is the one place in the level that opens on a different
  // strip from the one it repeats: `usa-mid-columbia` plays ONCE as the
  // section's establishing shot, then `usa-mid-campus` repeats for the
  // rest of it (openingPath, game.js drawImageTile). Author's call, and it
  // is what makes arriving in the USA read as arriving somewhere specific
  // before settling into ordinary campus scenery.
  //
  // The far river/skyline strip has no opening tile: it repeats across the
  // whole section, behind both mid strips.
  'usa-stadium': {
    layers: [
      { parallax: FAR, source: { type: 'color', color: '#5b8fc9' } },
      { depth: 'far', parallaxX: FAR, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/usa-far.webp', tileWidth: 1774, displayHeight: 887, baselineY: 727, colorMode: 'full-color' } },
      { depth: 'mid', parallaxX: MID, parallaxY: 1, source: { type: 'image', path: 'assets/backgrounds/usa-mid-campus.webp', openingPath: 'assets/backgrounds/usa-mid-columbia.webp', tileWidth: 1774, displayHeight: 887, baselineY: 734, openingBaselineY: 709, colorMode: 'full-color' } },
    ],
  },

  // 8 -- GU, the Graduation arena. Like Handels, only a fallback now: the
  // arena itself is the boss-specific `graduation-arena` landmark below
  // (AGENTS.md §6). The gradient runs from the art's own sky blue at the
  // top to the cloud haze under its floating floor, so screen-shake bleed
  // above the art and the sky under the ledge both read as the same place.
  'gu-ceremony': {
    layers: [
      { parallax: FAR, source: { type: 'gradient', from: '#2d6dd1', to: '#c9d3f0' } },
    ],
  },
};

// Landmarks: one-off background objects placed at a single x rather than
// tiled, each scrolling at its own parallax rate (set per placement in
// level.js, since how far away a thing reads is a layout decision).
// Types without a path keep their labelled placeholder until their art pass.
export const LANDMARK = {
  // Placeholder landmarks stay subdued so their solid rectangles read as
  // scenery. Approved image types can override this at full authored opacity.
  alpha: 0.5,
  labelFont: '13px sans-serif',
  labelColor: '#f7f3e3',
  labelGap: 8, // px between the label's baseline and the box top
  // s a showAfterUtspring landmark (level.js) takes to fade in once the
  // studentmössa celebration is over.
  afterUtspringFadeIn: 0.8,
  types: {
    // AGENTS.md §3: "a UF (Junior Achievement Sweden) reference in the
    // background". Never abbreviated on first appearance.
    // v3: the row of UF stalls with Candell UF's awards screen
    // (uf-stand-v3.png), flat-bottomed. Delivered 1:1
    // (scripts/runtime-assets.py). baselineY puts the left stalls' bottom
    // edge -- the highest of the stands' bottoms -- exactly on the floor;
    // the Candell stall and its chalkboard reach 3-8px lower and tuck
    // behind the ground, so every part sits flush.
    'uf-stand': { path: 'assets/backgrounds/uf-stand.webp', colorMode: 'full-color', width: 1100, height: 330, baselineY: 321, alpha: 1 },

    // The utspring scenery (author art, delivered 1:1 at these boxes by
    // scripts/runtime-assets.py). The staircase's baselineY is its bottom
    // landing's tread, so that landing is flush with the floor and the
    // plinth under it is hidden behind the ground; level.js measures the
    // climb and the descent off this same art. Polhemskolan stands behind
    // it with its trees and lampposts on the floor line.
    'utspring-staircase': { path: 'assets/backgrounds/utspring-staircase.webp', colorMode: 'full-color', width: 1599, height: 507, baselineY: 410, alpha: 1 },
    'utspring-polhem': { path: 'assets/backgrounds/utspring-polhem.webp', colorMode: 'full-color', width: 1672, height: 350, baselineY: 346, alpha: 1 },

    // World props: road signs and the airport departures board (author
    // art). Signs stand on the ground: baselineY is the delivered image's
    // bottom row. Delivered at 2x these boxes (scripts/runtime-assets.py).
    'sign-lund-arrow': { path: 'assets/backgrounds/sign-lund-arrow.webp', colorMode: 'full-color', width: 153, height: 200, baselineY: 400, alpha: 1 },
    'sign-welcome-lund': { path: 'assets/backgrounds/sign-welcome-lund.webp', colorMode: 'full-color', width: 126, height: 240, baselineY: 480, alpha: 1 },
    'sign-gothenburg-arrow': { path: 'assets/backgrounds/sign-gothenburg-arrow.webp', colorMode: 'full-color', width: 172, height: 200, baselineY: 400, alpha: 1 },
    // The departures board HANGS from above the screen instead: baselineY
    // is far below the image (in delivered pixels, 2 per world px), which
    // puts its top 502 world px above the floor line (world y 118). The
    // camera normally rests with the top of the screen near world y 158
    // (CAMERA.deadzoneHeight around a standing player), so the rods run up
    // out of shot -- even at the top of a jump -- and the board hangs
    // above the player's head.
    'departures-board': { path: 'assets/backgrounds/departures-board.webp', colorMode: 'full-color', width: 520, height: 325, baselineY: 1004, alpha: 1 },

    // Boss-specific world-space environment scenery (AGENTS.md §6,
    // BACKGROUND-ASSET-SPEC.md's scope exception): one-off placed images,
    // not reusable strips, drawn at their native pixel size (width/height
    // match the delivered webp exactly, so baselineY needs no rescale --
    // drawLandmarks' footOffset = baselineY * height / image.height = 1).
    // Placed at ground level (parallax: 1 in level.js) like every other
    // landmark here -- they simply happen to be much wider.
    //
    // v2 art (repair task): both assets paint their own doors directly
    // into the artwork, so no separate door prop is drawn on top.
    // Visibility among these is no longer z-order masking -- game.js's
    // drawLandmarks explicitly skips the façade while the player is inside
    // the Research Golem venue and skips the arena while they are outside
    // it (researchGolemInterior()), so they can never both be on screen
    // regardless of where their bounding boxes fall.
    //
    // Door-role repair task: the façade source has two doors -- a LARGE
    // DOUBLE DOOR (local x ~585 on the shared source) that is the actual
    // pre-boss entrance, and a SMALL SIDE DOOR (local x 1793) that is the
    // post-boss exit, never the entrance. The single full façade image used
    // to be placed twice and wrongly aligned both placements on the small
    // door. It is now two fixed crops of the same unedited source
    // (art-source/backgrounds/boss-arena-facad-v2.png, preserved unchanged;
    // scripts/runtime-assets.py FACADE_CROPS documents the exact boxes),
    // chosen from the actual in-game camera framing (config.js
    // BOSS_APPROACH, level.js RESEARCH_GOLEM_REVEAL_CAMERA_X) rather than
    // proportional guesses -- each crop only needs to cover what its own
    // moment ever shows on screen:
    //
    // research-golem-facade-entrance: source crop x[0, 1100], the whole
    // pre-boss approach/reveal/walk ever shows up to local x~980 (the
    // reveal camera's right edge sits BOSS_APPROACH.revealDoorMarginRight
    // before the door, and the camera holds there through the walk --
    // level.js RESEARCH_GOLEM_REVEAL_CAMERA_X). Contains the large double
    // door at local x 585.
    'research-golem-facade-entrance': { path: 'assets/backgrounds/research-golem-facade-entrance.webp', colorMode: 'full-color', width: 1100, height: 774, baselineY: 748, alpha: 1 },
    // research-golem-facade-exit: source crop x[1050, 2033] (the source's
    // own right edge), covering the small side door (source-local 1793,
    // crop-local 743) plus the room either side of it a normal
    // deadzone-follow camera shows the instant the player reappears there
    // after the boss (level.js FACADE_EXIT_X == SECTION_HAGA_X). Never
    // needs the main entrance or the far side of the building.
    'research-golem-facade-exit': { path: 'assets/backgrounds/research-golem-facade-exit.webp', colorMode: 'full-color', width: 983, height: 774, baselineY: 748, alpha: 1 },
    // research-golem-arena: the single enclosed interior hall for the whole
    // Research Golem encounter -- small entrance door, centre stage (globe
    // pedestal, where the boss stands), and small exit door, all in one
    // image (level.js positions BOSS_X/SUIT_X/GOLEM_EXIT_X against it).
    // Left door local x 165, centre (pedestal) 1086, right door 1980, of
    // 2172.
    //
    // Ground-alignment repair task: baselineY is a hand-measured row on the
    // source image, not derived from its alpha channel, and both this and
    // the façade entries above were measured a few pixels short of the art's
    // own visible floor line -- alpha content here actually runs solid
    // through row ~631 before the antialiased edge fades out, ~13px past
    // the old baselineY: 645, which floated the floor that far above
    // WORLD.groundY. Re-measured against the delivered webp itself (a
    // per-row alpha-solidity scan, not the padding trim baselineY already
    // exists to describe) rather than adjusted by feel.
    //
    // Arena-floor task: the art paints its own flat floor band (rows
    // 605-633 in the v3 art, including its dark top edge) under the
    // stairs, which read as a second floor above the arena1-ground tiles.
    // baselineY sits at the band's top row instead of its bottom, so the
    // band is hidden behind the ground (drawGround paints after
    // drawLandmarks). WORLD.groundY -- the collision surface -- is
    // unchanged. v3 art (boss-1-arena-v3.png): same size and door/pedestal
    // positions as v2, sharper detail.
    'research-golem-arena': { path: 'assets/backgrounds/research-golem-arena.webp', colorMode: 'full-color', width: 2172, height: 724, baselineY: 605, alpha: 1 },

    // The Graduation entrance (boss-portal.png): the portal the player
    // walks into at the end of the short Haga lead-in. Delivered at exactly
    // this box (scripts/runtime-assets.py), so it draws 1:1. baselineY is
    // the bottom row of its stone base. Its opening is centred at local
    // x 220 (level.js PORTAL_OPENING_LOCAL_X). Sized so the whole portal
    // fits under the top of the frame with the camera at its resting height.
    'graduation-portal': { path: 'assets/backgrounds/graduation-portal.webp', colorMode: 'full-color', width: 440, height: 402, baselineY: 374, alpha: 1 },
    // The Graduation arena (boss-2-arena-v1.png), native size. It paints
    // its own floor ledge from row ~727 down, hidden behind the separate
    // graduation ground (WORLD.graduationGroundTexture), which drawGround
    // paints afterwards on WORLD.groundY -- the same trick as the Research
    // Golem arena. baselineY sits 12px ABOVE that ledge, so the art is drawn
    // 12px lower and the ground overlaps it a little: at 726 the ledge's
    // dark edge and bright top face showed as a line through the gaps
    // between the balustrade's capstones.
    // Portal opening at local x 318 (level.js GRADUATION_ARENA_PORTAL_LOCAL_X).
    'graduation-arena': { path: 'assets/backgrounds/graduation-arena.webp', colorMode: 'full-color', width: 1831, height: 859, baselineY: 714, alpha: 1 },
  },
};

// Development pacing overlay (PLAN.md task 6.8). Turns pacing from a
// feeling into a number that can be checked against the target section
// durations. A development tool, not UI -- it is not styled, and with
// `overlay` false nothing about it reaches the screen.
//
// MUST stay false in anything sent to anyone.
export const DEBUG = {
  overlay: false,
  font: '14px monospace',
  color: '#8fe3a0',
  backgroundColor: 'rgba(13, 17, 23, 0.72)',
  width: 300,
  lineHeight: 18,
  paddingX: 10,
  paddingY: 8,
  marginX: 24,
  marginY: 24, // from the BOTTOM edge -- the HP pips own the top-left
};

export const PLAYER = {
  width: 48,
  height: 64,
  // px above the feet that a shot's centre leaves at: the extended fist in
  // the shooting poses (sprite sheet rows ~57-70 of 128, feet at row 120).
  // bosses.js's claim-phase band and the enemies' shotHitboxTop follow it.
  shotHeight: 57,
  color: '#f6c453',
  // A rim around the player, for the same reason the enemies have one
  // (HAZARD): eight background sections at wildly different brightnesses,
  // and no single fill colour reads against all of them. Wearing the
  // suit, the player was #3d4a63 -- within three hex digits of the
  // platforms (#3a4a63), and near enough to the USA stadium silhouette
  // (#3f5d78) and the stadium landmark (#2f4a63) to disappear into both.
  //
  // The rim means "this is a gameplay object", and the enemies, the
  // bosses and every projectile carry one too. What separates friend from
  // hazard is the FILL: warm orange-red is only ever something that hurts
  // you, and the player is never warm orange-red.
  outlineColor: '#141b26',
  outlineWidth: 3, // px

  // The invulnerability blink, after taking a hit. Alpha was 0.35, which
  // on the pale clinic and bright USA sections made the player almost
  // invisible for 1.2 s starting from the exact moment they most needed
  // to find themselves. Rate is blinks per second.
  invulnerableBlinkAlpha: 0.55,
  invulnerableBlinkRate: 12,
  moveSpeed: 360, // px/s
  jumpVelocity: -820, // px/s, negative is up
  maxFallSpeed: 1400, // px/s
  maxHp: 3,
  invulnerabilityDuration: 1.2, // s, after taking damage
  respawnDelay: 0.4, // s before control returns after death

  // Authored player sprite timing. All three animated appearances share
  // the same cell indices, including the six-frame run cycle: each outfit
  // has its own authored run sheet, so there is no longer a base-only
  // cadence. Armour stays static because it is collected immediately
  // before the final comic.
  animation: {
    runFrameDuration: 0.1, // s per frame
    // Cells 2-5 on the sheet's first row, then 10-11 on its third.
    runFrames: [2, 3, 4, 5, 10, 11],
    shootFrameDuration: 0.08, // s per frame
    // Run-and-gun: a second six-frame run cycle, firing arm extended,
    // used instead of the standing shot when the player fires while
    // actually running along the ground. Cells 12-17, the row left over
    // on the sheet plus a fourth one.
    //
    // It deliberately has no duration of its own: it is stepped by
    // runFrameDuration, from the same animationTime, so switching between
    // the two cycles keeps the legs on the same beat instead of
    // restarting the stride every time the fire key goes down.
    //
    // Every animated outfit carries these cells: each one is delivered as
    // a complete eighteen-pose sheet.
    runGunFrames: [12, 13, 14, 15, 16, 17],
  },

  // Coyote time: how long after walking off a ledge a jump still works.
  // Without it a jump pressed a frame or two late simply does nothing and
  // reads as the game cheating -- the single most common reason a
  // non-gamer decides a platformer is "broken". It cannot make a jump
  // land that would not otherwise have landed: the jump starts from the
  // same height with the same arc, it is only the input deadline that
  // moves.
  coyoteTime: 0.1, // s

  // Jump buffering: a jump pressed slightly BEFORE landing is remembered
  // for this long and fires the moment the ground is under the player
  // again, instead of being thrown away. The mirror image of coyote time
  // -- together they cover both halves of "I pressed it and nothing
  // happened". Someone who is nervous about a jump presses early; that
  // must not be punished.
  jumpBufferTime: 0.12, // s

  // Variable jump height. Releasing jump while still rising clamps the
  // remaining upward speed to jumpVelocity * this, so a tap is a small
  // hop and a held key is exactly the jump it always was. This is
  // control, not difficulty: the maximum jump is unchanged, the player
  // simply gains a smaller one for fine adjustments. A clamp rather than
  // a per-frame multiply, so holding the key released for longer cannot
  // keep shaving the arc down.
  jumpCutMultiplier: 0.45,

  // Landing squash. Purely visual: the sprite compresses vertically and
  // spreads horizontally for a moment on touchdown, then eases back.
  // Nothing about the hitbox, the collision or the physics changes -- it
  // only sells the weight of the landing, which a static rectangle
  // otherwise has none of.
  landSquash: {
    duration: 0.12, // s to ease back to normal
    scaleY: 0.72, // vertical scale at the instant of impact
    scaleX: 1.14, // horizontal spread at the instant of impact
    // px/s of downward speed below which a landing is too gentle to be
    // worth showing -- stepping off a 24px platform should not thump.
    minImpactSpeed: 320,
  },
};

// Player HUD (AGENTS.md §5: canvas renders gameplay; the player's health
// is gameplay state, not narrative UI, so it belongs here and not in the
// Milestone 4 DOM layer). Drawn in screen space, so the camera's zoom and
// pan never move it. Bosses have their own bar (§4); this is the player's.
export const HUD = {
  hpPipSize: 18, // px, one square per hit point
  hpPipGap: 8,
  marginX: 24,
  marginY: 24,
  filledColor: '#c9574b',
  emptyColor: '#2a3346',
  borderColor: '#0d1117',
};

// The hostile look. One rule, applied to everything that can take a hit
// point off the player: enemies, bosses and every projectile they fire.
//
// The problem it solves is that this level runs through eight background
// sections whose brightness is nowhere near constant -- dark navy in
// Lund, gold columns in Handels, pale teal in the clinic, open blue sky
// in USA. A single flat colour cannot read against all of them, and the
// palette had collisions in both directions: the maths book's shot was
// exactly the UF stand's gold, and the Research Golem's ground shot
// disappeared into the Handels columns it flew across.
//
// A bright warm fill inside a near-black rim reads against all of them.
// The rim carries it on the bright sections, the fill carries it on the
// dark ones, and warm orange-red appears nowhere in the scenery, which
// is deliberately cool or muted everywhere.
//
// Wind-up tells stay gold (each entity's telegraphColor) and are NOT
// part of this. Gold means "about to happen", hazard orange-red means
// "this hurts you now" -- two different things a player has to tell
// apart at a glance.
export const HAZARD = {
  outlineColor: '#170907',
  projectileOutlineWidth: 3, // px
  bodyOutlineWidth: 3, // px, enemy and boss bodies
};

// The player's own shots. Everything here except the trail is deliberately
// the opposite of HAZARD's look, because in a crowded moment the one
// question that has to answer itself instantly is "is that mine or is
// that coming at me":
//
//   hostile   warm orange-red, chunky, slow, thick near-black rim
//   player's  cool white, thin, fast, thin cool rim, and a trail
//
// Cool against warm survives every background section in the level, and
// the trail only ever appears on the player's shots -- nothing hostile
// moves fast enough to have one.
//
// width/height are the hitbox as well as the look, so they are unchanged:
// the shot is no easier or harder to land than it was.
export const PROJECTILE = {
  width: 14,
  height: 6,
  color: '#eaf7ff', // cool white, against the hazard palette's warm orange-red
  outlineColor: '#12202e',
  outlineWidth: 2, // px
  trailLength: 26, // px of streak behind the shot -- drawn only, never collides
  trailAlpha: 0.4,
  speed: 900, // px/s
  lifetime: 1.1, // s before expiring
  fireCooldown: 0.28, // s between shots while held
};

// Boss projectile lifetime (task B) -- was hardcoded to 4s directly in
// bosses.js, which at up to 420px/s let a shot travel over 1600px: most of
// a level section. This is a shared backstop lifetime for every boss
// pattern; PROJECTILE_CULL_MARGIN below is the primary defense (it removes
// a projectile as soon as it leaves the visible area, regardless of
// remaining life), but nothing should rely on the camera check alone --
// every projectile still needs its own hard cap.
export const BOSS_PROJECTILE_LIFETIME = 3; // s

// Projectile culling (task B): a correctness fix independent of boss
// dormancy below -- nothing should ever survive long enough to travel a
// whole section of the level. Checked every step against the camera's
// current position, on top of each projectile's own lifetime above.
export const PROJECTILE_CULL_MARGIN = 200; // px outside the camera's view before removal

// Hitstop: the whole simulation stops dead for a few frames the instant
// a player shot does damage. It is the cheapest and largest single
// improvement to how shooting feels -- without it a hit is a number
// changing somewhere, with it the shot lands. Deliberately measured in
// frames, not in a "feel" fraction: at 60 Hz, 0.05 s is three frames.
//
// Keep these small. Long enough to notice is already too long: past
// about 0.12 s it stops reading as impact and starts reading as the game
// stuttering, which is the opposite of the intended impression.
// Damage flash. Both halves of "something just got hit": the thing that
// was hit, and the player when it is them. Per-entity durations stay on
// the entities (their own hitFlashDuration); what they flash TO lives
// here so the whole game speaks with one voice.
//
// The flash is blended by how much of the duration is left rather than
// replacing the colour outright for the whole window. A flat white fill
// for 0.12 s at a 0.28 s fire rate left the bosses white roughly half the
// time, which reads as a strobing slab rather than as a series of hits --
// and it hid the wind-up tell underneath it.
export const DAMAGE_FLASH = {
  enemyColor: '#ffffff', // enemies and bosses
  playerColor: '#ff5f4d', // the player -- red, never white: the studentmossa overlay is white
  playerDuration: 0.16, // s. Shown at full opacity even mid-blink, so a hit is never missed
};

// Death burst. Enemies and bosses used to vanish on the frame they died,
// which left the single most satisfying moment in the game with no
// payoff at all -- including beating the Research Golem, the centrepiece
// of the whole pitch.
//
// Built the same way the utspring confetti is (AGENTS.md 7.10: not a
// particle system, a fixed list of rectangles that expire). One colour
// for every death rather than the dead thing's own, so a burst always
// reads as "that died" and never as a new hazard appearing.
export const DEATH_BURST = {
  color: '#ffe6a8',

  // A ghost of the body, scaling up from where it stood and fading out.
  ghostDuration: 0.28, // s
  ghostScale: 1.7, // final scale, from 1

  // Shards thrown out from the centre.
  particleCount: 8,
  particleSize: 9, // px square, before it shrinks away
  particleSpeed: 300, // px/s at spawn
  particleSpread: 0.45, // 0..1 random variation in speed per shard
  particleAngleJitter: 0.4, // radians of random scatter off the even fan
  particleGravity: 1100, // px/s^2
  particleDuration: 0.45, // s

  // Bosses are a bigger event than a maths book. Multiplies the shard
  // count and how far they travel; the body ghost already scales itself,
  // since it is drawn at the boss's own size.
  bossScale: 2.2,
};

// Screen shake. Three sizes, in the order the game escalates: taking a
// hit, killing something, a boss changing phase (and dying, which is the
// last phase change it makes).
//
// Restrained on purpose. This is an interactive CV read by people who do
// not play games, and a shaking screen is the fastest way to make text
// unreadable and a viewer queasy. Two rules hold it in check:
//
//   - maxAmplitude caps every request, whatever it asks for.
//   - Only the world shakes. The HP pips, the pacing overlay and every
//     DOM control are drawn outside the camera transform and never move,
//     so nothing that has to be READ is ever in motion (game.js render).
export const SHAKE = {
  playerDamage: 5, // px
  enemyDeath: 7, // px
  bossPhaseChange: 11, // px -- also a boss death, the last phase change it makes
  duration: 0.22, // s, decaying linearly to nothing
  frequency: 34, // Hz
  maxAmplitude: 12, // px. A hard ceiling: no request may exceed this
};

export const HITSTOP = {
  enemyHit: 0.05, // s -- ~3 frames, any shot that takes hit points off something
  enemyDeath: 0.1, // s -- ~6 frames, a kill should land harder than a chip
};

export const CAMERA = {
  deadzoneWidth: 220, // px, total width of the horizontal dead zone
  deadzoneHeight: 140, // px, total height of the vertical dead zone
  smoothing: 6, // higher = camera catches up to the target faster
  zoomSmoothing: 3, // higher = zoom transitions catch up faster
};

// Comic input lockout (task 3, playtest round 2). A comic can open while
// the player is mid-input -- most concretely, holding or clicking left
// mouse to fire (task A) right as a boss-room comic-trigger fires. The
// very next mouseup/click then lands on the newly-shown comic screen
// instead of the canvas and skips panel 1 before it was ever read. Every
// comic ignores clicks/Space/Enter for this long after it opens, and
// game.js clears input.js's held/pressed state at the same moment
// (enterComic) so nothing carried over from before the comic can fire
// through it either. Applies to every comic, not only the boss ones.
export const COMIC = {
  inputLockoutDuration: 0.4, // s
};

// The boss approach (task 3, playtest round 2): a short scripted walk-up
// before each boss's comic, replacing the comic simply popping up the
// instant the player crosses a line. Same pattern as the utspring
// (STAIRCASE below) -- one hardcoded sequence in game.js, not a cutscene
// framework, just driven by a table (level.js) because more than one boss
// needs a version of this beat.
//
// The approach trigger sits walkDuration * PLAYER.moveSpeed before the
// boss's own arena-activation line (level.js), so the scripted walk
// always arrives exactly on that line as the timer expires -- the same
// "arrives as the timer runs out" trick STAIRCASE uses below. That means
// the real fight (bosses.js activation) starts the instant control
// returns from the comic, with no further walking needed.
//
// Both bosses now run the reveal flow below. Graduation's own timings
// (longer walk, thought bubbles) are in GRADUATION_ENTRANCE.
export const BOSS_APPROACH = {
  walkDuration: 1.6, // s, control taken, walking forward at normal speed (not running)

  // Research Golem repair task: a camera-reveal beat inserted BEFORE the
  // walk, used only when a 'boss-approach' entry carries a revealCameraX
  // (level.js). The player stops dead; the camera (already able to hold a
  // fixed lock -- see arenaLockCameraX, reused here rather than building a
  // second camera system) glides to the authored reveal framing over
  // revealDuration, holds there for reactDuration while Jakob's reaction
  // bark shows, then the ordinary walk above carries him the rest of the
  // way to the door with the camera still locked at that same framing.
  revealDuration: 1.0, // s, camera eases from wherever it was to the reveal target
  reactDuration: 0.9, // s, camera holds; this is when the reaction bark shows
  // How far from the RIGHT edge of the locked reveal frame the venue's
  // entry door sits, once the camera settles -- the rest of the frame (to
  // the door's left) is the façade "presenting" itself. Authored, not
  // derived from where the player happens to stop (task brief: "the
  // camera should stop based on an authored target/framing... not because
  // Jakob physically reaches the edge of the screen").
  revealDoorMarginRight: 400, // px
};

// The Graduation entrance: the portal at the end of the short Haga
// lead-in (level.js). Same beat as the Research Golem's approach (game.js
// updateBossApproach): control taken, the camera glides to frame the
// portal, Jakob thinks, walks into it, comic, then straight into the
// arena and the fight. Only these values differ from BOSS_APPROACH.
export const GRADUATION_ENTRANCE = {
  // s of scripted walk from where control is taken to the portal. Longer
  // than the Golem's, so control goes the moment the portal starts to come
  // into view rather than when it is already fully on screen -- the
  // trigger sits walkDuration * PLAYER.moveSpeed before the portal.
  walkDuration: 2.0,
  // px between the portal art's right edge and the right edge of the
  // locked reveal frame: the shot ends just past the portal.
  revealMarginRight: 60,
  // Thought bubbles over Jakob, one after the other, each held this long.
  thoughtDuration: 1.5, // s
  thoughts: ['This can only be one thing…', 'Time for graduation!'],
  thoughtBubble: {
    font: '17px sans-serif',
    lineHeight: 21,
    maxWidth: 170, // px of text before wrapping
    paddingX: 16,
    paddingY: 12,
    bump: 11, // px radius of the scallops around the cloud's edge
    gapAboveHead: 88, // px from the hitbox top to the cloud's bottom edge (the head is ~42px above the hitbox)
    offsetX: 40, // px the cloud sits right of Jakob's centre
    fill: '#1f4e6b',
    border: '#0d1117',
    borderWidth: 3,
    textColor: '#f7f3e3',
  },
};

// Post-boss exit repair task (§9, game.js updateResearchGolemExitWalk): a
// short, quiet mirror of BOSS_APPROACH.WALK for leaving instead of
// entering -- control is briefly taken a short distance before the venue's
// own exit door and Jakob is auto-walked the rest of the way through it, so
// the exterior/interior render-state flip (RESEARCH_GOLEM_EXIT_X) lands as
// an authored beat instead of a cut mid-stride. No camera move, no comic,
// no reaction bark -- "quick and subtle" (task brief) is the whole point,
// unlike the entrance's reveal.
export const RESEARCH_GOLEM_EXIT = {
  triggerMarginBeforeDoor: 150, // px before the exit door where control is taken
  walkDuration: 0.5, // s of forced forward walk; PLAYER.moveSpeed * this comfortably clears the door
};

// The utspring — the staircase run and the studentmössa (AGENTS.md §3,
// PLAN.md task 3.5). A scripted five-second sequence, not a pickup you
// walk into: handover at the foot of the staircase, auto-climb, descent,
// confetti, flash, title card, control back. Everything below is one of
// its tunables.
//
// The beat from the top landing on:
//   descentDuration + flashDuration + cardHoldDuration + cardFadeDuration
//   = 3.0 + 0.25 + 1.6 + 0.4 = 5.25 s
// plus the auto-climb before it: ~1.9 s at PLAYER.moveSpeed (the climb and
// top landing are level.js geometry, 684 px) -- ~7.15 s in all.
export const STAIRCASE = {
  // The staircase's shape is its art now (level.js STAIR_SURFACE, measured
  // off 'utspring-staircase'); what is tunable is the timing below, and:
  // px the walking line may drop away under a grounded player in one step
  // and still pull their feet down onto it (game.js applyStairSurface).
  // Covers the steepest flight at the utspring's top speed with margin;
  // raising it a lot would let a player "stick" to the stairs on a jump.
  surfaceSnap: 20,

  // --- Timings
  descentDuration: 3.0, // s of auto-run from the handover to the stop
  speedRampMultiplier: 1.5, // final auto-run speed, as a multiple of PLAYER.moveSpeed
  flashDuration: 0.25, // s of white flash; the studentmössa appears under it
  cardHoldDuration: 1.6, // s the title card holds at full opacity
  cardFadeDuration: 0.4, // s it fades out over; control returns when it's gone
  // The ceremony music (MUSIC 'student-ceremony') starts with the handover,
  // this many seconds into the track rather than from its beginning. The
  // track's final chord hits ~9.0 s in, and the title card appears ~5.15 s
  // after the handover (climb 1.9 + descent 3.0 + flash 0.25), so
  // 9.0 - 5.15 = 3.85 puts that chord on the text. Lower = the chord comes
  // later than the text (0 = the whole track, chord ~3.85 s after it).
  musicStartAt: 3.85,

  zoomOut: 0.8, // camera scale for the whole sequence — the view widens
  flashColor: '#ffffff',

  // What the Lund years were, on clouds in the sky over the descent
  // (level.js UTSPRING_CLOUDS places them, in this order). Each drifts in
  // once the running player is within appearLead px of it, and all of them
  // fade out together with the title card.
  clouds: {
    words: ['Marketing', 'Entrepreneurship', 'Management'],
    appearLead: 560, // px before the cloud's centre that the player's centre reveals it
    fadeInDuration: 0.35, // s
    riseDistance: 18, // px each cloud drifts up by while it fades in
    // Same look as the thought bubbles (GRADUATION_ENTRANCE.thoughtBubble),
    // bigger, and with no trailing puffs -- these belong to the sky.
    bubble: {
      font: 'bold 22px sans-serif',
      lineHeight: 26,
      maxWidth: 260,
      paddingX: 24,
      paddingY: 14,
      bump: 15,
      fill: '#1f4e6b',
      border: '#0d1117',
      borderWidth: 3,
      textColor: '#f7f3e3',
    },
  },
};

// Jakob's thought as he passes the Gothenburg sign after the utspring
// (level.js 'thought-trigger'). Drawn like Graduation's thought bubbles,
// over his head, and never takes control or pauses anything.
// Jakob's thought passing the UF stand's Candell UF stall (level.js
// 'thought-trigger'). Same drawing and rules as GOTHENBURG_THOUGHT below.
// Placeholder copy -- author-owned (AGENTS.md §10), rewrite freely.
export const UF_THOUGHT = {
  text: 'Candell UF, my first company. Business Report of the Year in Skåne!',
  duration: 3.6, // s on screen
};

// Jakob's thoughts in USA (level.js 'thought-trigger'): two in a row just
// after arriving, then one as the second football helmet comes into view.
// Placeholder copy -- author-owned (AGENTS.md §10), rewrite freely.
export const USA_THOUGHTS = {
  arrival: { text: 'Everything really is bigger in America. Especially the portions.', duration: 3.2 },
  experience: { text: 'Columbia, South Carolina: a great time, and an invaluable experience.', duration: 3.6 },
  football: { text: 'American football: a fun spectacle… but they really gotta learn to pick up the pace.', duration: 3.8 },
};

// Jakob's thought on the walk up to the utspring staircase (level.js
// 'thought-trigger'), timed to fade as the staircase takes over.
export const STAIRCASE_THOUGHT = {
  text: 'Time flies, let’s become a real adult!!',
  duration: 3.0, // s on screen
};

export const GOTHENBURG_THOUGHT = {
  text: 'Armed with the basics, let’s continue on the business path!',
  duration: 3.2, // s on screen
};

// Confetti for the utspring (PLAN.md task 3.5). Deliberately not a
// particle system (AGENTS.md §7.10): a fixed number of small coloured
// rectangles, spawned once when the descent starts, falling with some
// drift and spin, culled when they leave the view.
export const CONFETTI = {
  count: 180,
  width: 10,
  height: 14,
  colors: ['#f6c453', '#c9574b', '#6fd67a', '#f7f3e3', '#5aa9e6', '#d98cc4'],
  fallSpeedMin: 180, // px/s
  fallSpeedMax: 420, // px/s
  driftSpeed: 70, // px/s, max horizontal drift in either direction
  spinSpeedMax: 5, // radians/s, in either direction
  spawnBandHeight: 1200, // px above the view that pieces start scattered through
  cullMargin: 60, // px below the view before a piece is removed
};

// The studentmössa on the player sprite. AGENTS.md §6: an overlay drawn
// on the base character, never a second animation set. Grey-box
// placeholder — a white cap with a brim and a tassel. When the real
// overlay art lands (task 6.4), drawStudentmossa in player.js becomes a
// single drawImage call and these numbers become its offset.
export const STUDENTMOSSA_OVERLAY = {
  capWidth: 44, // px, wider than the head — obviously a placeholder
  capHeight: 8,
  brimWidth: 22,
  brimHeight: 9,
  offsetY: -10, // px above the player's top edge
  color: '#ffffff',
  brimColor: '#151a23',
  tasselColor: '#c9574b', // deliberately not PLAYER.color, or it vanishes into the sprite
  tasselLength: 16,
  tasselWidth: 3,
};

// Pickups (AGENTS.md §3/§6): suit and armour. Grey-box: plain rectangles,
// one color per outfit, labelled with text (AGENTS.md §5: this is exactly
// the kind of temporary gameplay label canvas text is for) -- same-sized
// boxes are otherwise indistinguishable from each other.
//
// The studentmössa is deliberately absent: it is no longer a box you walk
// into but the reward at the end of the utspring sequence (STAIRCASE
// above, PLAN.md task 3.5), so it has no pickup entity, colour or label.
export const PICKUP = {
  width: 32,
  height: 32,
  // Outfit tints, which are also the pickup boxes' colours. Both were
  // collisions: the suit sat on the platform colour and the USA
  // silhouette, and the armour was byte-identical to the football
  // helmet's dazed-and-vulnerable colour (ENEMY_HELMET.recoveryColor),
  // which is the one shade in the game that means "hit this now".
  // Both are now brighter and cooler than anything in the scenery, which
  // is desaturated throughout.
  colors: {
    suit: '#8d9bff',
    armour: '#dfe6f2',
  },
  labels: {
    suit: 'SUIT',
    armour: 'ARMOUR',
  },
  labelFont: '14px sans-serif',
  labelColor: '#f7f3e3',
  labelGapAboveBox: 6, // px between the label's baseline and the box top
  // Pickups drawn from art instead of a labelled box. The sprite's box is
  // also the pickup's touch box, and it stands on the ground.
  sprites: {
    armour: { path: 'assets/backgrounds/armour-pickup.webp', width: 80, height: 74 },
  },
};

// Platforms (task C, AGENTS.md §5: "fixed standard dimensions for...
// platforms"). One-way: landable from above, never solid from the sides
// or below (player.js). Every instance is this same size -- only x/y vary
// in level.js -- so "wide, forgiving" (PLAN.md task C) is true everywhere
// by construction, not something each placement has to get right.
export const PLATFORM = {
  width: 220,
  height: 24,
  color: '#3a4a63',
  // A bright strip along the top edge of every platform. The body colour
  // alone sat inside the range the background silhouettes already use --
  // in the utspring section the staircase was actually DARKER than the
  // sky behind it and read as shadow. The highlight is the one thing in
  // the game that means "you can stand on this", and because it is on
  // every platform it means it everywhere.
  topHighlightColor: '#93b0d8',
  topHighlightHeight: 5, // px
};

// The opening tutorial's single low block. Its top is landable, and a held
// jump clears it with room to spare before the first enemy appears.
export const TUTORIAL = {
  blockWidth: 88,
  blockHeight: 72,
  blockColor: '#1e5b7a',
  blockEdgeColor: '#102f43',
  blockTopColor: '#74b4cf',
  blockEdgeWidth: 4,
  blockTopHeight: 6,
};

// Enemy roster (AGENTS.md §3). Three behaviours total: the maths book is
// killable and stationary, one behaviour placed three times in Lund (task
// 3.6 varies only where, never the logic); Endless Inbox can't be shot
// down, only gotten past; the football helmet charges. Visual variants
// belong to art (Milestone 6), not new logic here.
//
// The maths book is the game's first enemy and its real job is to teach
// shooting: stationary, low HP, and it fires one slow projectile straight
// ahead on a repeating idle -> telegraph -> shot cycle. "Straight ahead"
// is always leftward -- the level runs one direction and the player
// always approaches a stationary book from the left, so firing left is
// always firing back toward wherever the player is coming from.
// Playtest round 2 (task 1): fired too slowly and died too fast. hp 2 -> 4,
// idleDuration 6.2 -> 3.4 (full gap between shots, idleDuration +
// telegraphDuration, goes from 7.1s to 4.3s). idleDuration must stay above
// projectileLifetime (3s, below) or the "only one shot in flight at once"
// guarantee that keeps this fair for a player who does nothing breaks.
//
// The very first placement (level.js, MATHBOOK_1_X) is the shooting
// tutorial and must stay exactly as gentle as before -- a player who
// stands still there for 60s must still be alive. It carries an explicit
// per-instance override back to the old hp: 2, idleDuration: 6.2, so this
// tuning applies to the second and third placements only.
export const ENEMY_MATHBOOK = {
  width: 48,
  height: 48,
  // px above the footprint's bottom that PLAYER shots can hit: the top of
  // the drawn book (the lower of its two poses). Taller than `height`
  // because shots leave at PLAYER.shotHeight, above a 48px footprint --
  // without this a book on the ground could not be hit. Contact damage
  // still uses the footprint.
  shotHitboxTop: 60,
  color: '#8a5a3a', // closed cover
  telegraphColor: '#e2b23c', // opens toward this before firing
  hp: 5, // shots to kill (was 4; the first book overrides it in level.js)
  contactDamage: 1,
  hitFlashDuration: 0.12, // s

  firstShotDelay: 1.4, // s of idle before the very first telegraph. Only
  // matters if an instance is somehow never activated (ACTIVATION above
  // normally supersedes this by starting the wind-up on activation).
  // s between one shot and the next wind-up starting. Deliberately longer
  // than projectileLifetime below: only one shot is ever in flight at a
  // time (matches "fires A single slow projectile"), so a player who never
  // reacts at all still only ever faces one threat, never several stacked
  // shots closing the gap between hits. This is what makes "a player who
  // does nothing must not die there" actually true rather than just slow.
  idleDuration: 3.4, // was 6.2
  telegraphDuration: 0.9, // s -- AGENTS.md §4's 0.8-1.0s range applies to enemies too

  projectileSpeed: 150, // px/s -- slow enough to walk away from without hurrying
  projectileWidth: 22,
  projectileHeight: 14,
  projectileColor: '#ff6b3d', // hazard orange (HAZARD) -- was gold, the UF stand's exact colour
  // s. At 150 px/s this is the shot's RANGE: 3s = 450px, a third of the
  // screen. It was 6s = 900px, which is further than the distance from
  // the player's spawn (x 120) to this enemy (x 900) -- so a player who
  // read the controls and did not move for half a minute was hit at the
  // spawn point, repeatedly, and eventually died there without ever
  // having touched a key. idleDuration's note above claims "a player who
  // does nothing must not die there"; at 6s that simply was not true.
  projectileLifetime: 3,

  // The shot's authored art: a +, a = or a -, one after the other (each
  // book cycles through `symbols` in order, one per shot). Presentation
  // only -- projectileWidth/Height above stay the hitbox; the symbol is
  // drawn centred on it. The sheet is one row of square cells in
  // `symbols` order, delivered at 2x drawCell (scripts/runtime-assets.py
  // MATHBOOK_PROJECTILE_SHEET), so = draws about 28x20 and + about 26x26.
  projectileSprite: {
    path: 'assets/enemies/math-book-projectiles.webp',
    symbols: ['plus', 'equals', 'minus'],
    drawCell: 32, // px on screen per cell
  },

  // Authored artwork (art-source/enemies/math-book). The gameplay
  // rectangle above (48x48) stays the footprint -- collision, damage and
  // placement are all measured against it, never against this sprite.
  // The art is fitted to it and drawn from it.
  //
  // Both states are the SAME whole source canvas, delivered at 2x this
  // draw canvas, so swapping idle -> open cannot shift the book: the two
  // images share one origin and one draw box (scripts/runtime-assets.py
  // ENEMY_SOURCES). The open book is the wind-up tell the placeholder
  // colour lerp used to be -- it literally opens before it fires.
  sprite: {
    idlePath: 'assets/enemies/math-book-idle.webp',
    telegraphPath: 'assets/enemies/math-book-open.webp',
    // The draw canvas, not the visible book: within it the closed book
    // measures ~39x61 and the open one ~64x61, deliberately overhanging
    // the 48x48 footprint rather than the footprint being grown to match.
    displayWidth: 88,
    displayHeight: 88,
    // From "centred on the footprint". Both states' visible content sits
    // 1px right of and 8px below the draw canvas's centre, so these two
    // numbers put the book centred on the footprint with its bottom edge
    // flush to the footprint's -- a visual alignment only.
    offsetX: -1,
    offsetY: -8,
    // Same tells as the placeholder, washed over the sprite's own pixels
    // instead of a block (bosses.js drawSpriteTint does this for the
    // Research Golem). Lighter than the golem's 0.85/0.8: the open-book
    // swap already carries the wind-up here, so the tint only has to
    // reinforce it, not be the whole tell.
    telegraphTintAlpha: 0.5,
    hitFlashTintAlpha: 0.7,
  },
};

// No hitFlashDuration: the Endless Inbox cannot be damaged at all
// (damageEnemy returns before touching it), so it can never flash, and a
// duration for a flash that cannot happen is a number waiting to mislead
// whoever reads this next.
export const ENEMY_INBOX = {
  width: 56,
  height: 56,
  color: '#4a5568',
  contactDamage: 1,
};

// The football helmet (USA, exchange semester): idle -> telegraph -> charge
// -> recovery, on a loop. It teaches "dodge, then punish" -- exactly what
// the Graduation boss later assumes the player already knows. Every shot
// damages it, in any state (it used to be invulnerable outside recovery,
// which read as shots doing nothing); it deals no contact damage while
// dazed.
// Playtest round 2 (task 1): died too fast -- one or two charge cycles.
// hp 6 -> 16, aiming for three-to-four full cycles instead. The wind-up
// itself is unchanged (still 0.8-1.0s, this enemy is meant to be readable);
// only how much punishment it can absorb during recovery changed.
export const ENEMY_HELMET = {
  width: 56,
  height: 56,
  // Same as ENEMY_MATHBOOK.shotHitboxTop: the top of the drawn helmet
  // (its lower, wound-up pose).
  shotHitboxTop: 61,
  color: '#5a7a9a',
  telegraphColor: '#e2b23c', // same wind-up tell colour as every other telegraph
  recoveryColor: '#8a95a8', // dazed -- visibly different so "hit it now" reads at a glance
  hp: 8, // was 16, which took far too long -- two charge cycles
  contactDamage: 1,
  hitFlashDuration: 0.18, // s -- long enough to catch over the charge and the dazed tint

  idleMinDuration: 0.6, // s of idle before it's willing to wind up again
  // It only winds up while the player is within this many px (centre to
  // centre). Walking right, the camera trails Jakob so only ~480px ahead
  // of him is on screen (measured); 380 keeps the whole helmet in view
  // with margin before its wind-up starts. It used to wake 640px out and
  // charge in from off screen.
  windUpRange: 380,
  telegraphDuration: 0.9, // s -- AGENTS.md §4's 0.8-1.0s range
  chargeSpeed: 520, // px/s
  chargeMaxDuration: 1.4, // s hard cap, in case it never reaches a bound
  recoveryDuration: 1.5, // s, dazed: stops, and touching it does no damage

  // Skip starting a wind-up if the player is this close horizontally and
  // at least this far above the helmet's top -- directly overhead (e.g.
  // mid-jump over it), where the tell would be unreadable.
  noChargeHorizontalRange: 60,
  noChargeVerticalRange: 40,

  // Authored artwork (art-source/enemies/football-helmet), fitted to the
  // 56x56 gameplay footprint exactly as the maths book above is: the
  // rectangle stays the collision and charge geometry, the sprite is
  // drawn from it. Idle and telegraph are the same whole source canvas
  // delivered at 2x this draw canvas, which is what preserves the
  // authored shrink/tilt of the wind-up instead of it reading as the
  // helmet jumping.
  //
  // The art faces LEFT; the entity's `facing` (1 = right) flips it, so
  // "it is looking at you" stays true while it idles and the charge
  // direction is readable before it starts.
  sprite: {
    idlePath: 'assets/enemies/football-helmet-idle.webp',
    telegraphPath: 'assets/enemies/football-helmet-telegraph.webp',
    // Draw canvas; the helmet itself measures ~70x65 inside it.
    displayWidth: 124,
    displayHeight: 124,
    offsetX: -1,
    offsetY: -3, // bottom of the helmet flush with the footprint's bottom
    telegraphTintAlpha: 0.5,
    // Dazed recovery -- the one state that means "hit it now", so it gets
    // the heaviest wash of the three.
    recoveryTintAlpha: 0.55,
    hitFlashTintAlpha: 0.9, // strong enough to read over the telegraph and dazed tints
  },
};

// Barks: short spoken lines over Jakob that never pause the game. Kills no
// longer bark (author request) -- CV lines come from placed thought
// bubbles instead (UF_THOUGHT); the look below is still used by his spoken
// reaction at the Research Golem's door. The per-enemy lines are unused.
// Originally kill barks (AGENTS.md §4). Text lines are placeholder
// copy -- real CV lines are an open item (AGENTS.md §10) -- but the
// mechanism (spawn above the player, float up, fade, never block input)
// is real. One line per enemy type, cycled in order so repeat kills of the
// same type (the three Lund trash) don't repeat a line.
export const BARK = {
  displayDuration: 1.4, // s a bark stays on screen
  floatDistance: 26, // px it drifts upward over its lifetime
  offsetAboveHead: 16, // px above the player's top edge at spawn
  font: '16px sans-serif',
  color: '#f7f3e3',
  lines: {
    mathbook: [
      '[BARK PLACEHOLDER — CV line 1, maths book kill]',
      '[BARK PLACEHOLDER — CV line 2, maths book kill]',
      '[BARK PLACEHOLDER — CV line 3, maths book kill]',
    ],
    helmet: ['[BARK PLACEHOLDER — CV line, football helmet kill]', '[BARK PLACEHOLDER — CV line, second football helmet kill]'],
    // Not a kill bark: Jakob's reaction during the Research Golem's camera
    // reveal (BOSS_APPROACH, game.js updateBossApproach). Reuses the same
    // spawnBark mechanism -- floats above the player, never pauses the
    // game -- because a one-off reaction line is exactly what that
    // mechanism already does; it does not need its own system.
    'research-golem-reveal': ['What is this??'],
  },
};

export const TELEGRAPH = {
  minDuration: 0.8, // s — AGENTS.md §4, do not go below this
  maxDuration: 1.0, // s
};

// Proximity activation for ordinary enemies (task 1, playtest round 2).
// Bosses were already dormant until the player reached an arena's
// activationX (task B); the maths book and football helmet were not --
// they ran their idle/telegraph/attack cycle continuously from the moment
// the level loaded, so by the time a player actually reached one, it was
// at some essentially arbitrary point in a cycle that could have been
// running for a minute or more of simulated time. That reads as "several
// seconds of nothing" exactly as often as it reads as "instant attack" --
// both are the same bug, an activation moment the enemy doesn't know
// about. The fix, applied uniformly here, at every boss's activation
// point (bosses.js) and at every affected enemy's (enemies.js): a dormant
// enemy does nothing at all until the player is this close, and the
// instant it wakes it begins its wind-up immediately rather than a full
// idle/cooldown -- so the delay to the first attack is always roughly one
// telegraph duration, never a cycle length.
//
// Sized to roughly half the canvas width, so activation lands close to
// when the enemy is scrolling into view rather than either well before or
// well after.
export const ACTIVATION = {
  enemyLeadDistance: 640, // px, player.x before the enemy's own x
};

// Boss 1 — the Research Golem (AGENTS.md §4). Its world position is level
// layout, not a boss-intrinsic property, so it lives in level.js's LEVEL
// data, not here.
export const RESEARCH_GOLEM = {
  width: 140,
  height: 220,
  color: '#8a7c63',
  hitFlashDuration: 0.12, // s
  telegraphColor: '#e2b23c', // wind-up tell: boss glows toward this before firing
  maxHp: 30,
  contactDamage: 1,

  // Authored Research Golem artwork (art-source/research-golem, delivered
  // by scripts/runtime-assets.py). Presentation only: width/height above
  // stay the gameplay footprint -- collision, damage and the claim-phase
  // geometry are all measured against that rectangle, never against this
  // sprite. The art is simply fitted to it and drawn from it.
  //
  // The delivered sheet is sixteen poses on a shared grid
  // (scripts/prepare-boss-animation.py): a four-frame idle, then one
  // four-frame sequence per attack pattern, each reading ready, wind-up,
  // strike, recover. Every pose stands on the same foot line and is
  // centred on the same column, so the golem never drifts between them.
  sprite: {
    path: 'assets/bosses/research-golem.webp',
    columns: 4,
    // The cell, not the body: the body stands 219px tall inside it, and
    // the extra room is for the poses that reach past the idle
    // silhouette -- the raised bundle of the throw, the extended fists.
    cellWidth: 210,
    cellHeight: 252,
    // Where the feet sit inside a cell, measured from its top. The cell
    // is drawn so this line lands on the footprint's bottom edge.
    footY: 252,
    // Horizontally centred on the footprint. Both zero: the prepared
    // sheet already lines up, and these exist so a nudge is one number
    // here instead of arithmetic in bosses.js.
    offsetX: 0,
    offsetY: 0,

    idleFrames: [0, 1, 2, 3],
    idleFrameDuration: 0.42, // s per frame

    // Which four cells belong to each attack pattern. Authored per
    // pattern rather than by position, because the sheet's rows and the
    // cyclePatterns order are not the same list and never have to be:
    // the slam is the ground shot, the thrown bundle is the high arc,
    // and the punch is the spread burst.
    attackFrames: {
      'spread-burst': [4, 5, 6, 7],
      'ground-shot': [8, 9, 10, 11],
      'high-arc': [12, 13, 14, 15],
    },
    // How much of the wind-up is spent on the ready pose before the
    // golem commits to the wind-up pose. The telegraph runs 0.9-1.0s
    // (patterns above), so this leaves roughly 0.6s of unmistakable
    // raised arm -- AGENTS.md §4's "a raised arm", which it calls the
    // single most important thing for how the game feels.
    readyFraction: 0.35,
    strikeDuration: 0.16, // s the strike pose holds after the shot leaves
    recoverDuration: 0.22, // s of follow-through before returning to idle

    // The existing tells, kept exactly as they read before -- the
    // placeholder lerped its whole rectangle toward telegraphColor over
    // the wind-up and toward DAMAGE_FLASH.enemyColor on a hit. The same
    // colours wash over the SPRITE'S OWN PIXELS instead of a block,
    // ramping from nothing to these peak alphas.
    //
    // A brighten/glow blend was tried first and rejected: the golem is
    // mostly white paper, so screening white or amber over it barely
    // changed anything -- the weakest possible telegraph on exactly the
    // fight that must not have one.
    //
    // Lowered from 0.85 now that the wind-up has a POSE. The tint no
    // longer has to carry the whole telegraph on its own, and at 0.85 it
    // washed out the raised arm that is now the clearer tell.
    telegraphTintAlpha: 0.55,
    hitFlashTintAlpha: 0.8,
  },

  hpBar: {
    width: 220,
    height: 16,
    offsetY: 34, // px above the boss's top edge
    backgroundColor: '#1b2333',
    borderColor: '#0d1117',
    fillColor: '#c9574b',
  },

  // The boss is a fixed wall the player can't walk behind, so it can
  // always be fought facing right, by design (see project chat: bosses
  // stand at the right end of a bounded arena, never flip).
  solidWall: true,

  // HP fractions that trigger a claim phase. AGENTS.md §4: max two per
  // fight.
  claimThresholds: [0.66, 0.33],

  // Playtest round 2 (task 1): the cooldown between attacks ran too long
  // throughout the fight. Shortened both phases for continuous pressure;
  // every pattern's own telegraphDuration (below, unchanged) still gives
  // the same 0.8-1.0s tell either way.
  phaseA: {
    cyclePatterns: ['ground-shot', 'high-arc'],
    cycleInterval: 1.6, // s between attack starts — was 2.2, still the slower tutorial phase
  },
  phaseB: {
    cyclePatterns: ['ground-shot', 'high-arc', 'spread-burst'],
    cycleInterval: 0.9, // s between attack starts — was 1.3
  },

  // Authored projectile art (art-source/projectiles), one five-frame row
  // per pattern. Presentation only: projectileWidth/Height below stay the
  // hitbox and still decide every collision. The art is drawn about 3x
  // that, which is the generous direction -- a player who sees a heap of
  // paper coming is only hit by its core, never by the edge of the
  // drawing.
  //
  // `anchor` is 'bottom' for the ground shot alone. Its art is a heap of
  // paper standing on the floor, and that pattern travels along the floor
  // ("at floor level", bosses.js fireAttack), so centring it would bury
  // half the heap in the cobbles.
  projectileSprite: {
    path: 'assets/bosses/boss-projectiles.webp',
    columns: 5,
    cellWidth: 80,
    cellHeight: 68,
    frameDuration: 0.09, // s per frame
    // Row on the sheet, and the box the art is drawn in.
    rows: {
      'ground-shot': { row: 0, width: 60, height: 52, anchor: 'bottom' },
      'high-arc': { row: 1, width: 52, height: 50, anchor: 'centre' },
      // The dart is drawn pointing right; `facing` says so, and the
      // renderer mirrors it for a shot travelling left (game.js
      // drawBossProjectileSprite), which is every shot the golem fires.
      'spread-burst': { row: 2, width: 52, height: 34, anchor: 'centre', facing: 'right' },
    },
  },

  // Attack patterns as data: telegraph duration, projectile speed/angle,
  // repeat count. AGENTS.md §5.
  patterns: {
    'ground-shot': {
      telegraphDuration: 0.9,
      projectileSpeed: 420,
      projectileWidth: 20,
      projectileHeight: 14,
      color: '#ff8a3d', // was a tan that vanished against the Handels columns
    },
    'high-arc': {
      telegraphDuration: 0.95,
      projectileSpeed: 360, // horizontal speed
      launchVy: -520, // px/s, negative is up
      gravity: 900, // px/s^2, arcs back down
      spawnHeightOffset: -40, // px above boss center
      projectileWidth: 18,
      projectileHeight: 18,
      color: '#ff4d3d',
    },
    'spread-burst': {
      telegraphDuration: 1.0,
      projectileSpeed: 360,
      repeatCount: 3,
      spreadAngleDeg: 26, // total fan angle across all projectiles
      projectileWidth: 16,
      projectileHeight: 10,
      color: '#ff4d3d',
    },
  },
};

// Claim phase (AGENTS.md §4). Written specifically for the Research Golem
// — do not reuse the "choose correctly" idea for any other boss or enemy.
export const CLAIM_PHASE = {
  wrongAnswerHealFraction: 0.04, // fraction of maxHp healed per wrong shot

  // Claims stack VERTICALLY in one column, not side by side. The boss is a
  // solid wall (RESEARCH_GOLEM.solidWall) so the player's horizontal
  // position is constrained; a horizontal-only shot consumed by whichever
  // claim it reaches first meant a side-by-side row was only ever hittable
  // in order from wherever the player stood, and the wall made the far one
  // physically unreachable. Stacking vertically means the player chooses
  // which claim to hit by jump TIMING (shoot low, mid, or near apex)
  // instead of by position. See project chat.
  claimWidth: 300,
  claimHeight: 52, // target; buildClaims shrinks it to fit the reachable band if needed
  claimGapY: 6,
  // Inset from the very top/bottom of the reachable shot-height band
  // (computed from actual jump physics in bosses.js, not hardcoded), so no
  // claim needs frame-perfect apex timing to hit.
  reachableBandInset: 4,

  // How a claim is drawn. This used to sit inside bosses.js's draw call as
  // literal colours, two font sizes and a bare -22 offset, which made the
  // one piece of canvas text a player actually has to READ the only piece
  // whose presentation could not be adjusted from this file.
  boxFillColor: '#1b2333',
  boxBorderColor: '#f7f3e3',
  boxBorderWidth: 2, // px
  textColor: '#f7f3e3',
  textFont: '20px sans-serif',
  tauntColor: '#f0806f',

  // Fallback question, for a set without its own `question` (sets below).
  promptText: 'Which claim is supported?',
  // The question sits on its own dark panel directly above the claim
  // column. It used to be bare cream text there, which landed on the
  // golem's white paper body and could not be read at all.
  questionFont: 'bold 20px sans-serif',
  questionColor: '#ffd65a',
  questionBoxPaddingX: 14, // px either side of the text
  questionBoxHeight: 36, // px
  questionGapAboveClaims: 10, // px between the panel and the top claim
  evidenceMarkerColor: '#6fd67a',
  evidenceMarkerSize: 16,
  // px left of the claim box the evidence marker floats. To the side and
  // not above, because the claims stack tightly enough that "above" lands
  // inside the claim on top of this one.
  evidenceMarkerGapX: 22,
  evidenceBobAmplitude: 6, // px, gentle floating motion
  evidenceBobSpeed: 3, // radians/s
  taunts: ["That's not it.", 'Try again.', 'Read the data again.'],
  // s. Doubles as the claim lockout (polish-pass audit finding A11): a
  // wrong shot closes all three claims for this long, not just the one
  // that was hit, so holding fire down cannot brute-force the phase by
  // spraying every reachable height until one lands. The taunt is what's
  // actually shown during the lockout, which is why the same duration
  // drives both -- there is one window, not two to keep in sync.
  tauntDuration: 2.0,

  // Claim content, a few words each, never sentences (they're read on
  // canvas above a moving boss). One set per claim phase (max two). Each
  // set asks its own `question`, read out above the claims; the answers
  // are the evidence offered for it, and only one of them holds up.
  // Author-owned copy -- placeholder wording.
  sets: [
    {
      question: 'Did the new DLC grow revenue?',
      claims: [
        { text: '40% YoY growth', correct: true },
        { text: 'n = 12 survey', correct: false },
        { text: 'No control group', correct: false },
      ],
    },
    {
      question: 'Are players spending more?',
      claims: [
        { text: 'Consistent across quarters', correct: true },
        { text: 'Cherry-picked date range', correct: false },
        { text: 'Anonymous single source', correct: false },
      ],
    },
  ],
};

// Boss 2 — Graduation (AGENTS.md §4). An endurance finish over a shorter
// fight, with four abilities of his own (below, `abilities`) -- all of
// them dodged with the existing verbs, run and jump. The claim phase is
// Research-Golem-only, never reused here. Music and heavier shake are
// spectacle (PLAN.md 7.3), not tuned here.
export const GRADUATION = {
  // The gameplay footprint: what player shots hit and the wall the player
  // can't walk past. Sized to the drawn body (cap to feet, shoulder to
  // shoulder) -- the sprite below is fitted to it and drawn from it, the
  // same way the Research Golem's is.
  width: 160,
  height: 270,
  color: '#5b4a72',
  hitFlashDuration: 0.12, // s
  telegraphColor: '#e2b23c',
  // No claim phases, so the fight is still shorter than the Research
  // Golem's even with more HP. Measured: a test run that only held fire
  // point-blank and never dodged won in about 20s; a player who dodges
  // lands far fewer shots, so expect roughly 30-45s.
  maxHp: 60,
  contactDamage: 1,
  solidWall: true,

  // Authored Graduation artwork (art-source/graduation-boss, prepared by
  // scripts/prepare-graduation-animation.py). Twenty poses on one grid: a
  // four-frame idle, then one four-frame sequence per attack, each
  // reading ready, wind-up, strike, recover -- wired exactly like
  // RESEARCH_GOLEM.sprite. Every pose stands on the same foot line and
  // centre, so switching poses never moves him.
  sprite: {
    path: 'assets/bosses/graduation-boss.webp',
    columns: 4,
    cellWidth: 330,
    cellHeight: 355,
    // The shared pivot inside every cell: the centre between his feet
    // (pivotX) and the foot line (footY), both measured from the cell's
    // top-left. Drawn so the pivot lands on the footprint's bottom centre.
    pivotX: 165,
    footY: 347,
    // Draw scale of the delivered sheet. The art is delivered at its
    // native resolution (never upscaled); at 1 he stands ~270px to the
    // top of his cap and ~310px to the tip of his mace, about 1.2-1.4x
    // the Research Golem's 220. A whole number on purpose: the renderer
    // draws with image smoothing off.
    scale: 1,
    offsetX: 0, // px nudges, so a fix is one number here
    offsetY: 0,

    idleFrames: [0, 1, 2, 3],
    idleFrameDuration: 0.45, // s per frame
    // Which four cells belong to each attack. Sheet rows: 2 mace raised
    // overhead, 3 two-handed slam, 4 mace thrust forward, 5 open hand.
    attackFrames: {
      'book-rain': [4, 5, 6, 7],
      'staff-slam': [8, 9, 10, 11],
      volley: [12, 13, 14, 15],
      'rising-slabs': [16, 17, 18, 19],
    },
    // Same meaning as RESEARCH_GOLEM.sprite: share of the wind-up spent
    // on the ready pose before the wind-up pose, then how long the strike
    // and follow-through poses hold after the attack goes off.
    readyFraction: 0.35,
    strikeDuration: 0.2, // s
    recoverDuration: 0.3, // s
    telegraphTintAlpha: 0.45,
    hitFlashTintAlpha: 0.8,
  },

  hpBar: {
    width: 220,
    height: 16,
    // px above the footprint's top edge. Clears the raised mace, which
    // reaches ~75px above the footprint in the book-rain poses.
    offsetY: 90,
    backgroundColor: '#1b2333',
    borderColor: '#0d1117',
    fillColor: '#c9574b',
  },

  // Fight structure (AGENTS.md §4). No claim phase. The boss works through
  // `rotation` in order, over and over: wind-up (the ability's own
  // telegraphDuration), the strike, then the ability's own `cooldown`
  // (counted from the strike) before the next wind-up starts. Once his HP
  // drops to stage2Threshold he moves to stage2's rotation and every
  // cooldown is multiplied by stage2.cooldownScale.
  //
  // Stage 1 opens with the familiar one (the volley, closest to the
  // Research Golem), then the two new ones. Rising slabs are held back
  // for stage 2: its rotation is stage 1's with the slabs added at the
  // end. If the switch comes before the opening three have all been
  // shown, he finishes them first; otherwise the slabs come next
  // (bosses.js damageGraduationBoss). After that, all four rotate.
  stage1: { rotation: ['volley', 'book-rain', 'staff-slam'] },
  stage2: { rotation: ['volley', 'book-rain', 'staff-slam', 'rising-slabs'], cooldownScale: 0.85 },
  stage2Threshold: 0.5, // HP fraction

  // After the player dies: any wind-up in progress is dropped and the boss
  // waits this long before starting the next one (on top of the player's
  // own respawn invulnerability, PLAYER.invulnerabilityDuration).
  respawnGrace: 1.6, // s
  // Lifetime of every Graduation projectile. Long enough to cross the whole
  // arena at the slowest speed below; off-screen culling (game.js) is
  // what normally removes them.
  projectileLifetime: 6, // s

  // The abilities, as data. Every one has a telegraphDuration inside the
  // required 0.8-1.0s (checked at load, bosses.js) -- the wind-up that
  // the ready and wind-up poses play over -- and a cooldown after it goes
  // off. Colours are the hazard palette: warm orange-red is only ever
  // something that hurts.
  abilities: {
    // Row 4 -- mace thrust forward. A staggered volley along the floor at
    // two heights, fired from his front edge. `height` is the shot's
    // centre above the floor: the low shots (24) must be jumped; the high
    // ones (135) pass over a player who simply stays on the ground (the
    // player is 64 tall). `delay` is s after the strike. Every gap between
    // a low and the next shot leaves time to land before it arrives
    // (checked in the browser against the real jump values -- see the
    // task report), so no two shots ask for opposite answers at once.
    volley: {
      telegraphDuration: 0.9,
      cooldown: 3.0, // s from the strike to the next wind-up -- past the last shot
      projectileSpeed: 380, // px/s
      projectileWidth: 30, // the hitbox
      projectileHeight: 14,
      visualScale: 1.6, // drawn this much larger than the hitbox, around its centre
      shots: [
        { height: 24, delay: 0 },
        { height: 135, delay: 1.1 },
        { height: 24, delay: 1.8 },
        { height: 135, delay: 2.9 },
      ],
      color: '#ff6a3d',
    },

    // Row 2 -- mace raised overhead. Books fall from above the top of the
    // screen onto the floor between the arena's left wall and the boss.
    // The moment the wind-up starts, a shadow marks every landing spot, and
    // it stays until that book lands -- so the whole wind-up plus the fall
    // is warning time. The books are spread `bookSpacing` apart (a player
    // fits between two with room to spare) and one stretch of at least
    // safeGapWidth is always left empty, placed at random.
    'book-rain': {
      telegraphDuration: 1.0,
      cooldown: 2.4, // s from the strike -- the last book has landed by then
      bookWidth: 48, // the hitbox
      bookHeight: 34,
      visualScale: 1.35, // drawn this much larger than the hitbox
      bookSpacing: 130, // px between neighbouring books' centres
      safeGapWidth: 240, // px, at least -- five player widths
      spawnHeight: 800, // px above the floor: just above the arena camera's top edge
      fallSpeed: 560, // px/s, steady -- the shadow's timing is exact
      dropStagger: 0.3, // s, each book drops a random 0-this after the strike
      color: '#e0503a', // cover
      pageColor: '#f4ead2',
      // The landing shadow: darkens from startAlpha to endAlpha as its book
      // gets closer, under a ring in the hazard colour.
      shadow: {
        color: '#140f1e',
        startAlpha: 0.4,
        endAlpha: 0.85,
        radiusY: 10, // px, the ellipse's half-height on the floor
        widthScale: 1.7, // ellipse width, as a multiple of bookWidth
        ringColor: '#ff6a3d',
        ringWidth: 3, // px
      },
    },

    // Row 3 -- two-handed overhead slam. The staff hits the floor and
    // waveCount shockwaves run along it toward the player, one after
    // another, each to be jumped. They are ordinary floor-level
    // projectiles. waveSpacing is the distance between two waves; at
    // waveSpeed that is the time between them, and it must leave the
    // player time to land from one full jump and still have minLandingSlack
    // before the next wave needs jumping -- checked at load against the
    // real jump (bosses.js), and measured in the browser (task report).
    'staff-slam': {
      telegraphDuration: 0.95,
      cooldown: 4.6, // s from the strike -- the last wave has crossed the arena by then
      waveCount: 3,
      waveSpeed: 360, // px/s
      waveSpacing: 540, // px between waves -> 1.5s apart
      minLandingSlack: 0.3, // s, at least, between landing and the next wave
      // The hitbox. Narrow on purpose: how long a wave overlaps the player
      // is what shortens the jump window, and the drawn dome is far wider.
      waveWidth: 32,
      waveHeight: 28,
      visualScale: 1.4, // drawn this much larger than the hitbox
      color: '#ff6a3d',
    },

    // Row 5 -- open hand raised. Only joins the fight in stage 2. Several
    // spots on the floor glow and crack for the whole wind-up; when it
    // ends a stone slab bursts up out of each one, holds, and slams back
    // down. The slabs are timed damage zones, not terrain -- nothing can
    // stand on them and the floor itself never changes. The first spot is
    // wherever the player is standing when the wind-up starts (so it asks
    // for a step aside), the rest spread out from it every slabWidth +
    // safeGapWidth -- so between any two slabs there is always at least
    // safeGapWidth of floor that nothing rises from.
    'rising-slabs': {
      telegraphDuration: 1.0,
      cooldown: 2.0, // s from the strike -- the slabs are down again by then
      slabCount: 4, // at most; fewer if the arena runs out of floor
      slabWidth: 110, // px
      safeGapWidth: 170, // px of untouched floor between two slabs
      slabHeight: 130, // px at full height
      riseDuration: 0.15, // s
      holdDuration: 0.35, // s at full height
      slamDuration: 0.12, // s back down
      // The warning over each spot through the wind-up: a glowing strip on
      // the floor that pulses brighter as the wind-up runs out, with
      // cracks across it.
      // Strong on purpose: the arena floor is pale stone, and a faint
      // orange wash over it was nearly invisible at the arena's zoom.
      warning: {
        glowColor: '#ff6a3d',
        glowHeight: 48, // px above the floor the glow rises
        bandHeight: 6, // px, the solid strip of glow on the floor itself
        startAlpha: 0.55,
        endAlpha: 1,
        pulseRate: 9, // radians per second of the pulse
        pulseDepth: 0.2, // alpha the pulse swings by
        crackColor: '#2a1208',
        crackWidth: 4, // px
        crackSegments: 7,
        crackDepth: 6, // px the crack zigzags up and down
      },
      slabColor: '#8b8e98',
      slabShadeColor: '#5f626c',
      slabEdgeColor: '#ff6a3d', // the hazard colour, along the slab's top
      slabEdgeHeight: 8, // px
    },
  },
};

// The Clinic reception encounter (reception.js, level.js
// 'reception-encounter'). A PROTOTYPE, built up in small playtested steps:
// the intro sequence, Round 1 (move and jump to collect files), Round 2
// (files plus mouse drag-and-drop sorting at the same time) and Round 3
// (everything at once, deliberately barely possible). Every number here is
// expected to change after playtesting; none of it is locked.
//
// Positions (arena edges, desk, sign, platforms, items) are layout and live
// in level.js. This block is timing, feel and look.
export const RECEPTION = {
  // --- Camera. While the encounter runs the camera frames the whole arena
  // (level.js arenaLeftX..arenaRightX): the zoom is derived from that width,
  // so a wider arena zooms out further on its own. groundScreenY is where
  // the ground line sits on screen (of 720) while framed -- larger shows
  // less dirt and more room above.
  groundScreenY: 560, // px, screen space

  // --- Intro sequence, in order. Control is taken for all three.
  thinkDuration: 2.4, // s -- Jakob stops and wonders how hard admin can be
  // Both lengthened once Jakob started walking in from outside during the
  // pull-out (level.js RECEPTION_TRIGGER_X): the walk takes ~2.1 s of it.
  frameDuration: 3.6, // s -- camera pulls out to the arena, he walks in; the desk welcomes him
  readyDuration: 1.8, // s -- platforms pop in, "Let's go!", then control returns
  platformPopDuration: 0.35, // s -- each platform's pop-in animation
  platformPopStagger: 0.07, // s between one platform popping in and the next
  // The reception's own platform look. The shared navy PLATFORM colours sat
  // right in the hospital background's range (its beams and balconies)
  // and the blocks nearly vanished into it; these give them a colour the
  // art doesn't use, the dark rim every gameplay object carries, and a
  // shadow that lifts them off the wall behind.
  platformStyle: {
    color: '#2a8c7a', // teal body
    topColor: '#b8f5e3', // bright top edge: "stand here"
    topHeight: 6, // px
    outlineColor: '#0d1117',
    outlineWidth: 3, // px
    shadowColor: 'rgba(13, 17, 23, 0.4)',
    shadowOffset: 8, // px down and right
  },

  // --- Round 1: items appear ONE AT A TIME, in level.js order; touching the
  // current one reveals the next. Deliberately calm -- the sketch's 15 s
  // is the tighter end of the range to try.
  round1: {
    timeLimit: 20, // s for all items
  },
  // --- Round 2: files (one at a time, as in Round 1) AND sorting cards,
  // both before the clock runs out. Cards may be sorted in any order.
  round2: {
    timeLimit: 20, // s for both jobs together (30 felt far too generous in playtest)
    introDuration: 2.6, // s -- control taken, the card tray appears, the desk explains
  },

  // --- Round 3: the overload. Eight tasks in pairs across every tier, the
  // cards come as a ten-card deck (only the top card moves), and a card
  // dropped in the wrong box costs time. Meant to beat most first-timers
  // while staying
  // possible for someone who has learned the layout -- deterministic, no
  // randomness. Failing it does NOT restart it: the encounter ends with a
  // friendly jab and an optional Retry button (reception.js).
  round3: {
    timeLimit: 20, // s for everything (24 was beaten with 4 s to spare by someone who knew the layout)
    introDuration: 3.4, // s -- control taken, the top blocks pop in, the desk piles it on
    wrongDropPenalty: 2, // s taken off the clock for a wrong drop
  },
  round3FailedHold: 3.0, // s the desk's "good try" is read with the arena still framed
  round3FailedLineDuration: 4, // s the line stays up after the arena opens

  roundClearedDuration: 2.0, // s the "well done" line holds before moving on
  roundFailedDuration: 1.8, // s the "too slow" line holds before the round restarts
  // After this many failed attempts at the same round, a "Try again / Skip
  // this round" choice appears instead of the automatic restart -- nobody
  // may be blocked from the application by this (AGENTS.md §2).
  failsBeforeChoice: 2,

  // --- Drag and drop sorting (Round 2 onward). SCREEN coordinates (of the
  // 1280x720 canvas): the camera holds still during the rounds, so the tray
  // and the boxes live in the dirt band along the bottom of the screen like
  // a desk surface, clear of the play area above and of the Skip/Mute
  // controls in the bottom-right corner.
  sorting: {
    panelColor: 'rgba(13, 17, 23, 0.55)',
    panelPadding: 10,
    // The tray the cards wait in, left.
    trayX: 60,
    trayY: 640,
    cardWidth: 64,
    cardHeight: 46,
    cardGap: 14,
    // The destination boxes, one per colour, right of centre.
    binX: 700,
    binY: 628,
    binWidth: 100,
    binHeight: 70,
    binGap: 18,
    dropPadding: 14, // px of forgiveness around each box when dropping
    snapBackSpeed: 18, // how fast a dropped-elsewhere card eases home (higher = faster)
    flashDuration: 0.3, // s a box flashes green (right) or red (wrong)
    rightFlashColor: 'rgba(120, 230, 120, 0.7)',
    wrongFlashColor: 'rgba(240, 80, 70, 0.75)',
    outlineColor: '#0d1117',
    // Every card and box carries a symbol as well as a colour, so the
    // sorting still reads for colour-blind players.
    colors: {
      green: { fill: '#5cb85c', symbol: 'circle' },
      yellow: { fill: '#e8c547', symbol: 'triangle' },
      red: { fill: '#d9534f', symbol: 'square' },
    },
    binOrder: ['green', 'yellow', 'red'], // left to right
    symbolColor: '#1b2333',
    // Round 3's deck: each card under the top one peeks out this far
    // right and down, so the pile's height reads at a glance. Kept small
    // vertically so a ten-card pile still fits above the screen's bottom.
    deckStackOffsetX: 4, // px per card
    deckStackOffsetY: 2, // px per card
    // The "-2 s" that floats off the clock on a wrong drop in Round 3.
    penaltyFont: 'bold 20px sans-serif',
    penaltyColor: '#ff6b5e',
    penaltyDuration: 0.9, // s
    // The first-time tooltip above the tray (Round 2 only), shown until
    // the first card is sorted correctly.
    tooltipFont: 'bold 16px sans-serif',
    tooltipFill: '#f7f3e3',
    tooltipTextColor: '#1b2333',
    tooltipBobAmplitude: 4, // px
    tooltipBobSpeed: 5, // rad/s
  },

  // --- Looks (placeholder art: plain shapes).
  item: {
    width: 30,
    height: 38,
    // Round 3's other kinds of task, drawn as a coloured badge instead of
    // a sheet of paper: an unhappy face (a complaint) and a globe (a
    // patient from outside the EU).
    complaintColor: '#e8875c',
    globeColor: '#4a90d9',
    badgeDetailColor: '#1b2333',
    hoverAboveSurface: 22, // px gap between the surface it sits over and its bottom
    bobAmplitude: 4, // px
    bobSpeed: 3, // rad/s
    // A patient file is a manila folder with a sheet sticking out of it.
    // Cream paper alone vanished into the hospital art, which is mostly
    // cream and pale blue-grey; the saturated folder does not.
    folderColor: '#e9a23b',
    folderTabHeight: 6, // px, the tab on the folder's top-left
    paperColor: '#ffffff',
    lineColor: '#7a8699',
    outlineColor: '#0d1117',
    outlineWidth: 3, // px
    // Every item sits on a dark backing with a pulsing gold border: the
    // backing is what separates it from a light background, the pulse is
    // what says "grab me".
    backingColor: 'rgba(13, 17, 23, 0.6)',
    borderColor: '#ffd84a',
    borderWidth: 3, // px
    borderPulseSpeed: 5, // rad/s
    borderMinAlpha: 0.45, // the pulse runs between this and fully opaque
    glowPadding: 8, // px the backing extends around the item
  },
  // width is the desk's gameplay footprint (the arena's right wall is its
  // left edge); height is the top of the drawn desk, where the desk's
  // speech bubble sits. The art (sprite) runs on to the right from the
  // wall, past the arena's edge -- a long counter, left end first.
  desk: {
    width: 180,
    height: 141,
    sprite: { path: 'assets/backgrounds/clinic-desk.webp', width: 736, height: 141 },
    color: '#8a5a3b',
    topColor: '#b07a52',
    outlineColor: '#0d1117',
    labelColor: '#f7f3e3',
    labelFont: 'bold 14px sans-serif',
    label: 'RECEPTION',
  },
  sign: {
    postWidth: 10,
    postHeight: 110,
    boardSize: 46,
    postColor: '#5a6272',
    boardColor: '#f7f3e3',
    crossColor: '#c9302c',
  },
  // Speech bubbles for this encounter's own lines (Jakob and the desk).
  // Gameplay-local text like the kill barks, but they hold still for a set
  // time instead of floating off. Sizes are in SCREEN pixels -- they are
  // scaled back up against the camera zoom so they stay readable.
  bubble: {
    font: '17px sans-serif',
    lineHeight: 21,
    maxWidth: 190, // px before wrapping onto another line
    paddingX: 12,
    paddingY: 9,
    radius: 12,
    tail: 10,
    gapAboveSpeaker: 14,
    fill: '#1f4e6b',
    border: '#0d1117',
    textColor: '#f7f3e3',
  },
  hud: {
    font: 'bold 26px sans-serif',
    smallFont: '16px sans-serif',
    color: '#f7f3e3',
    warnColor: '#ffb347',
    warnBelow: 5, // s left when the timer turns warnColor
    shadowColor: 'rgba(13, 17, 23, 0.75)',
    marginX: 28,
    marginY: 30,
    // The instruction panel in the sky, top centre.
    // The instruction banner at the top. Nearly opaque and darker than it
    // was (0.85 of a mid blue): over the Clinic's bright skylight the art
    // showed through behind the words.
    hintFont: 'bold 26px sans-serif',
    hintLineHeight: 26, // px, the banner's text row -- match the font size
    hintColor: '#ffffff',
    hintFill: 'rgba(14, 38, 56, 0.96)',
    hintBorder: '#0d1117',
    hintBorderWidth: 3, // px
    hintPaddingX: 22,
    hintPaddingY: 11,
    hintTop: 22, // px from the top of the screen
  },
  // Placeholder copy -- author-owned (AGENTS.md §10), rewrite freely.
  lines: {
    think: 'How hard can it be to work as an administrator?',
    welcome: 'Welcome! Time to test your skills.',
    ready: "Let's go!",
    round1Task: 'Register patient',
    // The instruction shown in the sky, top centre, for the whole round.
    round1Hint: 'Grab each patient file before the time runs out',
    round1Cleared: 'Nicely done. That was the easy part.',
    roundFailed: 'Too slow! Again.',
    round2Intro: 'Oh, and you have to sort these at the same time.',
    round2Task: 'Register patient, book patient',
    round2Hint: 'Grab the files AND sort the cards before the time runs out',
    sortTooltip: 'Drag each card into the box with the same colour',
    round2Cleared: 'Not bad. Not bad at all.',
    round3Intro: 'Busy day! Handle a complaint, register and book. Oh, and this one is not an EU citizen.',
    round3Task: 'Complaint, register, book, non-EU patient — and sort!',
    round3Hint: 'Busy day! Every task AND the whole deck before the time runs out',
    round3SortTooltip: 'Only the top card moves: drag it to its colour',
    round3Cleared: '...wow. You actually did it.',
    round3Failed: 'Good try! A hectic front desk is not for everyone ;) (It is possible.)',
    roundSkipped: 'Fair enough. Moving on!',
  },
};

// Background music (music.js). One track plays at a time; a change
// crossfades -- the old track fades out over fadeOutDuration (or the new
// track's fadeOutPrevious, when it sets one) while the new one fades in
// over its own fadeIn. Which track plays where is level data
// (level.js 'background-section' entries carry `music`) plus the two boss
// fights (game.js currentMusic). Files come from scripts/encode-music.py,
// already loudness-matched, so one volume serves every track.
export const MUSIC = {
  volume: 0.7, // 0..1, the level every track plays at
  fadeOutDuration: 1.2, // s for the outgoing track to fade to silence
  tracks: {
    // loop: false = a one-off cue (music.js playMusicCue) that plays once
    // over whatever was playing, which resumes when the cue ends.
    exploration: { path: 'assets/audio/exploration.mp3', loop: true, fadeIn: 1.5 },
    'student-ceremony': { path: 'assets/audio/student-ceremony.mp3', loop: false, fadeIn: 0 },
    'research-golem': { path: 'assets/audio/research-golem.mp3', loop: true, fadeIn: 0.3 },
    // A long, overlapping crossfade: exploration and the Clinic track are
    // very different, and a quick change between them sounded abrupt.
    clinic: { path: 'assets/audio/clinic.mp3', loop: true, fadeIn: 2.5, fadeOutPrevious: 2.5 },
    usa: { path: 'assets/audio/usa.mp3', loop: true, fadeIn: 0.8 },
    graduation: { path: 'assets/audio/graduation.mp3', loop: true, fadeIn: 0.3 },
  },
};
