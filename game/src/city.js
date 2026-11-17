// Solara City itself: a sun-soaked grid city built from one seed.
// Streets, blocks, towers with lit windows, palms, street lamps, a
// beach and the ocean. Also owns the sun, the sky and the day cycle.
import * as THREE from 'three';
import { mulberry32, pickFrom, rangeRandom, intRandom, clamp } from './utils.js';

export const CITY = {
  blockSize: 46,
  roadWidth: 14,
  blocks: 4,            // blocks from -4..4 each way
  halfSize: 250,
};

const PALETTE = [0xffd9b0, 0xffe9c9, 0xf7c8a0, 0xd8ecf7, 0xf2e3ff, 0xc9f2d8, 0xfff3d6, 0xe8d5c4];
const ROOF_COLORS = [0x8a6f5c, 0x5c7a8a, 0x9a8a7a, 0x6a5a7a, 0x7a8a6a];

function makeWindowTexture(rng, baseColor, floors, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#' + baseColor.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 64, 128);
  const litChance = 0.35;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng() < litChance;
      g.fillStyle = lit ? '#ffe9a8' : '#2a3f55';
      const x = 6 + c * ((64 - 12) / cols);
      const y = 8 + f * ((128 - 16) / floors);
      g.fillRect(x, y, (64 - 12) / cols - 4, (128 - 16) / floors - 5);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'SolaraCity';
  const colliders = [];
  const lampLights = [];
  const buildingMats = [];
  const roadCenters = [];

  const pitch = CITY.blockSize + CITY.roadWidth;
  const N = CITY.blocks;

  // Ground: sand base, then grass-green city slab, then beach + ocean.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.halfSize * 2.6, CITY.halfSize * 2.6),
    new THREE.MeshLambertMaterial({ color: 0x7fae6e }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.halfSize * 2.6, 70),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.0, CITY.halfSize + 30);
  group.add(beach);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.halfSize * 3.4, 220),
    new THREE.MeshLambertMaterial({ color: 0x1e7fa8 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, CITY.halfSize + 30 + 35 + 110);
  ocean.name = 'Ocean';
  group.add(ocean);

  // Roads: dark strips along every grid line, with dashed centre lines.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  const sideMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  const roadLength = pitch * (N * 2 + 1) + CITY.roadWidth;
  for (let i = -N; i <= N; i++) {
    const c = i * pitch;
    roadCenters.push(c);
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(roadLength, CITY.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = horizontal ? 0 : Math.PI / 2;
      road.position.set(horizontal ? 0 : c, 0.02, horizontal ? c : 0);
      group.add(road);
      // Centre dashes.
      const dashCount = Math.floor(roadLength / 12);
      for (let d = 0; d < dashCount; d++) {
        const t = -roadLength / 2 + 6 + d * 12;
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.7), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = horizontal ? 0 : Math.PI / 2;
        dash.position.set(horizontal ? t : c, 0.04, horizontal ? c : t);
        group.add(dash);
      }
      // Sidewalks flanking the road.
      for (const side of [-1, 1]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(roadLength, 4), sideMat);
        walk.rotation.x = -Math.PI / 2;
        const off = c + side * (CITY.roadWidth / 2 + 2);
        walk.position.set(horizontal ? 0 : off, 0.03, horizontal ? off : 0);
        if (!horizontal) walk.rotation.z = Math.PI / 2;
        group.add(walk);
      }
    }
  }

  // Buildings: one to four towers per block, seeded heights and colours.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = -N; bx < N; bx++) {
    for (let bz = -N; bz < N; bz++) {
      const cx = bx * pitch + pitch / 2;
      const cz = bz * pitch + pitch / 2;
      // Central plaza: keep the middle block open as a park.
      if (bx === 0 && bz === 0) {
        const park = new THREE.Mesh(
          new THREE.CircleGeometry(16, 24),
          new THREE.MeshLambertMaterial({ color: 0x5da85f }),
        );
        park.rotation.x = -Math.PI / 2;
        park.position.set(cx, 0.05, cz);
        group.add(park);
        const fountain = new THREE.Mesh(
          new THREE.CylinderGeometry(5, 6, 1.2, 20),
          new THREE.MeshLambertMaterial({ color: 0x9fc8e8 }),
        );
        fountain.position.set(cx, 0.6, cz);
        group.add(fountain);
        continue;
      }
      const towers = intRandom(rng, 1, 3);
      for (let t = 0; t < towers; t++) {
        const w = rangeRandom(rng, 12, 20);
        const d = rangeRandom(rng, 12, 20);
        const h = rangeRandom(rng, 10, towers === 1 ? 52 : 30);
        const ox = rangeRandom(rng, -9, 9);
        const oz = rangeRandom(rng, -9, 9);
        const color = pickFrom(rng, PALETTE);
        const floors = Math.max(2, Math.floor(h / 4));
        const tex = makeWindowTexture(rng, color, floors, 4);
        const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x332200, emissiveIntensity: 0 });
        buildingMats.push(mat);
        const tower = new THREE.Mesh(boxGeo, mat);
        tower.scale.set(w, h, d);
        tower.position.set(cx + ox, h / 2, cz + oz);
        group.add(tower);
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pickFrom(rng, ROOF_COLORS) }));
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(cx + ox, h + 0.4, cz + oz);
        group.add(roof);
        colliders.push({
          minX: cx + ox - w / 2, maxX: cx + ox + w / 2,
          minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2,
        });
      }
      // Palm trees on block corners.
      for (let p = 0; p < 2; p++) {
        const px = cx + pickFrom(rng, [-18, 18]);
        const pz = cz + pickFrom(rng, [-18, 18]);
        group.add(makePalm(px, pz, rng));
      }
    }
  }

  // Street lamps along the avenues; a few carry real point lights at dusk.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  let lampIndex = 0;
  for (let i = -N; i <= N; i++) {
    for (let j = -N; j <= N; j += 2) {
      const x = i * pitch + CITY.roadWidth / 2 + 1.5;
      const z = j * pitch;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 8), poleMat);
      pole.position.set(x, 3, z);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), bulbMat);
      bulb.position.set(x, 6.1, z);
      group.add(bulb);
      if (lampIndex % 6 === 0) {
        const light = new THREE.PointLight(0xffd9a0, 0, 26, 1.6);
        light.position.set(x, 6, z);
        group.add(light);
        lampLights.push(light);
      }
      lampIndex += 1;
    }
  }

  // Landmarks: a tall "Solara Tower" and a beach boardwalk sign.
  const towerMat = new THREE.MeshLambertMaterial({ color: 0xffe9c9, emissive: 0x221100, emissiveIntensity: 0 });
  buildingMats.push(towerMat);
  const tower = new THREE.Mesh(boxGeo, towerMat);
  tower.scale.set(26, 86, 26);
  tower.position.set(-pitch * 2 + pitch / 2, 43, -pitch * 2 + pitch / 2);
  group.add(tower);
  colliders.push({
    minX: tower.position.x - 13, maxX: tower.position.x + 13,
    minZ: tower.position.z - 13, maxZ: tower.position.z + 13,
  });

  scene.add(group);

  // Lights: sun + sky. update() moves the sun with the clock.
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xcfe8f7, 220, 620);

  function update(dt, clockMinutes) {
    const dayFrac = clamp((clockMinutes - 360) / (1260 - 360), 0, 1); // 06:00 -> 21:00
    const sunAngle = Math.PI * (0.08 + dayFrac * 0.84);
    sun.position.set(Math.cos(sunAngle) * 220, Math.sin(sunAngle) * 190 + 20, 90);
    const dusk = clamp((clockMinutes - 1020) / 180, 0, 1); // lights after ~17:00
    const warm = dusk;
    sun.color.setHSL(0.09 + 0.04 * (1 - warm), 0.55, 0.85 - warm * 0.25);
    sun.intensity = 1.6 - warm * 0.7;
    hemi.intensity = 0.9 - warm * 0.35;
    scene.background = new THREE.Color().setHSL(0.58, 0.55, 0.72 - warm * 0.3);
    scene.fog.color = new THREE.Color().setHSL(0.58, 0.5, 0.78 - warm * 0.32);
    for (const m of buildingMats) m.emissiveIntensity = dusk * 0.9;
    for (const l of lampLights) l.intensity = dusk * 22;
    ocean.position.y = -0.4 + Math.sin(clockMinutes * 0.02) * 0.15;
  }

  return {
    group, colliders, roadCenters, pitch, bounds: CITY.halfSize,
    spawn: { x: 0, z: 40 },
    update,
  };
}

function makePalm(x, z, rng) {
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.34, 5.5, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a6f4d }),
  );
  trunk.position.y = 2.75;
  trunk.rotation.z = rangeRandom(rng, -0.08, 0.08);
  palm.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, 5.6, Math.sin(a) * 1.1);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    palm.add(leaf);
  }
  palm.position.set(x, 0, z);
  return palm;
}

// Push a circle (player or car) out of building AABBs. Returns true on hit.
export function collideWithBuildings(colliders, pos, radius) {
  let hit = false;
  for (const b of colliders) {
    if (pos.x > b.minX - radius && pos.x < b.maxX + radius &&
        pos.z > b.minZ - radius && pos.z < b.maxZ + radius) {
      const pushLeft = pos.x - (b.minX - radius);
      const pushRight = (b.maxX + radius) - pos.x;
      const pushBack = pos.z - (b.minZ - radius);
      const pushFront = (b.maxZ + radius) - pos.z;
      const m = Math.min(pushLeft, pushRight, pushBack, pushFront);
      if (m === pushLeft) pos.x = b.minX - radius;
      else if (m === pushRight) pos.x = b.maxX + radius;
      else if (m === pushBack) pos.z = b.minZ - radius;
      else pos.z = b.maxZ + radius;
      hit = true;
    }
  }
  return hit;
}
