// input.js — keyboard state only. No game logic lives here.

const BINDINGS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'ArrowUp', 'KeyW'],
  shoot: ['KeyF'],
};

const keysDown = new Set();
const pressedThisFrame = new Set();

// Left mouse button as an alternative fire input (task A): arrow-key
// players have F on the wrong side of the keyboard, a click needs no
// explanation. Tracked as its own flag, not a BINDINGS code, since a
// mouse button isn't a KeyboardEvent.code.
let mouseDown = false;

// The mouse as a pointer (the Clinic reception's drag and drop,
// reception.js): position in the canvas's own 1280x720 coordinates, however
// large the canvas is drawn on screen, plus press/release edges that are
// cleared with the keyboard's in clearFrameInput.
// pressX/pressY: where the button went down -- a quick flick can press,
// move and release all between two steps, and the press still has to land
// on what was under it at the time.
const pointer = { x: 0, y: 0, pressX: 0, pressY: 0, down: false, pressed: false, released: false };

// Input suppression (PLAN.md task 3.5): the utspring sequence ignores the
// player entirely for its four to six seconds, including fire. This is a
// flag on the existing system, not a second input path -- the handlers
// below keep recording exactly as they always do, and only the two
// readers stop answering. Setting it either way drops all held and
// pressed state (see resetInput), so nothing the player mashed during the
// sequence can fire the moment control comes back.
let suppressed = false;

export function setInputSuppressed(value) {
  suppressed = value;
  resetInput();
}

export function initInput(target = window) {
  target.addEventListener('keydown', (event) => {
    if (!keysDown.has(event.code)) pressedThisFrame.add(event.code);
    keysDown.add(event.code);
  });
  target.addEventListener('keyup', (event) => {
    keysDown.delete(event.code);
  });
  // Losing focus means no keyup ever arrives for a key that was held
  // (task 3.10): without this, alt-tabbing away mid-run leaves 'right'
  // stuck down and the player sprints off on their own the moment focus
  // returns. Forget everything instead -- on return the player is holding
  // whatever they are actually holding.
  target.addEventListener('blur', resetInput);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetInput();
  });

  // mousedown is scoped to the canvas itself, not window: while a DOM
  // screen (title, comic, application-bound) is showing, it's an opaque
  // element stacked above the canvas and receives the click instead, so
  // this handler simply never fires -- no gameState check needed here.
  // mouseup is on window regardless, so releasing off-canvas still stops
  // fire instead of leaving it stuck held.
  const canvas = document.querySelector('#game');
  if (canvas) {
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      mouseDown = true;
      updatePointerPosition(canvas, event);
      pointer.pressX = pointer.x;
      pointer.pressY = pointer.y;
      pointer.down = true;
      pointer.pressed = true;
    });
    window.addEventListener('mousemove', (event) => updatePointerPosition(canvas, event));
  }
  window.addEventListener('mouseup', (event) => {
    if (event.button !== 0) return;
    // The release point is where a dragged card lands, even if no
    // mousemove arrived between the last move and the release.
    if (canvas) updatePointerPosition(canvas, event);
    mouseDown = false;
    if (pointer.down) pointer.released = true;
    pointer.down = false;
  });
}

function updatePointerPosition(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) * canvas.width) / rect.width;
  pointer.y = ((event.clientY - rect.top) * canvas.height) / rect.height;
}

// The pointer, in canvas coordinates. While input is suppressed it still
// reports where it is, but never as held, pressed or released.
export function getPointer() {
  if (suppressed) return { ...pointer, down: false, pressed: false, released: false };
  return { ...pointer };
}

// Drops all held and pressed state. Called on focus loss; safe to call at
// any time.
export function resetInput() {
  keysDown.clear();
  pressedThisFrame.clear();
  mouseDown = false;
  pointer.down = false;
  pointer.pressed = false;
  pointer.released = false;
}

// True every frame the action's key (or, for 'shoot', the left mouse
// button) is held.
export function isActionDown(action) {
  if (suppressed) return false;
  if (action === 'shoot' && mouseDown) return true;
  return BINDINGS[action].some((code) => keysDown.has(code));
}

// True only on the frame the action's key was first pressed.
export function wasActionPressed(action) {
  if (suppressed) return false;
  return BINDINGS[action].some((code) => pressedThisFrame.has(code));
}

// Call after the simulation step (or static screen) that has read this
// frame's edge-triggered presses -- not blindly once per rendered frame.
// See game.js's loop: a rendered frame does not always run a step.
export function clearFrameInput() {
  pressedThisFrame.clear();
  pointer.pressed = false;
  pointer.released = false;
}
