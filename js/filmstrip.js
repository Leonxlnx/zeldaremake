// Bottom rail: one thumbnail per take (current viewpoint), hour ticks, gaps, agent stripes,
// and a phase-progress sparkline aligned above the thumbnails.

import { $, $$, esc, fmtTime, fmtDur, pad, clamp, HOUR, MIN } from './util.js';
import { state, set } from './state.js';
import { dataUrl } from './data.js';

const THUMB_W = 120;
const GAP = 8;
const SPARK_H = 26;

export function renderFilmstrip(root, data) {
  const vp = data.vpById[state.viewpoint];
  const takes = data.takes;
  if (!takes.length) {
    root.innerHTML = `<div class="fs-head"><span class="t k">Timeline</span><span class="sub">no takes yet · the rail fills one thumbnail per hourly take</span></div>
      <div class="fs-empty">WAITING FOR TAKE 01 · reference reel available under the REEL tab</div>`;
    return;
  }
  const cadenceMs = data.cadenceMin * MIN;
  const items = [];
  let x = 0;
  let gaps = 0;
  takes.forEach((t, i) => {
    if (i > 0) {
      const dt = t.atMs - takes[i - 1].atMs;
      if (dt > 1.5 * cadenceMs) {
        const w = Math.round(clamp(56 + 22 * (dt / HOUR), 84, 220));
        items.push({ type: 'gap', x, w, dt });
        x += w + GAP;
        gaps++;
      }
    }
    items.push({ type: 'take', take: t, x, w: THUMB_W });
    x += THUMB_W + GAP;
  });
  const total = Math.max(0, x - GAP);
  const span = takes[takes.length - 1].atMs - takes[0].atMs;
  const phaseReq = data.latest?.score?.phaseRequired || data.phaseRequired || 42;

  // sparkline
  const pts = items.filter((it) => it.type === 'take').map((it) => {
    const pp = it.take.score?.phasePassed ?? 0;
    return { x: it.x + THUMB_W / 2, y: SPARK_H - 3 - (SPARK_H - 14) * clamp(pp / phaseReq, 0, 1), pp, take: it.take };
  });
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${SPARK_H} L${pts[0].x.toFixed(1)},${SPARK_H} Z` : '';
  const spark = `<svg class="fs-spark" width="${total}" height="${SPARK_H}" viewBox="0 0 ${total} ${SPARK_H}" aria-hidden="true">
    <defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2b866" stop-opacity=".35"/><stop offset="1" stop-color="#f2b866" stop-opacity="0"/></linearGradient></defs>
    ${area ? `<path class="area" d="${area}"/>` : ''}${line ? `<path class="line" d="${line}"/>` : ''}
    ${pts.map((p) => `<circle class="pt${p.take.id === state.takeId ? ' cur' : ''}${p.take.valid ? '' : ' invalid'}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.take.id === state.takeId ? 4 : 2.5}"/>
      <text x="${(p.x + 7).toFixed(1)}" y="${(p.y < 12 ? p.y + 10 : p.y - 5).toFixed(1)}" text-anchor="start">${p.pp}</text>`).join('')}
  </svg>`;

  // ruler ticks (hour boundaries emphasised)
  let lastHour = null;
  const ticks = items.map((it) => {
    if (it.type === 'gap') return `<span class="fs-tick" style="left:${it.x}px"></span>`;
    const d = new Date(it.take.atMs);
    const hourKey = `${d.getUTCDate()}-${d.getUTCHours()}`;
    const isHour = hourKey !== lastHour;
    lastHour = hourKey;
    return `<span class="fs-tick${isHour ? ' hour' : ''}" style="left:${it.x}px"><span>${esc(fmtTime(it.take.at))}</span></span>`;
  }).join('');

  const track = items.map((it) => {
    if (it.type === 'gap') return `<div class="fs-gap" style="width:${it.w}px" title="No take for ${esc(fmtDur(it.dt))}"><span><b>${esc(fmtDur(it.dt))}</b>gap</span></div>`;
    const t = it.take;
    const shot = t.shotBy[vp?.id];
    const cur = t.id === state.takeId;
    return `<button type="button" class="thumb${cur ? ' cur' : ''}${t.valid ? '' : ' invalid'}" data-take="${esc(t.id)}" style="--ac:${esc(t.color)}" aria-pressed="${cur}" title="${esc(t.id)} · ${esc(t.agent)} · ${esc(t.subject || '')}">
      ${shot?.image ? `<img src="${esc(dataUrl(shot.image))}" alt="" loading="lazy" decoding="async">` : '<div class="missing-note" style="font-size:9px">no shot</div>'}
      <span class="stripe"></span><span class="ag">${esc(t.agent || '')}</span>
      <span class="tn">T${pad(t.number ?? t.index + 1)}</span>
      ${t.score ? `<span class="sc">${t.score.phasePassed ?? t.score.passed}/${t.score.phaseRequired ?? t.score.total}</span>` : ''}
      ${t.valid ? '' : '<span class="x">STRUCK</span>'}
    </button>`;
  }).join('');

  root.innerHTML = `
    <div class="fs-head">
      <span class="t k">Timeline</span>
      <span class="sub">${esc(vp?.id || '')} · ${takes.length} take${takes.length === 1 ? '' : 's'} · span ${esc(fmtDur(span))}${gaps ? ` · ${gaps} gap${gaps > 1 ? 's' : ''}` : ''} · UTC</span>
      <span class="legend-spark"><i></i>phase-1 items passing (of ${phaseReq})</span>
    </div>
    <div class="fs-scroll"><div class="fs-inner" style="width:${total}px">
      ${spark}
      <div class="fs-ruler">${ticks}</div>
      <div class="fs-track">${track}</div>
    </div></div>`;

  // keep the current take visible
  const scroller = $('.fs-scroll', root);
  const cur = $('.thumb.cur', root);
  if (scroller && cur) {
    const target = cur.offsetLeft - scroller.clientWidth / 2 + THUMB_W / 2;
    scroller.scrollLeft = clamp(target, 0, Math.max(0, total - scroller.clientWidth));
  }
}

export function bindFilmstrip(root) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-take]');
    if (b) set({ takeId: b.dataset.take });
  });
}

export function stepTake(data, dir) {
  if (!data.takes.length) return;
  const cur = data.byId[state.takeId];
  const i = cur ? cur.index : data.takes.length - 1;
  const n = clamp(i + dir, 0, data.takes.length - 1);
  if (n !== i) set({ takeId: data.takes[n].id });
}

export function gotoTake(data, index) {
  if (!data.takes.length) return;
  const n = clamp(index < 0 ? data.takes.length + index : index, 0, data.takes.length - 1);
  set({ takeId: data.takes[n].id });
}
