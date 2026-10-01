/**
 * =====================================================
 * ChartRouter — 차트 타입 자동 라우터
 * =====================================================
 *
 * 분석 결과의 chartType에 따라 적절한 차트 컴포넌트를
 * 자동으로 선택해서 렌더링합니다.
 *
 * 왜 "라우터"라고 부르나?
 * → 웹사이트에서 URL에 따라 다른 페이지를 보여주는 것처럼
 *   데이터 타입에 따라 다른 차트를 보여주기 때문
 *
 * 사용법:
 *   <ChartRouter analysis={분석결과} />
 *   → chartType이 "line"이면 TossLineChart 렌더링
 *   → chartType이 "bar"면 TossBarChart 렌더링
 *   → 등등...
 */

"use client";

import React from "react";
import type { ChartAnalysis } from "@/lib/analysis/schema";
import { getAnalysisThemeMode } from "@/lib/style-presets";
import type { ThemeMode } from "@/lib/theme/toss-theme";
import ChartWrapper from "./ChartWrapper";
import PanelGrid from "./PanelGrid";
import TossLineChart from "./TossLineChart";
import TossComboChart from "./TossComboChart";
import TossBarChart from "./TossBarChart";
import TossDonutChart from "./TossDonutChart";
import TossCandleChart from "./TossCandleChart";
import TossScatterChart from "./TossScatterChart";
import TossChartTable from "./TossChartTable";

interface ChartRouterProps {
  analysis: ChartAnalysis;
  theme?: ThemeMode;
  showInsights?: boolean;
  showHeader?: boolean;
  width?: number | string;
  height?: number;
  animated?: boolean;
}

export default function ChartRouter({
  analysis,
  theme = "dark",
  showInsights = true,
  showHeader = true,
  width,
  height = 350,
  animated = true,
}: ChartRouterProps) {
  const { chartType, panels } = analysis.structure;
  const renderTheme = getAnalysisThemeMode(analysis, theme);
  const responsiveWidth = (
    typeof width === "number" ? width : "100%"
  ) as number | `${number}%`;

  // 다중 패널(스몰멀티플) 분기 (P0-2)
  // → structure.panels[]가 있으면 단일 차트 대신 PanelGrid로 패널별 독립축 격자를 그린다.
  // → 없으면(undefined/빈 배열) 아래 기존 단일차트 경로를 그대로 사용한다(회귀 금지).
  const hasPanels = Array.isArray(panels) && panels.length > 0;

  /**
   * 차트 타입 → 컴포넌트 매핑
   *
   * 현재 구현된 4종:
   * - line, area → TossLineChart (선 차트)
   * - combo → TossComboChart (막대+선 조합 차트)
   * - bar, bar_horizontal, stacked_bar, waterfall → TossBarChart (막대 차트)
   * - donut, pie, treemap → TossDonutChart (도넛 차트)
   * - candle → TossCandleChart (캔들 차트)
   *
   * 아직 미구현인 것들은 가장 비슷한 차트로 대체:
   * - scatter, bubble → TossScatterChart
   * - heatmap, radar, funnel → 막대 차트로 대체
   */
  function renderChart() {
    if (analysis.tableData) {
      return (
        <TossChartTable
          analysis={analysis as ChartAnalysis & {
            tableData: NonNullable<ChartAnalysis["tableData"]>;
          }}
          theme={renderTheme}
          height={height}
        />
      );
    }

    // 다중 패널이 있으면 단일 차트 switch보다 우선해서 PanelGrid로 그린다.
    if (hasPanels) {
      return (
        <PanelGrid animated={animated}
          analysis={analysis}
          panels={panels!}
          theme={renderTheme}
          height={height}
        />
      );
    }

    switch (chartType) {
      // ── 콤보 차트 ──
      case "combo":
        return (
          <TossComboChart animated={animated}
            analysis={analysis}
            theme={renderTheme}
            width={responsiveWidth}
            height={height}
          />
        );

      // ── 막대 차트 계열 ──
      case "bar":
      case "bar_horizontal":
      case "stacked_bar":
      case "waterfall":
      case "heatmap":
      case "radar":
      case "funnel":
        return (
          <TossBarChart animated={animated}
            analysis={analysis}
            theme={renderTheme}
            width={responsiveWidth}
            height={height}
          />
        );

      // ── 선 차트 계열 ──
      case "line":
      case "area":
        return (
          <TossLineChart animated={animated}
            analysis={analysis}
            theme={renderTheme}
            width={responsiveWidth}
            height={height}
          />
        );

      // ── 산점도/버블 차트 계열 ──
      case "scatter":
      case "bubble":
        return (
          <TossScatterChart animated={animated}
            analysis={analysis}
            theme={renderTheme}
            width={responsiveWidth}
            height={height}
          />
        );

      // ── 도넛/파이 계열 ──
      case "donut":
      case "pie":
      case "treemap":
        return (
          <TossDonutChart animated={animated}
            analysis={analysis}
            theme={renderTheme}
            width={responsiveWidth}
            height={height}
          />
        );

      // ── 캔들 차트 ──
      case "candle":
        return (
          <TossCandleChart
            analysis={analysis}
            theme={renderTheme}
            width={typeof width === "number" ? width : undefined}
            height={height}
          />
        );

      // ── 기본값: 선 차트 ──
      default:
        return (
          <TossLineChart animated={animated}
            analysis={analysis}
            theme={renderTheme}
            width={responsiveWidth}
            height={height}
          />
        );
    }
  }

  return (
    <ChartWrapper
      analysis={analysis}
      theme={renderTheme}
      showInsights={showInsights}
      showHeader={showHeader}
      width={width}
    >
      {renderChart()}
    </ChartWrapper>
  );
}
