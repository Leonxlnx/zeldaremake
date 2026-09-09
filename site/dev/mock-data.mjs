#!/usr/bin/env node
/**
 * Generate a realistic mock monitor data dir (per site/SCHEMA.md) for developing the site.
 *
 *   node site/dev/mock-data.mjs [--out /tmp/monitor-mock] [--scaffold /tmp/take0_scaffold] [--takes 13]
 *
 * Uses the placeholder captures from the scaffold dir (PNG, 1280×720) as take images — cropped
 * and tinted per take so before/after wipes actually show a difference — plus reference/frames.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(args.out || '/tmp/monitor-mock');
const SCAFFOLD = path.resolve(args.scaffold || '/tmp/take0_scaffold');
const N_TAKES = Number(args.takes || 13);
const REF_DIR = path.join(ROOT, 'reference', 'frames');
const RUBRIC = JSON.parse(fs.readFileSync(path.join(ROOT, 'gauntlet', 'rubric.json'), 'utf8'));

const VIEWPOINTS = [
  { id: 'A_stairs', label: 'The Stairs', refSeconds: 1 },
  { id: 'B_house', label: "Saria's House", refSeconds: 14 },
  { id: 'C_lookback', label: 'Look Back', refSeconds: 46 },
  { id: 'D_log', label: 'The Log Arch', refSeconds: 56 },
  { id: 'E_ground', label: 'Ground Close-up', refSeconds: 24 },
  { id: 'F_canopy', label: 'Canopy & Shafts', refSeconds: 8 },
];
const HERO = new Set(['A_stairs', 'B_house', 'C_lookback', 'D_log']);

const AGENTS = {
  'fable-cursor': { runtime: 'Cursor Cloud Agent (Claude Fable 5.1)', github: 'Cursor Agent', branch: 'cursor/kokiri-world-phase1-f65e' },
  'nexiumbiz-agent': { runtime: 'Codex CLI (GPT-5) on the owner\'s workstation', github: 'nexiumbiz-debug', branch: 'agent/nexiumbiz-trees-canopy' },
};

// One row per take: [hourOffset, agent, scene, subject, items, note, opts]
const PLAN = [
  [0, 'fable-cursor', 'A', 'Bootstrap Phase 1 foundation: Three.js scaffold, layout, heightfield, capture API', ['W01', 'W04', 'W42'],
    'First capture of the scaffold. Reference frame A has a long stairway climbing to the upper-right with a fenced ledge; ours has the stair mass in the right place but every step is an extruded box and the flanks are bare smooth terrain. The lantern branch on the left is absent, the plaza is a flat sand-coloured plane, and the sky is far too open — the reference canopy closes the top third of the frame.'],
  [1, 'fable-cursor', 'E', 'Terrain: four-scale heightfield + layered ground material', ['W05', 'W06'],
    'Compared shot E against the reference plaza edge: the reference shows soil, moss and leaf litter transitions with fine roughness; the scaffold had a single flat colour. Added macro/medium/small/micro passes to the heightfield (312k verts in the detail zone) and a 4-layer slope/mask blend with detail normals. Still missing: litter geometry and the flagstone joints — the ground still reads as painted, not built.'],
  [2, 'nexiumbiz-agent', 'D', 'Rocks: hero boulders with ridged displacement + moss caps', ['W23', 'W24'],
    'Shot D reference: the boulder on the left is layered, fractured rock with moss on the top faces and a dark contact shadow. Ours was a faceted blob. Rebuilt the three hero boulders with ridged displacement and cracks, added 2,400 instanced pebbles at the path edges. The silhouettes now read as rock, but the moss is still a flat tint rather than surface-bound geometry, and the far log arch remains a placeholder cylinder.'],
  [3, 'fable-cursor', 'A', 'Stairs: carve 18 individual slabs with worn edges', ['W02', 'W21'],
    'Reference frame 1 shows 16–20 irregular stone steps, each a distinct slab with chipped edges, dark risers and moss in the joints. Ours had 18 identical boxes. Replaced them with 18 individually cut slabs (14 unique shapes), dark risers, moss joints and grass sprouts creeping in. The embankments on both flanks are still too smooth and the grassy verge that hides the stair base in the reference is not there yet.'],
  [4, 'nexiumbiz-agent', 'C', 'Trees: port Verdant white-bark trees, 8 variants', ['W08', 'W12'],
    'Shot C in the reference is framed by tall white-bark trunks leaning slightly with hierarchical branching; the scaffold had grey cylinders with green spheres. Ported the Verdant white-bark generator with 8 variants (taper, lean, branching hierarchy, crown shape) and 72 instances; bases now sit within 3 cm of the heightfield. Crowns are still ball-like — leaf laminae come next — and the giant trees are still massing.'],
  [7, 'fable-cursor', 'A', 'Vegetation: 420k instanced grass, 3 types, chunked LOD', ['W15', 'W16', 'W39'],
    'The reference embankments beside the stairs are thick with grass of varying height and colour; ours were bare. Added 420k GPU-instanced blades in three types (short, tall, weeds) with per-instance height/width/yaw/tint variation and density noise, chunked with distance culling. Zero blades on flagstones or stairs per the placement probe. It still looks too uniform in tint against the reference; ferns and bushes are missing entirely.'],
  [8, 'fable-cursor', 'B', 'Structures: trunk houses, dome roofs, pod lanterns', ['W25', 'W26', 'W27'],
    'Reference frame B: the house on the right is a hollow trunk with bark ridges, a dark arched doorway glowing warm inside, and a mossy dome roof grown over by branches. Ours were brown cylinders with green caps. Modelled two trunk houses with bark ridges, arched doors with interior light, mossy dome roofs and 7 hanging pod lanterns; added the carved signpost in front of the terrace. The roof vines and the heart-leaf creepers are still missing.'],
  [8.58, 'nexiumbiz-agent', 'A', 'Lighting: sun azimuth/elevation match, PCF shadows', ['W30'],
    'Measured the plaza shadows in reference frame A: they fall toward camera-right/front from a sun behind-left at roughly 35° elevation. Ours had the sun almost overhead. Moved the sun to azimuth −128°, elevation 33°, enabled PCF soft shadows. Shadow direction now matches, but the exposure ramp I added blows out the lanterns in shot B — overexposed pixels jumped to 2.1 % which is well over the 1 % limit.',
    { invalid: 'D2 regression: W26 pass→fail (overexposedFraction 0.021 > 0.01 in B_house)', local: false, blown: true }],
  [9, 'nexiumbiz-agent', 'B', 'Lanterns: clamp emissive; fix bloom regression from take 08', ['W26', 'W35'],
    'Take 08 struck for blowing out the lanterns. Reference B lanterns glow warm and soft with local light on the bark, never clipping. Clamped the emissive intensity, reduced the exposure ramp and added a soft local point light per pod. Overexposed pixels back to 0.3 %, sharpness ratio up as the bloom no longer smears the frame. The lantern cords are still straight lines; the reference cords sag.'],
  [10, 'fable-cursor', 'D', 'Atmosphere: god rays, layered haze, ground mist', ['W31', 'W32'],
    'Shot D reference reads in three depth planes: foreground stones, mid boulders and trees, and the far log arch dissolving into cool blue-grey mist with light shafts from the upper-left. Ours had a flat fog wall. Added screen-space god rays occluded by the canopy, depth-layered haze (fog far 180 m) and a low ground mist in the north hollow. The horizon now recedes; the distant tree silhouettes are still too sparse to sell the depth.'],
  [12, 'fable-cursor', 'E', 'Flagstones: 340 individual stones with bevels + joint sprouts', ['W03', 'W21'],
    'Reference E shows flat stones with visible thickness, bevelled edges and greenery in every joint. Ours was a tiled texture on a plane. Built 340 individually shaped flagstones (28 shapes, 0.4–1.6 m, ≤ 4 cm height jitter) with soil/moss joints and 640 joint sprouts. The stones now catch the light on their bevels like the reference; the moss blend at the joints is still a bit too saturated compared with the frame.'],
  [13, 'nexiumbiz-agent', 'F', 'Canopy: leaf laminae clusters, distant tree layers', ['W10', 'W11', 'W13'],
    'Looking up in reference F the canopy covers most of the sky with dappled shafts through the gaps; ours showed 58 % open sky. Replaced the sphere crowns with asymmetric clusters of curved leaf laminae (210k leaves) and added 460 distant trees in two LOD levels. Sky fraction is down to 39 %. The leaf edges are still too clean against the sky — the reference has a softer, broken silhouette from the sub-leaf detail.'],
  [14, 'fable-cursor', 'A', 'Composition: lantern branch over the path + fences on the upper ledge', ['W14', 'W28', 'W01'],
    'The last big compositional gap in shot A: the reference has a large near-horizontal limb from the west-ledge giant crossing above the path on the left, carrying three glowing pod lanterns, and post-and-rail fences along the plateau edge at the top of the stairs. Added both; the branch now occupies the same screen region as the reference and the fence silhouettes break the ledge line correctly. The branch still needs leaf clusters.'],
];

// Screen features per viewpoint for plausible callout coordinates.
const FEATURES = {
  A_stairs: [[0.62, 0.47, 'stair slabs', 'W02'], [0.18, 0.35, 'lantern branch', 'W14'], [0.5, 0.82, 'plaza flagstones', 'W03'], [0.74, 0.2, 'fences on the ledge', 'W28'], [0.86, 0.6, 'grassy embankment', 'W15'], [0.3, 0.12, 'canopy closes the sky', 'W10']],
  B_house: [[0.7, 0.42, 'trunk house + doorway', 'W25'], [0.78, 0.3, 'pod lanterns', 'W26'], [0.56, 0.5, 'signpost', 'W27'], [0.35, 0.72, 'flagstone path', 'W03'], [0.15, 0.4, 'giant tree roots', 'W09'], [0.62, 0.18, 'moss roof', 'W20']],
  C_lookback: [[0.2, 0.55, 'stairs from above', 'W02'], [0.42, 0.3, 'white-bark trunks', 'W08'], [0.7, 0.5, 'bushes on the ledge', 'W19'], [0.55, 0.8, 'ground layers', 'W06'], [0.85, 0.38, 'haze depth', 'W32']],
  D_log: [[0.5, 0.33, 'log arch in the mist', 'W29'], [0.13, 0.62, 'hero boulder', 'W23'], [0.15, 0.78, 'purple flowers', 'W18'], [0.5, 0.15, 'god rays', 'W31'], [0.8, 0.6, 'distant tree layers', 'W13'], [0.4, 0.9, 'pebbles + litter', 'W24']],
  E_ground: [[0.5, 0.6, 'flagstone bevels', 'W03'], [0.3, 0.7, 'joint sprouts', 'W21'], [0.7, 0.4, 'soil / moss blend', 'W06'], [0.2, 0.35, 'leaf litter', 'W07'], [0.8, 0.75, 'contact shadow', 'W36']],
  F_canopy: [[0.5, 0.4, 'canopy coverage', 'W10'], [0.3, 0.2, 'leaf laminae', 'W11'], [0.7, 0.65, 'light shafts', 'W31'], [0.15, 0.75, 'giant limbs', 'W09']],
};
const REF_CALLOUTS = {
  A_stairs: [[0.72, 0.42, 'stairs read as separate worn slabs'], [0.2, 0.3, 'lantern branch with 3 pods']],
  B_house: [[0.72, 0.4, 'mossy dome roof grown over by branches'], [0.58, 0.48, 'carved wooden signpost']],
  C_lookback: [[0.4, 0.28, 'white-bark trunks lean and branch']],
  D_log: [[0.5, 0.32, 'log arch dissolves into cool mist'], [0.12, 0.7, 'mossy layered boulder']],
  E_ground: [[0.5, 0.6, 'stone thickness + bevels visible']],
  F_canopy: [[0.5, 0.35, 'canopy closes the sky']],
};

// ------------------------------------------------------------------ helpers
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    }
  }
  return out;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry(20260909);
const jitter = (amp) => (rnd() * 2 - 1) * amp;
const lerp = (a, b, t) => a + (b - a) * t;
const round = (v, d) => Number(v.toFixed(d));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const fakeSha = (i) => sha256(`commit-${i}-${PLAN[i]?.[3] || i}`);
const ease = (t) => 1 - Math.pow(1 - t, 2.2);

function thresholdText(check) {
  if (!check) return 'reviewer verdict';
  if (check.op === 'between') return `${check.value[0]}..${check.value[1]}`;
  if (check.op === 'truthy') return 'truthy';
  if (check.type === 'console') return `errors ≤ ${check.maxErrors}`;
  if (check.type === 'projection') return `inside ≥ ${check.minInside}`;
  if (check.type === 'probe') return `±${check.tolerance} m`;
  if (check.type === 'placement') return `pass ≥ ${check.minPass}`;
  return `${check.op} ${check.value}`;
}
function valueFor(check, pass, t) {
  if (!check) return pass ? 'pass' : null;
  const v = check.value;
  switch (check.op) {
    case '>=': return typeof v === 'number' ? niceNum(pass ? v * lerp(1.04, 1.35, rnd()) : v * lerp(0.35, 0.92, t), v) : (pass ? v : null);
    case '<=': return typeof v === 'number' ? niceNum(pass ? v * lerp(0.45, 0.95, rnd()) : v * lerp(1.1, 2.4, 1 - t), v) : (pass ? v : null);
    case 'between': return pass ? Math.round(lerp(v[0], v[1], 0.5 + jitter(0.3))) : Math.round(v[0] * 0.6);
    case 'truthy': return pass;
    case '!=': return pass ? (String(v).includes('placeholder') ? 'authored-geometry' : 'ok') : v;
    case 'includes': return pass ? [v, 'cards'] : ['spheres'];
    default:
      if (check.type === 'console') return pass ? 0 : 3;
      if (check.type === 'projection') return round(pass ? lerp(check.minInside, 1, rnd()) : check.minInside * 0.7, 2);
      if (check.type === 'probe') return round(check.height + (pass ? jitter(check.tolerance * 0.6) : check.tolerance * 1.8), 2);
      if (check.type === 'placement') return round(pass ? lerp(check.minPass, 1, rnd()) : check.minPass - 0.1, 3);
      return pass ? 'pass' : 'fail';
  }
}
function niceNum(x, ref) {
  if (ref >= 1000) return Math.round(x / 10) * 10;
  if (ref >= 10) return Math.round(x);
  if (ref >= 1) return round(x, 1);
  return round(x, 3);
}

// ------------------------------------------------------------------ images
async function makeTakeImage(srcPng, i, p, opts, outJpg) {
  const meta = await sharp(srcPng).metadata();
  const W = meta.width, H = meta.height;
  const zoom = 1 - 0.07 * p;
  const cw = Math.round(W * zoom), ch = Math.round(H * zoom);
  const left = Math.round((W - cw) / 2 + (i % 2 ? 1 : -1) * 6 * p);
  const top = Math.round((H - ch) / 2 - 4 * p);
  let img = sharp(srcPng).extract({ left: Math.max(0, left), top: Math.max(0, top), width: cw, height: ch }).resize(1280, 720);
  img = img.modulate({
    brightness: opts.blown ? 1.28 : lerp(0.86, 1.0, p),
    saturation: lerp(0.78, 1.08, p),
    hue: Math.round(lerp(-14, 0, p)),
  });
  if (p > 0.5) img = img.sharpen({ sigma: 0.6 + p });
  const buf = await img.jpeg({ quality: 82 }).toBuffer();
  fs.writeFileSync(outJpg, buf);
  return sha256(buf);
}
async function makeCompareStrip(refJpg, oursJpg, prevJpg, out) {
  const w = 426, h = 240;
  const tile = async (src) => (src && fs.existsSync(src)
    ? sharp(src).resize(w, h, { fit: 'cover' }).toBuffer()
    : sharp({ create: { width: w, height: h, channels: 3, background: '#111' } }).jpeg().toBuffer());
  const [a, b, c] = await Promise.all([tile(refJpg), tile(oursJpg), tile(prevJpg)]);
  await sharp({ create: { width: w * 3 + 4, height: h, channels: 3, background: '#000' } })
    .composite([{ input: a, left: 0, top: 0 }, { input: b, left: w + 2, top: 0 }, { input: c, left: 2 * w + 4, top: 0 }])
    .jpeg({ quality: 80 }).toFile(out);
}

// ------------------------------------------------------------------ main
async function main() {
  if (!fs.existsSync(SCAFFOLD)) {
    console.error(`scaffold captures not found at ${SCAFFOLD} (expected A_stairs.png … F_canopy.png)`);
    process.exit(1);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'takes'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'reference', 'frames', 'timeline'), { recursive: true });

  for (const f of fs.readdirSync(REF_DIR)) {
    const s = path.join(REF_DIR, f);
    if (fs.statSync(s).isFile() && /\.jpe?g$/i.test(f)) fs.copyFileSync(s, path.join(OUT, 'reference', 'frames', f));
  }
  const tl = path.join(REF_DIR, 'timeline');
  if (fs.existsSync(tl)) {
    const frames = fs.readdirSync(tl).filter((f) => /^t_\d+\.jpe?g$/i.test(f)).sort();
    for (const f of frames) fs.copyFileSync(path.join(tl, f), path.join(OUT, 'reference', 'frames', 'timeline', f));
    // optional index (proposed schema addition) — lets the site skip probing and show timecodes
    const clipSeconds = 61;
    fs.writeFileSync(path.join(OUT, 'reference', 'frames', 'timeline', 'index.json'), JSON.stringify({
      clipSeconds,
      frames: frames.map((file, i) => ({ file, seconds: round(((i + 0.5) * clipSeconds) / frames.length, 1) })),
    }, null, 2));
  }
  fs.copyFileSync(path.join(ROOT, 'gauntlet', 'rubric.json'), path.join(OUT, 'rubric.json'));

  const plan = PLAN.slice(0, Math.max(2, Math.min(N_TAKES, PLAN.length)));
  const lastOffsetH = plan[plan.length - 1][0];
  // last take ≈ 12 minutes ago, aligned so takes land at hh:02:04 (CI top-of-hour)
  const now = Date.now();
  const lastAt = new Date(now - 12 * 60_000);
  lastAt.setUTCMinutes(2, 4, 0);
  const t0 = lastAt.getTime() - lastOffsetH * 3_600_000;

  const passSet = new Set();
  const takes = [];
  const ledger = [];
  let prevHash = 'sha256:genesis';
  const w1 = RUBRIC.items.filter((it) => it.phase === 1);

  for (let i = 0; i < plan.length; i++) {
    const [h, agent, scene, subject, items, note, opts = {}] = plan[i];
    const id = `take-${String(i + 1).padStart(4, '0')}`;
    const at = new Date(t0 + h * 3_600_000 + (i % 3) * 1000);
    const p = ease(i / (plan.length - 1));
    const dir = path.join(OUT, 'takes', id);
    fs.mkdirSync(dir, { recursive: true });

    // rubric progression
    const before = new Set(passSet);
    if (opts.blown) { passSet.delete('W26'); passSet.delete('W35'); }
    else for (const it of items) if (!(it === 'W15' && i < 8) && !(it === 'W01' && i < plan.length - 1)) passSet.add(it);
    if (i === 5) passSet.add('W17');
    if (i >= 6) passSet.add('W20');
    if (i >= 9 && !opts.blown) passSet.add('W35');
    if (i >= 10) { passSet.add('W07'); passSet.add('W36'); }
    if (i === plan.length - 1) { passSet.add('W37'); passSet.add('W34'); passSet.add('W15'); }

    const scoreItems = {};
    for (const it of RUBRIC.items) {
      let status;
      if (it.phase > 1) status = 'pending';
      else if (passSet.has(it.id)) status = 'pass';
      else if (it.verify === 'visual') status = 'pending';
      else status = 'fail';
      const wasPass = before.has(it.id);
      const check = it.checks?.[0];
      const entry = { status, value: valueFor(check, status === 'pass', p), threshold: thresholdText(check) };
      if (i > 0 && wasPass !== (status === 'pass') && status !== 'pending') entry.delta = wasPass ? 'pass→fail' : 'fail→pass';
      scoreItems[it.id] = entry;
    }
    const phasePassed = w1.filter((it) => scoreItems[it.id].status === 'pass').length;
    const passed = RUBRIC.items.filter((it) => scoreItems[it.id].status === 'pass').length;

    // shots
    const shots = [];
    const images = {};
    for (const vp of VIEWPOINTS) {
      const src = path.join(SCAFFOLD, `${vp.id}.png`);
      const outJpg = path.join(dir, `${vp.id}.jpg`);
      const hash = await makeTakeImage(src, i, p, opts, outJpg);
      images[vp.id] = `sha256:${hash}`;
      const prevTake = takes[i - 1];
      const prevImg = prevTake ? path.join(OUT, prevTake.shots.find((s) => s.viewpoint === vp.id).image) : null;
      await makeCompareStrip(path.join(OUT, 'reference', 'frames', `${vp.id}.jpg`), outJpg, prevImg, path.join(dir, `${vp.id}.compare.jpg`));

      const isF = vp.id === 'F_canopy';
      const n = jitter(0.02);
      const metrics = {
        ssim: round(lerp(0.17, 0.46, p) + n + (isF ? -0.04 : 0), 3),
        phashDistance: Math.round(lerp(34, 21, p) + jitter(1.4)),
        hueDiffDeg: round(lerp(22, 8.5, p) + jitter(0.9), 1),
        satDiff: round(lerp(0.15, 0.045, p) + jitter(0.006), 3),
        lumDiff: round((opts.blown ? 0.17 : lerp(0.16, 0.07, p)) + jitter(0.006), 3),
        sharpnessRatio: round((opts.blown ? 0.62 : lerp(0.41, 0.88, p)) + jitter(0.02), 3),
        skyFraction: round(isF ? lerp(0.6, 0.39, p) : lerp(0.31, 0.11, p) + jitter(0.01), 3),
        overexposedFraction: round(opts.blown && vp.id === 'B_house' ? 0.021 : lerp(0.004, 0.0025, p) + Math.abs(jitter(0.0008)), 4),
        purpleFraction: round(vp.id === 'D_log' ? lerp(0, 0.0045, p) : 0.0002, 4),
      };
      const prevShot = prevTake?.shots.find((s) => s.viewpoint === vp.id);
      const deltas = {};
      if (prevShot) for (const k of Object.keys(metrics)) deltas[k] = round(metrics[k] - prevShot.metrics[k], k === 'phashDistance' ? 0 : 4);

      // callouts: several on the hero scene of the take, fewer elsewhere; every kind appears over the run
      const feats = FEATURES[vp.id];
      const callouts = [];
      const isScene = vp.id[0] === scene;
      const count = isScene ? 3 + (i % 2) : (i + vp.id.charCodeAt(0)) % 3;
      for (let k = 0; k < Math.min(count, feats.length); k++) {
        const [x, y, label, item] = feats[(k + i) % feats.length];
        const st = scoreItems[item]?.status;
        const flipped = scoreItems[item]?.delta;
        let kind;
        if (flipped === 'pass→fail') kind = 'regression';
        else if (flipped === 'fail→pass') kind = 'new';
        else if (st === 'pass') kind = k % 2 ? 'improved' : 'reference';
        else kind = 'todo';
        const text = kind === 'new' ? `${label}: now ${scoreItems[item].value === true ? 'present' : scoreItems[item].value} (${scoreItems[item].threshold})`
          : kind === 'improved' ? `${label} closer to the reference`
          : kind === 'regression' ? `${label} regressed: ${scoreItems[item].value} vs ${scoreItems[item].threshold}`
          : kind === 'reference' ? `${label} matches the reference region`
          : `${label} still missing`;
        callouts.push({ x: round(x + jitter(0.01), 3), y: round(y + jitter(0.01), 3), label: text, item, kind });
      }
      const refCallouts = (isScene || HERO.has(vp.id) && i % 4 === 0) ? REF_CALLOUTS[vp.id].map(([x, y, label]) => ({ x, y, label })) : [];

      shots.push({
        viewpoint: vp.id,
        label: vp.label,
        refSeconds: vp.refSeconds,
        image: `takes/${id}/${vp.id}.jpg`,
        compare: `takes/${id}/${vp.id}.compare.jpg`,
        reference: `reference/frames/${vp.id}.jpg`,
        previous: prevTake ? `takes/${prevTake.id}/${vp.id}.jpg` : null,
        sha256: hash,
        metrics,
        deltas,
        callouts,
        refCallouts,
      });
    }

    const sha = fakeSha(i);
    const local = opts.local === true || i === 2;
    const take = {
      id,
      number: i + 1,
      at: at.toISOString(),
      agent,
      sha,
      shortSha: sha.slice(0, 7),
      branch: AGENTS[agent].branch,
      subject,
      phase: 1,
      items,
      note,
      slate: {
        scene,
        sceneTitle: VIEWPOINTS.find((v) => v.id[0] === scene)?.label || '',
        take: i + 1,
        director: agent,
        camera: 'SwiftShader · 1280×720',
        roll: 'phase-1',
      },
      shots,
      score: { passed, total: RUBRIC.items.length, phaseRequired: w1.length, phasePassed, items: scoreItems },
      stats: {
        drawCalls: Math.round(lerp(135, 610, p) + jitter(12)),
        triangles: Math.round(lerp(65_000, 7_400_000, p) + jitter(50_000)),
        captureMs: Math.round(lerp(21_000, 52_000, p) + jitter(1500)),
        renderer: 'SwiftShader',
      },
      attestation: local
        ? { source: 'local' }
        : { source: 'ci', runId: String(17_650_000_000 + i * 1_019_733), workflow: 'monitor', url: `https://github.com/Leonxlnx/zeldaremake/actions/runs/${17_650_000_000 + i * 1_019_733}` },
      valid: !opts.invalid,
      invalid: opts.invalid || null,
    };
    takes.push(take);

    fs.writeFileSync(path.join(dir, 'score.json'), JSON.stringify(take.score, null, 2));
    fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify({ note: 'mock audit', scene: { instancedMeshes: Math.round(lerp(0, 34, p)) } }, null, 2));

    const entry = {
      id, at: take.at, sha, agent, items, note, score: { passed, total: RUBRIC.items.length },
      images, distHash: `sha256:${sha256(`dist-${i}`)}`, attestation: take.attestation, invalid: take.invalid, prevHash,
    };
    entry.hash = `sha256:${sha256(JSON.stringify(entry))}`;
    prevHash = entry.hash;
    ledger.push(entry);
    process.stdout.write(`  ${id}  ${at.toISOString()}  ${agent.padEnd(16)} phase ${String(phasePassed).padStart(2)}/${w1.length}${take.invalid ? '  STRUCK' : ''}\n`);
  }

  const takesJson = {
    project: 'zeldaremake',
    updatedAt: takes[takes.length - 1].at,
    monitorCadenceMinutes: 60,
    takes,
  };
  fs.writeFileSync(path.join(OUT, 'takes.json'), JSON.stringify(takesJson, null, 2));
  fs.writeFileSync(path.join(OUT, 'ledger.json'), JSON.stringify({ note: 'mock ledger', genesis: 'kokiri-forest-phase1-2026-09-09', entries: ledger }, null, 2));

  const last = takes[takes.length - 1];
  const lastBy = (a) => takes.filter((t) => t.agent === a).at(-1);
  const agents = {
    agents: Object.entries(AGENTS).map(([agent, a]) => {
      const lt = lastBy(agent);
      const active = lt === last;
      return {
        agent,
        runtime: a.runtime,
        github: a.github,
        status: active ? 'active' : 'idle',
        branch: a.branch,
        updated: new Date(new Date(lt.at).getTime() + 4 * 60_000).toISOString(),
        currentTask: agent === 'fable-cursor'
          ? 'Composition pass on shot A: lantern branch over the path (W14), fences along the upper ledge (W28); next: leaf clusters on the branch and grass tint variation against reference frame A (W16).'
          : 'Canopy density from viewpoint F (W10): leaf laminae clusters and distant tree LOD layers (W13). Reviewing fable-cursor\'s W25 house pass as the cross-review for this cycle.',
      };
    }),
  };
  fs.writeFileSync(path.join(OUT, 'agents.json'), JSON.stringify(agents, null, 2));
  console.log(`\nmock data → ${OUT}  (${takes.length} takes, ${VIEWPOINTS.length} viewpoints, updatedAt ${takesJson.updatedAt})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
