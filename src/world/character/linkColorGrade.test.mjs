/** Run: node src/world/character/linkColorGrade.test.mjs (Node 20+, no browser needed). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

// Transpile linkColorGrade.ts (dependency-free) in memory so the test runs without a bundler.
const here = path.dirname(fileURLToPath(import.meta.url));
const source = ts.transpileModule(readFileSync(path.join(here, 'linkColorGrade.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', source)(() => {
  throw new Error('linkColorGrade.ts must stay dependency-free');
}, mod, mod.exports);
const { LINK_COLOR_GRADE, REGION_GROUPS, BONE_REGION, rgbToHsl, hslToRgb, gradeTexel, gradeImage, rasterizeRegionMask } = mod.exports;

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const HEAD = REGION_GROUPS.indexOf('head') + 1;
const LEGS = REGION_GROUPS.indexOf('legs') + 1;
const hsl255 = (rgb) => rgbToHsl(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);

// 1. HSL round trip over a colour sweep
for (const [r, g, b] of [[191, 149, 119], [160, 114, 66], [72, 87, 55], [72, 49, 31], [10, 200, 250], [250, 10, 120], [128, 128, 128]]) {
  const [h, s, l] = rgbToHsl(r / 255, g / 255, b / 255);
  const back = hslToRgb(h, s, l).map((v) => v * 255);
  near(back[0], r, 0.51, 'hsl round trip r');
  near(back[1], g, 0.51, 'hsl round trip g');
  near(back[2], b, 0.51, 'hsl round trip b');
}

// 2. the table's ids, and the clusters the bands were cut on (texture space, sRGB 0..255)
assert.deepEqual(LINK_COLOR_GRADE.map((e) => e.id), ['skin', 'hair', 'tunic']);
const w = new Float32Array(LINK_COLOR_GRADE.length);
const grade = (rgb, region = 0) => gradeTexel(LINK_COLOR_GRADE, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, region, w).map((v) => Math.round(v * 255));

// skin peach → tan: hue +4, chroma ×1.9, a touch darker; full membership anywhere (no region)
{
  const src = [191, 149, 119];
  const out = grade(src, LEGS);
  near(w[0], 1, 1e-6, 'skin membership');
  assert.equal(w[1], 0, 'skin texel is not hair');
  const [h0, s0, l0] = hsl255(src);
  const [h1, s1, l1] = hsl255(out);
  near(h1 - h0, 4, 0.6, 'skin hue shift');
  near(s1 / s0, 1.9, 0.05, 'skin saturation factor');
  near(l1 / l0, 0.95, 0.01, 'skin lightness factor');
  assert.ok(out[0] > out[1] && out[1] > out[2], 'skin stays warm (r > g > b)');
}
// hair ochre on the head → golden; the same ochre on the legs (a boot knot) is left alone
{
  const src = [160, 114, 66];
  const head = grade(src, HEAD);
  near(w[1], 1, 1e-6, 'hair membership on the head');
  const [h0, s0, l0] = hsl255(src);
  const [h1, s1, l1] = hsl255(head);
  near(h1 - h0, 5, 0.8, 'hair hue shift');
  near(s1 / s0, 1.7, 0.06, 'hair saturation factor');
  near(l1 / l0, 1.28, 0.02, 'hair lightness factor');
  const legs = grade(src, LEGS);
  assert.deepEqual(legs, src, 'ochre on the legs is not graded');
  assert.equal(w[1], 0, 'no hair membership off the head');
  const none = grade(src, 0);
  assert.deepEqual(none, src, 'ochre with no region byte is not graded');
}
// tunic green → olive: hue −4, chroma ×1.6
{
  const src = [72, 87, 55];
  const out = grade(src, 0);
  near(w[2], 1, 1e-6, 'tunic membership');
  const [h0, s0] = hsl255(src);
  const [h1, s1] = hsl255(out);
  near(h1 - h0, -4, 0.8, 'tunic hue shift');
  near(s1 / s0, 1.6, 0.06, 'tunic saturation factor');
}
// leather, black padding and the eye white are outside every band
for (const src of [[72, 49, 31], [0, 0, 0], [3, 3, 3], [242, 237, 227]]) {
  assert.deepEqual(grade(src, HEAD), src, `untouched ${src}`);
  assert.equal(w[0] + w[1] + w[2], 0, `no membership ${src}`);
}
// the hair / skin overlap: a texel between the clusters is graded by a blend, never twice
{
  const src = hslToRgb(27.5, 0.4, 0.475).map((v) => Math.round(v * 255));
  const out = grade(src, HEAD);
  assert.ok(w[0] > 0 && w[0] < 1, `partial skin membership ${w[0]}`);
  assert.ok(w[1] > 0 && w[1] < 1, `partial hair membership ${w[1]}`);
  near(w[0] + w[1], 1, 0.35, 'memberships blend rather than stack');
  const [, s0] = hsl255(src);
  const [, s1] = hsl255(out);
  assert.ok(s1 / s0 > 1.4 && s1 / s0 < 2.0, `blended saturation factor ${s1 / s0}`);
}

// 3. gradeImage: an RGBA8 strip of the four clusters, with a mask that puts its left half on the head
{
  const size = 4;
  const mask = { data: new Uint8Array(size * size), size };
  for (let y = 0; y < size; y++) for (let x = 0; x < size / 2; x++) mask.data[y * size + x] = HEAD;
  const width = 8;
  const height = 2;
  const px = [[191, 149, 119], [160, 114, 66], [72, 87, 55], [72, 49, 31], [191, 149, 119], [160, 114, 66], [72, 87, 55], [72, 49, 31]];
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data.set([...px[x], 255], i);
  }
  const stats = gradeImage(data, width, height, LINK_COLOR_GRADE, mask);
  // skin ×2 rows ×2 columns, tunic likewise, hair only in the left (head) half
  assert.equal(stats.perEntry.skin, 4, 'skin texels');
  assert.equal(stats.perEntry.tunic, 4, 'tunic texels');
  assert.equal(stats.perEntry.hair, 2, 'hair texels (head half only)');
  assert.equal(stats.touched, 10, 'touched texels');
  const at = (x, y) => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 3)];
  assert.deepEqual(at(5, 0), [160, 114, 66], 'ochre off the head untouched');
  assert.notDeepEqual(at(1, 0), [160, 114, 66], 'ochre on the head graded');
  assert.deepEqual(at(3, 1), [72, 49, 31], 'leather untouched');
  assert.equal(data[3], 255, 'alpha untouched');
  assert.ok(stats.meanAfter.hair[0] > stats.meanBefore.hair[0], 'hair mean lighter after');
  // without a mask the region-bound entry is skipped
  const data2 = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data2.set([...px[x], 255], (y * width + x) * 4);
  const s2 = gradeImage(data2, width, height, LINK_COLOR_GRADE, null);
  assert.equal(s2.perEntry.hair, undefined, 'hair skipped without a mask');
  assert.equal(s2.touched, 8, 'skin + tunic only');
}

// 4. rasterizeRegionMask: two triangles, one on the head bones, one on the legs, painted by majority
{
  const joints = Object.keys(BONE_REGION);
  const jointRegion = new Uint8Array(joints.map((n) => REGION_GROUPS.indexOf(BONE_REGION[n]) + 1));
  const J = (n) => joints.indexOf(n);
  // vertices: 0-2 a head triangle over the top-left quarter, 3-5 a legs triangle over the bottom-right quarter
  const uv = [0, 0, 0.5, 0, 0, 0.5, 1, 1, 0.5, 1, 1, 0.5];
  const ji = [J('head'), 0, 0, 0, J('cap'), 0, 0, 0, J('head'), J('hips'), 0, 0, J('ankleL'), 0, 0, 0, J('toeL'), 0, 0, 0, J('kneeL'), 0, 0, 0];
  const jw = [1, 0, 0, 0, 1, 0, 0, 0, 0.6, 0.4, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  const index = [0, 1, 2, 3, 4, 5];
  const mask = rasterizeRegionMask(uv, ji, jw, index, jointRegion, 16);
  const at = (u, v) => mask.data[Math.floor(v * 16) * 16 + Math.floor(u * 16)];
  assert.equal(at(0.1, 0.1), HEAD, 'head triangle interior');
  assert.equal(at(0.9, 0.9), LEGS, 'legs triangle interior');
  assert.equal(at(0.9, 0.1), 0, 'empty corner');
  assert.equal(at(0.1, 0.9), 0, 'empty corner');
  // a triangle whose vertices' dominant joints have no region paints nothing
  const none = rasterizeRegionMask([0, 0, 1, 0, 0, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [0, 1, 2], new Uint8Array([0]), 8);
  assert.equal(none.data.reduce((a, b) => a + b, 0), 0, 'no region → nothing painted');
}

console.log('linkColorGrade.test: ok');
