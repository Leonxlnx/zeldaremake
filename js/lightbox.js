// Full-screen lightbox for the evidence sheets and the player strip: one image at a time with
// prev / next, an A/B toggle when the item has an alternate (before ↔ after, this take ↔ the
// previous take), Esc / ← → / Space keys, and a caption. One instance, mounted on #lightbox.

import { $, esc, clamp } from './util.js';

let items = [];
let index = 0;
let showAlt = false;
let bound = false;
let lastFocus = null;

/**
 * items: [{ src, caption, sub, label, alt: { src, label } | null }]
 */
export function openLightbox(list, start = 0) {
  if (!Array.isArray(list) || !list.length) return;
  items = list;
  index = clamp(start, 0, list.length - 1);
  showAlt = false;
  bind();
  lastFocus = document.activeElement;
  const root = $('#lightbox');
  root.hidden = false;
  document.body.classList.add('lb-open');
  render();
  $('.lb-close', root)?.focus();
}

export function closeLightbox() {
  const root = $('#lightbox');
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.classList.remove('lb-open');
  items = [];
  if (lastFocus?.focus) lastFocus.focus();
}

export function isLightboxOpen() {
  const root = $('#lightbox');
  return !!root && !root.hidden;
}

function step(dir) {
  if (!items.length) return;
  index = (index + dir + items.length) % items.length;
  showAlt = false;
  render();
}

function toggleAlt() {
  if (!items[index]?.alt) return;
  showAlt = !showAlt;
  render();
}

function render() {
  const root = $('#lightbox');
  const it = items[index];
  if (!root || !it) return;
  const src = showAlt && it.alt ? it.alt.src : it.src;
  const label = showAlt && it.alt ? it.alt.label : it.label || '';
  root.innerHTML = `
    <div class="lb-backdrop" data-lb-close></div>
    <figure class="lb" role="dialog" aria-modal="true" aria-label="${esc(it.caption || 'image')}">
      <div class="lb-top">
        <span class="lb-count">${index + 1} / ${items.length}</span>
        ${it.alt ? `<div class="seg lb-ab" role="group" aria-label="Compare"><button type="button" data-lb-ab="0" aria-pressed="${!showAlt}">${esc(it.label || 'A')}</button><button type="button" data-lb-ab="1" aria-pressed="${showAlt}">${esc(it.alt.label || 'B')}</button></div>` : label ? `<span class="lb-label">${esc(label)}</span>` : ''}
        <button type="button" class="lb-close" data-lb-close aria-label="Close (Esc)">✕</button>
      </div>
      <div class="lb-stage" ${it.alt ? 'data-lb-toggle title="Click or Space: toggle A/B"' : ''}>
        <img src="${esc(src)}" alt="${esc(it.caption || '')}" draggable="false">
        ${it.alt ? `<span class="lb-tag">${esc(label)}</span>` : ''}
      </div>
      <figcaption class="lb-cap"><b>${esc(it.caption || '')}</b>${it.sub ? `<span>${esc(it.sub)}</span>` : ''}</figcaption>
      ${items.length > 1 ? `<button type="button" class="lb-nav prev" data-lb-step="-1" aria-label="Previous (←)">‹</button><button type="button" class="lb-nav next" data-lb-step="1" aria-label="Next (→)">›</button>` : ''}
    </figure>`;
  // preload the neighbours and the alternate
  for (const n of [items[(index + 1) % items.length], items[(index - 1 + items.length) % items.length]]) if (n?.src) { const i = new Image(); i.src = n.src; }
  if (it.alt?.src) { const i = new Image(); i.src = it.alt.src; }
}

function bind() {
  if (bound) return;
  bound = true;
  const root = $('#lightbox');
  if (!root) return;
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-lb-close]')) { closeLightbox(); return; }
    const s = e.target.closest('[data-lb-step]');
    if (s) { step(Number(s.dataset.lbStep)); return; }
    const ab = e.target.closest('[data-lb-ab]');
    if (ab) { showAlt = ab.dataset.lbAb === '1'; render(); return; }
    if (e.target.closest('[data-lb-toggle]')) toggleAlt();
  });
  document.addEventListener('keydown', (e) => {
    if (!isLightboxOpen()) return;
    if (e.key === 'Escape') { closeLightbox(); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'ArrowRight') { step(1); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === ' ' || e.key === 'b' || e.key === 'B') { toggleAlt(); e.preventDefault(); e.stopPropagation(); }
  }, true);
}
