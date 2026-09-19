// Per-round evidence gallery: the before/after sheets every lane files under
// art/environment/round<N>-review/ and the survey reports (survey<N>/), exported to
// data/evidence/ at publish time (monitor.mjs syncEvidence). One set is open at a time — the set
// of the current take's round by default — with its README rendered beside the sheets grouped by
// lane; before/after pairs are one card with an A/B toggle; every sheet opens in the lightbox.

import { $, $$, esc, fmtDateTime } from './util.js';
import { state, set } from './state.js';
import { dataUrl, evidenceSetFor } from './data.js';
import { renderMarkdown } from './markdown.js';
import { openLightbox } from './lightbox.js';

let currentItems = []; // lightbox items of the rendered set, in card order
let textCache = new Map(); // text file → markdown

export function renderEvidence(root, data) {
  const ev = data.evidence;
  const take = data.byId[state.takeId] || null;
  if (!ev || !ev.sets.length) {
    root.innerHTML = `<div class="panel-h"><span class="t">Evidence</span><span class="sub">no rounds published yet</span></div>
      <p class="empty-note">Each round's before/after sheets (<code>art/environment/round&lt;N&gt;-review/</code>) and the survey reports appear here once a take is published with <code>monitor.mjs</code>'s evidence export; the sets are read from <code>data/evidence/index.json</code>.</p>`;
    currentItems = [];
    return;
  }
  const chosen = ev.byId[state.evidenceSet] || evidenceSetFor(data, take) || ev.sets[0];
  const takeRound = take?.round ?? null;
  const chips = ev.sets.map((s) => {
    const cur = s.id === chosen.id;
    const mine = takeRound != null && s.round === takeRound;
    return `<button type="button" class="ev-chip${cur ? ' cur' : ''}${mine ? ' mine' : ''}" data-ev-set="${esc(s.id)}" aria-pressed="${cur}" title="${esc(s.title || s.id)}${mine ? ' · the round of this take' : ''}">${esc(s.kind === 'survey' ? `survey ${s.round ?? ''}` : `round ${s.round ?? s.id}`)}<span class="n">${s.sheets.length}</span></button>`;
  }).join('');

  // sheets grouped by lane, before/after pairs folded into one card
  const groups = new Map();
  const items = [];
  for (const sh of chosen.sheets) {
    if (sh.pairRole === 'before' && chosen.pairs[sh.pairKey]?.after) continue; // the after card carries it
    const after = sh;
    const before = sh.pairRole === 'after' ? chosen.pairs[sh.pairKey]?.before : null;
    const lane = sh.lane || 'sheets';
    const idx = items.length;
    items.push({
      src: dataUrl(after.file),
      caption: prettyName(after),
      sub: `${chosen.title || chosen.id} · ${after.name}${after.w ? ` · ${after.w}×${after.h}` : ''}`,
      label: before ? 'after' : `${chosen.kind === 'survey' ? 'survey' : 'round'} ${chosen.round ?? ''}`.trim(),
      alt: before ? { src: dataUrl(before.file), label: 'before' } : null,
    });
    (groups.get(lane) ?? groups.set(lane, []).get(lane)).push({ sheet: after, before, idx });
  }
  currentItems = items;
  const linkedTakes = (chosen.takes || []).filter((id) => data.byId[id]);
  const readmeBase = chosen.text ? dataUrl(chosen.text).replace(/[^/]+$/, '') : '';
  root.innerHTML = `
    <div class="ev-head">
      <div class="ev-title">
        <h2>Evidence gallery</h2>
        <div class="sum">${ev.sets.length} set${ev.sets.length === 1 ? '' : 's'} · ${ev.sets.reduce((n, s) => n + s.sheets.length, 0)} sheets · from <code>art/environment/</code> on the world branch${ev.source?.shortSha ? ` @ ${esc(ev.source.shortSha)}` : ''}</div>
      </div>
      <div class="ev-sets" role="group" aria-label="Evidence set">${chips}</div>
    </div>
    <div class="ev-body">
      <aside class="ev-text">
        <div class="ev-set-h">
          <div class="k">${esc(chosen.kind === 'survey' ? 'Survey report' : 'Round review')}</div>
          <h3>${esc(chosen.title || chosen.id)}</h3>
          <div class="ev-meta">${chosen.sheets.length} sheets${linkedTakes.length ? ` · takes ${linkedTakes.map((id) => `<a href="#${esc(id)}/${esc(state.viewpoint)}/${esc(state.mode)}" data-goto-take="${esc(id)}">${esc(id.replace('take-', 'T'))}</a>`).join(', ')}` : ''}${chosen.updatedAt ? ` · ${esc(fmtDateTime(chosen.updatedAt))}` : ''}</div>
        </div>
        <div class="ev-md" data-ev-md="${esc(chosen.text || '')}" data-ev-base="${esc(readmeBase)}">${chosen.text ? '<div class="strip-empty">loading the review…</div>' : '<p class="empty-note">This set has no README.</p>'}</div>
        ${chosen.text ? '<button type="button" class="btn ev-more" data-ev-more aria-expanded="false">Read the whole review</button>' : ''}
      </aside>
      <div class="ev-grid-wrap">
        ${[...groups.entries()].map(([lane, cards]) => `
          <section class="ev-lane">
            <div class="ev-lane-h"><h4>${esc(lane)}</h4><span class="k">${cards.length} sheet${cards.length === 1 ? '' : 's'}</span></div>
            <div class="ev-grid">${cards.map(({ sheet, before, idx }) => `
              <button type="button" class="ev-card${before ? ' has-before' : ''}" data-ev-item="${idx}" title="${esc(prettyName(sheet))}${before ? ' · before/after — hover for before' : ''}" style="--ar:${sheet.w && sheet.h ? `${sheet.w}/${sheet.h}` : '16/9'}">
                <img src="${esc(dataUrl(sheet.file))}" alt="${esc(prettyName(sheet))}" loading="lazy" decoding="async">
                ${before ? `<img class="ev-before" src="${esc(dataUrl(before.file))}" alt="" loading="lazy" decoding="async"><span class="pose-ab">before ↔ after</span>` : ''}
                <span class="ev-cap"><b>${esc(prettyName(sheet))}</b>${sheet.pose ? `<span>${esc(sheet.pose)}</span>` : ''}</span>
              </button>`).join('')}</div>
          </section>`).join('')}
      </div>
    </div>`;
  loadText(root, chosen);
}

function prettyName(sheet) {
  let n = sheet.name || sheet.file.split('/').pop().replace(/\.[a-z]+$/i, '');
  if (sheet.lane) n = n.replace(new RegExp(`^${sheet.lane}[-_]?`, 'i'), '');
  n = n.replace(/[-_](before|after)$/i, '').replace(/[-_]+/g, ' ').trim();
  return n || sheet.name;
}

async function loadText(root, setData) {
  const box = $('[data-ev-md]', root);
  if (!box || !setData.text) return;
  const url = dataUrl(setData.text);
  let md = textCache.get(url);
  if (md == null) {
    try {
      const r = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
      md = r.ok ? await r.text() : '';
    } catch { md = ''; }
    textCache.set(url, md);
  }
  if (!$('[data-ev-md]', root) || $('[data-ev-md]', root).dataset.evMd !== setData.text) return; // re-rendered meanwhile
  box.innerHTML = md ? renderMarkdown(md, { base: box.dataset.evBase }) : '<p class="empty-note">The review text could not be loaded.</p>';
  box.classList.toggle('is-long', box.scrollHeight > box.clientHeight + 8);
}

export function bindEvidence(root) {
  root.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-ev-set]');
    if (chip) { set({ evidenceSet: chip.dataset.evSet }); return; }
    const more = e.target.closest('[data-ev-more]');
    if (more) {
      const box = $('[data-ev-md]', root);
      const open = box.classList.toggle('is-open');
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? 'Collapse the review' : 'Read the whole review';
      return;
    }
    const card = e.target.closest('[data-ev-item]');
    if (card) { openLightbox(currentItems, Number(card.dataset.evItem)); return; }
    const gt = e.target.closest('[data-goto-take]');
    if (gt) { e.preventDefault(); set({ takeId: gt.dataset.gotoTake }); }
  });
}

/** every evidence <img> that failed marks its card (a set published without the sheet) */
export function bindEvidenceImages(root) {
  root.addEventListener('error', (e) => {
    const im = e.target;
    if (im?.tagName === 'IMG') im.closest('.ev-card, .pose')?.classList.add('is-missing');
  }, true);
}
