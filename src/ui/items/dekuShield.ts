/**
 * Deku Shield — a round, slightly domed wooden shield of vertical planks bound by a dark rim
 * with iron rivets, a painted red swirl on the face (our own curl, drawn in polar space) and a
 * leather arm-strap and grip on the back. Original design; wood grain painted procedurally.
 */
import { CircleGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { circleSection, bezierPath, hsl, paintTexture, paintData, sweep, woodGrain, leather } from './shape';

const R = 0.42;

function faceTexture(seed: number) {
  return paintTexture(
    512,
    512,
    (ctx, rng) => {
      woodGrain(ctx, rng, 512, 512, 30, 0.42, true);
      // plank joints
      ctx.strokeStyle = hsl(28, 0.4, 0.2, 0.7);
      ctx.lineWidth = 2.5;
      for (const x of [118, 212, 300, 394]) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (rng() - 0.5) * 6, 512);
        ctx.stroke();
      }
      // the painted swirl: an offset spiral with a leaf-like curl at its tail, weathered
      const cx = 268;
      const cy = 262;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const drawSpiral = (width: number, colour: string, alpha: number) => {
        ctx.strokeStyle = colour;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        ctx.beginPath();
        const turns = 2.35;
        const n = 160;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const a = -Math.PI * 0.5 + t * turns * Math.PI * 2;
          const r = 8 + t * 118 + Math.sin(t * 9) * 3;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r * 0.94;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        // tail curl sweeping down-left
        ctx.bezierCurveTo(cx - 150, cy + 150, cx - 210, cy + 60, cx - 170, cy - 10);
        ctx.stroke();
        // three teardrop flames off the outer turn
        for (const [ax, ay, rot] of [
          [cx + 92, cy - 108, -0.6],
          [cx + 140, cy - 20, 0.2],
          [cx + 120, cy + 90, 1.1],
        ] as [number, number, number][]) {
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(rot);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(18, -26, 44, -30, 52, -12);
          ctx.bezierCurveTo(34, -8, 14, 4, 0, 0);
          ctx.fillStyle = colour;
          ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      };
      drawSpiral(30, hsl(6, 0.7, 0.32), 0.55);
      drawSpiral(24, hsl(4, 0.78, 0.44), 0.85);
      drawSpiral(9, hsl(10, 0.7, 0.58), 0.35);
      // weathering: scuffs across the paint
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.15 + rng() * 0.4})`;
        ctx.beginPath();
        ctx.ellipse(rng() * 512, rng() * 512, 1 + rng() * 3, 0.5 + rng() * 1.5, rng() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      // dents and dark knots near the edge
      for (let i = 0; i < 40; i++) {
        const a = rng() * Math.PI * 2;
        const r = 200 + rng() * 50;
        ctx.fillStyle = hsl(28, 0.4, 0.22, 0.25 + rng() * 0.3);
        ctx.beginPath();
        ctx.ellipse(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 2 + rng() * 5, 1 + rng() * 3, a, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    seed,
  );
}

function faceRoughness(seed: number) {
  return paintData(
    256,
    256,
    (ctx, rng) => {
      ctx.fillStyle = '#b9b9b9';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1400; i++) {
        const v = 140 + Math.floor(rng() * 110);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(rng() * 256, rng() * 256, 1 + rng() * 4, 1 + rng() * 2);
      }
    },
    seed + 1,
  );
}

/** Dome the flat disc: z = dome(r). */
function domeDisc(geo: CircleGeometry, height: number, sign: number) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.hypot(x, y) / R;
    pos.setZ(i, sign * height * (1 - r * r));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

export function buildDekuShield(): Group {
  const group = new Group();
  const seed = 0xd3c0;
  const wood = new MeshStandardMaterial({ map: faceTexture(seed), roughnessMap: faceRoughness(seed), roughness: 0.85, metalness: 0 });
  const backWood = new MeshStandardMaterial({ map: paintTexture(256, 256, (c, r) => woodGrain(c, r, 256, 256, 26, 0.3, true), seed + 7), roughness: 0.95, metalness: 0, side: DoubleSide });
  const rimMat = new MeshStandardMaterial({ map: paintTexture(256, 64, (c, r) => bark(c, r), seed + 9, true), roughness: 0.8, metalness: 0.05 });
  const iron = new MeshStandardMaterial({ color: 0x4a4b4f, roughness: 0.55, metalness: 0.8 });
  const strapMat = new MeshStandardMaterial({ map: paintTexture(128, 128, (c, r) => leather(c, r, 128, 128, 24, 0.24), seed + 11), roughness: 0.9, metalness: 0 });

  const front = new CircleGeometry(R, 96, 0, Math.PI * 2);
  domeDisc(front, 0.06, 1);
  const frontMesh = new Mesh(front, wood);
  group.add(frontMesh);

  const back = new CircleGeometry(R, 64);
  domeDisc(back, 0.02, 1);
  const backMesh = new Mesh(back, backWood);
  backMesh.rotation.y = Math.PI;
  backMesh.position.z = -0.005;
  group.add(backMesh);

  // rim: a flattened torus, dark bound wood
  const rim = new Mesh(new TorusGeometry(R - 0.005, 0.03, 12, 96), rimMat);
  rim.scale.z = 1.4;
  group.add(rim);
  const rimInner = new Mesh(new TorusGeometry(R - 0.055, 0.008, 8, 96), iron);
  rimInner.position.z = 0.052 * (1 - ((R - 0.055) / R) ** 2) + 0.004;
  group.add(rimInner);

  // rivets
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.15;
    const rv = new Mesh(new SphereGeometry(0.016, 10, 8), iron);
    rv.position.set(Math.cos(a) * (R - 0.005), Math.sin(a) * (R - 0.005), 0.03);
    rv.scale.z = 0.7;
    group.add(rv);
  }

  // back: leather arm strap (a curved band) and a wooden grip
  const strap = sweep({
    path: bezierPath(new Vector3(-0.2, 0.05, -0.02), new Vector3(0, 0.02, -0.12), new Vector3(0.2, 0.05, -0.02)),
    section: () => [
      [-0.03, -0.006],
      [0.03, -0.006],
      [0.03, 0.006],
      [-0.03, 0.006],
    ],
    segments: 16,
    caps: true,
  });
  group.add(new Mesh(strap, strapMat));
  const grip = sweep({
    path: bezierPath(new Vector3(0.0, -0.22, -0.02), new Vector3(0.0, -0.13, -0.11), new Vector3(0.0, -0.04, -0.02)),
    section: circleSection(() => 0.018, 10),
    segments: 12,
    caps: true,
  });
  group.add(new Mesh(grip, backWood));

  group.rotation.set(0, 0, 0);
  return group;
}

function bark(ctx: CanvasRenderingContext2D, rng: () => number) {
  ctx.fillStyle = hsl(24, 0.35, 0.16);
  ctx.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = hsl(24 + (rng() - 0.5) * 8, 0.35, 0.1 + rng() * 0.16, 0.6);
    ctx.lineWidth = 0.6 + rng() * 1.5;
    ctx.beginPath();
    const x = rng() * 256;
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rng() - 0.5) * 10, 64);
    ctx.stroke();
  }
}
