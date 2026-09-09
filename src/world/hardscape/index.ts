/**
 * Hardscape system — owner: terrain agent.
 * Stone stairs (the hero stairway of shot A), flagstone paths, retaining edges, worn steps,
 * moss in the joints, grass sprouting between stones. This starter builds plain stepped
 * blocks from LAYOUT.stairs so the composition reads; real geometry/material work follows.
 */
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { WorldContext, WorldSystem } from '../system';

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'hardscape';
  const stoneMat = new MeshStandardMaterial({ color: new Color(ctx.config.palette.flagstoneDark), roughness: 0.9 });

  let totalSteps = 0;
  for (const s of ctx.layout.stairs) {
    const stair = new Group();
    stair.name = `stairs-${s.id}`;
    const dir = new Vector3(s.dir[0], 0, s.dir[1]).normalize();
    const yaw = Math.atan2(dir.x, dir.z);
    for (let i = 0; i < s.steps; i++) {
      // each step is a block from its riser back to the top of the run so the flank is closed
      const depth = (s.steps - i) * s.tread;
      const geo = new BoxGeometry(s.width, s.rise, depth);
      const m = new Mesh(geo, stoneMat);
      const along = i * s.tread + depth / 2;
      m.position.set(s.base[0] + dir.x * along, s.base[1] + i * s.rise + s.rise / 2, s.base[2] + dir.z * along);
      m.rotation.y = yaw;
      m.castShadow = true;
      m.receiveShadow = true;
      stair.add(m);
      totalSteps++;
    }
    group.add(stair);
  }

  ctx.audit('hardscape', () => ({
    stairways: ctx.layout.stairs.map((s) => ({ id: s.id, steps: s.steps, width: s.width })),
    totalSteps,
    flagstones: 0,
    stairGeometry: 'placeholder-boxes',
  }));

  return { name: 'hardscape', group };
}
