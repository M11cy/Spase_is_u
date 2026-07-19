const clampPresence = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const textureEntryFor = (textures, planet) => (
  textures?.get?.(planet.image)
  ?? textures?.get?.(planet.name)
  ?? textures?.get?.(planet.name.toLowerCase())
  ?? null
);

const textureFrom = (entry) => entry?.texture ?? (entry?.isTexture ? entry : null);

const createPlanetAnnotation = (planet, mesh, stage) => Object.freeze({
  id: `solar-${planet.name.toLowerCase()}`,
  title: planet.title,
  stage,
  text: planet.text,
  discovery: planet.discovery,
  distance: planet.distance,
  image: planet.image,
  quiz: planet.quiz,
  object3D: mesh
});

export const createSolarSystemLayer = ({
  THREE,
  stage,
  planets,
  textures = new Map(),
  quality = {},
  composition = {}
}) => {
  const root = new THREE.Group();
  const compactComposition = composition.compact
    ?? quality.compactNearSpace
    ?? quality.tier === "economy";
  root.name = "solar-system-layer";
  root.userData.staticComposition = true;
  root.rotation.set(-0.82, 0, 0.2);
  root.position.x = compactComposition ? -5 : 0;
  root.visible = false;

  const geometrySegments = quality.tier === "high" ? 40 : quality.tier === "economy" ? 20 : 28;
  const orbitalScale = quality.orbitalScale ?? (compactComposition ? 0.24 : 1);
  const planetScale = compactComposition ? 1.6 : 1;
  const fadedObjects = [];
  const geometries = new Set();
  const materials = new Set();
  const textureResources = new Set();

  const register = (object, baseOpacity) => {
    object.userData.baseOpacity = baseOpacity;
    fadedObjects.push(object);
    if (object.geometry && !object.isSprite) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
    return object;
  };

  const sunGeometry = new THREE.SphereGeometry(2.2, geometrySegments, Math.round(geometrySegments * 0.7));
  const sunMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd477,
    emissive: 0xff9d2e,
    emissiveIntensity: 1.55,
    roughness: 0.72,
    metalness: 0,
    transparent: true,
    opacity: 1
  });
  const sun = register(new THREE.Mesh(sunGeometry, sunMaterial), 1);
  sun.name = "sun";
  sun.position.set(10, 0, 0);
  root.add(sun);

  const glowEntry = textures?.get?.("glow");
  const sunGlowMaterial = new THREE.SpriteMaterial({
    map: textureFrom(glowEntry),
    color: 0xffd98a,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const sunGlow = register(new THREE.Sprite(sunGlowMaterial), 0.82);
  sunGlow.name = "sun-glow";
  sunGlow.position.copy(sun.position);
  sunGlow.scale.set(15, 15, 1);
  sunGlow.renderOrder = 4;
  root.add(sunGlow);

  const interactive = planets.map((planet) => {
    const displayRadius = planet.radius * orbitalScale;
    const displaySize = planet.size * planetScale;
    const orbitGeometry = new THREE.TorusGeometry(displayRadius, 0.022, 6, 128);
    const orbitMaterial = new THREE.MeshBasicMaterial({
      color: 0xcbd9ee,
      transparent: true,
      opacity: 0.16,
      depthWrite: false
    });
    const orbit = register(new THREE.Mesh(orbitGeometry, orbitMaterial), 0.16);
    orbit.name = `orbit-${planet.name.toLowerCase()}`;
    orbit.rotation.x = Math.PI / 2;
    orbit.position.x = 10;
    root.add(orbit);

    const textureEntry = textureEntryFor(textures, planet);
    const texture = textureFrom(textureEntry);
    if (textureEntry?.texture && typeof textureEntry.release === "function") {
      textureResources.add(textureEntry);
    }
    const planetGeometry = new THREE.SphereGeometry(
      displaySize,
      geometrySegments,
      Math.round(geometrySegments * 0.68)
    );
    const planetMaterial = new THREE.MeshStandardMaterial({
      color: texture ? 0xffffff : planet.color,
      map: texture,
      roughness: 0.66,
      metalness: 0,
      emissive: planet.color,
      emissiveIntensity: texture ? 0.035 : 0.09,
      transparent: true,
      opacity: 1
    });
    const mesh = register(new THREE.Mesh(planetGeometry, planetMaterial), 1);
    mesh.name = `planet-${planet.name.toLowerCase()}`;
    mesh.position.set(
      10 + Math.cos(planet.angle) * displayRadius,
      0,
      Math.sin(planet.angle) * displayRadius
    );
    mesh.userData.annotation = createPlanetAnnotation(planet, mesh, stage);
    root.add(mesh);

    if (planet.name === "Saturn") {
      const ringGeometry = new THREE.RingGeometry(displaySize * 1.25, displaySize * 2.05, geometrySegments);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xd9c79f,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const rings = register(new THREE.Mesh(ringGeometry, ringMaterial), 0.62);
      rings.name = "saturn-rings";
      rings.rotation.set(Math.PI / 2 + 0.12, 0.18, 0);
      mesh.add(rings);
    }

    return mesh;
  });

  let disposed = false;
  const setPresence = (value) => {
    if (disposed) return;
    const presence = clampPresence(value);
    root.visible = presence > 0.01;
    fadedObjects.forEach((object) => {
      object.material.opacity = object.userData.baseOpacity * presence;
    });
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textureResources.forEach((resource) => resource.release());
    root.clear();
  };

  return Object.freeze({
    root,
    interactive: Object.freeze(interactive),
    setPresence,
    dispose
  });
};
