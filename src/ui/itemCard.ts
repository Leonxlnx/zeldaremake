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
  /**
   * Thumbnail of any item into a fresh 2-D canvas of `w × h` device pixels: the item in its
   * `thumb` pose, scaled so its projected silhouette fills the cell, under a brighter rig, over a
   * soft warm pool with a contact shadow — readable at grid size on a 1280 px frame.
   */
  thumbnail(id: ItemId, w: number, h?: number): HTMLCanvasElement;
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
  const hemi = new HemisphereLight(0xdfe8d8, 0x2a2016, 0.55);
  const ambient = new AmbientLight(0xffffff, 0.12);
  scene.add(key, fill, rim, hemi, ambient);
  const CARD_RIG = { key: key.intensity, fill: fill.intensity, rim: rim.intensity, hemi: hemi.intensity, ambient: ambient.intensity, exposure: renderer.toneMappingExposure };
  // the grid cells are ~100 px on a 1280 frame: the thumbnails get a hotter key, a stronger rim and
  // more exposure so the silhouette reads against the dark plate
  const THUMB_RIG = { key: 3.8, fill: 1.4, rim: 2.4, hemi: 1.0, ambient: 0.34, exposure: 1.42 };
  const applyRig = (r: typeof CARD_RIG) => {
    key.intensity = r.key;
    fill.intensity = r.fill;
    rim.intensity = r.rim;
    hemi.intensity = r.hemi;
    ambient.intensity = r.ambient;
    renderer.toneMappingExposure = r.exposure;
  };

  // ZXY: yaw turns the item, pitch tilts it toward the camera, roll then lays it diagonally in
  // screen space (the card never rolls, so its pose is unchanged by the order)
  const stage = new Group();
  stage.rotation.order = 'ZXY';
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
    stage.position.set(0, 0, 0);
    stage.scale.setScalar(1);
    stage.rotation.set(0.28 + pitch, def.yaw + yaw, 0);
    renderer.render(scene, camera);
  };

  const box = new Box3();
  const corner = new Vector3();
  /**
   * Scale and shift the stage so the projected silhouette of `root` (in the stage's current pose)
   * fills `fill` of the viewport's constraining side, centred. Three passes: the projection is
   * perspective and the recentring shift is measured before the pass's scale, so each pass only
   * converges the estimate.
   */
  const fitProjected = (root: Object3D, fill: number) => {
    // `project` reads matrixWorldInverse, which only a render refreshes — frameFor just moved the camera
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    for (let pass = 0; pass < 3; pass++) {
      stage.updateMatrixWorld(true);
      box.setFromObject(root, true);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
        minX = Math.min(minX, corner.x);
        maxX = Math.max(maxX, corner.x);
        minY = Math.min(minY, corner.y);
        maxY = Math.max(maxY, corner.y);
      }
      const half = Math.max((maxX - minX) / 2, (maxY - minY) / 2, 1e-4);
      stage.scale.multiplyScalar(fill / half);
      // recentre: an NDC offset maps to world units through the view half-extents at the stage's depth
      const depth = camera.position.length();
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * depth;
      const halfW = halfH * camera.aspect;
      stage.position.x -= ((minX + maxX) / 2) * halfW;
      stage.position.y -= ((minY + maxY) / 2) * halfH;
    }
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
    thumbnail(id, tw, th = tw) {
      const def = itemById(id) ?? ITEMS[0];
      const b = build(def);
      const tp = def.thumb ?? {};
      const out = document.createElement('canvas');
      out.width = Math.max(8, Math.round(tw));
      out.height = Math.max(8, Math.round(th));
      const savedW = w;
      const savedH = h;
      w = out.width;
      h = out.height;
      renderer.setSize(w, h, false);
      frameFor(1);
      applyRig(THUMB_RIG);
      stage.clear();
      stage.add(b.root);
      stage.position.set(0, 0, 0);
      stage.scale.setScalar(1);
      stage.rotation.set(tp.pitch ?? 0.28, tp.yaw ?? def.yaw, tp.roll ?? 0);
      fitProjected(b.root, tp.fill ?? 0.84);
      renderer.render(scene, camera);
      applyRig(CARD_RIG);

      const g2 = out.getContext('2d')!;
      const short = Math.min(w, h);
      // the pool: a warm mid tone behind the item that fades to nothing before the cell's edge
      const pool = g2.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.5);
      pool.addColorStop(0, 'rgba(150, 118, 68, 0.34)');
      pool.addColorStop(0.55, 'rgba(96, 74, 40, 0.16)');
      pool.addColorStop(1, 'rgba(40, 30, 16, 0)');
      g2.fillStyle = pool;
      g2.fillRect(0, 0, w, h);
      // contact shadow under the silhouette, then the item itself
      g2.save();
      g2.shadowColor = 'rgba(0, 0, 0, 0.7)';
      g2.shadowBlur = short * 0.09;
      g2.shadowOffsetX = short * 0.015;
      g2.shadowOffsetY = short * 0.04;
      g2.drawImage(canvas, 0, 0, w, h);
      g2.restore();

      w = savedW;
      h = savedH;
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
