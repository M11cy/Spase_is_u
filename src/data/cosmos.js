const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

export const STAGES = deepFreeze([
  { id: "place", label: "Место", distance: "0 км", camera: { position: [0, 7, 20], target: [0, 0, -80], fov: 52 }, motion: "static" },
  { id: "earth", label: "Земля", distance: "6371 км", camera: { position: [0, 3.5, 29], target: [4.5, -3.5, 0], fov: 46 }, motion: "static" },
  { id: "solar-system", label: "Солнечная система", distance: "1 а.е.", camera: { position: [0, 12, 108], target: [8, 0, 0], fov: 48 }, motion: "transition-only" },
  { id: "milky-way", label: "Млечный Путь", distance: "27 000 св. лет", camera: { position: [0, 20, 213], target: [0, 0, -80], fov: 50 }, motion: "static" },
  { id: "local-group", label: "Локальная группа", distance: "2.5 млн св. лет", camera: { position: [0, 23, 405], target: [0, 0, -138], fov: 50 }, motion: "static" },
  { id: "cosmic-web", label: "Космическая сеть", distance: "сотни млн св. лет", camera: { position: [0, 26, 540], target: [0, 0, -235], fov: 52 }, motion: "static" },
  { id: "unknown", label: "?", distance: "? световых лет", camera: { position: [0, 29, 680], target: [0, 0, -340], fov: 52 }, motion: "static" }
]);

export const STAGE_INDEX = Object.freeze(Object.fromEntries(STAGES.map(({ id }, index) => [id, index])));

export const COLOR_ROLES = deepFreeze({
  cyan: 0x6fc7ff, solar: 0xffc46b, mars: 0xcf684d, deep: 0x9b8cff, white: 0xf4f8ff
});

const objects = [
  {
    id: "earth",
    title: "Земля",
    stage: STAGE_INDEX["earth"],
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
    stage: STAGE_INDEX["solar-system"],
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
    stage: STAGE_INDEX["solar-system"],
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
    stage: STAGE_INDEX["solar-system"],
    text: "Планета, найденная математикой: ее положение вычислили по возмущениям орбиты Урана.",
    discovery: "Наблюдал Иоганн Галле в 1846 году по расчетам Урбена Леверье.",
    distance: "30 а.е. от Солнца",
    image: "/space/neptune.jpg",
    position: [62, 2, -15],
    radius: 0.95,
    color: 0x4f76ff
  },
  {
    id: "sagittarius",
    title: "Стрелец A*",
    stage: STAGE_INDEX["milky-way"],
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
    stage: STAGE_INDEX["local-group"],
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
    stage: STAGE_INDEX["cosmic-web"],
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
    id: "milky-way",
    title: "Млечный Путь",
    stage: STAGE_INDEX["milky-way"],
    text: "Наша галактика - спиральная система из звезд, газа, пыли и темной материи. Солнце находится далеко от центра, в одном из рукавов.",
    discovery: "Как звездная система осмыслена после работ Галилея, Гершеля и астрономии XX века.",
    distance: "Около 100 000 световых лет в диаметре",
    image: "/space/milky-way-realistic.jpg",
    position: [0, 0, -80]
  },
  {
    id: "local-group",
    title: "Локальная группа",
    stage: STAGE_INDEX["local-group"],
    text: "Локальная группа - соседство Млечного Пути, Андромеды, Треугольника и десятков карликовых галактик.",
    discovery: "Масштаб соседних галактик был уточнен Эдвином Хабблом в 1920-х.",
    distance: "Несколько миллионов световых лет",
    image: "/space/andromeda.jpg",
    position: [0, 8, -138]
  },
  {
    id: "cosmic-web-region",
    title: "Космическая сеть",
    stage: STAGE_INDEX["cosmic-web"],
    text: "На самых больших масштабах материя собирается в узлы и нити. Между ними остаются огромные пустоты.",
    discovery: "Структура выявлена обзорами красных смещений галактик во второй половине XX века.",
    distance: "Сотни миллионов и миллиарды световых лет",
    image: "/space/cosmic-web.png",
    position: [0, 0, -260]
  },
  {
    id: "unknown-beyond",
    title: "?",
    stage: STAGE_INDEX.unknown,
    text: "Дальше ничего не понятно. Мы видим только границу наблюдаемой Вселенной и можем строить гипотезы о том, что находится за ней.",
    discovery: "Пока неизвестно. Может, вы будете тем, кто узнает это.",
    distance: "? световых лет",
    position: [0, 0, -340]
  }
];

export const OBJECTS = deepFreeze([...objects, ...regionAnnotations]);

const galaxy = [
  {
    id: "galactic-center",
    title: "Центр Галактики",
    stage: STAGE_INDEX["milky-way"],
    text: "Плотная центральная область Млечного Пути. Здесь находится сверхмассивная черная дыра Стрелец A* и старые звездные скопления.",
    discovery: "Центр был уточнен по радио- и инфракрасным наблюдениям XX века.",
    distance: "Около 27 000 световых лет",
    image: "/space/sagittarius-a.jpg",
    position: [-6, 1, -82]
  },
  {
    id: "orion-arm",
    title: "Рукав Ориона",
    stage: STAGE_INDEX["milky-way"],
    text: "Локальный спиральный рукав, в котором находится Солнце. Это наш район внутри диска Млечного Пути.",
    discovery: "Структура локального рукава уточнялась по картам звезд, газа и мазеров.",
    distance: "Солнце находится внутри этого рукава",
    position: [52, 8, -72]
  },
  {
    id: "perseus-arm",
    title: "Рукав Персея",
    stage: STAGE_INDEX["milky-way"],
    text: "Один из крупных спиральных рукавов Млечного Пути, богатый газом, пылью и областями звездообразования.",
    discovery: "Выделен по радионаблюдениям нейтрального водорода и молодых звезд.",
    distance: "Тысячи световых лет от Солнца",
    position: [-92, -8, -92]
  },
  {
    id: "galactic-halo",
    title: "Гало",
    stage: STAGE_INDEX["milky-way"],
    text: "Разреженная сферическая область вокруг диска: старые звезды, шаровые скопления и темная материя.",
    discovery: "Гало выявлено по распределению шаровых скоплений и движению звезд.",
    distance: "Сотни тысяч световых лет в поперечнике",
    position: [12, 78, -90]
  }
];

const localGroup = [
  {
    id: "group-milky-way",
    title: "Млечный Путь",
    stage: STAGE_INDEX["local-group"],
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
    stage: STAGE_INDEX["local-group"],
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
    stage: STAGE_INDEX["local-group"],
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
    stage: STAGE_INDEX["local-group"],
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
    stage: STAGE_INDEX["local-group"],
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
    stage: STAGE_INDEX["local-group"],
    text: "Компактная эллиптическая спутниковая галактика Андромеды.",
    discovery: "Каталогизирована Шарлем Мессье в XVIII веке.",
    distance: "Спутник Андромеды",
    position: [165, 58, -132],
    size: 12,
    color: 0xe7edff
  }
];

export const ANNOTATIONS = deepFreeze({ galaxy, localGroup });

export const SOLAR_PLANETS = deepFreeze([
  {
    name: "Mercury",
    title: "Меркурий",
    radius: 11,
    size: 0.28,
    color: 0x9b9184,
    angle: 0.4,
    text: "Самая близкая к Солнцу планета: маленький каменный мир с резкими перепадами температуры.",
    discovery: "Известен с древности.",
    distance: "0.39 а.е. от Солнца",
    quiz: {
      question: "Чем знаменит Меркурий?",
      options: ["Самый большой газовый гигант", "Ближайшая к Солнцу планета", "Планета с яркими кольцами"],
      answer: 1
    }
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
    distance: "0.72 а.е. от Солнца",
    quiz: {
      question: "Почему Венера — самая горячая планета?",
      options: ["Плотная атмосфера удерживает тепло", "Она ближе всех к Солнцу", "Её поверхность — жидкая лава"],
      answer: 0
    }
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
    distance: "1 а.е. от Солнца",
    quiz: {
      question: "Что делает Землю особенной?",
      options: ["Кольца из льда и пыли", "Жизнь и жидкая вода", "Вечные бури из метана"],
      answer: 1
    }
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
    distance: "1.52 а.е. от Солнца",
    quiz: {
      question: "Почему Марс называют красной планетой?",
      options: ["Из-за ржавчины (оксида железа) в грунте", "Из-за раскалённой лавы", "Из-за красных облаков"],
      answer: 0
    }
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
    distance: "5.2 а.е. от Солнца",
    quiz: {
      question: "Какой Юпитер по размеру?",
      options: ["Самый маленький", "Средний", "Самая большая планета системы"],
      answer: 2
    }
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
    distance: "9.5 а.е. от Солнца",
    quiz: {
      question: "Чем знаменит Сатурн?",
      options: ["Океанами воды", "Яркой системой колец", "Тем, что ближе всех к Солнцу"],
      answer: 1
    }
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
    distance: "19.2 а.е. от Солнца",
    quiz: {
      question: "Чем необычен Уран?",
      options: ["Вращается почти лёжа на боку", "Самый горячий из планет", "Самый близкий к Солнцу"],
      answer: 0
    }
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
    distance: "30 а.е. от Солнца",
    quiz: {
      question: "Как был открыт Нептун?",
      options: ["Его случайно заметили рядом", "Сначала вычислили на бумаге, потом нашли", "Он известен с древних времён"],
      answer: 1
    }
  }
]);
