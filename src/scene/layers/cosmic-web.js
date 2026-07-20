import { createPhotographicPlane } from "./photographic-plane.js";
import {
  clampPresence,
  resolveParallax
} from "./deep-space-utils.js";

const SUPPORTED_TIERS = Object.freeze(new Set(["high", "medium", "economy"]));
const PRIMARY_PARALLAX_FACTOR = 0.12;
const SECONDARY_PARALLAX_FACTOR = 0.05;
const INTERACTIVE = Object.freeze([]);

const requireLayerInput = ({ THREE, texture, quality, reducedMotion }) => {
  if (!THREE || typeof THREE.Group !== "function") {
    throw new TypeError("Cosmic web layer requires a compatible THREE namespace");
  }
  if (!texture || texture.isTexture !== true) {
    throw new TypeError("Cosmic web layer requires a THREE texture");
  }
  if (!quality || typeof quality !== "object" || !SUPPORTED_TIERS.has(quality.tier)) {
    throw new TypeError("Cosmic web quality requires a supported tier");
  }
  if (typeof reducedMotion !== "boolean") {
    throw new TypeError("Cosmic web layer requires a reduced-motion preference");
  }
};
export const createCosmicWebLayer = (input = {}) => {
  const {
    THREE,
    texture,
    quality,
    reducedMotion
  } = input;
  requireLayerInput({ THREE, texture, quality, reducedMotion });

  const primary = createPhotographicPlane({
    THREE,
    texture,
    name: "cosmic-web-photo-primary",
    width: 1760,
    aspect: 16 / 9,
    depth: -235,
    opacity: 0.17,
    renderOrder: 2
  });
  const secondary = createPhotographicPlane({
    THREE,
    texture,
    name: "cosmic-web-photo-secondary",
    width: 1880,
    aspect: 16 / 9,
    depth: -300,
    opacity: 0.034,
    renderOrder: 1
  });
  primary.mesh.material.fog = false;
  secondary.mesh.material.fog = false;
  secondary.mesh.position.set(7, -4, 0);
  secondary.mesh.scale.set(1.025, 1.025, 1);
  secondary.mesh.rotation.z = -0.012;

  const root = new THREE.Group();
  root.name = "cosmic-web-layer";
  root.visible = false;
  root.add(secondary.root, primary.root);
  let disposed = false;

  return Object.freeze({
    root,
    interactive: INTERACTIVE,
    setPresence: (value) => {
      if (disposed) return;
      const presence = clampPresence(value);
      root.visible = presence > 0.01;
      primary.setPresence(presence);
      secondary.setPresence(presence);
    },
    updateParallax: (pointer = {}) => {
      if (disposed) {
        return Object.freeze({ x: primary.root.position.x, y: primary.root.position.y });
      }
      const { x, y } = pointer && typeof pointer === "object" ? pointer : {};
      const offset = resolveParallax({ x, y, reducedMotion, tier: quality.tier });
      primary.setParallax(offset, PRIMARY_PARALLAX_FACTOR);
      secondary.setParallax(offset, SECONDARY_PARALLAX_FACTOR);
      return Object.freeze({ x: primary.root.position.x, y: primary.root.position.y });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      primary.dispose();
      secondary.dispose();
      root.clear();
    }
  });
};
