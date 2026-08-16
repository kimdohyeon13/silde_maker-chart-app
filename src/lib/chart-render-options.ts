/**
 * 선 그래프의 면 채우기 표시 여부를 정합니다.
 *
 * 기본값은 기존 동작과 같습니다. 시리즈가 1~2개면 표시하고,
 * 3개 이상이면 겹침을 줄이기 위해 숨깁니다. 슬라이드별 옵션이
 * 명시되면 해당 값을 우선해 같은 데이터도 서로 다른 톤으로 표현할 수 있습니다.
 */
export function shouldShowAreaFill(
  seriesCount: number,
  requested?: boolean,
): boolean {
  return requested ?? seriesCount <= 2;
}

export type GridMode = "none" | "solid" | "dashed";

export function resolveDirectLabelVisibility(
  automatic: boolean,
  requested?: boolean,
): boolean {
  return requested ?? automatic;
}

export function resolveGridMode(requested?: GridMode): GridMode {
  return requested ?? "dashed";
}

export function resolveDirectLabelFractionDigits(
  automatic: number,
  requested?: number,
): number {
  if (requested == null || !Number.isFinite(requested)) return automatic;
  return Math.min(6, Math.max(0, Math.round(requested)));
}

export function shouldRenderTrendLine(label = "", showAll = false): boolean {
  return showAll || label.includes("평균");
}

/**
 * 최신값 가이드선은 장표별 명시 옵션으로만 켭니다.
 * 데이터가 없거나 직접 라벨이 꺼진 차트에서 의미 없는 기준선이 생기지 않도록
 * 주 시리즈 수와 라벨 표시 상태를 함께 확인합니다.
 */
export function shouldShowLatestGuide(
  eligibleSeriesCount: number,
  requested = false,
  hasDirectLabel = true,
): boolean {
  return requested && eligibleSeriesCount === 1 && hasDirectLabel;
}
