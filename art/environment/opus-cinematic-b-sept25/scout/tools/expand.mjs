// expand move defs {name,s,from,to,check:"se"|"sme"|"s"} into static test shots at u=0/0.5/1
import fs from 'node:fs';
const defs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const L = (a, b, u) => a.map((v, i) => +(v + (b[i] - v) * u).toFixed(4));
const pose = (d, u) => ({ p: L(d.from.p, d.to.p, u), t: L(d.from.t, d.to.t, u), fov: +(d.from.fov + (d.to.fov - d.from.fov) * u).toFixed(3) });
const out = [];
for (const d of defs) for (const [c, u, tag] of [['s', 0, 'u0'], ['m', 0.5, 'u5'], ['e', 1, 'u1']]) if ((d.check || 'se').includes(c)) { const q = pose(d, u); out.push({ name: `${d.name}@${tag}`, s: 1, from: q, to: q }); }
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 0).replace(/\},\{"name"/g, '},\n{"name"'));
console.log(out.length, 'test shots');
