import assert from "node:assert/strict";
import test from "node:test";

import { resolveBarCategoryAxisLayout } from "../src/lib/bar-axis-layout.ts";

test("짧은 범주는 한 줄 X축을 유지한다", () => {
  const layout = resolveBarCategoryAxisLayout(["A", "B", "C", "D"], 860);

  assert.equal(layout.mode, "plain");
  assert.equal(layout.maxLineCount, 1);
});

test("긴 범주는 실제 카드 폭에 맞춰 여러 줄 공간을 예약한다", () => {
  const layout = resolveBarCategoryAxisLayout(
    ["5년 계약 (B300)", "온디맨드 (B300)", "스페이스X-앤스로픽 (H100/H200/GB200)", "스페이스X-앤스로픽 (GB300 추정)"],
    860,
    { hasLegend: false },
  );

  assert.equal(layout.mode, "multiline");
  assert.ok(layout.maxLineCount >= 2);
  assert.ok(layout.xAxisHeight >= 70);
});

test("좁은 카드에서는 같은 범주에 더 많은 X축 높이를 확보한다", () => {
  const labels = ["장기 계약 고객", "온디맨드 고객", "대형 전략 고객", "차세대 장비 고객"];
  const wide = resolveBarCategoryAxisLayout(labels, 900);
  const narrow = resolveBarCategoryAxisLayout(labels, 520);

  assert.ok(narrow.xAxisHeight >= wide.xAxisHeight);
  assert.ok(narrow.maxCharsPerLine < wide.maxCharsPerLine);
});
