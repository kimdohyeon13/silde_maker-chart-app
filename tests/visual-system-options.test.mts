import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeOptionDefaults,
  mergeTableVisualDefaults,
} from "../src/lib/visual-system-options.ts";

test("개별 JSON의 false 값도 시각 프리셋 기본값보다 우선한다", () => {
  type ExportLike = {
    showLatestGuide?: boolean;
    showAreaFill?: boolean;
    lineStrokeWidth?: number;
  };
  const merged = mergeOptionDefaults<ExportLike>(
    { showLatestGuide: true, showAreaFill: false, lineStrokeWidth: 4 },
    { showLatestGuide: false },
  );

  assert.equal(merged.showLatestGuide, false);
  assert.equal(merged.showAreaFill, false);
  assert.equal(merged.lineStrokeWidth, 4);
});

test("표 시각 옵션은 폰트 크기만 중첩 병합하고 나머지는 JSON을 우선한다", () => {
  type TableLike = {
    headerTone?: string;
    rowRules?: string;
    fontSize?: Partial<{ header: string; body: string }>;
  };
  const merged = mergeTableVisualDefaults<TableLike>(
    {
      headerTone: "underline",
      rowRules: "soft",
      fontSize: { header: "13px", body: "14px" },
    },
    {
      rowRules: "none",
      fontSize: { body: "16px" },
    },
  );

  assert.equal(merged.headerTone, "underline");
  assert.equal(merged.rowRules, "none");
  assert.deepEqual(merged.fontSize, { header: "13px", body: "16px" });
});
