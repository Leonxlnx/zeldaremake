/**
 * Atmosphere system — owner: atmosphere/lighting agent.
 * Sky dome, layered distance haze, ground mist, god rays, falling leaves, fireflies, fairy orb.
 * This starter only provides fog + a gradient sky so the scaffold renders.
 */
import { BackSide, Color, Fog, Group, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import type { WorldContext, WorldSystem } from '../system';

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'atmosphere';
  const cfg = ctx.config;

  ctx.scene.fog = new Fog(cfg.fog.color, cfg.fog.near, cfg.fog.far);
  ctx.scene.background = new Color(cfg.sky.horizon);

  const skyMat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new Color(cfg.sky.zenith) },
      uHorizon: { value: new Color(cfg.sky.horizon) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith; uniform vec3 uHorizon; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 c = mix(uHorizon, uZenith, pow(h, 0.55));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const sky = new Mesh(new SphereGeometry(800, 32, 16), skyMat);
  sky.name = 'sky';
  group.add(sky);

  ctx.audit('atmosphere', () => ({
    fogNear: (ctx.scene.fog as Fog).near,
    fogFar: (ctx.scene.fog as Fog).far,
    godRays: false,
    groundMist: false,
    fallingLeaves: 0,
    fireflies: 0,
    fairy: false,
  }));

  return {
    name: 'atmosphere',
    group,
    update(_dt, _t, c) {
      sky.position.copy(c.camera.position);
    },
  };
}
