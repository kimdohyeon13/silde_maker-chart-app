import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_HEAD_MESSAGE_WEIGHT,
  DEFAULT_SUB_MESSAGE_WEIGHT,
  PAPERLOGY_FONT_STACK,
  resolveSubMessageWeight,
} from "../src/lib/slide-typography.ts";
import { getStylePresetOptions } from "../src/lib/style-presets.ts";

test("새 슬라이드는 Paperlogy 제목 900·서브메시지 300 위계를 기본으로 쓴다", () => {
  assert.match(PAPERLOGY_FONT_STACK, /^"Paperlogy"/);
  assert.equal(DEFAULT_HEAD_MESSAGE_WEIGHT, 900);
  assert.equal(DEFAULT_SUB_MESSAGE_WEIGHT, 300);
});

test("모든 활성 프리셋은 Paperlogy 900/300 규칙을 따른다", () => {
  const activePresets = getStylePresetOptions();

  assert.equal(activePresets.length, 4);
  activePresets.forEach((preset) => {
    assert.match(preset.typography.fontFamily ?? "", /^"Paperlogy"/);
    assert.equal(preset.typography.titleWeight, DEFAULT_HEAD_MESSAGE_WEIGHT);
    assert.equal(preset.typography.subtitleWeight, DEFAULT_SUB_MESSAGE_WEIGHT);
  });
});

test("유효한 장표별 예외만 기본 서브메시지 굵기보다 우선한다", () => {
  assert.equal(resolveSubMessageWeight(undefined, 300), 300);
  assert.equal(resolveSubMessageWeight(400, 300), 400);
  assert.equal(resolveSubMessageWeight(99, 300), 300);
  assert.equal(resolveSubMessageWeight(901, 300), 300);
  assert.equal(resolveSubMessageWeight(Number.NaN, 300), 300);
  assert.equal(resolveSubMessageWeight("700", 300), 300);
  assert.equal(resolveSubMessageWeight(undefined, 950), 300);
});
