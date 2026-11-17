// The player on foot: a low-poly Solara citizen who walks, runs,
// jumps, takes hits and can be arrested or knocked down.
import * as THREE from 'three';
import { clamp, damp } from './utils.js';
import { collideWithBuildings } from './city.js';

const WALK_SPEED = 5;
const RUN_SPEED = 9.5;
const JUMP_SPEED = 7.5;
const GRAVITY = 22;

export function createPlayer(scene) {
  const group = new THREE.Group();
  group.name = 'Player';

  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff5a4e });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e4a6e });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1e1a16 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirt);
  torso.position.y = 1.18;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), skin);
  head.position.y = 1.78;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  cap.position.y = 1.82;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
  legL.position.set(-0.16, 0.42, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), shirt);
  armL.position.set(-0.44, 1.2, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.44;
  group.add(armR);
  // A simple pistol held in the right hand, visible when armed.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  gun.position.set(0.44, 0.86, 0.2);
  gun.visible = false;
  group.add(gun);

  scene.add(group);

  const player = {
    group,
    position: group.position,
    yaw: 0,
    health: 100,
    armor: 0,
    vy: 0,
    grounded: true,
    walkPhase: 0,
    moving: false,
    speed: 0,
    armed: true,
    update(dt, input, cameraYaw, colliders, bounds) {
      let fx = 0, fz = 0;
      if (input.isDown('w') || input.isDown('ArrowUp')) fz -= 1;
      if (input.isDown('s') || input.isDown('ArrowDown')) fz += 1;
      if (input.isDown('a') || input.isDown('ArrowLeft')) fx -= 1;
      if (input.isDown('d') || input.isDown('ArrowRight')) fx += 1;
      const len = Math.hypot(fx, fz) || 1;
      fx /= len; fz /= len;
      const running = input.isDown('Shift');
      const targetSpeed = (fx !== 0 || fz !== 0) ? (running ? RUN_SPEED : WALK_SPEED) : 0;
      player.speed = damp(player.speed, targetSpeed, 8, dt);
      player.moving = player.speed > 0.5;
      // Move relative to the camera yaw.
      const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
      const mx = (fx * cos - fz * sin) * player.speed * dt;
      const mz = (fx * sin + fz * cos) * player.speed * dt;
      group.position.x = clamp(group.position.x + mx, -bounds, bounds);
      group.position.z = clamp(group.position.z + mz, -bounds, bounds);
      collideWithBuildings(colliders, group.position, 0.5);
      // Face the movement direction.
      if (player.moving) {
        const targetYaw = Math.atan2(mx, mz);
        let diff = targetYaw - player.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        player.yaw += diff * Math.min(1, dt * 12);
        group.rotation.y = player.yaw;
        player.walkPhase += dt * player.speed * 1.6;
        const swing = Math.sin(player.walkPhase) * 0.55;
        legL.rotation.x = swing;
        legR.rotation.x = -swing;
        armL.rotation.x = -swing * 0.8;
        armR.rotation.x = swing * 0.8;
      } else {
        legL.rotation.x = damp(legL.rotation.x, 0, 10, dt);
        legR.rotation.x = damp(legR.rotation.x, 0, 10, dt);
        armL.rotation.x = damp(armL.rotation.x, 0, 10, dt);
        armR.rotation.x = damp(armR.rotation.x, 0, 10, dt);
      }
      // Jump and gravity.
      if (input.wasPressed(' ') && player.grounded) {
        player.vy = JUMP_SPEED;
        player.grounded = false;
      }
      if (!player.grounded || group.position.y > 0) {
        player.vy -= GRAVITY * dt;
        group.position.y += player.vy * dt;
        if (group.position.y <= 0) {
          group.position.y = 0;
          player.vy = 0;
          player.grounded = true;
        }
      }
      gun.visible = player.armed;
    },
    takeDamage(amount) {
      let rest = amount;
      if (player.armor > 0) {
        const absorbed = Math.min(player.armor, rest * 0.6);
        player.armor -= absorbed;
        rest -= absorbed;
      }
      player.health = Math.max(0, player.health - rest);
      return player.health <= 0;
    },
    heal(amount) { player.health = Math.min(100, player.health + amount); },
    reset(x, z) {
      group.position.set(x, 0, z);
      player.yaw = 0;
      group.rotation.y = 0;
      player.health = 100;
      player.armor = 50;
      player.vy = 0;
    },
  };
  return player;
}
