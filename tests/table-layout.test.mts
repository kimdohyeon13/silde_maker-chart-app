import assert from "node:assert/strict";
import test from "node:test";

import { resolveAdaptiveTableRowHeight } from "../src/lib/table-layout.ts";

test("7개 데이터 행은 16:9 하단 공백을 줄이도록 행 높이를 넓힌다", () => {
  assert.equal(
    resolveAdaptiveTableRowHeight({
      canvasHeight: 540,
      dataRowCount: 7,
      groupRowCount: 2,
      baseRowHeight: 29,
    }),
    47,
  );
});

test("9개 데이터 행은 그룹 수에 따라 안전한 높이로 맞춘다", () => {
  assert.equal(
    resolveAdaptiveTableRowHeight({
      canvasHeight: 540,
      dataRowCount: 9,
      groupRowCount: 2,
      baseRowHeight: 29,
    }),
    37,
  );
  assert.equal(
    resolveAdaptiveTableRowHeight({
      canvasHeight: 540,
      dataRowCount: 9,
      groupRowCount: 3,
      baseRowHeight: 29,
    }),
    35,
  );
});

test("행이 많거나 캔버스가 없으면 기존 최소 높이를 지킨다", () => {
  assert.equal(
    resolveAdaptiveTableRowHeight({
      canvasHeight: 540,
      dataRowCount: 14,
      groupRowCount: 3,
      baseRowHeight: 29,
    }),
    29,
  );
  assert.equal(
    resolveAdaptiveTableRowHeight({
      dataRowCount: 7,
      groupRowCount: 2,
      baseRowHeight: 29,
    }),
    29,
  );
});
