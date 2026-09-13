/**
 * Falling leaves: one InstancedMesh of small curved leaf laminae tumbling down deterministic
 * paths from canopy height (9–16 m) to the ground over the plaza / north path (in view in shots
 * B and D). Each leaf's spawn point, fall speed, sway, tumble and colour come from
 * `ctx.rng.fork('leaves')`; the pose at time `t` is a closed-form function of `t`, so captures at a
 * fixed simulation time are identical. Leaves drift with the shared wind direction and respawn
 * at the canopy when they reach the terrain.
 */
import {
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { WorldContext } from '../system';

export interface FallingLeaves {
  mesh: InstancedMesh;
  count: number;
  update(t: number): void;
}

interface Leaf {
  x0: number;
  z0: number;
  spawnY: number;
  groundY: number;
  speed: number; // m/s
  cycle: number; // s
  phase: number; // s
  swayA: number;
  swayW: number;
  swayP: number;
  swayB: number;
  drift: number; // m/s along wind
  tumble: Vector3; // rad/s per axis
  tumbleP: Vector3;
  scale: number;
}

/** small curved lamina: pointed tip, folded midrib, slight curl toward the tip */
function leafGeometry(): BufferGeometry {
  const segsL = 6;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const L = 0.13;
  const W = 0.035;
  for (let i = 0; i <= segsL; i++) {
    const s = i / segsL;
    const x = (s - 0.5) * L;
    const halfW = W * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.05)), 0.75);
    const curl = 0.02 * (1 - Math.cos(Math.PI * s)) * 0.5;
    for (let j = 0; j < 3; j++) {
      const v = j - 1; // -1, 0, 1 across the leaf
      const y = curl + 0.008 * Math.abs(v); // fold along the midrib
      pos.push(x, y, v * halfW);
      uv.push(s, (v + 1) / 2);
    }
  }
  for (let i = 0; i < segsL; i++) {
    for (let j = 0; j < 2; j++) {
      const a = i * 3 + j;
      const b = a + 3;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createFallingLeaves(ctx: WorldContext, count = 96): FallingLeaves {
  const rng = ctx.rng.fork('leaves');
  const P = ctx.config.palette;
  const wind = ctx.wind.direction;
  const palette = [new Color(P.leafSun), new Color(P.leafCanopy), new Color(0xb08a3a), new Color(0x8a6a2a), new Color(0xc9a24a), new Color(0x6f7f2e)];

  const geometry = leafGeometry();
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.75,
    metalness: 0,
    side: DoubleSide,
    vertexColors: false,
  });
  material.name = 'falling-leaf';
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = 'falling-leaves';
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  // spawn zone: plaza + north path + house terrace (shots B and D look across it)
  const leaves: Leaf[] = [];
  for (let i = 0; i < count; i++) {
    const x0 = rng.range(-11, 13);
    const z0 = rng.range(-30, 5);
    const spawnY = ctx.terrain.height(x0, z0) + rng.range(9, 16);
    const speed = rng.range(0.55, 0.95);
    const drift = rng.range(0.12, 0.35) * ctx.wind.strength;
    const fall = spawnY - ctx.terrain.height(x0, z0);
    const cycle = fall / speed;
    // where the leaf lands (after drifting) — used to stop it at that ground height
    const lx = x0 + wind.x * drift * cycle;
    const lz = z0 + wind.y * drift * cycle;
    const groundY = Math.max(ctx.terrain.height(lx, lz), ctx.terrain.height(x0, z0)) + 0.02;
    leaves.push({
      x0,
      z0,
      spawnY,
      groundY,
      speed,
      cycle,
      phase: rng() * cycle,
      swayA: rng.range(0.25, 0.7),
      swayW: rng.range(0.9, 1.8),
      swayP: rng() * Math.PI * 2,
      swayB: rng.range(0.6, 1.3),
      drift,
      tumble: new Vector3(rng.range(1.2, 3.2), rng.range(0.6, 1.8), rng.range(1.5, 3.5)),
      tumbleP: new Vector3(rng() * 6.28, rng() * 6.28, rng() * 6.28),
      scale: rng.range(0.8, 1.35),
    });
    mesh.setColorAt(i, rng.pick(palette).clone().offsetHSL(rng.range(-0.02, 0.02), 0, rng.range(-0.06, 0.06)));
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  const m = new Matrix4();
  const q = new Quaternion();
  const pos = new Vector3();
  const scl = new Vector3();
  const euler = new Vector3();
  const qx = new Quaternion();
  const qy = new Quaternion();
  const qz = new Quaternion();
  const AX = new Vector3(1, 0, 0);
  const AY = new Vector3(0, 1, 0);
  const AZ = new Vector3(0, 0, 1);

  return {
    mesh,
    count,
    update(t) {
      for (let i = 0; i < count; i++) {
        const l = leaves[i];
        const local = (t + l.phase) % l.cycle;
        const y = Math.max(l.spawnY - local * l.speed, l.groundY);
        // sway: a figure-eight in the horizontal plane plus wind drift
        const sx = Math.sin(local * l.swayW + l.swayP) * l.swayA;
        const sz = Math.sin(local * l.swayW * 0.5 + l.swayP * 1.7) * l.swayA * l.swayB;
        pos.set(l.x0 + sx + wind.x * l.drift * local, y, l.z0 + sz + wind.y * l.drift * local);
        euler.set(l.tumbleP.x + local * l.tumble.x, l.tumbleP.y + local * l.tumble.y, l.tumbleP.z + local * l.tumble.z);
        qx.setFromAxisAngle(AX, euler.x);
        qy.setFromAxisAngle(AY, euler.y);
        qz.setFromAxisAngle(AZ, Math.sin(euler.z) * 0.9);
        q.copy(qy).multiply(qx).multiply(qz);
        // near the ground the leaf settles flat
        const settle = Math.min(1, Math.max(0, (y - l.groundY) / 0.4));
        scl.setScalar(l.scale);
        if (settle < 1) q.slerp(qy, 1 - settle);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
