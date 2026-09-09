/**
 * Trees — owner: trees agent.
 * Port + upgrade of the Verdant Forest white-bark trees (github.com/Leonxlnx/verdant-forest,
 * app/forest/trees.js) plus the giant old Kokiri trees whose canopies roof the clearing.
 * Starter: giant-tree massing (tapered trunk + crown blob) at LAYOUT.giantTrees. Replace entirely.
 */
import { Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import type { WorldContext, WorldSystem } from '../system';

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'trees';
  const bark = new MeshStandardMaterial({ color: new Color(ctx.config.palette.barkGrey), roughness: 0.9 });
  const leaf = new MeshStandardMaterial({ color: new Color(ctx.config.palette.leafCanopy), roughness: 0.8 });

  for (const t of ctx.layout.giantTrees) {
    const tree = new Group();
    tree.name = `giant-${t.id}`;
    const gy = ctx.terrain.height(t.position[0], t.position[2]);
    const trunk = new Mesh(new CylinderGeometry(t.trunkRadius * 0.55, t.trunkRadius, t.height * 0.7, 16), bark);
    trunk.position.set(t.position[0], gy + t.height * 0.35, t.position[2]);
    const crown = new Mesh(new SphereGeometry(t.height * 0.34, 16, 10), leaf);
    crown.position.set(t.position[0], gy + t.height * 0.78, t.position[2]);
    crown.scale.set(1.25, 0.6, 1.25);
    trunk.castShadow = trunk.receiveShadow = crown.castShadow = true;
    tree.add(trunk, crown);
    group.add(tree);
  }

  ctx.audit('trees', () => ({
    giants: ctx.layout.giantTrees.length,
    whiteBarkVariants: 0,
    whiteBarkInstances: 0,
    distantTrees: 0,
    geometry: 'placeholder-massing',
  }));

  return { name: 'trees', group };
}
