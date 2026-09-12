/** Original periodic UV repair after the anatomical boot split and closure.
 * Duplicated seam vertices stay within their rigid movement region; triangle
 * positions/normals and the contact sole are unaffected.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';

export function repairBootPeriodicUvs(geometry: BufferGeometry, first: number, end: number,
  closedProfile = false): { first: number; end: number } {
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv'), index = geometry.getIndex();
  if (!uv || !normal || !index) throw new Error('Indexed boot attributes required');
  // The cuff has no duplicated closing profile row. Arc-length coordinates leave
  // that final physical strip a positive UV width, then its seam receives V=1.
  const profileV = new Map<number, number>();
  if (closedProfile) {
    const rings = new Map<number, Map<number, number>>();
    for (let i = 0; i < position.count; i++) {
      const v = uv.getY(i); if (!rings.has(v)) rings.set(v, new Map());
      rings.get(v)!.set(uv.getX(i), i);
    }
    const levels = [...rings.keys()].sort((a, b) => a - b), lengths: number[] = [];
    for (let row = 0; row < levels.length; row++) {
      const a = rings.get(levels[row])!, b = rings.get(levels[(row + 1) % levels.length])!;
      let distance = 0;
      for (const [u, i] of a) {
        const j = b.get(u); if (j === undefined) throw new Error('Matching cuff angle rings required');
        distance += Math.hypot(position.getX(i) - position.getX(j), position.getY(i) - position.getY(j), position.getZ(i) - position.getZ(j));
      }
      lengths.push(distance / a.size);
    }
    const total = lengths.reduce((sum, value) => sum + value, 0); let distance = 0;
    for (let row = 0; row < levels.length; row++) {
      profileV.set(levels[row], distance / total); distance += lengths[row];
    }
  }
  const buckets = Array.from({ length: 3 }, () => ({ position: [] as number[], normal: [] as number[], uv: [] as number[], keys: new Map<string, number>() }));
  const category = (i: number) => i < first ? 0 : i < end ? 1 : 2;
  const insert = (i: number, u: number, v: number): [number, number] => {
    const region = category(i), bucket = buckets[region], key = `${i}:${u}:${v}`;
    let j = bucket.keys.get(key);
    if (j === undefined) {
      j = bucket.position.length / 3; bucket.keys.set(key, j);
      bucket.position.push(position.getX(i), position.getY(i), position.getZ(i));
      bucket.normal.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      bucket.uv.push(u, v);
    }
    return [region, j];
  };
  // Keep original vertex order, including harmless unused entries. This also leaves
  // index zero of the cuff available to existing accessory attachment checks.
  for (let i = 0; i < position.count; i++) insert(i, uv.getX(i), profileV.get(uv.getY(i)) ?? uv.getY(i));
  const triangles: [number, number][] = [];
  for (let t = 0; t < index.count; t += 3) {
    const ids = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    const us = ids.map(i => uv.getX(i)), vs = ids.map(i => profileV.get(uv.getY(i)) ?? uv.getY(i));
    const planarCap = !closedProfile && ids.every(i => Math.abs(position.getY(i) - position.getY(ids[0])) < 1e-8);
    if (planarCap) {
      // Both anatomical cut caps and the existing bottom fans need a nonsingular
      // planar map. These UV-only duplicates retain their original hard normals.
      for (let j = 0; j < 3; j++) { us[j] = .5 + position.getX(ids[j]) / .144; vs[j] = .5 + position.getZ(ids[j]) / .144; }
    } else {
      if (Math.max(...us) - Math.min(...us) > .5) for (let j = 0; j < 3; j++) if (us[j] < .5) us[j] += 1;
      if (closedProfile && Math.max(...vs) - Math.min(...vs) > .5) for (let j = 0; j < 3; j++) if (vs[j] < .5) vs[j] += 1;
    }
    for (let j = 0; j < 3; j++) triangles.push(insert(ids[j], us[j], vs[j]));
  }
  const counts = buckets.map(b => b.position.length / 3), offsets = [0, counts[0], counts[0] + counts[1]];
  geometry.setAttribute('position', new Float32BufferAttribute(buckets.flatMap(b => b.position), 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(buckets.flatMap(b => b.normal), 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(buckets.flatMap(b => b.uv), 2));
  geometry.setIndex(triangles.map(([region, index]) => offsets[region] + index));
  return { first: counts[0], end: counts[0] + counts[1] };
}
