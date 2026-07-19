const HIGH_ROUTES = Object.freeze({
  surface: "/space/earth-daymap-8k.jpg",
  clouds: "/space/earth-clouds-4k.jpg"
});

const ECONOMY_ROUTES = Object.freeze({
  surface: "/space/earth-daymap-4k.jpg",
  clouds: "/space/earth-clouds-4k.jpg"
});

export const selectEarthTextureRoutes = (quality = {}) => (
  quality?.tier === "high" ? HIGH_ROUTES : ECONOMY_ROUTES
);
