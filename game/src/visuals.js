// Visual core for Solmar Heat v3: the renderer, the sky, and every shared
// look — canvas textures, neon signs, glow sprites, and the geometry and
// material caches that keep the draw-call count low. Nothing here knows
// about missions or input; it only makes the bay look expensive.

import * as THREE from 'three';

/** The look's anchor: golden hour, low sun, long shadows. */
export const GOLDEN_T = 0.06;

/** Build the renderer: ACES filmic tone mapping, soft shadows, sRGB. */
export function makeRenderer(canvas, pixelCap = 1.75) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
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
  // Double border: a bright outer tube and a dim inner one, like real neon.
  g.strokeStyle = color;
  g.lineWidth = 7;
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.strokeRect(9, 9, 494, 142);
  g.globalAlpha = 0.55;
  g.lineWidth = 2;
  g.strokeRect(20, 20, 472, 120);
  g.globalAlpha = 1;
  g.font = '900 64px Trebuchet MS, Verdana, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
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

/** Tower facade: window grid, some lit warm, some lit cool, floor bands.
 *  Lit windows are bright and warm so towers read at dusk instead of
 *  going black; dark windows stay a deep blue-grey, never pure black. */
export function facadeTexture(rng, base = '#3a3f4d', lit = 0.55) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Subtle vertical shading so the slab has a face, not a flat colour.
  const shade = g.createLinearGradient(0, 0, 128, 0);
  shade.addColorStop(0, 'rgba(255,255,255,0.10)');
  shade.addColorStop(0.5, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.30)';
  for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 128, 2);
  for (let y = 10; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 14) {
      const r = rng();
      if (r < lit) {
        const warm = rng() < 0.62;
        g.fillStyle = warm ? '#ffe3a1' : '#bfe0ff';
        g.fillRect(x, y, 9, 10);
        // Hot core inside each lit window so it glows against the glass.
        g.fillStyle = warm ? 'rgba(255,240,200,0.9)' : 'rgba(220,240,255,0.9)';
        g.fillRect(x + 2, y + 2, 5, 6);
      } else {
        g.fillStyle = '#1b2434';
        g.fillRect(x, y, 9, 10);
      }
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
  g.fillStyle = '#38343a';
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

/** Palm frond: tapered green blades fanning from a hub, on transparency.
 *  Two greens and a pale midrib per blade so the crown reads as leaves,
 *  not a black starburst, against the sunset. */
export function frondTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.28;
    const tx = 64 + Math.cos(a) * 56, ty = 64 + Math.sin(a) * 56 + 10;
    const mx = 64 + Math.cos(a) * 30, my = 64 + Math.sin(a) * 30 + 5;
    // Blade: a wide green stroke, then a paler midrib on top. Bright
    // greens on purpose — the crown is lit by the sunset, not in shadow.
    g.strokeStyle = i % 2 === 0 ? '#55b368' : '#3f9a52';
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(64, 64);
    g.quadraticCurveTo(mx, my, tx, ty);
    g.stroke();
    g.strokeStyle = '#9ad69a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(64, 64);
    g.quadraticCurveTo(mx, my, tx, ty);
    g.stroke();
  }
  g.fillStyle = '#5a4028';
  g.beginPath(); g.arc(64, 64, 6, 0, Math.PI * 2); g.fill();
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

/** Glowing sky dome: gradient + sun disc, driven by dayT colours.
 *  The blue holds most of the dome now — the warm band sits low on the
 *  horizon — so the sky reads as a sunset, not a flat red wall, and the
 *  sun disc stays crisp instead of washing the whole frame out. */
export function makeSky(scene) {
  const uniforms = {
    topColor: { value: new THREE.Color(0x3a5a9e) },
    midColor: { value: new THREE.Color(0xffb36b) },
    botColor: { value: new THREE.Color(0x54283a) },
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
        // The blend runs in linear light, where a bright peach swamps a
        // dark blue at any small mix factor — so the ramp to blue is
        // steep: the horizon band stays peach, but by a third of the way
        // up the dome the sky is genuinely blue. A pale haze sits right
        // at the skyline so towers stay separated.
        vec3 warm = h < 0.06 ? mix(botColor, midColor, (h + 0.12) / 0.18) : midColor;
        vec3 col = mix(warm, topColor, smoothstep(0.05, 0.38, h));
        col = mix(col, vec3(1.0, 0.82, 0.58), smoothstep(0.16, 0.0, abs(h - 0.05)) * 0.22);
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 220.0) * 1.0 + pow(s, 10.0) * 0.05);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(640, 24, 16), mat);
  scene.add(dome);

  // Drifting clouds: soft sprites far above the city.
  const cloudTex = glowTexture('rgba(255,235,220,0.85)', 'rgba(255,235,220,0)');
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.34, depthWrite: false, fog: false });
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

/** Sun + hemisphere rig with a tight shadow camera over the play area.
 *  A cool fill light from the east keeps shadow-side facades readable —
 *  at golden hour the sun is low in the west, so east faces would
 *  otherwise read as black slabs. The fill casts no shadows. */
export function makeLightRig(scene) {
  const sun = new THREE.DirectionalLight(0xffb36b, 2.6);
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
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a3450, 1.05);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(0x8aa8d8, 0.5);
  fill.position.set(180, 90, -40);
  scene.add(fill);
  scene.add(fill.target);
  return { sun, hemi, fill };
}
