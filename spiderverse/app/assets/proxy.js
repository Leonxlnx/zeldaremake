// Proxy assets. Owner: director. Each factory honours the same contract as the real asset in
// docs/INTERFACES.md, so the harness can render the whole film before (or without) any real
// asset, and swap each one in the moment it loads. Proxies are deliberately plain; they exist so
// staging, timing and continuity can be judged early.

import * as layout from '../core/layout.js';
import { rng } from '../core/prng.js';

function makeMat(THREE, look, p) {
  if (look && typeof look.makeLookMaterial === 'function') {
    try {
      return look.makeLookMaterial(p);
    } catch (e) {
      console.warn('[proxy] makeLookMaterial failed, using Lambert:', e.message);
    }
  }
  const m = new THREE.MeshLambertMaterial({ color: p.color, side: p.side || THREE.FrontSide });
  if (p.glow) m.emissive = new THREE.Color(p.color).multiplyScalar(p.glow);
  return m;
}

/** Orientation basis from a surface normal and a heading (local +X forward, +Y up). */
export function orientFromUpHeading(THREE, up, heading, target) {
  const U = new THREE.Vector3(up[0], up[1], up[2]).normalize();
  const ref = Math.abs(U.x) > 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const F = ref.clone().sub(U.clone().multiplyScalar(ref.dot(U))).normalize();
  F.applyAxisAngle(U, heading || 0);
  const Z = new THREE.Vector3().crossVectors(F, U).normalize();
  const m = new THREE.Matrix4().makeBasis(F, U, Z);
  target.quaternion.setFromRotationMatrix(m);
}

// ---------------------------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------------------------

const VARIANT = {
  courier: { len: 7.0, color: '#15101f', accent: '#E8202A', head: 1.0 },
  little: { len: 4.0, color: '#C9812F', accent: '#FFB21E', head: 1.35 },
  sibTall: { len: 4.6, color: '#B8892E', accent: '#E0B050', head: 1.2 },
  sibRound: { len: 3.8, color: '#9A4424', accent: '#C9602F', head: 1.3 },
  worker: { len: 6.4, color: '#2a1a14', accent: '#4a2a1c', head: 1.0 },
};

export function createAnt({ THREE, look, variant = 'courier', seed = 0 }) {
  const v = VARIANT[variant] || VARIANT.worker;
  const s = v.len / 7.0;
  const root = new THREE.Group();
  root.name = `proxyAnt:${variant}`;
  const body = new THREE.Group();
  root.add(body);
  const shell = makeMat(THREE, look, { color: v.color, matId: 1, gloss: 0.8, inkWeight: 1, halftone: 0.6, rim: 0.6, rimColor: '#FF2E88' });
  const accent = makeMat(THREE, look, { color: v.accent, matId: 2, inkWeight: 1, halftone: 0.5 });
  const eyeMat = makeMat(THREE, look, { color: '#F5F5FF', matId: 3, gloss: 1, inkWeight: 1 });

  const ell = (rx, ry, rz, mat) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
    m.scale.set(rx, ry, rz);
    return m;
  };
  const standH = 1.35 * s;
  const thorax = ell(1.25 * s, 0.7 * s, 0.62 * s, shell);
  thorax.position.set(0.2 * s, standH, 0);
  const gaster = ell(1.55 * s, 1.1 * s, 1.05 * s, shell);
  gaster.position.set(-2.1 * s, standH + 0.25 * s, 0);
  const band = ell(1.2 * s, 0.9 * s, 1.07 * s, accent);
  band.position.set(-1.7 * s, standH + 0.25 * s, 0);
  band.scale.x = 0.25 * s;
  const headG = new THREE.Group();
  headG.position.set(1.9 * s, standH + 0.35 * s, 0);
  const head = ell(0.95 * s * v.head, 0.85 * s * v.head, 0.9 * s * v.head, shell);
  headG.add(head);
  const eyeL = ell(0.34 * s * v.head, 0.42 * s * v.head, 0.2 * s * v.head, eyeMat);
  eyeL.position.set(0.45 * s * v.head, 0.18 * s * v.head, 0.62 * s * v.head);
  const eyeR = eyeL.clone();
  eyeR.position.z *= -1;
  headG.add(eyeL, eyeR);
  body.add(thorax, gaster, band, headG);

  const limbMat = shell;
  const seg = (len, r) => {
    const g = new THREE.CylinderGeometry(r, r * 0.8, len, 6);
    g.translate(0, -len / 2, 0);
    return new THREE.Mesh(g, limbMat);
  };
  const legs = [];
  const hips = [
    [0.9, 1], [0.2, 1], [-0.5, 1],
    [0.9, -1], [0.2, -1], [-0.5, -1],
  ];
  for (const [x, side] of hips) {
    const hip = new THREE.Group();
    hip.position.set(x * s, standH - 0.1 * s, side * 0.45 * s);
    const femur = seg(1.9 * s, 0.13 * s);
    const knee = new THREE.Group();
    knee.position.y = -1.9 * s;
    const tibia = seg(2.1 * s, 0.1 * s);
    knee.add(tibia);
    femur.add(knee);
    hip.add(femur);
    body.add(hip);
    legs.push({ hip, femur, knee, side, x });
  }
  const antennae = [];
  for (const side of [1, -1]) {
    const a = new THREE.Group();
    a.position.set(0.6 * s * v.head, 0.5 * s * v.head, side * 0.35 * s * v.head);
    const scape = seg(1.6 * s, 0.08 * s);
    const elbow = new THREE.Group();
    elbow.position.y = -1.6 * s;
    const fun = seg(1.9 * s, 0.07 * s);
    elbow.add(fun);
    scape.add(elbow);
    a.add(scape);
    headG.add(a);
    antennae.push({ a, scape, elbow, side });
  }
  const carryHook = new THREE.Group();
  carryHook.position.set(2.9 * s, standH + 0.1 * s, 0);
  body.add(carryHook);
  const shadowMat = makeMat(THREE, look, { color: '#0b0714', matId: 4, inkWeight: 0, halftone: 0 });
  const contactShadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24), shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.scale.set(3.4 * s, 1.5 * s, 1);
  contactShadow.position.y = 0.03;
  root.add(contactShadow);

  const parts = { head: headG, thorax, gaster, eyes: [eyeL, eyeR], legs, antennae, carryHook, contactShadow };

  function setPose(st = {}) {
    const p = st.position || [0, 0, 0];
    root.position.set(p[0], p[1], p[2]);
    orientFromUpHeading(THREE, st.up || [0, 1, 0], st.heading || 0, root);
    body.rotation.set(st.roll || 0, 0, st.pitch || 0);
    body.position.y = st.bob || 0;
    const k = st.stretch || 1;
    body.scale.set(k, 1 / Math.sqrt(k), 1 / Math.sqrt(k));
    headG.rotation.set(0, st.headYaw || 0, st.headPitch || 0);
    const g = st.gait || {};
    const speed = g.speed || 0;
    const ph = (g.phase || 0) * Math.PI * 2;
    legs.forEach((L, i) => {
      const tripod = (i === 0 || i === 2 || i === 4) ? 0 : Math.PI;
      const swing = Math.sin(ph + tripod) * speed;
      L.hip.rotation.set(L.side * 1.05, swing * 0.7, 0);
      L.knee.rotation.set(-L.side * 1.6 + Math.max(0, Math.cos(ph + tripod)) * speed * 0.4 * L.side, 0, 0);
    });
    const an = st.antennae || {};
    antennae.forEach((A) => {
      const s2 = A.side > 0 ? an.L || {} : an.R || {};
      A.a.rotation.set(-A.side * 0.4 + (s2.yaw || 0) * A.side, 0, -1.9 + (s2.pitch || 0));
      A.elbow.rotation.set(0, 0, 1.5 + (s2.curl || 0));
    });
    const e = st.eyes || {};
    const ey = 1 + (e.widen || 0) * 0.35 - (e.squint || 0) * 0.5 - (e.blink || 0) * 0.9;
    [eyeL, eyeR].forEach((m) => (m.scale.y = 0.42 * s * v.head * Math.max(0.08, ey)));
    contactShadow.visible = (st.contactShadow ?? 1) > 0.05;
  }
  setPose({});
  return {
    root,
    setPose,
    parts,
    audit: () => ({ triangles: 0, meshes: 0, setae: 0, proxy: true }),
  };
}

export function createColony({ THREE, look, count = 24, seed = 1 }) {
  const root = new THREE.Group();
  const members = [];
  for (let i = 0; i < count; i++) {
    const a = createAnt({ THREE, look, variant: 'worker', seed: seed * 100 + i });
    a.root.visible = false;
    root.add(a.root);
    members.push(a);
  }
  return {
    root,
    members,
    setPoses(states = []) {
      members.forEach((m, i) => {
        const st = states[i];
        m.root.visible = !!st;
        if (st) m.setPose(st);
      });
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------------------------

export function createProp(name, { THREE, look }) {
  const root = new THREE.Group();
  root.name = `proxyProp:${name}`;
  let setState = () => {};
  const M = (p) => makeMat(THREE, look, p);

  if (name === 'crumb') {
    const g = new THREE.IcosahedronGeometry(5.2, 2);
    const r = rng(11);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const k = 0.8 + r() * 0.35;
      pos.setXYZ(i, pos.getX(i) * k * 1.1, pos.getY(i) * k * 0.75, pos.getZ(i) * k);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, M({ color: '#E0A040', matId: 6, inkWeight: 0.9, halftone: 0.7, glow: 0.05 }));
    m.position.y = 3.6;
    const chip = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), M({ color: '#3B2012', matId: 7, gloss: 0.9 }));
    chip.position.set(2.2, 6.0, 1.2);
    root.add(m, chip);
    setState = (s = {}) => {
      if (s.position) root.position.set(...s.position);
      if (s.rotation) root.rotation.set(...s.rotation);
      const q = s.squash || 1;
      root.scale.set(1 / Math.sqrt(q), q, 1 / Math.sqrt(q));
    };
  } else if (name === 'mug') {
    const { height: H, bodyRadius: R, footRadius: FR, footHeight: FH } = layout.MUG;
    const prof = [
      [0, 0], [FR, 0], [FR, FH], [R - 3, FH + 4], [R, 18], [R, H - 6], [R + 1.5, H - 2], [R, H],
      [R - 5.5, H], [R - 5.5, 12], [0, 12],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), M({ color: '#F2EEE4', matId: 6, gloss: 0.7, inkWeight: 0.8, halftone: 0.5, side: THREE.DoubleSide }));
    const stripeMat = M({ color: '#E8202A', matId: 7, inkWeight: 0.3 });
    const st1 = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.3, R + 0.3, 3, 48, 1, true), stripeMat);
    st1.position.y = H - 18;
    const st2 = st1.clone();
    st2.position.y = H - 25;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(22, 5, 10, 24, Math.PI * 1.2), M({ color: '#F2EEE4', matId: 6, gloss: 0.7, inkWeight: 0.8 }));
    handle.position.set(layout.MUG.handleSide * (R + 4), H * 0.55, 0);
    handle.rotation.z = layout.MUG.handleSide > 0 ? -Math.PI * 0.6 : Math.PI * 0.4;
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(R - 5.6, 40), M({ color: '#1a0d06', matId: 7, gloss: 1 }));
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = H - 12;
    root.add(body, st1, st2, handle, coffee);
    setState = (s = {}) => {
      const p = s.position || layout.MUG.landing;
      root.position.set(p[0], s.y ?? p[1], p[2]);
      const t = s.tilt || [0, 0];
      root.rotation.set(t[0], 0, t[1]);
      const q = s.squash || 1;
      root.scale.set(1 / Math.sqrt(q), q, 1 / Math.sqrt(q));
      coffee.position.y = H - 12 + (s.coffeeSlosh || 0) * 4;
    };
  } else if (name === 'sponge') {
    const [sx, sy, sz] = layout.SPONGE.size;
    const y = new THREE.Mesh(new THREE.BoxGeometry(sx, sy * 0.72, sz), M({ color: '#F4C430', matId: 15, inkWeight: 0.8, halftone: 0.6 }));
    y.position.y = sy * 0.36;
    const gr = new THREE.Mesh(new THREE.BoxGeometry(sx, sy * 0.28, sz), M({ color: '#2E8B3A', matId: 15, inkWeight: 0.8 }));
    gr.position.y = sy * 0.86;
    root.add(y, gr);
    setState = (s = {}) => {
      if (s.position) root.position.set(...s.position);
      if (s.rotation) root.rotation.set(...s.rotation);
      const q = s.squash || 1;
      root.scale.set(1 / Math.sqrt(q), q, 1 / Math.sqrt(q));
    };
  } else if (name === 'cap') {
    const { radius: R, height: H } = layout.CAP;
    const prof = [[0, 0], [R, 0], [R, H], [R - 1.2, H], [R - 1.2, 1.2], [0, 1.2]].map(([x, y]) => new THREE.Vector2(x, y));
    root.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 21), M({ color: layout.CAP.color, matId: 15, gloss: 0.8, inkWeight: 0.9, halftone: 0.6, side: THREE.DoubleSide })));
    setState = (s = {}) => {
      const p = s.position || layout.CAP.position;
      root.position.set(p[0], p[1] + (s.bob || 0), p[2]);
      const r = s.rotation || [0, 0, 0];
      root.rotation.set(r[0], r[1] + (s.spin || 0), r[2]);
    };
    setState({});
  } else if (name === 'toothpick') {
    const L = layout.TOOTHPICK.length;
    const g = new THREE.CylinderGeometry(layout.TOOTHPICK.radius, layout.TOOTHPICK.radius, L, 8);
    g.translate(0, L / 2, 0);
    root.add(new THREE.Mesh(g, M({ color: '#E8D2A0', matId: 15, inkWeight: 0.7 })));
    setState = (s = {}) => {
      if (s.position) root.position.set(...s.position);
      if (s.rotation) root.rotation.set(...s.rotation);
    };
    const b = layout.TOOTHPICK.base;
    const t = layout.TOOTHPICK.tip;
    root.position.set(...b);
    const dir = new THREE.Vector3(t[0] - b[0], t[1] - b[1], t[2] - b[2]).normalize();
    root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  } else if (name === 'cuttingBoard') {
    const { min, max } = layout.CUTTING_BOARD;
    const m = new THREE.Mesh(new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), M({ color: '#C8864A', matId: 15, inkWeight: 0.6, halftone: 0.4, brush: 0.8 }));
    m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    root.add(m);
  } else if (name === 'sugarGrains') {
    const N = 900;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M({ color: '#F4F1EA', matId: 15, gloss: 0.9, inkWeight: 0.4 }), N);
    const r = rng(7);
    const base = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const cluster = r();
      let x, z;
      if (cluster < 0.4) {
        x = 150 + (r() - 0.5) * 160;
        z = -470 + (r() - 0.5) * 140;
      } else if (cluster < 0.7) {
        x = -150 + r() * 330;
        z = -520 + (r() - 0.5) * 60;
      } else {
        x = 220 + r() * 80;
        z = -470 + (r() - 0.5) * 100;
      }
      const sz = 0.4 + r() * 0.8;
      base.push({ x, z, sz, ry: r() * 6.28, rx: r() * 0.4 });
    }
    const apply = (jump = 0, scatter = 0) => {
      base.forEach((b, i) => {
        const dx = b.x - layout.MUG.landing[0];
        const dz = b.z - layout.MUG.landing[2];
        const d = Math.hypot(dx, dz);
        const near = Math.max(0, 1 - d / 120);
        const hop = jump * near * (3 + (i % 5));
        const push = scatter * near * 25;
        dummy.position.set(b.x + (dx / (d || 1)) * push, b.sz / 2 + hop, b.z + (dz / (d || 1)) * push);
        dummy.rotation.set(b.rx + hop * 0.3, b.ry, 0);
        dummy.scale.setScalar(b.sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    apply();
    root.add(mesh);
    setState = (s = {}) => apply(s.jump || 0, s.scatter || 0);
  } else if (name === 'hand') {
    const skin = M({ color: '#E0A27A', matId: 15, inkWeight: 0.9, halftone: 0.5 });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(80, 25, 90), skin);
    root.add(palm);
    const fingers = [];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(70, 18, 18), skin);
      f.geometry.translate(35, 0, 0);
      f.position.set(40, 0, -33 + i * 22);
      root.add(f);
      fingers.push(f);
    }
    setState = (s = {}) => {
      root.visible = s.visible ?? true;
      if (s.position) root.position.set(...s.position);
      if (s.rotation) root.rotation.set(...s.rotation);
      fingers.forEach((f) => (f.rotation.z = -(s.grip || 0) * 1.4));
    };
    root.visible = false;
  } else if (name === 'spoon') {
    const steel = M({ color: '#B9C3CC', matId: 15, gloss: 1, inkWeight: 0.6 });
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), steel);
    bowl.scale.set(18, 4, 12);
    bowl.position.set(-30, 3, -512);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(95, 2.5, 8), steel);
    handle.position.set(30, 2, -512);
    root.add(bowl, handle);
  }
  return { root, setState, audit: () => ({ proxy: true }) };
}

// ---------------------------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------------------------

export function createKitchen({ THREE, look }) {
  const root = new THREE.Group();
  root.name = 'proxyKitchen';
  const M = (p) => makeMat(THREE, look, p);
  const C = layout.COUNTER;
  const counter = new THREE.Mesh(new THREE.PlaneGeometry(C.maxX - C.minX, C.frontZ - C.backZ), M({ color: '#1F8A8F', matId: 8, inkWeight: 0.2, halftone: 0.3, screen: 'triplanar' }));
  counter.rotation.x = -Math.PI / 2;
  counter.position.set((C.minX + C.maxX) / 2, 0, (C.backZ + C.frontZ) / 2);
  const W = layout.WALL;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(W.maxX - W.minX, W.height), M({ color: '#EDE3CF', matId: 9, inkWeight: 0.3, halftone: 0.3 }));
  wall.position.set((W.minX + W.maxX) / 2, W.height / 2, W.z);
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(layout.NEST.opening[0], layout.NEST.opening[1]), M({ color: '#FFB21E', matId: 10, glow: 1.2 }));
  crack.position.set(layout.NEST.entrance[0], layout.NEST.lipY + layout.NEST.opening[1] / 2, W.z + 0.2);
  const sink = new THREE.Mesh(new THREE.PlaneGeometry(440, 600), M({ color: '#8C98A4', matId: 11, gloss: 0.8 }));
  sink.rotation.x = -Math.PI / 2;
  sink.position.set(layout.SINK.edgeX - 220, -layout.SINK.basinDepth, -300);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(layout.WINDOW.size[0], layout.WINDOW.size[1]), M({ color: '#1B1242', matId: 11, glow: 0.2 }));
  win.position.set(...layout.WINDOW.center);
  root.add(counter, wall, crack, sink, win);
  return { root, update() {}, audit: () => ({ proxy: true }) };
}

export function createNest({ THREE, look }) {
  const root = new THREE.Group();
  root.name = 'proxyNest';
  const o = layout.NEST.interiorOrigin;
  const room = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), makeMat(THREE, look, { color: '#8A5A34', matId: 13, side: THREE.BackSide, brush: 0.8 }));
  room.scale.set(1.3, 0.6, 1.0);
  room.position.set(o[0], 20, o[2] - 30);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(48, 32), makeMat(THREE, look, { color: '#6E4526', matId: 13 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(o[0], 0.01, o[2] - 30);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(2.5, 12, 8), makeMat(THREE, look, { color: '#FFB21E', matId: 14, glow: 1.5 }));
  glow.position.set(o[0] + 18, 26, o[2] - 40);
  root.add(room, floor, glow);
  const anchors = {
    larder: [o[0] - 20, 0, o[2] - 40],
    nursery: [o[0] + 15, 0, o[2] - 35],
    entranceInside: [o[0], 6, layout.NEST.entrance[2] - 8],
    entranceLedge: [o[0], 6, layout.NEST.entrance[2] - 2],
    chainAnchor: [layout.NEST.entrance[0], layout.NEST.lipY, layout.NEST.entrance[2] + 0.5],
    homeTable: [o[0], 0, o[2] - 30],
  };
  return { root, anchors, update() {}, audit: () => ({ proxy: true }) };
}

// ---------------------------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------------------------

export function createWater({ THREE, look }) {
  const root = new THREE.Group();
  root.name = 'proxyWater';
  const W = layout.WATER;
  const len = W.sourceX - W.dropX;
  const river = new THREE.Mesh(new THREE.PlaneGeometry(len, W.channelMaxZ - W.channelMinZ), makeMat(THREE, look, { color: '#2A4BD7', matId: 12, gloss: 1, inkWeight: 0.3, halftone: 0.5 }));
  river.rotation.x = -Math.PI / 2;
  river.position.set((W.sourceX + W.dropX) / 2, W.level, (W.channelMinZ + W.channelMaxZ) / 2);
  const torrent = new THREE.Mesh(new THREE.CylinderGeometry(6, 10, layout.SPONGE.wringPoint[1], 12, 1, true), makeMat(THREE, look, { color: '#6FB6FF', matId: 12, gloss: 1 }));
  torrent.position.set(layout.SPONGE.wringPoint[0], layout.SPONGE.wringPoint[1] / 2, layout.SPONGE.wringPoint[2]);
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(W.channelMaxZ - W.channelMinZ, layout.SINK.basinDepth), makeMat(THREE, look, { color: '#4C7BFF', matId: 12, side: THREE.DoubleSide }));
  fall.rotation.y = Math.PI / 2;
  fall.position.set(W.dropX - 1, -layout.SINK.basinDepth / 2, (W.channelMinZ + W.channelMaxZ) / 2);
  root.add(river, torrent, fall);
  return {
    root,
    setState(frame, s = {}) {
      const lv = s.level ?? 0;
      river.visible = lv > 0.01;
      river.scale.set(Math.max(0.01, lv), 1, 1);
      river.position.x = W.sourceX - (len * lv) / 2;
      torrent.visible = (s.torrent || 0) > 0.01;
      fall.visible = (s.dropFall || 0) > 0.01;
    },
    audit: () => ({ proxy: true }),
  };
}
