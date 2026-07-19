import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
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
