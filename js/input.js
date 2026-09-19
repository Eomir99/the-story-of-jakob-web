// input.js — keyboard state only. No game logic lives here.

const BINDINGS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'ArrowUp', 'KeyW'],
  shoot: ['KeyF'],
};

const keysDown = new Set();
const pressedThisFrame = new Set();

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
}

// Drops all held and pressed state. Called on focus loss; safe to call at
// any time.
export function resetInput() {
  keysDown.clear();
  pressedThisFrame.clear();
}

// True every frame the action's key is held.
export function isActionDown(action) {
  return BINDINGS[action].some((code) => keysDown.has(code));
}

// True only on the frame the action's key was first pressed.
export function wasActionPressed(action) {
  return BINDINGS[action].some((code) => pressedThisFrame.has(code));
}

// Call after the simulation step (or static screen) that has read this
// frame's edge-triggered presses -- not blindly once per rendered frame.
// See game.js's loop: a rendered frame does not always run a step.
export function clearFrameInput() {
  pressedThisFrame.clear();
}
