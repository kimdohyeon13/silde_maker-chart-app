import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveCanvasHeight,
  resolveCenteredTitleFontSize,
  resolveExportFrame,
  resolveFilledChartHeight,
  resolveHeaderLayout,
} from "../src/lib/export-layout.ts";
import { getStylePreset } from "../src/lib/style-presets.ts";

test("화이트 시안의 캔버스 높이는 유효한 양수만 사용한다", () => {
  assert.equal(resolveCanvasHeight(), undefined);
  assert.equal(resolveCanvasHeight(513), 513);
  assert.equal(resolveCanvasHeight(0), undefined);
  assert.equal(resolveCanvasHeight(Number.NaN), undefined);
});

test("고정 캔버스 차트는 안쪽 여백을 뺀 실제 남은 높이를 채운다", () => {
  assert.equal(resolveFilledChartHeight(410, 8, 12, 350), 390);
  assert.equal(resolveFilledChartHeight(220, 8, 12, 350), 350);
  assert.equal(resolveFilledChartHeight(Number.NaN, 0, 0, 350), 350);
});

test("프레임 없음과 헤어라인은 그림자 없이 구분한다", () => {
  assert.deepEqual(resolveExportFrame("none", 1, "#D0D5DD", "shadow"), {
    border: "0",
    boxShadow: "none",
  });
  assert.deepEqual(resolveExportFrame("hairline", 1, "#D0D5DD", "shadow"), {
    border: "1px solid #D0D5DD",
    boxShadow: "none",
  });
  assert.deepEqual(resolveExportFrame(undefined, 1, "#D0D5DD", "shadow"), {
    border: "1px solid #D0D5DD",
    boxShadow: "shadow",
  });
});

test("헤더 변형은 상단선·왼쪽 레일·중앙·분할 구조를 구분한다", () => {
  assert.equal(resolveHeaderLayout("top-rule", "#D92D20").container.borderTop, "6px solid #D92D20");
  assert.equal(resolveHeaderLayout("left-rail", "#2457D6").container.borderLeft, "6px solid #2457D6");
  assert.equal(resolveHeaderLayout("centered", "#101828").copy.textAlign, "center");
  assert.equal(resolveHeaderLayout("split-metric", "#0047FF").main.display, "grid");
  assert.equal(resolveHeaderLayout("split-metric", "#0047FF").showMetric, true);
});

test("중앙 제목은 마지막 줄 한두 글자를 피할 때만 기본 크기를 단계적으로 줄인다", () => {
  const shortTitle = "AI 인프라 수요";
  const orphanTitle = "가나다라마바사아자차카타파하라마바사아자차카가나";

  assert.equal(resolveCenteredTitleFontSize(shortTitle, 36, undefined, "centered"), 36);
  assert.equal(resolveCenteredTitleFontSize(orphanTitle, 36, undefined, "centered"), 34);
});

test("직접 지정한 제목 크기와 중앙 외 헤더의 제목 크기는 유지한다", () => {
  const orphanTitle = "가나다라마바사아자차카타파하라마바사아자차카가나";

  assert.equal(resolveCenteredTitleFontSize(orphanTitle, 36, 48, "centered"), 48);
  assert.equal(resolveCenteredTitleFontSize(orphanTitle, 36, undefined, "stacked"), 36);
});

test("일반 Slide_maker 기본형은 순백 중앙 갤러리 헤더와 헤어라인 프레임을 쓴다", () => {
  const preset = getStylePreset("toss-clean");
  const defaults = preset.exportDefaults;

  assert.equal(defaults?.headerVariant, "centered");
  assert.equal(defaults?.frameStyle, "hairline");
  assert.equal(defaults?.backgroundColor, "#FFFFFF");
  assert.equal(defaults?.contentBorder, false);
  assert.equal(defaults?.squareEdges, false);
  assert.equal(preset.export.titleFontSize, 36);
  assert.equal(preset.export.subtitleFontSize, 17);
  assert.equal(preset.export.sourceFontSize, 11);
  assert.equal(preset.tableDefaults?.headerTone, "underline");
  assert.equal(preset.tableDefaults?.groupHeaderTone, "plain");
});

test("시그널 에디토리얼 헤더는 상단 규칙과 우측 핵심 수치를 함께 쓴다", () => {
  const layout = resolveHeaderLayout("signal-editorial", "#0E6B5C");

  assert.equal(layout.container.borderTop, "4px solid #0E6B5C");
  assert.equal(layout.main.display, "grid");
  assert.equal(layout.main.gridTemplateColumns, "minmax(0, 1fr) auto");
  assert.equal(layout.showMetric, true);
});
