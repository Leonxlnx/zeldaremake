/**
 * Deku Nut — a fist-sized acorn-like nut: a glossy tan shell with faint marbling, a scaled
 * darker cap and a short stem; a second, smaller nut leans against it. Original shapes.
 */
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { hsl, lathe, paintData, paintTexture } from './shape';

function shellTexture(seed: number) {
  return paintTexture(
    256,
    256,
    (ctx, rng) => {
      ctx.fillStyle = hsl(34, 0.5, 0.5);
      ctx.fillRect(0, 0, 256, 256);
      // vertical marbling streaks
      for (let i = 0; i < 120; i++) {
        ctx.strokeStyle = hsl(30 + (rng() - 0.5) * 12, 0.5, 0.36 + rng() * 0.3, 0.25);
        ctx.lineWidth = 1 + rng() * 4;
        ctx.beginPath();
        const x = rng() * 256;
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + (rng() - 0.5) * 30, 90, x + (rng() - 0.5) * 30, 170, x + (rng() - 0.5) * 20, 256);
        ctx.stroke();
      }
      // dark point at the tip (bottom of the texture)
      const grad = ctx.createLinearGradient(0, 200, 0, 256);
      grad.addColorStop(0, hsl(30, 0.5, 0.3, 0));
      grad.addColorStop(1, hsl(28, 0.5, 0.2, 0.9));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 200, 256, 56);
    },
    seed,
  );
}

function capTexture(seed: number) {
  return paintTexture(
    256,
    128,
    (ctx, rng) => {
      ctx.fillStyle = hsl(26, 0.4, 0.26);
      ctx.fillRect(0, 0, 256, 128);
      // overlapping scales
      for (let row = 0; row < 6; row++) {
        for (let i = 0; i < 16; i++) {
          const x = i * 16 + (row % 2) * 8;
          const y = 8 + row * 20;
          ctx.fillStyle = hsl(26 + (rng() - 0.5) * 8, 0.42, 0.22 + rng() * 0.14);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 8, y - 12, x + 16, y);
          ctx.quadraticCurveTo(x + 8, y + 14, x, y);
          ctx.fill();
          ctx.strokeStyle = hsl(26, 0.4, 0.12, 0.8);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    },
    seed + 1,
  );
}

function capBump(seed: number) {
  return paintData(
    256,
    128,
    (ctx) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 256, 128);
      for (let row = 0; row < 6; row++) {
        for (let i = 0; i < 16; i++) {
          const x = i * 16 + (row % 2) * 8;
          const y = 8 + row * 20;
          const g = ctx.createRadialGradient(x + 8, y + 2, 1, x + 8, y + 2, 10);
          g.addColorStop(0, '#c8c8c8');
          g.addColorStop(1, '#606060');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 8, y - 12, x + 16, y);
          ctx.quadraticCurveTo(x + 8, y + 14, x, y);
          ctx.fill();
        }
      }
    },
    seed + 2,
  );
}

function nut(seed: number, scale: number): Group {
  const g = new Group();
  const shell = new MeshStandardMaterial({ map: shellTexture(seed), roughness: 0.32, metalness: 0.02 });
  const cap = new MeshStandardMaterial({ map: capTexture(seed), bumpMap: capBump(seed), bumpScale: 0.6, roughness: 0.8, metalness: 0 });
  const stem = new MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 });
  // shell profile: [radius, y], tip at the bottom
  const shellProfile: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const y = -0.15 + t * 0.26;
    const r = 0.13 * Math.sin(Math.PI * (0.02 + t * 0.9)) ** 0.75 * (t < 0.15 ? 0.6 + (t / 0.15) * 0.4 : 1);
    shellProfile.push([r, y]);
  }
  const shellGeo = lathe(shellProfile, 48);
  // lathe uv v runs bottom→top; the texture's dark tip is at the bottom (v = 0 → y = 1 in canvas)
  const body = new Mesh(shellGeo, shell);
  g.add(body);
  const capProfile: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = 0.02 + t * 0.12;
    const r = 0.132 * Math.cos(t * Math.PI * 0.5) ** 0.55 + 0.004;
    capProfile.push([r, y]);
  }
  capProfile.push([0.01, 0.145]);
  g.add(new Mesh(lathe(capProfile, 48), cap));
  const st = new Mesh(new CylinderGeometry(0.008, 0.012, 0.05, 10), stem);
  st.position.y = 0.165;
  st.rotation.z = 0.25;
  g.add(st);
  g.scale.setScalar(scale);
  return g;
}

export function buildDekuNut(): Group {
  const group = new Group();
  const a = nut(0xa7a7, 1);
  a.rotation.set(0.15, 0.4, -0.12);
  group.add(a);
  const b = nut(0xa7b1, 0.72);
  b.position.set(0.2, -0.08, 0.08);
  b.rotation.set(0.5, 1.3, 1.1);
  group.add(b);
  return group;
}
