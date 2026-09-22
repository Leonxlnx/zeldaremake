import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLabelTexture } from './materials.js';

function applyBoxMeterUV(geo, w, h, d) {
  const uv = geo.attributes.uv;
  const sizes = [
    [d, h], [d, h],
    [w, d], [w, d],
    [w, h], [w, h],
  ];
  for (let face = 0; face < 6; face++) {
    const su = sizes[face][0];
    const sv = sizes[face][1];
    for (let i = 0; i < 4; i++) {
      const idx = face * 4 + i;
      uv.setXY(idx, uv.getX(idx) * su, uv.getY(idx) * sv);
    }
  }
  uv.needsUpdate = true;
}

function cloneMat(src) {
  const m = src.clone();
  m.onBeforeCompile = src.onBeforeCompile;
  m.customProgramCacheKey = () => src.customProgramCacheKey();
  return m;
}

function sanitize(geo) {
  for (const name of Object.keys(geo.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
  }
  return geo;
}

class Kit {
  constructor() {
    this.buckets = new Map();
    this.colliders = [];
    this.rivets = [];
    this._q = new THREE.Quaternion();
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._e = new THREE.Euler();
  }

  add(key, material, geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    this._e.set(rx, ry, rz, 'XYZ');
    this._q.setFromEuler(this._e);
    this._p.set(x, y, z);
    this._m.compose(this._p, this._q, this._s);
    const g = sanitize(geo.clone());
    g.applyMatrix4(this._m);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { material, geos: [] };
      this.buckets.set(key, bucket);
    }
    bucket.geos.push(g);
  }

  box(key, material, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    applyBoxMeterUV(geo, w, h, d);
    this.add(key, material, geo, x, y, z, rx, ry, rz);
    geo.dispose();
  }

  collide(x, y, z, w, h, d) {
    this.colliders.push(new THREE.Box3(
      new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
      new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)
    ));
  }

  rivet(x, y, z, axis, inward) {
    const e = new THREE.Euler();
    if (axis === 'x') e.set(0, 0, inward > 0 ? Math.PI / 2 : -Math.PI / 2);
    else e.set(inward > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0);
    const q = new THREE.Quaternion().setFromEuler(e);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      q,
      new THREE.Vector3(1, 1, 1)
    );
    this.rivets.push(m);
  }

  finalize(root) {
    for (const [key, bucket] of this.buckets) {
      const geos = bucket.geos.filter(Boolean);
      if (!geos.length) continue;
      let merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) {
        for (const g of geos) {
          const mesh = new THREE.Mesh(g, bucket.material);
          mesh.castShadow = !key.startsWith('emit') && key !== 'glass';
          mesh.receiveShadow = key !== 'glass';
          root.add(mesh);
        }
        continue;
      }
      if (geos.length > 1) geos.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.name = key;
      mesh.castShadow = !key.startsWith('emit') && key !== 'glass';
      mesh.receiveShadow = key !== 'glass';
      if (bucket.material.userData && bucket.material.userData.skipAO) mesh.userData.skipAO = true;
      root.add(mesh);
    }
    if (this.rivets.length) {
      const geo = new THREE.CylinderGeometry(0.011, 0.011, 0.012, 6);
      const mat = this.buckets.get('metal')?.material;
      if (mat) {
        const mesh = new THREE.InstancedMesh(geo, mat, this.rivets.length);
        for (let i = 0; i < this.rivets.length; i++) mesh.setMatrixAt(i, this.rivets[i]);
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        root.add(mesh);
      }
    }
  }
}

function wallPoint(axis, fixed, inward, u, y, lift) {
  const n = fixed + inward * lift;
  if (axis === 'x') return [n, y, u];
  return [u, y, n];
}

export function createShip(mats) {
  const kit = new Kit();
  const root = new THREE.Group();
  root.name = 'ship';
  const specials = [];
  const cycleLights = [];
  const cycleMats = [mats.teal, mats.warm, mats.screen];

  function tagLight(light, restScale, restColor) {
    light.userData.baseI = light.intensity;
    light.userData.restScale = restScale;
    light.userData.baseColor = light.color.clone();
    light.userData.restColor = new THREE.Color(restColor || light.color);
    cycleLights.push(light);
  }

  function placeWall(axis, fixed, inward, u0, u1, y0, y1, thick, key, mat, collide) {
    const du = u1 - u0;
    const dy = y1 - y0;
    if (du < 0.02 || dy < 0.02) return;
    const uc = (u0 + u1) / 2;
    const yc = (y0 + y1) / 2;
    const n = fixed - inward * (thick / 2);
    if (axis === 'x') {
      kit.box(key, mat, thick, dy, du, n, yc, uc);
      if (collide) kit.collide(n, yc, uc, thick, dy, du);
    } else {
      kit.box(key, mat, du, dy, thick, uc, yc, n);
      if (collide) kit.collide(uc, yc, n, du, dy, thick);
    }
  }

  function panel(axis, fixed, inward, u, y, w, h, variant) {
    const plateT = 0.02;
    const gap = 0.006;
    const centerLift = gap + plateT / 2;
    const [px, py, pz] = wallPoint(axis, fixed, inward, u, y, centerLift);
    const faceW = Math.max(0.12, w);
    const faceH = Math.max(0.12, h);
    if (axis === 'x') kit.box('paint', mats.paint, plateT, faceH, faceW, px, py, pz);
    else kit.box('paint', mats.paint, faceW, faceH, plateT, px, py, pz);

    const insetLift = gap + plateT + 0.006;
    const [ix, iy, iz] = wallPoint(axis, fixed, inward, u, y, insetLift);
    const iw = faceW * 0.78;
    const ih = faceH * 0.72;
    if (axis === 'x') kit.box('paintDeep', mats.paintDeep, 0.012, ih, iw, ix, iy, iz);
    else kit.box('paintDeep', mats.paintDeep, iw, ih, 0.012, ix, iy, iz);

    const rivetLift = gap + plateT + 0.012;
    const ru = faceW * 0.42;
    const ry = faceH * 0.4;
    for (const du of [-ru, ru]) {
      for (const dy of [-ry, ry]) {
        const [rx, rry, rz] = wallPoint(axis, fixed, inward, u + du, y + dy, rivetLift);
        kit.rivet(rx, rry, rz, axis, inward);
      }
    }

    if (variant === 1 && faceH > 0.45) {
      for (let i = 0; i < 5; i++) {
        const [vx, vy, vz] = wallPoint(axis, fixed, inward, u, y - faceH * 0.18 + i * 0.04, insetLift + 0.008);
        if (axis === 'x') kit.box('dark', mats.dark, 0.01, 0.012, faceW * 0.46, vx, vy, vz);
        else kit.box('dark', mats.dark, faceW * 0.46, 0.012, 0.01, vx, vy, vz);
      }
    } else if (variant === 2) {
      const [gx, gy, gz] = wallPoint(axis, fixed, inward, u + faceW * 0.18, y, insetLift + 0.012);
      if (axis === 'x') kit.box('metal', mats.metal, 0.035, faceH * 0.55, 0.1, gx, gy, gz);
      else kit.box('metal', mats.metal, 0.1, faceH * 0.55, 0.035, gx, gy, gz);
      const [ox, oy, oz] = wallPoint(axis, fixed, inward, u - faceW * 0.2, y - faceH * 0.22, insetLift + 0.01);
      if (axis === 'x') kit.box('orange', mats.orange, 0.01, 0.07, 0.18, ox, oy, oz);
      else kit.box('orange', mats.orange, 0.18, 0.07, 0.01, ox, oy, oz);
    } else if (variant === 3) {
      const [sx, sy, sz] = wallPoint(axis, fixed, inward, u, y, insetLift + 0.01);
      if (axis === 'x') kit.box('metal', mats.metal, 0.025, 0.05, faceW * 0.7, sx, sy, sz);
      else kit.box('metal', mats.metal, faceW * 0.7, 0.05, 0.025, sx, sy, sz);
    } else if (variant === 4 && faceH > 0.4) {
      const [bx, by, bz] = wallPoint(axis, fixed, inward, u, y + faceH * 0.12, insetLift + 0.008);
      if (axis === 'x') kit.box('dark', mats.dark, 0.03, 0.16, 0.22, bx, by, bz);
      else kit.box('dark', mats.dark, 0.22, 0.16, 0.03, bx, by, bz);
    }
  }

  function decorate(axis, fixed, inward, u0, u1, y0, y1) {
    const tall = y1 - y0 > 1.3 && y0 < 0.05;
    const yStart = tall ? 0.18 : y0 + 0.04;
    const yEnd = y1 - 0.04;
    if (yEnd - yStart < 0.2 || u1 - u0 < 0.28) return;
    if (tall) {
      const [kx, ky, kz] = wallPoint(axis, fixed, inward, (u0 + u1) / 2, 0.07, 0.02);
      if (axis === 'x') kit.box('dark', mats.dark, 0.028, 0.14, (u1 - u0) - 0.04, kx, ky, kz);
      else kit.box('dark', mats.dark, (u1 - u0) - 0.04, 0.14, 0.028, kx, ky, kz);
    }
    if (u1 - u0 > 2.2 && y1 - y0 > 1.2) {
      const yPipe = y0 + (y1 - y0) * 0.72;
      const [cx, cy, cz] = wallPoint(axis, fixed, inward, (u0 + u1) / 2, yPipe, 0.045);
      if (axis === 'x') kit.box('metal', mats.metal, 0.05, 0.05, (u1 - u0) - 0.2, cx, cy, cz);
      else kit.box('metal', mats.metal, (u1 - u0) - 0.2, 0.05, 0.05, cx, cy, cz);
    }
    const bay = 0.98;
    let col = 0;
    for (let u = u0 + 0.06; u < u1 - 0.22; u += bay) {
      const w = Math.min(bay - 0.07, u1 - u - 0.05);
      if (w < 0.25) continue;
      const bands = [];
      if (yEnd - yStart > 1.35) {
        const mid = yStart + (yEnd - yStart) * 0.48;
        bands.push([yStart, mid - 0.03], [mid + 0.03, yEnd]);
      } else {
        bands.push([yStart, yEnd]);
      }
      let row = 0;
      for (const [a, b] of bands) {
        const h = b - a;
        if (h < 0.2) continue;
        const variant = Math.abs((col * 5 + row * 3 + Math.floor(fixed * 10)) % 5);
        panel(axis, fixed, inward, u + w / 2, (a + b) / 2, w, h - 0.04, variant);
        row++;
      }
      col++;
    }
  }

  const rects = [
    // corridor port
    ['x', -1.22, 1, 0.0, 1.18, 0, 2.5],
    ['x', -1.22, 1, 1.18, 2.82, 2.16, 2.5],
    ['x', -1.22, 1, 2.82, 5.18, 0, 2.5],
    ['x', -1.22, 1, 5.18, 5.94, 0, 1.14],
    ['x', -1.22, 1, 5.18, 5.94, 1.98, 2.5],
    ['x', -1.22, 1, 5.94, 9.4, 0, 2.5],
    // quarters side of that wall
    ['x', -1.32, -1, 0.0, 1.18, 0, 2.5],
    ['x', -1.32, -1, 1.18, 2.82, 2.16, 2.5],
    ['x', -1.32, -1, 2.82, 4.35, 0, 2.5],
    // corridor starboard
    ['x', 1.22, -1, 0.0, 0.68, 0, 2.5],
    ['x', 1.22, -1, 0.68, 1.92, 2.16, 2.5],
    ['x', 1.22, -1, 1.92, 3.52, 0, 2.5],
    ['x', 1.22, -1, 3.52, 4.28, 0, 1.14],
    ['x', 1.22, -1, 3.52, 4.28, 1.98, 2.5],
    ['x', 1.22, -1, 4.28, 5.92, 0, 2.5],
    ['x', 1.22, -1, 5.92, 7.48, 2.16, 2.5],
    ['x', 1.22, -1, 7.48, 9.4, 0, 2.5],
    // galley / bath side
    ['x', 1.32, 1, 0.2, 0.68, 0, 2.5],
    ['x', 1.32, 1, 0.68, 1.92, 2.16, 2.5],
    ['x', 1.32, 1, 1.92, 2.6, 0, 2.5],
    ['x', 1.32, 1, 5.1, 5.92, 0, 2.5],
    ['x', 1.32, 1, 5.92, 7.48, 2.16, 2.5],
    ['x', 1.32, 1, 7.48, 8.6, 0, 2.5],
    // aft + quarters shell
    ['z', 0, 1, -1.22, 1.22, 0, 2.5],
    ['x', -4.55, 1, 0.0, 4.35, 0, 2.5],
    ['z', 0, 1, -4.55, -1.32, 0, 2.5],
    ['z', 4.35, -1, -4.55, -1.22, 0, 2.5],
    // bath shell
    ['x', 3.05, -1, 0.2, 2.6, 0, 2.5],
    ['z', 0.2, 1, 1.32, 3.05, 0, 2.5],
    ['z', 2.6, -1, 1.32, 3.05, 0, 2.5],
    // galley shell
    ['x', 4.1, -1, 5.1, 8.6, 0, 2.5],
    ['z', 5.1, 1, 1.32, 4.1, 0, 2.5],
    ['z', 8.6, -1, 1.32, 4.1, 0, 2.5],
    // cockpit
    ['x', -2.45, 1, 9.4, 15.02, 0, 2.5],
    ['x', 2.45, -1, 9.4, 15.02, 0, 2.5],
    ['z', 9.4, 1, -2.45, -1.22, 0, 2.5],
    ['z', 9.4, 1, 1.22, 2.45, 0, 2.5],
    // cockpit shoulders facing aft corridor (other side)
    ['z', 9.5, -1, -2.45, -1.32, 0, 2.5],
    ['z', 9.5, -1, 1.32, 2.45, 0, 2.5],
    // window wall pieces
    ['z', 15.05, -1, -2.45, -1.72, 0, 2.5],
    ['z', 15.05, -1, 1.72, 2.45, 0, 2.5],
    ['z', 15.05, -1, -1.72, 1.72, 0, 0.9],
    ['z', 15.05, -1, -1.72, 1.72, 2.2, 2.5],
  ];

  for (const r of rects) {
    placeWall(r[0], r[1], r[2], r[3], r[4], r[5], r[6], 0.1, 'dark', mats.dark, true);
    decorate(r[0], r[1], r[2], r[3], r[4], r[5], r[6]);
  }

  function porthole(axis, fixed, inward, u, y) {
    const innerR = 0.28;
    const tube = 0.1;
    const geo = new THREE.TorusGeometry(innerR + tube * 0.15, tube, 8, 24);
    if (axis === 'x') geo.rotateY(Math.PI / 2);
    const lift = 0.03;
    const [x, yy, z] = wallPoint(axis, fixed, inward, u, y, lift);
    kit.add('metal', mats.metal, geo, x, yy, z);
    geo.dispose();
    const glass = new THREE.CircleGeometry(innerR * 0.92, 24);
    if (axis === 'x') glass.rotateY(Math.PI / 2);
    const [gx, gy, gz] = wallPoint(axis, fixed, inward, u, y, 0.012);
    kit.add('glass', mats.glass, glass, gx, gy, gz);
    glass.dispose();
    const seal = new THREE.TorusGeometry(innerR * 0.95, 0.012, 6, 24);
    if (axis === 'x') seal.rotateY(Math.PI / 2);
    const [sx, sy, sz] = wallPoint(axis, fixed, inward, u, y, 0.045);
    kit.add('emitTeal', mats.teal, seal, sx, sy, sz);
    seal.dispose();
  }
  porthole('x', -1.22, 1, 5.56, 1.56);
  porthole('x', 1.22, -1, 3.9, 1.56);

  function frame(axis, fixed, inward, u0, u1, top) {
    const t = 0.06;
    const depth = 0.05;
    const lift = 0.03;
    const uc = (u0 + u1) / 2;
    const span = u1 - u0;
    const parts = [
      [uc, top + t / 2, span + t * 2, t],
      [u0 - t / 2, top / 2, t, top],
      [u1 + t / 2, top / 2, t, top],
    ];
    for (const [u, y, w, h] of parts) {
      const [x, yy, z] = wallPoint(axis, fixed, inward, u, y, lift);
      if (axis === 'x') kit.box('metal', mats.metal, depth, h, w, x, yy, z);
      else kit.box('metal', mats.metal, w, h, depth, x, yy, z);
    }
    const [ox, oy, oz] = wallPoint(axis, fixed, inward, uc, 0.025, 0.02);
    if (axis === 'x') kit.box('orange', mats.orange, 0.01, 0.02, Math.min(span, 1.4), ox, oy, oz);
    else kit.box('orange', mats.orange, Math.min(span, 1.4), 0.02, 0.01, ox, oy, oz);
  }
  frame('x', -1.22, 1, 1.18, 2.82, 2.16);
  frame('x', -1.32, -1, 1.18, 2.82, 2.16);
  frame('x', 1.22, -1, 0.68, 1.92, 2.16);
  frame('x', 1.32, 1, 0.68, 1.92, 2.16);
  frame('x', 1.22, -1, 5.92, 7.48, 2.16);
  frame('x', 1.32, 1, 5.92, 7.48, 2.16);
  frame('z', 9.4, 1, -1.05, 1.05, 2.16);

  // mullion + window glass
  kit.box('metal', mats.metal, 0.08, 1.3, 0.08, 0, 1.55, 15.0);
  const paneL = new THREE.PlaneGeometry(1.6, 1.22);
  const paneR = paneL.clone();
  kit.add('glass', mats.glass, paneL, -0.86, 1.55, 14.98);
  kit.add('glass', mats.glass, paneR, 0.86, 1.55, 14.98);
  paneL.dispose();
  paneR.dispose();
  kit.box('metal', mats.metal, 3.5, 0.08, 0.06, 0, 0.92, 14.98);
  kit.box('metal', mats.metal, 3.5, 0.08, 0.06, 0, 2.18, 14.98);
  kit.box('orange', mats.orange, 0.9, 0.035, 0.012, -1.15, 1.02, 14.96);

  function floorRoom(x0, x1, z0, z1, grate) {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const w = x1 - x0;
    const d = z1 - z0;
    kit.box('dark', mats.dark, w, 0.16, d, cx, -0.12, cz);
    const bay = 1.05;
    for (let x = x0 + 0.04; x < x1 - 0.2; x += bay) {
      for (let z = z0 + 0.04; z < z1 - 0.2; z += bay) {
        const pw = Math.min(bay - 0.045, x1 - x - 0.03);
        const pd = Math.min(bay - 0.045, z1 - z - 0.03);
        if (pw < 0.25 || pd < 0.25) continue;
        const pcx = x + pw / 2;
        const pcz = z + pd / 2;
        if (grate && Math.abs(pcx) < 0.42) continue;
        kit.box('floor', mats.floor, pw, 0.028, pd, pcx, -0.012, pcz);
      }
    }
  }
  floorRoom(-1.22, 1.22, 0, 9.4, true);
  floorRoom(-4.55, -1.22, 0, 4.35, false);
  floorRoom(1.22, 3.05, 0.2, 2.6, false);
  floorRoom(1.22, 4.1, 5.1, 8.6, false);
  floorRoom(-2.45, 2.45, 9.4, 15.02, false);

  // corridor grate
  for (let z = 0.15; z < 9.25; z += 0.11) {
    kit.box('metal', mats.metal, 0.72, 0.012, 0.02, 0, -0.02, z);
  }
  kit.box('dark', mats.dark, 0.04, 0.03, 9.1, -0.34, -0.02, 4.7);
  kit.box('dark', mats.dark, 0.04, 0.03, 9.1, 0.34, -0.02, 4.7);
  kit.box('orange', mats.orange, 0.045, 0.008, 9.0, 0.78, 0.012, 4.7);

  function ceiling(x0, x1, z0, z1) {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    kit.box('dark', mats.dark, x1 - x0, 0.14, z1 - z0, cx, 2.57, cz);
    const bay = 1.05;
    for (let x = x0 + 0.06; x < x1 - 0.25; x += bay) {
      for (let z = z0 + 0.06; z < z1 - 0.25; z += bay) {
        const pw = Math.min(bay - 0.06, x1 - x - 0.04);
        const pd = Math.min(bay - 0.06, z1 - z - 0.04);
        if (pw < 0.28 || pd < 0.28) continue;
        kit.box('paint', mats.paint, pw, 0.02, pd, x + pw / 2, 2.475, z + pd / 2);
      }
    }
  }
  ceiling(-1.22, 1.22, 0, 9.4);
  ceiling(-4.55, -1.22, 0, 4.35);
  ceiling(1.22, 3.05, 0.2, 2.6);
  ceiling(1.22, 4.1, 5.1, 8.6);
  ceiling(-2.45, 2.45, 9.4, 15.02);

  function pipe(x, y, z0, z1, radius) {
    const len = z1 - z0;
    const geo = new THREE.CylinderGeometry(radius, radius, len, 8, 1, true);
    geo.rotateX(Math.PI / 2);
    const uv = geo.attributes.uv;
    const circ = Math.PI * 2 * radius;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * len);
    kit.add('metal', mats.metal, geo, x, y, (z0 + z1) / 2);
    geo.dispose();
    for (let z = z0 + 0.2; z < z1; z += 1.45) {
      const flange = new THREE.CylinderGeometry(radius * 1.7, radius * 1.7, 0.035, 8);
      flange.rotateX(Math.PI / 2);
      kit.add('dark', mats.dark, flange, x, y, z);
      flange.dispose();
    }
  }
  pipe(-0.92, 2.3, 0.3, 9.1, 0.045);
  pipe(0.96, 2.28, 0.4, 9.0, 0.032);
  pipe(-2.05, 2.28, 9.6, 14.7, 0.04);
  pipe(2.05, 2.28, 9.6, 14.7, 0.04);

  const cablePts = [
    new THREE.Vector3(-0.7, 2.34, 0.5),
    new THREE.Vector3(-0.45, 2.22, 2.4),
    new THREE.Vector3(-0.75, 2.3, 4.8),
    new THREE.Vector3(-0.4, 2.2, 7.1),
    new THREE.Vector3(-0.7, 2.32, 9.0),
  ];
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 40, 0.014, 5, false);
  kit.add('rubber', mats.rubber, tube, 0, 0, 0);
  tube.dispose();

  function practical(x, y, z, color, intensity, restScale, restColor, lit = true) {
    kit.box('dark', mats.dark, 0.78, 0.07, 0.2, x, y + 0.16, z);
    kit.box('emitTeal', mats.teal, 0.62, 0.025, 0.1, x, y + 0.11, z);
    if (!lit) return;
    const light = new THREE.PointLight(color, intensity, 9.5, 2);
    light.position.set(x, y, z);
    tagLight(light, restScale, restColor);
    root.add(light);
  }
  practical(0, 2.05, 1.6, '#b8fff4', 10, 0.1, '#7f9eb8');
  practical(0, 2.05, 3.9, '#b8fff4', 8, 0.1, '#7f9eb8');
  practical(0, 2.05, 6.15, '#b8fff4', 10, 0.1, '#7f9eb8');
  practical(0, 2.05, 8.25, '#b8fff4', 0, 0.12, '#7f9eb8', false);
  practical(0, 2.02, 12.55, '#c8fff6', 7.5, 0.18, '#8aa8c4');
  practical(2.7, 2.0, 6.9, '#ffe0b0', 7, 0.22, '#c4b09a');
  practical(2.1, 2.0, 1.4, '#d8fff8', 5.5, 0.15, '#9eb4c4');

  const bunk = new THREE.PointLight('#ffb15a', 16, 5.4, 2);
  bunk.position.set(-3.15, 1.85, 1.55);
  tagLight(bunk, 0.9, '#ffb15a');
  root.add(bunk);
  kit.box('dark', mats.dark, 0.18, 0.08, 0.18, -3.55, 2.15, 1.45);
  kit.box('emitWarm', mats.warm, 0.12, 0.02, 0.12, -3.55, 2.1, 1.45);

  const hemi = new THREE.HemisphereLight('#9eb6c8', '#4a3428', 0.38);
  tagLight(hemi, 0.45, '#6e8494');
  root.add(hemi);

  const sun = new THREE.DirectionalLight('#d5e4ff', 1.85);
  sun.position.set(7, 11, 22);
  sun.target.position.set(0, 1.1, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 48;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.04;
  tagLight(sun, 0.88, '#c9daf5');
  root.add(sun);
  root.add(sun.target);

  const fill = new THREE.DirectionalLight('#ffd2b0', 0.28);
  fill.position.set(-4, 3, -2);
  fill.target.position.set(0, 1, 6);
  tagLight(fill, 0.2, '#8aa0b4');
  root.add(fill);
  root.add(fill.target);

  const quarterFill = new THREE.PointLight('#d5e4f4', 5.5, 6.5, 2);
  quarterFill.position.set(-2.35, 2.15, 2.35);
  tagLight(quarterFill, 0.28, '#8ea6bc');
  root.add(quarterFill);

  const deckGlow = new THREE.PointLight('#d7e4f6', 7.2, 8.5, 2);
  deckGlow.position.set(0, 1.05, 13.35);
  tagLight(deckGlow, 0.35, '#9aafc4');
  root.add(deckGlow);

  // cockpit seats, console, controls
  function seat(x, z) {
    kit.box('dark', mats.dark, 0.12, 0.42, 0.12, x, 0.21, z);
    kit.box('fabric', mats.fabric, 0.5, 0.1, 0.5, x, 0.48, z);
    kit.box('fabric', mats.fabric, 0.48, 0.62, 0.08, x, 0.86, z - 0.22);
    kit.box('fabric', mats.fabric, 0.28, 0.16, 0.08, x, 1.24, z - 0.22);
    kit.box('dark', mats.dark, 0.08, 0.06, 0.42, x - 0.28, 0.62, z);
    kit.box('dark', mats.dark, 0.08, 0.06, 0.42, x + 0.28, 0.62, z);
    kit.box('orange', mats.orange, 0.04, 0.5, 0.02, x - 0.12, 0.9, z - 0.27);
    kit.box('orange', mats.orange, 0.04, 0.5, 0.02, x + 0.12, 0.9, z - 0.27);
    kit.collide(x, 0.55, z, 0.56, 1.15, 0.56);
    const stick = new THREE.CylinderGeometry(0.02, 0.025, 0.38, 8);
    kit.add('dark', mats.dark, stick, x, 0.72, z + 0.34);
    stick.dispose();
    kit.box('orange', mats.orange, 0.08, 0.04, 0.1, x, 0.92, z + 0.34);
  }
  seat(-0.58, 12.75);
  seat(0.58, 12.75);

  kit.box('dark', mats.dark, 1.9, 0.7, 0.55, 0, 0.48, 14.15);
  kit.box('paintDeep', mats.paintDeep, 1.7, 0.08, 0.42, 0, 0.86, 14.22, -0.35, 0, 0);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 2; j++) {
      const key = (i + j) % 5 === 0 ? 'emitWarm' : 'emitTeal';
      const mat = key === 'emitWarm' ? mats.warm : mats.teal;
      kit.box(key, mat, 0.045, 0.03, 0.02, -0.72 + i * 0.2, 0.95 + j * 0.08, 14.02);
    }
  }
  kit.box('screen', mats.screen, 0.42, 0.22, 0.02, -0.55, 1.08, 13.95);
  kit.box('screen', mats.screen, 0.42, 0.22, 0.02, 0.55, 1.08, 13.95);
  kit.box('metal', mats.metal, 0.7, 0.5, 0.35, 0, 0.7, 13.15);
  kit.box('emitTeal', mats.teal, 0.5, 0.015, 0.2, 0, 0.96, 13.0);

  // overhead cockpit panel
  kit.box('dark', mats.dark, 1.6, 0.08, 0.35, 0, 2.28, 13.6);
  for (let i = 0; i < 10; i++) {
    kit.box(i % 3 === 0 ? 'emitWarm' : 'emitTeal', i % 3 === 0 ? mats.warm : mats.teal, 0.06, 0.02, 0.06, -0.65 + i * 0.14, 2.22, 13.6);
  }

  // quarters bed
  kit.box('dark', mats.dark, 0.95, 0.28, 2.05, -4.05, 0.2, 1.55);
  const mattress = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.16, 1.92),
    cloneMat(mats.fabric)
  );
  mattress.position.set(-4.02, 0.42, 1.55);
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  mattress.name = 'bed';
  specials.push(mattress);
  kit.box('blanket', mats.blanket, 0.8, 0.06, 0.7, -4.02, 0.52, 0.95);
  kit.box('fabric', mats.fabric, 0.42, 0.1, 0.28, -4.05, 0.52, 2.28);
  kit.collide(-4.02, 0.35, 1.55, 0.95, 0.7, 2.05);
  kit.box('dark', mats.dark, 0.42, 1.5, 0.48, -4.22, 0.75, 3.45);
  kit.box('paint', mats.paint, 0.02, 1.2, 0.36, -3.98, 0.85, 3.45);
  kit.box('orange', mats.orange, 0.015, 0.08, 0.2, -3.96, 1.3, 3.45);

  // galley
  const counterMat = cloneMat(mats.paintDeep);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 2.5), counterMat);
  counter.position.set(3.65, 0.45, 6.85);
  counter.castShadow = true;
  counter.receiveShadow = true;
  counter.name = 'galley';
  specials.push(counter);
  kit.collide(3.65, 0.5, 6.85, 0.75, 1.0, 2.55);
  kit.box('dark', mats.dark, 0.62, 0.4, 2.3, 3.68, 1.7, 6.85);
  kit.box('metal', mats.metal, 0.55, 0.04, 0.55, 3.55, 0.92, 6.3);
  kit.box('emitWarm', mats.warm, 0.28, 0.015, 0.28, 3.55, 0.95, 6.3);
  kit.box('dark', mats.dark, 0.28, 0.55, 0.28, 2.35, 0.28, 6.4);
  kit.box('fabric', mats.fabric, 0.3, 0.06, 0.3, 2.35, 0.58, 6.4);
  kit.collide(2.35, 0.3, 6.4, 0.32, 0.65, 0.32);
  const kettle = new THREE.CylinderGeometry(0.07, 0.08, 0.16, 10);
  kit.add('metal', mats.metal, kettle, 3.5, 1.02, 7.35);
  kettle.dispose();

  // bathroom
  const bowl = new THREE.CylinderGeometry(0.18, 0.16, 0.28, 12);
  kit.add('dark', mats.dark, bowl, 2.35, 0.32, 0.75);
  bowl.dispose();
  kit.box('dark', mats.dark, 0.36, 0.28, 0.16, 2.55, 0.48, 0.58);
  kit.box('paint', mats.paint, 0.16, 0.04, 0.34, 2.35, 0.47, 0.75);
  kit.collide(2.4, 0.35, 0.7, 0.5, 0.7, 0.5);
  const sink = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.16, 0.4),
    cloneMat(mats.metal)
  );
  sink.position.set(2.55, 0.95, 2.05);
  sink.castShadow = true;
  sink.receiveShadow = true;
  sink.name = 'bathroom';
  specials.push(sink);
  kit.box('dark', mats.dark, 0.46, 0.7, 0.36, 2.58, 0.4, 2.05);
  kit.collide(2.55, 0.55, 2.05, 0.55, 1.15, 0.45);
  const basin = new THREE.CylinderGeometry(0.12, 0.1, 0.06, 12);
  kit.add('metal', mats.metal, basin, 2.5, 1.05, 2.05);
  basin.dispose();
  kit.box('mirror', mats.mirror, 0.36, 0.5, 0.02, 2.95, 1.45, 2.05);
  kit.box('emitTeal', mats.teal, 0.34, 0.03, 0.03, 2.9, 1.78, 2.05);

  // corridor clutter
  kit.box('dark', mats.dark, 0.42, 0.32, 0.42, -0.78, 0.16, 4.15);
  kit.box('orange', mats.orange, 0.44, 0.04, 0.44, -0.78, 0.34, 4.15);
  kit.collide(-0.78, 0.2, 4.15, 0.46, 0.4, 0.46);
  kit.box('metal', mats.metal, 0.28, 0.22, 0.22, 0.82, 0.11, 7.7);
  kit.collide(0.82, 0.12, 7.7, 0.3, 0.26, 0.24);

  // screens on corridor wall
  kit.box('screen', mats.screen, 0.02, 0.28, 0.46, -1.19, 1.45, 4.15);
  kit.box('dark', mats.dark, 0.03, 0.34, 0.52, -1.2, 1.45, 4.15);

  function addLabel(text, axis, fixed, inward, u, y) {
    const tex = makeLabelTexture(text);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.086), mat);
    const [x, yy, z] = wallPoint(axis, fixed, inward, u, y, 0.04);
    mesh.position.set(x, yy, z);
    if (axis === 'x') mesh.rotation.y = inward > 0 ? Math.PI / 2 : -Math.PI / 2;
    else if (inward < 0) mesh.rotation.y = Math.PI;
    mesh.userData.skipAO = true;
    specials.push(mesh);
  }
  addLabel('CREW', 'x', -1.22, 1, 1.55, 1.55);
  addLabel('GALLEY', 'x', 1.22, -1, 6.55, 1.55);
  addLabel('HEAD', 'x', 1.22, -1, 1.2, 1.55);
  addLabel('FLIGHT', 'z', 9.4, 1, 0, 1.7);

  // door chevrons
  function chevron(x, z, alongX) {
    for (let i = 0; i < 7; i++) {
      const matKey = i % 2 ? 'orange' : 'dark';
      const mat = i % 2 ? mats.orange : mats.dark;
      if (alongX) kit.box(matKey, mat, 0.08, 0.008, 0.7, x + (i - 3) * 0.08, 0.008, z);
      else kit.box(matKey, mat, 0.7, 0.008, 0.08, x, 0.008, z + (i - 3) * 0.08);
    }
  }
  chevron(-1.05, 2.0, false);
  chevron(1.05, 1.3, false);
  chevron(1.05, 6.7, false);

  // Bunk wall: the camera looks straight at this plane, so it cannot be bare.
  kit.box('metal', mats.metal, 0.22, 0.045, 1.55, -4.38, 1.48, 1.55);
  kit.box('dark', mats.dark, 0.08, 0.16, 0.08, -4.36, 1.4, 0.95);
  kit.box('dark', mats.dark, 0.08, 0.16, 0.08, -4.36, 1.4, 2.15);
  kit.box('orange', mats.orange, 0.12, 0.1, 0.16, -4.3, 1.56, 1.15);
  const mug = new THREE.CylinderGeometry(0.035, 0.04, 0.08, 8);
  kit.add('dark', mats.dark, mug, -4.32, 1.56, 1.85);
  mug.dispose();
  kit.box('metal', mats.metal, 0.06, 0.06, 1.7, -4.46, 1.95, 1.5);
  kit.box('emitWarm', mats.warm, 0.02, 0.035, 1.15, -4.4, 1.72, 1.55);
  kit.box('screen', mats.screen, 0.02, 0.28, 0.42, -4.4, 1.95, 2.45);
  kit.box('dark', mats.dark, 0.04, 0.34, 0.48, -4.43, 1.95, 2.45);
  kit.box('paintDeep', mats.paintDeep, 0.08, 0.55, 0.7, -4.4, 1.15, 3.15);
  for (let i = 0; i < 5; i++) {
    kit.rivet(-4.4, 1.28 + (i % 2) * 0.08, 2.85 + i * 0.12, 'x', 1);
  }

  // Viewport surround, seen large in the window shot.
  kit.box('emitTeal', mats.teal, 2.8, 0.025, 0.02, 0, 2.12, 14.94);
  kit.box('metal', mats.metal, 0.55, 0.35, 0.08, -2.05, 1.7, 14.9);
  kit.box('metal', mats.metal, 0.55, 0.35, 0.08, 2.05, 1.55, 14.9);
  kit.box('orange', mats.orange, 0.28, 0.08, 0.02, -2.05, 1.42, 14.88);
  kit.box('dark', mats.dark, 0.7, 0.05, 0.05, 0.4, 1.02, 14.9);
  for (let i = 0; i < 8; i++) {
    kit.rivet(-1.45 + i * 0.18, 0.98, 14.9, 'z', -1);
    kit.rivet(-1.45 + i * 0.18, 2.22, 14.9, 'z', -1);
  }
  for (let i = 0; i < 4; i++) {
    kit.box('dark', mats.dark, 0.08, 0.1, 0.04, -1.85, 1.15 + i * 0.22, 14.9);
    kit.box('dark', mats.dark, 0.08, 0.1, 0.04, 1.85, 1.15 + i * 0.22, 14.9);
  }

  let cycle = 0;
  let cycleTarget = 0;

  function applyCycle(k) {
    for (const light of cycleLights) {
      const u = light.userData;
      light.intensity = u.baseI * (1 - k + k * u.restScale);
      light.color.copy(u.baseColor).lerp(u.restColor, k);
    }
    for (const mat of cycleMats) {
      const u = mat.userData;
      if (u.baseE == null) continue;
      mat.emissiveIntensity = u.baseE * (1 - k + k * u.restScale);
    }
  }

  function update(dt) {
    if (Math.abs(cycle - cycleTarget) > 0.001) {
      cycle += (cycleTarget - cycle) * Math.min(1, dt * 1.6);
      applyCycle(cycle);
    }
  }

  kit.finalize(root);
  for (const mesh of specials) root.add(mesh);

  const interactables = [
    { id: 'bed', mesh: mattress, baseEmissive: 0 },
    { id: 'galley', mesh: counter, baseEmissive: 0 },
    { id: 'bathroom', mesh: sink, baseEmissive: 0 },
  ];

  return {
    root,
    colliders: kit.colliders,
    interactables,
    update,
    setCycle(v) { cycleTarget = v; },
    setCycleImmediate(v) {
      cycle = v;
      cycleTarget = v;
      applyCycle(v);
    },
    getCycle: () => cycle,
  };
}
