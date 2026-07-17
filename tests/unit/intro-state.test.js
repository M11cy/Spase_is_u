import { describe, expect, it } from "vitest";
import { createIntroState } from "../../src/core/intro-state.js";

describe("createIntroState", () => {
  it("keeps the journey locked until start", () => {
    expect(createIntroState({ started: false, elapsed: 0, reducedMotion: false })).toEqual(
      expect.objectContaining({ active: true, scrollLocked: true, earthSpin: 0 })
    );
  });

  it("reduces motion without stopping the scene", () => {
    const state = createIntroState({ started: false, elapsed: 10, reducedMotion: true });

    expect(state.earthSpin).toBeGreaterThan(0);
    expect(state.earthSpin).toBeLessThan(0.02);
  });

  it("returns a frozen state with normalized elapsed time", () => {
    const state = createIntroState({ started: true, elapsed: -1, reducedMotion: false });

    expect(state).toEqual(expect.objectContaining({ active: false, scrollLocked: false, earthSpin: 0 }));
    expect(Object.isFrozen(state)).toBe(true);
  });
});
