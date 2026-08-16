"use client";

import React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartAnalysis, ExportOptions } from "@/lib/analysis/schema";
import {
  getAnalysisStylePreset,
  getAnalysisThemeMode,
  getPresetColors,
  getPresetRechartsStyle,
} from "@/lib/style-presets";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";
import { chartSettings } from "@/lib/chart-settings";
import {
  formatAxisLabel,
  formatAxisTickLabel,
  matchTickToDataKey,
  getTickUnit,
  getInlineLabelUnit,
  formatValueWithUnit,
  getAxisFractionDigits,
  generateNiceTicks,
} from "@/lib/chart-format";
import { mergeOptionDefaults } from "@/lib/visual-system-options";

interface TossComboChartProps {
  analysis: ChartAnalysis;
  theme?: ThemeMode;
  width?: number | `${number}%`;
  height?: number;
  animated?: boolean;
}

type SeriesWithRender = ChartAnalysis["data"]["series"][number] & {
  renderAs?: "bar" | "line" | "area";
  role?: string;
  axis?: "left" | "right";
  color?: string;
  stackId?: string;
};

/**
 * A1: 이 파일에 복붙돼 있던 축/단위/소수 포매터(TICK_SCALE_UNITS, isIndexLikeUnit,
 * shouldSuppressTickUnit, formatValueWithUnit, formatAxisTickValue, normalizeXKey,
 * findMatchingXKey, formatXAxisTick, getAxisFractionDigits)는 모두 삭제하고
 * 공유 유틸 "@/lib/chart-format"로 일원화했다.
 * → 한 곳에서 고치면 모든 차트(라인/콤보/바)에 동일하게 반영되도록.
 *   - 눈금 텍스트       → formatAxisTickLabel
 *   - 데이터 키 매칭     → matchTickToDataKey
 *   - 눈금 단위 필터     → getTickUnit (formatValueWithUnit과 조합)
 *   - 끝라벨 단위 필터   → getInlineLabelUnit
 *   - 값+단위 표시       → formatValueWithUnit
 *   - 소수 자릿수        → getAxisFractionDigits
 * X축 제목 조립만 이 파일에 남긴다.
 */
function getXAxisLabel(label = ""): string {
  if (!label) return "";
  return label;
}

export default function TossComboChart({
  analysis,
  theme: themeMode = "dark",
  width = "100%",
  height = 350,
  animated = true,
}: TossComboChartProps) {
  const renderThemeMode = getAnalysisThemeMode(analysis, themeMode);
  const theme = getTheme(renderThemeMode);
  const preset = getAnalysisStylePreset(analysis);
  const styles = getPresetRechartsStyle(analysis, themeMode);
  const colors = getPresetColors(preset, renderThemeMode);
  const hasSecondaryYAxis = !!analysis.structure.secondaryYAxis;
  const seriesList = analysis.data.series as SeriesWithRender[];
  const exportOptions = mergeOptionDefaults<ExportOptions>(
    preset.exportDefaults,
    analysis.exportOptions,
  );
  const squareEdges = !!exportOptions.squareEdges;

  // 수정1(D2 롤백): 밴드/전망(forecast) 시리즈가 하나라도 있으면 generateNiceTicks를 적용하지 않는다.
  // → 밴드(PER 상·하한)/전망선은 도메인 양 끝을 일부러 비대칭으로 잡는 경우가 많은데,
  //   nice-round 균등 눈금이 그 위에 끼면 Y축이 과대확장(20,000~80,000)되거나 밴드 라벨과
  //   엇갈려 page-13-g1·page-15-g3 같은 회귀가 났다. 밴드/전망이면 tickValues/Recharts 자동에 맡긴다.
  const seriesKindOf = (s: SeriesWithRender): string =>
    String((s as { seriesKind?: string }).seriesKind ?? "").toLowerCase();
  const hasBandOrForecast = seriesList.some((s) => {
    const kind = seriesKindOf(s);
    if (kind === "band" || kind === "forecast") return true;
    const name = String(s.name ?? "");
    // 키워드 폴백(seriesKind 누락 JSON 호환): 밴드/전망/forecast 명칭
    return /밴드|전망|forecast|band/i.test(name);
  });

  // 수정1(D2 롤백): 특정 Y축(좌/우)에 속한 시리즈들의 "실측" y 최솟값/최댓값.
  // → JSON의 axis.min이 음수 데이터를 못 덮으면(예: min=-16인데 데이터 저점 -17.76) 눈금이
  //   데이터를 잘라낸다. nice-tick 생성/도메인 계산 시 실측 범위를 함께 고려해 음수 하한을 보존한다.
  function dataExtentForAxis(side: "left" | "right"): { min: number; max: number } | null {
    const ys: number[] = [];
    seriesList.forEach((s, i) => {
      if (getYAxisId(i) !== side) return;
      for (const p of s.data) {
        if (Number.isFinite(p.y)) ys.push(Number(p.y));
      }
    });
    if (ys.length === 0) return null;
    return { min: Math.min(...ys), max: Math.max(...ys) };
  }

  // D2: Y축 자동 눈금 균등화.
  // tickValues가 없으면 Recharts가 임의 눈금(tickCount=6)을 만들고 포매터가 정수 반올림하면서
  // '85/215/340'(비균등)이나 '109/116'(끝값 끼움) 같은 깨진 눈금이 나왔다.
  // → min/max에서 1·2·5·10 계열 nice-round 균등 눈금을 직접 만들어 ticks=로 넘긴다.
  //   tickValues가 이미 있으면(원본 눈금 명시) 그 값을 존중하므로 nice-tick을 끼우지 않는다(undefined).
  //   generateNiceTicks가 빈 배열을 주면(도메인 부적합) undefined로 떨궈 기존 Recharts 자동 눈금 동작 유지.
  function computeAxisTicks(
    axis: { tickValues?: Array<string | number>; min?: number; max?: number },
    side: "left" | "right",
  ): number[] | undefined {
    if (axis.tickValues && axis.tickValues.length > 0) return undefined;
    // 수정1: 밴드/전망 차트에는 nice-tick 미적용(과대확장/라벨겹침 회귀 방지).
    if (hasBandOrForecast) return undefined;
    // 수정1: 도메인 하한/상한을 실측값까지 확장해 음수 저점이 잘리지 않게 한다.
    const extent = dataExtentForAxis(side);
    const min =
      axis.min != null && extent != null ? Math.min(axis.min, extent.min) : axis.min ?? extent?.min;
    const max =
      axis.max != null && extent != null ? Math.max(axis.max, extent.max) : axis.max ?? extent?.max;
    const nice = generateNiceTicks(min, max);
    return nice.length > 0 ? nice : undefined;
  }
  const leftAxisTicks = computeAxisTicks(analysis.structure.yAxis, "left");
  const rightAxisTicks = hasSecondaryYAxis
    ? computeAxisTicks(analysis.structure.secondaryYAxis!, "right")
    : undefined;

  // 수정1(D2 롤백): Y축 domain min/max 계산.
  // → JSON에 min/max가 없으면 'auto'(Recharts 자동)인데, 자동은 데이터에 딱 맞춰 음수도 잘 잡지만
  //   nice-tick과 함께 쓰면 눈금이 도메인 밖에 생겨 잘릴 수 있다. nice-tick을 직접 줄 때는
  //   domain을 그 눈금의 [min,max]로 맞춰 음수 하한을 포함해 데이터가 클리핑되지 않게 한다.
  //   밴드/전망이거나 nice-tick이 없으면 기존 동작(JSON min/max 또는 'auto')을 그대로 유지한다.
  function computeAxisDomain(
    axis: { min?: number; max?: number },
    ticks: number[] | undefined,
  ): [number | "auto", number | "auto"] {
    if (ticks && ticks.length > 0) {
      // nice-tick의 양 끝이 도메인. (generateNiceTicks가 도메인을 덮도록 niceMin/niceMax로 맞춤)
      return [ticks[0], ticks[ticks.length - 1]];
    }
    return [axis.min ?? "auto", axis.max ?? "auto"];
  }
  const leftAxisDomain = computeAxisDomain(analysis.structure.yAxis, leftAxisTicks);
  const rightAxisDomain = hasSecondaryYAxis
    ? computeAxisDomain(analysis.structure.secondaryYAxis!, rightAxisTicks)
    : (["auto", "auto"] as [number | "auto", number | "auto"]);

  const chartData = (() => {
    if (!seriesList[0]) return [];
    const xSet = new Map<string, Record<string, string | number>>();
    for (const series of seriesList) {
      for (const point of series.data) {
        const xKey = String(point.x);
        if (!xSet.has(xKey)) xSet.set(xKey, { x: xKey });
        xSet.get(xKey)![series.name] = point.y;
      }
    }
    // X값 정렬 — JSON의 tickValues가 모든 X값을 덮으면 그 순서를 그대로 따른다.
    // (한글 시간 라벨 "1주·4주·3개월·6개월·1년" 등은 알파벳순 정렬 시 순서가 깨지므로)
    const tickOrder = (analysis.structure.xAxis.tickValues ?? []).map(String);
    const rows = Array.from(xSet.values());
    const allCovered =
      tickOrder.length > 0 && rows.every((r) => tickOrder.includes(String(r.x)));
    if (allCovered) {
      return rows.sort(
        (a, b) => tickOrder.indexOf(String(a.x)) - tickOrder.indexOf(String(b.x)),
      );
    }
    return rows.sort((a, b) => {
      const ax = String(a.x);
      const bx = String(b.x);
      return ax < bx ? -1 : ax > bx ? 1 : 0;
    });
  })();

  const maxVisibleXLabels =
    chartData.length >= chartSettings.xAxis.longSeriesThreshold
      ? chartSettings.xAxis.longSeriesMaxVisibleLabels
      : chartSettings.xAxis.maxVisibleLabels;

  // C1: 데이터 포인트가 많은(dense) 시계열은 Line의 점마커(dot)를 끄고 선만 그린다.
  // 점이 항상 찍히면(r 3.8/3.2) 포인트가 빽빽한 시계열이 "점구름(산점도)"처럼 보이기 때문.
  // 임계값 미만(<24)이면 기존 dot을 그대로 유지해 데이터가 적을 때의 가독성을 보존한다.
  // chart-settings.ts는 다른 에이전트와 충돌하므로 건드리지 않고 이 파일 지역 상수로 처리.
  const DENSE_THRESHOLD = 24;
  const isDense = chartData.length >= DENSE_THRESHOLD;

  const visibleXTicks = (() => {
    // 실제 데이터 x-key 목록(소수/접미사형 가능)
    const dataKeys = chartData.map((point) => String(point.x));

    // 수정3: 데이터 범위에서 균등하게 count개 x-key를 뽑는다(처음/끝 포함).
    // → tickValues/displayTickValues가 데이터 키와 매칭되지 않아 틱이 1개만 살아남거나
    //   전부 사라질 때, 데이터 자체에서 5~7개 균등 눈금을 강제로 만들어 X축이 비지 않게 한다.
    //   (page-12-t2: displayTickValues ['10'..'26']가 데이터 '2010.00'…과 안 맞아 '2010'만 떴음)
    const sampleEvenKeys = (count: number): string[] => {
      if (dataKeys.length === 0) return [];
      const n = Math.min(count, dataKeys.length);
      if (n <= 1) return [dataKeys[0]];
      const out: string[] = [];
      for (let i = 0; i < n; i++) {
        const idx = Math.round((i * (dataKeys.length - 1)) / (n - 1));
        const key = dataKeys[idx];
        if (!out.includes(key)) out.push(key);
      }
      return out;
    };

    // P0-5: displayTickValues(정제형)가 있으면 우선 사용, 없으면 tickValues
    const xAxisWithDisplay = analysis.structure.xAxis as typeof analysis.structure.xAxis & {
      displayTickValues?: string[];
    };
    const sourceTicks =
      xAxisWithDisplay.displayTickValues && xAxisWithDisplay.displayTickValues.length > 0
        ? xAxisWithDisplay.displayTickValues
        : (xAxisWithDisplay.tickValues ?? []);
    // P0-5: tick(정제형)을 데이터 키와 정규화 매칭 → 매칭된 실제 키로 환원해야
    //       Recharts ticks=가 데이터와 정확일치하여 틱이 사라지지 않는다.
    const explicitTicks = sourceTicks
      .map(String)
      .map((tick) => matchTickToDataKey(tick, dataKeys))
      .filter((key): key is string => key !== undefined);
    // 중복 제거(여러 tick이 같은 데이터 키에 매칭될 수 있음)
    const uniqueTicks = Array.from(new Set(explicitTicks));

    // 수정3: 명시 눈금이 "충분히" 매칭됐을 때만 그대로 사용한다.
    // → 데이터가 짧으면(<5개) 명시 눈금이 1~2개여도 그게 전부일 수 있으니 존중.
    //   데이터가 길면(≥5개) 살아남은 명시 눈금이 너무 적은(<3개) 건 매칭 실패로 보고
    //   데이터 균등 샘플로 대체해 X축이 '2010' 하나만 뜨는 사고를 막는다.
    const MIN_FORCED_TICKS = 5; // 강제 표시 시 목표 눈금 수(5~7)
    const minMatchedForExplicit = dataKeys.length < MIN_FORCED_TICKS ? 1 : 3;
    if (uniqueTicks.length < minMatchedForExplicit) {
      // 명시 눈금이 부실 → 데이터에서 균등 눈금 강제 생성
      const forced = sampleEvenKeys(Math.min(maxVisibleXLabels, 7));
      return forced.length > 0 ? forced : undefined;
    }

    if (uniqueTicks.length <= maxVisibleXLabels) return uniqueTicks;
    const selected = new Set<string>();
    for (let i = 0; i < maxVisibleXLabels; i++) {
      const sourceIndex = Math.floor((i * (uniqueTicks.length - 1)) / (maxVisibleXLabels - 1));
      selected.add(uniqueTicks[sourceIndex]);
    }
    return Array.from(selected);
  })();

  function getSeriesColor(index: number): string {
    const legendItem = analysis.structure.legend[index] as {
      remakeColor?: string;
      originalColor?: string;
      color?: string;
    } | undefined;
    return (
      legendItem?.remakeColor ||
      legendItem?.originalColor ||
      legendItem?.color ||
      seriesList[index]?.color ||
      colors.series[index % colors.series.length]
    );
  }

  function getSeriesUnit(index: number): string {
    if (getYAxisId(index) === "right") return analysis.structure.secondaryYAxis?.unit || "";
    return analysis.structure.yAxis.unit || "";
  }

  // D5: renderAs 정규화 — 원본이 막대인 시리즈가 면적/선으로 변질되지 않게 한 곳에서 판정.
  // 규칙(원본 충실):
  //   - 명시적으로 "bar"면 무조건 막대(Bar)로 렌더한다(공백/대소문자 변형도 정규화).
  //   - renderAs가 없으면(누락) 면적으로 빠지지 않게 기본 "line"으로 본다.
  //   - "area"는 이 콤보 차트에 면적 렌더 경로가 없어 선(line)으로 폴백한다(막대→면적 변질 아님).
  // 반환은 "bar" | "line"만(이 차트가 실제 렌더하는 두 종류).
  function getRenderAs(series: SeriesWithRender | undefined): "bar" | "line" {
    const raw = String(series?.renderAs ?? "line").trim().toLowerCase();
    return raw === "bar" ? "bar" : "line";
  }

  function getYAxisId(index: number): "left" | "right" {
    const series = seriesList[index];
    if (series?.axis === "right") return "right";
    if (series?.axis === "left") return "left";
    if (hasSecondaryYAxis && index > 0 && getRenderAs(series) !== "bar") return "right";
    return "left";
  }

  // 수정(이중축 끝라벨 겹침 구조적 해소): 이중축(우측 Y축 존재) 콤보 차트에서는
  // 인라인 직접라벨(directLineLabels)을 아예 만들지 않는다(빈 배열).
  // → 직접라벨은 선 끝(우측)에 붙는데, 우측 Y축이 있으면 그 눈금 숫자/경계와 같은 높이대에서
  //   겹친다(A2~D1 땜질·픽셀 충돌 계산으로도 완전히 못 막았던 page-04/12/14 회귀). 데이터 단계에서
  //   비우면 아래의 끝라벨 렌더 블록·픽셀 충돌 계산·우측 여백 가산이 전부 자동으로 no-op이 되고,
  //   대신 하단 범례(<Legend/>)로 시리즈를 식별한다. 단일축 콤보는 기존 직접라벨 동작을 그대로 유지.
  const showBottomLegend = hasSecondaryYAxis;
  const directLineLabels =
    chartSettings.directLabels.enabled && !hasSecondaryYAxis
      ? seriesList
        .map((series, index) => {
          if (getRenderAs(series) === "bar") return null;
          const lastPoint = [...series.data].reverse().find((point) => point.y != null);
          if (!lastPoint) return null;
          return { series, index, point: lastPoint, color: getSeriesColor(index) };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .slice(0, 2)
      : [];

  // A3+A2: 두 직접라벨이 우측 Y축 눈금과 겹치지 않도록 "값(point.y) 크기 순서"로
  // 위/아래를 정한다. 단순 labelIndex % 2 분산은 데이터 순서와 무관해 겹침이 잦았다.
  // → 값이 더 큰 라벨은 위(-)로, 더 작은 라벨은 아래(+)로 더 크게 벌린다(±26px).
  // C2→D1: 위/아래 분산 폭을 키워(32→44px) 두 직접라벨이 우축 눈금 숫자와 같은 높이에
  //     겹치지 않게 한다. 라벨 간 수직 간격이 넓어질수록 우축 tick과의 충돌이 줄어든다.
  //     (page-04-t1 '340'↔'통신 잉여현금흐름 30', page-12-t2 사례 대응)
  const DIRECT_LABEL_SPREAD = 44; // 위/아래 분산 폭(px)
  // 직접라벨이 2개일 때만 의미가 있다. y가 NaN/null이면 비교에서 -Infinity로 처리.
  const directLabelYs = directLineLabels.map((item) =>
    Number.isFinite(item.point.y) ? Number(item.point.y) : Number.NEGATIVE_INFINITY,
  );
  const directLabelMaxY =
    directLabelYs.length > 0 ? Math.max(...directLabelYs) : Number.NEGATIVE_INFINITY;

  // D1: 끝라벨이 플롯 경계(위/아래)를 넘지 않게 클램프하기 위한 도우미.
  // → ReferenceDot 라벨은 점 기준 dy(px)로 위(-)/아래(+)로 밀린다. 점이 이미 플롯 상단에
  //   가까우면 위로 밀 때 라벨이 플롯 밖으로 잘리고, 하단에 가까우면 아래로 밀 때 잘린다.
  // 전략: 점의 세로 정규화 위치 t(0=하단,1=상단)를 구해, 상단 밴드면 무조건 아래로,
  //       하단 밴드면 무조건 위로 방향을 강제(겹침 회피 분산 방향보다 우선). 중간이면 분산 방향 유지.
  // 도메인 min/max가 'auto'(null)면 해당 축 시리즈 데이터의 실측 범위로 폴백한다.
  const plotInnerHeight = Math.max(
    height - chartSettings.margin.top - chartSettings.margin.bottom,
    1,
  );
  function resolveAxisDomain(side: "left" | "right"): { min: number; max: number } | null {
    const axis = side === "right" ? analysis.structure.secondaryYAxis : analysis.structure.yAxis;
    let min = axis?.min;
    let max = axis?.max;
    if (min == null || max == null) {
      // 해당 축에 속한 시리즈들의 y값 실측 범위로 폴백
      const ys: number[] = [];
      seriesList.forEach((s, i) => {
        if (getYAxisId(i) !== side) return;
        for (const p of s.data) {
          if (Number.isFinite(p.y)) ys.push(Number(p.y));
        }
      });
      if (ys.length > 0) {
        min = min ?? Math.min(...ys);
        max = max ?? Math.max(...ys);
      }
    }
    if (min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      return null;
    }
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }
  // 라벨 텍스트가 점 위/아래로 차지하는 대략적 절반 높이(폰트 1줄 ≈ fontSize) + 여백.
  const LABEL_HALF_HEIGHT = chartSettings.directLabels.fontSize * 0.5 + 4;
  // 점이 위/아래 끝에서 이 비율(픽셀) 안에 들면 "경계 밴드"로 보고 라벨 방향을 안쪽으로 강제.
  function clampLabelDy(item: (typeof directLineLabels)[number], preferredDy: number): number {
    const side = getYAxisId(item.index);
    const domain = resolveAxisDomain(side);
    if (!domain) return preferredDy; // 도메인 불명 → 기존 분산 방향 유지
    const y = Number(item.point.y);
    if (!Number.isFinite(y)) return preferredDy;
    // t: 0(하단)~1(상단). 점이 도메인 위쪽이면 위로 밀 여유(headroom)가 적다.
    const t = (y - domain.min) / (domain.max - domain.min);
    const clampedT = Math.min(Math.max(t, 0), 1);
    const headroomPx = clampedT * plotInnerHeight; // 점 위쪽 남은 픽셀
    const footroomPx = (1 - clampedT) * plotInnerHeight; // 점 아래쪽 남은 픽셀
    const need = Math.abs(preferredDy) + LABEL_HALF_HEIGHT;
    if (preferredDy < 0 && headroomPx < need) {
      // 위로 밀면 상단을 넘침 → 아래로 뒤집되, 발밑 여유 안에서만(없으면 0으로 붙임)
      return Math.max(Math.min(Math.abs(preferredDy), footroomPx - LABEL_HALF_HEIGHT), 0);
    }
    if (preferredDy > 0 && footroomPx < need) {
      // 아래로 밀면 하단을 넘침 → 위로 뒤집되, 머리 위 여유 안에서만
      return -Math.max(Math.min(preferredDy, headroomPx - LABEL_HALF_HEIGHT), 0);
    }
    return preferredDy;
  }

  // 수정2(끝라벨 겹침 구조적 해결): 끝라벨들의 최종 dy(px)를 "픽셀 좌표 기준"으로 미리 계산한다.
  // ─────────────────────────────────────────────────────────────────────────────
  // 왜 dy를 직접 계산하나?
  // → Recharts ReferenceDot 라벨에는 충돌 회피 엔진이 없다(A2→C2→D1 땜질 모두 부분 실패).
  //   그래서 각 라벨의 데이터 y값 → 화면 픽셀 y(cyPx)로 변환하고, 두 라벨의 목표 픽셀 y가
  //   최소 간격(MIN_LABEL_GAP)보다 가까우면 위/아래로 강제 분산시켜 겹침을 "구조적으로" 없앤다.
  //   (page-14-t2 '부동산 상대강도 106'↔'증권 상대강도 115'가 같은 우축 높이대에서 겹치던 문제)
  //
  // 계산 흐름:
  //   1) 각 라벨의 점 픽셀 y(cyPx) = top + (1 - t) * plotInnerHeight   (t=0 하단, 1 상단)
  //   2) 선호 목표 = cyPx + clampLabelDy(preferredDy)  (플롯 상/하단 경계 클램프는 기존 함수 재사용)
  //   3) 라벨 2개면 목표 픽셀 y의 간격이 MIN_LABEL_GAP보다 작을 때 더 위 라벨은 위로, 더 아래
  //      라벨은 아래로 절반씩 벌려 간격을 확보(플롯 경계 안으로 다시 클램프)
  //   4) 최종 dy = 최종목표 - cyPx
  const MIN_LABEL_GAP = 24; // 끝라벨 간 최소 세로 간격(px)
  // 라벨 텍스트가 점유하는 세로 반높이(상·하단 경계로 빠져나가지 않게 클램프할 때 사용)
  const labelPixelInfo = directLineLabels.map((item, labelIndex) => {
    const side = getYAxisId(item.index);
    const domain = resolveAxisDomain(side);
    const y = Number(item.point.y);
    // 점의 픽셀 y. 도메인/값 불명이면 plot 중앙으로 폴백(분산은 dy로 처리되므로 안전).
    let cyPx = chartSettings.margin.top + plotInnerHeight / 2;
    if (domain && Number.isFinite(y)) {
      const t = (y - domain.min) / (domain.max - domain.min);
      const clampedT = Math.min(Math.max(t, 0), 1);
      cyPx = chartSettings.margin.top + (1 - clampedT) * plotInnerHeight;
    }
    // 값이 더 큰(=위) 라벨은 위로(-), 작은 라벨은 아래로(+) 분산하는 기존 방향 규칙 유지.
    const isTop =
      directLineLabels.length <= 1 ||
      (Number(directLabelYs[labelIndex]) === directLabelMaxY &&
        labelIndex === directLabelYs.indexOf(directLabelMaxY));
    const preferredDy = isTop ? -DIRECT_LABEL_SPREAD : DIRECT_LABEL_SPREAD;
    const clampedDy = clampLabelDy(item, preferredDy);
    return { labelIndex, cyPx, targetPx: cyPx + clampedDy, isTop };
  });

  // 플롯 상/하단 경계 안으로 목표 픽셀 y를 가두는 도우미(라벨 반높이만큼 여유를 둔다).
  const plotTopBound = chartSettings.margin.top + LABEL_HALF_HEIGHT;
  const plotBottomBound = chartSettings.margin.top + plotInnerHeight - LABEL_HALF_HEIGHT;
  const clampPx = (px: number): number =>
    Math.min(Math.max(px, plotTopBound), Math.max(plotBottomBound, plotTopBound));

  // 라벨 2개일 때만 간격 확보가 의미 있다.
  if (labelPixelInfo.length === 2) {
    const [a, b] = labelPixelInfo;
    const upper = a.targetPx <= b.targetPx ? a : b; // 화면상 더 위(px 작음)
    const lower = a.targetPx <= b.targetPx ? b : a;
    const gap = lower.targetPx - upper.targetPx;
    if (gap < MIN_LABEL_GAP) {
      const push = (MIN_LABEL_GAP - gap) / 2;
      upper.targetPx = clampPx(upper.targetPx - push);
      lower.targetPx = clampPx(lower.targetPx + push);
      // 클램프로 간격이 다시 줄었으면(한쪽이 경계에 닿음) 반대쪽을 더 밀어 간격을 맞춘다.
      const newGap = lower.targetPx - upper.targetPx;
      if (newGap < MIN_LABEL_GAP) {
        const deficit = MIN_LABEL_GAP - newGap;
        if (upper.targetPx > plotTopBound) upper.targetPx = clampPx(upper.targetPx - deficit);
        else lower.targetPx = clampPx(lower.targetPx + deficit);
      }
    }
  }
  // labelIndex → 최종 dy(px) 매핑(렌더에서 즉시 참조).
  const labelDyByIndex = new Map<number, number>(
    labelPixelInfo.map((info) => [info.labelIndex, info.targetPx - info.cyPx]),
  );

  // A2: 이중축 + 직접라벨이 동시에 있으면 우측 끝라벨이 우측 Y축 눈금/경계를 침범한다.
  // chart-settings.ts는 다른 에이전트와 충돌하므로 건드리지 않고, 이 파일 지역 상수로
  // 우측 여백을 추가 확보한다(이중축이며 직접라벨이 있을 때만 적용).
  // C2→D1: 40→64px로 키워 좌축 시리즈의 우측 끝라벨이 우축 눈금/경계를 침범하지 않도록
  //     오른쪽 여백을 더 확보한다(이중축이며 직접라벨이 있을 때만 적용).
  //     라벨을 우축 눈금 숫자보다 더 바깥으로 밀어내 숫자 겹침을 줄인다.
  const DUAL_AXIS_LABEL_EXTRA_RIGHT = 64;
  const computedMargin = {
    top: chartSettings.margin.top,
    right:
      chartSettings.margin.right +
      (hasSecondaryYAxis ? chartSettings.dualAxis.extraRightMargin : 0) +
      (directLineLabels.length ? chartSettings.directLabels.extraRightMargin : 0) +
      (hasSecondaryYAxis && directLineLabels.length ? DUAL_AXIS_LABEL_EXTRA_RIGHT : 0),
    // 이중축에서 하단 범례를 켜면 X축 라벨과 겹치지 않게 하단 여백을 추가 확보한다.
    bottom: chartSettings.margin.bottom + (showBottomLegend ? chartSettings.legend.extraBottomMargin : 0),
    left: chartSettings.margin.left,
  };

  return (
    <ResponsiveContainer width={width} height={height}>
      <ComposedChart data={chartData} margin={computedMargin}>
        <CartesianGrid {...styles.grid} />

        <XAxis
          dataKey="x"
          {...styles.xAxis}
          // [회전] 카테고리 라벨이 7개 이상(분기·기업명 등)이면 -45도 회전해 겹침 방지.
          //  회전 시 interval=0으로 모든 라벨을 표시(솎으면 기업/분기명이 사라지므로).
          interval={
            chartData.length > 6
              ? 0
              : visibleXTicks
                ? 0
                : Math.ceil(chartData.length / maxVisibleXLabels)
          }
          ticks={chartData.length > 6 ? undefined : visibleXTicks}
          tickFormatter={formatAxisTickLabel}
          height={chartData.length > 6 ? 92 : undefined}
          tickMargin={chartData.length > 6 ? 14 : undefined}
          tick={
            chartData.length > 6
              ? {
                  ...(typeof styles.xAxis.tick === "object" ? styles.xAxis.tick : {}),
                  angle: -45,
                  textAnchor: "end",
                }
              : styles.xAxis.tick
          }
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

        <YAxis
          yAxisId="left"
          width={chartSettings.yAxis.width}
          {...styles.yAxis}
          tickFormatter={(value) =>
            formatValueWithUnit(
              Number(value),
              // 눈금에는 짧은 단위만(인덱스 기준표현 '2020=100' 등은 축 라벨에만): A1
              getTickUnit(
                analysis.structure.yAxis.unit || "",
                analysis.structure.yAxis.label || "",
              ),
              getAxisFractionDigits(
                analysis.structure.yAxis.min,
                analysis.structure.yAxis.max,
                analysis.structure.yAxis.tickValues,
              ),
            )
          }
          label={{
            value: formatAxisLabel(analysis.structure.yAxis.label, analysis.structure.yAxis.unit),
            position: "insideTopLeft",
            offset: 0,
            dy: -28,
            fill: colors.textTertiary,
            fontSize: 16,
            fontWeight: 800,
            fontFamily: theme.typography.fontFamily.sans,
          }}
          // 수정1(D2): nice-tick을 직접 줄 때는 그 눈금의 [min,max]를 도메인으로 맞춰
          // 음수 하한을 포함(데이터 클리핑 방지). 밴드/전망·nice-tick 없음이면 기존 동작 유지.
          domain={leftAxisDomain}
          // D2: nice-round 균등 눈금이 있으면 그걸로, 없으면 기존 자동 눈금(tickCount=6)
          ticks={leftAxisTicks}
          tickCount={leftAxisTicks ? undefined : 6}
        />

        {hasSecondaryYAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            width={chartSettings.yAxis.rightWidth}
            {...styles.yAxis}
            tickFormatter={(value) => {
              const secondary = analysis.structure.secondaryYAxis!;
              return formatValueWithUnit(
                Number(value),
                // 우축 눈금 단위도 짧은 단위만 통과(A1)
                getTickUnit(secondary.unit || "", secondary.label || ""),
                getAxisFractionDigits(secondary.min, secondary.max, secondary.tickValues),
              );
            }}
            // 수정1(D2): 우축도 nice-tick이 있으면 그 [min,max]를 도메인으로 사용(클리핑 방지).
            domain={rightAxisDomain}
            // D2: 우축도 nice-round 균등 눈금 우선, 없으면 자동 눈금
            ticks={rightAxisTicks}
            tickCount={rightAxisTicks ? undefined : 6}
            label={{
              value: formatAxisLabel(
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

        <Tooltip
          {...styles.tooltip}
          formatter={(value, name) => [
            formatValueWithUnit(
              Number(value),
              getSeriesUnit(seriesList.findIndex((series) => series.name === String(name))),
              0,
            ),
            name,
          ]}
          labelFormatter={(label) => formatAxisTickLabel(label as string | number)}
        />

        {/* 하단 범례 — 이중축(우측 Y축 존재)일 때만 켠다.
            → 이중축에서는 인라인 끝라벨을 끄는 대신(겹침 구조적 해소) 범례로 시리즈를 식별한다.
              스타일은 TossLineChart의 범례와 동일하게 맞춘다(하단, 폰트 16px). */}
        {showBottomLegend && (
          <Legend
            wrapperStyle={{
              fontFamily: theme.typography.fontFamily.sans,
              fontSize: "16px",
              fontWeight: 700,
              color: colors.textSecondary,
              paddingTop: 12,
            }}
            formatter={(value) => (
              <span style={{ color: colors.textSecondary, fontWeight: 600 }}>{value}</span>
            )}
          />
        )}

        {/* 하이라이트 구간(배경 밴드) — 시리즈보다 먼저 그려 뒤에 깔리게 한다.
            → 좌측 축(yAxisId="left") 도메인 전체를 덮는다. zones가 없으면 아무것도 렌더되지 않으므로
              기존 콤보 차트(밴드 없음)에는 영향이 없다. */}
        {analysis.emphasis.highlightZones?.map((zone, i) => (
          <ReferenceArea
            key={`zone-${i}`}
            yAxisId="left"
            x1={String(zone.fromX)}
            x2={String(zone.toX)}
            // 수정1: 밴드 음영은 좌축 도메인 전체를 덮는다(nice-tick 적용 시 그 [min,max]와 일치).
            y1={leftAxisDomain[0]}
            y2={leftAxisDomain[1]}
            fill={zone.color || colors.accentSubtle}
            fillOpacity={chartSettings.highlightZone.opacity}
            strokeOpacity={0}
            label={
              zone.label
                ? {
                  value: zone.label,
                  position: "insideTopLeft",
                  fill: colors.textTertiary,
                  fontSize: chartSettings.highlightZone.labelFontSize,
                  fontWeight: 800,
                  fontFamily: theme.typography.fontFamily.sans,
                }
                : undefined
            }
          />
        ))}

        {seriesList.map((series, index) => {
          const color = getSeriesColor(index);
          const roleStyle =
            series.role === "secondary"
              ? chartSettings.seriesRole.secondary
              : chartSettings.seriesRole.primary;

          // D5: 명시적 "bar"는 반드시 Bar로 렌더(누락은 line, area도 line 폴백).
          if (getRenderAs(series) === "bar") {
            return (
              <Bar
                key={series.name}
                dataKey={series.name}
                stackId={series.stackId}
                yAxisId={getYAxisId(index)}
                fill={color}
                fillOpacity={series.role === "secondary" ? 0.58 : 0.92}
                radius={[0, 0, 0, 0]}
                maxBarSize={48}
                isAnimationActive={animated}
                animationDuration={theme.animation.chartEntrance.duration}
              >
                {chartData.length <= 5 && (
                  <LabelList
                    dataKey={series.name}
                    position="top"
                    formatter={(value) =>
                      formatValueWithUnit(
                        Number(value ?? 0),
                        series.stackId ? "" : getSeriesUnit(index),
                        0,
                      )
                    }
                    style={{
                      fill: colors.textSecondary,
                      fontSize: series.stackId ? 14 : 18,
                      fontFamily: theme.typography.fontFamily.mono,
                      fontWeight: 800,
                    }}
                  />
                )}
              </Bar>
            );
          }

          return (
            <Line
              key={series.name}
              type="linear"
              dataKey={series.name}
              yAxisId={getYAxisId(index)}
              stroke={color}
              strokeWidth={roleStyle.strokeWidth}
              strokeOpacity={roleStyle.opacity}
              strokeLinecap={squareEdges ? "butt" : "round"}
              strokeLinejoin={squareEdges ? "miter" : "round"}
              // C1: dense 시계열이면 점마커를 끄고(false) 선만 그린다. 적으면 기존 dot 유지.
              dot={
                squareEdges || isDense
                  ? false
                  : {
                      r: series.role === "secondary" ? 3.2 : 3.8,
                      stroke: colors.surface,
                      strokeWidth: series.role === "secondary" ? 1.7 : 2,
                      fill: color,
                      fillOpacity: roleStyle.opacity,
                    }
              }
              activeDot={
                squareEdges
                  ? false
                  : { r: 6, stroke: colors.surface, strokeWidth: 3, fill: color }
              }
              connectNulls
              isAnimationActive={animated}
              animationDuration={theme.animation.chartEntrance.duration + index * 50}
            />
          );
        })}

        {directLineLabels.map((item, labelIndex) => {
          // A3: 끝라벨 단위는 눈금과 동일 정책으로 정제 — '2020=100' 같은 기준표현이
          //     숫자에 붙어 '상대강도 1062020=100'처럼 병합되는 것을 막는다.
          //     단위가 속한 축(좌/우)에 맞는 라벨을 넘겨 중복 단위도 제거되게 한다.
          const onRightAxis = getYAxisId(item.index) === "right";
          const axisLabelForUnit = onRightAxis
            ? analysis.structure.secondaryYAxis?.label || ""
            : analysis.structure.yAxis.label || "";
          const inlineUnit = getInlineLabelUnit(getSeriesUnit(item.index), axisLabelForUnit);
          // 수정2: 위에서 픽셀좌표 기준으로 "겹침 회피까지 끝낸" 최종 dy를 그대로 사용한다.
          //   (값 순서 분산 + 플롯 경계 클램프 + 두 라벨 최소간격 확보가 모두 반영된 값)
          const labelDy = labelDyByIndex.get(labelIndex) ?? 0;
          return (
            <ReferenceDot
              key={`direct-label-${item.series.name}`}
              yAxisId={getYAxisId(item.index)}
              x={String(item.point.x)}
              y={item.point.y}
              r={squareEdges ? 0 : chartSettings.directLabels.dotRadius}
              fill={item.color}
              stroke={colors.surface}
              strokeWidth={squareEdges ? 0 : 2.5}
              label={{
                value: `${item.series.name} ${formatValueWithUnit(item.point.y, inlineUnit, 0)}`,
                position: "right",
                offset: chartSettings.directLabels.offset,
                dy: labelDy,
                fill: item.color,
                fontSize: chartSettings.directLabels.fontSize,
                fontWeight: 900,
                fontFamily: theme.typography.fontFamily.sans,
              }}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
