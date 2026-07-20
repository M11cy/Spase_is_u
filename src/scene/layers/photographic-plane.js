import { clampPresence } from "./deep-space-utils.js";

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const requirePhotographicPlaneInput = ({
  THREE,
  texture,
  name,
  width,
  aspect,
  depth,
  opacity,
  renderOrder
}) => {
  if (!THREE
    || typeof THREE.Group !== "function"
    || typeof THREE.PlaneGeometry !== "function"
    || typeof THREE.MeshBasicMaterial !== "function"
    || typeof THREE.Mesh !== "function") {
    throw new TypeError("Photographic plane requires a compatible THREE namespace");
  }
  if (!texture || typeof texture !== "object") {
    throw new TypeError("Photographic plane requires a texture");
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new TypeError("Photographic plane requires a name");
  }
  if (!isFiniteNumber(width) || width <= 0 || !isFiniteNumber(aspect) || aspect <= 0) {
    throw new TypeError("Photographic plane width and aspect must be positive finite numbers");
  }
  if (!isFiniteNumber(depth) || !isFiniteNumber(opacity) || opacity < 0 || opacity > 1) {
    throw new TypeError("Photographic plane depth and opacity must be finite");
  }
  if (!Number.isInteger(renderOrder)) {
    throw new TypeError("Photographic plane render order must be an integer");
  }
};

const resolveParallax = (offset, factor) => {
  if (!offset || typeof offset !== "object" || !isFiniteNumber(factor)
    || !isFiniteNumber(offset.x) || !isFiniteNumber(offset.y)) {
    return Object.freeze({ x: 0, y: 0 });
  }
  return Object.freeze({ x: offset.x * factor, y: offset.y * factor });
};

export const createPhotographicPlane = (input = {}) => {
  const {
    THREE,
    texture,
    name,
    width,
    aspect,
    depth,
    opacity,
    renderOrder
  } = input;
  requirePhotographicPlaneInput({
    THREE,
    texture,
    name,
    width,
    aspect,
    depth,
    opacity,
    renderOrder
  });

  const root = new THREE.Group();
  root.name = `${name}-root`;
  root.position.z = depth;
  root.visible = false;

  const geometry = new THREE.PlaneGeometry(width, width / aspect);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    blending: THREE.NormalBlending
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.renderOrder = renderOrder;
  root.add(mesh);

  const baseOpacity = opacity;
  let disposed = false;

  const setPresence = (value) => {
    if (disposed) return;
    const presence = clampPresence(value);
    root.visible = presence > 0.01;
    material.opacity = baseOpacity * presence;
  };

  const setParallax = (offset, factor) => {
    if (disposed) return;
    const parallax = resolveParallax(offset, factor);
    root.position.x = parallax.x;
    root.position.y = parallax.y;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    geometry.dispose();
    material.dispose();
    root.clear();
  };

  return Object.freeze({ root, mesh, setPresence, setParallax, dispose });
};
