---
title: Космос - это мы
date: 2026-07-05
tags:
  - development
  - frontend
  - cosmos
status: in-progress
---

# Космос - это мы

> [!note]
> Разработка ведется как интерактивное сайт-приложение: первый экран показывает карту текущего местоположения, затем пользователь отдаляется скроллом от дома до крупномасштабной структуры Вселенной.

## Решения

- Использовать Vite и Three.js для 3D-сцены с управлением масштабом через скролл.
- Начальный уровень: геолокация браузера и карта OpenStreetMap. Если пользователь не даст доступ, показывается запасная точка.
- Интерактивные объекты отмечаются белыми кольцами. Клик открывает аннотацию с линией, кратким текстом, годом/автором открытия и изображением.
- Сцена делится на 7 уровней: дом/город, Земля, Солнечная система, гелиосфера, Млечный Путь, локальная группа, космическая сеть.

## Обновление 2026-07-05

- Картинки аннотаций перенесены в локальную папку `public/space`, чтобы они не ломались из-за внешнего hotlink/thumbnail-поведения.
- Основные изображения взяты из NASA Image and Video Library / NASA Image API; для космической сети добавлена локальная SVG-визуализация, потому что поиск NASA по `cosmic web` вернул нерелевантные фотографии мероприятий.
- Аннотация теперь позиционируется от экранной проекции выбранного объекта. Белая точка и линия отходят от объекта к панели.
- Окна видимости дальних уровней сужены: гелиосфера, галактика/локальная группа и космическая сеть больше не должны висеть одновременно друг на друге.

## Обновление 2026-07-05 13:05

- Добавлен отдельный уровень `Карта мира` между локальной картой и Землей.
- Планеты и космические объекты переведены с 3D-сфер на плоские image-billboards в 3D-пространстве: масштаб и позиция остаются пространственными, но визуально используются реальные изображения.
- Финальная космическая сеть заменена на изображение пользователя `public/space/cosmic-web.png`.
- Аннотация фиксируется после открытия, чтобы текст можно было прочитать без движения панели.
- Кнопка закрытия исправлена: клик больше не всплывает до обработчика сцены и не открывает панель заново.

## Обновление 2026-07-05 13:15

- Удален отдельный уровень карты мира. После локальной карты идет плавный переход сразу к Земле.
- Объекты возвращены к 3D-сферам/точкам, но с сильно уменьшенным масштабом.
- Земля сделана 3D-сферой с реальной текстурой Blue Marble из локального ассета `public/space/earth.jpg`.
- Солнечная система уменьшена: планеты выглядят как маленькие точки разного цвета и размера, орбиты и Солнце тоже уменьшены.
- Белые кликабельные кольца заменены на billboard-спрайты: они всегда смотрят на зрителя и не вращаются вместе со сценой.

## Обновление 2026-07-05 13:25

- Полностью убрано автокручение сцены, звезд и галактики. Остался только статический наклон формы галактики.
- Слои скролла растянуты: каждый масштаб занимает больше вертикального пути.
- Солнечная система вынесена в наклонную плоскость с маленькими точками всех планет и уменьшенными орбитами.
- Гелиосфера, Млечный Путь и космическая сеть открываются как аннотации масштаба без отдельного кликабельного кружка вокруг объекта.
- Андромеда/локальная группа сделана точечным облаком, а не сферой.
- Космическая сеть заменена на большое поле точек на весь экран; палочки и сфера убраны.

## Проверка

- [x] Установить зависимости
- [x] Запустить dev-сервер
- [x] Проверить сборку
- [x] Проверить первый экран и скролл в браузере
- [x] Перенести изображения в локальные ассеты
- [x] Проверить обновленные аннотации в браузере
- [x] Проверить уровень карты мира
- [x] Проверить закрепление панели и кнопку закрытия
- [x] Проверить изображение космической сети пользователя
- [x] Проверить откат к 3D-сферам и удаление карты мира
- [x] Проверить отсутствие автокручения
- [x] Проверить длинные слои скролла
- [x] Проверить аннотации гелиосферы, галактики и космической сети

## Обновление 2026-07-05 13:40

- В качестве основного референса использован архив кадров `1-v10044g50000cemh7bjc77u18j0jnga0_frames.zip`.
- Композиция приведена ближе к ролику: черный фон, верхний крупный текст и центральная видеополоса с затемненными полями сверху и снизу.
- Добавлен статичный слой светящихся bokeh-дисков для ощущения дальнего зума через большое количество объектов.
- Солнечная система усилена мягким свечением Солнца и более читаемыми белыми орбитами в наклоненной плоскости.
- Млечный Путь и Андромеда получили мягкие спиральные glow-слои поверх точечных облаков, чтобы галактики выглядели ближе к референсу.
- Космическая сеть теперь показывается как широкая текстурная плоскость с дополнительной слабой глубиной из точек, без сферы и без палочек.

## Обновление 2026-07-05 14:05

- Удалены белые кольца-маркеры вокруг кликабельных объектов: они выглядели как лишние рамки и спорили с референсом.
- Добавлен экранный слой `spaceLabels`: подписи объектов теперь стоят прямо в кадре рядом с планетами и крупными масштабами.
- Информационная карточка превращена в нижнюю подпись без стеклянного фона, бордера, соединительной линии и точки-якоря.
- Верхняя строка и нижняя навигация очищены от плашек: остались только тонкие текстовые элементы поверх черного кадра.
- Марс, Юпитер, Нептун и Земля используют локальные изображения как текстуры в 3D-сцене, а детальная подпись показывает крупную нормальную картинку из `public/space`.
- Проверено через Chrome/Playwright: стартовый кадр, Солнечная система, космическая сеть и открытие подписи Марса отображаются без рамок и сетевых ошибок.

## Обновление 2026-07-05 14:25

- Удалены фиксированные черные псевдо-поля `experience::before/after`: viewport больше не ограничивается рамками.
- Заголовок `Космос - это мы` теперь показывается только на стадии `Место` поверх карты; на космических стадиях он скрывается через `body:not([data-stage="0"])`.
- Млечный Путь очищен от лишнего наложения: точечный слой стал реже и слабее, а спиральный glow-слой усилен.
- Локальная группа перенесена ближе к центру кадра, увеличена и усилена через additive-точки без depth-test.
- Космическая сеть стала ярче: плоскость перенесена ближе, точек больше, они крупнее и рисуются поверх темной текстуры.
- Проверено в Chrome/Playwright: стадии 4, 5 и 6 занимают весь canvas 1440x900, большой заголовок скрыт, сетевых ошибок нет.

## Обновление 2026-07-05 14:40

- Млечный Путь увеличен: `milkyWayGlow` масштабирован до `190 x 124`, чтобы галактика занимала больше центрального кадра.
- Локальная группа переделана с нуля: удалены спиральная галактика и `andromedaGlow`, вместо них используется отдельный `localGroup` из крупных мягких sprite-точек.
- Точки Локальной группы рисуются через `glowDiscTexture` с additive blending, без depth-test, чтобы выглядеть как большие светящиеся пятна, а не квадратные пиксели.
- Проверено через Chrome/Playwright: стадии `Млечный Путь` и `Локальная группа` отображаются без ошибок и сетевых 404.

## Обновление 2026-07-05 14:50

- Стадия `Галактика` сделана экранной: `milkyWayGlow` увеличен до `360 x 230`, чтобы Млечный Путь занимал большую часть viewport.
- Стадия `Группа` растянута по экрану: количество точек Локальной группы увеличено, радиус распределения расширен до ширины кадра, крупные центральные точки усилены.
- Стадия `Космическая сеть` также расширена: поле точек распределяется шире, а текстурная плоскость увеличена до `2300 x 1300`.
- Проверено в Chrome/Playwright: стадии 4, 5 и 6 занимают canvas `1440 x 900`, заголовок скрыт, ошибок и 404 нет.

## Обновление 2026-07-05 15:00

- Уточнено требование "на весь экран": дальние слои должны уходить за края viewport, а не просто быть крупными в центре.
- `Галактика`: `milkyWayGlow` увеличен до `650 x 420`, теперь Млечный Путь обрезается краями кадра.
- `Группа`: радиус Локальной группы расширен за пределы viewport, количество точек увеличено до 260 основных и 58 крупных центральных.
- `Космическая сеть`: текстурная плоскость увеличена до `4200 x 2400`, поле точек расширено до `1320 x 760` с 9800 точками.
- Проверено скриншотами Chrome/Playwright: стадии 4, 5 и 6 визуально заполняют кадр до краев и дальше.

## Обновление 2026-07-05 15:15

- Квадратность фоновых точек убрана: `stars` и `cosmicWebPoints` теперь используют круглую `glowDiscTexture` через `PointsMaterial.map`.
- Для стадии `Солнечная система` добавлены отдельные подписи и аннотации всех 8 планет: Меркурий, Венера, Земля, Марс, Юпитер, Сатурн, Уран, Нептун.
- Клик по планетной подписи или mesh открывает нижнюю аннотацию; для планет без локального изображения панель переходит в режим `no-image`.
- Убраны дубли подписей Марса, Юпитера и Нептуна: старые stage-2 объектные labels больше не добавляются в общий слой.
- Проверено в Chrome/Playwright: на стадии `Солнечная система` видно ровно 8 уникальных подписей, клик по Меркурию открывает аннотацию, ошибок и 404 нет.

## Обновление 2026-07-05 15:35

- Убраны лишние старые сферы в Солнечной системе: `renderedObjects` теперь оставляет только объекты до стадии 2, а стадия `Солнечная система` использует только планеты орбитальной модели.
- Стадия `Галактика` заменена на более реалистичную процедурную текстуру с рукавами, пылевыми полосами и ядром; старые mesh-сферы галактики заменены на мягкие круглые point-sprites.
- Добавлены кликабельные аннотации Млечного Пути: `Центр Галактики`, `Рукав Ориона`, `Рукав Персея`, `Гало`.
- В `Группе` добавлены подписи и кликабельные аннотации известных галактик: `Млечный Путь`, `Андромеда`, `Треугольник`, `Большое Магелланово Облако`, `Малое Магелланово Облако`, `M32`.
- Raycast теперь фильтрует скрытые стадии, чтобы невидимые объекты не ловили клики.
- Проверено в Chrome/Playwright: на стадии 2 видно 8 планет; на стадии 4 видно 4 галактические аннотации; на стадии 5 видно 6 галактик группы; клики по `Рукав Ориона` и `Треугольник` открывают аннотации.

## Обновление 2026-07-05 15:50

- Изображение Млечного Пути заменено на локальный ассет `public/space/milky-way-realistic.jpg` на основе NASA/JPL `PIA10748`.
- Стадия `Галактика` теперь использует этот ассет как полноэкранный `milkyWayGlow`, без старой процедурной картинки.
- Аннотация `Млечный Путь` в стадии `Галактика` и карточка `Млечный Путь` в `Локальной группе` показывают ту же нормальную картинку вместо старого изображения `sagittarius-a.jpg`.
- Проверено в Chrome/Playwright: панель `Млечный Путь` открывает `/space/milky-way-realistic.jpg`, canvas остается `1440 x 900`, JS-ошибок и 404 нет.

## Обновление 2026-07-05 16:10

- Текстура Земли заменена на equirectangular `public/space/earth-daymap.jpg`, добавлен отдельный облачный слой `public/space/earth-clouds.jpg` и мягкая атмосферная подсветка.
- Маленькая Земля в `Солнечной системе` использует ту же карту поверхности и отдельные облака, чтобы не отличаться от крупной Земли на предыдущем этапе.
- Для этапов 2-4 добавлен отдельный слой `midSpaceStars`: звезды видны на `Солнечной системе`, `Гелиосфере` и `Галактике`, без квадратных точек.
- Визуальное удаление между этапами стало длиннее: scroll-секции увеличены до `300vh`, общий путь страницы до `2100vh`, камера интерполируется через `smootherStep`, а fade-окна дальних объектов расширены.
- Исправлено просвечивание скрытых подписей: неактивные labels теперь принудительно получают `opacity: 0`, поэтому на этапе `Земля` не появляются подписи планет из соседнего этапа.
- Проверено в Chrome/Playwright: новые ассеты Земли отдаются с `200`, на этапе `Земля` видна только подпись `Земля`, на этапе `Солнечная система` видны все 8 планет, canvas остается `1440 x 900`, JS-ошибок и 404 нет.

## Обновление 2026-07-06 00:20

- Переходы между масштабами переведены на дискретные слои: `layerPresence` показывает только текущий слой около его позиции скролла, а в промежутке слои выключены.
- Между слоями добавлен отдельный `hyperdriveLines` слой со световыми линиями в стиле гиперпрыжка, чтобы длинный скролл ощущался как перелет, а не как наложение объектов.
- Карта больше не видна одновременно с Землей, а `Гелиосфера` больше не видна одновременно с `Млечным Путем`; в середине перехода остаются только звезды и hyperdrive-эффект.
- В гелиосферу добавлен кликабельный маркер и подпись `Это Вояджер-1`.
- Справа добавлена вертикальная шкала расстояния от Земли с текущим значением масштаба и отметками всех этапов.
- `Космическая сеть` переведена на яркий ассет `public/space/cosmic-web-bright.png`, для материала сети отключен fog/tone mapping, добавлены цветные 3D-точки глубины.
- Проверено в Chrome/Playwright: переходы `Место -> Земля` и `Гелиосфера -> Млечный Путь` не показывают подписи/объекты соседних слоев, `Вояджер-1` виден на гелиосфере, яркая сеть отдается с `200`, JS-ошибок и 404 нет.

## Обновление 2026-07-06 00:35

- Добавлен последний этап `?` после `Космической сети`.
- Для этапа `?` добавлен отдельный полноэкранный слой `unknownLayer` с текстом `Дальше ничего не понятно` и строкой `Может, вы будете тем, кто узнает это`.
- Шкала расстояния получила последнее значение `? световых лет`.
- Добавлена fallback-аннотация `unknown-beyond`, чтобы клик по финальному экрану открывал панель с текстом о неизвестности за наблюдаемой Вселенной.
- Проверено в Chrome/Playwright: последний этап активируется как `?`, виден финальный текст, шкала показывает `? световых лет`, клик открывает аннотацию, JS-ошибок и 404 нет.

## Обновление 2026-07-06 00:45

- Для этапов `Земля`, `Солнечная система` и `Гелиосфера` добавлен отдельный слой `nearSpaceStars` из ближних цветных point-sprites.
- `nearSpaceStars` включается через `layerOpacities[1]`, `layerOpacities[2]` и `layerOpacities[3]`, поэтому не смешивает соседние сцены, но убирает черный пустой фон.
- Проверено в Chrome/Playwright: на этапах 1-3 виден плотный звездный фон, подписи этапов остаются корректными, JS-ошибок и 404 нет.

## Обновление 2026-07-19 — защищённый deep-space маршрут

Связанные документы: [[2026-07-19-deep-space-progression-design]] и [[2026-07-19-deep-space-progression]].

> [!success] Маршрут завершён
> Удалён устаревший этап `Гелиосфера`. Путешествие теперь состоит ровно из семи этапов: место → Земля → Солнечная система → Млечный Путь → Локальная группа → Космическая сеть → неизвестность.

### Три игровых барьера

- Переход от Земли открывается только после реальной победы в ловле ракеты.
- Дальние этапы до Космической сети открываются только после восьми планетных квизов и сборки двигателя.
- Финальная неизвестность открывается только после трёх уровней головоломки Космической сети.
- `stage-access` остаётся единственным источником границы и причины блокировки. Rail-кнопки будущих этапов disabled, содержат доступное объяснение, а победа обновляет их немедленно.
- Wheel/trackpad, touch, `End`/`PageDown`/`ArrowDown`/`Space`, rail и программный scroll используют одну границу; обратное движение остаётся свободным, повторные попытки не создают новые live-region узлы.
- `Ctrl`/`Meta` + wheel и multi-touch исключены из scroll guard, поэтому browser zoom и pinch zoom не превращаются в ловушку у барьера.

### Новые слои и адаптация

- Млечный Путь, Локальная группа и Космическая сеть остаются отдельными процедурными 3D-слоями со стандартными контрактами presence/parallax/dispose.
- Удалены старые fullscreen bitmap-плоскости дальнего космоса; скриншоты подтверждают пространственную глубину и читаемые подписи.
- Mobile viewport использует компактную/economy-композицию, не имеет горизонтального overflow; reduced-motion подтверждён браузерным media query.

### Проверка

- Unit/DOM: `124/124` (`7/7` файлов).
- Coverage: `95.22%` statements, `84.37%` branches, `95.06%` functions, `96.88%` lines; `create-shell.js` — `100% / 93.33% / 100% / 100%`.
- Build: Vite exit `0`; остаётся только прежнее предупреждение о chunk больше `500 kB`.
- E2E: `4/4` — все обходные каналы, mobile touch/backward, три реальные победы, WebGL и `0` console errors.
- Security: `npm audit --audit-level=high` — `0` vulnerabilities; новых сетевых вводов, HTML-инъекций, секретов и production test hooks нет.
- Independent reviews: code/spec — approved без findings; security/accessibility findings о zoom gestures закрыты отдельным RED→GREEN E2E.

> [!note] Визуальные доказательства
> Скриншоты сохранены рядом с task report: `task-7-artifacts/galaxy.png`, `local-group.png`, `cosmic-web.png`, `cosmic-web-mobile.png`, `mobile-locked-route.png`.

### Hardening после внешнего review

> [!success] Скрытое больше не интерактивно
> Rocket, engine, Web и finale controls теперь закрываются не только CSS: неактивные кнопки получают `hidden`, `disabled`, `tabindex="-1"`, `aria-hidden="true"`; контейнер Web дополнительно получает `inert`. Доступность восстанавливается только на законном активном этапе.

- Core-игры получили собственный fail-closed `active` lifecycle. Synthetic `dispatchEvent` не вращает Web tiles и не меняет engine puzzle, пока игра не активирована.
- Reduced-motion больше не превращает неактивную ракету в победу: `attemptCatch()` возвращает `inactive`, пока Earth-game не активна.
- Сбор артефакта требует активной Солнечной системы, совпадающего `activeObject`, состояния quiz `solved` и известного ID.
- Engine открывается только на активной Солнечной системе при точном полном наборе quiz-артефактов; completion дополнительно требует открытый, запущенный и реально решённый puzzle.
- Web start, level и completion требуют активную разблокированную Космическую сеть и активный core-state. Solved timer при уходе с этапа приостанавливается; reset очищает timer и stale `.solved` presentation.
- Finale callbacks также требуют активный неизвестный этап после настоящей победы Web.

#### RED → GREEN evidence

- Первый focused unit RED: `7 failed / 18 passed` — controls были видимы для DOM/focus, reduced-motion rocket возвращал `caught`, engine/Web tiles были enabled, fail-closed predicates отсутствовали.
- Focus/lifecycle E2E RED: после `earth-ship-ready` legitimate rocket оставалась `hidden`; единый lifecycle-sync восстановил её только на Earth.
- Review regression RED: Web reset ожидал отсутствие `.solved`, но получил `true`; очистка presentation в `reset()` дала GREEN `3/3`.
- Focused hardening suite: `28/28`; code re-review — Ready, security/abuse re-review — Approved без findings.

#### Повторная проверка

- Unit/DOM: `135/135` (`10/10` файлов).
- Coverage: `90.58%` statements, `82.31%` branches, `90.04%` functions, `92.51%` lines; `create-shell.js` — `100% / 95.83% / 100% / 100%`.
- Build: Vite exit `0`; только прежнее предупреждение о chunk больше `500 kB`.
- E2E: `5/5` за `1.7m`, включая новый observable focus/keyboard/anti-progress сценарий и полный честный путь.
- Security: `npm audit --audit-level=high` — `0` vulnerabilities.

### Финальная полировка 3D-сцен

> [!success] Границы текстур скрыты материалом
> Карты Млечного Пути и Андромеды в Локальной группе теперь проходят через детерминированную мягкую радиальную `alphaMap`. Детальная исходная текстура сохраняется, но её прямоугольная плоскость полностью растворяется до края; процедурные звёздные профили, наклоны и глубина остаются самостоятельной 3D-геометрией.

- Альфа-маска создаётся как `64 × 64` `DataTexture` со smoothstep-пером и освобождается ровно один раз вместе с локальными fallback-текстурами.
- Мобильный layout подписей резервирует фактическую границу правой шкалы расстояния плюс `6 px`, поэтому подпись Космической сети не пересекает rail при `390 × 844`.
- В E2E добавлена геометрическая проверка зазора между каждой видимой подписью и шкалой расстояния.
- HTML-отчёт Playwright исключён через `.gitignore`.

#### RED → GREEN evidence

- Unit RED: `alphaMap` была `null` у текстурированной Андромеды; после material fix focused suite — `57/57`.
- Mobile E2E RED: правая граница подписи была `373 px` при допустимых `266 px`; после резервирования фактической ширины rail честный маршрут — GREEN.
- Обновлённые визуальные доказательства: `task-7-artifacts/local-group.png` и `task-7-artifacts/cosmic-web-mobile.png`.

#### Финальная проверка

- Unit/DOM: `136/136` (`10/10` файлов).
- Coverage: `90.83%` statements, `82.47%` branches, `90.17%` functions, `92.65%` lines; `local-group.js` — `96.78% / 83.87% / 100% / 98.42%`.
- Build: Vite exit `0`; сохранено известное предупреждение о production chunk больше `500 kB`.
- E2E: `5/5` за `1.7m`, включая честный маршрут, обновление desktop/mobile screenshots и геометрическую проверку safe region.
- Security: `npm audit --audit-level=high` — `0` vulnerabilities; `git diff --check` — без ошибок.
- Независимый code review: `Approved`, findings отсутствуют.

## Обновление 2026-07-20 — luminous deep-space observatory

Связанные документы: [[2026-07-19-deep-space-visual-overhaul-design]] и [[2026-07-19-deep-space-visual-overhaul]].

> [!success] Интеграция завершена
> Единственный `createDeepSpacePostprocessing` adapter подключён к `createScene`; `sceneManager.render()` остаётся единственным frame-level render-вызовом. Renderer использует `SRGBColorSpace`, `ACESFilmicToneMapping` и общую экспозицию `1.34`.

### RED → GREEN

- Integration RED: честный Playwright-маршрут прошёл Galaxy и упал на тёмном Local Group с `luminousRatio 0.014755 < 0.015` до подключения pipeline.
- Local Group visual RED: реальная settled-проекция каталога занимала только `0.22644` ширины desktop-кадра. После расширения семи детерминированных кластеров GREEN-значение стало `0.63534`; non-hero galaxies получили размер `4.2–14.7 px`, scale `1.15` и intensity `1.18`.
- Cosmic Web visual RED: первый свежий кадр имел central luminance `0.001776` и читался почти чёрным. Первый material pass поднял значение до `0.008040`, второй — до GREEN `0.019529`; purple-magenta ratio достиг `0.026991`.
- Rendered-geometry bounds regression параметризован для high/medium/economy; все пять `cosmic-web-*` geometries остаются finite и внутри опубликованного объёма.

### Quality budgets и fallback

| Tier | Galaxy points | Local Group | Cosmic Web | Bloom |
| --- | ---: | ---: | ---: | --- |
| high | 9000 | 260 | 18000 | `1.18 / 0.72 / 0.48`, scale `0.75` |
| medium | 5600 | 160 | 9800 | `0.92 / 0.58 / 0.52`, scale `0.5` |
| economy | 2800 | 90 | 5200 | disabled; тот же base-pass цвет и композиция |

- Reduced motion отключает движение, но не яркость.
- Composer fail-closed переключается на direct renderer; resize/render/dispose lifecycle покрыт unit-тестами.
- На software WebGL полный E2E занимает `2.8m`; Web game временно использует меньший viewport только после запуска публичным UI, затем high-tier evidence снимается после возврата `1920 × 1080`.

### Fresh pixel evidence

| Stage | Desktop `1920 × 1080` | Mobile `390 × 844` |
| --- | --- | --- |
| Milky Way | luminance `0.073169`; face-on, bright, >50% width | luminance `0.197579`; face-on core/arms remain readable |
| Local Group | luminance `0.021911`; `143` bright components; projected catalog width `0.63534`; zero labels | luminance `0.035668`; `36` bright components; zero labels |
| Cosmic Web | luminance `0.019529`; purple ratio `0.026991` | luminance `0.024405`; purple ratio `0.015126` |

![[task-7-artifacts/galaxy.png]]
![[task-7-artifacts/local-group.png]]
![[task-7-artifacts/cosmic-web.png]]
![[task-7-artifacts/galaxy-mobile.png]]
![[task-7-artifacts/local-group-mobile.png]]
![[task-7-artifacts/cosmic-web-mobile.png]]

### Gates и reviews

- Unit: `174/174`, `12/12` files.
- Coverage overall: statements `87.92%`, branches `77.43%`, functions `84.83%`, lines `89.87%`.
- Changed visual files: `local-group.js` — `96.15% / 83.92% / 100% / 96.73%`; `cosmic-web.js` — `99.56% / 95.31% / 100% / 100%`; postprocessing — `98.92% / 95.83% / 100% / 100%`.
- Build: PASS, `49` modules; известное предупреждение о chunk `999.85 kB` остаётся advisory.
- E2E: `5/5` PASS за `2.8m`; реальные победы, rail/progression, zero Local Group labels, no horizontal overflow и zero console/WebGL errors.
- Anti-progress stability: `--repeat-each=2` — `2/2` PASS за `28.6s` и `29.7s`; прежний RED был default `30s` timeout, а не retry или неверное состояние.
- Audit: `0 vulnerabilities`; `git diff --check`: clean.
- Independent code, spec, visual и security reviews: Critical `0`, Important `0` после исправлений; visual verdict `Approve`.

Feature commit: `f7c38eb`.

> [!warning] Остаточные риски
> Production chunk остаётся больше `500 kB`. Mobile distance rail частично перекрывает правую область Local Group/Cosmic Web, но независимый visual review классифицировал это как Minor: horizontal overflow и неприемлемого crop нет.

## Поправка 2026-07-20 — strict topology pixel acceptance

Связанные документы: [[2026-07-19-deep-space-visual-overhaul-design#Поправка 2026-07-20 — topology-first pixel correction]] и [[2026-07-19-deep-space-visual-overhaul#Task 5A Strict topology and mobile-composition correction]].

> [!success] Актуальный visual verdict
> Повторная строгая проверка приняла все шесть кадров: `APPROVE 6/6`, Critical `0`, Important `0`. Эта секция заменяет прежнее замечание о правом mobile rail: шкала теперь находится в компактной top-center safe area и не закрывает основной Local Group/Cosmic Web subject.

### RED → GREEN: пространственное покрытие

| Сцена | Отклонённый baseline | Итоговый свежий кадр |
| --- | ---: | ---: |
| Local desktop bright-grid | `0.28125` | `0.43750` |
| Local mobile bright-grid | `0.20000` | `0.60000` |
| Cosmic desktop luminous ratio | `0.019375` | `0.055721` |
| Cosmic desktop purple ratio / grid | `0.027001 / 0.43750` | `0.091894 / 0.91667` |
| Cosmic mobile luminous ratio | `0.024405` | `0.076500` |
| Cosmic mobile purple ratio / grid | `0.015237 / 0.21250` | `0.107316 / 0.81250` |

- Local projected readable cells: `17 → 32` из `96`; занято `6/8` вертикальных рядов, settled width `0.664588`, бюджет high/medium/economy остаётся `260 / 160 / 90`.
- Cosmic projected multi-edge coverage: `0.43750 → 0.96875`; high-граф содержит `120` узлов, `331` ребро, `18000` частиц, три depth bands и остаётся полностью связным/ограниченным published volume.
- Medium seed `106` выявил review RED `280 > 276` рёбер. Cap-aware insertion сохранил spanning backbone и дал GREEN `276`; независимый sweep seeds `1..500` для всех tier получил `badCount 0`, `disconnected 0`.
- Mobile rail сохраняет все значения в DOM, визуально показывает active/near markers, имеет размер не более `220 × 92`, центрирован с допуском `4 px`, находится в диапазоне `y=48..148`, не пересекает видимую подпись и не создаёт overflow.

### Свежие кадры после финального `5/5`

![[task-7-artifacts/galaxy.png]]
![[task-7-artifacts/local-group.png]]
![[task-7-artifacts/cosmic-web.png]]
![[task-7-artifacts/galaxy-mobile.png]]
![[task-7-artifacts/local-group-mobile.png]]
![[task-7-artifacts/cosmic-web-mobile.png]]

### Финальные gates

- Unit: `177/177`, `12/12` files.
- Coverage overall: statements `88.27%`, branches `78.32%`, functions `85.00%`, lines `90.19%`.
- Changed files: `cosmic-web.js` — `99.61% / 94.73% / 100% / 100%`; `local-group.js` — `98.07% / 92.85% / 100% / 98.91%`.
- Build: PASS, `49` modules; известный chunk-size advisory `1001.02 kB` остаётся неблокирующим.
- E2E: `5/5` PASS за `2.9m`, включая честные победы, шесть свежих кадров, rail/no-overflow и zero console/WebGL errors.
- Audit: `0 vulnerabilities`; `git diff --check`: clean; порт `4173`: clear.
- Независимые strict visual и code re-reviews: Critical `0`, Important `0`, Minor `0` в коде; visual `APPROVE 6/6`.

Design amendment commit: `742d96b`. Follow-up implementation commit: `ff4de20`.

> [!warning] Остаточный риск
> Production bundle остаётся больше `500 kB`. В desktop Cosmic Web некоторые дальние коннекторы тонкие, а центральная подпись слегка конкурирует с сетью; независимый strict visual review классифицировал это как Minor и принял кадр.

## Поправка 2026-07-20 — органические нити Cosmic Web и полная доступная шкала

Связанные документы: [[2026-07-19-deep-space-visual-overhaul-design#Поправка 2026-07-20 — organic curved filament body]] и [[2026-07-19-deep-space-visual-overhaul#Task 5B Organic curved filaments and accessible compact rail]].

> [!success] Итог
> Все шесть кадров приняты корневой original-pixel проверкой: `ACCEPT 6/6`, Critical `0`, Important `0`. Прямые механические хорды больше не доминируют: сеть состоит из детерминированных дуг и particulate-пучков. Единственный visual Minor — несколько дальних слабых дуг всё ещё слегка графоподобны.

### RED → GREEN

- Geometry RED: `662` filament vertices вместо требуемых `6620`; старый renderer создавал один прямой сегмент на каждое из `331` рёбер.
- Geometry GREEN: каждое graph edge получает `10` связанных cubic Bézier segments; не менее `75%` meaningful edges отклоняются от прямой хорды более чем на `1` world unit. Частицы проверяются на близость к той же polyline, а не к прямой хорде.
- A11y RED: `#distanceScaleA11ySummary` отсутствовал. Первый GREEN выявил review-дефект: supplied `<`, `&` и entity-like text разбирался через `innerHTML`.
- A11y final GREEN: пустой `.sr-only` placeholder заполняется через `textContent`, `#distanceScale` ссылается на него через `aria-describedby`, декоративный сокращённый `<ol>` имеет `aria-hidden="true"`; adversarial test требует точное полное значение маршрута.
- Graph metadata не изменились: high/medium/economy nodes `120 / 92 / 68`, particles `18000 / 9800 / 5200`, high app graph `331` edges, connectedness, три depth bands, published volume и edge cap сохранены.

### Финальные pixel metrics

| Cosmic Web | Strict straight baseline | Organic final |
| --- | ---: | ---: |
| Desktop luminous | `0.055721` | `0.059646` |
| Desktop purple / grid | `0.091894 / 0.91667` | `0.099260 / 0.93750` |
| Mobile luminous | `0.076500` | `0.077011` |
| Mobile purple / grid | `0.107316 / 0.81250` | `0.112911 / 0.83750` |

Последний полный E2E заново записал `1920 × 1080` desktop и `390 × 844` mobile кадры честным маршрутом через публичные controls:

![[task-7-artifacts/galaxy.png]]
![[task-7-artifacts/local-group.png]]
![[task-7-artifacts/cosmic-web.png]]
![[task-7-artifacts/galaxy-mobile.png]]
![[task-7-artifacts/local-group-mobile.png]]
![[task-7-artifacts/cosmic-web-mobile.png]]

### Gate hardening и финальная проверка

- Первый полный E2E после Task 5B дал `4/5`: scroll guard показывал причину barrier, затем Earth stage-frame до готовности корабля стирал её через `showMission("")`. RED оказался timing-dependent и воспроизводился в полном suite.
- Source-fix сохраняет только уже видимый текст, точно равный текущему immutable `stageAccess.reason`; focused Playwright `--repeat-each=3` прошёл без ошибок, независимый review — Critical/Important/Minor `0`.
- Unit: `179/179`, `12/12` files.
- Coverage overall: statements `88.53%`, branches `78.43%`, functions `85.41%`, lines `90.41%`.
- Changed files: `cosmic-web.js` — `99.66% / 95.00% / 100% / 100%`; `create-shell.js` — `100% / 95.83% / 100% / 100%`.
- Build: PASS, `49` modules; известный chunk-size advisory `1002.09 kB` остаётся неблокирующим.
- Финальный полный E2E: `5/5` PASS за `3.0m`; audit: `0 vulnerabilities`; `git diff --check`: clean; порт `4173`: clear.
- Task spec/quality review, a11y re-review, scroll-race review и root visual review: Critical `0`, Important `0`; кодовые Minor `0`.

Коммиты: design/plan `878fe95`; organic geometry `aa7c05a`; safe a11y text `95fd3fa`; scroll barrier race `28ac228`.

## Task 5C - procedural fine-cell Cosmic Web tissue

Related: [[2026-07-19-deep-space-visual-overhaul-design]], [[2026-07-20-procedural-cosmic-tissue]].

> [!success] Superseding visual verdict
> Root original-pixel review accepts Cosmic Web desktop and mobile. The final one-FBM, cellular-ridge, fine-dust field reads as fine violet-magenta cosmic tissue rather than a coarse lattice or flat wash. Galaxy and Local Group desktop/mobile remain accepted. Critical `0`, Important `0`.

### Evidence

- RED before production: short-edge bend `6.35349460965352 > 5.229806032267265`; tissue absent in all three tiers; desktop near-black `0.9274802782516864`, warm `0.03516578633839696`.
- Final tissue tiers are exactly high/medium/economy `3 / 2 / 1`, with deterministic offsets, depths `-300 / -235 / -170`, additive base-pass materials and no time/exposure uniform.
- Final accepted desktop: near-black `0.6479344173541359`, warm `0.21370170657246793`. Mobile: `0.6022631578947368 / 0.21676315789473685`.
- Post-parallax bounds used a real RED (`379.999 > 379.501`, `659.999 > 659.501`) and GREEN `3/3` after a `0.5` inset, checking transformed vertices through `matrixWorld`.
- Shared `PlaneGeometry` and materials dispose once; repeated layer disposal is idempotent. Reduced motion disables movement only.
- Public Web helper accepts only `.solved` or the exact active/enabled next-level `12/16` state through default polling; timeouts and puzzle clicks were not weakened.

### Gates and reviews

- Implementation: `12ce002190ec720da2ee2e455f468c404bb53afa`.
- Unit `210/210`; overall coverage `89.19 / 80.10 / 86.09 / 90.89`; scene/layers `97.77 / 92.44 / 97.10 / 98.36`. Global branches improved from `611/784` to `628/784` with test-only behavior contracts.
- Build PASS (`50` modules), audit `0 vulnerabilities`, diff-check clean.
- Full E2E startup audit: first run `4/5` had one blank-page startup flake; isolated test passed `1/1`, then unchanged full suite passed `5/5` in `3.5m`.
- Independent spec and quality reviews: Approved, no Critical/Important. Accepted Minors: fixed-z public factory assumption, two diagonal extrema instead of four, subtle warm/orange accents and some geometric microcells on close inspection.
- Coverage hardening: `6486681` (`test: cover cosmic tissue branch contracts`); test-quality re-review Approved with no findings after the artificial fallback assertion was removed.

![[task-7-artifacts/galaxy.png]]
![[task-7-artifacts/local-group.png]]
![[task-7-artifacts/cosmic-web.png]]
![[task-7-artifacts/galaxy-mobile.png]]
![[task-7-artifacts/local-group-mobile.png]]
![[task-7-artifacts/cosmic-web-mobile.png]]

> [!warning] Остаточный риск
> Production bundle остаётся больше `500 kB`. Несколько дальних слабых Cosmic Web дуг всё ещё могут читаться как граф, но корневая pixel-проверка признала это неблокирующим Minor после существенного удаления straight-chord доминирования.

## 2026-07-20 — Ultra photographic release acceptance

Связанные документы: [[2026-07-20-ultra-photographic-space-design]] и [[2026-07-20-ultra-photographic-space]].

> [!success] Финальный результат
> Полный production acceptance завершён: unit `187/187`, coverage по всем четырём метрикам выше `80%`, build и audit прошли, Playwright `5/5` прошёл за `4.3m`, а original-pixel проверка приняла `10/10` официальных кадров. Все мини-игры решены через публичные controls без localStorage или progression bypass; console/WebGL errors и horizontal overflow не обнаружены.

### Release gates

| Gate | Результат |
| --- | --- |
| Unit | `15/15` файлов, `187/187` тестов |
| Coverage | statements `86.75%`, branches `80.38%`, functions `84.46%`, lines `88.61%` |
| Build | PASS, `52` modules, JS chunk `991.40 kB` (`269.88 kB` gzip) |
| Audit | `0 vulnerabilities` |
| Focused production progression | `1/1` PASS за `3.0m` |
| Full production E2E | `5/5` PASS за `4.3m` |
| Runtime safety | zero collected console/WebGL errors; no horizontal overflow; progression barriers сохранены |

Local Group acceptance требует ровно шесть видимых `data-id` на desktop и mobile: `group-milky-way`, `group-andromeda`, `group-triangulum`, `group-lmc`, `group-smc`, `group-m32`. Публичный клик по `group-andromeda` открыл корректную object panel, а Close вернул панель в закрытое состояние.

### High-tier DPR evidence

High-tier профиль вычислен из boot-observed viewport и фактического DPR при тестово зафиксированном `hardwareConcurrency = 12`: viewport `1112 × 625`, `devicePixelRatio = 1`, выбранный tier `high`, ожидаемый `pixelRatio = min(2, DPR) = 1`.

| Capture | Viewport / client canvas | Backing canvas | Width ratio | Height ratio | Допуск |
| --- | --- | --- | ---: | ---: | ---: |
| Desktop | `1920 × 1080` | `1920 × 1080` | `1.000` | `1.000` | `≤ 0.02` |
| Mobile | `390 × 844` | `390 × 844` | `1.000` | `1.000` | `≤ 0.02` |

### Original-pixel verdict

Каждый файл проверен через original-resolution просмотр; PNG dimensions совпадают с соответствующим viewport.

| Артефакт | Размер | Verdict | Наблюдение |
| --- | ---: | --- | --- |
| `solar-system.png` | `1920 × 1080` | ACCEPT | Чёткие Солнце, планеты, орбиты и подписи; sub-native blur нет. |
| `milky-way.png` | `1920 × 1080` | ACCEPT | Полный крупный фотографический диск и halo видимы; не point spiral. |
| `local-group.png` | `1920 × 1080` | ACCEPT | Равномерное заполнение кадра и ровно шесть читаемых аннотаций. |
| `cosmic-web.png` | `1920 × 1080` | ACCEPT | Яркие органические purple/magenta нити и округлые узлы выходят за все края; angular-cell доминирования нет. |
| `unknown-star.png` | `1920 × 1080` | ACCEPT | Честно поставленная круглая звезда видна в свободной области; coupon отсутствует. |
| `solar-system-mobile.png` | `390 × 844` | ACCEPT | Система остаётся чёткой; top-center rail не закрывает основной subject. |
| `milky-way-mobile.png` | `390 × 844` | ACCEPT | Полный яркий диск читается по всей высоте и свободен от rail. |
| `local-group-mobile.png` | `390 × 844` | ACCEPT | Все шесть подписей видимы, UI не обрезан и не переполняет viewport. |
| `cosmic-web-mobile.png` | `390 × 844` | ACCEPT | Нити заполняют экран за краями, topology остаётся плавной и органической. |
| `unknown-star-mobile.png` | `390 × 844` | ACCEPT | Mobile-first pre-coupon кадр показывает круглую звезду отдельно от текста и rail. |

### Official captures

![[.superpowers/sdd/ultra-photo-artifacts/solar-system.png]]
![[.superpowers/sdd/ultra-photo-artifacts/milky-way.png]]
![[.superpowers/sdd/ultra-photo-artifacts/local-group.png]]
![[.superpowers/sdd/ultra-photo-artifacts/cosmic-web.png]]
![[.superpowers/sdd/ultra-photo-artifacts/unknown-star.png]]
![[.superpowers/sdd/ultra-photo-artifacts/solar-system-mobile.png]]
![[.superpowers/sdd/ultra-photo-artifacts/milky-way-mobile.png]]
![[.superpowers/sdd/ultra-photo-artifacts/local-group-mobile.png]]
![[.superpowers/sdd/ultra-photo-artifacts/cosmic-web-mobile.png]]
![[.superpowers/sdd/ultra-photo-artifacts/unknown-star-mobile.png]]

> [!warning] Остаточный advisory
> Vite по-прежнему сообщает, что production JavaScript chunk `991.40 kB` превышает advisory-порог `500 kB`. Build проходит; bundle splitting не входит в photographic acceptance.

## 2026-07-20 — Публикация текущей версии

> [!success] Готово к отправке
> Пользователь принял текущую визуальную версию и разрешил опубликовать её без повторного запуска проверок.

- Ветка: `feature/deep-space-3d`.
- Репозиторий: `M11cy/Spase_is_u`.
- В публикацию включено текущее состояние рабочего дерева, включая финальные визуальные артефакты и последнюю корректировку E2E-сценария.
- Повторные тесты перед отправкой сознательно не запускались по прямому указанию пользователя.
