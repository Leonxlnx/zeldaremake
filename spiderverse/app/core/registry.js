// Resolves every production module at runtime, falling back per module so one broken or
// unfinished file never blocks a render. Owner: director.
//
// Every resolution is recorded in `REPORT` so renders can state honestly which frames used real
// assets and which used proxies.

import * as proxy from '../assets/proxy.js';
import { SHOTS } from './edit.js';

export const REPORT = { modules: {}, shots: {} };

const BASE = '/spiderverse/app';

async function tryImport(key, path) {
  try {
    const mod = await import(`${path}?v=${globalThis.__svBust || 0}`);
    REPORT.modules[key] = { path, ok: true };
    return mod;
  } catch (e) {
    REPORT.modules[key] = { path, ok: false, error: String(e && e.message ? e.message : e).slice(0, 400) };
    return null;
  }
}

/** Look pipeline: materials + renderer + lookdev. Returns nulls where missing. */
export async function loadLook() {
  const materials = await tryImport('materials', `${BASE}/core/materials.js`);
  const renderer = await tryImport('renderer', `${BASE}/core/renderer.js`);
  const lookdev = await tryImport('lookdev', `${BASE}/core/lookdev.js`);
  return {
    materials: materials && typeof materials.makeLookMaterial === 'function' ? materials : null,
    createLookRenderer: renderer && typeof renderer.createLookRenderer === 'function' ? renderer.createLookRenderer : null,
    lookForShot: lookdev && typeof lookdev.lookForShot === 'function' ? lookdev.lookForShot : null,
  };
}

export async function loadAssetFactories() {
  const ant = await tryImport('characters', `${BASE}/assets/characters/ant.js`);
  const kitchen = await tryImport('kitchen', `${BASE}/assets/sets/kitchen.js`);
  const nest = await tryImport('nest', `${BASE}/assets/sets/nest.js`);
  const props = await tryImport('props', `${BASE}/assets/props/index.js`);
  const water = await tryImport('water', `${BASE}/assets/water/water.js`);
  const fx2d = await tryImport('fx2d', `${BASE}/fx/fx2d.js`);
  const post = await tryImport('post', `${BASE}/fx/post.js`);
  const pick = (mod, name, fallback, key) => {
    if (mod && typeof mod[name] === 'function') {
      REPORT.modules[key].using = 'real';
      return mod[name];
    }
    if (REPORT.modules[key]) REPORT.modules[key].using = fallback ? 'proxy' : 'none';
    return fallback;
  };
  return {
    createAnt: pick(ant, 'createAnt', proxy.createAnt, 'characters'),
    createColony: ant && typeof ant.createColony === 'function' ? ant.createColony : proxy.createColony,
    createKitchen: pick(kitchen, 'createKitchen', proxy.createKitchen, 'kitchen'),
    createNest: pick(nest, 'createNest', proxy.createNest, 'nest'),
    createProp: pick(props, 'createProp', proxy.createProp, 'props'),
    createWater: pick(water, 'createWater', proxy.createWater, 'water'),
    createFx2D: pick(fx2d, 'createFx2D', null, 'fx2d'),
    createPost: pick(post, 'createPost', null, 'post'),
    // Real modules are allowed to throw on construction while they are being written; the
    // harness catches that per asset and falls back to these.
    proxy,
  };
}

/** A shot module that stands in for a missing or broken one: a readable slate on the proxy set. */
function placeholderShot(id) {
  const s = SHOTS.find((x) => x.id === id);
  return {
    id,
    placeholder: true,
    needs: { sets: ['kitchen'], characters: [{ key: 'courier', variant: 'courier', lod: 1 }], props: ['crumb', 'cap', 'cuttingBoard'] },
    setup() {
      return {};
    },
    frame(f) {
      const n = s ? s.end - s.start : 48;
      const t = f / Math.max(1, n - 1);
      const x = -260 + t * 480;
      return {
        camera: { position: [x - 40, 14, -470], target: [x + 20, 2, -520], up: [0, 1, 0], fovY: 40 },
        held: false,
        characters: { courier: { position: [x, 0, -520], heading: 0, gait: { phase: (f / 12) % 1, speed: 0.8 } } },
        props: {},
        sets: { kitchen: { clock: '11:58' } },
        fx: [],
        lettering: [{ text: `${id} ${s ? s.name : ''}`.trim(), anchor: [0.5, 0.82], rot: 0, scale: 0.12, style: 'light', color: 'white', t: 1 }],
        panels: null,
        post: {},
        look: {},
      };
    },
  };
}

const shotCache = new Map();

export async function loadShot(id) {
  if (shotCache.has(id)) return shotCache.get(id);
  const mod = await tryImport(`shot:${id}`, `${BASE}/shots/${id.toLowerCase()}.js`);
  let shot = mod && mod.default && typeof mod.default.frame === 'function' ? mod.default : null;
  REPORT.shots[id] = shot ? 'real' : 'placeholder';
  if (!shot) shot = placeholderShot(id);
  shotCache.set(id, shot);
  return shot;
}

export function clearShotCache() {
  shotCache.clear();
}
