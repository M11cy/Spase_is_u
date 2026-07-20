import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createQualityProfile } from "../../core/quality-profile.js";
import { STAGES } from "../../data/cosmos.js";
import { BLOOM_SCENE_LAYER } from "../deep-space-postprocessing.js";
import { createCosmicTissue } from "./cosmic-tissue.js";
import { createCosmicWebLayer } from "./cosmic-web.js";
import { createLocalGroupLayer } from "./local-group.js";
import { createMilkyWayLayer } from "./milky-way.js";

const createLayer = (overrides = {}) => createMilkyWayLayer({
  THREE,
  annotations: [],
  quality: { tier: "high", galaxyPoints: 900 },
  glowTexture: null,
  createMarker: () => new THREE.Sprite(),
  reducedMotion: false,
  ...overrides
});

const createSettledMilkyWayCamera = (aspect = 16 / 9) => {
  const stage = STAGES.find(({ id }) => id === "milky-way");
  const camera = new THREE.PerspectiveCamera(stage.camera.fov, aspect, 0.1, 2000);
  camera.position.fromArray(stage.camera.position);
  camera.lookAt(new THREE.Vector3(...stage.camera.target));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
};

const measureFaceOnInclination = (root, camera) => {
  root.updateMatrixWorld(true);
  const discNormal = new THREE.Vector3(0, 0, 1).transformDirection(root.matrixWorld);
  const rootPosition = root.getWorldPosition(new THREE.Vector3());
  const viewDirection = camera.position.clone().sub(rootPosition).normalize();
  const alignment = Math.min(1, Math.abs(discNormal.dot(viewDirection)));
  return THREE.MathUtils.radToDeg(Math.acos(alignment));
};

const measureProjectedRingWidth = ({ root, camera, radius, samples = 720 }) => {
  root.updateMatrixWorld(true);
  const projectedX = Array.from({ length: samples }, (_, index) => {
    const angle = index / samples * Math.PI * 2;
    const point = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    root.localToWorld(point);
    point.project(camera);
    return point.x;
  });
  return (Math.max(...projectedX) - Math.min(...projectedX)) / 2;
};

const createSettledStageCamera = (stageId, aspect = 16 / 9) => {
  const stage = STAGES.find(({ id }) => id === stageId);
  const camera = new THREE.PerspectiveCamera(stage.camera.fov, aspect, 0.1, 2000);
  camera.position.fromArray(stage.camera.position);
  camera.lookAt(new THREE.Vector3(...stage.camera.target));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
};

const projectedGridCell = ({ point, camera, columns = 12, rows = 8 }) => {
  const projected = new THREE.Vector3(...point).project(camera);
  const normalizedX = (projected.x + 0.84) / 1.56;
  const normalizedY = (0.84 - projected.y) / 1.48;
  if (normalizedX < 0 || normalizedX >= 1 || normalizedY < 0 || normalizedY >= 1) return null;
  return Math.floor(normalizedY * rows) * columns + Math.floor(normalizedX * columns);
};

const measureProjectedGraphCoverage = ({ graph, camera, columns = 12, rows = 8 }) => {
  const edgesByCell = Array.from({ length: columns * rows }, () => new Set());
  graph.edges.forEach(([from, to], edgeIndex) => {
    const start = graph.nodes[from];
    const end = graph.nodes[to];
    for (let sample = 0; sample <= 24; sample += 1) {
      const progress = sample / 24;
      const cell = projectedGridCell({
        point: start.map((value, axis) => value + (end[axis] - value) * progress),
        camera,
        columns,
        rows
      });
      if (cell != null) edgesByCell[cell].add(edgeIndex);
    }
  });
  return edgesByCell.filter((edges) => edges.size >= 2).length / edgesByCell.length;
};

describe("createMilkyWayLayer", () => {
  it("presents a large four-arm disc at an actual twenty-degree face-on inclination", () => {
    const layer = createLayer({ quality: { tier: "high", galaxyPoints: 9000 } });
    const camera = createSettledMilkyWayCamera();
    const actualInclination = measureFaceOnInclination(layer.root, camera);

    expect(layer.root.userData.composition).toEqual(expect.objectContaining({
      inclinationDegrees: 20,
      diameter: 210,
      armCount: 4,
      dustLanes: 2
    }));
    expect(Object.isFrozen(layer.root.userData.composition)).toBe(true);
    expect(actualInclination).toBeGreaterThanOrEqual(18);
    expect(actualInclination).toBeLessThanOrEqual(22);
    expect(layer.root.rotation.z).toBeCloseTo(-0.16, 4);
    expect(layer.root.scale.x).toBeGreaterThanOrEqual(1.5);

    layer.dispose();
  });

  it.each([
    ["high", { width: 1920, height: 1080, dpr: 2, cores: 12 }, 9000],
    ["medium", { width: 1024, height: 768, dpr: 2, cores: 8 }, 5600],
    ["economy", { width: 390, height: 844, dpr: 3, cores: 12 }, 2800]
  ])("uses the exact %s Milky Way point budget", (tier, viewport, galaxyPoints) => {
    const profile = createQualityProfile({ ...viewport, reducedMotion: false });
    const layer = createLayer({ quality: profile });

    expect(profile).toMatchObject({ tier, galaxyPoints });
    expect(layer.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").count)
      .toBe(galaxyPoints);

    layer.dispose();
  });

  it("projects the luminous arm envelope to roughly seventy percent of the settled desktop frame", () => {
    const layer = createLayer({ quality: { tier: "high", galaxyPoints: 9000 } });
    const desktopCamera = createSettledMilkyWayCamera();
    const mobileCamera = createSettledMilkyWayCamera(390 / 844);
    const discRadius = layer.root.userData.composition.diameter / 2;
    const luminousArmEnvelope = discRadius + 6;
    const sparseHaloEnvelope = 118;
    const mobileInnerStructure = 32;
    const armOccupancy = measureProjectedRingWidth({
      root: layer.root,
      camera: desktopCamera,
      radius: luminousArmEnvelope
    });
    const haloOccupancy = measureProjectedRingWidth({
      root: layer.root,
      camera: desktopCamera,
      radius: sparseHaloEnvelope
    });
    const mobileInnerOccupancy = measureProjectedRingWidth({
      root: layer.root,
      camera: mobileCamera,
      radius: mobileInnerStructure
    });
    const routeCameraZ = STAGES.map(({ camera }) => camera.position[2]);
    const deepSpaceStart = STAGES.findIndex(({ id }) => id === "solar-system");
    const deepSpaceCameraDistances = STAGES.slice(deepSpaceStart).map(({ camera }) => (
      Math.hypot(...camera.position.map((value, index) => value - camera.target[index]))
    ));

    expect(armOccupancy).toBeGreaterThanOrEqual(0.65);
    expect(armOccupancy).toBeLessThanOrEqual(0.75);
    expect(haloOccupancy).toBeLessThanOrEqual(0.82);
    expect(mobileInnerOccupancy).toBeGreaterThanOrEqual(0.65);
    expect(mobileInnerOccupancy).toBeLessThanOrEqual(0.95);
    expect(routeCameraZ.every((depth, index) => index === 0 || depth > routeCameraZ[index - 1]))
      .toBe(true);
    expect(deepSpaceCameraDistances.every((distance, index) => (
      index === 0 || distance > deepSpaceCameraDistances[index - 1]
    )))
      .toBe(true);

    layer.dispose();
  });

  it("creates a layered volumetric galaxy using the quality point count", () => {
    const layer = createLayer({ quality: { tier: "economy", galaxyPoints: 900 } });

    expect(layer.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").count).toBe(900);
    expect(layer.root.getObjectByName("milky-way-dust-lane-1")).toBeTruthy();
    expect(layer.root.getObjectByName("milky-way-halo")).toBeTruthy();
    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0, y: 0 });

    layer.dispose();
  });

  it("uses the shared high-quality parallax response", () => {
    const layer = createLayer();
    const initialZ = layer.root.position.z;
    const initialRotation = layer.root.rotation.clone();

    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 1.6, y: -1.1 });
    expect(layer.root.position.z).toBe(initialZ);
    expect(layer.root.rotation.toArray()).toEqual(initialRotation.toArray());

    layer.dispose();
  });

  it("keeps stars, dust, core, and halo as independently faded transparent 3D layers", () => {
    const layer = createLayer();
    const stars = layer.root.getObjectByName("milky-way-stars");
    const dust = layer.root.getObjectByName("milky-way-dust-lane-1");
    const core = layer.root.getObjectByName("milky-way-core");
    const halo = layer.root.getObjectByName("milky-way-halo");

    expect(layer.root.position.z).toBe(-80);
    expect(core).toBeTruthy();
    expect(stars.material.blending).toBe(THREE.AdditiveBlending);
    expect(dust.material.blending).toBe(THREE.NormalBlending);
    expect([stars, dust, core, halo].every(({ material }) => material.transparent && !material.depthWrite)).toBe(true);
    layer.setPresence(0.5);
    expect(stars.material.opacity).toBeCloseTo(0.41);

    layer.dispose();
  });

  it("generates deterministic logarithmic-arm positions and keeps annotations outside the bright core", () => {
    const annotation = {
      id: "galactic-center",
      stage: 3,
      position: [-6, 1, -82]
    };
    const first = createLayer({ annotations: [annotation] });
    const second = createLayer({ annotations: [annotation] });

    expect(first.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").array)
      .toEqual(second.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").array);
    expect(first.interactive).toHaveLength(1);
    expect(first.interactive[0].userData.annotation).toMatchObject(annotation);
    expect(Math.hypot(first.interactive[0].position.x, first.interactive[0].position.y))
      .toBeGreaterThanOrEqual(28);

    first.dispose();
    second.dispose();
  });

  it("forms four separated face-on logarithmic arm bands with outward radial progression", () => {
    const layer = createLayer();
    const positions = layer.root.getObjectByName("milky-way-stars").geometry.getAttribute("position").array;
    const { armCount, coordinatePlane, pattern } = layer.root.userData.armStructure;
    const pointCount = positions.length / 3;
    const radialDistance = (index) => {
      const offset = index * 3;
      return Math.hypot(positions[offset], positions[offset + 1]);
    };
    const firstAngles = Array.from({ length: armCount }, (_, arm) => {
      const offset = arm * 3;
      return Math.atan2(positions[offset + 1], positions[offset]);
    }).sort((left, right) => left - right);
    const angularGaps = firstAngles.map((angle, index) => (
      (firstAngles[(index + 1) % armCount] - angle + Math.PI * 2) % (Math.PI * 2)
    ));

    expect(Object.isFrozen(layer.root.userData.armStructure)).toBe(true);
    expect(pattern).toBe("logarithmic");
    expect(coordinatePlane).toBe("xy");
    expect(armCount).toBe(4);
    expect(angularGaps.every((gap) => gap > 1 && gap < 2.1)).toBe(true);
    expect(Array.from({ length: armCount }, (_, arm) => (
      radialDistance(pointCount - armCount + arm) > radialDistance(arm) * 8
    )).every(Boolean)).toBe(true);

    layer.dispose();
  });

  it("breaks luminous arms with two dark offset dust lanes and a volumetric halo", () => {
    const layer = createLayer();
    const dustLanes = [1, 2].map((index) => (
      layer.root.getObjectByName(`milky-way-dust-lane-${index}`)
    ));
    const stars = layer.root.getObjectByName("milky-way-stars");
    const halo = layer.root.getObjectByName("milky-way-halo");
    const haloPositions = halo.geometry.getAttribute("position");
    const distinctHaloDepths = new Set(Array.from(haloPositions.array)
      .filter((_, index) => index % 3 === 2)
      .map((value) => Math.round(value)));

    expect(dustLanes.every(Boolean)).toBe(true);
    expect(dustLanes.every(({ material, renderOrder }) => (
      material.blending === THREE.NormalBlending
      && material.transparent
      && material.opacity >= 0.7
      && renderOrder > stars.renderOrder
    ))).toBe(true);
    expect(dustLanes[0].geometry.getAttribute("position").array)
      .not.toEqual(dustLanes[1].geometry.getAttribute("position").array);
    expect(halo.isPoints).toBe(true);
    expect(distinctHaloDepths.size).toBeGreaterThan(12);

    layer.dispose();
  });

  it("selectively blooms luminous stars and the warm core while preserving the base layer", () => {
    const layer = createLayer();
    const stars = layer.root.getObjectByName("milky-way-stars");
    const core = layer.root.getObjectByName("milky-way-core");
    const halo = layer.root.getObjectByName("milky-way-halo");
    const dust = layer.root.getObjectByName("milky-way-dust-lane-1");

    expect(core.material.color.getHex()).toBe(0xffc878);
    expect([stars, core].every(({ layers }) => (
      layers.isEnabled(0) && layers.isEnabled(BLOOM_SCENE_LAYER)
    ))).toBe(true);
    expect([halo, dust].every(({ layers }) => (
      layers.isEnabled(0) && !layers.isEnabled(BLOOM_SCENE_LAYER)
    ))).toBe(true);

    layer.dispose();
  });

  it.each([
    undefined,
    null,
    {},
    { tier: "high", galaxyPoints: 0 },
    { tier: "high", galaxyPoints: 1.5 }
  ])("rejects invalid quality input %j", (quality) => {
    expect(() => createLayer({ quality })).toThrow(TypeError);
  });

  it("rejects an absent layer contract", () => {
    expect(() => createMilkyWayLayer())
      .toThrow("Milky Way layer requires a compatible THREE namespace");
  });

  it.each([
    undefined,
    null,
    {},
    { Group: THREE.Group },
    { BufferGeometry: THREE.BufferGeometry }
  ])("rejects an incomplete THREE namespace %j", (incompleteThree) => {
    expect(() => createLayer({ THREE: incompleteThree })).toThrow(TypeError);
  });

  it.each([undefined, null, {}, "annotations"])("rejects invalid annotations %j", (annotations) => {
    expect(() => createLayer({ annotations })).toThrow(TypeError);
  });

  it.each([undefined, null, "marker"])("rejects invalid marker factory %j", (createMarker) => {
    expect(() => createLayer({ createMarker })).toThrow(TypeError);
  });

  it.each([undefined, null, "false"])("rejects invalid reduced-motion preference %j", (reducedMotion) => {
    expect(() => createLayer({ reducedMotion })).toThrow(TypeError);
  });

  it("fails closed by skipping malformed annotations and marker results", () => {
    const layer = createLayer({
      annotations: [null, { position: [0, 0] }, { position: [0, 0, -80] }],
      createMarker: () => null
    });

    expect(layer.interactive).toHaveLength(0);

    layer.dispose();
  });

  it("projects a central annotation and tolerates a material-less marker", () => {
    const marker = new THREE.Object3D();
    const layer = createLayer({
      annotations: [{ id: "origin", stage: 3, position: [0, 0, -80] }],
      createMarker: () => marker
    });

    expect(layer.interactive).toEqual([marker]);
    expect(marker.position.x).toBeCloseTo(15);
    expect(marker.position.y).toBeCloseTo(-Math.sqrt(675));
    expect(marker.position.z).toBe(0);
    expect(marker.userData.baseOpacity).toBe(1);
    expect(() => layer.setPresence(0.5)).not.toThrow();
    expect(layer.root.visible).toBe(true);

    layer.dispose();
  });

  it("fails closed for invalid presence and parallax input", () => {
    const layer = createLayer();

    layer.setPresence("visible");
    expect(layer.root.visible).toBe(false);
    expect(layer.updateParallax({ x: 1, y: "-1" })).toEqual({ x: 0, y: 0 });
    expect(layer.updateParallax(null)).toEqual({ x: 0, y: 0 });

    layer.dispose();
  });

  it("disposes the resource tree only once", () => {
    const layer = createLayer();
    const stars = layer.root.getObjectByName("milky-way-stars");
    const disposeGeometry = vi.spyOn(stars.geometry, "dispose");
    const disposeMaterial = vi.spyOn(stars.material, "dispose");

    layer.setPresence(0.4);
    const opacityBeforeDispose = stars.material.opacity;

    layer.dispose();
    layer.setPresence(0.9);
    layer.dispose();

    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(stars.material.opacity).toBe(opacityBeforeDispose);
  });
});

const createLocalGroup = (overrides = {}) => createLocalGroupLayer({
  THREE,
  quality: { tier: "high", localGroupGalaxies: 260 },
  glowTexture: null,
  reducedMotion: false,
  seed: 20610422,
  ...overrides
});

describe("createLocalGroupLayer", () => {
  it.each([
    ["high", 260],
    ["medium", 160],
    ["economy", 90]
  ])("renders a deterministic %s deep field without annotations", (tier, count) => {
    const input = { quality: { tier, localGroupGalaxies: count }, seed: 20610422 };
    const first = createLocalGroup(input);
    const second = createLocalGroup(input);

    expect(first.catalog).toHaveLength(count);
    expect(first.catalog).toEqual(second.catalog);
    expect(new Set(first.catalog.map(({ profile }) => profile)))
      .toEqual(new Set(["spiral", "elliptical", "irregular"]));
    expect(first.interactive).toEqual([]);
    expect(Object.isFrozen(first.interactive)).toBe(true);
    expect(first.root.getObjectByName("local-group-markers")).toBeUndefined();

    first.dispose();
    second.dispose();
  });

  it("publishes deeply frozen catalog records with the documented metadata only", () => {
    const layer = createLocalGroup();
    const [record] = layer.catalog;

    expect(Object.isFrozen(layer.catalog)).toBe(true);
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.position)).toBe(true);
    expect(Object.keys(record)).toEqual([
      "id",
      "profile",
      "position",
      "size",
      "rotation",
      "temperature"
    ]);
    expect(record.id).toBe("deep-field-0");
    expect(record.position).toHaveLength(3);
    expect(record.position.every(Number.isFinite)).toBe(true);
    expect(record.size).toBeGreaterThan(0);
    expect(record.rotation).toBeGreaterThanOrEqual(0);
    expect(record.rotation).toBeLessThan(Math.PI * 2);
    expect(["warm", "cool"]).toContain(record.temperature);

    layer.dispose();
  });

  it("batches every galaxy into one procedural shader point cloud per profile", () => {
    const layer = createLocalGroup();

    ["spiral", "elliptical", "irregular"].forEach((profile) => {
      const batch = layer.root.getObjectByName(`local-group-${profile}-batch`);
      const expectedCount = layer.catalog.filter((record) => record.profile === profile).length;

      expect(batch).toBeInstanceOf(THREE.Points);
      expect(batch.geometry.getAttribute("position").count).toBe(expectedCount);
      expect(batch.geometry.getAttribute("aSize").count).toBe(expectedCount);
      expect(batch.geometry.getAttribute("aRotation").count).toBe(expectedCount);
      expect(batch.geometry.getAttribute("aColor").count).toBe(expectedCount);
      expect(batch.material).toBeInstanceOf(THREE.ShaderMaterial);
      expect(batch.material.defines[`PROFILE_${profile.toUpperCase()}`]).toBe(1);
      expect(batch.material.blending).toBe(THREE.AdditiveBlending);
      expect(batch.material.depthWrite).toBe(false);
      expect(batch.material.toneMapped).toBe(false);
      expect(batch.material.uniforms.uIntensity.value).toBeGreaterThanOrEqual(1);
    });

    layer.dispose();
  });

  it("uses portable ascending smoothstep edges in every galaxy fragment shader", () => {
    const layer = createLocalGroup();
    const smoothstepEdges = layer.root.children.flatMap(({ material }) => (
      [...material.fragmentShader.matchAll(/smoothstep\((\d+\.\d+),\s*(\d+\.\d+)/g)]
        .map(([, first, second]) => [Number(first), Number(second)])
    ));

    expect(smoothstepEdges.length).toBeGreaterThan(0);
    expect(smoothstepEdges.every(([edge0, edge1]) => edge0 < edge1)).toBe(true);

    layer.dispose();
  });

  it.each([
    ["high", 14],
    ["medium", 11],
    ["economy", 8]
  ])("isolates the %s deep field to exactly %i hero cores on bloom", (tier, heroCount) => {
    const layer = createLocalGroup({ quality: { tier } });
    const heroCores = layer.root.getObjectByName("local-group-hero-cores");
    const bloomLayer = new THREE.Layers();
    const baseLayer = new THREE.Layers();
    bloomLayer.set(BLOOM_SCENE_LAYER);
    baseLayer.set(0);

    expect(layer.catalog.filter(({ size }) => size >= 18)).toHaveLength(heroCount);
    expect(heroCores.geometry.getAttribute("position").count).toBe(heroCount);
    expect(heroCores.layers.test(bloomLayer)).toBe(true);
    expect(heroCores.layers.test(baseLayer)).toBe(true);
    expect(layer.root.layers.test(bloomLayer)).toBe(false);
    ["spiral", "elliptical", "irregular"].forEach((profile) => {
      expect(layer.root.getObjectByName(`local-group-${profile}-batch`).layers.test(bloomLayer))
        .toBe(false);
    });

    layer.dispose();
  });

  it("uses several depth clusters while preserving broad empty regions", () => {
    const layer = createLocalGroup();
    const occupiedCells = new Set(layer.catalog.map(({ position: [x, y] }) => (
      `${Math.floor((x + 380) / 90)}:${Math.floor((y + 140) / 45)}`
    )));
    const depthBands = new Set(layer.catalog.map(({ position: [, , z] }) => Math.floor((-z - 110) / 55)));

    expect(occupiedCells.size).toBeGreaterThanOrEqual(14);
    expect(occupiedCells.size).toBeLessThanOrEqual(52);
    expect(depthBands.size).toBeGreaterThanOrEqual(5);
    expect(layer.catalog.some(({ position: [x, y] }) => Math.abs(x) < 8 && Math.abs(y) < 8))
      .toBe(false);

    layer.dispose();
  });

  it("fills most of the settled desktop field with individually readable clustered galaxies", () => {
    const layer = createLocalGroup({ quality: { tier: "high", localGroupGalaxies: 260 } });
    const stage = STAGES.find(({ id }) => id === "local-group");
    const camera = new THREE.PerspectiveCamera(stage.camera.fov, 16 / 9, 0.1, 2000);
    camera.position.fromArray(stage.camera.position);
    camera.lookAt(new THREE.Vector3(...stage.camera.target));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const projectedX = layer.catalog.map(({ position }) => (
      new THREE.Vector3(...position).project(camera).x
    ));
    const occupiedWidth = (Math.max(...projectedX) - Math.min(...projectedX)) / 2;
    const nonHeroes = layer.catalog.slice(layer.root.userData.composition.heroCount);
    const profileMaterial = layer.root.getObjectByName("local-group-spiral-batch").material;

    expect(occupiedWidth).toBeGreaterThanOrEqual(0.6);
    expect(occupiedWidth).toBeLessThanOrEqual(0.75);
    expect(Math.min(...nonHeroes.map(({ size }) => size))).toBeGreaterThanOrEqual(4);
    expect(profileMaterial.uniforms.uPointScale.value).toBeGreaterThanOrEqual(1.1);
    expect(profileMaterial.uniforms.uIntensity.value).toBeGreaterThanOrEqual(1.15);

    layer.dispose();
  });

  it("distributes clustered galaxies across the settled central and vertical field with real voids", () => {
    const layer = createLocalGroup({ quality: { tier: "high", localGroupGalaxies: 260 } });
    const camera = createSettledStageCamera("local-group");
    const occupied = new Map();
    layer.catalog.forEach(({ position }) => {
      const cell = projectedGridCell({ point: position, camera });
      if (cell != null) occupied.set(cell, (occupied.get(cell) ?? 0) + 1);
    });
    const readableCells = [...occupied].filter(([, count]) => count >= 3).map(([cell]) => cell);
    const occupiedRows = new Set(readableCells.map((cell) => Math.floor(cell / 12)));

    expect(readableCells.length).toBeGreaterThanOrEqual(26);
    expect(occupiedRows.size).toBeGreaterThanOrEqual(6);
    expect(readableCells.length).toBeLessThanOrEqual(50);

    layer.dispose();
  });

  it("applies clamped presence and high-quality parallax without mutating catalog metadata", () => {
    const layer = createLocalGroup();
    const catalogSnapshot = structuredClone(layer.catalog);

    layer.setPresence(0.5);
    expect(layer.root.visible).toBe(true);
    expect(layer.root.getObjectByName("local-group-spiral-batch").material.uniforms.uPresence.value)
      .toBe(0.5);
    expect(layer.root.getObjectByName("local-group-hero-cores").material.uniforms.uPresence.value)
      .toBe(0.5);
    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 1.6, y: -1.1 });
    expect(layer.updateParallax(null)).toEqual({ x: 0, y: 0 });
    layer.setPresence(Number.NaN);
    expect(layer.root.visible).toBe(false);
    expect(layer.catalog).toEqual(catalogSnapshot);

    layer.dispose();
  });

  it("honors reduced motion and disposes every batch exactly once", () => {
    const layer = createLocalGroup({ reducedMotion: true });
    const resources = layer.root.children.flatMap((child) => [child.geometry, child.material]);
    const disposeSpies = resources.map((resource) => vi.spyOn(resource, "dispose"));

    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0, y: 0 });

    layer.dispose();
    layer.dispose();

    disposeSpies.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(layer.root.children).toHaveLength(0);
  });

  it("validates the rendering boundary and falls back to the tier galaxy budget", () => {
    expect(() => createLocalGroup({ THREE: null })).toThrow(TypeError);
    expect(() => createLocalGroup({ quality: null })).toThrow(TypeError);
    expect(() => createLocalGroup({ quality: { tier: "ultra" } })).toThrow(TypeError);
    expect(() => createLocalGroup({
      quality: { tier: "high", localGroupGalaxies: 0 }
    })).toThrow(TypeError);
    expect(() => createLocalGroup({ reducedMotion: null })).toThrow(TypeError);
    expect(() => createLocalGroup({ seed: 1.5 })).toThrow(TypeError);

    const layer = createLocalGroup({ quality: { tier: "medium" } });
    expect(layer.catalog).toHaveLength(160);
    layer.dispose();
  });
});

describe("Local Group main integration", () => {
  it("does not load bitmap galaxies or activate Local Group annotations", () => {
    const mainSource = readFileSync(new URL("../../main.js", import.meta.url), "utf8");
    const layerSetup = mainSource.match(
      /const localGroupLayer = createLocalGroupLayer\(\{([\s\S]*?)\n\}\);/
    )?.[1] ?? "";

    expect(mainSource).not.toMatch(/groupGalaxyAnnotations|localGroupTexture(?:Sources|Resources|s)/);
    expect(layerSetup).toContain("seed: 20610422");
    expect(layerSetup).not.toMatch(/annotations|textureFor|createMarker/);
    expect(mainSource).toContain('object.stage !== STAGE_INDEX["local-group"]');
  });
});

const createCosmicWeb = (overrides = {}) => createCosmicWebLayer({
  THREE,
  quality: { tier: "economy", cosmicWebPoints: 5200 },
  glowTexture: null,
  reducedMotion: false,
  seed: 20260719,
  ...overrides
});

const createTissue = (overrides = {}) => createCosmicTissue({
  THREE,
  tier: "high",
  seed: 20260719,
  volume: { width: 920, height: 620, depth: 240 },
  ...overrides
});

describe("createCosmicTissue", () => {
  it.each([
    "Group",
    "PlaneGeometry",
    "Mesh",
    "ShaderMaterial",
    "Color",
    "Vector2"
  ])("rejects a THREE namespace without a usable %s constructor", (constructorName) => {
    const incompatibleThree = { ...THREE, [constructorName]: undefined };

    expect(() => createTissue({ THREE: incompatibleThree }))
      .toThrow("Cosmic tissue requires a compatible THREE namespace");
  });

  it("rejects a missing input contract and unsupported tiers", () => {
    expect(() => createCosmicTissue())
      .toThrow("Cosmic tissue requires a compatible THREE namespace");
    expect(() => createTissue({ tier: "ultra" }))
      .toThrow("Cosmic tissue requires a supported tier");
    expect(() => createTissue({ tier: undefined }))
      .toThrow("Cosmic tissue requires a supported tier");
  });

  it.each([
    undefined,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.MIN_SAFE_INTEGER - 1
  ])("rejects unsafe tissue seed %s", (seed) => {
    expect(() => createTissue({ seed }))
      .toThrow("Cosmic tissue seed must be a safe integer");
  });

  it.each([
    undefined,
    null,
    "920x620x240",
    {},
    { width: 920, height: 620 },
    { width: 0, height: 620, depth: 240 },
    { width: 920, height: -1, depth: 240 },
    { width: 920, height: 620, depth: Number.NaN },
    { width: Number.POSITIVE_INFINITY, height: 620, depth: 240 }
  ])("rejects invalid tissue volume %j", (volume) => {
    expect(() => createTissue({ volume }))
      .toThrow("Cosmic tissue volume dimensions must be positive finite numbers");
  });

  it("clamps presence and normalizes missing or non-finite parallax axes", () => {
    const tissue = createTissue();
    const profileParallax = [0.22, 0.46, 0.74];
    const positions = () => tissue.meshes.map(({ position }) => [position.x, position.y]);
    const presences = () => tissue.meshes.map(({ material }) => (
      material.uniforms.uPresence.value
    ));

    expect(tissue.metadata.profiles.map(({ parallax }) => parallax)).toEqual(profileParallax);
    tissue.setPresence(1.5);
    expect(presences()).toEqual([1, 1, 1]);
    tissue.setPresence(-0.5);
    expect(presences()).toEqual([0, 0, 0]);
    tissue.setPresence(Number.NaN);
    expect(presences()).toEqual([0, 0, 0]);

    tissue.setParallax({ x: 4, y: -3 });
    expect(positions()).toEqual(profileParallax.map((parallax) => [
      4 * parallax,
      -3 * parallax
    ]));
    tissue.setParallax();
    expect(positions()).toEqual(profileParallax.map(() => [0, 0]));
    tissue.setParallax(null);
    expect(positions()).toEqual(profileParallax.map(() => [0, 0]));
    tissue.setParallax({ x: Number.NaN, y: Number.POSITIVE_INFINITY });
    expect(positions()).toEqual(profileParallax.map(() => [0, 0]));

    tissue.dispose();
  });

  it("disposes its shared resources once and ignores lifecycle updates afterward", () => {
    const tissue = createTissue();
    const geometryDispose = vi.spyOn(tissue.meshes[0].geometry, "dispose");
    const materialDisposes = tissue.meshes.map(({ material }) => vi.spyOn(material, "dispose"));

    tissue.setPresence(0.42);
    tissue.setParallax({ x: 2, y: -2 });
    const presenceBeforeDispose = tissue.meshes.map(({ material }) => (
      material.uniforms.uPresence.value
    ));
    const positionsBeforeDispose = tissue.meshes.map(({ position }) => position.clone());

    tissue.dispose();
    tissue.setPresence(0.9);
    tissue.setParallax({ x: -8, y: 8 });
    tissue.dispose();

    expect(tissue.root.children).toHaveLength(0);
    expect(tissue.meshes.map(({ material }) => material.uniforms.uPresence.value))
      .toEqual(presenceBeforeDispose);
    expect(tissue.meshes.map(({ position }) => position))
      .toEqual(positionsBeforeDispose);
    expect(geometryDispose).toHaveBeenCalledOnce();
    materialDisposes.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
  });
});

const pointAt = (positions, index) => [
  positions.getX(index),
  positions.getY(index),
  positions.getZ(index)
];

const expectPointToBeCloseTo = (actual, expected) => {
  actual.forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 4));
};

const distanceToSegment = (point, start, end) => {
  const delta = end.map((value, axis) => value - start[axis]);
  const lengthSquared = delta.reduce((sum, value) => sum + value ** 2, 0);
  const progress = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (
    point.reduce((sum, value, axis) => sum + (value - start[axis]) * delta[axis], 0)
      / lengthSquared
  )));
  return Math.hypot(...point.map((value, axis) => (
    value - (start[axis] + delta[axis] * progress)
  )));
};

const distanceToPolyline = (point, positions, firstPoint, segmentCount) => (
  Math.min(...Array.from({ length: segmentCount }, (_, segmentIndex) => (
    distanceToSegment(
      point,
      pointAt(positions, firstPoint + segmentIndex * 2),
      pointAt(positions, firstPoint + segmentIndex * 2 + 1)
    )
  )))
);

describe("createCosmicWebLayer", () => {
  it.each([
    [{ width: 1920, height: 1080, dpr: 2, cores: 12, reducedMotion: false }, "high", 18000],
    [{ width: 1024, height: 768, dpr: 2, cores: 8, reducedMotion: false }, "medium", 9800],
    [{ width: 390, height: 844, dpr: 3, cores: 12, reducedMotion: false }, "economy", 5200]
  ])("publishes the %s Cosmic Web particle budget", (input, tier, cosmicWebPoints) => {
    expect(createQualityProfile(input)).toMatchObject({ tier, cosmicWebPoints });
  });

  it("uses a bright purple-magenta network with golden hot nodes", () => {
    const layer = createCosmicWeb({
      quality: { tier: "high", cosmicWebPoints: 18000 },
      seed: 20260719
    });
    const structure = layer.root.userData.structure;
    const filaments = layer.root.getObjectByName("cosmic-web-filaments");
    const hotNodes = layer.root.getObjectByName("cosmic-web-hot-nodes");

    expect(structure).toMatchObject({
      palette: [0x8b5cf6, 0xd946ef, 0xf472b6, 0xfbbf24],
      nodeBudget: 120,
      hotNodeCount: 12,
      depthLayers: 3
    });
    expect(Object.isFrozen(structure)).toBe(true);
    expect(Object.isFrozen(structure.palette)).toBe(true);
    expect(filaments.material.opacity).toBe(0.48);
    expect(hotNodes.geometry.getAttribute("position").count).toBe(12);

    const renderedColors = [];
    layer.root.traverse(({ geometry }) => {
      renderedColors.push(...Array.from(geometry?.getAttribute("color")?.array ?? []));
    });
    const paletteColors = structure.palette.map((hex) => new THREE.Color(hex));
    paletteColors.forEach((color) => {
      const found = Array.from({ length: renderedColors.length / 3 }, (_, index) => index * 3)
        .some((offset) => (
          Math.abs(renderedColors[offset] - color.r) < 0.0001
          && Math.abs(renderedColors[offset + 1] - color.g) < 0.0001
          && Math.abs(renderedColors[offset + 2] - color.b) < 0.0001
        ));
      expect(found).toBe(true);
    });

    layer.dispose();
  });

  it("keeps the volumetric network vivid in the base pass before bloom", () => {
    const layer = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 } });
    const filaments = layer.root.getObjectByName("cosmic-web-filaments");
    const particles = layer.root.getObjectByName("cosmic-web-particles");
    const nodes = layer.root.getObjectByName("cosmic-web-nodes");
    const hotNodes = layer.root.getObjectByName("cosmic-web-hot-nodes");
    const depth = layer.root.getObjectByName("cosmic-web-depth");

    expect([filaments, particles, nodes, hotNodes, depth].every(({ material }) => (
      material.toneMapped === false
    ))).toBe(true);
    expect(particles.material).toMatchObject({ size: 11.4, opacity: 0.98 });
    expect(nodes.material).toMatchObject({ size: 11.2, opacity: 0.96 });
    expect(hotNodes.material).toMatchObject({ size: 16, opacity: 1 });
    expect(depth.material).toMatchObject({ size: 5.2, opacity: 0.65 });
    expect(Math.max(...filaments.geometry.getAttribute("color").array)).toBeGreaterThan(1);

    layer.dispose();
  });

  it.each([
    ["high", 18000, 120, 12, 0.48],
    ["medium", 9800, 92, 9, 0.44],
    ["economy", 5200, 68, 7, 0.40]
  ])("uses the exact %s density and readable filament budget", (
    tier,
    cosmicWebPoints,
    nodeBudget,
    hotNodeCount,
    filamentOpacity
  ) => {
    const layer = createCosmicWeb({ quality: { tier, cosmicWebPoints } });
    const structure = layer.root.userData.structure;

    expect(layer.graph.nodes).toHaveLength(nodeBudget);
    expect(layer.root.getObjectByName("cosmic-web-particles").geometry
      .getAttribute("position").count).toBe(cosmicWebPoints);
    expect(structure).toMatchObject({ nodeBudget, hotNodeCount, depthLayers: 3 });
    expect(layer.root.getObjectByName("cosmic-web-filaments").material.opacity)
      .toBe(filamentOpacity);

    layer.dispose();
  });

  it("keeps three clustered depth layers instead of uniform flat noise", () => {
    const layer = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 } });
    const { volume } = layer.root.userData.structure;
    const depthBands = new Set(layer.graph.nodes.map(([, , z]) => (
      z < -280 ? "far" : z > -190 ? "near" : "middle"
    )));
    const occupiedCells = new Set(layer.graph.nodes.map(([x, y]) => (
      `${Math.floor((x + 660) / 110)}:${Math.floor((y + 380) / 95)}`
    )));
    const clusteredNodes = layer.graph.nodes.filter((node, nodeIndex, nodes) => (
      nodes.some((candidate, candidateIndex) => candidateIndex !== nodeIndex
        && Math.hypot(
          node[0] - candidate[0],
          node[1] - candidate[1],
          node[2] - candidate[2]
        ) < 105)
    ));

    expect(depthBands).toEqual(new Set(["far", "middle", "near"]));
    expect(layer.graph.nodes.every(([x, y, z]) => (
      Math.abs(x) <= volume.width / 2
      && Math.abs(y) <= volume.height / 2
      && z >= volume.centerZ - volume.depth / 2
      && z <= volume.centerZ + volume.depth / 2
    ))).toBe(true);
    expect(clusteredNodes.length).toBeGreaterThanOrEqual(Math.round(layer.graph.nodes.length * 0.9));
    expect(occupiedCells.size).toBeGreaterThanOrEqual(12);
    expect(occupiedCells.size).toBeLessThanOrEqual(70);

    layer.dispose();
  });

  it("weaves multiple independent strands continuously across the settled central field", () => {
    const layer = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 } });
    const camera = createSettledStageCamera("cosmic-web");
    const projectedCoverage = measureProjectedGraphCoverage({ graph: layer.graph, camera });

    expect(projectedCoverage).toBeGreaterThanOrEqual(0.6);
    expect(layer.graph.edges.length).toBeLessThanOrEqual(layer.graph.nodes.length * 3);

    layer.dispose();
  });

  it("renders curved organic filament segments inside every published volume and keeps particles on the sampled curves", () => {
    const tiers = [
      ["high", 18000],
      ["medium", 9800],
      ["economy", 5200]
    ];

    tiers.forEach(([tier, cosmicWebPoints]) => {
      const layer = createCosmicWeb({ quality: { tier, cosmicWebPoints } });
      const filaments = layer.root.getObjectByName("cosmic-web-filaments");
      const positions = filaments.geometry.getAttribute("position");
      const { volume } = layer.root.userData.structure;
      const meaningfulEdges = [];

      expect(positions.count).toBe(layer.graph.edges.length * 20);
      layer.graph.edges.forEach(([from, to], edgeIndex) => {
        const firstPoint = edgeIndex * 20;
        const start = layer.graph.nodes[from];
        const end = layer.graph.nodes[to];
        const intermediateDistances = Array.from({ length: 9 }, (_, segmentIndex) => (
          distanceToSegment(pointAt(positions, firstPoint + segmentIndex * 2 + 1), start, end)
        ));

        expectPointToBeCloseTo(pointAt(positions, firstPoint), start);
        expectPointToBeCloseTo(pointAt(positions, firstPoint + 19), end);
        for (let segmentIndex = 0; segmentIndex < 9; segmentIndex += 1) {
          expectPointToBeCloseTo(
            pointAt(positions, firstPoint + segmentIndex * 2 + 1),
            pointAt(positions, firstPoint + segmentIndex * 2 + 2)
          );
        }
        if (Math.hypot(...end.map((value, axis) => value - start[axis])) > 15) {
          meaningfulEdges.push(Math.max(...intermediateDistances) > 1);
        }
      });

      expect(meaningfulEdges.length).toBeGreaterThan(0);
      expect(meaningfulEdges.filter(Boolean).length / meaningfulEdges.length).toBeGreaterThanOrEqual(0.75);
      Array.from({ length: positions.count }, (_, index) => pointAt(positions, index)).forEach(([x, y, z]) => {
        expect([x, y, z].every(Number.isFinite)).toBe(true);
        expect(Math.abs(x)).toBeLessThanOrEqual(volume.width / 2);
        expect(Math.abs(y)).toBeLessThanOrEqual(volume.height / 2);
        expect(z).toBeGreaterThanOrEqual(volume.centerZ - volume.depth / 2);
        expect(z).toBeLessThanOrEqual(volume.centerZ + volume.depth / 2);
      });

      const particles = layer.root.getObjectByName("cosmic-web-particles")
        .geometry.getAttribute("position");
      const curveFollowerComparisons = Array.from({ length: particles.count }, (_, particleIndex) => {
        const edgeIndex = particleIndex % layer.graph.edges.length;
        const sampleIndex = Math.floor(particleIndex / layer.graph.edges.length);
        const samplesOnEdge = Math.ceil((particles.count - edgeIndex) / layer.graph.edges.length);
        if (sampleIndex / samplesOnEdge < 0.25 || sampleIndex / samplesOnEdge > 0.75) return null;
        const [from, to] = layer.graph.edges[edgeIndex];
        const start = layer.graph.nodes[from];
        const end = layer.graph.nodes[to];
        const firstPoint = edgeIndex * 20;
        const curveBend = Math.max(...Array.from({ length: 9 }, (_, segmentIndex) => (
          distanceToSegment(pointAt(positions, firstPoint + segmentIndex * 2 + 1), start, end)
        )));
        if (curveBend <= 6) return null;
        const particle = pointAt(particles, particleIndex);
        return distanceToPolyline(particle, positions, firstPoint, 10)
          < distanceToSegment(particle, start, end);
      }).filter((comparison) => comparison !== null);

      expect(curveFollowerComparisons.length).toBeGreaterThan(200);
      expect(curveFollowerComparisons.filter(Boolean).length / curveFollowerComparisons.length)
        .toBeGreaterThanOrEqual(0.75);
      layer.dispose();
    });
  });

  it("bounds short-edge cubic bends by full chord length", () => {
    const layer = createCosmicWeb({
      quality: { tier: "high", cosmicWebPoints: 18000 },
      seed: 13
    });
    const positions = layer.root.getObjectByName("cosmic-web-filaments")
      .geometry.getAttribute("position");
    layer.graph.edges.forEach(([from, to], edgeIndex) => {
      const start = layer.graph.nodes[from];
      const end = layer.graph.nodes[to];
      const chordLength = Math.hypot(...end.map((value, axis) => value - start[axis]));
      const maximumBend = Math.max(...Array.from({ length: 9 }, (_, segmentIndex) => (
        distanceToSegment(pointAt(positions, edgeIndex * 20 + segmentIndex * 2 + 1), start, end)
      )));
      expect(maximumBend).toBeLessThanOrEqual(chordLength * 0.4 + 0.001);
    });
    layer.dispose();
  });

  it.each([
    ["high", 18000, ["far", "mid", "near"], [0.62, 0.78, 0.58]],
    ["medium", 9800, ["far", "near"], [0.62 * 1.55, 0.58 * 1.55]],
    ["economy", 5200, ["mid"], [0.78 * 2.35]]
  ])("creates deterministic %s procedural tissue", (
    tier,
    cosmicWebPoints,
    expectedProfiles,
    expectedOpacities
  ) => {
    const first = createCosmicWeb({ quality: { tier, cosmicWebPoints }, seed: 20260719 });
    const second = createCosmicWeb({ quality: { tier, cosmicWebPoints }, seed: 20260719 });
    const tissue = first.root.children.filter(({ name }) => name === "cosmic-web-tissue")[0];
    const secondTissue = second.root.getObjectByName("cosmic-web-tissue");
    const metadata = first.root.userData.structure.tissue;
    const baseLayer = new THREE.Layers();
    const bloomLayer = new THREE.Layers();
    baseLayer.set(0);
    bloomLayer.set(BLOOM_SCENE_LAYER);

    expect(first.root.children[0]).toBe(tissue);
    expect(tissue.children).toHaveLength(expectedProfiles.length);
    expect(tissue.children.map(({ name }) => name)).toEqual(
      expectedProfiles.map((profile) => `cosmic-web-tissue-${profile}`)
    );
    expect(metadata).toEqual(second.root.userData.structure.tissue);
    expect(metadata).toMatchObject({
      algorithm: "cellular-voronoi-fbm",
      layerCount: expectedProfiles.length,
      palette: [0x8b5cf6, 0xd946ef, 0xf472b6, 0xf59e42]
    });
    expect(metadata.profiles.map(({ name }) => name)).toEqual(expectedProfiles);
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.profiles)).toBe(true);
    expect(metadata.profiles.every(Object.isFrozen)).toBe(true);
    expect(tissue.children.every(({ material }) => (
      material.isShaderMaterial
      && material.blending === THREE.AdditiveBlending
      && material.depthWrite === false
      && material.depthTest === true
      && material.toneMapped === false
      && material.transparent === true
    ))).toBe(true);
    expect(tissue.children.every((mesh) => (
      mesh.layers.test(baseLayer) && !mesh.layers.test(bloomLayer) && mesh.renderOrder === 2
    ))).toBe(true);
    expect(new Set(tissue.children.map(({ geometry }) => geometry)).size).toBe(1);
    tissue.children.forEach((mesh, index) => {
      expect(mesh.position.z).toBe(metadata.profiles[index].depth);
      expect(mesh.material.uniforms.uOpacity.value).toBeCloseTo(expectedOpacities[index], 6);
      expect(mesh.material.uniforms.uUvOffset.value.toArray()).toEqual(
        secondTissue.children[index].material.uniforms.uUvOffset.value.toArray()
      );
      expect(mesh.material.fragmentShader).toContain("float fbm(vec2 point)");
      expect(mesh.material.fragmentShader).toContain("float cellularRidge(vec2 point)");
      expect(mesh.material.fragmentShader).toContain("float fineDust(vec2 point)");
      expect(Object.keys(mesh.material.uniforms).some((name) => /time|exposure/i.test(name)))
        .toBe(false);
    });

    first.setPresence(0.37);
    expect(tissue.children.every(({ material }) => (
      material.uniforms.uPresence.value === 0.37
    ))).toBe(true);
    if (tier === "high") {
      const opacities = tissue.children.map(({ material }) => material.uniforms.uOpacity.value);
      expect(first.updateParallax({ x: 1, y: -1 })).toEqual({ x: 1.6, y: -1.1 });
      expect(tissue.children.map(({ position }) => [position.x, position.y])).toEqual(
        metadata.profiles.map(({ parallax }) => [1.6 * parallax, -1.1 * parallax])
      );
      expect(tissue.children.map(({ material }) => material.uniforms.uOpacity.value)).toEqual(opacities);
    }

    first.dispose();
    second.dispose();
  });

  it.each([
    ["high", 18000],
    ["medium", 9800],
    ["economy", 5200]
  ])("keeps every rendered %s geometry coordinate finite and inside the published volume", (
    tier,
    cosmicWebPoints
  ) => {
    const layer = createCosmicWeb({ quality: { tier, cosmicWebPoints } });
    const { volume } = layer.root.userData.structure;
    const renderedGeometry = [];
    layer.root.traverse((object) => {
      if (object.name.startsWith("cosmic-web-") && object.geometry?.getAttribute("position")) {
        object.updateMatrixWorld(true);
        renderedGeometry.push(object);
      }
    });
    const violations = renderedGeometry.flatMap((object) => {
      const { name, geometry } = object;
      const positions = geometry.getAttribute("position");
      for (let index = 0; index < positions.count; index += 1) {
        const world = new THREE.Vector3(
          positions.getX(index),
          positions.getY(index),
          positions.getZ(index)
        ).applyMatrix4(object.matrixWorld);
        const coordinate = world.toArray();
        const finite = coordinate.every(Number.isFinite);
        const inside = Math.abs(world.x) <= volume.width / 2
          && Math.abs(world.y) <= volume.height / 2
          && world.z >= volume.centerZ - volume.depth / 2
          && world.z <= volume.centerZ + volume.depth / 2;
        if (!finite || !inside) return [{ name, index, coordinate }];
      }
      return [];
    });
    const boundaryRatios = renderedGeometry
      .filter(({ geometry }) => geometry.getAttribute("position").count > 4)
      .map(({ name, geometry, matrixWorld }) => {
        const positions = geometry.getAttribute("position");
        const boundaryCount = Array.from({ length: positions.count }, (_, index) => index)
          .filter((index) => {
            const world = new THREE.Vector3(
              positions.getX(index),
              positions.getY(index),
              positions.getZ(index)
            ).applyMatrix4(matrixWorld);
            return Math.abs(world.x) === volume.width / 2
              || Math.abs(world.y) === volume.height / 2
              || world.z === volume.centerZ - volume.depth / 2
              || world.z === volume.centerZ + volume.depth / 2;
          }).length;
        return { name, ratio: boundaryCount / positions.count };
      });

    expect(renderedGeometry.map(({ name }) => name).sort()).toEqual([
      "cosmic-web-depth",
      "cosmic-web-filaments",
      "cosmic-web-hot-nodes",
      "cosmic-web-nodes",
      "cosmic-web-particles",
      ...({
        high: ["cosmic-web-tissue-far", "cosmic-web-tissue-mid", "cosmic-web-tissue-near"],
        medium: ["cosmic-web-tissue-far", "cosmic-web-tissue-near"],
        economy: ["cosmic-web-tissue-mid"]
      })[tier]
    ]);
    expect(violations).toEqual([]);
    expect(boundaryRatios.every(({ ratio }) => ratio < 0.02)).toBe(true);

    layer.dispose();
  });

  it.each([
    ["high", 18000],
    ["medium", 9800],
    ["economy", 5200]
  ])("keeps parallax-shifted %s tissue inside the published volume", (
    tier,
    cosmicWebPoints
  ) => {
    const layer = createCosmicWeb({ quality: { tier, cosmicWebPoints } });
    const { volume } = layer.root.userData.structure;

    [{ x: 1, y: 1 }, { x: -1, y: -1 }].forEach((pointer) => {
      layer.updateParallax(pointer);
      layer.root.updateMatrixWorld(true);
      const tissue = layer.root.getObjectByName("cosmic-web-tissue");
      tissue.children.forEach((mesh) => {
        const positions = mesh.geometry.getAttribute("position");
        for (let index = 0; index < positions.count; index += 1) {
          const world = new THREE.Vector3(
            positions.getX(index),
            positions.getY(index),
            positions.getZ(index)
          ).applyMatrix4(mesh.matrixWorld);
          expect(Math.abs(world.x)).toBeLessThanOrEqual(volume.width / 2 - 0.5 + 0.001);
          expect(Math.abs(world.y)).toBeLessThanOrEqual(volume.height / 2 - 0.5 + 0.001);
          expect(world.z).toBeGreaterThanOrEqual(volume.centerZ - volume.depth / 2);
          expect(world.z).toBeLessThanOrEqual(volume.centerZ + volume.depth / 2);
        }
      });
    });

    layer.dispose();
  });

  it("limits selective bloom to dense nodes while preserving their base layer", () => {
    const layer = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 } });
    const bloomLayer = new THREE.Layers();
    const baseLayer = new THREE.Layers();
    bloomLayer.set(BLOOM_SCENE_LAYER);
    baseLayer.set(0);
    const nodes = layer.root.getObjectByName("cosmic-web-nodes");
    const hotNodes = layer.root.getObjectByName("cosmic-web-hot-nodes");

    [nodes, hotNodes].forEach((object) => {
      expect(object.layers.test(baseLayer)).toBe(true);
      expect(object.layers.test(bloomLayer)).toBe(true);
    });
    ["cosmic-web-filaments", "cosmic-web-particles", "cosmic-web-depth"].forEach((name) => {
      const object = layer.root.getObjectByName(name);
      expect(object.layers.test(baseLayer)).toBe(true);
      expect(object.layers.test(bloomLayer)).toBe(false);
    });

    layer.dispose();
  });

  it("builds a connected deterministic nearest-neighbour graph with frozen normalized records", () => {
    const first = createCosmicWeb();
    const second = createCosmicWeb();
    const adjacency = first.graph.nodes.map(() => []);
    first.graph.edges.forEach(([from, to]) => {
      adjacency[from].push(to);
      adjacency[to].push(from);
    });
    const visited = new Set([0]);
    const queue = [0];
    while (queue.length > 0) {
      adjacency[queue.shift()].forEach((node) => {
        if (visited.has(node)) return;
        visited.add(node);
        queue.push(node);
      });
    }

    expect(first.graph).toEqual(second.graph);
    expect(visited.size).toBe(first.graph.nodes.length);
    expect(first.graph.edges.length).toBeGreaterThanOrEqual(first.graph.nodes.length - 1);
    expect(first.graph.edges.length).toBeLessThanOrEqual(first.graph.nodes.length * 3);
    expect(first.graph.edges.every(([from, to]) => from < to)).toBe(true);
    expect(new Set(first.graph.edges.map((edge) => edge.join(":"))).size).toBe(first.graph.edges.length);
    expect(Object.isFrozen(first.graph)).toBe(true);
    expect(first.graph.nodes.every(Object.isFrozen)).toBe(true);
    expect(first.graph.edges.every(Object.isFrozen)).toBe(true);

    first.dispose();
    second.dispose();
  });

  it("caps non-default medium graphs without dropping the connected spanning backbone", () => {
    const layer = createCosmicWeb({
      quality: { tier: "medium", cosmicWebPoints: 9800 },
      seed: 106
    });
    const adjacency = layer.graph.nodes.map(() => []);
    layer.graph.edges.forEach(([from, to]) => {
      adjacency[from].push(to);
      adjacency[to].push(from);
    });
    const visited = new Set([0]);
    const queue = [0];
    while (queue.length > 0) {
      adjacency[queue.shift()].forEach((node) => {
        if (visited.has(node)) return;
        visited.add(node);
        queue.push(node);
      });
    }

    expect(layer.graph.edges.length).toBeLessThanOrEqual(layer.graph.nodes.length * 3);
    expect(visited.size).toBe(layer.graph.nodes.length);

    layer.dispose();
  });

  it("changes the graph when the seed changes without mutating either input", () => {
    const quality = Object.freeze({ tier: "economy", cosmicWebPoints: 5200 });
    const first = createCosmicWeb({ quality, seed: 11 });
    const second = createCosmicWeb({ quality, seed: 12 });

    expect(first.graph.nodes).not.toEqual(second.graph.nodes);
    expect(quality).toEqual({ tier: "economy", cosmicWebPoints: 5200 });

    first.dispose();
    second.dispose();
  });

  it("supports the full safe-integer seed boundary", () => {
    const layer = createCosmicWeb({ seed: Number.MAX_SAFE_INTEGER });

    expect(layer.graph.nodes).toHaveLength(68);

    layer.dispose();
  });

  it.each([
    ["high", 18000],
    ["medium", 9800],
    ["economy", 5200]
  ])("places the exact %s quality point budget along volumetric filaments", (tier, cosmicWebPoints) => {
    const layer = createCosmicWeb({ quality: { tier, cosmicWebPoints } });
    const particles = layer.root.getObjectByName("cosmic-web-particles");
    const positions = particles.geometry.getAttribute("position");
    const distinctDepths = new Set(Array.from(positions.array).filter((_, index) => index % 3 === 2)
      .map((value) => Math.round(value)));

    expect(positions.count).toBe(cosmicWebPoints);
    expect(distinctDepths.size).toBeGreaterThan(40);
    expect(layer.root.getObjectByName("cosmic-web-filaments")?.isLineSegments).toBe(true);
    expect(layer.root.getObjectByName("cosmic-web-nodes")?.isPoints).toBe(true);
    expect(layer.root.getObjectByName("cosmic-web-depth")?.isPoints).toBe(true);
    expect(layer.root.children.some(({ name }) => name.includes("plane"))).toBe(false);

    layer.dispose();
  });

  it("forms deterministic quality-scaled galaxy-point clusters around every graph node", () => {
    const first = createCosmicWeb();
    const second = createCosmicWeb();
    const high = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 } });
    const firstNodes = first.root.getObjectByName("cosmic-web-nodes").geometry.getAttribute("position");
    const secondNodes = second.root.getObjectByName("cosmic-web-nodes").geometry.getAttribute("position");
    const highNodes = high.root.getObjectByName("cosmic-web-nodes").geometry.getAttribute("position");
    const clusterPositions = firstNodes.array;
    const nearbyCount = (center) => Array.from({ length: firstNodes.count }, (_, index) => {
      const offset = index * 3;
      return Math.hypot(
        clusterPositions[offset] - center[0],
        clusterPositions[offset + 1] - center[1],
        clusterPositions[offset + 2] - center[2]
      );
    }).filter((distance) => distance < 24).length;

    expect(firstNodes.count).toBeGreaterThan(first.graph.nodes.length);
    expect(highNodes.count).toBeGreaterThan(firstNodes.count);
    expect(firstNodes.array).toEqual(secondNodes.array);
    expect(first.graph.nodes.slice(0, 12).every((center) => nearbyCount(center) >= 6)).toBe(true);

    first.dispose();
    second.dispose();
    high.dispose();
  });

  it("uses independently faded observatory layers and shared parallax behavior", () => {
    const layer = createCosmicWeb({ quality: { tier: "high", cosmicWebPoints: 18000 } });
    const particles = layer.root.getObjectByName("cosmic-web-particles");
    const filaments = layer.root.getObjectByName("cosmic-web-filaments");
    const nodes = layer.root.getObjectByName("cosmic-web-nodes");
    const depth = layer.root.getObjectByName("cosmic-web-depth");
    const hotNodes = layer.root.getObjectByName("cosmic-web-hot-nodes");

    expect([particles, filaments, nodes, depth, hotNodes].every(({ material }) => (
      material.transparent && !material.depthWrite
    ))).toBe(true);
    expect(new Set([particles.renderOrder, filaments.renderOrder, nodes.renderOrder, depth.renderOrder]).size)
      .toBeGreaterThan(2);
    expect(layer.updateParallax({ x: 1, y: -1 })).toEqual({ x: 1.6, y: -1.1 });
    layer.setPresence(0.5);
    expect(particles.material.opacity).toBeGreaterThan(0);
    expect(particles.material.opacity).not.toBe(nodes.material.opacity);

    layer.dispose();
  });

  it("honors reduced motion and fails closed for malformed presence and parallax", () => {
    const reduced = createCosmicWeb({
      quality: { tier: "high", cosmicWebPoints: 18000 },
      reducedMotion: true
    });
    const economy = createCosmicWeb();

    expect(reduced.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0, y: 0 });
    expect(reduced.root.getObjectByName("cosmic-web-filaments").material.opacity).toBe(0.48);
    expect(economy.updateParallax({ x: 1, y: -1 })).toEqual({ x: 0, y: 0 });
    economy.setPresence("visible");
    expect(economy.root.visible).toBe(false);
    expect(economy.updateParallax({ x: 1, y: "-1" })).toEqual({ x: 0, y: 0 });
    expect(economy.updateParallax(null)).toEqual({ x: 0, y: 0 });

    reduced.dispose();
    economy.dispose();
  });

  it.each([
    { THREE: null },
    { quality: null },
    { quality: { tier: "economy", cosmicWebPoints: 0 } },
    { quality: { tier: "economy", cosmicWebPoints: 2.5 } },
    { seed: 1.5 },
    { reducedMotion: "false" },
    { THREE: { Group: THREE.Group } }
  ])("rejects invalid boundary input %j", (overrides) => {
    expect(() => createCosmicWebLayer({
      THREE,
      quality: { tier: "economy", cosmicWebPoints: 5200 },
      glowTexture: null,
      reducedMotion: false,
      seed: 20260719,
      ...overrides
    })).toThrow(TypeError);
  });

  it("disposes every resource tree only once", () => {
    const layer = createCosmicWeb();
    const resources = new Set();
    layer.root.traverse(({ geometry, material }) => {
      if (geometry) resources.add(geometry);
      if (material) resources.add(material);
    });
    const disposeSpies = [...resources].map((resource) => vi.spyOn(resource, "dispose"));

    layer.dispose();
    layer.dispose();

    disposeSpies.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(layer.root.children).toHaveLength(0);
  });
});
