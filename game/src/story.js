// Solmar Heat — five story jobs from Mara Voss, $3,400 on the table.
// Written fresh for round 4. Missions are data: each step has a target, a
// completion check, and hooks for when the step starts and ends.
import { CFG } from './config.js';
import { dist, clamp } from './util.js';
import { S, addCash, saveGame } from './state.js';
import { spawnEnemy } from './combat.js';

const MISSIONS = [
  {
    name: 'Sunset Courier',
    pay: 300,
    intro: 'Mara: Take this package to the pier boat. Do not keep the boat waiting.',
    steps: [
      {
        text: 'Deliver the package to the pier',
        target: (G) => G.world.landmarks.marina,
        done: (G) => near(G, G.world.landmarks.marina, 12),
      },
    ],
  },
  {
    name: 'Getaway Driver',
    pay: 500,
    intro: 'Mara: Pick up my associate outside the bank. The PD will be on you — get him to the safehouse.',
    steps: [
      {
        text: 'Pick up the associate at the bank',
        target: (G) => G.world.landmarks.bank,
        done: (G) => near(G, G.world.landmarks.bank, 12),
        onDone: (G) => {
          S.wanted = Math.max(S.wanted, 2);
          G.display.toast('Cops on you! Lose them at the safehouse.');
        },
      },
      {
        text: 'Reach the safehouse',
        target: (G) => G.world.landmarks.safehouse,
        done: (G) => near(G, G.world.landmarks.safehouse, 12),
      },
    ],
  },
  {
    name: 'Package Run',
    pay: 600,
    intro: 'Mara: Three packages, 150 seconds. Park, dockyard, beach — move!',
    steps: [
      {
        text: 'Pick up package 1/3 — the park',
        target: (G) => G.world.landmarks.park,
        done: (G) => near(G, G.world.landmarks.park, 12),
      },
      {
        text: 'Pick up package 2/3 — the dockyard',
        target: (G) => G.world.landmarks.dockyard,
        done: (G) => near(G, G.world.landmarks.dockyard, 12),
      },
      {
        text: 'Pick up package 3/3 — the beach',
        target: (G) => ({ x: 216, z: -120 }),
        done: (G) => near(G, { x: 216, z: -120 }, 12),
      },
    ],
  },
  {
    name: 'Dockyard Standoff',
    pay: 800,
    intro: 'Mara: The dock crew took my crate. Take it back — they will shoot.',
    steps: [
      {
        text: 'Reach the dockyard',
        target: (G) => G.world.landmarks.dockyard,
        done: (G) => near(G, G.world.landmarks.dockyard, 14),
        onDone: (G) => {
          const c = G.world.landmarks.dockyard;
          spawnEnemy(G, c.x - 14, c.z - 10);
          spawnEnemy(G, c.x + 12, c.z - 14);
          spawnEnemy(G, c.x - 8, c.z + 14);
          spawnEnemy(G, c.x + 16, c.z + 10);
          G.display.toast('Dock crew! Take them down.');
        },
      },
      {
        text: 'Defeat the dock crew (0/4)',
        target: (G) => G.world.landmarks.dockyard,
        done: (G) => G.combat.enemies.length > 0 && G.combat.enemies.every((e) => e.dead),
      },
      {
        text: 'Grab the crate',
        target: (G) => ({ x: 120, z: 108 }),
        done: (G) => near(G, { x: 120, z: 108 }, 10),
      },
    ],
  },
  {
    name: 'The Solmar Heist',
    pay: 1200,
    intro: 'Mara: The big one. Crack the bank vault, then run for the pier boat.',
    steps: [
      {
        text: 'Reach the bank',
        target: (G) => G.world.landmarks.bank,
        done: (G) => near(G, G.world.landmarks.bank, 12),
      },
      {
        text: 'Crack the vault — stay close (0%)',
        target: (G) => G.world.landmarks.bank,
        done: (G) => (G.story.crackT || 0) >= 10,
      },
      {
        text: 'Escape to the pier boat!',
        target: (G) => G.world.landmarks.marina,
        done: (G) => near(G, G.world.landmarks.marina, 12),
        onEnter: (G) => {
          S.wanted = 4;
          G.display.toast('4 stars! Run for the boat!');
        },
      },
    ],
  },
];

function near(G, pt, r) {
  return dist(S.player.x, S.player.z, pt.x, pt.z) < r;
}

export function createStory(G) {
  const story = {
    crackT: 0,
    startDelay: 1.2,
    allDone: false,
    wasted: () => wasted(G),
    busted: () => busted(G),
    respawn: () => respawn(G),
  };
  return story;
}

export function currentMission() {
  return MISSIONS[S.missionIndex] || null;
}

export function currentStep(G) {
  const m = currentMission();
  if (!m) return null;
  return m.steps[S.missionStep] || null;
}

export function currentTarget(G) {
  const step = currentStep(G);
  if (!step) return null;
  return step.target(G);
}

function startMission(G, i) {
  const m = MISSIONS[i];
  if (!m) return;
  S.missionIndex = i;
  S.missionStep = 0;
  S.missionTimer = i === 2 ? 150 : 0;
  S.missionActive = true;
  G.story.crackT = 0;
  G.display.setObjective(`${m.name} — ${m.steps[0].text}`);
  G.display.toast(`JOB: ${m.name} — $${m.pay}`);
  G.display.phone(m.intro);
}

function completeMission(G) {
  const m = currentMission();
  addCash(m.pay);
  S.stats.missionsDone += 1;
  G.display.toast(`${m.name} complete! +$${m.pay}`);
  G.display.floater(S.player.x, S.player.z, `+$${m.pay}`, '#ffd319');
  G.sound.chime();
  saveGame();
  S.missionActive = false;
  if (S.missionIndex + 1 >= MISSIONS.length) {
    G.story.allDone = true;
    G.display.setObjective('All jobs done — free roam Solmar Bay!');
    G.display.phone('Mara: $3,400. You are square with me, Rio. The city is yours.');
  } else {
    S.missionIndex += 1;
    G.story.startDelay = 2.5;
  }
}

export function updateStory(G, dt) {
  if (S.mode !== 'playing') return;
  if (G.story.allDone) return;

  if (!S.missionActive) {
    G.story.startDelay -= dt;
    if (G.story.startDelay <= 0) startMission(G, S.missionIndex);
    return;
  }

  const m = currentMission();
  if (!m) return;
  const step = currentStep(G);
  if (!step) {
    completeMission(G);
    return;
  }

  // Package Run timer.
  if (S.missionIndex === 2) {
    S.missionTimer -= dt;
    if (S.missionTimer <= 0) {
      G.display.toast('Too slow! Mara gives you another shot.');
      G.display.phone('Mara: The packages moved on. Start the run again.');
      startMission(G, 2);
      return;
    }
  }

  // Vault cracking: hold near the bank to fill the progress.
  if (S.missionIndex === 4 && S.missionStep === 1) {
    if (near(G, G.world.landmarks.bank, 12)) {
      G.story.crackT += dt;
    } else {
      G.story.crackT = Math.max(0, G.story.crackT - dt * 0.5);
    }
    step.text = `Crack the vault — stay close (${Math.floor(clamp(G.story.crackT / 10, 0, 1) * 100)}%)`;
    G.display.setObjective(`${m.name} — ${step.text}`);
  }

  // Defeat-the-crew counter.
  if (S.missionIndex === 3 && S.missionStep === 1) {
    const left = G.combat.enemies.filter((e) => !e.dead).length;
    step.text = `Defeat the dock crew (${4 - left}/4)`;
    G.display.setObjective(`${m.name} — ${step.text}`);
  }

  if (step.done(G)) {
    if (step.onDone) step.onDone(G);
    S.missionStep += 1;
    G.story.crackT = 0;
    const next = currentStep(G);
    if (next) {
      if (next.onEnter) next.onEnter(G);
      G.display.setObjective(`${m.name} — ${next.text}`);
    } else {
      completeMission(G);
    }
  }
}

// Gold beacon at the current waypoint.
export function drawBeacon(G) {
  const target = currentTarget(G);
  if (!target || !S.missionActive || S.mode !== 'playing') return;
  const { ctx, scale } = G;
  const p = { x: (target.x - S.camera.x) * scale + G.vw / 2, y: (target.z - S.camera.z) * scale + G.vh / 2 };
  const pulse = 0.6 + 0.4 * Math.sin(S.time * 4);
  // Beam.
  const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26 * scale * 0.5 * pulse);
  grad.addColorStop(0, 'rgba(255, 211, 25, 0.5)');
  grad.addColorStop(1, 'rgba(255, 211, 25, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 26 * scale * 0.5 * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Ring.
  ctx.strokeStyle = '#ffd319';
  ctx.lineWidth = Math.max(1.5, 0.8 * scale * 0.5);
  ctx.beginPath();
  ctx.arc(p.x, p.y, 9 * scale * 0.5 * (1 + 0.12 * Math.sin(S.time * 4)), 0, Math.PI * 2);
  ctx.stroke();
  // Distance label.
  const d = Math.round(dist(S.player.x, S.player.z, target.x, target.z));
  ctx.fillStyle = '#ffd319';
  ctx.font = `bold ${Math.max(11, 3 * scale * 0.5)}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(`${d}m`, p.x, p.y - 12 * scale * 0.5);
}

// Fare marker (green) when a taxi fare is active.
export function drawFareMarker(G) {
  if (!S.fare) return;
  const { ctx, scale } = G;
  const p = { x: (S.fare.destX - S.camera.x) * scale + G.vw / 2, y: (S.fare.destZ - S.camera.z) * scale + G.vh / 2 };
  ctx.strokeStyle = '#7cff4f';
  ctx.lineWidth = Math.max(1.5, 0.8 * scale * 0.5);
  ctx.beginPath();
  ctx.arc(p.x, p.y, 8 * scale * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#7cff4f';
  ctx.font = `bold ${Math.max(11, 3 * scale * 0.5)}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(`$${S.fare.amount}`, p.x, p.y - 11 * scale * 0.5);
}

// The player was wasted (health 0) or busted (caught on foot).
export function wasted(G) {
  if (S.mode !== 'playing') return;
  S.mode = 'wasted';
  G.display.showEnd('WASTED', 'The Solmar PD scrapes you off the boulevard. Hospital fee: 10% of your cash.');
}

export function busted(G) {
  if (S.mode !== 'playing') return;
  S.mode = 'busted';
  S.cash = Math.max(0, S.cash - CFG.BUST_FINE);
  G.display.showEnd('BUSTED', `The PD books you. Fine: $${CFG.BUST_FINE}.`);
}

export function respawn(G) {
  S.health = 100;
  S.wanted = 0;
  if (S.mode === 'wasted') S.cash = Math.round(S.cash * (1 - CFG.HOSPITAL_FEE_FRAC));
  S.player.x = G.world.landmarks.hospital.x;
  S.player.z = G.world.landmarks.hospital.z + 20;
  S.player.onFoot = true;
  S.player.car = null;
  S.player.angle = Math.PI / 2;
  S.camera.x = S.player.x;
  S.camera.z = S.player.z;
  G.combat.enemies = [];
  S.mode = 'playing';
  G.display.hideEnd();
  G.display.toast('Back on the streets. Mara is waiting.');
}
