---
title: Ultra Task 7 Release Acceptance Report
date: 2026-07-20
tags:
  - development
  - ultra-photographic-space
  - e2e
  - visual-acceptance
  - release-gate
status: complete
completed: true
---

# Ultra Task 7 release acceptance

Related: [[2026-07-20-ultra-photographic-space-design]] and [[2026-07-20-ultra-photographic-space]].

> [!success] Decision
> ACCEPT. The production application passed every required automated gate and all ten original-resolution visual checks. The route was completed through public UI controls without storage edits, progression bypasses, or disabled checks.

## E2E contract hardening

- Replaced both vacuous Local Group zero-count selectors with the exact visible ID set: `group-milky-way`, `group-andromeda`, `group-triangulum`, `group-lmc`, `group-smc`, `group-m32`.
- Verified the exact set on desktop and mobile, clicked Andromeda, checked the real panel title/open state, then closed it through the public Close control.
- Derived the selected quality profile from the boot-observed viewport and actual device DPR, with `hardwareConcurrency = 12` pinned by the test to select the high tier. The test asserts both backing/client canvas ratios within `0.02` of its DPR-aware pixel ratio.
- Preserved every progression barrier and solved the rocket, eight planet quizzes, engine puzzle, and three Cosmic Web levels honestly.
- Captured the finale star on mobile before the scheduled coupon appeared, then waited for the real coupon, closed it publicly, and captured the same round star on desktop.

## RED to GREEN evidence

- Milky Way RED: occupied width `0.4726301736 <= 0.5`; production scale fix `b4f4060` restored the accepted large complete disk.
- Local Group RED: bright-grid `40/96 = 0.4166666667 < 0.42`; production brightness fix `e3980f9` restored robust coverage while retaining exactly six labels.
- Cosmic Web RED: luminous ratio `0.0098161754 < 0.04`; production exposure fix `cc2920d` restored vivid organic exposure and passed all existing luminance, purple, grid, near-black, and warm gates.
- Test-only sequencing was corrected after viewport resize by navigating through already-unlocked public stage buttons; no state was injected or bypassed.

## Automated gates

| Gate | Result |
| --- | --- |
| Unit | `15/15` files, `187/187` tests |
| Coverage | statements `86.75%`; branches `80.38%`; functions `84.46%`; lines `88.61%` |
| Build | PASS, `52` modules |
| Audit | `0 vulnerabilities` |
| Focused progression | `1/1` PASS in `3.0m` |
| Full production E2E | `5/5` PASS in `4.3m` |
| Browser diagnostics | zero collected console/WebGL errors; no horizontal overflow |

## DPR evidence

Boot-observed inputs selected the high tier at `1112 × 625` with actual DPR `1` and test-pinned `12` logical cores. The selected profile's DPR-aware pixel ratio was `1`.

| Target | Viewport | Canvas client | Canvas backing | Backing/client ratios |
| --- | ---: | ---: | ---: | ---: |
| Desktop | `1920 × 1080` | `1920 × 1080` | `1920 × 1080` | `1.000 / 1.000` |
| Mobile | `390 × 844` | `390 × 844` | `390 × 844` | `1.000 / 1.000` |

Both axes differ from the selected profile by `0.000`, within the required `0.02` tolerance.

## Original-pixel inspection

| Image | Verdict | Acceptance evidence |
| --- | --- | --- |
| `solar-system.png` | ACCEPT | Crisp native-size system, readable objects and orbits. |
| `milky-way.png` | ACCEPT | Complete large photographic disk and halo. |
| `local-group.png` | ACCEPT | Uniform frame coverage and exactly six annotations. |
| `cosmic-web.png` | ACCEPT | Edge-filling smooth organic purple tissue and rounded nodes. |
| `unknown-star.png` | ACCEPT | Round placed star, unobscured after public coupon close. |
| `solar-system-mobile.png` | ACCEPT | Crisp subject clear of compact top-center rail. |
| `milky-way-mobile.png` | ACCEPT | Complete disk clear of rail, no clipping. |
| `local-group-mobile.png` | ACCEPT | Six readable annotations, no rail overlap or overflow. |
| `cosmic-web-mobile.png` | ACCEPT | Organic edge-filling network, no angular-cell dominance. |
| `unknown-star-mobile.png` | ACCEPT | Round star captured before coupon coverage, clear of text/rail. |

## Official artifacts

![[ultra-photo-artifacts/solar-system.png]]
![[ultra-photo-artifacts/milky-way.png]]
![[ultra-photo-artifacts/local-group.png]]
![[ultra-photo-artifacts/cosmic-web.png]]
![[ultra-photo-artifacts/unknown-star.png]]
![[ultra-photo-artifacts/solar-system-mobile.png]]
![[ultra-photo-artifacts/milky-way-mobile.png]]
![[ultra-photo-artifacts/local-group-mobile.png]]
![[ultra-photo-artifacts/cosmic-web-mobile.png]]
![[ultra-photo-artifacts/unknown-star-mobile.png]]

> [!warning] Residual advisory
> Vite still reports the existing `991.40 kB` production JavaScript chunk above its `500 kB` advisory threshold. The build is successful; bundle splitting is outside this acceptance task.
