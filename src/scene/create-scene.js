const createDefaultRenderer = (THREE, canvas) => new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true
});

const positiveDimension = (value, fallback) => (
  Number.isFinite(value) && value > 0 ? value : fallback
);

const freezePose = ({ position, target, fov }) => Object.freeze({
  position: Object.freeze(position),
  target: Object.freeze(target),
  fov
});

export const freezePositionedAnnotation = ({ position, ...annotation }) => Object.freeze({
  ...annotation,
  position: Object.freeze([...position])
});

export const isStaticCameraStop = ({ stages, stageState }) => {
  const stage = stages[stageState.activeStage];
  return stage?.motion === "static"
    && stageState.layerPresence[stageState.activeStage] === 1;
};

export const resolveCameraPose = ({ stages, stageState, interpolatedPose, staticPose }) => (
  isStaticCameraStop({ stages, stageState })
    ? (staticPose ?? stages[stageState.activeStage].camera)
    : interpolatedPose
);

export const createEarthCameraPose = ({
  basePose,
  aspect,
  earthPosition = Object.freeze([4.5, -3.5, 0]),
  radius = 14,
  occupancy = 0.84
}) => {
  const safeAspect = positiveDimension(aspect, 1);
  const verticalFov = basePose.fov * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * safeAspect);
  const angularRadius = Math.atan(occupancy * Math.tan(horizontalFov / 2));
  const distance = radius / Math.sin(angularRadius);
  const direction = basePose.position.map((value, index) => value - earthPosition[index]);
  const directionLength = Math.hypot(...direction) || 1;
  const position = earthPosition.map((value, index) => (
    value + direction[index] / directionLength * distance
  ));
  const target = [...earthPosition];
  if (safeAspect < 1) {
    target[0] += distance * Math.tan(horizontalFov / 2) * 0.18;
  }
  return freezePose({ position, target, fov: basePose.fov });
};

export const applyCameraPose = ({
  camera,
  cameraTarget,
  cameraPose,
  snap = false,
  easing = 0.055
}) => {
  const amount = snap ? 1 : easing;
  camera.position.set(
    camera.position.x + (cameraPose.position[0] - camera.position.x) * amount,
    camera.position.y + (cameraPose.position[1] - camera.position.y) * amount,
    camera.position.z + (cameraPose.position[2] - camera.position.z) * amount
  );
  cameraTarget.set(
    cameraTarget.x + (cameraPose.target[0] - cameraTarget.x) * amount,
    cameraTarget.y + (cameraPose.target[1] - cameraTarget.y) * amount,
    cameraTarget.z + (cameraPose.target[2] - cameraTarget.z) * amount
  );
  camera.fov += (cameraPose.fov - camera.fov) * amount;
  camera.updateProjectionMatrix();
  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld(true);
};

export const createScene = ({
  THREE,
  canvas,
  quality = {},
  layers = Object.freeze([]),
  interactive: adoptedInteractive = Object.freeze([]),
  renderer: adoptedRenderer = null,
  scene: adoptedScene = null,
  camera: adoptedCamera = null,
  cameraTarget: adoptedCameraTarget = null,
  raycaster: adoptedRaycaster = null,
  pointer: adoptedPointer = null,
  rendererFactory = (options) => createDefaultRenderer(THREE, options.canvas)
}) => {
  const renderer = adoptedRenderer
    ?? rendererFactory({ canvas, antialias: true, alpha: true });
  const scene = adoptedScene ?? new THREE.Scene();
  const camera = adoptedCamera ?? new THREE.PerspectiveCamera(52, 1, 0.1, 1200);
  const cameraTarget = adoptedCameraTarget ?? new THREE.Vector3();
  const raycaster = adoptedRaycaster ?? new THREE.Raycaster();
  const pointer = adoptedPointer ?? new THREE.Vector2();
  if (!adoptedScene) {
    scene.fog = new THREE.FogExp2(0x030711, 0.0026);
    const ambient = new THREE.AmbientLight(0x9fb8ff, 0.9);
    const keyLight = new THREE.DirectionalLight(0xfff2d4, 3.2);
    keyLight.position.set(-8, 5, 18);
    scene.add(ambient, keyLight);
  }

  const layerRecords = Object.freeze(layers.map(({ stage, layer }) => Object.freeze({ stage, layer })));
  const interactive = Object.freeze([...new Set([
    ...adoptedInteractive,
    ...layerRecords.flatMap(({ layer }) => layer.interactive)
  ])]);
  layerRecords.forEach(({ layer }) => {
    if (!layer.root.parent) scene.add(layer.root);
  });
  let disposed = false;
  let size = Object.freeze({ width: 1, height: 1, pixelRatio: quality.pixelRatio ?? 1 });

  const resize = ({ width, height, pixelRatio = quality.pixelRatio ?? 1 }) => {
    if (disposed) return;
    const nextWidth = positiveDimension(width, size.width);
    const nextHeight = positiveDimension(height, size.height);
    const nextPixelRatio = Math.min(quality.pixelRatio ?? pixelRatio, positiveDimension(pixelRatio, 1));
    size = Object.freeze({ width: nextWidth, height: nextHeight, pixelRatio: nextPixelRatio });
    renderer.setPixelRatio(nextPixelRatio);
    renderer.setSize(nextWidth, nextHeight, false);
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
  };

  const update = ({ stageState, cameraPose, viewport }) => {
    if (disposed) return;
    const viewportPixelRatio = viewport?.pixelRatio ?? size.pixelRatio;
    const nextPixelRatio = Math.min(
      quality.pixelRatio ?? viewportPixelRatio,
      positiveDimension(viewportPixelRatio, 1)
    );
    if (viewport && (
      viewport.width !== size.width
      || viewport.height !== size.height
      || nextPixelRatio !== size.pixelRatio
    )) {
      resize({ ...viewport, pixelRatio: viewport.pixelRatio ?? size.pixelRatio });
    }
    applyCameraPose({ camera, cameraTarget, cameraPose, snap: true });
    layerRecords.forEach(({ stage, layer }) => {
      layer.setPresence(stageState.layerPresence[stage] ?? 0);
    });
    scene.updateMatrixWorld(true);
  };

  const hitTest = ({ clientX, clientY }) => {
    if (disposed) return null;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const isWorldVisible = (object) => {
      for (let current = object; current; current = current.parent) {
        if (!current.visible) return false;
      }
      return true;
    };
    const hit = raycaster.intersectObjects(interactive, false)
      .find(({ object }) => isWorldVisible(object));
    if (!hit) return null;
    return hit.object.userData.annotation ?? hit.object.userData;
  };

  const render = () => {
    if (!disposed) renderer.render(scene, camera);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    layerRecords.forEach(({ layer }) => {
      layer.root.parent?.remove(layer.root);
      layer.dispose();
    });
    scene.clear();
    renderer.dispose();
  };

  resize({
    width: canvas.clientWidth || 1,
    height: canvas.clientHeight || 1,
    pixelRatio: quality.pixelRatio ?? 1
  });

  return Object.freeze({ canvas, update, hitTest, resize, render, dispose });
};
