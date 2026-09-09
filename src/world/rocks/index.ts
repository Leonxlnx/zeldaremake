/**
 * Rocks & geology — owner: terrain agent (or rocks agent if split).
 * Hero mossy boulders from LAYOUT.heroBoulders plus procedural scree/pebbles/embedded stones.
 * Starter: displaced icospheres seated on the terrain.
 */
import { Color, Group, IcosahedronGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { Noise2D } from '../util/noise';

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'rocks';
  const mat = new MeshStandardMaterial({ color: new Color(0x7d8272), roughness: 0.95 });
  const noise = new Noise2D(`${ctx.config.seed}/rocks`);
  const v = new Vector3();

  for (const b of ctx.layout.heroBoulders) {
    const geo = new IcosahedronGeometry(b.radius, 3);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = noise.fbm(v.x * 0.9 + 10, v.z * 0.9 + v.y * 0.7, 3);
      v.multiplyScalar(1 + n * 0.22);
      v.y *= 0.72;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const m = new Mesh(geo, mat);
    const gy = ctx.terrain.height(b.position[0], b.position[2]);
    m.position.set(b.position[0], gy + b.radius * 0.35, b.position[2]);
    m.castShadow = m.receiveShadow = true;
    m.name = `boulder-${b.id}`;
    group.add(m);
  }

  ctx.audit('rocks', () => ({ heroBoulders: group.children.length, scree: 0, pebbles: 0, mossCoverage: false }));
  return { name: 'rocks', group };
}
