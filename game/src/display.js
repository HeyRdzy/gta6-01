// The HUD: DOM panels, the canvas minimap, toasts and the title/pause
// screens. The game writes into this module; this module writes into the DOM.

import { clamp } from './util.js';

export function createDisplay(state, hero, story, cops, combat) {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'),
    cash: $('stat-cash'),
    healthFill: $('health-fill'),
    healthNum: $('health-num'),
    stars: $('stars'),
    ammo: $('stat-ammo'),
    speed: $('stat-speed'),
    objective: $('objective'),
    minimap: $('minimap'),
    toast: $('toast'),
    title: $('screen-title'),
    pause: $('screen-pause'),
    vignette: $('vignette'),
    muteBtn: $('btn-mute'),
  };
  const mapCtx = el.minimap.getContext('2d');
  let toastTimer = null;

  const display = {
    say(text) {
      el.objective.textContent = text;
    },

    toast(text) {
      el.toast.textContent = text;
      el.toast.style.opacity = '1';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        el.toast.style.opacity = '0';
      }, 2600);
    },

    showTitle() {
      el.title.style.display = 'flex';
      el.hud.style.display = 'none';
      el.pause.style.display = 'none';
    },

    showHud() {
      el.title.style.display = 'none';
      el.hud.style.display = 'block';
      el.pause.style.display = 'none';
    },

    showPause() {
      el.pause.style.display = 'flex';
    },

    hidePause() {
      el.pause.style.display = 'none';
    },

    update(dt, timeSec) {
      el.cash.textContent = `$${state.cash}`;
      const hp = clamp(state.health / state.maxHealth, 0, 1);
      el.healthFill.style.width = `${hp * 100}%`;
      el.healthFill.style.background = hp > 0.5 ? '#3ddc5a' : hp > 0.25 ? '#ffc21a' : '#ff3b30';
      el.healthNum.textContent = `${Math.ceil(state.health)}`;
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
      el.stars.textContent = stars;
      el.stars.style.textShadow = state.wanted > 0 ? '0 0 12px #ff5c5c, 0 0 24px #ff5c5c' : 'none';
      el.stars.style.color = state.wanted > 0 ? '#ff6a5c' : '#cfd6dd';
      el.ammo.textContent = combat.reloading ? 'RELOADING…' : `AMMO ${combat.ammo} / ${combat.maxAmmo}`;
      el.speed.textContent = hero.driving ? `${Math.round(Math.abs(hero.speed) * 2.2)} mph` : '';
      if (state.health < 35) {
        el.vignette.style.opacity = String(0.55 - state.health / 100);
      } else {
        el.vignette.style.opacity = '0';
      }
      drawMinimap(timeSec);
    },
  };

  function drawMinimap(timeSec) {
    const W = 180;
    const H = 180;
    const s = W / 400; // world -200..200 maps to 0..180
    const px = (x) => (x + 200) * s;
    const pz = (z) => (z + 200) * s;
    const g = mapCtx;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#10151c';
    g.fillRect(0, 0, W, H);
    // Sea and sand on the east edge.
    g.fillStyle = '#1e5f7a';
    g.fillRect(px(182), 0, W - px(182), H);
    g.fillStyle = '#d9b98a';
    g.fillRect(px(150), 0, px(182) - px(150), H);
    // Park in the south-west.
    g.fillStyle = '#2f5a34';
    g.fillRect(px(-180), pz(30), px(-30) - px(-180), pz(180) - pz(30));
    // Streets.
    g.strokeStyle = 'rgba(200,205,210,0.5)';
    g.lineWidth = 1;
    g.setLineDash([4, 3]);
    for (let v = -180; v <= 180; v += 30) {
      g.beginPath();
      g.moveTo(px(v), 0);
      g.lineTo(px(v), H);
      g.stroke();
      g.beginPath();
      g.moveTo(0, pz(v));
      g.lineTo(W, pz(v));
      g.stroke();
    }
    g.setLineDash([]);
    // Landmarks.
    for (const lm of story.landmarks || []) {
      g.fillStyle = lm.color;
      g.beginPath();
      g.arc(px(lm.x), pz(lm.z), 2.5, 0, Math.PI * 2);
      g.fill();
    }
    // Objective waypoint, pulsing gold.
    const wp = story.objectivePoint();
    if (wp) {
      const pulse = 4 + Math.sin(timeSec * 4) * 1.6;
      g.fillStyle = '#ffc21a';
      g.beginPath();
      g.arc(px(wp.x), pz(wp.z), pulse, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,194,26,0.6)';
      g.beginPath();
      g.arc(px(wp.x), pz(wp.z), pulse + 4, 0, Math.PI * 2);
      g.stroke();
    }
    // Cops as blue dots.
    g.fillStyle = '#5aa2ff';
    for (const c of cops.cruisers) {
      g.beginPath();
      g.arc(px(c.mesh.position.x), pz(c.mesh.position.z), 3, 0, Math.PI * 2);
      g.fill();
    }
    // Rivals as red dots.
    g.fillStyle = '#ff4a3a';
    for (const r of combat.rivals) {
      if (r.dead) continue;
      g.beginPath();
      g.arc(px(r.x), pz(r.z), 2.5, 0, Math.PI * 2);
      g.fill();
    }
    // Player arrow with a halo.
    const hx = px(hero.x);
    const hz = pz(hero.z);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.arc(hx, hz, 7, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(hx, hz);
    g.rotate(Math.PI - hero.heading);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 5);
    g.lineTo(-4.5, 5);
    g.closePath();
    g.fill();
    g.restore();
    // Border.
    g.strokeStyle = state.wanted > 0 ? '#ff5c5c' : 'rgba(255,255,255,0.25)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);
  }

  return display;
}
