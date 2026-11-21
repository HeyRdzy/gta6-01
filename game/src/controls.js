// Solmar Heat — keyboard and mouse input. Written fresh for round 4.
// Top-down camera is north-up, so WASD maps straight onto the map.
export function createControls(G) {
  const input = {
    keys: new Set(),
    mouse: { x: 0, y: 0, wx: 0, wz: 0, down: false, clicked: false },
    locked: false,
  };
  const canvas = G.canvas;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    input.keys.add(e.code);
    if (e.code === 'KeyM') G.S.muted = !G.S.muted;
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouse.down = true;
      input.mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Mouse world position, refreshed every frame by boot (camera moves).
  input.updateMouseWorld = () => {
    const { vw, vh, scale } = G;
    input.mouse.wx = (input.mouse.x - vw / 2) / scale + G.S.camera.x;
    input.mouse.wz = (input.mouse.y - vh / 2) / scale + G.S.camera.z;
  };

  // WASD as a world-space vector (x right, z down).
  input.moveVector = () => {
    let x = 0;
    let z = 0;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) z -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) z += 1;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
    if (x !== 0 && z !== 0) {
      x *= Math.SQRT1_2;
      z *= Math.SQRT1_2;
    }
    return { x, z };
  };

  input.pressed = (code) => {
    if (!input.keys.has(code)) return false;
    input.keys.delete(code);
    return true;
  };

  return input;
}
