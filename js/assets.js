// assets.js — asset loading + manifest (AGENTS.md §5).
//
// The manifest is empty: no art or audio is integrated yet (that's
// Milestone 6 -- see PLAN.md 6.1 and 6.6). loadAssets() is the real
// mechanism the loading screen (task 4.2) depends on, not a placeholder;
// it just has nothing to load today, so it resolves immediately. When
// Milestone 6 adds real files, they get pushed into MANIFEST and this
// function starts actually loading them -- the title screen doesn't
// change.

export const MANIFEST = []; // { path } entries; empty until Milestone 6.

// Loads every entry in MANIFEST, reporting progress via onProgress(0..1)
// as each one settles. A failed asset still counts toward progress rather
// than hanging the loading screen forever -- a missing file is a bug to
// fix, not a reason to trap the player on the title screen.
export function loadAssets(onProgress) {
  const total = MANIFEST.length;
  if (total === 0) {
    onProgress(1);
    return Promise.resolve();
  }

  let settled = 0;
  const reportOne = () => {
    settled += 1;
    onProgress(settled / total);
  };

  return Promise.all(MANIFEST.map((entry) => loadOne(entry).then(reportOne, reportOne)));
}

function loadOne(entry) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = reject;
    image.src = entry.path;
  });
}
