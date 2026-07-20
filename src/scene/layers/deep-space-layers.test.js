import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { ANNOTATIONS, STAGES } from "../../data/cosmos.js";
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
  "orion-arm": Object.freeze([70, -11.25, 1]),
  "perseus-arm": Object.freeze([-115, 14.0625, 1]),
  "galactic-halo": Object.freeze([15, 90, 1])
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
    expect(photo.geometry.parameters).toMatchObject({ width: 500, height: 281.25 });
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

const createCosmicWeb = (overrides = {}) => {
  const texture = Object.hasOwn(overrides, "texture")
    ? overrides.texture
    : new THREE.Texture();

  return {
    layer: createCosmicWebLayer({
      THREE,
      texture,
      quality: { tier: "high" },
      reducedMotion: false,
      ...overrides
    }),
    texture
  };
};

describe("createCosmicWebLayer", () => {
  it("replaces every procedural web object with two oversized photographic planes", () => {
    const texture = new THREE.Texture();
    const layer = createCosmicWebLayer({
      THREE,
      texture,
      quality: { tier: "high", cosmicWebPoints: 18000 },
      glowTexture: null,
      reducedMotion: false,
      seed: 20260719
    });

    [
      "cosmic-web-filaments",
      "cosmic-web-particles",
      "cosmic-web-nodes",
      "cosmic-web-hot-nodes",
      "cosmic-web-depth",
      "cosmic-web-tissue"
    ].forEach((name) => {
      expect(layer.root.getObjectByName(name)).toBeUndefined();
    });

    const primary = layer.root.getObjectByName("cosmic-web-photo-primary");
    const secondary = layer.root.getObjectByName("cosmic-web-photo-secondary");

    expectFrozenLayerContract(layer);
    expect(Object.hasOwn(layer, "graph")).toBe(false);
    expect(layer.interactive).toEqual([]);
    expect(primary.material.map).toBe(texture);
    expect(secondary.material.map).toBe(texture);
    expect(primary.geometry.parameters).toMatchObject({ width: 1760, height: 990 });
    expect(secondary.geometry.parameters).toMatchObject({ width: 1880, height: 1057.5 });
    expect(primary.parent.position.z).toBe(-235);
    expect(secondary.parent.position.z).toBe(-300);
    expect(primary.material).toMatchObject({
      opacity: 0.98,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      blending: THREE.NormalBlending
    });
    expect(secondary.material).toMatchObject({
      opacity: 0.16,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      blending: THREE.NormalBlending
    });
    expect(primary.renderOrder).toBe(2);
    expect(secondary.renderOrder).toBe(1);
    expect(secondary.position.toArray()).toEqual([7, -4, 0]);
    expect(secondary.scale.toArray()).toEqual([1.025, 1.025, 1]);
    expect(secondary.rotation.z).toBeCloseTo(-0.012, 8);

    layer.dispose();
  });

  it("fades both photographs and applies distinct quality-aware parallax factors", () => {
    const { layer } = createCosmicWeb();
    const primary = layer.root.getObjectByName("cosmic-web-photo-primary");
    const secondary = layer.root.getObjectByName("cosmic-web-photo-secondary");

    expect(layer.root.visible).toBe(false);
    layer.setPresence(0.5);
    expect(layer.root.visible).toBe(true);
    expect(primary.material.opacity).toBeCloseTo(0.49, 8);
    expect(secondary.material.opacity).toBeCloseTo(0.08, 8);

    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0.192, y: -0.132 });
    expect(primary.parent.position.toArray()).toEqual([0.192, -0.132, -235]);
    expect(secondary.parent.position.x).toBeCloseTo(0.08, 8);
    expect(secondary.parent.position.y).toBeCloseTo(-0.055, 8);
    expect(secondary.parent.position.z).toBe(-300);

    layer.setPresence(Number.NaN);
    expect(layer.root.visible).toBe(false);
    expect(primary.material.opacity).toBe(0);
    expect(secondary.material.opacity).toBe(0);
    expect(layer.updateParallax({ x: 1, y: "-1" })).toEqual({ x: 0, y: 0 });
    expect(layer.updateParallax(null)).toEqual({ x: 0, y: 0 });

    layer.dispose();
  });

  it.each([
    ["high", false, { x: 0.192, y: -0.132 }, { x: 0.08, y: -0.05500000000000001 }],
    ["medium", false, { x: 0.1056, y: -0.0726 }, { x: 0.044000000000000004, y: -0.030250000000000003 }],
    ["economy", false, { x: 0, y: 0 }, { x: 0, y: 0 }],
    ["high", true, { x: 0, y: 0 }, { x: 0, y: 0 }]
  ])("resolves %s reduced-motion=%s parallax", (
    tier,
    reducedMotion,
    expectedPrimary,
    expectedSecondary
  ) => {
    const { layer } = createCosmicWeb({ quality: { tier }, reducedMotion });
    const primaryRoot = layer.root.getObjectByName("cosmic-web-photo-primary").parent;
    const secondaryRoot = layer.root.getObjectByName("cosmic-web-photo-secondary").parent;

    const actual = layer.updateParallax({ x: 1, y: -1 });
    expect(actual.x).toBeCloseTo(expectedPrimary.x, 8);
    expect(actual.y).toBeCloseTo(expectedPrimary.y, 8);
    expect(primaryRoot.position.x).toBeCloseTo(expectedPrimary.x, 8);
    expect(primaryRoot.position.y).toBeCloseTo(expectedPrimary.y, 8);
    expect(secondaryRoot.position.x).toBeCloseTo(expectedSecondary.x, 8);
    expect(secondaryRoot.position.y).toBeCloseTo(expectedSecondary.y, 8);
    expect(primaryRoot.position.z).toBe(-235);
    expect(secondaryRoot.position.z).toBe(-300);

    layer.dispose();
  });

  it.each([
    { THREE: null },
    { texture: null },
    { texture: {} },
    { quality: null },
    { quality: { tier: "ultra" } },
    { reducedMotion: null },
    { THREE: { Group: THREE.Group } }
  ])("rejects invalid photographic boundary input %j", (overrides) => {
    expect(() => createCosmicWeb(overrides)).toThrow(TypeError);
  });

  it("disposes both plane resource trees once without disposing the shared texture", () => {
    const { layer, texture } = createCosmicWeb();
    const primary = layer.root.getObjectByName("cosmic-web-photo-primary");
    const secondary = layer.root.getObjectByName("cosmic-web-photo-secondary");
    const geometryDisposes = [
      vi.spyOn(primary.geometry, "dispose"),
      vi.spyOn(secondary.geometry, "dispose")
    ];
    const materialDisposes = [
      vi.spyOn(primary.material, "dispose"),
      vi.spyOn(secondary.material, "dispose")
    ];
    const textureDispose = vi.spyOn(texture, "dispose");

    layer.setPresence(0.42);
    layer.updateParallax({ x: 1, y: -1 });
    const primaryPosition = primary.parent.position.clone();
    const secondaryPosition = secondary.parent.position.clone();
    const opacities = [primary.material.opacity, secondary.material.opacity];

    layer.dispose();
    layer.setPresence(0.9);
    expect(layer.updateParallax({ x: -1, y: 1 })).toEqual({
      x: primaryPosition.x,
      y: primaryPosition.y
    });
    layer.dispose();

    geometryDisposes.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    materialDisposes.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(textureDispose).not.toHaveBeenCalled();
    expect([primary.material.opacity, secondary.material.opacity]).toEqual(opacities);
    expect(primary.parent).toBeNull();
    expect(secondary.parent).toBeNull();
    expect(primaryPosition.toArray()).toEqual([0.192, -0.132, -235]);
    expect(secondaryPosition.x).toBeCloseTo(0.08, 8);
    expect(secondaryPosition.y).toBeCloseTo(-0.055, 8);
    expect(secondaryPosition.z).toBe(-300);
    expect(layer.root.children).toHaveLength(0);
  });
});
