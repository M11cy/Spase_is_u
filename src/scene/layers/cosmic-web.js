import { enableDeepSpaceBloom } from "../deep-space-postprocessing.js";
import {
  clampPresence,
  createSeededRandom,
  disposeObjectTree,
  resolveParallax
} from "./deep-space-utils.js";

const VOLUME = Object.freeze({ width: 1320, height: 760, depth: 190, centerZ: -235 });
const PALETTE = Object.freeze([0x8b5cf6, 0xd946ef, 0xf472b6, 0xfbbf24]);
const NODE_BUDGET = Object.freeze({ high: 120, medium: 92, economy: 68 });
const FILAMENT_OPACITY = Object.freeze({ high: 0.58, medium: 0.52, economy: 0.48 });
const HOT_NODE_RATIO = 0.1;
const DEPTH_LAYERS = 3;
const DEPTH_CENTERS = Object.freeze([-330, -235, -140]);
const CLUSTER_ANCHORS = Object.freeze([
  Object.freeze([-0.42, -0.3]), Object.freeze([-0.2, -0.12]),
  Object.freeze([0.04, -0.34]), Object.freeze([0.31, -0.18]),
  Object.freeze([0.43, 0.1]), Object.freeze([0.19, 0.32]),
  Object.freeze([-0.06, 0.16]), Object.freeze([-0.34, 0.28]),
  Object.freeze([-0.46, 0.03]), Object.freeze([-0.13, -0.4]),
  Object.freeze([0.12, -0.04]), Object.freeze([0.4, 0.37])
]);
const NODE_POINTS_PER_TIER = Object.freeze({ high: 18, medium: 12, economy: 8 });
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

const gaussian = (random) => {
  const first = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(Math.PI * 2 * random());
};

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const buildGraph = (seed, nodeBudget) => {
  const random = createSeededRandom(seed);
  const centers = CLUSTER_ANCHORS.map(([anchorX, anchorY], clusterIndex) => Object.freeze([
    anchorX * VOLUME.width + gaussian(random) * 18,
    anchorY * VOLUME.height + gaussian(random) * 14,
    DEPTH_CENTERS[clusterIndex % DEPTH_LAYERS]
  ]));
  const nodes = Array.from({ length: nodeBudget }, (_, nodeIndex) => {
    const center = centers[nodeIndex % centers.length];
    return Object.freeze([
      clamp(center[0] + gaussian(random) * 40, -VOLUME.width / 2, VOLUME.width / 2),
      clamp(center[1] + gaussian(random) * 30, -VOLUME.height / 2, VOLUME.height / 2),
      clamp(
        center[2] + gaussian(random) * 7,
        VOLUME.centerZ - VOLUME.depth / 2,
        VOLUME.centerZ + VOLUME.depth / 2
      )
    ]);
  });
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

const createFilaments = (THREE, graph, tier) => {
  const positions = [];
  const colors = [];
  const violet = new THREE.Color(PALETTE[0]);
  const magenta = new THREE.Color(PALETTE[1]);
  graph.edges.forEach(([from, to], edgeIndex) => {
    positions.push(...graph.nodes[from], ...graph.nodes[to]);
    const color = edgeIndex % 5 === 0 ? magenta : violet;
    pushColor(colors, color, 1);
    pushColor(colors, color, 1);
  });
  const material = new THREE.LineBasicMaterial({
    transparent: true,
    opacity: FILAMENT_OPACITY[tier],
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

const createParticles = (THREE, graph, glowTexture, count, seed) => {
  const random = createSeededRandom(forkSeed(seed, 0x5f356495));
  const positions = [];
  const colors = [];
  const violet = new THREE.Color(PALETTE[0]);
  const magenta = new THREE.Color(PALETTE[1]);
  for (let index = 0; index < count; index += 1) {
    const [from, to] = graph.edges[index % graph.edges.length];
    const start = graph.nodes[from];
    const end = graph.nodes[to];
    const towardNode = random() < 0.62;
    const edgeProgress = random();
    const progress = towardNode
      ? (random() < 0.5 ? edgeProgress ** 2.8 : 1 - edgeProgress ** 2.8)
      : edgeProgress;
    const spread = 1.7 + random() * (towardNode ? 2.5 : 4.2);
    positions.push(
      start[0] + (end[0] - start[0]) * progress + gaussian(random) * spread,
      start[1] + (end[1] - start[1]) * progress + gaussian(random) * spread,
      start[2] + (end[2] - start[2]) * progress + gaussian(random) * spread * 0.65
    );
    const color = index % 7 === 0 ? magenta : violet;
    pushColor(colors, color, index % 13 === 0 ? 1 : 0.56 + random() * 0.4);
  }
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: 3.35,
    transparent: true,
    opacity: 0.82,
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

const createNodes = (THREE, graph, glowTexture, quality, seed) => {
  const random = createSeededRandom(forkSeed(seed, 0x1bf5a9d3));
  const pointsPerNode = NODE_POINTS_PER_TIER[quality.tier];
  const positions = [];
  const colors = [];
  const magenta = new THREE.Color(PALETTE[1]);
  const pink = new THREE.Color(PALETTE[2]);
  graph.nodes.forEach((node) => {
    for (let pointIndex = 0; pointIndex < pointsPerNode; pointIndex += 1) {
      const spread = pointIndex === 0 ? 0 : 3.2 + random() * 4.8;
      const offsetX = Math.max(-2.5, Math.min(2.5, gaussian(random))) * spread;
      const offsetY = Math.max(-2.5, Math.min(2.5, gaussian(random))) * spread;
      const offsetZ = Math.max(-2.5, Math.min(2.5, gaussian(random))) * spread * 0.62;
      positions.push(node[0] + offsetX, node[1] + offsetY, node[2] + offsetZ);
      const color = pointIndex === 0 ? pink : magenta;
      pushColor(colors, color, pointIndex < 2 ? 1 : 0.5 + random() * 0.46);
    }
  });
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: 4.8,
    transparent: true,
    opacity: 0.78,
    alphaTest: 0.01,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });
  const nodes = new THREE.Points(createGeometry(THREE, positions, colors), material);
  nodes.name = "cosmic-web-nodes";
  nodes.renderOrder = 6;
  nodes.userData.cluster = Object.freeze({ pointsPerNode, seed });
  return enableDeepSpaceBloom(nodes);
};

const selectHotNodeIndices = (graph, hotNodeCount) => {
  const degree = graph.nodes.map(() => 0);
  graph.edges.forEach(([from, to]) => {
    degree[from] += 1;
    degree[to] += 1;
  });
  return Object.freeze(degree
    .map((connections, nodeIndex) => Object.freeze({ connections, nodeIndex }))
    .sort((left, right) => right.connections - left.connections || left.nodeIndex - right.nodeIndex)
    .slice(0, hotNodeCount)
    .map(({ nodeIndex }) => nodeIndex)
    .sort((left, right) => left - right));
};

const createHotNodes = (THREE, graph, glowTexture, hotNodeCount) => {
  const indices = selectHotNodeIndices(graph, hotNodeCount);
  const positions = indices.flatMap((nodeIndex) => graph.nodes[nodeIndex]);
  const gold = new THREE.Color(PALETTE[3]);
  const colors = indices.flatMap(() => [gold.r, gold.g, gold.b]);
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: 8.4,
    transparent: true,
    opacity: 0.94,
    alphaTest: 0.01,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  });
  const hotNodes = new THREE.Points(createGeometry(THREE, positions, colors), material);
  hotNodes.name = "cosmic-web-hot-nodes";
  hotNodes.renderOrder = 7;
  hotNodes.userData.hotNodes = Object.freeze({ indices, paletteIndex: 3 });
  return enableDeepSpaceBloom(hotNodes);
};

const createDepthField = (THREE, graph, glowTexture, pointBudget, seed) => {
  const random = createSeededRandom(forkSeed(seed, 0x3c6ef372));
  const count = Math.max(240, Math.round(pointBudget * 0.12));
  const positions = [];
  const colors = [];
  const violet = new THREE.Color(PALETTE[0]);
  const pink = new THREE.Color(PALETTE[2]);
  for (let index = 0; index < count; index += 1) {
    const node = graph.nodes[index % graph.nodes.length];
    positions.push(
      node[0] + gaussian(random) * 46,
      node[1] + gaussian(random) * 38,
      node[2] + gaussian(random) * 18
    );
    const color = index % 9 === 0 ? pink : violet;
    pushColor(colors, color, 0.26 + random() * 0.34);
  }
  const material = new THREE.PointsMaterial({
    map: glowTexture,
    size: 2.25,
    transparent: true,
    opacity: 0.32,
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

  const nodeBudget = NODE_BUDGET[quality.tier];
  const hotNodeCount = Math.round(nodeBudget * HOT_NODE_RATIO);
  const graph = buildGraph(seed, nodeBudget);
  const root = new THREE.Group();
  root.name = "cosmic-web-layer";
  root.visible = false;
  root.userData.structure = Object.freeze({
    volume: VOLUME,
    nodeCount: graph.nodes.length,
    palette: PALETTE,
    nodeBudget,
    hotNodeCount,
    depthLayers: DEPTH_LAYERS,
    seed,
    connection: "nearest-neighbour-spanning"
  });
  const filaments = createFilaments(THREE, graph, quality.tier);
  const particles = createParticles(THREE, graph, glowTexture, quality.cosmicWebPoints, seed);
  const nodes = createNodes(THREE, graph, glowTexture, quality, seed);
  const hotNodes = createHotNodes(THREE, graph, glowTexture, hotNodeCount);
  const depth = createDepthField(THREE, graph, glowTexture, quality.cosmicWebPoints, seed);
  const fadedObjects = Object.freeze([depth, filaments, particles, nodes, hotNodes]);
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
