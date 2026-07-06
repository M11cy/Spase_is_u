import * as THREE from "three";
import "./styles.css";

const app = document.querySelector("#app");

app.innerHTML = `
  <main class="experience">
    <section class="map-layer" aria-label="Карта текущего местоположения">
      <iframe id="mapFrame" title="Карта местоположения"></iframe>
      <div class="map-vignette"></div>
    </section>
    <canvas id="cosmosCanvas"></canvas>
    <div id="spaceLabels" class="space-labels" aria-hidden="true"></div>
    <div class="reference-caption">Космос - это мы</div>
    <header class="topbar">
      <div>
        <span class="signal"></span>
        <span id="scaleLabel">Место</span>
      </div>
      <button id="locateButton" type="button">Мое место</button>
    </header>
    <section class="intro">
      <h1>Космос - это мы</h1>
      <p>Листайте вниз, чтобы отдалиться от дома до космической сети. Листайте вверх, чтобы вернуться обратно.</p>
    </section>
    <aside id="objectPanel" class="object-panel" aria-live="polite">
      <button id="closePanel" type="button" aria-label="Закрыть">×</button>
      <img id="panelImage" alt="" />
      <div>
        <p id="panelScale"></p>
        <h2 id="panelTitle"></h2>
        <p id="panelText"></p>
        <dl>
          <div><dt>Открытие</dt><dd id="panelDiscovery"></dd></div>
          <div><dt>Масштаб</dt><dd id="panelDistance"></dd></div>
        </dl>
      </div>
    </aside>
    <nav class="scale-rail" aria-label="Масштабы">
      <button data-stage="0" class="active">Дом</button>
      <button data-stage="1">Земля</button>
      <button data-stage="2">Система</button>
      <button data-stage="3">Гелиосфера</button>
      <button data-stage="4">Галактика</button>
      <button data-stage="5">Группа</button>
      <button data-stage="6">Вселенная</button>
      <button data-stage="7">?</button>
    </nav>
    <section id="unknownLayer" class="unknown-layer" aria-label="Неизвестный масштаб">
      <div>
        <strong>?</strong>
        <h2>Дальше ничего не понятно</h2>
        <p>Мы можем только предполагать, что находится за наблюдаемой Вселенной и где заканчивается масштаб, который способен понять человек.</p>
        <p>Может, вы будете тем, кто узнает это.</p>
      </div>
    </section>
    <aside class="distance-scale" aria-label="Шкала расстояния от Земли">
      <p>От Земли</p>
      <strong id="distanceValue">0 км</strong>
      <ol id="distanceMarkers"></ol>
    </aside>
    <div class="scroll-space" aria-hidden="true">
      <section></section><section></section><section></section>
      <section></section><section></section><section></section><section></section><section></section>
    </div>
  </main>
`;

const mapFrame = document.querySelector("#mapFrame");
const locateButton = document.querySelector("#locateButton");
const scaleLabel = document.querySelector("#scaleLabel");
const panel = document.querySelector("#objectPanel");
const closePanel = document.querySelector("#closePanel");
const panelImage = document.querySelector("#panelImage");
const panelScale = document.querySelector("#panelScale");
const panelTitle = document.querySelector("#panelTitle");
const panelText = document.querySelector("#panelText");
const panelDiscovery = document.querySelector("#panelDiscovery");
const panelDistance = document.querySelector("#panelDistance");
const railButtons = [...document.querySelectorAll(".scale-rail button")];
const spaceLabels = document.querySelector("#spaceLabels");
const unknownLayer = document.querySelector("#unknownLayer");
const distanceValue = document.querySelector("#distanceValue");
const distanceMarkers = document.querySelector("#distanceMarkers");
const stages = [
  { label: "Место", camera: 20, mapOpacity: 1, distance: "0 км" },
  { label: "Земля", camera: 42, mapOpacity: 0, distance: "6371 км" },
  { label: "Солнечная система", camera: 108, mapOpacity: 0, distance: "1 а.е." },
  { label: "Гелиосфера", camera: 190, mapOpacity: 0, distance: "120 а.е." },
  { label: "Млечный Путь", camera: 305, mapOpacity: 0, distance: "27 000 св. лет" },
  { label: "Локальная группа", camera: 405, mapOpacity: 0, distance: "2.5 млн св. лет" },
  { label: "Космическая сеть", camera: 540, mapOpacity: 0, distance: "сотни млн св. лет" },
  { label: "?", camera: 680, mapOpacity: 0, distance: "? световых лет" }
];

distanceMarkers.innerHTML = stages
  .map((stage, index) => `<li data-stage="${index}"><span></span><em>${stage.distance}</em></li>`)
  .join("");
const distanceMarkerItems = [...distanceMarkers.querySelectorAll("li")];

const objects = [
  {
    id: "earth",
    title: "Земля",
    stage: 1,
    text: "Земля - наш дом: океаны, атмосфера, жизнь и точка отсчета для всех космических масштабов.",
    discovery: "Известна человечеству с древности; как планета осмыслена в античности и Новое время.",
    distance: "1 а.е. от Солнца",
    image: "/space/earth-daymap.jpg",
    position: [0, 0, 0],
    radius: 3.35,
    color: 0x6fb7ff
  },
  {
    id: "mars",
    title: "Марс",
    stage: 2,
    text: "Красная планета с тонкой атмосферой, следами древней воды и роботами-исследователями на поверхности.",
    discovery: "Известен с древности; телескопические наблюдения развили Галилей и последующие астрономы.",
    distance: "1.52 а.е. от Солнца",
    image: "/space/mars.jpg",
    position: [24, 2, -7],
    radius: 0.55,
    color: 0xc96a4a
  },
  {
    id: "jupiter",
    title: "Юпитер",
    stage: 2,
    text: "Крупнейшая планета Солнечной системы. Его гравитация заметно формирует архитектуру окрестных орбит.",
    discovery: "Известен с древности; Галилей открыл четыре крупных спутника в 1610 году.",
    distance: "5.2 а.е. от Солнца",
    image: "/space/jupiter.jpg",
    position: [41, -1, 9],
    radius: 1.35,
    color: 0xd7a36f
  },
  {
    id: "neptune",
    title: "Нептун",
    stage: 2,
    text: "Планета, найденная математикой: ее положение вычислили по возмущениям орбиты Урана.",
    discovery: "Наблюдал Иоганн Галле в 1846 году по расчетам Урбена Леверье.",
    distance: "30 а.е. от Солнца",
    image: "/space/neptune.jpg",
    position: [62, 2, -15],
    radius: 0.95,
    color: 0x4f76ff
  },
  {
    id: "voyager",
    title: "Вояджер-1",
    stage: 3,
    text: "Самый дальний аппарат человечества. Он пересек гелиопаузу и продолжает передавать данные из межзвездной среды.",
    discovery: "Запущен NASA 5 сентября 1977 года.",
    distance: "За пределами гелиосферы",
    image: "/space/voyager-heliosphere.jpg",
    position: [94, 8, -22],
    radius: 0.65,
    color: 0xffffff
  },
  {
    id: "sagittarius",
    title: "Стрелец A*",
    stage: 4,
    text: "Сверхмассивная черная дыра в центре Млечного Пути. Вокруг нее движутся звезды центрального скопления.",
    discovery: "Радиоисточник выделили Брюс Балик и Роберт Браун в 1974 году.",
    distance: "Около 27 000 световых лет",
    image: "/space/sagittarius-a.jpg",
    position: [0, 0, -78],
    radius: 1.65,
    color: 0x101014
  },
  {
    id: "andromeda",
    title: "Андромеда",
    stage: 5,
    text: "Ближайшая крупная галактика к Млечному Пути. Через миллиарды лет две галактики сольются.",
    discovery: "Как внегалактический объект доказана Эдвином Хабблом в 1920-х.",
    distance: "Около 2.5 млн световых лет",
    image: "/space/andromeda.jpg",
    position: [-84, 14, -150],
    radius: 2.3,
    color: 0xcbd9ff
  },
  {
    id: "web",
    title: "Космическая сеть",
    stage: 6,
    text: "На самых больших масштабах галактики собираются в нити и узлы, между которыми лежат гигантские пустоты.",
    discovery: "Структура выявлена обзорами красных смещений галактик во второй половине XX века.",
    distance: "Сотни миллионов и миллиарды световых лет",
    image: "/space/cosmic-web.png",
    position: [0, -24, -260],
    radius: 3.2,
    color: 0xb9ccff
  }
];

const regionAnnotations = [
  {
    id: "heliosphere",
    title: "Гелиосфера",
    stage: 3,
    text: "Гелиосфера - огромный пузырь солнечного ветра вокруг Солнечной системы. На его границе начинается межзвездная среда.",
    discovery: "Границы подтверждены данными Voyager 1 и Voyager 2 в 2012 и 2018 годах.",
    distance: "Сотни астрономических единиц",
    image: "/space/voyager-heliosphere.jpg",
    position: [0, 0, -18]
  },
  {
    id: "milky-way",
    title: "Млечный Путь",
    stage: 4,
    text: "Наша галактика - спиральная система из звезд, газа, пыли и темной материи. Солнце находится далеко от центра, в одном из рукавов.",
    discovery: "Как звездная система осмыслена после работ Галилея, Гершеля и астрономии XX века.",
    distance: "Около 100 000 световых лет в диаметре",
    image: "/space/milky-way-realistic.jpg",
    position: [0, 0, -80]
  },
  {
    id: "local-group",
    title: "Локальная группа",
    stage: 5,
    text: "Локальная группа - соседство Млечного Пути, Андромеды, Треугольника и десятков карликовых галактик.",
    discovery: "Масштаб соседних галактик был уточнен Эдвином Хабблом в 1920-х.",
    distance: "Несколько миллионов световых лет",
    image: "/space/andromeda.jpg",
    position: [0, 8, -138]
  },
  {
    id: "cosmic-web-region",
    title: "Космическая сеть",
    stage: 6,
    text: "На самых больших масштабах материя собирается в узлы и нити. Между ними остаются огромные пустоты.",
    discovery: "Структура выявлена обзорами красных смещений галактик во второй половине XX века.",
    distance: "Сотни миллионов и миллиарды световых лет",
    image: "/space/cosmic-web.png",
    position: [0, 0, -260]
  },
  {
    id: "unknown-beyond",
    title: "?",
    stage: 7,
    text: "Дальше ничего не понятно. Мы видим только границу наблюдаемой Вселенной и можем строить гипотезы о том, что находится за ней.",
    discovery: "Пока неизвестно. Может, вы будете тем, кто узнает это.",
    distance: "? световых лет",
    position: [0, 0, -340]
  }
];

const galaxyAnnotations = [
  {
    id: "galactic-center",
    title: "Центр Галактики",
    stage: 4,
    text: "Плотная центральная область Млечного Пути. Здесь находится сверхмассивная черная дыра Стрелец A* и старые звездные скопления.",
    discovery: "Центр был уточнен по радио- и инфракрасным наблюдениям XX века.",
    distance: "Около 27 000 световых лет",
    image: "/space/sagittarius-a.jpg",
    position: [-6, 1, -82]
  },
  {
    id: "orion-arm",
    title: "Рукав Ориона",
    stage: 4,
    text: "Локальный спиральный рукав, в котором находится Солнце. Это наш район внутри диска Млечного Пути.",
    discovery: "Структура локального рукава уточнялась по картам звезд, газа и мазеров.",
    distance: "Солнце находится внутри этого рукава",
    position: [52, 8, -72]
  },
  {
    id: "perseus-arm",
    title: "Рукав Персея",
    stage: 4,
    text: "Один из крупных спиральных рукавов Млечного Пути, богатый газом, пылью и областями звездообразования.",
    discovery: "Выделен по радионаблюдениям нейтрального водорода и молодых звезд.",
    distance: "Тысячи световых лет от Солнца",
    position: [-92, -8, -92]
  },
  {
    id: "galactic-halo",
    title: "Гало",
    stage: 4,
    text: "Разреженная сферическая область вокруг диска: старые звезды, шаровые скопления и темная материя.",
    discovery: "Гало выявлено по распределению шаровых скоплений и движению звезд.",
    distance: "Сотни тысяч световых лет в поперечнике",
    position: [12, 78, -90]
  }
];

const groupGalaxyAnnotations = [
  {
    id: "group-milky-way",
    title: "Млечный Путь",
    stage: 5,
    text: "Наша спиральная галактика и один из двух главных центров массы Локальной группы.",
    discovery: "Как отдельная звездная система осмыслена в Новое время.",
    distance: "Нулевая точка отсчета",
    image: "/space/milky-way-realistic.jpg",
    position: [-92, 16, -128],
    size: 22,
    color: 0xdde8ff
  },
  {
    id: "group-andromeda",
    title: "Андромеда",
    stage: 5,
    text: "Ближайшая крупная спиральная галактика. Через несколько миллиардов лет сольется с Млечным Путем.",
    discovery: "Внегалактическая природа доказана Эдвином Хабблом в 1920-х.",
    distance: "Около 2.5 млн световых лет",
    image: "/space/andromeda.jpg",
    position: [118, 30, -134],
    size: 30,
    color: 0xffffff
  },
  {
    id: "group-triangulum",
    title: "Треугольник",
    stage: 5,
    text: "Галактика M33, третья крупная спиральная галактика Локальной группы.",
    discovery: "Известна как туманность, внегалактическая природа уточнена в XX веке.",
    distance: "Около 2.7 млн световых лет",
    position: [18, -62, -132],
    size: 20,
    color: 0xcddcff
  },
  {
    id: "group-lmc",
    title: "Большое Магелланово Облако",
    stage: 5,
    text: "Крупная спутниковая галактика Млечного Пути, хорошо видимая из Южного полушария.",
    discovery: "Описывалась мореплавателями Южного полушария; названа по экспедиции Магеллана.",
    distance: "Около 160 000 световых лет",
    position: [-155, -54, -130],
    size: 18,
    color: 0xb9ccff
  },
  {
    id: "group-smc",
    title: "Малое Магелланово Облако",
    stage: 5,
    text: "Меньшая спутниковая галактика Млечного Пути, связанная с Большим Магеллановым Облаком газовым мостом.",
    discovery: "Известна наблюдателям Южного полушария задолго до телескопов.",
    distance: "Около 200 000 световых лет",
    position: [-205, -16, -136],
    size: 14,
    color: 0xaec4ff
  },
  {
    id: "group-m32",
    title: "M32",
    stage: 5,
    text: "Компактная эллиптическая спутниковая галактика Андромеды.",
    discovery: "Каталогизирована Шарлем Мессье в XVIII веке.",
    distance: "Спутник Андромеды",
    position: [165, 58, -132],
    size: 12,
    color: 0xe7edff
  }
];

const markerIds = new Set(["earth", "mars", "jupiter", "neptune"]);

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("#cosmosCanvas"),
  antialias: true,
  alpha: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030711, 0.0026);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 7, stages[0].camera);

const group = new THREE.Group();
scene.add(group);

const ambient = new THREE.AmbientLight(0x9fb8ff, 0.9);
const sunLight = new THREE.PointLight(0xfff2c0, 5, 240);
sunLight.position.set(0, 0, 0);
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
const glowDiscTexture = createGlowDiscTexture();
const softGalaxyTexture = createSoftGalaxyTexture();
const earthCloudTexture = textureLoader.load("/space/earth-clouds.jpg");
const milkyWayTexture = textureLoader.load("/space/milky-way-realistic.jpg");
earthCloudTexture.colorSpace = THREE.SRGBColorSpace;
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
    depthTest: false,
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
    depthTest: false,
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

function createPlanetTexture(base, accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 512, 256);
  gradient.addColorStop(0, base);
  gradient.addColorStop(1, accent);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 44; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * 512, Math.random() * 256, 24 + Math.random() * 90, 2 + Math.random() * 12, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

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

function createSoftGalaxyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-0.18);
  ctx.globalCompositeOperation = "lighter";

  for (let arm = 0; arm < 3; arm += 1) {
    for (let i = 0; i < 2200; i += 1) {
      const t = i / 2200;
      const angle = t * Math.PI * 5.9 + arm * 2.08;
      const radius = 18 + t * 335;
      const width = 7 + t * 32;
      const x = Math.cos(angle) * radius + (Math.random() - 0.5) * width;
      const y = Math.sin(angle) * radius * 0.44 + (Math.random() - 0.5) * width * 0.48;
      const alpha = Math.max(0, 0.22 - t * 0.12) + Math.random() * 0.045;
      ctx.fillStyle = `rgba(205,224,255,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 1.2 + Math.random() * 2.8, 0.7 + Math.random() * 2.2, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const core = ctx.createRadialGradient(0, 0, 4, 0, 0, 120);
  core.addColorStop(0, "rgba(255,255,255,0.95)");
  core.addColorStop(0.28, "rgba(180,210,255,0.38)");
  core.addColorStop(1, "rgba(180,210,255,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(0, 0, 125, 52, 0, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addOrb(object) {
  const objectTexture = textureLoader.load(object.image);
  objectTexture.colorSpace = THREE.SRGBColorSpace;
  objectTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: objectTexture,
    roughness: 0.72,
    metalness: 0.02,
    emissive: object.id === "earth" ? 0x08142c : object.color,
    emissiveIntensity: object.id === "earth" ? 0.18 : 0.04
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(object.radius, 40, 28), material);
  sphere.position.set(...object.position);
  sphere.userData = object;

  if (object.id === "earth") {
    material.roughness = 0.54;
    material.metalness = 0;
    material.emissive = new THREE.Color(0x04112a);
    material.emissiveIntensity = 0.08;

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(object.radius * 1.012, 48, 32),
      new THREE.MeshBasicMaterial({
        map: earthCloudTexture,
        color: 0xddeaff,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    clouds.userData.rotationSpeed = 0.00045;
    clouds.userData.baseOpacity = 0.34;
    sphere.add(clouds);

    const atmosphere = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowDiscTexture,
        color: 0x79bfff,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
      })
    );
    atmosphere.scale.set(object.radius * 2.55, object.radius * 2.55, 1);
    atmosphere.userData.baseOpacity = 0.28;
    atmosphere.renderOrder = 2;
    sphere.add(atmosphere);
  }

  group.add(sphere);
  interactive.push(sphere);
  return { sphere, data: object };
}

const renderedObjects = objects
  .filter((object) => markerIds.has(object.id) && object.stage < 2)
  .map(addOrb);

const solarSystem = new THREE.Group();
solarSystem.rotation.set(-0.82, 0, 0.2);
group.add(solarSystem);

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(2.2, 40, 28),
  new THREE.MeshBasicMaterial({ color: 0xffe08a })
);
sun.position.set(10, 0, 0);
solarSystem.add(sun);

const sunGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: glowDiscTexture,
    color: 0xffe7a1,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
);
sunGlow.position.copy(sun.position);
sunGlow.scale.set(15, 15, 1);
solarSystem.add(sunGlow);

for (const radius of [11, 16, 24, 34, 45, 57, 70, 82]) {
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.025, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.34 })
  );
  orbit.rotation.x = Math.PI / 2;
  orbit.position.x = 10;
  solarSystem.add(orbit);
}

const solarPlanets = [
  {
    name: "Mercury",
    title: "Меркурий",
    radius: 11,
    size: 0.28,
    color: 0x9b9184,
    angle: 0.4,
    text: "Самая близкая к Солнцу планета: маленький каменный мир с резкими перепадами температуры.",
    discovery: "Известен с древности.",
    distance: "0.39 а.е. от Солнца"
  },
  {
    name: "Venus",
    title: "Венера",
    radius: 16,
    size: 0.44,
    color: 0xd8b26f,
    angle: 1.35,
    text: "Плотная атмосфера и парниковый эффект делают Венеру самой горячей планетой системы.",
    discovery: "Известна с древности.",
    distance: "0.72 а.е. от Солнца"
  },
  {
    name: "Earth",
    title: "Земля",
    radius: 24,
    size: 0.48,
    color: 0x5da8ff,
    angle: 2.25,
    image: "/space/earth-daymap.jpg",
    text: "Океаны, атмосфера и жизнь. Наша точка отсчета для всех космических масштабов.",
    discovery: "Наш дом.",
    distance: "1 а.е. от Солнца"
  },
  {
    name: "Mars",
    title: "Марс",
    radius: 34,
    size: 0.36,
    color: 0xc96a4a,
    angle: 3.2,
    image: "/space/mars.jpg",
    text: "Красная планета с тонкой атмосферой, полярными шапками и следами древней воды.",
    discovery: "Известен с древности.",
    distance: "1.52 а.е. от Солнца"
  },
  {
    name: "Jupiter",
    title: "Юпитер",
    radius: 45,
    size: 1.05,
    color: 0xd7a36f,
    angle: 4.05,
    image: "/space/jupiter.jpg",
    text: "Крупнейшая планета системы. Его гравитация заметно влияет на архитектуру внешних орбит.",
    discovery: "Известен с древности.",
    distance: "5.2 а.е. от Солнца"
  },
  {
    name: "Saturn",
    title: "Сатурн",
    radius: 57,
    size: 0.86,
    color: 0xd6bf8a,
    angle: 4.85,
    text: "Газовый гигант с самой узнаваемой системой колец из льда, пыли и каменных частиц.",
    discovery: "Известен с древности.",
    distance: "9.5 а.е. от Солнца"
  },
  {
    name: "Uranus",
    title: "Уран",
    radius: 70,
    size: 0.62,
    color: 0x8ad7dd,
    angle: 5.52,
    text: "Ледяной гигант, вращающийся почти на боку относительно плоскости орбиты.",
    discovery: "Открыт Уильямом Гершелем в 1781 году.",
    distance: "19.2 а.е. от Солнца"
  },
  {
    name: "Neptune",
    title: "Нептун",
    radius: 82,
    size: 0.6,
    color: 0x4f76ff,
    angle: 6.08,
    image: "/space/neptune.jpg",
    text: "Далекий ледяной гигант с быстрыми ветрами и темными атмосферными пятнами.",
    discovery: "Наблюдательно подтвержден Иоганном Галле в 1846 году.",
    distance: "30 а.е. от Солнца"
  }
];

const solarPlanetMeshes = solarPlanets.map((planet) => {
  const planetTexture = planet.image ? textureLoader.load(planet.image) : null;
  if (planetTexture) {
    planetTexture.colorSpace = THREE.SRGBColorSpace;
    planetTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(planet.size, 24, 16),
    new THREE.MeshStandardMaterial({
      color: planetTexture ? 0xffffff : planet.color,
      map: planetTexture,
      roughness: 0.58,
      emissive: planet.color,
      emissiveIntensity: planetTexture ? 0.025 : 0.08
    })
  );
  mesh.position.set(
    10 + Math.cos(planet.angle) * planet.radius,
    0,
    Math.sin(planet.angle) * planet.radius
  );
  planet.annotation = {
    id: `solar-${planet.name.toLowerCase()}`,
    title: planet.title,
    stage: 2,
    text: planet.text,
    discovery: planet.discovery,
    distance: planet.distance,
    image: planet.image,
    object3D: mesh
  };
  mesh.userData = planet.annotation;
  if (planet.name === "Earth") {
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(planet.size * 1.018, 24, 16),
      new THREE.MeshBasicMaterial({
        map: earthCloudTexture,
        color: 0xe4efff,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    clouds.userData.rotationSpeed = 0.0012;
    clouds.userData.baseOpacity = 0.28;
    mesh.add(clouds);
  }
  interactive.push(mesh);
  solarSystem.add(mesh);
  return mesh;
});

const solarAnnotations = solarPlanets.map((planet) => planet.annotation);

const heliosphere = new THREE.Mesh(
  new THREE.SphereGeometry(88, 64, 32),
  new THREE.MeshBasicMaterial({ color: 0x9ec5ff, wireframe: true, transparent: true, opacity: 0.11 })
);
heliosphere.scale.set(1.3, 0.82, 1);
group.add(heliosphere);

const voyagerAnnotation = {
  ...objects.find((object) => object.id === "voyager"),
  title: "Это Вояджер-1",
  position: [102, 12, -24]
};
const voyagerMarker = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: glowDiscTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  })
);
voyagerMarker.position.set(...voyagerAnnotation.position);
voyagerMarker.scale.set(8, 8, 1);
voyagerMarker.userData.baseOpacity = 0.96;
voyagerMarker.userData.annotation = voyagerAnnotation;
voyagerMarker.renderOrder = 8;
voyagerAnnotation.object3D = voyagerMarker;
group.add(voyagerMarker);
interactive.push(voyagerMarker);

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
galaxyAnnotations.forEach((annotation) => {
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
  marker.position.set(...annotation.position);
  marker.scale.set(12, 12, 1);
  marker.userData.baseOpacity = 0.76;
  marker.userData.annotation = annotation;
  marker.userData.stage = annotation.stage;
  annotation.object3D = marker;
  marker.renderOrder = 7;
  galaxyAnnotationMarkers.add(marker);
  interactive.push(marker);
});
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
groupGalaxyAnnotations.forEach((annotation) => {
  const material = new THREE.SpriteMaterial({
    map: glowDiscTexture,
    color: annotation.color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const dot = new THREE.Sprite(material);
  dot.position.set(...annotation.position);
  dot.scale.set(annotation.size, annotation.size, 1);
  dot.userData.baseOpacity = 0.9;
  dot.userData.annotation = annotation;
  dot.renderOrder = 6;
  annotation.object3D = dot;
  localGroup.add(dot);
  interactive.push(dot);
});
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

const cosmicWebTexture = textureLoader.load("/space/cosmic-web-bright.png");
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

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let activeStage = 0;
let hovered = null;
let activeObject = null;
let currentExactStage = 0;

function stagePresence(targetStage, exactStage, width = 0.58) {
  return Math.max(0, 1 - Math.abs(targetStage - exactStage) / width);
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function layerPresence(targetStage, exactStage) {
  const distance = Math.abs(targetStage - exactStage);
  if (distance <= 0.2) {
    return 1;
  }
  if (distance >= 0.34) {
    return 0;
  }
  return 1 - smootherStep((distance - 0.2) / 0.14);
}

function transitionPresence(exactStage) {
  const distanceFromLayer = Math.abs(exactStage - Math.round(exactStage));
  if (distanceFromLayer <= 0.26) {
    return 0;
  }
  return smootherStep((distanceFromLayer - 0.26) / 0.24);
}

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
  label.addEventListener("click", (event) => {
    event.stopPropagation();
    openPanel(data);
  });
  spaceLabels.append(label);
  return label;
}

const labelTargets = [
  ...objects.filter((object) => markerIds.has(object.id) && object.stage < 2),
  ...solarAnnotations,
  voyagerAnnotation,
  ...galaxyAnnotations,
  ...groupGalaxyAnnotations,
  ...regionAnnotations.filter((annotation) => ![4, 5, 7].includes(annotation.stage))
];
const labels = labelTargets.map((data) => ({ data, element: createLabel(data) }));

function updateLabels(exactStage) {
  labels.forEach(({ data, element }) => {
    const presence = layerPresence(data.stage, exactStage);
    element.classList.toggle("visible", presence > 0.08);
    if (presence <= 0.08) {
      element.style.opacity = "0";
      return;
    }

    element.style.opacity = String(Math.min(1, presence * 1.35));
    const point = screenPositionFor(data);
    const offsetX = data.object3D ? 10 : data.stage >= 4 ? 18 : 16;
    const offsetY = data.object3D ? -12 : data.stage >= 4 ? -10 : -22;
    element.style.transform = `translate3d(${point.x + offsetX}px, ${point.y + offsetY}px, 0)`;
  });
}

function closeAnnotation() {
  activeObject = null;
  panel.classList.remove("open");
}

function setMapLocation(lat = 55.7558, lon = 37.6173) {
  const delta = 0.006;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
}

function locate() {
  if (!navigator.geolocation) {
    setMapLocation();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => setMapLocation(position.coords.latitude, position.coords.longitude),
    () => setMapLocation(),
    { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
  );
}

function updateStage() {
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  const exactStage = progress * (stages.length - 1);
  currentExactStage = exactStage;
  activeStage = Math.min(stages.length - 1, Math.max(0, Math.round(exactStage)));
  const layerOpacities = stages.map((_, index) => layerPresence(index, exactStage));
  const transitionAmount = transitionPresence(exactStage);
  const lower = Math.floor(exactStage);
  const upper = Math.min(stages.length - 1, lower + 1);
  const mix = smootherStep(exactStage - lower);
  const cameraZ = THREE.MathUtils.lerp(stages[lower].camera, stages[upper].camera, mix);

  camera.position.z += (cameraZ - camera.position.z) * 0.055;
  camera.position.y += (7 + exactStage * 3.2 - camera.position.y) * 0.055;
  camera.lookAt(0, 0, -80);

  scaleLabel.textContent = stages[activeStage].label;
  distanceValue.textContent = stages[activeStage].distance;
  document.querySelector(".map-layer").style.opacity = String(layerOpacities[0] * stages[0].mapOpacity);
  document.body.dataset.stage = String(activeStage);

  const bokehOpacity = transitionAmount * 0.8 + layerOpacities[6] * 1.2 + layerOpacities[7] * 0.85;
  bokehField.visible = bokehOpacity > 0.03;
  bokehField.children.forEach((sprite) => {
    sprite.material.opacity = sprite.userData.baseOpacity * bokehOpacity;
  });

  railButtons.forEach((button, index) => {
    button.classList.toggle("active", index === activeStage);
  });
  distanceMarkerItems.forEach((item, index) => {
    item.classList.toggle("active", index === activeStage);
  });

  hyperdriveLines.visible = transitionAmount > 0.02;
  hyperdriveLines.material.opacity = transitionAmount * 0.95;
  hyperdriveLines.position.copy(camera.position);
  hyperdriveLines.position.z -= 6;
  hyperdriveLines.rotation.z = exactStage * 0.08;
  hyperdriveLines.scale.setScalar(1 + transitionAmount * 0.42);

  const unknownOpacity = layerOpacities[7];
  unknownLayer.style.opacity = String(unknownOpacity);
  unknownLayer.style.transform = `translateY(${(1 - unknownOpacity) * 18}px)`;

  const midStarOpacity = Math.max(
    layerOpacities[2] * 0.72,
    layerOpacities[3] * 0.8,
    layerOpacities[4] * 0.56,
    layerOpacities[7] * 0.9,
    transitionAmount * 0.9
  );
  midSpaceStars.visible = midStarOpacity > 0.03;
  midSpaceStars.material.opacity = Math.min(0.9, midStarOpacity * 0.78);

  const nearStarOpacity = Math.max(
    layerOpacities[1] * 0.78,
    layerOpacities[2] * 0.86,
    layerOpacities[3] * 0.76,
    transitionAmount * 0.35
  );
  nearSpaceStars.visible = nearStarOpacity > 0.03;
  nearSpaceStars.material.opacity = Math.min(0.95, nearStarOpacity);

  renderedObjects.forEach(({ sphere, data }) => {
    const visibleDistance = layerOpacities[data.stage];
    sphere.material.opacity = visibleDistance;
    sphere.material.transparent = true;
    sphere.visible = visibleDistance > 0.03;
    sphere.scale.setScalar(data === hovered ? 1.08 : 1);
    sphere.children.forEach((child) => {
      child.visible = sphere.visible;
      if (child.material && child.userData.baseOpacity != null) {
        child.material.opacity = child.userData.baseOpacity * visibleDistance;
      }
      if (child.userData.rotationSpeed) {
        child.rotation.y += child.userData.rotationSpeed;
      }
    });
  });
  updateLabels(exactStage);

  const solarOpacity = layerOpacities[2];
  solarSystem.visible = solarOpacity > 0.03;
  sun.visible = solarSystem.visible;
  sunGlow.visible = solarSystem.visible;
  sunGlow.material.opacity = 0.9 * solarOpacity;
  solarPlanetMeshes.forEach((mesh) => {
    mesh.visible = solarSystem.visible;
    mesh.material.opacity = solarOpacity;
    mesh.material.transparent = true;
    mesh.children.forEach((child) => {
      child.visible = solarSystem.visible;
      if (child.material && child.userData.baseOpacity != null) {
        child.material.opacity = child.userData.baseOpacity * solarOpacity;
      }
      if (child.userData.rotationSpeed) {
        child.rotation.y += child.userData.rotationSpeed;
      }
    });
  });
  const heliosphereOpacity = layerOpacities[3];
  heliosphere.visible = heliosphereOpacity > 0.03;
  heliosphere.material.opacity = 0.15 * heliosphereOpacity;
  voyagerMarker.visible = heliosphereOpacity > 0.03;
  voyagerMarker.material.opacity = voyagerMarker.userData.baseOpacity * heliosphereOpacity;
  const galaxyOpacity = layerOpacities[4];
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
  const localGroupOpacity = layerOpacities[5];
  localGroup.visible = localGroupOpacity > 0.03;
  localGroup.children.forEach((dot) => {
    dot.material.opacity = dot.userData.baseOpacity * localGroupOpacity;
    dot.visible = localGroup.visible;
  });
  const cosmicWebOpacity = layerOpacities[6];
  cosmicWebPoints.visible = cosmicWebOpacity > 0.03;
  cosmicWebPoints.material.opacity = cosmicWebOpacity * 1.35;
  cosmicWebPlane.visible = cosmicWebOpacity > 0.03;
  cosmicWebPlane.material.opacity = cosmicWebOpacity;
  cosmicDepthStars.visible = cosmicWebOpacity > 0.03;
  cosmicDepthStars.material.opacity = cosmicWebOpacity * 1.15;

  if (activeObject && layerPresence(activeObject.stage, exactStage) <= 0) {
    closeAnnotation();
  }

}

function openPanel(data) {
  activeObject = data;
  panel.classList.add("open");
  panel.classList.toggle("no-image", !data.image);
  panelImage.hidden = !data.image;
  if (data.image) {
    panelImage.src = data.image;
    panelImage.alt = data.title;
  } else {
    panelImage.removeAttribute("src");
    panelImage.alt = "";
  }
  panelScale.textContent = stages[data.stage].label;
  panelTitle.textContent = data.title;
  panelText.textContent = data.text;
  panelDiscovery.textContent = data.discovery;
  panelDistance.textContent = data.distance;
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster
    .intersectObjects(interactive, false)
    .find((intersection) => {
      const data = intersection.object.userData.annotation ?? intersection.object.userData;
      return intersection.object.visible && data?.stage != null && layerPresence(data.stage, currentExactStage) > 0.08;
    });
  hovered = hit?.object.userData ?? null;
  hovered = hovered?.annotation ?? hovered;
  document.body.classList.toggle("is-pointing", Boolean(hovered));
}

function onClick() {
  if (hovered) {
    openPanel(hovered);
    return;
  }

  const stageObject =
    regionAnnotations.find((object) => object.stage === activeStage) ??
    objects.find((object) => markerIds.has(object.id) && object.stage < 2 && object.stage === activeStage);
  if (stageObject && activeStage > 0) {
    openPanel(stageObject);
  }
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function animate() {
  updateStage();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

railButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const stage = Number(button.dataset.stage);
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    window.scrollTo({ top: maxScroll * (stage / (stages.length - 1)), behavior: "smooth" });
  });
});

locateButton.addEventListener("click", (event) => {
  event.stopPropagation();
  locate();
});
panel.addEventListener("click", (event) => {
  event.stopPropagation();
});
closePanel.addEventListener("click", (event) => {
  event.stopPropagation();
  closeAnnotation();
});
window.addEventListener("resize", onResize);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("click", onClick);

setTimeout(locate, 450);
animate();
