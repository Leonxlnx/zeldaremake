/**
 * Handle the character system publishes on `scene.userData.player` for the walkable build's
 * third-person camera (src/camera/follow.ts). Kept as a tiny interface so the camera code never
 * imports the character internals.
 */
import type { Vector3 } from 'three';

export interface PlayerInput {
  /** desired world-space move direction (xz), magnitude 0..1 */
  moveX: number;
  moveZ: number;
  run: boolean;
  /** jump button held (Space / gamepad A); a jump starts on the press, never repeats while held */
  jump?: boolean;
}

export interface PlayerHandle {
  /** Link's sole position (world), updated every frame */
  readonly position: Vector3;
  /** facing yaw (rad); forward = (sin yaw, 0, cos yaw) */
  heading(): number;
  /** height of the posed root above the ground it stands on (m): the jump arc, for a camera that wants to know without following it */
  airHeight(): number;
  /** switch between the capture/free-camera placement and player control */
  setPlayMode(on: boolean): void;
  playMode(): boolean;
  setInput(input: PlayerInput): void;
  /** the walkable ground under (x, z) as Link stands on it: terrain, stair treads, built decks, paving slabs */
  groundHeight(x: number, z: number): number;
  /** the rendered walking surface under (x, z): `groundHeight` raised to the rendered stair stones / timbers */
  surfaceHeight(x: number, z: number): number;
  /**
   * both boots against the rendered surface as last posed: the sole's gap over the stone / timber
   * under it and the smallest gap over the boot's footprint (m, negative = inside), and whether
   * the gait calls the foot a stance foot (play-test harness)
   */
  feetContact?(): { gapM: number; minShoeGapM: number; stance: boolean }[];
  /** put Link at rest at (x, z) facing `yaw` (play-test harness and authoring) */
  place(x: number, z: number, yaw: number): void;
}

export const PLAYER_KEY = 'player';
