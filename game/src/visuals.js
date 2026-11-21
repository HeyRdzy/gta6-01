// Solmar Heat — time of day, sky tint and night lighting. Written fresh for round 4.
// The game is top-down, so "sky" is a colour wash over the whole frame plus
// pools of light around streetlights and headlights after dusk.
import { CFG } from './config.js';
import { clamp, lerp } from './util.js';
import { worldToScreen } from './world.js';

// Sun elevation: 0 at midnight, 1 at noon. tod 0.25 = dawn, 0.75 = dusk.
export function sunLevel(tod) {
  return clamp(Math.sin((tod - 0.25) * Math.PI * 2) * 0.5 + 0.5, 0, 1);
}

export function createVisuals() {
  return { flicker: 0 };
}

export function updateVisuals(G, dt) {
  const S = G.S;
  S.tod = (S.tod + dt / CFG.DAY_LENGTH) % 1;
  G.visuals.flicker += dt;
}

// Colour wash + light pools, drawn after the world and entities.
export function drawLighting(G) {
  const { ctx, vw, vh } = G;
  const S = G.S;
  const sun = sunLevel(S.tod);
  const night = 1 - sun;

  // Golden-hour wash near dawn/dusk, deep blue wash at night.
  let wash = null;
  if (sun < 0.55) {
    const duskness = clamp((0.55 - sun) / 0.55, 0, 1);
    const warm = sun > 0.25 ? 1 : 0.4;
    wash = `rgba(20, 16, 64, ${(night * 0.42).toFixed(3)})`;
    if (warm > 0.5 && night < 0.85) {
      // Golden hour: warm orange over the dark blue.
      ctx.fillStyle = `rgba(255, 122, 26, ${(0.10 * duskness).toFixed(3)})`;
      ctx.fillRect(0, 0, vw, vh);
    }
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, vw, vh);
  }

  // Light pools after dusk: streetlights and headlights.
  if (night > 0.25) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = (sx, sy, r, alpha) => {
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      grad.addColorStop(0, `rgba(255, 214, 130, ${alpha.toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255, 214, 130, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    const a = 0.35 * night;
    for (const L of G.world.lights) {
      const p = worldToScreen(G, L.x, L.z);
      if (p.x < -60 || p.x > vw + 60 || p.y < -60 || p.y > vh + 60) continue;
      glow(p.x, p.y, 46 * G.scale * 0.6, a);
    }
    // Neon signs flicker and glow.
    for (const n of G.world.neons) {
      const p = worldToScreen(G, n.x, n.z);
      if (p.x < -80 || p.x > vw + 80 || p.y < -80 || p.y > vh + 80) continue;
      const fl = 0.75 + 0.25 * Math.sin(G.visuals.flicker * 3 + n.x);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 34 * G.scale * 0.5);
      grad.addColorStop(0, n.color + Math.round(150 * fl).toString(16).padStart(2, '0'));
      grad.addColorStop(1, n.color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34 * G.scale * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Headlight cones in front of moving cars.
    const cars = [];
    if (G.traffic) cars.push(...G.traffic.cars);
    if (G.cops) cars.push(...G.cops.units);
    if (G.hero && G.hero.car) cars.push(G.hero.car);
    for (const car of cars) {
      const p = worldToScreen(G, car.x, car.z);
      const fx = p.x + Math.cos(car.angle) * 26 * G.scale * 0.5;
      const fy = p.y + Math.sin(car.angle) * 26 * G.scale * 0.5;
      glow(fx, fy, 30 * G.scale * 0.5, a * 0.8);
    }
    ctx.restore();
  }

  // Vignette.
  const vg = ctx.createRadialGradient(
    vw / 2, vh / 2, Math.min(vw, vh) * 0.42,
    vw / 2, vh / 2, Math.max(vw, vh) * 0.75,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, vw, vh);
}
