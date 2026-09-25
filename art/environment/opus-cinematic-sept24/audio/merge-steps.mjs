// Merge the recorder's per-shot 60 Hz step logs into one edit-time log for render-audio.mjs --steps.
// node merge-steps.mjs <frames-out-dir> [out.json]   (reads <dir>/steps-*.json; keeps recorded rows only)
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3] ?? path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), 'steps-film.json'));
const rows = [];
for (const f of fs.readdirSync(dir).filter((f) => /^steps-.*\.json$/.test(f)).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const list = Array.isArray(j) ? j : j.rows ?? j.ticks ?? [];
  // recorded rows only; `shot` re-arms render-audio's edge detector at every cut (a boot already
  // down there is not a footfall). Only the boolean stance pair is kept: the recorder's `feet`
  // (foot names) would shadow it in render-audio's parser.
  for (const r of list) {
    if (!r.rec) continue;
    rows.push({ edit: r.edit, stance: r.stance.map(Boolean), gait: r.gait, shot: f.slice(6, -5) });
  }
}
rows.sort((a, b) => a.edit - b.edit);
fs.writeFileSync(out, JSON.stringify({ rows }, null, 0));
console.log(`${rows.length} rows from ${dir} -> ${out}`);
