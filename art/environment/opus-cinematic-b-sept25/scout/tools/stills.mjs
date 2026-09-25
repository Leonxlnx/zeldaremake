// Turn broll-style pose lists ({name, from, to?}) into recorder stills: node stills.mjs <out.json> <in1.json> [in2.json …]
// Each pose becomes a 1 s camera shot at world time 12.5 (render it with record.mjs --test --test-u 0).
import fs from 'node:fs';
const [out, ...ins] = process.argv.slice(2);
const seen = new Set();
const shots = [];
for (const f of ins) {
  const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const s of Array.isArray(raw) ? raw : raw.shots) {
    const from = s.from ?? s.keys?.[0];
    const key = JSON.stringify([from.p, from.t, from.fov]);
    if (seen.has(key)) continue;
    seen.add(key);
    shots.push({ name: s.name.replace(/[^\w.-]/g, '_'), kind: 'camera', s: 1, time: s.time ?? 12.5, settle: 12, from: { p: from.p, t: from.t, fov: from.fov }, to: { p: from.p, t: from.t, fov: from.fov } });
  }
}
fs.writeFileSync(out, '{"shots":[\n' + shots.map((s) => JSON.stringify(s)).join(',\n') + '\n]}\n');
console.log(shots.length, 'stills →', out);
