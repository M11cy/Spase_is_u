import {
  clampPresence,
  createSeededRandom,
  disposeObjectTree,
  resolveParallax
} from "./deep-space-utils.js";

const LOCAL_GROUP_SEED = 20610422;
const MIN_SIZE = 0.01;
const PROFILE_CONFIG = Object.freeze({
  spiral: Object.freeze({ aspect: 1.78, thickness: 0.36, stars: 84, discOpacity: 0.62, coreRatio: 0.34 }),
  irregular: Object.freeze({ aspect: 1.28, thickness: 0.68, stars: 54, discOpacity: 0.5, coreRatio: 0.25 }),
  elliptical: Object.freeze({ aspect: 1.14, thickness: 0.86, stars: 46, discOpacity: 0.56, coreRatio: 0.38 })
});

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isPosition = (position) => Array.isArray(position)
  && position.length === 3
  && position.every(isFiniteNumber);
const isQualityTier = (quality) => quality && typeof quality === "object"
  && ["high", "medium", "economy"].includes(quality.tier);

const profileFor = (id) => id.includes("m32")
  ? "elliptical"
  : id.includes("magellanic") || id.includes("-lmc") || id.includes("-smc")
    ? "irregular"
    : "spiral";

const annotationIsValid = (annotation) => annotation
  && typeof annotation === "object"
  && typeof annotation.id === "string"
  && annotation.id.length > 0
  && Number.isInteger(annotation.stage)
  && annotation.stage >= 0
  && isPosition(annotation.position)
  && isFiniteNumber(annotation.size)
  && annotation.size >= MIN_SIZE;

const requireLayerInput = ({ THREE, annotations, quality, stage, textureFor, createMarker, reducedMotion }) => {
  if (!THREE || ["Group", "Sprite", "SpriteMaterial", "Mesh", "MeshBasicMaterial", "PlaneGeometry", "DataTexture", "Points", "PointsMaterial", "BufferGeometry", "Float32BufferAttribute", "Color"]
    .some((name) => typeof THREE[name] !== "function")) {
    throw new TypeError("Local Group layer requires a compatible THREE namespace");
  }
  if (!Array.isArray(annotations)) throw new TypeError("Local Group annotations must be an array");
  if (!isQualityTier(quality)) throw new TypeError("Local Group quality requires a supported tier");
  if (!Number.isInteger(stage) || stage < 0) throw new TypeError("Local Group layer requires a valid stage");
  if (typeof textureFor !== "function" || typeof createMarker !== "function" || typeof reducedMotion !== "boolean") {
    throw new TypeError("Local Group layer requires texture, marker, and motion dependencies");
  }
};

const seedFor = (id) => [...id].reduce((seed, character) => (
  Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
), LOCAL_GROUP_SEED);

const textureFrom = (textureEntry) => textureEntry?.texture ?? (textureEntry?.isTexture ? textureEntry : null);

const safelyResolveTexture = (textureFor, annotation) => {
  try {
    return textureFrom(textureFor(annotation));
  } catch {
    return null;
  }
};

const createFallbackTexture = (THREE, annotation, profile) => {
  const resolution = 16;
  const data = new Uint8Array(resolution * resolution * 4);
  const color = Number.isInteger(annotation.color) ? annotation.color : 0xdde8ff;
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  const verticalScale = PROFILE_CONFIG[profile].thickness;
  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const horizontal = (x / (resolution - 1) - 0.5) * 2;
      const vertical = ((y / (resolution - 1) - 0.5) * 2) / verticalScale;
      const distance = Math.hypot(horizontal, vertical);
      const index = (y * resolution + x) * 4;
      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
      data[index + 3] = Math.round(Math.max(0, 1 - distance) * 255);
    }
  }
  const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const createStars = (THREE, annotation, profile, glowTexture) => {
  const random = createSeededRandom(seedFor(annotation.id));
  const config = PROFILE_CONFIG[profile];
  const positions = [];
  const colors = [];
  const size = annotation.size;
  for (let index = 0; index < config.stars; index += 1) {
    const arm = index % 4;
    const progression = (Math.floor(index / 4) + random() * 0.55) / Math.ceil(config.stars / 4);
    const smoothRadius = Math.sqrt(random());
    const spiralRadius = size * (0.14 + progression * 0.74);
    const spiralAngle = arm * Math.PI / 2 + progression * 5.4 + (random() - 0.5) * 0.09;
    const clump = index % 3;
    const clumpCenters = Object.freeze([
      Object.freeze({ x: -0.18, y: 0.11 }),
      Object.freeze({ x: 0.31, y: -0.08 }),
      Object.freeze({ x: 0.55, y: 0.21 })
    ]);
    const clumpSpread = (random() + random() - 1) * 0.22;
    const x = profile === "spiral"
      ? Math.cos(spiralAngle) * spiralRadius
      : profile === "irregular"
        ? (clumpCenters[clump].x + clumpSpread) * size
        : Math.cos(random() * Math.PI * 2) * smoothRadius * size * 0.78;
    const y = profile === "spiral"
      ? Math.sin(spiralAngle) * spiralRadius * 0.62
      : profile === "irregular"
        ? (clumpCenters[clump].y + clumpSpread * 0.72) * size
        : Math.sin(random() * Math.PI * 2) * smoothRadius * size * config.thickness * 0.4;
    const z = (random() - 0.5) * size * config.thickness;
    const tone = 0.54 + random() * 0.46;
    positions.push(x, y, z);
    colors.push(tone, tone * (0.9 + random() * 0.1), 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: Math.max(0.65, size * 0.055),
    transparent: true,
    opacity: 0.72,
    alphaTest: 0.01,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = `${annotation.id}-stars`;
  stars.renderOrder = 5;
  return stars;
};

const createDisc = (THREE, annotation, profile, texture) => {
  const config = PROFILE_CONFIG[profile];
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity: config.discOpacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  disc.name = `${annotation.id}-disc`;
  disc.scale.set(annotation.size * 2, annotation.size * 2, 1);
  disc.renderOrder = 4;
  return disc;
};

const createCore = (THREE, annotation, profile, glowTexture) => {
  const material = new THREE.SpriteMaterial({
    map: glowTexture,
    color: annotation.color ?? 0xf6e4c4,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const core = new THREE.Sprite(material);
  core.name = `${annotation.id}-core`;
  const coreSize = annotation.size * PROFILE_CONFIG[profile].coreRatio;
  core.scale.set(coreSize, coreSize, 1);
  core.renderOrder = 6;
  return core;
};

const createMarker = ({ annotation, factory, root, position }) => {
  let marker = null;
  try {
    marker = factory(annotation);
  } catch {
    return null;
  }
  if (!marker || typeof marker !== "object" || !marker.position || typeof marker.position.set !== "function") return null;
  marker.name = `${annotation.id}-marker`;
  marker.position.set(...position);
  marker.userData.baseOpacity = marker.material?.opacity ?? 1;
  const annotated = Object.freeze({ ...annotation, object3D: marker });
  marker.userData.annotation = annotated;
  marker.userData.stage = annotated.stage;
  marker.renderOrder = 7;
  root.add(marker);
  return marker;
};

const createGalaxy = ({ THREE, annotation, textureFor, glowTexture, position }) => {
  const profile = profileFor(annotation.id);
  const config = PROFILE_CONFIG[profile];
  const random = createSeededRandom(seedFor(annotation.id) + 1);
  const galaxy = new THREE.Group();
  galaxy.name = annotation.id;
  galaxy.position.set(...position);
  galaxy.scale.set(config.aspect, 1, 1);
  galaxy.rotation.set((random() - 0.5) * 0.24, (random() - 0.5) * 0.34, (random() - 0.5) * 0.8);
  galaxy.userData.profile = profile;
  galaxy.userData.tilt = Object.freeze({ x: galaxy.rotation.x, y: galaxy.rotation.y, z: galaxy.rotation.z });
  const resolvedTexture = safelyResolveTexture(textureFor, annotation);
  const fallbackTexture = resolvedTexture ? null : createFallbackTexture(THREE, annotation, profile);
  const disc = createDisc(THREE, annotation, profile, resolvedTexture ?? fallbackTexture);
  const stars = createStars(THREE, annotation, profile, glowTexture);
  const core = createCore(THREE, annotation, profile, glowTexture);
  galaxy.add(disc, stars, core);
  const faded = [disc, stars, core];
  faded.forEach((object) => {
    object.userData.baseOpacity = object.userData.baseOpacity ?? object.material?.opacity ?? 1;
  });
  return Object.freeze({ galaxy, fallbackTexture, faded: Object.freeze(faded) });
};

export const createLocalGroupLayer = (input) => {
  const {
    THREE,
    annotations,
    quality,
    stage,
    textureFor,
    glowTexture = null,
    createMarker: markerFactory,
    reducedMotion
  } = input ?? {};
  requireLayerInput({ THREE, annotations, quality, stage, textureFor, createMarker: markerFactory, reducedMotion });

  const root = new THREE.Group();
  root.name = "local-group-layer";
  root.visible = false;
  const validAnnotations = annotations.filter(annotationIsValid).filter(({ stage: annotationStage }) => annotationStage === stage);
  const uniqueAnnotations = validAnnotations.filter((annotation, index) => (
    validAnnotations.findIndex(({ id }) => id === annotation.id) === index
  ));
  const records = uniqueAnnotations.map((annotation, index) => {
    const repeatedDepth = uniqueAnnotations.slice(0, index)
      .filter(({ position }) => position[2] === annotation.position[2]).length;
    const position = Object.freeze([
      annotation.position[0],
      annotation.position[1],
      annotation.position[2] - repeatedDepth * (0.35 + (seedFor(annotation.id) % 5) * 0.05)
    ]);
    const record = createGalaxy({ THREE, annotation, textureFor, glowTexture, position });
    root.add(record.galaxy);
    const marker = createMarker({ annotation, factory: markerFactory, root, position });
    const faded = Object.freeze([...record.faded, marker].filter(Boolean));
    faded.forEach((object) => {
      object.userData.baseOpacity = object.userData.baseOpacity ?? object.material?.opacity ?? 1;
    });
    return Object.freeze({ ...record, marker, faded });
  });
  const interactive = Object.freeze(records.map(({ marker }) => marker).filter(Boolean));
  const fadedObjects = Object.freeze(records.flatMap(({ faded }) => faded));
  const fallbackTextures = Object.freeze(records.map(({ fallbackTexture }) => fallbackTexture).filter(Boolean));
  let disposed = false;

  const setPresence = (value) => {
    if (disposed) return;
    const presence = clampPresence(value);
    root.visible = presence > 0.01;
    fadedObjects.forEach((object) => {
      if (object.material) object.material.opacity = (object.userData.baseOpacity ?? object.material.opacity) * presence;
    });
  };

  return Object.freeze({
    root,
    interactive,
    setPresence,
    updateParallax: (pointer = {}) => {
      const { x, y } = pointer && typeof pointer === "object" ? pointer : {};
      const offset = resolveParallax({ x, y, reducedMotion, tier: quality.tier });
      root.position.x = offset.x;
      root.position.y = offset.y;
      return Object.freeze({ x: root.position.x, y: root.position.y });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      disposeObjectTree(root);
      fallbackTextures.forEach((texture) => texture.dispose());
    }
  });
};
