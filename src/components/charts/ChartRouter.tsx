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
import type { ThemeMode } from "@/lib/theme/toss-theme";
import ChartWrapper from "./ChartWrapper";
import TossLineChart from "./TossLineChart";
import TossBarChart from "./TossBarChart";
import TossDonutChart from "./TossDonutChart";
import TossCandleChart from "./TossCandleChart";
import TossScatterChart from "./TossScatterChart";

interface ChartRouterProps {
  analysis: ChartAnalysis;
  theme?: ThemeMode;
  showInsights?: boolean;
  showHeader?: boolean;
  width?: number | string;
  height?: number;
}

export default function ChartRouter({
  analysis,
  theme = "dark",
  showInsights = true,
  showHeader = true,
  width,
  height = 350,
}: ChartRouterProps) {
  const { chartType } = analysis.structure;

  /**
   * 차트 타입 → 컴포넌트 매핑
   *
   * 현재 구현된 4종:
   * - line, area → TossLineChart (선 차트)
   * - bar, bar_horizontal, stacked_bar, waterfall → TossBarChart (막대 차트)
   * - donut, pie, treemap → TossDonutChart (도넛 차트)
   * - candle → TossCandleChart (캔들 차트)
   *
   * 아직 미구현인 것들은 가장 비슷한 차트로 대체:
   * - scatter, bubble → TossScatterChart
   * - combo → 선 차트로 대체
   * - heatmap, radar, funnel → 막대 차트로 대체
   */
  function renderChart() {
    switch (chartType) {
      // ── 선 차트 계열 ──
      case "line":
      case "area":
      case "combo":
        return (
          <TossLineChart
            analysis={analysis}
            theme={theme}
            height={height}
          />
        );

      // ── 산점도/버블 차트 계열 ──
      case "scatter":
      case "bubble":
        return (
          <TossScatterChart
            analysis={analysis}
            theme={theme}
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
          <TossBarChart
            analysis={analysis}
            theme={theme}
            height={height}
          />
        );

      // ── 도넛/파이 계열 ──
      case "donut":
      case "pie":
      case "treemap":
        return (
          <TossDonutChart
            analysis={analysis}
            theme={theme}
            height={height}
          />
        );

      // ── 캔들 차트 ──
      case "candle":
        return (
          <TossCandleChart
            analysis={analysis}
            theme={theme}
            height={height}
          />
        );

      // ── 기본값: 선 차트 ──
      default:
        return (
          <TossLineChart
            analysis={analysis}
            theme={theme}
            height={height}
          />
        );
    }
  }

  return (
    <ChartWrapper
      analysis={analysis}
      theme={theme}
      showInsights={showInsights}
      showHeader={showHeader}
      width={width}
    >
      {renderChart()}
    </ChartWrapper>
  );
}
