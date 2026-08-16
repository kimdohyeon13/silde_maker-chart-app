/**
 * =====================================================
 * ChartWrapper — 차트 공통 래퍼 컴포넌트
 * =====================================================
 *
 * 모든 차트 타입에 공통으로 적용되는 "껍데기"입니다.
 *
 * 역할:
 * 1. 제목 / 부제목 / 출처 표시
 * 2. 인사이트 패널 (헤드라인 + 시사점)
 * 3. 어노테이션 오버레이
 * 4. 다크/라이트 모드 배경
 * 5. 반응형 크기 조절
 *
 * 왜 래퍼가 필요한가?
 * → 라인차트든 바차트든 "제목, 인사이트, 배경" 같은 공통 요소가 있음
 * → 이걸 매번 복붙하면 코드 중복이 심해짐
 * → 한 번만 만들어서 모든 차트가 공유하면 됨
 */

"use client";

import React from "react";
import type { ExportOptions, VisualAnalysis } from "@/lib/analysis/schema";
import { isChartAnalysis, isInfographicAnalysis } from "@/lib/analysis/schema";
import { getDisplayMessages } from "@/lib/analysis/message-agent";
import {
  getAnalysisStylePreset,
  getAnalysisThemeMode,
  getPresetColors,
} from "@/lib/style-presets";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";
import { cleanSourceText } from "@/lib/chart-format";
import { resolveSubMessageWeight } from "@/lib/slide-typography";
import { mergeOptionDefaults } from "@/lib/visual-system-options";
import Watermark from "@/components/app/Watermark";

interface ChartWrapperProps {
  /** 분석 결과 — 차트, 표, 인포그래픽 모두 가능 */
  analysis: VisualAnalysis;
  /** 테마 모드 */
  theme?: ThemeMode;
  /** 차트 컴포넌트 (children으로 전달) */
  children: React.ReactNode;
  /** 인사이트 패널 표시 여부 */
  showInsights?: boolean;
  /** 헤더(제목/배지) 표시 여부 — export 모드에서 false */
  showHeader?: boolean;
  /** 너비 (px 또는 "100%") */
  width?: number | string;
  /** 높이 (px) */
  height?: number;
}

function getFidelityNotice(analysis: VisualAnalysis): string | null {
  const fidelity = analysis.preserveIntent?.dataFidelity;
  if (fidelity === "exact") return "원본 숫자 보존";
  if (fidelity === "source-visible") return null;
  if (fidelity === "directional") return null;
  return null;
}

export default function ChartWrapper({
  analysis,
  theme: themeMode = "dark",
  children,
  showInsights = true,
  showHeader = true,
  width = "100%",
  height,
}: ChartWrapperProps) {
  const renderThemeMode = getAnalysisThemeMode(analysis, themeMode);
  const theme = getTheme(renderThemeMode);
  const preset = getAnalysisStylePreset(analysis);
  const colors = getPresetColors(preset, renderThemeMode);
  const { structure, emphasis } = analysis;
  const { headMessage, subMessage, metaMessage } = getDisplayMessages(analysis);
  const fidelityNotice = getFidelityNotice(analysis);
  const isCompactExportCard = !showHeader && !showInsights;
  const exportOptions = mergeOptionDefaults<ExportOptions>(
    preset.exportDefaults,
    analysis.exportOptions,
  );
  const isSourceReplica = !!exportOptions.sourceReplica;
  const squareEdges = isSourceReplica || !!exportOptions.squareEdges;
  const isNewsBrief =
    isInfographicAnalysis(analysis) &&
    analysis.infographicData.subType === "news_brief";
  // 최종 출처 줄에는 원문 근거만 남기고 내부 제작 메타데이터만 제거한다.
  const cleanedSource = cleanSourceText(structure.source);

  return (
    <div
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        position: "relative",
        // export 모드(헤더/인사이트 모두 꺼짐)에서는 투명 → 상위 div의 배경색 사용
        background: isCompactExportCard ? "transparent" : colors.surface,
        borderRadius: squareEdges
          ? 0
          : isCompactExportCard
            ? `${preset.card.borderRadius}px ${preset.card.borderRadius}px 0 0`
            : preset.card.borderRadius,
        border:
          isSourceReplica || (isCompactExportCard && exportOptions.contentBorder === false)
            ? "0"
            : `${preset.card.borderWidth}px solid ${colors.border}`,
        boxShadow: isCompactExportCard ? "none" : preset.card.shadow,
        overflow: "hidden",
        fontFamily: preset.typography.fontFamily ?? theme.typography.fontFamily.sans,
      }}
    >
      {/* ── 헤더: 제목 + 헤드라인 (showHeader=false면 숨김) ── */}
      {showHeader && (
        <div style={{ padding: "24px 28px 0" }}>
          <h2
            style={{
              color: colors.textPrimary,
              fontSize: theme.typography.fontSize.chartTitle,
              fontWeight: preset.typography.titleWeight,
              margin: 0,
              lineHeight: 1.3,
              letterSpacing: preset.typography.titleLetterSpacing,
            }}
          >
            {headMessage}
          </h2>

          {subMessage && (
            <p
              style={{
                color: colors.textSecondary,
                fontSize: theme.typography.fontSize.messageSubtitle,
                fontWeight: resolveSubMessageWeight(
                  exportOptions.subtitleFontWeight,
                  preset.typography.subtitleWeight,
                ),
                margin: "8px 0 0",
                lineHeight: 1.5,
              }}
            >
              {subMessage}
            </p>
          )}

          {metaMessage && (
            <p
              style={{
                // 부제/메타 텍스트가 textTertiary(옅은 회색)라 거의 안 보였음(D7-b).
                // textSecondary로 올려 대비를 확보한다. 폰트 크기/굵기는 그대로 두어
                // 제목·본문 대비 위계는 유지하면서 판독 가능하게 만든다.
                color: colors.textSecondary,
                fontSize: theme.typography.fontSize.chartSubtitle,
                fontWeight: theme.typography.fontSize.chartSubtitleWeight,
                margin: "8px 0 0",
                lineHeight: 1.4,
              }}
            >
              {metaMessage}
            </p>
          )}

          {/* 헤드라인 수치 (포커스 포인트) */}
          {!isNewsBrief && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <span
                style={{
                  color: colors.textPrimary,
                  fontSize: theme.typography.fontSize.heroValue,
                  fontWeight: theme.typography.fontSize.heroValueWeight,
                  fontFamily: theme.typography.fontFamily.mono,
                  letterSpacing: 0,
                }}
              >
                {emphasis.focusPoint.displayText}
              </span>

              {/* 변화율 뱃지 — 차트만 해당 (표/인포그래픽에는 statistics가 없음) */}
              {isChartAnalysis(analysis) && analysis.statistics.changeRates[0] && (
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 8,
                    fontSize: "26px",
                    fontWeight: 700,
                    fontFamily: theme.typography.fontFamily.mono,
                    background:
                      analysis.statistics.changeRates[0].percentChange >= 0
                        ? colors.positiveSubtle
                        : colors.negativeSubtle,
                    color:
                      analysis.statistics.changeRates[0].percentChange >= 0
                        ? colors.positive
                        : colors.negative,
                  }}
                >
                  {analysis.statistics.changeRates[0].percentChange >= 0
                    ? "+"
                    : ""}
                  {analysis.statistics.changeRates[0].percentChange.toFixed(1)}%
                </span>
              )}

              {fidelityNotice && (
                <span
                  style={{
                    alignSelf: "center",
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: `1px solid ${colors.borderSubtle}`,
                    color: colors.textTertiary,
                    fontSize: "14px",
                    fontWeight: 800,
                    letterSpacing: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {fidelityNotice}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 차트 영역 ── */}
      <div
        style={{
          padding: isSourceReplica ? 0 : isCompactExportCard ? 0 : "16px 12px",
          height: height || "auto",
        }}
      >
        {children}
      </div>

      {/* ── 축 왜곡 경고 (차트만 해당, export 모드에서는 숨김) ── */}
      {showHeader && "axisDistortionWarning" in structure && structure.axisDistortionWarning && (
        <div
          style={{
            margin: "0 28px",
            padding: "8px 12px",
            background: colors.warningSubtle,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: "21px" }}>⚠</span>
          <span
            style={{
              color: colors.warning,
              fontSize: "18px",
            }}
          >
            {structure.axisDistortionWarning}
          </span>
        </div>
      )}

      {/* ── 하단 출처 패널 ── */}
      {showInsights && !isNewsBrief && cleanedSource && (
        <div
          style={{
            padding: "16px 28px 24px",
            borderTop: `1px solid ${colors.borderSubtle}`,
            marginTop: 8,
          }}
        >
          <p
            style={{
              color: colors.textTertiary,
              fontSize: "20px",
              fontWeight: 500,
              margin: 0,
            }}
          >
            출처: {cleanedSource}
          </p>
        </div>
      )}

      {!isCompactExportCard && <Watermark color={colors.textTertiary} />}
    </div>
  );
}
