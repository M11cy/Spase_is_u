---
title: Local Group Brightness Fix Report
date: 2026-07-20
tags:
  - development
  - visual-regression
  - local-group
  - playwright
status: verified
aliases:
  - Local Group photo brightness verification
---

# Local Group brightness fix

> [!success] Итог
> Фотографический слой Local Group стал заметнее без изменения композиции и production-кода. Финальный production proof даёт **52 из 96 ячеек** (`0.5416666667`) против исходных **40 из 96** (`0.4166666667`). Цель с запасом `>= 46/96` выполнена.

## Причина отклонения

Официальный исходный снимок `ultra-photo-artifacts/local-group.png` имел правильную композицию, ровно шесть подписей и равномерное распределение галактик, но после WebGL-рендеринга текстура была слишком тёмной. Идентичный raw-pixel анализ подтвердил отклонение: порог `minimumBrightGridCoverage >= 0.42` не выполнялся при `40/96 = 0.4166666667`.

Исходником остался принятый project master `public/space/local-group-photo-8k.jpg` из `HEAD b4f4060`; его SHA-256 до коррекции — `819bf272ea6b6bca9f3eec601fbbf4082dfe785e05d2bf658b93cc555197befe`. Изображение не генерировалось заново.

## Детерминированная коррекция

Коррекция выполнена Sharp в 16-битном RGB-пространстве:

```js
sharp(source, { limitInputPixels: 80_000_000 })
  .toColourspace("rgb16")
  .modulate({ brightness: 1.20, saturation: 1.04 })
  .toColourspace("srgb")
  .jpeg({ quality: 94, chromaSubsampling: "4:4:4" });
```

Нулевой offset не добавлялся, поэтому чистый чёрный фон сохраняется. Для финального 8K JPEG в измеряемом crop строго чёрными остаются `49.4693899%` пикселей. Пиксели хотя бы с одним каналом `255` занимают `0.1040103%`: широкого клиппинга нет, а визуальная проверка исходных пикселей подтверждает сохранённые спиральные рукава, звёзды, цвет и детали ядер.

### Bounded-кандидаты

| Brightness | Saturation | Проверка | Bright cells | Coverage | Exact black | Any-channel clip |
|---:|---:|---|---:|---:|---:|---:|
| 1.20 | 1.04 | production 1920×1080 | 52/96 | 0.541667 | 49.4694% master crop | 0.1040% master crop |
| 1.25 | 1.04 | 8K master pixels | 81/96 | 0.843750 | 49.5167% | 0.1286% |
| 1.30 | 1.04 | production 1920×1080 | 56/96 | 0.583333 | 49.5312% master crop | 0.1576% master crop |
| 1.35 | 1.04 | 8K master pixels | 82/96 | 0.854167 | 49.5437% | 0.1875% |

Выбран `brightness: 1.20`: это нижняя проверенная граница bounded-набора и она уже даёт запас шесть ячеек относительно целевого `46/96`. Более сильная коррекция `1.30` не нужна.

## Производные файлы

4K и 2K JPEG пересобраны экспортированной функцией `buildDeepSpaceAssets`: Lanczos3, `fit: "fill"`, JPEG quality 92, `4:4:4`. AVIF/WebP пересобраны экспортированной функцией `optimizeAssets` в изолированной папке с теми же настройками проекта: AVIF quality 62/effort 5 и WebP quality 78/effort 4. `public/space/assets.json` не изменился.

| Файл | Размеры | Bytes | SHA-256 |
|---|---:|---:|---|
| `local-group-photo-8k.jpg` | 7680×4320 | 2,758,908 | `772bbb511521a2ff9ccb671b799c9bd18af5a0fcbf01ec9982bb654e8e67d06a` |
| `local-group-photo-8k.avif` | 7680×4320 | 458,369 | `7bf92a2978935f3df6ba11a95895bc156aac186ff955dee8f1ea8b5ae5897352` |
| `local-group-photo-8k.webp` | 7680×4320 | 430,072 | `a89ba9972888f48818aea9622d1cce74a4c46b1103178d71324e8bc6c603075c` |
| `local-group-photo-4k.jpg` | 4096×2304 | 1,005,485 | `2823b74e4bb351c942adbc8707e5544499f1b6fbe67452d3a46a478d053bca3e` |
| `local-group-photo-4k.avif` | 4096×2304 | 256,828 | `053a0a19d8f086c6cde0082ee0932731f0395f9ebfd6301b6c2f9aaf9fca7b6f` |
| `local-group-photo-4k.webp` | 4096×2304 | 206,120 | `5a456d69c7f65a954780a3b52645fda58f122920b206170d7ca02428a2c0c7c8` |
| `local-group-photo-2k.jpg` | 2048×1152 | 404,521 | `9cd3e871f6c538a060c3871081c3452f5be05f315d814ce8ab94bbe09ceb2ef7` |
| `local-group-photo-2k.avif` | 2048×1152 | 123,134 | `b67ed2ee08286c21eff7cd89091975597b7cb2b9084b7b1bbb77eb39a83a728d` |
| `local-group-photo-2k.webp` | 2048×1152 | 95,142 | `f9568f46442d9b4b9d93a7c1f5248c233e6eec53abce77663480954b2cbfaee7` |

Для каждого JPEG-маршрута manifest по-прежнему содержит соответствующие `avif`, `webp` и `fallback`. Все девять файлов имеют ожидаемые точные размеры.

## Production proof

Финальный уникальный proof:

![[local-group-brightness-proof/local-group-b1-20-final-2026-07-20T04-48-14-733Z.png]]

Проверка выполнена на свежем production build через публичный UI без подмены storage или внутренних progression-флагов: старт путешествия → ловля ракеты → ответы по планетам → сборка двигателя → Galaxy → Group.

- viewport: `1920×1080`;
- canvas: `1920×1080`, DPR `1`, high-tier hardware profile (`12` cores);
- реально загружен `/space/local-group-photo-8k.avif`, HTTP `200`;
- стадия `4`;
- ровно шесть видимых ID: `group-andromeda`, `group-lmc`, `group-m32`, `group-milky-way`, `group-smc`, `group-triangulum`;
- интерактивная панель открылась с заголовком `Андромеда` и штатно закрылась;
- browser errors: `0`.

Raw-pixel метрика повторяет официальный алгоритм: crop `(154, 86, 1498, 799)`, сетка `12×8`; ячейка считается яркой при доле не менее `0.006` пикселей с luminance `>= 20` и saturation `>= 5`.

| Состояние | Bright cells | Coverage |
|---|---:|---:|
| Before — официальный `local-group.png` | 40/96 | 0.4166666667 |
| After — финальный production proof | 52/96 | 0.5416666667 |

## Gates

> [!check] Пройдено
> - Focused assets/layers: `56/56` tests.
> - Full unit coverage: `187/187` tests; statements `86.73%`, branches `80.38%`, functions `84.46%`, lines `88.59%`.
> - Production build: Vite exit `0`.
> - Dependency audit: `0 vulnerabilities`.
> - `assets.json`: byte-clean относительно `HEAD`.
> - Milky Way и Cosmic Web: byte-clean относительно `HEAD` для всех 18 файлов.
> - Production JavaScript не изменялся.
> - Независимый read-only review: approved; 8K transform, JPEG derivatives и AVIF/WebP варианты точно воспроизводятся заявленными pipeline-настройками.

Незакоммиченный `tests/progression.e2e.spec.js` и официальный каталог `ultra-photo-artifacts` принадлежат параллельной Task7: они не редактировались, не откатывались и не включаются в этот commit.
