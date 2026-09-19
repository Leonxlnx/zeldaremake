// "What the player sees": a strip of player-height poses rendered for a take
// (data/takes/<id>/player/, site/tools/player-strip.mjs). A take without its own strip borrows
// the nearest earlier one and says so; each pose opens in the lightbox with a this-take ↔
// previous-strip toggle when an earlier strip has the same pose.

import { $, $$, esc, fmtDateTime, pad } from './util.js';
import { state } from './state.js';
import { dataUrl, playerStripFor } from './data.js';
import { openLightbox } from './lightbox.js';

let current = null; // { poses: [...], items: [...] } for the click handler

export function renderPlayer(root, data) {
  const take = data.byId[state.takeId] || null;
  const strip = take ? playerStripFor(data, take) : null;
  if (!take || !strip) {
    root.innerHTML = `<div class="panel-h"><span class="t">What the player sees</span><span class="sub">${take ? 'no player-height frames published yet' : 'standby'}</span></div>
      <p class="empty-note">Player-height poses (the survey's walk poses at 1.45 m: up the spine, under the lantern limb, the stair treads, the arch, Saria's door…) appear here when a take is published with a strip — <code>node site/tools/player-strip.mjs --dist dist --out gauntlet/out/last/player</code> before <code>take.mjs --publish</code>.</p>`;
    current = null;
    return;
  }
  const owner = strip.owner;
  const prev = strip.previous;
  const prevBy = prev ? Object.fromEntries((prev.player.poses || []).map((p) => [p.name, p])) : {};
  const items = strip.poses.map((p) => {
    const before = prevBy[p.name];
    return {
      src: dataUrl(p.file),
      caption: p.label || p.name,
      sub: `${p.name} · ${owner.id} · ${fmtDateTime(owner.capturedAt ?? owner.at)}${p.p ? ` · cam ${p.p.map((v) => Number(v).toFixed(1)).join(', ')}` : ''}${p.fov ? ` · fov ${p.fov}°` : ''}`,
      label: `T${pad(owner.number ?? owner.index + 1)}`,
      alt: before ? { src: dataUrl(before.file), label: `T${pad(prev.number ?? prev.index + 1)} (before)` } : null,
    };
  });
  current = { items };
  const sub = strip.borrowed
    ? `borrowed from ${esc(owner.id)} (${esc(owner.shortSha || '')}) — ${esc(take.id)} was published without a strip`
    : `${esc(owner.id)} · ${strip.poses.length} pose${strip.poses.length === 1 ? '' : 's'}${owner.player?.renderer ? ` · ${esc(owner.player.renderer)}` : ''}${prev ? ` · click a pose to wipe against ${esc(prev.id)}` : ''}`;
  root.innerHTML = `
    <div class="panel-h"><span class="t">What the player sees</span><span class="sub">${sub}</span></div>
    <div class="player-scroll"><div class="player-track">${strip.poses.map((p, i) => `
      <button type="button" class="pose${prevBy[p.name] ? ' has-before' : ''}" data-pose="${i}" title="${esc(p.label || p.name)} · ${esc(p.name)}">
        <img src="${esc(dataUrl(p.file))}" alt="${esc(p.label || p.name)}" loading="lazy" decoding="async">
        <span class="pose-cap"><b>${esc(p.label || p.name)}</b><span>${esc(p.name)}</span></span>
        ${prevBy[p.name] ? '<span class="pose-ab">B/A</span>' : ''}
      </button>`).join('')}</div></div>`;
}

export function bindPlayer(root) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pose]');
    if (!b || !current) return;
    openLightbox(current.items, Number(b.dataset.pose));
  });
  root.addEventListener('keydown', (e) => {
    // ← → scroll the strip when a pose has focus (the document handler steps takes otherwise)
    if (!e.target.closest?.('[data-pose]') || !/^Arrow(Left|Right)$/.test(e.key)) return;
    const poses = $$('[data-pose]', root);
    const i = poses.indexOf(e.target.closest('[data-pose]'));
    const n = poses[i + (e.key === 'ArrowRight' ? 1 : -1)];
    if (n) { n.focus(); n.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }
    e.preventDefault();
    e.stopPropagation();
  });
}

/** used by app.js to keep the strip's scroll position sensible after a re-render */
export function scrollPlayerToStart(root) {
  const s = $('.player-scroll', root);
  if (s) s.scrollLeft = 0;
}
