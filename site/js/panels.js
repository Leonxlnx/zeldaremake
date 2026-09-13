// Take notes, metrics strip, rubric board, crew roster.

import { $, $$, esc, fmtRel, fmtDateTime, fmtNum, initial, toast, prefersReducedMotion } from './util.js';
import { state, set } from './state.js';
import { GROUPS, describeThreshold, fmtScoreValue, metricTargets } from './data.js';

const REPO = 'https://github.com/Leonxlnx/zeldaremake';

/* ------------------------------------------------------------------ notes */
export function renderNotes(root, data) {
  const take = data.byId[state.takeId] || null;
  if (!take) {
    root.innerHTML = `<div class="panel-h"><span class="t">Take notes</span><span class="sub">standby</span></div>
      <p class="empty-note">No take notes yet. Each hour the gauntlet publishes a take: commit, six captures, the 50-item score and the agent's written comparison against the reference (≥ 200 characters — GAUNTLET.md §4.D6).</p>`;
    return;
  }
  const att = take.attestation || {};
  const attBadge = att.source === 'ci'
    ? `<a class="badge ci" ${att.url ? `href="${esc(att.url)}" target="_blank" rel="noopener"` : ''} title="CI-attested${att.runId ? ` · run ${esc(att.runId)}` : ''}">CI ✓${att.runId ? ` #${esc(String(att.runId)).slice(-6)}` : ''}</a>`
    : `<span class="badge local" title="Local report — does not count toward verify-exit">local</span>`;
  const validBadge = take.valid ? '<span class="badge valid">valid</span>' : '<span class="badge struck">struck</span>';
  const items = Array.isArray(take.items) ? take.items : [];
  const chips = items.map((id) => {
    const st = take.score?.items?.[id]?.status || 'pending';
    const flip = take.flips?.[id];
    return `<a class="chip ${esc(st)}" href="#" data-goto-item="${esc(id)}" title="${esc(data.rubricById[id]?.title || id)}${flip ? ` · ${flip}` : ''}">${esc(id)}${flip ? (flip.endsWith('pass') ? ' ▲' : ' ▼') : ''}</a>`;
  }).join('');
  const st = take.stats || {};
  root.innerHTML = `
    <div class="panel-h"><span class="t">Take notes</span><span class="sub">${esc(take.id)} · ${esc(fmtRel(Date.now() - take.atMs))}</span></div>
    <div class="note-head">
      <span class="avatar" style="background:${esc(take.color)}" aria-hidden="true">${esc(initial(take.agent))}</span>
      <div class="note-who">
        <div class="agent">${esc(take.agent || 'unknown agent')}</div>
        <div class="branch" title="${esc(take.branch || '')}">${esc(take.branch || '—')}</div>
      </div>
      <div class="badges">${attBadge}${validBadge}</div>
    </div>
    <div class="subject">${esc(take.subject || '(no commit subject)')}${take.shortSha ? `<a class="sha" href="${REPO}/commit/${esc(take.sha || take.shortSha)}" target="_blank" rel="noopener">${esc(take.shortSha)}</a>` : ''}</div>
    ${items.length ? `<div class="targets"><span class="k" style="align-self:center">Targets</span>${chips}</div>` : '<div class="targets"><span class="k">No targeted items</span></div>'}
    <div class="note-text">${esc(take.note || 'No comparison note was recorded for this take.')}</div>
    ${!take.valid ? `<div class="invalid-reason"><b>STRUCK</b>${esc(take.invalid || 'anti-cheat tagged this take as invalid')}</div>` : ''}
    <div class="note-stats">
      ${st.drawCalls != null ? `<span>draw calls <b>${esc(fmtNum(st.drawCalls))}</b></span>` : ''}
      ${st.triangles != null ? `<span>tris <b>${esc(fmtNum(st.triangles))}</b></span>` : ''}
      ${st.captureMs != null ? `<span>capture <b>${esc((st.captureMs / 1000).toFixed(0))} s</b></span>` : ''}
      ${take.score ? `<span>score <b>${esc(String(take.score.passed))}/${esc(String(take.score.total))}</b></span>` : ''}
      <span title="captured ${esc(fmtDateTime(take.capturedAt ?? take.at))}${take.resequenced ? ` · sealed ${esc(fmtDateTime(take.at))}` : ''}">shot <b>${esc(fmtDateTime(take.capturedAt ?? take.at))}</b></span>
    </div>`;
}

/* ------------------------------------------------------------------ metrics */
const METRIC_ORDER = ['ssim', 'phashDistance', 'hueDiffDeg', 'satDiff', 'lumDiff', 'sharpnessRatio', 'skyFraction', 'overexposedFraction'];

export function renderMetrics(root, data) {
  const take = data.byId[state.takeId] || null;
  const shot = take?.shotBy?.[state.viewpoint];
  const targets = metricTargets(data.rubric);
  if (!shot?.metrics) {
    root.innerHTML = `<div class="metric-empty">${take ? `NO METRICS FOR ${esc(state.viewpoint)}` : 'METRICS — SSIM · PHASH · HUE · SAT · LUM · SHARPNESS · SKY · OVEREXPOSED — appear with the first take'}</div>`;
    return;
  }
  const prev = shot.previousShot?.metrics || null;
  root.innerHTML = METRIC_ORDER.map((key) => {
    const t = targets[key];
    const v = shot.metrics[key];
    if (v == null) return `<div class="metric"><div class="k"><span>${esc(t.label)}</span></div><div class="v">—</div><div class="d">no data</div></div>`;
    let d = shot.deltas?.[key];
    if (d == null && prev && prev[key] != null) d = v - prev[key];
    const hasGoal = !t.onlyFor || t.onlyFor === state.viewpoint;
    const meets = hasGoal ? (t.op === '>=' ? v >= t.value : v <= t.value) : null;
    let dCls = '';
    let dTxt = 'first take';
    if (d != null && Number.isFinite(d)) {
      if (Math.abs(d) < 1e-9) dTxt = '= no change';
      else {
        const up = d > 0;
        const good = t.good === 'up' ? up : !up;
        dCls = hasGoal || key !== 'skyFraction' ? (good ? 'good' : 'bad') : '';
        dTxt = `${up ? '▲' : '▼'} ${t.pct ? `${(Math.abs(d) * 100).toFixed(2)} pt` : t.fmt(Math.abs(d))}${t.unit && !t.pct ? t.unit : ''}`;
      }
    }
    const goal = hasGoal ? `${t.op === '>=' ? '≥' : '≤'} ${t.pct ? `${(t.value * 100).toFixed(t.value < 0.05 ? 1 : 0)} %` : t.value}${t.unit && !t.pct ? t.unit : ''}` : 'info';
    return `<div class="metric ${meets == null ? '' : meets ? 'meets' : 'misses'}" title="${esc(t.label)} — goal ${esc(goal)}${t.item ? ` (${t.item})` : ''}">
      <div class="k"><span>${esc(t.label)}</span><span class="goal">${esc(goal)}</span></div>
      <div class="v">${esc(t.fmt(Number(v)))}${t.unit ? `<small>${esc(t.unit)}</small>` : ''}</div>
      <div class="d ${dCls}">${esc(dTxt)}</div>
    </div>`;
  }).join('');
}

/* ------------------------------------------------------------------ rubric */
export function renderRubric(root, data) {
  const take = data.byId[state.takeId] || null;
  const items = data.rubricItems;
  if (!items.length) {
    root.innerHTML = `<div class="rubric-head"><div class="rubric-title"><div><h2>Rubric board</h2><div class="sum">rubric.json not found in data/</div></div></div></div>`;
    return;
  }
  const score = take?.score || null;
  const sItems = score?.items || {};
  const statusOf = (id) => {
    const s = sItems[id]?.status;
    return s === 'pass' || s === 'fail' ? s : 'pending';
  };
  const flips = take?.flips || {};
  const targeted = new Set(take?.items || []);
  const phaseItems = items.filter((it) => it.phase === 1);
  const phasePassed = score?.phasePassed ?? phaseItems.filter((it) => statusOf(it.id) === 'pass').length;
  const phaseRequired = score?.phaseRequired ?? phaseItems.length;
  const passed = score?.passed ?? items.filter((it) => statusOf(it.id) === 'pass').length;
  const total = score?.total ?? items.length;
  const counts = { all: items.length, pass: 0, fail: 0, pending: 0, flipped: Object.keys(flips).length };
  for (const it of items) counts[statusOf(it.id)]++;

  const f = state.rubricFilter;
  const visible = (it) => f === 'all' || (f === 'flipped' ? !!flips[it.id] : statusOf(it.id) === f);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const frac = phaseRequired ? phasePassed / phaseRequired : 0;
  const prevTake = take?.prev;
  const prevPhase = prevTake?.score?.phasePassed;
  const trend = prevPhase != null ? phasePassed - prevPhase : null;

  let html = `<div class="rubric-head">
    <div class="rubric-title">
      <div class="ring" role="img" aria-label="${phasePassed} of ${phaseRequired} Phase-1 items pass">
        <svg viewBox="0 0 64 64"><circle class="track" cx="32" cy="32" r="${r}" fill="none" stroke-width="5"/><circle class="prog" cx="32" cy="32" r="${r}" fill="none" stroke-width="5" stroke-dasharray="${(frac * circ).toFixed(1)} ${circ.toFixed(1)}"/></svg>
        <div class="lbl-c">${Math.round(frac * 100)}%</div>
      </div>
      <div>
        <h2>Rubric board · ${items.length} items</h2>
        <div class="sum"><b>${phasePassed} / ${phaseRequired}</b> Phase-1 items pass${trend != null && trend !== 0 ? ` <span style="color:${trend > 0 ? 'var(--green)' : 'var(--magenta-t)'}">(${trend > 0 ? '+' : ''}${trend} vs previous take)</span>` : ''} · ${passed}/${total} overall${take ? ` · ${esc(take.id)}` : ' · no take yet'}</div>
      </div>
    </div>
    <div class="filters" role="group" aria-label="Filter rubric items">
      ${['all', 'pass', 'fail', 'pending', 'flipped'].map((k) => `<button type="button" class="filter" data-filter="${k}" aria-pressed="${f === k}">${k}<span class="n">${counts[k]}</span></button>`).join('')}
    </div>
  </div>`;

  for (const [gid, gname, range] of GROUPS) {
    const gItems = items.filter((it) => (it.group || 'other') === gid);
    if (!gItems.length) continue;
    const gPass = gItems.filter((it) => statusOf(it.id) === 'pass').length;
    const shown = gItems.filter(visible);
    html += `<section class="group" data-group="${gid}">
      <div class="group-h"><h3>${esc(gname)}</h3><span class="range">${esc(range)}</span><span class="gp"><b>${gPass}</b>/${gItems.length}</span><span class="bar" aria-hidden="true"><i style="width:${(gPass / gItems.length) * 100}%"></i></span></div>
      ${shown.length ? `<div class="cards">${shown.map((it) => card(it, statusOf(it.id), sItems[it.id], flips[it.id], targeted.has(it.id))).join('')}</div>` : `<div class="rubric-empty">no ${esc(f)} items in this group</div>`}
    </section>`;
  }
  // items with unknown groups
  const known = new Set(GROUPS.map((g) => g[0]));
  const rest = items.filter((it) => !known.has(it.group || 'other') && visible(it));
  if (rest.length) html += `<section class="group"><div class="group-h"><h3>Other</h3></div><div class="cards">${rest.map((it) => card(it, statusOf(it.id), sItems[it.id], flips[it.id], targeted.has(it.id))).join('')}</div></section>`;
  root.innerHTML = html;
}

function card(it, status, entry, flip, targeted) {
  const val = entry?.value;
  const thr = describeThreshold(it, entry);
  const up = flip && flip.endsWith('pass');
  return `<article class="card ${status}${targeted ? ' is-target' : ''}" id="item-${esc(it.id)}" data-item="${esc(it.id)}" title="${esc(it.description || '')}">
    <div class="card-top"><span class="id">${esc(it.id)}</span><span class="verify">${esc(it.verify || 'auto')}</span>${targeted ? '<span class="target-mark" title="targeted by this take">target</span>' : ''}<span class="status ${status}">${status}</span></div>
    <div class="card-title">${esc(it.title || '')}</div>
    <div class="card-vals"><span class="val">${esc(fmtScoreValue(val))}</span><span class="thr">${esc(thr)}</span>${flip ? `<span class="delta ${up ? 'up' : 'down'}">Δ ${esc(flip)}</span>` : ''}</div>
  </article>`;
}

export function bindRubric(root) {
  root.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) set({ rubricFilter: f.dataset.filter });
  });
  // rubric-item chips live in several panels (notes, callouts legend) — one delegated handler
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto-item]');
    if (!go) return;
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('monitor:goto-item', { detail: { id: go.dataset.gotoItem } }));
  });
  document.addEventListener('monitor:goto-item', (e) => {
    const id = e.detail?.id;
    if (!id) return;
    if (state.rubricFilter !== 'all') set({ rubricFilter: 'all' });
    const card = document.getElementById(`item-${id}`);
    if (!card) { toast(`${id} is not in the rubric`); return; }
    revealCard(card);
    card.classList.add('flash');
    setTimeout(() => card.classList.remove('flash'), 1600);
  });
}

// Centre the card in the band of viewport that the sticky filmstrip does not cover
// (scrollIntoView({block:'center'}) is unaware of sticky overlays).
function revealCard(card) {
  const strip = $('.filmstrip');
  const stripH = strip && getComputedStyle(strip).display !== 'none' ? strip.getBoundingClientRect().height : 0;
  const band = Math.max(200, window.innerHeight - stripH);
  const r = card.getBoundingClientRect();
  const top = Math.max(0, window.scrollY + r.top - (band - r.height) / 2);
  window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/* ------------------------------------------------------------------ crew */
export function renderCrew(root, data) {
  const take = data.byId[state.takeId] || null;
  const agents = data.agents.length ? data.agents : data.agentIds.map((id) => ({ agent: id, color: data.colorOf(id), status: 'unknown' }));
  if (!agents.length) {
    root.innerHTML = `<div class="panel-h"><span class="t">Crew</span><span class="sub">agents.json missing</span></div><p class="empty-note">No crew data. <code>agents.json</code> is generated from the front-matter of <code>.agents/*.md</code>.</p>`;
    return;
  }
  const now = Date.now();
  const takesBy = {};
  for (const t of data.takes) (takesBy[t.agent] ||= []).push(t);
  root.innerHTML = `<div class="panel-h"><span class="t">Crew</span><span class="sub">${agents.length} agent${agents.length === 1 ? '' : 's'} · ${data.takes.length} take${data.takes.length === 1 ? '' : 's'}</span></div>
    <div class="crew-list">${agents.map((a) => {
      const mine = takesBy[a.agent] || [];
      const last = mine[mine.length - 1];
      const onSet = take && take.agent === a.agent;
      const status = String(a.status || 'unknown').toLowerCase();
      const upd = a.updated ? new Date(a.updated).getTime() : NaN;
      return `<div class="member${onSet ? ' on-set' : ''}">
        <span class="avatar" style="background:${esc(a.color)}" aria-hidden="true">${esc(initial(a.agent))}</span>
        <div style="min-width:0">
          <div class="name"><span class="dot ${esc(status)}" title="${esc(status)}"></span>${esc(a.agent)}</div>
          ${a.runtime ? `<div class="rt">${esc(a.runtime)}</div>` : ''}
          ${a.branch ? `<div class="br" title="${esc(a.branch)}">${esc(a.branch)}</div>` : ''}
          ${a.currentTask ? `<div class="task">${esc(a.currentTask)}</div>` : ''}
          <div class="meta">
            <span>status <b>${esc(status)}</b></span>
            <span>updated <b>${esc(Number.isFinite(upd) ? fmtRel(now - upd) : '—')}</b></span>
            <span>takes <b>${mine.length}</b></span>
            ${last ? `<span>last take <b>${esc(fmtRel(now - last.atMs))}</b></span>` : ''}
          </div>
        </div>
        ${onSet ? '<span class="on-set-tag">shot this take</span>' : ''}
      </div>`;
    }).join('')}</div>`;
}
