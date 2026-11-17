// The HUD: money, health, armor, clock, wanted stars, objective,
// dialogue, toasts, minimap and the big map. The minimap canvas uses
// a desynchronized 2D context so it never punches a dark slab through
// the WebGL layer in Chromium.
import { formatMoney, formatClock, clamp } from './utils.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const moneyEl = $('money');
  const clockEl = $('clock');
  const healthFill = $('health-fill');
  const armorFill = $('armor-fill');
  const wantedEl = $('wanted');
  const stars = [...wantedEl.querySelectorAll('.star')];
  const objTitle = $('obj-title');
  const objText = $('obj-text');
  const dialogEl = $('dialog');
  const dlgWho = $('dlg-who');
  const dlgWhat = $('dlg-what');
  const toastEl = $('toast');
  const speedoEl = $('speedo');
  const speedVal = $('speed-val');
  const interactEl = $('interact');
  const hintEl = $('hint');
  const bigmapWrap = $('bigmap-wrap');
  const bigmap = $('bigmap');
  const minimap = $('minimap');
  const mm = minimap.getContext('2d', { desynchronized: true });
  const bm = bigmap.getContext('2d', { desynchronized: true });
  let toastTimer = null;
  let dialogTimer = null;

  function drawMap(ctx, size, state) {
    const half = state.city.bounds;
    const toMap = (x, z) => [((x + half) / (half * 2)) * size, ((z + half) / (half * 2)) * size];
    ctx.clearRect(0, 0, size, size);
    // Water + sand + city ground.
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, toMap(0, half)[1] - size * 0.02, size, size * 0.05);
    ctx.fillStyle = '#7fae6e';
    ctx.fillRect(0, 0, size, toMap(0, half)[1]);
    // Roads.
    ctx.strokeStyle = '#2e3138';
    ctx.lineWidth = size * 0.028;
    for (const c of state.city.roadCenters) {
      const [x] = toMap(c, 0);
      const [, y] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    }
    // Blocks.
    ctx.fillStyle = '#c9a06a';
    const pitch = state.city.pitch;
    for (let bx = -4; bx < 4; bx++) {
      for (let bz = -4; bz < 4; bz++) {
        const [x, y] = toMap(bx * pitch + pitch / 2 - 20, bz * pitch + pitch / 2 - 20);
        const w = (40 / (half * 2)) * size;
        ctx.fillRect(x, y, w, w);
      }
    }
    // Mission marker.
    if (state.missions.stage === 'active') {
      const m = state.missions.current();
      const [mx, my] = toMap(m.target.x, m.target.z);
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath(); ctx.arc(mx, my, size * 0.02, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, size * 0.03, 0, Math.PI * 2); ctx.stroke();
    }
    // Traffic dots.
    ctx.fillStyle = '#ffffff';
    for (const car of state.trafficCars) {
      const [x, y] = toMap(car.position.x, car.position.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Police dots.
    ctx.fillStyle = '#ff4444';
    for (const car of state.police.copCars) {
      const [x, y] = toMap(car.position.x, car.position.z);
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.player.position.x, state.player.position.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.cameraYaw + Math.PI);
    ctx.fillStyle = '#7dff9e';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0b1e2e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    // North marker.
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(size * 0.045)}px Arial`;
    ctx.fillText('N', size * 0.47, size * 0.05);
  }

  return {
    setMoney(v) { moneyEl.textContent = formatMoney(v); },
    setClock(minutes) { clockEl.textContent = formatClock(minutes); },
    setHealth(h) { healthFill.style.width = clamp(h, 0, 100) + '%'; },
    setArmor(a) { armorFill.style.width = clamp(a, 0, 100) + '%'; },
    setWanted(level) {
      stars.forEach((s, i) => s.classList.toggle('lit', i < level));
    },
    setObjective(title, text) {
      objTitle.textContent = title;
      objText.innerHTML = text;
    },
    showDialog(who, what, seconds = 6) {
      dlgWho.textContent = who;
      dlgWhat.textContent = what;
      dialogEl.style.display = 'block';
      if (dialogTimer) clearTimeout(dialogTimer);
      dialogTimer = setTimeout(() => { dialogEl.style.display = 'none'; }, seconds * 1000);
    },
    hideDialog() { dialogEl.style.display = 'none'; },
    toast(main, sub = '') {
      toastEl.innerHTML = main + (sub ? `<small>${sub}</small>` : '');
      toastEl.style.opacity = '1';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 2600);
    },
    setSpeed(kmh, driving) {
      speedoEl.style.display = driving ? 'block' : 'none';
      if (driving) speedVal.textContent = Math.round(Math.abs(kmh));
    },
    showInteract(text) {
      interactEl.textContent = text;
      interactEl.style.display = 'block';
    },
    hideInteract() { interactEl.style.display = 'none'; },
    showHint(show) { hintEl.style.display = show ? 'block' : 'none'; },
    drawMinimap(state) { drawMap(mm, 380, state); },
    toggleBigMap(show, state) {
      bigmapWrap.style.display = show ? 'flex' : 'none';
      if (show) drawMap(bm, 640, state);
    },
    bigMapOpen() { return bigmapWrap.style.display === 'flex'; },
  };
}
