// WHERE things are. Single source of truth for the set, the acting and the cameras.
// World units are millimetres. +Y up, tabletop surface is y = 0.
// The action runs along +X: sugar packet (start) -> mug landing -> crumb.

export const UNITS = 'mm';

export const TABLE = {
  // Visible Formica surface. The far edge has a chrome band; beyond it the window.
  minX: -520,
  maxX: 520,
  minZ: -340,
  maxZ: 260,
  topY: 0,
  thickness: 28,
  chromeBandZ: -340,
};

export const ANT = {
  bodyLength: 7.0, // head tip to gaster tip
  standHeight: 1.35, // thorax centre above the table when standing
  forward: [1, 0, 0], // local +X is forward; heading rotates about +Y (counter-clockwise from above)
  sprintSpeed: 38, // mm per second at full run (heroic, not scientific)
};

export const SUGAR_PACKET = {
  // Crumpled torn packet: the ant crests its ridge in shot A.
  position: [-150, 0, 18],
  rotationY: 0.35,
  size: [42, 5.5, 26], // x, peak height, z
  ridgeTop: [-140, 5.2, 16], // where the ant pops up
};

export const CRUMB = {
  position: [118, 0, -6],
  size: 11.0, // longest dimension
  lampPoolRadius: 34,
};

export const MUG = {
  landing: [14, 0, -2], // centre of the foot ring when it lands (directly in the ant's path)
  height: 95,
  bodyRadius: 41,
  footRadius: 33,
  footHeight: 4.5,
  lipThickness: 5.5,
  dropStartY: 190, // where it enters from (above frame)
  contactFrame: 138, // from beats.js - the slam
};

export const PENDANT_LAMP = {
  // Warm key. Pools on the crumb.
  position: [150, 420, -120],
  target: CRUMB.position,
  color: '#FFB21E',
};

export const WINDOW = {
  // Big diner window behind the far table edge. Night city beyond.
  planeZ: -900,
  minX: -1400,
  maxX: 1400,
  minY: -40,
  maxY: 900,
  neon: [
    { id: 'diner', text: 'DINER', color: '#FF2E88', position: [-380, 420, -880], scale: 150 },
    { id: 'open', text: 'OPEN', color: '#35E0FF', position: [420, 300, -880], scale: 95 },
    { id: 'arrow', color: '#FF5A1F', position: [120, 560, -880], scale: 120 },
  ],
};

/** Background monuments - the diner objects that read as architecture at ant scale. */
export const MONUMENTS = [
  { id: 'napkinDispenser', position: [-300, 0, -230], size: [110, 125, 70] },
  { id: 'sugarPourer', position: [-120, 0, -270], size: [62, 150, 62] },
  { id: 'saltShaker', position: [260, 0, -250], size: [36, 92, 36] },
  { id: 'pepperShaker', position: [310, 0, -215], size: [36, 92, 36] },
  { id: 'ketchup', position: [420, 0, -290], size: [60, 200, 60] },
  { id: 'fork', position: [-40, 0, 120], rotationY: -0.25, size: [190, 4, 26] },
  { id: 'check', position: [300, 0, 90], rotationY: 0.5, size: [90, 1, 150] },
];

/** The ant's path, key positions in world space. perform.js interpolates between these. */
export const PATH = {
  start: [-146, 5.2, 16], // on the packet ridge (shot A)
  sprintEnd: [-44, 0, 6], // where shot C's shadow catches it
  skidPoint: [-30, 0, 4], // plants in front of the landed mug (shot F)
  wallRunEntry: [-24, 6, -8], // steps onto the mug's belly
  wallRunApex: [14, 78, -44], // highest point on the mug wall, half a turn around
  launch: [48, 60, -30], // leaves the mug
  landing: [92, 0, -10],
  grab: [110, 0, -6], // in front of the crumb
};
