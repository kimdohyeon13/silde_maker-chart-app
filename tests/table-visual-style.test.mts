import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDataBarStyle,
  resolveTableColumnGroups,
  resolveTableFontWeights,
  resolveTableVisualStyle,
} from "../src/lib/table-visual-style.ts";

const palette = {
  surfaceHover: "#F2F4F7",
  textPrimary: "#101828",
  textSecondary: "#475467",
  borderSubtle: "#E4E7EC",
  accent: "#2457D6",
  accentSubtle: "#EEF4FF",
};

test("인버스 헤더와 강한 행 구분선을 만든다", () => {
  const style = resolveTableVisualStyle(
    { headerTone: "inverse", rowRules: "strong", accentColor: "#0B1F3A" },
    palette,
    true,
  );

  assert.equal(style.header.background, "#0B1F3A");
  assert.equal(style.header.color, "#FFFFFF");
  assert.equal(style.cell.borderBottom, "2px solid #E4E7EC");
  assert.equal(style.badgeRadius, 0);
});

test("언더라인 헤더와 그룹 액센트 레일을 조합한다", () => {
  const style = resolveTableVisualStyle(
    {
      headerTone: "underline",
      rowRules: "soft",
      groupHeaderTone: "accent-rule",
      accentColor: "#D92D20",
      columnRules: true,
      sectionRules: true,
      sectionRuleColor: "#CBD5E1",
    },
    palette,
    true,
  );

  assert.equal(style.header.background, "transparent");
  assert.equal(style.header.borderBottom, "3px solid #101828");
  assert.equal(style.groupHeader.borderLeft, "5px solid #D92D20");
  assert.equal(style.cell.borderRight, "1px solid #E4E7EC");
  assert.equal(style.sectionDivider, "2px solid #CBD5E1");
});

test("그룹 행 배경은 명시한 표 강조색의 옅은 색을 쓴다", () => {
  const style = resolveTableVisualStyle(
    {
      headerTone: "inverse",
      groupHeaderTone: "band",
      accentColor: "#0B1F3A",
    },
    palette,
    true,
  );

  assert.equal(style.groupHeader.background, "rgba(11, 31, 58, 0.08)");
  assert.equal(style.groupHeader.color, "#0B1F3A");
});

test("인셀 데이터 바는 절댓값 비율을 읽기 쉬운 폭으로 제한한다", () => {
  assert.equal(resolveDataBarStyle(0, 100, "#0E6B5C"), undefined);
  assert.deepEqual(resolveDataBarStyle(50, 100, "#0E6B5C"), {
    background: "#0E6B5C",
    bottom: 5,
    height: 3,
    opacity: 0.22,
    width: "44%",
  });
  assert.equal(resolveDataBarStyle(200, 100, "#0E6B5C")?.width, "88%");
  assert.equal(resolveDataBarStyle(-2, 100, "#2563EB")?.width, "8%");
});

test("인셀 데이터 바 옵션은 과도한 값도 안전 범위로 보정한다", () => {
  assert.deepEqual(
    resolveDataBarStyle(25, 100, "#D92D20", {
      minWidthPercent: -20,
      maxWidthPercent: 140,
      height: 0,
      opacity: 4,
      bottom: -2,
    }),
    {
      background: "#D92D20",
      bottom: 0,
      height: 1,
      opacity: 1,
      width: "25%",
    },
  );
});

test("열 그룹은 JSON 배열 순서가 아니라 실제 열 순서대로 묶는다", () => {
  assert.deepEqual(
    resolveTableColumnGroups(
      ["ticker", "keyword", "current", "m1", "target", "eps"],
      [
        { label: "컨센서스", keys: ["target"] },
        { label: "종목", keys: ["ticker", "keyword"] },
        { label: "가격·모멘텀", keys: ["current", "m1", "missing"] },
        { label: "성장·밸류", keys: ["eps"] },
      ],
    ),
    [
      { label: "종목", keys: ["ticker", "keyword"], colSpan: 2 },
      { label: "가격·모멘텀", keys: ["current", "m1"], colSpan: 2 },
      { label: "컨센서스", keys: ["target"], colSpan: 1 },
      { label: "성장·밸류", keys: ["eps"], colSpan: 1 },
    ],
  );
});

test("그룹이 빠진 열과 중복 지정된 열도 표 너비를 잃지 않는다", () => {
  assert.deepEqual(
    resolveTableColumnGroups(
      ["ticker", "current", "target", "pe"],
      [
        { label: "종목", keys: ["ticker", "current"] },
        { label: "가격", keys: ["current", "target"] },
      ],
    ),
    [
      { label: "종목", keys: ["ticker", "current"], colSpan: 2 },
      { label: "가격", keys: ["target"], colSpan: 1 },
      { label: "", keys: ["pe"], colSpan: 1 },
    ],
  );
});

test("표 숫자 굵기를 낮춰도 헤더와 행 식별자는 독립적으로 유지한다", () => {
  assert.deepEqual(
    resolveTableFontWeights({
      body: 500,
      numeric: 550,
      rowHeader: 700,
      header: 650,
    }),
    {
      body: 500,
      numeric: 550,
      rowHeader: 700,
      header: 650,
      total: 800,
      groupHeader: 800,
      columnGroup: 700,
    },
  );
});

test("표 글자 굵기는 100~900 범위 밖의 값을 안전하게 보정한다", () => {
  const weights = resolveTableFontWeights({
    body: 20,
    numeric: 1200,
    header: Number.NaN,
  });

  assert.equal(weights.body, 100);
  assert.equal(weights.numeric, 900);
  assert.equal(weights.header, 800);
});
