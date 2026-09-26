import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Sphere,
  Vector3,
  type Object3D,
} from 'three';
import { ASSETS } from './assets';
import { DEFAULT_LENS, type Lens, type Pipeline } from './render/pipeline';
import { makeEnvironment, SPACE_ENV, STUDIO_ENV } from './render/env';
import { bakeNebula, makeStars } from './world/sky';

/**
 * Turntable for a single asset: `?lab=<id>&bg=studio|space`. Auto-frames the bounding sphere;
 * the still renderer drives yaw / pitch / distance / time through the capture API.
 */
export class Lab {
  scene = new Scene();
  camera = new PerspectiveCamera(32, 2.39, 0.02, 4000);
  object: Object3D;
  sphere = new Sphere();
  key: DirectionalLight;
  lens: Lens = { ...DEFAULT_LENS, grain: 0.02, vignette: 0.25 };
  far: { near: number; far: number } | null = null;

  constructor(private pipeline: Pipeline, id: string, bg: 'studio' | 'space') {
    const f = ASSETS[id];
    if (!f) throw new Error(`unknown asset "${id}" (have: ${Object.keys(ASSETS).join(', ')})`);
    this.object = f();
    this.scene.add(this.object);
    this.object.updateMatrixWorld(true);
    new Box3().setFromObject(this.object).getBoundingSphere(this.sphere);
    // optional framing override: userData.frame = { center: [x, y, z], radius }
    const fr = this.object.userData.frame as { center: [number, number, number]; radius: number } | undefined;
    if (fr) {
      this.sphere.center.set(...fr.center);
      this.sphere.radius = fr.radius;
    }
    const sun: [number, number, number] = [0.55, 0.62, 0.56];
    if (bg === 'space') {
      this.scene.background = bakeNebula(pipeline.renderer, { size: 256 });
      this.scene.add(makeStars({ count: 6000 }));
      this.scene.environment = makeEnvironment(pipeline.renderer, SPACE_ENV(sun));
    } else {
      this.scene.background = new Color(0x15181d);
      this.scene.environment = makeEnvironment(pipeline.renderer, STUDIO_ENV);
    }
    const r = this.sphere.radius;
    this.key = new DirectionalLight(0xfff2e0, 2.6);
    this.key.position.set(sun[0], sun[1], sun[2]).multiplyScalar(r * 4).add(this.sphere.center);
    this.key.target.position.copy(this.sphere.center);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    const sc = this.key.shadow.camera;
    sc.left = -r * 1.2;
    sc.right = r * 1.2;
    sc.top = r * 1.2;
    sc.bottom = -r * 1.2;
    sc.near = r * 0.5;
    sc.far = r * 8;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = r * 0.004;
    this.key.shadow.radius = 2;
    this.key.layers.enableAll();
    this.key.target.layers.enableAll();
    this.scene.add(this.key, this.key.target);
    const hemi = new HemisphereLight(0x8fa6c8, 0x2a2f38, bg === 'space' ? 0.35 : 0.6);
    hemi.layers.enableAll();
    this.scene.add(hemi);
    const amb = new AmbientLight(0xffffff, 0.05);
    amb.layers.enableAll();
    this.scene.add(amb);
    this.pose(35, 18, 1, 0);
  }

  pose(yawDeg: number, pitchDeg: number, distMul: number, t: number): void {
    const c = this.sphere.center;
    const r = this.sphere.radius;
    const yaw = (yawDeg * Math.PI) / 180;
    const pitch = (pitchDeg * Math.PI) / 180;
    const vfov = (this.camera.fov * Math.PI) / 180;
    const dist = (r / Math.sin(vfov / 2)) * 0.62 * distMul;
    this.camera.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * dist, c.y + Math.sin(pitch) * dist, c.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    this.camera.near = Math.max(0.01, dist - r * 3) * 0.05;
    this.camera.far = Math.max(dist + r * 4, 3e6);
    this.camera.lookAt(c);
    this.camera.updateProjectionMatrix();
    this.lens.focus = dist;
    const anim = this.object.userData.animate as ((t: number) => void) | undefined;
    anim?.(t);
  }

  render(t: number): void {
    this.camera.aspect = this.pipeline.width / this.pipeline.height;
    this.camera.updateProjectionMatrix();
    this.pipeline.render(this.scene, this.camera, this.lens, { far: this.far, time: t });
  }
}

export const _v = new Vector3();
