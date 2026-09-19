/**
 * Tiny argv parser: `--key value`, `--flag`, `--key=value`. Keys listed in `multi` collect every
 * occurrence into an array (e.g. repeated `--callout`). Positionals are returned under `_`.
 */
/**
 * Minimal `--flag value` / `--flag=value` / `--flag` parser. Pass `known` (the flags a script
 * reads) to make an unknown flag a hard error instead of a silently ignored one: a mistyped
 * `--in` on take.mjs once fell through to the default build+capture path and sealed the wrong
 * tree locally.
 */
export function parseArgs(argv, { multi = [], known = null } = {}) {
  const args = { _: [] };
  const isMulti = new Set(multi);
  const isKnown = known ? new Set([...known, ...multi]) : null;
  const put = (key, value) => {
    if (isKnown && !isKnown.has(key)) {
      const hint = nearest(key, isKnown);
      console.error(`✗ unknown flag --${key}${hint ? ` (did you mean --${hint}?)` : ''}`);
      process.exit(2);
    }
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

function nearest(key, candidates) {
  let best = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = editDistance(key, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return bestD <= Math.max(1, Math.floor(key.length / 3)) ? best : null;
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
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
