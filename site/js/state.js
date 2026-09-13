// Tiny observable store + URL-hash deep links:  #take-0007/A_stairs/reference[/reel]

export const MODES = ['before', 'reference', 'onion', 'side'];
export const VIEWS = ['monitor', 'reel'];

export const state = {
  view: 'monitor',
  takeId: null,
  viewpoint: 'A_stairs',
  mode: 'before',
  pins: true,
  onion: 0.5,
  wipe: 0.5,
  rubricFilter: 'all',
  reelIndex: -1,
  reelPlaying: false,
  refFrame: null, // reference-only frame shown on the empty stage (viewpoint id)
};

const HASH_KEYS = ['takeId', 'viewpoint', 'mode', 'view'];
const listeners = new Set();
let suppressHash = false;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Patch the state; notifies listeners with the list of changed keys (unless silent). */
export function set(patch, { silent = false } = {}) {
  const changed = [];
  for (const [k, v] of Object.entries(patch)) {
    if (state[k] !== v) {
      state[k] = v;
      changed.push(k);
    }
  }
  if (!changed.length) return changed;
  if (changed.some((k) => HASH_KEYS.includes(k))) writeHash();
  if (!silent) emit(changed);
  return changed;
}

export function emit(changed) {
  for (const fn of listeners) {
    try {
      fn(changed);
    } catch (e) {
      console.error('[monitor] render error', e);
    }
  }
}

export function readHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (!raw) return {};
  const parts = raw.split('/').filter(Boolean);
  const patch = {};
  for (const p of parts) {
    if (/^take-\d+$/i.test(p)) patch.takeId = p.toLowerCase();
    else if (MODES.includes(p)) patch.mode = p;
    else if (VIEWS.includes(p)) patch.view = p;
    else if (/^[A-Za-z]_[A-Za-z0-9_-]+$/.test(p)) patch.viewpoint = p;
  }
  return patch;
}

export function writeHash() {
  if (suppressHash) return;
  const parts = [];
  if (state.takeId) parts.push(state.takeId);
  parts.push(state.viewpoint, state.mode);
  if (state.view !== 'monitor') parts.push(state.view);
  const h = `#${parts.join('/')}`;
  if (location.hash !== h) {
    suppressHash = true;
    history.replaceState(null, '', h);
    // hashchange doesn't fire for replaceState, but guard anyway
    setTimeout(() => { suppressHash = false; }, 0);
  }
}

export function onHashChange(fn) {
  window.addEventListener('hashchange', () => {
    if (suppressHash) return;
    fn(readHash());
  });
}
