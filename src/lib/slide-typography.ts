/**
 * 새 슬라이드에 공통 적용하는 Paperlogy 타이포 위계.
 * 개별 JSON의 명시적 옵션은 사용자 예외 요청으로 보고 렌더 단계에서 우선한다.
 */
export const PAPERLOGY_FONT_STACK =
  '"Paperlogy", var(--font-noto-sans-kr), "Noto Sans KR", "Apple SD Gothic Neo", ui-sans-serif, system-ui, sans-serif';

export const DEFAULT_HEAD_MESSAGE_WEIGHT = 900;
export const DEFAULT_SUB_MESSAGE_WEIGHT = 300;

/**
 * JSON의 장표별 예외값을 검사한 뒤 서브메시지 굵기를 결정한다.
 * 잘못된 문자열·NaN·범위 밖 숫자는 CSS에 넘기지 않고 안전한 프리셋값으로 복구한다.
 */
export function resolveSubMessageWeight(
  explicitWeight: unknown,
  presetWeight = DEFAULT_SUB_MESSAGE_WEIGHT,
): number {
  const safePresetWeight =
    typeof presetWeight === "number" &&
    Number.isFinite(presetWeight) &&
    presetWeight >= 100 &&
    presetWeight <= 900
      ? presetWeight
      : DEFAULT_SUB_MESSAGE_WEIGHT;

  return typeof explicitWeight === "number" &&
    Number.isFinite(explicitWeight) &&
    explicitWeight >= 100 &&
    explicitWeight <= 900
    ? explicitWeight
    : safePresetWeight;
}
