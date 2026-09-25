import {
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';
import { DEFAULT_LENS, type Lens, type Pipeline } from '../render/pipeline';
import { makeEnvironment, SPACE_ENV } from '../render/env';
import { bakeNebula, makeStars } from '../world/sky';
import { makeCoruscant } from '../world/planet';
import type { FilmUI } from '../ui';
import { testBricks } from '../assets/testBricks';

export interface Film {
  duration: number;
  renderAt(t: number, o?: { subframes?: number; shutter?: number; fps?: number }): void;
  shots(): { name: string; start: number; end: number }[];
  renderAudio(): Promise<string>;
}

export async function createFilm(pipeline: Pipeline, ui: FilmUI): Promise<Film> {
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 2.39, 0.1, 3e6);
  const sun = new Vector3(0.5, 0.35, -0.8).normalize();
  scene.background = bakeNebula(pipeline.renderer);
  scene.add(makeStars());
  scene.environment = makeEnvironment(pipeline.renderer, SPACE_ENV([sun.x, sun.y, sun.z]));
  const planet = makeCoruscant({ radius: 120000, center: new Vector3(0, -132000, 0), sunDir: sun });
  scene.add(planet.group);
  const key = new DirectionalLight(0xfff0dc, 2.8);
  key.position.copy(sun).multiplyScalar(100);
  key.layers.enableAll();
  scene.add(key);
  const hemi = new HemisphereLight(0x1c2a44, 0x5d7aa8, 0.5);
  hemi.layers.enableAll();
  scene.add(hemi);
  const obj = testBricks();
  scene.add(obj);
  const lens: Lens = { ...DEFAULT_LENS };
  return {
    duration: 10,
    renderAt(t) {
      camera.aspect = pipeline.width / pipeline.height;
      const a = t * 0.2;
      camera.position.set(Math.sin(a) * 18, 6, Math.cos(a) * 18);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      ui.setSubtitle('Obi-Wan Kenobi', 'Hello, there!');
      pipeline.render(scene, camera, lens, { time: t });
    },
    shots: () => [{ name: 'test', start: 0, end: 10 }],
    renderAudio: async () => '',
  };
}
