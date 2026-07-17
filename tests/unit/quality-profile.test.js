import { describe, expect, it } from "vitest";
import {
  createNearSpaceComposition,
  createQualityProfile
} from "../../src/core/quality-profile.js";

describe("createQualityProfile", () => {
  it.each([
    [{ width: 1920, dpr: 2, cores: 12, reducedMotion: false }, "high", 1.5, 9800],
    [{ width: 900, dpr: 2, cores: 6, reducedMotion: false }, "medium", 1.25, 5200],
    [{ width: 390, dpr: 3, cores: 4, reducedMotion: false }, "economy", 1, 2600]
  ])("selects a bounded profile", (input, tier, pixelRatio, cosmicWebPoints) => {
    expect(createQualityProfile(input)).toMatchObject({ tier, pixelRatio, cosmicWebPoints });
  });

  it("never raises the device pixel ratio", () => {
    expect(createQualityProfile({ width: 1920, dpr: 1, cores: 12, reducedMotion: false }).pixelRatio).toBe(1);
  });

  it("disables animated particles for reduced motion", () => {
    const profile = createQualityProfile({ width: 1920, dpr: 2, cores: 12, reducedMotion: true });

    expect(profile.animatedParticles).toBe(false);
  });

  it("disables animated particles for the economy tier", () => {
    const profile = createQualityProfile({ width: 390, dpr: 3, cores: 4, reducedMotion: false });

    expect(profile.animatedParticles).toBe(false);
  });

  it("returns an immutable profile", () => {
    const profile = createQualityProfile({ width: 900, dpr: 2, cores: 6, reducedMotion: false });

    expect(Object.isFrozen(profile)).toBe(true);
  });

  it("compacts near space for a narrow aspect above the phone breakpoint", () => {
    const profile = createQualityProfile({
      width: 900,
      height: 1200,
      dpr: 1,
      cores: 6,
      reducedMotion: false
    });

    expect(profile.compactNearSpace).toBe(true);
    expect(createNearSpaceComposition({ width: 900, height: 1200 })).toEqual({
      compact: true,
      labelSafeRightInset: 72
    });
    expect(Object.isFrozen(createNearSpaceComposition({ width: 1920, height: 1080 }))).toBe(true);
  });
});
