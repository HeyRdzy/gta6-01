// Solmar Heat — every tuning number, colour and story beat in one place.
// Solmar Bay is a fictional sun-soaked coastal city: a street grid, a beach on the
// west edge, and a downtown of towers in the middle. Nothing here is copied from
// any commercial game: all names, characters and places are original.

/** Fixed simulation step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar-heat.save.v1';

/** The city grid: streets run both ways at these coordinates; blocks sit between them. */
export const CITY = {
  halfSize: 160,
  streets: [-120, -80, -40, 0, 40, 80, 120],
  streetWidth: 12,
  blockCentres: [-100, -60, -20, 20, 60, 100],
  beachX: -160,
  seaX: -190,
};

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 12,
  jumpSpeed: 9,
  gravity: 24,
  radius: 0.6,
  maxHealth: 100,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 42,
  maxReverse: 12,
  steerRate: 1.9,
  drag: 0.6,
  radius: 1.6,
};

export const TRAFFIC = { count: 10, speedMin: 9, speedMax: 15, maxCars: 12 };
export const PEDS = { count: 16, speedMin: 1.2, speedMax: 2.4, maxPeds: 20 };
export const POLICE = { maxCars: 5, chaseSpeed: 30, ramDistance: 6, bustDistance: 4, bustSeconds: 2.5 };

/** Wanted heat 0-100; stars are heat/20 rounded up. Crime adds heat, hiding sheds it. */
export const WANTED = {
  stealCar: 15,
  hitPed: 20,
  shootPed: 25,
  hitTraffic: 5,
  missionHeat: 40,
  heistHeat: 80,
  decayPerSecond: 6,
  quietSeconds: 8,
};

export const WEAPON = {
  damage: 34,
  range: 90,
  fireInterval: 0.22,
  magazine: 12,
  reloadSeconds: 1.4,
};

/** The five story missions, in order. Each step is a place to reach, a thing to collect, a fight, or an escape. */
export const MISSIONS = [
  {
    id: 'courier',
    title: 'Sunset Courier',
    giver: 'Mara Voss',
    briefing: 'Mara needs a package moved across town before the sun drops. Pick it up at Rosa\u2019s Diner, then run it to the Marina Gate. Don\u2019t be late.',
    reward: 300,
    steps: [
      { kind: 'goto', label: 'Pick up the package at Rosa\u2019s Diner', x: -100, z: -60, radius: 6 },
      { kind: 'deliver', label: 'Deliver the package to the Marina Gate (90s)', x: 100, z: 100, radius: 6, time: 90 },
    ],
  },
  {
    id: 'getaway',
    title: 'Getaway Driver',
    giver: 'Mara Voss',
    briefing: 'Mara lifted a ledger from the wrong people. The cops are already rolling. Grab a car, pick her up, and lose them at the Old Cannery.',
    reward: 500,
    steps: [
      { kind: 'goto', label: 'Pick up Mara at Rosa\u2019s Diner', x: -100, z: -60, radius: 6 },
      { kind: 'escape', label: 'Lose the cops, then reach the Old Cannery', x: -100, z: 100, radius: 8, heatOnStart: 40 },
    ],
  },
  {
    id: 'packages',
    title: 'Package Run',
    giver: 'Dario Fen',
    briefing: 'Dario stashed five packages around Solmar Bay before the harbour raid. Collect all five and bring the haul back to the diner.',
    reward: 400,
    steps: [
      { kind: 'collect', label: 'Collect the stashed packages (0/5)', count: 5, spots: [[-60, 120], [120, -40], [20, -100], [-120, 20], [60, 60]] },
      { kind: 'goto', label: 'Bring the haul back to Rosa\u2019s Diner', x: -100, z: -60, radius: 6 },
    ],
  },
  {
    id: 'dockyard',
    title: 'Dockyard Standoff',
    giver: 'Mara Voss',
    briefing: 'The Kestrel crew is waiting at the docks with guns out. Clear them out, then report back to Mara. Watch your health.',
    reward: 700,
    steps: [
      { kind: 'fight', label: 'Clear the Kestrel crew at the docks (0/4)', x: 120, z: -100, radius: 14, enemies: 4 },
      { kind: 'goto', label: 'Report back to Mara at the diner', x: -100, z: -60, radius: 6 },
    ],
  },
  {
    id: 'heist',
    title: 'The Solmar Heist',
    giver: 'Mara Voss',
    briefing: 'One last job: the vault at Solmar Trust Bank. Grab the cash, and whatever you do, don\u2019t stop until you reach the boat on the beach.',
    reward: 1500,
    steps: [
      { kind: 'goto', label: 'Reach the Solmar Trust Bank', x: 20, z: -20, radius: 8 },
      { kind: 'grab', label: 'Grab the vault cash', x: 20, z: -20, radius: 5, heatOnStart: 80 },
      { kind: 'escape', label: 'Escape to the boat on the beach', x: -168, z: 60, radius: 8 },
    ],
  },
];

export const PALETTE = {
  sky: 0xffb36b,
  fog: 0xffc98a,
  sun: 0xffe0a8,
  ground: 0x3d3a33,
  road: 0x2e2e33,
  sidewalk: 0x8f8a7d,
  sand: 0xe8cf9a,
  sea: 0x2e7f9e,
  building: [0xd8a06a, 0x9fb4c7, 0xc77b58, 0x7fa88f, 0xb5a6c9, 0xe0cfa8, 0x8fa3b8, 0xd98f7a],
  tower: [0x6b7f95, 0x8a6f5c, 0x5c7a8a],
  car: [0xc23b2e, 0x2e6fc2, 0xe8b93b, 0x3ba86b, 0x8a4fc2, 0xd8d8d8, 0x222831, 0xe07b39],
  pedShirt: [0xe05a4f, 0x4f8fe0, 0x57b25e, 0xe0c04f, 0x9b59d0, 0xefefef, 0x37474f],
  hudText: '#f5efe2',
  hudAccent: '#ffb347',
  wanted: '#ff5252',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
