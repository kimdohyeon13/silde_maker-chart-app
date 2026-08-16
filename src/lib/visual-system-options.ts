/**
 * 시각 프리셋의 안전한 기본값 위에 분석 JSON의 개별 옵션을 덮습니다.
 * `false`, `0`, 빈 문자열도 의도적인 override이므로 null 병합이 아니라 객체 병합을 씁니다.
 */
export function mergeOptionDefaults<T extends object>(
  defaults?: Partial<T>,
  overrides?: Partial<T>,
): T {
  return {
    ...defaults,
    ...overrides,
  } as T;
}

/** 표 옵션은 fontSize 묶음만 한 단계 더 깊게 병합합니다. */
export function mergeTableVisualDefaults<T extends { fontSize?: object }>(
  defaults?: Partial<T>,
  overrides?: Partial<T>,
): T {
  return {
    ...defaults,
    ...overrides,
    fontSize:
      defaults?.fontSize || overrides?.fontSize
        ? {
            ...defaults?.fontSize,
            ...overrides?.fontSize,
          }
        : undefined,
  } as T;
}
