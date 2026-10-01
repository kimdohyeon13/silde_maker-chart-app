/**
 * =====================================================
 * 축 라벨 배치 — Y축 폭과 X축 양끝 라벨 정렬
 * =====================================================
 *
 * 왜 필요한가?
 * → Y축 숫자 자리를 112px로 고정해 두면 "110" 같은 짧은 눈금에서 40px 넘게 논다.
 *   반대로 "1,972 B" 같은 긴 눈금은 오히려 잘린다.
 * → X축 첫 라벨은 plot 왼쪽 끝에 가운데 정렬돼 Y축 마지막 눈금과 겹친다.
 *   마지막 라벨도 같은 이유로 오른쪽으로 삐져나간다.
 *
 * 여기서는 계산만 한다. 실제 그리기는 각 차트 컴포넌트가 한다.
 */

/** Y축 숫자 자리의 하한 — 이보다 좁으면 두 자리 숫자도 답답하다. */
export const MIN_Y_AXIS_WIDTH = 52;

/** Y축 숫자 자리의 상한 — 이보다 넓으면 plot이 지나치게 줄어든다. */
export const MAX_Y_AXIS_WIDTH = 132;

/**
 * Y축 제목("3개월 전 = 100", "십억 달러")이 plot 위쪽에 앉는 데 필요한 높이(px).
 * 이만큼을 상단 여백으로 확보하지 않으면 제목이 헤더 문장 위로 올라탄다.
 */
export const Y_AXIS_TITLE_TOP_SPACE = 40;

/** 눈금 글자와 plot 사이에 두는 최소 간격(px) */
const AXIS_LABEL_GAP = 12;

/**
 * 글자 하나가 차지하는 가로 폭을 글자 종류로 어림한다.
 * 브라우저 실측 대신 쓰는 근사치이므로 넉넉한 쪽으로 잡는다.
 */
function estimateCharWidth(character: string, fontSize: number): number {
  if (/\s/u.test(character)) return fontSize * 0.3;
  if (/[.,'’\-−]/u.test(character)) return fontSize * 0.34;
  if (/[0-9]/u.test(character)) return fontSize * 0.62;
  if (/[\u0000-\u024f]/u.test(character)) return fontSize * 0.56;
  return fontSize; // 한글·전각 기호
}

/** 눈금 문자열 하나가 차지할 가로 폭(px)을 어림한다. */
export function estimateTickLabelWidth(label: string, fontSize: number): number {
  return Array.from(label).reduce(
    (width, character) => width + estimateCharWidth(character, fontSize),
    0,
  );
}

/**
 * 실제로 그릴 Y축 눈금 문자열들로 축 폭을 정한다.
 *
 * 눈금을 아직 모르면(빈 배열) 상한을 돌려줘 잘림을 막는다.
 * 결과는 항상 [MIN, MAX] 안이다.
 */
export function resolveYAxisWidth(
  tickLabels: readonly string[],
  fontSize: number,
  fallbackWidth: number = MAX_Y_AXIS_WIDTH,
): number {
  const labels = tickLabels.filter((label) => typeof label === "string" && label.length > 0);
  if (labels.length === 0) {
    return Math.min(MAX_Y_AXIS_WIDTH, Math.max(MIN_Y_AXIS_WIDTH, Math.round(fallbackWidth)));
  }

  const widest = labels.reduce(
    (widest, label) => Math.max(widest, estimateTickLabelWidth(label, fontSize)),
    0,
  );

  return Math.min(
    MAX_Y_AXIS_WIDTH,
    Math.max(MIN_Y_AXIS_WIDTH, Math.ceil(widest + AXIS_LABEL_GAP)),
  );
}

/**
 * X축 라벨의 가로 정렬을 정한다.
 *
 * 첫 라벨은 왼쪽 끝에 붙이고(start), 마지막 라벨은 오른쪽 끝에 붙인다(end).
 * 가운데 정렬을 그대로 두면 첫 라벨이 Y축 눈금 위로 올라타고,
 * 마지막 라벨은 plot 밖으로 나간다.
 *
 * 라벨이 하나뿐이면 가운데 정렬을 유지한다.
 */
export function resolveEdgeTickAnchor(
  index: number,
  tickCount: number,
): "start" | "middle" | "end" {
  if (!Number.isFinite(index) || !Number.isFinite(tickCount) || tickCount <= 1) {
    return "middle";
  }

  if (index <= 0) return "start";
  if (index >= tickCount - 1) return "end";
  return "middle";
}
