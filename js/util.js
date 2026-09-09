// Small DOM + formatting helpers shared by every module.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Build an element: el('div', { class: 'x', onclick: fn, dataset: {...} }, child, 'text') */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const pad = (n, w = 2) => String(Math.trunc(Math.abs(n))).padStart(w, '0');
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MIN = 60_000;
export const HOUR = 3_600_000;

/** "12 min ago" / "3 h ago" / "2 d ago" */
export function fmtRel(ms) {
  if (!Number.isFinite(ms)) return '—';
  const abs = Math.abs(ms);
  let s;
  if (abs < MIN) s = 'just now';
  else if (abs < HOUR) s = `${Math.round(abs / MIN)} min`;
  else if (abs < 48 * HOUR) {
    const h = Math.floor(abs / HOUR);
    const m = Math.round((abs - h * HOUR) / MIN);
    s = m ? `${h} h ${m} min` : `${h} h`;
  } else s = `${Math.round(abs / (24 * HOUR))} d`;
  if (s === 'just now') return s;
  return ms >= 0 ? `${s} ago` : `in ${s}`;
}

/** Duration "48 min" / "1 h 12 min" / "2 d 3 h" */
export function fmtDur(ms) {
  if (!Number.isFinite(ms)) return '—';
  const abs = Math.abs(ms);
  if (abs < MIN) return '< 1 min';
  if (abs < HOUR) return `${Math.round(abs / MIN)} min`;
  if (abs < 48 * HOUR) {
    const h = Math.floor(abs / HOUR);
    const m = Math.round((abs - h * HOUR) / MIN);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(abs / (24 * HOUR));
  const h = Math.round((abs - d * 24 * HOUR) / HOUR);
  return h ? `${d} d ${h} h` : `${d} d`;
}

export function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** HH:MM (UTC) */
export function fmtTime(v) {
  const d = toDate(v);
  return d ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : '—';
}

/** YYYY-MM-DD HH:MM:SS UTC */
export function fmtDateTime(v) {
  const d = toDate(v);
  if (!d) return '—';
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

/** Short date "09 Sep" */
export function fmtDay(v) {
  const d = toDate(v);
  if (!d) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${pad(d.getUTCDate())} ${months[d.getUTCMonth()]}`;
}

/** Reference-clip timecode from seconds: 00:00:01:00 (HH:MM:SS:FF, 30 fps). */
export function timecode(seconds) {
  const s = Number(seconds) || 0;
  const whole = Math.floor(s);
  const ff = Math.round((s - whole) * 30);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const sec = whole % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}:${pad(ff)}`;
}

export const KINDS = ['new', 'improved', 'todo', 'regression', 'reference'];
export const KIND_COLORS = {
  new: '#8fc64a',
  improved: '#f2b866',
  todo: '#e5484d',
  regression: '#e0409a',
  reference: '#5aa9ff',
};
export function kindOf(k) {
  return KINDS.includes(k) ? k : 'new';
}

const AGENT_PALETTE = ['#f2b866', '#6cc7e6', '#c48cf0', '#8fc64a', '#ff8f6b', '#e0409a'];
export function agentColor(index) {
  return AGENT_PALETTE[((index % AGENT_PALETTE.length) + AGENT_PALETTE.length) % AGENT_PALETTE.length];
}

export function initial(name) {
  const s = String(name || '?').trim();
  return (s[0] || '?').toUpperCase();
}

export function fmtNum(v, digits = 2) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)} k`;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(digits);
}

export function fmtPct(v, digits = 1) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${(Number(v) * 100).toFixed(digits)} %`;
}

let toastTimer = 0;
export function toast(msg, ms = 1800) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
