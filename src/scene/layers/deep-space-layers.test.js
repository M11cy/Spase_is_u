import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createQualityProfile } from "../../core/quality-profile.js";
import { STAGES } from "../../data/cosmos.js";
import { BLOOM_SCENE_LAYER } from "../deep-space-postprocessing.js";
import { createCosmicWebLayer } from "./cosmic-web.js";
import { createLocalGroupLayer } from "./local-group.js";
import { createMilkyWayLayer } from "./milky-way.js";

const createLayer = (overrides = {}) => createMilkyWayLayer({
  THREE,
  annotations: [],
  quality: { tier: "high", galaxyPoints: 900 },
  glowTexture: null,
  createMarker: () => new THREE.Sprite(),
  reducedMotion: false,
  ...overrides
});

describe("createMilkyWayLayer", () => {
  it("presents a large four-arm disc toward the camera", () => {
    const layer = createLayer({ quality: { tier: "high", galaxyPoints: 9000 } });

    expect(layer.root.userData.composition).toEqual(expect.objectContaining({
      inclinationDegrees: 20,
      diameter: 210,
      armCount: 4,
      dustLanes: 2
    }));
    expect(Object.isFrozen(layer.root.userData.composition)).toBe(true);
    expect(layer.root.rotation.x).toBeCloseTo(-Math.PI / 2 + Math.PI / 9, 4);
    expect(layer.root.rotation.z).toBeCloseTo(-0.16, 4);
    expect(layer.root.scale.x).toBeGreaterThanOrEqual(1.5);

    layer.dispose();
  });

  it.each([
    ["high", { width: 1920, height: 1080, dpr: 2, cores: 12 }, 9000],
    ["medium", { width: 1024, height: 768, dpr: 2, cores: 8 }, 5600],
    ["economy", { width: 390, height: 844, dpr: 3, cores: 12 }, 2800]
  ])("uses the exact %s Milky Way point budget", (tier, viewport, galaxyPoints) => {
    const profile = createQualityProfile({ ...viewport, reducedMotion: false });
    const layer = createLayer({ quality: profile });

    expect(profile).toMatchObject({ tier, galaxyPoints });
    expect(layer.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").count)
      .toBe(galaxyPoints);

    layer.dispose();
  });

  it("fills roughly seventy percent of the settled desktop frame", () => {
    const layer = createLayer({ quality: { tier: "high", galaxyPoints: 9000 } });
    const stage = STAGES.find(({ id }) => id === "milky-way");
    const distance = Math.hypot(...stage.camera.position.map((value, index) => (
      value - stage.camera.target[index]
    )));
    const verticalFov = stage.camera.fov * Math.PI / 180;
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * (16 / 9));
    const viewportWidth = 2 * distance * Math.tan(horizontalFov / 2);
    const occupancy = layer.root.userData.composition.diameter * layer.root.scale.x / viewportWidth;

    expect(occupancy).toBeGreaterThanOrEqual(0.66);
    expect(occupancy).toBeLessThanOrEqual(0.75);

    layer.dispose();
  });

  it("creates a layered volumetric galaxy using the quality point count", () => {
    const layer = createLayer({ quality: { tier: "economy", galaxyPoints: 900 } });

    expect(layer.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").count).toBe(900);
    expect(layer.root.getObjectByName("milky-way-dust-lane-1")).toBeTruthy();
    expect(layer.root.getObjectByName("milky-way-halo")).toBeTruthy();
    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0, y: 0 });

    layer.dispose();
  });

  it("uses the shared high-quality parallax response", () => {
    const layer = createLayer();
    const initialZ = layer.root.position.z;
    const initialRotation = layer.root.rotation.clone();

    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 1.6, y: -1.1 });
    expect(layer.root.position.z).toBe(initialZ);
    expect(layer.root.rotation.toArray()).toEqual(initialRotation.toArray());

    layer.dispose();
  });

  it("keeps stars, dust, core, and halo as independently faded transparent 3D layers", () => {
    const layer = createLayer();
    const stars = layer.root.getObjectByName("milky-way-stars");
    const dust = layer.root.getObjectByName("milky-way-dust-lane-1");
    const core = layer.root.getObjectByName("milky-way-core");
    const halo = layer.root.getObjectByName("milky-way-halo");

    expect(layer.root.position.z).toBe(-80);
    expect(core).toBeTruthy();
    expect(stars.material.blending).toBe(THREE.AdditiveBlending);
    expect(dust.material.blending).toBe(THREE.NormalBlending);
    expect([stars, dust, core, halo].every(({ material }) => material.transparent && !material.depthWrite)).toBe(true);
    layer.setPresence(0.5);
    expect(stars.material.opacity).toBeCloseTo(0.41);

    layer.dispose();
  });

  it("generates deterministic logarithmic-arm positions and keeps annotations outside the bright core", () => {
    const annotation = {
      id: "galactic-center",
      stage: 3,
      position: [-6, 1, -82]
    };
    const first = createLayer({ annotations: [annotation] });
    const second = createLayer({ annotations: [annotation] });

    expect(first.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").array)
      .toEqual(second.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").array);
    expect(first.interactive).toHaveLength(1);
    expect(first.interactive[0].userData.annotation).toMatchObject(annotation);
    expect(Math.hypot(first.interactive[0].position.x, first.interactive[0].position.y))
      .toBeGreaterThanOrEqual(28);

    first.dispose();
    second.dispose();
  });

  it("forms four separated face-on logarithmic arm bands with outward radial progression", () => {
    const layer = createLayer();
    const positions = layer.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").array;
    const { armCount, coordinatePlane, pattern } = layer.root.userData.armStructure;
    const pointCount = positions.length / 3;
    const radialDistance = (index) => {
      const offset = index * 3;
      return Math.hypot(positions[offset], positions[offset + 1]);
    };
    const firstAngles = Array.from({ length: armCount }, (_, arm) => {
      const offset = arm * 3;
      return Math.atan2(positions[offset + 1], positions[offset]);
    }).sort((left, right) => left - right);
    const angularGaps = firstAngles.map((angle, index) => (
      (firstAngles[(index + 1) % armCount] - angle + Math.PI * 2) % (Math.PI * 2)
    ));

    expect(Object.isFrozen(layer.root.userData.armStructure)).toBe(true);
    expect(pattern).toBe("logarithmic");
    expect(coordinatePlane).toBe("xy");
    expect(armCount).toBe(4);
    expect(angularGaps.every((gap) => gap > 1 && gap < 2.1)).toBe(true);
    expect(Array.from({ length: armCount }, (_, arm) => (
      radialDistance(pointCount - armCount + arm) > radialDistance(arm) * 8
    )).every(Boolean)).toBe(true);

    layer.dispose();
  });

  it("breaks luminous arms with two dark offset dust lanes and a volumetric halo", () => {
    const layer = createLayer();
    const dustLanes = [1, 2].map((index) => (
      layer.root.getObjectByName(`milky-way-dust-lane-${index}`)
    ));
    const stars = layer.root.getObjectByName("milky-way-stars");
    const halo = layer.root.getObjectByName("milky-way-halo");
    const haloPositions = halo.geometry.getAttribute("position");
    const distinctHaloDepths = new Set(Array.from(haloPositions.array)
      .filter((_, index) => index % 3 === 2)
      .map((value) => Math.round(value)));

    expect(dustLanes.every(Boolean)).toBe(true);
    expect(dustLanes.every(({ material, renderOrder }) => (
      material.blending === THREE.NormalBlending
      && material.transparent
      && material.opacity >= 0.7
      && renderOrder > stars.renderOrder
    ))).toBe(true);
    expect(dustLanes[0].geometry.getAttribute("position").array)
      .not.toEqual(dustLanes[1].geometry.getAttribute("position").array);
    expect(halo.isPoints).toBe(true);
    expect(distinctHaloDepths.size).toBeGreaterThan(12);

    layer.dispose();
  });

  it("selectively blooms luminous stars and the warm core while preserving the base layer", () => {
    const layer = createLayer();
    const stars = layer.root.getObjectByName("milky-way-stars");
    const core = layer.root.getObjectByName("milky-way-core");
    const halo = layer.root.getObjectByName("milky-way-halo");
    const dust = layer.root.getObjectByName("milky-way-dust-lane-1");

    expect(core.material.color.getHex()).toBe(0xffc878);
    expect([stars, core].every(({ layers }) => (
      layers.isEnabled(0) && layers.isEnabled(BLOOM_SCENE_LAYER)
    ))).toBe(true);
    expect([halo, dust].every(({ layers }) => (
      layers.isEnabled(0) && !layers.isEnabled(BLOOM_SCENE_LAYER)
    ))).toBe(true);

    layer.dispose();
  });

  it.each([
    undefined,
    null,
    {},
    { tier: "high", galaxyPoints: 0 },
    { tier: "high", galaxyPoints: 1.5 }
  ])("rejects invalid quality input %j", (quality) => {
    expect(() => createLayer({ quality })).toThrow(TypeError);
  });

  it.each([
    undefined,
    null,
    {},
    { Group: THREE.Group },
    { BufferGeometry: THREE.BufferGeometry }
  ])("rejects an incomplete THREE namespace %j", (incompleteThree) => {
    expect(() => createLayer({ THREE: incompleteThree })).toThrow(TypeError);
  });

  it.each([undefined, null, {}, "annotations"])("rejects invalid annotations %j", (annotations) => {
    expect(() => createLayer({ annotations })).toThrow(TypeError);
  });

  it.each([undefined, null, "marker"])("rejects invalid marker factory %j", (createMarker) => {
    expect(() => createLayer({ createMarker })).toThrow(TypeError);
  });

  it.each([undefined, null, "false"])("rejects invalid reduced-motion preference %j", (reducedMotion) => {
    expect(() => createLayer({ reducedMotion })).toThrow(TypeError);
  });

  it("fails closed by skipping malformed annotations and marker results", () => {
    const layer = createLayer({
      annotations: [null, { position: [0, 0] }, { position: [0, 0, -80] }],
      createMarker: () => null
    });

    expect(layer.interactive).toHaveLength(0);

    layer.dispose();
  });

  it("fails closed for invalid presence and parallax input", () => {
    const layer = createLayer();

    layer.setPresence("visible");
    expect(layer.root.visible).toBe(false);
    expect(layer.updateParallax({ x: 1, y: "-1" })).toEqual({ x: 0, y: 0 });
    expect(layer.updateParallax(null)).toEqual({ x: 0, y: 0 });

    layer.dispose();
  });

  it("disposes the resource tree only once", () => {
    const layer = createLayer();
    const stars = layer.root.getObjectByName("milky-way-stars");
    const disposeGeometry = vi.spyOn(stars.geometry, "dispose");
    const disposeMaterial = vi.spyOn(stars.material, "dispose");

    layer.dispose();
    layer.dispose();

    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});

const localGroupAnnotations = Object.freeze([
  Object.freeze({ id: "group-milky-way", stage: 4, position: [-34, 4, -142], size: 18, image: "/mw.jpg", color: 0xdde8ff }),
  Object.freeze({ id: "group-andromeda", stage: 4, position: [56, 13, -160], size: 24, image: "/a.jpg", color: 0xffffff }),
  Object.freeze({ id: "group-triangulum", stage: 4, position: [20, -26, -180], size: 11, image: "/m33.jpg", color: 0xcddcff }),
  Object.freeze({ id: "group-lmc", stage: 4, position: [-55, -10, -130], size: 10, color: 0xb9ccff }),
  Object.freeze({ id: "group-m32", stage: 4, position: [72, 18, -166], size: 8, color: 0xe7edff })
]);

const createLocalGroup = (overrides = {}) => createLocalGroupLayer({
  THREE,
  annotations: localGroupAnnotations,
  quality: { tier: "high" },
  stage: 4,
  glowTexture: null,
  textureFor: () => null,
  createMarker: () => new THREE.Sprite(),
  reducedMotion: false,
  ...overrides
});

describe("createLocalGroupLayer", () => {
  it("creates named galaxies with distinct depth and aspect", () => {
    const layer = createLocalGroup();
    const galaxies = localGroupAnnotations.map(({ id }) => layer.root.getObjectByName(id));

    expect(galaxies.every(Boolean)).toBe(true);
    expect(new Set(galaxies.map(({ position }) => position.z)).size).toBe(5);
    expect(galaxies[1].scale.x).not.toBe(galaxies[1].scale.y);

    layer.dispose();
  });

  it("renders textured discs, cores, and star clouds with deterministic profile-specific form", () => {
    const texture = new THREE.Texture();
    const first = createLocalGroup({ textureFor: () => texture });
    const second = createLocalGroup({ textureFor: () => texture });
    const andromeda = first.root.getObjectByName("group-andromeda");
    const lmc = first.root.getObjectByName("group-lmc");
    const m32 = first.root.getObjectByName("group-m32");
    const disc = andromeda.getObjectByName("group-andromeda-disc");
    const stars = andromeda.getObjectByName("group-andromeda-stars");

    expect(andromeda.userData.profile).toBe("spiral");
    expect(lmc.userData.profile).toBe("irregular");
    expect(m32.userData.profile).toBe("elliptical");
    expect(disc.material.map).toBe(texture);
    expect(andromeda.getObjectByName("group-andromeda-core")).toBeTruthy();
    expect(stars.isPoints).toBe(true);
    expect(stars.geometry.getAttribute("position").array)
      .toEqual(second.root.getObjectByName("group-andromeda-stars").geometry.getAttribute("position").array);
    expect(andromeda.rotation.z).not.toBe(lmc.rotation.z);

    first.dispose();
    second.dispose();
  });

  it("keeps annotations interactive and applies presence and high-quality parallax", () => {
    const layer = createLocalGroup();

    expect(layer.interactive).toHaveLength(localGroupAnnotations.length);
    expect(layer.interactive[0].userData.annotation).toMatchObject(localGroupAnnotations[0]);
    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 1.6, y: -1.1 });
    layer.setPresence(0.5);
    expect(layer.root.visible).toBe(true);
    expect(layer.root.getObjectByName("group-andromeda-disc").material.opacity).toBeGreaterThan(0);

    layer.dispose();
  });

  it("fails closed for invalid inputs, honors reduced motion, and disposes once", () => {
    expect(() => createLocalGroup({ quality: null })).toThrow(TypeError);
    expect(() => createLocalGroup({ textureFor: null })).toThrow(TypeError);
    const malformedLayer = createLocalGroup({
      annotations: [null, { id: "bad", position: [1, 2] }],
      reducedMotion: true
    });
    const layer = createLocalGroup();
    const marker = layer.root.getObjectByName("group-milky-way-marker");
    const dispose = vi.spyOn(marker.material, "dispose");

    expect(malformedLayer.interactive).toHaveLength(0);
    expect(malformedLayer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0, y: 0 });
    malformedLayer.dispose();
    layer.dispose();
    layer.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("skips duplicate galaxy identities without mutating frozen annotation sources", () => {
    const source = Object.freeze({
      id: "group-andromeda",
      stage: 4,
      position: Object.freeze([56, 13, -160]),
      size: 24,
      color: 0xffffff
    });
    const annotations = Object.freeze([source, source, null]);
    const layer = createLocalGroup({ annotations });

    expect(layer.interactive).toHaveLength(1);
    expect(layer.root.children.filter(({ name }) => name === source.id)).toHaveLength(1);
    expect(source).toEqual({
      id: "group-andromeda",
      stage: 4,
      position: [56, 13, -160],
      size: 24,
      color: 0xffffff
    });

    layer.dispose();
  });

  it("keeps markers independent of visual scale and requires the configured stage", () => {
    const layer = createLocalGroup({
      createMarker: () => {
        const marker = new THREE.Sprite();
        marker.scale.set(12, 12, 1);
        return marker;
      }
    });
    const marker = layer.root.getObjectByName("group-andromeda-marker");
    const worldScale = new THREE.Vector3();
    layer.root.updateMatrixWorld(true);
    marker.getWorldScale(worldScale);
    const wrongStage = createLocalGroup({
      annotations: [{ ...localGroupAnnotations[0], stage: 5 }]
    });

    expect(worldScale.x).toBeCloseTo(12);
    expect(worldScale.y).toBeCloseTo(12);
    expect(wrongStage.interactive).toHaveLength(0);

    layer.dispose();
    wrongStage.dispose();
  });

  it("uses oriented texture planes and resolves colliding source depths deterministically", () => {
    const duplicateDepth = [
      { ...localGroupAnnotations[0], position: [-34, 4, -142] },
      { ...localGroupAnnotations[1], position: [56, 13, -142] }
    ];
    const first = createLocalGroup({ annotations: duplicateDepth });
    const second = createLocalGroup({ annotations: duplicateDepth });
    const milkyWay = first.root.getObjectByName("group-milky-way");
    const andromeda = first.root.getObjectByName("group-andromeda");
    const disc = andromeda.getObjectByName("group-andromeda-disc");

    expect(disc.isMesh).toBe(true);
    expect(disc.material.map).not.toBeNull();
    expect(milkyWay.position.z).not.toBe(andromeda.position.z);
    expect(andromeda.position.z).toBe(second.root.getObjectByName("group-andromeda").position.z);

    first.dispose();
    second.dispose();
  });

  it("uses restrained additive textured discs so opaque RGB image backgrounds cannot render as black panels", () => {
    const opaqueRgbTexture = new THREE.DataTexture(
      new Uint8Array([0, 0, 0, 255]),
      1,
      1,
      THREE.RGBAFormat
    );
    const layer = createLocalGroup({ textureFor: () => opaqueRgbTexture });
    const disc = layer.root.getObjectByName("group-andromeda-disc");

    expect(disc.material.map).toBe(opaqueRgbTexture);
    expect(disc.material.blending).toBe(THREE.AdditiveBlending);
    expect(disc.material.transparent).toBe(true);
    expect(disc.material.depthWrite).toBe(false);
    expect(disc.material.opacity).toBeLessThanOrEqual(0.7);

    layer.dispose();
  });

  it("feathers every source texture with a soft radial alpha mask and disposes the mask once", () => {
    const sourceTexture = new THREE.Texture();
    const layer = createLocalGroup({ textureFor: () => sourceTexture });
    const disc = layer.root.getObjectByName("group-andromeda-disc");
    const alphaMask = disc.material.alphaMap;

    expect(alphaMask).toBeInstanceOf(THREE.DataTexture);
    expect(alphaMask).not.toBe(sourceTexture);
    expect(alphaMask.image.width).toBeGreaterThanOrEqual(32);
    expect(alphaMask.image.height).toBe(alphaMask.image.width);

    const pixels = alphaMask.image.data;
    const resolution = alphaMask.image.width;
    const channelAt = (x, y) => pixels[(y * resolution + x) * 4 + 1];
    expect(channelAt(0, 0)).toBe(0);
    expect(channelAt(resolution - 1, resolution - 1)).toBe(0);
    expect(channelAt(Math.floor(resolution / 2), Math.floor(resolution / 2))).toBeGreaterThan(245);
    expect(channelAt(Math.floor(resolution * 0.82), Math.floor(resolution / 2))).toBeGreaterThan(0);
    expect(channelAt(Math.floor(resolution * 0.82), Math.floor(resolution / 2))).toBeLessThan(245);

    const dispose = vi.spyOn(alphaMask, "dispose");
    layer.dispose();
    layer.dispose();

    expect(dispose).toHaveBeenCalledOnce();
  });

  it("forms arm bands and outward radial progression for spirals while irregular galaxies are asymmetric and clumped", () => {
    const layer = createLocalGroup();
    const spiralPositions = layer.root.getObjectByName("group-andromeda-stars").geometry.getAttribute("position").array;
    const irregularPositions = layer.root.getObjectByName("group-lmc-stars").geometry.getAttribute("position").array;
    const armCount = 4;
    const radialDistance = (positions, index) => Math.hypot(positions[index * 3], positions[index * 3 + 1]);
    const firstArmAngles = Array.from({ length: armCount }, (_, index) => (
      Math.atan2(spiralPositions[index * 3 + 1], spiralPositions[index * 3])
    )).sort((left, right) => left - right);
    const gaps = firstArmAngles.map((angle, index) => (
      (firstArmAngles[(index + 1) % armCount] - angle + Math.PI * 2) % (Math.PI * 2)
    ));
    const irregularMeanX = Array.from({ length: irregularPositions.length / 3 }, (_, index) => (
      irregularPositions[index * 3]
    )).reduce((sum, value) => sum + value, 0) / (irregularPositions.length / 3);

    expect(gaps.every((gap) => gap > 1 && gap < 2.1)).toBe(true);
    expect(radialDistance(spiralPositions, spiralPositions.length / 3 - armCount)).toBeGreaterThan(
      radialDistance(spiralPositions, 0) * 4
    );
    expect(irregularMeanX).toBeGreaterThan(0.8);

    layer.dispose();
  });

  it("scales each visible galaxy core from its own profile and size", () => {
    const layer = createLocalGroup();
    const andromedaCore = layer.root.getObjectByName("group-andromeda-core");
    const lmcCore = layer.root.getObjectByName("group-lmc-core");

    expect(andromedaCore.scale.x).toBeGreaterThan(6);
    expect(andromedaCore.scale.x).toBeGreaterThan(lmcCore.scale.x);

    layer.dispose();
  });

  it("forms M32 as a deterministic, centered, smooth anisotropic ellipsoid distinct from spiral and clumped profiles", () => {
    const first = createLocalGroup();
    const second = createLocalGroup();
    const positions = first.root.getObjectByName("group-m32-stars").geometry.getAttribute("position").array;
    const pointCount = positions.length / 3;
    const m32Size = localGroupAnnotations.find(({ id }) => id === "group-m32").size;
    const horizontalRadius = m32Size * 0.78;
    const verticalRadius = m32Size * 0.86 * 0.4;
    const coordinate = (axis) => Array.from({ length: pointCount }, (_, index) => positions[index * 3 + axis]);
    const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const deviation = (values) => Math.sqrt(mean(values.map((value) => (value - mean(values)) ** 2)));
    const normalizedRadii = Array.from({ length: pointCount }, (_, index) => {
      const x = positions[index * 3] / horizontalRadius;
      const y = positions[index * 3 + 1] / verticalRadius;
      return Math.hypot(x, y);
    });

    expect(Math.abs(mean(coordinate(0)))).toBeLessThan(0.65);
    expect(Math.abs(mean(coordinate(1)))).toBeLessThan(0.35);
    expect(deviation(coordinate(0))).toBeGreaterThan(deviation(coordinate(1)) * 1.7);
    expect(normalizedRadii.every((radius) => radius <= 1.001)).toBe(true);
    expect(positions).toEqual(second.root.getObjectByName("group-m32-stars").geometry.getAttribute("position").array);

    first.dispose();
    second.dispose();
  });
});

const createCosmicWeb = (overrides = {}) => createCosmicWebLayer({
  THREE,
  quality: { tier: "economy", cosmicWebPoints: 2600 },
  glowTexture: null,
  reducedMotion: false,
  seed: 20260719,
  ...overrides
});

describe("createCosmicWebLayer", () => {
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

  it("changes the graph when the seed changes without mutating either input", () => {
    const quality = Object.freeze({ tier: "economy", cosmicWebPoints: 2600 });
    const first = createCosmicWeb({ quality, seed: 11 });
    const second = createCosmicWeb({ quality, seed: 12 });

    expect(first.graph.nodes).not.toEqual(second.graph.nodes);
    expect(quality).toEqual({ tier: "economy", cosmicWebPoints: 2600 });

    first.dispose();
    second.dispose();
  });

  it("supports the full safe-integer seed boundary", () => {
    const layer = createCosmicWeb({ seed: Number.MAX_SAFE_INTEGER });

    expect(layer.graph.nodes).toHaveLength(74);

    layer.dispose();
  });

  it.each([
    ["high", 9800],
    ["medium", 5200],
    ["economy", 2600]
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
    const high = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 9800 } });
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
    const layer = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 9800 } });
    const particles = layer.root.getObjectByName("cosmic-web-particles");
    const filaments = layer.root.getObjectByName("cosmic-web-filaments");
    const nodes = layer.root.getObjectByName("cosmic-web-nodes");
    const depth = layer.root.getObjectByName("cosmic-web-depth");

    expect([particles, filaments, nodes, depth].every(({ material }) => (
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
      quality: { tier: "high", cosmicWebPoints: 9800 },
      reducedMotion: true
    });
    const economy = createCosmicWeb();

    expect(reduced.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0, y: 0 });
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
      quality: { tier: "economy", cosmicWebPoints: 2600 },
      glowTexture: null,
      reducedMotion: false,
      seed: 20260719,
      ...overrides
    })).toThrow(TypeError);
  });

  it("disposes every resource tree only once", () => {
    const layer = createCosmicWeb();
    const particles = layer.root.getObjectByName("cosmic-web-particles");
    const disposeGeometry = vi.spyOn(particles.geometry, "dispose");
    const disposeMaterial = vi.spyOn(particles.material, "dispose");

    layer.dispose();
    layer.dispose();

    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
