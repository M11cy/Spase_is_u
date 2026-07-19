import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
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
  it("creates a layered volumetric galaxy using the quality point count", () => {
    const layer = createLayer({ quality: { tier: "economy", galaxyPoints: 900 } });

    expect(layer.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").count).toBe(900);
    expect(layer.root.getObjectByName("milky-way-dust")).toBeTruthy();
    expect(layer.root.getObjectByName("milky-way-halo")).toBeTruthy();
    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0, y: 0 });

    layer.dispose();
  });

  it("uses the shared high-quality parallax response", () => {
    const layer = createLayer();

    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 1.6, y: -1.1 });

    layer.dispose();
  });

  it("keeps stars, dust, core, and halo as independently faded transparent 3D layers", () => {
    const layer = createLayer();
    const stars = layer.root.getObjectByName("milky-way-stars");
    const dust = layer.root.getObjectByName("milky-way-dust");
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

  it("generates deterministic logarithmic-arm positions and creates annotation markers", () => {
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

    first.dispose();
    second.dispose();
  });

  it("forms four separated logarithmic arm bands with outward radial progression", () => {
    const layer = createLayer();
    const positions = layer.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").array;
    const { armCount, discDepthScale, pattern } = layer.root.userData.armStructure;
    const pointCount = positions.length / 3;
    const radialDistance = (index) => {
      const offset = index * 3;
      return Math.hypot(positions[offset], positions[offset + 2] / discDepthScale);
    };
    const firstAngles = Array.from({ length: armCount }, (_, arm) => {
      const offset = arm * 3;
      return Math.atan2(positions[offset + 2] / discDepthScale, positions[offset]);
    }).sort((left, right) => left - right);
    const angularGaps = firstAngles.map((angle, index) => (
      (firstAngles[(index + 1) % armCount] - angle + Math.PI * 2) % (Math.PI * 2)
    ));

    expect(Object.isFrozen(layer.root.userData.armStructure)).toBe(true);
    expect(pattern).toBe("logarithmic");
    expect(armCount).toBe(4);
    expect(angularGaps.every((gap) => gap > 1 && gap < 2.1)).toBe(true);
    expect(Array.from({ length: armCount }, (_, arm) => (
      radialDistance(pointCount - armCount + arm) > radialDistance(arm) * 8
    )).every(Boolean)).toBe(true);

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
});
