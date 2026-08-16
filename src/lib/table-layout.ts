export interface AdaptiveTableRowHeightInput {
  canvasHeight?: number;
  dataRowCount: number;
  groupRowCount: number;
  baseRowHeight: number;
  minRowHeight?: number;
  maxRowHeight?: number;
}

const DEFAULT_RESERVED_HEIGHT = 120;
const DEFAULT_GROUP_HEADER_HEIGHT = 21;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 고정 16:9 캔버스에서 표 아래 큰 빈 공간이 생기지 않도록 행 높이를 계산한다.
 * 제목과 출처 영역은 남기고, 표 머리글과 데이터 행이 남은 높이를 함께 나눠 쓴다.
 */
export function resolveAdaptiveTableRowHeight({
  canvasHeight,
  dataRowCount,
  groupRowCount,
  baseRowHeight,
  minRowHeight = baseRowHeight,
  maxRowHeight = 48,
}: AdaptiveTableRowHeightInput): number {
  if (!Number.isFinite(canvasHeight) || (canvasHeight ?? 0) <= 0 || dataRowCount <= 0) {
    return baseRowHeight;
  }

  const safeMin = Math.max(1, Math.round(minRowHeight));
  const safeMax = Math.max(safeMin, Math.round(maxRowHeight));
  const groupHeight = Math.max(0, groupRowCount) * DEFAULT_GROUP_HEADER_HEIGHT;
  const availableHeight = Math.max(
    0,
    Math.round(canvasHeight!) - DEFAULT_RESERVED_HEIGHT - groupHeight,
  );
  const rowSlots = Math.max(1, dataRowCount + 1);
  const fittedHeight = Math.floor(availableHeight / rowSlots);

  return clamp(fittedHeight, safeMin, safeMax);
}
