import { describe, expect, it } from "vitest";
import { createQualityProfile } from "./quality-profile.js";

describe("createQualityProfile deep-space budgets", () => {
  it.each([
    [
      "high-resolution desktop",
      { width: 1920, height: 1080, dpr: 3, cores: 16, reducedMotion: false },
      2
    ],
    [
      "medium-resolution device",
      { width: 900, height: 700, dpr: 3, cores: 8, reducedMotion: false },
      1.5
    ],
    [
      "economy-resolution device",
      { width: 390, height: 844, dpr: 3, cores: 8, reducedMotion: false },
      1.25
    ]
  ])("caps the pixel ratio for a %s", (_name, input, pixelRatio) => {
    expect(createQualityProfile(input).pixelRatio).toBe(pixelRatio);
  });

  it("keeps high bloom while reduced motion only disables movement", () => {
    const profile = createQualityProfile({
      width: 1920,
      height: 1080,
      dpr: 2,
      cores: 12,
      reducedMotion: true
    });

    expect(profile).toMatchObject({
      tier: "high",
      bloomEnabled: true,
      bloomStrength: 1.18,
      bloomRadius: 0.72,
      bloomThreshold: 0.48,
      bloomScale: 0.75,
      localGroupGalaxies: 260,
      animatedParticles: false
    });
    expect(Object.isFrozen(profile)).toBe(true);
  });

  it.each([
    [
      "medium",
      { width: 1024, height: 768, dpr: 2, cores: 8, reducedMotion: false },
      {
        bloomEnabled: true,
        bloomStrength: 0.92,
        bloomRadius: 0.58,
        bloomThreshold: 0.52,
        bloomScale: 0.5,
        localGroupGalaxies: 160
      }
    ],
    [
      "economy",
      { width: 390, height: 844, dpr: 3, cores: 12, reducedMotion: false },
      {
        bloomEnabled: false,
        bloomStrength: 0,
        bloomRadius: 0,
        bloomThreshold: 1,
        bloomScale: 0.5,
        localGroupGalaxies: 90
      }
    ]
  ])("adds the exact %s deep-space budget", (tier, input, expectedBudget) => {
    const profile = createQualityProfile(input);

    expect(profile).toMatchObject({ tier, ...expectedBudget });
  });
});
