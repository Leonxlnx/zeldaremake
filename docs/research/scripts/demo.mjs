// Staged demonstration of the report's pipeline, using the GLSL functions taken
// verbatim from the report and the parameters measured in Appendix A.
// Four panels show the Appendix D ordering, one stage at a time.
import fs from "node:fs";
import puppeteer from "/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";

const md = fs.readFileSync("/workspace/docs/research/SPIDERVERSE_STYLE.md", "utf8");
const blocks = [...md.matchAll(/```glsl\n([\s\S]*?)```/g)].map((m) => m[1]);
console.log(`extracted ${blocks.length} glsl blocks from the report`);

const W = 1400, H = 586;           // 2.39:1 -> picture height 586 px
const PITCH = (8.0 * H) / 803;     // measured 8.0 px at 803 px picture height

const COMMON = `#version 300 es
precision highp float;
#define BAND_COUNT 4
const int MODE_UV = 0, MODE_SCREEN = 1, MODE_AXIS = 2, MODE_TRIPLANAR = 3;
uniform float uBandPos[BAND_COUNT]; uniform float uTransWidth[BAND_COUNT];
uniform float uBandMul[BAND_COUNT + 1];
uniform vec2 uUVScale, uResolution, uTexel, uOffsetDir;
uniform bool uUseRest; uniform mat3 uAxisBasis; uniform float uTriSharpness;
uniform vec3 uAxisScale; uniform float uSoft, uNormalQuantAmount;
uniform float uInkOffsetPx; uniform vec3 uInkTint;
uniform float uFloorPx, uDepthGain, uTrailGain, uTrailMaxPx;
uniform sampler2D uBeauty, uPalette;
uniform float uPitch; uniform int uStage;
in vec2 vUv; out vec4 fragColor;

${blocks.join("\n")}
`;

// --- pass 1: synthetic scene + optional Thresher/Hatcher, by stage
const FRAG_SCENE = COMMON + `
// A deliberately simple scene: one sphere plus a ground plane and a sky gradient,
// chosen so the tonal gradients are smooth and the operators are unambiguous.
void main() {
  vec2 uv = vUv;
  vec2 p = (uv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3(p * 0.55, -1.0));

  vec3 alb; vec3 N; float depth; bool isSky = false;
  vec3 sc = vec3(-0.35, 0.02, 0.0); float sr = 0.80;
  vec3 oc = ro - sc;
  float b = dot(oc, rd), cc = dot(oc, oc) - sr * sr;
  float disc = b * b - cc;
  float tS = (disc >= 0.0) ? (-b - sqrt(disc)) : -1.0;
  float tP = (rd.y < -1e-4) ? ((-0.80 - ro.y) / rd.y) : -1.0;

  if (tS > 0.001 && (tP < 0.001 || tS < tP)) {
    vec3 hp = ro + rd * tS;
    N = normalize(hp - sc); alb = vec3(0.90, 0.26, 0.30); depth = tS;
  } else if (tP > 0.001) {
    N = vec3(0.0, 1.0, 0.0); alb = vec3(0.82, 0.78, 0.70); depth = tP;
  } else {
    isSky = true; N = -rd; alb = vec3(0.95, 0.93, 0.86); depth = 60.0;
  }

  float lum;
  if (isSky) {
    lum = mix(1.25, 0.55, smoothstep(0.35, 1.0, uv.y));   // smooth sky ramp
  } else {
    vec3 Nq = (uStage >= 1) ? quantiseNormal(N, 4.0) : N;
    vec3 L1 = normalize(vec3(-0.50, 0.75, 0.55));
    vec3 L2 = normalize(vec3(0.80, 0.25, 0.30));
    float d = max(dot(Nq, L1), 0.0) * 1.10 + max(dot(Nq, L2), 0.0) * 0.30 + 0.14;
    float rim = pow(1.0 - clamp(dot(Nq, -rd), 0.0, 1.0), 3.0);
    lum = clamp(d + rim * 0.50, 0.0, 1.45);
  }

  // stage 0: raw smooth shading, no look at all
  if (uStage == 0) { fragColor = vec4(alb * lum, 1.0); return; }

  float ln = clamp(lum / 1.45, 0.0, 1.0);

  // stage 1: Thresher banding only, screen forced to a constant so steps are hard
  if (uStage == 1) {
    fragColor = vec4(alb * lum * thresher(ln, 0.5), 1.0);
    return;
  }

  // stages 2+: Hatcher screen, object-locked tri-planar, bifurcated
  vec3 hp = ro + rd * depth;
  vec2 q = hatcherCoord(MODE_TRIPLANAR, hp, hp, N, uv, uv, uAxisBasis, vec3(0.0));
  if (isSky) q = uv * uResolution;                 // sky: screen-locked, reads as light
  float pitch = bifurcatedPitch(q, uPitch, 6.0, 26.0);
  // dots in the bright bands, cross-hatch in the dark bands (patent's own example)
  float screen = (ln < uBandPos[1])
               ? crossHatch(q, pitch * 1.2, radians(32.0), radians(104.0))
               : dotScreen(q, pitch, radians(45.0));
  fragColor = vec4(alb * lum * thresher(ln, screen), 1.0);
}
`;

// --- pass 2: misregistration + grain, by stage
const FRAG_POST = COMMON + `
void main() {
  vec3 c = texture(uBeauty, vUv).rgb;
  if (uStage >= 3) {
    // circle of confusion ramps with height, standing in for a depth ramp
    float coc = smoothstep(0.62, 0.10, vUv.y) * 6.5;
    c = misregister(uBeauty, vUv, coc);
    float g = fract(sin(dot(floor(vUv * uResolution), vec2(12.9898, 78.233))) * 43758.5453);
    c *= 1.0 - 0.035 * g;                          // frame-locked paper grain
  }
  fragColor = vec4(c, 1.0);
}
`;

const VERT = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader",
         "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage();
page.on("console", (m) => console.log("  [page]", m.text()));
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

const out = await page.evaluate(
  ({ vert, fragScene, fragPost, W, H, PITCH }) => {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const gl = cv.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) return { err: "no webgl2" };
    const mk = (vs, fs) => {
      const c = (t, s) => {
        const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
          throw new Error(gl.getShaderInfoLog(sh));
        return sh;
      };
      const p = gl.createProgram();
      gl.attachShader(p, c(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, c(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(p));
      return p;
    };
    let pScene, pPost;
    try { pScene = mk(vert, fragScene); pPost = mk(vert, fragPost); }
    catch (e) { return { err: String(e.message) }; }

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);

    const mkTex = (w, h, data, filter) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const palTex = mkTex(4, 1, new Uint8Array([
      0x1a,0x0b,0x2e,255, 0x7b,0x2f,0xbe,255,
      0xe0,0x21,0x8a,255, 0xf5,0xef,0xe6,255]), gl.NEAREST);
    const sceneTex = mkTex(W, H, null, gl.LINEAR);
    const fbo = gl.createFramebuffer();

    const setU = (p, stage) => {
      gl.useProgram(p);
      const u = (n) => gl.getUniformLocation(p, n);
      gl.uniform1fv(u("uBandPos[0]"),    new Float32Array([0.20, 0.42, 0.64, 0.86]));
      // transition width ~ 0.8x the 0.22 band spacing -> continuous printed halftone
      gl.uniform1fv(u("uTransWidth[0]"), new Float32Array([0.18, 0.18, 0.18, 0.16]));
      gl.uniform1fv(u("uBandMul[0]"),    new Float32Array([0.30, 0.55, 0.78, 1.00, 1.22]));
      gl.uniform2f(u("uUVScale"), 1, 1);
      gl.uniform2f(u("uResolution"), W, H);
      gl.uniform2f(u("uTexel"), 1 / W, 1 / H);
      gl.uniform2f(u("uOffsetDir"), 1, 0);
      gl.uniform1i(u("uUseRest"), 0);
      gl.uniformMatrix3fv(u("uAxisBasis"), false, new Float32Array([1,0,0, 0,1,0, 0,0,1]));
      gl.uniform1f(u("uTriSharpness"), 12.0);
      gl.uniform3f(u("uAxisScale"), 1, 1, 1);
      gl.uniform1f(u("uSoft"), 0.06);
      gl.uniform1f(u("uNormalQuantAmount"), 0.30);
      gl.uniform1f(u("uInkOffsetPx"), 1.5);
      gl.uniform3f(u("uInkTint"), 0.85, 1.0, 1.0);
      gl.uniform1f(u("uFloorPx"), 1.0);
      gl.uniform1f(u("uDepthGain"), 1.0);
      gl.uniform1f(u("uTrailGain"), 40.0);
      gl.uniform1f(u("uTrailMaxPx"), 8.0);
      gl.uniform1f(u("uPitch"), PITCH);
      gl.uniform1i(u("uStage"), stage);
      const a = gl.getAttribLocation(p, "aPos");
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    };

    const frames = [];
    for (const stage of [0, 1, 2, 3]) {
      // pass 1 -> FBO
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                              gl.TEXTURE_2D, sceneTex, 0);
      gl.viewport(0, 0, W, H);
      setU(pScene, stage);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, palTex);
      gl.uniform1i(gl.getUniformLocation(pScene, "uPalette"), 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // pass 2 -> canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      setU(pPost, stage);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.uniform1i(gl.getUniformLocation(pPost, "uBeauty"), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frames.push(cv.toDataURL("image/png"));
    }
    return { frames, renderer: gl.getParameter(gl.RENDERER) };
  },
  { vert: VERT, fragScene: FRAG_SCENE, fragPost: FRAG_POST, W, H, PITCH }
);

if (out.err) { console.error("SHADER ERROR:\n" + out.err); await browser.close(); process.exit(1); }
const names = ["stage0_smooth", "stage1_thresher", "stage2_hatcher", "stage3_misreg_grain"];
out.frames.forEach((d, i) => {
  fs.writeFileSync(`/tmp/sv/demo_${names[i]}.png`, Buffer.from(d.split(",")[1], "base64"));
});
console.log("renderer:", out.renderer, "| pitch", PITCH.toFixed(2), "px | wrote 4 stages");
await browser.close();
