// Production harness for "Into the Ant-Verse". Owner: director.
//
// For any global frame: locate the shot (edit.js), evaluate its module, apply the returned
// state to real-or-proxy assets, render through the LOOK pipeline (or a plain fallback), run
// transitions / flash / universe / glitch passes, draw the 2D FX layer, finish the print pass
// and hand back pixels. Exposes window.__sv for tools/render.mjs and tools/export-cues.mjs.
//
// URL params: ?scale=0.5 (render size factor), ?ss=1 (supersample), ?nolook=1 (force fallback)

import * as THREE from 'three';
import * as edit from './core/edit.js';
import * as layout from './core/layout.js';
import * as prng from './core/prng.js';
import * as common from './shots/common.js';
import { loadLook, loadAssetFactories, loadShot, REPORT } from './core/registry.js';

const params = new URLSearchParams(location.search);
const SCALE = Number(params.get('scale') || 1);
const SS = Number(params.get('ss') || 1);
const FORCE_FALLBACK = params.get('nolook') === '1';
const even = (x) => Math.max(2, 2 * Math.round(x / 2));
const W = even(edit.WIDTH * SCALE);
const H = even(edit.HEIGHT * SCALE);
const TRANSITION_FRAMES = { whip: 6, inkWipe: 10, panelWipe: 10, fadeIn: 14 };

// ---------------------------------------------------------------------------------------------
// Fallback renderer: same contract as LOOK's createLookRenderer, plain three.js underneath.
// ---------------------------------------------------------------------------------------------

function makeBlitter(renderer) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tex; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tex, vUv); }',
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  return (tex, target) => {
    mat.uniforms.tex.value = tex;
    const prevTarget = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;
    renderer.autoClear = true;
    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAuto;
  };
}

function createFallbackRenderer({ width, height }) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  document.body.appendChild(renderer.domElement);
  const opts = { type: THREE.HalfFloatType, depthBuffer: true };
  let comp = new THREE.WebGLRenderTarget(width, height, opts);
  let temp = new THREE.WebGLRenderTarget(width, height, opts);
  const blit = makeBlitter(renderer);
  const hemi = new THREE.HemisphereLight('#bcd6ff', '#402a50', 1.4);
  const sun = new THREE.DirectionalLight('#fff2dd', 2.2);
  sun.position.set(-0.4, 1, 0.6);
  return {
    renderer,
    fallback: true,
    beginFrame() {},
    renderView({ scene, camera, look, rect = [0, 0, 1, 1] }) {
      if (!hemi.parent) scene.add(hemi, sun);
      const [x, y, w, h] = rect;
      comp.viewport.set(x * width, y * height, w * width, h * height);
      comp.scissor.set(x * width, y * height, w * width, h * height);
      comp.scissorTest = true;
      renderer.setRenderTarget(comp);
      renderer.setClearColor(new THREE.Color((look && look.background && look.background.color) || '#15102a'), 1);
      renderer.clear();
      renderer.render(scene, camera);
      comp.scissorTest = false;
      comp.viewport.set(0, 0, width, height);
      renderer.setRenderTarget(null);
    },
    compositeTexture: () => comp.texture,
    applyPass(fn) {
      fn(comp.texture, temp);
      const t = comp;
      comp = temp;
      temp = t;
    },
    drawOverlay(scene, camera) {
      const prev = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(comp);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.autoClear = prev;
    },
    finish() {
      blit(comp.texture, null);
    },
    readPixels() {
      const buf = new Uint8Array(width * height * 4);
      renderer.setRenderTarget(null);
      const gl = renderer.getContext();
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return flipRows(buf, width, height);
    },
  };
}

function flipRows(buf, width, height) {
  const out = new Uint8Array(buf.length);
  const row = width * 4;
  for (let y = 0; y < height; y++) out.set(buf.subarray(y * row, y * row + row), (height - 1 - y) * row);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------------

const state = {
  look: null,
  factories: null,
  lr: null,
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(40, W / H, 0.25, 8000),
  panelCams: [],
  assets: { characters: {}, props: {}, sets: {}, water: null, colony: null },
  built: new Map(), // cacheKey -> { root, kind }
  fx2d: null,
  post: null,
  memo: new Map(), // shotId -> memo from setup()
  lastRendered: -10,
  blit: null,
  transA: null,
  black: null,
  errors: [],
};

function lookModule() {
  return state.look && state.look.materials ? state.look.materials : null;
}

async function boot() {
  state.look = await loadLook();
  state.factories = await loadAssetFactories();
  let lr = null;
  if (state.look.createLookRenderer && !FORCE_FALLBACK) {
    try {
      lr = state.look.createLookRenderer({ width: W, height: H, supersample: SS });
      if (lr.renderer && lr.renderer.domElement && !lr.renderer.domElement.parentNode) document.body.appendChild(lr.renderer.domElement);
      REPORT.renderer = 'look';
    } catch (e) {
      state.errors.push('createLookRenderer: ' + e.message);
      lr = null;
    }
  }
  if (!lr) {
    lr = createFallbackRenderer({ width: W, height: H });
    REPORT.renderer = 'fallback';
  }
  state.lr = lr;
  state.blit = makeBlitter(lr.renderer);
  state.transA = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
  const blackData = new Uint8Array([0, 0, 0, 255]);
  state.black = new THREE.DataTexture(blackData, 1, 1);
  state.black.needsUpdate = true;
  if (state.factories.createFx2D) {
    try {
      state.fx2d = state.factories.createFx2D({ THREE });
      REPORT.fx2d = 'real';
    } catch (e) {
      state.errors.push('createFx2D: ' + e.message);
    }
  }
  if (state.factories.createPost) {
    try {
      state.post = state.factories.createPost({ THREE, renderer: lr.renderer });
      REPORT.post = 'real';
    } catch (e) {
      state.errors.push('createPost: ' + e.message);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Asset construction (lazy, cached, per-asset fallback to proxies)
// ---------------------------------------------------------------------------------------------

function buildOnce(key, kind, make, makeProxy) {
  if (state.built.has(key)) return state.built.get(key).obj;
  let obj = null;
  let used = 'real';
  try {
    obj = make();
  } catch (e) {
    state.errors.push(`${key}: ${e.message}`);
    obj = null;
  }
  if (!obj || !obj.root) {
    used = 'proxy';
    obj = makeProxy();
  }
  state.scene.add(obj.root);
  state.built.set(key, { obj, kind, used });
  REPORT.assets = REPORT.assets || {};
  REPORT.assets[key] = used;
  return obj;
}

function ensureAssets(needs = {}) {
  const f = state.factories;
  const look = lookModule();
  const P = f.proxy;
  const want = new Set();
  for (const c of needs.characters || []) {
    const key = `char:${c.key}`;
    want.add(key);
    state.assets.characters[c.key] = buildOnce(
      key,
      'character',
      () => f.createAnt({ THREE, look, variant: c.variant || c.key, lod: c.lod ?? 0, seed: c.seed || 0 }),
      () => P.createAnt({ THREE, look, variant: c.variant || c.key, seed: c.seed || 0 }),
    );
  }
  if (needs.colony) {
    const key = 'colony';
    want.add(key);
    const cfg = needs.colony === true ? {} : needs.colony;
    state.assets.colony = buildOnce(
      key,
      'colony',
      () => f.createColony({ THREE, look, count: cfg.count || 24, seed: cfg.seed || 1, lod: cfg.lod ?? 2 }),
      () => P.createColony({ THREE, look, count: cfg.count || 24, seed: cfg.seed || 1 }),
    );
  }
  for (const name of needs.props || []) {
    const key = `prop:${name}`;
    want.add(key);
    state.assets.props[name] = buildOnce(key, 'prop', () => f.createProp(name, { THREE, look }), () => P.createProp(name, { THREE, look }));
  }
  for (const name of needs.sets || []) {
    const key = `set:${name}`;
    want.add(key);
    const make = name === 'nest' ? () => f.createNest({ THREE, look }) : () => f.createKitchen({ THREE, look });
    const makeP = name === 'nest' ? () => P.createNest({ THREE, look }) : () => P.createKitchen({ THREE, look });
    state.assets.sets[name] = buildOnce(key, 'set', make, makeP);
  }
  if (needs.water) {
    want.add('water');
    state.assets.water = buildOnce('water', 'water', () => f.createWater({ THREE, look }), () => P.createWater({ THREE, look }));
  }
  for (const [key, rec] of state.built) rec.obj.root.visible = want.has(key);
}

// ---------------------------------------------------------------------------------------------
// Shot staging
// ---------------------------------------------------------------------------------------------

function ctxFor(shot, n) {
  return { THREE, edit, layout, prng, common, assets: state.assets, shot: edit.shotById(shot.id), n };
}

async function evaluateShot(shotId, f) {
  const shot = await loadShot(shotId);
  const meta = edit.shotById(shotId);
  const n = meta.end - meta.start;
  ensureAssets(shot.needs || {});
  const ctx = ctxFor(shot, n);
  if (!state.memo.has(shotId)) {
    let memo = {};
    try {
      memo = (shot.setup && shot.setup(ctx)) || {};
    } catch (e) {
      state.errors.push(`${shotId}.setup: ${e.message}`);
    }
    state.memo.set(shotId, memo);
  }
  let out;
  try {
    out = shot.frame(Math.max(0, Math.min(n - 1, f)), ctx, state.memo.get(shotId)) || {};
  } catch (e) {
    state.errors.push(`${shotId}.frame(${f}): ${e.message}`);
    out = {};
  }
  return { shot, meta, n, out, placeholder: !!shot.placeholder };
}

function applyState(out, globalFrame) {
  const A = state.assets;
  // Characters
  for (const [key, st] of Object.entries(out.characters || {})) {
    const c = A.characters[key];
    if (!c || !st) continue;
    try {
      c.setPose(st);
    } catch (e) {
      state.errors.push(`setPose(${key}): ${e.message}`);
    }
  }
  if (A.colony && out.colony) {
    try {
      A.colony.setPoses(out.colony);
    } catch (e) {
      state.errors.push(`colony.setPoses: ${e.message}`);
    }
  }
  // Props (+ carry parenting)
  const carriedBy = {};
  for (const [key, st] of Object.entries(out.characters || {})) if (st && st.carry) carriedBy[st.carry] = key;
  for (const [name, st] of Object.entries(out.props || {})) if (st && st.attachedTo) carriedBy[name] = st.attachedTo;
  for (const [name, prop] of Object.entries(A.props)) {
    if (!prop.root.visible) continue;
    const st = (out.props || {})[name] || {};
    const holder = carriedBy[name] && A.characters[carriedBy[name]];
    const hook = holder && holder.parts && holder.parts.carryHook;
    try {
      if (hook) {
        if (prop.root.parent !== hook) hook.add(prop.root);
        prop.setState({ ...st, position: st.carryOffset || [0, 0, 0], attachedTo: carriedBy[name] });
        if (!st.carryOffset) prop.root.position.set(0, 0, 0);
      } else {
        if (prop.root.parent !== state.scene) state.scene.add(prop.root);
        prop.setState(st);
      }
    } catch (e) {
      state.errors.push(`prop ${name}: ${e.message}`);
    }
  }
  for (const [name, set] of Object.entries(A.sets)) {
    if (!set.root.visible) continue;
    try {
      set.update && set.update(globalFrame, (out.sets || {})[name] || {});
    } catch (e) {
      state.errors.push(`set ${name}: ${e.message}`);
    }
  }
  if (A.water && A.water.root.visible) {
    try {
      A.water.setState(globalFrame, out.water || {});
    } catch (e) {
      state.errors.push(`water: ${e.message}`);
    }
  }
}

function setCamera(cam, c, aspect) {
  cam.fov = c.fovY || 40;
  cam.aspect = aspect;
  cam.near = c.near || 0.25;
  cam.far = c.far || 8000;
  const p = c.position || [0, 10, 40];
  const t = c.target || [0, 0, 0];
  cam.position.set(p[0], p[1], p[2]);
  cam.up.set(...(c.up || [0, 1, 0]));
  cam.lookAt(t[0], t[1], t[2]);
  if (c.roll) cam.rotateZ(c.roll);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}

function lookFor(meta, f, globalFrame, out) {
  let look = {};
  if (state.look.lookForShot) {
    try {
      look = state.look.lookForShot(meta.id, f, globalFrame) || {};
    } catch (e) {
      state.errors.push(`lookForShot(${meta.id}): ${e.message}`);
    }
  }
  return { ...look, ...(out.look || {}) };
}

function applyLights(look) {
  const m = lookModule();
  if (m && typeof m.setLightRig === 'function' && look.lights) {
    try {
      m.setLightRig(look.lights);
    } catch (e) {
      state.errors.push('setLightRig: ' + e.message);
    }
  }
}

function renderViews(out, look) {
  const lr = state.lr;
  if (Array.isArray(out.cameras) && out.cameras.length) {
    while (state.panelCams.length < out.cameras.length) state.panelCams.push(new THREE.PerspectiveCamera());
    out.cameras.forEach((c, i) => {
      const rect = c.rect || [0, 0, 1, 1];
      const cam = state.panelCams[i];
      setCamera(cam, c, (rect[2] * W) / Math.max(1, rect[3] * H));
      lr.renderView({ scene: state.scene, camera: cam, look, rect });
    });
    return state.panelCams[0];
  }
  setCamera(state.camera, out.camera || {}, W / H);
  lr.renderView({ scene: state.scene, camera: state.camera, look, rect: [0, 0, 1, 1] });
  return state.camera;
}

// Resolve FX anchors from world positions or named subjects into normalised screen space.
const _v = new THREE.Vector3();
function project(camera, p) {
  _v.set(p[0], p[1], p[2]).project(camera);
  return [(_v.x + 1) / 2, (_v.y + 1) / 2, _v.z];
}

function subjectWorld(name) {
  const A = state.assets;
  const obj = (A.characters[name] && A.characters[name].root) || (A.props[name] && A.props[name].root);
  if (!obj) return null;
  obj.getWorldPosition(_v);
  return [_v.x, _v.y, _v.z];
}

function resolveAnchors(list, camera) {
  return (list || []).map((cue) => {
    const c = { ...cue };
    let w = c.anchorWorld || (c.anchorOf ? subjectWorld(c.anchorOf) : null);
    if (w) {
      if (c.anchorOffset) w = [w[0] + c.anchorOffset[0], w[1] + c.anchorOffset[1], w[2] + c.anchorOffset[2]];
      const s = project(camera, w);
      c.anchor = [s[0], s[1]];
    }
    if (Array.isArray(c.pathWorld)) c.path = c.pathWorld.map((p) => project(camera, p).slice(0, 2));
    return c;
  });
}

async function stageAndRender(shotId, f, globalFrame, { held = false } = {}) {
  const ev = await evaluateShot(shotId, f);
  applyState(ev.out, globalFrame);
  const look = lookFor(ev.meta, f, globalFrame, ev.out);
  applyLights(look);
  state.lr.beginFrame && state.lr.beginFrame(globalFrame, { held: held || !!ev.out.held });
  const cam = renderViews(ev.out, look);
  return { ...ev, look, cam };
}

function copyComposite(target) {
  state.lr.applyPass((inTex, outT) => {
    state.blit(inTex, target);
    state.blit(inTex, outT);
  });
}

async function renderFrame(globalFrame) {
  const loc = edit.locate(globalFrame);
  const meta = loc.shot;
  // Pre-roll: when frames are rendered out of order, pose the previous frame first so the
  // previous-matrix bookkeeping (motion vectors) is correct.
  if (state.lastRendered !== globalFrame - 1 && loc.f > 0) {
    await stageAndRender(meta.id, loc.f - 1, globalFrame - 1);
  }
  const kind = meta.transitionIn;
  const win = TRANSITION_FRAMES[kind] || 0;
  const idx = edit.SHOTS.indexOf(meta);
  let usedTransition = null;
  if (win && loc.f < win && state.post && typeof state.post.transition === 'function') {
    let texA = state.black;
    if (kind !== 'fadeIn' && idx > 0) {
      const prev = edit.SHOTS[idx - 1];
      await stageAndRender(prev.id, prev.end - prev.start - 1, globalFrame, { held: true });
      copyComposite(state.transA);
      texA = state.transA.texture;
    }
    usedTransition = { kind, t: (loc.f + 1) / win };
  }
  const r = await stageAndRender(meta.id, loc.f, globalFrame);
  const out = r.out;
  const post = out.post || {};
  const P = state.post;
  const pass = (fn) => state.lr.applyPass(fn);
  if (usedTransition && P) {
    const texA = kind === 'fadeIn' || idx === 0 ? state.black : state.transA.texture;
    pass((inTex, outT) => P.transition(texA, inTex, outT, { kind, t: usedTransition.t, dir: post.transitionDir || [1, 0], frame: globalFrame }));
  }
  if (post.flash && P && P.flash) pass((i, o) => P.flash(i, o, { ...post.flash, frame: globalFrame }));
  // 2D FX go in before the universe/glitch passes so tears and style breaks hit them too.
  if (state.fx2d) {
    try {
      state.fx2d.update(globalFrame, {
        fx: resolveAnchors(out.fx, r.cam),
        lettering: resolveAnchors(out.lettering, r.cam),
        panels: out.panels || null,
      });
      state.lr.drawOverlay(state.fx2d.scene, state.fx2d.camera);
    } catch (e) {
      state.errors.push(`fx2d(${globalFrame}): ${e.message}`);
    }
  }
  if (post.universe && post.universe.amount > 0 && P && P.universe) pass((i, o) => P.universe(i, o, { ...post.universe, frame: globalFrame }));
  if (post.glitch > 0 && P && P.glitch) pass((i, o) => P.glitch(i, o, { amount: post.glitch, frame: globalFrame, seed: post.glitchSeed || 1 }));
  state.lr.finish({ frame: globalFrame, look: r.look });
  state.lastRendered = globalFrame;
  return {
    shot: meta.id,
    f: loc.f,
    held: !!out.held,
    placeholder: r.placeholder,
    transition: usedTransition,
    sfx: out.sfx || [],
  };
}

// JSON-safe evaluation for cue export and continuity checks (no rendering).
function toJSONSafe(v, depth = 0) {
  if (depth > 6) return null;
  if (v == null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map((x) => toJSONSafe(x, depth + 1));
  if (typeof v === 'object') {
    if (v.isObject3D || v.isTexture || v.isMaterial) return `[${v.type || 'object'}]`;
    const o = {};
    for (const [k, x] of Object.entries(v)) if (typeof x !== 'function') o[k] = toJSONSafe(x, depth + 1);
    return o;
  }
  return null;
}

function toBase64(u8) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}

window.__sv = {
  width: W,
  height: H,
  async renderFrame(frame, { pixels = true } = {}) {
    const info = await renderFrame(frame);
    const res = { ...info, errors: state.errors.splice(0) };
    if (pixels) {
      const px = state.lr.readPixels();
      res.width = W;
      res.height = H;
      res.data = toBase64(px);
    }
    return res;
  },
  async evaluate(frame) {
    const loc = edit.locate(frame);
    const ev = await evaluateShot(loc.shot.id, loc.f);
    return { frame, shot: loc.shot.id, f: loc.f, placeholder: ev.placeholder, out: toJSONSafe(ev.out), errors: state.errors.splice(0) };
  },
  info() {
    const audits = {};
    for (const [key, rec] of state.built) {
      try {
        audits[key] = { used: rec.used, ...(rec.obj.audit ? rec.obj.audit() : {}) };
      } catch (e) {
        audits[key] = { used: rec.used, error: e.message };
      }
    }
    return { report: REPORT, audits, errors: state.errors.slice(), size: [W, H], ss: SS };
  },
};

boot()
  .then(() => {
    window.__ready = true;
  })
  .catch((e) => {
    console.error(e);
    window.__error = String(e && e.stack ? e.stack : e);
  });
