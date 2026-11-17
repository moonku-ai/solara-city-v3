// Street traffic: NPC cars that cruise the avenue grid in loops,
// keeping Solara City's roads busy day and night.
import { mulberry32, rangeRandom, pickFrom } from './utils.js';
import { createCar, randomCarColor } from './vehicles.js';

export function createTraffic(scene, city, seed, count = 14) {
  const rng = mulberry32(seed + 101);
  const cars = [];
  const centers = city.roadCenters;
  const pitch = city.pitch;

  for (let i = 0; i < count; i++) {
    const horizontal = rng() < 0.5;
    const road = pickFrom(rng, centers);
    const along = rangeRandom(rng, -city.bounds + 20, city.bounds - 20);
    const lane = (rng() < 0.5 ? -1 : 1) * 3.2;
    const x = horizontal ? along : road + lane;
    const z = horizontal ? road + lane : along;
    // Face along the road, in the lane's direction.
    const dir = lane > 0 ? 1 : -1;
    const yaw = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = createCar(scene, x, z, yaw, randomCarColor(rng), rng() < 0.15 ? 'taxi' : 'sedan');
    car.owner = 'traffic';
    car.cruiseSpeed = rangeRandom(rng, 7, 12);
    car.horizontal = horizontal;
    car.road = road;
    car.lane = lane;
    car.dir = dir;
    cars.push(car);
  }

  function steerCar(car, dt) {
    // Keep to the lane, turn at the city edge, keep a steady cruise speed.
    const targetSpeed = car.cruiseSpeed;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    const targetYaw = car.horizontal
      ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.dir > 0 ? 0 : Math.PI);
    let diff = targetYaw - car.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.yaw += diff * Math.min(1, dt * 2.5);
    const sin = Math.sin(car.yaw), cos = Math.cos(car.yaw);
    car.position.x -= sin * car.speed * dt;
    car.position.z -= cos * car.speed * dt;
    // Lane correction: pull back toward the lane centre.
    if (car.horizontal) {
      const want = car.road + car.lane;
      car.position.z += (want - car.position.z) * Math.min(1, dt * 2);
      if (car.position.x > city.bounds - 8 || car.position.x < -city.bounds + 8) {
        car.dir *= -1;
        car.lane *= -1;
        car.position.x = Math.max(-city.bounds + 10, Math.min(city.bounds - 10, car.position.x));
      }
    } else {
      const want = car.road + car.lane;
      car.position.x += (want - car.position.x) * Math.min(1, dt * 2);
      if (car.position.z > city.bounds - 8 || car.position.z < -city.bounds + 8) {
        car.dir *= -1;
        car.lane *= -1;
        car.position.z = Math.max(-city.bounds + 10, Math.min(city.bounds - 10, car.position.z));
      }
    }
    car.mesh.rotation.y = car.yaw;
    const spin = car.speed * dt / 0.36;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }

  return {
    cars,
    update(dt) {
      for (const car of cars) steerCar(car, dt);
    },
    // The closest traffic/parked car the player could steal.
    nearestStealable(x, z, maxDist) {
      let best = null, bestD = maxDist;
      for (const car of cars) {
        const d = Math.hypot(car.position.x - x, car.position.z - z);
        if (d < bestD) { best = car; bestD = d; }
      }
      return best;
    },
  };
}

// Parked cars along the curbs, free for the taking.
export function createParkedCars(scene, city, seed, count = 10) {
  const rng = mulberry32(seed + 202);
  const cars = [];
  const centers = city.roadCenters;
  for (let i = 0; i < count; i++) {
    const horizontal = rng() < 0.5;
    const road = pickFrom(rng, centers);
    const along = rangeRandom(rng, -city.bounds + 30, city.bounds - 30);
    const side = (rng() < 0.5 ? -1 : 1) * (city.roadWidth / 2 - 1.6);
    const x = horizontal ? along : road + side;
    const z = horizontal ? road + side : along;
    const yaw = horizontal ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    const car = createCar(scene, x, z, yaw, randomCarColor(rng));
    car.owner = 'parked';
    cars.push(car);
  }
  return cars;
}
