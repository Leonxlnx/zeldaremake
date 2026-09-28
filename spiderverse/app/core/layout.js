// WHERE things are in "Into the Ant-Verse". Owner: director. Sets, props, water and every shot
// read this; nobody hard-codes a world position that is defined here.
//
// Millimetres. +Y up. Counter surface is y = 0. -Z is north (toward the backsplash wall).
// Outbound (nest -> crumb) is +X = screen right; homebound is -X = screen left.

export const COUNTER = {
  minX: -560, // west end: the counter drops into the sink here (see SINK)
  maxX: 900,
  backZ: -600, // backsplash wall face
  frontZ: 0, // front edge (chrome band)
  topY: 0,
  thickness: 32,
};

export const WALL = {
  // Tile backsplash rising from the counter's back edge.
  z: -600,
  minX: -560,
  maxX: 900,
  height: 460,
  tile: [75, 150], // subway tile w x h (mm)
  grout: 3.0,
  groutDepth: 1.2,
  caulkHeight: 4.0, // the caulk bead along the wall base
  cabinetUndersideY: 460, // upper cabinets; under-cabinet lights live here
};

export const NEST = {
  // A crumbled-grout crack at the base of the backsplash. Its lip is above the flood level.
  entrance: [-300, 6, -600], // centre of the opening on the wall face
  opening: [11, 7], // width, height of the crack mouth (mm)
  lipY: 6, // bottom of the opening above the counter
  // The interior is its own set (nest.js) authored in its own local space; this is where its
  // local origin sits in the world, directly behind the crack.
  interiorOrigin: [-300, 0, -640],
};

export const CAP = {
  // Red crimped bottle cap, open side up. Lookout in S03, boat in S14-S17.
  position: [-240, 0, -548],
  radius: 14.5,
  height: 6.5,
  color: '#E8202A',
};

export const TOOTHPICK = {
  // Leaning against the cap in S03; paddle in S14-S17.
  base: [-226, 0, -540],
  tip: [-250, 34, -552],
  length: 65,
  radius: 1.1,
};

export const CUTTING_BOARD = {
  min: [200, 0, -570],
  max: [500, 18, -360],
  grooveInset: 14, // the juice groove runs this far in from the edge
  grooveWidth: 6,
  grooveDepth: 2.5,
};

export const CRUMB = {
  // Wedged in the juice groove on the board's west side.
  wedged: [226, 18, -470],
  size: 11.0,
};

export const MUG = {
  landing: [150, 0, -470], // foot-ring centre when it slams (between the board and home)
  height: 95,
  bodyRadius: 41,
  footRadius: 33,
  footHeight: 4.5,
  handleSide: -1, // handle on the WEST side (toward home) - the wall-run exits over it
  dropStartY: 260,
};

export const SPONGE = {
  size: [110, 32, 72],
  sweepStart: [-420, 0, -470], // enters from the west (home side)
  sweepEnd: [60, 0, -470], // stops against the mug
  wringPoint: [-120, 170, -585], // S12: the hand wrings it above the wall base
};

export const WATER = {
  // The flood river along the wall base (acts 4-5). Flows WEST (-X) to the sink drop.
  channelMinZ: -600,
  channelMaxZ: -520,
  sourceX: -120, // where the torrent hits the counter
  level: 3.2, // water surface height above the counter (mm)
  speed: 26, // mm/s surface flow near the source, accelerating toward the drop
  dropX: -460, // counter edge into the sink - the waterfall
};

export const SINK = {
  edgeX: -460,
  basinMinX: -900,
  basinDepth: 180,
};

export const LIGHTS = {
  rangeHood: { position: [380, 520, -520], color: '#FFB21E', target: [300, 18, -470] }, // pools on the board
  underCabinet: { y: 455, z: -585, color: '#FFD68A' }, // warm strip along the wall
  moon: { direction: [-0.35, 0.62, 0.7], color: '#8FA8FF' }, // cool key from the window
  microwaveClock: { position: [640, 180, -560], color: '#39FF7A', text: '11:58' },
  nestGlow: { position: [-300, 4, -606], color: '#FFB21E' }, // warm spill from the crack
};

export const WINDOW = {
  // Above the sink. Night city beyond: flat graphic buildings, neon.
  center: [-700, 520, -620],
  size: [700, 420],
  neon: [
    { text: 'DINER', color: '#FF2E88' },
    { text: 'OPEN', color: '#35E0FF' },
  ],
};

/** The Courier's route. Shots interpolate between these; add intermediate points in-shot. */
export const ROUTE = {
  nestMouth: [-300, 6, -596],
  capRim: [-240, 6.5, -548],
  runA: [-150, 0, -520],
  runB: [60, 0, -490],
  boardFoot: [196, 0, -470], // at the board's west face
  boardTop: [212, 18, -470],
  crumb: CRUMB.wedged,
  mugFoot: [196, 0, -470], // same spot: she climbs down right where the mug lands next to her
  chaseEnd: [230, 0, -410],
  wallRunStart: [185, 0, -440],
  handle: [100, 60, -470],
  landHome: [40, 0, -500],
  riverBank: [-110, 0, -515],
  capAdrift: [-160, 3.2, -560],
  catchPoint: [-450, 3.2, -575], // Little One catches her at the brink
};
