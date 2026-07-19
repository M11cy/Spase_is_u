const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const createStageIndex = (stages) => Object.freeze(
  Object.fromEntries(stages.map(({ id }, index) => [id, index]))
);

export const getHighestUnlockedStage = ({ stages, journeyState }) => {
  const index = createStageIndex(stages);
  if (!journeyState.rocketCaught) return index.earth;
  if (!journeyState.solarComplete) return index["solar-system"];
  if (!journeyState.webComplete) return index["cosmic-web"];
  return stages.length - 1;
};

export const clampStageTarget = ({ requestedStage, highestUnlockedStage }) => (
  clamp(Math.round(requestedStage), 0, highestUnlockedStage)
);

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
