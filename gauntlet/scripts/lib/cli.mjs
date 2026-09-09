/**
 * Tiny argv parser: `--key value`, `--flag`, `--key=value`. Keys listed in `multi` collect every
 * occurrence into an array (e.g. repeated `--callout`). Positionals are returned under `_`.
 */
export function parseArgs(argv, { multi = [] } = {}) {
  const args = { _: [] };
  const isMulti = new Set(multi);
  const put = (key, value) => {
    if (isMulti.has(key)) (args[key] ??= []).push(value);
    else args[key] = value;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq > 0) {
      put(a.slice(2, eq), a.slice(eq + 1));
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || (next.startsWith('--') && next.length > 2)) put(key, true);
    else {
      put(key, next);
      i++;
    }
  }
  return args;
}

export function listArg(v) {
  if (v === undefined || v === true) return [];
  if (Array.isArray(v)) return v.flatMap(listArg);
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function fmtNum(v, digits = 3) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return String(v);
  if (Number.isInteger(v)) return v.toLocaleString('en-US');
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (abs >= 10) return v.toFixed(1);
  return Number(v.toPrecision(digits)).toString();
}

export function pad(s, n, right = false) {
  s = String(s ?? '');
  const len = [...s].length;
  if (len >= n) return s;
  return right ? ' '.repeat(n - len) + s : s + ' '.repeat(n - len);
}
