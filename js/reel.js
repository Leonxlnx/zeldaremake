// REEL view: time-lapse of every take for one viewpoint (2 fps player + scrubber) and the
// reference reel (reference/frames/timeline/t_*.jpg, probed — the folder has no index).

import { $, $$, esc, fmtTime, fmtDur, fmtDateTime, timecode, pad, clamp, initial } from './util.js';
import { state, set } from './state.js';
import { dataUrl } from './data.js';

const FPS = 2;
let timer = 0;
let refPreview = null; // { src, label } when a reference frame is being shown in the reel stage
let timelinePromise = null;

function takesFor(data) {
  return data.takes.filter((t) => t.shotBy[state.viewpoint]);
}

export function currentIndex(data) {
  const takes = takesFor(data);
  if (!takes.length) return -1;
  return state.reelIndex >= 0 && state.reelIndex < takes.length ? state.reelIndex : takes.length - 1;
}

export function renderReel(root, data) {
  const vp = data.vpById[state.viewpoint] || data.viewpoints[0];
  const takes = takesFor(data);
  const idx = currentIndex(data);
  const cur = idx >= 0 ? takes[idx] : null;
  const first = takes[0];
  const last = takes[takes.length - 1];

  const vps = data.viewpoints.map((v) => `<button type="button" class="vp-tab" data-vp="${esc(v.id)}" aria-pressed="${state.viewpoint === v.id}" aria-label="${esc(v.letter)} ${esc(v.label)}"><b>${esc(v.letter)}</b><span class="vp-lbl">${esc(v.label)}</span></button>`).join('');

  root.innerHTML = `
    <div class="reel-grid">
      <div class="stage-col">
        <div class="viewer-toolbar"><div class="vp-tabs" role="group" aria-label="Viewpoint">${vps}</div>
          <span class="k">Time-lapse · ${esc(vp?.id || '')} · ${takes.length} frame${takes.length === 1 ? '' : 's'} @ ${FPS} fps</span></div>
        <div class="stage-frame"><div class="stage reel-stage" id="reel-stage" data-mode="before">${stageInner(cur, vp)}</div></div>
        <div class="reel-controls">
          <button type="button" class="btn primary" data-reel-play ${takes.length > 1 ? '' : 'disabled'} aria-pressed="${state.reelPlaying}">${state.reelPlaying ? '❚❚ Pause' : '▶ Play'}</button>
          <input type="range" class="scrub" data-reel-scrub min="0" max="${Math.max(0, takes.length - 1)}" value="${Math.max(0, idx)}" ${takes.length ? '' : 'disabled'} aria-label="Scrub takes">
          <span class="reel-pos" data-reel-pos>${posText(cur, idx, takes.length)}</span>
          <button type="button" class="btn" data-reel-open ${cur ? '' : 'disabled'} title="Open this take in the monitor">Open in monitor</button>
        </div>
      </div>
      <aside class="side-col">
        <section class="panel">
          <div class="panel-h"><span class="t">Reel stats</span><span class="sub">${esc(vp?.id || '')}</span></div>
          <div class="reel-meta">
            <div class="stat"><div class="k">Takes</div><div class="v">${takes.length}</div></div>
            <div class="stat"><div class="k">Span</div><div class="v">${takes.length > 1 ? esc(fmtDur(last.atMs - first.atMs)) : '—'}</div></div>
            <div class="stat"><div class="k">Phase-1 first → last</div><div class="v">${first?.score ? `${first.score.phasePassed ?? '—'} <small>→</small> ${last.score?.phasePassed ?? '—'}` : '—'}</div></div>
            <div class="stat"><div class="k">Struck</div><div class="v">${takes.filter((t) => !t.valid).length}</div></div>
          </div>
          <div class="crew-list" style="margin-top:10px">${data.agentIds.map((id) => {
            const n = takes.filter((t) => t.agent === id).length;
            return `<div class="member" style="grid-template-columns:26px 1fr;padding:6px 8px"><span class="avatar" style="width:26px;height:26px;font-size:12px;background:${esc(data.colorOf(id))}">${esc(initial(id))}</span><div class="name" style="font-size:12.5px">${esc(id)} <span class="k" style="margin-left:auto">${n} take${n === 1 ? '' : 's'}</span></div></div>`;
          }).join('')}</div>
        </section>
      </aside>
    </div>
    <section class="panel">
      <div class="panel-h"><span class="t">All takes · ${esc(vp?.id || '')}</span><span class="sub">${takes.length ? 'click a frame to scrub · double-click opens it in the monitor' : 'no takes yet'}</span></div>
      ${takes.length ? `<div class="reel-thumbs">${takes.map((t, i) => `<button type="button" class="rt-item${i === idx && !refPreview ? ' cur' : ''}${t.valid ? '' : ' invalid'}" data-reel-i="${i}" style="--ac:${esc(t.color)}" title="${esc(t.subject || '')}">
          <img src="${esc(dataUrl(t.shotBy[vp.id].image))}" alt="" loading="lazy" decoding="async"><span class="stripe"></span>
          <span class="cap"><b>T${pad(t.number ?? t.index + 1)}${t.valid ? '' : ' ✕'}</b><span>${esc(fmtTime(t.capturedAt ?? t.at))}</span><span>${esc(t.agent)}</span></span></button>`).join('')}</div>`
        : '<div class="fs-empty">WAITING FOR TAKE 01</div>'}
    </section>
    <section class="panel">
      <div class="panel-h"><span class="t">Reference reel</span><span class="sub">hero frames A–F · clip timeline</span></div>
      <div class="ref-reel-wrap">
        <div class="ref-hero">${data.viewpoints.map((v) => `<button type="button" data-ref-hero="${esc(v.id)}" class="${refPreview?.id === v.id ? 'cur' : ''}" title="${esc(v.label)} · TC ${timecode(v.refSeconds)}"><img src="${esc(dataUrl(v.reference))}" alt="${esc(v.label)}" loading="lazy"><span class="cap"><b>${esc(v.letter)}</b> ${esc(v.label)}</span></button>`).join('')}</div>
        <div class="strip"><div class="strip-in" data-ref-strip><div class="strip-empty">scanning reference/frames/timeline …</div></div></div>
      </div>
    </section>`;

  fillTimeline(root, data);
  if (state.reelPlaying && takes.length > 1) startTimer(data);
  else stopTimer();
}

function stageInner(cur, vp) {
  if (refPreview) {
    return `<div class="panes"><div class="pane"><img class="img" src="${esc(refPreview.src)}" alt="" draggable="false"><div class="tag tag-tl ref"><b>Reference</b> · ${esc(refPreview.label)}</div></div></div>${frame(vp, null)}`;
  }
  if (!cur) {
    return `<div class="panes"><div class="pane"><img class="img" src="${esc(dataUrl(vp?.reference))}" alt="" draggable="false" style="opacity:.55"><div class="tag tag-tl ref"><b>Reference</b> · TC ${timecode(vp?.refSeconds)}</div><div class="tag tag-tr"><b>Reel</b> · no takes yet</div></div></div>${frame(vp, null)}`;
  }
  const shot = cur.shotBy[vp.id];
  return `<div class="panes"><div class="pane"><img class="img" src="${esc(dataUrl(shot.image))}" alt="" draggable="false" data-reel-img>
      <div class="tag tag-tl" data-reel-tag><b>T${pad(cur.number ?? cur.index + 1)}</b> · ${esc(fmtTime(cur.capturedAt ?? cur.at))} · ${esc(cur.agent)}</div>
      <div class="tag tag-tr"><b>Reel</b> · ${esc(vp.id)}</div></div></div>
    ${frame(vp, cur)}
    <div class="struck" data-reel-struck ${cur.valid ? 'hidden' : ''}>STRUCK<small>${esc(cur.invalid || '')}</small></div>`;
}

function frame(vp, take) {
  return `<div class="frame-ui"><div class="vig"></div><i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
    <div class="tc">TC <b>${timecode(vp?.refSeconds)}</b><span data-reel-tc>${take ? ` · T${pad(take.number ?? take.index + 1)}` : ''}</span></div>
    <div class="vp-label"><b>${esc(vp?.letter || '')}</b> ${esc(vp?.label || '')} · ${esc(vp?.id || '')}</div></div>`;
}

function posText(cur, idx, n) {
  if (!cur) return '— / —';
  return `<b>T${pad(cur.number ?? cur.index + 1)}</b> · ${esc(fmtDateTime(cur.capturedAt ?? cur.at))} · ${esc(cur.agent)} · ${idx + 1}/${n}`;
}

/** Cheap update when only reelIndex / reelPlaying changed (no DOM rebuild → smooth playback). */
export function updateReel(root, data) {
  const vp = data.vpById[state.viewpoint];
  const takes = takesFor(data);
  const idx = currentIndex(data);
  const cur = idx >= 0 ? takes[idx] : null;
  refPreview = null;
  const stage = $('#reel-stage', root);
  if (stage && cur) {
    if (!$('[data-reel-img]', stage)) stage.innerHTML = stageInner(cur, vp);
    else {
      $('[data-reel-img]', stage).src = dataUrl(cur.shotBy[vp.id].image);
      $('[data-reel-tag]', stage).innerHTML = `<b>T${pad(cur.number ?? cur.index + 1)}</b> · ${esc(fmtTime(cur.capturedAt ?? cur.at))} · ${esc(cur.agent)}`;
      $('[data-reel-tc]', stage).textContent = ` · T${pad(cur.number ?? cur.index + 1)}`;
      const st = $('[data-reel-struck]', stage);
      if (st) { st.hidden = cur.valid; st.innerHTML = `STRUCK<small>${esc(cur.invalid || '')}</small>`; }
    }
    stage.classList.toggle('is-struck', !cur.valid);
  }
  const scrub = $('[data-reel-scrub]', root);
  if (scrub) scrub.value = Math.max(0, idx);
  const pos = $('[data-reel-pos]', root);
  if (pos) pos.innerHTML = posText(cur, idx, takes.length);
  const play = $('[data-reel-play]', root);
  if (play) { play.textContent = state.reelPlaying ? '❚❚ Pause' : '▶ Play'; play.setAttribute('aria-pressed', String(state.reelPlaying)); }
  for (const b of $$('[data-reel-i]', root)) b.classList.toggle('cur', Number(b.dataset.reelI) === idx);
  for (const b of $$('[data-ref-hero], [data-ref-strip] button', root)) b.classList.remove('cur');
  if (state.reelPlaying && takes.length > 1) startTimer(data); else stopTimer();
}

function startTimer(data) {
  if (timer) return;
  timer = setInterval(() => {
    const n = takesFor(data).length;
    if (n < 2) { stopTimer(); set({ reelPlaying: false }); return; }
    set({ reelIndex: (currentIndex(data) + 1) % n });
  }, 1000 / FPS);
}
export function stopTimer() {
  if (timer) clearInterval(timer);
  timer = 0;
}

export function bindReel(root, data, openInMonitor) {
  root.addEventListener('click', (e) => {
    const v = e.target.closest('[data-vp]');
    if (v) { refPreview = null; set({ viewpoint: v.dataset.vp, reelIndex: -1 }); return; }
    if (e.target.closest('[data-reel-play]')) { set({ reelPlaying: !state.reelPlaying }); return; }
    if (e.target.closest('[data-reel-open]')) { openInMonitor(); return; }
    const th = e.target.closest('[data-reel-i]');
    if (th) { set({ reelIndex: Number(th.dataset.reelI), reelPlaying: false }); return; }
    const hero = e.target.closest('[data-ref-hero]');
    if (hero) { showRef(root, hero, hero.dataset.refHero, dataUrl(root.__data.vpById[hero.dataset.refHero].reference), `${hero.dataset.refHero} · TC ${timecode(root.__data.vpById[hero.dataset.refHero].refSeconds)}`); return; }
    const fr = e.target.closest('[data-ref-frame]');
    if (fr) { showRef(root, fr, fr.dataset.refFrame, fr.dataset.refFrame, fr.dataset.refLabel); }
  });
  root.addEventListener('dblclick', (e) => {
    const th = e.target.closest('[data-reel-i]');
    if (th) { set({ reelIndex: Number(th.dataset.reelI), reelPlaying: false }, { silent: true }); openInMonitor(); }
  });
  root.addEventListener('input', (e) => {
    const s = e.target.closest('[data-reel-scrub]');
    if (s) set({ reelIndex: Number(s.value), reelPlaying: false });
  });
  root.__data = data;
}

export function setReelData(root, data) { root.__data = data; }

function showRef(root, btn, id, src, label) {
  set({ reelPlaying: false }, { silent: true });
  stopTimer();
  refPreview = { id, src, label };
  const vp = root.__data.vpById[state.viewpoint];
  const stage = $('#reel-stage', root);
  if (stage) { stage.innerHTML = stageInner(null, vp); stage.classList.remove('is-struck'); }
  for (const b of $$('[data-ref-hero], [data-ref-frame], [data-reel-i]', root)) b.classList.remove('cur');
  btn.classList.add('cur');
  const play = $('[data-reel-play]', root);
  if (play) { play.textContent = '▶ Play'; play.setAttribute('aria-pressed', 'false'); }
}

/* ------------------------------------------------------------------ reference timeline */
export function loadTimeline() {
  if (timelinePromise) return timelinePromise;
  timelinePromise = (async () => {
    try {
      const r = await fetch(`${dataUrl('reference/frames/timeline/index.json')}?t=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        const arr = Array.isArray(j) ? j : j?.frames;
        if (Array.isArray(arr) && arr.length) return arr.map((f) => (typeof f === 'string' ? { file: f } : f)).filter((f) => f?.file);
      }
    } catch { /* fall through to probing */ }
    // No index: probe t_001.jpg, t_002.jpg … sequentially and stop at the first miss, so the
    // console only ever sees one 404 (two counting index.json).
    const found = [];
    for (let i = 1; i <= 200; i++) {
      const file = `t_${pad(i, 3)}.jpg`;
      if (!(await probe(dataUrl(`reference/frames/timeline/${file}`)))) break;
      found.push({ file });
    }
    return found;
  })();
  return timelinePromise;
}

function probe(src) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(true);
    im.onerror = () => resolve(false);
    im.src = src;
  });
}

async function fillTimeline(root, data) {
  const frames = await loadTimeline();
  const strip = $('[data-ref-strip]', root);
  if (!strip) return;
  if (!frames.length) {
    strip.innerHTML = '<div class="strip-empty">NO TIMELINE FRAMES — reference/frames/timeline/ is not in this data set</div>';
    return;
  }
  strip.innerHTML = frames.map((f, i) => {
    const src = dataUrl(`reference/frames/timeline/${f.file}`);
    const label = f.seconds != null ? `TC ${timecode(f.seconds)}` : `#${pad(i + 1, 3)}`;
    return `<button type="button" data-ref-frame="${esc(src)}" data-ref-label="${esc(`timeline ${f.file} · ${label}`)}" title="${esc(f.file)}"><img src="${esc(src)}" alt="" loading="lazy"><span class="tcap">${esc(label)}</span></button>`;
  }).join('');
  const sub = $('.panel-h .sub', strip.closest('.panel'));
  if (sub) sub.textContent = `hero frames A–F · ${frames.length} timeline frames${frames[0]?.seconds == null ? ' (no index.json — order only)' : ''}`;
}
