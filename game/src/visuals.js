// Visual core for Solmar Heat v3: the renderer, the sky, and every shared
// look — canvas textures, neon signs, glow sprites, and the geometry and
// material caches that keep the draw-call count low. Nothing here knows
// about missions or input; it only makes the bay look expensive.

import * as THREE from 'three';

/** The look's anchor: golden hour, low sun, long shadows. */
export const GOLDEN_T = 0.06;

/** Build the renderer: ACES filmic tone mapping, soft shadows, sRGB. */
export function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/** A soft radial blob, reused for clouds, lamp glow and muzzle sprites. */
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Neon sign face: glowing original text on a dark panel. */
export function neonTexture(text, color = '#ff5a7a', sub = '') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#0d0a14';
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeRect(8, 8, 496, 144);
  g.font = '900 64px Trebuchet MS, Verdana, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 26;
  g.fillStyle = '#ffffff';
  g.fillText(text, 256, sub ? 66 : 82);
  if (sub) {
    g.font = '700 34px Trebuchet MS, Verdana, sans-serif';
    g.shadowBlur = 14;
    g.fillStyle = color;
    g.fillText(sub, 256, 122);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Tower facade: window grid, some lit warm, some lit cool, floor bands. */
export function facadeTexture(rng, base = '#3a3f4d', lit = 0.55) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 128, 2);
  for (let y = 10; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 14) {
      const r = rng();
      if (r < lit) g.fillStyle = rng() < 0.62 ? '#ffd98a' : '#a8d8ff';
      else g.fillStyle = '#10131c';
      g.fillRect(x, y, 9, 10);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Asphalt with centre dashes, edge lines and patch wear. */
export function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#26242a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.04})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.fillStyle = '#c8b25a';
  g.fillRect(61, 0, 3, 128);
  g.fillStyle = 'rgba(230,230,230,0.75)';
  g.fillRect(6, 0, 3, 128);
  g.fillRect(119, 0, 3, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Pale paver sidewalk. */
export function sidewalkTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8d8578';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.28)';
  g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Sand with speckles and a wet darker band. */
export function sandTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ddbd85';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(120,90,40,${0.08 + Math.random() * 0.14})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Palm frond: alpha-cut leaves on a transparent plane. */
export function frondTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#2e8a44';
  g.lineWidth = 7;
  g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.beginPath();
    g.moveTo(64, 64);
    g.quadraticCurveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34, 64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58 + 12);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Shared geometry cache: one box/cylinder/sphere reused everywhere. */
const geoCache = new Map();
export function sharedGeo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

/** Standard material cache keyed by colour + roughness + metalness. */
const matCache = new Map();
export function stdMat(color, roughness = 0.85, metalness = 0.0) {
  const key = `${color}|${roughness}|${metalness}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  }
  return matCache.get(key);
}

/** Glowing sky dome: gradient + sun disc, driven by dayT colours. */
export function makeSky(scene) {
  const uniforms = {
    topColor: { value: new THREE.Color(0x2a4a7a) },
    midColor: { value: new THREE.Color(0xff9a4d) },
    botColor: { value: new THREE.Color(0x3a1a2a) },
    sunDir: { value: new THREE.Vector3(-0.6, 0.25, 0.3).normalize() },
    sunColor: { value: new THREE.Color(0xffd9a0) },
  };
  const mat = new THREE.ShaderMaterial({
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
      uniform vec3 topColor; uniform vec3 midColor; uniform vec3 botColor;
      uniform vec3 sunDir; uniform vec3 sunColor;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -0.12, 1.0);
        vec3 col = h > 0.28 ? mix(midColor, topColor, (h - 0.28) / 0.72)
                            : mix(botColor, midColor, (h + 0.12) / 0.4);
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 220.0) * 1.4 + pow(s, 10.0) * 0.28);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(640, 24, 16), mat);
  scene.add(dome);

  // Drifting clouds: soft sprites far above the city.
  const cloudTex = glowTexture('rgba(255,235,220,0.85)', 'rgba(255,235,220,0)');
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
    const s = new THREE.Sprite(m);
    const sc = 90 + Math.random() * 120;
    s.scale.set(sc, sc * 0.36, 1);
    s.position.set(-420 + Math.random() * 840, 95 + Math.random() * 70, -420 + Math.random() * 840);
    s.userData.drift = 1.2 + Math.random() * 1.6;
    scene.add(s);
    clouds.push(s);
  }
  return {
    uniforms,
    drift(dt) {
      for (const c of clouds) {
        c.position.x += c.userData.drift * dt;
        if (c.position.x > 460) c.position.x = -460;
      }
    },
  };
}

/** Sun + hemisphere rig with a tight shadow camera over the play area. */
export function makeLightRig(scene) {
  const sun = new THREE.DirectionalLight(0xffb36b, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -170;
  sun.shadow.camera.right = 170;
  sun.shadow.camera.top = 170;
  sun.shadow.camera.bottom = -170;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 520;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x2a2438, 0.85);
  scene.add(hemi);
  return { sun, hemi };
}
