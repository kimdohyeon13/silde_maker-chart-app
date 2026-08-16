import type { DataSeries } from "./analysis/schema";

export type HorizontalSeriesDatum = {
  name: string;
  [seriesName: string]: string | number;
};

/**
 * 가로 막대 차트의 여러 시리즈를 카테고리별 행 구조로 합칩니다.
 * 첫 등장 순서를 유지하고, 특정 시리즈에 값이 없으면 0으로 채웁니다.
 */
export function buildHorizontalSeriesData(
  seriesList: readonly DataSeries[],
): HorizontalSeriesDatum[] {
  const categories = Array.from(
    new Set(
      seriesList.flatMap((series) =>
        series.data.map((point) => String(point.x)),
      ),
    ),
  );

  return categories.map((name) => {
    const row: HorizontalSeriesDatum = { name };

    seriesList.forEach((series) => {
      row[series.name] =
        series.data.find((point) => String(point.x) === name)?.y ?? 0;
    });

    return row;
  });
}
