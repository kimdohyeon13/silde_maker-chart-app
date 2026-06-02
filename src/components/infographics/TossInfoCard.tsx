/**
 * =====================================================
 * TossInfoCard — 토스증권 스타일 인포그래픽 컴포넌트
 * =====================================================
 *
 * 다양한 인포그래픽 형태를 서브타입별로 분기하여 렌더링합니다.
 *
 * 지원하는 서브타입:
 * - kpi_card: KPI 카드 (주요 지표 나열)
 * - comparison_card: 비교 카드 (항목 vs 항목)
 * - stat_matrix: 통계 매트릭스 (밀도 높은 KPI 그리드)
 * - process_flow: 프로세스 플로우 (단계별)
 * - timeline: 타임라인 (시간순 이벤트)
 * - feature_list: 특징/스펙 리스트
 * - news_brief: 뉴스 번역/요약 카드
 *
 * 설계 원칙:
 * → 순수 HTML + inline style (PNG 캡처 호환)
 * → 테마 시스템(toss-theme.ts) 색상 사용
 * → chart-settings.ts의 infographic 섹션에서 크기 조절 가능
 */

"use client";

import React from "react";
import type {
  InfographicAnalysis,
  InfographicData,
  KpiItem,
  TimelineEvent,
} from "@/lib/analysis/schema";
import {
  getAnalysisThemeMode,
} from "@/lib/style-presets";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";
import { chartSettings } from "@/lib/chart-settings";

interface TossInfoCardProps {
  analysis: InfographicAnalysis;
  theme?: ThemeMode;
}

export default function TossInfoCard({
  analysis,
  theme: themeMode = "dark",
}: TossInfoCardProps) {
  const { infographicData } = analysis;
  const renderThemeMode = getAnalysisThemeMode(analysis, themeMode);

  // 서브타입별 분기 — switch로 각 서브 렌더러를 선택
  switch (infographicData.subType) {
    case "kpi_card":
      return <KpiGrid data={infographicData} themeMode={renderThemeMode} />;
    case "stat_matrix":
      return <StatMatrix data={infographicData} themeMode={renderThemeMode} />;
    case "comparison_card":
      return <ComparisonGrid data={infographicData} themeMode={renderThemeMode} />;
    case "process_flow":
      return <ProcessFlow data={infographicData} themeMode={renderThemeMode} />;
    case "timeline":
      return <TimelineLine data={infographicData} themeMode={renderThemeMode} />;
    case "feature_list":
      return <FeatureList data={infographicData} themeMode={renderThemeMode} />;
    case "news_brief":
      return <NewsBriefCard data={infographicData} themeMode={renderThemeMode} />;
    default:
      return <FallbackRenderer data={infographicData} themeMode={renderThemeMode} />;
  }
}

// ─────────────────────────────────────────────
// KpiGrid — KPI 카드 그리드
// ─────────────────────────────────────────────
// 주요 지표를 카드 형태로 나열. 예: 매출 1.2조 ↑12.3%

function KpiGrid({
  data,
  themeMode,
}: {
  data: Extract<InfographicData, { subType: "kpi_card" }>;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  const { colors, typography } = theme;
  const cfg = chartSettings.infographic.kpiCard;
  const isDark = themeMode === "dark";

  // 레이아웃 결정: grid(2×N), row(가로), column(세로)
  const layout = data.layout ?? "grid";
  const gridCols = layout === "column" ? 1 : layout === "row" ? data.items.length : 2;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gap: cfg.gap,
        padding: "8px 12px",
      }}
    >
      {data.items.map((item, i) => (
        <KpiCardItem key={i} item={item} colors={colors} typography={typography} cfg={cfg} isDark={isDark} />
      ))}
    </div>
  );
}

/** 개별 KPI 카드 항목 */
function KpiCardItem({
  item,
  colors,
  typography,
  cfg,
  isDark,
}: {
  item: KpiItem;
  colors: ReturnType<typeof getTheme>["colors"];
  typography: ReturnType<typeof getTheme>["typography"];
  cfg: typeof chartSettings.infographic.kpiCard;
  isDark: boolean;
}) {
  // 변화 방향에 따른 색상과 화살표
  const changeColor = item.change
    ? item.change.direction === "up"
      ? colors.positive
      : item.change.direction === "down"
        ? colors.negative
        : colors.textSecondary
    : undefined;

  const changeArrow = item.change
    ? item.change.direction === "up"
      ? "▲"
      : item.change.direction === "down"
        ? "▼"
        : "―"
    : undefined;

  const changeBg = item.change
    ? item.change.direction === "up"
      ? colors.positiveSubtle
      : item.change.direction === "down"
        ? colors.negativeSubtle
        : "transparent"
    : undefined;

  return (
    <div
      style={{
        padding: cfg.padding,
        borderRadius: cfg.borderRadius,
        background: isDark ? "rgba(230, 237, 243, 0.03)" : "rgba(31, 35, 40, 0.02)",
        border: `1px solid ${isDark ? "rgba(48, 54, 61, 0.5)" : "rgba(208, 215, 222, 0.5)"}`,
        minWidth: cfg.minWidth,
      }}
    >
      {/* 아이콘 + 레이블 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {item.icon && <span style={{ fontSize: "16px" }}>{item.icon}</span>}
        <span
          style={{
            fontSize: cfg.labelSize,
            color: colors.textSecondary,
            fontFamily: typography.fontFamily.sans,
            fontWeight: 500,
          }}
        >
          {item.label}
        </span>
      </div>

      {/* 주 수치 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: cfg.valueSize,
            fontWeight: 700,
            color: item.accentColor ?? colors.textPrimary,
            fontFamily: typography.fontFamily.mono,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          {item.value}
        </span>
        {item.unit && (
          <span
            style={{
              fontSize: "16px",
              color: colors.textSecondary,
              fontFamily: typography.fontFamily.sans,
            }}
          >
            {item.unit}
          </span>
        )}
      </div>

      {/* 변화율 뱃지 */}
      {item.change && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: cfg.changeSize,
              fontWeight: 600,
              fontFamily: typography.fontFamily.mono,
              background: changeBg,
              color: changeColor,
            }}
          >
            {changeArrow} {Math.abs(item.change.value)}%
          </span>
          <span
            style={{
              fontSize: "14px",
              color: colors.textTertiary,
              fontFamily: typography.fontFamily.sans,
            }}
          >
            {item.change.period}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// StatMatrix — 통계 매트릭스 (밀도 높은 KPI 그리드)
// ─────────────────────────────────────────────

function StatMatrix({
  data,
  themeMode,
}: {
  data: Extract<InfographicData, { subType: "stat_matrix" }>;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  const { colors, typography } = theme;
  const cols = data.columns ?? 3;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 12,
        padding: "8px 12px",
      }}
    >
      {data.items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <div
            style={{
              fontSize: "14px",
              color: colors.textSecondary,
              fontFamily: typography.fontFamily.sans,
              marginBottom: 4,
            }}
          >
            {item.label}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: colors.textPrimary,
                fontFamily: typography.fontFamily.mono,
              }}
            >
              {item.value}
            </span>
            {item.unit && (
              <span style={{ fontSize: "14px", color: colors.textTertiary }}>{item.unit}</span>
            )}
          </div>
          {item.change && (
            <span
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color:
                  item.change.direction === "up"
                    ? colors.positive
                    : item.change.direction === "down"
                      ? colors.negative
                      : colors.textSecondary,
                fontFamily: typography.fontFamily.mono,
              }}
            >
              {item.change.direction === "up" ? "+" : item.change.direction === "down" ? "" : ""}
              {item.change.value}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// ComparisonGrid — 비교 카드
// ─────────────────────────────────────────────

function ComparisonGrid({
  data,
  themeMode,
}: {
  data: Extract<InfographicData, { subType: "comparison_card" }>;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  const { colors, typography } = theme;
  const cfg = chartSettings.infographic.comparison;
  const isDark = themeMode === "dark";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${data.items.length}, 1fr)`,
        gap: cfg.gap,
        padding: "8px 12px",
      }}
    >
      {data.items.map((item, i) => (
        <div
          key={i}
          style={{
            borderRadius: 12,
            border: item.isWinner
              ? `${cfg.winnerBorderWidth}px solid ${colors.accent}`
              : `1px solid ${isDark ? "rgba(48, 54, 61, 0.5)" : "rgba(208, 215, 222, 0.5)"}`,
            background: item.isWinner
              ? isDark ? "rgba(88, 166, 255, 0.06)" : "rgba(9, 105, 218, 0.04)"
              : undefined,
            overflow: "hidden",
          }}
        >
          {/* 카드 헤더 */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: `1px solid ${colors.borderSubtle}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: colors.textPrimary,
                fontFamily: typography.fontFamily.sans,
              }}
            >
              {item.name}
            </span>
            {item.isWinner && (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: "13px",
                  fontWeight: 700,
                  background: colors.accentSubtle,
                  color: colors.accent,
                }}
              >
                추천
              </span>
            )}
            {item.overallScore != null && (
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  fontFamily: typography.fontFamily.mono,
                  color: colors.accent,
                }}
              >
                {item.overallScore}
              </span>
            )}
          </div>

          {/* 속성 리스트 */}
          <div style={{ padding: "8px 0" }}>
            {data.comparisonAttributes.map((attr) => {
              const attrData = item.attributes[attr];
              if (!attrData) return null;

              const attrColor =
                attrData.highlight === "positive"
                  ? colors.positive
                  : attrData.highlight === "negative"
                    ? colors.negative
                    : colors.textPrimary;

              return (
                <div
                  key={attr}
                  style={{
                    padding: "10px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: "15px",
                      color: colors.textSecondary,
                      fontFamily: typography.fontFamily.sans,
                    }}
                  >
                    {attr}
                  </span>
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: attrColor,
                      fontFamily: typography.fontFamily.mono,
                    }}
                  >
                    {attrData.displayValue ?? String(attrData.value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// ProcessFlow — 프로세스 플로우
// ─────────────────────────────────────────────

function ProcessFlow({
  data,
  themeMode,
}: {
  data: Extract<InfographicData, { subType: "process_flow" }>;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  const { colors, typography } = theme;
  const cfg = chartSettings.infographic.processFlow;
  const isHorizontal = data.direction !== "vertical";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isHorizontal ? "row" : "column",
        alignItems: "center",
        gap: cfg.gap,
        padding: "16px 12px",
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      {data.steps.map((step, i) => (
        <React.Fragment key={i}>
          {/* 단계 카드 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {/* 원형 번호 */}
            <div
              style={{
                width: cfg.stepSize,
                height: cfg.stepSize,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  step.status === "completed"
                    ? colors.accent
                    : step.status === "in_progress"
                      ? colors.positive
                      : colors.borderSubtle,
                color:
                  step.status === "completed" || step.status === "in_progress"
                    ? "#FFFFFF"
                    : colors.textSecondary,
                fontSize: "16px",
                fontWeight: 700,
                fontFamily: typography.fontFamily.mono,
              }}
            >
              {step.icon ?? step.stepNumber}
            </div>
            {/* 제목 */}
            <span
              style={{
                fontSize: cfg.labelSize,
                fontWeight: 600,
                color: colors.textPrimary,
                fontFamily: typography.fontFamily.sans,
                textAlign: "center",
                // maxWidth를 넉넉히(160) 두고 줄바꿈을 허용해 제목이 잘리지 않게 한다(D7-a).
                maxWidth: 160,
                whiteSpace: "normal",
                overflowWrap: "break-word",
                wordBreak: "keep-all",
              }}
            >
              {step.title}
            </span>
            {/* 설명 */}
            {step.description && (
              <span
                style={{
                  fontSize: cfg.descSize,
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamily.sans,
                  textAlign: "center",
                  // 설명도 동일하게 폭을 넓히고 줄바꿈을 허용한다(D7-a).
                  maxWidth: 160,
                  lineHeight: 1.4,
                  whiteSpace: "normal",
                  overflowWrap: "break-word",
                  wordBreak: "keep-all",
                }}
              >
                {step.description}
              </span>
            )}
          </div>

          {/* 연결선 (화살표) — 마지막 단계 뒤에는 없음 */}
          {i < data.steps.length - 1 && (
            <div
              style={{
                width: isHorizontal ? 32 : cfg.connectorWidth,
                height: isHorizontal ? cfg.connectorWidth : 32,
                background: colors.borderSubtle,
                borderRadius: 1,
                position: "relative",
              }}
            >
              {/* 화살표 머리 */}
              <div
                style={{
                  position: "absolute",
                  [isHorizontal ? "right" : "bottom"]: -4,
                  [isHorizontal ? "top" : "left"]: "50%",
                  transform: isHorizontal
                    ? "translateY(-50%)"
                    : "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderStyle: "solid",
                  borderWidth: isHorizontal ? "4px 0 4px 6px" : "6px 4px 0 4px",
                  borderColor: isHorizontal
                    ? `transparent transparent transparent ${colors.borderSubtle}`
                    : `${colors.borderSubtle} transparent transparent transparent`,
                }}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// TimelineLine — 타임라인
// ─────────────────────────────────────────────

function TimelineLine({
  data,
  themeMode,
}: {
  data: Extract<InfographicData, { subType: "timeline" }>;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  const { colors, typography } = theme;
  const cfg = chartSettings.infographic.timeline;

  // 중요도별 점 색상
  function getDotColor(importance: TimelineEvent["importance"]): string {
    switch (importance) {
      case "critical":
        return colors.positive;
      case "high":
        return colors.accent;
      default:
        return colors.textTertiary;
    }
  }

  return (
    <div style={{ padding: cfg.containerPadding }}>
      {data.events.map((event, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: cfg.rowGap,
            paddingBottom: i < data.events.length - 1 ? cfg.gap : 0,
            position: "relative",
          }}
        >
          {/* 세로 라인 + 점 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flexShrink: 0,
              width: cfg.dotSize + 8,
            }}
          >
            {/* 점 */}
            <div
              style={{
                width: cfg.dotSize,
                height: cfg.dotSize,
                borderRadius: "50%",
                background: getDotColor(event.importance),
                flexShrink: 0,
                marginTop: 4,
              }}
            />
            {/* 세로선 (마지막 이벤트 제외) */}
            {i < data.events.length - 1 && (
              <div
                style={{
                  width: cfg.lineWidth,
                  flex: 1,
                  background: colors.borderSubtle,
                  marginTop: 4,
                }}
              />
            )}
          </div>

          {/* 이벤트 내용 */}
          <div style={{ paddingBottom: 4 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                fontSize: cfg.metaFontSize,
                color: colors.textTertiary,
                fontFamily: typography.fontFamily.mono,
                marginBottom: 4,
              }}
            >
              <span>{event.date}</span>
              {event.category && (
                <span
                  style={{
                    padding: "2px 7px",
                    borderRadius: cfg.categoryRadius,
                    border: `1px solid ${colors.borderSubtle}`,
                    fontSize: cfg.categoryFontSize,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    background: colors.accentSubtle,
                    color: colors.accent,
                  }}
                >
                  {event.category}
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: cfg.titleFontSize,
                fontWeight: 700,
                color: colors.textPrimary,
                fontFamily: typography.fontFamily.sans,
                letterSpacing: "-0.02em",
                lineHeight: 1.35,
              }}
            >
              {event.title}
            </div>
            {event.description && (
              <div
                style={{
                  fontSize: cfg.descriptionFontSize,
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamily.sans,
                  marginTop: 4,
                  lineHeight: 1.55,
                }}
              >
                {event.description}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// FeatureList — 특징/스펙 리스트
// ─────────────────────────────────────────────

function FeatureList({
  data,
  themeMode,
}: {
  data: Extract<InfographicData, { subType: "feature_list" }>;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  const { colors, typography } = theme;

  return (
    <div style={{ padding: "8px 12px" }}>
      {data.items.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 12,
            padding: "12px 4px",
            borderBottom:
              i < data.items.length - 1 ? `1px solid ${colors.borderSubtle}` : undefined,
          }}
        >
          {/* 아이콘 */}
          {item.icon && (
            <span
              style={{
                fontSize: "20px",
                flexShrink: 0,
                width: 28,
                textAlign: "center",
              }}
            >
              {item.icon}
            </span>
          )}
          {/* 텍스트 */}
          {/* minWidth:0 — flex 자식이 줄바꿈 없이 넘치는 것을 막아 긴 문장이 카드 밖으로 잘리지 않게 한다(D7-a). */}
          <div style={{ minWidth: 0 }}>
            {/* 라벨이 비어 있으면(텍스트 박스형) 빈 제목 줄을 만들지 않는다(D7-a). */}
            {item.label && (
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamily.sans,
                  marginBottom: 2,
                  lineHeight: 1.4,
                  // 라벨도 한 줄 말줄임 없이 전체가 보이도록 줄바꿈을 허용한다.
                  whiteSpace: "normal",
                  overflowWrap: "break-word",
                  wordBreak: "keep-all",
                }}
              >
                {item.label}
              </div>
            )}
            <div
              style={{
                fontSize: "15px",
                color: colors.textSecondary,
                fontFamily: typography.fontFamily.sans,
                lineHeight: 1.5,
                // 결론 문장이 끊기지 않도록 전체 문장을 줄바꿈하여 모두 보여준다(D7-a).
                whiteSpace: "normal",
                overflowWrap: "break-word",
                wordBreak: "keep-all",
              }}
            >
              {item.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// NewsBriefCard — 뉴스 원문 번역/요약 카드
// ─────────────────────────────────────────────

function NewsBriefCard({
  data,
  themeMode,
}: {
  data: Extract<InfographicData, { subType: "news_brief" }>;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  const { colors, typography } = theme;
  const cfg = chartSettings.infographic.newsBrief;
  const primaryMedia = data.media[0];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "4px 8px 12px",
      }}
    >
      {primaryMedia && (primaryMedia.url || primaryMedia.path) && (
        <figure
          style={{
            margin: 0,
            borderRadius: cfg.mediaRadius,
            overflow: "hidden",
            border: `1px solid ${colors.borderSubtle}`,
            background: colors.surfaceHover,
          }}
        >
          <>
            {/* 카드뉴스는 기사 사진만 크게 쓰는 것이 목적이라 로컬 이미지 경로를 그대로 렌더링합니다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primaryMedia.url ?? primaryMedia.path}
              alt={primaryMedia.alt}
              style={{
                width: "100%",
                display: "block",
                objectFit: "cover",
                background: colors.background,
              }}
            />
          </>
          {(primaryMedia.caption || primaryMedia.source) && (
            <figcaption
              style={{
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {primaryMedia.caption && (
                <span
                  style={{
                    fontSize: "14px",
                    lineHeight: 1.5,
                    color: colors.textSecondary,
                    fontFamily: typography.fontFamily.sans,
                  }}
                >
                  {primaryMedia.caption}
                </span>
              )}
              {primaryMedia.source && (
                <span
                  style={{
                    fontSize: "13px",
                    color: colors.textTertiary,
                    fontFamily: typography.fontFamily.sans,
                  }}
                >
                  사진: {primaryMedia.source}
                </span>
              )}
            </figcaption>
          )}
        </figure>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────
// Fallback — 알 수 없는 서브타입용
// ─────────────────────────────────────────────

function FallbackRenderer({
  data,
  themeMode,
}: {
  data: InfographicData;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  const { colors, typography } = theme;

  return (
    <div
      style={{
        padding: 24,
        textAlign: "center",
        color: colors.textSecondary,
        fontFamily: typography.fontFamily.sans,
        fontSize: "16px",
      }}
    >
      지원하지 않는 인포그래픽 타입: {data.subType}
    </div>
  );
}
