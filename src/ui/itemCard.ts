/**
 * The bag's 3-D item card: a small secondary Three.js scene (its own WebGLRenderer on its own
 * transparent canvas, never the world's) with deterministic three-point lighting. It renders the
 * selected item in the equipment screen's oval, and thumbnails of every item for the grid and
 * the HUD slot (drawn into plain 2-D canvases). Interactive mode turns the item slowly and lets
 * a drag spin it; under headless capture the pose is fixed so `?screen=equipment` is reproducible.
 */
import { ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, Sphere, Vector3, WebGLRenderer, type Object3D } from 'three';
import { ITEMS, itemById, type ItemDef, type ItemId } from './items';

export interface ItemCard {
  canvas: HTMLCanvasElement;
  /** show an item (builds its mesh on first use) and draw a frame */
  setItem(id: ItemId): void;
  current(): ItemId | null;
  /** thumbnail of any item into a fresh 2-D canvas of `size` device pixels */
  thumbnail(id: ItemId, size: number): HTMLCanvasElement;
  /** start / stop the interactive turntable loop */
  setActive(on: boolean): void;
  /** drawing-buffer size in device pixels (CSS size is set by the stylesheet) */
  setSize(w: number, h: number): void;
  /** add a yaw impulse (drag / rotate key) */
  spin(deltaYaw: number, deltaPitch?: number): void;
  dispose(): void;
}

interface Built {
  root: Group;
  def: ItemDef;
  radius: number;
}

export function createItemCard(opts: { headless: boolean }): ItemCard | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: false });
  } catch (e) {
    console.warn('[bag] item card renderer unavailable:', e);
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.className = 'zr-bag-card';

  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 1, 0.05, 20);
  camera.position.set(0, 0.35, 4.2);
  camera.lookAt(0, 0, 0);

  // three-point rig: warm key from upper-left, cool fill from the right, a rim from behind
  const key = new DirectionalLight(0xfff0d8, 2.6);
  key.position.set(-2.2, 3.2, 3.5);
  const fill = new DirectionalLight(0xbfd4ff, 0.9);
  fill.position.set(3.2, 0.6, 2.2);
  const rim = new DirectionalLight(0xffe2b0, 1.4);
  rim.position.set(0.8, 2.4, -3.2);
  scene.add(key, fill, rim, new HemisphereLight(0xdfe8d8, 0x2a2016, 0.55), new AmbientLight(0xffffff, 0.12));

  const stage = new Group();
  scene.add(stage);

  const built = new Map<ItemId, Built>();
  let current: Built | null = null;
  let yaw = 0;
  let pitch = 0;
  let spinVel = 0;
  let pitchVel = 0;
  let active = false;
  let raf = 0;
  let last = 0;
  let w = 480;
  let h = 520;

  const build = (def: ItemDef): Built => {
    const cached = built.get(def.id);
    if (cached) return cached;
    const mesh = def.build();
    const root = new Group();
    root.add(mesh);
    // centre on the bounding box and normalise to a unit-ish sphere
    const box = new Box3().setFromObject(mesh);
    const centre = box.getCenter(new Vector3());
    mesh.position.sub(centre);
    const sphere = box.getBoundingSphere(new Sphere());
    const s = 1 / Math.max(1e-4, sphere.radius);
    root.scale.setScalar(s * 0.86 * def.fit);
    const b: Built = { root, def, radius: 1 };
    built.set(def.id, b);
    return b;
  };

  const frameFor = (size: number) => {
    // the camera distance that puts a unit sphere at ~72 % of the shorter side
    const aspect = w / h;
    camera.aspect = aspect;
    const fovV = (camera.fov * Math.PI) / 180;
    const fovMin = aspect < 1 ? 2 * Math.atan(Math.tan(fovV / 2) * aspect) : fovV;
    const d = size / Math.sin(fovMin / 2) / 0.72;
    camera.position.set(0, d * 0.09, d);
    camera.lookAt(0, -0.02, 0);
    camera.updateProjectionMatrix();
  };

  const draw = (root: Object3D, def: ItemDef) => {
    stage.clear();
    stage.add(root);
    stage.rotation.set(0.28 + pitch, def.yaw + yaw, 0);
    renderer.render(scene, camera);
  };

  const render = () => {
    if (!current) return;
    renderer.setSize(w, h, false);
    frameFor(1);
    draw(current.root, current.def);
  };

  const loop = (now: number) => {
    if (!active) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    // idle turntable + damped spin impulses
    yaw += (0.35 + spinVel) * dt;
    pitch = Math.max(-0.5, Math.min(0.5, pitch + pitchVel * dt));
    spinVel *= Math.exp(-dt * 3.2);
    pitchVel *= Math.exp(-dt * 3.2);
    pitch *= Math.exp(-dt * 0.8);
    render();
    raf = requestAnimationFrame(loop);
  };

  const card: ItemCard = {
    canvas,
    setItem(id) {
      const def = itemById(id);
      if (!def) return;
      current = build(def);
      if (!opts.headless) {
        yaw = 0;
        pitch = 0;
        spinVel = 0;
        pitchVel = 0;
      }
      render();
    },
    current: () => current?.def.id ?? null,
    thumbnail(id, size) {
      const def = itemById(id) ?? ITEMS[0];
      const b = build(def);
      const out = document.createElement('canvas');
      out.width = size;
      out.height = size;
      const savedW = w;
      const savedH = h;
      w = size;
      h = size;
      const savedYaw = yaw;
      const savedPitch = pitch;
      yaw = 0;
      pitch = 0;
      renderer.setSize(size, size, false);
      frameFor(1.02);
      draw(b.root, def);
      out.getContext('2d')!.drawImage(canvas, 0, 0, size, size);
      w = savedW;
      h = savedH;
      yaw = savedYaw;
      pitch = savedPitch;
      if (current) render();
      return out;
    },
    setActive(on) {
      if (on === active) return;
      active = on && !opts.headless;
      if (active) {
        last = 0;
        raf = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    setSize(nw, nh) {
      w = Math.max(8, Math.round(nw));
      h = Math.max(8, Math.round(nh));
      render();
    },
    spin(dy, dp = 0) {
      spinVel += dy;
      pitchVel += dp;
    },
    dispose() {
      card.setActive(false);
      renderer.dispose();
      canvas.remove();
    },
  };
  return card;
}
