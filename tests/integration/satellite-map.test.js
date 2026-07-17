import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import {
  MAP_ROOT_OVERSCAN,
  MIN_MAP_IMAGE_SCALE,
  WORLD_IMAGERY_ATTRIBUTION,
  WORLD_IMAGERY_URL,
  createSatelliteMap
} from "../../src/map/satellite-map.js";

const MOSCOW = Object.freeze({ lat: 55.7558, lon: 37.6173 });

const createFakeLeaflet = () => {
  const handlers = new Map();
  const map = {
    setView: vi.fn().mockReturnThis(),
    setZoom: vi.fn().mockReturnThis(),
    remove: vi.fn()
  };
  const tiles = {
    addTo: vi.fn().mockReturnThis(),
    on: vi.fn((type, handler) => {
      handlers.set(type, handler);
      return tiles;
    }),
    off: vi.fn((type, handler) => {
      if (handlers.get(type) === handler) handlers.delete(type);
      return tiles;
    })
  };
  const L = {
    map: vi.fn(() => map),
    tileLayer: vi.fn(() => tiles)
  };

  return Object.freeze({ L, map, tiles, handlers });
};

const createMapRoot = () => {
  const root = document.createElement("div");
  root.id = "mapRoot";
  root.innerHTML = '<p data-map-status role="status">Загрузка спутниковой карты…</p>';
  document.body.append(root);
  return root;
};

describe("createSatelliteMap", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the Moscow fallback immediately with every user interaction disabled", () => {
    const fake = createFakeLeaflet();
    const root = createMapRoot();

    createSatelliteMap({
      L: fake.L,
      root,
      initialLocation: MOSCOW,
      tileUrl: WORLD_IMAGERY_URL,
      attribution: WORLD_IMAGERY_ATTRIBUTION
    });

    expect(fake.L.map).toHaveBeenCalledWith(root, expect.objectContaining({
      attributionControl: true,
      boxZoom: false,
      doubleClickZoom: false,
      dragging: false,
      keyboard: false,
      scrollWheelZoom: false,
      touchZoom: false,
      zoomControl: false,
      zoomSnap: 0
    }));
    expect(fake.map.setView).toHaveBeenCalledWith([55.7558, 37.6173], 15, { animate: false });
    expect(fake.L.tileLayer).toHaveBeenCalledWith(WORLD_IMAGERY_URL, expect.objectContaining({
      attribution: WORLD_IMAGERY_ATTRIBUTION,
      maxZoom: 23
    }));
    expect(fake.tiles.addTo).toHaveBeenCalledWith(fake.map);
    expect(root.dataset.mapState).toBe("loading");
  });

  it("updates location immutably and accepts journey progress or a precomputed map zoom", () => {
    const fake = createFakeLeaflet();
    const root = createMapRoot();
    const controller = createSatelliteMap({
      L: fake.L,
      root,
      initialLocation: MOSCOW,
      tileUrl: WORLD_IMAGERY_URL,
      attribution: WORLD_IMAGERY_ATTRIBUTION
    });
    fake.map.setZoom.mockClear();

    const location = { lat: 59.9386, lon: 30.3141 };
    const appliedLocation = controller.setLocation(location);
    location.lat = 0;
    controller.setJourneyProgress(0.5);
    controller.setJourneyProgress(0.501);
    controller.setJourneyProgress(Object.freeze({ mapZoom: 8.25 }));
    controller.setJourneyProgress(1);

    expect(appliedLocation).toEqual({ lat: 59.9386, lon: 30.3141 });
    expect(Object.isFrozen(appliedLocation)).toBe(true);
    expect(fake.map.setView).toHaveBeenLastCalledWith([59.9386, 30.3141], 15, { animate: false });
    expect(fake.map.setZoom).not.toHaveBeenCalled();
    expect(root.style.getPropertyValue("--map-image-scale")).not.toBe("");
  });

  it("scales the loaded tile pane without changing leaflet zoom", () => {
    const fake = createFakeLeaflet();
    const root = createMapRoot();
    const controller = createSatelliteMap({ L: fake.L, root, initialLocation: MOSCOW });

    controller.setJourneyProgress({ mapZoom: 9, progress: 0.5 });
    controller.setJourneyProgress({ mapZoom: 3, progress: 0.9 });

    expect(fake.map.setZoom).not.toHaveBeenCalled();
    expect(root.style.getPropertyValue("--map-image-scale")).not.toBe("");
  });

  it("scales an oversized map root rather than a nested Leaflet pane", async () => {
    const fake = createFakeLeaflet();
    const layer = document.createElement("section");
    layer.className = "map-layer";
    const root = createMapRoot();
    const tilePane = document.createElement("div");
    tilePane.className = "leaflet-tile-pane";
    root.append(tilePane);
    layer.append(root);
    document.body.append(layer);

    createSatelliteMap({ L: fake.L, root, initialLocation: MOSCOW });
    const styles = await readFile("src/styles.css", "utf8");

    expect(root.querySelector(".leaflet-tile-pane")).toBe(tilePane);
    expect(MAP_ROOT_OVERSCAN * MIN_MAP_IMAGE_SCALE).toBeGreaterThanOrEqual(1);
    expect(styles).toMatch(/\.map-layer\s*>\s*#mapRoot\s*\{[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*width:\s*160vw;[^}]*height:\s*160vh;[^}]*transform:\s*translate\(-50%,\s*-50%\)\s*scale\(var\(--map-image-scale\)\);/s);
    expect(styles).not.toContain("#mapRoot .leaflet-tile-pane");
  });

  it("announces tile readiness and reports an unavailable satellite layer only once", () => {
    const fake = createFakeLeaflet();
    const root = createMapRoot();
    const onUnavailable = vi.fn();
    createSatelliteMap({
      L: fake.L,
      root,
      initialLocation: MOSCOW,
      tileUrl: WORLD_IMAGERY_URL,
      attribution: WORLD_IMAGERY_ATTRIBUTION,
      onUnavailable
    });
    const status = root.querySelector("[data-map-status]");

    fake.handlers.get("load")();
    expect(root.dataset.mapState).toBe("ready");
    expect(status.hidden).toBe(true);

    fake.handlers.get("tileerror")({ tile: "one" });
    fake.handlers.get("tileerror")({ tile: "two" });
    expect(root.dataset.mapState).toBe("unavailable");
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain("недоступна");
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it("applies exact city and orbit image scales", () => {
    const fake = createFakeLeaflet();
    const root = createMapRoot();
    const controller = createSatelliteMap({
      L: fake.L,
      root,
      initialLocation: MOSCOW,
      tileUrl: WORLD_IMAGERY_URL,
      attribution: WORLD_IMAGERY_ATTRIBUTION
    });
    fake.map.setZoom.mockClear();

    controller.setJourneyProgress(0);
    const cityScale = root.style.getPropertyValue("--map-image-scale");
    controller.setJourneyProgress(1);

    expect(cityScale).toBe("1");
    expect(Number(root.style.getPropertyValue("--map-image-scale"))).toBeCloseTo(0.66);
    expect(fake.map.setZoom).not.toHaveBeenCalled();
  });

  it("records journey progress as a transform-only state", () => {
    const fake = createFakeLeaflet();
    const root = createMapRoot();
    const controller = createSatelliteMap({
      L: fake.L,
      root,
      initialLocation: MOSCOW,
      tileUrl: WORLD_IMAGERY_URL,
      attribution: WORLD_IMAGERY_ATTRIBUTION
    });

    controller.setJourneyProgress({ mapZoom: 8.25, progress: 0.55 });

    expect(root.dataset.journeyProgress).toBe("0.55");
    expect(root.querySelector(".satellite-map-snapshot")).toBeNull();
    expect(fake.map.setZoom).not.toHaveBeenCalled();
  });

  it("disposes listeners and the map once and performs no terminal work", () => {
    const fake = createFakeLeaflet();
    const onUnavailable = vi.fn();
    const controller = createSatelliteMap({
      L: fake.L,
      root: createMapRoot(),
      initialLocation: MOSCOW,
      tileUrl: WORLD_IMAGERY_URL,
      attribution: WORLD_IMAGERY_ATTRIBUTION,
      onUnavailable
    });
    const lateTileError = fake.handlers.get("tileerror");
    fake.map.setView.mockClear();
    fake.map.setZoom.mockClear();

    controller.dispose();
    controller.dispose();
    controller.setLocation({ lat: 1, lon: 2 });
    controller.setJourneyProgress(1);
    lateTileError(new Error("late"));

    expect(fake.tiles.off).toHaveBeenCalledTimes(2);
    expect(fake.map.remove).toHaveBeenCalledTimes(1);
    expect(fake.map.setView).not.toHaveBeenCalled();
    expect(fake.map.setZoom).not.toHaveBeenCalled();
    expect(onUnavailable).not.toHaveBeenCalled();
  });
});
