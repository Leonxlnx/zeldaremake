// Clapperboard slate header + LIVE status pill.

import { $, esc, fmtDateTime, fmtRel, fmtDur, HOUR, MIN } from './util.js';
import { state } from './state.js';

const REPO = 'https://github.com/Leonxlnx/zeldaremake';

export function renderSlate(data) {
  const root = $('#slate-fields');
  const take = data.byId[state.takeId] || null;
  const vp = data.vpById[state.viewpoint];
  const slate = take?.slate || {};
  const scene = slate.scene || vp?.letter || '—';
  const sceneTitle = slate.sceneTitle || vp?.label || '';
  const takeNo = take ? (slate.take ?? take.number ?? take.index + 1) : 0;
  const director = slate.director || take?.agent || '—';
  const camera = slate.camera || take?.stats?.renderer || '—';
  const roll = slate.roll || (take?.phase ? `phase-${take.phase}` : 'phase-1');
  const sha = take?.shortSha || (take?.sha ? take.sha.slice(0, 7) : null);

  root.innerHTML = `
    <div class="sf big"><span class="k">Scene</span><span class="v">${esc(scene)}<small>${esc(sceneTitle)}</small></span></div>
    <div class="sf big"><span class="k">Take</span><span class="v">${esc(String(takeNo).padStart(2, '0'))}${take && !take.valid ? '<small style="color:var(--red-t)">struck</small>' : ''}</span></div>
    <div class="sf"><span class="k">Dir.</span><span class="v">${esc(director)}</span></div>
    <div class="sf"><span class="k">Cam.</span><span class="v" title="${esc(camera)}">${esc(shortCam(camera))}</span></div>
    <div class="sf"><span class="k">Roll</span><span class="v">${esc(roll)}</span></div>
    <div class="sf"><span class="k">Date</span><span class="v">${take ? esc(fmtDateTime(take.at)) : '<span class="dash">— waiting —</span>'}</span></div>
    <div class="sf"><span class="k">Commit</span><span class="v">${
      sha ? `<a href="${REPO}/commit/${esc(take.sha || sha)}" target="_blank" rel="noopener" title="${esc(take.subject || '')}">${esc(sha)} ↗</a>` : '<span class="dash">—</span>'
    }</span></div>`;
}

function shortCam(s) {
  if (!s || s === '—') return '—';
  if (/swiftshader/i.test(s) && !/·/.test(s)) return 'SwiftShader · 1280×720';
  return s.length > 28 ? `${s.slice(0, 26)}…` : s;
}

/** Freshness pill. green ≤ cadence, amber ≤ 2×, red beyond; standby when there is no take. */
export function renderLive(data, now = Date.now()) {
  const pill = $('#live');
  const text = $('.live-text', pill);
  const cadenceMs = data.cadenceMin * MIN;
  const last = data.latest ? data.latest.atMs : (data.updatedAt ? new Date(data.updatedAt).getTime() : NaN);
  pill.classList.remove('is-live', 'is-late', 'is-stale', 'is-standby');

  const nextAt = nextCaptureAt(now, cadenceMs, last);
  const nextIn = nextAt - now;

  if (!data.latest) {
    pill.classList.add('is-standby');
    text.innerHTML = `<strong>STANDBY</strong> · waiting for the first take · next capture ${nextIn > 0 ? `in ${esc(fmtDur(nextIn))}` : 'imminent'}`;
    pill.title = 'No takes published yet';
    return;
  }
  const age = now - last;
  if (age <= cadenceMs) {
    pill.classList.add('is-live');
    text.innerHTML = `<strong>LIVE</strong> · last take ${esc(fmtRel(age))} · next in ${esc(fmtDur(Math.max(0, nextIn)))}`;
  } else if (age <= 2 * cadenceMs) {
    pill.classList.add('is-late');
    text.innerHTML = `<strong>LATE</strong> · last take ${esc(fmtRel(age))} · overdue by ${esc(fmtDur(age - cadenceMs))}`;
  } else {
    pill.classList.add('is-stale');
    text.innerHTML = `<strong>STALE</strong> · last take ${esc(fmtRel(age))} · monitor is > ${Math.round((2 * cadenceMs) / HOUR * 10) / 10} h behind`;
  }
  pill.title = `updatedAt ${fmtDateTime(data.updatedAt)} · cadence ${data.cadenceMin} min`;
}

/** CI captures at the top of the hour (cadence-aligned). */
export function nextCaptureAt(now, cadenceMs, lastMs) {
  if (cadenceMs > 0 && HOUR % cadenceMs === 0) {
    return Math.floor(now / cadenceMs) * cadenceMs + cadenceMs;
  }
  if (Number.isFinite(lastMs)) {
    let n = lastMs + cadenceMs;
    while (n <= now) n += cadenceMs;
    return n;
  }
  return Math.floor(now / HOUR) * HOUR + HOUR;
}
