const NAVIGATION_LABELS = Object.freeze({
  place: "Дом",
  earth: "Земля",
  "solar-system": "Система",
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
      <button id="rocketCatcher" class="rocket-catcher" type="button" aria-label="Поймать ракету в зоне"></button>
      <div id="rocketShip" class="rocket-ship" aria-hidden="true">
        <span class="rocket-body"></span>
      </div>
      <div id="webFlow" class="web-flow" aria-label="Собери космическую нить"></div>
      <button id="webRunner" class="web-runner" type="button">Начать заново</button>
      <button id="starMaker" class="star-maker" type="button">Зажечь звезду</button>
      <div id="personalStars" class="personal-stars" aria-hidden="true"></div>
      <div id="couponModal" class="coupon" hidden>
        <div class="coupon__dialog" role="dialog" aria-modal="true" aria-label="Купон на скидку">
          <p class="coupon__eyebrow">Поздравляем!</p>
          <h2 class="coupon__title">Ты зажёг свою звезду — и получил купон</h2>
          <p class="coupon__text">Крути рулетку, чтобы узнать свою скидку. Один раз!</p>
          <div class="coupon__wheel-wrap">
            <span class="coupon__pointer" aria-hidden="true"></span>
            <button id="couponWheel" class="coupon__wheel" type="button" aria-label="Рулетка"></button>
          </div>
          <button id="couponSpin" class="coupon__spin" type="button">Крутить рулетку</button>
          <p id="couponResult" class="coupon__result" aria-live="polite"></p>
          <button id="couponClose" class="coupon__close" type="button">Закрыть</button>
        </div>
      </div>
      <button id="enginePuzzleOpen" class="engine-puzzle-open" type="button">Собрать двигатель</button>
      <div id="enginePuzzle" class="engine-puzzle" hidden>
        <div class="engine-puzzle__dialog" role="dialog" aria-modal="true" aria-label="Сборка двигателя">
          <p class="engine-puzzle__title">Собери двигатель</p>
          <p class="engine-puzzle__hint">Нажми одну плитку, потом другую — они поменяются местами. Собери картинку.</p>
          <div id="enginePuzzleBoard" class="engine-puzzle__board" aria-label="Пазл двигателя"></div>
          <p id="enginePuzzleStatus" class="engine-puzzle__status" aria-live="polite"></p>
          <button id="enginePuzzleClose" class="engine-puzzle__close" type="button">Свернуть</button>
        </div>
      </div>
      <div class="panel-scrim" aria-hidden="true"></div>
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
          <div id="panelQuiz" class="panel-quiz" hidden></div>
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
        ${stages.map(() => "<section></section>").join("")}
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
  const rocketShip = root.querySelector("#rocketShip");
  const webFlow = root.querySelector("#webFlow");
  const webRunner = root.querySelector("#webRunner");
  const starMaker = root.querySelector("#starMaker");
  const personalStars = root.querySelector("#personalStars");
  const couponModal = root.querySelector("#couponModal");
  const couponWheel = root.querySelector("#couponWheel");
  const couponSpin = root.querySelector("#couponSpin");
  const couponResult = root.querySelector("#couponResult");
  const couponClose = root.querySelector("#couponClose");
  const enginePuzzleOpen = root.querySelector("#enginePuzzleOpen");
  const enginePuzzle = root.querySelector("#enginePuzzle");
  const enginePuzzleBoard = root.querySelector("#enginePuzzleBoard");
  const enginePuzzleStatus = root.querySelector("#enginePuzzleStatus");
  const enginePuzzleClose = root.querySelector("#enginePuzzleClose");

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

  const setStageAccess = ({ highestUnlockedStage, reason = "" }) => {
    const safeHighestUnlockedStage = Number.isFinite(highestUnlockedStage)
      ? Math.min(stageButtons.length - 1, Math.max(0, Math.floor(highestUnlockedStage)))
      : 0;
    stageButtons.forEach((button, index) => {
      const locked = index > safeHighestUnlockedStage;
      button.disabled = locked;
      button.setAttribute("aria-disabled", String(locked));
      if (locked) {
        const accessibleReason = String(reason).trim();
        const label = button.textContent;
        button.setAttribute("aria-label", accessibleReason ? `${label}. ${accessibleReason}` : label);
        button.title = accessibleReason;
      } else {
        button.removeAttribute("aria-label");
        button.removeAttribute("title");
      }
    });
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
    quiz: root.querySelector("#panelQuiz"),
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
    rocketShip,
    webFlow,
    webRunner,
    starMaker,
    personalStars,
    couponModal,
    couponWheel,
    couponSpin,
    couponResult,
    couponClose,
    enginePuzzleOpen,
    enginePuzzle,
    enginePuzzleBoard,
    enginePuzzleStatus,
    enginePuzzleClose,
    setActiveStage,
    setStageAccess,
    dispose: () => distanceSummary.removeEventListener("click", toggleDistanceScale)
  });
}
