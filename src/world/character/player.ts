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
  /** Held button; the simulation consumes only a rising edge (no automatic repeated jump). */
  jump?: boolean;
}

export interface PlayerHandle {
  /** Link's sole position (world), updated every frame */
  readonly position: Vector3;
  /** facing yaw (rad); forward = (sin yaw, 0, cos yaw) */
  heading(): number;
  /** switch between the capture/free-camera placement and player control */
  setPlayMode(on: boolean): void;
  playMode(): boolean;
  setInput(input: PlayerInput): void;
}

export const PLAYER_KEY = 'player';
