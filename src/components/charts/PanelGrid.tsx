/**
 * =====================================================
 * PanelGrid — 다중 패널(스몰멀티플) 격자 렌더러 (P0-2)
 * =====================================================
 *
 * 왜 필요한가?
 * → 기존 차트 컴포넌트는 단일 xAxis/yAxis/secondaryYAxis만 그릴 수 있었다.
 * → 그래서 "3분할 패널"이나 "2단 콤보" 같은 차트가 하나의 합성 축으로
 *   평탄화(flatten)되면서 원본의 구조가 파괴되는 문제가 있었다.
 *   (예: cycle% 같은 가짜 X축이 생기거나, 서로 다른 단위의 시리즈가 한 축에 뭉개짐)
 *
 * 무엇을 하나?
 * → analysis.structure.panels[] (PanelInfo 배열)가 있으면,
 *   각 패널을 "독립된 축을 가진 작은 서브차트"로 나눠 격자(grid)에 배치한다.
 * → 각 패널은 그 패널의 chartType에 맞는 기존 Toss*Chart 컴포넌트를 그대로 재사용한다.
 *   (코드 중복을 만들지 않고, 이미 검증된 렌더 로직을 그대로 쓰기 위함)
 *
 * 어떻게 재사용하나? (핵심 아이디어)
 * → 기존 Toss*Chart는 전부 `analysis: ChartAnalysis` 하나만 받아서
 *   그 안의 structure / data.series / emphasis 를 읽어 그린다.
 * → 그래서 패널마다 "그 패널에 해당하는 부분만 남긴 축약 analysis 객체"를 새로 만들어
 *   기존 컴포넌트에 넘기면, 컴포넌트는 자기가 단일 차트인 줄 알고 정상 동작한다.
 * → 원본 analysis 객체는 절대 수정하지 않고(immutability), 항상 새 객체를 만들어 반환한다.
 *
 * 레이아웃:
 * → 패널이 1~2개면 세로 스택(1열), 3개 이상이면 2열 그리드.
 * → 전체 height를 행(row) 수로 나눠 각 패널에 배분한다.
 */

"use client";

import React from "react";
import type {
  AxisInfo,
  ChartAnalysis,
  ChartType,
  HighlightZone,
  LegendItem,
  PanelInfo,
} from "@/lib/analysis/schema";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";
import { getAnalysisThemeMode, getAnalysisPresetColors } from "@/lib/style-presets";
import TossLineChart from "./TossLineChart";
import TossComboChart from "./TossComboChart";
import TossBarChart from "./TossBarChart";
import TossDonutChart from "./TossDonutChart";
import TossCandleChart from "./TossCandleChart";
import TossScatterChart from "./TossScatterChart";

interface PanelGridProps {
  /** 원본 전체 분석 결과 (이 객체는 수정하지 않는다) */
  analysis: ChartAnalysis;
  /** 그릴 패널 목록 — ChartRouter가 analysis.structure.panels를 넘겨준다 */
  panels: PanelInfo[];
  /** 테마 모드 */
  theme?: ThemeMode;
  /** 격자 전체 높이(px) — 패널 행 수로 나눠 배분 */
  height?: number;
}

// ─────────────────────────────────────────────
// 패널 X축 라벨 솎기용 지역 상수 (D3)
// → 패널은 2열 격자에서 가로폭이 좁아(반쪽 너비) 연도 라벨이
//   '19901990199019902002'처럼 겹쳐 보인다.
// → 그래서 패널 X축에는 시작/중간/끝 정도(최대 PANEL_X_MAX_TICKS개)로
//   강하게 솎은 displayTickValues를 채워 넣어 겹침을 막는다.
// ⚠️ chart-settings.ts는 다른 에이전트가 작업 중이라 건드리지 않고,
//    이 파일 안에서만 쓰는 지역 상수로 둔다.
const PANEL_X_MAX_TICKS = 4; // 패널 X축에 표시할 최대 눈금 개수(시작·중간들·끝)

/**
 * 좁은 패널 X축용으로 원본 tickValues 중 일부만 "균등 선택"해서 돌려준다.
 *
 * 왜 이렇게 하나?
 * → 패널은 반쪽 너비라 눈금이 많으면 라벨이 서로 붙어 겹친다(D3).
 * → 그래서 전체 눈금에서 처음/끝을 포함해 균등 간격으로 maxTicks개만 고른다.
 *   (예: 12개 → 처음·끝 포함 4개)
 *
 * 어떻게 동작하나?
 * → 이미 눈금이 충분히 적으면(<= maxTicks) 그대로 반환(솎을 필요 없음).
 * → 그 외에는 0 ~ (len-1) 구간을 maxTicks 등분해 인덱스를 골라 부분집합을 만든다.
 *   중복(같은 라벨)은 입력 순서를 보존하며 제거한다.
 */
function pickEvenTickSubset(
  tickValues: readonly string[],
  maxTicks: number,
): string[] {
  // 눈금이 maxTicks 이하면 솎을 게 없으므로 복사본을 그대로 반환한다.
  if (tickValues.length <= maxTicks) return [...tickValues];
  // maxTicks가 1 이하인 비정상 입력 방어 — 첫 눈금만 표시.
  if (maxTicks <= 1) return [tickValues[0]];

  const seen = new Set<string>();
  const picked: string[] = [];
  for (let i = 0; i < maxTicks; i++) {
    // i=0 → 첫 눈금, i=maxTicks-1 → 마지막 눈금, 그 사이는 균등 분포.
    const sourceIndex = Math.floor((i * (tickValues.length - 1)) / (maxTicks - 1));
    const value = tickValues[sourceIndex];
    if (!seen.has(value)) {
      seen.add(value);
      picked.push(value);
    }
  }
  return picked;
}

/**
 * 패널 X축에 "겹침 방지용 displayTickValues"를 보강한 새 AxisInfo를 만든다.
 *
 * 규칙:
 * → 이미 displayTickValues가 있으면(분석 단계에서 의도적으로 정한 것) 그대로 존중한다.
 * → 없을 때만, 원본 tickValues를 균등 솎기해 displayTickValues로 채운다.
 * → 원본 tickValues가 이미 적으면(<= PANEL_X_MAX_TICKS) 그대로 두어 불필요한 변형을 피한다.
 *
 * immutability: 원본 axis 객체는 수정하지 않고 새 객체를 만들어 반환한다.
 */
function withThinnedPanelXAxis(xAxis: AxisInfo): AxisInfo {
  // 이미 표시용 눈금이 정해져 있으면 손대지 않는다.
  if (xAxis.displayTickValues && xAxis.displayTickValues.length > 0) {
    return xAxis;
  }
  const ticks = xAxis.tickValues ?? [];
  // 솎을 필요가 없을 만큼 눈금이 적으면 원본을 그대로 사용.
  if (ticks.length <= PANEL_X_MAX_TICKS) return xAxis;

  // 새 객체로 displayTickValues만 보강 (원본 불변).
  return {
    ...xAxis,
    displayTickValues: pickEvenTickSubset(ticks, PANEL_X_MAX_TICKS),
  };
}

/**
 * 패널 하나를 그릴 때 사용할 "축약 analysis 객체"를 만든다.
 *
 * 왜 이렇게 하나?
 * → 기존 Toss*Chart 컴포넌트는 analysis.structure.{xAxis,yAxis,secondaryYAxis},
 *   analysis.structure.legend, analysis.data.series, analysis.emphasis.highlightZones 등을
 *   읽어서 그린다.
 * → 따라서 이 필드들만 "패널 전용 값"으로 교체한 새 객체를 만들면,
 *   컴포넌트는 자기가 단일 차트인 줄 알고 그 패널만 정상적으로 그린다.
 *
 * 무엇을 교체하나?
 * 1. structure.chartType → 패널의 chartType (없으면 원본 chartType 유지)
 * 2. structure.xAxis / yAxis / secondaryYAxis → 패널의 축 (이게 "독립 축"의 핵심)
 * 3. structure.title → 패널 제목 (sourceReplica 등 일부 경로에서 제목으로 사용됨)
 * 4. structure.legend → 패널 시리즈에 해당하는 범례 항목만 필터
 * 5. data.series → 패널의 seriesNames에 해당하는 시리즈만 필터
 * 6. emphasis.highlightZones → 패널 전용 강조 구간 (없으면 빈 배열)
 *
 * 나머지(statistics, narrative, emphasis.annotations 등)는 원본을 그대로 둔다.
 * → 컴포넌트가 해당 필드에 접근해도 undefined로 깨지지 않게 하기 위함이다.
 */
function buildPanelAnalysis(
  analysis: ChartAnalysis,
  panel: PanelInfo,
): ChartAnalysis {
  // 1. 패널 시리즈만 필터링 — seriesNames 순서를 우선 따르되,
  //    매칭이 안 되면 원본 series 순서를 폴백으로 사용한다.
  const nameSet = new Set(panel.seriesNames ?? []);
  const matchedSeries =
    nameSet.size > 0
      ? analysis.data.series.filter((s) => nameSet.has(s.name))
      : analysis.data.series;

  // seriesNames에 적힌 순서대로 정렬 (원본 시리즈 배열 순서가 아니라 패널이 의도한 순서 존중)
  const orderedSeries =
    nameSet.size > 0
      ? [...matchedSeries].sort(
          (a, b) =>
            panel.seriesNames.indexOf(a.name) - panel.seriesNames.indexOf(b.name),
        )
      : matchedSeries;

  // 2. 범례도 같은 시리즈만 남긴다.
  //    → 기존 컴포넌트는 legend[i]를 시리즈 i의 색상/역할 소스로 쓰므로
  //      "시리즈와 같은 순서"가 되도록 시리즈 이름 기준으로 재구성한다.
  const legendByName = new Map<string, LegendItem>(
    analysis.structure.legend.map((item) => [item.name, item]),
  );
  const panelLegend: LegendItem[] = orderedSeries.map(
    (s, i) =>
      legendByName.get(s.name) ??
      analysis.structure.legend[i] ?? { name: s.name },
  );

  // 3. 패널 전용 강조 구간 (없으면 빈 배열 — 컴포넌트의 .map()이 깨지지 않도록)
  const panelZones: HighlightZone[] = panel.highlightZones ?? [];

  // 4. 패널 차트 종류 (없으면 원본 유지)
  const panelChartType: ChartType =
    panel.chartType ?? analysis.structure.chartType;

  // 5. 새 객체 조립 (원본은 절대 수정하지 않음 — spread로 얕은 복사 후 필요한 곳만 교체)
  return {
    ...analysis,
    structure: {
      ...analysis.structure,
      chartType: panelChartType,
      title: panel.title ?? analysis.structure.title,
      // 좁은 패널 X축은 라벨 겹침 방지를 위해 displayTickValues를 보강한다 (D3).
      // → withThinnedPanelXAxis는 원본 panel.xAxis를 수정하지 않고 새 객체를 만들어 반환.
      xAxis: withThinnedPanelXAxis(panel.xAxis),
      yAxis: panel.yAxis,
      secondaryYAxis: panel.secondaryYAxis,
      legend: panelLegend,
      // 중첩 렌더를 막기 위해 패널 analysis에는 panels를 비워둔다.
      // (만약 panels가 그대로 남아 있으면 무한 분기 위험이 있음)
      panels: undefined,
    },
    data: {
      ...analysis.data,
      series: orderedSeries,
    },
    emphasis: {
      ...analysis.emphasis,
      highlightZones: panelZones,
    },
  };
}

/**
 * 패널 chartType에 맞는 Toss*Chart 컴포넌트를 선택해 렌더한다.
 * → ChartRouter의 매핑과 동일한 규칙을 사용한다(일관성 유지).
 */
function renderPanelChart(
  panelAnalysis: ChartAnalysis,
  chartType: ChartType,
  renderTheme: ThemeMode,
  panelHeight: number,
) {
  switch (chartType) {
    case "combo":
      return (
        <TossComboChart analysis={panelAnalysis} theme={renderTheme} height={panelHeight} />
      );

    case "bar":
    case "bar_horizontal":
    case "stacked_bar":
    case "waterfall":
    case "heatmap":
    case "radar":
    case "funnel":
      return (
        <TossBarChart analysis={panelAnalysis} theme={renderTheme} height={panelHeight} />
      );

    case "scatter":
    case "bubble":
      return (
        <TossScatterChart analysis={panelAnalysis} theme={renderTheme} height={panelHeight} />
      );

    case "donut":
    case "pie":
    case "treemap":
      return (
        <TossDonutChart analysis={panelAnalysis} theme={renderTheme} height={panelHeight} />
      );

    case "candle":
      return (
        <TossCandleChart analysis={panelAnalysis} theme={renderTheme} height={panelHeight} />
      );

    // line, area, 그리고 알 수 없는 타입은 선 차트로 (ChartRouter 기본값과 동일)
    case "line":
    case "area":
    default:
      return (
        <TossLineChart analysis={panelAnalysis} theme={renderTheme} height={panelHeight} />
      );
  }
}

export default function PanelGrid({
  analysis,
  panels,
  theme = "dark",
  height = 350,
}: PanelGridProps) {
  const renderTheme = getAnalysisThemeMode(analysis, theme);
  const themeObj = getTheme(renderTheme);
  const colors = getAnalysisPresetColors(analysis, theme);

  // 패널이 없으면 아무것도 그리지 않는다(ChartRouter에서 이미 걸러주지만 방어적으로 처리).
  if (!panels || panels.length === 0) return null;

  // 레이아웃 결정: 1~2개는 1열(세로 스택), 3개 이상은 2열 그리드.
  // ⚠️ 단, 이중축 콤보 패널은 좌·우 Y축 + 직접라벨 여백(합 ~550px)을 먹어
  //    반쪽 너비(2열)에선 플롯 영역이 0에 가깝게 찌그러진다.
  //    → 패널 중 하나라도 이중축(secondaryYAxis)을 쓰는 콤보면 1열(전체 너비)로 세로 스택한다.
  const hasWideComboPanel = panels.some(
    (p) =>
      (p.chartType ?? analysis.structure.chartType) === "combo" &&
      !!p.secondaryYAxis,
  );
  const columns = panels.length >= 3 && !hasWideComboPanel ? 2 : 1;
  const rows = Math.ceil(panels.length / columns);

  // 각 패널에 배분할 높이 — 전체 높이를 행 수로 나누고, 패널 간 간격/제목 공간을 고려해 하한을 둔다.
  const titleSpace = 26; // 패널 제목 한 줄 높이(px)
  const rowGap = 20; // 행 사이 간격(px)
  const perPanelChartHeight = Math.max(
    160,
    Math.floor((height - rows * titleSpace - (rows - 1) * rowGap) / rows),
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        columnGap: 24,
        rowGap,
        width: "100%",
      }}
    >
      {panels.map((panel, index) => {
        const panelAnalysis = buildPanelAnalysis(analysis, panel);
        const chartType = panel.chartType ?? analysis.structure.chartType;
        // 패널 제목: 명시된 title 우선, 없으면 첫 시리즈명, 그것도 없으면 순번
        const panelTitle =
          panel.title ??
          panel.seriesNames?.[0] ??
          `패널 ${index + 1}`;

        return (
          <div
            key={`panel-${index}-${panelTitle}`}
            style={{ minWidth: 0, display: "flex", flexDirection: "column" }}
          >
            {/* 패널별 작은 제목 */}
            <div
              style={{
                color: colors.textSecondary,
                fontSize: themeObj.typography.fontSize.chartSubtitle,
                fontWeight: 800,
                lineHeight: 1.2,
                marginBottom: 6,
                fontFamily: themeObj.typography.fontFamily.sans,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {panelTitle}
            </div>

            {/* 패널 본문 — 그 패널의 chartType에 맞는 차트 */}
            <div style={{ width: "100%" }}>
              {renderPanelChart(
                panelAnalysis,
                chartType,
                renderTheme,
                perPanelChartHeight,
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
