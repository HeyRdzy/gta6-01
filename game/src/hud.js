// The HUD: cash, health, wanted stars, speed, clock, mission objective, subtitles and
// the top-down minimap. All DOM — readable in a screenshot even when scaled down —
// with the minimap drawn on a small canvas each frame.

import { CITY } from './config.js';

/** Wire up the HUD elements already present in index.html. */
export function createHud() {
  const el = (id) => document.getElementById(id);
  const cashEl = el('hud-cash');
  const healthEl = el('hud-health-fill');
  const healthText = el('hud-health-text');
  const starsEl = el('hud-stars');
  const speedEl = el('hud-speed');
  const clockEl = el('hud-clock');
  const objectiveEl = el('hud-objective');
  const subtitleEl = el('hud-subtitle');
  const toastEl = el('hud-toast');
  const minimap = el('minimap');
  const minimapCtx = minimap ? minimap.getContext('2d') : null;
  const titleScreen = el('screen-title');
  const pauseScreen = el('screen-pause');
  const deadScreen = el('screen-dead');
  const vignette = el('damage-vignette');
  const crosshair = el('crosshair');
  let subtitleTimer = 0;
  let toastTimer = 0;
  let toastQueue = [];

  function showOnly(screen) {
    for (const [name, node] of [['title', titleScreen], ['pause', pauseScreen], ['dead', deadScreen]]) {
      if (node) node.style.display = name === screen ? 'flex' : 'none';
    }
    const hud = el('hud');
    if (hud) hud.style.display = screen === 'play' ? 'block' : 'none';
    if (crosshair) crosshair.style.display = screen === 'play' ? 'block' : 'none';
  }

  return {
    showTitle(hasSave) {
      showOnly('title');
      const continueButton = el('btn-continue');
      if (continueButton) continueButton.style.display = hasSave ? 'inline-block' : 'none';
    },
    showPlay() {
      showOnly('play');
    },
    showPause() {
      showOnly('pause');
    },
    showDead() {
      showOnly('dead');
    },

    /** A line of dialogue across the bottom of the screen. */
    showSubtitle(line, seconds) {
      if (!subtitleEl) return;
      subtitleEl.textContent = line;
      subtitleEl.style.opacity = '1';
      subtitleTimer = seconds || 5;
    },

    /** A short toast under the objective (pickups, rewards, warnings). */
    toast(message) {
      toastQueue.push(message);
      if (toastQueue.length > 3) toastQueue.shift();
      if (!toastEl) return;
      toastEl.textContent = toastQueue.join('  •  ');
      toastEl.style.opacity = '1';
      toastTimer = 4;
    },

    /** Red flash when the player takes damage. */
    flashDamage() {
      if (!vignette) return;
      vignette.style.opacity = '0.55';
      window.setTimeout(() => {
        vignette.style.opacity = '0';
      }, 180);
    },

    /** Refresh every HUD number and the minimap from the live game state. */
    update(game, dt) {
      if (subtitleTimer > 0) {
        subtitleTimer -= dt;
        if (subtitleTimer <= 0 && subtitleEl) subtitleEl.style.opacity = '0';
      }
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) {
          if (toastEl) toastEl.style.opacity = '0';
          toastQueue = [];
        }
      }
      if (cashEl) cashEl.textContent = `$${Math.floor(game.cash).toLocaleString('en-US')}`;
      if (healthEl) healthEl.style.width = `${Math.max(0, game.player.state.health)}%`;
      if (healthText) healthText.textContent = `${Math.ceil(game.player.state.health)} HP`;
      if (starsEl) {
        const stars = game.wanted.stars();
        starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
        starsEl.style.color = stars > 0 ? '#ff5252' : '#8b93a3';
      }
      if (speedEl) {
        const kmh = Math.round(Math.abs(game.player.state.speed || 0) * 3.6);
        speedEl.textContent = game.player.isDriving() ? `${kmh} km/h` : '';
      }
      if (clockEl) {
        const totalMinutes = Math.floor(game.clockMinutes || 0);
        const hours = 17 + Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        clockEl.textContent = `${String(hours % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
      if (objectiveEl && game.missions) objectiveEl.textContent = game.missions.objectiveText();
      this.drawMinimap(game);
    },

    /** Top-down map: streets, beach, player arrow, police, waypoint and mission marker. */
    drawMinimap(game) {
      if (!minimapCtx || !minimap) return;
      const size = minimap.width;
      const half = CITY.halfSize + 40;
      const toMap = (x, z) => [((x + half) / (half * 2)) * size, ((z + half) / (half * 2)) * size];
      minimapCtx.clearRect(0, 0, size, size);
      minimapCtx.fillStyle = '#20242c';
      minimapCtx.fillRect(0, 0, size, size);
      // Sea and sand on the west edge.
      minimapCtx.fillStyle = '#2e7f9e';
      minimapCtx.fillRect(0, 0, size * 0.08, size);
      minimapCtx.fillStyle = '#e8cf9a';
      minimapCtx.fillRect(size * 0.08, 0, size * 0.03, size);
      // Streets.
      minimapCtx.strokeStyle = '#5a5f6a';
      minimapCtx.lineWidth = 5;
      for (const street of CITY.streets) {
        const [x1, y1] = toMap(street, -half);
        const [x2, y2] = toMap(street, half);
        minimapCtx.beginPath();
        minimapCtx.moveTo(x1, y1);
        minimapCtx.lineTo(x2, y2);
        minimapCtx.stroke();
        const [x3, y3] = toMap(-half, street);
        const [x4, y4] = toMap(half, street);
        minimapCtx.beginPath();
        minimapCtx.moveTo(x3, y3);
        minimapCtx.lineTo(x4, y4);
        minimapCtx.stroke();
      }
      // Downtown blocks.
      minimapCtx.fillStyle = '#3a4150';
      for (const bx of CITY.blockCentres) {
        for (const bz of CITY.blockCentres) {
          const [x, y] = toMap(bx - 9, bz - 9);
          minimapCtx.fillRect(x, y, 18 * (size / (half * 2)), 18 * (size / (half * 2)));
        }
      }
      // Mission waypoint.
      const waypoint = game.missions ? game.missions.waypoint() : null;
      if (waypoint) {
        const [x, y] = toMap(waypoint.x, waypoint.z);
        minimapCtx.fillStyle = '#ffc23b';
        minimapCtx.beginPath();
        minimapCtx.arc(x, y, 6, 0, Math.PI * 2);
        minimapCtx.fill();
        minimapCtx.strokeStyle = '#fff';
        minimapCtx.lineWidth = 2;
        minimapCtx.stroke();
      }
      // Police cars.
      if (game.police) {
        minimapCtx.fillStyle = '#4f8fe0';
        for (const car of game.police.cars) {
          const [x, y] = toMap(car.mesh.position.x, car.mesh.position.z);
          minimapCtx.beginPath();
          minimapCtx.arc(x, y, 4, 0, Math.PI * 2);
          minimapCtx.fill();
        }
      }
      // Player arrow, pointing along the heading.
      const playerPos = game.player.state.position;
      const [px, py] = toMap(playerPos.x, playerPos.z);
      const heading = game.player.isDriving() && game.player.state.driving
        ? game.player.state.driving.heading
        : game.player.state.heading;
      minimapCtx.save();
      minimapCtx.translate(px, py);
      minimapCtx.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)));
      minimapCtx.fillStyle = '#ffc23b';
      minimapCtx.beginPath();
      minimapCtx.moveTo(0, -8);
      minimapCtx.lineTo(5, 6);
      minimapCtx.lineTo(-5, 6);
      minimapCtx.closePath();
      minimapCtx.fill();
      minimapCtx.restore();
      // North tick.
      minimapCtx.fillStyle = '#f5efe2';
      minimapCtx.font = 'bold 11px system-ui, sans-serif';
      minimapCtx.fillText('N', size - 14, 14);
    },
  };
}
