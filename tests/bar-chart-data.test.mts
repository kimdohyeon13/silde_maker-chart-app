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
    { name: "에너지", 현재: 122.1, "현재__label": "", "3월 말": 48.3, "3월 말__label": "" },
    { name: "헬스케어", 현재: -9.5, "현재__label": "", "3월 말": 6.7, "3월 말__label": "" },
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
    { name: "첫째", A: 1, "A__label": "", B: 2, "B__label": "" },
    { name: "둘째", A: 0, "A__label": "", B: 3, "B__label": "" },
  ]);
});

test("가로 막대의 내부 키는 화면 라벨로만 치환하고 값 조회는 보존한다", () => {
  const result = buildHorizontalSeriesData(
    [{
      name: "등락률",
      data: [
        { x: "p1", y: 6.67, confidence: 1, displayLabel: "+6.67%" },
        { x: "p2", y: -0.83, confidence: 1, displayLabel: "-0.83%" },
      ],
    }],
    new Map([["p1", "루멘텀"], ["p2", "샌디스크"]]),
  );

  assert.deepEqual(result, [
    { name: "루멘텀", 등락률: 6.67, "등락률__label": "+6.67%" },
    { name: "샌디스크", 등락률: -0.83, "등락률__label": "-0.83%" },
  ]);
});
