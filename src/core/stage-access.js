const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const JOURNEY_STAGE_IDS = Object.freeze([
  "place",
  "earth",
  "solar-system",
  "milky-way",
  "local-group",
  "cosmic-web",
  "unknown"
]);

const validateJourneyStages = (stages) => {
  if (!Array.isArray(stages)) {
    throw new TypeError("stages must be an array of journey stages");
  }

  if (stages.length !== JOURNEY_STAGE_IDS.length) {
    throw new RangeError("stages must contain exactly seven journey stages");
  }

  const ids = stages.map((stage, index) => {
    if (!stage || typeof stage.id !== "string") {
      throw new TypeError(`stage at index ${index} must have a string id`);
    }
    return stage.id;
  });

  if (new Set(ids).size !== ids.length) {
    throw new RangeError("stages must contain unique journey stage ids");
  }

  const hasExpectedOrder = ids.every((id, index) => id === JOURNEY_STAGE_IDS[index]);
  if (!hasExpectedOrder) {
    throw new RangeError("stages must match the fixed journey stage order");
  }
};

export const createStageIndex = (stages) => {
  validateJourneyStages(stages);
  return Object.freeze(Object.fromEntries(stages.map(({ id }, index) => [id, index])));
};

export const getHighestUnlockedStage = ({ stages, journeyState }) => {
  const index = createStageIndex(stages);
  if (!journeyState.rocketCaught) return index.earth;
  if (!journeyState.solarComplete) return index["solar-system"];
  if (!journeyState.webComplete) return index["cosmic-web"];
  return stages.length - 1;
};

export const clampStageTarget = ({ requestedStage, highestUnlockedStage }) => {
  const safeHighestUnlockedStage = Number.isFinite(highestUnlockedStage)
    ? Math.max(0, Math.floor(highestUnlockedStage))
    : 0;
  const safeRequestedStage = Number.isFinite(requestedStage)
    ? Math.round(requestedStage)
    : 0;

  return clamp(safeRequestedStage, 0, safeHighestUnlockedStage);
};

export const scrollYForStage = ({ stage, stageCount, maxScroll }) => (
  stageCount <= 1 ? 0 : maxScroll * (stage / (stageCount - 1))
);

export const blockReasonForStage = ({ stages, journeyState }) => {
  const highest = getHighestUnlockedStage({ stages, journeyState });
  const id = stages[highest]?.id;
  if (id === "earth") return "Сначала поймай ракету у Земли.";
  if (id === "solar-system") return "Сначала собери все детали и восстанови двигатель.";
  if (id === "cosmic-web") return "Сначала соедини космическую нить на всех трёх уровнях.";
  return "";
};
