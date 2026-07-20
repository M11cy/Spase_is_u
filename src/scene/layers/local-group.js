import { createPhotographicPlane } from "./photographic-plane.js";
import {
  clampPresence,
  disposeObjectTree,
  resolveParallax
} from "./deep-space-utils.js";

const ROOT_DEPTH = -138;
const PARALLAX_FACTOR = 0.12;
const SUPPORTED_TIERS = Object.freeze(new Set(["high", "medium", "economy"]));

const isPosition = (position) => Array.isArray(position)
  && position.length === 3
  && position.every((value) => typeof value === "number" && Number.isFinite(value));

const requireLayerInput = ({ THREE, texture, annotations, quality, createMarker, reducedMotion }) => {
  if (!THREE || typeof THREE.Group !== "function") {
    throw new TypeError("Local Group layer requires a compatible THREE namespace");
  }
  if (!texture || texture.isTexture !== true) {
    throw new TypeError("Local Group layer requires a THREE texture");
  }
  if (!Array.isArray(annotations)) {
    throw new TypeError("Local Group annotations must be an array");
  }
  if (!quality || typeof quality !== "object" || !SUPPORTED_TIERS.has(quality.tier)) {
    throw new TypeError("Local Group quality requires a supported tier");
  }
  if (typeof createMarker !== "function" || typeof reducedMotion !== "boolean") {
    throw new TypeError("Local Group layer requires a marker factory and reduced-motion preference");
  }
};

const createAnnotationMarkers = ({ THREE, annotations, createMarker, root }) => {
  const markerRoot = new THREE.Group();
  markerRoot.name = "local-group-markers";
  root.add(markerRoot);

  const interactive = annotations.flatMap((source) => {
    if (!source || typeof source !== "object" || !isPosition(source.position)) return [];

    const marker = createMarker(source);
    if (!marker || typeof marker !== "object" || typeof marker.position?.set !== "function") {
      return [];
    }

    const [x, y, sourceZ] = source.position;
    marker.position.set(x, y, sourceZ - ROOT_DEPTH);
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

export const createLocalGroupLayer = (input = {}) => {
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
    name: "local-group-photo",
    width: 780,
    aspect: 16 / 9,
    depth: ROOT_DEPTH,
    opacity: 1,
    renderOrder: 2
  });
  const root = photo.root;
  root.name = "local-group-layer";
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
