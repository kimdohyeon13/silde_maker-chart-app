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
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  LabelList,
} from "recharts";
import type { ChartAnalysis } from "@/lib/analysis/schema";
import { getTheme, getRechartsStyle, type ThemeMode } from "@/lib/theme/toss-theme";
import { formatNumber } from "@/lib/analysis/insight-engine";
import { chartSettings } from "@/lib/chart-settings";

interface TossBarChartProps {
  analysis: ChartAnalysis;
  theme?: ThemeMode;
  width?: number;
  height?: number;
  showLabels?: boolean;
  animated?: boolean;
}

export default function TossBarChart({
  analysis,
  theme: themeMode = "dark",
  width = 800,
  height = 350,
  showLabels = true,
  animated = true,
}: TossBarChartProps) {
  const theme = getTheme(themeMode);
  const styles = getRechartsStyle(themeMode);
  const { colors } = theme;

  const firstSeries = analysis.data.series[0];
  if (!firstSeries) return null;

  // Recharts 형식으로 변환
  const chartData = firstSeries.data.map((point) => ({
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

  // 평균값
  const average = analysis.statistics.summary.average;

  // 막대 색상 결정 함수
  function getBarColor(value: number, index: number): string {
    if (index === maxIndex) return colors.positive;
    if (index === minIndex) return colors.negative;
    if (value >= 0) return `${colors.positive}99`;
    return `${colors.negative}99`;
  }

  // X축 라벨 간격 — chartSettings 기반
  const xLabelInterval = (() => {
    const len = chartData.length;
    const maxLabels = chartSettings.xAxis.maxVisibleLabels;
    if (len <= maxLabels) return 0;
    return Math.ceil(len / maxLabels);
  })();

  return (
    <ResponsiveContainer width={width} height={height}>
      <BarChart
        data={chartData}
        margin={{
          top: chartSettings.margin.top,
          right: chartSettings.margin.right,
          bottom: chartSettings.margin.bottom,
          left: chartSettings.margin.left,
        }}
      >
        <CartesianGrid {...styles.grid} />

        <XAxis
          dataKey="name"
          {...styles.xAxis}
          interval={xLabelInterval}
        />

        <YAxis
          width={chartSettings.yAxis.width}
          {...styles.yAxis}
          tickFormatter={(value) =>
            formatNumber(Number(value)) + (analysis.structure.yAxis.unit || "")
          }
        />

        <Tooltip
          {...styles.tooltip}
          formatter={(value) => [
            formatNumber(Number(value)) + (analysis.structure.yAxis.unit || ""),
            firstSeries.name,
          ]}
        />

        {/* 평균 기준선 */}
        <ReferenceLine
          y={average}
          stroke={colors.textTertiary}
          strokeDasharray="4 4"
          label={{
            value: `평균 ${formatNumber(average)}`,
            position: "right",
            fill: colors.textTertiary,
            fontSize: 22,
            fontWeight: 700,
            fontFamily: theme.typography.fontFamily.mono,
          }}
        />

        {/* 0 기준선 (음수 값이 있는 경우) */}
        {chartData.some((d) => d.value < 0) && (
          <ReferenceLine y={0} stroke={colors.axisLine} />
        )}

        <Bar
          dataKey="value"
          radius={[6, 6, 0, 0]}
          isAnimationActive={animated}
          animationDuration={theme.animation.chartEntrance.duration}
          animationEasing="ease-out"
          maxBarSize={56}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={getBarColor(entry.value, index)}
            />
          ))}

          {showLabels && chartData.length <= 15 && (
            <LabelList
              dataKey="value"
              position="top"
              formatter={(value) => formatNumber(Number(value ?? 0))}
              style={{
                fill: colors.textSecondary,
                fontSize: 22,
                fontFamily: theme.typography.fontFamily.mono,
                fontWeight: 800,
              }}
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
