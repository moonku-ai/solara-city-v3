// Combat: shooting and punching in Solara City.
// Hitscan pistol with a visible tracer and muzzle flash; a punch
// when the target is right in front of the player.
import * as THREE from 'three';

export function createCombat(scene) {
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const tracerGeo = new THREE.BoxGeometry(0.05, 0.05, 1);
  const tracers = [];
  const flashLight = new THREE.PointLight(0xffe9a8, 0, 12, 2);
  scene.add(flashLight);

  function spawnTracer(from, to) {
    const mesh = new THREE.Mesh(tracerGeo, tracerMat);
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.lookAt(to);
    const len = from.distanceTo(to);
    mesh.scale.set(1, 1, Math.max(0.1, len));
    mesh.userData.life = 0.09;
    scene.add(mesh);
    tracers.push(mesh);
  }

  function spawnImpact(point, color = 0xffd21f) {
    const burst = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), mat);
      p.position.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5);
      burst.add(p);
    }
    burst.position.copy(point);
    burst.userData.life = 0.35;
    burst.userData.isBurst = true;
    scene.add(burst);
    tracers.push(burst);
  }

  return {
    update(dt) {
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i];
        t.userData.life -= dt;
        if (t.userData.life <= 0) {
          scene.remove(t);
          tracers.splice(i, 1);
        } else if (t.userData.isBurst) {
          t.scale.multiplyScalar(1 + dt * 6);
          t.rotation.y += dt * 8;
        }
      }
      flashLight.intensity = Math.max(0, flashLight.intensity - dt * 120);
    },
    // Fire from the muzzle toward the aim direction. Returns the hit object.
    shoot(origin, direction, range, hittables) {
      flashLight.position.copy(origin);
      flashLight.intensity = 26;
      const ray = new THREE.Raycaster(origin, direction.clone().normalize(), 0, range);
      const hits = ray.intersectObjects(hittables, true);
      let end = origin.clone().add(direction.clone().normalize().multiplyScalar(range));
      let hitObject = null;
      if (hits.length > 0) {
        end = hits[0].point.clone();
        hitObject = hits[0].object;
        spawnImpact(end);
      }
      spawnTracer(origin, end);
      return { hitObject, point: end, distance: hits.length > 0 ? hits[0].distance : range };
    },
    punch(origin, direction, range, hittables) {
      const ray = new THREE.Raycaster(origin, direction.clone().normalize(), 0, range);
      const hits = ray.intersectObjects(hittables, true);
      if (hits.length > 0) {
        spawnImpact(hits[0].point, 0xff8a5c);
        return { hitObject: hits[0].object, point: hits[0].point };
      }
      return null;
    },
    impact(point, color) { spawnImpact(point, color); },
  };
}

// Walk up a hit object's parents to find the game object that owns it.
export function findOwner(object) {
  let node = object;
  while (node) {
    if (node.userData && node.userData.gameOwner) return node.userData.gameOwner;
    node = node.parent;
  }
  return null;
}
