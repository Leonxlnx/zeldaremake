// The director's cut header above the viewer: the take's headline (from the ledger note), its
// round, who shot it and when, and one chip per viewpoint with the SSIM delta against the
// previous take — the "what changed this hour" read before any picture.

import { $, esc, fmtRel, fmtDateTime, pad } from './util.js';
import { state, set } from './state.js';
import { viewDeltas } from './headline.js';

export function renderCut(root, data) {
  const take = data.byId[state.takeId] || null;
  if (!take) {
    root.innerHTML = `<div class="cut-in is-standby"><div class="cut-tags"><span class="cut-round">Standby</span></div><h1 class="cut-h">Waiting for the first take</h1><div class="cut-sub">The headline of every take — what changed, in the agent's own words — appears here.</div></div>`;
    return;
  }
  const deltas = viewDeltas(take, 'ssim');
  const chips = deltas.map((d) => {
    const cur = d.viewpoint === state.viewpoint;
    const cls = d.delta == null ? 'none' : Math.abs(d.delta) < 5e-5 ? 'flat' : d.delta > 0 ? 'up' : 'down';
    const txt = d.delta == null ? '—' : `${d.delta > 0 ? '+' : d.delta < 0 ? '−' : '±'}${Math.abs(d.delta).toFixed(4)}`;
    return `<button type="button" class="cut-delta ${cls}${cur ? ' cur' : ''}" data-cut-vp="${esc(d.viewpoint)}" aria-pressed="${cur}" title="${esc(d.viewpoint)} · SSIM ${d.value != null ? d.value.toFixed(4) : '—'} · Δ vs previous take ${esc(txt)}"><b>${esc(d.letter)}</b><span>${esc(txt)}</span></button>`;
  }).join('');
  const worst = deltas.filter((d) => typeof d.delta === 'number').sort((a, b) => a.delta - b.delta)[0];
  const best = deltas.filter((d) => typeof d.delta === 'number').sort((a, b) => b.delta - a.delta)[0];
  const summary = worst && best
    ? `SSIM vs the previous take: best ${best.letter} ${best.delta >= 0 ? '+' : '−'}${Math.abs(best.delta).toFixed(4)}, worst ${worst.letter} ${worst.delta >= 0 ? '+' : '−'}${Math.abs(worst.delta).toFixed(4)}${worst.delta < -0.003 ? ' — outside the −0.003 budget' : ''}`
    : 'first take — no previous frames to compare';
  root.innerHTML = `
    <div class="cut-in${take.valid ? '' : ' is-struck'}">
      <div class="cut-tags">
        ${take.round != null ? `<span class="cut-round">Round ${esc(String(take.round))}</span>` : '<span class="cut-round dim">No round</span>'}
        <span class="cut-take">T${pad(take.number ?? take.index + 1)}</span>
        <span class="cut-agent" style="--ac:${esc(take.color)}"><i></i>${esc(take.agent || 'unknown')}</span>
        <span class="cut-when" title="${esc(fmtDateTime(take.capturedAt ?? take.at))}">${esc(fmtRel(Date.now() - take.capturedAtMs))}</span>
        ${take.shortSha ? `<span class="cut-sha mono">${esc(take.shortSha)}</span>` : ''}
        ${!take.valid ? `<span class="cut-struck">struck · ${esc(take.invalid || 'invalid')}</span>` : ''}
      </div>
      <h1 class="cut-h">${esc(take.headline || take.subject || take.id)}</h1>
      <div class="cut-row">
        <div class="cut-deltas" role="group" aria-label="SSIM delta per viewpoint">${chips}</div>
        <div class="cut-sub">${esc(summary)} · <a href="#" data-cut-goto="notes">full note</a> · <a href="#" data-cut-goto="evidence">evidence</a> · <a href="#" data-cut-goto="player">player view</a></div>
      </div>
    </div>`;
}

export function bindCut(root) {
  root.addEventListener('click', (e) => {
    const vp = e.target.closest('[data-cut-vp]');
    if (vp) { set({ viewpoint: vp.dataset.cutVp }); return; }
    const go = e.target.closest('[data-cut-goto]');
    if (go) {
      e.preventDefault();
      const el = $(`#${go.dataset.cutGoto}`);
      el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });
}
