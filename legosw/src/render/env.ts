import {
  BackSide,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from 'three';

/**
 * Image-based lighting for glossy ABS. Space has almost nothing to reflect, which makes plastic
 * look dead, so this is a "virtual studio" consistent with the shot: a sun softbox, planet-shine
 * from below, a cool rim panel and a few strip lights that draw long highlights along studs and
 * slopes — the look of a lit LEGO product shot, placed where the real light sources are.
 */
export interface Panel {
  dir: [number, number, number];
  color: number;
  power: number;
  w: number;
  h: number;
}
export interface EnvSpec {
  top: number;
  horizon: number;
  bottom: number;
  bottomPower?: number;
  panels: Panel[];
}

export function makeEnvironment(renderer: WebGLRenderer, spec: EnvSpec): Texture {
  const scene = new Scene();
  const sky = new Mesh(
    new SphereGeometry(100, 48, 24),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new Color(spec.top) },
        horizon: { value: new Color(spec.horizon) },
        bottom: { value: new Color(spec.bottom).multiplyScalar(spec.bottomPower ?? 1) },
      },
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top, horizon, bottom; varying vec3 vDir;
        void main(){
          float y = vDir.y;
          vec3 c = y > 0.0 ? mix(horizon, top, pow(clamp(y,0.0,1.0), 0.6)) : mix(horizon, bottom, pow(clamp(-y,0.0,1.0), 0.45));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(sky);
  for (const p of spec.panels) {
    const m = new Mesh(new PlaneGeometry(p.w, p.h), new MeshBasicMaterial({ color: new Color(p.color).multiplyScalar(p.power), side: DoubleSide }));
    const d = new Vector3(...p.dir).normalize();
    m.position.copy(d.clone().multiplyScalar(60));
    m.lookAt(0, 0, 0);
    scene.add(m);
  }
  const pmrem = new PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02, 0.1, 200);
  pmrem.dispose();
  return rt.texture;
}

export const SPACE_ENV = (sun: [number, number, number]): EnvSpec => ({
  top: 0x04070f,
  horizon: 0x1a2a44,
  bottom: 0x5b7aa6,
  bottomPower: 0.9,
  panels: [
    { dir: sun, color: 0xfff1dc, power: 9, w: 26, h: 18 },
    { dir: [-sun[0], 0.25, -sun[2]], color: 0x9fc4ff, power: 1.6, w: 40, h: 12 },
    { dir: [sun[2], 0.7, -sun[0]], color: 0xdce8ff, power: 1.3, w: 70, h: 5 },
    { dir: [-sun[2], 0.55, sun[0]], color: 0xdce8ff, power: 1.0, w: 60, h: 4 },
    { dir: [0.2, -1, 0.1], color: 0x88a8d8, power: 1.2, w: 90, h: 90 },
  ],
});

/**
 * The hangar bay (it is only seen from inside once its ray shield is down): the mouth is open space, so
 * the glossy deck mirrors near-black there instead of a blue wall, and the long highlights it carries
 * come from the gantry strips overhead and the lit office windows along both catwalks.
 */
export const HANGAR_OPEN_ENV: EnvSpec = {
  top: 0x201e1c,
  horizon: 0x2c2926,
  bottom: 0x131211,
  panels: [
    { dir: [0, 1, 0], color: 0xfff0d8, power: 4, w: 80, h: 6 },
    { dir: [0.35, 1, 0.3], color: 0xfff0d8, power: 3.5, w: 80, h: 5 },
    { dir: [-0.35, 1, -0.3], color: 0xfff0d8, power: 3.5, w: 80, h: 5 },
    { dir: [0, 0.1, 1], color: 0x0c1322, power: 1, w: 80, h: 34 },
    { dir: [1, 0.3, 0], color: 0xffd9a0, power: 1.6, w: 110, h: 5 },
    { dir: [-1, 0.3, 0], color: 0xffd9a0, power: 1.6, w: 110, h: 5 },
    { dir: [0, 0.35, -1], color: 0xffd9a0, power: 1.2, w: 90, h: 5 },
    { dir: [-1, 0.3, -0.2], color: 0xff7a3a, power: 1.4, w: 20, h: 10 },
  ],
};

export const STUDIO_ENV: EnvSpec = {
  top: 0x2c3340,
  horizon: 0x3a4250,
  bottom: 0x1a1d22,
  panels: [
    { dir: [0.6, 0.7, 0.8], color: 0xfff4e6, power: 7, w: 30, h: 22 },
    { dir: [-0.9, 0.3, 0.2], color: 0xbfd6ff, power: 2.2, w: 30, h: 30 },
    { dir: [0, 0.5, -1], color: 0xffffff, power: 3, w: 60, h: 8 },
    { dir: [0, 1, 0], color: 0xffffff, power: 1.5, w: 60, h: 60 },
  ],
};
