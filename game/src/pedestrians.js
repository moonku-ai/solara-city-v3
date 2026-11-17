// Pedestrians: Solara citizens strolling the sidewalks, who scatter
// when shots are fired or a car comes at them.
import * as THREE from 'three';
import { mulberry32, rangeRandom, pickFrom, clamp } from './utils.js';

const SHIRTS = [0xffd21f, 0x37b268, 0x2e7fd2, 0xff8a3d, 0xd25fae, 0x7fd4ff, 0xf2f2f2, 0x8a5fd2];
const SKINS = [0xd9a066, 0x8a5a3b, 0xf2c9a0, 0x6e4426, 0xe8b88a];

export function createPedestrians(scene, city, seed, count = 26) {
  const rng = mulberry32(seed + 303);
  const peds = [];
  const centers = city.roadCenters;

  function makePed() {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pickFrom(rng, SHIRTS) });
    const skin = new THREE.MeshLambertMaterial({ color: pickFrom(rng, SKINS) });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.32), shirt);
    torso.position.y = 1.12;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
    head.position.y = 1.66;
    g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.24), pants);
    legL.position.set(-0.14, 0.38, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.14;
    g.add(legR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), shirt);
    armL.position.set(-0.4, 1.14, 0);
    g.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.4;
    g.add(armR);
    return { group: g, legL, legR, armL, armR };
  }

  for (let i = 0; i < count; i++) {
    const parts = makePed();
    const horizontal = rng() < 0.5;
    const road = pickFrom(rng, centers);
    const along = rangeRandom(rng, -city.bounds + 20, city.bounds - 20);
    const side = (rng() < 0.5 ? -1 : 1) * (city.roadWidth / 2 + 2);
    const x = horizontal ? along : road + side;
    const z = horizontal ? road + side : along;
    parts.group.position.set(x, 0, z);
    parts.group.rotation.y = rng() * Math.PI * 2;
    scene.add(parts.group);
    peds.push({
      ...parts,
      position: parts.group.position,
      yaw: parts.group.rotation.y,
      speed: rangeRandom(rng, 1.1, 2.2),
      walkPhase: rng() * 6,
      panicked: 0,
      alive: true,
      target: null,
      update(dt, danger) {
        if (!this.alive) return;
        // Flee from a nearby danger point (gunfire, speeding car).
        if (danger && Math.hypot(this.position.x - danger.x, this.position.z - danger.z) < 26) {
          this.panicked = 2.5;
        }
        if (this.panicked > 0) {
          this.panicked -= dt;
          const away = Math.atan2(this.position.x - (danger ? danger.x : 0),
            this.position.z - (danger ? danger.z : 0));
          this.yaw = away;
          this.position.x += Math.sin(away) * 5.5 * dt;
          this.position.z += Math.cos(away) * 5.5 * dt;
        } else {
          // Wander: pick a new sidewalk heading now and then.
          if (!this.target || Math.hypot(this.target.x - this.position.x, this.target.z - this.position.z) < 2) {
            const horizontal2 = rng() < 0.5;
            const road2 = pickFrom(rng, centers);
            const along2 = rangeRandom(rng, -city.bounds + 20, city.bounds - 20);
            const side2 = (rng() < 0.5 ? -1 : 1) * (city.roadWidth / 2 + 2);
            this.target = horizontal2
              ? { x: along2, z: road2 + side2 }
              : { x: road2 + side2, z: along2 };
          }
          const dx = this.target.x - this.position.x;
          const dz = this.target.z - this.position.z;
          const want = Math.atan2(dx, dz);
          let diff = want - this.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.yaw += diff * Math.min(1, dt * 4);
          this.position.x += Math.sin(this.yaw) * this.speed * dt;
          this.position.z += Math.cos(this.yaw) * this.speed * dt;
        }
        this.position.x = clamp(this.position.x, -city.bounds, city.bounds);
        this.position.z = clamp(this.position.z, -city.bounds, city.bounds);
        this.group.rotation.y = this.yaw;
        this.walkPhase += dt * this.speed * 4;
        const swing = Math.sin(this.walkPhase) * (this.panicked > 0 ? 0.9 : 0.5);
        this.legL.rotation.x = swing;
        this.legR.rotation.x = -swing;
        this.armL.rotation.x = -swing * 0.7;
        this.armR.rotation.x = swing * 0.7;
      },
      knockDown() {
        this.alive = false;
        this.group.rotation.x = -Math.PI / 2;
        this.group.position.y = 0.3;
      },
      revive(x, z) {
        this.alive = true;
        this.group.rotation.x = 0;
        this.group.position.set(x, 0, z);
        this.panicked = 0;
        this.target = null;
      },
    });
  }

  return {
    list: peds,
    update(dt, danger) { for (const p of peds) p.update(dt, danger); },
    nearestAlive(x, z, maxDist) {
      let best = null, bestD = maxDist;
      for (const p of peds) {
        if (!p.alive) continue;
        const d = Math.hypot(p.position.x - x, p.position.z - z);
        if (d < bestD) { best = p; bestD = d; }
      }
      return best;
    },
  };
}
