import { wrapCategoryLabel } from "./chart-format.ts";

export type BarCategoryAxisMode = "plain" | "multiline" | "rotated";

export interface BarCategoryAxisLayout {
  mode: BarCategoryAxisMode;
  maxCharsPerLine: number;
  maxLineCount: number;
  xAxisHeight: number;
  bottomMargin: number;
  tickMargin: number;
}

interface BarCategoryAxisLayoutOptions {
  hasLegend?: boolean;
  hasAxisTitle?: boolean;
  yAxisWidth?: number;
  leftMargin?: number;
  rightMargin?: number;
}

function estimateLabelWidth(label: string, fontSize = 14): number {
  return Array.from(label).reduce((width, char) => {
    if (/\s/.test(char)) return width + fontSize * 0.32;
    if (/[\u1100-\u11ff\u3130-\u318f\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(char)) {
      return width + fontSize;
    }
    if (/[A-Z0-9]/.test(char)) return width + fontSize * 0.65;
    return width + fontSize * 0.52;
  }, 0);
}

/**
 * 모든 세로 막대가 공유하는 X축 공간 계산기.
 * 실제 카드 폭과 범주별 슬롯 폭을 기준으로 한 줄, 여러 줄, 회전을 고른다.
 */
export function resolveBarCategoryAxisLayout(
  labels: string[],
  chartWidth: number,
  options: BarCategoryAxisLayoutOptions = {},
): BarCategoryAxisLayout {
  const count = Math.max(labels.length, 1);
  const yAxisWidth = options.yAxisWidth ?? 56;
  const leftMargin = options.leftMargin ?? 8;
  const rightMargin = options.rightMargin ?? 32;
  const availableWidth = Math.max(240, chartWidth - yAxisWidth - leftMargin - rightMargin);
  const slotWidth = Math.max(36, availableWidth / count - 10);
  const maxLabelWidth = Math.max(0, ...labels.map((label) => estimateLabelWidth(label)));
  const maxCharsPerLine = Math.max(5, Math.min(18, Math.floor(slotWidth / 10.5)));
  const needsMoreSpace = maxLabelWidth > slotWidth;
  const mode: BarCategoryAxisMode =
    count > 8 && needsMoreSpace ? "rotated" : needsMoreSpace ? "multiline" : "plain";
  const maxLineCount =
    mode === "multiline"
      ? Math.max(1, ...labels.map((label) => wrapCategoryLabel(label, maxCharsPerLine, 4).length))
      : 1;
  const titleSpace = options.hasAxisTitle ? 20 : 0;
  const legendSpace = options.hasLegend ? 8 : 0;

  if (mode === "rotated") {
    return {
      mode,
      maxCharsPerLine,
      maxLineCount,
      xAxisHeight: 92 + titleSpace,
      bottomMargin: 32 + legendSpace,
      tickMargin: 14,
    };
  }

  if (mode === "multiline") {
    return {
      mode,
      maxCharsPerLine,
      maxLineCount,
      xAxisHeight: 34 + maxLineCount * 18 + titleSpace,
      bottomMargin: 22 + legendSpace,
      tickMargin: 12,
    };
  }

  return {
    mode,
    maxCharsPerLine,
    maxLineCount,
    xAxisHeight: 42 + titleSpace,
    bottomMargin: 18 + legendSpace,
    tickMargin: 10,
  };
}
