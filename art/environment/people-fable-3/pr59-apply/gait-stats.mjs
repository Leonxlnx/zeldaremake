// stance / flight fractions and step timing from a run-strip rows.json
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const rows = d.rows.filter((r) => Array.isArray(r.feet) && r.feet.length === 2);
  const n = rows.length;
  const flight = rows.filter((r) => !r.feet[0].stance && !r.feet[1].stance).length;
  const both = rows.filter((r) => r.feet[0].stance && r.feet[1].stance).length;
  const single = n - flight - both;
  // step period: frames between successive stance onsets of either foot
  const onsets = [];
  for (let i = 1; i < n; i++) for (const k of [0, 1]) if (rows[i].feet[k].stance && !rows[i - 1].feet[k].stance) onsets.push(i);
  const gaps = onsets.slice(1).map((v, i) => v - onsets[i]);
  const mean = gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : NaN;
  const y = rows.map((r) => r.link[1]);
  console.log(`${f}: ${d.gait} ${d.speedMps.toFixed(3)} m/s over ${n} frames @60Hz — flight ${(100 * flight / n).toFixed(0)}%, single stance ${(100 * single / n).toFixed(0)}%, double ${(100 * both / n).toFixed(0)}%; step every ${mean.toFixed(1)} frames = ${(mean / 60).toFixed(3)} s → ${(60 / mean).toFixed(2)} steps/s, step length ${(d.speedMps * mean / 60).toFixed(3)} m; ground y range ${(Math.max(...y) - Math.min(...y)).toFixed(4)} m`);
}
