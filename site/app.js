// Director's Monitor — entry point. Loads ./data/*.json, wires the modules, handles keyboard,
// hash deep-links (#take-0007/A_stairs/reference) and the 5-minute auto-refresh.

import { $, $$, toast } from './js/util.js';
import { state, set, subscribe, readHash, onHashChange, MODES, VIEWS } from './js/state.js';
import { loadAll } from './js/data.js';
import { renderSlate, renderLive } from './js/slate.js';
import { renderToolbar, bindToolbar, renderStage, bindStage, renderCallouts, bindCallouts, drawLeaders } from './js/viewer.js';
import { renderNotes, renderMetrics, renderRubric, bindRubric, renderCrew } from './js/panels.js';
import { renderFilmstrip, bindFilmstrip, stepTake, gotoTake } from './js/filmstrip.js';
import { renderReel, updateReel, bindReel, setReelData, stopTimer, currentIndex } from './js/reel.js';

const REFRESH_MS = 5 * 60 * 1000;
const LIVE_TICK_MS = 30 * 1000;

let data = null;
const R = {
  slate: () => renderSlate(data),
  live: () => renderLive(data),
  toolbar: () => renderToolbar($('#viewer-toolbar'), data),
  stage: () => renderStage($('#stage'), data),
  callouts: () => renderCallouts($('#callouts'), data),
  notes: () => renderNotes($('#notes'), data),
  metrics: () => renderMetrics($('#metrics'), data),
  rubric: () => renderRubric($('#rubric'), data),
  crew: () => renderCrew($('#crew'), data),
  filmstrip: () => renderFilmstrip($('#filmstrip'), data),
  reel: () => { if (state.view === 'reel') renderReel($('#view-reel'), data); },
  view: applyView,
};
const ORDER = ['view', 'slate', 'live', 'toolbar', 'stage', 'callouts', 'notes', 'metrics', 'rubric', 'crew', 'filmstrip', 'reel'];
const DEPS = {
  takeId: ['slate', 'toolbar', 'stage', 'callouts', 'notes', 'metrics', 'rubric', 'crew', 'filmstrip', 'reel'],
  viewpoint: ['slate', 'toolbar', 'stage', 'callouts', 'metrics', 'filmstrip', 'reel'],
  mode: ['toolbar', 'stage', 'callouts'],
  pins: ['toolbar', 'stage', 'callouts'],
  rubricFilter: ['rubric'],
  view: ['view', 'reel'],
};

function renderAll() {
  for (const k of ORDER) R[k]();
  scheduleLeaders();
}

function onChange(changed) {
  if (changed.every((k) => k === 'reelIndex' || k === 'reelPlaying')) {
    if (state.view === 'reel') updateReel($('#view-reel'), data);
    return;
  }
  const todo = new Set();
  for (const k of changed) for (const r of DEPS[k] || []) todo.add(r);
  for (const k of ORDER) if (todo.has(k)) R[k]();
  scheduleLeaders();
}

function applyView() {
  const reel = state.view === 'reel';
  $('#view-monitor').hidden = reel;
  $('#view-reel').hidden = !reel;
  for (const b of $$('#view-tabs .tab')) {
    const on = b.dataset.view === state.view;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  }
  if (!reel) { stopTimer(); if (state.reelPlaying) set({ reelPlaying: false }, { silent: true }); }
  document.title = `${reel ? 'Reel' : 'Monitor'} · ${state.takeId ? state.takeId.toUpperCase() : 'standby'} · Kokiri Forest Remake`;
}

// Coalesce redraws into one zero-timeout (not rAF: headless/throttled tabs fire rAF very late,
// and getBoundingClientRect() forces layout synchronously anyway).
let leaderTimer = 0;
function scheduleLeaders() {
  clearTimeout(leaderTimer);
  leaderTimer = setTimeout(() => { fitStage(); drawLeaders(); }, 0);
}

/**
 * Keep picture + metrics visible above the sticky filmstrip: measure everything that is not the
 * stage and publish it as --stage-reserve (the stage width is derived from 100vh minus this).
 */
let lastReserve = 0;
function fitStage() {
  if (window.innerWidth < 1000) return;
  const h = (sel) => $(sel)?.offsetHeight || 0;
  const slate = $('#slate');
  const slateBox = slate ? slate.offsetHeight + parseFloat(getComputedStyle(slate).marginTop || '0') : 0;
  const mainPad = parseFloat(getComputedStyle($('main')).paddingTop || '0');
  const frame = $('.stage-frame');
  const framePad = frame ? parseFloat(getComputedStyle(frame).paddingTop || '0') * 2 : 14;
  const reserve = Math.round(slateBox + mainPad + h('#viewer-toolbar') + 10 + framePad + 10 + h('#metrics') + h('#filmstrip') + 8);
  if (Math.abs(reserve - lastReserve) > 1) {
    lastReserve = reserve;
    document.documentElement.style.setProperty('--stage-reserve', `${reserve}px`);
  }
}

/** Resolve a hash patch against the data (unknown ids fall back to sensible defaults). */
function resolve(patch, initial) {
  const p = {};
  if (patch.takeId && data.byId[patch.takeId]) p.takeId = patch.takeId;
  else if (initial || !data.byId[state.takeId]) p.takeId = data.latest?.id || null;
  if (patch.viewpoint && data.vpById[patch.viewpoint]) p.viewpoint = patch.viewpoint;
  else if (initial) {
    const scene = (data.byId[p.takeId ?? state.takeId]?.slate?.scene || '').toUpperCase();
    const hero = data.viewpoints.find((v) => v.letter === scene) || data.viewpoints[0];
    p.viewpoint = hero?.id || 'A_stairs';
  }
  if (patch.mode && MODES.includes(patch.mode)) p.mode = patch.mode;
  // the hash is the full navigation state: no "/reel" segment means the monitor view
  p.view = patch.view && VIEWS.includes(patch.view) ? patch.view : 'monitor';
  return p;
}

function openInMonitor() {
  const takes = data.takes.filter((t) => t.shotBy[state.viewpoint]);
  const i = currentIndex(data);
  set({ view: 'monitor', takeId: takes[i]?.id || state.takeId, reelPlaying: false });
}

function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.closest?.('input, textarea, select, [contenteditable]')) return;
    // a focused wipe handle owns the arrow/Home/End keys (see viewer.js); letters still work
    if (t.closest?.('[role="slider"]') && /^(Arrow|Home|End)/.test(e.key)) return;
    const reel = state.view === 'reel';
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        if (reel) {
          const n = data.takes.filter((x) => x.shotBy[state.viewpoint]).length;
          if (n) set({ reelIndex: Math.min(n - 1, Math.max(0, currentIndex(data) + dir)), reelPlaying: false });
        } else stepTake(data, dir);
        e.preventDefault();
        break;
      }
      case 'Home': if (reel) set({ reelIndex: 0, reelPlaying: false }); else gotoTake(data, 0); e.preventDefault(); break;
      case 'End': if (reel) set({ reelIndex: -1, reelPlaying: false }); else gotoTake(data, -1); e.preventDefault(); break;
      case ' ': if (reel) { set({ reelPlaying: !state.reelPlaying }); e.preventDefault(); } break;
      case 'p': case 'P': set({ pins: !state.pins }); toast(state.pins ? 'Pins shown' : 'Pins hidden'); break;
      case '1': case '2': case '3': case '4': if (data.latest) set({ mode: MODES[Number(e.key) - 1] }); break;
      default: {
        const letter = e.key.length === 1 ? e.key.toUpperCase() : '';
        const vp = letter && data.viewpoints.find((v) => v.letter === letter);
        if (vp) set({ viewpoint: vp.id });
      }
    }
  });
}

async function refresh() {
  let fresh;
  try { fresh = await loadAll(); } catch (e) { console.warn('[monitor] refresh failed', e); return; }
  const changed = fresh.updatedAt !== data.updatedAt || fresh.takes.length !== data.takes.length;
  const wasLatest = !state.takeId || state.takeId === data.latest?.id;
  data = fresh;
  setReelData($('#view-reel'), data);
  if (changed) {
    if (wasLatest || !data.byId[state.takeId]) set({ takeId: data.latest?.id || null }, { silent: true });
    renderAll();
    if (data.latest) toast(`New take published: ${data.latest.id.toUpperCase()}`);
  } else {
    R.live();
    R.crew();
  }
}

async function boot() {
  data = await loadAll();
  set(resolve(readHash(), true), { silent: true });

  bindToolbar($('#viewer-toolbar'));
  bindStage($('#stage'));
  bindCallouts($('#callouts'));
  bindRubric($('#rubric'));
  bindFilmstrip($('#filmstrip'));
  bindReel($('#view-reel'), data, openInMonitor);
  $('#view-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) set({ view: b.dataset.view });
  });
  bindKeyboard();
  subscribe(onChange);
  onHashChange((patch) => set(resolve(patch, false)));

  renderAll();

  // Leader lines follow layout changes (sidebar height, window size, fonts).
  const ro = new ResizeObserver(() => scheduleLeaders());
  ro.observe($('#monitor-grid'));
  ro.observe($('#callouts'));
  window.addEventListener('resize', () => { R.stage(); scheduleLeaders(); });

  setInterval(refresh, REFRESH_MS);
  setInterval(() => R.live(), LIVE_TICK_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { R.live(); scheduleLeaders(); } });
}

boot().catch((e) => {
  console.error('[monitor] boot failed', e);
  const live = $('#live .live-text');
  if (live) live.textContent = `ERROR · ${e.message}`;
  $('#live')?.classList.add('is-stale');
});
