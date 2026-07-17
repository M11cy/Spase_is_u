import { describe, expect, it } from "vitest";
import { computeStageState, interpolateCamera } from "../../src/core/stage-state.js";

describe("computeStageState", () => {
  it("returns immutable layer presence for the exact stage", () => {
    const state = computeStageState({ scrollY: 900, scrollHeight: 8000, viewportHeight: 800, stageCount: 8, reducedMotion: false });
    expect(state.exactStage).toBeCloseTo(0.875);
    expect(state.layerPresence).toHaveLength(8);
    expect(Object.isFrozen(state)).toBe(true);
  });

  it("removes spatial transition amount in reduced motion", () => {
    const state = computeStageState({ scrollY: 3600, scrollHeight: 8000, viewportHeight: 800, stageCount: 8, reducedMotion: true });
    expect(state.transitionAmount).toBe(0);
  });

  it("interpolates camera records without mutating them", () => {
    const from = { position: [0, 0, 10], target: [0, 0, 0], fov: 40 };
    const to = { position: [10, 0, 20], target: [2, 0, 0], fov: 50 };
    expect(interpolateCamera(from, to, 0.5)).toEqual({ position: [5, 0, 15], target: [1, 0, 0], fov: 45 });
    expect(from.position).toEqual([0, 0, 10]);
  });
});
