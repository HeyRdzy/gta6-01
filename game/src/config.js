// Solmar Heat — tuning and world constants. Written fresh for round 4.
// The city is a 480x480 top-down grid: streets every 60 units, roads 14 wide.
export const CFG = {
  WORLD_HALF: 240,
  STREETS: [-210, -150, -90, -30, 30, 90, 150, 210],
  ROAD_W: 14,
  BLOCK: 46,
  DAY_LENGTH: 300, // seconds for a full day cycle
  START_TOD: 0.70, // golden hour (0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk)

  // Movement tuning (units per second).
  WALK_SPEED: 26,
  RUN_SPEED: 44,
  CAR_ACCEL: 58,
  CAR_BRAKE: 95,
  CAR_MAX_SPEED: 96,
  CAR_REVERSE_MAX: 32,
  CAR_STEER: 2.6, // radians per second at full lock, scaled by speed
  TRAFFIC_SPEED_MIN: 9,
  TRAFFIC_SPEED_MAX: 16,
  COP_SPEED: 88,
  PED_SPEED_MIN: 3,
  PED_SPEED_MAX: 6,

  // Combat.
  MAG_SIZE: 12,
  RELOAD_TIME: 1.2,
  BULLET_RANGE: 230,
  GUN_DAMAGE: 34,
  PED_HP: 34,
  COP_CAR_HP: 120,

  // Wanted (0-5 stars).
  WANTED_MAX: 5,
  WANTED_DECAY_IDLE: 20, // seconds with no crime and no cop near before decay starts
  WANTED_DECAY_EVERY: 8, // seconds per star lost while cooling off
  COP_NEAR_DIST: 70,

  // Economy.
  FARE_MIN: 25,
  FARE_MAX: 60,
  STUNT_PAY: 50,
  BUST_FINE: 200,
  HOSPITAL_FEE_FRAC: 0.1,

  // Colours.
  COL: {
    grass: '#4d7a38',
    grassDark: '#42682f',
    asphalt: '#2c3038',
    asphaltDark: '#262a31',
    roadLine: '#c9b458',
    sidewalk: '#7e838d',
    sidewalkEdge: '#6a6f78',
    sand: '#d8c078',
    sea: '#1d5c86',
    seaDeep: '#17486b',
    pond: '#2e7d9e',
    buildingRoof: '#8b7d6b',
    buildingEdge: '#5d5347',
    downtownRoof: '#6f7f92',
    container: ['#b8442c', '#2c6eb8', '#c9a13a', '#3f8f4f', '#7a4a8a'],
    neon: ['#ff2e88', '#22e6ff', '#ffd319', '#7cff4f', '#ff7a1a'],
  },
};
