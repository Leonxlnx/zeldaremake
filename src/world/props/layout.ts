/** Small domestic details, deliberately outside doors, stairs and the central sightlines. */
export const PROP_LAYOUT = [
  { id: 'saria-ochre-pot', kind: 'pot', x: 8.0, z: -12.8, size: 0.72, yaw: 0.3 },
  // Bring the small domestic cluster toward the house approach for shots B/D. Footprint
  // masks still reject stairs, paths and house roots, even if an authored point is blocked.
  { id: 'saria-small-pot', kind: 'pot', x: 6.75, z: -11.6, size: 0.49, yaw: -0.5 },
  { id: 'saria-water-bucket', kind: 'bucket', x: 7.6, z: -7.2, size: 0.58, yaw: 0.5 },
  { id: 'saria-crate', kind: 'crate', x: 7.7, z: -11.7, size: 0.77, yaw: 0.13 },
  { id: 'saria-storage-pot', kind: 'pot', x: 16.4, z: -8.45, size: 0.58, yaw: 0.8 },
  { id: 'upper-crate', kind: 'crate', x: 19.4, z: -9.7, size: 0.72, yaw: -0.12 },
  { id: 'upper-bucket', kind: 'bucket', x: 19.3, z: -10.7, size: 0.51, yaw: -0.4 },
  { id: 'west-tree-platform', kind: 'platform', x: -8.7, z: -10.0, size: 1, yaw: 0 },
] as const;
