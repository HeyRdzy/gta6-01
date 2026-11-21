// Solmar Heat — the city of Solmar Bay. Written fresh for round 4.
// Top-down open world: a street grid with downtown towers north-west, a
// park and pond south-west, a beach and pier east, and a dockyard south-east.
// The static city (ground, roads, buildings) is pre-rendered once to an
// offscreen canvas; cars, people and lights are drawn every frame.
import { CFG } from './config.js';
import { rand, randInt, choice } from './util.js';

const STATIC_PX = 2400; // offscreen canvas size
const WORLD_EXT = 480; // the static canvas covers world -480..480 (sea runs past the east edge)
const PX_PER_UNIT = STATIC_PX / (WORLD_EXT * 2);

function sx(wx) {
  return (wx + WORLD_EXT) * PX_PER_UNIT;
}
function sy(wz) {
  return (wz + WORLD_EXT) * PX_PER_UNIT;
}
function sw(w) {
  return w * PX_PER_UNIT;
}

export function createWorld(G) {
  const W = {
    colliders: [],
    buildings: [],
    palms: [],
    lights: [],
    neons: [],
    containers: [],
    cranes: [],
    ramps: [
      { x: 196, z: -90, angle: 0 },
      { x: -196, z: -90, angle: Math.PI },
    ],
    landmarks: {
      bank: { x: -120, z: -120 },
      hospital: { x: 120, z: -120 },
      safehouse: { x: -60, z: 120 },
      marina: { x: 262, z: 0 },
      dockyard: { x: 120, z: 120 },
      park: { x: -150, z: 120 },
      pond: { x: -150, z: 120, r: 28 },
    },
    nodes: [],
    staticCanvas: null,
  };

  // Intersection nodes for traffic routing.
  for (const x of CFG.STREETS) {
    for (const z of CFG.STREETS) W.nodes.push({ x, z });
  }

  // ---- Buildings, one block at a time -------------------------------------
  const blockCenters = [-180, -120, -60, 0, 60, 120, 180];
  const isPark = (bx, bz) => bx >= -180 && bx <= -120 && bz >= 60 && bz <= 180;
  const isDock = (bx, bz) => bx >= 60 && bx <= 180 && bz >= 60 && bz <= 180;
  const isDowntown = (bx, bz) => bx >= -180 && bx <= -60 && bz >= -180 && bz <= -60;

  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      if (isPark(bx, bz) || isDock(bx, bz)) continue;
      if (bx === 180) {
        // Beachfront: two small houses with palms.
        for (const [ox, oz] of [[-10, -10], [10, 10]]) {
          addBuilding(W, bx + ox, bz + oz, 20, 18, 'house');
        }
        W.palms.push({ x: bx - 14, z: bz - 14 }, { x: bx + 14, z: bz + 16 });
        continue;
      }
      if (isDowntown(bx, bz)) {
        const tall = bx === -120 && bz === -120; // the bank
        addBuilding(W, bx, bz, tall ? 34 : 30, tall ? 30 : 28, tall ? 'bank' : 'tower');
        if (!tall) W.neons.push({ x: bx, z: bz + 16, color: choice(CFG.COL.neon) });
      } else if (bx === 120 && bz === -120) {
        addBuilding(W, bx, bz, 34, 28, 'hospital');
      } else if (bx === -60 && bz === 120) {
        addBuilding(W, bx, bz, 26, 22, 'safehouse');
      } else {
        // Regular block: one or two mid buildings.
        if (Math.random() < 0.5) {
          addBuilding(W, bx, bz, rand(26, 34), rand(24, 32), 'mid');
        } else {
          addBuilding(W, bx - 11, bz, 20, 26, 'mid');
          addBuilding(W, bx + 11, bz, 20, 26, 'mid');
        }
      }
    }
  }

  // ---- Dockyard containers and cranes --------------------------------------
  const dockColors = CFG.COL.container;
  for (let i = 0; i < 14; i++) {
    const cx = rand(72, 168);
    const cz = rand(72, 168);
    W.containers.push({
      x: cx,
      z: cz,
      w: rand(16, 24),
      d: 8,
      angle: Math.random() < 0.5 ? 0 : Math.PI / 2,
      color: choice(dockColors),
      stacked: Math.random() < 0.3,
    });
    W.colliders.push({ x: cx, z: cz, w: 22, d: 8 });
  }
  W.cranes.push({ x: 84, z: 84 }, { x: 156, z: 156 });

  // ---- Palms, streetlights --------------------------------------------------
  for (let i = 0; i < 14; i++) W.palms.push({ x: rand(208, 224), z: rand(-200, 200) });
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(18, 26);
    W.palms.push({ x: -150 + Math.cos(a) * r, z: 120 + Math.sin(a) * r });
  }
  for (const x of CFG.STREETS) {
    for (const z of CFG.STREETS) {
      if ((x + z) % 120 === 0) W.lights.push({ x: x + 10, z: z + 10 });
    }
  }

  // ---- Sea boundary (with a gap for the pier) ------------------------------
  W.colliders.push({ x: 360, z: -124, w: 256, d: 232 });
  W.colliders.push({ x: 360, z: 124, w: 256, d: 232 });
  W.colliders.push({ x: 302, z: 0, w: 6, d: 16 }); // pier end

  G_NODES = W.nodes;
  W.staticCanvas = renderStatic(W);
  return W;
}

function addBuilding(W, x, z, w, d, kind) {
  const roof =
    kind === 'tower'
      ? CFG.COL.downtownRoof
      : kind === 'bank'
        ? '#9a8f7a'
        : kind === 'hospital'
          ? '#e8e8e8'
          : kind === 'safehouse'
            ? '#7a9a6a'
            : kind === 'house'
              ? '#a8876a'
              : CFG.COL.buildingRoof;
  const b = { x, z, w, d, kind, roof, h: kind === 'tower' ? 3 : kind === 'bank' ? 2 : 1 };
  W.buildings.push(b);
  W.colliders.push({ x, z, w: w - 2, d: d - 2 });
  return b;
}

// Pre-render everything that never moves.
function renderStatic(W) {
  const c = document.createElement('canvas');
  c.width = STATIC_PX;
  c.height = STATIC_PX;
  const g = c.getContext('2d');
  const C = CFG.COL;

  // Grass base.
  g.fillStyle = C.grass;
  g.fillRect(0, 0, STATIC_PX, STATIC_PX);

  // Sea (east) and sand strip.
  g.fillStyle = C.seaDeep;
  g.fillRect(sx(232), 0, STATIC_PX - sx(232), STATIC_PX);
  g.fillStyle = C.sea;
  g.fillRect(sx(232), 0, STATIC_PX - sx(232), STATIC_PX);
  g.fillStyle = C.sand;
  g.fillRect(sx(205), 0, sw(27), STATIC_PX);

  // Park (south-west) and pond.
  g.fillStyle = C.grassDark;
  g.fillRect(sx(-195), sy(45), sw(90), sw(150));
  g.fillStyle = C.pond;
  g.beginPath();
  g.ellipse(sx(-150), sy(120), sw(28), sw(20), 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#7fb069';
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    g.arc(sx(rand(-190, -110)), sy(rand(55, 185)), sw(rand(3, 6)), 0, Math.PI * 2);
    g.fill();
  }

  // Dockyard concrete (south-east).
  g.fillStyle = '#6f6f66';
  g.fillRect(sx(45), sy(45), sw(150), sw(150));
  g.strokeStyle = '#3f3f38';
  g.lineWidth = sw(1);
  g.strokeRect(sx(45), sy(45), sw(150), sw(150));

  // Sidewalks: one slab per block.
  g.fillStyle = C.sidewalk;
  for (const bx of [-180, -120, -60, 0, 60, 120, 180]) {
    for (const bz of [-180, -120, -60, 0, 60, 120, 180]) {
      g.fillRect(sx(bx - 23), sy(bz - 23), sw(46), sw(46));
    }
  }

  // Roads.
  g.fillStyle = C.asphalt;
  for (const s of CFG.STREETS) {
    g.fillRect(sx(s - 7), 0, sw(14), STATIC_PX);
    g.fillRect(0, sy(s - 7), STATIC_PX, sw(14));
  }
  // Centre dashes.
  g.fillStyle = C.roadLine;
  for (const s of CFG.STREETS) {
    for (let v = -234; v < 234; v += 12) {
      g.fillRect(sx(s - 0.4), sy(v), sw(0.8), sw(6));
      g.fillRect(sx(v), sy(s - 0.4), sw(6), sw(0.8));
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = '#dfe3e6';
  for (const x of CFG.STREETS) {
    for (const z of CFG.STREETS) {
      for (let k = -3; k <= 3; k++) {
        g.fillRect(sx(x + k * 1.8 - 0.7), sy(z - 9), sw(1.4), sw(3));
        g.fillRect(sx(x + k * 1.8 - 0.7), sy(z + 6), sw(1.4), sw(3));
      }
    }
  }

  // Pier (east, at z = 0).
  g.fillStyle = '#8a6b45';
  g.fillRect(sx(232), sy(-7), sw(68), sw(14));
  g.fillStyle = '#6e5436';
  for (let x = 234; x < 298; x += 4) g.fillRect(sx(x), sy(-7), sw(1), sw(14));
  g.fillStyle = '#d8c078';
  g.beginPath();
  g.arc(sx(300), sy(0), sw(5), 0, Math.PI * 2);
  g.fill();

  // Buildings: shadow, roof, edge, rooftop details.
  for (const b of W.buildings) {
    const bx = sx(b.x - b.w / 2);
    const bz = sy(b.z - b.d / 2);
    const bw = sw(b.w);
    const bd = sw(b.d);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(bx + sw(2), bz + sw(2), bw, bd);
    g.fillStyle = b.roof;
    g.fillRect(bx, bz, bw, bd);
    g.strokeStyle = C.buildingEdge;
    g.lineWidth = sw(0.8);
    g.strokeRect(bx, bz, bw, bd);
    // Rooftop details.
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(bx + bw * 0.15, bz + bd * 0.15, bw * 0.2, bd * 0.2);
    g.fillRect(bx + bw * 0.6, bz + bd * 0.55, bw * 0.25, bd * 0.25);
    if (b.kind === 'tower') {
      g.strokeStyle = '#dfe8f2';
      g.lineWidth = sw(0.7);
      g.beginPath();
      g.arc(bx + bw / 2, bz + bd / 2, sw(6), 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#ff5a4e';
      g.beginPath();
      g.arc(bx + bw / 2, bz + bd / 2, sw(1.2), 0, Math.PI * 2);
      g.fill();
    }
    if (b.kind === 'bank') {
      g.fillStyle = '#2c4a6b';
      g.fillRect(bx + bw * 0.3, bz + bd * 0.3, bw * 0.4, bd * 0.4);
      g.fillStyle = '#ffd319';
      g.font = `bold ${Math.round(sw(9))}px Arial`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('$', bx + bw / 2, bz + bd / 2);
    }
    if (b.kind === 'hospital') {
      g.fillStyle = '#c22e2e';
      g.fillRect(bx + bw / 2 - sw(1), bz + bd * 0.3, sw(2), bd * 0.4);
      g.fillRect(bx + bw * 0.3, bz + bd / 2 - sw(1), bw * 0.4, sw(2));
    }
  }

  // Dockyard containers and cranes.
  for (const cn of W.containers) {
    g.save();
    g.translate(sx(cn.x), sy(cn.z));
    g.rotate(cn.angle);
    g.fillStyle = cn.color;
    g.fillRect(-sw(cn.w / 2), -sw(cn.d / 2), sw(cn.w), sw(cn.d));
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = sw(0.6);
    g.strokeRect(-sw(cn.w / 2), -sw(cn.d / 2), sw(cn.w), sw(cn.d));
    if (cn.stacked) {
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(-sw(cn.w / 2) + sw(2), -sw(cn.d / 2) - sw(3), sw(cn.w) - sw(4), sw(3));
    }
    g.restore();
  }
  g.strokeStyle = '#3a3f45';
  g.lineWidth = sw(1.4);
  for (const cr of W.cranes) {
    g.strokeRect(sx(cr.x - 6), sy(cr.z - 6), sw(12), sw(12));
    g.beginPath();
    g.moveTo(sx(cr.x - 6), sy(cr.z));
    g.lineTo(sx(cr.x + 16), sy(cr.z - 4));
    g.stroke();
  }

  // Palms.
  for (const p of W.palms) {
    g.fillStyle = '#6e5436';
    g.fillRect(sx(p.x) - sw(0.7), sy(p.z) - sw(0.7), sw(1.4), sw(1.4));
    g.fillStyle = '#3f7d33';
    g.beginPath();
    g.arc(sx(p.x), sy(p.z), sw(3.2), 0, Math.PI * 2);
    g.fill();
  }

  // Stunt ramps.
  for (const r of W.ramps) {
    g.save();
    g.translate(sx(r.x), sy(r.z));
    g.rotate(r.angle);
    g.fillStyle = '#ff7a1a';
    g.beginPath();
    g.moveTo(-sw(7), sw(5));
    g.lineTo(sw(7), sw(5));
    g.lineTo(sw(7), -sw(5));
    g.closePath();
    g.fill();
    g.fillStyle = '#ffd319';
    g.fillRect(-sw(7), sw(3.4), sw(14), sw(1.6));
    g.restore();
  }

  // Neon sign plates on downtown buildings (glow is drawn at night).
  for (const n of W.neons) {
    g.fillStyle = n.color;
    g.fillRect(sx(n.x - 6), sy(n.z - 1), sw(12), sw(2));
  }
  return c;
}

// Draw the visible part of the static city (source rect clamped to the canvas).
export function drawWorld(G) {
  const { ctx, vw, vh, scale } = G;
  const cam = G.S.camera;
  const W = G.world;
  const left = cam.x - vw / 2 / scale;
  const top = cam.z - vh / 2 / scale;
  const w = vw / scale;
  const h = vh / scale;
  let sX = sx(left);
  let sY = sy(top);
  let sW = sw(w);
  let sH = sw(h);
  let dX = 0;
  let dY = 0;
  let dW = vw;
  let dH = vh;
  if (sX < 0) {
    dX = (-sX / sW) * vw;
    dW -= dX;
    sW += sX;
    sX = 0;
  }
  if (sY < 0) {
    dY = (-sY / sH) * vh;
    dH -= dY;
    sH += sY;
    sY = 0;
  }
  if (sX + sW > STATIC_PX) {
    const over = sX + sW - STATIC_PX;
    dW -= (over / sW) * vw;
    sW -= over;
  }
  if (sY + sH > STATIC_PX) {
    const over = sY + sH - STATIC_PX;
    dH -= (over / sH) * vh;
    sH -= over;
  }
  if (sW > 0 && sH > 0 && dW > 0 && dH > 0) {
    ctx.drawImage(W.staticCanvas, sX, sY, sW, sH, dX, dY, dW, dH);
  }
}

// Convert world coords to screen coords.
export function worldToScreen(G, wx, wz) {
  const { vw, vh, scale } = G;
  return {
    x: (wx - G.S.camera.x) * scale + vw / 2,
    y: (wz - G.S.camera.z) * scale + vh / 2,
  };
}

// Is a world point on a road (within half road width of a street)?
export function onRoad(x, z) {
  const near = (v) => CFG.STREETS.some((s) => Math.abs(v - s) <= CFG.ROAD_W / 2 + 1);
  return near(x) || near(z);
}

// Nearest intersection node to a point.
export function nearestNode(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const n of G_NODES) {
    const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

let G_NODES = [];
export function setNodes(nodes) {
  G_NODES = nodes;
}
