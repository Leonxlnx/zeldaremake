/**
 * CHARACTER SYSTEM (Phase 2) — owner: character agent.
 *
 * Young Link, Navi and the Kokiri NPCs (rubric C01–C05). Registered last in `SYSTEMS` so it can
 * read `ctx.sun` and the terrain. Under capture the player stands at the reference's screen
 * position for the active viewpoint (see the per-view table in this directory); in the walkable
 * build the follow camera (src/camera/follow.ts) drives it.
 *
 * Stub: builds nothing yet; the audit reports the missing pieces as falsy so C01–C05 stay red.
 */
import { Group } from 'three';
import type { WorldContext, WorldSystem } from '../system';

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'character';
  ctx.audit('character', () => ({ link: false, animations: 0, fairy: false, npcs: 0, geometry: 'stub' }));
  return { name: 'character', group };
}
