import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createPhotographicPlane } from "./photographic-plane.js";

const createPlane = (overrides = {}) => {
  const texture = new THREE.Texture();
  const options = {
    THREE,
    texture,
    name: "test-photo",
    width: 400,
    aspect: 16 / 9,
    depth: -80,
    opacity: 0.94,
    renderOrder: 2,
    ...overrides
  };

  return { plane: createPhotographicPlane(options), texture };
};

describe("createPhotographicPlane", () => {
  it("creates a camera-facing photographic material with the supplied geometry", () => {
    const { plane, texture } = createPlane();

    expect(plane.root.name).toBe("test-photo-root");
    expect(plane.root.position.z).toBe(-80);
    expect(plane.root.visible).toBe(false);
    expect(plane.mesh.name).toBe("test-photo");
    expect(plane.mesh.geometry.parameters).toMatchObject({ width: 400, height: 225 });
    expect(plane.mesh.material).toMatchObject({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      blending: THREE.NormalBlending,
      opacity: 0.94
    });
    expect(plane.mesh.renderOrder).toBe(2);

    plane.dispose();
  });

  it("clamps presence without changing the immutable base opacity", () => {
    const { plane } = createPlane();

    plane.setPresence(0.5);
    expect(plane.root.visible).toBe(true);
    expect(plane.mesh.material.opacity).toBeCloseTo(0.47);

    plane.setPresence(2);
    expect(plane.mesh.material.opacity).toBeCloseTo(0.94);

    plane.setPresence(Number.NaN);
    expect(plane.root.visible).toBe(false);
    expect(plane.mesh.material.opacity).toBe(0);

    plane.dispose();
  });

  it("applies parallax only to x and y while preserving the supplied depth", () => {
    const { plane } = createPlane();

    const offset = Object.freeze({ x: 4, y: -2 });
    plane.setParallax(offset, 0.25);

    expect(plane.root.position.toArray()).toEqual([1, -0.5, -80]);
    expect(offset).toEqual({ x: 4, y: -2 });

    plane.setParallax({ x: "4", y: -2 }, 0.25);
    expect(plane.root.position.toArray()).toEqual([0, 0, -80]);

    plane.dispose();
  });

  it("disposes only its geometry and material exactly once", () => {
    const { plane, texture } = createPlane();
    const geometryDispose = vi.spyOn(plane.mesh.geometry, "dispose");
    const materialDispose = vi.spyOn(plane.mesh.material, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");

    plane.dispose();
    plane.dispose();

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).not.toHaveBeenCalled();
  });

  it.each([
    { THREE: null },
    { texture: null },
    { texture: {} },
    { texture: { texture: new THREE.Texture(), release() {} } },
    { name: "" },
    { width: 0 },
    { aspect: Number.NaN },
    { depth: Infinity },
    { opacity: "0.94" },
    { opacity: -0.01 },
    { opacity: 1.01 },
    { renderOrder: 1.5 }
  ])("rejects invalid boundary input %j", (overrides) => {
    expect(() => createPlane(overrides)).toThrow(TypeError);
  });
});
