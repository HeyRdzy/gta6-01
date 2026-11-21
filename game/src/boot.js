// Solmar Heat — boot, game loop and rendering. Written fresh for round 4.
import { CFG } from './config.js';
import { clamp } from './util.js';
import { S, resetRun, saveGame, loadGame, addCash } from './state.js';
import { createWorld, drawWorld } from './world.js';
import { createVisuals, updateVisuals, drawLighting } from './visuals.js';
import { createControls } from './controls.js';
import { createSound } from './sound.js';
import { createHero, updateHero, drawHero, drawCar } from './hero.js';
import { createTraffic, updateTraffic, drawTraffic } from './traffic.js';
import { createCops, updateCops, drawCops } from './cops.js';
import { createCombat, updateCombat, drawCombat } from './combat.js';
import { createStory, updateStory, drawBeacon, drawFareMarker, currentStep } from './story.js';
import { createDisplay, updateDisplay, drawFloaters } from './display.js';
import { applyShot } from './stage.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const G = {
  canvas,
  ctx,
  vw: 1280,
  vh: 720,
  scale: 2,
  S,
  CFG,
  world: null,
  visuals: null,
  input: null,
  sound: null,
  hero: null,
  traffic: null,
  cops: null,
  combat: null,
  story: null,
  display: null,
  effects: [],
  tracers: [],
  frames: 0,
  shotName: null,
  shotZoom: 1,
};

function resize() {
  G.vw = window.innerWidth;
  G.vh = window.innerHeight;
  canvas.width = G.vw;
  canvas.height = G.vh;
  G.scale = clamp(Math.min(G.vw / 430, G.vh / 260), 1.2, 4) * (G.shotZoom || 1);
}
window.addEventListener('resize', resize);
resize();

G.world = createWorld(G);
G.visuals = createVisuals();
G.input = createControls(G);
G.sound = createSound();
G.hero = createHero(G);
G.traffic = createTraffic(G);
G.cops = createCops(G);
G.combat = createCombat(G);
G.story = createStory(G);
G.display = createDisplay(G);
G.effects = [];
G.tracers = [];

// ---- Buttons ---------------------------------------------------------------
document.getElementById('start-btn').addEventListener('click', () => {
  G.sound.ensure();
  resetRun();
  G.display.hideTitle();
  S.mode = 'playing';
  G.display.setObjective('Sunset Courier — deliver the package to the pier');
  G.display.phone('Mara: Rio. Five jobs, $3,400. First one is easy — pier boat, sunset. Go.');
});
document.getElementById('resume-btn').addEventListener('click', () => {
  S.mode = 'playing';
  G.display.hidePause();
});
document.getElementById('save-btn').addEventListener('click', () => {
  saveGame();
  G.display.toast('Game saved.');
});
document.getElementById('restart-btn').addEventListener('click', () => {
  window.location.reload();
});
document.getElementById('retry-btn').addEventListener('click', () => {
  G.story.respawn();
});

// Save info on the title screen.
const save = loadGame();
if (save) {
  const el = document.getElementById('save-info');
  el.textContent = `Save found: $${save.cash.toLocaleString('en-US')} — ${save.missionsDone} job(s) done. Starting fresh keeps your save until you save again.`;
}

// ---- Staged screenshots (?shot=start|play|chase|mission) --------------------
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  resize();
  applyShot(G, shot);
}

// ---- Main loop ---------------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  G.frames += 1;
  G.input.updateMouseWorld();
  G.sound.setMuted(S.muted);

  if (S.mode === 'playing') {
    S.time += dt;
    updateVisuals(G, dt);
    updateStory(G, dt);
    updateTraffic(G, dt);
    updateCops(G, dt);
    updateHero(G, dt);
    updateCombat(G, dt);
  } else if (S.mode === 'title') {
    // Living backdrop behind the title: traffic cruises, sun drifts.
    S.time += dt;
    updateVisuals(G, dt);
    updateTraffic(G, dt);
    const t = S.time * 0.05;
    S.camera.x = 60 * Math.cos(t);
    S.camera.z = 40 * Math.sin(t);
  }
  updateDisplay(G, dt);

  // Pause toggle.
  if (G.input.pressed('Escape')) {
    if (S.mode === 'playing') {
      S.mode = 'paused';
      G.display.showPause();
    } else if (S.mode === 'paused') {
      S.mode = 'playing';
      G.display.hidePause();
    }
  }

  // Effects decay.
  for (const e of G.effects) e.life -= dt;
  G.effects = G.effects.filter((e) => e.life > 0);
  for (const t of G.tracers) t.life -= dt;
  G.tracers = G.tracers.filter((t) => t.life > 0);

  render();

  // Staged screenshots: flag ready after the scene has settled.
  if (G.shotName && G.frames > 90 && !S.shotReady) {
    S.shotReady = true;
    window.__shotReady = true;
  }
}

function render() {
  const { ctx, vw, vh, scale } = G;
  ctx.clearRect(0, 0, vw, vh);
  ctx.fillStyle = '#4d7a38';
  ctx.fillRect(0, 0, vw, vh);

  drawWorld(G);
  if (S.mode === 'playing') {
    drawBeacon(G);
    drawFareMarker(G);
  }
  drawTraffic(G);
  drawCops(G);
  drawCombat(G);
  drawHero(G);

  // Bullet tracers.
  for (const t of G.tracers) {
    const a = t.life / t.maxLife;
    ctx.strokeStyle = `rgba(255, 233, 168, ${a.toFixed(2)})`;
    ctx.lineWidth = Math.max(1, 0.7 * scale * 0.5);
    ctx.beginPath();
    ctx.moveTo((t.x1 - S.camera.x) * scale + vw / 2, (t.z1 - S.camera.z) * scale + vh / 2);
    ctx.lineTo((t.x2 - S.camera.x) * scale + vw / 2, (t.z2 - S.camera.z) * scale + vh / 2);
    ctx.stroke();
  }
  // Particles (smoke, sparks).
  for (const e of G.effects) {
    const a = e.life / e.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc((e.x - S.camera.x) * scale + vw / 2, (e.z - S.camera.z) * scale + vh / 2, e.size * scale * 0.5, 0, Math.PI * 2);
    ctx.fill();
    e.x += e.vx * 0.016;
    e.z += e.vz * 0.016;
  }
  ctx.globalAlpha = 1;
  drawFloaters(G);
  drawLighting(G);
}

requestAnimationFrame(frame);
window.__game = G;
