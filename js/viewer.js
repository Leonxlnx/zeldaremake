// The 16:9 stage: Before/After wipe, Reference wipe, Onion skin, Side by side; callout pins with
// leader lines into the legend; director's-frame chrome; STRUCK stamp; waiting state.

import { $, $$, esc, timecode, kindOf, clamp, pad, fmtDur, fmtTime, KIND_COLORS, toast } from './util.js';
import { state, set, MODES } from './state.js';
import { dataUrl } from './data.js';
import { nextCaptureAt } from './slate.js';

const MODE_LABELS = { before: 'Before / After', reference: 'Reference', onion: 'Onion skin', side: 'Side by side' };
const MODE_KEYS = { before: 'B/A', reference: 'REF', onion: 'ONION', side: 'SIDE' };

let pinnedId = null;
let hoverId = null;

/* ------------------------------------------------------------------ toolbar */
export function renderToolbar(root, data) {
  const take = data.byId[state.takeId] || null;
  const scene = take?.slate?.scene?.toUpperCase();
  const modes = MODES.map((m) => `<button type="button" data-mode="${m}" aria-pressed="${state.mode === m}" ${take ? '' : 'disabled'} title="${MODE_LABELS[m]}">${MODE_LABELS[m]}</button>`).join('');
  const vps = data.viewpoints.map((v) => `<button type="button" class="vp-tab" data-vp="${esc(v.id)}" aria-pressed="${state.viewpoint === v.id}" title="${esc(v.id)} · TC ${timecode(v.refSeconds)}"><b>${esc(v.letter)}</b>${esc(v.label)}${scene === v.letter ? '<i class="scene-dot" title="hero scene of this take"></i>' : ''}</button>`).join('');
  root.innerHTML = `
    <div class="seg" role="group" aria-label="Compare mode">${modes}</div>
    <div class="vp-tabs" role="group" aria-label="Viewpoint">${vps}</div>
    <div class="tool-right">
      ${state.mode === 'onion' && take ? `<label class="onion-ctl">Ref opacity <input type="range" min="0" max="100" value="${Math.round(state.onion * 100)}" data-onion aria-label="Onion skin opacity"><span data-onion-val>${Math.round(state.onion * 100)}%</span></label>` : ''}
      <button type="button" class="toggle" data-pins aria-pressed="${state.pins}" title="Toggle callout pins (P)"><span class="sw"></span>Pins</button>
    </div>`;
}

export function bindToolbar(root) {
  root.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]');
    if (m && !m.disabled) { set({ mode: m.dataset.mode }); return; }
    const v = e.target.closest('[data-vp]');
    if (v) { set({ viewpoint: v.dataset.vp }); return; }
    const p = e.target.closest('[data-pins]');
    if (p) { set({ pins: !state.pins }); }
  });
  root.addEventListener('input', (e) => {
    const r = e.target.closest('[data-onion]');
    if (!r) return;
    const v = clamp(Number(r.value) / 100, 0, 1);
    set({ onion: v }, { silent: true });
    const img = $('#stage .img-onion');
    if (img) img.style.opacity = v;
    const tag = $('#stage [data-onion-tag]');
    if (tag) tag.textContent = `${Math.round(v * 100)}%`;
    const out = $('[data-onion-val]', root);
    if (out) out.textContent = `${Math.round(v * 100)}%`;
  });
}

/* ------------------------------------------------------------------ stage */
export function renderStage(root, data) {
  const take = data.byId[state.takeId] || null;
  const vp = data.vpById[state.viewpoint] || data.viewpoints[0];
  root.dataset.mode = take ? state.mode : 'before';
  root.classList.toggle('is-struck', !!take && !take.valid);
  pinnedId = null;

  if (!vp) { root.innerHTML = '<div class="missing-note">No viewpoints</div>'; return; }
  if (!take) { renderWaiting(root, data, vp); return; }

  const shot = take.shotBy[vp.id];
  if (!shot) {
    root.innerHTML = `<div class="missing-note">NO ${esc(vp.id)} SHOT IN ${esc(take.id.toUpperCase())}</div>${frameUi(vp, take)}`;
    return;
  }
  const W = root.clientWidth || 960;
  const ours = dataUrl(shot.image);
  const ref = dataUrl(shot.reference || vp.reference);
  const prev = shot.previous ? dataUrl(shot.previous) : null;
  const tcode = timecode(shot.refSeconds ?? vp.refSeconds);
  let html = '';

  if (state.mode === 'side') {
    const half = W / 2;
    html = `<div class="panes">
      <div class="pane pane-ref">${img(ref, 'img-ref')}${pinsHtml(shot.refCallouts, 'r', true, half)}
        <div class="tag tag-tl ref"><b>Reference</b> · TC ${tcode}</div></div>
      <div class="pane pane-ours">${img(ours, 'img-ours')}${pinsHtml(shot.callouts, 'o', false, half)}
        <div class="tag tag-tr"><b>Ours</b> · ${esc(take.id)}</div></div>
    </div>`;
  } else if (state.mode === 'onion') {
    html = `<div class="panes"><div class="pane">
      ${img(ours, 'img-ours')}${img(ref, 'img-ref img-onion', `opacity:${state.onion}`)}
      ${pinsHtml(shot.callouts, 'o', false, W)}
      <div class="tag tag-tl ref"><b>Reference</b> @ <span data-onion-tag>${Math.round(state.onion * 100)}%</span> over ours</div>
      <div class="tag tag-tr"><b>Ours</b> · ${esc(take.id)}</div>
    </div></div>`;
  } else {
    const isRef = state.mode === 'reference';
    const other = isRef ? ref : prev;
    const clip = `clip-path: inset(0 ${(100 - state.wipe * 100).toFixed(2)}% 0 0)`;
    html = `<div class="panes"><div class="pane is-wipe">
      ${img(ours, 'img-ours')}
      ${other ? img(other, 'img-other', clip) : `<div class="img-other missing-note" style="${clip}">FIRST CAPTURE OF ${esc(vp.id)}<br><small>no previous take to wipe against</small></div>`}
      ${pinsHtml(shot.callouts, 'o', false, W)}
      ${isRef ? pinsHtml(shot.refCallouts, 'r', true, W) : ''}
      <div class="wipe" style="left:${state.wipe * 100}%"><button type="button" class="wipe-handle" role="slider" aria-label="Wipe position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(state.wipe * 100)}" aria-orientation="horizontal" title="Drag · ← → to nudge">◂▸</button></div>
      <div class="tag tag-tl ${isRef ? 'ref' : 'before'}">${isRef ? `<b>Reference</b> · TC ${tcode}` : `<b>Before</b> · ${take.prev ? esc(take.prev.id) : 'none'}`}</div>
      <div class="tag tag-tr"><b>${isRef ? 'Ours' : 'After'}</b> · ${esc(take.id)}</div>
    </div></div>`;
  }
  html += frameUi(vp, take, shot);
  if (!take.valid) html += `<div class="struck">STRUCK<small>${esc(take.invalid || 'invalid take')}</small></div>`;
  root.innerHTML = html;
  bindImages(root);
  markOffSide(root);
  preloadNeighbours(take, vp.id);
}

function img(src, cls, style = '') {
  return `<img class="img ${cls}" src="${esc(src)}" alt="" draggable="false" decoding="async"${style ? ` style="${esc(style)}"` : ''}>`;
}

function frameUi(vp, take, shot) {
  const tc = timecode(shot?.refSeconds ?? vp.refSeconds);
  return `<div class="frame-ui"><div class="vig"></div>
    <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i><i class="crosshair"></i>
    <div class="tc">TC <b>${tc}</b>${take ? ` · T${pad(take.number ?? take.index + 1)}` : ''}</div>
    <div class="vp-label"><b>${esc(vp.letter)}</b> ${esc(vp.label)} · ${esc(vp.id)}</div>
  </div>`;
}

function pinsHtml(list, prefix, isRef, paneWidth) {
  if (!Array.isArray(list) || !list.length) return '';
  const flipAt = clamp(1 - 270 / Math.max(320, paneWidth), 0.45, 0.8);
  const pins = list.map((c, i) => {
    const x = clamp(Number(c.x) || 0, 0, 1);
    const y = clamp(Number(c.y) || 0, 0, 1);
    const kind = isRef ? 'reference' : kindOf(c.kind);
    const id = `${prefix}${i + 1}`;
    const num = isRef ? `R${i + 1}` : String(i + 1);
    return `<div class="pin kind-${kind}${x > flipAt ? ' flip' : ''}" data-pin="${id}" data-x="${x}" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%">
      <span class="pin-dot" title="${esc(c.label || '')}">${num}</span><span class="pin-line"></span>
      <span class="pin-chip">${c.item ? `<span class="it">${esc(c.item)}</span>` : ''}${esc(c.label || '')}</span></div>`;
  }).join('');
  return `<div class="pins ${isRef ? 'pins-ref' : 'pins-ours'}${state.pins ? '' : ' hidden'}">${pins}</div>`;
}

function bindImages(root) {
  for (const im of $$('img.img', root)) {
    im.addEventListener('error', () => {
      im.classList.add('is-missing');
      const note = document.createElement('div');
      note.className = 'missing-note';
      note.innerHTML = `IMAGE MISSING<br><small>${esc(im.getAttribute('src'))}</small>`;
      if (im.style.clipPath) note.style.clipPath = im.style.clipPath;
      im.after(note);
    }, { once: true });
  }
}

function preloadNeighbours(take, vpId) {
  for (const t of [take.prev, take.next]) {
    const s = t?.shotBy?.[vpId];
    if (s?.image) { const i = new Image(); i.src = dataUrl(s.image); }
  }
}

function renderWaiting(root, data, vp) {
  const now = Date.now();
  const nextAt = nextCaptureAt(now, data.cadenceMin * 60_000, NaN);
  root.innerHTML = `
    <div class="panes"><div class="pane">${img(dataUrl(vp.reference), 'img-ref')}
      <div class="tag tag-tl ref"><b>Reference</b> · TC ${timecode(vp.refSeconds)}</div>
      <div class="tag tag-tr"><b>Ours</b> · no take yet</div>
    </div></div>
    <div class="waiting"><div class="w-in">
      <div class="w-k">No signal · standby</div>
      <h2>Waiting for the first take</h2>
      <p>Next capture at the top of the hour · <b>in ${esc(fmtDur(nextAt - now))}</b> (${esc(fmtTime(nextAt))} UTC).<br>Reference frames and the rubric are live below; the viewpoint tabs browse the reference.</p>
      <div class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
    </div></div>
    ${frameUi(vp, null)}`;
  bindImages(root);
}

/* ------------------------------------------------------------------ wipe interaction */
export function bindStage(root) {
  let dragging = false;
  const paneOf = () => $('.pane.is-wipe', root);
  const setFromEvent = (e, pane) => {
    const r = pane.getBoundingClientRect();
    setWipe((e.clientX - r.left) / Math.max(1, r.width));
  };
  root.addEventListener('pointerdown', (e) => {
    const pane = e.target.closest('.pane.is-wipe');
    if (!pane || e.target.closest('.pin-dot, .pin-chip')) return;
    dragging = true;
    root.setPointerCapture?.(e.pointerId);
    setFromEvent(e, pane);
    e.preventDefault();
  });
  root.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const pane = paneOf();
    if (pane) setFromEvent(e, pane);
  });
  const stop = () => { dragging = false; };
  root.addEventListener('pointerup', stop);
  root.addEventListener('pointercancel', stop);
  root.addEventListener('lostpointercapture', stop);

  root.addEventListener('keydown', (e) => {
    if (!e.target.classList.contains('wipe-handle')) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft') setWipe(state.wipe - step);
    else if (e.key === 'ArrowRight') setWipe(state.wipe + step);
    else if (e.key === 'Home') setWipe(0);
    else if (e.key === 'End') setWipe(1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  });

  root.addEventListener('pointerover', (e) => {
    const p = e.target.closest('.pin');
    if (p) { hoverId = p.dataset.pin; applyHighlight(); }
  });
  root.addEventListener('pointerout', (e) => {
    const p = e.target.closest('.pin');
    if (p && hoverId === p.dataset.pin) { hoverId = null; applyHighlight(); }
  });
  root.addEventListener('click', (e) => {
    const p = e.target.closest('.pin');
    if (!p) return;
    pinnedId = pinnedId === p.dataset.pin ? null : p.dataset.pin;
    applyHighlight();
    const lg = $(`#callouts .lg[data-pin="${p.dataset.pin}"]`);
    if (lg && pinnedId) lg.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function setWipe(v) {
  set({ wipe: clamp(v, 0, 1) }, { silent: true });
  applyWipe();
}

export function applyWipe() {
  const root = $('#stage');
  const other = $('.img-other', root);
  const wipe = $('.wipe', root);
  const pct = (state.wipe * 100).toFixed(2);
  if (other) other.style.clipPath = `inset(0 ${(100 - state.wipe * 100).toFixed(2)}% 0 0)`;
  if (wipe) {
    wipe.style.left = `${pct}%`;
    $('.wipe-handle', wipe)?.setAttribute('aria-valuenow', Math.round(state.wipe * 100));
  }
  markOffSide(root);
}

/** Pins that currently sit over the "other" image get dimmed (they annotate ours). */
function markOffSide(root) {
  const pane = $('.pane.is-wipe', root);
  if (!pane) return;
  for (const p of $$('.pins-ours .pin', pane)) p.classList.toggle('off-side', Number(p.dataset.x) < state.wipe);
  for (const p of $$('.pins-ref .pin', pane)) p.classList.toggle('off-side', Number(p.dataset.x) > state.wipe);
}

/* ------------------------------------------------------------------ legend */
export function renderCallouts(root, data) {
  const take = data.byId[state.takeId] || null;
  const shot = take?.shotBy?.[state.viewpoint];
  const ours = Array.isArray(shot?.callouts) ? shot.callouts : [];
  const refs = Array.isArray(shot?.refCallouts) ? shot.refCallouts : [];
  const showRef = state.mode === 'reference' || state.mode === 'side';

  const counts = [];
  if (ours.length) counts.push(`${ours.length} on ours`);
  if (refs.length) counts.push(`${refs.length} on reference`);

  let body = '';
  if (!take) {
    body = `<p class="empty-note">Callouts appear here once the first take is published. Agents pin what changed (<b>new</b>), what got closer to the reference (<b>improved</b>), what is still missing (<b>todo</b>) and what got worse (<b>regression</b>).</p>`;
  } else if (!ours.length && !refs.length) {
    body = `<p class="empty-note">No callouts on <b>${esc(state.viewpoint)}</b> for ${esc(take.id)}.</p>`;
  } else {
    if (ours.length) body += `<ol class="legend legend-ours">${ours.map((c, i) => legendRow(c, `o${i + 1}`, String(i + 1), kindOf(c.kind), data)).join('')}</ol>`;
    if (refs.length) {
      if (showRef) {
        body += `<div class="legend-h"><span class="k" style="color:var(--blue)">On the reference</span></div>
          <ol class="legend legend-ref">${refs.map((c, i) => legendRow(c, `r${i + 1}`, `R${i + 1}`, 'reference', data)).join('')}</ol>`;
      } else {
        body += `<p class="empty-note" style="margin-top:8px">${refs.length} reference pin${refs.length > 1 ? 's' : ''} — <a href="#" data-goto-mode="reference">switch to Reference</a> or <a href="#" data-goto-mode="side">Side by side</a> to see them.</p>`;
      }
    }
  }
  body += `<div class="kinds" aria-label="Pin colours">${Object.entries(KIND_COLORS).map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join('')}</div>`;

  root.innerHTML = `<div class="panel-h"><span class="t">Callouts</span><span class="sub">${esc(counts.join(' · ') || (take ? 'none on this shot' : 'standby'))}</span></div>${body}`;
}

function legendRow(c, id, num, kind, data) {
  const item = c.item ? String(c.item) : '';
  const st = item && data.byId[state.takeId]?.score?.items?.[item]?.status;
  return `<li class="lg kind-${kind}" data-pin="${id}" tabindex="0">
    <span class="lg-num">${esc(num)}</span>
    <span class="lg-label">${esc(c.label || '')}</span>
    <span class="lg-meta">${item ? `<a class="chip ${esc(st || '')}" href="#" data-goto-item="${esc(item)}" title="${esc(data.rubricById[item]?.title || item)}">${esc(item)}</a>` : ''}<span class="lg-kind">${esc(kind)}</span></span>
  </li>`;
}

export function bindCallouts(root) {
  root.addEventListener('pointerover', (e) => {
    const lg = e.target.closest('.lg');
    if (lg) { hoverId = lg.dataset.pin; applyHighlight(); }
  });
  root.addEventListener('pointerout', (e) => {
    const lg = e.target.closest('.lg');
    if (lg && hoverId === lg.dataset.pin) { hoverId = null; applyHighlight(); }
  });
  root.addEventListener('focusin', (e) => {
    const lg = e.target.closest('.lg');
    if (lg) { hoverId = lg.dataset.pin; applyHighlight(); }
  });
  root.addEventListener('focusout', (e) => {
    const lg = e.target.closest('.lg');
    if (lg && hoverId === lg.dataset.pin) { hoverId = null; applyHighlight(); }
  });
  root.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto-item]');
    if (go) {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('monitor:goto-item', { detail: { id: go.dataset.gotoItem } }));
      return;
    }
    const gm = e.target.closest('[data-goto-mode]');
    if (gm) { e.preventDefault(); set({ mode: gm.dataset.gotoMode }); return; }
    const lg = e.target.closest('.lg');
    if (lg) {
      pinnedId = pinnedId === lg.dataset.pin ? null : lg.dataset.pin;
      applyHighlight();
      if (pinnedId && !state.pins) { set({ pins: true }); toast('Pins shown'); }
    }
  });
  root.addEventListener('keydown', (e) => {
    const lg = e.target.closest('.lg');
    if (lg && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); lg.click(); }
  });
}

function applyHighlight() {
  const id = hoverId || pinnedId;
  const any = !!id;
  for (const n of $$('#stage .pin, #callouts .lg, #leaders [data-pin]')) n.classList.toggle('hl', any && n.dataset.pin === id);
  for (const n of $$('#stage .pins')) n.classList.toggle('dimmed', any);
  $('#leaders')?.classList.toggle('dimmed', any);
}

/* ------------------------------------------------------------------ leader lines */
export function drawLeaders() {
  const svg = $('#leaders');
  const grid = $('#monitor-grid');
  if (!svg || !grid) return;
  svg.innerHTML = '';
  if (!state.pins || getComputedStyle(svg).display === 'none') return;
  const gRect = grid.getBoundingClientRect();
  const stage = $('#stage');
  const sRect = stage.getBoundingClientRect();
  let out = '';
  for (const lg of $$('#callouts .lg')) {
    const id = lg.dataset.pin;
    const pin = $(`#stage .pin[data-pin="${id}"]`);
    if (!pin) continue;
    const dot = $('.pin-dot', pin);
    const chip = $('.pin-chip', pin);
    const flip = pin.classList.contains('flip');
    const src = (flip ? dot : chip).getBoundingClientRect();
    // start at the right edge of the chip (or the dot when flipped), clamped inside the stage
    const sx = clamp(src.right, sRect.left, sRect.right) - gRect.left;
    const sy = clamp(src.top + src.height / 2, sRect.top, sRect.bottom) - gRect.top;
    const lr = lg.getBoundingClientRect();
    const lx = lr.left - gRect.left;
    const ly = lr.top + lr.height / 2 - gRect.top;
    const kind = [...pin.classList].find((c) => c.startsWith('kind-'))?.slice(5) || 'new';
    const col = KIND_COLORS[kind] || KIND_COLORS.new;
    const mx = sx + (lx - sx) * 0.55;
    const hl = pin.classList.contains('hl') ? ' hl' : '';
    out += `<path class="${hl}" data-pin="${id}" stroke="${col}" d="M${sx.toFixed(1)},${sy.toFixed(1)} C${mx.toFixed(1)},${sy.toFixed(1)} ${mx.toFixed(1)},${ly.toFixed(1)} ${(lx - 2).toFixed(1)},${ly.toFixed(1)}"/>
      <circle data-pin="${id}" cx="${(lx - 2).toFixed(1)}" cy="${ly.toFixed(1)}" r="3" fill="${col}"/>`;
  }
  svg.innerHTML = out;
}
