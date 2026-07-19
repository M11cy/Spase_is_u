import { BLOOM_SCENE_LAYER } from "../deep-space-postprocessing.js";
import {
  clampPresence,
  createSeededRandom,
  disposeObjectTree,
  resolveParallax
} from "./deep-space-utils.js";

const DEFAULT_SEED = 20610422;
const PROFILE_ORDER = Object.freeze(["spiral", "elliptical", "irregular"]);
const GALAXIES_PER_TIER = Object.freeze({ high: 260, medium: 160, economy: 90 });
const HEROES_PER_TIER = Object.freeze({ high: 14, medium: 11, economy: 8 });
const PROFILE_ASPECT = Object.freeze({ spiral: 1.78, elliptical: 1.34, irregular: 1.18 });
const PROFILE_COLORS = Object.freeze({ warm: 0xffbd7a, cool: 0xb7d6ff });
const CLUSTERS = Object.freeze([
  Object.freeze([-104, 42, -145, 18, 13, 24]),
  Object.freeze([-72, -35, -205, 24, 17, 32]),
  Object.freeze([-18, 54, -268, 20, 14, 34]),
  Object.freeze([48, -44, -326, 24, 16, 38]),
  Object.freeze([96, 18, -388, 19, 15, 32]),
  Object.freeze([-94, -2, -448, 18, 22, 30]),
  Object.freeze([44, 52, -505, 21, 13, 28])
]);
const EMPTY_INTERACTIVE = Object.freeze([]);

const VERTEX_SHADER = `
  attribute float aSize;
  attribute float aRotation;
  attribute float aAspect;
  attribute vec3 aColor;
  uniform float uPresence;
  uniform float uPointScale;
  varying vec3 vColor;
  varying float vRotation;
  varying float vAspect;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    float perspective = clamp(540.0 / max(1.0, -viewPosition.z), 0.62, 2.1);
    gl_PointSize = max(1.25, aSize * perspective * uPointScale);
    gl_Position = projectionMatrix * viewPosition;
    vColor = aColor;
    vRotation = aRotation;
    vAspect = aAspect;
  }
`;

const PROFILE_FRAGMENT_SHADER = `
  uniform float uPresence;
  uniform float uIntensity;
  varying vec3 vColor;
  varying float vRotation;
  varying float vAspect;

  vec2 rotatedPoint(vec2 point, float angle) {
    float cosine = cos(angle);
    float sine = sin(angle);
    return mat2(cosine, -sine, sine, cosine) * point;
  }

  void main() {
    vec2 point = rotatedPoint(gl_PointCoord - 0.5, vRotation);
    point.y *= vAspect;
    float radius = length(point);
    float alpha = 0.0;
    float luminance = 1.0;

    #ifdef PROFILE_SPIRAL
      float angle = atan(point.y, point.x);
      float arms = pow(0.5 + 0.5 * cos(angle * 2.0 - radius * 31.0), 7.0);
      float disc = 1.0 - smoothstep(0.08, 0.52, radius);
      float core = exp(-radius * 15.0);
      alpha = (disc * (0.16 + arms * 0.82) + core * 1.3) * (1.0 - smoothstep(0.4, 0.53, radius));
      luminance = 0.78 + core * 0.75 + arms * 0.32;
    #elif defined(PROFILE_ELLIPTICAL)
      float envelope = exp(-radius * radius * 14.0);
      float core = exp(-radius * 18.0);
      alpha = (envelope * 0.86 + core * 0.82) * (1.0 - smoothstep(0.36, 0.53, radius));
      luminance = 0.86 + core * 0.92;
    #else
      float cloudA = exp(-dot(point - vec2(-0.12, 0.05), point - vec2(-0.12, 0.05)) * 30.0);
      float cloudB = exp(-dot(point - vec2(0.13, -0.08), point - vec2(0.13, -0.08)) * 42.0);
      float cloudC = exp(-dot(point - vec2(0.03, 0.16), point - vec2(0.03, 0.16)) * 55.0);
      alpha = (cloudA * 0.7 + cloudB * 0.84 + cloudC * 0.64) * (1.0 - smoothstep(0.37, 0.54, radius));
      luminance = 0.88 + cloudB * 0.62;
    #endif

    alpha *= uPresence;
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(vColor * luminance * uIntensity, alpha);
  }
`;

const CORE_FRAGMENT_SHADER = `
  uniform float uPresence;
  uniform float uIntensity;
  varying vec3 vColor;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point) * 2.0;
    float halo = pow(max(0.0, 1.0 - radius), 3.2);
    float core = exp(-radius * 8.0);
    float alpha = (halo * 0.55 + core) * uPresence;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor * (0.85 + core) * uIntensity, alpha);
  }
`;

const requireLayerInput = ({ THREE, quality, reducedMotion, seed }) => {
  const requiredConstructors = [
    "Group",
    "BufferGeometry",
    "Float32BufferAttribute",
    "ShaderMaterial",
    "Points",
    "Color"
  ];
  if (!THREE || requiredConstructors.some((name) => typeof THREE[name] !== "function")) {
    throw new TypeError("Local Group layer requires a compatible THREE namespace");
  }
  if (!quality || typeof quality !== "object" || !(quality.tier in GALAXIES_PER_TIER)) {
    throw new TypeError("Local Group quality requires a supported tier");
  }
  if (quality.localGroupGalaxies != null && (
    !Number.isInteger(quality.localGroupGalaxies) || quality.localGroupGalaxies < 1
  )) {
    throw new TypeError("Local Group galaxy budget must be a positive integer");
  }
  if (typeof reducedMotion !== "boolean") {
    throw new TypeError("Local Group layer requires an explicit motion preference");
  }
  if (!Number.isSafeInteger(seed)) throw new TypeError("Local Group seed must be a safe integer");
};

const centeredRandom = (random) => random() + random() + random() - 1.5;

const sampleClusteredPosition = (random, index) => {
  const cluster = CLUSTERS[(index * 5 + Math.floor(random() * CLUSTERS.length)) % CLUSTERS.length];
  const [centerX, centerY, centerZ, spreadX, spreadY, spreadZ] = cluster;
  let x = centerX + centeredRandom(random) * spreadX;
  let y = centerY + centeredRandom(random) * spreadY;
  if (Math.abs(x) < 8 && Math.abs(y) < 8) {
    x += x < 0 ? -16 : 16;
    y += y < 0 ? -10 : 10;
  }
  return Object.freeze([
    x,
    y,
    centerZ + centeredRandom(random) * spreadZ
  ]);
};

const createCatalog = ({ count, heroCount, random }) => Object.freeze(Array.from(
  { length: count },
  (_, index) => Object.freeze({
    id: `deep-field-${index}`,
    profile: PROFILE_ORDER[index % PROFILE_ORDER.length],
    position: sampleClusteredPosition(random, index),
    size: index < heroCount ? 18 + random() * 22 : 2.4 + random() * 8.5,
    rotation: random() * Math.PI * 2,
    temperature: index % 7 === 0 ? "warm" : "cool"
  })
));

const colorFor = (THREE, record, index) => {
  const color = new THREE.Color(PROFILE_COLORS[record.temperature]);
  color.multiplyScalar(0.82 + (index % 9) * 0.025);
  return color.toArray();
};

const createGeometry = (THREE, records) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(records.flatMap(({ position }) => position), 3));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(records.map(({ size }) => size), 1));
  geometry.setAttribute("aRotation", new THREE.Float32BufferAttribute(records.map(({ rotation }) => rotation), 1));
  geometry.setAttribute("aAspect", new THREE.Float32BufferAttribute(records.map(({ profile, rotation }) => (
    PROFILE_ASPECT[profile] * (0.92 + rotation / (Math.PI * 2) * 0.16)
  )), 1));
  geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(records.flatMap((record, index) => (
    colorFor(THREE, record, index)
  )), 3));
  geometry.computeBoundingSphere();
  return geometry;
};

const createMaterial = (THREE, { profile = null, core = false }) => new THREE.ShaderMaterial({
  name: core ? "local-group-hero-core-material" : `local-group-${profile}-material`,
  defines: profile ? { [`PROFILE_${profile.toUpperCase()}`]: 1 } : {},
  uniforms: {
    uPresence: { value: 1 },
    uPointScale: { value: core ? 0.46 : 1 },
    uIntensity: { value: core ? 1.72 : 1.08 }
  },
  vertexShader: VERTEX_SHADER,
  fragmentShader: core ? CORE_FRAGMENT_SHADER : PROFILE_FRAGMENT_SHADER,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
  toneMapped: false
});

const createProfileBatch = (THREE, profile, catalog) => {
  const records = catalog.filter((record) => record.profile === profile);
  const points = new THREE.Points(
    createGeometry(THREE, records),
    createMaterial(THREE, { profile })
  );
  points.name = `local-group-${profile}-batch`;
  points.renderOrder = 4;
  return points;
};

const createHeroCores = (THREE, catalog, heroCount) => {
  const records = catalog.slice(0, heroCount);
  const points = new THREE.Points(
    createGeometry(THREE, records),
    createMaterial(THREE, { core: true })
  );
  points.name = "local-group-hero-cores";
  points.layers.enable(BLOOM_SCENE_LAYER);
  points.renderOrder = 5;
  return points;
};

export const createLocalGroupLayer = (input = {}) => {
  const {
    THREE,
    quality,
    glowTexture: _glowTexture = null,
    reducedMotion,
    seed = DEFAULT_SEED
  } = input;
  requireLayerInput({ THREE, quality, reducedMotion, seed });

  const count = quality.localGroupGalaxies ?? GALAXIES_PER_TIER[quality.tier];
  const heroCount = Math.min(count, HEROES_PER_TIER[quality.tier]);
  const catalog = createCatalog({ count, heroCount, random: createSeededRandom(seed) });
  const root = new THREE.Group();
  root.name = "local-group-layer";
  root.visible = false;
  root.userData.composition = Object.freeze({
    galaxyCount: count,
    heroCount,
    profiles: PROFILE_ORDER,
    clustered: true
  });
  const batches = Object.freeze(PROFILE_ORDER.map((profile) => createProfileBatch(THREE, profile, catalog)));
  const heroCores = createHeroCores(THREE, catalog, heroCount);
  const renderObjects = Object.freeze([...batches, heroCores]);
  root.add(...renderObjects);
  let disposed = false;

  return Object.freeze({
    root,
    catalog,
    interactive: EMPTY_INTERACTIVE,
    setPresence: (value) => {
      if (disposed) return;
      const presence = clampPresence(value);
      root.visible = presence > 0.01;
      renderObjects.forEach(({ material }) => {
        material.uniforms.uPresence.value = presence;
      });
    },
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
    }
  });
};
