// Keyboard and mouse state for Solara City.
// Tracks held keys, one-shot presses, and camera drag deltas so the
// player, driver and camera code all read from one place.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function keyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(keyName(event));
    pressed.add(keyName(event));
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(keyName(event)));
  window.addEventListener('blur', () => { keys.clear(); dragging = false; });

  canvas.addEventListener('mousedown', (event) => {
    mouseDown = true;
    mouseClicked = true;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; dragging = false; });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    mouseDX += event.clientX - lastX;
    mouseDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });

  return {
    isDown(name) { return keys.has(name); },
    wasPressed(name) { return pressed.has(name); },
    consumeMouse() {
      const out = { dx: mouseDX, dy: mouseDY, down: mouseDown, clicked: mouseClicked };
      mouseDX = 0; mouseDY = 0; mouseClicked = false;
      return out;
    },
    endFrame() { pressed.clear(); },
  };
}
