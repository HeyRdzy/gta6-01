// HUD, minimap and menus for Solmar Heat v2. The HUD lives top-right
// (cash, stars, health, clock, speed) and top-centre (objective); the
// minimap sits bottom-left; the top-left corner stays clear of text.

export class Display {
  constructor(doc) {
    this.doc = doc;
    this.el = {};
    const ids = ['panel-stats', 'stat-cash', 'stat-stars', 'stat-health-bar', 'stat-health-fill', 'stat-health-num',
      'stat-clock', 'stat-speed', 'panel-objective', 'panel-toast', 'panel-subtitle',
      'map-canvas', 'screen-title', 'screen-pause', 'screen-dead', 'btn-start',
      'btn-continue', 'btn-resume', 'btn-quit', 'btn-mute', 'btn-respawn',
      'hud', 'crosshair', 'vignette', 'hint-bar'];
    for (const id of ids) this.el[id] = doc.getElementById(id);
    this.map = this.el['map-canvas'].getContext('2d');
    this.toastT = 0;
    this.subT = 0;
  }

  showPlay() {
    this.el['hud'].style.display = 'block';
    this.el['screen-title'].style.display = 'none';
    this.el['screen-pause'].style.display = 'none';
    this.el['screen-dead'].style.display = 'none';
    this.el['crosshair'].style.display = 'block';
  }

  showTitle(canContinue) {
    this.el['hud'].style.display = 'none';
    this.el['screen-title'].style.display = 'flex';
    this.el['screen-pause'].style.display = 'none';
    this.el['screen-dead'].style.display = 'none';
    this.el['btn-continue'].style.display = canContinue ? 'inline-block' : 'none';
  }

  showPause(muted) {
    this.el['screen-pause'].style.display = 'flex';
    this.el['btn-mute'].textContent = muted ? 'Sound: Off' : 'Sound: On';
  }

  hidePause() { this.el['screen-pause'].style.display = 'none'; }

  showDead() {
    this.el['screen-dead'].style.display = 'flex';
    this.el['hud'].style.display = 'none';
  }

  toast(text, secs = 3) {
    this.el['panel-toast'].textContent = text;
    this.el['panel-toast'].style.opacity = '1';
    this.toastT = secs;
  }

  say(text, secs = 6) {
    this.el['panel-subtitle'].textContent = text;
    this.el['panel-subtitle'].style.opacity = '1';
    this.subT = secs;
  }

  update(dt, state, hero, story, cops) {
    this.el['stat-cash'].textContent = '$' + state.cash;
    const stars = state.stars();
    this.el['stat-stars'].textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    this.el['stat-stars'].style.color = stars > 0 ? '#ff5a4a' : '#f5efe2';
    this.el['stat-health-fill'].style.width = state.health + '%';
    this.el['stat-health-num'].textContent = Math.ceil(state.health) + ' HP';
    this.el['stat-clock'].textContent = state.clockText();
    this.el['stat-speed'].textContent = hero.driving
      ? Math.round(Math.abs(hero.speed) * 3.2) + ' mph' + (hero.driving.damage >= 60 ? '  — SMOKING' : '')
      : '';
    this.el['panel-objective'].textContent = story.title() + '  ·  ' + story.objective();
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.el['panel-toast'].style.opacity = '0';
    }
    if (this.subT > 0) {
      this.subT -= dt;
      if (this.subT <= 0) this.el['panel-subtitle'].style.opacity = '0';
    }
    const low = state.health < 30 ? 0.9 : state.health < 55 ? 0.45 : 0;
    this.el['vignette'].style.opacity = String(low);
    this._drawMap(hero, cops, story);
  }

  _drawMap(hero, cops, story) {
    const g = this.map, S = 190, half = 150;
    const toMap = (x, z) => [(x + half) / (half * 2) * S, (z + half) / (half * 2) * S];
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#2e2a28'; g.fillRect(0, 0, S, S);
    // Sea + sand on the east edge.
    g.fillStyle = '#1d6f8e'; g.fillRect(S * 0.92, 0, S * 0.08, S);
    g.fillStyle = '#e0c188'; g.fillRect(S * 0.86, 0, S * 0.06, S);
    // Park, south-west.
    g.fillStyle = '#4d7a3a'; g.fillRect(S * 0.08, S * 0.72, S * 0.25, S * 0.25);
    // Streets.
    g.strokeStyle = '#5a564f'; g.lineWidth = 3;
    for (let i = -3; i <= 3; i++) {
      const [px] = toMap(i * 42, 0);
      g.beginPath(); g.moveTo(px, 0); g.lineTo(px, S); g.stroke();
      const [, pz] = toMap(0, i * 42);
      g.beginPath(); g.moveTo(0, pz); g.lineTo(S, pz); g.stroke();
    }
    // Waypoint.
    const wp = story.waypoint();
    if (wp) {
      const [wx, wz] = toMap(wp.x, wp.z);
      g.fillStyle = '#ffc23b';
      g.beginPath(); g.arc(wx, wz, 6, 0, Math.PI * 2); g.fill();
    }
    // Police.
    g.fillStyle = '#4a8aff';
    for (const c of cops.cars) {
      const [cx, cz] = toMap(c.mesh.position.x, c.mesh.position.z);
      g.beginPath(); g.arc(cx, cz, 4, 0, Math.PI * 2); g.fill();
    }
    // Player arrow.
    const [px, pz] = toMap(hero.x, hero.z);
    g.save();
    g.translate(px, pz);
    g.rotate(Math.atan2(Math.sin(hero.heading), Math.cos(hero.heading)) + Math.PI);
    g.fillStyle = hero.driving ? '#ffb347' : '#ffffff';
    g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
  }
}
