import type { DataSeries } from "./analysis/schema";

export type HorizontalSeriesDatum = {
  name: string;
  /** 단일 시리즈에서 막대별 색을 다르게 줄 때 쓴다(예: 진영 구분). */
  __pointColor?: string;
  [seriesName: string]: string | number | undefined;
};

/**
 * 가로 막대 차트의 여러 시리즈를 카테고리별 행 구조로 합칩니다.
 * 첫 등장 순서를 유지하고, 특정 시리즈에 값이 없으면 0으로 채웁니다.
 */
export function buildHorizontalSeriesData(
  seriesList: readonly DataSeries[],
  displayLabels: ReadonlyMap<string, string> = new Map(),
): HorizontalSeriesDatum[] {
  const categories = Array.from(
    new Set(
      seriesList.flatMap((series) =>
        series.data.map((point) => String(point.x)),
      ),
    ),
  );

  return categories.map((name) => {
    const row: HorizontalSeriesDatum = { name: displayLabels.get(name) ?? name };

    seriesList.forEach((series) => {
      const found = series.data.find((point) => String(point.x) === name);
      row[series.name] = found?.y ?? 0;
      row[`${series.name}__label`] = found?.displayLabel ?? "";
      const declared = (found as typeof found & { color?: string })?.color;
      if (declared && seriesList.length === 1) row.__pointColor = declared;
    });

    return row;
  });
}
