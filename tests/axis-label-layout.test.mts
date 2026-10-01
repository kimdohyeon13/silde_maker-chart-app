import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_Y_AXIS_WIDTH,
  MIN_Y_AXIS_WIDTH,
  Y_AXIS_TITLE_TOP_SPACE,
  estimateTickLabelWidth,
  resolveEdgeTickAnchor,
  resolveYAxisWidth,
} from "../src/lib/axis-label-layout.ts";

test("숫자 눈금은 한글 눈금보다 좁게 어림한다", () => {
  const digits = estimateTickLabelWidth("110", 20);
  const hangul = estimateTickLabelWidth("백십", 20);
  assert.ok(digits < hangul, `${digits} < ${hangul}`);
  assert.ok(digits > 0);
});

test("짧은 숫자 눈금은 축 폭을 좁히고 긴 눈금은 넓힌다", () => {
  const short = resolveYAxisWidth(["90", "100", "110"], 20);
  const long = resolveYAxisWidth(["1,972 B", "5,505 B"], 20);
  assert.ok(short < long, `${short} < ${long}`);
  assert.ok(short >= MIN_Y_AXIS_WIDTH);
  assert.ok(long <= MAX_Y_AXIS_WIDTH);
});

test("아주 긴 눈금도 상한을 넘지 않는다", () => {
  assert.equal(resolveYAxisWidth(["1,234,567,890억 달러"], 20), MAX_Y_AXIS_WIDTH);
});

test("눈금을 모르면 넘겨받은 기본 폭을 그대로 쓴다", () => {
  assert.equal(resolveYAxisWidth([], 20, 96), 96);
  assert.equal(resolveYAxisWidth(["", ""], 20, 96), 96);
  assert.equal(resolveYAxisWidth([], 20, 999), MAX_Y_AXIS_WIDTH);
  assert.equal(resolveYAxisWidth([], 20, 10), MIN_Y_AXIS_WIDTH);
});

test("X축 양끝 라벨은 안쪽으로 붙이고 가운데는 그대로 둔다", () => {
  assert.equal(resolveEdgeTickAnchor(0, 6), "start");
  assert.equal(resolveEdgeTickAnchor(5, 6), "end");
  assert.equal(resolveEdgeTickAnchor(2, 6), "middle");
});

test("라벨이 하나뿐이거나 개수를 모르면 가운데 정렬을 유지한다", () => {
  assert.equal(resolveEdgeTickAnchor(0, 1), "middle");
  assert.equal(resolveEdgeTickAnchor(0, 0), "middle");
  assert.equal(resolveEdgeTickAnchor(Number.NaN, 6), "middle");
});

test("Y축 제목 자리는 축 제목 글자가 들어갈 만큼 잡는다", () => {
  assert.ok(Y_AXIS_TITLE_TOP_SPACE >= 34);
});
