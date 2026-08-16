/**
 * =====================================================
 * TossDonutChart — 토스증권 스타일 도넛 차트
 * =====================================================
 *
 * 비율/구성 데이터에 적합합니다.
 * 예: 포트폴리오 비중, 매출 구성비, 시장 점유율 등
 *
 * 토스 스타일 특징:
 * - 중앙에 핵심 수치 표시
 * - 호버 시 해당 세그먼트 강조
 * - 깔끔한 범례 (우측 또는 하단)
 * - 작은 세그먼트는 "기타"로 묶기
 */

"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import type { ChartAnalysis } from "@/lib/analysis/schema";
import {
  getAnalysisStylePreset,
  getAnalysisThemeMode,
  getPresetColors,
} from "@/lib/style-presets";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";
import { formatNumber } from "@/lib/analysis/insight-engine";

interface TossDonutChartProps {
  analysis: ChartAnalysis;
  theme?: ThemeMode;
  width?: number | `${number}%`;
  height?: number;
  animated?: boolean;
}

export default function TossDonutChart({
  analysis,
  theme: themeMode = "dark",
  width = "100%",
  height = 350,
  animated = true,
}: TossDonutChartProps) {
  const renderThemeMode = getAnalysisThemeMode(analysis, themeMode);
  const theme = getTheme(renderThemeMode);
  const preset = getAnalysisStylePreset(analysis);
  const colors = getPresetColors(preset, renderThemeMode);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const firstSeries = analysis.data.series[0];
  if (!firstSeries) return null;

  // 도넛 차트 데이터 준비
  const chartData = firstSeries.data
    .map((point) => ({
      name: String(point.x),
      value: Math.abs(point.y), // 비율은 양수여야 함
    }))
    .sort((a, b) => b.value - a.value); // 큰 순서대로 정렬

  // 전체 합계 (중앙 표시용)
  const total = chartData.reduce((sum, d) => sum + d.value, 0);
  const centerLabel = /[가-힣]/.test(analysis.structure.title) ? "전체" : "Total";

  return (
    <div style={{ width, height }}>
      <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
        {/* 도넛 차트 */}
        <div style={{ flex: "1 1 60%", position: "relative" }}>
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="55%" // 도넛 구멍 크기
                outerRadius="80%"
                paddingAngle={2} // 세그먼트 간 간격
                dataKey="value"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                isAnimationActive={animated}
                animationDuration={theme.animation.chartEntrance.duration}
                animationEasing="ease-out"
                stroke="none"
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors.series[index % colors.series.length]}
                    opacity={
                      activeIndex === null || activeIndex === index ? 1 : 0.4
                    }
                    style={{
                      transition: "opacity 150ms ease-out",
                    }}
                  />
                ))}
              </Pie>

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const data = payload[0];
                  const percentage = ((Number(data.value) / total) * 100).toFixed(1);

                  return (
                    <div
                      style={{
                        background: colors.tooltipBg,
                        border: `1px solid ${colors.tooltipBorder}`,
                        borderRadius: 12,
                        padding: "12px 16px",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      }}
                    >
                      <div
                        style={{
                          color: colors.textSecondary,
                          fontSize: 20,
                          marginBottom: 4,
                        }}
                      >
                        {data.name}
                      </div>
                      <div
                        style={{
                          color: colors.textPrimary,
                          fontSize: 28,
                          fontWeight: 700,
                          fontFamily: theme.typography.fontFamily.mono,
                        }}
                      >
                        {percentage}%
                      </div>
                      <div
                        style={{
                          color: colors.textTertiary,
                          fontSize: 18,
                          fontFamily: theme.typography.fontFamily.mono,
                        }}
                      >
                        {formatNumber(Number(data.value))}
                        {analysis.structure.yAxis.unit || ""}
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* 중앙 텍스트 (총합 또는 포커스 수치) */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {activeIndex !== null ? (
              // 호버 중: 해당 세그먼트 수치
              <>
                <div
                  style={{
                    color: colors.textPrimary,
                    fontSize: 40,
                    fontWeight: 700,
                    fontFamily: theme.typography.fontFamily.mono,
                  }}
                >
                  {((chartData[activeIndex].value / total) * 100).toFixed(1)}%
                </div>
                <div
                  style={{
                    color: colors.textSecondary,
                    fontSize: 20,
                    marginTop: 2,
                  }}
                >
                  {chartData[activeIndex].name}
                </div>
              </>
            ) : (
              // 기본: 전체 합계
              <>
                <div
                  style={{
                    color: colors.textSecondary,
                    fontSize: 18,
                    marginBottom: 2,
                  }}
                >
                  {centerLabel}
                </div>
                <div
                  style={{
                    color: colors.textPrimary,
                    fontSize: 34,
                    fontWeight: 800,
                    fontFamily: theme.typography.fontFamily.mono,
                  }}
                >
                  {formatNumber(total)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 범례 (우측) */}
        <div
          style={{
            flex: "1 1 40%",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            paddingLeft: 16,
          }}
        >
          {chartData.map((item, index) => {
            const percentage = ((item.value / total) * 100).toFixed(1);
            const isActive = activeIndex === index;

            return (
              <div
                key={item.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: isActive ? colors.surfaceHover : "transparent",
                  cursor: "pointer",
                  transition: "background 150ms ease-out",
                }}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {/* 색상 원 */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background:
                      colors.series[index % colors.series.length],
                    flexShrink: 0,
                  }}
                />

                {/* 이름 */}
                <span
                  style={{
                    color: colors.textSecondary,
                    fontSize: 20,
                    flex: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.name}
                </span>

                {/* 비율 */}
                <span
                  style={{
                    color: colors.textPrimary,
                    fontSize: 20,
                    fontWeight: 700,
                    fontFamily: theme.typography.fontFamily.mono,
                    flexShrink: 0,
                  }}
                >
                  {percentage}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
