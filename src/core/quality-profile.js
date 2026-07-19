const PROFILES = Object.freeze({
  high: Object.freeze({
    tier: "high",
    pixelRatio: 1.5,
    stars: 5200,
    cosmicWebPoints: 9800,
    galaxyPoints: 9000
  }),
  medium: Object.freeze({
    tier: "medium",
    pixelRatio: 1.25,
    stars: 3600,
    cosmicWebPoints: 5200,
    galaxyPoints: 5600
  }),
  economy: Object.freeze({
    tier: "economy",
    pixelRatio: 1,
    stars: 1800,
    cosmicWebPoints: 2600,
    galaxyPoints: 2800
  })
});

const DEEP_SPACE = Object.freeze({
  high: Object.freeze({
    bloomEnabled: true,
    bloomStrength: 1.18,
    bloomRadius: 0.72,
    bloomThreshold: 0.48,
    bloomScale: 0.75,
    localGroupGalaxies: 260
  }),
  medium: Object.freeze({
    bloomEnabled: true,
    bloomStrength: 0.92,
    bloomRadius: 0.58,
    bloomThreshold: 0.52,
    bloomScale: 0.5,
    localGroupGalaxies: 160
  }),
  economy: Object.freeze({
    bloomEnabled: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 1,
    bloomScale: 0.5,
    localGroupGalaxies: 90
  })
});

export const createNearSpaceComposition = ({ width, height = width }) => {
  const aspect = height > 0 ? width / height : 1;
  const compact = width <= 760 || aspect < 0.9;
  return Object.freeze({ compact, labelSafeRightInset: compact ? 72 : 0 });
};

export const createQualityProfile = ({ width, height = width, dpr, cores, reducedMotion }) => {
  const tier = width <= 480 || cores <= 4
    ? "economy"
    : width <= 1100 || cores <= 8
      ? "medium"
      : "high";
  const base = PROFILES[tier];

  return Object.freeze({
    ...base,
    ...DEEP_SPACE[tier],
    pixelRatio: Math.min(base.pixelRatio, dpr),
    animatedParticles: !reducedMotion && tier !== "economy",
    compactNearSpace: createNearSpaceComposition({ width, height }).compact
  });
};
