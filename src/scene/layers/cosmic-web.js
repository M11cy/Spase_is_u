import {
  clampPresence,
  createSeededRandom,
  disposeObjectTree,
  resolveParallax
} from "./deep-space-utils.js";

const NODE_COUNT = 74;
const VOLUME = Object.freeze({ width: 1320, height: 760, depth: 190, centerZ: -235 });
const PALETTE = Object.freeze([0xffd477, 0xe278c8, 0xb397ff, 0x9dc7ff]);
const REQUIRED_THREE_CONSTRUCTORS = Object.freeze([
  "Group",
  "BufferGeometry",
  "Float32BufferAttribute",
  "Points",
  "PointsMaterial",
  "LineSegments",
  "LineBasicMaterial",
  "Color"
]);

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

const requireLayerInput = ({ THREE, quality, reducedMotion, seed }) => {
  if (!THREE || REQUIRED_THREE_CONSTRUCTORS.some((name) => typeof THREE[name] !== "function")) {
    throw new TypeError("Cosmic web layer requires a compatible THREE namespace");
  }
  if (!quality || typeof quality !== "object"
    || !["high", "medium", "economy"].includes(quality.tier)
    || !isPositiveInteger(quality.cosmicWebPoints)) {
    throw new TypeError("Cosmic web quality requires a supported tier and positive point budget");
  }
  if (typeof reducedMotion !== "boolean") {
    throw new TypeError("Cosmic web layer requires a reduced-motion preference");
  }
  if (!Number.isSafeInteger(seed)) {
    throw new TypeError("Cosmic web seed must be a safe integer");
  }
};

const squaredDistance = (left, right) => (
  (left[0] - right[0]) ** 2
  + (left[1] - right[1]) ** 2
  + (left[2] - right[2]) ** 2
);

const edgeKey = (left, right) => (
  left < right ? `${left}:${right}` : `${right}:${left}`
);

const forkSeed = (seed, salt) => (seed >>> 0) ^ salt;

const buildGraph = (seed) => {
  const random = createSeededRandom(seed);
  const nodes = Array.from({ length: NODE_COUNT }, () => Object.freeze([
    (random() - 0.5) * VOLUME.width,
    (random() - 0.5) * VOLUME.height,
    VOLUME.centerZ + (random() - 0.5) * VOLUME.depth
  ]));
  const edgeKeys = new Set();

  for (let nodeIndex = 1; nodeIndex < nodes.length; nodeIndex += 1) {
    let nearestIndex = 0;
    let nearestDistance = squaredDistance(nodes[nodeIndex], nodes[0]);
    for (let candidateIndex = 1; candidateIndex < nodeIndex; candidateIndex += 1) {
      const distance = squaredDistance(nodes[nodeIndex], nodes[candidateIndex]);
      if (distance < nearestDistance) {
        nearestIndex = candidateIndex;
        nearestDistance = distance;
      }
    }
    edgeKeys.add(edgeKey(nodeIndex, nearestIndex));
  }

  nodes.forEach((node, nodeIndex) => {
    const nearest = nodes
      .map((candidate, candidateIndex) => Object.freeze({
        candidateIndex,
        distance: squaredDistance(node, candidate)
      }))
      .filter(({ candidateIndex }) => candidateIndex !== nodeIndex)
      .sort((left, right) => left.distance - right.distance || left.candidateIndex - right.candidateIndex)
      .slice(0, 2);
    nearest.forEach(({ candidateIndex }) => edgeKeys.add(edgeKey(nodeIndex, candidateIndex)));
  });

  const edges = [...edgeKeys]
    .map((key) => Object.freeze(key.split(":").map(Number)))
    .sort(([leftA, leftB], [rightA, rightB]) => leftA - rightA || leftB - rightB);
  return Object.freeze({
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges)
  });
};

const pushColor = (target, color, intensity) => {
  target.push(color.r * intensity, color.g * intensity, color.b * intensity);
};

const createGeometry = (THREE, positions, colors) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
};

const createFilaments = (THREE, graph) => {
  const positions = [];
  const colors = [];
  graph.edges.forEach(([from, to], edgeIndex) => {
    positions.push(...graph.nodes[from], ...graph.nodes[to]);
    const color = new THREE.Color(PALETTE[edgeIndex % PALETTE.length]);
    pushColor(colors, color, 0.72);
    pushColor(colors, color, 0.72);
  });
  const material = new THREE.LineBasicMaterial({
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });
  const filaments = new THREE.LineSegments(createGeometry(THREE, positions, colors), material);
  filaments.name = "cosmic-web-filaments";
  filaments.renderOrder = 3;
  return filaments;
};

const gaussian = (random) => {
  const first = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(Math.PI * 2 * random());
};

const createParticles = (THREE, graph, glowTexture, count, seed) => {
  const random = createSeededRandom(forkSeed(seed, 0x5f356495));
  const positions = [];
  const colors = [];
  for (let index = 0; index < count; index += 1) {
    const [from, to] = graph.edges[index % graph.edges.length];
    const start = graph.nodes[from];
    const end = graph.nodes[to];
    const progress = random();
    const spread = 2.1 + random() * 2.7;
    positions.push(
      start[0] + (end[0] - start[0]) * progress + gaussian(random) * spread,
      start[1] + (end[1] - start[1]) * progress + gaussian(random) * spread,
      start[2] + (end[2] - start[2]) * progress + gaussian(random) * spread * 0.65
    );
    const color = new THREE.Color(PALETTE[index % PALETTE.length]);
    pushColor(colors, color, 0.42 + random() * 0.48);
  }
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: 3.05,
    transparent: true,
    opacity: 0.74,
    alphaTest: 0.01,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });
  const particles = new THREE.Points(createGeometry(THREE, positions, colors), material);
  particles.name = "cosmic-web-particles";
  particles.renderOrder = 5;
  return particles;
};

const createNodes = (THREE, graph, glowTexture) => {
  const positions = graph.nodes.flatMap((node) => node);
  const colors = [];
  graph.nodes.forEach((node, index) => {
    const color = new THREE.Color(PALETTE[index % PALETTE.length]);
    pushColor(colors, color, 0.88 + (index % 3) * 0.06);
  });
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: 8.4,
    transparent: true,
    opacity: 0.9,
    alphaTest: 0.01,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });
  const nodes = new THREE.Points(createGeometry(THREE, positions, colors), material);
  nodes.name = "cosmic-web-nodes";
  nodes.renderOrder = 6;
  return nodes;
};

const createDepthField = (THREE, glowTexture, pointBudget, seed) => {
  const random = createSeededRandom(forkSeed(seed, 0x3c6ef372));
  const count = Math.max(240, Math.round(pointBudget * 0.12));
  const positions = [];
  const colors = [];
  for (let index = 0; index < count; index += 1) {
    positions.push(
      (random() - 0.5) * VOLUME.width * 1.65,
      (random() - 0.5) * VOLUME.height * 1.35,
      VOLUME.centerZ - VOLUME.depth * 0.55 - random() * 260
    );
    const color = new THREE.Color(index % 5 === 0 ? 0xffd98a : 0xc8b8e8);
    pushColor(colors, color, 0.22 + random() * 0.32);
  }
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: 2.25,
    transparent: true,
    opacity: 0.24,
    alphaTest: 0.01,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });
  const depth = new THREE.Points(createGeometry(THREE, positions, colors), material);
  depth.name = "cosmic-web-depth";
  depth.renderOrder = 1;
  return depth;
};

export const createCosmicWebLayer = (input) => {
  const {
    THREE,
    quality,
    glowTexture = null,
    reducedMotion,
    seed
  } = input ?? {};
  requireLayerInput({ THREE, quality, reducedMotion, seed });

  const graph = buildGraph(seed);
  const root = new THREE.Group();
  root.name = "cosmic-web-layer";
  root.visible = false;
  root.userData.structure = Object.freeze({
    volume: VOLUME,
    nodeCount: graph.nodes.length,
    seed,
    connection: "nearest-neighbour-spanning"
  });
  const filaments = createFilaments(THREE, graph);
  const particles = createParticles(THREE, graph, glowTexture, quality.cosmicWebPoints, seed);
  const nodes = createNodes(THREE, graph, glowTexture);
  const depth = createDepthField(THREE, glowTexture, quality.cosmicWebPoints, seed);
  const fadedObjects = Object.freeze([depth, filaments, particles, nodes]);
  fadedObjects.forEach((object) => {
    object.userData.baseOpacity = object.material.opacity;
  });
  root.add(...fadedObjects);
  let disposed = false;

  const setPresence = (value) => {
    if (disposed) return;
    const presence = clampPresence(value);
    root.visible = presence > 0.01;
    fadedObjects.forEach((object) => {
      object.material.opacity = object.userData.baseOpacity * presence;
    });
  };

  return Object.freeze({
    root,
    interactive: Object.freeze([]),
    graph,
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
    }
  });
};
