import {
  clampPresence,
  createSeededRandom,
  disposeObjectTree
} from "./deep-space-utils.js";

const PROFILE_ORDER = Object.freeze({
  high: Object.freeze(["far", "mid", "near"]),
  medium: Object.freeze(["far", "near"]),
  economy: Object.freeze(["mid"])
});

const PROFILES = Object.freeze({
  far: Object.freeze({ depth: -300, parallax: 0.22, opacity: 0.62, salt: 0x243f6a88 }),
  mid: Object.freeze({ depth: -235, parallax: 0.46, opacity: 0.78, salt: 0x85a308d3 }),
  near: Object.freeze({ depth: -170, parallax: 0.74, opacity: 0.58, salt: 0x13198a2e })
});

const TIER_OPACITY_SCALE = Object.freeze({ high: 1, medium: 1.55, economy: 2.35 });
const TIER_DENSITY_SCALE = Object.freeze({ high: 1, medium: 0.9, economy: 0.78 });
const MAX_ROOT_PARALLAX = Object.freeze({
  high: Object.freeze({ x: 1.6, y: 1.1 }),
  medium: Object.freeze({ x: 0.88, y: 0.605 }),
  economy: Object.freeze({ x: 0, y: 0 })
});
const PALETTE = Object.freeze([0x8b5cf6, 0xd946ef, 0xf472b6, 0xf59e42]);
const REQUIRED_THREE_CONSTRUCTORS = Object.freeze([
  "Group",
  "PlaneGeometry",
  "Mesh",
  "ShaderMaterial",
  "Color",
  "Vector2"
]);

const VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 vUv;
  uniform vec2 uUvOffset;
  uniform float uOpacity;
  uniform float uPresence;
  uniform float uDensityScale;
  uniform vec3 uViolet;
  uniform vec3 uMagenta;
  uniform vec3 uPink;
  uniform vec3 uOrange;

  float hash21(vec2 point) {
    vec3 value = fract(vec3(point.xyx) * 0.1031);
    value += dot(value, value.yzx + 33.33);
    return fract((value.x + value.y) * value.z);
  }

  vec2 hash22(vec2 point) {
    vec3 value = fract(vec3(point.xyx) * vec3(0.1031, 0.1030, 0.0973));
    value += dot(value, value.yzx + 33.33);
    return fract((value.xx + value.yz) * value.zy);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    vec2 blend = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), blend.x),
      mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0)), blend.x),
      blend.y
    );
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave += 1) {
      value += valueNoise(point) * amplitude;
      point = mat2(1.6, -1.2, 1.2, 1.6) * point + 0.17;
      amplitude *= 0.5;
    }
    return value;
  }

  float cellularRidge(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    float nearest = 10.0;
    float secondNearest = 10.0;
    for (int y = -1; y <= 1; y += 1) {
      for (int x = -1; x <= 1; x += 1) {
        vec2 neighbor = vec2(float(x), float(y));
        float distanceToCell = length(neighbor + hash22(cell + neighbor) - local);
        if (distanceToCell < nearest) {
          secondNearest = nearest;
          nearest = distanceToCell;
        } else if (distanceToCell < secondNearest) {
          secondNearest = distanceToCell;
        }
      }
    }
    return 1.0 - smoothstep(0.035, 0.24, secondNearest - nearest);
  }

  float fineDust(vec2 point) {
    vec2 dustCell = floor(point * 56.0 + uUvOffset * 7.0);
    float grain = hash21(dustCell);
    float cluster = valueNoise(point * 5.3 + 11.7);
    return smoothstep(0.95, 0.998, grain) * (0.35 + cluster * 0.65);
  }

  void main() {
    vec2 point = vUv * vec2(6.4, 3.8) + uUvOffset;
    float warpNoise = fbm(point * 0.72 + vec2(4.1, 1.7));
    vec2 warp = vec2(
      warpNoise,
      valueNoise(point * 1.17 + vec2(-2.8, 5.6))
    );
    point += (warp - 0.5) * 0.72;

    float rawRidge = cellularRidge(point * 12.2 + warp * 0.62);
    float thinRidge = smoothstep(0.95, 0.998, rawRidge);
    float body = mix(
      warpNoise,
      valueNoise(point * 1.42 + warp * 1.1),
      0.58
    );
    float veil = mix(
      warpNoise,
      valueNoise(point * 0.58 + vec2(warp.y, warp.x) * 0.7),
      0.46
    );
    float dust = fineDust(point * 1.35 + warp * 0.7);
    float breakupNoise = valueNoise(point * 13.7 + warp * 3.4 + 19.3);
    float breakupMask = smoothstep(0.3, 0.68, breakupNoise + dust * 0.2);
    float microFilaments = pow(thinRidge * breakupMask, 2.35);
    float coarseField = valueNoise(point * 0.52 + warp * 0.38 + 7.4);
    float coarseScaffold = 1.0 - smoothstep(0.035, 0.115, abs(coarseField - 0.52));
    coarseScaffold *= smoothstep(0.28, 0.78, veil);
    float warmMix = smoothstep(
      0.72,
      0.98,
      body * 0.42 + microFilaments * 0.28 + dust * 0.56
    );

    // Exact normalized palette sentinels: 0x8b5cf6, 0xd946ef, 0xf472b6, 0xf59e42.
    vec3 cool = mix(
      uViolet,
      uMagenta,
      clamp(microFilaments * 0.58 + veil * 0.18, 0.0, 1.0)
    );
    vec3 warm = mix(uPink, uOrange, clamp(body * 0.24 + dust * 0.72, 0.0, 1.0));
    vec3 filamentColor = mix(cool, warm, warmMix * 0.44);
    filamentColor = mix(filamentColor, uOrange, dust * 0.36);
    vec3 scaffoldColor = mix(uViolet, vec3(0.28, 0.39, 0.56), 0.72);
    vec3 color = mix(
      scaffoldColor,
      filamentColor,
      clamp(microFilaments * 1.4 + dust * 0.75, 0.0, 1.0)
    );

    vec2 centered = abs(vUv * 2.0 - 1.0);
    float edgeFade = smoothstep(1.0, 0.72, centered.x)
      * smoothstep(1.0, 0.72, centered.y);
    float alphaEnvelope = microFilaments * 0.9 + dust * 0.52;
    float density = coarseScaffold * 0.15
      + pow(alphaEnvelope, 2.0) * 0.18;
    float alpha = clamp(
      edgeFade * density * uPresence * uOpacity * uDensityScale,
      0.0,
      1.0
    );
    gl_FragColor = vec4(
      color * (0.44 + microFilaments * 0.34 + dust * 0.24),
      alpha
    );
  }
`;

const isPositiveFinite = (value) => Number.isFinite(value) && value > 0;

const requireInput = ({ THREE, tier, seed, volume }) => {
  if (!THREE || REQUIRED_THREE_CONSTRUCTORS.some((name) => typeof THREE[name] !== "function")) {
    throw new TypeError("Cosmic tissue requires a compatible THREE namespace");
  }
  if (!Object.hasOwn(PROFILE_ORDER, tier)) {
    throw new TypeError("Cosmic tissue requires a supported tier");
  }
  if (!Number.isSafeInteger(seed)) {
    throw new TypeError("Cosmic tissue seed must be a safe integer");
  }
  if (!volume || typeof volume !== "object"
    || ![volume.width, volume.height, volume.depth].every(isPositiveFinite)) {
    throw new TypeError("Cosmic tissue volume dimensions must be positive finite numbers");
  }
};

const createNormalizedColor = (THREE, hex) => new THREE.Color(
  ((hex >> 16) & 0xff) / 255,
  ((hex >> 8) & 0xff) / 255,
  (hex & 0xff) / 255
);

const createMaterial = (THREE, opacity, densityScale, uvOffset) => new THREE.ShaderMaterial({
  uniforms: {
    uUvOffset: { value: uvOffset },
    uOpacity: { value: opacity },
    uPresence: { value: 1 },
    uDensityScale: { value: densityScale },
    uViolet: { value: createNormalizedColor(THREE, PALETTE[0]) },
    uMagenta: { value: createNormalizedColor(THREE, PALETTE[1]) },
    uPink: { value: createNormalizedColor(THREE, PALETTE[2]) },
    uOrange: { value: createNormalizedColor(THREE, PALETTE[3]) }
  },
  vertexShader: VERTEX_SHADER,
  fragmentShader: FRAGMENT_SHADER,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  depthTest: true,
  toneMapped: false
});

export const createCosmicTissue = (input) => {
  const { THREE, tier, seed, volume } = input ?? {};
  requireInput({ THREE, tier, seed, volume });

  const geometry = new THREE.PlaneGeometry(volume.width, volume.height);
  const selectedProfiles = PROFILE_ORDER[tier].map((name) => {
    const profile = PROFILES[name];
    const layerSeed = ((seed >>> 0) ^ profile.salt) >>> 0;
    return Object.freeze({ name, seed: layerSeed, ...profile });
  });
  const meshes = selectedProfiles.map((profile) => {
    const random = createSeededRandom(profile.seed);
    const uvOffset = new THREE.Vector2(random() * 31 + 3, random() * 31 + 3);
    const material = createMaterial(
      THREE,
      profile.opacity * TIER_OPACITY_SCALE[tier],
      TIER_DENSITY_SCALE[tier],
      uvOffset
    );
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `cosmic-web-tissue-${profile.name}`;
    mesh.position.set(0, 0, profile.depth);
    const maximumOffset = MAX_ROOT_PARALLAX[tier];
    const insetX = maximumOffset.x * (1 + profile.parallax) + 0.5;
    const insetY = maximumOffset.y * (1 + profile.parallax) + 0.5;
    mesh.scale.set(
      Math.max(0.001, (volume.width - insetX * 2) / volume.width),
      Math.max(0.001, (volume.height - insetY * 2) / volume.height),
      1
    );
    mesh.renderOrder = 2;
    return mesh;
  });
  const root = new THREE.Group();
  root.name = "cosmic-web-tissue";
  root.add(...meshes);

  const metadata = Object.freeze({
    algorithm: "cellular-voronoi-fbm",
    layerCount: selectedProfiles.length,
    profiles: Object.freeze(selectedProfiles.map(({ name, seed: layerSeed, depth, parallax }) => (
      Object.freeze({ name, seed: layerSeed, depth, parallax })
    ))),
    palette: PALETTE
  });
  let disposed = false;

  return Object.freeze({
    root,
    meshes: Object.freeze(meshes),
    metadata,
    setPresence: (value) => {
      if (disposed) return;
      const presence = clampPresence(value);
      meshes.forEach(({ material }) => {
        material.uniforms.uPresence.value = presence;
      });
    },
    setParallax: (offset = {}) => {
      if (disposed) return;
      const x = Number.isFinite(offset?.x) ? offset.x : 0;
      const y = Number.isFinite(offset?.y) ? offset.y : 0;
      meshes.forEach((mesh, index) => {
        const { parallax } = selectedProfiles[index];
        mesh.position.x = x * parallax;
        mesh.position.y = y * parallax;
      });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      disposeObjectTree(root);
    }
  });
};
