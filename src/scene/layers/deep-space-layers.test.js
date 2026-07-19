import * as THREE from "three";
import { describe, expect, it } from "vitest";
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

  it.each([
    undefined,
    null,
    {},
    { tier: "high", galaxyPoints: 0 },
    { tier: "high", galaxyPoints: 1.5 }
  ])("rejects invalid quality input %j", (quality) => {
    expect(() => createLayer({ quality })).toThrow(TypeError);
  });

  it("fails closed for invalid presence and parallax input", () => {
    const layer = createLayer();

    layer.setPresence("visible");
    expect(layer.root.visible).toBe(false);
    expect(layer.updateParallax({ x: 1, y: "-1" })).toEqual({ x: 0, y: 0 });
    expect(layer.updateParallax(null)).toEqual({ x: 0, y: 0 });

    layer.dispose();
  });
});
