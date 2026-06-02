/**
 * =====================================================
 * TossScatterChart — 토스증권 스타일 산점도/버블 차트
 * =====================================================
 *
 * 두 지표의 관계를 보여줄 때 사용합니다.
 * 예: 고점 대비 하락률과 목표가 상승여력, P/E와 EPS 성장률 등
 */

"use client";

import React from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  Cell,
} from "recharts";
import type { ChartAnalysis, DataPoint } from "@/lib/analysis/schema";
import {
  getAnalysisStylePreset,
  getAnalysisThemeMode,
  getPresetColors,
  getPresetRechartsStyle,
} from "@/lib/style-presets";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";
import { chartSettings } from "@/lib/chart-settings";
import { getTickUnit, formatValueWithUnit, getAxisFractionDigits } from "@/lib/chart-format";

interface TossScatterChartProps {
  analysis: ChartAnalysis;
  theme?: ThemeMode;
  width?: number;
  height?: number;
  animated?: boolean;
}

type LabelPosition = "top" | "bottom" | "left" | "right";

interface ScatterPoint {
  name: string;
  xValue: number;
  yValue: number;
  zValue: number;
  fill: string;
  labelPosition: LabelPosition;
  showLabel: boolean;
}

type ExtendedDataPoint = DataPoint & {
  label?: string;
  company?: string;
  z?: number;
  color?: string;
  labelPosition?: LabelPosition;
  showLabel?: boolean;
};

export default function TossScatterChart({
  analysis,
  theme: themeMode = "dark",
  width = 800,
  height = 350,
  animated = true,
}: TossScatterChartProps) {
  const renderThemeMode = getAnalysisThemeMode(analysis, themeMode);
  const theme = getTheme(renderThemeMode);
  const preset = getAnalysisStylePreset(analysis);
  const styles = getPresetRechartsStyle(analysis, themeMode);
  const colors = getPresetColors(preset, renderThemeMode);

  const firstSeries = analysis.data.series[0];
  if (!firstSeries) return null;

  const chartData: ScatterPoint[] = firstSeries.data.map((point, index) => {
    const extended = point as ExtendedDataPoint;
    const legendColor = analysis.structure.legend[index]?.originalColor;

    return {
      name: extended.label ?? extended.company ?? String(point.x),
      xValue: Number(point.x),
      yValue: point.y,
      zValue: extended.z ?? 12,
      fill: extended.color ?? legendColor ?? colors.series[index % colors.series.length],
      labelPosition: extended.labelPosition ?? "top",
      showLabel: extended.showLabel !== false,
    };
  });

  const xAxisLabel = analysis.structure.xAxis.label;
  const yAxisLabel = analysis.structure.yAxis.label;
  const xMin = analysis.structure.xAxis.min;
  const xMax = analysis.structure.xAxis.max;
  const yMin = analysis.structure.yAxis.min;
  const yMax = analysis.structure.yAxis.max;

  // 축 단위를 "눈금에 붙여도 되는 짧은 단위"로 정제한다.
  // → %면 %가 붙고, 비었거나 긴/기준 단위면 빈 문자열(숫자만 표시)이 된다.
  //   덕분에 배수/포인트/연도 산점도에서 "2024%"처럼 잘못된 %가 붙지 않는다.
  const xTickUnit = getTickUnit(analysis.structure.xAxis.unit, xAxisLabel);
  const yTickUnit = getTickUnit(analysis.structure.yAxis.unit, yAxisLabel);
  // 축별 소수 자릿수(눈금 간격 기반). 산점도는 도메인 min/max만 알 수 있어 그것으로 추정.
  const xFractionDigits = getAxisFractionDigits(xMin, xMax);
  const yFractionDigits = getAxisFractionDigits(yMin, yMax);

  // 0 기준선 라벨: 단위가 '%'일 때만 "0%", 그 외에는 "0".
  const xZeroLabel = xTickUnit === "%" ? "0%" : "0";
  const yZeroLabel = yTickUnit === "%" ? "0%" : "0";

  const showXZeroLine =
    typeof xMin === "number" && typeof xMax === "number" && xMin < 0 && xMax > 0;
  const showYZeroLine =
    typeof yMin === "number" && typeof yMax === "number" && yMin < 0 && yMax > 0;

  // D7 수정: 두 0기준선이 동시에 그려질 때 '0%' 라벨이 2개(좌상단·중앙우측) 떠
  //          잡음처럼 보였다. 라벨 위치를 축 쪽으로 분리하고, 둘 다 켜질 때는
  //          한쪽(X 0선)은 라벨 없이 선만 그려 중복 표기를 없앤다.
  //          두 선은 원점에서 눈에 띄게 교차하므로 Y축 좌측 끝 라벨 하나로 0 기준이 충분히 전달된다.
  const showBothZeroLines = showXZeroLine && showYZeroLine;

  return (
    <ResponsiveContainer width={width} height={height}>
      <ScatterChart
        margin={{
          top: chartSettings.margin.top + 4,
          right: chartSettings.margin.right + 10,
          bottom: chartSettings.margin.bottom,
          left: chartSettings.margin.left,
        }}
      >
        <CartesianGrid {...styles.grid} />

        <XAxis
          type="number"
          dataKey="xValue"
          name={analysis.structure.xAxis.label}
          width={chartSettings.yAxis.width}
          {...styles.xAxis}
          domain={[
            analysis.structure.xAxis.min ?? "auto",
            analysis.structure.xAxis.max ?? "auto",
          ]}
          tickFormatter={(value) =>
            formatValueWithUnit(Number(value), xTickUnit, xFractionDigits)
          }
          tickCount={6}
        />

        <YAxis
          type="number"
          dataKey="yValue"
          name={analysis.structure.yAxis.label}
          width={chartSettings.yAxis.width}
          {...styles.yAxis}
          domain={[
            analysis.structure.yAxis.min ?? "auto",
            analysis.structure.yAxis.max ?? "auto",
          ]}
          tickFormatter={(value) =>
            formatValueWithUnit(Number(value), yTickUnit, yFractionDigits)
          }
          tickCount={6}
        />

        <ZAxis
          type="number"
          dataKey="zValue"
          range={analysis.structure.chartType === "bubble" ? [150, 520] : [180, 180]}
        />

        <Tooltip
          {...styles.tooltip}
          formatter={(value, name) => {
            // 툴팁은 축 단위를 그대로 반영한다(%면 %, 배수/포인트면 해당 단위, 없으면 숫자만).
            if (name === "xValue")
              return [
                formatValueWithUnit(Number(value), analysis.structure.xAxis.unit ?? "", xFractionDigits),
                xAxisLabel,
              ];
            if (name === "yValue")
              return [
                formatValueWithUnit(Number(value), analysis.structure.yAxis.unit ?? "", yFractionDigits),
                yAxisLabel,
              ];
            // 버블 크기(zValue)는 단위 없는 상대 크기값이라 숫자만 표시.
            if (name === "zValue") return [formatValueWithUnit(Number(value)), "버블 크기"];
            return [String(value), String(name)];
          }}
          labelFormatter={() => ""}
          cursor={{ stroke: colors.textTertiary, strokeDasharray: "4 4" }}
        />

        {showXZeroLine && (
          <ReferenceLine
            x={0}
            stroke={colors.border}
            strokeDasharray="6 6"
            // X축 0선(세로선): 라벨은 X축 근처(아래)에 둔다.
            // 단, 두 0선이 동시에 켜질 때는 라벨을 생략해 Y선 라벨과의 '0%' 중복을 없앤다.
            label={
              showBothZeroLines
                ? undefined
                : {
                    value: xZeroLabel,
                    position: "insideBottom",
                    fill: colors.textTertiary,
                    fontSize: 18,
                    fontWeight: 700,
                  }
            }
          />
        )}

        {showYZeroLine && (
          <ReferenceLine
            y={0}
            stroke={colors.border}
            strokeDasharray="6 6"
            // Y축 0선(가로선): 라벨은 Y축 쪽(좌측 끝)에 둔다 → X선 라벨과 위치가 명확히 분리된다.
            label={{
              value: yZeroLabel,
              position: "insideLeft",
              fill: colors.textTertiary,
              fontSize: 18,
              fontWeight: 700,
            }}
          />
        )}

        <Scatter
          name={firstSeries.name}
          data={chartData}
          fill={colors.accent}
          isAnimationActive={animated}
          animationDuration={theme.animation.chartEntrance.duration}
          animationEasing="ease-out"
        >
          {chartData.map((point) => (
            <Cell key={point.name} fill={point.fill} stroke={colors.surface} strokeWidth={3} />
          ))}
        </Scatter>

        {chartData.filter((point) => point.showLabel).map((point) => (
          <ReferenceDot
            key={`label-${point.name}`}
            x={point.xValue}
            y={point.yValue}
            r={0}
            label={{
              value: point.name,
              position: point.labelPosition,
              offset: 12,
              fill: colors.textPrimary,
              fontSize: 21,
              fontWeight: 800,
              fontFamily: theme.typography.fontFamily.sans,
            }}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
