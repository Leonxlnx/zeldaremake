/** Original post-only seed membrane. Borrowed material maps remain owned by the shared library. */
import {
  ClampToEdgeWrapping, Color, DataTexture, LinearFilter, LinearMipmapLinearFilter,
  RepeatWrapping, SRGBColorSpace, type MeshStandardMaterial,
} from 'three';

const SIZE = 256;
const BODY_V = 0.80;
const DARK_V = 0.85;
type Point = readonly [number, number];

/** Fixed original vein paths: no world RNG or image assets. Coordinates are periodic in U. */
function membraneVeins() {
  const veins = new Float32Array(SIZE * SIZE);
  const stamp = (a: Point, b: Point, radius: number, strength: number) => {
    const ax = a[0] * SIZE, ay = a[1] * BODY_V * SIZE;
    const bx = b[0] * SIZE, by = b[1] * BODY_V * SIZE;
    const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
    const margin = radius + 0.7;
    for (let y = Math.max(0, Math.floor(Math.min(ay, by) - margin)); y <= Math.min(SIZE - 1, Math.ceil(Math.max(ay, by) + margin)); y++) {
      for (let x = Math.floor(Math.min(ax, bx) - margin); x <= Math.ceil(Math.max(ax, bx) + margin); x++) {
        const t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / length2));
        const distance = Math.hypot(x + 0.5 - ax - t * dx, y + 0.5 - ay - t * dy);
        const coverage = Math.max(0, Math.min(1, (radius + 0.7 - distance) / 1.0));
        const i = y * SIZE + ((x % SIZE) + SIZE) % SIZE;
        veins[i] = Math.max(veins[i], coverage * strength);
      }
    }
  };
  const trace = (point: (t: number) => Point, radius: number, strength: number, segments: number) => {
    for (let j = 0; j < segments; j++) {
      const t = (j + 0.5) / segments;
      stamp(point(j / segments), point((j + 1) / segments), radius * (0.55 + 0.45 * Math.sin(Math.PI * t)), strength);
    }
  };
  // Unequal panels and curved forks avoid the old nine evenly spaced orange stripes.
  const roots = [0.025, 0.173, 0.306, 0.487, 0.638, 0.773, 0.928];
  for (let i = 0; i < roots.length; i++) {
    const phase = i * 2.37;
    const primary = (t: number): Point => [roots[i] + 0.029 * Math.sin(Math.PI * t) * Math.sin(phase + t * 3.8), 0.035 + t * 0.965];
    trace(primary, 0.95, 0.90, 42);
    for (let j = 0; j < 3; j++) {
      const start = 0.17 + j * 0.235 + 0.04 * Math.sin(phase + j * 1.6);
      const rise = 0.18 + 0.045 * Math.sin(phase * 0.7 + j * 2.1);
      const side = (i + j) % 2 ? 1 : -1;
      const origin = primary(start);
      const fork = (t: number): Point => [origin[0] + side * (0.045 + 0.019 * Math.sin(phase + j)) * Math.sin(t * Math.PI * 0.5)
        + 0.009 * Math.sin(Math.PI * t) * Math.sin(phase + j), origin[1] + rise * t];
      trace(fork, 0.66, 0.64, 18);
      if ((i + j) % 2 === 0) {
        const branch = fork(0.55);
        trace(t => [branch[0] - side * 0.027 * t, branch[1] + 0.105 * t + 0.018 * Math.sin(Math.PI * t)], 0.42, 0.34, 10);
      }
    }
  }
  return veins;
}

function membraneTexture(glow: number) {
  const pixels = new Uint8Array(SIZE * SIZE * 4), veins = membraneVeins();
  const base = new Color(glow);
  // Same warm bottom-to-neck envelope as the shared atlas; source bytes are never changed.
  const bottom = [Math.min(1, base.r * 1.02), Math.min(1, base.g * 1.12), Math.min(1, base.b * 1.3)];
  const top = [base.r * 0.86, base.g * 0.5, base.b * 0.35];
  const transmission = new Float32Array(SIZE);
  for (let y = 0; y < SIZE; y++) {
    const v = (y + 0.5) / SIZE;
    let sum = 0;
    for (let x = 0; x < SIZE; x++) {
      const u = (x + 0.5) / SIZE, q = v / BODY_V;
      const cell = 0.5 + 0.25 * Math.sin(2 * Math.PI * u * 3 + q * 7.1)
        + 0.25 * Math.sin(2 * Math.PI * u * 5 - q * 10.3 + 0.4 * Math.sin(q * 8));
      // Absorption by thicker membrane/veins, not painted highlights or extra emission layers.
      const value = 1 - 0.28 * veins[y * SIZE + x] - 0.07 * cell;
      transmission[x] = value; sum += value;
    }
    // Match the old stripe multiplier's 0.9 row mean in encoded texture space.
    const rowScale = 0.9 * SIZE / sum;
    const heat = Math.pow(Math.max(0, 1 - v / DARK_V), 1.4);
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      if (v < DARK_V) {
        for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(255 * Math.min(1,
          (top[c] + (bottom[c] - top[c]) * heat) * transmission[x] * rowScale));
      }
      pixels[i + 3] = 255;
    }
  }
  const atlas = new DataTexture(pixels, SIZE, SIZE);
  atlas.name = 'structures:post-pod-membrane';
  atlas.colorSpace = SRGBColorSpace;
  atlas.wrapS = RepeatWrapping;
  atlas.wrapT = ClampToEdgeWrapping;
  atlas.minFilter = LinearMipmapLinearFilter;
  atlas.magFilter = LinearFilter;
  atlas.generateMipmaps = true;
  atlas.anisotropy = 4;
  // Data rows grow with V, unlike the old top-to-bottom canvas.
  atlas.flipY = false;
  atlas.needsUpdate = true;
  return atlas;
}

/** Shared by exactly the two orange post pods; dispose only this clone and its original atlas. */
export function createPostPodMaterial(shared: MeshStandardMaterial, glow: number) {
  const material = shared.clone(), atlas = membraneTexture(glow);
  material.name = 'structures:post-pod';
  material.emissiveMap = atlas;
  const sharedHook = shared.onBeforeCompile, sharedKey = shared.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    sharedHook.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
#include <emissivemap_fragment>
#ifdef USE_EMISSIVEMAP
  // Non-body parts use constant UV (.5, .95). Even coarse mips must not light their bindings.
  // The body ends at v=.80, so its existing gradient passes without loss at any distance.
  totalEmissiveRadiance *= 1.0 - smoothstep(0.80, 0.85, vEmissiveMapUv.y);
#endif
`);
  };
  material.customProgramCacheKey = () => `${sharedKey}|post-pod-membrane-v1`;
  let disposed = false;
  return {
    material,
    dispose() {
      if (disposed) return;
      disposed = true;
      material.dispose();
      atlas.dispose();
    },
  };
}
