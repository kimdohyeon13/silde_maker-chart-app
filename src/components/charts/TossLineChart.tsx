/**
 * =====================================================
 * TossLineChart — 토스증권 스타일 꺾은선 차트
 * =====================================================
 *
 * 가장 많이 쓰이는 차트 타입입니다.
 * 주가 추이, 매출 변화, 시계열 데이터 등에 사용됩니다.
 *
 * 토스증권 스타일 특징:
 * - 부드러운 곡선 (monotone interpolation)
 * - 그라데이션 영역 (선 아래 은은한 색 채움)
 * - 최소한의 격자선 (가로만, 세로는 없음)
 * - 깔끔한 툴팁 (호버 시 수치 표시)
 * - 어노테이션 (핵심 포인트에 라벨)
 * - originalColor: 원본 차트 색상을 최대한 존중
 * - 전망/forecast 시리즈는 점선(dashed)으로 표시
 * - 스마트 어노테이션 위치 (겹침/잘림 자동 방지)
 *
 * Recharts 라이브러리를 사용합니다.
 */

"use client";

import React from "react";
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  Area,
  ComposedChart,
  Legend,
} from "recharts";
import type { ChartAnalysis } from "@/lib/analysis/schema";
import { getTheme, getRechartsStyle, type ThemeMode } from "@/lib/theme/toss-theme";
import { formatNumber } from "@/lib/analysis/insight-engine";
import { chartSettings } from "@/lib/chart-settings";

interface TossLineChartProps {
  analysis: ChartAnalysis;
  theme?: ThemeMode;
  width?: number;
  height?: number;
  showAnnotations?: boolean;
  animated?: boolean;
}

/**
 * 전망/예측 시리즈인지 판별하는 헬퍼 함수
 *
 * 왜 필요한가?
 * → 원본 차트에서 "전망", "forecast" 같은 시리즈는
 *   점선(dashed line)으로 표시되는 경우가 많습니다.
 * → 이 함수로 시리즈 이름에 전망 관련 키워드가 있는지 확인합니다.
 */
const FORECAST_KEYWORDS = ["전망", "forecast", "예상", "추정", "예측", "projected"];

function isForecastSeries(name: string): boolean {
  const lower = name.toLowerCase();
  return FORECAST_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * 다크모드에서 너무 어두운 색상을 밝게 보정하는 맵
 *
 * 왜 필요한가?
 * → 원본 차트가 라이트 배경이라 짙은 네이비(#1B365D) 같은 색이
 *   다크 배경에서는 거의 안 보입니다.
 * → 그래서 다크모드에서만 밝은 색으로 자동 변환합니다.
 */
const DARK_MODE_COLOR_MAP: Record<string, string> = {
  "#1B365D": "#7EB8FF", // 짙은 네이비 → 밝은 파랑
  "#1b365d": "#7EB8FF",
  "#000000": "#E6EDF3", // 검정 → 밝은 회색
  "#333333": "#C0C0C0", // 짙은 회색 → 밝은 회색
  "#1a1a1a": "#D0D0D0",
};

export default function TossLineChart({
  analysis,
  theme: themeMode = "dark",
  width = 800,
  height = 350,
  showAnnotations = true,
  animated = true,
}: TossLineChartProps) {
  const theme = getTheme(themeMode);
  const styles = getRechartsStyle(themeMode);
  const { colors } = theme;

  // 듀얼 축 여부 판단
  const hasSecondaryYAxis = !!analysis.structure.secondaryYAxis;

  // 시리즈가 2개 이상이면 범례(Legend)를 보여준다
  const showLegend = analysis.data.series.length > 1;

  /**
   * getSeriesColor — 시리즈의 색상을 결정하는 함수
   *
   * 우선순위:
   * 1. legend에 originalColor가 있으면 → 그 색상 사용 (원본 존중)
   * 2. 다크모드에서 너무 어두운 색이면 → 밝은 색으로 보정
   * 3. originalColor가 없으면 → 기본 시리즈 색상표에서 선택
   */
  function getSeriesColor(i: number): string {
    const legendItem = analysis.structure.legend[i];
    if (legendItem?.originalColor) {
      const oc = legendItem.originalColor;
      if (themeMode === "dark" && DARK_MODE_COLOR_MAP[oc]) {
        return DARK_MODE_COLOR_MAP[oc];
      }
      return oc;
    }
    return colors.series[i % colors.series.length];
  }

  // ─────────────────────────────────────────────
  // 데이터를 Recharts 형식으로 변환
  // ─────────────────────────────────────────────
  const chartData = (() => {
    if (!analysis.data.series[0]) return [];
    const xSet = new Map<string, Record<string, string | number>>();
    for (const series of analysis.data.series) {
      for (const point of series.data) {
        const xKey = String(point.x);
        if (!xSet.has(xKey)) {
          xSet.set(xKey, { x: xKey });
        }
        xSet.get(xKey)![series.name] = point.y;
      }
    }
    // X값 기준으로 정렬 (여러 시리즈에서 고유한 X값이 뒤로 밀리는 문제 방지)
    // "Q4 2015" 같은 분기 형식은 연도 우선 정렬, "2024-01" 같은 날짜는 문자열 정렬
    const parseX = (x: string): string => {
      const qm = x.match(/^Q(\d)\s+(\d{4})$/);
      if (qm) return `${qm[2]}-Q${qm[1]}`; // "Q4 2015" → "2015-Q4"
      return x;
    };
    return Array.from(xSet.values()).sort((a, b) => {
      const ax = parseX(String(a.x));
      const bx = parseX(String(b.x));
      return ax < bx ? -1 : ax > bx ? 1 : 0;
    });
  })();

  // ─────────────────────────────────────────────
  // Y축 범위 계산 (어노테이션 위치 판단용)
  // ─────────────────────────────────────────────
  const yMin = analysis.structure.yAxis.min ?? (() => {
    let min = Infinity;
    for (const s of analysis.data.series) {
      for (const p of s.data) if (p.y < min) min = p.y;
    }
    return min === Infinity ? 0 : min;
  })();
  const yMax = analysis.structure.yAxis.max ?? (() => {
    let max = -Infinity;
    for (const s of analysis.data.series) {
      for (const p of s.data) if (p.y > max) max = p.y;
    }
    return max === -Infinity ? 100 : max;
  })();

  // ─────────────────────────────────────────────
  // 어노테이션 충돌 감지 + 필터링
  // ─────────────────────────────────────────────
  /**
   * 왜 충돌 감지가 필요한가?
   * → Y좌표가 비슷한 어노테이션이 여러 개면 화면에서 글자가 겹침
   * → Y값 차이가 전체 범위의 12% 미만이면 "겹친다"고 판단
   * → 중요도 순으로 유지하고, 겹치는 것은 제거
   * → 최대 4개만 표시 (너무 많으면 오히려 가독성 하락)
   */
  const annotationPoints = (() => {
    if (!showAnnotations) return [];
    const candidates = analysis.emphasis.annotations
      .filter((a) => a.importance === "critical" || a.importance === "high")
      .filter((a) => a.position.y !== undefined && a.position.y !== null)
      .slice(0, 8);
    const yRange = (yMax - yMin) || 1;
    const MIN_Y_GAP_RATIO = 0.12;
    const kept: typeof candidates = [];
    for (const ann of candidates) {
      const annY = ann.position.y ?? 0;
      const tooClose = kept.some((ex) => {
        const exY = ex.position.y ?? 0;
        return Math.abs(annY - exY) / yRange < MIN_Y_GAP_RATIO;
      });
      if (!tooClose) kept.push(ann);
      if (kept.length >= 4) break;
    }
    return kept;
  })();

  // 추세선
  const trendLines = analysis.emphasis.trendLines || [];

  // ─────────────────────────────────────────────
  // 어노테이션 텍스트 정리
  // ─────────────────────────────────────────────
  /**
   * cleanAnnotationText
   *
   * 왜 필요한가?
   * → 줄바꿈(\n)은 SVG에서 무시됨 → 공백으로 교체
   * → 너무 긴 텍스트는 차트 밖으로 삐져나옴 → 길이 제한
   *
   * 설정: chartSettings.annotation.maxTextLength
   */
  function cleanAnnotationText(text: string): string {
    const cleaned = text.replace(/\n/g, " ");
    const maxLen = chartSettings.annotation.maxTextLength;
    if (cleaned.length > maxLen) {
      return cleaned.slice(0, maxLen) + "…";
    }
    return cleaned;
  }

  // ─────────────────────────────────────────────
  // 어노테이션 위치 자동 계산 (스마트 포지셔닝)
  // ─────────────────────────────────────────────
  /**
   * getSmartLabelPosition
   *
   * 왜 필요한가?
   * → 라벨이 차트 선과 겹치거나, 차트 밖으로 잘리는 것을 방지
   * → 컨설팅 장표 수준의 깔끔한 배치를 위해 자동 위치 계산
   *
   * 규칙:
   * 1. 오른쪽 끝 근처 (75% 이후) → 왼쪽에 배치 (잘림 방지)
   * 2. 차트 상단 근처 (85% 이상) → 아래에 배치
   * 3. 차트 하단 근처 (25% 이하) → 위에 배치 + 간격 넉넉히
   * 4. 그 외 → 위에 배치 (기본)
   */
  function getSmartLabelPosition(ann: (typeof annotationPoints)[number]): {
    position: "top" | "bottom" | "left" | "right";
    offset: number;
  } {
    const yValue = ann.position.y ?? 0;
    const yRange = yMax - yMin || 1;
    const yRatio = (yValue - yMin) / yRange; // 0 = 차트 하단, 1 = 차트 상단

    // X축 위치 판단
    const xStr = String(ann.position.x);
    const xIndex = chartData.findIndex((d) => d.x === xStr);
    const xRatio = xIndex >= 0 ? xIndex / (chartData.length || 1) : 0.5;

    const baseOffset = chartSettings.annotation.offset;

    // 규칙 1: 오른쪽 끝 25% → 왼쪽에 배치 (텍스트 잘림 방지)
    if (xRatio > 0.75) {
      return { position: "left", offset: baseOffset + 6 };
    }

    // 규칙 2: 차트 상단 15% → 아래에 배치 (상단 잘림 방지)
    if (yRatio > 0.85) {
      return { position: "bottom", offset: baseOffset };
    }

    // 규칙 3: 차트 하단 25% → 위에 배치 + 간격 넉넉히 (차트선 겹침 방지)
    if (yRatio < 0.25) {
      return {
        position: "top",
        offset: baseOffset + chartSettings.annotation.bottomExtraOffset,
      };
    }

    // 기본: 위에 배치
    return { position: "top", offset: baseOffset };
  }

  // ─────────────────────────────────────────────
  // X축 라벨 간격 계산
  // ─────────────────────────────────────────────
  const xLabelInterval = (() => {
    const len = chartData.length;
    const maxLabels = chartSettings.xAxis.maxVisibleLabels;
    if (len <= maxLabels) return 0;
    return Math.ceil(len / maxLabels);
  })();

  // ─────────────────────────────────────────────
  // 여백 계산 (chartSettings 기반)
  // ─────────────────────────────────────────────
  const computedMargin = {
    top: chartSettings.margin.top,
    right: hasSecondaryYAxis
      ? chartSettings.margin.right + chartSettings.dualAxis.extraRightMargin
      : chartSettings.margin.right,
    bottom: showLegend
      ? chartSettings.margin.bottom + chartSettings.legend.extraBottomMargin
      : chartSettings.margin.bottom,
    left: chartSettings.margin.left,
  };

  return (
    <ResponsiveContainer width={width} height={height}>
      <ComposedChart data={chartData} margin={computedMargin}>
        {/* 그라데이션 정의 */}
        <defs>
          {analysis.data.series.map((series, i) => {
            const color = getSeriesColor(i);
            return (
              <linearGradient
                key={series.name}
                id={`gradient-${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>

        {/* 격자선 — 가로만 (토스 스타일) */}
        <CartesianGrid {...styles.grid} />

        {/* X축 */}
        <XAxis
          dataKey="x"
          {...styles.xAxis}
          interval={xLabelInterval}
        />

        {/* Y축 (좌측) — width로 숫자 잘림 방지 */}
        <YAxis
          yAxisId="left"
          width={chartSettings.yAxis.width}
          {...styles.yAxis}
          tickFormatter={(value) => {
            const yMin = analysis.structure.yAxis.min;
            const yMax = analysis.structure.yAxis.max;
            const range = (yMin != null && yMax != null) ? yMax - yMin : Infinity;
            // 좁은 범위에서는 소수점 자릿수를 늘려 라벨이 구분되도록
            let fractionDigits = 1;
            if (range > 0 && range < 1) fractionDigits = 2;
            if (range > 0 && range < 0.1) fractionDigits = 3;
            const num = Number(value).toLocaleString("ko-KR", {
              minimumFractionDigits: fractionDigits,
              maximumFractionDigits: fractionDigits,
            });
            const unit = analysis.structure.yAxis.unit || "";
            if (!unit) return num;
            // %, $/bbl 등 기호로 시작하면 바로 붙이고, 글자면 공백 추가
            if (/^[%$€¥£₩\/]/.test(unit)) return num + unit;
            return num + unit;
          }}
          domain={[
            analysis.structure.yAxis.min ?? "auto",
            analysis.structure.yAxis.max ?? "auto",
          ]}
        />

        {/* 보조 Y축 (우측) — 듀얼 축인 경우만 */}
        {hasSecondaryYAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            width={chartSettings.yAxis.rightWidth}
            {...styles.yAxis}
            tickFormatter={(value) =>
              formatNumber(Number(value)) + (analysis.structure.secondaryYAxis!.unit || "")
            }
            domain={[
              analysis.structure.secondaryYAxis!.min ?? "auto",
              analysis.structure.secondaryYAxis!.max ?? "auto",
            ]}
          />
        )}

        {/* 툴팁 */}
        <Tooltip
          {...styles.tooltip}
          formatter={(value, name) => [
            formatNumber(Number(value)) + (analysis.structure.yAxis.unit || ""),
            name,
          ]}
          labelFormatter={(label) => String(label)}
        />

        {/* 범례 — 시리즈가 2개 이상일 때만 */}
        {showLegend && (
          <Legend
            wrapperStyle={{
              fontFamily: theme.typography.fontFamily.sans,
              fontSize: "16px",
              fontWeight: 700,
              color: colors.textSecondary,
              paddingTop: 12,
            }}
            formatter={(value) => {
              return (
                <span style={{ color: colors.textSecondary, fontWeight: 600 }}>
                  {value}
                </span>
              );
            }}
          />
        )}

        {/* 하이라이트 구간 */}
        {analysis.emphasis.highlightZones.map((zone, i) => (
          <ReferenceLine
            key={`zone-${i}`}
            yAxisId="left"
            x={String(zone.fromX)}
            stroke="transparent"
            label=""
          />
        ))}

        {/* 영역 채움 (그라데이션) — 전망 시리즈는 제외 */}
        {analysis.data.series.map((series, i) => {
          if (isForecastSeries(series.name)) return null;
          const legendItem = analysis.structure.legend[i];
          const role = series.role ?? legendItem?.role;
          const roleStyle = role === "secondary"
            ? chartSettings.seriesRole.secondary
            : chartSettings.seriesRole.primary;
          return (
            <Area
              key={`area-${series.name}`}
              type="monotone"
              dataKey={series.name}
              yAxisId={hasSecondaryYAxis && i > 0 ? "right" : "left"}
              fill={`url(#gradient-${i})`}
              stroke="none"
              legendType="none"
              opacity={roleStyle.areaOpacity}
              isAnimationActive={animated}
              animationDuration={theme.animation.chartEntrance.duration}
              animationEasing="ease-out"
            />
          );
        })}

        {/* 선 그리기 */}
        {analysis.data.series.map((series, i) => {
          const seriesColor = getSeriesColor(i);
          const isForecast = isForecastSeries(series.name);
          const legendItem = analysis.structure.legend[i];
          const role = series.role ?? legendItem?.role;
          const roleStyle = role === "secondary"
            ? chartSettings.seriesRole.secondary
            : chartSettings.seriesRole.primary;

          return (
            <Line
              key={series.name}
              type="monotone"
              dataKey={series.name}
              yAxisId={hasSecondaryYAxis && i > 0 ? "right" : "left"}
              stroke={seriesColor}
              strokeDasharray={isForecast ? "8 4" : undefined}
              strokeWidth={isForecast ? 3.2 : roleStyle.strokeWidth}
              strokeOpacity={roleStyle.opacity}
              dot={false}
              activeDot={{
                r: role === "secondary" ? 5 : 7,
                stroke: colors.surface,
                strokeWidth: role === "secondary" ? 2.5 : 3.5,
                fill: seriesColor,
              }}
              connectNulls
              isAnimationActive={animated}
              animationDuration={
                theme.animation.chartEntrance.duration +
                i * theme.animation.chartEntrance.staggerDelay
              }
              animationEasing="ease-out"
            />
          );
        })}

        {/* 평균선 (추세선이 있으면) */}
        {trendLines
          .filter((tl) => tl.label?.includes("평균"))
          .map((tl, i) => (
            <ReferenceLine
              key={`avg-${i}`}
              yAxisId="left"
              y={tl.from.y}
              stroke={tl.color}
              strokeDasharray="4 4"
              label={{
                value: tl.label || "",
                position: "right",
                fill: colors.textTertiary,
                fontSize: 22,
                fontWeight: 700,
                fontFamily: theme.typography.fontFamily.mono,
              }}
            />
          ))}

        {/* 어노테이션 포인트 (핵심 데이터에 표시) — 스마트 위치 */}
        {annotationPoints.map((ann, i) => {
          const { position, offset } = getSmartLabelPosition(ann);
          const cleanedText = cleanAnnotationText(ann.text);

          return (
            <ReferenceDot
              key={`ann-${i}`}
              yAxisId="left"
              x={String(ann.position.x)}
              y={ann.position.y ?? 0}
              r={ann.importance === "critical" ? 6 : 5}
              fill={
                ann.style === "positive"
                  ? colors.positive
                  : ann.style === "negative"
                    ? colors.negative
                    : colors.accent
              }
              stroke={colors.surface}
              strokeWidth={2.5}
              label={{
                value: cleanedText,
                position: position,
                offset: offset,
                fill:
                  ann.style === "positive"
                    ? colors.positive
                    : ann.style === "negative"
                      ? colors.negative
                      : colors.textPrimary,
                fontSize: ann.importance === "critical" ? 18 : 16,
                fontWeight: 800,
                fontFamily: theme.typography.fontFamily.mono,
              }}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
