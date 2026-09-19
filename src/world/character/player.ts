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
}

export const PLAYER_KEY = 'player';
