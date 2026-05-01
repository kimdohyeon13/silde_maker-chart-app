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
import { getTheme, getRechartsStyle, type ThemeMode } from "@/lib/theme/toss-theme";
import { chartSettings } from "@/lib/chart-settings";

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
}

type ExtendedDataPoint = DataPoint & {
  label?: string;
  company?: string;
  z?: number;
  color?: string;
  labelPosition?: LabelPosition;
};

function formatPercent(value: number): string {
  return `${value.toLocaleString("ko-KR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export default function TossScatterChart({
  analysis,
  theme: themeMode = "dark",
  width = 800,
  height = 350,
  animated = true,
}: TossScatterChartProps) {
  const theme = getTheme(themeMode);
  const styles = getRechartsStyle(themeMode);
  const { colors } = theme;

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
    };
  });

  const xUnit = analysis.structure.xAxis.unit ?? "";
  const yUnit = analysis.structure.yAxis.unit ?? "";

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
          tickFormatter={(value) => formatPercent(Number(value))}
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
          tickFormatter={(value) => formatPercent(Number(value))}
        />

        <ZAxis
          type="number"
          dataKey="zValue"
          range={analysis.structure.chartType === "bubble" ? [150, 520] : [180, 180]}
        />

        <Tooltip
          {...styles.tooltip}
          formatter={(value, name) => {
            if (name === "xValue") return [`${formatPercent(Number(value))}${xUnit && xUnit !== "%" ? ` ${xUnit}` : ""}`, "고점 대비 하락"];
            if (name === "yValue") return [`${formatPercent(Number(value))}${yUnit && yUnit !== "%" ? ` ${yUnit}` : ""}`, "목표가 상승여력"];
            if (name === "zValue") return [formatPercent(Number(value)), "EPS 성장 예상"];
            return [String(value), String(name)];
          }}
          labelFormatter={() => ""}
          cursor={{ stroke: colors.textTertiary, strokeDasharray: "4 4" }}
        />

        <ReferenceLine
          x={10}
          stroke={colors.border}
          strokeDasharray="6 6"
          label={{
            value: "고점 대비 10%",
            position: "insideTop",
            fill: colors.textTertiary,
            fontSize: 18,
            fontWeight: 700,
          }}
        />

        <ReferenceLine
          y={20}
          stroke={colors.border}
          strokeDasharray="6 6"
          label={{
            value: "상승여력 20%",
            position: "right",
            fill: colors.textTertiary,
            fontSize: 18,
            fontWeight: 700,
          }}
        />

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

        {chartData.map((point) => (
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
