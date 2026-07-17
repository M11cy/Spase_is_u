import * as THREE from "three";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNearSpaceComposition,
  createQualityProfile
} from "../../src/core/quality-profile.js";
import { SOLAR_PLANETS, STAGES } from "../../src/data/cosmos.js";
import { createHeliosphereLayer } from "../../src/scene/layers/heliosphere.js";
import { createSolarSystemLayer } from "../../src/scene/layers/solar-system.js";

const CONTRACT_KEYS = Object.freeze(["dispose", "interactive", "root", "setPresence"]);

afterEach(() => {
  vi.restoreAllMocks();
});

const collectDisposableObjects = (root) => {
  const geometries = [];
  const materials = [];
  root.traverse((object) => {
    if (object.geometry && !object.isSprite) geometries.push(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    materials.push(...objectMaterials.filter(Boolean));
  });
  return Object.freeze({ geometries, materials });
};

const spyOnDisposal = ({ geometries, materials }) => Object.freeze({
  geometries: geometries.map((geometry) => vi.spyOn(geometry, "dispose")),
  materials: materials.map((material) => vi.spyOn(material, "dispose"))
});

describe("createSolarSystemLayer", () => {
  it("creates the restrained eight-planet exhibit without rotation state", () => {
    const planetsBefore = structuredClone(SOLAR_PLANETS);
    const layer = createSolarSystemLayer({
      THREE,
      planets: SOLAR_PLANETS,
      textures: new Map(),
      quality: Object.freeze({ tier: "medium" })
    });

    expect(Object.keys(layer).sort()).toEqual(CONTRACT_KEYS);
    expect(Object.isFrozen(layer)).toBe(true);
    expect(layer.root).toBeInstanceOf(THREE.Group);
    expect(layer.root.name).toBe("solar-system-layer");
    expect(layer.interactive).toHaveLength(8);
    expect(Object.isFrozen(layer.interactive)).toBe(true);
    expect(layer.interactive.map(({ name }) => name)).toEqual(
      SOLAR_PLANETS.map(({ name }) => `planet-${name.toLowerCase()}`)
    );
    expect(layer.interactive.every((planet) => planet instanceof THREE.Mesh)).toBe(true);
    expect(layer.interactive.every(({ userData }) => (
      userData.annotation.stage === 2 && Object.isFrozen(userData.annotation)
    ))).toBe(true);

    const orbits = layer.root.children.filter(({ name }) => name.startsWith("orbit-"));
    expect(orbits).toHaveLength(8);
    expect(orbits.every(({ material }) => material.opacity <= 0.22)).toBe(true);
    expect(layer.root.getObjectByName("sun").material.emissive.getHex()).not.toBe(0);
    expect(layer.root.getObjectByName("sun-glow")).toBeInstanceOf(THREE.Sprite);
    expect(layer.root.getObjectByName("saturn-rings")).toBeInstanceOf(THREE.Mesh);
    expect(layer.root.getObjectByName("heliosphere-wireframe")).toBeUndefined();

    const staticRotations = layer.interactive.map(({ rotation }) => rotation.toArray());
    layer.setPresence(1);
    layer.setPresence(0.45);
    expect(layer.interactive.map(({ rotation }) => rotation.toArray())).toEqual(staticRotations);
    layer.root.traverse(({ userData }) => {
      expect(Object.keys(userData).some((key) => /time|phase|speed|rotation/i.test(key))).toBe(false);
    });
    expect(SOLAR_PLANETS).toEqual(planetsBefore);
  });

  it("clamps presence and releases texture acquisitions exactly once on disposal", () => {
    const earthTexture = new THREE.Texture();
    const earthTextureDispose = vi.spyOn(earthTexture, "dispose");
    const earthResource = Object.freeze({ texture: earthTexture, release: vi.fn() });
    const textures = new Map([["/space/earth-daymap.jpg", earthResource]]);
    const layer = createSolarSystemLayer({ THREE, planets: SOLAR_PLANETS, textures, quality: {} });
    const disposables = collectDisposableObjects(layer.root);
    const disposalSpies = spyOnDisposal(disposables);
    const sharedSpriteGeometryDispose = vi.spyOn(
      layer.root.getObjectByName("sun-glow").geometry,
      "dispose"
    );
    const earth = layer.root.getObjectByName("planet-earth");
    const baseOpacity = earth.userData.baseOpacity;

    layer.setPresence(2);
    expect(earth.material.opacity).toBe(baseOpacity);
    layer.setPresence(0.4);
    expect(earth.material.opacity).toBeCloseTo(baseOpacity * 0.4);
    layer.setPresence(Number.NaN);
    expect(layer.root.visible).toBe(false);

    layer.dispose();
    layer.dispose();
    layer.setPresence(1);
    expect(layer.root.children).toHaveLength(0);
    disposalSpies.geometries.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    disposalSpies.materials.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(sharedSpriteGeometryDispose).not.toHaveBeenCalled();
    expect(earthResource.release).toHaveBeenCalledOnce();
    expect(earthTextureDispose).not.toHaveBeenCalled();
  });

  it("bounds the economy orbital footprint for portrait touch labels", () => {
    const layer = createSolarSystemLayer({
      THREE,
      planets: SOLAR_PLANETS,
      textures: new Map(),
      quality: Object.freeze({ tier: "economy" })
    });
    const sun = layer.root.getObjectByName("sun");
    const orbitalDistances = layer.interactive.map((planet) => (
      Math.hypot(planet.position.x - sun.position.x, planet.position.z - sun.position.z)
    ));

    expect(Math.max(...orbitalDistances)).toBeLessThanOrEqual(20);
    expect(layer.root.position.x).toBeLessThanOrEqual(-4);
  });

  it("keeps a medium-tier 600px portrait composition inside the camera", () => {
    const quality = createQualityProfile({ width: 600, dpr: 1, cores: 6, reducedMotion: false });
    const composition = createNearSpaceComposition({ width: 600, height: 900 });
    const layer = createSolarSystemLayer({
      THREE,
      planets: SOLAR_PLANETS,
      textures: new Map(),
      quality,
      composition
    });
    const camera = new THREE.PerspectiveCamera(STAGES[2].camera.fov, 600 / 900, 0.1, 1200);
    camera.position.set(...STAGES[2].camera.position);
    camera.lookAt(new THREE.Vector3(...STAGES[2].camera.target));
    camera.updateMatrixWorld(true);
    layer.root.updateMatrixWorld(true);
    const projected = layer.interactive.map((planet) => (
      planet.getWorldPosition(new THREE.Vector3()).project(camera)
    ));

    expect(composition.compact).toBe(true);
    expect(projected.every(({ x, y }) => Math.abs(x) <= 0.9 && Math.abs(y) <= 0.9)).toBe(true);
  });
});

describe("createHeliosphereLayer", () => {
  const voyager = Object.freeze({
    id: "voyager",
    title: "Это Вояджер-1",
    stage: 3,
    text: "За пределами гелиосферы",
    discovery: "Запущен в 1977 году",
    distance: "Межзвёздное пространство",
    position: Object.freeze([102, 12, -24])
  });

  it("uses three subtle ellipsoid wind shells and a physically dashed Voyager path", () => {
    const voyagerBefore = structuredClone(voyager);
    const glowTexture = new THREE.Texture();
    const layer = createHeliosphereLayer({
      THREE,
      glowTexture,
      quality: Object.freeze({ tier: "medium" }),
      voyager
    });

    expect(Object.keys(layer).sort()).toEqual(CONTRACT_KEYS);
    expect(Object.isFrozen(layer)).toBe(true);
    expect(layer.root.name).toBe("heliosphere-layer");
    expect(layer.root.getObjectByName("heliosphere-wireframe")).toBeUndefined();
    const shells = layer.root.getObjectByName("solar-wind-shells");
    expect(shells).toBeInstanceOf(THREE.Group);
    expect(shells.children).toHaveLength(3);
    expect(shells.children.every((shell) => shell instanceof THREE.Mesh)).toBe(true);
    expect(shells.children.every(({ material }) => (
      material.wireframe === false && material.opacity > 0 && material.opacity <= 0.08
    ))).toBe(true);
    expect(new Set(shells.children.map(({ material }) => material.side))).toEqual(
      new Set([THREE.FrontSide, THREE.BackSide])
    );
    expect(new Set(shells.children.map(({ scale }) => scale.toArray().join(","))).size).toBe(3);

    const trajectory = layer.root.getObjectByName("voyager-trajectory");
    expect(trajectory).toBeInstanceOf(THREE.LineSegments);
    const pathPositions = trajectory.geometry.getAttribute("position");
    expect(pathPositions.count).toBeGreaterThan(8);
    const firstDashEnd = new THREE.Vector3().fromBufferAttribute(pathPositions, 1);
    const secondDashStart = new THREE.Vector3().fromBufferAttribute(pathPositions, 2);
    expect(firstDashEnd.distanceTo(secondDashStart)).toBeGreaterThan(0);

    expect(layer.interactive).toHaveLength(1);
    expect(Object.isFrozen(layer.interactive)).toBe(true);
    const marker = layer.interactive[0];
    expect(marker).toBeInstanceOf(THREE.Mesh);
    expect(marker.name).toBe("voyager-marker");
    expect(marker.userData.annotation.stage).toBe(3);
    expect(Object.isFrozen(marker.userData.annotation)).toBe(true);
    expect(voyager).toEqual(voyagerBefore);
    expect(Object.keys(layer)).not.toContain("update");
    layer.root.traverse(({ userData }) => {
      expect(Object.keys(userData).some((key) => /time|phase|speed|rotation/i.test(key))).toBe(false);
    });
  });

  it("keeps external glow ownership and disposes static scene resources idempotently", () => {
    const glowTexture = new THREE.Texture();
    const glowDispose = vi.spyOn(glowTexture, "dispose");
    const layer = createHeliosphereLayer({ THREE, glowTexture, quality: {}, voyager });
    const disposables = collectDisposableObjects(layer.root);
    const disposalSpies = spyOnDisposal(disposables);
    const sharedSpriteGeometryDispose = vi.spyOn(
      layer.root.getObjectByName("voyager-glow").geometry,
      "dispose"
    );
    const marker = layer.root.getObjectByName("voyager-marker");
    const markerOpacity = marker.userData.baseOpacity;

    layer.setPresence(0.25);
    expect(layer.root.visible).toBe(true);
    expect(marker.material.opacity).toBeCloseTo(markerOpacity * 0.25);
    layer.setPresence(-1);
    expect(layer.root.visible).toBe(false);

    layer.dispose();
    layer.dispose();
    layer.setPresence(1);
    expect(layer.root.children).toHaveLength(0);
    disposalSpies.geometries.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    disposalSpies.materials.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(sharedSpriteGeometryDispose).not.toHaveBeenCalled();
    expect(glowDispose).not.toHaveBeenCalled();
  });

  it("keeps the immutable Voyager position inside the economy portrait footprint", () => {
    const layer = createHeliosphereLayer({
      THREE,
      glowTexture: new THREE.Texture(),
      quality: Object.freeze({ tier: "economy" }),
      voyager
    });
    const marker = layer.root.getObjectByName("voyager-marker");
    layer.root.updateMatrixWorld(true);
    const worldPosition = marker.getWorldPosition(new THREE.Vector3());

    expect(marker.userData.annotation.position).toEqual([102, 12, -24]);
    expect(Object.isFrozen(marker.userData.annotation.position)).toBe(true);
    expect(Math.abs(worldPosition.x)).toBeLessThanOrEqual(28);
  });

  it("aligns the trajectory origin with the transformed production Sun", () => {
    const quality = createQualityProfile({ width: 600, dpr: 1, cores: 6, reducedMotion: false });
    const composition = createNearSpaceComposition({ width: 600, height: 900 });
    const solar = createSolarSystemLayer({
      THREE,
      planets: SOLAR_PLANETS,
      textures: new Map(),
      quality,
      composition
    });
    solar.root.updateMatrixWorld(true);
    const sunPosition = solar.root.getObjectByName("sun").getWorldPosition(new THREE.Vector3());
    const heliosphere = createHeliosphereLayer({
      THREE,
      glowTexture: new THREE.Texture(),
      quality,
      composition,
      voyager,
      sunPosition: Object.freeze(sunPosition.toArray())
    });
    heliosphere.root.updateMatrixWorld(true);
    const trajectory = heliosphere.root.getObjectByName("voyager-trajectory");
    const start = new THREE.Vector3().fromBufferAttribute(
      trajectory.geometry.getAttribute("position"),
      0
    );
    trajectory.localToWorld(start);

    expect(start.distanceTo(sunPosition)).toBeLessThan(0.001);
  });
});

it("uses the near-space factories as the sole production stage 2 and 3 layers", () => {
  const mainSource = readFileSync(resolve(process.cwd(), "src/main.js"), "utf8");
  const stylesSource = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

  expect(mainSource).toContain("createSolarSystemLayer");
  expect(mainSource).toContain("createHeliosphereLayer");
  expect(mainSource).toMatch(/stage:\s*2,\s*layer:\s*solarSystemLayer/);
  expect(mainSource).toMatch(/stage:\s*3,\s*layer:\s*heliosphereLayer/);
  expect(mainSource).not.toContain("const solarSystem = new THREE.Group()");
  expect(mainSource).not.toContain("wireframe: true");
  expect(mainSource).not.toContain("const heliosphere = new THREE.Mesh(");
  expect(mainSource).toContain("labelSafeRightInset");
  expect(mainSource).toContain("window.innerWidth - labelSafeRightInset");
  expect(mainSource).toContain("nearSpaceComposition");
  expect(stylesSource).toMatch(/\.space-label\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
  expect(stylesSource).toMatch(/\.space-label:focus-visible\s*\{[^}]*outline:/s);
});
