import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createQualityProfile } from "../../core/quality-profile.js";
import { ANNOTATIONS, STAGES } from "../../data/cosmos.js";
import { BLOOM_SCENE_LAYER } from "../deep-space-postprocessing.js";
import { createCosmicTissue } from "./cosmic-tissue.js";
import { createCosmicWebLayer } from "./cosmic-web.js";
import { createLocalGroupLayer } from "./local-group.js";
import { createMilkyWayLayer } from "./milky-way.js";

const createLayer = (overrides = {}) => createMilkyWayLayer({
  THREE,
  texture: new THREE.Texture(),
  annotations: ANNOTATIONS.galaxy,
  quality: { tier: "high", galaxyPoints: 900 },
  createMarker: () => new THREE.Sprite(new THREE.SpriteMaterial({ opacity: 0.76 })),
  reducedMotion: false,
  ...overrides
});

const createSettledStageCamera = (stageId, aspect = 16 / 9) => {
  const stage = STAGES.find(({ id }) => id === stageId);
  const camera = new THREE.PerspectiveCamera(stage.camera.fov, aspect, 0.1, 2000);
  camera.position.fromArray(stage.camera.position);
  camera.lookAt(new THREE.Vector3(...stage.camera.target));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
};

const projectedGridCell = ({ point, camera, columns = 12, rows = 8 }) => {
  const projected = new THREE.Vector3(...point).project(camera);
  const normalizedX = (projected.x + 0.84) / 1.56;
  const normalizedY = (0.84 - projected.y) / 1.48;
  if (normalizedX < 0 || normalizedX >= 1 || normalizedY < 0 || normalizedY >= 1) return null;
  return Math.floor(normalizedY * rows) * columns + Math.floor(normalizedX * columns);
};

const measureProjectedGraphCoverage = ({ graph, camera, columns = 12, rows = 8 }) => {
  const edgesByCell = Array.from({ length: columns * rows }, () => new Set());
  graph.edges.forEach(([from, to], edgeIndex) => {
    const start = graph.nodes[from];
    const end = graph.nodes[to];
    for (let sample = 0; sample <= 24; sample += 1) {
      const progress = sample / 24;
      const cell = projectedGridCell({
        point: start.map((value, axis) => value + (end[axis] - value) * progress),
        camera,
        columns,
        rows
      });
      if (cell != null) edgesByCell[cell].add(edgeIndex);
    }
  });
  return edgesByCell.filter((edges) => edges.size >= 2).length / edgesByCell.length;
};

const MILKY_WAY_MARKER_POSITIONS = Object.freeze({
  "galactic-center": Object.freeze([0, 0, 1]),
  "orion-arm": Object.freeze([54.6, -8.775, 1]),
  "perseus-arm": Object.freeze([-89.7, 10.96875, 1]),
  "galactic-halo": Object.freeze([11.7, 70.2, 1])
});

const expectFrozenLayerContract = (layer) => {
  expect(Object.keys(layer)).toEqual([
    "root",
    "interactive",
    "setPresence",
    "updateParallax",
    "dispose"
  ]);
  expect(Object.isFrozen(layer)).toBe(true);
  expect(Object.isFrozen(layer.interactive)).toBe(true);
};

describe("createMilkyWayLayer", () => {
  it("renders one texture-backed plane and removes every procedural galaxy object", () => {
    const texture = new THREE.Texture();
    const layer = createLayer({ texture });
    const photo = layer.root.getObjectByName("milky-way-photo");

    expectFrozenLayerContract(layer);
    expect(photo.material.map).toBe(texture);
    expect(photo.geometry.parameters).toMatchObject({ width: 390, height: 219.375 });
    expect(photo.material).toMatchObject({
      opacity: 1,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      blending: THREE.NormalBlending
    });
    expect(photo.renderOrder).toBe(2);
    expect(layer.root.position.z).toBe(-80);
    expect(layer.root.getObjectByName("milky-way-stars")).toBeUndefined();
    expect(layer.root.getObjectByName("milky-way-core")).toBeUndefined();
    expect(layer.root.getObjectByName("milky-way-halo")).toBeUndefined();
    expect(layer.root.children.filter(({ isMesh }) => isMesh)).toHaveLength(1);

    layer.dispose();
  });

  it("preserves the four annotation records and remaps their markers to photo features", () => {
    const layer = createLayer();

    expect(layer.interactive.map(({ userData }) => userData.annotation.id)).toEqual([
      "galactic-center",
      "orion-arm",
      "perseus-arm",
      "galactic-halo"
    ]);
    expect(layer.interactive).toHaveLength(ANNOTATIONS.galaxy.length);
    layer.interactive.forEach((marker, index) => {
      const source = ANNOTATIONS.galaxy[index];
      const annotation = marker.userData.annotation;

      expect(annotation).toMatchObject(source);
      expect(annotation.object3D).toBe(marker);
      expect(Object.isFrozen(annotation)).toBe(true);
      expect(marker.position.toArray()).toEqual(MILKY_WAY_MARKER_POSITIONS[source.id]);
      expect(marker.userData.stage).toBe(source.stage);
      expect(marker.userData.baseOpacity).toBe(0.76);
    });

    layer.dispose();
  });

  it("fades the photograph and markers and applies the 0.18 parallax factor", () => {
    const layer = createLayer();
    const photo = layer.root.getObjectByName("milky-way-photo");

    layer.setPresence(0.5);
    expect(layer.root.visible).toBe(true);
    expect(photo.material.opacity).toBe(0.5);
    expect(layer.interactive.every(({ material }) => material.opacity === 0.38)).toBe(true);
    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0.288, y: -0.198 });
    expect(layer.root.position.z).toBe(-80);

    layer.setPresence(Number.NaN);
    expect(layer.root.visible).toBe(false);
    expect(photo.material.opacity).toBe(0);
    expect(layer.updateParallax({ x: 1, y: "-1" })).toEqual({ x: 0, y: 0 });

    layer.dispose();
  });

  it.each([
    [{ tier: "high" }, false, { x: 0.288, y: -0.198 }],
    [{ tier: "medium" }, false, { x: 0.1584, y: -0.1089 }],
    [{ tier: "economy" }, false, { x: 0, y: 0 }],
    [{ tier: "high" }, true, { x: 0, y: 0 }]
  ])("resolves quality and reduced-motion parallax for %j", (quality, reducedMotion, expected) => {
    const layer = createLayer({ quality, reducedMotion });

    const actual = layer.updateParallax({ x: 1, y: -1 });
    expect(actual.x).toBeCloseTo(expected.x, 8);
    expect(actual.y).toBeCloseTo(expected.y, 8);

    layer.dispose();
  });

  it.each([
    { THREE: null },
    { texture: null },
    { texture: {} },
    { annotations: null },
    { quality: null },
    { quality: { tier: "ultra" } },
    { createMarker: null },
    { reducedMotion: null }
  ])("rejects invalid photographic boundary input %j", (overrides) => {
    expect(() => createLayer(overrides)).toThrow(TypeError);
  });

  it("skips malformed annotations and marker results without mutating supplied records", () => {
    const valid = Object.freeze({ id: "valid", stage: 3, position: [1, 2, -80] });
    const annotations = Object.freeze([null, { position: [0, 0] }, valid]);
    const layer = createLayer({
      annotations,
      createMarker: ({ id } = {}) => id === "valid"
        ? new THREE.Object3D()
        : null
    });

    expect(layer.interactive).toHaveLength(1);
    expect(layer.interactive[0].userData.annotation).toMatchObject(valid);
    expect(layer.interactive[0].userData.baseOpacity).toBe(1);
    expect(annotations).toEqual([null, { position: [0, 0] }, valid]);

    layer.dispose();
  });

  it("disposes owned photo and marker materials once without disposing the texture", () => {
    const texture = new THREE.Texture();
    const layer = createLayer({ texture });
    const photo = layer.root.getObjectByName("milky-way-photo");
    const geometryDispose = vi.spyOn(photo.geometry, "dispose");
    const materialDispose = vi.spyOn(photo.material, "dispose");
    const markerDisposes = layer.interactive.map(({ material }) => vi.spyOn(material, "dispose"));
    const textureDispose = vi.spyOn(texture, "dispose");

    layer.dispose();
    layer.setPresence(0.9);
    layer.dispose();

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    markerDisposes.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(textureDispose).not.toHaveBeenCalled();
    expect(layer.root.children).toHaveLength(0);
  });
});

const createLocalGroup = (overrides = {}) => createLocalGroupLayer({
  THREE,
  texture: new THREE.Texture(),
  annotations: ANNOTATIONS.localGroup,
  createMarker: () => new THREE.Sprite(new THREE.SpriteMaterial({ opacity: 0.68 })),
  quality: { tier: "high" },
  reducedMotion: false,
  ...overrides
});

describe("createLocalGroupLayer", () => {
  it("renders one texture-backed Local Group plane with six interactive markers", () => {
    const texture = new THREE.Texture();
    const layer = createLocalGroup({ texture });
    const photo = layer.root.getObjectByName("local-group-photo");

    expectFrozenLayerContract(layer);
    expect(photo.material.map).toBe(texture);
    expect(photo.geometry.parameters).toMatchObject({ width: 780, height: 438.75 });
    expect(photo.material).toMatchObject({
      opacity: 1,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      blending: THREE.NormalBlending
    });
    expect(photo.renderOrder).toBe(2);
    expect(layer.root.position.z).toBe(-138);
    expect(layer.interactive).toHaveLength(6);
    expect(layer.interactive.map(({ userData }) => userData.annotation.id)).toEqual([
      "group-milky-way",
      "group-andromeda",
      "group-triangulum",
      "group-lmc",
      "group-smc",
      "group-m32"
    ]);
    expect(layer.root.getObjectByName("local-group-galaxy-field")).toBeUndefined();
    expect(layer.root.getObjectByName("local-group-spiral-batch")).toBeUndefined();
    expect(layer.root.getObjectByName("local-group-hero-cores")).toBeUndefined();
    expect(layer.root.children.filter(({ isMesh }) => isMesh)).toHaveLength(1);

    layer.dispose();
  });

  it("uses source positions as normalized photo anchors and preserves all metadata", () => {
    const layer = createLocalGroup();

    layer.interactive.forEach((marker, index) => {
      const source = ANNOTATIONS.localGroup[index];
      const annotation = marker.userData.annotation;

      expect(marker.position.toArray()).toEqual([
        source.position[0],
        source.position[1],
        source.position[2] + 138
      ]);
      expect(annotation).toMatchObject(source);
      expect(annotation.object3D).toBe(marker);
      expect(Object.isFrozen(annotation)).toBe(true);
      expect(marker.userData.stage).toBe(source.stage);
      expect(marker.userData.baseOpacity).toBe(0.68);
    });

    layer.dispose();
  });

  it("fades photo and markers and applies the 0.12 parallax factor", () => {
    const layer = createLocalGroup();
    const photo = layer.root.getObjectByName("local-group-photo");

    layer.setPresence(0.5);
    expect(layer.root.visible).toBe(true);
    expect(photo.material.opacity).toBe(0.5);
    expect(layer.interactive.every(({ material }) => material.opacity === 0.34)).toBe(true);
    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0.192, y: -0.132 });
    expect(layer.root.position.z).toBe(-138);

    layer.setPresence("visible");
    expect(layer.root.visible).toBe(false);
    expect(layer.updateParallax(null)).toEqual({ x: 0, y: 0 });

    layer.dispose();
  });

  it.each([
    [{ tier: "high" }, false, { x: 0.192, y: -0.132 }],
    [{ tier: "medium" }, false, { x: 0.1056, y: -0.0726 }],
    [{ tier: "economy" }, false, { x: 0, y: 0 }],
    [{ tier: "high" }, true, { x: 0, y: 0 }]
  ])("resolves quality and reduced-motion parallax for %j", (quality, reducedMotion, expected) => {
    const layer = createLocalGroup({ quality, reducedMotion });

    const actual = layer.updateParallax({ x: 1, y: -1 });
    expect(actual.x).toBeCloseTo(expected.x, 8);
    expect(actual.y).toBeCloseTo(expected.y, 8);

    layer.dispose();
  });

  it.each([
    { THREE: null },
    { texture: null },
    { texture: {} },
    { annotations: null },
    { quality: null },
    { quality: { tier: "ultra" } },
    { createMarker: null },
    { reducedMotion: null }
  ])("rejects invalid photographic boundary input %j", (overrides) => {
    expect(() => createLocalGroup(overrides)).toThrow(TypeError);
  });

  it("skips malformed Local Group records and marker results", () => {
    const retained = Object.freeze({ id: "retained", stage: 4, position: [7, -9, -136] });
    const annotations = Object.freeze([
      null,
      { id: "short-position", position: [0, 0] },
      { id: "invalid-marker", position: [1, 2, -138] },
      retained
    ]);
    const marker = new THREE.Object3D();
    const layer = createLocalGroup({
      annotations,
      createMarker: ({ id }) => id === "retained" ? marker : null
    });

    expect(layer.interactive).toEqual([marker]);
    expect(marker.position.toArray()).toEqual([7, -9, 2]);
    expect(marker.userData.annotation).toMatchObject(retained);
    expect(marker.userData.baseOpacity).toBe(1);

    layer.dispose();
  });

  it("disposes owned photo and marker resources once without disposing the texture", () => {
    const texture = new THREE.Texture();
    const layer = createLocalGroup({ texture });
    const photo = layer.root.getObjectByName("local-group-photo");
    const geometryDispose = vi.spyOn(photo.geometry, "dispose");
    const materialDispose = vi.spyOn(photo.material, "dispose");
    const markerDisposes = layer.interactive.map(({ material }) => vi.spyOn(material, "dispose"));
    const textureDispose = vi.spyOn(texture, "dispose");

    layer.dispose();
    layer.dispose();

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    markerDisposes.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(textureDispose).not.toHaveBeenCalled();
    expect(layer.root.children).toHaveLength(0);
  });
});

describe("photographic galaxy main integration", () => {
  it("maps both annotation groups, passes photo textures, and includes both marker collections in labels", () => {
    const mainSource = readFileSync(new URL("../../main.js", import.meta.url), "utf8");
    const milkyWaySetup = mainSource.match(
      /const milkyWayLayer = createMilkyWayLayer\(\{([\s\S]*?)\n\}\);/
    )?.[1] ?? "";
    const localGroupSetup = mainSource.match(
      /const localGroupLayer = createLocalGroupLayer\(\{([\s\S]*?)\n\}\);/
    )?.[1] ?? "";

    expect(mainSource).toContain(
      "const { galaxy: rawGalaxyAnnotationSources, localGroup: rawLocalGroupAnnotationSources } = ANNOTATIONS;"
    );
    expect(mainSource).toContain(
      "const localGroupAnnotationSources = rawLocalGroupAnnotationSources.map(withBaseAsset);"
    );
    expect(milkyWaySetup).toMatch(/texture:\s*milkyWayPhotoTexture/);
    expect(milkyWaySetup).toContain("annotations: galaxyAnnotationSources");
    expect(milkyWaySetup).toContain("createMarker: createGalaxyMarker");
    expect(localGroupSetup).toMatch(/texture:\s*localGroupPhotoTexture/);
    expect(localGroupSetup).toContain("annotations: localGroupAnnotationSources");
    expect(localGroupSetup).toContain("createMarker: createGalaxyMarker");
    expect(mainSource).toContain(
      "const localGroupAnnotations = Object.freeze(localGroupLayer.interactive.map"
    );
    expect(mainSource).toMatch(/\.\.\.galaxyAnnotations,[\s\S]*\.\.\.localGroupAnnotations,/);
  });
});

const createCosmicWeb = (overrides = {}) => createCosmicWebLayer({
  THREE,
  quality: { tier: "economy", cosmicWebPoints: 5200 },
  glowTexture: null,
  reducedMotion: false,
  seed: 20260719,
  ...overrides
});

const createTissue = (overrides = {}) => createCosmicTissue({
  THREE,
  tier: "high",
  seed: 20260719,
  volume: { width: 920, height: 620, depth: 240 },
  ...overrides
});

describe("createCosmicTissue", () => {
  it.each([
    "Group",
    "PlaneGeometry",
    "Mesh",
    "ShaderMaterial",
    "Color",
    "Vector2"
  ])("rejects a THREE namespace without a usable %s constructor", (constructorName) => {
    const incompatibleThree = { ...THREE, [constructorName]: undefined };

    expect(() => createTissue({ THREE: incompatibleThree }))
      .toThrow("Cosmic tissue requires a compatible THREE namespace");
  });

  it("rejects a missing input contract and unsupported tiers", () => {
    expect(() => createCosmicTissue())
      .toThrow("Cosmic tissue requires a compatible THREE namespace");
    expect(() => createTissue({ tier: "ultra" }))
      .toThrow("Cosmic tissue requires a supported tier");
    expect(() => createTissue({ tier: undefined }))
      .toThrow("Cosmic tissue requires a supported tier");
  });

  it.each([
    undefined,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.MIN_SAFE_INTEGER - 1
  ])("rejects unsafe tissue seed %s", (seed) => {
    expect(() => createTissue({ seed }))
      .toThrow("Cosmic tissue seed must be a safe integer");
  });

  it.each([
    undefined,
    null,
    "920x620x240",
    {},
    { width: 920, height: 620 },
    { width: 0, height: 620, depth: 240 },
    { width: 920, height: -1, depth: 240 },
    { width: 920, height: 620, depth: Number.NaN },
    { width: Number.POSITIVE_INFINITY, height: 620, depth: 240 }
  ])("rejects invalid tissue volume %j", (volume) => {
    expect(() => createTissue({ volume }))
      .toThrow("Cosmic tissue volume dimensions must be positive finite numbers");
  });

  it("clamps presence and normalizes missing or non-finite parallax axes", () => {
    const tissue = createTissue();
    const profileParallax = [0.22, 0.46, 0.74];
    const positions = () => tissue.meshes.map(({ position }) => [position.x, position.y]);
    const presences = () => tissue.meshes.map(({ material }) => (
      material.uniforms.uPresence.value
    ));

    expect(tissue.metadata.profiles.map(({ parallax }) => parallax)).toEqual(profileParallax);
    tissue.setPresence(1.5);
    expect(presences()).toEqual([1, 1, 1]);
    tissue.setPresence(-0.5);
    expect(presences()).toEqual([0, 0, 0]);
    tissue.setPresence(Number.NaN);
    expect(presences()).toEqual([0, 0, 0]);

    tissue.setParallax({ x: 4, y: -3 });
    expect(positions()).toEqual(profileParallax.map((parallax) => [
      4 * parallax,
      -3 * parallax
    ]));
    tissue.setParallax();
    expect(positions()).toEqual(profileParallax.map(() => [0, 0]));
    tissue.setParallax(null);
    expect(positions()).toEqual(profileParallax.map(() => [0, 0]));
    tissue.setParallax({ x: Number.NaN, y: Number.POSITIVE_INFINITY });
    expect(positions()).toEqual(profileParallax.map(() => [0, 0]));

    tissue.dispose();
  });

  it("disposes its shared resources once and ignores lifecycle updates afterward", () => {
    const tissue = createTissue();
    const geometryDispose = vi.spyOn(tissue.meshes[0].geometry, "dispose");
    const materialDisposes = tissue.meshes.map(({ material }) => vi.spyOn(material, "dispose"));

    tissue.setPresence(0.42);
    tissue.setParallax({ x: 2, y: -2 });
    const presenceBeforeDispose = tissue.meshes.map(({ material }) => (
      material.uniforms.uPresence.value
    ));
    const positionsBeforeDispose = tissue.meshes.map(({ position }) => position.clone());

    tissue.dispose();
    tissue.setPresence(0.9);
    tissue.setParallax({ x: -8, y: 8 });
    tissue.dispose();

    expect(tissue.root.children).toHaveLength(0);
    expect(tissue.meshes.map(({ material }) => material.uniforms.uPresence.value))
      .toEqual(presenceBeforeDispose);
    expect(tissue.meshes.map(({ position }) => position))
      .toEqual(positionsBeforeDispose);
    expect(geometryDispose).toHaveBeenCalledOnce();
    materialDisposes.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
  });
});

const pointAt = (positions, index) => [
  positions.getX(index),
  positions.getY(index),
  positions.getZ(index)
];

const expectPointToBeCloseTo = (actual, expected) => {
  actual.forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 4));
};

const distanceToSegment = (point, start, end) => {
  const delta = end.map((value, axis) => value - start[axis]);
  const lengthSquared = delta.reduce((sum, value) => sum + value ** 2, 0);
  const progress = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (
    point.reduce((sum, value, axis) => sum + (value - start[axis]) * delta[axis], 0)
      / lengthSquared
  )));
  return Math.hypot(...point.map((value, axis) => (
    value - (start[axis] + delta[axis] * progress)
  )));
};

const distanceToPolyline = (point, positions, firstPoint, segmentCount) => (
  Math.min(...Array.from({ length: segmentCount }, (_, segmentIndex) => (
    distanceToSegment(
      point,
      pointAt(positions, firstPoint + segmentIndex * 2),
      pointAt(positions, firstPoint + segmentIndex * 2 + 1)
    )
  )))
);

describe("createCosmicWebLayer", () => {
  it.each([
    [{ width: 1920, height: 1080, dpr: 2, cores: 12, reducedMotion: false }, "high", 18000],
    [{ width: 1024, height: 768, dpr: 2, cores: 8, reducedMotion: false }, "medium", 9800],
    [{ width: 390, height: 844, dpr: 3, cores: 12, reducedMotion: false }, "economy", 5200]
  ])("publishes the %s Cosmic Web particle budget", (input, tier, cosmicWebPoints) => {
    expect(createQualityProfile(input)).toMatchObject({ tier, cosmicWebPoints });
  });

  it("uses a bright purple-magenta network with golden hot nodes", () => {
    const layer = createCosmicWeb({
      quality: { tier: "high", cosmicWebPoints: 18000 },
      seed: 20260719
    });
    const structure = layer.root.userData.structure;
    const filaments = layer.root.getObjectByName("cosmic-web-filaments");
    const hotNodes = layer.root.getObjectByName("cosmic-web-hot-nodes");

    expect(structure).toMatchObject({
      palette: [0x8b5cf6, 0xd946ef, 0xf472b6, 0xfbbf24],
      nodeBudget: 120,
      hotNodeCount: 12,
      depthLayers: 3
    });
    expect(Object.isFrozen(structure)).toBe(true);
    expect(Object.isFrozen(structure.palette)).toBe(true);
    expect(filaments.material.opacity).toBe(0.48);
    expect(hotNodes.geometry.getAttribute("position").count).toBe(12);

    const renderedColors = [];
    layer.root.traverse(({ geometry }) => {
      renderedColors.push(...Array.from(geometry?.getAttribute("color")?.array ?? []));
    });
    const paletteColors = structure.palette.map((hex) => new THREE.Color(hex));
    paletteColors.forEach((color) => {
      const found = Array.from({ length: renderedColors.length / 3 }, (_, index) => index * 3)
        .some((offset) => (
          Math.abs(renderedColors[offset] - color.r) < 0.0001
          && Math.abs(renderedColors[offset + 1] - color.g) < 0.0001
          && Math.abs(renderedColors[offset + 2] - color.b) < 0.0001
        ));
      expect(found).toBe(true);
    });

    layer.dispose();
  });

  it("keeps the volumetric network vivid in the base pass before bloom", () => {
    const layer = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 } });
    const filaments = layer.root.getObjectByName("cosmic-web-filaments");
    const particles = layer.root.getObjectByName("cosmic-web-particles");
    const nodes = layer.root.getObjectByName("cosmic-web-nodes");
    const hotNodes = layer.root.getObjectByName("cosmic-web-hot-nodes");
    const depth = layer.root.getObjectByName("cosmic-web-depth");

    expect([filaments, particles, nodes, hotNodes, depth].every(({ material }) => (
      material.toneMapped === false
    ))).toBe(true);
    expect(particles.material).toMatchObject({ size: 11.4, opacity: 0.98 });
    expect(nodes.material).toMatchObject({ size: 11.2, opacity: 0.96 });
    expect(hotNodes.material).toMatchObject({ size: 16, opacity: 1 });
    expect(depth.material).toMatchObject({ size: 5.2, opacity: 0.65 });
    expect(Math.max(...filaments.geometry.getAttribute("color").array)).toBeGreaterThan(1);

    layer.dispose();
  });

  it.each([
    ["high", 18000, 120, 12, 0.48],
    ["medium", 9800, 92, 9, 0.44],
    ["economy", 5200, 68, 7, 0.40]
  ])("uses the exact %s density and readable filament budget", (
    tier,
    cosmicWebPoints,
    nodeBudget,
    hotNodeCount,
    filamentOpacity
  ) => {
    const layer = createCosmicWeb({ quality: { tier, cosmicWebPoints } });
    const structure = layer.root.userData.structure;

    expect(layer.graph.nodes).toHaveLength(nodeBudget);
    expect(layer.root.getObjectByName("cosmic-web-particles").geometry
      .getAttribute("position").count).toBe(cosmicWebPoints);
    expect(structure).toMatchObject({ nodeBudget, hotNodeCount, depthLayers: 3 });
    expect(layer.root.getObjectByName("cosmic-web-filaments").material.opacity)
      .toBe(filamentOpacity);

    layer.dispose();
  });

  it("keeps three clustered depth layers instead of uniform flat noise", () => {
    const layer = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 } });
    const { volume } = layer.root.userData.structure;
    const depthBands = new Set(layer.graph.nodes.map(([, , z]) => (
      z < -280 ? "far" : z > -190 ? "near" : "middle"
    )));
    const occupiedCells = new Set(layer.graph.nodes.map(([x, y]) => (
      `${Math.floor((x + 660) / 110)}:${Math.floor((y + 380) / 95)}`
    )));
    const clusteredNodes = layer.graph.nodes.filter((node, nodeIndex, nodes) => (
      nodes.some((candidate, candidateIndex) => candidateIndex !== nodeIndex
        && Math.hypot(
          node[0] - candidate[0],
          node[1] - candidate[1],
          node[2] - candidate[2]
        ) < 105)
    ));

    expect(depthBands).toEqual(new Set(["far", "middle", "near"]));
    expect(layer.graph.nodes.every(([x, y, z]) => (
      Math.abs(x) <= volume.width / 2
      && Math.abs(y) <= volume.height / 2
      && z >= volume.centerZ - volume.depth / 2
      && z <= volume.centerZ + volume.depth / 2
    ))).toBe(true);
    expect(clusteredNodes.length).toBeGreaterThanOrEqual(Math.round(layer.graph.nodes.length * 0.9));
    expect(occupiedCells.size).toBeGreaterThanOrEqual(12);
    expect(occupiedCells.size).toBeLessThanOrEqual(70);

    layer.dispose();
  });

  it("weaves multiple independent strands continuously across the settled central field", () => {
    const layer = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 } });
    const camera = createSettledStageCamera("cosmic-web");
    const projectedCoverage = measureProjectedGraphCoverage({ graph: layer.graph, camera });

    expect(projectedCoverage).toBeGreaterThanOrEqual(0.6);
    expect(layer.graph.edges.length).toBeLessThanOrEqual(layer.graph.nodes.length * 3);

    layer.dispose();
  });

  it("renders curved organic filament segments inside every published volume and keeps particles on the sampled curves", () => {
    const tiers = [
      ["high", 18000],
      ["medium", 9800],
      ["economy", 5200]
    ];

    tiers.forEach(([tier, cosmicWebPoints]) => {
      const layer = createCosmicWeb({ quality: { tier, cosmicWebPoints } });
      const filaments = layer.root.getObjectByName("cosmic-web-filaments");
      const positions = filaments.geometry.getAttribute("position");
      const { volume } = layer.root.userData.structure;
      const meaningfulEdges = [];

      expect(positions.count).toBe(layer.graph.edges.length * 20);
      layer.graph.edges.forEach(([from, to], edgeIndex) => {
        const firstPoint = edgeIndex * 20;
        const start = layer.graph.nodes[from];
        const end = layer.graph.nodes[to];
        const intermediateDistances = Array.from({ length: 9 }, (_, segmentIndex) => (
          distanceToSegment(pointAt(positions, firstPoint + segmentIndex * 2 + 1), start, end)
        ));

        expectPointToBeCloseTo(pointAt(positions, firstPoint), start);
        expectPointToBeCloseTo(pointAt(positions, firstPoint + 19), end);
        for (let segmentIndex = 0; segmentIndex < 9; segmentIndex += 1) {
          expectPointToBeCloseTo(
            pointAt(positions, firstPoint + segmentIndex * 2 + 1),
            pointAt(positions, firstPoint + segmentIndex * 2 + 2)
          );
        }
        if (Math.hypot(...end.map((value, axis) => value - start[axis])) > 15) {
          meaningfulEdges.push(Math.max(...intermediateDistances) > 1);
        }
      });

      expect(meaningfulEdges.length).toBeGreaterThan(0);
      expect(meaningfulEdges.filter(Boolean).length / meaningfulEdges.length).toBeGreaterThanOrEqual(0.75);
      Array.from({ length: positions.count }, (_, index) => pointAt(positions, index)).forEach(([x, y, z]) => {
        expect([x, y, z].every(Number.isFinite)).toBe(true);
        expect(Math.abs(x)).toBeLessThanOrEqual(volume.width / 2);
        expect(Math.abs(y)).toBeLessThanOrEqual(volume.height / 2);
        expect(z).toBeGreaterThanOrEqual(volume.centerZ - volume.depth / 2);
        expect(z).toBeLessThanOrEqual(volume.centerZ + volume.depth / 2);
      });

      const particles = layer.root.getObjectByName("cosmic-web-particles")
        .geometry.getAttribute("position");
      const curveFollowerComparisons = Array.from({ length: particles.count }, (_, particleIndex) => {
        const edgeIndex = particleIndex % layer.graph.edges.length;
        const sampleIndex = Math.floor(particleIndex / layer.graph.edges.length);
        const samplesOnEdge = Math.ceil((particles.count - edgeIndex) / layer.graph.edges.length);
        if (sampleIndex / samplesOnEdge < 0.25 || sampleIndex / samplesOnEdge > 0.75) return null;
        const [from, to] = layer.graph.edges[edgeIndex];
        const start = layer.graph.nodes[from];
        const end = layer.graph.nodes[to];
        const firstPoint = edgeIndex * 20;
        const curveBend = Math.max(...Array.from({ length: 9 }, (_, segmentIndex) => (
          distanceToSegment(pointAt(positions, firstPoint + segmentIndex * 2 + 1), start, end)
        )));
        if (curveBend <= 6) return null;
        const particle = pointAt(particles, particleIndex);
        return distanceToPolyline(particle, positions, firstPoint, 10)
          < distanceToSegment(particle, start, end);
      }).filter((comparison) => comparison !== null);

      expect(curveFollowerComparisons.length).toBeGreaterThan(200);
      expect(curveFollowerComparisons.filter(Boolean).length / curveFollowerComparisons.length)
        .toBeGreaterThanOrEqual(0.75);
      layer.dispose();
    });
  });

  it("bounds short-edge cubic bends by full chord length", () => {
    const layer = createCosmicWeb({
      quality: { tier: "high", cosmicWebPoints: 18000 },
      seed: 13
    });
    const positions = layer.root.getObjectByName("cosmic-web-filaments")
      .geometry.getAttribute("position");
    layer.graph.edges.forEach(([from, to], edgeIndex) => {
      const start = layer.graph.nodes[from];
      const end = layer.graph.nodes[to];
      const chordLength = Math.hypot(...end.map((value, axis) => value - start[axis]));
      const maximumBend = Math.max(...Array.from({ length: 9 }, (_, segmentIndex) => (
        distanceToSegment(pointAt(positions, edgeIndex * 20 + segmentIndex * 2 + 1), start, end)
      )));
      expect(maximumBend).toBeLessThanOrEqual(chordLength * 0.4 + 0.001);
    });
    layer.dispose();
  });

  it.each([
    ["high", 18000, ["far", "mid", "near"], [0.62, 0.78, 0.58]],
    ["medium", 9800, ["far", "near"], [0.62 * 1.55, 0.58 * 1.55]],
    ["economy", 5200, ["mid"], [0.78 * 2.35]]
  ])("creates deterministic %s procedural tissue", (
    tier,
    cosmicWebPoints,
    expectedProfiles,
    expectedOpacities
  ) => {
    const first = createCosmicWeb({ quality: { tier, cosmicWebPoints }, seed: 20260719 });
    const second = createCosmicWeb({ quality: { tier, cosmicWebPoints }, seed: 20260719 });
    const tissue = first.root.children.filter(({ name }) => name === "cosmic-web-tissue")[0];
    const secondTissue = second.root.getObjectByName("cosmic-web-tissue");
    const metadata = first.root.userData.structure.tissue;
    const baseLayer = new THREE.Layers();
    const bloomLayer = new THREE.Layers();
    baseLayer.set(0);
    bloomLayer.set(BLOOM_SCENE_LAYER);

    expect(first.root.children[0]).toBe(tissue);
    expect(tissue.children).toHaveLength(expectedProfiles.length);
    expect(tissue.children.map(({ name }) => name)).toEqual(
      expectedProfiles.map((profile) => `cosmic-web-tissue-${profile}`)
    );
    expect(metadata).toEqual(second.root.userData.structure.tissue);
    expect(metadata).toMatchObject({
      algorithm: "cellular-voronoi-fbm",
      layerCount: expectedProfiles.length,
      palette: [0x8b5cf6, 0xd946ef, 0xf472b6, 0xf59e42]
    });
    expect(metadata.profiles.map(({ name }) => name)).toEqual(expectedProfiles);
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.profiles)).toBe(true);
    expect(metadata.profiles.every(Object.isFrozen)).toBe(true);
    expect(tissue.children.every(({ material }) => (
      material.isShaderMaterial
      && material.blending === THREE.AdditiveBlending
      && material.depthWrite === false
      && material.depthTest === true
      && material.toneMapped === false
      && material.transparent === true
    ))).toBe(true);
    expect(tissue.children.every((mesh) => (
      mesh.layers.test(baseLayer) && !mesh.layers.test(bloomLayer) && mesh.renderOrder === 2
    ))).toBe(true);
    expect(new Set(tissue.children.map(({ geometry }) => geometry)).size).toBe(1);
    tissue.children.forEach((mesh, index) => {
      expect(mesh.position.z).toBe(metadata.profiles[index].depth);
      expect(mesh.material.uniforms.uOpacity.value).toBeCloseTo(expectedOpacities[index], 6);
      expect(mesh.material.uniforms.uUvOffset.value.toArray()).toEqual(
        secondTissue.children[index].material.uniforms.uUvOffset.value.toArray()
      );
      expect(mesh.material.fragmentShader).toContain("float fbm(vec2 point)");
      expect(mesh.material.fragmentShader).toContain("float cellularRidge(vec2 point)");
      expect(mesh.material.fragmentShader).toContain("float fineDust(vec2 point)");
      expect(Object.keys(mesh.material.uniforms).some((name) => /time|exposure/i.test(name)))
        .toBe(false);
    });

    first.setPresence(0.37);
    expect(tissue.children.every(({ material }) => (
      material.uniforms.uPresence.value === 0.37
    ))).toBe(true);
    if (tier === "high") {
      const opacities = tissue.children.map(({ material }) => material.uniforms.uOpacity.value);
      expect(first.updateParallax({ x: 1, y: -1 })).toEqual({ x: 1.6, y: -1.1 });
      expect(tissue.children.map(({ position }) => [position.x, position.y])).toEqual(
        metadata.profiles.map(({ parallax }) => [1.6 * parallax, -1.1 * parallax])
      );
      expect(tissue.children.map(({ material }) => material.uniforms.uOpacity.value)).toEqual(opacities);
    }

    first.dispose();
    second.dispose();
  });

  it.each([
    ["high", 18000],
    ["medium", 9800],
    ["economy", 5200]
  ])("keeps every rendered %s geometry coordinate finite and inside the published volume", (
    tier,
    cosmicWebPoints
  ) => {
    const layer = createCosmicWeb({ quality: { tier, cosmicWebPoints } });
    const { volume } = layer.root.userData.structure;
    const renderedGeometry = [];
    layer.root.traverse((object) => {
      if (object.name.startsWith("cosmic-web-") && object.geometry?.getAttribute("position")) {
        object.updateMatrixWorld(true);
        renderedGeometry.push(object);
      }
    });
    const violations = renderedGeometry.flatMap((object) => {
      const { name, geometry } = object;
      const positions = geometry.getAttribute("position");
      for (let index = 0; index < positions.count; index += 1) {
        const world = new THREE.Vector3(
          positions.getX(index),
          positions.getY(index),
          positions.getZ(index)
        ).applyMatrix4(object.matrixWorld);
        const coordinate = world.toArray();
        const finite = coordinate.every(Number.isFinite);
        const inside = Math.abs(world.x) <= volume.width / 2
          && Math.abs(world.y) <= volume.height / 2
          && world.z >= volume.centerZ - volume.depth / 2
          && world.z <= volume.centerZ + volume.depth / 2;
        if (!finite || !inside) return [{ name, index, coordinate }];
      }
      return [];
    });
    const boundaryRatios = renderedGeometry
      .filter(({ geometry }) => geometry.getAttribute("position").count > 4)
      .map(({ name, geometry, matrixWorld }) => {
        const positions = geometry.getAttribute("position");
        const boundaryCount = Array.from({ length: positions.count }, (_, index) => index)
          .filter((index) => {
            const world = new THREE.Vector3(
              positions.getX(index),
              positions.getY(index),
              positions.getZ(index)
            ).applyMatrix4(matrixWorld);
            return Math.abs(world.x) === volume.width / 2
              || Math.abs(world.y) === volume.height / 2
              || world.z === volume.centerZ - volume.depth / 2
              || world.z === volume.centerZ + volume.depth / 2;
          }).length;
        return { name, ratio: boundaryCount / positions.count };
      });

    expect(renderedGeometry.map(({ name }) => name).sort()).toEqual([
      "cosmic-web-depth",
      "cosmic-web-filaments",
      "cosmic-web-hot-nodes",
      "cosmic-web-nodes",
      "cosmic-web-particles",
      ...({
        high: ["cosmic-web-tissue-far", "cosmic-web-tissue-mid", "cosmic-web-tissue-near"],
        medium: ["cosmic-web-tissue-far", "cosmic-web-tissue-near"],
        economy: ["cosmic-web-tissue-mid"]
      })[tier]
    ]);
    expect(violations).toEqual([]);
    expect(boundaryRatios.every(({ ratio }) => ratio < 0.02)).toBe(true);

    layer.dispose();
  });

  it.each([
    ["high", 18000],
    ["medium", 9800],
    ["economy", 5200]
  ])("keeps parallax-shifted %s tissue inside the published volume", (
    tier,
    cosmicWebPoints
  ) => {
    const layer = createCosmicWeb({ quality: { tier, cosmicWebPoints } });
    const { volume } = layer.root.userData.structure;

    [{ x: 1, y: 1 }, { x: -1, y: -1 }].forEach((pointer) => {
      layer.updateParallax(pointer);
      layer.root.updateMatrixWorld(true);
      const tissue = layer.root.getObjectByName("cosmic-web-tissue");
      tissue.children.forEach((mesh) => {
        const positions = mesh.geometry.getAttribute("position");
        for (let index = 0; index < positions.count; index += 1) {
          const world = new THREE.Vector3(
            positions.getX(index),
            positions.getY(index),
            positions.getZ(index)
          ).applyMatrix4(mesh.matrixWorld);
          expect(Math.abs(world.x)).toBeLessThanOrEqual(volume.width / 2 - 0.5 + 0.001);
          expect(Math.abs(world.y)).toBeLessThanOrEqual(volume.height / 2 - 0.5 + 0.001);
          expect(world.z).toBeGreaterThanOrEqual(volume.centerZ - volume.depth / 2);
          expect(world.z).toBeLessThanOrEqual(volume.centerZ + volume.depth / 2);
        }
      });
    });

    layer.dispose();
  });

  it("limits selective bloom to dense nodes while preserving their base layer", () => {
    const layer = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 } });
    const bloomLayer = new THREE.Layers();
    const baseLayer = new THREE.Layers();
    bloomLayer.set(BLOOM_SCENE_LAYER);
    baseLayer.set(0);
    const nodes = layer.root.getObjectByName("cosmic-web-nodes");
    const hotNodes = layer.root.getObjectByName("cosmic-web-hot-nodes");

    [nodes, hotNodes].forEach((object) => {
      expect(object.layers.test(baseLayer)).toBe(true);
      expect(object.layers.test(bloomLayer)).toBe(true);
    });
    ["cosmic-web-filaments", "cosmic-web-particles", "cosmic-web-depth"].forEach((name) => {
      const object = layer.root.getObjectByName(name);
      expect(object.layers.test(baseLayer)).toBe(true);
      expect(object.layers.test(bloomLayer)).toBe(false);
    });

    layer.dispose();
  });

  it("builds a connected deterministic nearest-neighbour graph with frozen normalized records", () => {
    const first = createCosmicWeb();
    const second = createCosmicWeb();
    const adjacency = first.graph.nodes.map(() => []);
    first.graph.edges.forEach(([from, to]) => {
      adjacency[from].push(to);
      adjacency[to].push(from);
    });
    const visited = new Set([0]);
    const queue = [0];
    while (queue.length > 0) {
      adjacency[queue.shift()].forEach((node) => {
        if (visited.has(node)) return;
        visited.add(node);
        queue.push(node);
      });
    }

    expect(first.graph).toEqual(second.graph);
    expect(visited.size).toBe(first.graph.nodes.length);
    expect(first.graph.edges.length).toBeGreaterThanOrEqual(first.graph.nodes.length - 1);
    expect(first.graph.edges.length).toBeLessThanOrEqual(first.graph.nodes.length * 3);
    expect(first.graph.edges.every(([from, to]) => from < to)).toBe(true);
    expect(new Set(first.graph.edges.map((edge) => edge.join(":"))).size).toBe(first.graph.edges.length);
    expect(Object.isFrozen(first.graph)).toBe(true);
    expect(first.graph.nodes.every(Object.isFrozen)).toBe(true);
    expect(first.graph.edges.every(Object.isFrozen)).toBe(true);

    first.dispose();
    second.dispose();
  });

  it("caps non-default medium graphs without dropping the connected spanning backbone", () => {
    const layer = createCosmicWeb({
      quality: { tier: "medium", cosmicWebPoints: 9800 },
      seed: 106
    });
    const adjacency = layer.graph.nodes.map(() => []);
    layer.graph.edges.forEach(([from, to]) => {
      adjacency[from].push(to);
      adjacency[to].push(from);
    });
    const visited = new Set([0]);
    const queue = [0];
    while (queue.length > 0) {
      adjacency[queue.shift()].forEach((node) => {
        if (visited.has(node)) return;
        visited.add(node);
        queue.push(node);
      });
    }

    expect(layer.graph.edges.length).toBeLessThanOrEqual(layer.graph.nodes.length * 3);
    expect(visited.size).toBe(layer.graph.nodes.length);

    layer.dispose();
  });

  it("changes the graph when the seed changes without mutating either input", () => {
    const quality = Object.freeze({ tier: "economy", cosmicWebPoints: 5200 });
    const first = createCosmicWeb({ quality, seed: 11 });
    const second = createCosmicWeb({ quality, seed: 12 });

    expect(first.graph.nodes).not.toEqual(second.graph.nodes);
    expect(quality).toEqual({ tier: "economy", cosmicWebPoints: 5200 });

    first.dispose();
    second.dispose();
  });

  it("supports the full safe-integer seed boundary", () => {
    const layer = createCosmicWeb({ seed: Number.MAX_SAFE_INTEGER });

    expect(layer.graph.nodes).toHaveLength(68);

    layer.dispose();
  });

  it.each([
    ["high", 18000],
    ["medium", 9800],
    ["economy", 5200]
  ])("places the exact %s quality point budget along volumetric filaments", (tier, cosmicWebPoints) => {
    const layer = createCosmicWeb({ quality: { tier, cosmicWebPoints } });
    const particles = layer.root.getObjectByName("cosmic-web-particles");
    const positions = particles.geometry.getAttribute("position");
    const distinctDepths = new Set(Array.from(positions.array).filter((_, index) => index % 3 === 2)
      .map((value) => Math.round(value)));

    expect(positions.count).toBe(cosmicWebPoints);
    expect(distinctDepths.size).toBeGreaterThan(40);
    expect(layer.root.getObjectByName("cosmic-web-filaments")?.isLineSegments).toBe(true);
    expect(layer.root.getObjectByName("cosmic-web-nodes")?.isPoints).toBe(true);
    expect(layer.root.getObjectByName("cosmic-web-depth")?.isPoints).toBe(true);
    expect(layer.root.children.some(({ name }) => name.includes("plane"))).toBe(false);

    layer.dispose();
  });

  it("forms deterministic quality-scaled galaxy-point clusters around every graph node", () => {
    const first = createCosmicWeb();
    const second = createCosmicWeb();
    const high = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 } });
    const firstNodes = first.root.getObjectByName("cosmic-web-nodes").geometry.getAttribute("position");
    const secondNodes = second.root.getObjectByName("cosmic-web-nodes").geometry.getAttribute("position");
    const highNodes = high.root.getObjectByName("cosmic-web-nodes").geometry.getAttribute("position");
    const clusterPositions = firstNodes.array;
    const nearbyCount = (center) => Array.from({ length: firstNodes.count }, (_, index) => {
      const offset = index * 3;
      return Math.hypot(
        clusterPositions[offset] - center[0],
        clusterPositions[offset + 1] - center[1],
        clusterPositions[offset + 2] - center[2]
      );
    }).filter((distance) => distance < 24).length;

    expect(firstNodes.count).toBeGreaterThan(first.graph.nodes.length);
    expect(highNodes.count).toBeGreaterThan(firstNodes.count);
    expect(firstNodes.array).toEqual(secondNodes.array);
    expect(first.graph.nodes.slice(0, 12).every((center) => nearbyCount(center) >= 6)).toBe(true);

    first.dispose();
    second.dispose();
    high.dispose();
  });

  it("uses independently faded observatory layers and shared parallax behavior", () => {
    const layer = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 } });
    const particles = layer.root.getObjectByName("cosmic-web-particles");
    const filaments = layer.root.getObjectByName("cosmic-web-filaments");
    const nodes = layer.root.getObjectByName("cosmic-web-nodes");
    const depth = layer.root.getObjectByName("cosmic-web-depth");
    const hotNodes = layer.root.getObjectByName("cosmic-web-hot-nodes");

    expect([particles, filaments, nodes, depth, hotNodes].every(({ material }) => (
      material.transparent && !material.depthWrite
    ))).toBe(true);
    expect(new Set([particles.renderOrder, filaments.renderOrder, nodes.renderOrder, depth.renderOrder]).size)
      .toBeGreaterThan(2);
    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 1.6, y: -1.1 });
    layer.setPresence(0.5);
    expect(particles.material.opacity).toBeGreaterThan(0);
    expect(particles.material.opacity).not.toBe(nodes.material.opacity);

    layer.dispose();
  });

  it("honors reduced motion and fails closed for malformed presence and parallax", () => {
    const reduced = createCosmicWeb({
      quality: { tier: "high", cosmicWebPoints: 18000 },
      reducedMotion: true
    });
    const economy = createCosmicWeb();

    expect(reduced.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0, y: 0 });
    expect(reduced.root.getObjectByName("cosmic-web-filaments").material.opacity).toBe(0.48);
    expect(economy.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0, y: 0 });
    economy.setPresence("visible");
    expect(economy.root.visible).toBe(false);
    expect(economy.updateParallax({ x: 1, y: "-1" })).toEqual({ x: 0, y: 0 });
    expect(economy.updateParallax(null)).toEqual({ x: 0, y: 0 });

    reduced.dispose();
    economy.dispose();
  });

  it.each([
    { THREE: null },
    { quality: null },
    { quality: { tier: "economy", cosmicWebPoints: 0 } },
    { quality: { tier: "economy", cosmicWebPoints: 2.5 } },
    { seed: 1.5 },
    { reducedMotion: "false" },
    { THREE: { Group: THREE.Group } }
  ])("rejects invalid boundary input %j", (overrides) => {
    expect(() => createCosmicWebLayer({
      THREE,
      quality: { tier: "economy", cosmicWebPoints: 5200 },
      glowTexture: null,
      reducedMotion: false,
      seed: 20260719,
      ...overrides
    })).toThrow(TypeError);
  });

  it("disposes every resource tree only once", () => {
    const layer = createCosmicWeb();
    const resources = new Set();
    layer.root.traverse(({ geometry, material }) => {
      if (geometry) resources.add(geometry);
      if (material) resources.add(material);
    });
    const disposeSpies = [...resources].map((resource) => vi.spyOn(resource, "dispose"));

    layer.dispose();
    layer.dispose();

    disposeSpies.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(layer.root.children).toHaveLength(0);
  });
});
