const NAVIGATION_LABELS = Object.freeze({
  place: "Дом",
  earth: "Земля",
  "solar-system": "Система",
  heliosphere: "Гелиосфера",
  "milky-way": "Галактика",
  "local-group": "Группа",
  "cosmic-web": "Вселенная",
  unknown: "?"
});

const formatDistanceSummary = (stage) => `${stage.label} · ${stage.distance}`;
const cinematicShipPath = `${import.meta.env.BASE_URL}space/cinematic-ship.png`;

export const setLabelAccessibility = (label, isVisible) => {
  if (isVisible) {
    label.removeAttribute("tabindex");
    label.removeAttribute("aria-hidden");
    return;
  }

  label.tabIndex = -1;
  label.setAttribute("aria-hidden", "true");
};

export function createShell({ root, stages }) {
  document.body.classList.add("intro-pending");
  root.innerHTML = `
    <main class="experience">
    <section id="introLayer" class="cinematic-intro" aria-label="Начало путешествия">
      <div class="cinematic-intro__copy">
        <p class="cinematic-intro__eyebrow">Путеводитель по масштабу</p>
        <h1>Космос — это мы</h1>
        <p class="cinematic-intro__lede">От знакомого места до границы наблюдаемой Вселенной.</p>
        <button id="startJourneyButton" class="start-journey-button" type="button" disabled aria-disabled="true">Начать путешествие</button>
      </div>
      <img id="cinematicShip" class="cinematic-ship" src="${cinematicShipPath}" alt="Исследовательский корабль в космосе">
    </section>
      <section class="map-layer" aria-label="Карта текущего местоположения">
        <div id="mapRoot" class="satellite-map" role="region" aria-label="Спутниковая карта выбранного места" data-map-state="loading">
          <p id="mapStatus" class="map-status" data-map-status role="status" aria-live="polite">Загрузка спутниковой карты…</p>
        </div>
        <span id="mapReticle" class="map-reticle" aria-hidden="true"></span>
        <div class="map-vignette"></div>
      </section>
      <canvas id="cosmosCanvas" aria-label="Интерактивное путешествие по космическим масштабам"></canvas>
      <div id="spaceLabels" class="space-labels"></div>
      <div class="reference-caption">Космос - это мы</div>
      <header class="topbar">
        <div class="stage-heading">
          <span class="signal"></span>
          <span id="scaleLabel"></span>
        </div>
        <button id="locateButton" type="button">Моё место</button>
      </header>
      <aside id="narrationPanel" class="narration-panel" aria-live="polite">
        <div class="narration-head">
          <span id="narrationStage">Дом</span>
          <div class="narration-actions">
            <button id="subtitleToggle" class="subtitle-toggle" type="button" aria-label="Скрыть субтитры">×</button>
            <button id="voiceToggle" class="voice-toggle" type="button" aria-label="Включить озвучку" aria-pressed="false">▶</button>
          </div>
        </div>
        <p id="narrationText"></p>
        <div class="narration-progress" aria-hidden="true"><span id="narrationProgress"></span></div>
      </aside>
      <button id="subtitleRestore" class="subtitle-restore" type="button" aria-label="Показать субтитры" hidden>CC</button>
      <div id="missionStatus" class="mission-status" aria-live="polite" hidden></div>
      <button id="rocketCatcher" class="rocket-catcher" type="button" aria-label="Поймать ракету">
        <span class="rocket-body"></span>
      </button>
      <button id="webRunner" class="web-runner" type="button">Проложить путь</button>
      <button id="starMaker" class="star-maker" type="button">Зажечь звезду</button>
      <div id="personalStars" class="personal-stars" aria-hidden="true"></div>
      <aside
        id="objectPanel"
        class="object-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="panelTitle"
        aria-live="polite"
        hidden
      >
        <button id="closePanel" type="button" aria-label="Закрыть информацию">×</button>
        <img id="panelImage" alt="" hidden>
        <div class="panel-content">
          <p id="panelScale"></p>
          <h2 id="panelTitle"></h2>
          <p id="panelText"></p>
          <dl>
            <div><dt>Открытие</dt><dd id="panelDiscovery"></dd></div>
            <div><dt>Масштаб</dt><dd id="panelDistance"></dd></div>
          </dl>
        </div>
      </aside>
      <nav class="scale-rail" aria-label="Масштабы"></nav>
      <button
        class="distance-summary"
        type="button"
        aria-expanded="true"
        aria-controls="distanceScale"
      ></button>
      <aside id="distanceScale" class="distance-scale" aria-label="Шкала расстояния от Земли" data-expanded="true">
        <p>От Земли</p>
        <strong id="distanceValue"></strong>
        <ol id="distanceMarkers"></ol>
      </aside>
      <section id="unknownLayer" class="unknown-layer" aria-label="Неизвестный масштаб">
        <div>
          <strong>?</strong>
          <h2>Дальше ничего не понятно</h2>
          <p>Мы можем только предполагать, что находится за наблюдаемой Вселенной и где заканчивается масштаб, который способен понять человек.</p>
          <p>Может, вы будете тем, кто узнает это.</p>
        </div>
      </section>
      <div class="scroll-space" aria-hidden="true">
        <section></section><section></section><section></section><section></section>
        <section></section><section></section><section></section><section></section>
      </div>
    </main>
  `;

  const experience = root.querySelector(".experience");
  const mapLayer = root.querySelector(".map-layer");
  const mapRoot = root.querySelector("#mapRoot");
  const mapStatus = root.querySelector("#mapStatus");
  const mapReticle = root.querySelector("#mapReticle");
  const canvas = root.querySelector("#cosmosCanvas");
  const labels = root.querySelector("#spaceLabels");
  const scaleLabel = root.querySelector("#scaleLabel");
  const locateButton = root.querySelector("#locateButton");
  const panel = root.querySelector("#objectPanel");
  const closeButton = root.querySelector("#closePanel");
  const panelImage = root.querySelector("#panelImage");
  const navigation = root.querySelector(".scale-rail");
  const distanceSummary = root.querySelector(".distance-summary");
  const distanceScale = root.querySelector("#distanceScale");
  const distanceValue = root.querySelector("#distanceValue");
  const distanceMarkers = root.querySelector("#distanceMarkers");
  const unknownLayer = root.querySelector("#unknownLayer");
  const introLayer = root.querySelector("#introLayer");
  const startJourneyButton = root.querySelector("#startJourneyButton");
  const cinematicShip = root.querySelector("#cinematicShip");
  const narrationPanel = root.querySelector("#narrationPanel");
  const narrationStage = root.querySelector("#narrationStage");
  const narrationText = root.querySelector("#narrationText");
  const narrationProgress = root.querySelector("#narrationProgress");
  const voiceToggle = root.querySelector("#voiceToggle");
  const subtitleToggle = root.querySelector("#subtitleToggle");
  const subtitleRestore = root.querySelector("#subtitleRestore");
  const missionStatus = root.querySelector("#missionStatus");
  const rocketCatcher = root.querySelector("#rocketCatcher");
  const webRunner = root.querySelector("#webRunner");
  const starMaker = root.querySelector("#starMaker");
  const personalStars = root.querySelector("#personalStars");

  const stageButtons = stages.map((stage, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.stage = String(index);
    button.textContent = NAVIGATION_LABELS[stage.id] ?? stage.label;
    navigation.append(button);
    return button;
  });

  stages.forEach((stage, index) => {
    const marker = document.createElement("li");
    marker.dataset.stage = String(index);
    const dot = document.createElement("span");
    const distance = document.createElement("em");
    distance.textContent = stage.distance;
    marker.append(dot, distance);
    distanceMarkers.append(marker);
  });

  const distanceMarkerItems = [...distanceMarkers.children];

  const setActiveStage = (index) => {
    stageButtons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === index;
      button.classList.toggle("active", isActive);
      if (isActive) {
        button.setAttribute("aria-current", "step");
      } else {
        button.removeAttribute("aria-current");
      }
    });
    scaleLabel.textContent = stages[index].label;
    distanceValue.textContent = stages[index].distance;
    distanceSummary.textContent = formatDistanceSummary(stages[index]);
  };

  const toggleDistanceScale = () => {
    const isExpanded = distanceSummary.getAttribute("aria-expanded") === "true";
    const nextExpanded = !isExpanded;
    distanceSummary.setAttribute("aria-expanded", String(nextExpanded));
    distanceScale.hidden = !nextExpanded;
    if (nextExpanded) {
      distanceScale.dataset.expanded = "true";
    } else {
      delete distanceScale.dataset.expanded;
    }
  };

  distanceSummary.addEventListener("click", toggleDistanceScale);
  setActiveStage(0);

  const panelFields = Object.freeze({
    scale: root.querySelector("#panelScale"),
    title: root.querySelector("#panelTitle"),
    text: root.querySelector("#panelText"),
    discovery: root.querySelector("#panelDiscovery"),
    distance: root.querySelector("#panelDistance"),
    image: panelImage
  });
  const panelBindings = Object.freeze({ panel, closeButton, fields: panelFields });

  return Object.freeze({
    root,
    experience,
    mapLayer,
    mapRoot,
    mapStatus,
    mapReticle,
    canvas,
    labels,
    scaleLabel,
    locateButton,
    panel,
    closeButton,
    panelImage,
    panelFields,
    panelBindings,
    navigation,
    stageButtons: Object.freeze([...stageButtons]),
    distanceSummary,
    distanceScale,
    distanceValue,
    distanceMarkers,
    distanceMarkerItems: Object.freeze([...distanceMarkerItems]),
    unknownLayer,
    introLayer,
    startJourneyButton,
    cinematicShip,
    narrationPanel,
    narrationStage,
    narrationText,
    narrationProgress,
    voiceToggle,
    subtitleToggle,
    subtitleRestore,
    missionStatus,
    rocketCatcher,
    webRunner,
    starMaker,
    personalStars,
    setActiveStage,
    dispose: () => distanceSummary.removeEventListener("click", toggleDistanceScale)
  });
}
