const ZERO_PARALLAX = Object.freeze({ x: 0, y: 0 });

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const canDispose = (resource) => resource && typeof resource.dispose === "function";

const disposeSafely = (resource) => {
  try {
    resource.dispose();
  } catch {
    // Cleanup must continue so one faulty resource cannot leak the remaining tree.
  }
};

export const clampPresence = (value) => (
  isFiniteNumber(value) ? Math.min(1, Math.max(0, value)) : 0
);

export const createSeededRandom = (seed) => {
  if (!Number.isInteger(seed) || !Number.isSafeInteger(seed)) {
    throw new TypeError("Random seed must be a safe integer");
  }

  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

export const resolveParallax = (input) => {
  if (!input || typeof input !== "object") return ZERO_PARALLAX;

  const { x, y, reducedMotion, tier } = input;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || typeof reducedMotion !== "boolean") {
    return ZERO_PARALLAX;
  }
  if (reducedMotion || tier === "economy") return ZERO_PARALLAX;

  const factor = tier === "high" ? 1 : tier === "medium" ? 0.55 : 0;
  return factor === 0
    ? ZERO_PARALLAX
    : Object.freeze({ x: x * 1.6 * factor, y: y * 1.1 * factor });
};

export const disposeObjectTree = (root) => {
  if (!root || typeof root !== "object") return;

  const geometries = new Set();
  const materials = new Set();
  const collect = (object) => {
    if (!object || typeof object !== "object") return;
    if (canDispose(object.geometry)) geometries.add(object.geometry);

    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(canDispose).forEach((material) => materials.add(material));
  };

  try {
    if (typeof root.traverse === "function") root.traverse(collect);
    else collect(root);
  } catch {
    // The root can be partially constructed; still release resources already found.
  }

  geometries.forEach(disposeSafely);
  materials.forEach(disposeSafely);

  try {
    if (typeof root.clear === "function") root.clear();
  } catch {
    // There is no safe recovery path for a partially constructed root.
  }
};
