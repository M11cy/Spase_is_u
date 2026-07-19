import { describe, expect, it, vi } from "vitest";
import {
  clampPresence,
  createSeededRandom,
  disposeObjectTree,
  resolveParallax
} from "./deep-space-utils.js";

describe("deep space utilities", () => {
  it("repeats the same random sequence for a valid seed", () => {
    const first = createSeededRandom(1977);
    const second = createSeededRandom(1977);

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });

  it.each([undefined, null, "1977", Number.NaN, Infinity])("rejects invalid random seed %s", (seed) => {
    expect(() => createSeededRandom(seed)).toThrow(TypeError);
  });

  it("clamps finite presence values and fails closed for invalid values", () => {
    expect(clampPresence(-1)).toBe(0);
    expect(clampPresence(0.4)).toBe(0.4);
    expect(clampPresence(3)).toBe(1);
    expect(clampPresence(Number.NaN)).toBe(0);
    expect(clampPresence("0.4")).toBe(0);
  });

  it("resolves parallax by quality tier without mutating its input", () => {
    const input = { x: 1, y: -1, reducedMotion: false, tier: "high" };

    expect(resolveParallax(input)).toEqual({ x: 1.6, y: -1.1 });
    expect(resolveParallax({ ...input, tier: "medium" })).toMatchObject({
      x: expect.closeTo(0.88),
      y: expect.closeTo(-0.605)
    });
    expect(resolveParallax({ ...input, tier: "economy" })).toEqual({ x: 0, y: 0 });
    expect(resolveParallax({ ...input, reducedMotion: true })).toEqual({ x: 0, y: 0 });
    expect(input).toEqual({ x: 1, y: -1, reducedMotion: false, tier: "high" });
  });

  it.each([
    undefined,
    null,
    {},
    { x: 1, y: 1, reducedMotion: false, tier: "ultra" },
    { x: "1", y: 1, reducedMotion: false, tier: "high" },
    { x: 1, y: 1, reducedMotion: "false", tier: "high" }
  ])("fails closed for invalid parallax input %j", (input) => {
    expect(resolveParallax(input)).toEqual({ x: 0, y: 0 });
  });

  it("disposes unique geometries and materials once, including material arrays", () => {
    const geometry = { dispose: vi.fn() };
    const material = { dispose: vi.fn() };
    const alternateMaterial = { dispose: vi.fn() };
    const root = {
      traverse: (visit) => [{ geometry, material: [material, alternateMaterial] }, { geometry, material }].forEach(visit),
      clear: vi.fn()
    };

    disposeObjectTree(root);

    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
    expect(alternateMaterial.dispose).toHaveBeenCalledTimes(1);
    expect(root.clear).toHaveBeenCalledOnce();
  });

  it("tolerates incomplete object trees and only disposes callable resources", () => {
    const geometry = { dispose: vi.fn() };
    const material = { dispose: vi.fn() };
    const root = {
      traverse: (visit) => [null, {}, { geometry: {} }, { geometry, material: [null, {}, material] }].forEach(visit),
      clear: vi.fn()
    };

    expect(() => disposeObjectTree(root)).not.toThrow();
    expect(geometry.dispose).toHaveBeenCalledOnce();
    expect(material.dispose).toHaveBeenCalledOnce();
    expect(root.clear).toHaveBeenCalledOnce();
  });

  it.each([undefined, null, {}, { clear: vi.fn() }, { traverse: vi.fn() }])("fails closed for invalid disposal root %j", (root) => {
    expect(() => disposeObjectTree(root)).not.toThrow();
  });
});
