import * as L from "leaflet";
import * as THREE from "three";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import { createEarthExperienceController } from "./core/earth-experience.js";
import { createIntroState } from "./core/intro-state.js";
import { layoutLabels } from "./core/label-layout.js";
import { createNearSpaceComposition, createQualityProfile } from "./core/quality-profile.js";
import { createRocketCatchGame } from "./core/earth-rocket-game.js";
import { createEngineImageDataUri, createEnginePuzzle } from "./core/engine-puzzle.js";
import { createWebFlowGame } from "./core/web-flow-game.js";
import { createCouponWheel } from "./core/coupon-wheel.js";
import { computeStageState, interpolateCamera } from "./core/stage-state.js";
import { ANNOTATIONS, OBJECTS, SOLAR_PLANETS, STAGES, STAGE_INDEX } from "./data/cosmos.js";
import {
  WORLD_IMAGERY_ATTRIBUTION,
  WORLD_IMAGERY_URL,
  createSatelliteMap
} from "./map/satellite-map.js";
import {
  createEarthCameraPose,
  createScene,
  freezePositionedAnnotation,
  resolveCameraPose
} from "./scene/create-scene.js";
import { createEarthLayer } from "./scene/layers/earth.js";
import { selectEarthTextureRoutes } from "./scene/earth-assets.js";
import { createSolarSystemLayer } from "./scene/layers/solar-system.js";
import { createTextureStore } from "./scene/textures.js";
import { createAnnotationPanel } from "./ui/annotation-panel.js";
import { createShell, setLabelAccessibility } from "./ui/create-shell.js";
import { createIntroController } from "./ui/intro-controller.js";
import {
  applyLabelPlacements,
  createLabelLayoutCoordinator
} from "./ui/label-layout-coordinator.js";
import { DEFAULT_LOCATION, createLocationController } from "./ui/location.js";

const app = document.querySelector("#app");
const stages = STAGES;
const shell = createShell({ root: app, stages });
const {
  canvas,
  cinematicShip,
  couponModal,
  couponWheel,
  couponSpin,
  couponResult,
  couponClose,
  distanceMarkerItems,
  enginePuzzle,
  enginePuzzleBoard,
  enginePuzzleClose,
  enginePuzzleOpen,
  enginePuzzleStatus,
  introLayer,
  labels: spaceLabels,
  locateButton,
  mapLayer,
  mapRoot,
  missionStatus,
  narrationPanel,
  narrationProgress,
  narrationStage,
  narrationText,
  panel,
  personalStars,
  rocketCatcher,
  rocketShip,
  webFlow,
  setActiveStage,
  stageButtons: railButtons,
  starMaker,
  startJourneyButton,
  subtitleRestore,
  subtitleToggle,
  unknownLayer,
  voiceToggle,
  webRunner
} = shell;
const annotationPanel = createAnnotationPanel({
  ...shell.panelBindings,
  onSolveQuiz: (data) => collectSolarArtifact(data)
});
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const rocketGame = createRocketCatchGame({ shipElement: rocketShip, zoneElement: rocketCatcher, reducedMotion });
const enginePuzzleGame = createEnginePuzzle({
  boardElement: enginePuzzleBoard,
  statusElement: enginePuzzleStatus,
  image: createEngineImageDataUri(),
  onSolved: () => completeEngine()
});
let enginePuzzleStarted = false;
const webFlowGame = createWebFlowGame({
  container: webFlow,
  onStart: () => startWebQuest(),
  onLevel: (index, total) => showMission(`Уровень ${index} из ${total} собран! Дальше — сложнее.`),
  onComplete: () => completeWebPath()
});
createCouponWheel({ wheelElement: couponWheel, spinButton: couponSpin, resultElement: couponResult });
const listenerController = new AbortController();
const listenerSignal = listenerController.signal;
const publicAsset = (path) => `${import.meta.env.BASE_URL}${String(path).replace(/^\/+/, "")}`;
const withBaseAsset = (record) => Object.freeze({
  ...record,
  image: record.image ? publicAsset(record.image) : record.image
});
const solarPlanets = Object.freeze(SOLAR_PLANETS.map(withBaseAsset));

const narrationCues = {
  homeStart: {
    label: "Дом",
    src: publicAsset("voice/home-start.mp3"),
    text: "Ну что, начнём? Не с далёких звёзд, а прямо отсюда, с того места, где ты сейчас. Вот твой двор, твоя улица, твой город. Держись рядом, полетели."
  },
  homeZoomOut: {
    label: "Отдаление",
    src: publicAsset("voice/home-zoom-out.mp3"),
    text: "Смотри, как всё уменьшается. Дом становится точкой, город — пятнышком. А вокруг проступает то, что из окна и не разглядишь. Целая планета."
  },
  earthArrival: {
    label: "Земля",
    src: publicAsset("voice/earth-arrival.mp3"),
    text: "Вот она, Земля. Один дом на всех нас. Только пешком отсюда не уйдёшь. Нужен корабль."
  },
  earthRocketPrompt: {
    label: "Ракета",
    src: publicAsset("voice/earth-rocket-prompt.mp3"),
    text: "Видишь, как кружит старая ракета? Она облетает планету за один вздох и лишь на миг проходит совсем рядом. Другого попутчика не будет. Поймай этот миг и запрыгивай на борт. Не спеши и не зевай. Лови ровно тогда, когда она поравняется с нами."
  },
  earthRocketCaught: {
    label: "На борту",
    src: publicAsset("voice/earth-rocket-caught.mp3"),
    text: "Получилось, запрыгнул. Молодец, реакция что надо. Устраивайся поудобнее, теперь этот корабль наш."
  },
  earthDeparture: {
    label: "Покидаем Землю",
    src: publicAsset("voice/earth-departure.mp3"),
    text: "Поехали. Земля отдаляется всё больше. Вот она уже с яблоко, потом с горошину, а там и вовсе теряется среди звёзд. Подумать только, весь твой мир уместился в одну крошечную точку, а вокруг неё семья соседей."
  },
  solarArrival: {
    label: "Солнечная система",
    src: publicAsset("voice/solar-arrival.mp3"),
    text: "А вот и наша семья — Солнечная система. В середине — Солнце, вокруг по своим дорожкам-орбитам идут планеты."
  },
  solarBroken: {
    label: "Поломка",
    src: publicAsset("voice/solar-broken-rocket.mp3"),
    text: "Ой! Слышишь? Застучало и встали. Кажется, наша ракета была не готова к долгой дороге. Растрясло на взлёте. Но не горюй, дело поправимое."
  },
  solarQuest: {
    label: "Артефакты",
    src: publicAsset("voice/solar-artifact-quest.mp3"),
    text: "На каждой планете можно найти часть нашего двигателя. Соберём их все и снова запустим ракету. Чтобы найти деталь, изучи планету и ответь на вопросы о ней. Так мы поймём, где искать. Планет тут хватает. Выбирай любую и вперёд!"
  },
  solarComplete: {
    label: "Двигатель готов",
    src: publicAsset("voice/solar-artifacts-complete.mp3"),
    text: "Ну вот, все детали на месте. Слышишь, двигатель снова работает. Мы нашли всё, что нужно, и теперь можем продолжить наше путешествие. Держись!"
  },
  solarDeparture: {
    label: "Разгон",
    src: publicAsset("voice/solar-departure.mp3"),
    text: "Мы уходим за орбиту самой дальней планеты. Кажется, вот он, край нашего дома. Хотя нет, похоже, наш дом гораздо больше."
  },
  milkyWay: {
    label: "Млечный Путь",
    src: publicAsset("voice/milky-way.mp3"),
    text: "Вот это да, это Млечный Путь, наша галактика. Сотни миллиардов звёзд, а наше Солнце — лишь одна из них, где-то в рукаве Ориона. Наш маленький уголок огромного звёздного города, а в самом центре — сверхмассивная чёрная дыра — Стрелец А. А теперь давай посмотрим, что ещё здесь есть."
  },
  milkyWayDeparture: {
    label: "Соседи",
    src: publicAsset("voice/milky-way-departure.mp3"),
    text: "Летим дальше, и даже наша галактика постепенно превращается в маленькую точку. И тут выясняется, что и у нашей галактики есть соседи."
  },
  localGroup: {
    label: "Локальная группа",
    src: publicAsset("voice/local-group.mp3"),
    text: "Целые галактики теперь просто огоньки. В каждой миллиарды звёзд. Это локальная группа, наши соседи. Вон Андромеда, самая большая. Она тихо, но верно плывёт к нам. Только не пугайся, через миллиарды лет мы просто станем одной большой галактикой. Да, в космосе никто не спешит."
  },
  localGroupDeparture: {
    label: "Дальше",
    src: publicAsset("voice/local-group-departure.mp3"),
    text: "Отдалимся ещё. И ещё. Приготовься, сейчас ты увидишь то, что мало кому показывают."
  },
  universeArrival: {
    label: "Вселенная",
    src: publicAsset("voice/universe-arrival.mp3"),
    text: "Вот она, вся Вселенная, какую мы можем разглядеть. Видишь светящиеся узелки? Каждый из них не звезда, а целая галактика. Миллиарды галактик собрались в огромную космическую сеть, а между ними простираются гигантские пустоты."
  },
  universeQuest: {
    label: "Космическая нить",
    src: publicAsset("voice/universe-web-quest.mp3"),
    text: "Но галактики не разбросаны случайно. Между ними протянулись тончайшие нити, по которым, как по рекам, движется вещество. Держись этих нитей, проведи наш корабль от нашей галактики к дальнему узлу и не сорвись в пустоту между ними."
  },
  universeFall: {
    label: "Пустота",
    src: publicAsset("voice/universe-web-fall.mp3"),
    text: "Упс, сорвались в пустоту. Ничего страшного, возвращаемся на нить и пробуем ещё раз."
  },
  universeComplete: {
    label: "Связь",
    src: publicAsset("voice/universe-web-complete.mp3"),
    text: "Долетели. Вот так во Вселенной всё и связано тонкими нитями, от края до края. И знаешь, что удивительнее всего? Эта паутина точь-в-точь как нейроны в твоей голове. Космос устроен почти так же, как ты сам. Может, потому и говорят, что космос — это мы."
  },
  unknownTransition: {
    label: "Граница",
    src: publicAsset("voice/unknown-transition.mp3"),
    text: "А дальше, дальше начинается неизвестное. Здесь заканчивается всё, что человек сумел разглядеть и понять."
  },
  finalOne: {
    label: "Неизвестность",
    src: publicAsset("voice/final-1.mp3"),
    text: "За этой чертой темнота, в которую ещё никто не заглядывал. Что там, не знает никто. Может быть, однажды это узнаешь именно ты."
  },
  finalTwo: {
    label: "Это мы",
    src: publicAsset("voice/final-2.mp3"),
    text: "А пока давай сделаем вот что. Помнишь, с чего мы начали? С крошечной точки, с твоего дома. Так вот, всё, из чего ты сделан. Каждая косточка и каждая капелька. Когда-то родилось внутри звёзд. Получается, ты и есть космос, который научился смотреть на самого себя."
  },
  finalStar: {
    label: "Твой след",
    src: publicAsset("voice/final-star.mp3"),
    text: "Оставь здесь свой след, зажги свою звезду. Пусть светит на этой карте рядом с миллиардами других. Ты только что прошёл путь от дома до края Вселенной и оказался её частью. Впрочем, ты всегда ею был."
  }
};

const stageNarration = new Map([
  [STAGE_INDEX.place, "homeStart"],
  [STAGE_INDEX.earth, "earthArrival"],
  [STAGE_INDEX["solar-system"], "solarArrival"],
  [STAGE_INDEX["milky-way"], "milkyWay"],
  [STAGE_INDEX["local-group"], "localGroup"],
  [STAGE_INDEX["cosmic-web"], "universeArrival"],
  [STAGE_INDEX.unknown, "finalOne"]
]);

const narrationAudio = new Audio();
narrationAudio.preload = "metadata";
narrationAudio.volume = 0.95;

const journeyState = {
  userInteracted: false,
  voiceEnabled: false,
  currentCue: "homeStart",
  lastExactStage: STAGE_INDEX.place,
  rocketPrompted: false,
  rocketCaught: false,
  earthShipReady: false,
  solarBroken: false,
  solarQuestStarted: false,
  solarComplete: false,
  artifactIds: new Set(),
  artifactTotal: 0,
  webQuestStarted: false,
  webComplete: false,
  finalStep: 0,
  subtitlesHidden: false
};

function updateVoiceButton() {
  const isPlaying = journeyState.voiceEnabled && !narrationAudio.paused;
  voiceToggle.textContent = isPlaying ? "||" : "▶";
  voiceToggle.setAttribute("aria-pressed", String(journeyState.voiceEnabled));
  voiceToggle.setAttribute("aria-label", isPlaying ? "Поставить озвучку на паузу" : "Включить озвучку");
}

function syncJourneyClasses() {
  document.body.classList.toggle("rocket-caught", journeyState.rocketCaught);
  document.body.classList.toggle("earth-ship-ready", journeyState.earthShipReady);
  document.body.classList.toggle("web-started", journeyState.webQuestStarted);
  document.body.classList.toggle("web-complete", journeyState.webComplete);
  document.body.classList.toggle("final-star-lit", journeyState.finalStep >= 3);
  document.body.classList.toggle(
    "parts-collected",
    journeyState.artifactTotal > 0 && journeyState.artifactIds.size >= journeyState.artifactTotal
  );
  document.body.classList.toggle("engine-assembled", journeyState.solarComplete);
}

function showMission(message = "") {
  missionStatus.hidden = !message;
  missionStatus.textContent = message;
}

function syncSubtitleVisibility() {
  document.body.classList.toggle("subtitles-hidden", journeyState.subtitlesHidden);
  narrationPanel.setAttribute("aria-hidden", String(journeyState.subtitlesHidden));
  subtitleRestore.hidden = !journeyState.subtitlesHidden;
  subtitleToggle.setAttribute("aria-label", journeyState.subtitlesHidden ? "Показать субтитры" : "Скрыть субтитры");
}

function setNarration(cueId, { play = journeyState.voiceEnabled, force = false } = {}) {
  const cue = narrationCues[cueId];
  if (!cue) {
    return false;
  }

  if (journeyState.currentCue === cueId && !force) {
    return false;
  }

  journeyState.currentCue = cueId;
  narrationStage.textContent = cue.label;
  narrationText.textContent = cue.text;
  narrationPanel.dataset.cue = cueId;
  narrationProgress.style.width = "0%";
  narrationAudio.src = new URL(cue.src, window.location.href).href;
  narrationAudio.currentTime = 0;

  if (play) {
    playCurrentNarration();
  } else {
    updateVoiceButton();
  }

  return true;
}

async function playCurrentNarration({ restart = false } = {}) {
  const cue = narrationCues[journeyState.currentCue];
  if (!cue) {
    return;
  }

  const cueSrc = new URL(cue.src, window.location.href).href;
  if (narrationAudio.src !== cueSrc) {
    narrationAudio.src = cueSrc;
    narrationAudio.currentTime = 0;
  }

  if (restart || narrationAudio.ended) {
    narrationAudio.currentTime = 0;
  }

  try {
    await narrationAudio.play();
    journeyState.voiceEnabled = true;
  } catch {
    journeyState.voiceEnabled = false;
    showMission("Нажми кнопку воспроизведения, чтобы браузер разрешил звук.");
  } finally {
    updateVoiceButton();
  }
}

function markUserInteraction() {
  journeyState.userInteracted = true;
}

function updateMissionForStage() {
  if (activeStage === STAGE_INDEX.earth && !journeyState.rocketCaught) {
    if (!journeyState.earthShipReady) {
      showMission("");
      return;
    }
    showMission(journeyState.rocketPrompted ? "Жми на светящуюся зону у Земли, когда ракета проходит сквозь неё." : "Ракета носится восьмёркой вокруг Земли. Лови её в зоне у Земли.");
    return;
  }

  if (activeStage === STAGE_INDEX["solar-system"]) {
    const count = journeyState.artifactIds.size;
    const total = journeyState.artifactTotal || solarPlanets.length;
    if (journeyState.solarComplete) {
      showMission("");
      return;
    }
    if (count >= total) {
      showMission("Все детали собраны! Нажми «Собрать двигатель».");
      return;
    }
    showMission(`Детали двигателя: ${count}/${total}. Открывай планеты и решай квизы, чтобы собрать детали.`);
    return;
  }

  if (activeStage === STAGE_INDEX["cosmic-web"] && !journeyState.webComplete) {
    showMission(journeyState.webQuestStarted ? "Поворачивай кусочки, собирая нить от галактики к дальнему узлу." : "Поверни кусочки нитей и соедини нашу галактику с дальним узлом.");
    return;
  }

  if (activeStage === STAGE_INDEX.unknown) {
    if (journeyState.finalStep === 0) {
      showMission("Нажми «Зажечь звезду», чтобы продолжить рассказ.");
      return;
    }
    if (journeyState.finalStep === 1) {
      showMission("Нажми «Продолжить», чтобы услышать финал.");
      return;
    }
    if (journeyState.finalStep === 2) {
      showMission("Кликни в любом месте на экране, чтобы поставить свою звезду.");
      return;
    }
    showMission("");
    return;
  }

  showMission("");
}

function cueForStageState(stage, exactStage = stage) {
  if (stage === STAGE_INDEX.place) {
    return exactStage > 0.18 ? "homeZoomOut" : "homeStart";
  }

  if (stage === STAGE_INDEX.earth) {
    if (!journeyState.rocketPrompted) {
      return "earthArrival";
    }
    return journeyState.rocketCaught ? "earthRocketCaught" : "earthRocketPrompt";
  }

  if (stage === STAGE_INDEX["solar-system"]) {
    if (journeyState.solarComplete) {
      return "solarComplete";
    }
    if (journeyState.solarQuestStarted) {
      return "solarQuest";
    }
    if (journeyState.solarBroken) {
      return "solarBroken";
    }
    return "solarArrival";
  }

  if (stage === STAGE_INDEX["cosmic-web"]) {
    if (journeyState.webComplete) {
      return "universeComplete";
    }
    if (journeyState.webQuestStarted) {
      return "universeQuest";
    }
    return "universeArrival";
  }

  if (stage === STAGE_INDEX.unknown) {
    if (journeyState.finalStep >= 2) {
      return "finalStar";
    }
    if (journeyState.finalStep === 1) {
      return "finalTwo";
    }
    return "finalOne";
  }

  return stageNarration.get(stage) ?? "homeStart";
}

function cueForScrollPosition(exactStage) {
  if (exactStage < STAGE_INDEX.place + 0.2) {
    return "homeStart";
  }

  if (exactStage < STAGE_INDEX.place + 0.72) {
    return "homeZoomOut";
  }

  if (exactStage < STAGE_INDEX.earth + 0.24) {
    return cueForStageState(STAGE_INDEX.earth, exactStage);
  }

  if (exactStage < STAGE_INDEX.earth + 0.78) {
    return journeyState.rocketCaught ? "earthDeparture" : cueForStageState(STAGE_INDEX.earth, exactStage);
  }

  if (exactStage < STAGE_INDEX["solar-system"] + 0.34) {
    return cueForStageState(STAGE_INDEX["solar-system"], exactStage);
  }

  if (exactStage < STAGE_INDEX["solar-system"] + 0.5) {
    return journeyState.solarComplete ? "solarDeparture" : cueForStageState(STAGE_INDEX["solar-system"], exactStage);
  }

  if (exactStage < STAGE_INDEX["milky-way"] + 0.26) {
    return "milkyWay";
  }

  if (exactStage < STAGE_INDEX["milky-way"] + 0.76) {
    return "milkyWayDeparture";
  }

  if (exactStage < STAGE_INDEX["local-group"] + 0.26) {
    return "localGroup";
  }

  if (exactStage < STAGE_INDEX["local-group"] + 0.76) {
    return "localGroupDeparture";
  }

  if (exactStage < STAGE_INDEX["cosmic-web"] + 0.26) {
    return cueForStageState(STAGE_INDEX["cosmic-web"], exactStage);
  }

  if (exactStage < STAGE_INDEX.unknown - 0.24) {
    return "unknownTransition";
  }

  return cueForStageState(STAGE_INDEX.unknown, exactStage);
}

function handleNarrationFromStage(exactStage, previousStage) {
  const cueId = cueForScrollPosition(exactStage);

  if (!journeyState.userInteracted) {
    setNarration(cueId, { play: false });
    journeyState.lastExactStage = exactStage;
    return;
  }

  setNarration(cueId);

  if (activeStage !== previousStage) {
    updateMissionForStage();
  }

  journeyState.lastExactStage = exactStage;
}

setNarration("homeStart", { play: false, force: true });
syncSubtitleVisibility();
const quality = createQualityProfile({
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: window.devicePixelRatio,
  cores: navigator.hardwareConcurrency ?? 4,
  reducedMotion
});
const nearSpaceComposition = createNearSpaceComposition({
  width: window.innerWidth,
  height: window.innerHeight
});
let mapUnavailable = false;
const satelliteMap = createSatelliteMap({
  L,
  root: mapRoot,
  initialLocation: DEFAULT_LOCATION,
  tileUrl: WORLD_IMAGERY_URL,
  attribution: WORLD_IMAGERY_ATTRIBUTION,
  onUnavailable: () => {
    mapUnavailable = true;
  }
});

const visualObjects = OBJECTS.map(withBaseAsset);
const objects = visualObjects.filter((object) => "radius" in object);
const regionAnnotations = visualObjects.filter((object) => !("radius" in object));
const {
  galaxy: rawGalaxyAnnotationSources,
  localGroup: rawGroupGalaxyAnnotationSources
} = ANNOTATIONS;
const galaxyAnnotationSources = rawGalaxyAnnotationSources.map(withBaseAsset);
const groupGalaxyAnnotationSources = rawGroupGalaxyAnnotationSources.map(withBaseAsset);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true
});

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030711, 0.0026);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 7, stages[STAGE_INDEX.place].camera.position[2]);
const cameraTarget = new THREE.Vector3(...stages[STAGE_INDEX.place].camera.target);

const group = new THREE.Group();
scene.add(group);

const ambient = new THREE.AmbientLight(0x9fb8ff, 0.2);
const sunLight = new THREE.PointLight(0xfff2c0, 5, 240);
sunLight.position.set(10, 0, 0);
scene.add(ambient, sunLight);

const starGeometry = new THREE.BufferGeometry();
const starPositions = [];
for (let i = 0; i < 2400; i += 1) {
  const radius = 80 + Math.random() * 520;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions.push(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi)
  );
}
starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({ color: 0xdde7ff, size: 0.42, transparent: true, opacity: 0.75 })
);
scene.add(stars);

const interactive = [];
const textureLoader = new THREE.TextureLoader();
const textureStore = createTextureStore({
  THREE,
  loader: textureLoader,
  manifestUrl: publicAsset("space/assets.json")
});
const rawEarthTextureRoutes = selectEarthTextureRoutes(quality);
const earthTextureRoutes = Object.freeze({
  surface: publicAsset(rawEarthTextureRoutes.surface),
  clouds: publicAsset(rawEarthTextureRoutes.clouds)
});
const solarTextureSources = Object.freeze([
  ...new Set(solarPlanets.flatMap(({ image }) => image ? [image] : []))
]);
const introController = createIntroController({
  root: introLayer,
  startButton: startJourneyButton,
  reducedMotion,
  onStart: startJourney
});
const [earthTextureResource, earthCloudResource, ...solarTextureResources] = await Promise.all([
  textureStore.load(earthTextureRoutes.surface, 0x16355f),
  textureStore.load(earthTextureRoutes.clouds, 0x000000),
  ...solarTextureSources.map((url) => textureStore.load(url, 0x07101f))
]);
const earthTexture = earthTextureResource.texture;
const earthCloudTexture = earthCloudResource.texture;
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
[earthTextureResource, earthCloudResource, ...solarTextureResources].forEach(({ texture }) => {
  texture.anisotropy = maxAnisotropy;
});
const solarTextures = new Map(solarTextureSources.map((url, index) => (
  [url, solarTextureResources[index]]
)));
const glowDiscTexture = createGlowDiscTexture();
solarTextures.set("glow", glowDiscTexture);
const milkyWayTexture = textureLoader.load(publicAsset("space/milky-way-realistic.jpg"));
milkyWayTexture.colorSpace = THREE.SRGBColorSpace;
stars.material.map = glowDiscTexture;
stars.material.alphaTest = 0.01;
stars.material.depthWrite = false;
stars.material.needsUpdate = true;

const bokehField = new THREE.Group();
for (let i = 0; i < 170; i += 1) {
  const material = new THREE.SpriteMaterial({
    map: glowDiscTexture,
    color: [0xffffff, 0xa8c7ff, 0xffc1ad, 0x9d83ff][i % 4],
    transparent: true,
    opacity: 0.24 + Math.random() * 0.28,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const sprite = new THREE.Sprite(material);
  const z = -90 - Math.random() * 330;
  sprite.position.set((Math.random() - 0.5) * 230, (Math.random() - 0.5) * 116, z);
  const size = 2.4 + Math.random() * 12;
  sprite.scale.set(size, size, 1);
  sprite.userData.baseOpacity = material.opacity;
  sprite.renderOrder = 3;
  bokehField.add(sprite);
}
scene.add(bokehField);

const midSpaceStarGeometry = new THREE.BufferGeometry();
const midSpaceStarPositions = [];
const midSpaceStarColors = [];
const midSpaceStarPalette = [
  new THREE.Color(0xeef6ff),
  new THREE.Color(0xaecbff),
  new THREE.Color(0xffd4b8),
  new THREE.Color(0x9fbbff)
];
for (let i = 0; i < 5200; i += 1) {
  const zBand = -120 - Math.random() * 460;
  const spread = 180 + Math.abs(zBand) * 1.45;
  midSpaceStarPositions.push(
    (Math.random() - 0.5) * spread,
    (Math.random() - 0.5) * spread * 0.52,
    zBand
  );
  const color = midSpaceStarPalette[i % midSpaceStarPalette.length];
  const intensity = 0.62 + Math.random() * 0.38;
  midSpaceStarColors.push(color.r * intensity, color.g * intensity, color.b * intensity);
}
midSpaceStarGeometry.setAttribute("position", new THREE.Float32BufferAttribute(midSpaceStarPositions, 3));
midSpaceStarGeometry.setAttribute("color", new THREE.Float32BufferAttribute(midSpaceStarColors, 3));
const midSpaceStars = new THREE.Points(
  midSpaceStarGeometry,
  new THREE.PointsMaterial({
    map: glowDiscTexture,
    size: 0.72,
    transparent: true,
    opacity: 0,
    alphaTest: 0.01,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  })
);
midSpaceStars.renderOrder = 1;
scene.add(midSpaceStars);

const nearStarGeometry = new THREE.BufferGeometry();
const nearStarPositions = [];
const nearStarColors = [];
const nearStarPalette = [
  new THREE.Color(0xffffff),
  new THREE.Color(0xb9d7ff),
  new THREE.Color(0xffdfc1),
  new THREE.Color(0xd8c8ff)
];
for (let i = 0; i < 3600; i += 1) {
  const zBand = -18 - Math.random() * 240;
  const spread = 120 + Math.abs(zBand) * 1.9;
  nearStarPositions.push(
    (Math.random() - 0.5) * spread,
    (Math.random() - 0.5) * spread * 0.56,
    zBand
  );
  const color = nearStarPalette[i % nearStarPalette.length];
  const intensity = 0.5 + Math.random() * 0.5;
  nearStarColors.push(color.r * intensity, color.g * intensity, color.b * intensity);
}
nearStarGeometry.setAttribute("position", new THREE.Float32BufferAttribute(nearStarPositions, 3));
nearStarGeometry.setAttribute("color", new THREE.Float32BufferAttribute(nearStarColors, 3));
const nearSpaceStars = new THREE.Points(
  nearStarGeometry,
  new THREE.PointsMaterial({
    map: glowDiscTexture,
    size: 1.05,
    transparent: true,
    opacity: 0,
    alphaTest: 0.01,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  })
);
nearSpaceStars.renderOrder = 2;
scene.add(nearSpaceStars);

const hyperdriveGeometry = new THREE.BufferGeometry();
const hyperdrivePositions = [];
const hyperdriveColors = [];
for (let i = 0; i < 720; i += 1) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 1.5 + Math.random() * 62;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * 0.58;
  const length = 140 + Math.random() * 260;
  const stretch = 3.4 + Math.random() * 4.2;
  hyperdrivePositions.push(x, y, -24 - Math.random() * 80, x * stretch, y * stretch, -24 - length);
  const color = i % 5 === 0 ? new THREE.Color(0x9ad7ff) : new THREE.Color(0xffffff);
  const intensity = 0.45 + Math.random() * 0.55;
  hyperdriveColors.push(
    color.r * 0.08,
    color.g * 0.08,
    color.b * 0.08,
    color.r * intensity,
    color.g * intensity,
    color.b * intensity
  );
}
hyperdriveGeometry.setAttribute("position", new THREE.Float32BufferAttribute(hyperdrivePositions, 3));
hyperdriveGeometry.setAttribute("color", new THREE.Float32BufferAttribute(hyperdriveColors, 3));
const hyperdriveLines = new THREE.LineSegments(
  hyperdriveGeometry,
  new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  })
);
hyperdriveLines.renderOrder = 20;
scene.add(hyperdriveLines);

function createGlowDiscTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 6, 128, 128, 118);
  gradient.addColorStop(0, "rgba(255,255,255,0.96)");
  gradient.addColorStop(0.36, "rgba(210,225,255,0.5)");
  gradient.addColorStop(0.58, "rgba(255,210,190,0.18)");
  gradient.addColorStop(0.72, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const earthLayer = createEarthLayer({
  THREE,
  textures: Object.freeze({ earth: earthTexture, clouds: earthCloudTexture }),
  quality,
  renderer
});
const earthSurface = earthLayer.root.getObjectByName("earth-surface");
const earthSource = objects.find(({ id }) => id === "earth");
const earthAnnotation = Object.freeze({ ...earthSource, object3D: earthSurface });
earthSurface.userData.annotation = earthAnnotation;
earthLayer.root.userData.stage = earthAnnotation.stage;
earthLayer.setPresence(0);
group.add(earthLayer.root);
const earthKeyLight = new THREE.DirectionalLight(0xfff1d6, 3.8);
earthKeyLight.position.set(-26, 12, 12);
earthKeyLight.target.position.copy(earthLayer.root.position);
scene.add(earthKeyLight, earthKeyLight.target);

const solarSystemLayer = createSolarSystemLayer({
  THREE,
  stage: STAGE_INDEX["solar-system"],
  planets: solarPlanets,
  textures: solarTextures,
  quality,
  composition: nearSpaceComposition
});
const solarAnnotations = Object.freeze(solarSystemLayer.interactive.map(
  ({ userData }) => userData.annotation
));
const solarArtifactIds = new Set(solarAnnotations.map((annotation) => annotation.id));
journeyState.artifactTotal = solarArtifactIds.size;

// The rocket fades in only after the first Earth line ("Вот она, Земля… Нужен
// корабль") has had time to play, instead of popping in during the transition.
function scheduleEarthShipReveal() {
  if (journeyState.earthShipReady || earthShipRevealTimer != null) {
    return;
  }
  earthShipRevealTimer = window.setTimeout(() => {
    earthShipRevealTimer = null;
    journeyState.earthShipReady = true;
    syncJourneyClasses();
    if (activeStage === STAGE_INDEX.earth) updateMissionForStage();
  }, 5500);
}

function promptRocketCatch() {
  // The rocket briefing plays exactly once — never again on a mistimed tap.
  if (journeyState.rocketCaught || journeyState.rocketPrompted) {
    return;
  }

  journeyState.rocketPrompted = true;
  setNarration("earthRocketPrompt", { force: true });
  syncJourneyClasses();
  updateMissionForStage();
}

function catchRocket() {
  markUserInteraction();

  if (!journeyState.rocketPrompted) {
    promptRocketCatch();
    return;
  }

  if (journeyState.rocketCaught) {
    return;
  }

  if (rocketGame.attemptCatch() !== "caught") {
    rocketGame.flashMiss();
    showMission("Мимо! Жми на зону ровно в тот миг, когда ракета внутри неё.");
    return;
  }

  journeyState.rocketCaught = true;
  rocketGame.setCaught();
  setNarration("earthRocketCaught", { force: true });
  showMission("Ракета поймана. Листай дальше, чтобы покинуть Землю.");
  syncJourneyClasses();
}

// Plays the breakdown → quest briefing (once each) when the player starts
// inspecting planets, before any quiz is solved.
function ensureSolarBriefing() {
  if (journeyState.solarComplete) {
    return;
  }

  if (!journeyState.solarBroken) {
    journeyState.solarBroken = true;
    setNarration("solarBroken", { force: true });
  } else if (!journeyState.solarQuestStarted) {
    journeyState.solarQuestStarted = true;
    setNarration("solarQuest", { force: true });
  }
}

// Collects an engine part — only reached once the planet's quiz is answered.
function collectSolarArtifact(data) {
  if (!solarArtifactIds.has(data.id) || journeyState.solarComplete) {
    return;
  }

  if (journeyState.artifactIds.has(data.id)) {
    return;
  }

  journeyState.artifactIds.add(data.id);
  solarLabelById.get(data.id)?.classList.add("collected");

  if (journeyState.artifactIds.size >= journeyState.artifactTotal) {
    syncJourneyClasses();
    showMission("Все детали собраны! Нажми «Собрать двигатель», чтобы собрать его.");
    return;
  }

  showMission(`Деталь найдена: ${journeyState.artifactIds.size}/${journeyState.artifactTotal}. ${data.title} отдала часть двигателя.`);
}

// The engine-assembly puzzle: opened once all parts are gathered, solved by
// swapping tiles into place, which finishes the solar-system stage.
function openEnginePuzzle() {
  markUserInteraction();
  if (journeyState.solarComplete) {
    return;
  }
  if (!enginePuzzleStarted) {
    enginePuzzleGame.shuffle();
    enginePuzzleStarted = true;
  }
  closeAnnotation();
  enginePuzzle.hidden = false;
}

function closeEnginePuzzle() {
  enginePuzzle.hidden = true;
}

function completeEngine() {
  if (journeyState.solarComplete) {
    return;
  }
  journeyState.solarComplete = true;
  setNarration("solarComplete", { force: true });
  showMission("Двигатель собран и снова работает. Листай дальше!");
  closeEnginePuzzle();
  syncJourneyClasses();
}

// Begins the cosmic-web flow puzzle (first tile the player rotates). The quest
// narration plays exactly once here.
function startWebQuest() {
  markUserInteraction();
  if (journeyState.webComplete || journeyState.webQuestStarted) {
    return;
  }
  journeyState.webQuestStarted = true;
  setNarration("universeQuest", { force: true });
  showMission("Поворачивай кусочки нитей, чтобы соединить нашу галактику с дальним узлом. Три уровня.");
  syncJourneyClasses();
}

// Connected the thread on all three levels.
function completeWebPath() {
  if (journeyState.webComplete) {
    return;
  }
  journeyState.webComplete = true;
  setNarration("universeComplete", { force: true });
  showMission("Нить собрана до конца — всё во Вселенной связано. Листай к неизвестному.");
  syncJourneyClasses();
}

function createPersonalStar(left, top) {
  const star = document.createElement("span");
  star.style.left = `${left}%`;
  star.style.top = `${top}%`;
  personalStars.append(star);
}

function openCoupon() {
  couponModal.hidden = false;
}

function closeCoupon() {
  couponModal.hidden = true;
}

// Places the user's star where they clicked (finale "choose a spot" mode).
function placeStar(clientX, clientY) {
  if (journeyState.finalStep !== 2) {
    return;
  }
  journeyState.finalStep = 3;
  const left = Math.min(96, Math.max(4, (clientX / window.innerWidth) * 100));
  const top = Math.min(92, Math.max(8, (clientY / window.innerHeight) * 100));
  createPersonalStar(left, top);
  starMaker.textContent = "Звезда горит";
  showMission("Твоя звезда зажглась! Забери свой купон.");
  syncJourneyClasses();
  // Let the flash play and the star be seen before the coupon window covers it.
  window.setTimeout(openCoupon, 1200);
}

function advanceFinale() {
  markUserInteraction();

  if (journeyState.finalStep === 0) {
    journeyState.finalStep = 1;
    starMaker.textContent = "Продолжить";
    setNarration("finalTwo", { force: true });
    showMission("Нажми «Продолжить», чтобы услышать финал.");
    syncJourneyClasses();
    return;
  }

  if (journeyState.finalStep === 1) {
    journeyState.finalStep = 2;
    starMaker.textContent = "Выберите место для звезды";
    setNarration("finalStar", { force: true });
    showMission("Кликни в любом месте на экране, чтобы поставить свою звезду.");
    syncJourneyClasses();
    return;
  }

  if (journeyState.finalStep >= 3) {
    openCoupon();
  }
}

function handlePanelNarration(data) {
  if (data.id === "earth" && activeStage === STAGE_INDEX.earth) {
    promptRocketCatch();
    return;
  }

  if (solarArtifactIds.has(data.id)) {
    ensureSolarBriefing();
    return;
  }

  if (data.stage === STAGE_INDEX["cosmic-web"]) {
    startWebQuest();
  }
}
solarSystemLayer.root.updateMatrixWorld(true);
const solarSunPosition = solarSystemLayer.root.getObjectByName("sun")
  .getWorldPosition(new THREE.Vector3());
sunLight.position.copy(solarSunPosition);

const galaxyGeometry = new THREE.BufferGeometry();
const galaxyPositions = [];
for (let i = 0; i < 1600; i += 1) {
  const angle = i * 0.23;
  const radius = 12 + Math.sqrt(i) * 4.5;
  const arm = i % 4;
  const spread = (Math.random() - 0.5) * 16;
  galaxyPositions.push(
    Math.cos(angle + arm * 1.57) * radius + spread,
    (Math.random() - 0.5) * 8,
    Math.sin(angle + arm * 1.57) * radius + spread * 0.25 - 80
  );
}
galaxyGeometry.setAttribute("position", new THREE.Float32BufferAttribute(galaxyPositions, 3));
const galaxy = new THREE.Points(
  galaxyGeometry,
  new THREE.PointsMaterial({
    map: glowDiscTexture,
    color: 0xdbe7ff,
    size: 1.15,
    transparent: true,
    opacity: 0,
    alphaTest: 0.01,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  })
);
galaxy.rotation.x = 0.34;
galaxy.renderOrder = 5;
group.add(galaxy);

const milkyWayGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: milkyWayTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending
  })
);
milkyWayGlow.position.set(-20, 2, -82);
milkyWayGlow.scale.set(900, 580, 1);
milkyWayGlow.renderOrder = 4;
group.add(milkyWayGlow);

const galaxyAnnotationMarkers = new THREE.Group();
const galaxyAnnotations = Object.freeze(galaxyAnnotationSources.map((source) => {
  const material = new THREE.SpriteMaterial({
    map: glowDiscTexture,
    color: 0xdfe9ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const marker = new THREE.Sprite(material);
  marker.position.set(...source.position);
  marker.scale.set(12, 12, 1);
  marker.userData.baseOpacity = 0.76;
  const annotation = Object.freeze({ ...source, object3D: marker });
  marker.userData.annotation = annotation;
  marker.userData.stage = annotation.stage;
  marker.renderOrder = 7;
  galaxyAnnotationMarkers.add(marker);
  interactive.push(marker);
  return annotation;
}));
group.add(galaxyAnnotationMarkers);

const localGroup = new THREE.Group();
for (let i = 0; i < 260; i += 1) {
  const radius = 28 + Math.random() * 520;
  const angle = Math.random() * Math.PI * 2;
  const material = new THREE.SpriteMaterial({
    map: glowDiscTexture,
    color: i % 5 === 0 ? 0xffffff : 0xb8ccff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const dot = new THREE.Sprite(material);
  dot.position.set(
    Math.cos(angle) * radius + (Math.random() - 0.5) * 70,
    8 + (Math.random() - 0.5) * 330,
    -138 + Math.sin(angle) * radius * 0.42 + (Math.random() - 0.5) * 58
  );
  const size = 5 + Math.random() * 18;
  dot.scale.set(size, size, 1);
  dot.userData.baseOpacity = 0.24 + Math.random() * 0.5;
  dot.renderOrder = 5;
  localGroup.add(dot);
}
for (let i = 0; i < 58; i += 1) {
  const material = new THREE.SpriteMaterial({
    map: glowDiscTexture,
    color: 0xe8efff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const dot = new THREE.Sprite(material);
  dot.position.set((Math.random() - 0.5) * 520, 8 + (Math.random() - 0.5) * 220, -138 + (Math.random() - 0.5) * 88);
  const size = 12 + Math.random() * 30;
  dot.scale.set(size, size, 1);
  dot.userData.baseOpacity = 0.36 + Math.random() * 0.48;
  dot.renderOrder = 5;
  localGroup.add(dot);
}
const groupGalaxyAnnotations = Object.freeze(groupGalaxyAnnotationSources.map((source) => {
  const material = new THREE.SpriteMaterial({
    map: glowDiscTexture,
    color: source.color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const dot = new THREE.Sprite(material);
  dot.position.set(...source.position);
  dot.scale.set(source.size, source.size, 1);
  dot.userData.baseOpacity = 0.9;
  const annotation = Object.freeze({ ...source, object3D: dot });
  dot.userData.annotation = annotation;
  dot.renderOrder = 6;
  localGroup.add(dot);
  interactive.push(dot);
  return annotation;
}));
group.add(localGroup);

const cosmicWebGeometry = new THREE.BufferGeometry();
const cosmicWebPositions = [];
const cosmicWebColors = [];
const webClusters = Array.from({ length: 74 }, () => ({
  x: (Math.random() - 0.5) * 1320,
  y: (Math.random() - 0.5) * 760,
  z: -235 + (Math.random() - 0.5) * 190
}));
for (let i = 0; i < 9800; i += 1) {
  const cluster = webClusters[Math.floor(Math.random() * webClusters.length)];
  const next = webClusters[Math.floor(Math.random() * webClusters.length)];
  const t = Math.random();
  cosmicWebPositions.push(
    THREE.MathUtils.lerp(cluster.x, next.x, t) + (Math.random() - 0.5) * 10,
    THREE.MathUtils.lerp(cluster.y, next.y, t) + (Math.random() - 0.5) * 10,
    THREE.MathUtils.lerp(cluster.z, next.z, t) + (Math.random() - 0.5) * 10
  );
  const color = i % 7 === 0 ? new THREE.Color(0xffd56b) : i % 3 === 0 ? new THREE.Color(0xff78d7) : new THREE.Color(0xc09bff);
  const intensity = 0.5 + Math.random() * 0.5;
  cosmicWebColors.push(color.r * intensity, color.g * intensity, color.b * intensity);
}
cosmicWebGeometry.setAttribute("position", new THREE.Float32BufferAttribute(cosmicWebPositions, 3));
cosmicWebGeometry.setAttribute("color", new THREE.Float32BufferAttribute(cosmicWebColors, 3));
const cosmicWebPoints = new THREE.Points(
  cosmicWebGeometry,
  new THREE.PointsMaterial({
    map: glowDiscTexture,
    size: 3.2,
    transparent: true,
    opacity: 0,
    alphaTest: 0.01,
    depthWrite: false,
    depthTest: false,
    fog: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  })
);
cosmicWebPoints.renderOrder = 6;
group.add(cosmicWebPoints);

const cosmicWebTexture = textureLoader.load(publicAsset("space/cosmic-web-bright.png"));
cosmicWebTexture.colorSpace = THREE.SRGBColorSpace;
const cosmicWebPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(4200, 2400),
  new THREE.MeshBasicMaterial({
    map: cosmicWebTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide
  })
);
cosmicWebPlane.position.set(0, 0, -185);
cosmicWebPlane.renderOrder = 1;
group.add(cosmicWebPlane);

const cosmicDepthGeometry = new THREE.BufferGeometry();
const cosmicDepthPositions = [];
const cosmicDepthColors = [];
for (let i = 0; i < 1200; i += 1) {
  cosmicDepthPositions.push(
    (Math.random() - 0.5) * 2200,
    (Math.random() - 0.5) * 980,
    -120 - Math.random() * 420
  );
  const color = i % 4 === 0 ? new THREE.Color(0xffd67a) : new THREE.Color(0xf0d7ff);
  const intensity = 0.55 + Math.random() * 0.45;
  cosmicDepthColors.push(color.r * intensity, color.g * intensity, color.b * intensity);
}
cosmicDepthGeometry.setAttribute("position", new THREE.Float32BufferAttribute(cosmicDepthPositions, 3));
cosmicDepthGeometry.setAttribute("color", new THREE.Float32BufferAttribute(cosmicDepthColors, 3));
const cosmicDepthStars = new THREE.Points(
  cosmicDepthGeometry,
  new THREE.PointsMaterial({
    map: glowDiscTexture,
    size: 4.2,
    transparent: true,
    opacity: 0,
    alphaTest: 0.01,
    depthWrite: false,
    depthTest: false,
    fog: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending
  })
);
cosmicDepthStars.renderOrder = 7;
group.add(cosmicDepthStars);

const sceneManager = createScene({
  THREE,
  canvas,
  quality,
  renderer,
  scene,
  camera,
  cameraTarget,
  layers: Object.freeze([
    Object.freeze({ stage: earthAnnotation.stage, layer: earthLayer }),
    Object.freeze({ stage: STAGE_INDEX["solar-system"], layer: solarSystemLayer })
  ]),
  interactive: Object.freeze([...interactive])
});
let hovered = null;
let activeObject = null;
let activeStage = STAGE_INDEX.place;
let journeyStarted = false;
let introElapsed = 0;
let lastAnimationTime = null;
let earthShipRevealTimer = null;
let currentStageState = computeStageState({
  scrollY: 0,
  scrollHeight: 1,
  viewportHeight: 1,
  stageCount: stages.length,
  reducedMotion
});

function screenPositionFor(data) {
  const point = data.object3D
    ? data.object3D.getWorldPosition(new THREE.Vector3())
    : new THREE.Vector3(...data.position);
  if (!data.object3D) {
    group.localToWorld(point);
  }
  point.project(camera);
  return {
    x: (point.x * 0.5 + 0.5) * window.innerWidth,
    y: (-point.y * 0.5 + 0.5) * window.innerHeight
  };
}

function createLabel(data) {
  const label = document.createElement("button");
  label.type = "button";
  label.className = "space-label";
  label.dataset.id = data.id;
  label.textContent = data.title;
  setLabelAccessibility(label, false);
  label.addEventListener("click", (event) => {
    event.stopPropagation();
    openPanel(data, event.currentTarget);
  }, { signal: listenerSignal });
  spaceLabels.append(label);
  return label;
}

const labelTargets = [
  earthAnnotation,
  ...solarAnnotations,
  ...galaxyAnnotations,
  ...groupGalaxyAnnotations,
  ...regionAnnotations.filter((annotation) => ![
    STAGE_INDEX["milky-way"],
    STAGE_INDEX["local-group"],
    STAGE_INDEX.unknown
  ].includes(annotation.stage))
];
const labels = labelTargets.map((data, index) => Object.freeze({
  data,
  element: createLabel(data),
  priority: labelTargets.length - index
}));
const solarLabelById = new Map();
labels.forEach(({ data, element }) => {
  if (solarArtifactIds.has(data.id)) {
    element.classList.add("quest-target");
    solarLabelById.set(data.id, element);
  }
});
const labelSafeRightInset = nearSpaceComposition.labelSafeRightInset;
const labelLayoutCoordinator = createLabelLayoutCoordinator({
  layout: layoutLabels,
  getViewport: () => ({
    width: Math.max(240, window.innerWidth - labelSafeRightInset),
    height: window.innerHeight
  }),
  padding: 12,
  gap: 6
});

function updateLabels(layerOpacities) {
  const visibleLabels = [];

  labels.forEach(({ data, element, priority }) => {
    const presence = layerOpacities[data.stage];
    const isVisible = presence > 0.08;
    element.classList.toggle("visible", isVisible);
    setLabelAccessibility(element, isVisible);
    if (!isVisible) {
      element.style.opacity = "0";
      element.style.removeProperty("transform");
      element.style.removeProperty("--anchor-x");
      element.style.removeProperty("--anchor-y");
      return;
    }

    const opacity = String(Math.min(1, presence * 1.35));
    element.style.opacity = opacity;
    const point = screenPositionFor(data);
    const offsetX = data.object3D ? 10 : data.stage >= 4 ? 18 : 16;
    const offsetY = data.object3D ? -12 : data.stage >= 4 ? -10 : -22;
    visibleLabels.push(Object.freeze({
      id: data.id,
      element,
      anchor: Object.freeze({ x: point.x + offsetX, y: point.y + offsetY }),
      priority,
      opacity
    }));
  });

  const placements = labelLayoutCoordinator.update(visibleLabels);
  applyLabelPlacements({
    placements,
    records: visibleLabels,
    setAccessibility: setLabelAccessibility
  });
}

function closeAnnotation() {
  activeObject = null;
  annotationPanel.close();
}

const earthPosition = Object.freeze(earthLayer.root.position.toArray());
const initialOrbitPose = createEarthCameraPose({
  basePose: stages[earthAnnotation.stage].camera,
  aspect: camera.aspect,
  earthPosition
});
const earthExperience = createEarthExperienceController({
  map: satelliteMap,
  earthLayer,
  orbitPose: initialOrbitPose,
  earthPosition,
  radius: 14,
  earthStage: STAGE_INDEX.earth,
  initialLocation: DEFAULT_LOCATION
});
const locationController = createLocationController({
  geolocation: navigator.geolocation,
  setLocation: earthExperience.setLocation,
  fallback: DEFAULT_LOCATION
});

function applyEarthJourneyVisuals(journey) {
  const progress = journey?.progress ?? 1;
  const mapOpacity = journey?.mapOpacity ?? 0;
  const maskRadius = 160 * mapOpacity;
  const scale = 1.03 - progress * 0.09;
  const tilt = progress * 1.5;

  mapLayer.style.setProperty("--map-opacity", String(mapOpacity));
  mapLayer.style.setProperty("--map-mask-radius", `${maskRadius}vmax`);
  mapLayer.style.setProperty("--map-scale", String(scale));
  mapLayer.style.setProperty("--map-tilt", `${tilt}deg`);
  mapLayer.toggleAttribute("data-handoff", progress > 0.58 && mapOpacity > 0);
  mapLayer.setAttribute("aria-hidden", String(!journey || (mapOpacity <= 0.01 && !mapUnavailable)));
}

function updateEarthRenderTelemetry(layerOpacities) {
  canvas.dataset.earthPresence = String(layerOpacities[earthAnnotation.stage] ?? 0);
  canvas.dataset.hyperdriveVisible = String(hyperdriveLines.visible);
  canvas.dataset.bokehVisible = String(bokehField.visible);

  const marker = earthLayer.root.getObjectByName("earth-focus-marker");
  const surface = earthLayer.root.getObjectByName("earth-surface");
  const clouds = earthLayer.root.getObjectByName("earth-clouds");
  canvas.dataset.earthSurfaceRotation = surface?.rotation.y.toFixed(6) ?? "";
  canvas.dataset.earthCloudsRotation = clouds?.rotation.y.toFixed(6) ?? "";
  canvas.dataset.earthFocusMarkerVisible = String(Boolean(
    marker?.visible
      && earthLayer.root.visible
      && marker.material.opacity > 0.01
  ));
  const northValues = earthLayer.root.userData.focusNorthWorld;
  if (!marker || !northValues) return;

  const focusWorld = marker.getWorldPosition(new THREE.Vector3());
  const focusProjected = focusWorld.clone().project(camera);
  const northProjected = focusWorld.clone()
    .add(new THREE.Vector3(...northValues))
    .project(camera);
  const toScreen = (projected) => Object.freeze({
    x: (projected.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projected.y * 0.5 + 0.5) * window.innerHeight
  });
  const focusScreen = toScreen(focusProjected);
  const northScreen = toScreen(northProjected);

  canvas.dataset.earthFocusX = focusScreen.x.toFixed(3);
  canvas.dataset.earthFocusY = focusScreen.y.toFixed(3);
  canvas.dataset.earthNorthDx = (northScreen.x - focusScreen.x).toFixed(3);
  canvas.dataset.earthNorthDy = (focusScreen.y - northScreen.y).toFixed(3);
}

function updateStage() {
  if (!journeyStarted) return;
  const previousStage = activeStage;
  currentStageState = computeStageState({
    scrollY: window.scrollY,
    scrollHeight: document.body.scrollHeight,
    viewportHeight: window.innerHeight,
    stageCount: stages.length,
    reducedMotion
  });
  const { exactStage, transitionAmount } = currentStageState;
  activeStage = currentStageState.activeStage;
  if (activeStage === STAGE_INDEX.earth) scheduleEarthShipReveal();
  const lower = Math.floor(exactStage);
  const upper = Math.min(stages.length - 1, lower + 1);
  const mix = THREE.MathUtils.smootherstep(exactStage - lower, 0, 1);
  const cameraPoseForStage = (stageIndex) => (
    stageIndex === earthAnnotation.stage
      ? createEarthCameraPose({
        basePose: stages[stageIndex].camera,
        aspect: camera.aspect
      })
      : stages[stageIndex].camera
  );
  const cameraState = interpolateCamera(cameraPoseForStage(lower), cameraPoseForStage(upper), mix);
  const cameraPose = resolveCameraPose({
    stages,
    stageState: currentStageState,
    interpolatedPose: cameraState,
    staticPose: cameraPoseForStage(activeStage)
  });
  const responsiveOrbitPose = cameraPoseForStage(earthAnnotation.stage);
  const earthFrame = earthExperience.update({
    stageState: currentStageState,
    exactStage,
    reducedMotion,
    aspect: camera.aspect,
    orbitPose: responsiveOrbitPose,
    mapUnavailable
  });
  const earthFocusMarker = earthLayer.root.getObjectByName("earth-focus-marker");
  if (earthFocusMarker) earthFocusMarker.visible = true;
  const renderStageState = earthFrame?.stageState ?? currentStageState;
  const renderCameraPose = earthFrame?.cameraPose ?? cameraPose;
  const layerOpacities = renderStageState.layerPresence;
  const journeyTransitionAmount = earthFrame?.transitionEffectsAllowed === false
    ? 0
    : transitionAmount;
  sceneManager.update({
    stageState: renderStageState,
    cameraPose: renderCameraPose,
    viewport: Object.freeze({
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: quality.pixelRatio
    })
  });

  setActiveStage(activeStage);
  applyEarthJourneyVisuals(earthFrame?.journey);
  document.body.dataset.stage = String(activeStage);
  handleNarrationFromStage(exactStage, previousStage);

  const bokehOpacity = journeyTransitionAmount * 0.8
    + layerOpacities[STAGE_INDEX["cosmic-web"]] * 1.2
    + layerOpacities[STAGE_INDEX.unknown] * 0.85;
  bokehField.visible = bokehOpacity > 0.03;
  bokehField.children.forEach((sprite) => {
    sprite.material.opacity = sprite.userData.baseOpacity * bokehOpacity;
  });

  distanceMarkerItems.forEach((item, index) => {
    item.classList.toggle("active", index === activeStage);
  });

  hyperdriveLines.visible = journeyTransitionAmount > 0.02;
  hyperdriveLines.material.opacity = journeyTransitionAmount * 0.95;
  if (hyperdriveLines.visible) {
    hyperdriveLines.position.copy(camera.position);
    hyperdriveLines.position.z -= 6;
    hyperdriveLines.rotation.z = exactStage * 0.08;
    hyperdriveLines.scale.setScalar(1 + journeyTransitionAmount * 0.42);
  }

  updateEarthRenderTelemetry(layerOpacities);

  const unknownOpacity = layerOpacities[STAGE_INDEX.unknown];
  unknownLayer.style.opacity = String(unknownOpacity);
  unknownLayer.style.transform = `translateY(${(1 - unknownOpacity) * 18}px)`;

  const midStarOpacity = Math.max(
    layerOpacities[STAGE_INDEX["solar-system"]] * 0.72,
    layerOpacities[STAGE_INDEX["milky-way"]] * 0.56,
    layerOpacities[STAGE_INDEX.unknown] * 0.9,
    journeyTransitionAmount * 0.9
  );
  midSpaceStars.visible = midStarOpacity > 0.03;
  midSpaceStars.material.opacity = Math.min(0.9, midStarOpacity * 0.78);

  const nearStarOpacity = Math.max(
    layerOpacities[STAGE_INDEX.earth] * 0.78,
    layerOpacities[STAGE_INDEX["solar-system"]] * 0.86,
    journeyTransitionAmount * 0.35
  );
  nearSpaceStars.visible = nearStarOpacity > 0.03;
  nearSpaceStars.material.opacity = Math.min(0.95, nearStarOpacity);

  updateLabels(layerOpacities);

  const galaxyOpacity = layerOpacities[STAGE_INDEX["milky-way"]];
  galaxy.visible = galaxyOpacity > 0.03;
  galaxy.material.opacity = galaxyOpacity * 0.72;
  milkyWayGlow.visible = galaxyOpacity > 0.03;
  milkyWayGlow.material.opacity = galaxyOpacity;
  const galaxyAnnotationOpacity = galaxyOpacity;
  galaxyAnnotationMarkers.visible = galaxyOpacity > 0.03;
  galaxyAnnotationMarkers.children.forEach((marker) => {
    marker.visible = galaxyAnnotationMarkers.visible;
    marker.material.opacity = marker.userData.baseOpacity * galaxyAnnotationOpacity;
  });
  const localGroupOpacity = layerOpacities[STAGE_INDEX["local-group"]];
  localGroup.visible = localGroupOpacity > 0.03;
  localGroup.children.forEach((dot) => {
    dot.material.opacity = dot.userData.baseOpacity * localGroupOpacity;
    dot.visible = localGroup.visible;
  });
  const cosmicWebOpacity = layerOpacities[STAGE_INDEX["cosmic-web"]];
  cosmicWebPoints.visible = cosmicWebOpacity > 0.03;
  cosmicWebPoints.material.opacity = cosmicWebOpacity * 1.35;
  cosmicWebPlane.visible = cosmicWebOpacity > 0.03;
  cosmicWebPlane.material.opacity = cosmicWebOpacity;
  cosmicDepthStars.visible = cosmicWebOpacity > 0.03;
  cosmicDepthStars.material.opacity = cosmicWebOpacity * 1.15;

  if (activeObject && layerOpacities[activeObject.stage] <= 0) {
    closeAnnotation();
  }

}

function openPanel(data, trigger) {
  markUserInteraction();
  activeObject = data;
  annotationPanel.open({
    ...data,
    scale: stages[data.stage].label,
    quizSolved: journeyState.artifactIds.has(data.id)
  }, trigger);
  handlePanelNarration(data);
}

function startJourney() {
  markUserInteraction();
  journeyStarted = true;
  window.scrollTo({ top: 0, behavior: "auto" });
  setNarration("homeStart", { play: journeyState.voiceEnabled, force: true });
  updateMissionForStage();
}

function onPointerMove(event) {
  if (!journeyStarted) return;
  const annotation = sceneManager.hitTest({ clientX: event.clientX, clientY: event.clientY });
  hovered = annotation?.stage != null && currentStageState.layerPresence[annotation.stage] > 0.08
    ? annotation
    : null;
  document.body.classList.toggle("is-pointing", Boolean(hovered));
}

function onClick(event) {
  if (!journeyStarted) return;
  markUserInteraction();

  if (event.target.closest(".narration-panel, .rocket-catcher, .web-flow, .web-runner, .star-maker, .coupon, .engine-puzzle, .engine-puzzle-open, .cinematic-intro, .object-panel, .scale-rail, .distance-summary, .topbar, .space-label, #locateButton")) {
    return;
  }

  if (activeStage === STAGE_INDEX.unknown && !hovered) {
    if (journeyState.finalStep === 2) {
      placeStar(event.clientX, event.clientY);
    }
    return;
  }

  if (hovered) {
    openPanel(hovered);
    return;
  }

  const stageObject =
    regionAnnotations.find((object) => object.stage === currentStageState.activeStage) ??
    (currentStageState.activeStage === earthAnnotation.stage ? earthAnnotation : null);
  if (stageObject && currentStageState.activeStage > STAGE_INDEX.place) {
    openPanel(stageObject);
    return;
  }
}

function onResize() {
  sceneManager.resize({
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: quality.pixelRatio
  });
  labelLayoutCoordinator.invalidateMeasurements();
}

let animationFrameId = null;
let experienceDisposed = false;
const introStageState = computeStageState({
  scrollY: 1,
  scrollHeight: stages.length,
  viewportHeight: 1,
  stageCount: stages.length,
  reducedMotion: true
});

function renderIntro(delta) {
  const introState = createIntroState({ started: journeyStarted, elapsed: introElapsed, reducedMotion });
  earthLayer.updateMotion({ delta, introActive: introState.active });
  const earthFocusMarker = earthLayer.root.getObjectByName("earth-focus-marker");
  if (earthFocusMarker) earthFocusMarker.visible = false;
  cinematicShip.style.setProperty("--ship-roll", `${introState.shipRoll}deg`);
  cinematicShip.style.setProperty("--ship-drift-x", `${introState.shipDrift * -0.7}px`);
  cinematicShip.style.setProperty("--ship-drift-y", `${introState.shipDrift * -1}px`);
  sceneManager.update({
    stageState: introStageState,
    cameraPose: createEarthCameraPose({
      basePose: stages[earthAnnotation.stage].camera,
      aspect: camera.aspect,
      earthPosition,
      radius: 14,
      occupancy: 0.92
    }),
    viewport: Object.freeze({
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: quality.pixelRatio
    })
  });
  updateEarthRenderTelemetry(introStageState.layerPresence);
  applyEarthJourneyVisuals(null);
}

function animate(timestamp = performance.now()) {
  if (experienceDisposed) return;
  const delta = lastAnimationTime == null
    ? 0
    : Math.min(0.1, Math.max(0, (timestamp - lastAnimationTime) / 1000));
  lastAnimationTime = timestamp;
  introElapsed += delta;

  if (journeyStarted) {
    updateStage();
    rocketGame.update({
      delta,
      active: activeStage === STAGE_INDEX.earth && !journeyState.rocketCaught && journeyState.earthShipReady
    });
  } else {
    renderIntro(delta);
  }
  sceneManager.render();
  animationFrameId = requestAnimationFrame(animate);
}

const localVisualRoots = Object.freeze([
  stars,
  bokehField,
  midSpaceStars,
  nearSpaceStars,
  hyperdriveLines,
  galaxy,
  milkyWayGlow,
  galaxyAnnotationMarkers,
  localGroup,
  cosmicWebPoints,
  cosmicWebPlane,
  cosmicDepthStars
]);

function disposeLocalVisualResources() {
  const geometries = new Set();
  const materials = new Set();
  localVisualRoots.forEach((root) => {
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      objectMaterials.filter(Boolean).forEach((material) => materials.add(material));
    });
  });
  geometries.forEach((geometry) => geometry?.dispose());
  materials.forEach((material) => material?.dispose());
  milkyWayTexture.dispose();
  cosmicWebTexture.dispose();
}

function disposeExperience() {
  if (experienceDisposed) return;
  experienceDisposed = true;
  if (animationFrameId != null) cancelAnimationFrame(animationFrameId);
  window.clearTimeout(locateTimerId);
  window.clearTimeout(earthShipRevealTimer);
  listenerController.abort();
  introController.dispose();
  narrationAudio.pause();
  narrationAudio.removeAttribute("src");
  narrationAudio.load();
  annotationPanel.dispose();
  shell.dispose();
  earthExperience.dispose();
  disposeLocalVisualResources();
  sceneManager.dispose();
  earthTextureResource.release();
  earthCloudResource.release();
  textureStore.dispose();
  glowDiscTexture.dispose();
}

function onLocateClick(event) {
  event.stopPropagation();
  markUserInteraction();
  locationController.locate();
}

function onJourneyInteraction() {
  if (!journeyStarted) return;
  markUserInteraction();
}

railButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!journeyStarted) return;
    markUserInteraction();
    const stage = Number(button.dataset.stage);
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    window.scrollTo({ top: maxScroll * (stage / (stages.length - 1)), behavior: reducedMotion ? "auto" : "smooth" });
  }, { signal: listenerSignal });
});

voiceToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  markUserInteraction();

  if (journeyState.voiceEnabled && !narrationAudio.paused) {
    narrationAudio.pause();
    journeyState.voiceEnabled = false;
    updateVoiceButton();
    return;
  }

  journeyState.voiceEnabled = true;
  playCurrentNarration({ restart: narrationAudio.ended });
}, { signal: listenerSignal });
subtitleToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  markUserInteraction();
  journeyState.subtitlesHidden = true;
  syncSubtitleVisibility();
}, { signal: listenerSignal });
subtitleRestore.addEventListener("click", (event) => {
  event.stopPropagation();
  markUserInteraction();
  journeyState.subtitlesHidden = false;
  syncSubtitleVisibility();
}, { signal: listenerSignal });
narrationAudio.addEventListener("timeupdate", () => {
  const progress = narrationAudio.duration > 0 ? narrationAudio.currentTime / narrationAudio.duration : 0;
  narrationProgress.style.width = `${Math.min(1, progress) * 100}%`;
}, { signal: listenerSignal });
narrationAudio.addEventListener("ended", updateVoiceButton, { signal: listenerSignal });

rocketCatcher.addEventListener("click", (event) => {
  event.stopPropagation();
  catchRocket();
}, { signal: listenerSignal });
webRunner.addEventListener("click", (event) => {
  event.stopPropagation();
  markUserInteraction();
  startWebQuest();
  webFlowGame.reset();
  showMission("Начинаем сначала. Поворачивай кусочки и собери нить.");
}, { signal: listenerSignal });
starMaker.addEventListener("click", (event) => {
  event.stopPropagation();
  advanceFinale();
}, { signal: listenerSignal });
couponClose.addEventListener("click", (event) => {
  event.stopPropagation();
  closeCoupon();
}, { signal: listenerSignal });
couponModal.addEventListener("click", (event) => {
  event.stopPropagation();
  if (event.target === couponModal) closeCoupon();
}, { signal: listenerSignal });
enginePuzzleOpen.addEventListener("click", (event) => {
  event.stopPropagation();
  openEnginePuzzle();
}, { signal: listenerSignal });
enginePuzzleClose.addEventListener("click", (event) => {
  event.stopPropagation();
  closeEnginePuzzle();
}, { signal: listenerSignal });
enginePuzzle.addEventListener("click", (event) => {
  event.stopPropagation();
  if (event.target === enginePuzzle) closeEnginePuzzle();
}, { signal: listenerSignal });
locateButton.addEventListener("click", onLocateClick, { signal: listenerSignal });
panel.addEventListener("click", (event) => {
  event.stopPropagation();
}, { signal: listenerSignal });
shell.closeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  markUserInteraction();
  closeAnnotation();
}, { signal: listenerSignal });
window.addEventListener("resize", onResize, { signal: listenerSignal });
window.addEventListener("pointermove", onPointerMove, { signal: listenerSignal });
window.addEventListener("scroll", onJourneyInteraction, { passive: true, signal: listenerSignal });
window.addEventListener("wheel", onJourneyInteraction, { passive: true, signal: listenerSignal });
window.addEventListener("touchstart", onJourneyInteraction, { passive: true, signal: listenerSignal });
window.addEventListener("keydown", onJourneyInteraction, { signal: listenerSignal });
window.addEventListener("click", onClick, { signal: listenerSignal });
window.addEventListener("beforeunload", disposeExperience, { once: true, signal: listenerSignal });

startJourneyButton.disabled = false;
startJourneyButton.removeAttribute("aria-disabled");
startJourneyButton.focus();
const locateTimerId = window.setTimeout(() => locationController.locate(), 450);
animate();
