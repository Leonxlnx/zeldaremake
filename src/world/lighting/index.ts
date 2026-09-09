/**
 * Lighting system — owner: atmosphere/lighting agent.
 * Sun (directional + cascaded-ish shadow window following the camera), sky hemisphere.
 * Values start from WORLD.sun and must be matched against the reference before "improving".
 */
import { DirectionalLight, HemisphereLight, Group, Vector3, Object3D } from 'three';
import type { WorldContext, WorldSystem } from '../system';

export function sunDirection(azimuthDeg: number, elevationDeg: number, out = new Vector3()): Vector3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  // direction FROM the sun toward the world origin is -out; `out` points at the sun
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
}

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'lighting';
  const s = ctx.config.sun;

  const sun = new DirectionalLight(s.color, s.intensity);
  const dir = sunDirection(s.azimuthDeg, s.elevationDeg);
  sun.position.copy(dir).multiplyScalar(120);
  sun.castShadow = ctx.quality.shadows;
  sun.shadow.mapSize.set(s.shadowMapSize, s.shadowMapSize);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 320;
  sun.shadow.camera.left = -s.shadowRadius;
  sun.shadow.camera.right = s.shadowRadius;
  sun.shadow.camera.top = s.shadowRadius;
  sun.shadow.camera.bottom = -s.shadowRadius;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2.5;
  const target = new Object3D();
  group.add(target);
  sun.target = target;
  group.add(sun);
  ctx.sun = sun;

  const hemi = new HemisphereLight(ctx.config.sky.hemiSky, ctx.config.sky.hemiGround, ctx.config.sky.hemiIntensity);
  group.add(hemi);

  ctx.audit('lighting', () => ({
    sunAzimuthDeg: s.azimuthDeg,
    sunElevationDeg: s.elevationDeg,
    sunIntensity: sun.intensity,
    shadows: sun.castShadow,
    shadowMapSize: sun.shadow.mapSize.x,
    hemiIntensity: hemi.intensity,
  }));

  const camPos = new Vector3();
  return {
    name: 'lighting',
    group,
    update(_dt, _t, c) {
      // shadow window follows the camera, snapped to texel-ish steps to avoid shimmering
      c.camera.getWorldPosition(camPos);
      const snap = 2;
      const tx = Math.round(camPos.x / snap) * snap;
      const tz = Math.round(camPos.z / snap) * snap;
      target.position.set(tx, c.terrain.height(tx, tz), tz);
      sun.position.copy(target.position).addScaledVector(dir, 120);
    },
  };
}
