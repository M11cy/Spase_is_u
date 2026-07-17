const clampPresence = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const EARTH_RADIUS = 14;
const MARKER_RADIUS = 14.12;

const focusNormalFor = (THREE, { lat, lon }) => {
  const latitude = THREE.MathUtils.degToRad(Number.isFinite(lat) ? lat : 0);
  const longitude = THREE.MathUtils.degToRad(Number.isFinite(lon) ? lon : 0);
  const latitudeScale = Math.cos(latitude);
  return new THREE.Vector3(
    latitudeScale * Math.cos(longitude),
    Math.sin(latitude),
    -latitudeScale * Math.sin(longitude)
  ).normalize();
};

const focusNorthFor = (THREE, { lat, lon }) => {
  const latitude = THREE.MathUtils.degToRad(Number.isFinite(lat) ? lat : 0);
  const longitude = THREE.MathUtils.degToRad(Number.isFinite(lon) ? lon : 0);
  return new THREE.Vector3(
    -Math.sin(latitude) * Math.cos(longitude),
    Math.cos(latitude),
    Math.sin(latitude) * Math.sin(longitude)
  ).normalize();
};

const cameraVectorFor = (THREE, cameraDirection) => {
  if (Array.isArray(cameraDirection)) return new THREE.Vector3(...cameraDirection);
  return new THREE.Vector3(cameraDirection?.x, cameraDirection?.y, cameraDirection?.z);
};

const configureTexture = ({ THREE, texture, anisotropy }) => {
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
};

export const createEarthLayer = ({ THREE, textures, quality = {}, renderer = null }) => {
  const segments = quality.sphereSegments ?? (quality.tier === "high" ? 64 : 40);
  const heightSegments = Math.round(segments * 0.65);
  const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.()
    ?? Math.max(textures.earth?.anisotropy ?? 1, textures.clouds?.anisotropy ?? 1);
  [textures.earth, textures.clouds].forEach((texture) => {
    configureTexture({ THREE, texture, anisotropy: maxAnisotropy });
  });
  const root = new THREE.Group();
  root.name = "earth-layer";
  root.userData.staticComposition = true;
  root.position.set(4.5, -3.5, 0);

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, segments, heightSegments),
    new THREE.MeshStandardMaterial({
      map: textures.earth,
      roughness: 0.72,
      metalness: 0,
      emissive: 0x020817,
      emissiveIntensity: 0.08,
      transparent: true
    })
  );
  surface.name = "earth-surface";

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(14.08, segments, heightSegments),
    new THREE.MeshStandardMaterial({
      map: textures.clouds,
      alphaMap: textures.clouds,
      color: 0xf2f7ff,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.48,
      depthWrite: false
    })
  );
  clouds.name = "earth-clouds";

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(14.34, segments, heightSegments),
    new THREE.MeshBasicMaterial({
      color: 0x6dbdff,
      transparent: true,
      opacity: 0.11,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  atmosphere.name = "earth-atmosphere";

  const meshes = Object.freeze([surface, clouds, atmosphere]);
  meshes.forEach((mesh) => {
    mesh.userData.baseOpacity = mesh.material.opacity;
  });
  root.add(...meshes);

  let disposed = false;
  let marker = null;
  let presence = 1;
  const createFocusMarker = () => {
    const focusMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.28, 32),
      new THREE.MeshBasicMaterial({
        color: 0xf5fbff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false
      })
    );
    focusMarker.name = "earth-focus-marker";
    focusMarker.userData.baseOpacity = focusMarker.material.opacity;
    root.add(focusMarker);
    return focusMarker;
  };
  const setFocus = (focus, cameraDirection, cameraUp = [0, 1, 0]) => {
    if (disposed) return;
    const focusCopy = Object.freeze({
      lat: Number.isFinite(focus?.lat) ? focus.lat : 0,
      lon: Number.isFinite(focus?.lon) ? focus.lon : 0
    });
    const surfaceNormal = focusNormalFor(THREE, focusCopy);
    const surfaceNorth = focusNorthFor(THREE, focusCopy);
    const targetDirection = cameraVectorFor(THREE, cameraDirection);
    if (targetDirection.lengthSq() === 0) targetDirection.set(0, 0, 1);
    targetDirection.normalize();
    const targetUp = cameraVectorFor(THREE, cameraUp)
      .addScaledVector(targetDirection, -cameraVectorFor(THREE, cameraUp).dot(targetDirection));
    if (targetUp.lengthSq() < 1e-8) {
      targetUp.set(1, 0, 0).addScaledVector(targetDirection, -targetDirection.x);
    }
    targetUp.normalize();
    const sourceRight = surfaceNorth.clone().cross(surfaceNormal).normalize();
    const targetRight = targetUp.clone().cross(targetDirection).normalize();
    const sourceBasis = new THREE.Matrix4().makeBasis(sourceRight, surfaceNorth, surfaceNormal);
    const targetBasis = new THREE.Matrix4().makeBasis(targetRight, targetUp, targetDirection);
    const alignment = targetBasis.multiply(sourceBasis.clone().invert());

    marker ??= createFocusMarker();
    marker.position.copy(surfaceNormal).multiplyScalar(MARKER_RADIUS);
    marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfaceNormal);
    marker.material.opacity = marker.userData.baseOpacity * presence;
    root.quaternion.setFromRotationMatrix(alignment);
    root.userData.focus = focusCopy;
    root.userData.focusNorthWorld = Object.freeze(
      surfaceNorth.clone().applyQuaternion(root.quaternion).normalize().toArray()
    );
  };
  const setPresence = (value) => {
    if (disposed) return;
    presence = clampPresence(value);
    root.visible = presence > 0.01;
    [...meshes, ...(marker ? [marker] : [])].forEach((mesh) => {
      mesh.material.opacity = mesh.userData.baseOpacity * presence;
    });
  };
  const updateMotion = ({ delta, introActive } = {}) => {
    if (disposed || !introActive || !Number.isFinite(delta)) return;
    surface.rotation.y += delta * 0.018;
    clouds.rotation.y += delta * 0.025;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    [...meshes, ...(marker ? [marker] : [])].forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    root.clear();
  };

  return Object.freeze({
    root,
    interactive: Object.freeze([surface]),
    setFocus,
    setPresence,
    updateMotion,
    dispose
  });
};
