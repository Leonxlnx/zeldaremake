#!/usr/bin/env node
/**
 * perftrace.mjs — reproducible play-mode frame-time trace (round 37, runtime performance).
 *
 * Drives the production build's play mode the way main.ts + camera/follow.ts do (player.setInput,
 * the follow camera's placement math, fixed 1/60 steps through the capture hooks' `step`) along a
 * fixed waypoint path (plaza → stairs top → back down → toward the house → north path to the
 * hollow, ~40 s) and records per frame: total JS ms of the step, world.update ms, the composer's
 * render-issue ms, per-system update ms (__ZR__.perf()), renderer.info (calls, triangles) and the
 * number of programs / geometries / textures created since the previous frame (first-use hitches),
 * plus the camera movement gates (trees ≥ 1.5 m, vegetation sets ≥ 0.6 m) so re-buckets can be
 * attributed. Spikes (> 2× the median step ms) are binned by cause in the summary.
 *
 *   node gauntlet/scripts/perftrace.mjs --dist <dist> --out <json> [--frames 2400] [--width 160 --height 90]
 *        [--quality high] [--norender] [--render-every N] [--label name] [--phase2 N] [--warmup]
 *        [--params "fx=noao&shadow=1024"] [--finish] [--auto] [--note "box load, provenance"]
 *        [--profile trace.cpuprofile] [--profile-load load.cpuprofile] [--alloc trace.heapprofile]
 *
 * Every pass also carries `poolSeries` — one `WorldSystem.perf()` snapshot per 30-frame chunk (the
 * trees' near-LOD pools: live bytes, builds, evictions, synchronous builds, build-time percentiles)
 * — and `poolFinal`, the last of them; `--note` is stored verbatim under `config.note`.
 *
 * --norender     : the render call is stubbed (pure world.update JS; no first-use events happen)
 * --render-every : render only every Nth step (the others advance the simulation without a frame)
 * --phase2 N     : a second pass afterwards that draws every Nth frame (GPU sync outside the timing)
 *                  to count first-use events (programs / geometries / textures) along the walk
 * --warmup       : open with ?warmup=1 (main.ts's warm-up before the first frame; headless default off)
 * --params       : extra URL parameters appended as given — the performance flags of src/perfFlags.ts
 *                  (fx=off|noao|norays|nobloom|nosoft, shadow=<size>[,<taps>], veg=<lod>[,<grass>],
 *                  scale=<s>); the page's parsed flags / live state are echoed in the output (`perf`)
 * --finish       : GPU completion sync INSIDE the timed step, so `ms` carries the GPU's (or SwiftShader's)
 *                  completion of the frame — the matched-ablation measurement (`finish` ms is also
 *                  recorded per frame); without it `ms` is the JS issue time only
 * --auto         : open with quality=auto&governor=1 (main.ts runs the frame-time governor under the
 *                  harness, finishing each step itself); every row carries the tier and the summary
 *                  lists the governor's changes with frame indices. Tune it through --params
 *                  "gov=<window>,<slowMs>,<fastMs>,<fastForS>,<minIntervalS>" (a software rasteriser
 *                  at seconds per frame needs a short window to step within a trace)
 * --profile      : V8 CPU profile of the first pass (GC pauses show as "(garbage collector)")
 * --alloc        : sampled allocation profile of the first pass (who allocates per frame → GC pressure)
 *
 * SwiftShader box: the render-issue ms includes command-buffer back-pressure from the software GPU,
 * so only `update` / per-system numbers and the event counts are GPU-independent; the summary says so.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser } from './lib/browser.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
    else {
      args[a.slice(2)] = n;
      i++;
    }
  }
}
const dist = path.resolve(args.dist ?? 'dist');
const out = args.out ? path.resolve(args.out) : null;
const frames = Number(args.frames ?? 2400);
const width = Number(args.width ?? 160);
const height = Number(args.height ?? 90);
const quality = args.quality ?? 'high';
const norender = !!args.norender;
const renderEvery = Math.max(1, Number(args['render-every'] ?? 1));
/** --phase2 K: after the main pass, reset to the spawn and run a second, RENDERED pass drawing every Kth step (first-use events, render-issue ms) */
const phase2Every = args.phase2 ? Math.max(1, Number(args.phase2)) : 0;
const phase2Frames = Number(args['phase2-frames'] ?? frames);
const label = args.label ?? path.basename(dist);
const profileOut = args.profile ? path.resolve(args.profile) : null;
/** --profile-load <file>: CPU profile of the page load (createWorld) instead of the trace */
const profileLoadOut = args['profile-load'] ? path.resolve(args['profile-load']) : null;
/** --warmup: open the world with ?warmup=1 (main.ts warm-up render before the first frame; headless default is off) */
const warmup = !!args.warmup;
/** --alloc <file>: sampled allocation profile (HeapProfiler) of the first pass — who allocates per frame */
const allocOut = args.alloc ? path.resolve(args.alloc) : null;
/** --params "a=b&c=d": performance flags (src/perfFlags.ts) appended to the page URL */
const extraParams = typeof args.params === 'string' ? args.params.replace(/^[?&]+/, '') : '';
/** --finish: GPU completion sync inside the timed step (the frame's completion counts in `ms`) */
const finishInside = !!args.finish;
/** --note "…": free text carried in the output's `config.note` (the box's load, who else was capturing, the build's provenance) */
const note = typeof args.note === 'string' ? args.note : null;
/** --auto: quality=auto with the governor enabled under the harness */
const auto = !!args.auto;
let allocDone = false;
const log = (...a) => console.error(...a);

/** aggregate a HeapProfiler sampling profile by self bytes per function, with the nearest named callers */
export function topAlloc(profile, n = 40) {
  const rows = new Map();
  let total = 0;
  const short = (cf) => `${cf.functionName || '(anon)'} @ ${path.basename(cf.url || '')}:${cf.lineNumber + 1}`;
  const walk = (node, chain) => {
    const here = [...chain, short(node.callFrame)];
    if (node.selfSize > 0) {
      total += node.selfSize;
      const key = here[here.length - 1];
      const r = rows.get(key) ?? { bytes: 0, callers: new Map() };
      r.bytes += node.selfSize;
      const callers = here.slice(-5, -1).reverse().join(' ← ');
      r.callers.set(callers, (r.callers.get(callers) ?? 0) + node.selfSize);
      rows.set(key, r);
    }
    for (const c of node.children ?? []) walk(c, here);
  };
  walk(profile.head, []);
  const out = [...rows.entries()]
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, n)
    .map(([fn, r]) => ({ fn, kb: Math.round(r.bytes / 1024), pct: +((100 * r.bytes) / total).toFixed(1), callers: [...r.callers.entries()].sort((a, b) => b[1] - a[1])[0][0] }));
  return { totalBytes: total, rows: out };
}

/** aggregate a V8 .cpuprofile by self time per function (name @ url:line) */
export function topSelf(profile, n = 40) {
  const byId = new Map(profile.nodes.map((nd) => [nd.id, nd]));
  const self = new Map();
  const dt = profile.timeDeltas;
  let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const nd = byId.get(profile.samples[i]);
    const d = dt[i] ?? 0;
    total += d;
    const cf = nd.callFrame;
    const key = `${cf.functionName || '(anonymous)'} @ ${(cf.url || '').split('/').pop()}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + d);
  }
  const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return { totalMs: total / 1000, rows: rows.map(([k, v]) => ({ fn: k, ms: +(v / 1000).toFixed(1), pct: +((100 * v) / total).toFixed(1) })) };
}

/** find the capture hooks object (scene, step, renderer, terrain) through the closure scopes of __ZR__.render */
async function grabHooks(page) {
  const client = await page.createCDPSession();
  const ev = await client.send('Runtime.evaluate', { expression: 'window.__ZR__.render' });
  const objectId = ev.result?.objectId;
  if (!objectId) throw new Error('no __ZR__.render object');
  const { internalProperties } = await client.send('Runtime.getProperties', { objectId, ownProperties: true });
  const scopes = internalProperties?.find((p) => p.name === '[[Scopes]]');
  if (!scopes) throw new Error('no [[Scopes]] on __ZR__.render');
  const { result: scopeList } = await client.send('Runtime.getProperties', { objectId: scopes.value.objectId, ownProperties: true });
  for (const s of scopeList) {
    if (!s.value?.objectId) continue;
    const { result: vars } = await client.send('Runtime.getProperties', { objectId: s.value.objectId, ownProperties: true });
    for (const v of vars) {
      if (v.value?.type !== 'object' || !v.value.objectId) continue;
      const r = await client.send('Runtime.callFunctionOn', {
        objectId: v.value.objectId,
        functionDeclaration: 'function(){ if (this && this.scene && this.scene.isScene && typeof this.step === "function") { window.__H = this; return true; } return false; }',
        returnByValue: true,
      });
      if (r.result?.value === true) {
        await client.detach();
        return true;
      }
    }
  }
  await client.detach();
  return false;
}

/**
 * The fixed path. Waypoints in world xz with a `run` flag; the follower steers Link at each one
 * until within `reach` m, then advances. Geometry from layout.ts: the main stair (base 7.3,−0.1,
 * dir 1,−0.78, 20 × 0.54 m), pathToHouse, pathSpine.
 */
const STAIR = { base: [7.3, -0.1], dir: [1, -0.78], run: 20 * 0.54 };
const sl = Math.hypot(STAIR.dir[0], STAIR.dir[1]);
const SDX = STAIR.dir[0] / sl;
const SDZ = STAIR.dir[1] / sl;
const stairAt = (u) => [STAIR.base[0] + SDX * u, STAIR.base[1] + SDZ * u];
const PATH = [
  { at: [3.0, -0.3], run: true, tag: 'plaza→stair foot' },
  { at: [6.6, -0.5], run: true, tag: 'plaza→stair foot' },
  { at: stairAt(-0.3), run: false, tag: 'stair foot' },
  { at: stairAt(STAIR.run + 0.6), run: false, tag: 'stairs up' },
  { at: stairAt(STAIR.run + 1.6), run: false, tag: 'stairs top' },
  { at: stairAt(-0.4), run: false, tag: 'stairs down' },
  { at: [3.45, -4.2], run: true, tag: 'to the house path' },
  { at: [3.0, -5.2], run: false, tag: 'house path' },
  { at: [3.05, -8.1], run: false, tag: 'house apron' },
  { at: [3.8, -8.0], run: false, tag: 'house flight' },
  { at: [5.68, -7.32], run: false, tag: 'house flight' },
  { at: [6.48, -7.03], run: false, tag: 'house landing' },
  { at: [8.0, -7.5], run: false, tag: 'house lawn' },
  { at: [5.68, -7.32], run: true, tag: 'back to the path' },
  { at: [3.0, -8.4], run: true, tag: 'back to the path' },
  { at: [1.2, -9.5], run: true, tag: 'north path' },
  { at: [1.5, -12], run: true, tag: 'north path' },
  { at: [2.0, -18], run: true, tag: 'north path' },
  { at: [1.8, -24], run: true, tag: 'hollow' },
  { at: [2.5, -30], run: false, tag: 'hollow' },
  { at: [3.5, -36], run: false, tag: 'hollow' },
  { at: [4.5, -42], run: false, tag: 'toward the arch' },
];
const IDLE_FRAMES = 60;

/** in-page: enter play mode at the spawn, install the follow-camera emulation and the recorder */
function pageSetup({ norender, path, idleFrames, finishAfter, finishInside }) {
  const H = window.__H;
  const scene = H.scene;
  const player = scene.userData.player;
  const link = scene.getObjectByName('link');
  if (!player || !link) throw new Error('no player / link');
  const V = link.position.constructor;
  const camera = H.camera;
  const terrain = H.terrain;
  player.setPlayMode(true);
  window.__ZR__.setTime(20);
  // camera/follow.ts constants and placement math (FOLLOW = 4.3 m behind, 1.75 eye, 1.5 aim)
  const F = { distance: 4.3, eyeHeight: 1.75, aimHeight: 1.5 };
  const st = { yaw: player.heading(), pos: new V(), desired: new V(), aim: new V(), init: false, wp: 0, stuck: 0, lastD: Infinity };
  const place = (blend) => {
    const p = player.position;
    const groundY = terrain.height(p.x, p.z);
    st.desired.set(p.x - Math.sin(st.yaw) * F.distance, groundY + F.eyeHeight, p.z - Math.cos(st.yaw) * F.distance);
    const floor = terrain.height(st.desired.x, st.desired.z) + 0.4;
    if (st.desired.y < floor) st.desired.y = floor;
    st.pos.lerp(st.desired, blend);
    camera.position.copy(st.pos);
    st.aim.set(p.x, groundY + F.aimHeight, p.z);
    camera.lookAt(st.aim);
  };
  st.yaw = player.heading();
  place(1);
  st.init = true;
  const comp = scene.userData.composer;
  // the real render functions, captured once (a previous pass may have left the stubs in place)
  window.__T_ORIG ??= { comp: comp ? comp.render : null, rend: H.renderer.render };
  const origComp = window.__T_ORIG.comp;
  const origRend = window.__T_ORIG.rend;
  const off = () => {
    if (comp) comp.render = () => {};
    H.renderer.render = () => {};
  };
  const on = () => {
    if (comp) comp.render = origComp;
    H.renderer.render = origRend;
  };
  if (norender) off();
  else on();
  // per-frame gates the systems use (replicated for attribution): trees re-bucket at ≥ 1.5 m, the
  // vegetation sets at ≥ 0.6 m (lodset.ts default hysteresis), from the camera position they last saw
  const gates = { trees: new V(Infinity, Infinity, Infinity), veg: new V(Infinity, Infinity, Infinity) };
  camera.getWorldPosition(gates.trees);
  gates.veg.copy(gates.trees);
  const info = H.renderer.info;
  const knownPrograms = new Set(info.programs.map((p) => p.id));
  const gl = H.renderer.getContext();
  const px = new Uint8Array(4);
  /** wait for the GPU to have drawn the canvas (finish() is a flush in Chromium; readPixels is not) */
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  window.__T = { H, player, link, camera, terrain, st, place, F, on, off, norender, finishAfter: !!finishAfter, finishInside: !!finishInside, gl, sync, path, idleFrames, gates, knownPrograms, lastGeom: info.memory.geometries, lastTex: info.memory.textures, camPrev: new V().copy(gates.trees), V };
  const perf0 = window.__ZR__.perf();
  const stats0 = window.__ZR__.stats();
  return {
    start: [player.position.x, player.position.z],
    heading: st.yaw,
    programs: info.programs.length,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    buildMs: perf0.buildMs,
    warmup: perf0.warmup ?? null,
    // the page's performance flags and live state (src/perfFlags.ts), so the trace carries its config
    perf: perf0.perfState ?? null,
    flags: perf0.flags ?? {},
    tier: perf0.tier ?? null,
    drawingBuffer: [stats0.width, stats0.height],
    pixelRatio: stats0.pixelRatio,
  };
}

/** in-page: run `n` fixed steps from frame index `k0`, returning one row per step */
function pageRun({ k0, n, dt, renderEvery }) {
  const T = window.__T;
  const { H, player, camera, st, place, path, idleFrames, gates, V } = T;
  const info = H.renderer.info;
  const rows = [];
  const camNow = new V();
  for (let j = 0; j < n; j++) {
    const k = k0 + j;
    // ---- input: the waypoint follower
    let input = { moveX: 0, moveZ: 0, run: false };
    let tag = 'idle';
    if (k >= idleFrames && st.wp < path.length) {
      const w = path[st.wp];
      const p = player.position;
      const dx = w.at[0] - p.x;
      const dz = w.at[1] - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) {
        st.wp++;
        st.stuck = 0;
        st.lastD = Infinity;
      } else {
        if (d > st.lastD - 1e-4) st.stuck++;
        else st.stuck = 0;
        st.lastD = d;
        if (st.stuck > 120) {
          st.wp++;
          st.stuck = 0;
          st.lastD = Infinity;
        }
        input = { moveX: dx / d, moveZ: dz / d, run: w.run };
        tag = w.tag;
      }
    }
    player.setInput(input);
    // ---- follow camera (camera/follow.ts update): ease the yaw behind the heading while moving, then place
    const moving = Math.hypot(input.moveX, input.moveZ) > 0;
    if (moving) {
      let dd = player.heading() - st.yaw;
      dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      st.yaw += dd * Math.min(1, dt * 1.6);
    }
    place(1 - Math.exp(-dt * 8));
    // ---- gates the systems will see this frame
    camera.getWorldPosition(camNow);
    const treesMove = camNow.distanceTo(gates.trees);
    const vegMove = camNow.distanceTo(gates.veg);
    const treesRebucket = treesMove >= 1.5;
    const vegRebucket = vegMove >= 0.6;
    if (treesRebucket) gates.trees.copy(camNow);
    if (vegRebucket) gates.veg.copy(camNow);
    const camMoved = camNow.distanceTo(T.camPrev);
    T.camPrev.copy(camNow);
    // ---- the step
    const rendered = !T.norender && k % renderEvery === 0;
    if (!T.norender && !rendered) T.off();
    const tA = performance.now();
    H.step(dt);
    const tB0 = performance.now();
    // --finish: the frame's GPU completion counts in `ms` (the matched-ablation measurement).
    // Chromium's WebGL finish() is only a flush; a one-pixel readPixels of the canvas is the
    // synchronous round-trip that waits for the GPU process to have drawn the frame.
    if (rendered && T.finishInside) T.sync();
    const tB = performance.now();
    if (!T.norender && !rendered) T.on();
    if (rendered && T.finishAfter) T.sync();
    const perf = window.__ZR__.perf();
    // ---- first-use events since the previous frame
    const newPrograms = [];
    for (const p of info.programs) {
      if (!T.knownPrograms.has(p.id)) {
        T.knownPrograms.add(p.id);
        newPrograms.push(p.name || p.cacheKey?.slice(0, 40) || '?');
      }
    }
    const newGeom = info.memory.geometries - T.lastGeom;
    const newTex = info.memory.textures - T.lastTex;
    T.lastGeom = info.memory.geometries;
    T.lastTex = info.memory.textures;
    const audit = H.audits.get('character')();
    rows.push({
      k,
      t: window.__ZR__.stats().simTime,
      tag,
      rendered,
      pos: [+player.position.x.toFixed(3), +player.position.z.toFixed(3)],
      cam: [+camNow.x.toFixed(3), +camNow.y.toFixed(3), +camNow.z.toFixed(3)],
      camMoved: +camMoved.toFixed(4),
      gait: audit.linkGait,
      ms: +(tB - tA).toFixed(3),
      update: +perf.update.toFixed(3),
      render: +perf.render.toFixed(3),
      // --finish: ms spent waiting for the GPU (the frame's completion beyond the issue)
      finish: T.finishInside ? +(tB - tB0).toFixed(3) : undefined,
      // --auto: the governor's current rung (main.ts finishes its own steps under the harness)
      tier: perf.tier ?? undefined,
      sys: Object.fromEntries(Object.entries(perf.systems).map(([k2, v]) => [k2, +v.toFixed(3)])),
      calls: info.render.calls,
      tris: info.render.triangles,
      programs: info.programs.length,
      newPrograms,
      newGeom,
      newTex,
      treesRebucket,
      vegRebucket,
    });
  }
  // the systems' runtime state after this chunk (the trees' near-LOD pools: live bytes, builds,
  // evictions, synchronous builds, build-time percentiles — `WorldSystem.perf()`), so a trace
  // shows how the pools filled along the walk, not only where they ended
  const perfNow = window.__ZR__.perf();
  const pool = perfNow.systemPerf ?? null;
  return { rows, pool };
}

function percentile(sorted, q) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
  return sorted[i];
}

export function summarise(rows, { renderedOnly = false } = {}) {
  const use = renderedOnly ? rows.filter((r) => r.rendered) : rows;
  const stat = (key) => {
    // non-finite samples (a selector returning NaN for "not this frame") are dropped, never sorted
    const v = use.map((r) => (typeof key === 'function' ? key(r) : r[key])).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return { median: 0, p95: 0, p99: 0, max: 0, mean: 0 };
    return { median: +percentile(v, 0.5).toFixed(2), p95: +percentile(v, 0.95).toFixed(2), p99: +percentile(v, 0.99).toFixed(2), max: +percentile(v, 1).toFixed(2), mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) };
  };
  const sysNames = [...new Set(use.flatMap((r) => Object.keys(r.sys)))];
  const systems = Object.fromEntries(sysNames.map((n) => [n, stat((r) => r.sys[n] ?? 0)]));
  const med = stat('ms').median;
  const spikes = use.filter((r) => r.ms > 2 * med);
  // attribution: the dominant reason for each spike frame
  const causes = {};
  const attributed = spikes.map((r) => {
    const reasons = [];
    if (r.newPrograms.length) reasons.push(`shader compile ×${r.newPrograms.length} (${r.newPrograms.slice(0, 3).join(', ')})`);
    if (r.newGeom > 0) reasons.push(`geometry upload ×${r.newGeom}`);
    if (r.newTex > 0) reasons.push(`texture upload ×${r.newTex}`);
    if (r.treesRebucket) reasons.push('trees rebucket (≥1.5 m)');
    if (r.vegRebucket) reasons.push('vegetation rebucket (≥0.6 m)');
    // which system dominated the update
    const top = Object.entries(r.sys).sort((a, b) => b[1] - a[1])[0];
    const updShare = r.update / r.ms;
    const rendShare = r.render / r.ms;
    let cause;
    if (r.newPrograms.length) cause = 'shader-compile';
    else if (r.newGeom > 0 || r.newTex > 0) cause = 'gpu-upload';
    else if (updShare > 0.5) cause = `update:${top?.[0] ?? '?'}${r.treesRebucket && top?.[0] === 'trees' ? '(rebucket)' : ''}${r.vegRebucket && top?.[0] === 'vegetation' ? '(rebucket)' : ''}`;
    else if (rendShare > 0.5) cause = 'render-issue';
    else cause = 'mixed';
    causes[cause] = (causes[cause] ?? 0) + 1;
    return { k: r.k, t: r.t, tag: r.tag, ms: r.ms, update: r.update, render: r.render, top: top ? `${top[0]} ${top[1]} ms` : '', reasons, cause };
  });
  const rebucketFrames = { trees: use.filter((r) => r.treesRebucket).length, veg: use.filter((r) => r.vegRebucket).length };
  const events = {
    newPrograms: use.reduce((n, r) => n + r.newPrograms.length, 0),
    newGeometries: use.reduce((n, r) => n + Math.max(0, r.newGeom), 0),
    newTextures: use.reduce((n, r) => n + Math.max(0, r.newTex), 0),
    framesWithNewPrograms: use.filter((r) => r.newPrograms.length).length,
    framesWithNewGeometries: use.filter((r) => r.newGeom > 0).length,
  };
  const byTag = {};
  for (const r of use) {
    const b = (byTag[r.tag] ??= []);
    b.push(r.ms);
  }
  const perTag = Object.fromEntries(Object.entries(byTag).map(([t, v]) => [t, { n: v.length, median: +percentile([...v].sort((a, b) => a - b), 0.5).toFixed(2), max: +Math.max(...v).toFixed(2) }]));
  const treesRebucketMs = stat((r) => (r.treesRebucket ? r.sys.trees ?? 0 : NaN));
  const hasFinish = use.some((r) => typeof r.finish === 'number');
  // --auto: the rungs seen and every change, with the frame it took effect on
  const tierChanges = [];
  let lastTier;
  for (const r of use) {
    if (r.tier === undefined) continue;
    if (lastTier !== undefined && r.tier !== lastTier) tierChanges.push({ frame: r.k, t: +r.t.toFixed(2), tag: r.tag, from: lastTier, to: r.tier });
    lastTier = r.tier;
  }
  const tiers = [...new Set(use.map((r) => r.tier).filter((t) => t !== undefined))];
  const perTier = tiers.length
    ? Object.fromEntries(
        tiers.map((t) => {
          const v = use.filter((r) => r.tier === t).map((r) => r.ms).sort((a, b) => a - b);
          return [t, { frames: v.length, medianMs: +percentile(v, 0.5).toFixed(2), p95Ms: +percentile(v, 0.95).toFixed(2) }];
        }),
      )
    : null;
  return {
    frames: use.length,
    step: stat('ms'),
    update: stat('update'),
    render: stat('render'),
    finish: hasFinish ? stat((r) => r.finish ?? 0) : null,
    tiers: tiers.length ? tiers : null,
    tierChanges: tiers.length ? tierChanges : null,
    perTier,
    calls: stat('calls'),
    tris: stat('tris'),
    systems,
    spikeThresholdMs: +(2 * med).toFixed(2),
    spikes: spikes.length,
    spikeCauses: causes,
    spikeList: attributed,
    rebucketFrames,
    treesRebucketMs: { median: +percentile(use.filter((r) => r.treesRebucket).map((r) => r.sys.trees).sort((a, b) => a - b), 0.5).toFixed(2), max: +Math.max(0, ...use.filter((r) => r.treesRebucket).map((r) => r.sys.trees)).toFixed(2) },
    vegRebucketMs: { median: +percentile(use.filter((r) => r.vegRebucket).map((r) => r.sys.vegetation).sort((a, b) => a - b), 0.5).toFixed(2), max: +Math.max(0, ...use.filter((r) => r.vegRebucket).map((r) => r.sys.vegetation)).toFixed(2) },
    treesSteadyMs: stat((r) => (r.treesRebucket ? NaN : r.sys.trees ?? 0)),
    events,
    perTag,
  };
}

/** like browser.mjs openWorld, with a V8 CPU profile running from before the navigation until ready */
async function openWorldProfiled(browser, baseUrl, { width, height, quality, log, profileOut, warmup, params = '', auto = false }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') log(`[page:${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));
  // same-origin 404 first so the real navigation stays in this renderer process (the profiler is per process)
  await page.goto(`${baseUrl}/blank.txt`, { waitUntil: 'load' });
  const cdp = profileOut ? await page.createCDPSession() : null;
  if (cdp) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
  }
  // --auto: quality=auto plus governor=1 (a headless page otherwise pins auto to the fixed high tier)
  const qualityParam = auto ? 'quality=auto&governor=1' : `quality=${encodeURIComponent(quality)}`;
  const url = `${baseUrl}/?capture=1&dev=0&${qualityParam}${warmup ? '&warmup=1' : ''}${params ? `&${params}` : ''}`;
  log(`url: ${url}`);
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 900_000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 900_000, polling: 250 });
  await page.evaluate(() => {
    const w = window;
    w.__zrReadyState = 'pending';
    Promise.resolve(w.__ZR__.ready()).then(
      () => (w.__zrReadyState = 'ready'),
      (e) => (w.__zrReadyState = `error: ${e?.message ?? e}`),
    );
  });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 900_000, polling: 500 });
  const state = await page.evaluate(() => window.__zrReadyState);
  if (state !== 'ready') throw new Error(`__ZR__.ready() rejected: ${state}`);
  log(`world: ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!cdp) return { page, loadProfileTop: null };
  const { profile } = await cdp.send('Profiler.stop');
  fs.mkdirSync(path.dirname(profileOut), { recursive: true });
  fs.writeFileSync(profileOut, JSON.stringify(profile));
  const top = topSelf(profile, 45);
  log(`load profile: ${top.totalMs.toFixed(0)} ms sampled → ${profileOut}`);
  for (const r of top.rows) log(`  ${String(r.pct).padStart(5)} %  ${String(r.ms).padStart(8)} ms  ${r.fn}`);
  await cdp.detach();
  return { page, loadProfileTop: top };
}

async function main() {
  const server = await serveStatic(dist);
  const browser = await launchBrowser({ width, height });
  try {
    const tLoad = Date.now();
    const { page, loadProfileTop } = await openWorldProfiled(browser, server.url, { width, height, quality, log, profileOut: profileLoadOut, warmup, params: extraParams, auto });
    const readyMs = Date.now() - tLoad;
    if (!(await grabHooks(page))) throw new Error('could not find the capture hooks');
    const dt = 1 / 60;
    const CHUNK = 30;
    /** one pass along the path from the spawn */
    const runPass = async ({ norender, renderEvery, frames, profileOut, tag, finishAfter = false }) => {
      const setup = await page.evaluate(pageSetup, { norender, path: PATH, idleFrames: IDLE_FRAMES, finishAfter, finishInside: finishInside && !norender });
      log(`[${tag}] setup`, JSON.stringify(setup));
      const rows = [];
      const t0 = Date.now();
      let cdp = null;
      if (profileOut) {
        cdp = await page.createCDPSession();
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
        await cdp.send('Profiler.start');
      }
      // --alloc: sampled allocation profile of the pass (every ~4 KB of allocation records the stack)
      let heap = null;
      if (allocOut && tag === (norender ? 'norender' : 'render') && !allocDone) {
        heap = await page.createCDPSession();
        await heap.send('HeapProfiler.enable');
        await heap.send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
      }
      /** one `WorldSystem.perf()` snapshot per chunk (the trees' LOD pools along the walk) */
      const poolSeries = [];
      for (let k = 0; k < frames; k += CHUNK) {
        const n = Math.min(CHUNK, frames - k);
        const { rows: part, pool } = await page.evaluate(pageRun, { k0: k, n, dt, renderEvery });
        rows.push(...part);
        const last = part[part.length - 1];
        if (pool) poolSeries.push({ k: last.k, t: last.t, tag: last.tag, pos: last.pos, systemPerf: pool });
        if ((k / CHUNK) % 4 === 0)
          log(
            `[${tag}] frame ${last.k} t=${last.t.toFixed(2)} ${last.tag} pos=${last.pos} gait=${last.gait} ms=${last.ms} upd=${last.update} rend=${last.render}${last.finish !== undefined ? ` fin=${last.finish}` : ''}${last.tier ? ` tier=${last.tier}` : ''} calls=${last.calls} tris=${last.tris} prog=${last.programs} (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
          );
      }
      let profileTop = null;
      if (cdp) {
        const { profile } = await cdp.send('Profiler.stop');
        fs.mkdirSync(path.dirname(profileOut), { recursive: true });
        fs.writeFileSync(profileOut, JSON.stringify(profile));
        profileTop = topSelf(profile, 45);
        log(`[${tag}] profile: ${profileTop.totalMs.toFixed(0)} ms sampled → ${profileOut}`);
        for (const r of profileTop.rows) log(`  ${String(r.pct).padStart(5)} %  ${String(r.ms).padStart(8)} ms  ${r.fn}`);
        await cdp.detach();
      }
      if (heap) {
        const { profile } = await heap.send('HeapProfiler.stopSampling');
        fs.mkdirSync(path.dirname(allocOut), { recursive: true });
        fs.writeFileSync(allocOut, JSON.stringify(profile));
        allocDone = true;
        const top = topAlloc(profile, 40);
        log(`[${tag}] allocation profile: ${(top.totalBytes / 1048576).toFixed(1)} MB sampled over ${frames} frames → ${allocOut}`);
        for (const r of top.rows) log(`  ${String(r.pct).padStart(5)} %  ${String(r.kb).padStart(8)} KB  ${r.fn}   ← ${r.callers}`);
        await heap.detach();
      }
      const summary = summarise(rows);
      const summaryRendered = renderEvery > 1 ? summarise(rows, { renderedOnly: true }) : null;
      const poolFinal = poolSeries.length ? poolSeries[poolSeries.length - 1].systemPerf : null;
      return { setup, summary, summaryRendered, profileTop, rows, poolSeries, poolFinal, norender, renderEvery, frames };
    };
    const pass1 = await runPass({ norender, renderEvery, frames, profileOut, tag: norender ? 'norender' : 'render' });
    let pass2 = null;
    if (phase2Every) {
      // the rendered pass: a GPU sync after each drawn frame (outside the timed step) so the
      // software GPU's backlog never blocks the next frame's JS — the render-issue ms then measure
      // three's CPU work + call issue only
      pass2 = await runPass({ norender: false, renderEvery: phase2Every, frames: phase2Frames, profileOut: profileOut ? profileOut.replace(/\.cpuprofile$/, '') + '.render.cpuprofile' : null, tag: 'render', finishAfter: true });
    }
    // the governor's own record (rungs, changes with frame indices and the median that triggered each)
    const governor = auto ? await page.evaluate(() => window.__ZR__.perf().governor ?? null) : null;
    const config = { params: extraParams, finish: finishInside, auto, warmup, note, flags: pass1.setup.flags, perf: pass1.setup.perf, drawingBuffer: pass1.setup.drawingBuffer };
    const result = { label, dist, width, height, quality: auto ? 'auto' : quality, config, readyMs, loadProfileTop: loadProfileTop ?? null, pass1, pass2, governor };
    if (out) {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(result));
      log(`wrote ${out}`);
    }
    const brief = (p) => {
      if (!p) return null;
      const { rows: _r, poolSeries: _ps, summary, ...rest } = p;
      const { spikeList, ...s } = summary;
      return { ...rest, summary: s, spikeList: spikeList.slice(0, 40) };
    };
    console.log(JSON.stringify({ label, dist, width, height, quality: result.quality, config, readyMs, pass1: brief(pass1), pass2: brief(pass2), governor }, null, 1));
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
