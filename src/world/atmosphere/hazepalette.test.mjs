/**
 * The airlight palette has drifted cool twice (the 2026-09-16 daylight pass turned every veil
 * colour blue; the owner's 2026-09-23 screenshot circled the result). His own recording is the
 * arbiter: `reference/frames-dense/review46/r_020–r_028` measures its mist at display hue 25–50°
 * and B/R 0.85–0.94, and there is no blue sky in any frame of it.
 *
 * This locks the direction, not the exact numbers: any veil or dome colour may be retuned for
 * brightness, but none of them may go cool again without the reference changing.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadModule(url, requireImpl = () => ({})) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(
    readFileSync(url, 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText)(requireImpl, module, module.exports);
  return module.exports;
}

const fog = loadModule(new URL('./heightfog.ts', import.meta.url), (id) => {
  if (id === 'three') return { ShaderChunk: {} };
  if (id === '../lighting/sun') return { sunDirection: () => ({ x: 0, y: 0, z: 0 }) };
  throw new Error(`unexpected import ${id}`);
});
const { HEIGHT_FOG_DEFAULTS: P } = fog;

/** display sRGB of a scene-linear colour after the composer's ACES at exposure 1 */
function display(linear) {
  const aces = (x) => {
    const v = x / 0.6;
    return Math.min(1, Math.max(0, (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081)));
  };
  const srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  return linear.map((c) => srgb(aces(c)));
}

function hueDeg([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** the veils a walker sees, and the dome's canopy-gap glare the owner circled as a blue streak */
const AIRLIGHT = {
  hazeNear: P.hazeNear,
  hazeFar: P.hazeFar,
  hazeClosed: P.hazeClosed,
  hazeClosedFar: P.hazeClosedFar,
  hazeLit: P.hazeLit,
  hazeFarLit: P.hazeFarLit,
  hazeNearField: P.hazeNearField,
  mistColor: P.mistColor,
  hazeHot: P.hazeHot,
};

test('every airlight colour is warm, as the owner’s recording measures it', () => {
  const sky = loadModule(new URL('./sky.ts', import.meta.url), (id) => {
    if (id === 'three') {
      const stub = class {};
      return { BackSide: 1, Color: stub, Mesh: stub, ShaderMaterial: stub, SphereGeometry: stub, Vector2: stub, Vector3: stub };
    }
    if (id === './heightfog') return fog;
    throw new Error(`unexpected import ${id}`);
  });
  for (const [name, linear] of Object.entries({ ...AIRLIGHT, SKY_GAP_GLARE: sky.SKY_GAP_GLARE })) {
    const d = display(linear);
    const hue = hueDeg(d);
    const br = d[2] / d[0];
    assert.ok(br <= 0.96, `${name} display B/R ${br.toFixed(3)} — the recording's air is 0.85–0.94, never blue`);
    assert.ok(hue >= 20 && hue <= 70, `${name} display hue ${hue.toFixed(1)}° — the recording's air is 25–50°`);
  }
});

test('the veil deepens with distance on both the open and the closed side', () => {
  const lum = (linear) => {
    const d = display(linear);
    return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
  };
  // the far air must be lighter than the near air, or distance reads as a grey ceiling instead of
  // mist — this is what the owner saw looking north, where the closed side had no grade at all
  assert.ok(lum(P.hazeFar) > lum(P.hazeNear) + 0.05, 'hazeFar must sit clearly over hazeNear');
  assert.ok(lum(P.hazeClosedFar) > lum(P.hazeClosed) + 0.05, 'hazeClosedFar must sit clearly over hazeClosed');
  assert.ok(P.hazeGradeNear < P.hazeGradeFar, 'the colour grade must run near → far');
  // the wall has to arrive while the walk can still see trees in front of it
  assert.ok(P.hazeFarStart >= 25 && P.hazeFarStart <= 45, `hazeFarStart ${P.hazeFarStart} m`);
  assert.ok(P.hazeFarDensity > P.hazeDensity, 'the far air must be thicker than the near air');
});

test('the shader carries the closed roof’s far colour', () => {
  const chunk = { ShaderChunk: {} };
  const mod = loadModule(new URL('./heightfog.ts', import.meta.url), (id) => {
    if (id === 'three') return chunk;
    if (id === '../lighting/sun') return { sunDirection: () => ({ x: 0.5, y: 0.6, z: -0.6 }) };
    throw new Error(`unexpected import ${id}`);
  });
  mod.installHeightFog({ fog: { near: 28, far: 190 }, sun: { azimuthDeg: -128, elevationDeg: 38 } });
  const src = Object.values(chunk.ShaderChunk).join('\n');
  assert.match(src, /KF_HAZE_CLOSED_FAR/, 'the closed roof’s far colour must reach the fog chunk');
  assert.match(src, /mix\( KF_HAZE_CLOSED, KF_HAZE_CLOSED_FAR, grade \)/, 'the closed veil must grade with distance');
});
