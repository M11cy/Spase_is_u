---
title: Публикация cinematic scene transfer
date: 2026-07-18
tags:
  - development
  - git
  - release
status: complete
---

# Публикация cinematic scene transfer

Связано с [[2026-07-17-cinematic-scene-transfer]] и [[2026-07-17-cinematic-scene-transfer-design]].

> [!info] Область публикации
> Финальная версия проекта с озвучкой перенесена в Git-репозиторий без удаления существующей истории и старых проектных документов.

## Ветка

`codex/cinematic-scene-transfer`

## Проверки перед публикацией

- [x] unit/integration tests — 132/132, statements 95.09%, branches 84.03%
- [x] production build — PASS
- [x] desktop/mobile E2E — 2/2
- [x] проверка состава diff — 113 файлов, секретов и файлов больше 50 MB нет
- [x] push в `origin` — `codex/cinematic-scene-transfer`

> [!note] Известное предупреждение
> Vite сообщает о JavaScript chunk больше 500 kB. Сборка завершается успешно; runtime-ошибок и E2E-регрессий нет.
