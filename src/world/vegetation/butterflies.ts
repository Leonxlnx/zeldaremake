/**
 * Butterflies over the flower verges (squad backlog item 5, the owner: "falling leaves, fireflies,
 * butterflies — gentle life in the air, not spectacle"). Falling leaves and drifting motes already
 * exist (`atmosphere/leaves.ts`, `motes.ts`); this is the third.
 *
 * They belong to this system rather than to the atmosphere because they are anchored to the
 * violet clumps the verge passes seat (`plants.ts`): each butterfly wanders a slow closed loop
 * around one flower clump, so where the flowers gather, so do they, and a verge with no flowers
 * has none. The whole set is ONE InstancedMesh of four triangles a butterfly — two wings, two
 * sides — with the flap done in the vertex shader from `uTime` and a per-instance phase, so the
 * CPU only writes a matrix per butterfly per frame and the draw cost is a rounding error.
 *
 * Deterministic like the leaves: every anchor, radius, period and phase comes from
 * `ctx.rng.fork('butterflies')`, and the pose at time `t` is a closed-form function of `t`, so a
 * capture at a fixed simulation time is identical run to run.
 */
import { BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Euler, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { WorldContext } from '../system';

export interface Butterflies {
  mesh: InstancedMesh;
  count: number;
  /** flower clumps that got one (audit) */
  anchors: number;
  update(t: number): void;
  dispose(): void;
}

/** one butterfly: a loop around its flower clump, with a rest on the flowers at the loop's end */
interface Flier {
  ax: number;
  az: number;
  groundY: number;
  /** loop radii (m) and its period (s) */
  rx: number;
  rz: number;
  period: number;
  phase: number;
  /** cruise height over the ground (m) and its bob */
  hi: number;
  bob: number;
  /** share of the loop spent settled on the flowers */
  restShare: number;
  scale: number;
  flapHz: number;
  /** the loop's turn, so they do not all orbit the same way */
  spin: number;
}

/**
 * Two wings meeting at the body, each a rounded triangle. `aSide` is −1 / +1 (which wing) and
 * `aHinge` 0 at the body and 1 at the wing tip, so the shader can fold them about the body axis.
 */
function butterflyGeometry(): BufferGeometry {
  const pos: number[] = [];
  const side: number[] = [];
  const hinge: number[] = [];
  const idx: number[] = [];
  // the outline of one wing in the wing plane: along the body (x) and out from it (z)
  // A real butterfly is a 5-8 cm wingspan, which at the 5-12 m a walker sees the verge from is a
  // couple of pixels: the first build measured 24 changed pixels in a whole 960x540 frame. These
  // are drawn at roughly twice life size (~14 cm across the pair) — the same exaggeration the
  // reference's leaves and pods use — so one reads as a butterfly at the distance he walks past.
  const K = 2.4;
  const wing: [number, number][] = ([
    [0.004, 0],
    [0.03, 0.006],
    [0.028, 0.03],
    [0.004, 0.038],
    [-0.016, 0.03],
    [-0.024, 0.008],
    [-0.006, 0],
  ] as [number, number][]).map(([x, z]) => [x * K, z * K] as [number, number]);
  for (const s of [-1, 1]) {
    const base = pos.length / 3;
    // a fan from the body root out to the outline
    pos.push(0, 0, 0);
    side.push(s);
    hinge.push(0);
    for (const [x, z] of wing) {
      pos.push(x, 0, z * s);
      side.push(s);
      hinge.push(Math.min(1, z / (0.038 * K)));
    }
    for (let i = 1; i < wing.length; i++) {
      if (s < 0) idx.push(base, base + i, base + i + 1);
      else idx.push(base, base + i + 1, base + i);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aSide', new Float32BufferAttribute(side, 1));
  g.setAttribute('aHinge', new Float32BufferAttribute(hinge, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** pale forest colours — nothing saturated; a butterfly should be noticed, not looked at */
const WING_COLOURS = [0xf0e2b4, 0xe8d79a, 0xf3ece0, 0xd9c98a, 0xe0b98a, 0xf0dcc4];

export function createButterflies(ctx: WorldContext, clumps: readonly { x: number; z: number }[], count = 34): Butterflies {
  const rng = ctx.rng.fork('butterflies');
  const geometry = butterflyGeometry();
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0, side: DoubleSide });
  material.name = 'butterfly-wing';
  const uTime = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSide;\nattribute float aHinge;\nattribute float aFlap;\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  // the flap: each wing folds up about the body axis, the fold growing toward the tip. The rest
  // angle is open (a butterfly at rest holds its wings up, not flat), so the loop never reads as a
  // flat card spinning.
  float flap = 0.55 + 0.75 * ( 0.5 + 0.5 * sin( uTime * aFlap ) );
  float c = cos( flap * aHinge );
  float s = sin( flap * aHinge );
  transformed.y += abs( transformed.z ) * s;
  transformed.z *= c;`,
      );
  };

  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = 'butterflies';
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  const flap = new Float32Array(count);
  const fliers: Flier[] = [];
  // one butterfly per clump, clumps picked at random without repeats; if there are fewer clumps
  // than butterflies the extra ones share (they will not collide — their loops and phases differ)
  const picked = new Set<number>();
  const colour = new Color();
  for (let i = 0; i < count; i++) {
    let c = -1;
    for (let tries = 0; tries < 24 && clumps.length; tries++) {
      const k = rng.int(0, clumps.length);
      if (picked.size >= clumps.length || !picked.has(k)) {
        c = k;
        picked.add(k);
        break;
      }
    }
    const ax = c >= 0 ? clumps[c].x : rng.range(-10, 10);
    const az = c >= 0 ? clumps[c].z : rng.range(-20, 6);
    const groundY = ctx.terrain.height(ax, az);
    fliers.push({
      ax,
      az,
      groundY,
      rx: rng.range(0.35, 1.1),
      rz: rng.range(0.35, 1.1),
      period: rng.range(7, 14),
      phase: rng() * 100,
      hi: rng.range(0.32, 0.85),
      bob: rng.range(0.06, 0.2),
      restShare: rng.range(0.12, 0.3),
      scale: rng.range(0.85, 1.3),
      flapHz: rng.range(7, 12),
      spin: rng() < 0.5 ? -1 : 1,
    });
    flap[i] = fliers[i].flapHz;
    mesh.setColorAt(i, colour.setHex(WING_COLOURS[rng.int(0, WING_COLOURS.length)]).offsetHSL(0, rng.range(-0.05, 0.05), rng.range(-0.05, 0.05)));
  }
  geometry.setAttribute('aFlap', new InstancedBufferAttribute(flap, 1));
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const p = new Vector3();
  const scl = new Vector3();

  return {
    mesh,
    count,
    anchors: picked.size,
    update(t) {
      uTime.value = t;
      for (let i = 0; i < count; i++) {
        const f = fliers[i];
        const u = (((t + f.phase) / f.period) % 1 + 1) % 1;
        // the loop: a slow ellipse about the clump, flattened into a rest at its end — over the
        // rest share the butterfly sits on the flowers (no radius, no height, no heading change)
        const fly = Math.min(1, u / (1 - f.restShare));
        const rest = 1 - Math.min(1, (1 - u) / Math.max(1e-3, f.restShare));
        const a = fly * Math.PI * 2 * f.spin;
        const ease = fly < 0.08 ? fly / 0.08 : fly > 0.92 ? (1 - fly) / 0.08 : 1;
        const r = ease * (1 - rest);
        p.set(f.ax + Math.cos(a) * f.rx * r, f.groundY + 0.06 + (f.hi + Math.sin(a * 2) * f.bob) * r, f.az + Math.sin(a) * f.rz * r);
        // face along the loop's tangent, nose down a little while climbing out of the rest
        e.set(0, -a + Math.PI / 2 + (f.spin < 0 ? Math.PI : 0), 0.25 * Math.sin(a * 2) * r);
        q.setFromEuler(e);
        scl.setScalar(f.scale);
        m.compose(p, q, scl);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
