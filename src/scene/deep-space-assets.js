const ROUTES = Object.freeze(Object.fromEntries(
  [["high", "8k"], ["medium", "4k"], ["economy", "2k"]]
    .map(([tier, suffix]) => [tier, Object.freeze({
      milkyWay: `/space/milky-way-photo-${suffix}.jpg`,
      localGroup: `/space/local-group-photo-${suffix}.jpg`,
      cosmicWeb: `/space/cosmic-web-photo-${suffix}.jpg`
    })])
));

export const selectDeepSpaceTextureRoutes = (quality = {}) => {
  const routes = ROUTES[quality?.tier];
  if (!routes) throw new TypeError("Deep-space texture routes require a supported tier");
  return routes;
};
