import * as THREE from 'three';
import { createEnvironment, createMaterials } from './materials.js';
import { createShip } from './ship.js';
import { createSpace } from './space.js';
import { createPlayer } from './player.js';
import { createInteract } from './interact.js';
import { createPost } from './post.js';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
  alpha: false,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = true;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b10);
scene.fog = new THREE.FogExp2(0x12161b, 0.011);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 900);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(createEnvironment(), 0.14).texture;
scene.environmentIntensity = 0.58;
pmrem.dispose();

const mats = createMaterials();
const ship = createShip(mats);
const space = createSpace();
scene.add(ship.root);
scene.add(space.root);

const post = createPost(renderer, scene, camera);
const player = createPlayer(camera, renderer.domElement, ship.colliders);
const interact = createInteract({
  camera,
  interactables: ship.interactables,
  ship,
  setExposure: (v) => { renderer.toneMappingExposure = v; },
});

const VIEWS = {
  cockpit: { pos: [0, 1.7, 11.15], look: [0.05, 1.28, 15.2], time: 26 },
  corridor: { pos: [0, 1.7, 1.4], look: [0.2, 1.46, 9.4], time: 26 },
  quarters: { pos: [-2.65, 1.7, 2.25], look: [-4.2, 0.95, 1.5], time: 26 },
  window: { pos: [0.12, 1.6, 14.58], look: [14, -1.2, 58], time: 26 },
};

const perf = { fps: 0, triangles: 0, calls: 0 };
let fpsAccum = 0;
let fpsFrames = 0;
let lastSample = performance.now();

window.debugAPI = {
  ready: true,
  frames: 0,
  views: Object.keys(VIEWS),
  setView(name) {
    const view = VIEWS[name];
    if (!view) throw new Error(`Unknown view: ${name}`);
    player.setView(view.pos, view.look);
    space.setTime(view.time);
    interact.setSuppressed(true);
  },
  setSuppress(value) {
    interact.setSuppressed(!!value);
  },
  perform: (id) => interact.perform(id),
  getStatus: () => interact.getStatus(),
  getPrompt: () => interact.getPrompt(),
  getCycle: () => ship.getCycle(),
  setCycle: (value) => ship.setCycleImmediate(value),
  getPerf: () => ({ ...perf }),
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!player.state.debug) space.play();
  player.update(dt);
  ship.update(dt);
  space.update(dt);
  interact.update(dt);
  post.render(now * 0.001);
  const sampleDt = now - lastSample;
  lastSample = now;
  if (sampleDt > 0 && sampleDt < 200) {
    fpsAccum += 1000 / sampleDt;
    fpsFrames += 1;
    if (fpsFrames >= 24) {
      perf.fps = fpsAccum / fpsFrames;
      fpsAccum = 0;
      fpsFrames = 0;
    }
  }
  perf.triangles = renderer.info.render.triangles;
  perf.calls = renderer.info.render.calls;
  window.debugAPI.frames += 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  post.setSize(window.innerWidth, window.innerHeight);
});
