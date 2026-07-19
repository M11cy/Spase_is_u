const PROFILES = Object.freeze({
  high: Object.freeze({
    tier: "high",
    pixelRatio: 1.5,
    stars: 5200,
    cosmicWebPoints: 9800,
    galaxyPoints: 2600
  }),
  medium: Object.freeze({
    tier: "medium",
    pixelRatio: 1.25,
    stars: 3600,
    cosmicWebPoints: 5200,
    galaxyPoints: 1700
  }),
  economy: Object.freeze({
    tier: "economy",
    pixelRatio: 1,
    stars: 1800,
    cosmicWebPoints: 2600,
    galaxyPoints: 900
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
    pixelRatio: Math.min(base.pixelRatio, dpr),
    animatedParticles: !reducedMotion && tier !== "economy",
    compactNearSpace: createNearSpaceComposition({ width, height }).compact
  });
};
