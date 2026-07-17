import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createEarthLayer } from "../../src/scene/layers/earth.js";
import { selectEarthTextureRoutes } from "../../src/scene/earth-assets.js";

const createLayer = ({ maxAnisotropy = 16 } = {}) => {
  const earth = new THREE.Texture();
  const clouds = new THREE.Texture();
  return {
    earth,
    clouds,
    layer: createEarthLayer({
      THREE,
      textures: Object.freeze({ earth, clouds }),
      quality: Object.freeze({ tier: "high", sphereSegments: 64 }),
      renderer: Object.freeze({
        capabilities: Object.freeze({ getMaxAnisotropy: () => maxAnisotropy })
      })
    })
  };
};

describe("createEarthLayer", () => {
  it("selects frozen adaptive Earth routes without decoding 8K on economy devices", () => {
    const high = selectEarthTextureRoutes({ tier: "high" });
    const medium = selectEarthTextureRoutes({ tier: "medium" });
    const economy = selectEarthTextureRoutes({ tier: "economy" });

    expect(high).toEqual({
      surface: "/space/earth-daymap-8k.jpg",
      clouds: "/space/earth-clouds-4k.jpg"
    });
    expect(medium).toEqual({
      surface: "/space/earth-daymap-4k.jpg",
      clouds: "/space/earth-clouds-4k.jpg"
    });
    expect(economy).toEqual(medium);
    expect(Object.isFrozen(high)).toBe(true);
    expect(Object.isFrozen(economy)).toBe(true);
  });

  it("builds the approved large static orbital composition", () => {
    const { layer } = createLayer();
    const surface = layer.root.getObjectByName("earth-surface");
    const clouds = layer.root.getObjectByName("earth-clouds");
    const atmosphere = layer.root.getObjectByName("earth-atmosphere");

    expect(layer.root.name).toBe("earth-layer");
    expect(layer.root.userData.staticComposition).toBe(true);
    expect(layer.root.position.toArray()).toEqual([4.5, -3.5, 0]);
    expect(surface.geometry.parameters.radius).toBe(14);
    expect(clouds.geometry.parameters.radius).toBe(14.08);
    expect(atmosphere.geometry.parameters.radius).toBe(14.34);
    expect([surface, clouds, atmosphere].every(({ userData }) => (
      userData.rotationSpeed === undefined
    ))).toBe(true);
  });

  it("uses color, alpha, transparency and depth settings suited to the supplied maps", () => {
    const { clouds: cloudTexture, earth: earthTexture, layer } = createLayer();
    const surface = layer.root.getObjectByName("earth-surface");
    const clouds = layer.root.getObjectByName("earth-clouds");
    const atmosphere = layer.root.getObjectByName("earth-atmosphere");

    expect(surface.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(surface.material.map).toBe(earthTexture);
    expect(surface.material.roughness).toBeCloseTo(0.72);
    expect(surface.material.metalness).toBe(0);
    expect(surface.material.transparent).toBe(true);
    expect(surface.material.depthWrite).toBe(true);

    expect(clouds.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(clouds.material.map).toBe(cloudTexture);
    expect(clouds.material.alphaMap).toBe(cloudTexture);
    expect(clouds.material.transparent).toBe(true);
    expect(clouds.material.depthWrite).toBe(false);

    expect(atmosphere.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(atmosphere.material.side).toBe(THREE.BackSide);
    expect(atmosphere.material.transparent).toBe(true);
    expect(atmosphere.material.depthWrite).toBe(false);
  });

  it("configures Earth textures for smooth mipmapped sampling at maximum renderer anisotropy", () => {
    const { clouds, earth } = createLayer({ maxAnisotropy: 12 });

    [earth, clouds].forEach((texture) => {
      expect(texture.generateMipmaps).toBe(true);
      expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
      expect(texture.magFilter).toBe(THREE.LinearFilter);
      expect(texture.anisotropy).toBe(12);
      expect(texture.version).toBeGreaterThan(0);
    });
  });

  it("changes only presence and leaves the Earth transform static", () => {
    const { layer } = createLayer();
    const meshes = ["earth-surface", "earth-clouds", "earth-atmosphere"]
      .map((name) => layer.root.getObjectByName(name));
    const rotations = meshes.map(({ rotation }) => rotation.toArray());

    layer.setPresence(0.5);
    expect(layer.root.visible).toBe(true);
    expect(meshes.map(({ material }) => material.opacity)).toEqual([0.5, 0.24, 0.055]);
    expect(meshes.map(({ rotation }) => rotation.toArray())).toEqual(rotations);

    layer.setPresence(-1);
    expect(layer.root.visible).toBe(false);
    expect(meshes.every(({ material }) => material.opacity === 0)).toBe(true);
  });

  it("rotates surface and clouds independently while the intro is active", () => {
    const { layer } = createLayer();
    const surface = layer.root.getObjectByName("earth-surface");
    const clouds = layer.root.getObjectByName("earth-clouds");

    layer.updateMotion({ delta: 1, introActive: true });

    expect(surface.rotation.y).not.toBe(clouds.rotation.y);
    expect(surface.rotation.y).toBeGreaterThan(0);
    expect(clouds.rotation.y).toBeGreaterThan(0);
  });

  it("ignores invalid motion, inactive intros, and updates after disposal", () => {
    const { layer } = createLayer();
    const surface = layer.root.getObjectByName("earth-surface");
    const clouds = layer.root.getObjectByName("earth-clouds");

    layer.updateMotion({ delta: Number.NaN, introActive: true });
    layer.updateMotion({ delta: 1, introActive: false });
    expect([surface.rotation.y, clouds.rotation.y]).toEqual([0, 0]);

    layer.dispose();
    expect(() => layer.updateMotion({ delta: 1, introActive: true })).not.toThrow();
    expect([surface.rotation.y, clouds.rotation.y]).toEqual([0, 0]);
  });

  it("aligns a copied geographic focus with the camera and keeps it static", () => {
    const { layer } = createLayer();
    const focus = { lat: 0, lon: 0 };
    const cameraDirection = new THREE.Vector3(0, 0, 3);
    const cameraDirectionBefore = cameraDirection.clone();

    layer.setFocus(focus, cameraDirection);

    const marker = layer.root.getObjectByName("earth-focus-marker");
    const focusedNormal = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(layer.root.quaternion)
      .normalize();
    const quaternionBefore = layer.root.quaternion.clone();
    const markerPositionBefore = marker.position.clone();

    expect(focusedNormal.dot(cameraDirection.clone().normalize())).toBeCloseTo(1, 6);
    expect(marker.position.clone().normalize().distanceTo(new THREE.Vector3(1, 0, 0))).toBeCloseTo(0, 8);
    expect(layer.root.userData.focus).toEqual({ lat: 0, lon: 0 });
    expect(layer.root.userData.focus).not.toBe(focus);
    expect(Object.isFrozen(layer.root.userData.focus)).toBe(true);
    expect(focus).toEqual({ lat: 0, lon: 0 });
    expect(cameraDirection).toEqual(cameraDirectionBefore);

    layer.setPresence(0.35);
    layer.setPresence(1);
    layer.setFocus(focus, cameraDirection);

    expect(layer.root.quaternion.equals(quaternionBefore)).toBe(true);
    expect(marker.position.equals(markerPositionBefore)).toBe(true);
    expect(layer.root.children.filter(({ name }) => name === "earth-focus-marker")).toHaveLength(1);
  });

  it("keeps geographic north upright while the selected point faces the camera", () => {
    const { layer } = createLayer();
    const focus = Object.freeze({ lat: 55.7558, lon: 37.6173 });
    const cameraDirection = new THREE.Vector3(-4.5, 7, 29).normalize();
    const cameraUp = new THREE.Vector3(0, 1, 0);
    const latitude = THREE.MathUtils.degToRad(focus.lat);
    const longitude = THREE.MathUtils.degToRad(focus.lon);
    const localNormal = new THREE.Vector3(
      Math.cos(latitude) * Math.cos(longitude),
      Math.sin(latitude),
      -Math.cos(latitude) * Math.sin(longitude)
    ).normalize();
    const localNorth = new THREE.Vector3(
      -Math.sin(latitude) * Math.cos(longitude),
      Math.cos(latitude),
      Math.sin(latitude) * Math.sin(longitude)
    ).normalize();

    layer.setFocus(focus, cameraDirection, cameraUp);

    const worldNormal = localNormal.clone().applyQuaternion(layer.root.quaternion).normalize();
    const worldNorth = localNorth.clone().applyQuaternion(layer.root.quaternion)
      .projectOnPlane(cameraDirection)
      .normalize();
    const projectedCameraUp = cameraUp.clone().projectOnPlane(cameraDirection).normalize();
    const quaternionBefore = layer.root.quaternion.clone();

    expect(worldNormal.dot(cameraDirection)).toBeCloseTo(1, 6);
    expect(worldNorth.dot(projectedCameraUp)).toBeCloseTo(1, 6);

    layer.setFocus(focus, cameraDirection, cameraUp);
    expect(layer.root.quaternion.equals(quaternionBefore)).toBe(true);
  });

  it("builds a subtle luminous surface marker without rotation state", () => {
    const { layer } = createLayer();

    layer.setFocus({ lat: 55.7558, lon: 37.6173 }, [0, 0, 1]);

    const marker = layer.root.getObjectByName("earth-focus-marker");
    expect(marker.geometry).toBeInstanceOf(THREE.RingGeometry);
    expect(marker.geometry.parameters.innerRadius).toBeCloseTo(0.16);
    expect(marker.geometry.parameters.outerRadius).toBeCloseTo(0.28);
    expect(marker.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(marker.material.transparent).toBe(true);
    expect(marker.material.depthWrite).toBe(false);
    expect(marker.material.toneMapped).toBe(false);
    expect(marker.userData.rotationSpeed).toBeUndefined();
    expect(marker.position.length()).toBeCloseTo(14.12);
  });

  it("returns an immutable contract and disposes owned GPU resources once", () => {
    const { earth, clouds, layer } = createLayer();
    layer.setFocus({ lat: 0, lon: 0 }, new THREE.Vector3(0, 0, 1));
    const meshes = ["earth-surface", "earth-clouds", "earth-atmosphere", "earth-focus-marker"]
      .map((name) => layer.root.getObjectByName(name));
    const geometryDisposals = meshes.map(({ geometry }) => vi.spyOn(geometry, "dispose"));
    const materialDisposals = meshes.map(({ material }) => vi.spyOn(material, "dispose"));
    const earthDispose = vi.spyOn(earth, "dispose");
    const cloudsDispose = vi.spyOn(clouds, "dispose");

    expect(Object.isFrozen(layer)).toBe(true);
    expect(Object.isFrozen(layer.interactive)).toBe(true);
    expect(layer.interactive).toEqual([meshes[0]]);

    layer.dispose();
    layer.dispose();

    geometryDisposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    materialDisposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(earthDispose).not.toHaveBeenCalled();
    expect(cloudsDispose).not.toHaveBeenCalled();
    expect(() => layer.setFocus({ lat: 10, lon: 20 }, [1, 0, 0])).not.toThrow();
    expect(() => layer.setPresence(1)).not.toThrow();
    expect(layer.root.children).toHaveLength(0);
  });
});
