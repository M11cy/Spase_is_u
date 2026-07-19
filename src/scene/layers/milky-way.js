import { enableDeepSpaceBloom } from "../deep-space-postprocessing.js";
import {
  clampPresence,
  createSeededRandom,
  disposeObjectTree,
  resolveParallax
} from "./deep-space-utils.js";

const GALAXY_SEED = 19770314;
const ARM_COUNT = 4;
const DUST_LANE_COUNT = 2;
const ROOT_DEPTH = -80;
const DISC_DIAMETER = 210;
const DISC_RADIUS = DISC_DIAMETER / 2;
const INNER_ARM_RADIUS = 7.2;
const INCLINATION = Math.PI / 9;
const ROOT_SCALE = 1.62;
const PROTECTED_CORE_RADIUS = 28;
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

const createSpiralPoint = ({ random, index, count, angleOffset = 0, widthScale = 1 }) => {
  const arm = index % ARM_COUNT;
  const pointsPerArm = Math.ceil(count / ARM_COUNT);
  const pointInArm = Math.floor(index / ARM_COUNT);
  const progression = Math.min(1, (pointInArm + random() * 0.42) / Math.max(1, pointsPerArm - 0.58));
  const logarithmicGrowth = Math.log(DISC_RADIUS / INNER_ARM_RADIUS);
  const radius = INNER_ARM_RADIUS * Math.exp(progression * logarithmicGrowth);
  const clump = (Math.sin(progression * Math.PI * 18 + arm * 1.7) + 1) / 2;
  const angle = arm * (Math.PI * 2 / ARM_COUNT)
    + progression * 6.35
    + angleOffset
    + (random() - 0.5) * 0.11;
  const radialSpread = (random() - 0.5) * (0.9 + radius * 0.026) * widthScale;
  const armSpread = (random() - 0.5) * (1.35 + radius * 0.068) * widthScale * (0.62 + clump * 0.38);
  const resolvedRadius = radius + radialSpread;
  const tangent = angle + Math.PI / 2;

  return Object.freeze({
    x: Math.cos(angle) * resolvedRadius + Math.cos(tangent) * armSpread,
    y: Math.sin(angle) * resolvedRadius + Math.sin(tangent) * armSpread,
    z: (random() - 0.5) * (1.15 + radius * 0.028),
    clump,
    progression
  });
};

const createStarField = (THREE, glowTexture, count) => {
  const random = createSeededRandom(GALAXY_SEED);
  const positions = [];
  const colors = [];
  const warm = new THREE.Color(0xffd39a);
  const coolPalette = [
    new THREE.Color(0xeef6ff),
    new THREE.Color(0xb9d3ff),
    new THREE.Color(0xffe1c2),
    new THREE.Color(0xa8b8ff)
  ];

  for (let index = 0; index < count; index += 1) {
    const point = createSpiralPoint({ random, index, count });
    const outerColor = coolPalette[index % coolPalette.length];
    const color = warm.clone().lerp(outerColor, Math.min(1, point.progression * 1.35));
    const brightness = (0.56 + random() * 0.44) * (0.72 + point.clump * 0.28);
    positions.push(point.x, point.y, point.z);
    colors.push(color.r * brightness, color.g * brightness, color.b * brightness);
  }

  const geometry = new THREE.BufferGeometry();
  setAttribute(THREE, geometry, "position", positions);
  setAttribute(THREE, geometry, "color", colors);
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: 1.38,
    transparent: true,
    opacity: 0.82,
    alphaTest: 0.01,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });
  const stars = enableDeepSpaceBloom(new THREE.Points(geometry, material));
  stars.name = "milky-way-stars";
  stars.renderOrder = 5;
  return stars;
};

const createDustLane = (THREE, glowTexture, count, laneIndex) => {
  const random = createSeededRandom(GALAXY_SEED + 101 + laneIndex);
  const positions = [];
  const colors = [];
  const angleOffset = laneIndex === 0 ? -0.105 : 0.115;

  for (let index = 0; index < count; index += 1) {
    const point = createSpiralPoint({
      random,
      index,
      count,
      angleOffset,
      widthScale: 0.48
    });
    const foregroundOffset = 0.7 + laneIndex * 0.38;
    const darkness = 0.018 + random() * 0.026;
    positions.push(point.x, point.y, point.z + foregroundOffset);
    colors.push(darkness * 0.38, darkness * 0.48, darkness * 0.72);
  }

  const geometry = new THREE.BufferGeometry();
  setAttribute(THREE, geometry, "position", positions);
  setAttribute(THREE, geometry, "color", colors);
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: laneIndex === 0 ? 6.2 : 5.4,
    transparent: true,
    opacity: laneIndex === 0 ? 0.82 : 0.74,
    alphaTest: 0.01,
    depthTest: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.NormalBlending
  });
  const dust = new THREE.Points(geometry, material);
  dust.name = `milky-way-dust-lane-${laneIndex + 1}`;
  dust.userData.occludesArms = true;
  dust.renderOrder = 6;
  return dust;
};

const createCore = (THREE, glowTexture) => {
  const material = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffc878,
    transparent: true,
    opacity: 0.97,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const core = enableDeepSpaceBloom(new THREE.Sprite(material));
  core.name = "milky-way-core";
  core.scale.set(31, 31, 1);
  core.renderOrder = 8;
  return core;
};

const createHalo = (THREE, glowTexture, count) => {
  const random = createSeededRandom(GALAXY_SEED + 303);
  const positions = [];
  const colors = [];
  const cool = new THREE.Color(0x88aaff);
  const warm = new THREE.Color(0xffd7a4);

  for (let index = 0; index < count; index += 1) {
    const radius = 32 + Math.pow(random(), 0.58) * 86;
    const polar = random() * 2 - 1;
    const planarRadius = Math.sqrt(1 - polar * polar) * radius;
    const angle = random() * Math.PI * 2;
    const color = cool.clone().lerp(warm, random() * 0.3);
    const brightness = 0.34 + random() * 0.44;
    positions.push(
      Math.cos(angle) * planarRadius,
      Math.sin(angle) * planarRadius,
      polar * radius * 0.48
    );
    colors.push(color.r * brightness, color.g * brightness, color.b * brightness);
  }

  const geometry = new THREE.BufferGeometry();
  setAttribute(THREE, geometry, "position", positions);
  setAttribute(THREE, geometry, "color", colors);
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: 2.15,
    transparent: true,
    opacity: 0.28,
    alphaTest: 0.01,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });
  const halo = new THREE.Points(geometry, material);
  halo.name = "milky-way-halo";
  halo.renderOrder = 1;
  return halo;
};

const isPosition = (position) => Array.isArray(position)
  && position.length === 3
  && position.every((value) => typeof value === "number" && Number.isFinite(value));

const projectAnnotationPosition = ([sourceX, sourceY, sourceZ]) => {
  const sourceRadius = Math.hypot(sourceX, sourceY);
  const markerRadius = Math.max(PROTECTED_CORE_RADIUS + 2, sourceRadius);
  const angle = sourceRadius > 0 ? Math.atan2(sourceY, sourceX) : -Math.PI / 3;
  return Object.freeze({
    x: Math.cos(angle) * markerRadius,
    y: Math.sin(angle) * markerRadius,
    z: Math.max(-14, Math.min(14, sourceZ - ROOT_DEPTH))
  });
};

const createAnnotationMarkers = ({ annotations, createMarker, root }) => annotations.flatMap((source) => {
  if (!source || typeof source !== "object" || !isPosition(source.position)) return [];

  const marker = createMarker(source);
  if (!marker || typeof marker !== "object" || !marker.position || typeof marker.position.set !== "function") {
    return [];
  }
  const position = projectAnnotationPosition(source.position);
  marker.position.set(position.x, position.y, position.z);
  marker.userData.baseOpacity = marker.material?.opacity ?? 1;
  const annotation = Object.freeze({ ...source, object3D: marker });
  marker.userData.annotation = annotation;
  marker.userData.stage = annotation.stage;
  marker.renderOrder = 9;
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
  root.rotation.set(-Math.PI / 2 + INCLINATION, 0, -0.16);
  root.scale.setScalar(ROOT_SCALE);
  root.visible = false;
  root.userData.composition = Object.freeze({
    inclinationDegrees: 20,
    diameter: DISC_DIAMETER,
    armCount: ARM_COUNT,
    dustLanes: DUST_LANE_COUNT
  });
  root.userData.armStructure = Object.freeze({
    armCount: ARM_COUNT,
    coordinatePlane: "xy",
    pattern: "logarithmic",
    seed: GALAXY_SEED
  });

  const stars = createStarField(THREE, glowTexture, quality.galaxyPoints);
  const dustCount = Math.max(64, Math.round(quality.galaxyPoints * 0.16));
  const dustLanes = Array.from({ length: DUST_LANE_COUNT }, (_, laneIndex) => (
    createDustLane(THREE, glowTexture, dustCount, laneIndex)
  ));
  const core = createCore(THREE, glowTexture);
  const halo = createHalo(THREE, glowTexture, Math.max(96, Math.round(quality.galaxyPoints * 0.05)));
  root.add(halo, stars, ...dustLanes, core);

  const interactive = createAnnotationMarkers({ annotations, createMarker, root });
  const fadedObjects = [stars, ...dustLanes, core, halo, ...interactive];
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
