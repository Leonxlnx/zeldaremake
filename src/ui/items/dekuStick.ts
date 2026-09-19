/**
 * Deku Stick — a gnarled branch about a metre long: a wobbling centre-line with varying girth,
 * a fork at the top with two prongs, a side twig carrying a couple of leaves and a knot. The
 * HUD's slot draws the same silhouette in 2-D (itemSlot.ts).
 */
import { DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';
import { bark, bezierPath, circleSection, hsl, paintTexture, sweep } from './shape';
import { seeded } from '../svg';

export function buildDekuStick(): Group {
  const group = new Group();
  const seed = 0x57ac;
  const barkMat = new MeshStandardMaterial({ map: paintTexture(256, 512, (c, r) => bark(c, r, 256, 512, 28, 0.36), seed, true), roughness: 0.95, metalness: 0 });
  const leafMat = new MeshStandardMaterial({
    map: paintTexture(
      128,
      128,
      (ctx, rng) => {
        ctx.clearRect(0, 0, 128, 128);
        ctx.fillStyle = hsl(95, 0.5, 0.36);
        ctx.beginPath();
        ctx.moveTo(64, 4);
        ctx.bezierCurveTo(118, 40, 110, 100, 64, 124);
        ctx.bezierCurveTo(18, 100, 10, 40, 64, 4);
        ctx.fill();
        ctx.strokeStyle = hsl(95, 0.45, 0.22, 0.8);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(64, 8);
        ctx.lineTo(64, 120);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) {
          const y = 24 + i * 16;
          ctx.beginPath();
          ctx.moveTo(64, y);
          ctx.quadraticCurveTo(64 + 24, y + 6, 64 + 36 - i * 3, y + 22);
          ctx.moveTo(64, y);
          ctx.quadraticCurveTo(64 - 24, y + 6, 64 - 36 + i * 3, y + 22);
          ctx.stroke();
        }
        for (let i = 0; i < 300; i++) {
          ctx.fillStyle = hsl(95 + (rng() - 0.5) * 20, 0.5, 0.3 + rng() * 0.2, 0.3);
          ctx.fillRect(rng() * 128, rng() * 128, 1, 1);
        }
      },
      seed + 1,
    ),
    transparent: true,
    alphaTest: 0.4,
    side: DoubleSide,
    roughness: 0.7,
    metalness: 0,
  });

  const rng = seeded(seed);
  const wobble = Array.from({ length: 8 }, () => [(rng() - 0.5) * 0.05, (rng() - 0.5) * 0.05] as [number, number]);
  const shaftPath = (t: number) => {
    const k = t * (wobble.length - 1);
    const i = Math.min(wobble.length - 2, Math.floor(k));
    const f = k - i;
    const s = f * f * (3 - 2 * f);
    const x = wobble[i][0] * (1 - s) + wobble[i + 1][0] * s;
    const z = wobble[i][1] * (1 - s) + wobble[i + 1][1] * s;
    return new Vector3(x + t * 0.08, -0.5 + t * 1.0, z);
  };
  const girth = (t: number) => 0.021 * (1 - t * 0.35) * (1 + 0.16 * Math.sin(t * 19) + 0.1 * Math.sin(t * 7 + 1));
  const shaft = sweep({ path: shaftPath, section: circleSection(girth, 12, 0.9), segments: 40, caps: true });
  group.add(new Mesh(shaft, barkMat));

  const top = shaftPath(1);
  const prong = (dir: Vector3, len: number, r0: number) =>
    sweep({
      path: bezierPath(top.clone(), top.clone().add(dir.clone().multiplyScalar(len * 0.5)).add(new Vector3(0, len * 0.35, 0)), top.clone().add(dir.clone().multiplyScalar(len)).add(new Vector3(0, len * 0.7, 0))),
      section: circleSection((t) => r0 * (1 - t * 0.8), 9),
      segments: 10,
      caps: true,
    });
  group.add(new Mesh(prong(new Vector3(-0.35, 0, 0.1), 0.16, 0.011), barkMat));
  group.add(new Mesh(prong(new Vector3(0.45, 0, -0.15), 0.21, 0.012), barkMat));

  // side twig at a third of the height with two leaves
  const twigBase = shaftPath(0.62);
  const twigTip = twigBase.clone().add(new Vector3(0.19, 0.09, 0.06));
  const twig = sweep({
    path: bezierPath(twigBase, twigBase.clone().add(new Vector3(0.1, 0.02, 0.04)), twigTip),
    section: circleSection((t) => 0.008 * (1 - t * 0.7), 8),
    segments: 8,
    caps: true,
  });
  group.add(new Mesh(twig, barkMat));
  for (const [off, rot, size] of [
    [new Vector3(0, 0.005, 0), [0.4, 0.3, -0.9], 0.11],
    [new Vector3(-0.06, -0.01, 0.01), [-0.5, 1.2, 0.6], 0.085],
  ] as [Vector3, [number, number, number], number][]) {
    const leaf = new Mesh(new PlaneGeometry(size * 0.6, size), leafMat);
    leaf.position.copy(twigTip).add(off);
    leaf.rotation.set(rot[0], rot[1], rot[2]);
    group.add(leaf);
  }
  // a knot bump
  const knot = new Mesh(sweep({ path: (t) => shaftPath(0.3 + t * 0.06), section: circleSection((t) => girth(0.33) * (1.15 + 0.5 * Math.sin(t * Math.PI)), 12, 0.9), segments: 6, caps: true }), barkMat);
  group.add(knot);

  group.rotation.z = -0.55;
  return group;
}
