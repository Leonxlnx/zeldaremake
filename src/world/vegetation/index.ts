/**
 * Vegetation — owner: vegetation agent.
 * GPU-instanced grass (short/tall/weeds), ferns, purple flowers, bushes, moss patches,
 * saplings, fallen leaves/twigs litter. Placement via ctx.terrain.vegetationAllowed and the
 * mask (no grass on flagstones/stairs, dense on embankments, sprouting in stone joints).
 * Starter: empty system with an audit stub.
 */
import { Group } from 'three';
import type { WorldContext, WorldSystem } from '../system';

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'vegetation';
  ctx.audit('vegetation', () => ({
    grassInstances: 0,
    grassTypes: 0,
    ferns: 0,
    flowers: 0,
    bushes: 0,
    litter: 0,
    windLayers: 0,
  }));
  return { name: 'vegetation', group };
}
