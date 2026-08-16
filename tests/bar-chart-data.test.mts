import assert from "node:assert/strict";
import test from "node:test";

import { buildHorizontalSeriesData } from "../src/lib/bar-chart-data.ts";

test("다중 시리즈 가로 막대는 카테고리별 값을 모두 보존한다", () => {
  const result = buildHorizontalSeriesData([
    {
      name: "현재",
      data: [
        { x: "에너지", y: 122.1, confidence: 1 },
        { x: "헬스케어", y: -9.5, confidence: 1 },
      ],
    },
    {
      name: "3월 말",
      data: [
        { x: "에너지", y: 48.3, confidence: 1 },
        { x: "헬스케어", y: 6.7, confidence: 1 },
      ],
    },
  ]);

  assert.deepEqual(result, [
    { name: "에너지", 현재: 122.1, "3월 말": 48.3 },
    { name: "헬스케어", 현재: -9.5, "3월 말": 6.7 },
  ]);
});

test("후속 시리즈에만 있는 카테고리도 입력 순서대로 추가한다", () => {
  const result = buildHorizontalSeriesData([
    {
      name: "A",
      data: [{ x: "첫째", y: 1, confidence: 1 }],
    },
    {
      name: "B",
      data: [
        { x: "첫째", y: 2, confidence: 1 },
        { x: "둘째", y: 3, confidence: 1 },
      ],
    },
  ]);

  assert.deepEqual(result, [
    { name: "첫째", A: 1, B: 2 },
    { name: "둘째", A: 0, B: 3 },
  ]);
});
