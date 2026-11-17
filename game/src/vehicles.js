// Cars of Solara City: boxy low-poly rides built from primitives.
// One builder makes player cars, parked cars, traffic and police cars;
// the driver module gives the player arcade handling with a handbrake.
import * as THREE from 'three';
import { clamp, damp } from './utils.js';
import { collideWithBuildings } from './city.js';

const CAR_COLORS = [0xd23b2e, 0x2e7fd2, 0xf2c230, 0x37b268, 0x8a5fd2, 0xe8e8e8, 0x222831, 0xff8a3d];

export function makeCarMesh(color, kind = 'sedan') {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.2), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.08, kind === 'taxi' ? -0.1 : -0.25);
  group.add(cabin);
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xffd21f, emissive: 0x664400 }));
    sign.position.set(0, 1.45, -0.1);
    group.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x223344 }));
    bar.position.set(0, 1.42, -0.25);
    group.add(bar);
    const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    lightL.position.set(-0.32, 1.42, -0.25);
    group.add(lightL);
    const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    lightR.position.set(0.32, 1.42, -0.25);
    group.add(lightR);
    group.userData.flashL = lightL;
    group.userData.flashR = lightR;
  }
  // Headlights and taillights.
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const sx of [-0.62, 0.62]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), hlMat);
    hl.position.set(sx, 0.6, -2.12);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    tl.position.set(sx, 0.6, 2.12);
    group.add(tl);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, -1.35], [0.95, -1.35], [-0.95, 1.35], [0.95, 1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;
  return group;
}

export function createCar(scene, x, z, yaw, color, kind = 'sedan') {
  const mesh = makeCarMesh(color, kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = yaw;
  scene.add(mesh);
  return {
    mesh,
    position: mesh.position,
    yaw,
    speed: 0,
    steering: 0,
    kind,
    color,
    owner: null,      // 'player' | 'traffic' | 'police' | 'parked'
    stolen: false,
    updateDrive(dt, input, colliders, bounds, onCrash) {
      const car = this;
      const forward = input.isDown('w') || input.isDown('ArrowUp');
      const back = input.isDown('s') || input.isDown('ArrowDown');
      const handbrake = input.isDown(' ');
      const accel = forward ? 16 : back ? -10 : 0;
      car.speed = damp(car.speed, handbrake ? 0 : (accel !== 0 ? (accel > 0 ? 26 : -9) : 0), handbrake ? 6 : 1.1, dt);
      if (accel !== 0 && !handbrake) car.speed += accel * dt * (car.speed < 0 ? 0.4 : 1);
      car.speed = clamp(car.speed, -10, 30);
      if (Math.abs(car.speed) < 0.05 && accel === 0) car.speed = 0;
      const steerInput = (input.isDown('a') || input.isDown('ArrowLeft') ? 1 : 0) -
        (input.isDown('d') || input.isDown('ArrowRight') ? 1 : 0);
      const steerTarget = steerInput * 0.55 * (car.speed >= 0 ? 1 : -1);
      car.steering = damp(car.steering, steerTarget, 8, dt);
      if (Math.abs(car.speed) > 0.2) {
        car.yaw += car.steering * (car.speed / 8) * dt * (handbrake ? 1.6 : 1);
      }
      const sin = Math.sin(car.yaw), cos = Math.cos(car.yaw);
      const nx = car.position.x - sin * car.speed * dt;
      const nz = car.position.z - cos * car.speed * dt;
      const beforeX = car.position.x, beforeZ = car.position.z;
      car.position.x = clamp(nx, -bounds, bounds);
      car.position.z = clamp(nz, -bounds, bounds);
      if (collideWithBuildings(colliders, car.position, 1.6)) {
        const impact = Math.abs(car.speed);
        if (impact > 6 && onCrash) onCrash(impact);
        car.speed *= -0.25;
      }
      if ((car.position.x === -bounds || car.position.x === bounds ||
           car.position.z === -bounds || car.position.z === bounds) &&
          (beforeX !== car.position.x || beforeZ !== car.position.z)) {
        car.speed *= 0.4;
      }
      mesh.rotation.y = car.yaw;
      const tilt = handbrake && Math.abs(car.speed) > 8 ? 0.06 : 0;
      mesh.rotation.z = damp(mesh.rotation.z, tilt * Math.sign(car.steering || 1), 6, dt);
      const spin = car.speed * dt / 0.36;
      for (const w of mesh.userData.wheels) w.rotation.x += spin;
      return car.speed;
    },
  };
}

export function randomCarColor(rng) {
  return CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
}
