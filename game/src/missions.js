// Story missions for Solara City: three chained jobs from Mara Voss,
// each with dialogue, an objective marker in the world and a payout.
import * as THREE from 'three';

const MISSIONS = [
  {
    id: 'courier',
    title: 'Mission 1 — The Courier Run',
    giver: 'Mara Voss',
    intro: 'Listen, kid. A package needs to reach the marina — no questions, no peeking. Take any car you can find and get it there in one piece. The city pays couriers who deliver.',
    objective: 'Deliver the package to the marina drop-off at the south beach.',
    target: { x: 0, z: 235 },
    reward: 150,
    hint: 'Follow the yellow marker. Steal a car with E to get there fast.',
  },
  {
    id: 'tail',
    title: 'Mission 2 — Tail the Rat',
    giver: 'Mara Voss',
    intro: 'Good work. Now — a rat named Dito is driving a red sedan toward the north docks, and he talks too much. Chase him down and stop his car. Bump him hard or shoot out his ride. Do NOT let him reach the docks.',
    objective: 'Chase Dito’s red sedan and stop it before it reaches the north docks.',
    target: { x: -180, z: -210 },
    reward: 300,
    hint: 'Ram his car from behind or shoot it. His health bar is above his car.',
  },
  {
    id: 'escape',
    title: 'Mission 3 — The Great Escape',
    giver: 'Mara Voss',
    intro: 'The whole Solara PD is on you now, kid. Three stars and climbing. Lose them — or reach my safehouse on the east side — and the money is yours. Drive like the city is on fire. Because it is.',
    objective: 'Escape the police: lose your wanted level, or reach the safehouse.',
    target: { x: 215, z: 40 },
    reward: 500,
    hint: 'Break line of sight, then hide. Or drive straight to the safehouse marker.',
  },
];

export function createMissions(scene) {
  // A glowing beacon column + floating diamond marks the objective.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd21f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true), beaconMat);
  beacon.position.y = 30;
  beacon.visible = false;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd21f }),
  );
  diamond.position.y = 9;
  diamond.visible = false;
  scene.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.4, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd21f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  ring.visible = false;
  scene.add(ring);

  const missions = {
    index: 0,
    stage: 'intro',   // intro | active | done | complete
    targetCar: null,  // mission 2's fleeing sedan
    escapeTimer: 0,
    allDone: false,
    current() { return MISSIONS[Math.min(missions.index, MISSIONS.length - 1)]; },
    start() {
      missions.stage = 'active';
      const m = missions.current();
      beacon.position.set(m.target.x, 30, m.target.z);
      diamond.position.set(m.target.x, 9, m.target.z);
      ring.position.set(m.target.x, 0.12, m.target.z);
      beacon.visible = true;
      diamond.visible = true;
      ring.visible = true;
    },
    complete() {
      const m = missions.current();
      missions.index += 1;
      if (missions.index >= MISSIONS.length) {
        missions.allDone = true;
        missions.stage = 'complete';
        beacon.visible = false;
        diamond.visible = false;
        ring.visible = false;
        return m.reward;
      }
      missions.stage = 'intro';
      beacon.visible = false;
      diamond.visible = false;
      ring.visible = false;
      return m.reward;
    },
    // Called when the player reaches the marker; returns the reward or 0.
    checkArrival(playerPos) {
      if (missions.stage !== 'active') return 0;
      const m = missions.current();
      const d = Math.hypot(playerPos.x - m.target.x, playerPos.z - m.target.z);
      if (m.id === 'escape') {
        // Reaching the safehouse also completes the escape.
        if (d < 7) return missions.complete();
        return 0;
      }
      if (m.id === 'tail') return 0; // tail ends when the target car is stopped
      if (d < 7) return missions.complete();
      return 0;
    },
    distanceToTarget(playerPos) {
      const m = missions.current();
      return Math.hypot(playerPos.x - m.target.x, playerPos.z - m.target.z);
    },
    update(dt, time) {
      diamond.rotation.y = time * 1.5;
      diamond.position.y = 9 + Math.sin(time * 2) * 0.8;
      beacon.material.opacity = 0.22 + Math.sin(time * 2.4) * 0.08;
      const s = 1 + Math.sin(time * 3) * 0.12;
      ring.scale.set(s, s, 1);
    },
  };
  return missions;
}

export function missionList() { return MISSIONS; }
