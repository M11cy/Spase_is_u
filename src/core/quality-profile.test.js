import { describe, expect, it } from "vitest";
import { createQualityProfile } from "./quality-profile.js";

describe("createQualityProfile deep-space budgets", () => {
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
