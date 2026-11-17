// Shared helpers: seeded random numbers and small math utilities.
// Every procedural part of Solara City draws from one seed so the same
// seed always builds the same streets, buildings and traffic.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickFrom(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function rangeRandom(rng, min, max) {
  return min + rng() * (max - min);
}

export function intRandom(rng, min, max) {
  return Math.floor(rangeRandom(rng, min, max + 1));
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function angleTowards(current, target, maxStep) {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

export function distance2D(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function formatMoney(amount) {
  return '$' + Math.floor(amount).toLocaleString('en-US');
}

export function formatClock(minutesOfDay) {
  const h = Math.floor(minutesOfDay / 60) % 24;
  const m = Math.floor(minutesOfDay % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
