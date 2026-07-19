const clampPresence = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const createDashedPositions = ({ THREE, start, end, dashCount, fill }) => {
  const positions = [];
  for (let index = 0; index < dashCount; index += 1) {
    const dashStart = index / dashCount;
    const dashEnd = Math.min(1, (index + fill) / dashCount);
    const from = new THREE.Vector3().lerpVectors(start, end, dashStart);
    const to = new THREE.Vector3().lerpVectors(start, end, dashEnd);
    positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
  }
  return positions;
};

export const createHeliosphereLayer = ({
  THREE,
  glowTexture,
  quality = {},
  composition = {},
  voyager = {},
  sunPosition = [0, 0, -18]
}) => {
  const root = new THREE.Group();
  const compactComposition = composition.compact
    ?? quality.compactNearSpace
    ?? quality.tier === "economy";
  root.name = "heliosphere-layer";
  root.userData.staticComposition = true;
  root.visible = false;
  root.scale.x = quality.horizontalScale ?? (compactComposition ? 0.34 : 1);
  root.position.x = compactComposition ? -8 : 0;

  const sphereSegments = quality.tier === "high" ? 48 : quality.tier === "economy" ? 24 : 36;
  const fadedObjects = [];
  const geometries = new Set();
  const materials = new Set();
  const register = (object, baseOpacity) => {
    object.userData.baseOpacity = baseOpacity;
    fadedObjects.push(object);
    if (object.geometry && !object.isSprite) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
    return object;
  };

  const shellGroup = new THREE.Group();
  shellGroup.name = "solar-wind-shells";
  shellGroup.position.z = -18;
  const shellDefinitions = Object.freeze([
    Object.freeze({ radius: 76, color: 0x68bfff, opacity: 0.038, side: THREE.BackSide, scale: [1.24, 0.76, 0.94], x: -2 }),
    Object.freeze({ radius: 84, color: 0x849cff, opacity: 0.052, side: THREE.FrontSide, scale: [1.29, 0.8, 0.98], x: 0 }),
    Object.freeze({ radius: 91, color: 0xa28cff, opacity: 0.03, side: THREE.BackSide, scale: [1.34, 0.84, 1.02], x: 2 })
  ]);
  shellDefinitions.forEach((definition, index) => {
    const geometry = new THREE.SphereGeometry(
      definition.radius,
      sphereSegments,
      Math.round(sphereSegments * 0.55)
    );
    const material = new THREE.MeshBasicMaterial({
      color: definition.color,
      transparent: true,
      opacity: definition.opacity,
      side: definition.side,
      wireframe: false,
      depthWrite: false
    });
    const shell = register(new THREE.Mesh(geometry, material), definition.opacity);
    shell.name = `solar-wind-shell-${index + 1}`;
    shell.position.x = definition.x;
    shell.scale.set(...definition.scale);
    shell.renderOrder = index + 1;
    shellGroup.add(shell);
  });
  root.add(shellGroup);

  const voyagerPosition = Object.freeze([...(voyager.position ?? [102, 12, -24])]);
  root.updateMatrixWorld(true);
  const trajectoryStart = root.worldToLocal(new THREE.Vector3(...sunPosition));
  const markerPosition = new THREE.Vector3(...voyagerPosition);
  const trajectoryGeometry = new THREE.BufferGeometry();
  trajectoryGeometry.setAttribute("position", new THREE.Float32BufferAttribute(createDashedPositions({
    THREE,
    start: trajectoryStart,
    end: markerPosition,
    dashCount: quality.tier === "economy" ? 14 : 20,
    fill: 0.58
  }), 3));
  const trajectoryMaterial = new THREE.LineBasicMaterial({
    color: 0xa9d8ff,
    transparent: true,
    opacity: 0.48,
    depthWrite: false
  });
  const trajectory = register(new THREE.LineSegments(trajectoryGeometry, trajectoryMaterial), 0.48);
  trajectory.name = "voyager-trajectory";
  trajectory.renderOrder = 5;
  root.add(trajectory);

  const markerGeometry = new THREE.SphereGeometry(1.05, 20, 12);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0xf4f8ff,
    transparent: true,
    opacity: 0.96,
    depthWrite: false
  });
  const marker = register(new THREE.Mesh(markerGeometry, markerMaterial), 0.96);
  marker.name = "voyager-marker";
  marker.position.copy(markerPosition);
  marker.renderOrder = 7;
  const annotation = Object.freeze({
    id: voyager.id ?? "voyager",
    title: voyager.title ?? "Это Вояджер-1",
    stage: voyager.stage ?? 3,
    text: voyager.text,
    discovery: voyager.discovery,
    distance: voyager.distance,
    image: voyager.image,
    position: voyagerPosition,
    object3D: marker
  });
  marker.userData.annotation = annotation;
  root.add(marker);

  const markerGlowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xb9e0ff,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const markerGlow = register(new THREE.Sprite(markerGlowMaterial), 0.72);
  markerGlow.name = "voyager-glow";
  markerGlow.position.copy(markerPosition);
  markerGlow.scale.set(9, 9, 1);
  markerGlow.renderOrder = 6;
  root.add(markerGlow);

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
    root.clear();
  };

  return Object.freeze({
    root,
    interactive: Object.freeze([marker]),
    setPresence,
    dispose
  });
};
