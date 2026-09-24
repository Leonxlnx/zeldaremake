/**
 * Round 57 (expansion-ruins): the green motes the reference's ruins shot has drifting low over the
 * water (r_036–r_038: a few soft green glows by the pool on the left and toward the fall on the
 * right). Sixteen of them — over the pool, in the fall's mist, under the parapet and in the shade on
 * the terrace behind the arch — each wandering a slow three-axis figure about its home and breathing
 * brighter and dimmer; one camera-facing quad each, one draw, all of it a function of the time
 * uniform. No light: the core sits just over the bloom's 1.0 threshold, so each blooms a little and
 * none reads white.
 */
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Sphere, Uint32BufferAttribute, Vector3, type WebGLProgramParametersWithUniforms } from 'three';
import { EXPANSION_RUINS } from '../layout';
import type { Rng } from '../util/prng';

const R = EXPANSION_RUINS;

export interface RuinsWisps {
  mesh: Mesh;
  material: MeshBasicMaterial;
  count: number;
  update(t: number): void;
}

export function buildWisps(rng: Rng): RuinsWisps {
  const Q = R.pool;
  const F = R.fall;
  const T = R.terrace;
  const homes: [number, number, number][] = [];
  const zone = (n: number, x: [number, number], y: [number, number], z: [number, number]) => {
    for (let i = 0; i < n; i++) homes.push([rng.range(x[0], x[1]), rng.range(y[0], y[1]), rng.range(z[0], z[1])]);
  };
  // (each wanders ≤ 0.7 m about its home: the homes keep that far off the wall, the columns and the fall's sheet)
  zone(7, [Q.x - 5, Q.x + 6], [Q.water + 0.5, Q.water + 2.2], [Q.z - 2.6, Q.z + 3.2]);
  zone(4, [F.x + 1.4, F.x + 3.4], [Q.water + 0.8, Q.water + 3.4], [F.z - 1.6, F.z + 2.4]);
  zone(3, [R.arch.x - 5.5, R.arch.x - 1.2], [T.y + 0.7, T.y + 2], [T.z0 + 1.8, R.arch.z - 0.8]);
  zone(2, [R.parapet.x1 + 1, R.parapet.x0 - 1], [Q.water + 1.5, Q.water + 2.6], [R.wall.z + 2.1, R.wall.z + 3.3]);

  const pos: number[] = [];
  const corner: number[] = [];
  const motion: number[] = [];
  const phase: number[] = [];
  const idx: number[] = [];
  for (const h of homes) {
    const base = pos.length / 3;
    // amplitudes (m) and angular rates (rad/s) of the wander; phases, the breath's rate and the size
    const m = [rng.range(0.25, 0.7), rng.range(0.12, 0.35), rng.range(0.25, 0.7), rng.range(0.12, 0.3)];
    const p = [rng.range(0, 6.283), rng.range(0, 6.283), rng.range(0, 6.283), rng.range(0.5, 1.4)];
    const size = rng.range(0.16, 0.22);
    for (const [cx, cy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      pos.push(h[0], h[1], h[2]);
      corner.push(cx * size, cy * size);
      motion.push(...m);
      phase.push(...p);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aCorner', new Float32BufferAttribute(corner, 2));
  g.setAttribute('aMotion', new Float32BufferAttribute(motion, 4));
  g.setAttribute('aPhase', new Float32BufferAttribute(phase, 4));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const bs = g.boundingSphere as Sphere;
  g.boundingSphere = new Sphere(bs.center.clone(), bs.radius + 1);

  const time = { value: 0 };
  const material = new MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
  material.name = 'ruins-wisps';
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; attribute vec2 aCorner; attribute vec4 aMotion; attribute vec4 aPhase; varying vec2 vWCorner; varying float vWBreath;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        float wT = uTime;
        vec3 wC = position + vec3(
          aMotion.x * sin(wT * aMotion.w * 1.7 + aPhase.x),
          aMotion.y * sin(wT * aMotion.w * 1.3 + aPhase.y) + 0.5 * aMotion.y * sin(wT * aMotion.w * 3.1 + aPhase.z),
          aMotion.z * sin(wT * aMotion.w * 1.1 + aPhase.z));
        vec4 mvPosition = modelViewMatrix * vec4(wC, 1.0);
        mvPosition.xy += aCorner;
        gl_Position = projectionMatrix * mvPosition;
        float wB = 0.5 + 0.5 * sin(wT * aPhase.w + aPhase.x * 2.0);
        vWBreath = 0.45 + 0.55 * wB * wB;
        vWCorner = sign(aCorner);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWCorner; varying float vWBreath;')
      .replace(
        '#include <alphamap_fragment>',
        /* glsl */ `
        {
          float r2 = dot(vWCorner, vWCorner);
          float core = exp(-r2 * 16.0);
          float halo = exp(-r2 * 3.5) * 0.3;
          diffuseColor = vec4(vec3(0.3, 1.28, 0.5) * (core + halo * 0.4) / max(core + halo, 1e-3), min(1.0, core + halo) * vWBreath);
        }`,
      );
  };
  material.customProgramCacheKey = () => 'ruins-wisps-v1';
  const mesh = new Mesh(g, material);
  mesh.name = 'ruins-wisps';
  mesh.renderOrder = 4;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return {
    mesh,
    material,
    count: homes.length,
    update(t: number) {
      time.value = t % 3600;
    },
  };
}
