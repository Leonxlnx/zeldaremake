// Loads takes.json / rubric.json / agents.json (relative to the page, so it works under
// https://<user>.github.io/zeldaremake/) and derives the cross-take relations the UI needs.

import { toDate, agentColor } from './util.js';
import { headlineOf, roundOf } from './headline.js';

// Data base: relative on GitHub Pages / local. On raw CDN mirrors (githack/jsdelivr/statically) read
// straight from the monitor branch on raw.githubusercontent.com so hourly takes appear within ~5 min.
// Override with window.MONITOR_DATA_BASE before app.js loads.
const ON_RAW_CDN = /githack\.com$|jsdelivr\.net$|statically\.io$/.test(location.hostname);
export const DATA_BASE = window.MONITOR_DATA_BASE || (ON_RAW_CDN ? 'https://raw.githubusercontent.com/Leonxlnx/zeldaremake/monitor/data/' : './data/');
export const dataUrl = (rel) => (rel ? DATA_BASE + String(rel).replace(/^\/+/, '') : '');

export const EMPTY_TAKES = { project: 'zeldaremake', updatedAt: null, monitorCadenceMinutes: 60, takes: [] };

export const GROUPS = [
  ['composition', 'Composition, terrain, ground', 'W01–W07'],
  ['trees', 'Trees', 'W08–W14'],
  ['vegetation', 'Vegetation & wind', 'W15–W22'],
  ['rocks', 'Rocks', 'W23–W24'],
  ['structures', 'Structures', 'W25–W29'],
  ['lighting', 'Lighting, atmosphere, image match', 'W30–W37'],
  ['engineering', 'Performance & engineering', 'W38–W42'],
  ['character', 'Character (Phase 2)', 'C01–C05'],
  ['ui', 'UI (Phase 3)', 'U01–U03'],
];

export const DEFAULT_VIEWPOINTS = [
  { id: 'A_stairs', label: 'The Stairs', refSeconds: 1 },
  { id: 'B_house', label: "Saria's House", refSeconds: 14 },
  { id: 'C_lookback', label: 'Look Back', refSeconds: 46 },
  { id: 'D_log', label: 'The Log Arch', refSeconds: 56 },
  { id: 'E_ground', label: "Saria's House (hold)", refSeconds: 24 },
  { id: 'F_canopy', label: 'Up the Stairs', refSeconds: 8 },
];

async function fetchJson(url, fallback) {
  try {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return { value: fallback, missing: true, status: res.status };
    return { value: await res.json(), missing: false };
  } catch (e) {
    return { value: fallback, missing: true, error: String(e) };
  }
}

export async function loadAll() {
  const [takes, rubric, agents, evidence] = await Promise.all([
    fetchJson(`${DATA_BASE}takes.json`, EMPTY_TAKES),
    fetchJson(`${DATA_BASE}rubric.json`, null),
    fetchJson(`${DATA_BASE}agents.json`, { agents: [] }),
    fetchJson(`${DATA_BASE}evidence/index.json`, null),
  ]);
  return normalise({
    takes: takes.value || EMPTY_TAKES,
    rubric: rubric.value,
    agents: agents.value || { agents: [] },
    evidence: evidence.value,
    missing: { takes: takes.missing, rubric: takes.missing && rubric.missing ? true : rubric.missing, agents: agents.missing, evidence: evidence.missing },
  });
}

/**
 * The evidence index (data/evidence/index.json, written by monitor.mjs syncEvidence): sets sorted
 * newest round first, surveys after the rounds; before/after pairs indexed per set.
 */
export function normaliseEvidence(ev) {
  const sets = Array.isArray(ev?.sets) ? ev.sets.filter((s) => s && s.id).map((s) => ({ ...s, sheets: Array.isArray(s.sheets) ? s.sheets.filter((x) => x?.file) : [] })) : [];
  if (!sets.length) return null;
  const rank = (s) => (s.kind === 'survey' ? 0 : 1) * 10_000 + (Number(s.round) || 0);
  sets.sort((a, b) => rank(b) - rank(a));
  for (const s of sets) {
    s.pairs = {};
    for (const sh of s.sheets) if (sh.pairKey && sh.pairRole) (s.pairs[sh.pairKey] ??= {})[sh.pairRole] = sh;
  }
  const source = ev.source || null;
  if (source && !source.shortSha && source.sha) source.shortSha = String(source.sha).slice(0, 7);
  return { generatedAt: ev.generatedAt || null, source, sets, byId: Object.fromEntries(sets.map((s) => [s.id, s])) };
}

/** The evidence set that belongs to a take: same round, or a set whose README names the take. */
export function evidenceSetFor(data, take) {
  const ev = data.evidence;
  if (!ev || !take) return null;
  if (take.round != null) {
    const byRound = ev.sets.find((s) => s.kind !== 'survey' && s.round === take.round);
    if (byRound) return byRound;
  }
  return ev.sets.find((s) => Array.isArray(s.takes) && s.takes.includes(take.id)) || null;
}

/**
 * The player strip to show for a take: its own (data/takes/<id>/player/), else the nearest earlier
 * take's (`borrowed`), plus the strip before that one for before/after comparison.
 */
export function playerStripFor(data, take) {
  if (!take) return null;
  const has = (t) => Array.isArray(t?.player?.poses) && t.player.poses.length > 0;
  let owner = null;
  for (let i = take.index; i >= 0; i--) if (has(data.takes[i])) { owner = data.takes[i]; break; }
  if (!owner) return null;
  let previous = null;
  for (let i = owner.index - 1; i >= 0; i--) if (has(data.takes[i])) { previous = data.takes[i]; break; }
  return { owner, borrowed: owner !== take, previous, poses: owner.player.poses };
}

export function normalise({ takes, rubric, agents, evidence = null, missing = {} }) {
  const list = Array.isArray(takes?.takes) ? takes.takes.slice() : [];
  list.sort((a, b) => (toDate(a.at)?.getTime() ?? 0) - (toDate(b.at)?.getTime() ?? 0));

  // agents: union of agents.json and take authors, stable colours
  const agentIds = [];
  for (const a of agents?.agents || []) if (a?.agent && !agentIds.includes(a.agent)) agentIds.push(a.agent);
  for (const t of list) if (t.agent && !agentIds.includes(t.agent)) agentIds.push(t.agent);
  const agentIndex = Object.fromEntries(agentIds.map((id, i) => [id, i]));
  const colorOf = (id) => agentColor(agentIndex[id] ?? agentIds.length);

  // viewpoints
  const vpMap = new Map(DEFAULT_VIEWPOINTS.map((v) => [v.id, { ...v }]));
  for (const t of list) for (const s of t.shots || []) {
    if (!s?.viewpoint) continue;
    const cur = vpMap.get(s.viewpoint) || { id: s.viewpoint };
    if (s.label) cur.label = s.label;
    if (s.refSeconds != null) cur.refSeconds = s.refSeconds;
    if (s.reference) cur.reference = s.reference;
    vpMap.set(s.viewpoint, cur);
  }
  const order = rubric?.allViewpoints || DEFAULT_VIEWPOINTS.map((v) => v.id);
  const viewpoints = [...order.filter((id) => vpMap.has(id)), ...[...vpMap.keys()].filter((id) => !order.includes(id))]
    .map((id) => {
      const v = vpMap.get(id);
      return { id, label: v.label || id.replace(/^[A-Z]_/, '').replace(/_/g, ' '), refSeconds: v.refSeconds ?? 0, letter: id[0].toUpperCase(),
        reference: v.reference || `reference/frames/${id}.jpg` };
    });

  // per-take derivations
  const byId = {};
  list.forEach((t, i) => {
    t.index = i;
    t.atMs = toDate(t.at)?.getTime() ?? 0;
    // the card shows when the frame was captured; `at` orders the chain
    t.capturedAt = t.capturedAt ?? t.at;
    t.capturedAtMs = toDate(t.capturedAt)?.getTime() ?? t.atMs;
    t.prev = i > 0 ? list[i - 1] : null;
    t.next = i < list.length - 1 ? list[i + 1] : null;
    t.color = colorOf(t.agent);
    t.shots = Array.isArray(t.shots) ? t.shots : [];
    t.shotBy = Object.fromEntries(t.shots.map((s) => [s.viewpoint, s]));
    t.valid = t.valid !== false;
    // the director's cut: takes published before monitor.mjs stored these derive them here
    if (!t.headline) t.headline = headlineOf(t.note, t.subject);
    if (t.round == null) t.round = roundOf(t.note, t.subject);
    t.player = t.player && Array.isArray(t.player.poses) ? t.player : null;
    byId[t.id] = t;
  });
  for (const t of list) {
    const prevItems = t.prev?.score?.items || {};
    const items = t.score?.items || {};
    t.flips = {};
    for (const [id, it] of Object.entries(items)) {
      let d = it?.delta;
      if (!d) {
        const p = prevItems[id]?.status;
        if (p && it?.status && p !== it.status) d = `${p}→${it.status}`;
      }
      if (d && /→/.test(d)) t.flips[id] = d;
    }
    for (const s of t.shots) {
      s.previousShot = t.prev?.shotBy?.[s.viewpoint] || null;
      if (!s.previous && s.previousShot?.image) s.previous = s.previousShot.image;
    }
  }

  const rubricItems = Array.isArray(rubric?.items) ? rubric.items : [];
  const rubricById = Object.fromEntries(rubricItems.map((it) => [it.id, it]));
  const phaseRequired = rubricItems.filter((it) => it.phase === 1).length || 42;

  return {
    project: takes?.project || 'zeldaremake',
    updatedAt: takes?.updatedAt || (list.length ? list[list.length - 1].at : null),
    cadenceMin: Number(takes?.monitorCadenceMinutes) > 0 ? Number(takes.monitorCadenceMinutes) : 60,
    takes: list,
    byId,
    latest: list[list.length - 1] || null,
    viewpoints,
    vpById: Object.fromEntries(viewpoints.map((v) => [v.id, v])),
    rubric,
    rubricItems,
    rubricById,
    phaseRequired,
    agents: (agents?.agents || []).map((a) => ({ ...a, color: colorOf(a.agent) })),
    agentIds,
    colorOf,
    evidence: normaliseEvidence(evidence),
    // the walkable build under play/ (monitor.mjs syncPlayBuild): which take's build it is
    play: takes?.play && takes.play.sha ? { ...takes.play, shortSha: takes.play.shortSha || String(takes.play.sha).slice(0, 7) } : null,
    missing,
  };
}

/** Threshold text for a rubric item, from a score entry or from the rubric checks. */
export function describeThreshold(rubricItem, scoreEntry) {
  if (scoreEntry?.threshold != null && scoreEntry.threshold !== '') return String(scoreEntry.threshold);
  const c = rubricItem?.checks?.[0];
  if (!c) return rubricItem?.verify === 'visual' ? 'reviewer verdict' : '—';
  if (c.op === 'between' && Array.isArray(c.value)) return `${c.value[0]}..${c.value[1]}`;
  if (c.op === 'truthy') return 'truthy';
  if (c.type === 'console') return `errors ≤ ${c.maxErrors ?? 0}`;
  if (c.type === 'projection') return `inside ≥ ${c.minInside}`;
  if (c.type === 'probe') return `±${c.tolerance} m`;
  if (c.type === 'placement') return `pass ≥ ${c.minPass}`;
  if (c.op && c.value != null) return `${c.op} ${c.value}`;
  return '—';
}

export function fmtScoreValue(v) {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M`;
    if (Math.abs(v) >= 10_000) return `${(v / 1000).toFixed(1)} k`;
    return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }
  if (Array.isArray(v)) return v.map(fmtScoreValue).join(', ');
  return String(v);
}

/** Metric direction + goal read from the rubric (compare/pixels checks), with fallbacks. */
export function metricTargets(rubric) {
  const targets = {
    ssim: { op: '>=', value: 0.42, good: 'up', label: 'SSIM', fmt: (v) => v.toFixed(2) },
    phashDistance: { op: '<=', value: 26, good: 'down', label: 'pHash Δ', fmt: (v) => String(Math.round(v)) },
    hueDiffDeg: { op: '<=', value: 14, good: 'down', label: 'Hue Δ', unit: '°', fmt: (v) => v.toFixed(1) },
    satDiff: { op: '<=', value: 0.1, good: 'down', label: 'Sat Δ', fmt: (v) => v.toFixed(3).replace(/0$/, '') },
    lumDiff: { op: '<=', value: 0.12, good: 'down', label: 'Lum Δ', fmt: (v) => v.toFixed(3).replace(/0$/, '') },
    sharpnessRatio: { op: '>=', value: 0.8, good: 'up', label: 'Sharpness', unit: '×', fmt: (v) => v.toFixed(2) },
    skyFraction: { op: '<=', value: 0.45, good: 'down', label: 'Sky', unit: '%', pct: true, fmt: (v) => (v * 100).toFixed(1), onlyFor: 'F_canopy' },
    overexposedFraction: { op: '<=', value: 0.01, good: 'down', label: 'Overexposed', unit: '%', pct: true, fmt: (v) => (v * 100).toFixed(2) },
  };
  for (const it of rubric?.items || []) {
    for (const c of it.checks || []) {
      if ((c.type === 'compare' || c.type === 'pixels') && targets[c.metric] && c.value != null && typeof c.value === 'number') {
        targets[c.metric].op = c.op;
        targets[c.metric].value = c.value;
        targets[c.metric].item = it.id;
      }
    }
  }
  return targets;
}
