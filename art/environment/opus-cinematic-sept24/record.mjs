#!/usr/bin/env node
/**
 * record.mjs — the one recorder for the Opus 30-second Kokiri Forest cinematic (2026-09-24).
 *
 * Renders camera-only shots (character hidden, broll semantics) and real-character shots (the actual
 * game's player: PlayerHandle input at 60 Hz, the game's own locomotion / gait / IK) from the built
 * game, headless, on the native GPU (ZR_NATIVE_GPU=1). See README.md next to this file.
 *
 *   node art/environment/opus-cinematic-sept24/record.mjs --shots shots.json --out gauntlet/out/opus-cinematic-sept24/take1
 *        [--dist dist] [--size 3840x2160] [--fps 30] [--only a,b] [--test [--test-u 0,0.5,1]] [--settle 12]
 *        [--dry] [--url-extra 'hud=0&warmup=1'] [--time 12.5] [--quality high] [--verify] [--full-ticks]
 *
 * grabHooks / isUniform / lerp / lerp3 / ease / captureFrame are copied VERBATIM from
 * gauntlet/scripts/broll.mjs sha256 0431512a6007185aa5391231d1c5b0c54d038ef912d37c109b727306422e9f75
 * (broll.mjs is not imported: its top level parses argv).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, serveStatic, launchBrowser, openWorld } from '../../../gauntlet/scripts/lib/browser.mjs';

const SELF = fileURLToPath(import.meta.url);
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

// ---------------------------------------------------------------- CLI
const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[a.slice(2)] = true;
  else (args[a.slice(2)] = next), i++;
}
if (typeof args.shots !== 'string') {
  console.error('usage: node record.mjs --shots <json> [--out dir] [--dist dist] [--size WxH] [--fps 30] [--only a,b] [--test] [--settle N] [--dry] [--url-extra q] [--verify]');
  process.exit(2);
}
const dist = path.resolve(typeof args.dist === 'string' ? args.dist : 'dist');
const out = path.resolve(typeof args.out === 'string' ? args.out : path.join(ROOT, 'gauntlet/out/opus-cinematic-sept24/take'));
const fps = Number(args.fps ?? 30);
const SIM_HZ = 60;
const [width, height] = String(args.size ?? '3840x2160').split('x').map(Number);
const quality = typeof args.quality === 'string' ? args.quality : 'high';
const baseTime = Number(args.time ?? 12.5);
const test = !!args.test;
const testU = typeof args['test-u'] === 'string' ? args['test-u'].split(',').map(Number) : [0, 0.5, 1];
const settleDefault = Math.max(1, Number(args.settle ?? 12));
const only = typeof args.only === 'string' ? new Set(args.only.split(',').map((s) => s.trim()).filter(Boolean)) : null;
const dry = !!args.dry;
const verify = !!args.verify;
const fullTicks = !!args['full-ticks'];
const urlExtra = typeof args['url-extra'] === 'string' ? args['url-extra'] : 'hud=0&warmup=1';
if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16 || width % 2 || height % 2) throw new Error(`bad --size ${args.size} (even integers >= 16)`);
if (!Number.isFinite(fps) || fps <= 0 || SIM_HZ % fps !== 0) throw new Error(`bad --fps ${args.fps}: ${SIM_HZ} Hz sim must divide evenly`);
if (testU.some((u) => !(u >= 0 && u <= 1))) throw new Error(`bad --test-u ${args['test-u']}`);
const TPF = SIM_HZ / fps; // 60 Hz ticks per output frame

// ---------------------------------------------------------------- copied verbatim from broll.mjs (sha256 0431512a…9f75)
/** Find the world hooks (scene + step) captured in the capture API's closure, to hide the character group. */
async function grabHooks(page) {
  const client = await page.createCDPSession();
  try {
    const ev = await client.send('Runtime.evaluate', { expression: 'window.__ZR__.render' });
    const objectId = ev.result?.objectId;
    if (!objectId) return false;
    const { internalProperties } = await client.send('Runtime.getProperties', { objectId, ownProperties: true });
    const scopes = internalProperties?.find((p) => p.name === '[[Scopes]]');
    if (!scopes?.value?.objectId) return false;
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
        if (r.result?.value === true) return true;
      }
    }
    return false;
  } finally {
    await client.detach();
  }
}

/** true when the PNG's central world box has (almost) no variance — a frame that was not drawn */
async function isUniform(png) {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(png).metadata();
  const box = { left: Math.floor(meta.width * 0.15), top: Math.floor(meta.height * 0.15), width: Math.floor(meta.width * 0.7), height: Math.floor(meta.height * 0.7) };
  const st = await sharp(png).extract(box).greyscale().stats();
  return st.channels[0].stdev < 2;
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const ease = (t) => t * t * (3 - 2 * t);

async function captureFrame(page, canvas, warmFrames, dt, name) {
  // Warm LOD pools in bounded batches without consuming unrecorded simulation time.
  for (let left = warmFrames; left > 0; left -= 4) await page.evaluate(async ([n]) => { await window.__ZR__.render(n, 0); }, [Math.min(4, left)]);
  await page.evaluate(async (dt) => { await window.__ZR__.render(1, dt); }, dt);
  let buf = await canvas.screenshot({ type: 'png' });
  let uniform = await isUniform(buf);
  for (let retry = 0; retry < 3 && uniform; retry++) {
    console.error(`broll: uniform frame at ${name} — re-rendering (${retry + 1}/3)`);
    await page.evaluate(async () => { await window.__ZR__.render(2, 0); });
    buf = await canvas.screenshot({ type: 'png' });
    uniform = await isUniform(buf);
  }
  if (uniform) throw new Error(`broll: uniform frame at ${name} after 3 retries`);
  return buf;
}
// ---------------------------------------------------------------- end of the broll copy
// (captureFrame above is kept verbatim for reference/regression; the recorder's own shot() below is
// the same warm→output→isUniform-retry sequence with the PNG taken with optimizeForSpeed:true.)
void captureFrame;

async function screenshotChecked(page, canvas, name) {
  let buf = Buffer.from(await canvas.screenshot({ type: 'png', optimizeForSpeed: true }));
  let uniform = await isUniform(buf);
  let retries = 0;
  for (; retries < 3 && uniform; retries++) {
    console.error(`record: uniform frame at ${name} — re-rendering (${retries + 1}/3)`);
    await page.evaluate(async () => { await window.__ZR__.render(2, 0); });
    buf = Buffer.from(await canvas.screenshot({ type: 'png', optimizeForSpeed: true }));
    uniform = await isUniform(buf);
  }
  if (uniform) throw new Error(`record: uniform frame at ${name} after 3 retries`);
  return { buf, retries };
}

// ---------------------------------------------------------------- easing + camera paths (Node side, camera shots)
const EASES = {
  smoothstep: (t) => t * t * (3 - 2 * t),
  linear: (t) => t,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeIn: (t) => t * t * t,
};
const easeFn = (name, where) => {
  const f = EASES[name ?? 'smoothstep'];
  if (!f) throw new Error(`${where}: unknown ease "${name}" (${Object.keys(EASES).join('|')})`);
  return f;
};

/** centripetal Catmull-Rom (alpha 0.5, Barry–Goldman) between p1 and p2 at s ∈ [0,1] */
function catmullRom(p0, p1, p2, p3, s) {
  const d = (a, b) => Math.max(1e-6, Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), 0.5));
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const t = t1 + (t2 - t1) * s;
  const mix = (a, b, ta, tb) => a.map((v, i) => (tb - ta < 1e-12 ? v : ((tb - t) / (tb - ta)) * v + ((t - ta) / (tb - ta)) * b[i]));
  const a1 = mix(p0, p1, t0, t1), a2 = mix(p1, p2, t1, t2), a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2), b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}
/** camera keys → pose at eased u. Two keys = a straight lerp (broll's from/to). */
function keyPose(keys, u) {
  if (u <= keys[0].u) return { p: [...keys[0].p], t: [...keys[0].t], fov: keys[0].fov };
  const last = keys[keys.length - 1];
  if (u >= last.u) return { p: [...last.p], t: [...last.t], fov: last.fov };
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1].u) i++;
  const k1 = keys[i], k2 = keys[i + 1];
  const s = (u - k1.u) / Math.max(1e-9, k2.u - k1.u);
  const refl = (a, b) => a.map((v, j) => 2 * v - b[j]);
  const k0 = keys[i - 1], k3 = keys[i + 2];
  const curve = (f) => catmullRom(k0 ? k0[f] : refl(k1[f], k2[f]), k1[f], k2[f], k3 ? k3[f] : refl(k2[f], k1[f]), s);
  return { p: curve('p'), t: curve('t'), fov: lerp(k1.fov, k2.fov, s) };
}

// ---------------------------------------------------------------- shot file validation + edit plan
const isInt = (x) => Math.abs(x - Math.round(x)) < 1e-6;
const v3 = (a, where) => {
  if (!Array.isArray(a) || a.length !== 3 || !a.every(Number.isFinite)) throw new Error(`${where}: expected [x,y,z], got ${JSON.stringify(a)}`);
  return a.map(Number);
};
const v2 = (a, where) => {
  if (!Array.isArray(a) || a.length !== 2 || !a.every(Number.isFinite)) throw new Error(`${where}: expected [x,z], got ${JSON.stringify(a)}`);
  return a.map(Number);
};
const CAM_MODES = ['follow', 'track', 'lead', 'fixed'];
const CAM_DEFAULTS = {
  follow: { back: 3.2, side: 0.4, height: 1.45, aim: 0.9, lead: 0.6, fov: 40, tau: 0.4 },
  track: { side: 3.0, back: 0.4, height: 1.2, aim: 0.8, lead: 0.3, fov: 40, tau: 0.4 },
  lead: { ahead: 3.0, side: 0.5, height: 1.1, aim: 0.85, fov: 40, tau: 0.4 },
  fixed: { aim: 0.85, fov: 40, tau: 0.4 },
};

function loadShots(file) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.shots;
  const total = Array.isArray(raw) ? undefined : raw.total;
  if (!Array.isArray(list) || !list.length) throw new Error('shots: expected an array or {shots:[…], total}');
  const names = new Set();
  let frame = 0;
  let worldEnd = baseTime;
  const plan = list.map((s, idx) => {
    const where = `shot #${idx} ${s.name ?? ''}`;
    if (typeof s.name !== 'string' || !/^[\w.-]+$/.test(s.name)) throw new Error(`${where}: name must match [\\w.-]+`);
    if (names.has(s.name)) throw new Error(`${where}: duplicate name`);
    names.add(s.name);
    const kind = s.kind ?? 'camera';
    if (!(Number(s.s) > 0) || !isInt(s.s * fps)) throw new Error(`${where}: s*fps must be a positive integer (s=${s.s}, fps=${fps})`);
    const frames = Math.round(s.s * fps);
    const settle = Math.max(1, Number(s.settle ?? settleDefault));
    const startFrame = frame;
    frame += frames;
    if (kind === 'camera') {
      let keys;
      if (Array.isArray(s.keys)) keys = s.keys.map((k, i) => ({ u: Number(k.u ?? (s.keys.length > 1 ? i / (s.keys.length - 1) : 0)), p: v3(k.p, `${where} keys[${i}].p`), t: v3(k.t, `${where} keys[${i}].t`), fov: Number(k.fov) }));
      else if (s.from && s.to) keys = [{ u: 0, p: v3(s.from.p, `${where} from.p`), t: v3(s.from.t, `${where} from.t`), fov: Number(s.from.fov) }, { u: 1, p: v3(s.to.p, `${where} to.p`), t: v3(s.to.t, `${where} to.t`), fov: Number(s.to.fov) }];
      else throw new Error(`${where}: camera shot needs keys[] or from/to`);
      if (keys.some((k) => !(k.fov > 1 && k.fov < 170))) throw new Error(`${where}: every key needs a fov in degrees`);
      for (let i = 1; i < keys.length; i++) if (!(keys[i].u > keys[i - 1].u)) throw new Error(`${where}: key u must increase`);
      if (keys[0].u < 0 || keys[keys.length - 1].u > 1) throw new Error(`${where}: key u must lie in [0,1]`);
      const easeName = s.ease ?? 'smoothstep';
      easeFn(easeName, where);
      const time = s.time !== undefined ? Number(s.time) : worldEnd;
      worldEnd = time + frames / fps;
      return { name: s.name, kind, s: s.s, frames, startFrame, settle, keys, ease: easeName, time, timeExplicit: s.time !== undefined };
    }
    if (kind !== 'player') throw new Error(`${where}: kind must be camera|player`);
    const pl = s.player;
    if (!pl) throw new Error(`${where}: player shot needs "player"`);
    const start = v2(pl.start, `${where} player.start`);
    const preroll = Number(pl.preroll ?? 1);
    if (!(preroll >= 0) || !isInt(preroll * SIM_HZ)) throw new Error(`${where}: preroll*${SIM_HZ} must be a non-negative integer`);
    const skip = Number(s.skip ?? 0);
    if (!(skip >= 0) || !isInt(skip * fps)) throw new Error(`${where}: skip*fps must be a non-negative integer`);
    const inputs = (pl.input ?? []).map((inp, i) => {
      const dir = inp.dir ? v2(inp.dir, `${where} input[${i}].dir`) : [0, 0];
      const l = Math.hypot(dir[0], dir[1]);
      const mag = l < 1e-9 ? 0 : Math.max(0, Math.min(1, Number(inp.mag ?? 1)));
      if (!Number.isFinite(Number(inp.at))) throw new Error(`${where}: input[${i}].at must be a number (seconds on the action clock; 0 = first recorded frame of the unskipped action)`);
      return { at: Number(inp.at), k: Math.round(Number(inp.at) * SIM_HZ), moveX: mag ? (dir[0] / l) * mag : 0, moveZ: mag ? (dir[1] / l) * mag : 0, run: !!inp.run, jump: !!inp.jump };
    }).sort((a, b) => a.k - b.k);
    if (!inputs.length) throw new Error(`${where}: player.input needs at least one entry`);
    const face = pl.face ? v2(pl.face, `${where} player.face`) : null;
    const cam = s.camera ?? {};
    const mode = cam.mode ?? 'follow';
    if (!CAM_MODES.includes(mode)) throw new Error(`${where}: camera.mode must be ${CAM_MODES.join('|')}`);
    const params = { ...CAM_DEFAULTS[mode], ...cam };
    if (mode === 'fixed') {
      v3(params.p, `${where} camera.p`);
      if (!params.aimAtLink) v3(params.t, `${where} camera.t (or aimAtLink:true)`);
    }
    if (params.axis) v2(params.axis, `${where} camera.axis`);
    if (cam.dolly) {
      if (!cam.dolly.to || typeof cam.dolly.to !== 'object') throw new Error(`${where}: camera.dolly needs {to:{…}, ease}`);
      easeFn(cam.dolly.ease, `${where} dolly`);
    }
    const time = s.time !== undefined ? Number(s.time) : worldEnd - skip;
    worldEnd = time + skip + frames / fps;
    return {
      name: s.name, kind, s: s.s, frames, startFrame, settle, time, timeExplicit: s.time !== undefined,
      skipFrames: Math.round(skip * fps), prerollTicks: Math.round(preroll * SIM_HZ),
      player: { start, face, anchor: pl.anchor === 'record' ? 'record' : 'preroll', inputs },
      camera: { mode, params, dolly: cam.dolly ? { to: cam.dolly.to, ease: cam.dolly.ease ?? 'smoothstep' } : null },
    };
  });
  if (total !== undefined && !isInt(Number(total) * fps)) throw new Error(`total*fps must be an integer (total=${total})`);
  if (total !== undefined && Math.round(Number(total) * fps) !== frame) throw new Error(`shots sum to ${frame} frames (${(frame / fps).toFixed(3)} s) but total is ${total} s = ${Math.round(total * fps)} frames`);
  return { plan, frames: frame, total };
}

/** rough kinematic estimate of the player's travel (flat ground, no obstacles) — for --dry only */
function estimateTravel(sh) {
  const SPEED = { walk: 1.2, run: 2.2 };
  let x = 0, z = 0, v = 0;
  const pos = {};
  const k0 = -sh.prerollTicks, k1 = (sh.skipFrames + sh.frames - 1) * TPF;
  const inputAt = (k) => {
    let cur = sh.player.inputs[0];
    for (const i of sh.player.inputs) if (i.k <= k) cur = i;
    return cur;
  };
  let dir = [0, 0];
  for (let k = k0 + 1; k <= k1; k++) {
    const i = inputAt(k);
    const mag = Math.hypot(i.moveX, i.moveZ);
    const dt = 1 / SIM_HZ;
    if (mag > 0.05) {
      dir = [i.moveX / mag, i.moveZ / mag];
      const want = (i.run ? SPEED.run : SPEED.walk) * mag;
      v += Math.max(-16 * dt, Math.min(9 * dt, want - v));
    } else v = Math.max(0, v - 16 * dt);
    x += dir[0] * v * dt;
    z += dir[1] * v * dt;
    if (k === 0) pos.atAction0 = [x, z];
    if (k === sh.skipFrames * TPF) pos.atFirstRecorded = [x, z];
    if (k === k1) pos.atLastRecorded = [x, z];
  }
  if (k0 === 0) pos.atAction0 = [0, 0];
  const off = (p) => (p ? [+(sh.player.start[0] + p[0] - (sh.player.anchor === 'record' ? pos.atAction0[0] : 0)).toFixed(2), +(sh.player.start[1] + p[1] - (sh.player.anchor === 'record' ? pos.atAction0[1] : 0)).toFixed(2)] : null);
  return { firstRecorded: off(pos.atFirstRecorded ?? pos.atAction0), lastRecorded: off(pos.atLastRecorded) };
}

// ---------------------------------------------------------------- the in-page recorder (serialised into the page)
function installPageRecorder() {
  const H = window.__H, Z = window.__ZR__;
  const scene = H.scene;
  const P = scene.userData.player;
  const hero = scene.getObjectByName('link');
  const charGroup = scene.getObjectByName('character');
  const cast = scene.getObjectByName('background-characters');
  const composer = scene.userData.composer ?? null;
  const realRender = composer ? composer.render : null;
  const noop = () => {};
  if (!P || !hero || !charGroup) throw new Error(`recorder: player handle / link / character group missing (${!!P}/${!!hero}/${!!charGroup})`);
  const charAudit = H.audits.get('character');
  const stairs = Z.audit().layout.stairs;
  const tmp = hero.position.clone();
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  /** Unity-style SmoothDamp: critically damped, smoothTime T (a ramp lags by v·T) */
  const sd = (cur, target, vel, T, dt) => {
    const omega = 2 / Math.max(1e-4, T);
    const x = omega * dt;
    const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = cur - target;
    const temp = (vel + omega * change) * dt;
    return [target + (change + temp) * e, (vel - omega * temp) * e];
  };
  const groundAt = (x, z) => {
    let h = H.terrain.height(x, z);
    for (const s of stairs) {
      const dx0 = s.top[0] - s.base[0], dz0 = s.top[2] - s.base[2];
      const l = Math.hypot(dx0, dz0);
      const dx = dx0 / l, dz = dz0 / l;
      const u = (x - s.base[0]) * dx + (z - s.base[2]) * dz;
      const v = -(x - s.base[0]) * dz + (z - s.base[2]) * dx;
      if (u >= -0.05 && u <= s.steps * s.tread + 0.05 && Math.abs(v) <= s.width / 2 + 0.1) h = Math.max(h, s.base[1] + Math.min(s.steps, Math.floor(Math.max(0, u) / s.tread) + 1) * s.rise);
    }
    return h;
  };
  const hideUi = () => {
    for (const sel of ['.zr-hud', '.zr-equip', '#dev', '#loading']) for (const el of document.querySelectorAll(sel)) el.style.display = 'none';
  };
  const castHidden = () => {
    if (cast) cast.visible = false;
    return !cast || cast.visible === false;
  };

  const R = {
    renderer: (() => {
      const gl = H.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), drawingBufferWidth: gl.drawingBufferWidth, drawingBufferHeight: gl.drawingBufferHeight, canvasWidth: H.renderer.domElement.width, canvasHeight: H.renderer.domElement.height, pixelRatio: H.renderer.getPixelRatio(), composer: !!composer };
    })(),
    hideUi,
    /** camera-only shots: Link / Navi hidden (broll), player released */
    cameraMode() {
      hideUi();
      P.setInput({ moveX: 0, moveZ: 0, run: false, jump: false });
      if (P.playMode()) P.setPlayMode(false);
      charGroup.visible = false;
      castHidden();
    },
    shot: null,
    /** player shots: set up the action at k = -prerollTicks and (optionally) run the preroll */
    async setupPlayer(spec, startXZ) {
      hideUi();
      charGroup.visible = true;
      if (!castHidden()) throw new Error('background cast still visible');
      const S = {
        spec, k: -spec.prerollTicks, rows: [], fullTicks: !!spec.fullTicks || !composer,
        f: null, axis: spec.camera.params.axis ? (() => { const a = spec.camera.params.axis; const l = Math.hypot(a[0], a[1]); return [a[0] / l, a[1] / l]; })() : null,
        clamped: 0, faceTicks: 0, faceTarget: 0,
      };
      P.setInput({ moveX: 0, moveZ: 0, run: false, jump: false });
      P.setPlayMode(true); // placeFree (spawn, yaw π, hard idle) + fresh locomotion
      P.position.set(startXZ[0], 0, startXZ[1]);
      const T0 = spec.time + S.k / spec.simHz;
      // force the same clock-jump reset path every time (index.ts isTimeJump → resetLocomotion), whatever ran before
      Z.setTime(T0 - 5);
      await R.fastStep(0, S);
      Z.setTime(T0);
      await R.fastStep(0, S);
      if (spec.face) {
        const target = Math.atan2(spec.face[0], spec.face[1]);
        S.faceTarget = target;
        S.faceTicks = Math.ceil((Math.abs(wrap(target - P.heading())) / 9) * spec.simHz) + 2;
      }
      R.shot = S;
      R.filterInit(S);
      return S;
    },
    fastStep(dt, S) {
      if (S && S.fullTicks) return Z.render(1, dt);
      composer.render = noop;
      try {
        H.step(dt);
      } finally {
        composer.render = realRender;
      }
      return null;
    },
    inputAt(S, k) {
      if (S.spec.face && k <= -S.spec.prerollTicks + S.faceTicks) return { moveX: Math.sin(S.faceTarget) * 0.06, moveZ: Math.cos(S.faceTarget) * 0.06, run: false, jump: false };
      const list = S.spec.inputs;
      let cur = list[0];
      for (const i of list) if (i.k <= k) cur = i;
      return { moveX: cur.moveX, moveZ: cur.moveZ, run: cur.run, jump: cur.jump };
    },
    filterInit(S) {
      hero.getWorldPosition(tmp);
      const h = P.heading();
      S.f = { sx: tmp.x, sy: tmp.y, sz: tmp.z, vx: 0, vy: 0, vz: 0, kx: 0, kz: 0, kvx: 0, kvz: 0, vyl: 0, hs: h, hv: 0, px: P.position.x, pz: P.position.z };
    },
    filterStep(S, dt) {
      const c = S.spec.camera.params;
      const tau = Number(c.tau ?? 0.4), tauY = Number(c.tauY ?? Math.max(0.6, tau)), tauH = Number(c.tauH ?? tau * 1.5);
      const f = S.f;
      hero.getWorldPosition(tmp);
      const kvx = (P.position.x - f.px) / dt, kvz = (P.position.z - f.pz) / dt;
      f.px = P.position.x;
      f.pz = P.position.z;
      [f.sx, f.vx] = sd(f.sx, tmp.x, f.vx, tau, dt);
      [f.sz, f.vz] = sd(f.sz, tmp.z, f.vz, tau, dt);
      [f.kx, f.kvx] = sd(f.kx, kvx, f.kvx, tau, dt);
      [f.kz, f.kvz] = sd(f.kz, kvz, f.kvz, tau, dt);
      [f.sy, f.vy] = sd(f.sy, tmp.y, f.vy, tauY, dt);
      f.vyl += (f.vy - f.vyl) * (1 - Math.exp(-dt / 0.8));
      const h = P.heading();
      [f.hs, f.hv] = sd(f.hs, f.hs + wrap(h - f.hs), f.hv, tauH, dt);
    },
    /** the smoothed Link root (lag-compensated: a constant-velocity walk has zero lag; `comp`/`compY` 0 = plain low-pass) */
    smoothed(S) {
      const c = S.spec.camera.params, f = S.f;
      const tau = Number(c.tau ?? 0.4), tauY = Number(c.tauY ?? Math.max(0.6, tau));
      const comp = Number(c.comp ?? 1), compY = Number(c.compY ?? 1);
      return [f.sx + comp * tau * f.kx, f.sy + compY * tauY * f.vyl, f.sz + comp * tau * f.kz];
    },
    async tick(S) {
      S.k++;
      const dt = 1 / S.spec.simHz;
      P.setInput(R.inputAt(S, S.k));
      await R.fastStep(dt, S);
      R.filterStep(S, dt);
      const a = charAudit();
      const fc = P.feetContact ? P.feetContact() : [];
      hero.getWorldPosition(tmp);
      S.rows.push({
        k: S.k,
        sim: +Z.stats().simTime.toFixed(5),
        gait: a.linkGait,
        chain: a.linkGaitChain,
        stance: fc.map((c) => c.stance),
        gapM: fc.map((c) => +c.gapM.toFixed(4)),
        minShoeGapM: fc.map((c) => +c.minShoeGapM.toFixed(4)),
        feet: a.linkFeetContact.map((c) => c.foot),
        sole: a.linkFeetContact.map((c) => [c.soleX, c.soleY, c.soleZ]),
        root: [+tmp.x.toFixed(5), +tmp.y.toFixed(5), +tmp.z.toFixed(5)],
        pos: [+P.position.x.toFixed(5), +P.position.z.toFixed(5)],
        heading: +P.heading().toFixed(5),
        speed: a.linkLocomotion?.speed ?? null,
        jump: a.linkLocomotion?.jump ?? null,
        reachClamped: !!a.linkIk?.reachClamped,
        npcsVisible: a.npcsVisible,
      });
    },
    async runTo(S, k) {
      while (S.k < k) await R.tick(S);
    },
    freezeAxis(S) {
      if (!S.axis) S.axis = [Math.sin(S.f.hs), Math.cos(S.f.hs)];
    },
    /** camera pose for this frame from the smoothed root + the (dollied) camera parameters */
    pose(S, u) {
      const cam = S.spec.camera;
      const e = cam.dolly ? S.spec.easeDolly(u) : 0;
      const prm = {};
      for (const [k, v] of Object.entries(cam.params)) {
        const to = cam.dolly?.to?.[k];
        if (to === undefined) prm[k] = v;
        else if (Array.isArray(v)) prm[k] = v.map((x, i) => x + (to[i] - x) * e);
        else if (typeof v === 'number') prm[k] = v + (to - v) * e;
        else prm[k] = v;
      }
      const L = R.smoothed(S);
      const hs = S.f.hs;
      const fwd = [Math.sin(hs), Math.cos(hs)];
      const right = [-fwd[1], fwd[0]]; // Link's right (his local +X is his left)
      const ax = S.axis ?? fwd;
      const axR = [-ax[1], ax[0]];
      let p, t;
      const n = (k, d = 0) => Number(prm[k] ?? d);
      if (cam.mode === 'follow') {
        p = [L[0] - fwd[0] * n('back') + right[0] * n('side'), L[1] + n('height'), L[2] - fwd[1] * n('back') + right[1] * n('side')];
        t = [L[0] + fwd[0] * n('lead'), L[1] + n('aim'), L[2] + fwd[1] * n('lead')];
      } else if (cam.mode === 'track') {
        p = [L[0] - ax[0] * n('back') + axR[0] * n('side'), L[1] + n('height'), L[2] - ax[1] * n('back') + axR[1] * n('side')];
        t = [L[0] + ax[0] * n('lead'), L[1] + n('aim'), L[2] + ax[1] * n('lead')];
      } else if (cam.mode === 'lead') {
        p = [L[0] + fwd[0] * n('ahead') + right[0] * n('side'), L[1] + n('height'), L[2] + fwd[1] * n('ahead') + right[1] * n('side')];
        t = [L[0], L[1] + n('aim'), L[2]];
      } else {
        p = [...prm.p];
        t = prm.aimAtLink ? [L[0], L[1] + n('aim'), L[2]] : [...prm.t];
      }
      const floor = groundAt(p[0], p[2]) + n('clearance', 0.25);
      let clamped = false;
      if (p[1] < floor) {
        p[1] = floor;
        clamped = true;
        S.clamped++;
      }
      return { p, t, fov: n('fov', 40), clamped, root: L };
    },
    /** one output frame: TPF ticks (sim only), camera, warm renders at dt 0, the output render at dt 0 */
    async frame(S, ticks, capture, u, warm) {
      for (let i = 0; i < ticks; i++) await R.tick(S);
      const rows = S.rows;
      S.rows = [];
      if (!capture) return { k: S.k, rows };
      R.freezeAxis(S);
      const pose = R.pose(S, u);
      Z.setPose(pose.p, pose.t, pose.fov);
      for (let left = warm; left > 0; left -= 4) await Z.render(Math.min(4, left), 0);
      await Z.render(1, 0);
      const st = Z.stats();
      const a = charAudit();
      hero.getWorldPosition(tmp);
      return {
        k: S.k, rows, pose, cam: Z.cameraPose(), simTime: st.simTime, triangles: st.triangles, calls: st.drawCalls,
        root: [tmp.x, tmp.y, tmp.z], pos: [P.position.x, P.position.z], gait: a.linkGait,
        stance: a.linkFeetContact.map((c) => ({ foot: c.foot, stance: c.stance, gapM: c.gapM, minShoeGapM: c.minShoeGapM })),
        reachClamped: !!a.linkIk?.reachClamped, npcsVisible: a.npcsVisible, linkSource: a.linkSource,
        charVisible: charGroup.visible, contextLost: !!window.__zrContextLost,
      };
    },
  };
  window.__REC = R;
  return R.renderer;
}

// ---------------------------------------------------------------- helpers
const fmtS = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
};
const git = (a) => {
  try {
    return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) {
    return `error: ${e.message}`;
  }
};
const round = (a, d = 4) => (Array.isArray(a) ? a.map((x) => round(x, d)) : typeof a === 'number' ? +a.toFixed(d) : a);

// ---------------------------------------------------------------- main
async function main() {
  const { plan, frames: editFrames, total } = loadShots(args.shots);
  const selected = plan.filter((s) => !only || only.has(s.name));
  if (only) for (const n of only) if (!plan.some((s) => s.name === n)) throw new Error(`--only: no shot named ${n}`);
  console.error(`record: ${plan.length} shots, ${editFrames} frames = ${(editFrames / fps).toFixed(3)} s at ${fps} fps${total !== undefined ? ` (total ${total} s ✓)` : ''}; ${width}x${height}; ${test ? `TEST u=${testU.join(',')}` : 'FULL'}`);
  for (const s of plan) {
    const est = s.kind === 'player' ? estimateTravel(s) : null;
    const pose0 = s.kind === 'camera' ? keyPose(s.keys, 0) : null;
    console.error(
      `  ${selected.includes(s) ? '*' : ' '} ${String(s.startFrame).padStart(4)}–${String(s.startFrame + s.frames - 1).padStart(4)} ${s.name.padEnd(18)} ${s.kind.padEnd(6)} ${String(s.frames).padStart(4)} f  world t ${s.time.toFixed(3)}${s.timeExplicit ? '' : ' (cont.)'}` +
        (s.kind === 'player' ? `  preroll ${s.prerollTicks} ticks, skip ${s.skipFrames} f, cam ${s.camera.mode}; est. Link ${JSON.stringify(est.firstRecorded)} → ${JSON.stringify(est.lastRecorded)}` : `  ${s.keys.length} keys, ease ${s.ease}, p0 ${JSON.stringify(pose0.p)}`),
    );
  }
  if (dry) {
    // spline sanity: the path passes through every key at its u
    for (const s of plan.filter((p) => p.kind === 'camera')) for (const k of s.keys) {
      const q = keyPose(s.keys, k.u);
      const err = Math.hypot(q.p[0] - k.p[0], q.p[1] - k.p[1], q.p[2] - k.p[2]);
      if (err > 1e-6) throw new Error(`${s.name}: spline misses key u=${k.u} by ${err}`);
    }
    const capturedFrames = selected.reduce((a, s) => a + (test ? testU.length : s.frames), 0);
    console.error(`dry: OK — ${selected.length} shot(s) selected, ${capturedFrames} frame(s) would be captured (${selected.filter((s) => s.kind === 'player').reduce((a, s) => a + s.prerollTicks + (s.skipFrames + s.frames) * TPF, 0)} player sim ticks)`);
    return;
  }

  if (process.env.ZR_NATIVE_GPU !== '1') throw new Error('ZR_NATIVE_GPU must be 1 (otherwise Chrome silently falls back to SwiftShader)');
  process.env.ZR_URL_EXTRA = urlExtra;
  fs.mkdirSync(path.join(out, test ? 'test' : 'frames'), { recursive: true });

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const tBoot = Date.now();
  const server = await serveStatic(dist);
  const browser = await launchBrowser({ width, height });
  let aborted = null;
  browser.on('disconnected', () => (aborted ??= 'browser disconnected'));
  const run = {
    runId, startedAt: new Date().toISOString(), argv: process.argv.slice(1), test, testU: test ? testU : undefined, only: only ? [...only] : null, width, height, fps, simHz: SIM_HZ, quality, urlExtra, settleDefault, verify, fullTicks,
    git: { head: git(['rev-parse', 'HEAD']), branch: git(['rev-parse', '--abbrev-ref', 'HEAD']), status: git(['status', '--porcelain']).split('\n').filter(Boolean) },
    recorder: { file: path.relative(ROOT, SELF).replace(/\\/g, '/'), sha256: sha256(fs.readFileSync(SELF)), brollSha256: sha256(fs.readFileSync(path.join(ROOT, 'gauntlet/scripts/broll.mjs'))), browserLibSha256: sha256(fs.readFileSync(path.join(ROOT, 'gauntlet/scripts/lib/browser.mjs'))) },
    shotsFile: { path: path.resolve(args.shots), sha256: sha256(fs.readFileSync(path.resolve(args.shots))) },
    dist: { dir: dist, files: {} },
  };
  run.git.statusSummary = `${run.git.status.length} changed path(s)`;
  for (const f of ['index.html', ...fs.readdirSync(path.join(dist, 'assets')).map((f) => `assets/${f}`)].sort()) {
    const full = path.join(dist, f);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) run.dist.files[f] = sha256(fs.readFileSync(full));
  }
  const receiptPath = path.join(out, test ? 'test/receipt.json' : 'receipt.json');
  const receipt = fs.existsSync(receiptPath) ? JSON.parse(fs.readFileSync(receiptPath, 'utf8')) : { runs: [], frames: {}, shots: {} };
  if (receipt.width && (receipt.width !== width || receipt.height !== height || receipt.fps !== fps)) throw new Error(`${receiptPath} was recorded at ${receipt.width}x${receipt.height}@${receipt.fps}; refusing to mix sizes`);
  Object.assign(receipt, { width, height, fps, editFrames, shotsPlan: plan.map((s) => ({ name: s.name, kind: s.kind, startFrame: s.startFrame, frames: s.frames, time: s.time })) });
  receipt.runs.push(run);
  const writeReceipt = () => {
    const files = Object.keys(receipt.frames).sort();
    receipt.sequenceHash = sha256(files.map((f) => `${f} ${receipt.frames[f].sha256}\n`).join(''));
    receipt.frameCount = files.length;
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 1));
  };
  try {
    run.launchArgs = browser.process()?.spawnargs ?? null;
    run.browserVersion = await browser.version();
    const glbRes = await fetch(`${server.url}/models/link/link-runtime.glb`);
    run.linkGlb = { url: '/models/link/link-runtime.glb', status: glbRes.status, sha256: sha256(Buffer.from(await glbRes.arrayBuffer())) };
    const { page, url } = await openWorld(browser, server.url, { width, height, quality, log: console.error });
    run.url = url.replace(server.url, '');
    page.on('console', (m) => {
      if (m.text().includes('ZR_WEBGL_CONTEXT_LOST')) aborted ??= 'webglcontextlost';
    });
    page.on('pageerror', (e) => (run.pageErrors ??= []).push(e.message));
    if (!(await grabHooks(page))) throw new Error('world hooks (window.__H) not found — cannot drive the player');
    await page.addStyleTag({ content: '*{cursor:none!important}.zr-hud,.zr-equip,#dev,#loading{display:none!important}' });
    await page.evaluate(() => {
      window.__zrContextLost = false;
      window.__H.renderer.domElement.addEventListener('webglcontextlost', () => {
        window.__zrContextLost = true;
        console.error('ZR_WEBGL_CONTEXT_LOST');
      });
    });
    const gpu = await page.evaluate(installPageRecorder);
    run.gpu = gpu;
    run.bootSeconds = +((Date.now() - tBoot) / 1000).toFixed(1);
    console.error(`record: boot ${run.bootSeconds} s — ${gpu.renderer} — drawingBuffer ${gpu.drawingBufferWidth}x${gpu.drawingBufferHeight} (pixelRatio ${gpu.pixelRatio})`);
    if (/swiftshader/i.test(gpu.renderer)) throw new Error(`renderer is SwiftShader: ${gpu.renderer}`);
    if (gpu.drawingBufferWidth !== width || gpu.drawingBufferHeight !== height) throw new Error(`drawing buffer ${gpu.drawingBufferWidth}x${gpu.drawingBufferHeight} ≠ requested ${width}x${height}`);
    const canvas = await page.$('canvas');
    const box = await canvas.boundingBox();
    if (Math.round(box.width) !== width || Math.round(box.height) !== height) throw new Error(`canvas box ${box.width}x${box.height} ≠ ${width}x${height}`);

    const toCapture = selected.reduce((a, s) => a + (test ? testU.length : s.frames), 0);
    let captured = 0;
    const tRun = Date.now();
    const recent = [];
    const kindMs = { camera: [], player: [] };
    const saveFrame = (s, i, u, buf, info, ms) => {
      const file = test ? `${s.name}-u${u}.png` : `f${String(s.startFrame + i).padStart(4, '0')}.png`;
      fs.writeFileSync(path.join(out, test ? 'test' : 'frames', file), buf);
      const hash = sha256(buf);
      receipt.frames[file] = { file, sha256: hash, bytes: buf.length, shot: s.name, kind: s.kind, i, u: +u.toFixed(5), editTime: +((s.startFrame + i) / fps).toFixed(5), run: runId, ms, ...info };
      captured++;
      recent.push(ms);
      if (recent.length > 12) recent.shift();
      kindMs[s.kind].push(ms);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      console.error(`${file} [${s.name} ${i + 1}/${s.frames}] sim ${info.simTime.toFixed(4)} ${info.triangles} tris ${info.calls} calls — ${ms} ms (avg ${avg.toFixed(0)}) — ${captured}/${toCapture} ETA ${fmtS((toCapture - captured) * avg)}${info.gait ? ` — ${info.gait} ${info.stance.map((c) => (c.stance ? c.foot[0].toUpperCase() : '·')).join('')}` : ''}${info.cameraClamped ? ' — CAMERA CLAMPED' : ''}`);
      if (aborted) throw new Error(`aborted: ${aborted}`);
      if (info.contextLost) throw new Error('aborted: WebGL context lost');
    };

    for (const s of selected) {
      const tShot = Date.now();
      const idx = test ? [...new Set(testU.map((u) => Math.round(u * (s.frames - 1))))].sort((a, b) => a - b) : Array.from({ length: s.frames }, (_, i) => i);
      const shotReport = { name: s.name, kind: s.kind, run: runId, startFrame: s.startFrame, frames: s.frames, time: s.time };
      if (s.kind === 'camera') {
        await page.evaluate(() => window.__REC.cameraMode());
        const easeC = easeFn(s.ease);
        let prevT = null;
        for (const i of idx) {
          const t0 = Date.now();
          const u = s.frames > 1 ? i / (s.frames - 1) : 0;
          const pose = keyPose(s.keys, easeC(u));
          const want = s.time + i / fps; // world time of this frame
          const first = prevT === null || i !== prevT + 1;
          const r = await page.evaluate(async ([pose, setT, warm, dt]) => {
            if (setT !== null) window.__ZR__.setTime(setT);
            window.__ZR__.setPose(pose.p, pose.t, pose.fov);
            for (let left = warm; left > 0; left -= 4) await window.__ZR__.render(Math.min(4, left), 0);
            await window.__ZR__.render(1, dt);
            const st = window.__ZR__.stats();
            return { simTime: st.simTime, triangles: st.triangles, calls: st.drawCalls, cam: window.__ZR__.cameraPose(), contextLost: !!window.__zrContextLost };
          }, [pose, first ? want - 1 / fps : null, first ? s.settle - 1 : 0, 1 / fps]);
          prevT = i;
          if (Math.abs(r.simTime - want) > 1e-6) throw new Error(`${s.name} frame ${i}: simTime ${r.simTime} ≠ ${want}`);
          const { buf, retries } = await screenshotChecked(page, canvas, `${s.name}#${i}`);
          saveFrame(s, i, u, buf, { simTime: +r.simTime.toFixed(5), cameraPose: { set: round(pose), actual: round(r.cam) }, triangles: r.triangles, calls: r.calls, retries, contextLost: r.contextLost }, Date.now() - t0);
        }
      } else {
        const spec = {
          name: s.name, time: s.time, prerollTicks: s.prerollTicks, simHz: SIM_HZ, face: s.player.face, inputs: s.player.inputs, fullTicks,
          camera: s.camera,
        };
        const setupFn = async ([spec, startXZ, anchor, dollyEase]) => {
          const EASES = { smoothstep: (t) => t * t * (3 - 2 * t), linear: (t) => t, easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), easeOut: (t) => 1 - Math.pow(1 - t, 3), easeIn: (t) => t * t * t };
          spec.easeDolly = EASES[dollyEase] ?? EASES.smoothstep;
          const R = window.__REC;
          let start = startXZ;
          const iters = [];
          for (let it = 0; it < (anchor === 'record' ? 4 : 1); it++) {
            const S = await R.setupPlayer(spec, start);
            await R.runTo(S, 0);
            const at0 = [S.rows.length ? S.rows[S.rows.length - 1].pos[0] : window.__H.scene.userData.player.position.x, S.rows.length ? S.rows[S.rows.length - 1].pos[1] : window.__H.scene.userData.player.position.z];
            iters.push({ start, at0 });
            if (anchor !== 'record') break;
            const err = [startXZ[0] - at0[0], startXZ[1] - at0[1]];
            if (Math.hypot(err[0], err[1]) < 0.002) break;
            start = [start[0] + err[0], start[1] + err[1]];
          }
          const S = R.shot;
          return { k: S.k, faceTicks: S.faceTicks, iters, start };
        };
        const setup = await page.evaluate(setupFn, [spec, s.player.start, s.player.anchor, s.camera.dolly?.ease ?? 'smoothstep']);
        console.error(`${s.name}: preroll ${s.prerollTicks} ticks (face turn ${setup.faceTicks}), start ${JSON.stringify(round(setup.start, 3))} → at action 0 ${JSON.stringify(round(setup.iters.at(-1).at0, 3))}${setup.iters.length > 1 ? ` (${setup.iters.length} anchor iterations)` : ''}`);
        shotReport.preroll = { ticks: s.prerollTicks, faceTicks: setup.faceTicks, start: setup.start, iterations: setup.iters };
        // the steps log: every 60 Hz tick from the preroll on; edit = this shot's edit start + (k − first recorded tick)/60
        const shotStartEdit = s.startFrame / fps;
        const k0rec = s.skipFrames * TPF;
        const steps = [];
        const pushRows = (rows) => {
          for (const r of rows) steps.push({ edit: +(shotStartEdit + (r.k - k0rec) / SIM_HZ).toFixed(5), rec: r.k >= k0rec && r.k <= (s.skipFrames + s.frames - 1) * TPF, ...r });
        };
        // rows produced during the preroll are drained with the first frame call
        let first = true;
        let curK = setup.k;
        for (const i of idx) {
          const t0 = Date.now();
          const j = s.skipFrames + i; // action frame
          const u = s.frames > 1 ? i / (s.frames - 1) : 0;
          const ticks = j * TPF - curK;
          const warm = first || test ? s.settle - 1 : 0;
          const r = await page.evaluate(([ticks, u, warm]) => window.__REC.frame(window.__REC.shot, ticks, true, u, warm), [ticks, u, warm]);
          first = false;
          curK = r.k;
          if (curK !== j * TPF) throw new Error(`${s.name}: tick ${curK} ≠ ${j * TPF}`);
          pushRows(r.rows);
          const want = s.time + j / fps;
          if (Math.abs(r.simTime - want) > 1e-6) throw new Error(`${s.name} frame ${i}: simTime ${r.simTime} ≠ ${want}`);
          if (r.npcsVisible !== 0) throw new Error(`${s.name}: npcsVisible ${r.npcsVisible}`);
          if (!r.charVisible) throw new Error(`${s.name}: character hidden in a player shot`);
          const { buf, retries } = await screenshotChecked(page, canvas, `${s.name}#${i}`);
          saveFrame(s, i, u, buf, {
            simTime: +r.simTime.toFixed(5), cameraPose: { set: round({ p: r.pose.p, t: r.pose.t, fov: r.pose.fov }), actual: round(r.cam) }, cameraClamped: r.pose.clamped, smoothedRoot: round(r.pose.root),
            triangles: r.triangles, calls: r.calls, retries, root: round(r.root, 5), pos: round(r.pos, 5), gait: r.gait, stance: r.stance.map((c) => ({ ...c, gapM: +c.gapM.toFixed(4), minShoeGapM: +c.minShoeGapM.toFixed(4) })), reachClamped: r.reachClamped, linkSource: r.linkSource, contextLost: r.contextLost,
          }, Date.now() - t0);
        }
        const rest = await page.evaluate(() => window.__REC.frame(window.__REC.shot, 0, false));
        pushRows(rest.rows);
        const gaits = {};
        for (const r of steps.filter((r) => r.rec)) gaits[r.gait] = (gaits[r.gait] ?? 0) + 1;
        // footfall events: a foot's stance rising edge (feet named from the audit)
        const events = [];
        for (let n = 1; n < steps.length; n++) for (let f = 0; f < steps[n].stance.length; f++) if (steps[n].stance[f] && !steps[n - 1].stance[f]) events.push({ edit: steps[n].edit, k: steps[n].k, foot: steps[n].feet[f], gait: steps[n].gait, rec: steps[n].rec });
        shotReport.gaitTicks = gaits;
        shotReport.reachClampedTicks = steps.filter((r) => r.rec && r.reachClamped).length;
        shotReport.cameraClampedFrames = Object.values(receipt.frames).filter((f) => f.run === runId && f.shot === s.name && f.cameraClamped).length;
        shotReport.footfalls = events.filter((e) => e.rec).length;
        const stepsFile = path.join(out, test ? 'test' : '', `steps-${s.name}.json`);
        fs.writeFileSync(stepsFile, JSON.stringify({ shot: s.name, run: runId, fps, simHz: SIM_HZ, shotStartEdit, startFrame: s.startFrame, frames: s.frames, skipFrames: s.skipFrames, worldTimeAtAction0: s.time, note: 'edit = seconds in the cut (this shot starts at shotStartEdit); rec = inside the recorded frames; stance/gapM/minShoeGapM = PlayerHandle.feetContact() per 60 Hz tick, feet names from the character audit', events, rows: steps }, null, 0));
        if (verify) {
          // determinism: the same action re-simulated (sim-only ticks) must give identical per-tick state;
          // equivalence: sim-only ticks (post-fx skipped) vs fully rendered ticks must give identical state too
          const lastK = steps.at(-1).k;
          const key = (r) => JSON.stringify([r.k, r.gait, r.stance, r.root, r.pos, r.heading, r.gapM]);
          const resim = async (full) => page.evaluate(async ([spec, start, lastK, full, dollyEase]) => {
            const R = window.__REC;
            spec.easeDolly = () => 0;
            const S = await R.setupPlayer({ ...spec, fullTicks: full }, start);
            await R.runTo(S, lastK);
            return S.rows;
          }, [spec, setup.start, lastK, full, 'smoothstep']);
          const cmp = (rows, label) => {
            let mismatch = 0, first = null, maxRootDiff = 0;
            const byK = new Map(steps.map((r) => [r.k, r]));
            for (const r of rows) {
              const o = byK.get(r.k);
              if (!o) continue;
              const d = Math.max(...r.root.map((v, i) => Math.abs(v - o.root[i])));
              maxRootDiff = Math.max(maxRootDiff, d);
              if (key(r) !== key(o)) {
                mismatch++;
                first ??= { k: r.k, a: o, b: r };
              }
            }
            const res = { ticks: rows.length, mismatchedTicks: mismatch, maxRootDiffM: maxRootDiff, identical: mismatch === 0 && rows.length === steps.length, firstMismatch: first };
            console.error(`${s.name}: ${label} — ${res.identical ? 'IDENTICAL' : 'DIFFERENT'} over ${rows.length} ticks (max root diff ${maxRootDiff.toExponential(2)} m, ${mismatch} mismatched)`);
            return res;
          };
          shotReport.determinism = cmp(await resim(fullTicks), 'determinism (re-simulated)');
          shotReport.equivalence = cmp(await resim(!fullTicks), `equivalence (${fullTicks ? 'sim-only' : 'fully rendered'} ticks)`);
        }
        console.error(`${s.name}: gaits ${JSON.stringify(gaits)}, ${shotReport.footfalls} footfalls, reachClamped ${shotReport.reachClampedTicks} ticks, camera clamped ${shotReport.cameraClampedFrames} frames → ${path.relative(ROOT, stepsFile)}`);
      }
      shotReport.seconds = +((Date.now() - tShot) / 1000).toFixed(1);
      receipt.shots[`${s.name}${test ? '@test' : ''}`] = shotReport;
      writeReceipt();
    }
    const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
    run.timing = { bootSeconds: run.bootSeconds, captureSeconds: +((Date.now() - tRun) / 1000).toFixed(1), frames: captured, msPerFrame: { camera: avg(kindMs.camera), player: avg(kindMs.player) }, msPerFrameSteady: { camera: avg(kindMs.camera.slice(1)), player: avg(kindMs.player.slice(1)) } };
    run.pageErrors ??= [];
    run.finishedAt = new Date().toISOString();
    writeReceipt();
    console.error(`record: done — ${captured} frame(s) in ${run.timing.captureSeconds} s (+ boot ${run.bootSeconds} s); ms/frame camera ${run.timing.msPerFrame.camera} player ${run.timing.msPerFrame.player} → ${path.relative(ROOT, receiptPath)}`);
  } catch (e) {
    run.error = String(e?.stack ?? e);
    try {
      writeReceipt();
    } catch {}
    throw e;
  } finally {
    await browser.close().catch(() => {});
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
