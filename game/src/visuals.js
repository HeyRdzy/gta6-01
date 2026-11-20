// Rendering setup, sky, lights and every texture the city is made of.
// All textures are drawn on canvas at boot, so the game loads no images.

import * as THREE from 'three';
import { clamp, clamp01, lerp, makeCanvas, mulberry32 } from './util.js';

/** Build the WebGL renderer with the look the game is graded on. */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

/** One sky colour stop of the day cycle. */
const SKY_STOPS = [
  { t: 0.0, top: 0x2c4a6b, horizon: 0xf2a56b, sun: 0xffb36b, fog: 0xd9a06f, sunI: 0.7, hemi: 0.5, glow: 0.5 },
  { t: 0.12, top: 0x3f6ea6, horizon: 0xbcd6ea, sun: 0xfff2c8, fog: 0xa8c4d8, sunI: 1.2, hemi: 0.8, glow: 0.15 },
  { t: 0.3, top: 0x2f7fd0, horizon: 0xa8d4ef, sun: 0xffffff, fog: 0xbcd8ea, sunI: 1.5, hemi: 1.0, glow: 0.05 },
  { t: 0.55, top: 0x3a7cc0, horizon: 0xe8c98f, sun: 0xffe9a8, fog: 0xc9c09a, sunI: 1.3, hemi: 0.9, glow: 0.1 },
  { t: 0.7, top: 0x35548f, horizon: 0xf7a45c, sun: 0xff9a3d, fog: 0xe8a06a, sunI: 1.1, hemi: 0.7, glow: 0.35 },
  { t: 0.8, top: 0x2a3560, horizon: 0xe86a4e, sun: 0xff6a2d, fog: 0xc97a5e, sunI: 0.8, hemi: 0.55, glow: 0.7 },
  { t: 0.88, top: 0x171c38, horizon: 0x7a4a72, sun: 0xff8a5c, fog: 0x5e4a66, sunI: 0.45, hemi: 0.4, glow: 1.0 },
  { t: 0.96, top: 0x0a0f24, horizon: 0x1c2440, sun: 0x8899bb, fog: 0x141a2e, sunI: 0.25, hemi: 0.3, glow: 1.0 },
  { t: 1.0, top: 0x2c4a6b, horizon: 0xf2a56b, sun: 0xffb36b, fog: 0xd9a06f, sunI: 0.7, hemi: 0.5, glow: 0.5 },
];

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

function stopAt(dayT) {
  const t = ((dayT % 1) + 1) % 1;
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    const a = SKY_STOPS[i];
    const b = SKY_STOPS[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      return { a, b, k };
    }
  }
  return { a: SKY_STOPS[0], b: SKY_STOPS[0], k: 0 };
}

function mixColor(a, b, k, out) {
  _c1.setHex(a);
  _c2.setHex(b);
  out.copy(_c1).lerp(_c2, k);
  return out;
}

/** Gradient sky dome with a sun glow, plus drifting cloud sprites. */
export function createSky(scene) {
  const uniforms = {
    topColor: { value: new THREE.Color(0x35548f) },
    horizonColor: { value: new THREE.Color(0xf7a45c) },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunColor: { value: new THREE.Color(0xff9a3d) },
    sunI: { value: 1 },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform float sunI;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 350.0) * 2.2 + pow(s, 10.0) * 0.30) * sunI;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat);
  scene.add(sky);

  const cloudTex = cloudTexture();
  const clouds = [];
  const rng = mulberry32(77);
  for (let i = 0; i < 14; i++) {
    const mat = new THREE.SpriteMaterial({
      map: cloudTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0.55 + rng() * 0.25,
      depthWrite: false,
      fog: false,
    });
    const spr = new THREE.Sprite(mat);
    spr.position.set(-500 + rng() * 1000, 130 + rng() * 90, -500 + rng() * 1000);
    spr.scale.set(120 + rng() * 160, 34 + rng() * 30, 1);
    spr.userData.drift = 1.5 + rng() * 2.5;
    scene.add(spr);
    clouds.push(spr);
  }

  const top = new THREE.Color();
  const horizon = new THREE.Color();
  const sunC = new THREE.Color();
  const fogC = new THREE.Color();
  const sunDir = new THREE.Vector3();

  return {
    uniforms,
    clouds,
    update(dayT, dt, timeSec) {
      const { a, b, k } = stopAt(dayT);
      mixColor(a.top, b.top, k, top);
      mixColor(a.horizon, b.horizon, k, horizon);
      mixColor(a.sun, b.sun, k, sunC);
      mixColor(a.fog, b.fog, k, fogC);
      uniforms.topColor.value.copy(top);
      uniforms.horizonColor.value.copy(horizon);
      uniforms.sunColor.value.copy(sunC);
      uniforms.sunI.value = lerp(a.sunI, b.sunI, k);
      // The sun travels east to west on the same clock as the colour stops:
      // high at midday, near 30 degrees at golden hour so facades and
      // streets stay readable, on the horizon at dusk, gone at night.
      const dayFrac = clamp((((dayT % 1) + 1) % 1) / 0.9, 0, 1);
      const el = Math.sin(dayFrac * Math.PI) * 1.08;
      const az = dayFrac * Math.PI;
      sunDir.set(Math.cos(az) * Math.cos(el), Math.max(0.06, Math.sin(el)), 0.35 * Math.cos(el)).normalize();
      uniforms.sunDir.value.copy(sunDir);
      scene.fog.color.copy(fogC);
      for (const c of clouds) {
        c.position.x += c.userData.drift * dt;
        if (c.position.x > 560) c.position.x = -560;
        c.material.opacity = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(timeSec * 0.05 + c.position.z));
      }
      return {
        sunDir,
        sunColor: sunC,
        sunIntensity: lerp(a.sunI, b.sunI, k),
        hemiIntensity: lerp(a.hemi, b.hemi, k),
        windowGlow: lerp(a.glow, b.glow, k),
        fogColor: fogC,
      };
    },
  };
}

/** One shadow-casting sun, a sky hemisphere light and a cool east fill. */
export function createLightRig(scene) {
  const sun = new THREE.DirectionalLight(0xffe9c0, 1.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -190;
  sun.shadow.camera.right = 190;
  sun.shadow.camera.top = 190;
  sun.shadow.camera.bottom = -190;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 800;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xbfd8ee, 0x5a4a3a, 0.7);
  scene.add(hemi);

  // Cool fill from the sea side so shadow-side facades stay readable at dusk.
  const fill = new THREE.DirectionalLight(0x9fb8dd, 0.35);
  fill.position.set(300, 140, 60);
  scene.add(fill);
  scene.add(fill.target);

  return {
    sun,
    hemi,
    fill,
    update(skyInfo, focus) {
      const d = skyInfo.sunDir;
      sun.position.set(focus.x + d.x * 420, Math.max(60, focus.y + d.y * 420), focus.z + d.z * 420);
      sun.target.position.set(focus.x, 0, focus.z);
      sun.intensity = skyInfo.sunIntensity * 1.6;
      if (skyInfo.sunColor) sun.color.copy(skyInfo.sunColor);
      else sun.color.setHex(0xffe9c0);
      hemi.intensity = skyInfo.hemiIntensity * 1.25;
      fill.intensity = 0.2 + 0.25 * (1 - skyInfo.sunIntensity / 1.5);
    },
  };
}

// ---------------------------------------------------------------- textures

/** Soft radial glow used by lamps, neon and light halos. */
export function glowTexture() {
  return new THREE.CanvasTexture(
    makeCanvas(64, 64, (g) => {
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    })
  );
}

/** Puffy cloud blob. */
export function cloudTexture() {
  return new THREE.CanvasTexture(
    makeCanvas(128, 64, (g) => {
      g.clearRect(0, 0, 128, 64);
      for (let i = 0; i < 9; i++) {
        const x = 20 + Math.random() * 88;
        const y = 26 + Math.random() * 16;
        const r = 12 + Math.random() * 16;
        const grad = g.createRadialGradient(x, y, 1, x, y, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.85)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    })
  );
}

const FACADE_PALETTES = [
  { base: '#8a7a68', trim: '#6e5f4f', glass: '#2b3a4a' },
  { base: '#7d8a99', trim: '#5d6a78', glass: '#27333f' },
  { base: '#a08a6a', trim: '#7d6a50', glass: '#2f3a42' },
  { base: '#6f7f7a', trim: '#55635e', glass: '#26323a' },
  { base: '#96684f', trim: '#744e3a', glass: '#33291f' },
  { base: '#5f6f8a', trim: '#49566d', glass: '#232c3d' },
];

/** A building face: lit and dark windows over a tinted wall, with trim lines. */
export function facadeTexture(rng, variant) {
  const p = FACADE_PALETTES[variant % FACADE_PALETTES.length];
  const tex = new THREE.CanvasTexture(
    makeCanvas(128, 256, (g, w, h) => {
      g.fillStyle = p.base;
      g.fillRect(0, 0, w, h);
      // Subtle vertical shading so floors read apart.
      const shade = g.createLinearGradient(0, 0, 0, h);
      shade.addColorStop(0, 'rgba(255,255,255,0.10)');
      shade.addColorStop(0.5, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.28)');
      g.fillStyle = shade;
      g.fillRect(0, 0, w, h);
      // Window grid.
      const cols = 5;
      const rows = 10;
      const cw = w / cols;
      const ch = h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cw + cw * 0.22;
          const y = r * ch + ch * 0.22;
          const ww = cw * 0.56;
          const hh = ch * 0.6;
          const lit = rng() < 0.34;
          g.fillStyle = lit ? '#ffd27a' : p.glass;
          if (lit && rng() < 0.25) g.fillStyle = '#ffb35c';
          g.fillRect(x, y, ww, hh);
          g.fillStyle = 'rgba(255,255,255,0.12)';
          g.fillRect(x, y, ww, hh * 0.25);
        }
      }
      // Ground floor band and trim.
      g.fillStyle = p.trim;
      g.fillRect(0, h - 18, w, 18);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let r = 0; r < rows; r++) g.fillRect(0, r * ch, w, 2);
    })
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A warehouse wall: corrugated panels, a roller door and small high windows. */
export function dockTexture(rng) {
  const tex = new THREE.CanvasTexture(
    makeCanvas(128, 128, (g, w, h) => {
      g.fillStyle = '#7a6a58';
      g.fillRect(0, 0, w, h);
      // Vertical panel seams.
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      for (let x = 8; x < w; x += 16) g.fillRect(x, 0, 2, h);
      // Big roller door.
      g.fillStyle = '#4a4038';
      g.fillRect(w * 0.28, h * 0.45, w * 0.44, h * 0.55);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      for (let y = h * 0.5; y < h; y += 8) g.fillRect(w * 0.28, y, w * 0.44, 2);
      // Small high windows, a few lit.
      for (let i = 0; i < 4; i++) {
        const wx = 10 + i * 30;
        g.fillStyle = rng() < 0.4 ? '#ffd27a' : '#2f3a42';
        g.fillRect(wx, 12, 16, 10);
      }
      // Grime at the base.
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(0, h - 10, w, 10);
    })
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A glowing neon sign board with text. */
export function neonTexture(text, fg, bg) {
  const tex = new THREE.CanvasTexture(
    makeCanvas(512, 96, (g, w, h) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = fg;
      g.lineWidth = 4;
      g.strokeRect(6, 6, w - 12, h - 12);
      g.font = 'bold 52px Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = fg;
      g.shadowBlur = 22;
      g.fillStyle = fg;
      g.fillText(text, w / 2, h / 2 + 2);
      g.shadowBlur = 0;
      g.fillStyle = '#ffffff';
      g.font = 'bold 50px Arial, sans-serif';
      g.fillText(text, w / 2, h / 2 + 2);
    })
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Asphalt strip with a dashed centre line, repeated along the road. */
export function roadTexture() {
  const tex = new THREE.CanvasTexture(
    makeCanvas(128, 128, (g, w, h) => {
      g.fillStyle = '#2b2e33';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.fillStyle = '#d8c25a';
      g.fillRect(w / 2 - 2, 8, 4, 34);
      g.fillRect(w / 2 - 2, 86, 4, 34);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(4, 0, 3, h);
      g.fillRect(w - 7, 0, 3, h);
    })
  );
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Sidewalk slabs. */
export function sidewalkTexture() {
  const tex = new THREE.CanvasTexture(
    makeCanvas(128, 128, (g, w, h) => {
      g.fillStyle = '#8f9598';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.10)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.strokeStyle = 'rgba(0,0,0,0.28)';
      g.lineWidth = 2;
      g.strokeRect(1, 1, w - 2, h - 2);
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.lineTo(w / 2, h);
      g.moveTo(0, h / 2);
      g.lineTo(w, h / 2);
      g.stroke();
    })
  );
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Warm beach sand. */
export function sandTexture() {
  const tex = new THREE.CanvasTexture(
    makeCanvas(128, 128, (g, w, h) => {
      g.fillStyle = '#d9b98a';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 420; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(255,240,200,0.25)' : 'rgba(120,90,50,0.20)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    })
  );
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------- shared caches

const geoCache = new Map();
const matCache = new Map();

/** One shared unit box; scale the mesh, never the geometry. */
export function unitBox() {
  if (!geoCache.has('box')) geoCache.set('box', new THREE.BoxGeometry(1, 1, 1));
  return geoCache.get('box');
}

export function unitCylinder(radial = 10) {
  const key = `cyl${radial}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.CylinderGeometry(1, 1, 1, radial));
  return geoCache.get(key);
}

export function unitSphere(w = 12, h = 10) {
  const key = `sph${w}x${h}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.SphereGeometry(1, w, h));
  return geoCache.get(key);
}

export function unitCone(radial = 8) {
  const key = `cone${radial}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.ConeGeometry(1, 1, radial));
  return geoCache.get(key);
}

export function unitPlane() {
  if (!geoCache.has('plane')) geoCache.set('plane', new THREE.PlaneGeometry(1, 1));
  return geoCache.get('plane');
}

/** A cached standard material by key; the maker runs once. */
export function stdMat(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}

export function basicMat(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}
