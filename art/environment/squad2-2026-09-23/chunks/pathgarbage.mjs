/**
 * One code path's garbage, isolated. Run under `--trace-gc` against two checkouts:
 *
 *   node --trace-gc art/environment/squad2-2026-09-23/chunks/pathgarbage.mjs --root <repo> --calls 40000
 *
 * The sampling heap profiler names the allocating functions but its byte attribution shifts run to run
 * (`getPoint` kept its 9 % share after its 201-per-call throwaway vectors were removed, while `init`
 * vanished and two `BufferAttribute` getters appeared). `--trace-gc` over a loop that does one thing is
 * coarse but honest: same workload, same seeds, count the megabytes reclaimed.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeLoader, THREE } from './fixture.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(flag('root', path.resolve(here, '..', '..', '..', '..')));
const CALLS = Number(flag('calls', 40000));
const WHAT = flag('what', 'growthPath');

const loadTs = makeLoader();
const { growthPath, taper, addLeaf, GeometryWriter } = loadTs(path.join(ROOT, 'src', 'world', 'trees', 'writer.ts'));
const { createRng } = loadTs(path.join(ROOT, 'src', 'world', 'util', 'prng.ts'));

const rng = createRng('pathgarbage');
const origin = new THREE.Vector3();
const target = new THREE.Vector3();
const dir = new THREE.Vector3();
let sink = 0;

if (WHAT === 'growthPath') {
  // the shape a twiglet asks for: four segments off a short parent
  for (let i = 0; i < CALLS; i++) {
    origin.set(rng() * 4, 6 + rng() * 3, rng() * 4);
    target.set(origin.x + rng(), origin.y + rng(), origin.z + rng());
    dir.set(rng() - 0.5, rng(), rng() - 0.5).normalize();
    const p = growthPath(origin, target, dir, rng, 4, 0.7);
    sink += p.length + p[2].x;
  }
} else if (WHAT === 'addLeaf') {
  const writer = new GeometryWriter('high');
  const color = new THREE.Color(0.2, 0.5, 0.1);
  const o = { widthRatio: 0.62, wideFirst: 0.86, wideSecond: 0.62, stiffness: 0.4, flutter: 0.5 };
  for (let i = 0; i < CALLS; i++) {
    origin.set(rng() * 4, 6 + rng() * 3, rng() * 4);
    dir.set(rng() - 0.5, rng(), rng() - 0.5).normalize();
    addLeaf(writer, origin, dir, 0.2, color, rng, o);
    // the writer's own arrays are not what is being measured here: keep them small
    if (writer.positions.length > 60_000) {
      writer.positions.length = 0;
      writer.colors.length = 0;
      writer.uvs.length = 0;
      writer.winds.length = 0;
      writer.roots.length = 0;
      writer.normals.length = 0;
      writer.indices.length = 0;
    }
    sink += writer.leafCount;
  }
}
void taper;
process.stdout.write(`${WHAT} ${CALLS} calls, sink ${Math.round(sink)}\n`);
