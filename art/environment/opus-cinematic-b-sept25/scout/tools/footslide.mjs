// Foot-slide check over recorder step logs: node footslide.mjs <dir with steps-*.json> [--all]
// For every stance interval (a foot's stance flag held ≥ 8 ticks) inside the recorded ticks (or all
// ticks with --all), the sole's world x/z drift between its 3rd and 3rd-last tick and its peak speed.
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const all = process.argv.includes('--all');
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
for (const f of fs.readdirSync(dir).filter((f) => /^steps-.*\.json$/.test(f)).sort()) {
  const st = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const rows = st.rows.filter((r) => all || r.rec);
  const out = [];
  for (let fi = 0; fi < 2; fi++) {
    let run = [];
    const flush = () => {
      if (run.length >= 8) {
        const core = run.slice(2, -2);
        const a = core[0].sole[fi], b = core.at(-1).sole[fi];
        let vmax = 0;
        for (let k = 1; k < core.length; k++) vmax = Math.max(vmax, Math.hypot(core[k].sole[fi][0] - core[k - 1].sole[fi][0], core[k].sole[fi][2] - core[k - 1].sole[fi][2]) * 60);
        out.push({ foot: rows[0].feet[fi], edit: run[0].edit, ticks: run.length, driftMm: Math.hypot(b[0] - a[0], b[2] - a[2]) * 1000, peakMmS: vmax * 1000, gait: run[run.length >> 1].gait });
      }
      run = [];
    };
    for (const r of rows) (r.stance[fi] ? run.push(r) : flush());
    flush();
  }
  const d = out.map((x) => x.driftMm);
  const worst = [...out].sort((a, b) => b.driftMm - a.driftMm)[0];
  const gaps = rows.flatMap((r) => r.gapM.filter((g, i) => r.stance[i]));
  console.log(`${f.padEnd(28)} stances ${String(out.length).padStart(2)}  drift median ${median(d).toFixed(1).padStart(5)} mm  max ${Math.max(0, ...d).toFixed(1).padStart(5)} mm (${worst ? `${worst.foot} ${worst.gait} @${worst.edit.toFixed(2)}s, peak ${worst.peakMmS.toFixed(0)} mm/s` : '-'})  stance gap ${gaps.length ? `${(Math.min(...gaps) * 1000).toFixed(1)}..${(Math.max(...gaps) * 1000).toFixed(1)} mm` : '-'}  reachClamped ${rows.filter((r) => r.reachClamped).length}`);
}
