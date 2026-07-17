export const WORLD_IMAGERY_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const WORLD_IMAGERY_ATTRIBUTION = "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community";
export const MAP_ROOT_OVERSCAN = 1.6;
export const MIN_MAP_IMAGE_SCALE = 0.66;

const CITY_ZOOM = 15;
const ORBIT_ZOOM = 2.75;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const copyLocation = (location) => {
  const lat = Number(location?.lat);
  const lon = Number(location?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new TypeError("Satellite map location must contain valid latitude and longitude");
  }
  return Object.freeze({ lat, lon });
};

const resolveZoom = (journeyProgress) => {
  if (typeof journeyProgress === "object" && journeyProgress !== null) {
    const mapZoom = Number(journeyProgress.mapZoom);
    if (!Number.isFinite(mapZoom)) throw new TypeError("Journey state must contain a finite mapZoom");
    return clamp(mapZoom, ORBIT_ZOOM, CITY_ZOOM);
  }

  const progress = Number(journeyProgress);
  if (!Number.isFinite(progress)) throw new TypeError("Journey progress must be finite");
  return CITY_ZOOM + (ORBIT_ZOOM - CITY_ZOOM) * clamp(progress, 0, 1);
};

const resolveImageScale = (mapZoom) => {
  const progress = clamp((CITY_ZOOM - mapZoom) / (CITY_ZOOM - ORBIT_ZOOM), 0, 1);
  return 1 - progress * (1 - MIN_MAP_IMAGE_SCALE);
};

const setStatus = (root, state, message = "") => {
  root.dataset.mapState = state;
  const status = root.querySelector("[data-map-status]");
  if (!status) return;
  status.hidden = state === "ready";
  if (message) status.textContent = message;
};

export function createSatelliteMap({
  L,
  root,
  initialLocation,
  tileUrl = WORLD_IMAGERY_URL,
  attribution = WORLD_IMAGERY_ATTRIBUTION,
  onUnavailable = () => {}
}) {
  if (!L?.map || !L?.tileLayer) throw new TypeError("A Leaflet-compatible adapter is required");
  if (!root?.dataset) throw new TypeError("A map root element is required");

  const firstLocation = copyLocation(initialLocation);
  let disposed = false;
  let unavailableReported = false;
  let currentZoom = CITY_ZOOM;

  setStatus(root, "loading", "Загрузка спутниковой карты…");
  const map = L.map(root, {
    attributionControl: true,
    boxZoom: false,
    doubleClickZoom: false,
    dragging: false,
    keyboard: false,
    scrollWheelZoom: false,
    touchZoom: false,
    zoomControl: false,
    zoomSnap: 0
  });
  map.setView([firstLocation.lat, firstLocation.lon], CITY_ZOOM, { animate: false });

  const tiles = L.tileLayer(tileUrl, {
    attribution,
    maxZoom: 23,
    minZoom: 0,
    noWrap: false
  });

  const handleLoad = () => {
    if (disposed || unavailableReported) return;
    setStatus(root, "ready");
  };

  const handleTileError = (event) => {
    if (disposed || unavailableReported) return;
    unavailableReported = true;
    setStatus(root, "unavailable", "Спутниковая карта недоступна — продолжаем с локальной Землёй.");
    onUnavailable(event);
  };

  tiles.on("load", handleLoad);
  tiles.on("tileerror", handleTileError);
  tiles.addTo(map);

  const setLocation = (location) => {
    if (disposed) return undefined;
    const nextLocation = copyLocation(location);
    map.setView([nextLocation.lat, nextLocation.lon], CITY_ZOOM, { animate: false });
    return nextLocation;
  };

  const setJourneyProgress = (journeyProgress) => {
    if (disposed) return undefined;
    const nextZoom = resolveZoom(journeyProgress);
    currentZoom = nextZoom;
    root.style.setProperty("--map-image-scale", String(resolveImageScale(nextZoom)));
    root.dataset.journeyProgress = String(journeyProgress?.progress ?? 0);
    return currentZoom;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    tiles.off("load", handleLoad);
    tiles.off("tileerror", handleTileError);
    map.remove();
  };

  return Object.freeze({ setLocation, setJourneyProgress, dispose });
}
