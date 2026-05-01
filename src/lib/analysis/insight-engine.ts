/**
 * =====================================================
 * 인사이트 엔진 + 강조 플래너
 * =====================================================
 *
 * 이 파일은 Claude가 추출한 원시(raw) 분석 결과를
 * "시청자에게 직관적으로 전달 가능한" 형태로 가공합니다.
 *
 * 두 가지 핵심 역할:
 *
 * 1. 인사이트 랭킹 (Insight Ranking)
 *    → 수십 개의 패턴 중 "진짜 중요한 것"을 골라냄
 *    → "이걸 왜 봐야 하는데?" 질문에 답할 수 있는 것만 남김
 *
 * 2. 시각 강조 계획 (Emphasis Planning)
 *    → 중요한 인사이트를 차트 위에 "어떻게" 보여줄지 결정
 *    → 토스증권처럼 깔끔하면서도 핵심이 명확한 시각화
 *
 * 비유: Claude가 "원재료(데이터)"를 캐오면,
 *       이 엔진이 "요리(시각화)"를 해서 시청자에게 서빙하는 것
 */

import type {
  ChartAnalysis,
  PatternPoint,
  Annotation,
  HighlightZone,
  TrendLine,
  FocusPoint,
  ColorStrategy,
  Importance,
  ChartType,
} from "./schema";

// ─────────────────────────────────────────────
// 1. 인사이트 랭킹 시스템
// ─────────────────────────────────────────────

/**
 * 인사이트 점수 매기기
 *
 * 왜 필요한가?
 * → Claude가 찾아낸 패턴이 20개라면, 시청자에게 20개를 다 보여주면 안 됨
 * → "진짜 중요한 3~5개"만 골라야 시청자가 한눈에 파악 가능
 * → 이 함수가 각 패턴에 점수를 매겨서 순위를 정함
 *
 * 점수 기준:
 * - 변화 크기 (변동이 클수록 중요)
 * - 최근성 (최근 데이터일수록 중요)
 * - 독특함 (유일한 패턴일수록 중요)
 * - 행동 가능성 (시청자가 뭔가 할 수 있으면 중요)
 */
export interface ScoredInsight {
  /** 원본 패턴 포인트 */
  point: PatternPoint;
  /** 산출된 점수 (0~100) */
  score: number;
  /** 점수 산출 근거 */
  scoreBreakdown: {
    magnitudeScore: number; // 변화 크기 점수 (0~30)
    recencyScore: number; // 최근성 점수 (0~25)
    uniquenessScore: number; // 독특함 점수 (0~20)
    actionabilityScore: number; // 행동 가능성 점수 (0~15)
    narrativeScore: number; // 서사 기여도 점수 (0~10)
  };
}

/**
 * rankInsights
 *
 * 패턴 포인트들에 점수를 매기고 순위를 정합니다.
 *
 * @param analysis - 전체 차트 분석 결과
 * @returns 점수순으로 정렬된 인사이트 배열
 */
export function rankInsights(analysis: ChartAnalysis): ScoredInsight[] {
  const { patterns, statistics, data } = analysis;
  const allPoints = patterns.points;
  const totalDataPoints = data.totalDataPoints;

  const scored = allPoints.map((point) => {
    // ── 1. 변화 크기 점수 (0~30) ──
    // 데이터 범위 대비 이 포인트가 얼마나 극단적인지
    const range = statistics.summary.range || 1;
    const deviation = Math.abs(
      point.dataPoint.y - statistics.summary.average
    );
    const magnitudeScore = Math.min(30, (deviation / range) * 30);

    // ── 2. 최근성 점수 (0~25) ──
    // 시계열 데이터에서 최근 데이터일수록 높은 점수
    const dataPoints = data.series[0]?.data || [];
    const pointIndex = dataPoints.findIndex(
      (d) => String(d.x) === String(point.dataPoint.x)
    );
    const recencyRatio =
      pointIndex >= 0 ? pointIndex / Math.max(1, totalDataPoints - 1) : 0.5;
    const recencyScore = recencyRatio * 25;

    // ── 3. 독특함 점수 (0~20) ──
    // 같은 타입의 패턴이 적을수록 높은 점수
    const sameTypeCount = allPoints.filter(
      (p) => p.type === point.type
    ).length;
    const uniquenessScore = Math.max(0, 20 - (sameTypeCount - 1) * 5);

    // ── 4. 행동 가능성 점수 (0~15) ──
    // 시청자가 이 정보를 바탕으로 행동할 수 있는지
    const actionableTypes = [
      "inflection",
      "breakout",
      "breakdown",
      "crossover",
    ];
    const actionabilityScore = actionableTypes.includes(point.type) ? 15 : 5;

    // ── 5. 서사 기여도 점수 (0~10) ──
    // importance가 높을수록 서사에 더 기여
    const narrativeMap: Record<Importance, number> = {
      critical: 10,
      high: 7,
      medium: 3,
    };
    const narrativeScore = narrativeMap[point.importance];

    const totalScore =
      magnitudeScore +
      recencyScore +
      uniquenessScore +
      actionabilityScore +
      narrativeScore;

    return {
      point,
      score: Math.round(totalScore * 10) / 10,
      scoreBreakdown: {
        magnitudeScore: Math.round(magnitudeScore * 10) / 10,
        recencyScore: Math.round(recencyScore * 10) / 10,
        uniquenessScore: Math.round(uniquenessScore * 10) / 10,
        actionabilityScore,
        narrativeScore,
      },
    };
  });

  // 점수 높은 순으로 정렬
  return scored.sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────
// 2. 시각 강조 플래너
// ─────────────────────────────────────────────

/**
 * planEmphasis
 *
 * 랭킹된 인사이트를 바탕으로 차트에 시각적으로 무엇을 어떻게
 * 강조할지 결정합니다.
 *
 * 토스증권 스타일의 핵심 원칙:
 * 1. Less is More — 적게 보여줘도 핵심이 명확
 * 2. 숫자가 주인공 — 장식이 아니라 수치가 시선을 끌어야 함
 * 3. 색상의 절제 — 의미 있는 곳에만 색상 변화
 * 4. 공간의 여유 — 빽빽하지 않고 숨 쉴 공간
 *
 * @param analysis - 전체 차트 분석 결과
 * @param rankedInsights - 랭킹된 인사이트
 * @param density - 정보 밀도 수준
 * @returns 어노테이션, 하이라이트, 추세선 등의 계획
 */
export function planEmphasis(
  analysis: ChartAnalysis,
  rankedInsights: ScoredInsight[],
  density: "minimal" | "balanced" | "detailed" = "balanced"
) {
  // 밀도에 따른 최대 어노테이션 수
  const maxAnnotations = { minimal: 2, balanced: 5, detailed: 12 };
  const maxHighlightZones = { minimal: 0, balanced: 2, detailed: 4 };
  const maxTrendLines = { minimal: 0, balanced: 1, detailed: 3 };

  const limit = maxAnnotations[density];
  const topInsights = rankedInsights.slice(0, limit);

  // ── 어노테이션 생성 ──
  const annotations: Annotation[] = topInsights.map((insight, index) => {
    const point = insight.point;

    // 패턴 타입에 따라 어노테이션 타입 결정
    const annotationType = getAnnotationType(point.type);
    // 패턴 타입에 따라 스타일 결정
    const annotationStyle = getAnnotationStyle(point.type);

    // 표시할 텍스트 결정
    const displayText = formatAnnotationText(point, analysis);

    return {
      type: annotationType,
      position: { x: point.dataPoint.x, y: point.dataPoint.y },
      text: displayText,
      style: annotationStyle,
      importance: index < 3 ? point.importance : ("medium" as Importance),
    };
  });

  // ── 하이라이트 구간 생성 ──
  const highlightZones: HighlightZone[] = generateHighlightZones(
    analysis,
    rankedInsights,
    maxHighlightZones[density]
  );

  // ── 추세선 생성 ──
  const trendLines: TrendLine[] = generateTrendLines(
    analysis,
    maxTrendLines[density]
  );

  // ── 포커스 포인트 결정 ──
  const focusPoint: FocusPoint = determineFocusPoint(
    analysis,
    rankedInsights
  );

  // ── 색상 전략 결정 ──
  const colorStrategy: ColorStrategy = determineColorStrategy(
    analysis.structure.chartType
  );

  return {
    annotations,
    highlightZones,
    trendLines,
    focusPoint,
    colorStrategy,
    densityLevel: density,
  };
}

// ─────────────────────────────────────────────
// 보조 함수들
// ─────────────────────────────────────────────

/**
 * 패턴 타입 → 어노테이션 타입 매핑
 *
 * 왜 이 매핑이 필요한가?
 * → "추세전환점"은 화살표로 보여주는 게 직관적
 * → "최고점"은 포인트 라벨로 수치를 보여주는 게 직관적
 * → 즉, 패턴의 성격에 맞는 시각화 방식을 자동 선택
 */
function getAnnotationType(
  patternType: PatternPoint["type"]
): Annotation["type"] {
  const mapping: Record<PatternPoint["type"], Annotation["type"]> = {
    inflection: "arrow",
    outlier: "callout",
    peak: "point_label",
    trough: "point_label",
    acceleration: "arrow",
    deceleration: "arrow",
    breakout: "badge",
    breakdown: "badge",
    gap: "range_highlight",
  };
  return mapping[patternType] || "point_label";
}

/**
 * 패턴 타입 → 스타일 매핑
 *
 * 색상으로 "좋은 것"과 "나쁜 것"을 직관적으로 구분
 * → 시청자가 색상만 보고도 긍정/부정을 알 수 있음
 */
function getAnnotationStyle(
  patternType: PatternPoint["type"]
): Annotation["style"] {
  const mapping: Record<PatternPoint["type"], Annotation["style"]> = {
    inflection: "emphasis",
    outlier: "warning",
    peak: "positive",
    trough: "negative",
    acceleration: "positive",
    deceleration: "warning",
    breakout: "positive",
    breakdown: "negative",
    gap: "warning",
  };
  return mapping[patternType] || "neutral";
}

/**
 * 어노테이션에 표시할 텍스트 생성
 *
 * 원칙: 짧고 명확하게. 숫자를 포함하되 맥락도 함께.
 * 나쁜 예: "최고점"
 * 좋은 예: "최고 52,400원 (+23%)"
 */
function formatAnnotationText(
  point: PatternPoint,
  analysis: ChartAnalysis
): string {
  const value = point.dataPoint.y;
  const unit = analysis.structure.yAxis.unit || "";
  const formattedValue = formatNumber(value) + unit;

  switch (point.type) {
    case "peak":
      return `최고 ${formattedValue}`;
    case "trough":
      return `최저 ${formattedValue}`;
    case "inflection":
      return `전환점 ${formattedValue}`;
    case "outlier":
      return `이상치 ${formattedValue}`;
    case "breakout":
      return `돌파 ${formattedValue}`;
    case "breakdown":
      return `이탈 ${formattedValue}`;
    case "acceleration":
      return `가속 시작`;
    case "deceleration":
      return `감속 시작`;
    case "gap":
      return `갭 발생`;
    default:
      return formattedValue;
  }
}

/**
 * 숫자 포맷 (한국식 쉼표 + 약어)
 *
 * 예:
 * 1234 → "1,234"
 * 1234567 → "123.5만"
 * 123456789 → "1.2억"
 */
export function formatNumber(num: number): string {
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1_0000_0000) {
    return sign + (abs / 1_0000_0000).toFixed(1) + "억";
  }
  if (abs >= 1_0000) {
    return sign + (abs / 1_0000).toFixed(1) + "만";
  }
  return sign + abs.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

/**
 * 하이라이트 구간 생성
 *
 * 연속된 상승/하락 구간이나 특별한 기간을 배경색으로 강조
 * → "이 기간에 뭔가 특별한 일이 있었다"를 시각적으로 전달
 */
function generateHighlightZones(
  analysis: ChartAnalysis,
  insights: ScoredInsight[],
  maxZones: number
): HighlightZone[] {
  if (maxZones === 0) return [];

  const zones: HighlightZone[] = [];
  const { changeRates } = analysis.statistics;

  // 가장 큰 변화가 있었던 기간을 하이라이트
  const significantChanges = changeRates
    .filter((cr) => Math.abs(cr.percentChange) > 10) // 10% 이상 변화만
    .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))
    .slice(0, maxZones);

  for (const change of significantChanges) {
    const isPositive = change.percentChange > 0;
    zones.push({
      fromX: change.period.split("→")[0]?.trim() || change.period,
      toX: change.period.split("→")[1]?.trim() || change.period,
      color: isPositive
        ? "rgba(255, 107, 107, 0.08)" // 상승: 연한 빨강
        : "rgba(77, 171, 247, 0.08)", // 하락: 연한 파랑
      label: `${isPositive ? "+" : ""}${change.percentChange.toFixed(1)}%`,
      description: `${change.period} 동안 ${Math.abs(change.percentChange).toFixed(1)}% ${isPositive ? "상승" : "하락"}`,
    });
  }

  return zones;
}

/**
 * 추세선 생성
 *
 * 전체 데이터의 방향을 보여주는 보조선
 * → 개별 데이터의 등락에 시선을 뺏기지 않고 큰 흐름을 파악하게 함
 */
function generateTrendLines(
  analysis: ChartAnalysis,
  maxLines: number
): TrendLine[] {
  if (maxLines === 0) return [];

  const lines: TrendLine[] = [];
  const firstSeries = analysis.data.series[0];
  if (!firstSeries || firstSeries.data.length < 2) return lines;

  const firstPoint = firstSeries.data[0];
  const lastPoint = firstSeries.data[firstSeries.data.length - 1];

  // 전체 추세선
  lines.push({
    from: { x: firstPoint.x, y: firstPoint.y },
    to: { x: lastPoint.x, y: lastPoint.y },
    style: "dashed",
    color: "rgba(255, 255, 255, 0.15)",
    label:
      analysis.statistics.trend.direction === "up" ||
      analysis.statistics.trend.direction === "strong_up"
        ? "상승 추세"
        : analysis.statistics.trend.direction === "down" ||
            analysis.statistics.trend.direction === "strong_down"
          ? "하락 추세"
          : "횡보",
  });

  // 평균선 (detailed일 때)
  if (maxLines > 1) {
    const avg = analysis.statistics.summary.average;
    lines.push({
      from: { x: firstPoint.x, y: avg },
      to: { x: lastPoint.x, y: avg },
      style: "dotted",
      color: "rgba(255, 255, 255, 0.1)",
      label: `평균 ${formatNumber(avg)}`,
    });
  }

  return lines.slice(0, maxLines);
}

/**
 * 포커스 포인트 결정
 *
 * 시청자가 차트를 처음 봤을 때 시선이 가야 할 "딱 한 곳"
 *
 * 우선순위:
 * 1. 가장 점수가 높은 인사이트 지점
 * 2. 그중에서도 최근 데이터 우선
 * 3. 시청자에게 가장 임팩트 있는 수치
 */
function determineFocusPoint(
  analysis: ChartAnalysis,
  rankedInsights: ScoredInsight[]
): FocusPoint {
  // 기본값: 가장 높은 점수의 인사이트
  if (rankedInsights.length > 0) {
    const top = rankedInsights[0];
    return {
      position: {
        x: top.point.dataPoint.x,
        y: top.point.dataPoint.y,
      },
      reason: top.point.reasoning,
      displayText: formatAnnotationText(top.point, analysis),
    };
  }

  // 인사이트가 없으면 마지막 데이터 포인트 (가장 최근)
  const lastSeries = analysis.data.series[0];
  const lastPoint = lastSeries?.data[lastSeries.data.length - 1];

  return {
    position: {
      x: lastPoint?.x || 0,
      y: lastPoint?.y || 0,
    },
    reason: "가장 최근 데이터 포인트",
    displayText: `현재 ${formatNumber(lastPoint?.y || 0)}`,
  };
}

/**
 * 색상 전략 결정
 *
 * 토스증권 스타일의 핵심:
 * - 상승 = 빨간계열 (한국 증시 컨벤션)
 * - 하락 = 파란계열
 * - 배경 = 진한 다크
 * - 강조 = 밝은 블루
 * - 보조 = 회색 계열
 *
 * 차트 종류에 따라 미세 조정:
 * - 도넛/파이: 구분을 위해 다양한 색상 사용
 * - 캔들: 양봉/음봉 색상이 핵심
 * - 일반: 주 색상 1개 + 보조 1~2개
 */
function determineColorStrategy(chartType: ChartType): ColorStrategy {
  // 기본 토스 스타일 팔레트
  const baseStrategy: ColorStrategy = {
    primary: "#58A6FF", // 메인 블루
    secondary: ["#8B949E", "#30363D"], // 보조 그레이
    positive: "#FF6B6B", // 상승 레드
    negative: "#4DABF7", // 하락 블루
    accent: "#58A6FF", // 강조 블루
    backgroundTone: "dark",
  };

  switch (chartType) {
    case "candle":
      // 캔들차트: 양봉/음봉이 핵심
      return {
        ...baseStrategy,
        primary: "#FF6B6B", // 양봉 빨강
        secondary: ["#4DABF7", "#8B949E"], // 음봉 파랑 + 보조
      };

    case "donut":
    case "pie":
    case "treemap":
      // 비율 차트: 구분을 위해 다양한 색상
      return {
        ...baseStrategy,
        primary: "#58A6FF",
        secondary: [
          "#FF6B6B",
          "#FBBF24",
          "#34D399",
          "#A78BFA",
          "#F472B6",
          "#8B949E",
        ],
      };

    case "bar":
    case "bar_horizontal":
    case "stacked_bar":
      // 막대차트: 하나의 강한 색상
      return {
        ...baseStrategy,
        primary: "#58A6FF",
        secondary: ["#3B82F6", "#1E40AF"],
      };

    default:
      return baseStrategy;
  }
}

// ─────────────────────────────────────────────
// 3. 분석 결과 후처리 (Post-Processing)
// ─────────────────────────────────────────────

/**
 * postProcessAnalysis
 *
 * Claude가 출력한 원시 분석 결과를 가공합니다.
 * - 인사이트 랭킹
 * - 시각 강조 계획 보강
 * - 서사 일관성 검증
 *
 * @param analysis - Claude가 출력한 원시 분석
 * @param density - 정보 밀도 수준
 * @returns 가공된 최종 분석
 */
export function postProcessAnalysis(
  analysis: ChartAnalysis,
  density: "minimal" | "balanced" | "detailed" = "balanced"
): ChartAnalysis & {
  rankedInsights: ScoredInsight[];
  refinedEmphasis: ReturnType<typeof planEmphasis>;
} {
  // 1. 인사이트 랭킹
  const rankedInsights = rankInsights(analysis);

  // 2. 시각 강조 계획 생성/보강
  const refinedEmphasis = planEmphasis(analysis, rankedInsights, density);

  // 3. emphasis 필드를 보강된 것으로 교체
  const processedAnalysis: ChartAnalysis = {
    ...analysis,
    emphasis: {
      ...analysis.emphasis,
      annotations: refinedEmphasis.annotations,
      highlightZones: refinedEmphasis.highlightZones,
      trendLines: refinedEmphasis.trendLines,
      focusPoint: refinedEmphasis.focusPoint,
      colorStrategy: refinedEmphasis.colorStrategy,
      densityLevel: density,
    },
  };

  return {
    ...processedAnalysis,
    rankedInsights,
    refinedEmphasis,
  };
}
