import * as THREE from 'three';

export const PALETTE = {
  paint: '#d5cbbd',
  paintDeep: '#b7ad9f',
  orange: '#e07a2a',
  metal: '#8f9ba6',
  metalDark: '#2c333a',
  floor: '#4a453f',
  fabric: '#7d5a48',
  blanket: '#c4622d',
  rubber: '#1c1e20',
  teal: '#7dfff0',
  warm: '#ffb15a',
  screen: '#9ffff0',
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iy) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function vnoise(x, y, period) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const p = period;
  const h = (ix, iy) => {
    const wx = ((ix % p) + p) % p;
    const wy = ((iy % p) + p) % p;
    return hash2(wx, wy);
  };
  const a = h(x0, y0);
  const b = h(x0 + 1, y0);
  const c = h(x0, y0 + 1);
  const d = h(x0 + 1, y0 + 1);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

function fbm(x, y, period) {
  let v = 0;
  let a = 0.5;
  let p = period;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    v += a * vnoise(x * f, y * f, p);
    f *= 2;
    p *= 2;
    a *= 0.5;
  }
  return v;
}

function canvasTex(size, colorSpace, draw) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true });
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = colorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function makeAlbedo(base, kind) {
  return canvasTex(512, THREE.SRGBColorSpace, (g, s) => {
    const img = g.createImageData(s, s);
    const [br, bgc, bb] = base;
    const period = 8;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = (x / s) * period;
        const v = (y / s) * period;
        const n = fbm(u, v, period);
        const n2 = fbm(u * 2.3 + 4, v * 2.3, period * 2);
        let r = br;
        let gc = bgc;
        let b = bb;
        const blot = (n - 0.5) * (kind === 'fabric' ? 28 : 22);
        r += blot;
        gc += blot * (kind === 'metal' ? 1.05 : 0.95);
        b += blot * (kind === 'metal' ? 1.15 : 0.85);
        if (kind === 'metal') {
          const brush = Math.sin((y / s) * Math.PI * 180) * 8;
          r += brush;
          gc += brush;
          b += brush * 1.2;
        }
        if (kind === 'fabric') {
          const weave = ((x >> 1) ^ (y >> 1)) & 1 ? 12 : -8;
          r += weave;
          gc += weave * 0.7;
          b += weave * 0.4;
        }
        if (kind === 'floor') {
          const dx = (x % 64) - 32;
          const dy = (y % 64) - 32;
          const diamond = Math.abs(dx) + Math.abs(dy);
          if (diamond > 22 && diamond < 26) {
            r += 18;
            gc += 16;
            b += 12;
          }
        }
        if (n2 > 0.72 && kind !== 'fabric') {
          const scratch = (n2 - 0.72) * 80;
          r -= scratch;
          gc -= scratch;
          b -= scratch * 0.8;
        }
        const i = (y * s + x) * 4;
        img.data[i] = Math.max(0, Math.min(255, r));
        img.data[i + 1] = Math.max(0, Math.min(255, gc));
        img.data[i + 2] = Math.max(0, Math.min(255, b));
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

function makeRough(kind) {
  return canvasTex(512, THREE.NoColorSpace, (g, s) => {
    const img = g.createImageData(s, s);
    const period = 8;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = (x / s) * period;
        const v = (y / s) * period;
        const n = fbm(u * 1.4, v * 1.4, period);
        const fine = fbm(u * 5 + 2, v * 5, period * 4);
        let rough = kind === 'fabric' ? 0.88 : kind === 'metal' ? 0.42 : kind === 'floor' ? 0.62 : 0.55;
        rough += (n - 0.5) * 0.38 + (fine - 0.5) * 0.12;
        if (kind === 'metal') rough += Math.sin((y / s) * Math.PI * 90) * 0.06;
        rough = Math.max(0.12, Math.min(0.98, rough));
        const byte = rough * 255;
        const i = (y * s + x) * 4;
        img.data[i] = byte;
        img.data[i + 1] = byte;
        img.data[i + 2] = byte;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

function makeBump(kind) {
  return canvasTex(512, THREE.NoColorSpace, (g, s) => {
    const img = g.createImageData(s, s);
    const period = 8;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = (x / s) * period;
        const v = (y / s) * period;
        let h = fbm(u * 1.6, v * 1.6, period);
        if (kind === 'metal') h = h * 0.45 + (0.5 + 0.5 * Math.sin((y / s) * Math.PI * 120)) * 0.55;
        if (kind === 'floor') {
          const dx = (x % 64) - 32;
          const dy = (y % 64) - 32;
          const diamond = Math.abs(dx) + Math.abs(dy);
          if (diamond < 24) h += 0.18;
        }
        if (kind === 'fabric') h = 0.45 + 0.15 * (((x >> 1) ^ (y >> 1)) & 1);
        const byte = Math.max(0, Math.min(255, h * 255));
        const i = (y * s + x) * 4;
        img.data[i] = byte;
        img.data[i + 1] = byte;
        img.data[i + 2] = byte;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

const WEAR_GLSL = /* glsl */ `
varying vec3 vWorldPos;
uniform float uWear;
float ghash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float gnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = ghash(i);
  float b = ghash(i + vec2(1.0, 0.0));
  float c = ghash(i + vec2(0.0, 1.0));
  float d = ghash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float gfbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * gnoise(p); p *= 2.07; a *= 0.5; }
  return v;
}
`;

function bindWear(material, mode) {
  material.userData.wearMode = mode;
  material.customProgramCacheKey = () => `wear-${mode}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWear = { value: mode };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WEAR_GLSL}`)
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
         float n1 = gfbm(vWorldPos.xz * 0.85 + vWorldPos.yz * 0.35);
         float n2 = gfbm(vWorldPos.xy * 3.4 + vWorldPos.zy * 2.1);
         if (uWear < 0.5) {
           float dirt = smoothstep(0.55, 0.92, n1);
           float floorGrime = smoothstep(0.62, 0.0, vWorldPos.y);
           diffuseColor.rgb *= mix(1.0, 0.58, dirt * 0.5 + floorGrime * 0.42);
           float chip = step(0.74, n2) * step(0.48, gfbm(vWorldPos.zy * 1.7));
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.58, 0.62, 0.66), chip);
           metalnessFactor = mix(metalnessFactor, 0.88, chip);
           roughnessFactor = clamp(mix(roughnessFactor, 0.34, chip) + (n1 - 0.5) * 0.22, 0.2, 0.96);
         } else if (uWear < 1.5) {
           float path = exp(-vWorldPos.x * vWorldPos.x * 1.35);
           diffuseColor.rgb *= mix(vec3(0.78, 0.74, 0.68), vec3(1.12, 1.08, 1.02), path);
           roughnessFactor = clamp(mix(0.84, 0.38, path) + (n2 - 0.5) * 0.16, 0.22, 0.95);
           float scuff = step(0.82, gfbm(vWorldPos.xz * 2.8));
           diffuseColor.rgb *= mix(1.0, 0.72, scuff);
           metalnessFactor = mix(0.72, 0.95, path);
         } else if (uWear < 2.5) {
           float scratch = step(0.7, n2);
           roughnessFactor = clamp(roughnessFactor * mix(1.2, 0.42, n1), 0.16, 0.88);
           diffuseColor.rgb *= mix(vec3(1.0), vec3(0.72, 0.7, 0.66), scratch * 0.55);
           diffuseColor.rgb *= mix(0.82, 1.08, n1);
           metalnessFactor = mix(metalnessFactor, 1.0, 0.35);
         } else {
           roughnessFactor = clamp(0.9 + (n1 - 0.5) * 0.08, 0.78, 1.0);
           diffuseColor.rgb *= mix(0.9, 1.05, n2);
         }
        `
      );
  };
  return material;
}

function stdMat({ color, map, roughnessMap, bumpMap, metalness, roughness, bumpScale, envMapIntensity }) {
  return new THREE.MeshStandardMaterial({
    color,
    map,
    roughnessMap,
    bumpMap,
    metalness,
    roughness,
    bumpScale,
    envMapIntensity,
  });
}

export function createMaterials() {
  const paintMap = makeAlbedo([214, 206, 194], 'paint');
  const paintRough = makeRough('paint');
  const paintBump = makeBump('paint');
  const metalMap = makeAlbedo([168, 178, 188], 'metal');
  const metalRough = makeRough('metal');
  const metalBump = makeBump('metal');
  const floorMap = makeAlbedo([92, 86, 78], 'floor');
  const floorRough = makeRough('floor');
  const floorBump = makeBump('floor');
  const fabricMap = makeAlbedo([150, 112, 90], 'fabric');
  const fabricRough = makeRough('fabric');
  const fabricBump = makeBump('fabric');

  const paint = bindWear(stdMat({
    color: PALETTE.paint,
    map: paintMap,
    roughnessMap: paintRough,
    bumpMap: paintBump,
    metalness: 0.05,
    roughness: 0.62,
    bumpScale: 0.012,
    envMapIntensity: 0.42,
  }), 0);

  const paintDeep = bindWear(stdMat({
    color: PALETTE.paintDeep,
    map: paintMap,
    roughnessMap: paintRough,
    bumpMap: paintBump,
    metalness: 0.06,
    roughness: 0.7,
    bumpScale: 0.01,
    envMapIntensity: 0.35,
  }), 0);

  const orange = bindWear(stdMat({
    color: PALETTE.orange,
    map: paintMap,
    roughnessMap: paintRough,
    bumpMap: paintBump,
    metalness: 0.08,
    roughness: 0.5,
    bumpScale: 0.008,
    envMapIntensity: 0.4,
  }), 0);

  const metal = bindWear(stdMat({
    color: PALETTE.metal,
    map: metalMap,
    roughnessMap: metalRough,
    bumpMap: metalBump,
    metalness: 0.94,
    roughness: 0.38,
    bumpScale: 0.02,
    envMapIntensity: 1.15,
  }), 2);

  const dark = bindWear(stdMat({
    color: PALETTE.metalDark,
    map: metalMap,
    roughnessMap: metalRough,
    bumpMap: metalBump,
    metalness: 0.86,
    roughness: 0.48,
    bumpScale: 0.016,
    envMapIntensity: 0.85,
  }), 2);

  const floor = bindWear(stdMat({
    color: PALETTE.floor,
    map: floorMap,
    roughnessMap: floorRough,
    bumpMap: floorBump,
    metalness: 0.78,
    roughness: 0.55,
    bumpScale: 0.018,
    envMapIntensity: 0.7,
  }), 1);

  const fabric = bindWear(stdMat({
    color: PALETTE.fabric,
    map: fabricMap,
    roughnessMap: fabricRough,
    bumpMap: fabricBump,
    metalness: 0.0,
    roughness: 0.92,
    bumpScale: 0.006,
    envMapIntensity: 0.12,
  }), 3);

  const blanket = bindWear(stdMat({
    color: PALETTE.blanket,
    map: fabricMap,
    roughnessMap: fabricRough,
    bumpMap: fabricBump,
    metalness: 0.0,
    roughness: 0.94,
    bumpScale: 0.007,
    envMapIntensity: 0.1,
  }), 3);

  const rubber = bindWear(stdMat({
    color: PALETTE.rubber,
    map: floorMap,
    roughnessMap: fabricRough,
    bumpMap: fabricBump,
    metalness: 0.0,
    roughness: 0.86,
    bumpScale: 0.01,
    envMapIntensity: 0.08,
  }), 3);

  const teal = new THREE.MeshStandardMaterial({
    color: '#06211e',
    emissive: PALETTE.teal,
    emissiveIntensity: 3.4,
    roughness: 0.35,
    metalness: 0.15,
    toneMapped: true,
  });
  teal.userData.baseE = 3.4;
  teal.userData.restScale = 0.12;

  const warm = new THREE.MeshStandardMaterial({
    color: '#2a1608',
    emissive: PALETTE.warm,
    emissiveIntensity: 2.4,
    roughness: 0.4,
    metalness: 0.05,
  });
  warm.userData.baseE = 2.4;
  warm.userData.restScale = 0.85;

  const screenTex = makeScreenTexture();
  const screen = new THREE.MeshStandardMaterial({
    color: '#02110f',
    emissive: '#ffffff',
    emissiveMap: screenTex,
    emissiveIntensity: 1.7,
    roughness: 0.42,
    metalness: 0.2,
  });
  screen.userData.baseE = 1.7;
  screen.userData.restScale = 0.2;

  const glass = new THREE.MeshStandardMaterial({
    color: '#9eb8c4',
    metalness: 0.05,
    roughness: 0.04,
    transparent: true,
    opacity: 0.07,
    envMapIntensity: 1.3,
    depthWrite: false,
  });
  glass.side = THREE.DoubleSide;
  glass.fog = false;
  glass.userData.skipAO = true;

  const mirror = new THREE.MeshStandardMaterial({
    color: '#c5d0d8',
    metalness: 1,
    roughness: 0.08,
    envMapIntensity: 1.4,
  });

  return { paint, paintDeep, orange, metal, dark, floor, fabric, blanket, rubber, teal, warm, screen, glass, mirror };
}

function makeScreenTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#041816';
  g.fillRect(0, 0, 256, 160);
  g.strokeStyle = '#8dfff2';
  g.lineWidth = 2;
  g.strokeRect(10, 10, 236, 140);
  g.beginPath();
  g.moveTo(22, 120);
  for (let i = 0; i < 8; i++) {
    g.lineTo(28 + i * 24, 110 - Math.sin(i * 1.3) * 36 - (i % 3) * 8);
  }
  g.stroke();
  g.fillStyle = '#e07a2a';
  g.fillRect(176, 22, 54, 8);
  g.font = 'bold 18px monospace';
  g.fillStyle = '#d8fff8';
  g.fillText('NAV  0.62c', 22, 36);
  g.font = '13px monospace';
  g.fillStyle = '#8dfff2';
  g.fillText('HULL  NOM', 22, 58);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createEnvironment() {
  const scene = new THREE.Scene();
  const geo = new THREE.BoxGeometry(14, 8, 16);
  const wall = (color) => new THREE.MeshLambertMaterial({ color, side: THREE.BackSide });
  const room = new THREE.Mesh(geo, [
    wall('#c4b39a'),
    wall('#7f96a3'),
    wall('#efe4d4'),
    wall('#2a241e'),
    wall('#d5cbbd'),
    wall('#16344c'),
  ]);
  scene.add(room);

  const key = new THREE.PointLight(0xfff0dc, 28, 40, 2);
  key.position.set(0, 3.2, 1);
  scene.add(key);
  const cool = new THREE.PointLight(0xc5dcff, 22, 40, 2);
  cool.position.set(0, 1.6, -6);
  scene.add(cool);
  const accent = new THREE.PointLight(0xff7a32, 8, 24, 2);
  accent.position.set(-4, 1.2, 2);
  scene.add(accent);
  const teal = new THREE.PointLight(0x7dfff0, 6, 18, 2);
  teal.position.set(3, 2.4, -1);
  scene.add(teal);

  const rng = mulberry32(11);
  void rng;
  return scene;
}

export function makeLabelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 96);
  g.font = 'bold 56px monospace';
  g.fillStyle = '#2a241c';
  g.fillText(text, 8, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
