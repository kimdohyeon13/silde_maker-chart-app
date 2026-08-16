import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanSourceText,
  formatAxisLabel,
  formatAxisTickLabel,
  formatValueWithUnit,
  generateNiceTicks,
  getAxisFractionDigits,
  getInlineLabelUnit,
  getTickUnit,
  matchTickToDataKey,
  normalizeXKey,
  wrapCategoryLabel,
} from "../src/lib/chart-format.ts";

test("축 단위는 중복 없이 쉬운 말로 한 번만 표시한다", () => {
  assert.equal(formatAxisLabel("십억달러", "$bn"), "10억 달러");
  assert.equal(formatAxisLabel("매출 증분", "$bn"), "매출 증분 (10억 달러)");
  assert.equal(formatAxisLabel("매출 총이익률", "%"), "매출 총이익률 (%)");
});

test("긴 범주 라벨은 단어 경계에서 여러 줄로 나눈다", () => {
  assert.deepEqual(wrapCategoryLabel("5년 계약가 기준 (B300)", 10), [
    "5년 계약가 기준",
    "(B300)",
  ]);
});

test("실제 월·소수 값은 축 라벨에서 보존한다", () => {
  assert.equal(formatAxisTickLabel("2023.07"), "2023.07");
  assert.equal(formatAxisTickLabel("4.48"), "4.48");
  assert.equal(normalizeXKey("2023.07"), "2023.07");
  assert.equal(normalizeXKey("4.48"), "4.48");
});

test("정수형 레거시 소수 표기만 정리한다", () => {
  assert.equal(formatAxisTickLabel("24.00"), "24");
  assert.equal(formatAxisTickLabel("-15.0"), "-15");
  assert.equal(formatAxisTickLabel("26F.04"), "26F");
  assert.equal(normalizeXKey("24.00"), "24");
  assert.equal(normalizeXKey("26F.04"), "26F");
});

test("날짜·반기·회계분기 라벨을 사람이 읽기 쉽게 바꾼다", () => {
  assert.equal(formatAxisTickLabel("2026-07-10"), "7/10");
  assert.equal(formatAxisTickLabel("2026-07"), "2026.07");
  assert.equal(formatAxisTickLabel("24.06.2"), "24.06 중");
  assert.equal(formatAxisTickLabel("FY1Q26E"), "1Q26E");
  assert.equal(formatAxisTickLabel("기준"), "기준");
});

test("눈금 키는 정확·정규화·접두 순서로 실제 데이터 키를 찾는다", () => {
  const dataKeys = ["2024.00", "26F.04", "2026-07-10"];

  assert.equal(matchTickToDataKey("2026-07-10", dataKeys), "2026-07-10");
  assert.equal(matchTickToDataKey("2024", dataKeys), "2024.00");
  assert.equal(matchTickToDataKey("26F", dataKeys), "26F.04");
  assert.equal(matchTickToDataKey("2026", dataKeys), "2026-07-10");
  assert.equal(matchTickToDataKey("없음", dataKeys), undefined);
});

test("축과 직접 라벨에는 짧고 중복되지 않는 단위만 붙인다", () => {
  assert.equal(getTickUnit(), "");
  assert.equal(getTickUnit("2020=100"), "");
  assert.equal(getTickUnit("%", "증가율(%)"), "");
  assert.equal(getTickUnit("%"), "%");
  assert.equal(getTickUnit("/bbl"), "/bbl");
  assert.equal(getTickUnit("십억달러"), "");
  assert.equal(getInlineLabelUnit("bp"), "bp");
});

test("값과 단위는 통화 접두·비율 접미 규칙으로 표시한다", () => {
  assert.equal(formatValueWithUnit(1234, ""), "1,234");
  assert.equal(formatValueWithUnit(16, "$"), "$16");
  assert.equal(formatValueWithUnit(16, "$/bbl"), "$16/bbl");
  assert.equal(formatValueWithUnit(4.48, "%", 2), "4.48%");
  assert.equal(formatValueWithUnit(3, "/oz"), "3/oz");
  assert.equal(formatValueWithUnit(2, "배"), "2배");
});

test("눈금 소수 자릿수는 인접 간격과 범위에 맞춰 결정한다", () => {
  assert.equal(getAxisFractionDigits(undefined, undefined, [0, 0.05, 0.1]), 2);
  assert.equal(getAxisFractionDigits(undefined, undefined, [0, 0.5, 1]), 1);
  assert.equal(getAxisFractionDigits(undefined, undefined, [0, 5, 10]), 0);
  assert.equal(getAxisFractionDigits(0, 0.05), 2);
  assert.equal(getAxisFractionDigits(0, 0.5), 1);
  assert.equal(getAxisFractionDigits(0, 5), 0);
});

test("보기 좋은 균등 눈금을 만들고 잘못된 범위는 거부한다", () => {
  assert.deepEqual(generateNiceTicks(), []);
  assert.deepEqual(generateNiceTicks(5, 5), []);
  assert.deepEqual(generateNiceTicks(0, 10, 6), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(generateNiceTicks(0.1, 0.3, 3), [0.1, 0.2, 0.3]);
  assert.deepEqual(generateNiceTicks(10, 0, 3), [0, 5, 10]);
});

test("원문 출처는 보존하고 내부 메타데이터만 제거한다", () => {
  assert.equal(cleanSourceText(), "");
  assert.equal(cleanSourceText("자료: LSEG, 신한투자증권"), "자료: LSEG, 신한투자증권");
  assert.equal(cleanSourceText("Bloomberg / 미래에셋증권"), "Bloomberg / 미래에셋증권");
  assert.equal(cleanSourceText("자료: 신한투자증권"), "자료: 신한투자증권");
  assert.equal(cleanSourceText("출처: FactSet"), "출처: FactSet");
});

test("최종 출처 줄에서는 내부 제작 메타데이터를 제거한다", () => {
  assert.equal(
    cleanSourceText(
      "자료: TSMC IR (2026-07-16) · source-visible · 저장소 기존 검증 데이터 재사용",
    ),
    "자료: TSMC IR (2026-07-16)",
  );
  assert.equal(
    cleanSourceText("Source: Yahoo Finance, close of 2026-08-04 · source-visible"),
    "Source: Yahoo Finance, close of 2026-08-04",
  );
  assert.equal(cleanSourceText("자료: Bloomberg · 데이터 상태: directional"), "자료: Bloomberg");
});
