/**
 * Structures — owner: structures agent.
 * Kokiri tree-trunk houses with mossy dome roofs, glowing pod lanterns, wooden signposts,
 * post-and-rail fences, the lantern branch, the giant hollow log arch.
 * Starter: massing blocks at the layout positions so shots compose; all to be replaced.
 */
import { Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, PointLight, Vector3 } from 'three';
import type { WorldContext, WorldSystem } from '../system';

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'structures';
  const bark = new MeshStandardMaterial({ color: new Color(0x5a4a38), roughness: 0.95 });
  const moss = new MeshStandardMaterial({ color: new Color(ctx.config.palette.mossDeep), roughness: 1 });
  const glow = new MeshStandardMaterial({ color: new Color(0xffc24a), emissive: new Color(ctx.config.palette.lanternGlow), emissiveIntensity: 2.5 });

  let lanterns = 0;
  for (const h of ctx.layout.houses) {
    const house = new Group();
    house.name = `house-${h.id}`;
    const gy = ctx.terrain.height(h.position[0], h.position[2]);
    const trunk = new Mesh(new CylinderGeometry(h.trunkRadius * 0.9, h.trunkRadius, h.roofHeight * 0.7, 24), bark);
    trunk.position.set(h.position[0], gy + h.roofHeight * 0.35, h.position[2]);
    const roof = new Mesh(new SphereGeometry(h.trunkRadius * 1.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), moss);
    roof.position.set(h.position[0], gy + h.roofHeight * 0.62, h.position[2]);
    roof.scale.y = 0.7;
    trunk.castShadow = trunk.receiveShadow = roof.castShadow = roof.receiveShadow = true;
    house.add(trunk, roof);
    const f = new Vector3(h.facing[0], 0, h.facing[1]).normalize();
    for (let i = 0; i < h.lanterns; i++) {
      const a = (i - (h.lanterns - 1) / 2) * 0.55;
      const d = f.clone().applyAxisAngle(new Vector3(0, 1, 0), a);
      const l = new Mesh(new SphereGeometry(0.16, 12, 8), glow);
      l.position.set(h.position[0] + d.x * (h.trunkRadius + 0.5), gy + h.roofHeight * 0.55, h.position[2] + d.z * (h.trunkRadius + 0.5));
      house.add(l);
      const pl = new PointLight(ctx.config.palette.lanternGlow, 6, 7, 2);
      pl.position.copy(l.position);
      house.add(pl);
      lanterns++;
    }
    group.add(house);
  }

  // log arch massing
  const la = ctx.layout.logArch;
  const log = new Mesh(new CylinderGeometry(la.radius, la.radius * 1.1, la.length, 24, 1, true), bark);
  log.rotation.z = Math.PI / 2;
  log.rotation.y = (la.yawDeg * Math.PI) / 180;
  log.position.set(la.position[0], ctx.terrain.height(la.position[0], la.position[2]) + la.radius * 0.8, la.position[2]);
  log.castShadow = log.receiveShadow = true;
  log.name = 'log-arch';
  group.add(log);

  ctx.audit('structures', () => ({
    houses: ctx.layout.houses.length,
    lanterns,
    signposts: 0,
    fences: 0,
    lanternBranch: false,
    logArch: true,
    geometry: 'placeholder-massing',
  }));

  return { name: 'structures', group };
}
