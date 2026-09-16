/**
 * Sun geometry shared by lighting, sky, fog and god rays. Azimuth is measured from +Z toward +X
 * (negative = the light comes from the west/north-west); elevation above the horizon.
 * The returned vector points FROM the world TOWARD the sun.
 */
import { Vector3 } from 'three';

export function sunDirection(azimuthDeg: number, elevationDeg: number, out = new Vector3()): Vector3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
}
