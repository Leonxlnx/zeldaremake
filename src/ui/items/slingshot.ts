/**
 * Slingshot (Fairy Slingshot) — a forked branch cut and smoothed: a wrapped grip, two curving
 * prongs bound with cord at the tips, a leather pouch hung on two pale rubber bands, and a
 * single Deku seed sitting in the pouch. Original shapes.
 */
import { DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, TubeGeometry, Vector3, CatmullRomCurve3 } from 'three';
import { bark, bezierPath, circleSection, hsl, leather, paintTexture, sweep } from './shape';

export function buildSlingshot(): Group {
  const group = new Group();
  const seed = 0x51a6;
  const woodMat = new MeshStandardMaterial({ map: paintTexture(256, 256, (c, r) => bark(c, r, 256, 256, 32, 0.46), seed, true), roughness: 0.8, metalness: 0 });
  const cordMat = new MeshStandardMaterial({ color: 0xc9b27a, roughness: 0.95 });
  const bandMat = new MeshStandardMaterial({ color: 0xe6d6b5, roughness: 0.55, metalness: 0 });
  const pouchMat = new MeshStandardMaterial({ map: paintTexture(128, 128, (c, r) => leather(c, r, 128, 128, 24, 0.28), seed + 1), roughness: 0.9, side: DoubleSide });
  const seedMat = new MeshStandardMaterial({ color: 0x6d4a26, roughness: 0.5 });
  const wrapMat = new MeshStandardMaterial({
    map: paintTexture(
      64,
      64,
      (ctx) => {
        ctx.fillStyle = hsl(20, 0.45, 0.24);
        ctx.fillRect(0, 0, 64, 64);
        ctx.strokeStyle = hsl(20, 0.4, 0.12, 0.9);
        ctx.lineWidth = 3;
        for (let y = -10; y < 80; y += 11) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(64, y + 16);
          ctx.stroke();
        }
      },
      seed + 2,
      true,
    ),
    roughness: 0.9,
  });

  // handle: slightly bent, thicker at the bottom
  const base = new Vector3(0, -0.22, 0);
  const crotch = new Vector3(0.01, 0.0, 0.01);
  const handle = sweep({
    path: bezierPath(base, new Vector3(-0.015, -0.1, 0.02), crotch),
    section: circleSection((t) => 0.024 * (1 - t * 0.2) * (1 + 0.08 * Math.sin(t * 13)), 12),
    segments: 16,
    caps: true,
  });
  group.add(new Mesh(handle, woodMat));
  const wrap = sweep({
    path: bezierPath(new Vector3(0, -0.2, 0), new Vector3(-0.012, -0.12, 0.016), new Vector3(0.002, -0.06, 0.007)),
    section: circleSection(() => 0.027, 12),
    segments: 8,
    caps: true,
  });
  group.add(new Mesh(wrap, wrapMat));

  // prongs: fork out and up, curving back inward at the tips
  const tipL = new Vector3(-0.12, 0.2, 0.0);
  const tipR = new Vector3(0.13, 0.19, -0.01);
  const prong = (tip: Vector3, ctrl: Vector3) =>
    sweep({
      path: bezierPath(crotch, ctrl, tip),
      section: circleSection((t) => 0.019 * (1 - t * 0.35) * (1 + 0.07 * Math.sin(t * 17 + 2)), 10),
      segments: 14,
      caps: true,
    });
  group.add(new Mesh(prong(tipL, new Vector3(-0.11, 0.06, 0.02)), woodMat));
  group.add(new Mesh(prong(tipR, new Vector3(0.12, 0.05, -0.01)), woodMat));
  // cord bindings near the tips
  for (const tip of [tipL, tipR]) {
    const bind = sweep({
      path: (t) => tip.clone().add(new Vector3(0, -0.035 + t * 0.03, 0)),
      section: circleSection((t) => 0.0195 * (1 + 0.15 * Math.sin(t * Math.PI * 6)), 12),
      segments: 8,
      caps: true,
    });
    group.add(new Mesh(bind, cordMat));
  }

  // pouch: a small curved leather rectangle behind the fork, hanging on the bands
  const pouchPos = new Vector3(0.0, 0.08, -0.17);
  const pouch = new Mesh(new PlaneGeometry(0.075, 0.045, 8, 4), pouchMat);
  const pp = pouch.geometry.attributes.position;
  for (let i = 0; i < pp.count; i++) pp.setZ(i, -0.012 * (1 - (pp.getX(i) / 0.0375) ** 2) - 0.004 * (1 - (pp.getY(i) / 0.0225) ** 2));
  pp.needsUpdate = true;
  pouch.geometry.computeVertexNormals();
  pouch.position.copy(pouchPos);
  pouch.rotation.x = 0.35;
  group.add(pouch);
  const seedBall = new Mesh(new SphereGeometry(0.014, 14, 10), seedMat);
  seedBall.position.copy(pouchPos).add(new Vector3(0, 0.002, 0.008));
  group.add(seedBall);

  // bands from the prong tips to the pouch edges (slack, catenary-ish)
  for (const [tip, side] of [
    [tipL, -1],
    [tipR, 1],
  ] as [Vector3, number][]) {
    const end = pouchPos.clone().add(new Vector3(side * 0.036, 0.006, 0));
    const curve = new CatmullRomCurve3([tip.clone().add(new Vector3(0, -0.02, 0)), tip.clone().lerp(end, 0.5).add(new Vector3(0, -0.02, 0.01)), end]);
    group.add(new Mesh(new TubeGeometry(curve, 16, 0.0045, 8, false), bandMat));
  }

  group.rotation.set(0.25, -0.3, 0.1);
  return group;
}
