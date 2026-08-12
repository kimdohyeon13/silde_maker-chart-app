/**
 * =====================================================
 * TossBarChart — 토스증권 스타일 막대 차트
 * =====================================================
 *
 * 비교/순위 데이터에 적합합니다.
 * 예: 업종별 수익률, 월별 매출, 국가별 GDP 등
 *
 * 토스 스타일 특징:
 * - 둥근 모서리 막대 (radius)
 * - 가장 큰/작은 막대에 자동 강조
 * - 음수 값은 하락 색상으로 자동 구분
 * - 세로 격자선 없음, 가로만
 */

"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot,
  LabelList,
} from "recharts";
import type { ChartAnalysis, ExportOptions } from "@/lib/analysis/schema";
import {
  getAnalysisStylePreset,
  getAnalysisThemeMode,
  getPresetColors,
  getPresetRechartsStyle,
} from "@/lib/style-presets";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";
import { formatNumber, formatNumberEn } from "@/lib/analysis/insight-engine";
import { chartSettings } from "@/lib/chart-settings";
import {
  formatAxisTickLabel,
  getTickUnit,
  formatValueWithUnit,
  getAxisFractionDigits,
  generateNiceTicks,
} from "@/lib/chart-format";
import { mergeOptionDefaults } from "@/lib/visual-system-options";
import { buildHorizontalSeriesData } from "@/lib/bar-chart-data";

interface TossBarChartProps {
  analysis: ChartAnalysis;
  theme?: ThemeMode;
  width?: number | `${number}%`;
  height?: number;
  showLabels?: boolean;
  animated?: boolean;
}

type StackedDatum = {
  name: string;
  value: number;
  __total: number;
  [seriesName: string]: string | number;
};

export default function TossBarChart({
  analysis,
  theme: themeMode = "dark",
  width = "100%",
  height = 350,
  showLabels = true,
  animated = true,
}: TossBarChartProps) {
  const renderThemeMode = getAnalysisThemeMode(analysis, themeMode);
  const theme = getTheme(renderThemeMode);
  const preset = getAnalysisStylePreset(analysis);
  const styles = getPresetRechartsStyle(analysis, themeMode);
  const colors = getPresetColors(preset, renderThemeMode);
  const exportOptions = mergeOptionDefaults<ExportOptions>(
    preset.exportDefaults,
    analysis.exportOptions,
  );
  const squareEdges = !!exportOptions.squareEdges;
  const compactChartMargins = exportOptions.compactChartMargins === true;
  // 영문 덱은 값 라벨에 "만"·"억" 축약을 쓰지 않는다(기본값 ko는 기존 동작 그대로).
  const fmt = exportOptions.numberLocale === "en" ? formatNumberEn : formatNumber;

  const firstSeries = analysis.data.series[0];
  if (!firstSeries) return null;
  const chartType = analysis.structure.chartType;
  const isStackedBarChart = chartType === "stacked_bar";
  const isHorizontalBarChart = chartType === "bar_horizontal";
  const horizontalBarSeries = isHorizontalBarChart
    ? analysis.data.series.filter((series) => series.renderAs !== "line")
    : [];
  const horizontalChartData = isHorizontalBarChart
    ? buildHorizontalSeriesData(horizontalBarSeries)
    : [];

  const stackedBarSeries = isStackedBarChart
    ? analysis.data.series.filter((series) => (series.renderAs ?? "bar") !== "line")
    : [];
  const stackedLineSeries = isStackedBarChart
    ? analysis.data.series.filter((series) => series.renderAs === "line")
    : [];
  const stackedCategories = Array.from(
    new Set(stackedBarSeries.flatMap((series) => series.data.map((point) => String(point.x))))
  );
  const stackedChartData: StackedDatum[] = stackedCategories.map((name) => {
    const row: StackedDatum = { name, value: 0, __total: 0 };

    stackedBarSeries.forEach((series) => {
      const value =
        series.data.find((point) => String(point.x) === name)?.y ?? 0;
      row[series.name] = value;
      row.__total += value;
    });

    stackedLineSeries.forEach((series) => {
      const value =
        series.data.find((point) => String(point.x) === name)?.y ?? 0;
      row[series.name] = value;
    });

    const maxLineValue = Math.max(
      0,
      ...stackedLineSeries.map((series) => Number(row[series.name] ?? 0))
    );
    row.value = Math.max(row.__total, maxLineValue);
    return row;
  });

  // Recharts 형식으로 변환
  const chartData =
    isStackedBarChart && stackedChartData.length > 0
      ? stackedChartData.map((point) => ({
          name: point.name,
          value: point.value,
        }))
      : firstSeries.data.map((point) => ({
          name: String(point.x),
          value: point.y,
        }));

  // 최댓값/최솟값 인덱스 (강조용)
  const maxIndex = chartData.reduce(
    (maxI, item, i, arr) => (item.value > arr[maxI].value ? i : maxI),
    0
  );
  const minIndex = chartData.reduce(
    (minI, item, i, arr) => (item.value < arr[minI].value ? i : minI),
    0
  );

  // 기준선(평균/기준) — 원본 충실 [A6-a]
  // → 예전에는 statistics.summary.average를 항상 그려서, 원본에 평균선이 없는
  //   막대차트에도 "평균 126.6" 같은 가짜 선이 생겼다(환각).
  // → 이제는 원본 분석이 명시적으로 잡아낸 추세선(emphasis.trendLines) 중
  //   라벨에 "평균" 또는 "기준"이 들어간 항목이 있을 때만 그 값으로 기준선을 그린다.
  //   그런 추세선이 없으면 기준선을 아예 그리지 않는다.
  const baselineTrend = analysis.emphasis.trendLines.find(
    (line) => line.label != null && /평균|기준/.test(line.label)
  );
  // 수평 기준선의 대표 y값(시작/끝이 같은 수평선이므로 to.y를 사용)
  const baselineValue = baselineTrend?.to.y;

  // 막대 색상 결정 함수
  // → 모든 양수 막대를 빨간 계열로 칠하면 전체가 강조처럼 보여 시선이 퍼진다.
  // → 기본 막대는 차분한 중립색, 최댓값/음수 같은 "읽어야 할 곳"에만 강조색을 쓴다.
  const colorStrategy = analysis.emphasis.colorStrategy;
  const neutralBar =
    colorStrategy?.secondary?.[0] ??
    (renderThemeMode === "light" ? "#AEB8C6" : "#6E7681");
  const neutralBarSubtle = colorStrategy?.secondary?.[1] ?? neutralBar;
  const positiveAccent =
    colorStrategy?.accent ??
    colorStrategy?.positive ??
    (renderThemeMode === "light" ? "#D92D3A" : "#FF6B6B");
  const negativeAccent =
    colorStrategy?.negative ??
    (renderThemeMode === "light" ? "#2563EB" : "#4DABF7");
  const negativeSubtle =
    colorStrategy?.secondary?.[1] ??
    (renderThemeMode === "light" ? "#8DB7F0" : "#74B9FF");
  const positiveSeriesColor =
    analysis.structure.legend[0]?.remakeColor ??
    colorStrategy?.primary ??
    colorStrategy?.positive ??
    positiveAccent;
  const stackPalette =
    renderThemeMode === "light"
      ? ["#D8E0EA", "#BFCAD7", "#9EADBE", "#6F8094"]
      : ["#38414D", "#4B5664", "#657487", "#8492A6"];

  function getBarColor(value: number, index: number): string {
    if (exportOptions.barColorMode === "sign") {
      return value < 0 ? negativeAccent : positiveSeriesColor;
    }
    if (value < 0) return index === minIndex ? negativeAccent : negativeSubtle;
    if (index === maxIndex) return positiveAccent;
    return chartData.length <= 5 ? neutralBar : neutralBarSubtle;
  }

  function getStackColor(index: number, seriesName?: string): string {
    // JSON에서 시리즈 색을 지정했으면 그것을 먼저 쓴다. 고정 팔레트는 4색뿐이라
    // 시리즈가 5개 이상이면 첫 색이 되풀이돼 구분이 사라진다.
    const declared = analysis.structure.legend.find(
      (item) => item.name === seriesName,
    )?.remakeColor;
    return declared ?? stackPalette[index % stackPalette.length];
  }

  // X축 라벨 간격 — chartSettings 기반
  const xLabelInterval = (() => {
    const len = chartData.length;
    const maxLabels = chartSettings.xAxis.maxVisibleLabels;
    if (len <= maxLabels) return 0;
    return Math.ceil(len / maxLabels);
  })();
  // [D4] 막대 카테고리 라벨은 개수와 무관하게 "전부" 표시한다.
  // → 예전 임계(>12)에선 업종 막대 10개가 안 걸려 솎기(xLabelInterval)가 적용,
  //   10개 중 4개만 보이고 나머지 업종명이 사라졌다(page-15-t1).
  // → 임계를 8로 낮춰, 8개 초과면 -45도 회전 + interval={0}으로 모든 라벨을 강제 표시한다.
  //   (회전했으니 라벨이 겹치지 않으므로 솎을 이유가 없다.)
  const isDenseBarChart = chartData.length > 8;
  const hasLongDenseCategoryLabels =
    isDenseBarChart && chartData.some((point) => point.name.length > 6);
  const denseXAxisHeight = hasLongDenseCategoryLabels ? 86 : 56;
  const denseBottomMargin = hasLongDenseCategoryLabels ? 92 : 42;
  const denseTickMargin = hasLongDenseCategoryLabels ? 14 : 8;
  const xAxisWithDisplay = analysis.structure.xAxis as typeof analysis.structure.xAxis & {
    displayTickValues?: string[];
  };
  const sourceTickValues = (xAxisWithDisplay.tickValues ?? []).map(String);
  const displayTickValues = (xAxisWithDisplay.displayTickValues ?? []).map(String);
  const displayLabelByKey = new Map<string, string>();
  let visibleCategoryTicks: string[] | undefined;
  if (displayTickValues.length > 0) {
    if (sourceTickValues.length === displayTickValues.length) {
      sourceTickValues.forEach((tick, index) => {
        displayLabelByKey.set(tick, displayTickValues[index]);
      });
      visibleCategoryTicks = sourceTickValues;
    } else {
      visibleCategoryTicks = displayTickValues;
    }
  }
  function formatCategoryTick(value: string | number): string {
    const key = String(value);
    return displayLabelByKey.get(key) ?? formatAxisTickLabel(key);
  }

  // ─────────────────────────────────────────────
  // [D2] Y축 자동 눈금 균등화/중복 제거
  // ─────────────────────────────────────────────
  // 왜 필요한가?
  // → JSON에 tickValues가 없으면 Recharts 자동 눈금이 '1,1,2,2'(중복, 0.5 간격을 정수 반올림)·
  //   '80/240/400'(비균등)처럼 깨진다(page-15-t1 / page-14-t1).
  // → 그래서 tickValues가 없을 때만 도메인(min~max)에서 1·2·5·10 계열 균등 눈금을 직접 만들어 넘긴다.
  //   도메인도 그 눈금의 처음/끝으로 맞춰 0/1/2/3 또는 0/100/200/300/400 같은 균등 눈금이 나오게 한다.
  // ⚠️ min/max는 analysis.structure.yAxis.min/max를 쓰되, 없으면 데이터(값)에서 극값을 계산한다.

  // 데이터 실제 극값(음수 도메인 보강의 기준). 빈 배열이면 각각 0/0.
  // → 막대 하나하나의 값에서 최솟값/최댓값을 직접 구한다.
  const dataMin = chartData.reduce(
    (min, d) => (d.value < min ? d.value : min),
    chartData.length > 0 ? chartData[0].value : 0
  );
  const dataMax = chartData.reduce(
    (max, d) => (d.value > max ? d.value : max),
    chartData.length > 0 ? chartData[0].value : 0
  );

  // 명시 min(없으면 데이터 최솟값, 양수만 있으면 0 기준으로 내려 0 눈금이 보이게)
  // ⚠️ [D2-음수] 핵심: 명시 min이 있어도 그 값이 음수 데이터보다 "위"면(예: JSON이
  //   기본값 min:0을 줬는데 데이터엔 -15가 있는 경우) 음수 막대 하한이 잘려 막대가
  //   0 기준선 아래로 안 그려진다. 따라서 명시 min이 있더라도 데이터 최솟값과
  //   비교해 더 낮은 쪽을 채택한다(음수를 절대 잘라먹지 않는다).
  const yMin = (() => {
    const explicit = analysis.structure.yAxis.min;
    // 양수 데이터일 때 0부터 그리기 위한 기본 하한(명시값이 없을 때만 적용)
    const dataFloor =
      chartData.length === 0 ? 0 : dataMin > 0 ? 0 : dataMin;
    if (explicit == null) return dataFloor;
    // 명시값이 있더라도 음수 데이터가 명시값보다 아래면 데이터 최솟값까지 내린다.
    return Math.min(explicit, dataMin);
  })();
  // 명시 max(없으면 데이터 최댓값, 음수만 있으면 0)
  // → 대칭으로, 명시 max가 양수 데이터보다 "아래"면 양수 막대 상단이 잘리므로 올린다.
  const rawYMax = (() => {
    const explicit = analysis.structure.yAxis.max;
    const dataCeil =
      chartData.length === 0 ? 100 : dataMax < 0 ? 0 : dataMax;
    if (explicit == null) return dataCeil;
    return Math.max(explicit, dataMax);
  })();
  // JSON 명시 눈금(있으면 그대로) → 없으면 generateNiceTicks로 균등 눈금 생성
  const explicitYTicks = (analysis.structure.yAxis.tickValues ?? [])
    .map((tick) => Number(tick))
    .filter((tick) => Number.isFinite(tick));
  // Y축 상단이 데이터보다 지나치게 크면 막대가 바닥에 붙어 보인다.
  // 명시 max라도 데이터의 2.4배를 넘으면 export 가독성 기준으로 부드럽게 축소한다.
  const yMax = (() => {
    if (dataMax <= 0) return rawYMax;
    if (rawYMax > dataMax * 2.4 && explicitYTicks.length === 0) {
      return dataMax * 1.18;
    }
    return rawYMax;
  })();

  const yAxisTicks =
    explicitYTicks.length > 0 ? explicitYTicks : generateNiceTicks(yMin, yMax);

  function getAxisLabel(label = "", unit = ""): string {
    if (label && label !== "값") return unit ? `${label} (${unit})` : label;
    return unit || label;
  }
  const yAxisLabel = getAxisLabel(
    analysis.structure.yAxis.label,
    analysis.structure.yAxis.unit,
  );

  // ─────────────────────────────────────────────
  // [BAR-강조] highlightZones / annotations 렌더 준비
  // ─────────────────────────────────────────────
  // 왜 필요한가?
  // → 막대차트는 그동안 ReferenceLine(평균/0선)만 그렸고, 원본 분석이 잡아낸
  //   emphasis.highlightZones(상위 막대 음영 밴드)와 emphasis.annotations(콜아웃)를
  //   "전혀" 렌더하지 않았다. 그래서 page-15-t1의 '전체 이익 성장의 61% 설명' 콜아웃,
  //   page-06-t2의 음영밴드+번호 콜아웃이 데이터에 복원돼도 PNG에 안 그려졌다.
  // → 여기서 막대 카테고리(name) 기준으로 음영 구간과 주석을 함께 그린다.
  // ⚠️ 빈 배열이면 .map/.filter가 아무것도 그리지 않으므로, 기존 막대차트(강조 없음)는 영향 없음.

  // 텍스트 정리: 개행(\n)은 SVG에서 무시되므로 공백으로 바꾸고, 너무 길면 말줄임표로 자른다.
  // → chart-settings.ts는 건드리지 않기로 했으므로 길이 제한은 이 파일 지역 상수로 둔다.
  const ANNOTATION_MAX_TEXT_LENGTH = 22; // 막대 위 콜아웃 한 줄 기준 글자수
  const HIGHLIGHT_ZONE_OPACITY = 0.12; // 음영 구간 투명도(옅게 — 막대 가독성 유지)
  const MAX_ANNOTATIONS = 4; // 화면이 빽빽해지지 않도록 중요도 상위 N개만 표시
  function cleanText(text: string): string {
    const cleaned = text.replace(/\n/g, " ");
    if (cleaned.length > ANNOTATION_MAX_TEXT_LENGTH) {
      return cleaned.slice(0, ANNOTATION_MAX_TEXT_LENGTH) + "…";
    }
    return cleaned;
  }

  // [BAR-중복제거] 같은 문구가 음영밴드 라벨과 콜아웃에 둘 다 그려지는 것을 막는다.
  // → page-15-t1에서 highlightZone.label("전체 이익 성장의 61% 설명")과
  //   annotation.text(같은 문구)가 둘 다 렌더돼 같은 말이 위·아래로 두 번 나왔다.
  // → 정규화(공백/말줄임표 제거, 소문자화) 후 비교해 동일하면 음영밴드는 "라벨 없이
  //   배경 음영만" 그리고, 그 문구는 콜아웃(annotation) 한쪽에서만 표시한다.
  function normalizeText(text: string): string {
    return text
      .replace(/\s+/g, "") // 모든 공백 제거(개행/스페이스 차이 무시)
      .replace(/…+$/, "") // 말줄임표 꼬리 제거(자른 버전과 원본을 같게 본다)
      .toLowerCase();
  }
  // 콜아웃으로 표시될 주석 텍스트 집합(정규화된 형태). 음영밴드 라벨 중복 판정에 쓴다.
  const annotationTextSet = new Set(
    analysis.emphasis.annotations.map((ann) => normalizeText(ann.text))
  );

  // 막대차트에서 표시할 주석만 추린다.
  // → type이 callout/point_label/badge인 것만(라인/화살표/구간강조 타입은 막대에 부적합)
  // → position.x가 실제 막대 카테고리명과 일치하는 것만(어디 위에 둘지 알아야 하므로)
  // → 중요도(critical>high>medium) 높은 순으로 정렬해 상위 MAX_ANNOTATIONS개만 사용
  const importanceRank: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
  };
  const barAnnotations = analysis.emphasis.annotations
    .filter(
      (ann) =>
        (ann.type === "callout" ||
          ann.type === "point_label" ||
          ann.type === "badge") &&
        chartData.some((d) => d.name === String(ann.position.x))
    )
    .slice() // 불변성: 원본 배열을 정렬로 건드리지 않도록 복사 후 정렬
    .sort(
      (a, b) =>
        (importanceRank[a.importance] ?? 9) - (importanceRank[b.importance] ?? 9)
    )
    .slice(0, MAX_ANNOTATIONS);

  // 콜아웃을 플롯 최상단으로 띄울지 여부(상단 여백 확보 판단용).
  // → 표시할 콜아웃이 하나라도 있을 때만 상단 여백을 늘린다.
  const hasFloatingCallout = barAnnotations.length > 0;

  // 주석 스타일(positive/negative/그 외)에 따른 색상 — 라인차트와 동일한 규칙
  function getAnnotationColor(style: string): string {
    if (style === "positive") return positiveAccent;
    if (style === "negative") return negativeAccent;
    return colors.accent;
  }

  if (isStackedBarChart && stackedChartData.length > 0) {
    return (
      <ResponsiveContainer width={width} height={height}>
        <ComposedChart
          data={stackedChartData}
          margin={{
            top: 18,
            right: 48,
            bottom: denseBottomMargin,
            left: chartSettings.margin.left,
          }}
        >
          <CartesianGrid {...styles.grid} />
          <XAxis
            dataKey="name"
            {...styles.xAxis}
            interval={0}
            ticks={visibleCategoryTicks}
            tickFormatter={formatCategoryTick}
            height={isDenseBarChart ? denseXAxisHeight : undefined}
            tickMargin={isDenseBarChart ? denseTickMargin : undefined}
            tick={
              // 라벨을 무조건 -45도로 눕히면 카테고리가 적을 때도 왼쪽이 잘리고
              // 축 높이가 늘어 출처 줄이 카드 밖으로 밀린다. 일반 막대 경로와
              // 같은 조건(8개 초과)일 때만 회전한다.
              isDenseBarChart
                ? {
                    ...(typeof styles.xAxis.tick === "object" ? styles.xAxis.tick : {}),
                    angle: -45,
                    textAnchor: "end",
                  }
                : styles.xAxis.tick
            }
          />
          <YAxis
            width={chartSettings.yAxis.width}
            {...styles.yAxis}
            tickFormatter={(value) =>
              formatValueWithUnit(
                Number(value),
                getTickUnit(analysis.structure.yAxis.unit, analysis.structure.yAxis.label),
                getAxisFractionDigits(yMin, yMax, yAxisTicks),
              )
            }
            domain={
              yAxisTicks.length > 0
                ? [yAxisTicks[0], yAxisTicks[yAxisTicks.length - 1]]
                : ["auto", "auto"]
            }
            ticks={yAxisTicks.length > 0 ? yAxisTicks : undefined}
            label={{
              value: getAxisLabel(analysis.structure.yAxis.label, analysis.structure.yAxis.unit),
              position: "insideTopLeft",
              offset: 0,
              dy: -16,
              fill: colors.textTertiary,
              fontSize: 15,
              fontWeight: 800,
              fontFamily: theme.typography.fontFamily.sans,
            }}
            tickCount={6}
          />
          <Tooltip
            {...styles.tooltip}
            formatter={(value, name) => [
              fmt(Number(value)) + (analysis.structure.yAxis.unit || ""),
              String(name),
            ]}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={30}
            iconType="circle"
            formatter={(value) => (
              <span
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {String(value)}
              </span>
            )}
          />
          {stackedBarSeries.map((series, index) => (
            <Bar
              key={series.name}
              dataKey={series.name}
              stackId="capacity"
              fill={getStackColor(index, series.name)}
              radius={
                !squareEdges && index === stackedBarSeries.length - 1
                  ? [5, 5, 0, 0]
                  : [0, 0, 0, 0]
              }
              isAnimationActive={animated}
              animationDuration={theme.animation.chartEntrance.duration}
              animationEasing="ease-out"
              maxBarSize={48}
            />
          ))}
          {stackedLineSeries.map((series, index) => (
            <Line
              key={series.name}
              type="linear"
              dataKey={series.name}
              stroke={index === 0 ? positiveAccent : colors.accent}
              strokeWidth={3.2}
              strokeDasharray="7 5"
              strokeLinecap={squareEdges ? "butt" : "round"}
              strokeLinejoin={squareEdges ? "miter" : "round"}
              dot={false}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={animated}
              animationDuration={theme.animation.chartEntrance.duration}
              animationEasing="ease-out"
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (isHorizontalBarChart) {
    const horizontalValues = horizontalChartData.flatMap((row) =>
      horizontalBarSeries.map((series) => Number(row[series.name] ?? 0)),
    );
    const horizontalMin = Math.min(0, ...horizontalValues);
    const horizontalMax = Math.max(0, ...horizontalValues);
    const horizontalTicks =
      explicitYTicks.length > 0
        ? explicitYTicks
        : generateNiceTicks(horizontalMin, horizontalMax);

    return (
      <ResponsiveContainer width={width} height={height}>
        <BarChart
          data={horizontalChartData}
          layout="vertical"
          margin={{
            top: horizontalBarSeries.length > 1 ? 42 : 18,
            right: 92,
            bottom: 18,
            left: 132,
          }}
        >
          <CartesianGrid {...styles.grid} horizontal={false} />
          <XAxis
            type="number"
            {...styles.xAxis}
            tickFormatter={(value) =>
              formatValueWithUnit(
                Number(value),
                getTickUnit(analysis.structure.yAxis.unit, analysis.structure.yAxis.label),
                getAxisFractionDigits(yMin, yMax, yAxisTicks),
              )
            }
            domain={
              horizontalTicks.length > 0
                ? [horizontalTicks[0], horizontalTicks[horizontalTicks.length - 1]]
                : ["auto", "auto"]
            }
            ticks={horizontalTicks.length > 0 ? horizontalTicks : undefined}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            interval={0}
            tickMargin={8}
            tick={{
              ...(typeof styles.yAxis.tick === "object" ? styles.yAxis.tick : {}),
              fill: colors.textSecondary,
              fontSize: 18,
              fontWeight: 800,
            }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            {...styles.tooltip}
            formatter={(value, name) => [
              fmt(Number(value)) + (analysis.structure.yAxis.unit || ""),
              String(name),
            ]}
          />
          {horizontalBarSeries.length > 1 && (
            <Legend
              verticalAlign="top"
              align="right"
              height={28}
              iconType="square"
              formatter={(value) => (
                <span
                  style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {String(value)}
                </span>
              )}
            />
          )}
          {horizontalValues.some((value) => value < 0) && (
            <ReferenceLine x={0} stroke={colors.axisLine} />
          )}
          {horizontalBarSeries.map((series, seriesIndex) => {
            const legendColor = analysis.structure.legend.find(
              (item) => item.name === series.name,
            )?.remakeColor;
            const fill = legendColor ?? stackPalette[seriesIndex % stackPalette.length];

            return (
              <Bar
                key={series.name}
                dataKey={series.name}
                fill={fill}
                radius={squareEdges ? [0, 0, 0, 0] : [0, 5, 5, 0]}
                isAnimationActive={animated}
                animationDuration={theme.animation.chartEntrance.duration}
                animationEasing="ease-out"
                maxBarSize={horizontalBarSeries.length > 1 ? 11 : 18}
              >
                {showLabels && (
                  <LabelList
                    dataKey={series.name}
                    position="right"
                    formatter={(value) => fmt(Number(value ?? 0))}
                    style={{
                      fill: colors.textSecondary,
                      fontSize: horizontalBarSeries.length > 1 ? 13 : 17,
                      fontFamily: theme.typography.fontFamily.mono,
                      fontWeight: 700,
                    }}
                  />
                )}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width={width} height={height}>
      <BarChart
        data={chartData}
        margin={{
          // [BAR-겹침회피] 콜아웃을 플롯 최상단으로 띄우므로(아래 ReferenceDot y=yMax),
          //   막대 위 값 라벨과 분리하려면 상단 여백이 더 필요하다.
          //   강조 콜아웃이 있을 때만 상단 여백을 넉넉히 준다(없으면 기존 그대로).
          top: compactChartMargins
            ? yAxisLabel
              ? 30
              : 12
            : hasFloatingCallout
              ? chartSettings.margin.top + 64
              : Math.max(22, chartSettings.margin.top - 14),
          right: compactChartMargins ? 36 : chartSettings.margin.right,
          bottom: compactChartMargins
            ? 32
            : isDenseBarChart
              ? denseBottomMargin
              : chartSettings.margin.bottom,
          left: compactChartMargins
            ? yAxisLabel
              ? 8
              : 0
            : chartSettings.margin.left,
        }}
      >
        <CartesianGrid {...styles.grid} />

        <XAxis
          dataKey="name"
          {...styles.xAxis}
          // 회전 표시(밀집)일 때는 interval={0}으로 모든 카테고리 라벨을 표시한다 [A6-c]
          // → 회전했으니 라벨이 겹치지 않는데, 예전엔 솎기(xLabelInterval)가 같이 걸려
          //   22개 종목 중 6개만 보이고 나머지 종목명이 사라졌다.
          // → 솎기는 회전을 안 하는(여유 있는) 경우에만 적용한다.
          interval={isDenseBarChart ? 0 : xLabelInterval}
          ticks={visibleCategoryTicks}
          tickFormatter={formatCategoryTick}
          height={isDenseBarChart ? denseXAxisHeight : undefined}
          tickMargin={isDenseBarChart ? denseTickMargin : undefined}
          tick={
            isDenseBarChart
              ? {
                  ...(typeof styles.xAxis.tick === "object" ? styles.xAxis.tick : {}),
                  angle: -45,
                  textAnchor: "end",
                }
              : styles.xAxis.tick
          }
          label={{
            value: analysis.structure.xAxis.label || "",
            position: "insideBottomRight",
            offset: -30,
            fill: colors.textTertiary,
            fontSize: 16,
            fontWeight: 800,
            fontFamily: theme.typography.fontFamily.sans,
          }}
        />

        <YAxis
          width={chartSettings.yAxis.width}
          {...styles.yAxis}
          tickFormatter={(value) =>
            formatValueWithUnit(
              Number(value),
              getTickUnit(analysis.structure.yAxis.unit, analysis.structure.yAxis.label),
              // [D2] 소수 자릿수도 "실제로 그릴 눈금 배열" 기준으로 맞춘다.
              // → 0.5 간격 눈금을 0자리로 반올림하면 '1,1,2,2'(중복)가 되므로,
              //   눈금 간격이 1 미만이면 1자리(0.5/1.0/1.5)로 표시해 중복을 막는다.
              getAxisFractionDigits(yMin, yMax, yAxisTicks),
            )
          }
          // [D2] tickValues가 없을 때만 균등 눈금/도메인을 강제한다(있으면 기존 동작 유지).
          // → 도메인을 눈금의 처음/끝으로 맞춰 0/1/2/3 또는 0/100/200/300/400처럼 균등하게 그린다.
          domain={
            yAxisTicks.length > 0
              ? [yAxisTicks[0], yAxisTicks[yAxisTicks.length - 1]]
              : ["auto", "auto"]
          }
          ticks={yAxisTicks.length > 0 ? yAxisTicks : undefined}
          label={{
            value: yAxisLabel,
            position: "insideTopLeft",
            offset: 0,
            dy: -16,
            fill: colors.textTertiary,
            fontSize: 15,
            fontWeight: 800,
            fontFamily: theme.typography.fontFamily.sans,
          }}
          tickCount={6}
        />

        <Tooltip
          {...styles.tooltip}
          formatter={(value) => [
            fmt(Number(value)) + (analysis.structure.yAxis.unit || ""),
            firstSeries.name,
          ]}
        />

        {/* 기준선(평균/기준) — 원본에 실제로 있을 때만 그린다 [A6-a] */}
        {baselineValue != null && (
          <ReferenceLine
            y={baselineValue}
            stroke={colors.textTertiary}
            strokeDasharray="4 4"
            label={{
              // 원본 추세선의 라벨을 그대로 사용(없으면 값만 표시)
              value: baselineTrend?.label || fmt(baselineValue),
              position: "right",
              fill: colors.textTertiary,
              fontSize: 22,
              fontWeight: 700,
              fontFamily: theme.typography.fontFamily.mono,
            }}
          />
        )}

        {/* 0 기준선 (음수 값이 있는 경우) */}
        {chartData.some((d) => d.value < 0) && (
          <ReferenceLine y={0} stroke={colors.axisLine} />
        )}

        {/* 하이라이트 구간 (배경 음영 밴드) — [BAR-강조]
            막대보다 "먼저" 배치해야 막대 뒤(배경)에 깔린다.
            막대차트 X축은 category(name)이므로 x1/x2는 카테고리명(막대 라벨)과 일치해야 한다.
            예: page-15-t1 상위 3개 막대 구간 음영, page-06-t2 음영밴드. */}
        {analysis.emphasis.highlightZones
          .filter(
            (zone) =>
              chartData.some((d) => d.name === String(zone.fromX)) &&
              chartData.some((d) => d.name === String(zone.toX))
          )
          .map((zone, i) => {
            // [BAR-중복제거] 음영밴드 라벨이 콜아웃(annotation) 텍스트와 동일하면
            //   라벨을 생략하고 "배경 음영만" 그린다(같은 문구 2번 표시 금지).
            //   문구는 아래 콜아웃에서 한 번만 나오게 한다.
            const isDuplicatedByAnnotation =
              zone.label != null &&
              annotationTextSet.has(normalizeText(zone.label));
            const showZoneLabel = zone.label != null && !isDuplicatedByAnnotation;
            return (
              <ReferenceArea
                key={`zone-${i}`}
                x1={String(zone.fromX)}
                x2={String(zone.toX)}
                y1={yMin}
                y2={yMax}
                fill={zone.color || colors.accent}
                fillOpacity={HIGHLIGHT_ZONE_OPACITY}
                strokeOpacity={0}
                label={
                  showZoneLabel
                    ? {
                        value: cleanText(zone.label),
                        position: "insideTopLeft",
                        fill: colors.textTertiary,
                        fontSize: 16,
                        fontWeight: 800,
                        fontFamily: theme.typography.fontFamily.sans,
                      }
                    : undefined
                }
              />
            );
          })}

        <Bar
          dataKey="value"
          radius={squareEdges ? [0, 0, 0, 0] : [6, 6, 0, 0]}
          isAnimationActive={animated}
          animationDuration={theme.animation.chartEntrance.duration}
          animationEasing="ease-out"
          maxBarSize={chartData.length <= 3 ? 92 : chartData.length <= 5 ? 72 : 56}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={getBarColor(entry.value, index)}
            />
          ))}

          {/* 막대 위 값 라벨 — 막대가 8개를 초과하면 라벨이 서로 붙어
              "385370365360"처럼 읽을 수 없으므로 표시하지 않는다(겹침 방지) [A6-b] */}
          {showLabels && chartData.length <= 8 && (
            <LabelList
              dataKey="value"
              position="top"
              formatter={(value) => fmt(Number(value ?? 0))}
              style={{
                fill: colors.textSecondary,
                fontSize: 22,
                fontFamily: theme.typography.fontFamily.mono,
                fontWeight: 800,
              }}
            />
          )}
        </Bar>

        {/* 어노테이션 (콜아웃/포인트라벨/뱃지) — [BAR-강조 / 겹침회피]
            막대보다 "나중에" 배치해야 막대 위에 글자가 얹힌다.
            ⚠️ 핵심 수정: 예전엔 콜아웃을 "막대 값(상단)"에 두고 position:"top"으로 띄워서,
               막대 위 값 라벨(LabelList: 예 "2.5")과 같은 자리에 겹쳐 "2 5"처럼 깨졌다.
            → 이제 콜아웃을 플롯 "최상단(yMax)"으로 띄우고(점은 그 위치) 라벨을 top으로 올려,
               막대 값 라벨과 세로로 분리한다(상단 여백은 위 margin.top에서 확보).
               해당 막대가 어디인지는 x(카테고리명)로 정렬되어 그대로 식별된다.
            예: page-15-t1 '전체 이익 성장의 61% 설명', page-06-t2 번호 콜아웃. */}
        {barAnnotations.map((ann, i) => {
          const annColor = getAnnotationColor(ann.style);
          return (
            <ReferenceDot
              key={`ann-${i}`}
              x={String(ann.position.x)}
              // 막대 값이 아니라 플롯 최상단(yMax)에 고정 → 막대 위 값 라벨과 겹치지 않는다.
              y={yMax}
              r={ann.importance === "critical" ? 6 : 5}
              fill={annColor}
              stroke={colors.surface}
              strokeWidth={2.5}
              label={{
                value: cleanText(ann.text),
                position: "top", // 최상단 점보다 더 위(상단 여백)로 라벨을 올린다.
                offset: 14,
                fill:
                  ann.style === "positive" || ann.style === "negative"
                    ? annColor
                    : colors.textPrimary,
                fontSize: ann.importance === "critical" ? 18 : 16,
                fontWeight: 800,
                fontFamily: theme.typography.fontFamily.mono,
              }}
            />
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}
