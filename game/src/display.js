// Solmar Heat — HUD, minimap, toasts, phone calls and screens. Written fresh for round 4.
// HUD lives in the DOM (index.html); the minimap and floating texts are canvas.
import { CFG } from './config.js';
import { clamp } from './util.js';
import { S } from './state.js';
import { currentMission, currentStep } from './story.js';

export function createDisplay(G) {
  const $ = (id) => document.getElementById(id);
  const D = {
    el: {
      hud: $('hud'),
      cash: $('cash'),
      healthFill: $('health-fill'),
      stars: $('stars'),
      ammo: $('ammo'),
      speed: $('speed'),
      vehicle: $('vehicle'),
      objective: $('objective'),
      timer: $('timer'),
      minimap: $('minimap'),
      toasts: $('toasts'),
      phone: $('phone'),
      phoneText: $('phone-text'),
      title: $('title-screen'),
      pause: $('pause-screen'),
      end: $('end-screen'),
      endTitle: $('end-title'),
      endText: $('end-text'),
      vignette: $('vignette'),
      crosshair: $('crosshair'),
      saveInfo: $('save-info'),
    },
    toasts: [],
    phoneTimer: 0,
    damage: 0,
    floaters: [],
  };
  G.display = D;

  D.toast = (text) => {
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = text;
    D.el.toasts.appendChild(div);
    D.toasts.push({ div, t: 0 });
    while (D.toasts.length > 3) {
      const old = D.toasts.shift();
      old.div.remove();
    }
  };

  D.phone = (text) => {
    D.el.phoneText.textContent = text;
    D.el.phone.classList.add('show');
    D.phoneTimer = 6;
  };

  D.setObjective = (text) => {
    D.el.objective.textContent = text;
  };

  D.floater = (x, z, text, color) => {
    D.floaters.push({ x, z, text, color: color || '#fff', life: 1.4, maxLife: 1.4 });
  };

  D.flashDamage = (amount) => {
    D.damage = Math.min(1, D.damage + amount);
  };

  D.showEnd = (title, text) => {
    D.el.endTitle.textContent = title;
    D.el.endText.textContent = text;
    D.el.end.classList.add('show');
  };
  D.hideEnd = () => D.el.end.classList.remove('show');
  D.showTitle = () => D.el.title.classList.add('show');
  D.hideTitle = () => D.el.title.classList.remove('show');
  D.showPause = () => D.el.pause.classList.add('show');
  D.hidePause = () => D.el.pause.classList.remove('show');

  return D;
}

export function updateDisplay(G, dt) {
  const D = G.display;
  const S_ = S;

  // Toast lifetimes.
  for (const t of D.toasts) t.t += dt;
  D.toasts = D.toasts.filter((t) => {
    if (t.t > 3.2) {
      t.div.remove();
      return false;
    }
    return true;
  });

  // Phone call.
  if (D.phoneTimer > 0) {
    D.phoneTimer -= dt;
    if (D.phoneTimer <= 0) D.el.phone.classList.remove('show');
  }

  // Damage vignette fades.
  D.damage = Math.max(0, D.damage - dt * 1.4);
  D.el.vignette.style.opacity = D.damage.toFixed(2);

  // Floaters rise and fade.
  for (const f of D.floaters) f.life -= dt;
  D.floaters = D.floaters.filter((f) => f.life > 0);

  if (S_.mode !== 'playing') return;

  // HUD values.
  D.el.cash.textContent = `$${S_.cash.toLocaleString('en-US')}`;
  D.el.healthFill.style.width = `${clamp(S_.health, 0, 100)}%`;
  D.el.healthFill.style.background = S_.health > 50 ? '#7cff4f' : S_.health > 25 ? '#ffd319' : '#ff5a4e';
  let stars = '';
  for (let i = 0; i < CFG.WANTED_MAX; i++) stars += i < S_.wanted ? '★' : '☆';
  D.el.stars.textContent = stars;
  D.el.stars.style.color = S_.wanted > 0 ? '#ffd319' : 'rgba(255,255,255,0.5)';
  D.el.ammo.textContent = S_.reloading > 0 ? 'RELOADING…' : `${S_.ammo} / ∞`;
  const mph = Math.round(Math.abs(S_.player.speed || 0) * 1.6);
  D.el.speed.textContent = S_.player.onFoot ? '—' : `${mph} mph`;
  D.el.vehicle.textContent = S_.player.onFoot ? 'ON FOOT' : (S_.player.car ? S_.player.car.type.toUpperCase() : 'DRIVING');
  D.el.crosshair.style.display = 'block';

  // Mission timer (Package Run).
  if (S_.missionIndex === 2 && S_.missionActive) {
    D.el.timer.textContent = `⏱ ${Math.max(0, Math.ceil(S_.missionTimer))}s`;
    D.el.timer.style.display = 'block';
  } else {
    D.el.timer.style.display = 'none';
  }

  drawMinimap(G);
}

function drawMinimap(G) {
  const D = G.display;
  const cv = D.el.minimap;
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = 200;
  const H = 200;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#10151c';
  ctx.fillRect(0, 0, W, H);
  // Static city, scaled down (cropped to the playable world bounds:
  // the static canvas covers -480..480 at 2.5 px/unit; the world is -240..240).
  const sx0 = (-240 + 480) * 2.5;
  const sw0 = 480 * 2.5;
  ctx.drawImage(G.world.staticCanvas, sx0, sx0, sw0, sw0, 0, 0, W, H);
  const toMap = (x, z) => ({ x: ((x + 240) / 480) * W, y: ((z + 240) / 480) * H });

  // Waypoint (mission).
  const step = currentStep(G);
  if (step && S.missionActive) {
    const t = step.target(G);
    if (t) {
      const p = toMap(t.x, t.z);
      const r = 5 + 2 * Math.sin(S.time * 4);
      ctx.fillStyle = '#ffd319';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5b00';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // Fare destination.
  if (S.fare) {
    const p = toMap(S.fare.destX, S.fare.destZ);
    ctx.fillStyle = '#7cff4f';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops.
  for (const u of G.cops.units) {
    if (u.hp <= 0) continue;
    const p = toMap(u.x, u.z);
    ctx.fillStyle = Math.floor(S.time * 3) % 2 === 0 ? '#ff2e2e' : '#2e7bff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Enemies.
  for (const e of G.combat.enemies) {
    if (e.dead) continue;
    const p = toMap(e.x, e.z);
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  // Player arrow.
  const pp = toMap(S.player.x, S.player.z);
  ctx.save();
  ctx.translate(pp.x, pp.y);
  ctx.rotate(S.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// World-space floating texts (+$300, WANTED +1, ...).
export function drawFloaters(G) {
  const D = G.display;
  const { ctx, scale } = G;
  ctx.textAlign = 'center';
  for (const f of D.floaters) {
    const p = { x: (f.x - S.camera.x) * scale + G.vw / 2, y: (f.z - S.camera.z) * scale + G.vh / 2 };
    const rise = (1 - f.life / f.maxLife) * 14 * scale * 0.5;
    ctx.globalAlpha = clamp(f.life / f.maxLife, 0, 1);
    ctx.fillStyle = f.color;
    ctx.font = `bold ${Math.max(12, 3.4 * scale * 0.5)}px Arial`;
    ctx.fillText(f.text, p.x, p.y - rise);
  }
  ctx.globalAlpha = 1;
}
