// Loads takes.json / rubric.json / agents.json (relative to the page, so it works under
// https://<user>.github.io/zeldaremake/) and derives the cross-take relations the UI needs.

import { toDate, agentColor } from './util.js';

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
  { id: 'E_ground', label: 'Ground Close-up', refSeconds: 24 },
  { id: 'F_canopy', label: 'Canopy & Shafts', refSeconds: 8 },
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
  const [takes, rubric, agents] = await Promise.all([
    fetchJson(`${DATA_BASE}takes.json`, EMPTY_TAKES),
    fetchJson(`${DATA_BASE}rubric.json`, null),
    fetchJson(`${DATA_BASE}agents.json`, { agents: [] }),
  ]);
  return normalise({
    takes: takes.value || EMPTY_TAKES,
    rubric: rubric.value,
    agents: agents.value || { agents: [] },
    missing: { takes: takes.missing, rubric: takes.missing && rubric.missing ? true : rubric.missing, agents: agents.missing },
  });
}

export function normalise({ takes, rubric, agents, missing = {} }) {
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
    t.prev = i > 0 ? list[i - 1] : null;
    t.next = i < list.length - 1 ? list[i + 1] : null;
    t.color = colorOf(t.agent);
    t.shots = Array.isArray(t.shots) ? t.shots : [];
    t.shotBy = Object.fromEntries(t.shots.map((s) => [s.viewpoint, s]));
    t.valid = t.valid !== false;
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
