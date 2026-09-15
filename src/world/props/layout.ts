/** Small domestic details, deliberately outside doors, stairs and the central sightlines. */
export const PROP_LAYOUT = [
  // Round 32 (structures-22): at (8.0, −12.8) the big pot stood inside camera D's frustum — D
  // (0.90, 0.55), on the dark bank under Saria's trunk where frame 56 s has moss and roots only.
  // Now on the terrace's south-west corner above the house-west flight: bearing 48.1° from
  // camera D (its frustum ends at 44.6°; the pot's 0.28 m radius at 12 m is 1.3°), camera B sees
  // it at (0.67, 0.55) beside the small pot; ground 0.83 m, off the flight, the walk and the roots.
  { id: 'saria-ochre-pot', kind: 'pot', x: 8.0, z: -10.0, size: 0.72, yaw: 0.3 },
  // Bring the small domestic cluster toward the house approach for shots B/D. Footprint
  // masks still reject stairs, paths and house roots, even if an authored point is blocked.
  // Round 31: the house-west flight (layout stairs 'house-west', landing to x ≈ 7.5 at z ≈ −11.4)
  // took the old pot / crate spots ((6.75, −11.6), (7.7, −11.7): stairs mask 1, skipped) and
  // frame 56 s has no props at D's right edge, so both move to the terrace's south lip below the
  // door — the pot by the signpost's foot, the crate left of the threshold — where camera D's
  // frustum ends (bearing from D > 44.6°) and camera B sees them at (0.66, 0.56) / (0.76, 0.55).
  { id: 'saria-small-pot', kind: 'pot', x: 7.5, z: -9.5, size: 0.49, yaw: -0.5 },
  // Round 32: the re-planned walk to the door (`pathToHouse`: landing (6.59, −7.40) → (8.4, −7.7)
  // → door) runs through the bucket's old spot (7.6, −7.2), and the flight's south bank now
  // falls through (7.3, −6.75); it stands on the lawn between the walk and the signpost, 0.5 m
  // north of the walk 0.6 m past the landing's end (ground 1.39, slope 12°): camera B sees it at
  // (0.69, 0.50) at the landing's edge left of the door, camera D not at all (bearing 47°).
  { id: 'saria-water-bucket', kind: 'bucket', x: 7.25, z: -8.0, size: 0.58, yaw: 0.5 },
  { id: 'saria-crate', kind: 'crate', x: 8.75, z: -8.0, size: 0.77, yaw: 0.13 },
  { id: 'saria-storage-pot', kind: 'pot', x: 16.4, z: -8.45, size: 0.58, yaw: 0.8 },
  { id: 'upper-crate', kind: 'crate', x: 19.4, z: -9.7, size: 0.72, yaw: -0.12 },
  { id: 'upper-bucket', kind: 'bucket', x: 19.3, z: -10.7, size: 0.51, yaw: -0.4 },
  { id: 'west-tree-platform', kind: 'platform', x: -8.7, z: -10.0, size: 1, yaw: 0 },
] as const;
