import { access, readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";

const VOICE_CUES = Object.freeze([
  "homeStart", "homeZoom", "earthArrival", "earthRocketPrompt",
  "earthRocketCaught", "earthDeparture", "solarArrival", "solarBroken",
  "solarQuest", "solarComplete", "solarDeparture", "milkyWay",
  "milkyWayDeparture", "localGroup", "localGroupDeparture",
  "universeArrival", "universeQuest", "universeFall", "universeComplete",
  "unknownTransition", "finalOne", "finalTwo", "finalStar"
]);

const QUEST_HOOKS = Object.freeze([
  "handleNarrationFromStage", "handlePanelNarration", "promptRocketCatch",
  "catchRocket", "collectSolarArtifact", "runWebPath", "slipFromWebPath",
  "createPersonalStar", "advanceFinale"
]);

const QUEST_CONTROLS = Object.freeze([
  "narrationPanel", "voiceToggle", "subtitleToggle", "rocketCatcher",
  "webRunner", "starMaker", "personalStars"
]);

describe("voice and quest preservation contract", () => {
  test("keeps every narration cue and quest hook", async () => {
    const source = await readFile("src/main.js", "utf8");
    VOICE_CUES.forEach((id) => expect(source).toContain(id));
    QUEST_HOOKS.forEach((name) => expect(source).toContain(name));
    QUEST_CONTROLS.forEach((id) => expect(source).toContain(id));
  });

  test("keeps all referenced voice files", async () => {
    const source = await readFile("src/main.js", "utf8");
    const files = [...source.matchAll(/voice\/([a-z0-9-]+\.mp3)/g)].map(([, file]) => file);

    expect(files.length).toBe(23);
    await Promise.all(files.map((file) => access(`public/voice/${file}`)));
  });

  test("connects the preserved story to the modular cinematic journey", async () => {
    const source = await readFile("src/main.js", "utf8");

    expect(source).toMatch(/import\s*\{[^}]*\bcreateIntroState\b[^}]*\}\s*from\s*["']\.\/core\/intro-state\.js["']/);
    expect(source).toMatch(/import\s*\{[^}]*\bcreateSatelliteMap\b[^}]*\}\s*from\s*["']\.\/map\/satellite-map\.js["']/);
    expect(source).toMatch(/import\s*\{[^}]*\bcreateIntroController\b[^}]*\}\s*from\s*["']\.\/ui\/intro-controller\.js["']/);
    expect(source).toMatch(/createIntroController\([\s\S]*markUserInteraction\(\)[\s\S]*setNarration\("homeStart"/);
    expect(source).toMatch(/if\s*\(\s*!journeyStarted\s*\)\s*return/);
    expect(source).toMatch(/function updateStage[\s\S]*handleNarrationFromStage/);
    expect(source).toMatch(/function updateStage[\s\S]*updateMissionForStage/);
    expect(source).toMatch(/function openPanel[\s\S]*markUserInteraction\(\)[\s\S]*handlePanelNarration/);
    expect(source).toContain("collectSolarArtifact(data)");
    expect(source).toContain("slipFromWebPath()");
  });

  test("updates mission feedback once through the narration stage hook", async () => {
    const source = await readFile("src/main.js", "utf8");
    const updateStageSource = source.slice(
      source.indexOf("function updateStage()"),
      source.indexOf("function openPanel", source.indexOf("function updateStage()"))
    );
    const narrationHookSource = source.slice(
      source.indexOf("function handleNarrationFromStage"),
      source.indexOf("setNarration(\"homeStart\"", source.indexOf("function handleNarrationFromStage"))
    );

    expect(updateStageSource).toContain("handleNarrationFromStage(exactStage, previousStage)");
    expect(updateStageSource).not.toContain("updateMissionForStage()");
    expect(narrationHookSource.match(/updateMissionForStage\(\)/g)).toHaveLength(1);
  });

  test("keeps frozen map scaling active for reduced motion", async () => {
    const styles = await readFile("src/styles.css", "utf8");
    const reducedMotionMapRules = styles.slice(
      styles.indexOf("@media (prefers-reduced-motion: reduce)"),
      styles.indexOf("/* Task 5:")
    );

    expect(reducedMotionMapRules).toContain(".map-layer");
    expect(reducedMotionMapRules).toContain(".satellite-map");
    expect(reducedMotionMapRules).toContain("transition: none !important");
    expect(reducedMotionMapRules).not.toContain("transform: none !important");
  });

  test("cleans dynamic labels and locally owned Three.js resources", async () => {
    const source = await readFile("src/main.js", "utf8");

    expect(source).toMatch(/label\.addEventListener\([\s\S]*\{\s*signal:\s*listenerSignal\s*\}/);
    expect(source).toContain("disposeLocalVisualResources()");
    expect(source).toMatch(/function disposeLocalVisualResources[\s\S]*geometry\?\.dispose\(\)[\s\S]*material\?\.dispose\(\)/);
  });
});
