// Headless WebGL2 capability + throughput probe.
// Answers: how many MRT attachments, which float formats, and how fast SwiftShader
// pushes a representative G-buffer + post chain at the delivery resolution.
import puppeteer from 'puppeteer-core';

const CHROME = '/usr/local/bin/google-chrome';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'shell',
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--disable-dev-shm-usage',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
});

const page = await browser.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

const out = await page.evaluate(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 803;
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) return { error: 'no webgl2' };

  const info = {
    version: gl.getParameter(gl.VERSION),
    renderer: gl.getParameter(gl.RENDERER),
    vendor: gl.getParameter(gl.VENDOR),
    maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS),
    maxColorAttachments: gl.getParameter(gl.MAX_COLOR_ATTACHMENTS),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxVaryings: gl.getParameter(gl.MAX_VARYING_VECTORS),
    maxSamples: gl.getParameter(gl.MAX_SAMPLES),
    extFloatLinear: !!gl.getExtension('OES_texture_float_linear'),
    extColorBufferFloat: !!gl.getExtension('EXT_color_buffer_float'),
    extDerivatives: true,
  };

  // Throughput probe: a fragment-heavy full-screen pass at delivery resolution,
  // roughly the cost of the look chain (many texture fetches + trig).
  const vs = `#version 300 es
  in vec2 p; out vec2 vUv;
  void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;
  const fs = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o;
  uniform float t;
  void main(){
    vec3 c = vec3(0.);
    for(int i=0;i<48;i++){
      float f = float(i);
      vec2 q = vUv*vec2(1920.,803.) + vec2(sin(f+t),cos(f*1.7+t))*3.0;
      c += vec3(fract(sin(dot(q,vec2(12.9898,78.233)))*43758.5453));
    }
    o = vec4(c/48.0,1.0);
  }`;
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tl = gl.getUniformLocation(pr, 't');

  gl.viewport(0, 0, 1920, 803);
  gl.uniform1f(tl, 0.0); gl.drawArrays(gl.TRIANGLES, 0, 3);
  const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // sync

  const N = 6;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) { gl.uniform1f(tl, i); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t1 = performance.now();
  info.fullscreenPassMs = (t1 - t0) / N;

  // toDataURL / readback cost at delivery res
  const t2 = performance.now();
  const big = new Uint8Array(1920 * 803 * 4);
  gl.readPixels(0, 0, 1920, 803, gl.RGBA, gl.UNSIGNED_BYTE, big);
  info.readbackMs = performance.now() - t2;

  return info;
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
