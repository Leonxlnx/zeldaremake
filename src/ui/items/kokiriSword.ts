/**
 * Kokiri Sword — a child-sized short sword: a tapering steel blade with a diamond section and a
 * shallow fuller, a curved brass guard set with a small red stone, a leather-wrapped grip and a
 * round pommel; its scabbard (dark leather over wood, brass throat and chape) lies behind it at
 * an angle. Original shapes.
 */
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { bezierPath, circleSection, hsl, linePath, paintTexture, sweep, leather } from './shape';

export function buildKokiriSword(): Group {
  const group = new Group();
  const seed = 0x5a0d;
  const steel = new MeshStandardMaterial({ color: 0xd9dde3, roughness: 0.28, metalness: 0.95 });
  const brass = new MeshStandardMaterial({ color: 0xb98a3a, roughness: 0.42, metalness: 0.85 });
  const gripMat = new MeshStandardMaterial({
    map: paintTexture(
      128,
      256,
      (ctx, rng) => {
        leather(ctx, rng, 128, 256, 22, 0.2);
        // diagonal wrap seams
        ctx.strokeStyle = hsl(22, 0.35, 0.08, 0.85);
        ctx.lineWidth = 4;
        for (let y = -40; y < 300; y += 26) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(128, y + 40);
          ctx.stroke();
        }
        ctx.strokeStyle = hsl(24, 0.35, 0.34, 0.5);
        ctx.lineWidth = 1.2;
        for (let y = -36; y < 300; y += 26) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(128, y + 40);
          ctx.stroke();
        }
      },
      seed,
      true,
    ),
    roughness: 0.9,
    metalness: 0,
  });
  const scabMat = new MeshStandardMaterial({ map: paintTexture(128, 512, (c, r) => leather(c, r, 128, 512, 18, 0.17), seed + 3, true), roughness: 0.75, metalness: 0.02 });
  const gem = new MeshStandardMaterial({ color: 0xc0202a, roughness: 0.15, metalness: 0.1, emissive: 0x500008 });

  // ---- blade: y from 0 (guard) to 0.46 (tip), diamond section tapering to a point ----
  const bladeLen = 0.46;
  const blade = sweep({
    path: linePath(new Vector3(0, 0, 0), new Vector3(0, bladeLen, 0)),
    section: (t) => {
      const taper = t < 0.72 ? 1 - t * 0.18 : (1 - 0.72 * 0.18) * (1 - (t - 0.72) / 0.28) ** 0.85;
      const hw = 0.032 * taper + 0.0004;
      const th = 0.007 * taper + 0.0003;
      // diamond with a slight fuller: extra points along the flats
      return [
        [hw, 0],
        [hw * 0.55, th * 0.72],
        [0, th],
        [-hw * 0.55, th * 0.72],
        [-hw, 0],
        [-hw * 0.55, -th * 0.72],
        [0, -th],
        [hw * 0.55, -th * 0.72],
      ];
    },
    segments: 28,
    caps: true,
  });
  const bladeMesh = new Mesh(blade, steel);
  group.add(bladeMesh);

  // ---- guard: a shallow crescent bar with upturned ends ----
  const guard = sweep({
    path: bezierPath(new Vector3(-0.085, 0.012, 0), new Vector3(0, -0.02, 0), new Vector3(0.085, 0.012, 0)),
    section: (t) => {
      const w = 0.012 * (1 - Math.abs(t - 0.5) * 0.8);
      const d = 0.02 * (1 - Math.abs(t - 0.5) * 1.1);
      return [
        [-w, -d],
        [w, -d],
        [w * 1.3, 0],
        [w, d],
        [-w, d],
        [-w * 1.3, 0],
      ];
    },
    segments: 24,
    caps: true,
  });
  group.add(new Mesh(guard, brass));
  const collar = new Mesh(new CylinderGeometry(0.022, 0.03, 0.02, 16), brass);
  collar.position.y = -0.012;
  group.add(collar);
  const stone = new Mesh(new SphereGeometry(0.011, 16, 12), gem);
  stone.position.set(0, -0.003, 0.022);
  stone.scale.z = 0.5;
  group.add(stone);

  // ---- grip + pommel ----
  const grip = sweep({
    path: linePath(new Vector3(0, -0.02, 0), new Vector3(0, -0.13, 0)),
    section: circleSection((t) => 0.0165 - Math.sin(t * Math.PI) * 0.0015, 14, 0.8),
    segments: 10,
  });
  group.add(new Mesh(grip, gripMat));
  const pommel = new Mesh(new SphereGeometry(0.024, 20, 14), brass);
  pommel.position.y = -0.148;
  pommel.scale.set(1, 0.85, 0.8);
  group.add(pommel);
  const pommelRing = new Mesh(new CylinderGeometry(0.02, 0.02, 0.012, 16), brass);
  pommelRing.position.y = -0.13;
  group.add(pommelRing);

  // ---- scabbard: behind the blade, tilted, with brass throat and chape ----
  const scab = new Group();
  const scabLen = bladeLen + 0.02;
  const body = sweep({
    path: linePath(new Vector3(0, 0, 0), new Vector3(0, -scabLen, 0)),
    section: (t) => {
      const k = 1 - t * 0.28;
      const hw = 0.042 * k;
      const th = 0.014 * k;
      const pts: [number, number][] = [];
      for (let j = 0; j < 14; j++) {
        const a = (j / 14) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        pts.push([Math.sign(c) * Math.abs(c) ** 0.6 * hw, s * th]);
      }
      return pts;
    },
    segments: 12,
    caps: true,
  });
  scab.add(new Mesh(body, scabMat));
  const throat = sweep({
    path: linePath(new Vector3(0, 0.012, 0), new Vector3(0, -0.04, 0)),
    section: circleSection(() => 0.046, 18, 0.36),
    segments: 2,
    caps: true,
  });
  scab.add(new Mesh(throat, brass));
  const chape = sweep({
    path: linePath(new Vector3(0, -scabLen + 0.05, 0), new Vector3(0, -scabLen - 0.01, 0)),
    section: circleSection((t) => 0.034 * (1 - t * 0.5), 18, 0.38),
    segments: 3,
    caps: true,
  });
  scab.add(new Mesh(chape, brass));
  // suspension ring
  const ring = new Mesh(new CylinderGeometry(0.014, 0.014, 0.006, 16), brass);
  ring.position.set(0.046, -0.06, 0);
  ring.rotation.x = Math.PI / 2;
  scab.add(ring);
  scab.position.set(0.1, 0.42, -0.06);
  scab.rotation.z = -0.32;
  group.add(scab);

  // the sword itself leans the other way so the pair reads as a cross
  const sword = new Group();
  for (const m of [...group.children]) if (m !== scab) sword.add(m);
  sword.rotation.z = 0.32;
  sword.position.set(-0.03, 0.03, 0.03);
  group.add(sword);
  return group;
}
