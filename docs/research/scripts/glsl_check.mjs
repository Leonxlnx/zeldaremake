// Compile every GLSL snippet from the Spider-Verse report in a real WebGL2 context
// (headless Chrome + SwiftShader) and report compiler diagnostics.
import fs from "node:fs";
import puppeteer from "/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";

const REPORT = "/workspace/docs/research/SPIDERVERSE_STYLE.md";

// Pull every ```glsl fenced block out of the report, in order.
const md = fs.readFileSync(REPORT, "utf8");
const blocks = [...md.matchAll(/```glsl\n([\s\S]*?)```/g)].map((m) => m[1]);
if (!blocks.length) throw new Error("no glsl blocks found in report");
console.log(`found ${blocks.length} glsl blocks in the report`);

// Shared preamble supplying the uniforms / constants the snippets reference.
const PREAMBLE = `#version 300 es
precision highp float;
precision highp int;

#define BAND_COUNT 4
const int MODE_UV = 0, MODE_SCREEN = 1, MODE_AXIS = 2, MODE_TRIPLANAR = 3;

uniform float uBandPos[BAND_COUNT];
uniform float uTransWidth[BAND_COUNT];
uniform float uBandMul[BAND_COUNT + 1];

uniform vec2  uUVScale;
uniform vec2  uResolution;
uniform vec2  uTexel;
uniform bool  uUseRest;
uniform mat3  uAxisBasis;
uniform float uTriSharpness;
uniform vec3  uAxisScale;

uniform float uSoft;
uniform float uNormalQuantAmount;

uniform float uInkOffsetPx;
uniform vec3  uInkTint;

uniform float uFloorPx;
uniform float uDepthGain;
uniform vec2  uOffsetDir;

uniform float uTrailGain;
uniform float uTrailMaxPx;

uniform sampler2D uBeauty;
uniform sampler2D uPalette;

in vec2 vUv;
out vec4 fragColor;
`;

// A main() that touches every function so nothing is dead-stripped before validation.
const MAIN = `
void main() {
  vec2 q = hatcherCoord(MODE_TRIPLANAR, vec3(vUv, 1.0), vec3(vUv, 0.5),
                        normalize(vec3(vUv, 1.0)), vUv, vUv,
                        mat3(1.0), vec3(0.0));
  q = isotropiseCoord(q);
  float pitch = bifurcatedPitch(q, 8.0, 6.0, 24.0);
  float dots  = dotScreen(q, pitch, radians(45.0));
  float lines = lineScreen(q, pitch, radians(30.0));
  float xh    = crossHatch(q, pitch, radians(30.0), radians(105.0));
  float hm    = hatchMask(q, 0.5, pitch, radians(30.0), radians(105.0), true);
  float lum   = texture(uBeauty, vUv).g;
  float mult  = thresher(lum, dots);
  vec3  pal   = paletteShade(lum, uPalette, 0.5, 4.0);
  vec3  nq    = quantiseNormal(normalize(vec3(vUv, 1.0)), 4.0);
  vec3  ink   = inkEdge(pal, vUv, vec2(1.0, 0.0), 0.5);
  vec3  mis   = misregister(uBeauty, vUv, 3.0);
  vec3  mt    = motionTrail(uBeauty, vUv, vec2(0.01, 0.0));
  float ht    = heldTime(1.5, 2, 0, 24.0);
  fragColor = vec4((ink + mis + mt + pal + nq) * mult
                 + vec3(dots + lines + xh + hm + ht), 1.0);
}
`;

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const fragSource = PREAMBLE + "\n" + blocks.join("\n") + "\n" + MAIN;
fs.writeFileSync("/tmp/sv/combined.frag", fragSource);

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
  ],
});
const page = await browser.newPage();
page.on("console", (m) => console.log("  [page]", m.text()));

const result = await page.evaluate(
  ({ vert, frag, blockCount }) => {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return { ok: false, err: "no webgl2 context" };

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      const ok = gl.getShaderParameter(s, gl.COMPILE_STATUS);
      return { ok, log: gl.getShaderInfoLog(s) || "", shader: s };
    };

    const v = compile(gl.VERTEX_SHADER, vert);
    const f = compile(gl.FRAGMENT_SHADER, frag);
    if (!v.ok || !f.ok) {
      return { ok: false, vertLog: v.log, fragLog: f.log, blockCount };
    }
    const p = gl.createProgram();
    gl.attachShader(p, v.shader);
    gl.attachShader(p, f.shader);
    gl.linkProgram(p);
    const linked = gl.getProgramParameter(p, gl.LINK_STATUS);
    return {
      ok: linked,
      linkLog: gl.getProgramInfoLog(p) || "",
      vertLog: v.log,
      fragLog: f.log,
      renderer: gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      blockCount,
    };
  },
  { vert: VERT, frag: fragSource, blockCount: blocks.length }
);

console.log("\n=== WebGL2 shader validation ===");
console.log("renderer :", result.renderer);
console.log("GLSL     :", result.version);
console.log("blocks   :", result.blockCount, "glsl blocks concatenated");
if (result.vertLog?.trim()) console.log("vertex log:\n" + result.vertLog);
if (result.fragLog?.trim()) console.log("fragment log:\n" + result.fragLog);
if (result.linkLog?.trim()) console.log("link log:\n" + result.linkLog);
console.log(result.ok ? "\nRESULT: PASS - all snippets compile and link" : "\nRESULT: FAIL");

await browser.close();
process.exit(result.ok ? 0 : 1);
