import assert from "node:assert/strict";
import test from "node:test";
import { getAnalysisStylePreset, getPresetColors, getPresetRechartsStyle, getStylePreset, usesCompactChartDesign } from "../src/lib/style-presets.ts";
import { mergeOptionDefaults } from "../src/lib/visual-system-options.ts";
import type { ExportOptions } from "../src/lib/analysis/schema.ts";

const compact = (chartType: string, dark = false) => ({
  stylePreset: dark ? "market-terminal" as const : "toss-clean" as const,
  structure: { chartType },
  exportOptions: { chartDesign: "compact-contextual" as const },
});

test("compact profile applies only to the approved bar and line types", () => {
  for (const type of ["bar", "bar_horizontal", "line"]) {
    const analysis = compact(type);
    assert.equal(usesCompactChartDesign(analysis), true);
    const preset = getAnalysisStylePreset(analysis);
    assert.equal(preset.export.titleFontSize, 32);
    assert.equal(preset.export.subtitleFontSize, 15);
    assert.equal(preset.exportDefaults?.showLatestGuide, false);
    assert.equal(getPresetColors(preset, "light").series[0], "#175CD3");
  }
  for (const type of ["table", "donut", "area", "stacked_bar", "combo"]) {
    assert.equal(usesCompactChartDesign(compact(type)), false);
    assert.equal(getAnalysisStylePreset(compact(type)), getStylePreset("toss-clean"));
  }
});

test("legacy JSON and shared presets retain their previous design", () => {
  const original = getStylePreset("toss-clean");
  const snapshot = structuredClone(original);
  getAnalysisStylePreset(compact("line"));
  assert.deepEqual(original, snapshot);
  assert.equal(getAnalysisStylePreset({ stylePreset: "toss-clean", structure: { chartType: "line" } }), original);
});

test("dark compact charts use the approved neutral background and blue series", () => {
  const preset = getAnalysisStylePreset(compact("line", true));
  const colors = getPresetColors(preset, "dark");
  assert.equal(colors.background, "#0B0E14");
  assert.equal(colors.series[0], "#6698FF");
  assert.equal(preset.exportDefaults?.backgroundColor, "#0B0E14");
});

test("explicit chart choices override safe compact defaults", () => {
  const analysis = compact("line");
  const preset = getAnalysisStylePreset(analysis);
  const merged = mergeOptionDefaults<ExportOptions>(preset.exportDefaults, { lineStrokeWidth: 2, showLatestGuide: true });
  assert.equal(merged.lineStrokeWidth, 2);
  assert.equal(merged.showLatestGuide, true);
  assert.equal(getPresetRechartsStyle(analysis, "light").labels.scale, 1);
});
