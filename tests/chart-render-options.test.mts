import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDirectLabelFractionDigits,
  resolveDirectLabelVisibility,
  resolveGridMode,
  shouldRenderTrendLine,
  shouldShowLatestGuide,
  shouldShowAreaFill,
} from "../src/lib/chart-render-options.ts";

test("면 채우기 옵션이 없으면 1~2개 시리즈에만 기본 적용한다", () => {
  assert.equal(shouldShowAreaFill(1), true);
  assert.equal(shouldShowAreaFill(2), true);
  assert.equal(shouldShowAreaFill(3), false);
});

test("슬라이드별 명시 옵션은 기본 규칙보다 우선한다", () => {
  assert.equal(shouldShowAreaFill(1, false), false);
  assert.equal(shouldShowAreaFill(3, true), true);
});

test("직접 라벨과 격자 옵션은 슬라이드별 override를 우선한다", () => {
  assert.equal(resolveDirectLabelVisibility(true), true);
  assert.equal(resolveDirectLabelVisibility(true, false), false);
  assert.equal(resolveGridMode(), "dashed");
  assert.equal(resolveGridMode("none"), "none");
});

test("직접 라벨 정밀도는 0~6자리 범위에서 보존한다", () => {
  assert.equal(resolveDirectLabelFractionDigits(0), 0);
  assert.equal(resolveDirectLabelFractionDigits(0, 2), 2);
  assert.equal(resolveDirectLabelFractionDigits(2, 99), 6);
  assert.equal(resolveDirectLabelFractionDigits(2, -1), 0);
});

test("기존 평균선 규칙은 유지하면서 명시 옵션으로 모든 기준선을 표시한다", () => {
  assert.equal(shouldRenderTrendLine("평균 80"), true);
  assert.equal(shouldRenderTrendLine("안정권 80"), false);
  assert.equal(shouldRenderTrendLine("안정권 80", true), true);
});

test("최신값 가이드선은 데이터가 있고 명시적으로 켠 경우에만 표시한다", () => {
  assert.equal(shouldShowLatestGuide(1), false);
  assert.equal(shouldShowLatestGuide(1, true), true);
  assert.equal(shouldShowLatestGuide(0, true), false);
  assert.equal(shouldShowLatestGuide(2, true), false);
  assert.equal(shouldShowLatestGuide(2, false), false);
  assert.equal(shouldShowLatestGuide(1, true, false), false);
});
