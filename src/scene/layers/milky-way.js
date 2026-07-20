import { createPhotographicPlane } from "./photographic-plane.js";
import {
  clampPresence,
  disposeObjectTree,
  resolveParallax
} from "./deep-space-utils.js";

const ROOT_DEPTH = -80;
const PARALLAX_FACTOR = 0.18;
const SUPPORTED_TIERS = Object.freeze(new Set(["high", "medium", "economy"]));
const PHOTO_ANCHORS = Object.freeze({
  "galactic-center": Object.freeze([0, 0, 1]),
  "orion-arm": Object.freeze([70, -11.25, 1]),
  "perseus-arm": Object.freeze([-115, 14.0625, 1]),
  "galactic-halo": Object.freeze([15, 90, 1])
});

const isPosition = (position) => Array.isArray(position)
  && position.length === 3
  && position.every((value) => typeof value === "number" && Number.isFinite(value));

const requireLayerInput = ({ THREE, texture, annotations, quality, createMarker, reducedMotion }) => {
  if (!THREE || typeof THREE.Group !== "function") {
    throw new TypeError("Milky Way layer requires a compatible THREE namespace");
  }
  if (!texture || texture.isTexture !== true) {
    throw new TypeError("Milky Way layer requires a THREE texture");
  }
  if (!Array.isArray(annotations)) {
    throw new TypeError("Milky Way annotations must be an array");
  }
  if (!quality || typeof quality !== "object" || !SUPPORTED_TIERS.has(quality.tier)) {
    throw new TypeError("Milky Way quality requires a supported tier");
  }
  if (typeof createMarker !== "function" || typeof reducedMotion !== "boolean") {
    throw new TypeError("Milky Way layer requires a marker factory and reduced-motion preference");
  }
};

const resolveMarkerPosition = (source) => (
  PHOTO_ANCHORS[source.id]
  ?? Object.freeze([source.position[0], source.position[1], source.position[2] - ROOT_DEPTH])
);

const createAnnotationMarkers = ({ THREE, annotations, createMarker, root }) => {
  const markerRoot = new THREE.Group();
  markerRoot.name = "milky-way-markers";
  root.add(markerRoot);

  const interactive = annotations.flatMap((source) => {
    if (!source || typeof source !== "object" || !isPosition(source.position)) return [];

    const marker = createMarker(source);
    if (!marker || typeof marker !== "object" || typeof marker.position?.set !== "function") {
      return [];
    }

    const [x, y, z] = resolveMarkerPosition(source);
    marker.position.set(x, y, z);
    marker.userData.baseOpacity = marker.material?.opacity ?? 1;
    const annotation = Object.freeze({ ...source, object3D: marker });
    marker.userData.annotation = annotation;
    marker.userData.stage = annotation.stage;
    marker.renderOrder = 3;
    markerRoot.add(marker);
    return [marker];
  });

  return Object.freeze({ markerRoot, interactive: Object.freeze(interactive) });
};

const setMarkerPresence = (interactive, presence) => {
  interactive.forEach((marker) => {
    const materials = Array.isArray(marker.material) ? marker.material : [marker.material];
    materials.filter(Boolean).forEach((material) => {
      material.opacity = marker.userData.baseOpacity * presence;
    });
  });
};

export const createMilkyWayLayer = (input = {}) => {
  const {
    THREE,
    texture,
    annotations,
    quality,
    createMarker,
    reducedMotion
  } = input;
  requireLayerInput({ THREE, texture, annotations, quality, createMarker, reducedMotion });

  const photo = createPhotographicPlane({
    THREE,
    texture,
    name: "milky-way-photo",
    width: 500,
    aspect: 16 / 9,
    depth: ROOT_DEPTH,
    opacity: 1,
    renderOrder: 2
  });
  const root = photo.root;
  root.name = "milky-way-layer";
  const { markerRoot, interactive } = createAnnotationMarkers({
    THREE,
    annotations,
    createMarker,
    root
  });
  let disposed = false;

  return Object.freeze({
    root,
    interactive,
    setPresence: (value) => {
      if (disposed) return;
      const presence = clampPresence(value);
      photo.setPresence(presence);
      setMarkerPresence(interactive, presence);
    },
    updateParallax: (pointer = {}) => {
      if (disposed) return Object.freeze({ x: root.position.x, y: root.position.y });
      const { x, y } = pointer && typeof pointer === "object" ? pointer : {};
      const offset = resolveParallax({ x, y, reducedMotion, tier: quality.tier });
      photo.setParallax(offset, PARALLAX_FACTOR);
      return Object.freeze({ x: root.position.x, y: root.position.y });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      disposeObjectTree(markerRoot);
      photo.dispose();
    }
  });
};
