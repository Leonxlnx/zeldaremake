/**
 * The bag's item registry: id, display name, two-line description, a lazy mesh builder and the
 * equipment-grid cell the item lives in. Meshes are original procedural geometry
 * (src/ui/items/*.ts) — no ripped assets; textures are painted on canvases at build time.
 */
import type { Group } from 'three';
import { buildDekuShield } from './dekuShield';
import { buildKokiriSword } from './kokiriSword';
import { buildDekuStick } from './dekuStick';
import { buildDekuNut } from './dekuNut';
import { buildSlingshot } from './slingshot';
import { buildOcarina } from './ocarina';

export type ItemId = 'deku-shield' | 'kokiri-sword' | 'deku-stick' | 'deku-nut' | 'slingshot' | 'fairy-ocarina';

export interface ItemDef {
  id: ItemId;
  name: string;
  description: [string, string];
  build: () => Group;
  /** equipment grid cell: row 0 / 1 (the tunic row stays empty), column 0..2 */
  cell: [number, number];
  /** stack count shown in the HUD slot (undefined = none) */
  count?: number;
  /** yaw offset (rad) for the card's resting pose */
  yaw: number;
  /** extra framing scale (1 = bounding sphere fits the card) */
  fit: number;
  /**
   * Thumbnail pose (grid cell / HUD slot): stage rotation in radians and how much of the cell the
   * projected silhouette fills (fraction of the cell's constraining side). Defaults to the card's
   * yaw, the card's 0.28 pitch, no roll, 0.84 fill.
   */
  thumb?: { yaw?: number; pitch?: number; roll?: number; fill?: number };
}

export const ITEMS: readonly ItemDef[] = [
  { id: 'kokiri-sword', name: 'Kokiri Sword', description: ['This small, child-sized sword is', 'a treasure of Kokiri Forest.'], build: buildKokiriSword, cell: [0, 0], yaw: -0.35, fit: 1.0, thumb: { yaw: -0.25, pitch: 0.12, roll: -0.08, fill: 0.9 } },
  { id: 'deku-stick', name: 'Deku Stick', description: ['A sturdy branch from a Deku Baba.', 'Swing it, or carry a flame with it.'], build: buildDekuStick, cell: [0, 1], count: 4, yaw: 0.2, fit: 0.95, thumb: { yaw: 0.2, pitch: 0.1, roll: 0.2, fill: 0.9 } },
  { id: 'slingshot', name: 'Fairy Slingshot', description: ['A forked branch strung with a', 'leather pouch. Fires Deku Seeds.'], build: buildSlingshot, cell: [0, 2], yaw: 0.3, fit: 1.0, thumb: { yaw: 0.15, pitch: 0.12, fill: 0.88 } },
  { id: 'deku-shield', name: 'Deku Shield', description: ['A round shield of Deku wood.', 'Sturdy, but it burns easily.'], build: buildDekuShield, cell: [1, 0], yaw: -0.55, fit: 1.05, thumb: { yaw: -0.3, pitch: 0.1, fill: 0.82 } },
  { id: 'deku-nut', name: 'Deku Nut', description: ['Throw it: the flash stuns', 'anything that sees it.'], build: buildDekuNut, cell: [1, 1], count: 5, yaw: 0.4, fit: 1.05, thumb: { yaw: 0.4, pitch: 0.2, fill: 0.8 } },
  { id: 'fairy-ocarina', name: 'Fairy Ocarina', description: ['A clay ocarina from a friend', 'in the forest. Play it anywhere.'], build: buildOcarina, cell: [1, 2], yaw: -0.2, fit: 1.0, thumb: { yaw: -0.2, pitch: 0.2, fill: 0.84 } },
];

export const DEFAULT_ITEM: ItemId = 'deku-stick';

export function itemById(id: string | null | undefined): ItemDef | null {
  if (!id) return null;
  return ITEMS.find((i) => i.id === id) ?? null;
}

export function itemIndex(id: ItemId): number {
  return ITEMS.findIndex((i) => i.id === id);
}
