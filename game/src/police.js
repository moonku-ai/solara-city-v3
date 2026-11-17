// The Solara Police Department: a wanted level from 1 to 5 stars,
// patrol cars that chase the player, and foot officers who close in
// on foot and make the arrest.
import * as THREE from 'three';
import { clamp } from './utils.js';
import { createCar } from './vehicles.js';

const MAX_COPS = 6;

export function createPolice(scene, city) {
  const copCars = [];
  const footCops = [];
  let flashTimer = 0;

  function spawnCopCar(x, z) {
    if (copCars.length >= MAX_COPS) return null;
    const car = createCar(scene, x, z, 0, 0xffffff, 'police');
    car.owner = 'police';
    car.speed = 0;
    copCars.push(car);
    return car;
  }

  function spawnFootCop(x, z) {
    const g = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1e3a5f });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), navy);
    torso.position.y = 1.18;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), skin);
    head.position.y = 1.78;
    g.add(head);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.12, 14), navy);
    hat.position.y = 1.98;
    g.add(hat);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), navy);
    legL.position.set(-0.16, 0.42, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.16;
    g.add(legR);
    g.position.set(x, 0, z);
    scene.add(g);
    const cop = { group: g, position: g.position, yaw: 0, walkPhase: 0, shootTimer: 1.5 };
    footCops.push(cop);
    return cop;
  }

  function removeCar(car) {
    scene.remove(car.mesh);
    const i = copCars.indexOf(car);
    if (i >= 0) copCars.splice(i, 1);
  }

  function removeFootCop(cop) {
    scene.remove(cop.group);
    const i = footCops.indexOf(cop);
    if (i >= 0) footCops.splice(i, 1);
  }

  const police = {
    level: 0,
    heat: 0,            // 0..100, drives the star level
    calmTimer: 0,
    copCars,
    footCops,
    addHeat(amount) {
      police.heat = clamp(police.heat + amount, 0, 100);
      const want = police.heat < 12 ? 0 : police.heat < 28 ? 1 : police.heat < 45 ? 2
        : police.heat < 65 ? 3 : police.heat < 85 ? 4 : 5;
      if (want !== police.level) {
        police.level = want;
        return true; // level changed
      }
      return false;
    },
    update(dt, playerPos, playerInCar, playerCar, onArrested, onCopShot, audio) {
      flashTimer += dt;
      const flash = Math.floor(flashTimer * 4) % 2 === 0;
      for (const car of copCars) {
        if (car.mesh.userData.flashL) car.mesh.userData.flashL.material.color.setHex(flash ? 0xff2222 : 0x551111);
        if (car.mesh.userData.flashR) car.mesh.userData.flashR.material.color.setHex(flash ? 0x112266 : 0x2266ff);
      }
      // How many units the law wants on the street right now.
      const wantCars = police.level >= 2 ? Math.min(1 + police.level, MAX_COPS) : police.level >= 1 ? 1 : 0;
      const wantFoot = police.level >= 1 && !playerInCar ? Math.min(police.level, 3) : 0;
      while (copCars.length < wantCars) {
        const a = Math.random() * Math.PI * 2;
        spawnCopCar(playerPos.x + Math.sin(a) * 45, playerPos.z + Math.cos(a) * 45);
      }
      while (copCars.length > wantCars) removeCar(copCars[copCars.length - 1]);
      while (footCops.length < wantFoot) {
        const a = Math.random() * Math.PI * 2;
        spawnFootCop(playerPos.x + Math.sin(a) * 18, playerPos.z + Math.cos(a) * 18);
      }
      while (footCops.length > wantFoot) removeFootCop(footCops[footCops.length - 1]);

      // Cop cars chase: steer toward the player, ram on contact.
      const chaseSpeed = 13 + police.level * 2.2;
      for (const car of copCars) {
        const dx = playerPos.x - car.position.x;
        const dz = playerPos.z - car.position.z;
        const dist = Math.hypot(dx, dz);
        const wantYaw = Math.atan2(-dx, -dz);
        let diff = wantYaw - car.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.yaw += diff * Math.min(1, dt * 2.2);
        car.speed += (chaseSpeed - car.speed) * Math.min(1, dt * 1.2);
        car.position.x -= Math.sin(car.yaw) * car.speed * dt;
        car.position.z -= Math.cos(car.yaw) * car.speed * dt;
        car.mesh.rotation.y = car.yaw;
        const spin = car.speed * dt / 0.36;
        for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
        if (dist < 3.4) {
          // Ram: shove the player's car and slow both down.
          if (playerInCar && playerCar) {
            playerCar.speed *= 0.55;
            if (audio) audio.crash();
          }
          car.speed *= 0.4;
        }
        if (Math.random() < dt * 0.25 && dist < 60 && audio) audio.siren();
      }
      // Foot cops run at the player and shoot when close.
      for (const cop of [...footCops]) {
        const dx = playerPos.x - cop.position.x;
        const dz = playerPos.z - cop.position.z;
        const dist = Math.hypot(dx, dz);
        const wantYaw = Math.atan2(dx, dz);
        let diff = wantYaw - cop.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cop.yaw += diff * Math.min(1, dt * 6);
        const speed = dist > 2.2 ? 6.2 : 0;
        cop.position.x += Math.sin(cop.yaw) * speed * dt;
        cop.position.z += Math.cos(cop.yaw) * speed * dt;
        cop.group.rotation.y = cop.yaw;
        cop.walkPhase += dt * speed * 1.8;
        cop.group.position.y = Math.abs(Math.sin(cop.walkPhase)) * 0.06;
        cop.shootTimer -= dt;
        if (dist < 16 && cop.shootTimer <= 0) {
          cop.shootTimer = 1.6;
          if (onCopShot) onCopShot(4 + police.level);
        }
        // Arrested: a cop reaches the player while on foot and slow.
        if (dist < 1.6 && !playerInCar && onArrested) onArrested();
      }
      // Heat cools down when the player stays out of trouble.
      if (police.level > 0) {
        police.calmTimer += dt;
        if (police.calmTimer > 14) {
          police.calmTimer = 0;
          police.addHeat(-14);
        }
      } else {
        police.calmTimer = 0;
      }
    },
    clearAll() {
      while (copCars.length) removeCar(copCars[0]);
      while (footCops.length) removeFootCop(footCops[0]);
      police.level = 0;
      police.heat = 0;
    },
  };
  return police;
}
