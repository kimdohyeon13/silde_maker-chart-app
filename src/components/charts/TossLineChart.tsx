/**
 * =====================================================
 * TossLineChart — 토스증권 스타일 꺾은선 차트
 * =====================================================
 *
 * 가장 많이 쓰이는 차트 타입입니다.
 * 주가 추이, 매출 변화, 시계열 데이터 등에 사용됩니다.
 *
 * 토스증권 스타일 특징:
 * - 꺾인 선형 연결 (linear interpolation)
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
  ReferenceArea,
  Area,
  ComposedChart,
  Legend,
} from "recharts";
import type { ChartAnalysis } from "@/lib/analysis/schema";
import {
  getAnalysisStylePreset,
  getAnalysisThemeMode,
  getPresetColors,
  getPresetRechartsStyle,
} from "@/lib/style-presets";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";
import { chartSettings } from "@/lib/chart-settings";
import {
  formatAxisTickLabel,
  normalizeXKey,
  matchTickToDataKey,
  getTickUnit,
  getInlineLabelUnit,
  formatValueWithUnit,
  getAxisFractionDigits,
  generateNiceTicks,
} from "@/lib/chart-format";

interface TossLineChartProps {
  analysis: ChartAnalysis;
  theme?: ThemeMode;
  width?: number | `${number}%`;
  height?: number;
  showAnnotations?: boolean;
  animated?: boolean;
}

/**
 * 전망/예측 시리즈인지 이름으로 추정하는 키워드 목록
 *
 * 왜 필요한가?
 * → 원본 차트에서 "전망", "forecast" 같은 시리즈는
 *   점선(dashed line)으로 표시되는 경우가 많습니다.
 *
 * ⚠️ '밴드'/'band'는 여기서 의도적으로 제외한다.
 * → 밴드(예: PER 19x~22x)는 "전망선"이 아니라 정식 시리즈다.
 * → 이전 세션에서 '밴드','band'를 키워드에 넣는 바람에 PER 밴드를 전망선으로 오판해
 *   범례·라벨을 통째로 날리는 회귀(P0-3)가 발생했다 → 복구.
 */
const FORECAST_KEYWORDS = ["전망", "forecast", "예상", "추정", "예측", "projected"];

/**
 * 이름에 밴드/band가 들어있는지 (이름기반 밴드 추정용)
 * → seriesKind 명시 필드가 없을 때의 폴백 판정에 쓴다.
 */
const BAND_KEYWORDS = ["밴드", "band"];

/** 시리즈의 성격(normal/forecast/band) */
type SeriesKind = "band" | "forecast" | "normal";

/**
 * 이름만으로 시리즈 성격을 추정 (seriesKind 명시 필드가 없을 때의 폴백)
 *
 * → 밴드 우선 판정: '밴드'/'band'가 들어가면 band (전망으로 보지 않는다).
 * → 그 외 전망 키워드가 들어가면 forecast.
 * → 둘 다 아니면 normal.
 */
function guessSeriesKindByName(name: string): SeriesKind {
  const lower = name.toLowerCase();
  if (BAND_KEYWORDS.some((kw) => lower.includes(kw))) return "band";
  if (FORECAST_KEYWORDS.some((kw) => lower.includes(kw))) return "forecast";
  return "normal";
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
  width = "100%",
  height = 350,
  showAnnotations = true,
  animated = true,
}: TossLineChartProps) {
  const renderThemeMode = getAnalysisThemeMode(analysis, themeMode);
  const theme = getTheme(renderThemeMode);
  const preset = getAnalysisStylePreset(analysis);
  const styles = getPresetRechartsStyle(analysis, themeMode);
  const colors = getPresetColors(preset, renderThemeMode);
  const exportOptions = (analysis as { exportOptions?: { sourceReplica?: boolean } }).exportOptions ?? {};

  // 듀얼 축 여부 판단
  const hasSecondaryYAxis = !!analysis.structure.secondaryYAxis;

  // 선 끝에 라벨을 직접 붙이면 사용자가 범례와 선을 왕복해서 볼 필요가 줄어든다.
  const showDirectLabels =
    chartSettings.directLabels.enabled &&
    analysis.data.series.length >= 1 &&
    analysis.data.series.length <= chartSettings.directLabels.maxSeries;

  // 직접 라벨을 표시할 때는 범례를 숨겨 그래프 본문 공간을 더 넓게 쓴다.
  const showLegend = analysis.data.series.length > 1 && !showDirectLabels;

  // [D5] 다계열(3개 이상)에서는 선 아래 area fill(그라데이션)을 끈다.
  //  → 시리즈가 많은데 모두 면적을 채우면 라인차트가 면적차트처럼 보여 추세가 뭉개진다(page-03-g1).
  //  → 1~2개일 때만 area를 유지(원본이 면적 강조인 경우가 많음).
  const AREA_FILL_MAX_SERIES = 2;
  const showAreaFill = analysis.data.series.length <= AREA_FILL_MAX_SERIES;

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
    if (legendItem?.remakeColor) {
      return legendItem.remakeColor;
    }
    if (legendItem?.originalColor) {
      const oc = legendItem.originalColor;
      if (renderThemeMode === "dark" && DARK_MODE_COLOR_MAP[oc]) {
        return DARK_MODE_COLOR_MAP[oc];
      }
      return oc;
    }
    return colors.series[i % colors.series.length];
  }

  /**
   * resolveSeriesKind — i번째 시리즈의 성격(band/forecast/normal)을 결정
   *
   * 우선순위(P0-3):
   * 1. 범례항목의 seriesKind (legend[i].seriesKind)
   * 2. 시리즈 자체의 seriesKind (series.seriesKind) — 스키마에 아직 없을 수 있어 안전 캐스팅
   * 3. 둘 다 없으면 이름기반 추정 (단 '밴드'/'band'는 forecast로 보지 않음)
   *
   * 왜 명시 필드를 우선하나?
   * → 이름 추론은 "코스피 전망 밴드"처럼 밴드/전망이 섞인 이름에서 오판할 수 있다.
   * → 분석 단계에서 명시한 seriesKind가 있으면 그게 가장 정확하다.
   */
  function resolveSeriesKind(i: number): SeriesKind {
    const legendItem = analysis.structure.legend[i];
    // series.seriesKind는 schema.ts에 아직 추가 전일 수 있으므로 안전하게 optional 접근
    const series = analysis.data.series[i] as
      | (typeof analysis.data.series[number] & { seriesKind?: SeriesKind })
      | undefined;
    const explicit = legendItem?.seriesKind ?? series?.seriesKind;
    if (explicit) return explicit;
    return guessSeriesKindByName(series?.name ?? "");
  }

  /** i번째 시리즈가 전망선인지 (band는 전망 아님) */
  function isForecastIndex(i: number): boolean {
    return resolveSeriesKind(i) === "forecast";
  }

  /** i번째 시리즈가 밴드인지 */
  function isBandIndex(i: number): boolean {
    return resolveSeriesKind(i) === "band";
  }

  function getAxisLabel(label = "", unit = ""): string {
    if (!label || label === unit) return "";
    return unit ? `${label} (${unit})` : label;
  }

  function getXAxisLabel(label = ""): string {
    if (!label) return "";
    return label;
  }

  function getSeriesUnit(index: number): string {
    if (hasSecondaryYAxis && index > 0) {
      return analysis.structure.secondaryYAxis?.unit || "";
    }
    return analysis.structure.yAxis.unit || "";
  }

  function getDirectSeriesLabel(name: string, value: number, index: number): string {
    const compactNameFull = name
      .replace(/^8Gb DDR5\s*/, "")
      .replace(/\s*TLC\s*/g, " ")
      .replace("현물가", "현물")
      .replace("계약가", "계약")
      .replace(/\s+/g, " ")
      .trim();

    // [D1] 끝라벨 우측 잘림 방지:
    // → '엔/달러 - Nikkei225 52주 상대강도'처럼 이름이 길면 끝라벨이 카드 우측 밖으로 잘린다
    //   (page-15-g2). 우측 여백(directLabels.extraRightMargin≈148px, fontSize 19)에 들어가도록
    //   이름 부분만 글자 수를 제한하고 말줄임(…) 처리한다. 값(숫자+단위)은 보존한다.
    const DIRECT_LABEL_MAX_NAME_CHARS = 10;
    const compactName =
      compactNameFull.length > DIRECT_LABEL_MAX_NAME_CHARS
        ? compactNameFull.slice(0, DIRECT_LABEL_MAX_NAME_CHARS - 1).trimEnd() + "…"
        : compactNameFull;

    // [A3] 끝라벨 단위 병합 깨짐 수정:
    // → getSeriesUnit(index)를 그대로 쓰면 '2020=100' 같은 기준표현이 숫자에 붙어
    //   "상대강도 1062020=100"처럼 깨진다.
    // → getInlineLabelUnit으로 정제(기준표현 제거, 짧은 단위만 허용)해서 넘긴다.
    //   좌축이면 yAxis.label, 우축(보조축)이면 secondaryYAxis.label을 기준으로 검사.
    const axisLabel =
      hasSecondaryYAxis && index > 0
        ? analysis.structure.secondaryYAxis?.label || ""
        : analysis.structure.yAxis.label || "";
    const inlineUnit = getInlineLabelUnit(getSeriesUnit(index), axisLabel);

    return `${compactName} ${formatValueWithUnit(value, inlineUnit, 0)}`;
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
    // X값 정렬
    // 1순위: JSON의 tickValues가 모든 X값을 덮으면 그 순서를 그대로 따른다.
    //   (한글 시간 라벨 "상장당일·D+5·T+50일·1주" 등은 알파벳순 정렬 시 시간순이 깨지므로)
    // 2순위(tickValues 미제공/부분 제공): 기존처럼 "Q4 2015" 분기 형식은 연도 우선, 그 외 문자열 정렬
    const tickOrder = (analysis.structure.xAxis.tickValues ?? []).map(String);
    const rows = Array.from(xSet.values());
    // tickOrder 안에서 이 x-key가 몇 번째인지 — 정확일치 우선, 없으면 정규화 일치(P0-5)
    const tickOrderIndex = (x: string): number => {
      const exact = tickOrder.indexOf(x);
      if (exact >= 0) return exact;
      const nx = normalizeXKey(x);
      return tickOrder.findIndex((t) => normalizeXKey(t) === nx);
    };
    const allCovered =
      tickOrder.length > 0 && rows.every((r) => tickOrderIndex(String(r.x)) >= 0);
    if (allCovered) {
      return rows.sort(
        (a, b) => tickOrderIndex(String(a.x)) - tickOrderIndex(String(b.x)),
      );
    }
    const parseX = (x: string): string => {
      const qm = x.match(/^Q(\d)\s+(\d{4})$/);
      if (qm) return `${qm[2]}-Q${qm[1]}`; // "Q4 2015" → "2015-Q4"
      return x;
    };
    return rows.sort((a, b) => {
      const ax = parseX(String(a.x));
      const bx = parseX(String(b.x));
      return ax < bx ? -1 : ax > bx ? 1 : 0;
    });
  })();

  // ─────────────────────────────────────────────
  // [수정1] 밴드/전망 시리즈 존재 여부 (Y축 눈금 정책 분기용)
  // ─────────────────────────────────────────────
  // 왜 필요한가? (D2 회귀 롤백)
  // → generateNiceTicks(1·2·5·10 균등 눈금)는 단일/2계열 일반 차트엔 좋지만,
  //   밴드(PER 19x~22x)·전망 차트에선 도메인을 step 경계까지 과대확장(25,000~73,000 → 20,000~80,000)해
  //   밴드 간격을 시각적으로 압축한다(page-15-g3·13-g1).
  // → 그래서 "밴드 또는 전망 시리즈가 하나라도 있으면" generateNiceTicks를 쓰지 않고,
  //   JSON의 tickValues(있으면) 또는 Recharts auto(없으면)를 그대로 쓴다(과대확장 방지).
  const hasBandOrForecastSeries = analysis.data.series.some((_, i) => {
    const kind = resolveSeriesKind(i);
    return kind === "band" || kind === "forecast";
  });

  // ─────────────────────────────────────────────
  // Y축 범위 계산 (어노테이션 위치 판단용)
  // ─────────────────────────────────────────────
  // 데이터의 실제 극값(min/max)을 먼저 구한다 — 음수 하한 보존 판정에 쓴다.
  const dataYMin = (() => {
    let min = Infinity;
    for (const s of analysis.data.series) {
      for (const p of s.data) if (p.y != null && p.y < min) min = p.y;
    }
    return min === Infinity ? 0 : min;
  })();
  const dataYMax = (() => {
    let max = -Infinity;
    for (const s of analysis.data.series) {
      for (const p of s.data) if (p.y != null && p.y > max) max = p.y;
    }
    return max === -Infinity ? 100 : max;
  })();

  // [수정1] 음수 하한 보존:
  // → yAxis.min이 명시돼 있어도(예: 0), 데이터에 그보다 작은 음수가 있으면
  //   그 음수까지 도메인 하한을 내려 음수 저점이 0선에 잘리지 않게 한다(page-03-g1 알리바바).
  // → 명시 min이 없으면 데이터 min을 그대로 쓴다.
  const yMin =
    analysis.structure.yAxis.min != null
      ? Math.min(analysis.structure.yAxis.min, dataYMin)
      : dataYMin;
  const yMax = analysis.structure.yAxis.max ?? dataYMax;

  // [A2] 여러 끝라벨이 세로로 겹치지 않도록 분산 간격을 키운다.
  //  → 끝라벨 fontSize가 14~18이라, 옛 간격(22/30px)으로는 인접 라벨 글자가 맞붙어
  //    "S&P 7,0007,000"처럼 읽혔다. 한 줄 높이 이상으로 벌려 세로 충돌을 막는다.
  //  → direct/band/forecast 끝라벨이 같은 기준으로 분산되도록 공용 상수로 둔다.
  const END_LABEL_DY_GAP = 34;

  // [수정2] 직접라벨 최소 세로 간격(px).
  //  → 직접라벨 fontSize가 19라 한 줄 높이를 확실히 넘기는 24px로 둬 글자가 맞붙지 않게 한다.
  const MIN_DIRECT_LABEL_GAP = 24;

  // ─────────────────────────────────────────────
  // [D1] 끝라벨 세로 위치 클램프 — 플롯 밖 클리핑 방지
  // ─────────────────────────────────────────────
  // 왜 필요한가? (최우선 결함)
  // → 기존 분산은 끝점 기준으로 라벨을 위/아래 대칭으로 벌렸다(order - (n-1)/2).
  //   → 끝점이 상단(yMax 근처)인 라벨은 위로 벌어지며 카드 위로 잘렸다('22x','27Y','27년').
  // → 그래서 "끝점 픽셀 y + dy"가 플롯 세로 범위 안([상단여백, 하단여백])에 들도록 dy를 클램프한다.
  //   끝점이 위에 있으면 자연히 아래로, 아래 있으면 위로 모이는 효과.
  //
  // 플롯 안쪽 높이(근사): 전체 height − 상단여백 − 하단여백 − X축 눈금영역.
  //  → computedMargin은 아래에서 정의되므로, 여기서는 같은 입력으로 근사 높이만 미리 계산한다.
  //    (좌우 끝라벨은 가로 위치만 다르고 세로 기하는 동일하므로 이 근사로 충분.)
  const X_AXIS_TICK_AREA = 34; // X축 눈금 텍스트가 차지하는 대략 높이(px)
  const END_LABEL_EDGE_PAD = 14; // 라벨 한 줄이 플롯 경계 안에 머물도록 두는 상하 여백(px)
  const approxBottomMargin = showLegend
    ? chartSettings.margin.bottom + chartSettings.legend.extraBottomMargin
    : chartSettings.margin.bottom;
  const plotInnerHeight = Math.max(
    1,
    height - chartSettings.margin.top - approxBottomMargin - X_AXIS_TICK_AREA,
  );

  /**
   * i번째 시리즈가 그려지는 축의 (min,max)를 돌려준다.
   * → 좌축은 yMin/yMax, 우축(보조축)은 명시 min/max(없으면 우축 시리즈 데이터 극값)로 잡는다.
   *   라벨 끝점의 "세로 위치 비율"을 정확한 축 기준으로 계산하기 위함.
   */
  function getAxisRangeForIndex(index: number): { min: number; max: number } {
    if (!(hasSecondaryYAxis && index > 0)) {
      return { min: yMin, max: yMax };
    }
    const sec = analysis.structure.secondaryYAxis;
    let lo = sec?.min;
    let hi = sec?.max;
    if (lo == null || hi == null) {
      let dMin = Infinity;
      let dMax = -Infinity;
      analysis.data.series.forEach((s, i) => {
        if (!(hasSecondaryYAxis && i > 0)) return; // 우축 시리즈만
        for (const p of s.data) {
          if (p.y == null) continue;
          if (p.y < dMin) dMin = p.y;
          if (p.y > dMax) dMax = p.y;
        }
      });
      lo = lo ?? (Number.isFinite(dMin) ? dMin : 0);
      hi = hi ?? (Number.isFinite(dMax) ? dMax : 1);
    }
    return { min: lo, max: hi };
  }

  /**
   * 끝라벨 dy 맵을 만든다(클램프 포함). 모든 끝라벨(직접/밴드/전망)이 공유.
   * 1) 끝점 y 내림차순으로 정렬 → 위에서 아래 순서.
   * 2) 대칭 분산 dy 후보(order 중심)를 만든다.
   * 3) "끝점 픽셀 y + dy"가 [EDGE_PAD, plotInnerHeight − EDGE_PAD] 안에 들도록 클램프.
   *    → 위로 벗어나려던 라벨은 아래로, 아래로 벗어나려던 라벨은 위로 끌어들인다.
   */
  function buildEndLabelDyMap<T extends { series: { name: string }; index: number; point: { y: number } }>(
    points: T[],
  ): Map<string, number> {
    const map = new Map<string, number>();
    const sorted = [...points].sort((a, b) => b.point.y - a.point.y);
    sorted.forEach((item, order, arr) => {
      const rawDy = (order - (arr.length - 1) / 2) * END_LABEL_DY_GAP;
      const { min, max } = getAxisRangeForIndex(item.index);
      const range = max - min || 1;
      const yRatio = (item.point.y - min) / range; // 0=하단, 1=상단
      // 끝점의 플롯 내부 픽셀 y(위에서부터). 상단(yRatio=1)이면 0에 가깝다.
      const endpointPixelY = (1 - Math.max(0, Math.min(1, yRatio))) * plotInnerHeight;
      // 라벨이 플롯 경계 안에 머물도록 dy 허용 범위를 끝점 기준으로 환산
      const minDy = END_LABEL_EDGE_PAD - endpointPixelY;
      const maxDy = plotInnerHeight - END_LABEL_EDGE_PAD - endpointPixelY;
      const clamped = Math.max(minDy, Math.min(maxDy, rawDy));
      map.set(item.series.name, clamped);
    });
    return map;
  }

  // 끝점의 플롯 내부 픽셀 y(위에서부터)로 환산. 상단(축 max 근처)이면 0, 하단이면 plotInnerHeight.
  // → 라벨을 "끝점 기준 dy"로 표현해야 하는 Recharts 특성상, 목표 픽셀 위치와의 차이를 dy로 만들 때 쓴다.
  function endpointPixelYForIndex(index: number, y: number): number {
    const { min, max } = getAxisRangeForIndex(index);
    const range = max - min || 1;
    const yRatio = (y - min) / range;
    return (1 - Math.max(0, Math.min(1, yRatio))) * plotInnerHeight;
  }

  // ─────────────────────────────────────────────
  // [수정2] 밴드/전망 라벨 — 끝점 y를 따르지 않고 우측 여백에 "세로 균등 분산"
  // ─────────────────────────────────────────────
  // 왜 구조를 바꾸나? (3회 땜질 실패 → 방식 전환)
  // → 밴드(19x~22x)·전망(23Y~27Y) 라벨을 끝점 y에 붙이면 끝점들이 촘촘할 때 서로/우축 눈금과 겹친다
  //   (page-01·03-g2·13-g1·15-g3). 대칭 분산(buildEndLabelDyMap)으로도 끝점이 한쪽에 몰리면 실패했다.
  // → 해결: 라벨을 끝점 y와 무관하게 "플롯 우측 여백 세로 범위"에 개수만큼 균등 배치(위→아래 동일 간격).
  //   색으로 어느 선인지 식별되므로 끝점 y에 정확히 안 붙어도 된다. 이러면 라벨끼리 절대 겹치지 않는다.
  // → 정렬: 끝점 y 내림차순(위에 있는 선의 라벨이 위로) → 선과 라벨의 상대 순서는 보존해 직관 유지.
  // → 균등 위치(targetPixelY)를 끝점 픽셀y와의 차이(dy)로 변환해 Recharts ReferenceDot 라벨에 넘긴다.
  function buildRightMarginDistributedDyMap<
    T extends { series: { name: string }; index: number; point: { y: number } },
  >(points: T[]): Map<string, number> {
    const map = new Map<string, number>();
    const n = points.length;
    if (n === 0) return map;
    // 끝점 y 내림차순 → order 0이 가장 위
    const sorted = [...points].sort((a, b) => b.point.y - a.point.y);
    // 플롯 세로 가용 범위 [EDGE_PAD, plotInnerHeight − EDGE_PAD]를 n등분해 라벨 목표 픽셀y를 잡는다.
    const top = END_LABEL_EDGE_PAD;
    const bottom = plotInnerHeight - END_LABEL_EDGE_PAD;
    const usable = Math.max(0, bottom - top);
    sorted.forEach((item, order) => {
      // n=1이면 중앙, n≥2면 위→아래 동일 간격
      const targetPixelY = n === 1 ? top + usable / 2 : top + (usable * order) / (n - 1);
      const endPixelY = endpointPixelYForIndex(item.index, item.point.y);
      map.set(item.series.name, targetPixelY - endPixelY);
    });
    return map;
  }

  // ─────────────────────────────────────────────
  // [수정2] 일반 끝라벨(직접라벨) 최소 간격 강제 분산
  // ─────────────────────────────────────────────
  // 왜 필요한가?
  // → 직접라벨 2개 이상이 세로로 가까우면(끝점이 붙어 있으면) 글자가 맞붙어 읽힌다.
  // → buildEndLabelDyMap의 대칭 분산만으로는 간격이 보장되지 않으므로, 분산 결과의
  //   "라벨 실제 픽셀y(끝점픽셀y + dy)"가 최소 간격(MIN_LABEL_GAP) 이상 벌어지도록 한 번 더 민다.
  // → 위에서 아래로 훑으며 이전 라벨과 너무 가까우면 아래로 밀고, 마지막에 하단 경계를 넘으면
  //   전체를 위로 끌어올려 플롯 안에 들어오게 한다(상/하단 클램프).
  function buildSpacedEndLabelDyMap<
    T extends { series: { name: string }; index: number; point: { y: number } },
  >(points: T[], minGap: number): Map<string, number> {
    const map = new Map<string, number>();
    const n = points.length;
    if (n === 0) return map;
    if (n === 1) {
      // 1개면 분산 불필요 — 끝점에 그대로(경계 클램프만)
      return buildEndLabelDyMap(points);
    }
    // 끝점 y 내림차순(위→아래) + 각 라벨의 끝점 픽셀y
    const sorted = [...points]
      .map((item) => ({
        item,
        endPixelY: endpointPixelYForIndex(item.index, item.point.y),
      }))
      .sort((a, b) => a.endPixelY - b.endPixelY); // 픽셀y 오름차순 = 위에서 아래

    const top = END_LABEL_EDGE_PAD;
    const bottom = plotInnerHeight - END_LABEL_EDGE_PAD;
    // 1) 위에서 아래로 훑으며 최소 간격 확보(끝점 위치를 최대한 존중하되 겹치면 아래로 민다)
    const labelY: number[] = [];
    sorted.forEach((entry, i) => {
      let y = Math.max(top, entry.endPixelY);
      if (i > 0) y = Math.max(y, labelY[i - 1] + minGap);
      labelY.push(y);
    });
    // 2) 마지막 라벨이 하단 경계를 넘으면 전체를 위로 평행이동(넘은 만큼)
    const overflow = labelY[labelY.length - 1] - bottom;
    if (overflow > 0) {
      for (let i = 0; i < labelY.length; i++) labelY[i] -= overflow;
    }
    // 3) 위로 민 결과 상단 경계를 넘으면 상단으로 클램프(간격은 유지 못 할 수 있으나 잘림 방지 우선)
    if (labelY[0] < top) {
      const shift = top - labelY[0];
      for (let i = 0; i < labelY.length; i++) labelY[i] += shift;
    }
    // 4) 라벨 픽셀y를 끝점 기준 dy로 환산해 저장
    sorted.forEach((entry, i) => {
      map.set(entry.item.series.name, labelY[i] - entry.endPixelY);
    });
    return map;
  }

  const directLabelPoints = analysis.data.series
    .map((series, index) => {
      // [A4] 밴드/전망 시리즈는 각각 전용 끝라벨(bandLabelPoints/forecastLabelPoints)을
      //      따로 항상 그리므로, 일반 직접라벨 대상에서는 제외한다(중복 방지).
      const kind = resolveSeriesKind(index);
      if (kind === "band" || kind === "forecast") return null;
      const lastPoint = [...series.data].reverse().find((point) => point.y != null);
      if (!lastPoint) return null;
      return {
        series,
        index,
        point: lastPoint,
        color: getSeriesColor(index),
        yAxisId: hasSecondaryYAxis && index > 0 ? "right" : "left",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  // [수정2] 최소 간격 강제 분산(+상/하단 클램프) → 직접라벨끼리 글자가 맞붙지 않게.
  const directLabelDy = buildSpacedEndLabelDyMap(directLabelPoints, MIN_DIRECT_LABEL_GAP);

  // ─────────────────────────────────────────────
  // 밴드 우측 끝 배수라벨 (P0-3)
  // ─────────────────────────────────────────────
  /**
   * PER 밴드(19x~22x)처럼 seriesKind === "band"인 시리즈는 범례에서 빠지므로,
   * 선 끝(우측 마지막 점)에 시리즈명("19x" 등)을 직접 라벨로 "항상" 표시한다.
   * → showLegend/showDirectLabels 설정과 무관하게 렌더(밴드 식별을 보장).
   */
  const bandLabelPoints = analysis.data.series
    .map((series, index) => {
      if (resolveSeriesKind(index) !== "band") return null;
      const lastPoint = [...series.data].reverse().find((point) => point.y != null);
      if (!lastPoint) return null;
      return {
        series,
        index,
        point: lastPoint,
        color: getSeriesColor(index),
        yAxisId: hasSecondaryYAxis && index > 0 ? "right" : "left",
        // 라벨 텍스트: 범례 이름 우선(예: "19x"), 없으면 시리즈명
        label: analysis.structure.legend[index]?.name ?? series.name,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const hasBandSeries = bandLabelPoints.length > 0;

  // [수정2] 밴드 라벨은 끝점 y를 따르지 않고 우측 여백에 세로 균등 분산 → 라벨끼리/우축눈금과 겹침 제거.
  const bandLabelDy = buildRightMarginDistributedDyMap(bandLabelPoints);

  // ─────────────────────────────────────────────
  // [A4] 전망선(forecast) 우측 끝 라벨
  // ─────────────────────────────────────────────
  /**
   * 왜 필요한가? (중요)
   * → resolveSeriesKind === "forecast"인 시리즈는 legendType="none"이라 범례에서 빠진다.
   * → 게다가 시리즈가 4개 이상이면 showDirectLabels=false라 직접라벨도 안 붙는다.
   *   → "어느 점선이 몇 년도 전망인지"를 식별할 방법이 완전히 사라진다
   *     (예: 23Y~27Y 5개 컨센서스 점선).
   * → 그래서 밴드 라벨(bandLabelPoints) 패턴을 그대로 본떠, 전망 시리즈도
   *   선 끝(마지막 유효점)에 시리즈명을 "항상" 표시한다
   *   (showLegend/showDirectLabels 설정과 무관).
   * 라벨 텍스트: 범례 이름 우선(예: "27Y(E)"), 없으면 시리즈명.
   */
  const forecastLabelPoints = analysis.data.series
    .map((series, index) => {
      if (resolveSeriesKind(index) !== "forecast") return null;
      const lastPoint = [...series.data].reverse().find((point) => point.y != null);
      if (!lastPoint) return null;
      return {
        series,
        index,
        point: lastPoint,
        color: getSeriesColor(index),
        yAxisId: hasSecondaryYAxis && index > 0 ? "right" : "left",
        label: analysis.structure.legend[index]?.name ?? series.name,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const hasForecastLabels = forecastLabelPoints.length > 0;

  // [수정2] 전망 라벨도 끝점 y를 따르지 않고 우측 여백에 세로 균등 분산(밴드와 동일 구조).
  const forecastLabelDy = buildRightMarginDistributedDyMap(forecastLabelPoints);

  const maxSeriesPointCount = Math.max(
    0,
    ...analysis.data.series.map((series) => series.data.length),
  );
  const isDenseLine = maxSeriesPointCount >= 24;
  // [C1] 촘촘한 시계열에서 점 마커가 찍히면 선이 "점구름(산점도)"처럼 보여 추세가 흐려진다.
  //  → 그래서 점 마커 허용 임계를 크게 낮춘다: 포인트가 40개를 넘으면 점 없이 선만 그린다.
  //  → 24~40개의 "중간 밀도"만 아주 작은 점을 허용하고, 40개 초과는 아래 isDenseLine 분기에서 dot=false가 된다.
  //  → 선(strokeWidth/색)은 그대로 두고 점만 제거하는 것이 목적이다(원본은 매끈한 선).
  const DENSE_POINT_MARKER_MAX = 40;
  const showDensePointMarkers =
    isDenseLine && maxSeriesPointCount <= DENSE_POINT_MARKER_MAX;

  const yAxisTicks = (analysis.structure.yAxis.tickValues ?? [])
    .map((tick) => Number(tick))
    .filter((tick) => Number.isFinite(tick));

  // 보조 Y축 눈금 (소수 자릿수 step 계산용) — 듀얼 축이 아니면 빈 배열
  const secondaryYAxisTicks = (analysis.structure.secondaryYAxis?.tickValues ?? [])
    .map((tick) => Number(tick))
    .filter((tick) => Number.isFinite(tick));

  // ─────────────────────────────────────────────
  // [D2] Y축 자동 눈금 균등화
  // ─────────────────────────────────────────────
  // 왜 필요한가?
  // → JSON에 tickValues가 없으면 Recharts 자동 눈금이 '1,1,2,2'(중복)·'10/70/120'(비균등)으로 깨진다.
  // → 그래서 tickValues가 없을 때만 도메인(min~max)에서 1·2·5·10 계열 균등 눈금을 직접 만들어 넘긴다.
  // → 자릿수(getAxisFractionDigits)도 "실제로 그릴 눈금 배열"을 넘겨 라벨 자릿수가 눈금과 일치하게 한다.
  //
  // ⚠️ generateNiceTicks는 min/max가 둘 다 유한할 때만 의미가 있다.
  //    → 좌축은 yMin/yMax(명시값 없으면 데이터 극값 폴백)를 그대로 쓴다.
  //    → 보조축은 명시 min/max만 사용(없으면 빈 배열 → 기존 Recharts auto 유지).
  //
  // [수정1] D2 회귀 롤백:
  //    → 밴드/전망 시리즈가 있으면 generateNiceTicks를 쓰지 않는다(과대확장 방지).
  //      JSON tickValues가 있으면 그것을, 없으면 빈 배열(→ Recharts auto)을 쓴다.
  const effectiveYAxisTicks =
    yAxisTicks.length > 0
      ? yAxisTicks
      : hasBandOrForecastSeries
        ? []
        : generateNiceTicks(yMin, yMax);

  const secondaryYAxis = analysis.structure.secondaryYAxis;
  const effectiveSecondaryYAxisTicks =
    secondaryYAxisTicks.length > 0
      ? secondaryYAxisTicks
      : hasBandOrForecastSeries
        ? []
        : generateNiceTicks(secondaryYAxis?.min, secondaryYAxis?.max);

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
    const yRange = (yMax - yMin) || 1;
    const candidates = analysis.emphasis.annotations
      .filter((a) => a.importance === "critical" || a.importance === "high")
      .filter((a) => a.position.y !== undefined && a.position.y !== null)
      .filter((a) => {
        if (!showDirectLabels) return true;
        return !directLabelPoints.some((point) => {
          const sameX = String(a.position.x) === String(point.point.x);
          const sameY = Math.abs((a.position.y ?? 0) - point.point.y) / yRange < 0.08;
          return sameX && sameY;
        });
      })
      .slice(0, 8);
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
  const maxVisibleXLabels =
    chartData.length >= chartSettings.xAxis.longSeriesThreshold
      ? chartSettings.xAxis.longSeriesMaxVisibleLabels
      : chartSettings.xAxis.maxVisibleLabels;

  const visibleXTicks = (() => {
    const xAxisWithDisplay = analysis.structure.xAxis as typeof analysis.structure.xAxis & {
      displayTickValues?: string[];
    };
    const hasDisplayTicks =
      !!xAxisWithDisplay.displayTickValues && xAxisWithDisplay.displayTickValues.length > 0;
    const sourceTicks = hasDisplayTicks
      ? xAxisWithDisplay.displayTickValues!
      : (xAxisWithDisplay.tickValues ?? []);

    // 데이터에 실제로 존재하는 x-key 목록 (정규화 매칭의 대상)
    const dataKeys = chartData.map((point) => String(point.x));

    // 각 소스 틱을 "실제 데이터 x-key"로 정규화 매칭 (P0-5)
    // → "26F" 틱이라도 데이터키 "26F.04"로 치환해야 Recharts가 라벨을 그린다.
    // → 중복 제거하되 입력 순서는 보존한다.
    const seen = new Set<string>();
    const explicitTicksRaw: string[] = [];
    for (const rawTick of sourceTicks.map(String)) {
      const matched = matchTickToDataKey(rawTick, dataKeys);
      if (matched && !seen.has(matched)) {
        seen.add(matched);
        explicitTicksRaw.push(matched);
      }
    }

    // [D6] X축 소수연도 중복 라벨 제거
    //  → 데이터 x가 '23.01','23.07'(반기)면 formatAxisTickLabel이 둘 다 '23'으로 만들어
    //    X축에 '23 23 24 24'처럼 중복 표시된다.
    //  → "표시 라벨(formatAxisTickLabel 적용 후)"이 같아지는 눈금은 첫 번째만 남긴다.
    //    (데이터 키는 서로 다르므로 위 seen 중복제거로는 안 걸러진다 → 표시 라벨 기준으로 한 번 더.)
    const seenDisplay = new Set<string>();
    const explicitTicks: string[] = [];
    for (const tick of explicitTicksRaw) {
      const display = formatAxisTickLabel(tick);
      if (!seenDisplay.has(display)) {
        seenDisplay.add(display);
        explicitTicks.push(tick);
      }
    }

    if (explicitTicks.length === 0) return undefined;

    // displayTickValues가 명시되면 솎기(thinning)를 끄고 그 틱을 그대로 표시 (P0-5)
    // → 분석 단계에서 "이만큼만 보여줘"라고 정한 것을 존중한다.
    if (hasDisplayTicks) return explicitTicks;

    if (explicitTicks.length <= maxVisibleXLabels) return explicitTicks;
    if (maxVisibleXLabels <= 1) return [explicitTicks[0]];

    const selected = new Set<string>();
    for (let i = 0; i < maxVisibleXLabels; i++) {
      const sourceIndex = Math.floor((i * (explicitTicks.length - 1)) / (maxVisibleXLabels - 1));
      selected.add(explicitTicks[sourceIndex]);
    }
    return Array.from(selected);
  })();

  const xLabelInterval = (() => {
    if (visibleXTicks) return 0;
    const len = chartData.length;
    if (len <= maxVisibleXLabels) return 0;
    return Math.ceil(len / maxVisibleXLabels);
  })();

  function getHighlightZoneLabel(zone: (typeof analysis.emphasis.highlightZones)[number]) {
    const fromIndex = chartData.findIndex((point) => String(point.x) === String(zone.fromX));
    const toIndex = chartData.findIndex((point) => String(point.x) === String(zone.toX));
    const span =
      fromIndex >= 0 && toIndex >= 0
        ? Math.abs(toIndex - fromIndex) / Math.max(chartData.length - 1, 1)
        : 1;

    if (showDirectLabels && span < chartSettings.highlightZone.minLabelSpanRatio) {
      return "";
    }

    return zone.label;
  }

  // ─────────────────────────────────────────────
  // 여백 계산 (chartSettings 기반)
  // ─────────────────────────────────────────────
  // 밴드/전망 끝라벨("19x","27Y(E)" 등)이 잘리지 않도록, 직접 라벨이 없을 때라도 우측 여백을 확보한다 (P0-3 / A4)
  // → 이미 directLabels로 우측 여백이 확보됐으면 중복 가산하지 않는다.
  const needsBandRightMargin = (hasBandSeries || hasForecastLabels) && !showDirectLabels;

  // [A2/C2] 우측 끝라벨 겹침 회피:
  //  → 이중축이면 우측 Y축 눈금 숫자가 카드 우측에 이미 있어서, 좌축 시리즈의 끝라벨이
  //    그 위에 겹쳐 "통신 21x"가 우축 "2,000pt"와 겹쳐 읽혔다.
  //  → [C2] 대책: (1) 우측 여백을 더 키워 끝라벨을 눈금 숫자 바깥쪽 빈 공간에 두고,
  //              (2) 좌축 끝라벨의 가로 offset을 우축 눈금 폭만큼 더 바깥으로 밀고,
  //              (3) 좌축 끝라벨을 끝점에서 살짝 위/아래로 더 분산해 우축 숫자와 세로로 어긋나게 한다.
  //  → chart-settings.ts는 수정 금지라 이 파일 내 지역 상수로 둔다.
  const DUAL_AXIS_END_LABEL_EXTRA_RIGHT = 92;
  const hasAnyEndLabel = showDirectLabels || hasBandSeries || hasForecastLabels;
  const dualAxisEndLabelRightMargin =
    hasSecondaryYAxis && hasAnyEndLabel ? DUAL_AXIS_END_LABEL_EXTRA_RIGHT : 0;

  // [C2] 이중축일 때 좌축(left) 시리즈 끝라벨을 우축 눈금 숫자 바깥으로 밀어내는 가로 offset 가산값.
  //  → 우축 눈금 폭(rightWidth)만큼 더 밀어야 눈금 숫자와 가로로 겹치지 않는다.
  const dualAxisLeftLabelExtraOffset = hasSecondaryYAxis
    ? chartSettings.yAxis.rightWidth
    : 0;

  // [C2] 이중축일 때 좌축 끝라벨 세로 분산을 한 단계 더 키우는 보정값.
  //  → 우축 눈금 숫자와 같은 높이에 라벨이 놓이지 않도록 세로로 더 어긋나게 한다.
  const dualAxisLeftLabelDyBoost = hasSecondaryYAxis ? END_LABEL_DY_GAP * 0.5 : 0;

  // i번째 시리즈가 좌축(left)에 그려지는지 — 끝라벨 보정을 좌축에만 적용하기 위함.
  const isLeftAxisSeries = (index: number): boolean =>
    !(hasSecondaryYAxis && index > 0);

  const computedMargin = {
    top: chartSettings.margin.top,
    right:
      chartSettings.margin.right +
      (hasSecondaryYAxis ? chartSettings.dualAxis.extraRightMargin : 0) +
      (showDirectLabels ? chartSettings.directLabels.extraRightMargin : 0) +
      (needsBandRightMargin ? chartSettings.directLabels.extraRightMargin : 0) +
      dualAxisEndLabelRightMargin,
    bottom: showLegend
      ? chartSettings.margin.bottom + chartSettings.legend.extraBottomMargin
      : chartSettings.margin.bottom,
    left: chartSettings.margin.left,
  };

  function renderSourceReplicaLineChart() {
    const viewW = 469;
    const viewH = 350;
    const titleBar = { x: 18, y: 18, w: 433, h: 37 };
    const chartLeft = 59;
    const chartTop = 91;
    const chartW = 386;
    const chartH = 199;
    const chartBottom = chartTop + chartH;
    const yTicks = (analysis.structure.yAxis.tickValues ?? ["0", "10", "20", "30", "40", "50"])
      .map((tick) => Number(String(tick).replace(/[^\d.-]/g, "")))
      .filter((tick) => Number.isFinite(tick));
    const replicaYMin = analysis.structure.yAxis.min ?? Math.min(0, ...yTicks);
    const replicaYMax = analysis.structure.yAxis.max ?? Math.max(...yTicks, 1);
    const sourceOrder =
      analysis.data.series[0]?.data.map((point) => String(point.x)) ??
      chartData.map((point) => String(point.x));
    const xIndex = new Map(sourceOrder.map((x, index) => [x, index]));
    const xCount = Math.max(sourceOrder.length - 1, 1);
    const xPos = (x: string) => chartLeft + ((xIndex.get(x) ?? 0) / xCount) * chartW;
    const yPos = (y: number) => {
      const ratio = (y - replicaYMin) / ((replicaYMax - replicaYMin) || 1);
      return chartBottom - ratio * chartH;
    };
    const pathForSeries = (series: (typeof analysis.data.series)[number]) => {
      const points = series.data
        .filter((point) => point.y != null && xIndex.has(String(point.x)))
        .sort((a, b) => (xIndex.get(String(a.x)) ?? 0) - (xIndex.get(String(b.x)) ?? 0));
      if (points.length === 0) return "";
      return points
        .map((point, i) => `${i === 0 ? "M" : "L"} ${xPos(String(point.x)).toFixed(1)} ${yPos(point.y).toFixed(1)}`)
        .join(" ");
    };
    const tickLabel = (raw: string) => {
      const match = raw.match(/^(\d{4})-(\d{2})/);
      if (match) return `${match[2]}/${match[1].slice(2)}`;
      return raw;
    };
    const tickX = (raw: string) => {
      const exact = xIndex.get(raw);
      if (exact != null) return chartLeft + (exact / xCount) * chartW;
      const prefix = sourceOrder.findIndex((x) => x.startsWith(raw));
      return chartLeft + ((prefix >= 0 ? prefix : 0) / xCount) * chartW;
    };
    const xTicks =
      (analysis.structure.xAxis.tickValues ?? []).length > 0
        ? (analysis.structure.xAxis.tickValues ?? []).map(String)
        : [sourceOrder[0], sourceOrder[Math.floor(sourceOrder.length / 2)], sourceOrder[sourceOrder.length - 1]];
    const sourceLine = analysis.structure.source || "";

    return (
      <div style={{ width: "100%", height: "100%", background: "#ffffff" }}>
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={analysis.structure.title}
          style={{
            display: "block",
            background: "#ffffff",
            fontFamily:
              "\"Apple SD Gothic Neo\", \"Noto Sans KR\", Arial, sans-serif",
          }}
        >
          <rect x="0" y="0" width={viewW} height={viewH} fill="#ffffff" />
          <rect
            x={titleBar.x}
            y={titleBar.y}
            width={titleBar.w}
            height={titleBar.h}
            fill="#d7d7d7"
            stroke="#c9c9c9"
            strokeWidth="1.5"
          />
          <text
            x={titleBar.x + 13}
            y={titleBar.y + 27}
            fontSize="21"
            fontWeight="900"
            fill="#111111"
            stroke="#ffffff"
            strokeWidth="1.6"
            paintOrder="stroke"
          >
            {analysis.structure.title}
          </text>

          <text x="25" y="75" fontSize="15" fontWeight="800" fill="#111111">
            ({analysis.structure.yAxis.unit || analysis.structure.yAxis.label})
          </text>

          {analysis.data.series.map((series, i) => {
            const y = 90 + i * 20;
            const color = getSeriesColor(i);
            const label = analysis.structure.legend[i]?.name ?? series.name;
            return (
              <g key={`replica-legend-${series.name}`}>
                <line
                  x1="79"
                  x2="120"
                  y1={y}
                  y2={y}
                  stroke={color}
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <text x="124" y={y + 5} fontSize="13" fontWeight="800" fill="#111111">
                  {label}
                </text>
              </g>
            );
          })}

          <line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} stroke="#111111" strokeWidth="2.6" />
          <line x1={chartLeft} y1={chartBottom} x2={chartLeft + chartW} y2={chartBottom} stroke="#111111" strokeWidth="2.6" />

          {yTicks.map((tick) => (
            <g key={`replica-y-${tick}`}>
              <line
                x1={chartLeft - 6}
                x2={chartLeft}
                y1={yPos(tick)}
                y2={yPos(tick)}
                stroke="#111111"
                strokeWidth="2.6"
              />
              <text
                x={chartLeft - 14}
                y={yPos(tick) + 5}
                textAnchor="end"
                fontSize="16"
                fontWeight="800"
                fill="#111111"
              >
                {tick}
              </text>
            </g>
          ))}

          {xTicks.map((tick) => {
            const x = tickX(String(tick));
            return (
              <g key={`replica-x-${tick}`}>
                <line x1={x} x2={x} y1={chartBottom} y2={chartBottom + 6} stroke="#111111" strokeWidth="2.6" />
                <text
                  x={x}
                  y={chartBottom + 26}
                  textAnchor="middle"
                  fontSize="18"
                  fontWeight="800"
                  fill="#111111"
                >
                  {tickLabel(String(tick))}
                </text>
              </g>
            );
          })}

          {analysis.data.series.map((series, i) => (
            <path
              key={`replica-line-${series.name}`}
              d={pathForSeries(series)}
              fill="none"
              stroke={getSeriesColor(i)}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={i === 0 ? 1 : 0.95}
            />
          ))}

          <line x1="18" x2="451" y1="320" y2="320" stroke="#111111" strokeWidth="1.4" />
          <text x="18" y="339" fontSize="15" fontWeight="800" fill="#111111">
            {sourceLine}
          </text>
        </svg>
      </div>
    );
  }

  if (exportOptions.sourceReplica) {
    return renderSourceReplicaLineChart();
  }

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
          ticks={visibleXTicks}
          tickFormatter={formatAxisTickLabel}
          label={{
            value: getXAxisLabel(analysis.structure.xAxis.label),
            position: "insideBottomRight",
            offset: -30,
            fill: colors.textTertiary,
            fontSize: 16,
            fontWeight: 800,
            fontFamily: theme.typography.fontFamily.sans,
          }}
        />

        {/* Y축 (좌측) — width로 숫자 잘림 방지 */}
        <YAxis
          yAxisId="left"
          width={chartSettings.yAxis.width}
          {...styles.yAxis}
          tickFormatter={(value) => {
            const yAxis = analysis.structure.yAxis;
            // 눈금 접미사 단위는 화이트리스트/지수형/라벨중복 검사를 통과한 것만 (P0-4)
            const tickUnit = getTickUnit(yAxis.unit || "", yAxis.label || "");
            return formatValueWithUnit(
              Number(value),
              tickUnit,
              // [D2] 실제로 그릴 눈금 배열로 자릿수 계산 → 라벨 자릿수가 눈금과 일치
              getAxisFractionDigits(yAxis.min, yAxis.max, effectiveYAxisTicks),
            );
          }}
          // [수정1] 음수 하한 보존: 명시 min이 있어도 데이터 음수 저점까지 내린 yMin을 도메인 하한으로 쓴다.
          //  → yAxis.min이 0이어도 데이터에 음수가 있으면 yMin이 그 음수가 되어 저점이 잘리지 않는다.
          //  → 명시 min/max가 전혀 없으면 "auto"로 두어 기존 동작 유지.
          domain={[
            analysis.structure.yAxis.min != null ? yMin : "auto",
            analysis.structure.yAxis.max ?? "auto",
          ]}
          // [D2] JSON 눈금이 없으면 균등 nice 눈금으로 폴백(빈 배열이면 undefined → 기존 동작)
          //  → 밴드/전망 차트는 effectiveYAxisTicks가 빈 배열 → undefined → Recharts auto(과대확장 방지)
          ticks={effectiveYAxisTicks.length > 0 ? effectiveYAxisTicks : undefined}
          scale={analysis.structure.yAxis.isLogScale ? "log" : "auto"}
          allowDataOverflow={analysis.structure.yAxis.isLogScale}
          tickCount={6}
          label={{
            value: getAxisLabel(analysis.structure.yAxis.label, analysis.structure.yAxis.unit),
            position: "insideTopLeft",
            offset: 0,
            dy: -28,
            fill: colors.textTertiary,
            fontSize: 16,
            fontWeight: 800,
            fontFamily: theme.typography.fontFamily.sans,
          }}
        />

        {/* 보조 Y축 (우측) — 듀얼 축인 경우만 */}
        {hasSecondaryYAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            width={chartSettings.yAxis.rightWidth}
            {...styles.yAxis}
            tickFormatter={(value) => {
              const secondary = analysis.structure.secondaryYAxis!;
              const tickUnit = getTickUnit(secondary.unit || "", secondary.label || "");
              return formatValueWithUnit(
                Number(value),
                tickUnit,
                // [D2] 보조축도 실제로 그릴 눈금 배열로 자릿수 계산
                getAxisFractionDigits(secondary.min, secondary.max, effectiveSecondaryYAxisTicks),
              );
            }}
            domain={[
              analysis.structure.secondaryYAxis!.min ?? "auto",
              analysis.structure.secondaryYAxis!.max ?? "auto",
            ]}
            // [D2] 보조축도 JSON 눈금이 없으면 균등 nice 눈금으로 폴백
            ticks={
              effectiveSecondaryYAxisTicks.length > 0
                ? effectiveSecondaryYAxisTicks
                : undefined
            }
            tickCount={6}
            label={{
              value: getAxisLabel(
                analysis.structure.secondaryYAxis!.label,
                analysis.structure.secondaryYAxis!.unit,
              ),
              position: "insideTopRight",
              offset: 0,
              dy: -28,
              fill: colors.textTertiary,
              fontSize: 16,
              fontWeight: 800,
              fontFamily: theme.typography.fontFamily.sans,
            }}
          />
        )}

        {/* 툴팁 */}
        <Tooltip
          {...styles.tooltip}
          formatter={(value, name) => [
            formatValueWithUnit(
              Number(value),
              getSeriesUnit(
                analysis.data.series.findIndex((series) => series.name === String(name)),
              ),
              0,
            ),
            name,
          ]}
          labelFormatter={(label) => formatAxisTickLabel(label)}
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
        {analysis.emphasis.highlightZones.map((zone, i) => {
          const zoneLabel = getHighlightZoneLabel(zone);
          return (
            <ReferenceArea
              key={`zone-${i}`}
              yAxisId="left"
              x1={String(zone.fromX)}
              x2={String(zone.toX)}
              y1={yMin}
              y2={yMax}
              fill={zone.color || colors.accentSubtle}
              fillOpacity={chartSettings.highlightZone.opacity}
              strokeOpacity={0}
              label={
                zoneLabel
                  ? {
                    value: zoneLabel,
                    position: "insideTopLeft",
                    fill: colors.textTertiary,
                    fontSize: chartSettings.highlightZone.labelFontSize,
                    fontWeight: 800,
                    fontFamily: theme.typography.fontFamily.sans,
                  }
                  : undefined
              }
            />
          );
        })}

        {/* 영역 채움 (그라데이션) — 전망/밴드 시리즈는 제외 */}
        {/* → 전망선은 점선이라 면적 채움이 어색하고, 밴드는 선 자체가 경계라 채움하면 지저분해진다 */}
        {/* [D5] 시리즈 3개 이상이면 area를 통째로 끈다(showAreaFill=false) → 선만 그린다 */}
        {showAreaFill && analysis.data.series.map((series, i) => {
          if (isForecastIndex(i) || isBandIndex(i)) return null;
          const legendItem = analysis.structure.legend[i];
          const role = series.role ?? legendItem?.role;
          const roleStyle = role === "secondary"
            ? chartSettings.seriesRole.secondary
            : chartSettings.seriesRole.primary;
          return (
            <Area
              key={`area-${series.name}`}
              type="linear"
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
          const kind = resolveSeriesKind(i);
          const isForecast = kind === "forecast";
          const isBand = kind === "band";
          const legendItem = analysis.structure.legend[i];
          const role = series.role ?? legendItem?.role;
          // 밴드 시리즈는 옅게(보조 스타일) 그려서 본선과 구분하되, 우측 끝 배수라벨로 식별한다
          const roleStyle = role === "secondary" || isBand
            ? chartSettings.seriesRole.secondary
            : chartSettings.seriesRole.primary;

          return (
            <Line
              key={series.name}
              type="linear"
              dataKey={series.name}
              yAxisId={hasSecondaryYAxis && i > 0 ? "right" : "left"}
              // 전망·밴드는 범례에서 빼고(none), 밴드는 우측 끝 배수라벨로 직접 식별 (P0-3)
              legendType={isForecast || isBand ? "none" : "line"}
              stroke={seriesColor}
              // 밴드는 옅은 실선, 전망은 점선
              strokeDasharray={isForecast ? "8 4" : undefined}
              strokeWidth={isForecast ? 3.2 : isBand ? 2.4 : roleStyle.strokeWidth}
              strokeOpacity={isBand ? 0.7 : roleStyle.opacity}
              strokeLinecap={isDenseLine ? "butt" : "round"}
              strokeLinejoin={isDenseLine ? "miter" : "round"}
              dot={
                showDensePointMarkers
                  ? {
                    r: role === "secondary" ? 0.9 : 1.15,
                    stroke: "none",
                    fill: seriesColor,
                    fillOpacity: role === "secondary" ? 0.45 : 0.62,
                  }
                  : isDenseLine
                    ? false
                  : {
                    r: role === "secondary" ? 3.4 : 4,
                    stroke: colors.surface,
                    strokeWidth: role === "secondary" ? 1.8 : 2.2,
                    fill: seriesColor,
                    fillOpacity: roleStyle.opacity,
                  }
              }
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

        {/* 직접 라벨 — 선 끝에서 바로 "무슨 선인지 + 최신값"을 읽게 한다 */}
        {showDirectLabels &&
          directLabelPoints.map((item) => {
            // [C2] 좌축 시리즈만 우축 눈금 바깥으로 더 밀고 세로로 더 어긋나게 한다.
            const isLeft = isLeftAxisSeries(item.index);
            const baseDy = directLabelDy.get(item.series.name) ?? 0;
            return (
              <ReferenceDot
                key={`direct-label-${item.series.name}`}
                yAxisId={item.yAxisId}
                x={String(item.point.x)}
                y={item.point.y}
                r={chartSettings.directLabels.dotRadius}
                fill={item.color}
                stroke={colors.surface}
                strokeWidth={2.5}
                label={{
                  value: getDirectSeriesLabel(item.series.name, item.point.y, item.index),
                  position: "right",
                  offset:
                    chartSettings.directLabels.offset +
                    (isLeft ? dualAxisLeftLabelExtraOffset : 0),
                  dy: baseDy + (isLeft ? Math.sign(baseDy || 1) * dualAxisLeftLabelDyBoost : 0),
                  fill: item.color,
                  fontSize: chartSettings.directLabels.fontSize,
                  fontWeight: 900,
                  fontFamily: theme.typography.fontFamily.sans,
                }}
              />
            );
          })}

        {/* 밴드 배수라벨 — 선 끝에 "19x","20x" 등을 항상 표시 (P0-3, showLegend/showDirectLabels와 무관) */}
        {/* [수정2] 라벨 세로 위치는 bandLabelDy(우측 여백 균등 분산)로 결정 → 끝점 y를 따르지 않아 겹치지 않는다. */}
        {/*  → 가로 offset만 우축 눈금 바깥으로 밀고(좌축 시리즈일 때), 세로 boost는 적용하지 않는다(균등 분산을 깨므로). */}
        {bandLabelPoints.map((item) => {
          const isLeft = isLeftAxisSeries(item.index);
          const baseDy = bandLabelDy.get(item.series.name) ?? 0;
          return (
            <ReferenceDot
              key={`band-label-${item.series.name}`}
              yAxisId={item.yAxisId}
              x={String(item.point.x)}
              y={item.point.y}
              r={2.5}
              fill={item.color}
              stroke="none"
              label={{
                value: item.label,
                position: "right",
                offset: 8 + (isLeft ? dualAxisLeftLabelExtraOffset : 0),
                dy: baseDy,
                fill: item.color,
                fontSize: 15,
                fontWeight: 800,
                fontFamily: theme.typography.fontFamily.mono,
              }}
            />
          );
        })}

        {/* [A4] 전망선 끝라벨 — 점선 끝에 시리즈명("27Y(E)" 등)을 항상 표시 */}
        {/* → 범례에서 빠지고(legendType="none") 시리즈 4개↑면 직접라벨도 없으므로, */}
        {/*   이 라벨이 "어느 점선이 몇 년도 전망인지"를 식별하는 유일한 단서다. */}
        {/* → 점선 색(item.color)을 그대로 써서 어떤 선의 라벨인지 색으로도 잇는다. */}
        {/* [수정2] 라벨 세로 위치는 forecastLabelDy(우측 여백 균등 분산)로 결정 → 끝점 y를 따르지 않아 겹치지 않는다. */}
        {/*  → 가로 offset만 우축 눈금 바깥으로 밀고, 세로 boost는 적용하지 않는다(균등 분산을 깨므로). */}
        {forecastLabelPoints.map((item) => {
          const isLeft = isLeftAxisSeries(item.index);
          const baseDy = forecastLabelDy.get(item.series.name) ?? 0;
          return (
            <ReferenceDot
              key={`forecast-label-${item.series.name}`}
              yAxisId={item.yAxisId}
              x={String(item.point.x)}
              y={item.point.y}
              r={2.5}
              fill={item.color}
              stroke="none"
              label={{
                value: item.label,
                position: "right",
                offset: 8 + (isLeft ? dualAxisLeftLabelExtraOffset : 0),
                dy: baseDy,
                fill: item.color,
                fontSize: 14,
                fontWeight: 800,
                fontFamily: theme.typography.fontFamily.sans,
              }}
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
