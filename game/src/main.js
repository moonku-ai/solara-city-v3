// Solara City — main loop and game orchestration.
// Wires the city, player, cars, traffic, pedestrians, police, missions,
// combat, HUD, audio and saving together into one playable open world.
import * as THREE from 'three';
import { buildCity, CITY } from './city.js';
import { createPlayer } from './player.js';
import { createCar } from './vehicles.js';
import { createTraffic, createParkedCars } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat, findOwner } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { mulberry32, clamp, damp, distance2D } from './utils.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED = parseInt(params.get('seed') || '1', 10) || 1;

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe8f7);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const input = createInput(canvas);
const audio = createAudio();
const hud = createHud();
const city = buildCity(scene, SEED);
const player = createPlayer(scene);
const traffic = createTraffic(scene, city, SEED, 14);
const parkedCars = createParkedCars(scene, city, SEED, 10);
const pedestrians = createPedestrians(scene, city, SEED, 26);
const police = createPolice(scene, city);
const missions = createMissions(scene);
const combat = createCombat(scene);

const rng = mulberry32(SEED + 909);

// Crosshair for shooting.
const crosshair = document.createElement('div');
crosshair.textContent = '+';
crosshair.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' +
  'font-size:22px;font-weight:900;color:rgba(255,255,255,.85);text-shadow:0 0 4px #000;display:none;';
document.getElementById('hud').appendChild(crosshair);

// ---- Game state -----------------------------------------------------------
const state = {
  started: false,
  paused: false,
  money: 250,
  clockMinutes: 8 * 60,
  cameraYaw: Math.PI,
  cameraPitch: 0.32,
  cameraDistance: 9,
  playerCar: null,
  inCar: false,
  targetCar: null,
  targetHealth: 100,
  dangerPoint: null,
  dangerTimer: 0,
  mapTimer: 0,
  minimapTimer: 0,
  shootCooldown: 0,
  missionToastAt: 0,
  freeRoam: false,
};

// Link scene objects back to their game owners for combat hit tests.
function tagOwner(group, owner) { group.userData.gameOwner = owner; }
for (const p of pedestrians.list) tagOwner(p.group, { type: 'ped', ref: p });
for (const car of [...traffic.cars, ...parkedCars]) tagOwner(car.mesh, { type: 'car', ref: car });
for (const cop of police.footCops) tagOwner(cop.group, { type: 'cop', ref: cop });

function playerPosition() {
  return state.inCar && state.playerCar ? state.playerCar.position : player.position;
}

function startMissionIntro() {
  const m = missions.current();
  hud.showDialog(m.giver, m.intro, 8);
  missions.start();
  hud.setObjective(m.title, m.objective + ' <span class="dist" id="obj-dist"></span>');
  if (m.id === 'tail') spawnTargetCar();
  if (m.id === 'escape') {
    police.addHeat(55);
    hud.setWanted(police.level);
    audio.siren();
  }
  audio.pickup();
}

function spawnTargetCar() {
  if (state.targetCar) {
    scene.remove(state.targetCar.mesh);
    state.targetCar = null;
  }
  const car = createCar(scene, 70, 60, Math.PI, 0xd23b2e, 'sedan');
  car.owner = 'target';
  car.speed = 0;
  tagOwner(car.mesh, { type: 'target', ref: car });
  state.targetCar = car;
  state.targetHealth = 100;
}

function completeMission(reward) {
  state.money += reward;
  hud.setMoney(state.money);
  hud.toast('MISSION COMPLETE', `+$${reward}`);
  audio.missionDone();
  audio.cash();
  if (missions.allDone) {
    hud.setObjective('Solara Legend', 'All three jobs done. The city is yours, kid. Free roam — earn, explore, survive.');
    hud.showDialog('Mara Voss', 'You did it. Three jobs, no loose ends. Solara City is yours now — spend it well, and stay out of my way.', 8);
    state.freeRoam = true;
    police.clearAll();
    return;
  }
  setTimeout(() => { if (state.started) startMissionIntro(); }, 1800);
  hud.setObjective('Job Done', 'Mara has another job for you…');
}

function enterCar(car) {
  state.playerCar = car;
  state.inCar = true;
  player.group.visible = false;
  if (car.owner === 'traffic') {
    const i = traffic.cars.indexOf(car);
    if (i >= 0) traffic.cars.splice(i, 1);
    police.addHeat(16);
    hud.setWanted(police.level);
    hud.toast('CAR STOLEN!', 'The owner called the cops…');
    audio.horn();
  } else if (car.owner === 'parked') {
    hud.toast('Nice ride', 'It was just sitting there. Finders keepers.');
  }
  car.owner = 'player';
  car.speed = 0;
  audio.setEngine(true, 0);
}

function exitCar() {
  const car = state.playerCar;
  if (!car) return;
  const side = 2.4;
  player.position.set(car.position.x + Math.cos(car.yaw) * side, 0, car.position.z - Math.sin(car.yaw) * side);
  player.yaw = car.yaw;
  player.group.rotation.y = car.yaw;
  player.group.visible = true;
  car.owner = 'parked';
  car.speed = 0;
  state.playerCar = null;
  state.inCar = false;
  audio.setEngine(false, 0);
}

function handleArrested() {
  if (!state.started || state.paused) return;
  const fine = Math.floor(state.money * 0.15);
  state.money -= fine;
  hud.setMoney(state.money);
  police.clearAll();
  if (state.inCar) exitCar();
  player.reset(0, 40);
  audio.busted();
  showScreen('busted-screen');
  state.paused = true;
}

function handleWasted() {
  if (!state.started || state.paused) return;
  const fee = Math.floor(state.money * 0.1);
  state.money -= fee;
  hud.setMoney(state.money);
  police.clearAll();
  if (state.inCar) exitCar();
  player.reset(0, 40);
  audio.busted();
  showScreen('wasted-screen');
  state.paused = true;
}

function showScreen(id) {
  for (const s of ['start-screen', 'pause-screen', 'busted-screen', 'wasted-screen']) {
    document.getElementById(s).style.display = s === id ? 'flex' : 'none';
  }
  if (!id) crosshair.style.display = state.started ? 'block' : 'none';
  else crosshair.style.display = 'none';
}

function startGame(fromSave) {
  audio.unlock();
  const save = fromSave ? loadGame() : null;
  if (save) {
    state.money = save.money;
    state.clockMinutes = save.clockMinutes || 480;
    missions.index = Math.min(save.missionIndex || 0, 2);
    player.reset(save.playerX ?? 0, save.playerZ ?? 40);
    if (save.wanted > 0) police.addHeat(save.wanted * 14);
  } else {
    player.reset(city.spawn.x, city.spawn.z);
  }
  state.started = true;
  state.paused = false;
  document.getElementById('loading').style.display = 'none';
  showScreen(null);
  hud.setMoney(state.money);
  hud.setWanted(police.level);
  hud.setHealth(player.health);
  hud.setArmor(player.armor);
  hud.showHint(true);
  if (save) hud.toast('SAVE LOADED', 'Welcome back to Solara City.');
  if (!state.freeRoam && missions.stage === 'intro') startMissionIntro();
}

function applyShotStaging() {
  if (SHOT === 'start') {
    // Title screen over an orbiting city view; the game has not started.
    return;
  }
  if (SHOT === 'chase') {
    // Free-roam chase: no story mission intro for this staging.
    missions.stage = 'done';
    state.freeRoam = true;
  }
  startGame(false);
  if (SHOT === 'play') {
    player.reset(10, 60);
    state.cameraYaw = Math.PI * 0.9;
  } else if (SHOT === 'chase') {
    const car = createCar(scene, 0, 60, Math.PI, 0x2e7fd2, 'sedan');
    tagOwner(car.mesh, { type: 'car', ref: car });
    enterCar(car);
    police.addHeat(48);
    hud.setWanted(police.level);
    // One patrol car ahead, in frame, so the chase reads at a glance.
    const ahead = createCar(scene, 4, 96, 0, 0xffffff, 'police');
    tagOwner(ahead.mesh, { type: 'car', ref: ahead });
    ahead.owner = 'police';
    police.copCars.push(ahead);
    hud.setObjective('WANTED — Escape!', 'Three stars. Lose the Solara PD or outrun them to the safehouse.');
    state.cameraYaw = Math.PI;
  } else if (SHOT === 'mission') {
    // On the avenue facing the beach, the marker straight ahead.
    player.reset(0, 172);
    const car = createCar(scene, 6, 168, Math.PI, 0xf2c230, 'sedan');
    tagOwner(car.mesh, { type: 'car', ref: car });
    parkedCars.push(car);
    state.cameraYaw = Math.PI;
  }
}

// ---- Shooting -------------------------------------------------------------
function tryShoot() {
  if (state.shootCooldown > 0 || !state.started || state.paused) return;
  state.shootCooldown = 0.28;
  const origin = camera.position.clone();
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  // Muzzle a little forward so the tracer starts near the player.
  origin.add(direction.clone().multiplyScalar(1.2));
  const hittables = [];
  for (const p of pedestrians.list) if (p.alive) hittables.push(p.group);
  for (const c of police.footCops) hittables.push(c.group);
  for (const c of [...traffic.cars, ...parkedCars, ...police.copCars]) hittables.push(c.mesh);
  if (state.targetCar) hittables.push(state.targetCar.mesh);
  if (state.inCar && state.playerCar) {
    // Don't shoot your own car.
    const i = hittables.indexOf(state.playerCar.mesh);
    if (i >= 0) hittables.splice(i, 1);
  }
  // Melee first: a target right in front of the player gets punched.
  const ownPos = playerPosition();
  let near = null, nearD = 2.4;
  for (const p of pedestrians.list) {
    if (!p.alive) continue;
    const d = distance2D(p.position.x, p.position.z, ownPos.x, ownPos.z);
    if (d < nearD) { near = { type: 'ped', ref: p }; nearD = d; }
  }
  for (const c of police.footCops) {
    const d = distance2D(c.position.x, c.position.z, ownPos.x, ownPos.z);
    if (d < nearD) { near = { type: 'cop', ref: c }; nearD = d; }
  }
  audio.gunshot();
  state.dangerPoint = { x: ownPos.x, z: ownPos.z };
  state.dangerTimer = 1.5;
  if (near) {
    audio.punch();
    const result = combat.punch(origin, direction, 3, hittables);
    if (near.type === 'ped') {
      near.ref.knockDown();
      police.addHeat(16);
      hud.setWanted(police.level);
      hud.toast('Pedestrian down', 'Witnesses called the cops!');
    } else {
      const i = police.footCops.indexOf(near.ref);
      if (i >= 0) {
        scene.remove(near.ref.group);
        police.footCops.splice(i, 1);
      }
      police.addHeat(12);
      hud.setWanted(police.level);
    }
    return;
  }
  const shot = combat.shoot(origin, direction, 90, hittables);
  if (shot.hitObject) {
    const owner = findOwner(shot.hitObject);
    if (owner) {
      if (owner.type === 'ped' && owner.ref.alive) {
        owner.ref.knockDown();
        police.addHeat(18);
        hud.setWanted(police.level);
        hud.toast('Pedestrian down', 'Witnesses called the cops!');
      } else if (owner.type === 'cop') {
        const i = police.footCops.indexOf(owner.ref);
        if (i >= 0) {
          scene.remove(owner.ref.group);
          police.footCops.splice(i, 1);
        }
        police.addHeat(14);
        hud.setWanted(police.level);
      } else if (owner.type === 'target') {
        state.targetHealth -= 26;
        combat.impact(shot.point, 0xff5a4e);
        police.addHeat(8);
        hud.setWanted(police.level);
        if (state.targetHealth <= 0) {
          hud.toast('Target stopped!', 'Dito is going nowhere now.');
          const reward = missions.complete();
          completeMission(reward);
        }
      } else if (owner.type === 'car') {
        police.addHeat(4);
        hud.setWanted(police.level);
      }
    }
  }
}

// ---- Per-frame update -----------------------------------------------------
const clock = new THREE.Clock();
let orbitAngle = 0;

function updateCamera(dt) {
  const focus = state.inCar && state.playerCar
    ? new THREE.Vector3(state.playerCar.position.x, 1.4, state.playerCar.position.z)
    : new THREE.Vector3(player.position.x, 1.6, player.position.z);
  const dist = state.inCar ? 11.5 : 8.5;
  const height = state.inCar ? 4.2 : 3.4;
  const cx = focus.x + Math.sin(state.cameraYaw) * Math.cos(state.cameraPitch) * dist;
  const cz = focus.z + Math.cos(state.cameraYaw) * Math.cos(state.cameraPitch) * dist;
  const cy = focus.y + height * (0.5 + state.cameraPitch);
  camera.position.set(cx, cy, cz);
  camera.lookAt(focus.x, focus.y + 0.4, focus.z);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (!state.started) {
    // Title screen: slow orbit over the city.
    orbitAngle += dt * 0.05;
    camera.position.set(Math.sin(orbitAngle) * 130, 55, Math.cos(orbitAngle) * 130);
    camera.lookAt(0, 12, 0);
    city.update(dt, state.clockMinutes);
    traffic.update(dt);
    pedestrians.update(dt, null);
    state.minimapTimer += dt;
    if (state.minimapTimer > 0.3) {
      state.minimapTimer = 0;
      hud.drawMinimap({
        city, player, cameraYaw: state.cameraYaw, missions,
        trafficCars: traffic.cars, police,
      });
    }
    input.consumeMouse();
    input.endFrame();
    renderer.render(scene, camera);
    return;
  }
  if (state.paused) {
    if (input.wasPressed('p')) {
      state.paused = false;
      showScreen(null);
    }
    input.consumeMouse();
    input.endFrame();
    renderer.render(scene, camera);
    return;
  }

  // Clock + day cycle.
  state.clockMinutes += dt * 0.6;
  if (state.clockMinutes >= 1440) state.clockMinutes -= 1440;
  city.update(dt, state.clockMinutes);
  missions.update(dt, time);
  combat.update(dt);

  // Camera drag.
  const mouse = input.consumeMouse();
  state.cameraYaw -= mouse.dx * 0.004;
  state.cameraPitch = clamp(state.cameraPitch + mouse.dy * 0.002, -0.1, 1.0);
  if (mouse.clicked) {
    audio.unlock();
    if (!state.inCar || true) tryShoot();
  }
  if (input.wasPressed('f')) tryShoot();
  if (input.wasPressed('h')) audio.horn();
  if (input.wasPressed('m')) {
    hud.toggleBigMap(!hud.bigMapOpen(), {
      city, player, cameraYaw: state.cameraYaw, missions,
      trafficCars: traffic.cars, police,
    });
  }
  if (input.wasPressed('p')) {
    state.paused = true;
    showScreen('pause-screen');
  }
  if (input.wasPressed('r') && missions.stage === 'active') {
    missions.stage = 'intro';
    if (state.targetCar) { scene.remove(state.targetCar.mesh); state.targetCar = null; }
    hud.toast('Mission restarted', missions.current().title);
    startMissionIntro();
  }

  // Enter / exit car.
  if (input.wasPressed('e')) {
    if (state.inCar) {
      exitCar();
    } else {
      const nearTraffic = traffic.nearestStealable(player.position.x, player.position.z, 4.5);
      let nearParked = null, bestD = 4.5;
      for (const c of parkedCars) {
        const d = distance2D(c.position.x, c.position.z, player.position.x, player.position.z);
        if (d < bestD) { nearParked = c; bestD = d; }
      }
      if (nearTraffic) enterCar(nearTraffic);
      else if (nearParked) enterCar(nearParked);
    }
  }

  // Movement.
  let playerSpeed = 0;
  if (state.inCar && state.playerCar) {
    playerSpeed = state.playerCar.updateDrive(dt, input, city.colliders, city.bounds, (impact) => {
      audio.crash();
      player.takeDamage(impact * 0.4);
      hud.setHealth(player.health);
    });
    audio.setEngine(true, clamp(Math.abs(playerSpeed) / 30, 0, 1));
    player.position.copy(state.playerCar.position);
  } else {
    player.update(dt, input, state.cameraYaw, city.colliders, city.bounds);
    playerSpeed = player.speed;
    audio.setEngine(false, 0);
  }

  traffic.update(dt);
  pedestrians.update(dt, state.dangerTimer > 0 ? state.dangerPoint : null);
  if (state.dangerTimer > 0) state.dangerTimer -= dt;

  // Police chase.
  const pPos = playerPosition();
  police.update(dt, pPos, state.inCar, state.playerCar,
    () => handleArrested(),
    (dmg) => {
      const died = player.takeDamage(dmg);
      hud.setHealth(player.health);
      hud.setArmor(player.armor);
      if (died) handleWasted();
    },
    audio);

  // Target car fleeing (mission 2).
  if (state.targetCar && missions.current().id === 'tail' && missions.stage === 'active') {
    const t = state.targetCar;
    const dest = missions.current().target;
    const dx = dest.x - t.position.x, dz = dest.z - t.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 8) {
      hud.toast('DITO ESCAPED!', 'He reached the docks. Mission failed — try again.');
      missions.stage = 'intro';
      scene.remove(t.mesh);
      state.targetCar = null;
      setTimeout(() => { if (state.started) startMissionIntro(); }, 1500);
    } else {
      const wantYaw = Math.atan2(-dx, -dz);
      let diff = wantYaw - t.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      t.yaw += diff * Math.min(1, dt * 2);
      t.speed = damp(t.speed, 15, 1, dt);
      t.position.x -= Math.sin(t.yaw) * t.speed * dt;
      t.position.z -= Math.cos(t.yaw) * t.speed * dt;
      t.mesh.rotation.y = t.yaw;
      // Ram damage from the player's car.
      if (state.inCar && state.playerCar) {
        const rd = distance2D(t.position.x, t.position.z, state.playerCar.position.x, state.playerCar.position.z);
        if (rd < 3.4 && Math.abs(state.playerCar.speed) > 6) {
          state.targetHealth -= Math.abs(state.playerCar.speed) * 0.9;
          state.playerCar.speed *= 0.5;
          audio.crash();
          combat.impact(new THREE.Vector3(t.position.x, 1, t.position.z), 0xff8a5c);
          if (state.targetHealth <= 0) {
            hud.toast('Target stopped!', 'Dito is going nowhere now.');
            const reward = missions.complete();
            completeMission(reward);
            scene.remove(t.mesh);
            state.targetCar = null;
          }
        }
      }
    }
  }

  // Mission arrival checks.
  if (missions.stage === 'active' && !state.freeRoam) {
    const reward = missions.checkArrival(pPos);
    if (reward > 0) completeMission(reward);
    const m = missions.current();
    const distEl = document.getElementById('obj-dist');
    if (distEl) distEl.textContent = Math.round(missions.distanceToTarget(pPos)) + 'm';
    // Mission 3 also completes when the heat fully dies down.
    if (m.id === 'escape' && police.level === 0 && police.heat <= 0 && state.missionToastAt !== 1) {
      state.missionToastAt = 1;
      const r2 = missions.complete();
      completeMission(r2);
    }
  }

  // Interact prompt.
  if (!state.inCar) {
    const nearTraffic = traffic.nearestStealable(player.position.x, player.position.z, 4.5);
    let nearParked = null, bestD = 4.5;
    for (const c of parkedCars) {
      const d = distance2D(c.position.x, c.position.z, player.position.x, player.position.z);
      if (d < bestD) { nearParked = c; bestD = d; }
    }
    if (nearTraffic) hud.showInteract('Press E — STEAL CAR');
    else if (nearParked) hud.showInteract('Press E — ENTER CAR');
    else hud.hideInteract();
  } else {
    hud.showInteract('E — EXIT CAR · SPACE — HANDBRAKE');
  }

  // HUD refresh.
  state.shootCooldown = Math.max(0, state.shootCooldown - dt);
  state.minimapTimer += dt;
  if (state.minimapTimer > 0.15) {
    state.minimapTimer = 0;
    hud.drawMinimap({
      city, player, cameraYaw: state.cameraYaw, missions,
      trafficCars: traffic.cars, police,
    });
  }
  hud.setClock(state.clockMinutes);
  hud.setSpeed(playerSpeed * 3.6, state.inCar);
  hud.setWanted(police.level);

  updateCamera(dt);
  renderer.render(scene, camera);
  input.endFrame();
}

// ---- Buttons --------------------------------------------------------------
document.getElementById('play-btn').addEventListener('click', () => startGame(hasSave()));
document.getElementById('resume-btn').addEventListener('click', () => {
  state.paused = false;
  showScreen(null);
});
document.getElementById('save-btn').addEventListener('click', () => {
  const ok = saveGame({ money: state.money, missions, wanted: police, player, clockMinutes: state.clockMinutes });
  hud.toast(ok ? 'GAME SAVED' : 'Save failed', ok ? 'Progress stored in this browser.' : '');
});
document.getElementById('quit-btn').addEventListener('click', () => {
  saveGame({ money: state.money, missions, wanted: police, player, clockMinutes: state.clockMinutes });
  state.started = false;
  state.paused = false;
  showScreen('start-screen');
});
document.getElementById('busted-btn').addEventListener('click', () => {
  state.paused = false;
  showScreen(null);
  hud.toast('Back on the streets', 'Stay clean this time… or don’t.');
});
document.getElementById('wasted-btn').addEventListener('click', () => {
  state.paused = false;
  showScreen(null);
  hud.toast('Patched up', 'Solara Memorial sends its bill.');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('loading').style.display = 'none';
hud.setMoney(state.money);
hud.setWanted(0);
applyShotStaging();
animate();
