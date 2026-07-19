import {
  createEarthJourneyCameraPose,
  createEarthJourneyState
} from "./earth-journey.js";

const FALLBACK_LOCATION = Object.freeze({ lat: 55.7558, lon: 37.6173 });

const copyLocation = (location) => {
  const lat = Number(location?.lat);
  const lon = Number(location?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new TypeError("Earth experience location must contain valid latitude and longitude");
  }
  return Object.freeze({ lat, lon });
};

const copyVector = (values, label) => {
  const vector = Array.from(values ?? [], Number);
  if (vector.length !== 3 || vector.some((value) => !Number.isFinite(value))) {
    throw new TypeError(`${label} must contain three finite values`);
  }
  return Object.freeze(vector);
};

const requireStageCount = (stageCount) => {
  if (!Number.isInteger(stageCount) || stageCount <= 0) {
    throw new TypeError("Earth experience stageCount must be a positive integer");
  }
  return stageCount;
};

const requireStageIndex = (stage, stageCount, label) => {
  if (!Number.isInteger(stage) || stage < 0 || stage >= stageCount) {
    throw new TypeError(`${label} must be a valid route index`);
  }
  return stage;
};

const normalize = (vector) => {
  const length = Math.hypot(...vector);
  if (length === 0) return Object.freeze([0, 0, 1]);
  return Object.freeze(vector.map((value) => value / length));
};

const dot = (left, right) => left.reduce((sum, value, index) => (
  sum + value * right[index]
), 0);

const focusDirectionForPose = ({ pose, earthPosition, radius }) => {
  const viewRay = normalize(pose.target.map((value, index) => value - pose.position[index]));
  const cameraOffset = pose.position.map((value, index) => value - earthPosition[index]);
  const halfB = dot(cameraOffset, viewRay);
  const discriminant = halfB ** 2 - (dot(cameraOffset, cameraOffset) - radius ** 2);

  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant);
    const nearDistance = -halfB - root;
    const farDistance = -halfB + root;
    const distance = nearDistance >= 0 ? nearDistance : farDistance;
    if (distance >= 0) {
      const focusedPoint = pose.position.map((value, index) => value + viewRay[index] * distance);
      return normalize(focusedPoint.map((value, index) => value - earthPosition[index]));
    }
  }

  return normalize(cameraOffset);
};

const createUnavailableJourney = (journey) => Object.freeze({
  ...journey,
  cameraProgress: 1,
  mapOpacity: 0,
  globePresence: 1
});

const withEarthPresence = (stageState, presence, earthStage) => {
  const layerPresence = [...stageState.layerPresence];
  layerPresence[earthStage] = presence;
  return Object.freeze({
    ...stageState,
    layerPresence: Object.freeze(layerPresence)
  });
};

export const createEarthExperienceController = ({
  map,
  earthLayer,
  orbitPose,
  earthPosition,
  radius,
  earthStage,
  stageCount,
  initialLocation = FALLBACK_LOCATION
}) => {
  if (!map?.setLocation || !map?.setJourneyProgress || !map?.dispose) {
    throw new TypeError("An Earth experience map controller is required");
  }
  if (!earthLayer?.setFocus) {
    throw new TypeError("An Earth layer with setFocus is required");
  }
  const fixedStageCount = requireStageCount(stageCount);
  const fixedEarthStage = requireStageIndex(earthStage, fixedStageCount, "Earth stage");

  const fixedEarthPosition = copyVector(earthPosition, "Earth position");
  const fixedOrbitPose = Object.freeze({
    position: copyVector(orbitPose?.position, "Orbit position"),
    target: copyVector(orbitPose?.target, "Orbit target"),
    fov: Number(orbitPose?.fov)
  });
  const cameraDirection = Object.freeze(fixedOrbitPose.position.map((value, index) => (
    value - fixedEarthPosition[index]
  )));
  const cameraUp = Object.freeze([0, 1, 0]);
  const fixedRadius = Number(radius);
  if (!Number.isFinite(fixedRadius) || fixedRadius <= 0) {
    throw new TypeError("Earth radius must be a positive finite number");
  }
  let disposed = false;
  let currentLocation = null;

  const setLocation = (location) => {
    if (disposed) return undefined;
    const nextLocation = copyLocation(location);
    currentLocation = nextLocation;
    map.setLocation(nextLocation);
    earthLayer.setFocus(nextLocation, cameraDirection, cameraUp);
    return nextLocation;
  };

  const update = ({
    stageState,
    exactStage = stageState?.exactStage,
    reducedMotion = false,
    orbitPose: responsiveOrbitPose = fixedOrbitPose,
    mapUnavailable = false
  }) => {
    if (disposed) return null;
    if (!stageState?.layerPresence) throw new TypeError("A stage state is required");

    if (exactStage > fixedEarthStage) {
      return Object.freeze({
        journey: null,
        cameraPose: null,
        stageState,
        transitionEffectsAllowed: true
      });
    }

    const baseJourney = createEarthJourneyState({ exactStage, reducedMotion });
    const journey = mapUnavailable ? createUnavailableJourney(baseJourney) : baseJourney;
    const cameraPose = createEarthJourneyCameraPose({
      orbitPose: responsiveOrbitPose,
      earthPosition: fixedEarthPosition,
      radius: fixedRadius,
      progress: journey.cameraProgress
    });
    earthLayer.setFocus(
      currentLocation,
      focusDirectionForPose({ pose: cameraPose, earthPosition: fixedEarthPosition, radius: fixedRadius }),
      cameraUp
    );
    const nextStageState = exactStage < fixedEarthStage
      ? withEarthPresence(stageState, journey.globePresence, fixedEarthStage)
      : stageState;

    map.setJourneyProgress(journey);
    return Object.freeze({
      journey,
      cameraPose,
      stageState: nextStageState,
      transitionEffectsAllowed: false
    });
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    map.dispose();
  };

  setLocation(initialLocation);

  return Object.freeze({ setLocation, update, dispose });
};
