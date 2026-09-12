/** Eleven fixed full-scene D approach samples; no arbitrary camera input or scene isolation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as T from 'three';
import { digest } from './environment-capture-data.mjs';

export const MIDDEPTH_SCHEMA = 'zeldaremake.environment-middepth-sweep.v1';
export const MIDDEPTH_SCOPE = 'Eleven original full-scene distance samples over a 16 m D approach at fixed simulation time. Matched 22 m and 32 m source runs can inform provisional art retention. These discrete views do not measure continuous playback or interactive LOD timing; setPose forces vegetation rebucketing while trees retain their existing distance cache. No light/post override or hidden objects.';

// Portable original-depth provenance, never loaded as an image or game asset. Coordinates are
// fixed probe estimates from the actual 0d4 D capture, re-seated against the source terrain.
// Their x/z locations and height offsets are observations, not an exact material/triangle ID.
const PROBES = [
  { id: 'middle-path', pixel: [632, 344], x: 3.4565562129560314, z: -35.487256897109106, aboveTerrain: 0 },
  { id: 'middle-trunk-low', pixel: [536, 312], x: -.38982311315246104, z: -35.007897353413085, aboveTerrain: 1.1446973537044811 },
  { id: 'middle-trunk-upper', pixel: [520, 232], x: -1.0303435146997357, z: -35.05208002711278, aboveTerrain: 4.2235837733854025 },
];

export function loadMiddepthSweep(root) {
  const modules = new Map(), sources = new Map();
  function load(file) {
    file = path.posix.normalize(file); assert(file.startsWith('src/world/'));
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const text = fs.readFileSync(path.join(root, file), 'utf8'); sources.set(file, digest(text));
    const compiled = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', compiled)(name => name === 'three' ? T : load(path.posix.join(path.posix.dirname(file), name + '.ts')), module, module.exports);
    return module.exports;
  }
  const { LAYOUT } = load('src/world/layout.ts'), terrain = load('src/world/terrain/heightfield.ts').createTerrain();
  const fog = load('src/world/atmosphere/heightfog.ts').HEIGHT_FOG_DEFAULTS;
  assert([22, 32].includes(fog.farShadeStart), 'Review this bounded comparison if the shade trial changes');
  assert.equal(fog.farShadeFull, 44); assert.equal(fog.farShadeMin, .3);
  const view = LAYOUT.viewpoints.find(v => v.id === 'D_log');
  assert.deepEqual(view.position, [.2, 1.45, -3]); assert.deepEqual(view.target, [4.5, 2.75, -42]); assert.equal(view.fov, 48);
  const anchors = PROBES.map(p => ({ ...p, point: [p.x, terrain.height(p.x, p.z) + p.aboveTerrain, p.z] }));
  const frames = Array.from({ length: 11 }, (_, i) => ({ id: `M${String(i + 1).padStart(2, '0')}-north`,
    position: [.2, 1.45, (100 - 16 * i) / 10], target: [...view.target], fov: view.fov }));
  const track = Array.from({ length: 161 }, (_, i) => {
    const z = (100 - i) / 10, mask = terrain.mask(.2, z), clearance = 1.45 - terrain.height(.2, z);
    assert(clearance > 1.4 && mask.path > .99 && mask.stairs === 0 && mask.structure === 0, 'Review terrain clearance along D approach');
    return clearance;
  });
  const samples = frames.map(frame => {
    const camera = new T.PerspectiveCamera(frame.fov, 1280 / 720, .08, 900);
    camera.position.fromArray(frame.position); camera.lookAt(new T.Vector3(...frame.target)); camera.updateMatrixWorld(true);
    return { frame: frame.id, anchors: anchors.map(a => {
      const point = new T.Vector3(...a.point), distance = camera.position.distanceTo(point), projected = point.clone().project(camera);
      assert(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && Math.abs(projected.z) < 1, 'Target remains framed');
      let clearance = Infinity;
      // Positive clearance excludes the last 0.5 m at the ground-contact endpoint only.
      const terminal = a.id === 'middle-path' ? .5 : 0;
      for (let s = 0; s <= distance - terminal; s += .1) {
        const p = camera.position.clone().lerp(point, s / distance);
        clearance = Math.min(clearance, p.y - terrain.height(p.x, p.z));
      }
      assert(clearance > 0, 'Source terrain must not block the target line');
      return { id: a.id, distanceM: distance, pixel: [(projected.x + 1) * 640, (1 - projected.y) * 360],
        terrainLineClearanceM: clearance, terminalExcludedM: terminal };
    }) };
  });
  for (let i = 0; i < anchors.length; i++) assert(samples[0].anchors[i].distanceM > 44 && samples.at(-1).anchors[i].distanceM < 32, 'Every target traverses the 32–44 m band');
  return { schema: MIDDEPTH_SCHEMA, frames, anchors, repeatedPosePairs: [], oneWayTravelM: 16,
    farShade: { startM: fog.farShadeStart, fullM: fog.farShadeFull, minimum: fog.farShadeMin },
    targetProvenance: { source: '0d4ae524bb29a64df796e7506e34761498626244', view: 'D_log', depthSize: [80, 45],
      imageSHA256: 'b161c0e7032a048ef50e7a356157b3ae9f6560e552c81cebe2bde1f27304fbd5',
      note: 'Fixed original D depth estimates; central path snapped 12.3 mm to source terrain. Trunk targets are near the authored (-1,-35.5) column. No local reference file dependency, material-ID or observed LOD claim.' },
    terrainClearance: { samplingM: .1, cameraMinimumM: Math.min(...track), cameraMaximumM: Math.max(...track), samples },
    sourceFiles: Object.fromEntries([...sources].sort(([a], [b]) => a.localeCompare(b))),
    scope: MIDDEPTH_SCOPE,
    visibilityLimit: 'Source projection and sampled terrain clearance do not prove full-scene visibility. Keep occluders; a blocked target is inconclusive. Natural camera parallax, haze and distance-selected geometry can change. Compare matching source geometry and controls before attributing the result to the shade scalar.' };
}

export function assertMiddepthShade(audit, plan) {
  const atmosphere = audit.systems.atmosphere;
  assert.equal(atmosphere.farShadeStartM, plan.farShade.startM, 'Rendered audit matches source shade start');
  assert.equal(atmosphere.farShadeFullM, plan.farShade.fullM); assert.equal(atmosphere.farShadeMin, plan.farShade.minimum);
}
