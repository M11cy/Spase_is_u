import {
  clampPresence,
  createSeededRandom,
  disposeObjectTree,
  resolveParallax
} from "./deep-space-utils.js";

const GALAXY_SEED = 19770314;
const ARM_COUNT = 4;
const ROOT_DEPTH = -80;
const MIN_GALAXY_POINTS = 1;

const isPositiveInteger = (value) => Number.isInteger(value) && value >= MIN_GALAXY_POINTS;

const requireLayerInput = ({ THREE, annotations, quality, createMarker, reducedMotion }) => {
  if (!THREE || typeof THREE.Group !== "function" || typeof THREE.BufferGeometry !== "function") {
    throw new TypeError("Milky Way layer requires a compatible THREE namespace");
  }
  if (!Array.isArray(annotations)) {
    throw new TypeError("Milky Way annotations must be an array");
  }
  if (!quality || typeof quality !== "object" || !isPositiveInteger(quality.galaxyPoints)) {
    throw new TypeError("Milky Way quality.galaxyPoints must be a positive integer");
  }
  if (typeof createMarker !== "function" || typeof reducedMotion !== "boolean") {
    throw new TypeError("Milky Way layer requires a marker factory and reduced-motion preference");
  }
};

const setAttribute = (THREE, geometry, name, values) => {
  geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, 3));
};

const createArmPoint = (random, index, count, offset = 0) => {
  const arm = index % ARM_COUNT;
  const progression = (index + random() * 0.7) / count;
  const radius = 10 * Math.exp(progression * 2.9);
  const angle = arm * (Math.PI * 2 / ARM_COUNT) + progression * 7.2 + (random() - 0.5) * 0.24;
  const armSpread = (random() - 0.5) * (3.5 + radius * 0.11);
  const thickness = (random() - 0.5) * (1.5 + radius * 0.035);

  return Object.freeze({
    x: Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * armSpread,
    y: thickness + offset,
    z: Math.sin(angle) * radius * 0.36 + Math.sin(angle + Math.PI / 2) * armSpread * 0.35
  });
};

const createStarField = (THREE, glowTexture, count) => {
  const random = createSeededRandom(GALAXY_SEED);
  const positions = [];
  const colors = [];
  const palette = [
    new THREE.Color(0xeef6ff),
    new THREE.Color(0xb9d3ff),
    new THREE.Color(0xffdfbd),
    new THREE.Color(0xa8b8ff)
  ];

  for (let index = 0; index < count; index += 1) {
    const point = createArmPoint(random, index, count);
    const color = palette[index % palette.length];
    const brightness = 0.55 + random() * 0.45;
    positions.push(point.x, point.y, point.z);
    colors.push(color.r * brightness, color.g * brightness, color.b * brightness);
  }

  const geometry = new THREE.BufferGeometry();
  setAttribute(THREE, geometry, "position", positions);
  setAttribute(THREE, geometry, "color", colors);
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: 1.45,
    transparent: true,
    opacity: 0.82,
    alphaTest: 0.01,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = "milky-way-stars";
  stars.renderOrder = 5;
  return stars;
};

const createDustField = (THREE, glowTexture, count) => {
  const random = createSeededRandom(GALAXY_SEED + 1);
  const positions = [];
  const colors = [];

  for (let index = 0; index < count; index += 1) {
    const point = createArmPoint(random, index, count, (random() - 0.5) * 1.5);
    positions.push(point.x * 1.025, point.y * 1.8, point.z * 1.025);
    const opacityTone = 0.045 + random() * 0.11;
    colors.push(opacityTone * 0.46, opacityTone * 0.56, opacityTone);
  }

  const geometry = new THREE.BufferGeometry();
  setAttribute(THREE, geometry, "position", positions);
  setAttribute(THREE, geometry, "color", colors);
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: 4.4,
    transparent: true,
    opacity: 0.55,
    alphaTest: 0.01,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.NormalBlending
  });
  const dust = new THREE.Points(geometry, material);
  dust.name = "milky-way-dust";
  dust.renderOrder = 3;
  return dust;
};

const createCore = (THREE, glowTexture) => {
  const material = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffc878,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const core = new THREE.Sprite(material);
  core.name = "milky-way-core";
  core.scale.set(28, 28, 1);
  core.renderOrder = 6;
  return core;
};

const createHalo = (THREE) => {
  const geometry = new THREE.SphereGeometry(115, 24, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0x789cff,
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.NormalBlending
  });
  const halo = new THREE.Mesh(geometry, material);
  halo.name = "milky-way-halo";
  halo.scale.set(1, 0.52, 0.74);
  halo.renderOrder = 1;
  return halo;
};

const isPosition = (position) => Array.isArray(position)
  && position.length === 3
  && position.every((value) => typeof value === "number" && Number.isFinite(value));

const createAnnotationMarkers = ({ annotations, createMarker, root }) => annotations.flatMap((source) => {
  if (!source || typeof source !== "object" || !isPosition(source.position)) return [];

  const marker = createMarker(source);
  if (!marker || typeof marker !== "object" || !marker.position || typeof marker.position.set !== "function") {
    return [];
  }
  marker.position.set(source.position[0], source.position[1], source.position[2] - ROOT_DEPTH);
  marker.userData.baseOpacity = marker.material?.opacity ?? 1;
  const annotation = Object.freeze({ ...source, object3D: marker });
  marker.userData.annotation = annotation;
  marker.userData.stage = annotation.stage;
  marker.renderOrder = 7;
  root.add(marker);
  return [marker];
});

export const createMilkyWayLayer = (input) => {
  const {
    THREE,
    annotations,
    quality,
    glowTexture = null,
    createMarker,
    reducedMotion
  } = input ?? {};
  requireLayerInput({ THREE, annotations, quality, createMarker, reducedMotion });

  const root = new THREE.Group();
  root.name = "milky-way-layer";
  root.position.set(0, 0, ROOT_DEPTH);
  root.visible = false;

  const stars = createStarField(THREE, glowTexture, quality.galaxyPoints);
  const dust = createDustField(THREE, glowTexture, Math.max(64, Math.round(quality.galaxyPoints * 0.58)));
  const core = createCore(THREE, glowTexture);
  const halo = createHalo(THREE);
  root.add(halo, dust, stars, core);

  const interactive = createAnnotationMarkers({ annotations, createMarker, root });
  const fadedObjects = [stars, dust, core, halo, ...interactive];
  fadedObjects.forEach((object) => {
    object.userData.baseOpacity = object.userData.baseOpacity ?? object.material?.opacity ?? 1;
  });
  let disposed = false;

  const setPresence = (value) => {
    if (disposed) return;
    const presence = clampPresence(value);
    root.visible = presence > 0.01;
    fadedObjects.forEach((object) => {
      if (!object.material) return;
      object.material.opacity = (object.userData.baseOpacity ?? object.material.opacity) * presence;
    });
  };

  return Object.freeze({
    root,
    interactive: Object.freeze(interactive),
    setPresence,
    updateParallax: (input = {}) => {
      const { x, y } = input && typeof input === "object" ? input : {};
      const offset = resolveParallax({
        x,
        y,
        reducedMotion,
        tier: quality.tier
      });
      root.position.x = offset.x;
      root.position.y = offset.y;
      return Object.freeze({ x: root.position.x, y: root.position.y });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      disposeObjectTree(root);
    }
  });
};
