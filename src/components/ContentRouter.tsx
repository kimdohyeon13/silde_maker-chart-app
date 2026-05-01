/**
 * =====================================================
 * ContentRouter — 콘텐츠 타입 통합 라우터
 * =====================================================
 *
 * 차트, 표, 인포그래픽을 하나의 진입점에서 자동 분기합니다.
 *
 * 기존 ChartRouter를 래핑하는 상위 라우터���니다.
 * ChartRouter는 변경하지 않고 그대로 재사용합니다.
 *
 * 분기 로직:
 * → contentType 필드가 없으면 → ChartRouter (기존 차트)
 * → contentType === "table" → TossTable (표)
 * → contentType === "infographic" → TossInfoCard (인포그래픽)
 *
 * 왜 ChartRouter를 수정하지 않고 새 컴포넌트를 만들었나?
 * → 기존 코드를 안전하게 유지하기 위해
 * → ChartRouter에 의존하는 다른 코드가 깨지지 않음
 * → 새 타입을 추가할 때 이 파일만 수정하면 됨
 */

"use client";

import React from "react";
import type { VisualAnalysis } from "@/lib/analysis/schema";
import { isChartAnalysis, isTableAnalysis, isInfographicAnalysis } from "@/lib/analysis/schema";
import type { ThemeMode } from "@/lib/theme/toss-theme";
import ChartRouter from "./charts/ChartRouter";
import ChartWrapper from "./charts/ChartWrapper";
import { TossTable } from "./tables";
import { TossInfoCard } from "./infographics";

interface ContentRouterProps {
  analysis: VisualAnalysis;
  theme?: ThemeMode;
  showInsights?: boolean;
  showHeader?: boolean;
  width?: number | string;
  height?: number;
}

export default function ContentRouter({
  analysis,
  theme = "dark",
  showInsights = true,
  showHeader = true,
  width,
  height = 350,
}: ContentRouterProps) {
  // ── 기존 차트 → ChartRouter에 그대로 위임 ──
  if (isChartAnalysis(analysis)) {
    return (
      <ChartRouter
        analysis={analysis}
        theme={theme}
        showInsights={showInsights}
        showHeader={showHeader}
        width={width}
        height={height}
      />
    );
  }

  // ── 표 → ChartWrapper로 감싸고 TossTable 렌더링 ──
  if (isTableAnalysis(analysis)) {
    return (
      <ChartWrapper
        analysis={analysis}
        theme={theme}
        showInsights={showInsights}
        showHeader={showHeader}
        width={width}
      >
        <TossTable analysis={analysis} theme={theme} />
      </ChartWrapper>
    );
  }

  // ── 인포그래픽 → ChartWrapper로 감싸고 TossInfoCard 렌더링 ──
  if (isInfographicAnalysis(analysis)) {
    return (
      <ChartWrapper
        analysis={analysis}
        theme={theme}
        showInsights={showInsights}
        showHeader={showHeader}
        width={width}
      >
        <TossInfoCard analysis={analysis} theme={theme} />
      </ChartWrapper>
    );
  }

  // 알 수 없는 타입 — 방어적 코드 (도달하지 않아야 함)
  return null;
}
