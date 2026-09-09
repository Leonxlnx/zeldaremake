/**
 * Pure rubric evaluator — no I/O. Everything score.mjs prints comes from here.
 *
 *   evaluateRubric(rubric, evidence) → {
 *     items: { [id]: { status, autoStatus, verify, group, phase, weight, title, value, threshold,
 *                      viewpoint, checks: [{ …check, value, threshold, ok, viewpoint, detail }], review } },
 *     passed, total, phasePassed, phaseRequired, phase
 *   }
 *
 *   evidence = {
 *     audit,          // capture audit.json (window.__ZR__.audit())
 *     stats,          // capture stats.json ({ viewpoints: [{ id, stats: { drawCalls, triangles } }] })
 *     compare,        // compare.json ({ viewpoints: { [vp]: { ssim, phashDistance, …, depth } } })
 *     checks,         // checks.json from capture ({ depth, probes, placements, projections })
 *     consoleErrors,  // number of console/page errors during capture
 *     reviews,        // { [item]: review } (see lib/reviews.mjs)
 *     author,         // agent id of the take being scored (D7)
 *   }
 *
 * Status semantics:
 *   auto    → pass when every check passes, else fail
 *   visual  → pending until a valid cross-review verdict exists, then that verdict
 *   both    → auto must pass (else fail); then pending until a valid verdict; verdict decides
 */
import { reviewValidity } from './reviews.mjs';

export const HERO_WILDCARD = '*hero';

// ---------- path resolution ----------

/** Resolve `systems.hardscape.stairways[id=main].steps` / `layout.viewpoints.length` against an object. */
export function resolvePath(obj, pathStr) {
  if (obj == null) return undefined;
  const parts = String(pathStr).match(/[^.[\]]+(\[[^\]]*\])*/g) ?? [];
  let cur = obj;
  for (const rawPart of parts) {
    if (cur == null) return undefined;
    const m = /^([^[]+)((?:\[[^\]]*\])*)$/.exec(rawPart);
    if (!m) return undefined;
    const key = m[1];
    const filters = [...(m[2] ?? '').matchAll(/\[([^\]]*)\]/g)].map((x) => x[1]);
    if (key === 'length') {
      if (Array.isArray(cur) || typeof cur === 'string') cur = cur.length;
      else if (cur && typeof cur === 'object' && 'length' in cur) cur = cur.length;
      else if (cur && typeof cur === 'object') cur = Object.keys(cur).length;
      else return undefined;
    } else cur = cur[key];
    for (const f of filters) {
      if (cur == null) return undefined;
      const eq = f.indexOf('=');
      if (eq > 0) {
        const fk = f.slice(0, eq).trim();
        const fv = f.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!Array.isArray(cur)) return undefined;
        cur = cur.find((x) => x && String(x[fk]) === fv);
      } else if (/^\d+$/.test(f)) cur = Array.isArray(cur) ? cur[Number(f)] : undefined;
      else return undefined;
    }
  }
  return cur;
}

// ---------- operators ----------

export function applyOp(op, value, expected) {
  switch (op) {
    case '>=':
      return typeof value === 'number' && value >= expected;
    case '>':
      return typeof value === 'number' && value > expected;
    case '<=':
      return typeof value === 'number' && value <= expected;
    case '<':
      return typeof value === 'number' && value < expected;
    case '==':
    case '=':
      return value === expected;
    case '!=':
      return value !== undefined && value !== null && value !== expected;
    case 'between':
      return typeof value === 'number' && Array.isArray(expected) && value >= expected[0] && value <= expected[1];
    case 'truthy':
      return !!value;
    case 'falsy':
      return !value;
    case 'includes':
      if (Array.isArray(value)) return value.includes(expected);
      if (typeof value === 'string') return value.includes(String(expected));
      return false;
    default:
      return false;
  }
}

export function describeThreshold(check) {
  const fmt = (v) => (typeof v === 'string' ? JSON.stringify(v) : Array.isArray(v) ? v.join('..') : String(v));
  switch (check.type) {
    case 'audit':
    case 'stats':
    case 'compare':
    case 'pixels':
    case 'depth': {
      switch (check.op) {
        case '>=':
          return `≥ ${fmt(check.value)}`;
        case '>':
          return `> ${fmt(check.value)}`;
        case '<=':
          return `≤ ${fmt(check.value)}`;
        case '<':
          return `< ${fmt(check.value)}`;
        case 'between':
          return `${check.value[0]}..${check.value[1]}`;
        case 'truthy':
          return 'truthy';
        case 'falsy':
          return 'falsy';
        case '!=':
          return `≠ ${fmt(check.value)}`;
        case 'includes':
          return `includes ${fmt(check.value)}`;
        default:
          return `${check.op} ${fmt(check.value)}`;
      }
    }
    case 'probe':
      return `${check.height} ± ${check.tolerance}`;
    case 'placement': {
      const parts = [];
      if (check.maxGap !== undefined) parts.push(`gap ≤ ${check.maxGap} m`);
      if (check.maskMax) parts.push(`mask ${Object.entries(check.maskMax).map(([k, v]) => `${k}<${v}`).join(',')}`);
      return `≥ ${Math.round(check.minPass * 100)} % ${parts.join(' & ')}`.trim();
    }
    case 'projection':
      return `≥ ${Math.round(check.minInside * 100)} % inside`;
    case 'console':
      return `≤ ${check.maxErrors} errors`;
    default:
      return JSON.stringify(check);
  }
}

/** Which direction moves a numeric value toward passing: +1 (bigger better), -1 (smaller better), 0 (n/a). */
export function improvementDirection(check) {
  switch (check.type) {
    case 'probe':
      return -1; // value reported is the absolute gap
    case 'placement':
    case 'projection':
      return 1;
    case 'console':
      return -1;
    default:
      switch (check.op) {
        case '>=':
        case '>':
          return 1;
        case '<=':
        case '<':
          return -1;
        default:
          return 0;
      }
  }
}

// ---------- evidence lookups ----------

function viewpointsFor(check, rubric) {
  if (check.viewpoint === HERO_WILDCARD) return rubric.heroViewpoints ?? [];
  if (check.viewpoint === '*') return rubric.allViewpoints ?? [];
  return [check.viewpoint];
}

function statsFor(stats, vp) {
  const list = stats?.viewpoints ?? [];
  const hit = list.find((v) => v.id === vp);
  return hit?.stats ?? null;
}

function compareFor(compare, vp) {
  return compare?.viewpoints?.[vp] ?? null;
}

function depthFor(checks, compare, vp) {
  return checks?.depth?.[vp] ?? compare?.viewpoints?.[vp]?.depth ?? null;
}

/** Evaluate a per-viewpoint metric check, taking the worst case over `*hero`. */
function evalMetric(check, rubric, getter) {
  const vps = viewpointsFor(check, rubric);
  const dir = improvementDirection(check);
  let worst = null;
  const perViewpoint = {};
  for (const vp of vps) {
    const v = getter(vp);
    perViewpoint[vp] = v ?? null;
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      if (!worst || worst.value !== null) worst = { vp, value: null };
      continue;
    }
    if (!worst || worst.value === null) {
      if (!worst) worst = { vp, value: v };
      continue;
    }
    if (dir >= 0 ? v < worst.value : v > worst.value) worst = { vp, value: v };
  }
  if (!worst) worst = { vp: check.viewpoint, value: null };
  const ok = worst.value !== null && applyOp(check.op, worst.value, check.value);
  return { value: worst.value, viewpoint: worst.vp, ok, perViewpoint: vps.length > 1 ? perViewpoint : undefined, detail: worst.value === null ? `no ${check.type} evidence for ${worst.vp}` : undefined };
}

export function evaluateCheck(check, evidence, rubric) {
  const base = { ...check, threshold: describeThreshold(check) };
  switch (check.type) {
    case 'audit': {
      const value = resolvePath(evidence.audit, check.path);
      const norm = value === undefined ? null : value;
      return { ...base, value: norm, ok: value !== undefined && applyOp(check.op, value, check.value), detail: value === undefined ? `audit path ${check.path} missing` : undefined };
    }
    case 'stats':
      return { ...base, ...evalMetric(check, rubric, (vp) => statsFor(evidence.stats, vp)?.[check.metric]) };
    case 'compare':
    case 'pixels':
      return { ...base, ...evalMetric(check, rubric, (vp) => compareFor(evidence.compare, vp)?.[check.metric]) };
    case 'depth':
      return { ...base, ...evalMetric(check, rubric, (vp) => depthFor(evidence.checks, evidence.compare, vp)?.[check.metric]) };
    case 'probe': {
      const probes = evidence.checks?.probes ?? [];
      const hit = probes.find((p) => Number(p.x) === Number(check.x) && Number(p.z) === Number(check.z));
      if (!hit || typeof hit.height !== 'number') return { ...base, value: null, ok: false, detail: `no probe evidence at (${check.x}, ${check.z})` };
      const gap = Math.abs(hit.height - check.height);
      return { ...base, value: Number(hit.height.toFixed(3)), gap: Number(gap.toFixed(3)), ok: gap <= check.tolerance };
    }
    case 'placement': {
      const p = evidence.checks?.placements?.[check.path];
      if (!p || p.missing || typeof p.passFraction !== 'number') return { ...base, value: null, ok: false, detail: p?.missing ? `${check.path} not exposed by the system` : `no placement evidence for ${check.path}` };
      return { ...base, value: Number(p.passFraction.toFixed(4)), samples: p.samples, maxGapSeen: p.maxGap, ok: p.passFraction >= check.minPass && p.samples > 0 };
    }
    case 'projection': {
      const key = `${check.viewpoint}:${check.layout}`;
      const p = evidence.checks?.projections?.[key];
      if (!p || typeof p.insideFraction !== 'number') return { ...base, value: null, ok: false, detail: `no projection evidence for ${key}` };
      return { ...base, value: Number(p.insideFraction.toFixed(3)), ok: p.insideFraction >= check.minInside, viewpoint: check.viewpoint };
    }
    case 'console': {
      const n = evidence.consoleErrors;
      if (typeof n !== 'number') return { ...base, value: null, ok: false, detail: 'no console log' };
      return { ...base, value: n, ok: n <= check.maxErrors };
    }
    default:
      return { ...base, value: null, ok: false, detail: `unknown check type ${check.type}` };
  }
}

// ---------- items ----------

export function evaluateItem(item, evidence, rubric) {
  const checks = (item.checks ?? []).map((c) => evaluateCheck(c, evidence, rubric));
  const hasAuto = checks.length > 0;
  const autoOk = checks.every((c) => c.ok);
  const autoStatus = hasAuto ? (autoOk ? 'pass' : 'fail') : null;

  const review = evidence.reviews?.[item.id] ?? null;
  const validity = review ? reviewValidity(review, evidence.author) : null;
  const verdict = validity?.valid ? review.verdict : null;

  let status;
  if (item.verify === 'auto') status = hasAuto ? autoStatus : 'pending';
  else if (item.verify === 'visual') status = verdict ?? 'pending';
  else {
    // both
    if (hasAuto && !autoOk) status = 'fail';
    else if (!verdict) status = 'pending';
    else status = verdict;
  }

  const primary = checks.find((c) => !c.ok) ?? checks[0] ?? null;
  return {
    id: item.id,
    title: item.title,
    group: item.group,
    phase: item.phase,
    verify: item.verify,
    weight: item.weight,
    status,
    autoStatus,
    value: primary ? primary.value : null,
    threshold: primary ? primary.threshold : item.verify === 'visual' ? 'reviewer verdict' : null,
    viewpoint: primary?.viewpoint ?? item.reference?.frame ?? null,
    primaryCheck: primary ? checks.indexOf(primary) : null,
    checks,
    review: review
      ? { reviewer: review.reviewer, verdict: review.verdict, takeId: review.takeId ?? null, at: review.at ?? null, evidence: review.evidence ?? null, valid: validity.valid, reason: validity.reason }
      : null,
  };
}

export function evaluateRubric(rubric, evidence = {}) {
  const items = {};
  for (const item of rubric.items) items[item.id] = evaluateItem(item, evidence, rubric);
  const phase = evidence.phase ?? 1;
  const prefix = rubric.phaseRequired?.[String(phase)] ?? 'W';
  const required = rubric.items.filter((i) => i.id.startsWith(prefix));
  const passed = Object.values(items).filter((i) => i.status === 'pass').length;
  const phasePassed = required.filter((i) => items[i.id].status === 'pass').length;
  return {
    items,
    passed,
    total: rubric.items.length,
    phase,
    phaseRequired: required.length,
    phasePassed,
    pending: Object.values(items).filter((i) => i.status === 'pending').length,
    failed: Object.values(items).filter((i) => i.status === 'fail').length,
  };
}

/** Count console/page errors in a capture console.log. */
export function countConsoleErrors(text) {
  if (typeof text !== 'string') return null;
  return text.split('\n').filter((l) => /^\[page:error\]|^\[pageerror\]/.test(l)).length;
}
