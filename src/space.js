import * as THREE from 'three';

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

function vnoise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const h = (ix, iy) => hash2(ix, iy);
  return (
    h(x0, y0) * (1 - ux) * (1 - uy)
    + h(x0 + 1, y0) * ux * (1 - uy)
    + h(x0, y0 + 1) * (1 - ux) * uy
    + h(x0 + 1, y0 + 1) * ux * uy
  );
}

function fbm(x, y) {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < 5; i++) {
    v += a * vnoise(x, y);
    x = x * 2.03 + 1.7;
    y = y * 2.03 + 9.2;
    a *= 0.5;
  }
  return v;
}

function planetTextures() {
  const s = 512;
  const albedo = document.createElement('canvas');
  albedo.width = s;
  albedo.height = s;
  const ag = albedo.getContext('2d');
  const aim = ag.createImageData(s, s);
  const city = document.createElement('canvas');
  city.width = s;
  city.height = s;
  const cg = city.getContext('2d');
  const cim = cg.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = x / s;
      const v = y / s;
      const n = fbm(u * 4.5, v * 3.2);
      const n2 = fbm(u * 10 + 3, v * 8);
      const land = n > 0.52;
      let r;
      let g;
      let b;
      if (!land) {
        const depth = Math.min(1, (0.52 - n) * 3);
        r = 18 + depth * 10;
        g = 78 + (1 - depth) * 40;
        b = 102 + (1 - depth) * 20;
      } else {
        r = 168 + n2 * 40;
        g = 132 + n2 * 20;
        b = 86 + n2 * 10;
      }
      if (v < 0.08 || v > 0.92) {
        r = r * 0.4 + 190;
        g = g * 0.4 + 198;
        b = b * 0.4 + 200;
      }
      const cloud = Math.max(0, fbm(u * 7 + 20, v * 6) - 0.62) * 2.2;
      r = r * (1 - cloud) + 230 * cloud;
      g = g * (1 - cloud) + 236 * cloud;
      b = b * (1 - cloud) + 240 * cloud;
      const i = (y * s + x) * 4;
      aim.data[i] = r;
      aim.data[i + 1] = g;
      aim.data[i + 2] = b;
      aim.data[i + 3] = 255;
      const cities = land && n2 > 0.72 ? (n2 - 0.72) * 3.2 : 0;
      cim.data[i] = Math.min(255, cities * 255);
      cim.data[i + 1] = cim.data[i];
      cim.data[i + 2] = cim.data[i];
      cim.data[i + 3] = 255;
    }
  }
  ag.putImageData(aim, 0, 0);
  cg.putImageData(cim, 0, 0);
  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const cityMap = new THREE.CanvasTexture(city);
  cityMap.colorSpace = THREE.NoColorSpace;
  return { map, cityMap };
}

function nebulaTexture(seed, core, edge) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  const rnd = mulberry32(seed);
  g.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 28; i++) {
    const x = 60 + rnd() * 400;
    const y = 60 + rnd() * 400;
    const r = 50 + rnd() * 160;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, core);
    grd.addColorStop(0.45, edge);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStarShell({ count, radius, speed, length, width, color, seed }) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.userData.skipAO = true;
  mesh.userData.speed = speed;
  const rnd = mulberry32(seed);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const theta = rnd() * Math.PI * 2;
    const phi = Math.acos(2 * rnd() - 1);
    const r = radius * (0.92 + rnd() * 0.16);
    dummy.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi) * 0.72,
      r * Math.sin(phi) * Math.sin(theta)
    );
    dummy.lookAt(0, 0, 0);
    dummy.rotateZ(Math.PI / 2);
    const len = length * (0.35 + rnd() * 1.4);
    const wid = width * (0.35 + rnd());
    dummy.scale.set(wid, len, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

const planetVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const planetFrag = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;
  uniform vec3 sunDir;
  uniform sampler2D map;
  uniform sampler2D city;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    float ndl = dot(N, normalize(sunDir));
    float day = smoothstep(-0.05, 0.22, ndl);
    vec3 albedo = texture2D(map, vUv).rgb;
    vec3 col = albedo * (0.045 + day * 1.05);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.15);
    float limb = fres * (0.35 + 0.65 * smoothstep(-0.35, 0.45, ndl));
    col += vec3(0.42, 0.72, 1.0) * limb * 2.15;
    float night = 1.0 - day;
    float cities = texture2D(city, vUv).r;
    col += vec3(1.0, 0.72, 0.38) * cities * night * 2.4;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSpace() {
  const root = new THREE.Group();
  root.name = 'space';

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(520, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x070b12, side: THREE.BackSide, fog: false })
  );
  sky.userData.skipAO = true;
  sky.frustumCulled = false;
  root.add(sky);

  const far = makeStarShell({
    count: 1600, radius: 340, speed: 0.012, length: 0.55, width: 0.18, color: 0xd5e4ff, seed: 3,
  });
  const mid = makeStarShell({
    count: 700, radius: 230, speed: 0.03, length: 2.4, width: 0.22, color: 0xe7f0ff, seed: 9,
  });
  const near = makeStarShell({
    count: 280, radius: 150, speed: 0.055, length: 6.5, width: 0.28, color: 0xf4f7ff, seed: 21,
  });
  root.add(far, mid, near);
  const shells = [far, mid, near];

  const { map, cityMap } = planetTextures();
  const sunDir = new THREE.Vector3(0.85, 0.42, 0.15).normalize();
  const planetMat = new THREE.ShaderMaterial({
    uniforms: {
      sunDir: { value: sunDir },
      map: { value: map },
      city: { value: cityMap },
    },
    vertexShader: planetVert,
    fragmentShader: planetFrag,
    fog: false,
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(24, 64, 48), planetMat);
  planet.userData.skipAO = true;

  const moonMat = new THREE.MeshStandardMaterial({
    color: 0xb7a898,
    roughness: 0.92,
    metalness: 0.05,
    emissive: 0x1a140e,
    emissiveIntensity: 0.15,
  });
  moonMat.fog = false;
  const moon = new THREE.Mesh(new THREE.SphereGeometry(4.2, 32, 24), moonMat);
  moon.position.set(18, 6, -10);
  moon.userData.skipAO = true;

  const planetGroup = new THREE.Group();
  planetGroup.add(planet);
  planetGroup.add(moon);
  root.add(planetGroup);

  const nebulaMat = (tex, opacity) => {
    const m = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    return m;
  };
  const n1 = new THREE.Mesh(
    new THREE.PlaneGeometry(130, 80),
    nebulaMat(nebulaTexture(4, 'rgba(40, 180, 170, 0.55)', 'rgba(18, 70, 90, 0.15)'), 0.55)
  );
  n1.position.set(-36, 14, 96);
  n1.userData.skipAO = true;
  const n2 = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 60),
    nebulaMat(nebulaTexture(8, 'rgba(210, 120, 60, 0.4)', 'rgba(80, 30, 20, 0.1)'), 0.4)
  );
  n2.position.set(48, -8, 40);
  n2.userData.skipAO = true;
  root.add(n1, n2);
  const nebulas = [n1, n2];

  let time = 0;
  let frozen = null;

  function place(t) {
    const loop = 78;
    const u = ((t % loop) + loop) % loop / loop;
    const x = 14 + 36 * u;
    const y = -7 + Math.sin(u * Math.PI) * 3;
    const z = 118 - 155 * u;
    planetGroup.position.set(x, y, z);
    planet.rotation.y = t * 0.04;
    for (const shell of shells) shell.rotation.y = t * shell.userData.speed;
    for (const neb of nebulas) neb.lookAt(0, 1.6, 8);
  }

  function update(dt) {
    if (frozen == null) time += dt;
    else time = frozen;
    place(time);
  }

  function setTime(t) {
    frozen = t;
    time = t;
    place(t);
  }

  function play() {
    frozen = null;
  }

  place(0);
  return { root, update, setTime, play, planetGroup };
}
