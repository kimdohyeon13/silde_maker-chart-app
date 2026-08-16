/**
 * 원본이 차트와 정밀 수치표를 한 화면에 함께 배치한 경우의 결합형 렌더러.
 * 표 데이터가 있는 차트에만 사용하며 기존 단일 차트 경로에는 영향을 주지 않는다.
 */

"use client";

import React from "react";
import type { ChartAnalysis, TableAnalysis } from "@/lib/analysis/schema";
import type { ThemeMode } from "@/lib/theme/toss-theme";
import { TossTable } from "@/components/tables";

interface TossChartTableProps {
  analysis: ChartAnalysis & { tableData: NonNullable<ChartAnalysis["tableData"]> };
  theme: ThemeMode;
  height: number;
}

function createTableAnalysis(
  analysis: TossChartTableProps["analysis"],
): TableAnalysis {
  return {
    ...analysis,
    contentType: "table",
    tableSubType: "financial",
    structure: {
      title: analysis.structure.title,
      subtitle: analysis.structure.subtitle,
      source: analysis.structure.source,
    },
    tableData: analysis.tableData,
  };
}

function findPointIndex(
  points: ChartAnalysis["data"]["series"][number]["data"],
  x: string | number,
): number {
  return points.findIndex((point) => String(point.x) === String(x));
}

function createPlotGeometry(analysis: ChartAnalysis, height: number) {
  const points = analysis.data.series[0]?.data ?? [];
  const width = 868;
  const margin = { top: 8, right: 48, bottom: 28, left: 8 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const yMin = analysis.structure.yAxis.min ?? 0;
  const yMax = analysis.structure.yAxis.max ?? Math.max(...points.map((point) => point.y));
  const xAt = (index: number) =>
    margin.left + (points.length <= 1 ? 0 : (plotWidth * index) / (points.length - 1));
  const yAt = (value: number) =>
    margin.top + ((yMax - value) / Math.max(1, yMax - yMin)) * plotHeight;
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xAt(index)} ${yAt(point.y)}`)
    .join(" ");
  const zone = analysis.emphasis.highlightZones[0];
  const zoneStart = zone ? findPointIndex(points, zone.fromX) : -1;
  const zoneEnd = zone ? findPointIndex(points, zone.toX) : -1;
  const halfStep = points.length > 1 ? plotWidth / (points.length - 1) / 2 : 0;
  const shadeX = zoneStart >= 0 ? Math.max(margin.left, xAt(zoneStart) - halfStep) : 0;
  const shadeWidth =
    zoneEnd >= zoneStart && zoneStart >= 0
      ? Math.min(margin.left + plotWidth, xAt(zoneEnd) + halfStep) - shadeX
      : 0;

  return {
    points,
    width,
    height,
    margin,
    plotWidth,
    plotHeight,
    xAt,
    yAt,
    path,
    shadeX,
    shadeWidth,
    shadeColor: zone?.color ?? "#F1F3F5",
  };
}

type PlotGeometry = ReturnType<typeof createPlotGeometry>;

function PlotGrid({
  geometry,
  yTicks,
}: {
  geometry: PlotGeometry;
  yTicks: number[];
}) {
  return yTicks.map((tick) => (
    <g key={tick}>
      <line
        x1={geometry.margin.left}
        x2={geometry.margin.left + geometry.plotWidth}
        y1={geometry.yAt(tick)}
        y2={geometry.yAt(tick)}
        stroke="#D7DCE2"
        strokeWidth={1}
      />
      <text
        x={geometry.width - 2}
        y={geometry.yAt(tick) + 4}
        textAnchor="end"
        fill="#525866"
        fontFamily="Paperlogy, sans-serif"
        fontSize={10}
        fontWeight={500}
      >
        {tick.toFixed(2)}
      </text>
    </g>
  ));
}

function PlotXAxis({
  geometry,
  xTicks,
  displayTicks,
}: {
  geometry: PlotGeometry;
  xTicks: string[];
  displayTicks: string[];
}) {
  return xTicks.map((tick, index) => {
    const pointIndex = findPointIndex(geometry.points, tick);
    if (pointIndex < 0) return null;
    return (
      <g key={tick}>
        <line
          x1={geometry.xAt(pointIndex)}
          x2={geometry.xAt(pointIndex)}
          y1={geometry.margin.top + geometry.plotHeight}
          y2={geometry.margin.top + geometry.plotHeight + 7}
          stroke="#C7CDD4"
          strokeWidth={1}
        />
        <text
          x={geometry.xAt(pointIndex)}
          y={geometry.height - 4}
          textAnchor="middle"
          fill="#525866"
          fontFamily="Paperlogy, sans-serif"
          fontSize={10}
          fontWeight={500}
        >
          {displayTicks[index] ?? tick}
        </text>
      </g>
    );
  });
}

function CompactLinePlot({
  analysis,
  height,
}: {
  analysis: ChartAnalysis;
  height: number;
}) {
  const geometry = createPlotGeometry(analysis, height);
  const yTicks = analysis.structure.yAxis.tickValues.map(Number);
  const xTicks = analysis.structure.xAxis.tickValues;
  const displayTicks = analysis.structure.xAxis.displayTickValues ?? xTicks;

  return (
    <svg
      data-compact-line-plot
      data-point-count={geometry.points.length}
      viewBox={`0 0 ${geometry.width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={analysis.structure.title}
      style={{ display: "block", overflow: "visible" }}
    >
      {geometry.shadeWidth > 0 && (
        <rect
          x={geometry.shadeX}
          y={geometry.margin.top}
          width={geometry.shadeWidth}
          height={geometry.plotHeight}
          fill={geometry.shadeColor}
        />
      )}
      <PlotGrid geometry={geometry} yTicks={yTicks} />
      <PlotXAxis
        geometry={geometry}
        xTicks={xTicks}
        displayTicks={displayTicks}
      />
      <path
        d={geometry.path}
        fill="none"
        stroke={analysis.structure.legend[0]?.remakeColor ?? "#4B5563"}
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function TossChartTable({
  analysis,
  theme,
  height,
}: TossChartTableProps) {
  const chartHeight = analysis.chartTableOptions?.chartHeight ?? Math.round(height * 0.44);
  const gap = analysis.chartTableOptions?.gap ?? 4;
  const tableAnalysis = createTableAnalysis(analysis);

  return (
    <div
      data-chart-table
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        height,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div data-chart-panel style={{ flex: `0 0 ${chartHeight}px`, minHeight: 0 }}>
        <CompactLinePlot analysis={analysis} height={chartHeight} />
      </div>
      <div data-table-panel style={{ flex: "1 1 auto", minHeight: 0 }}>
        <TossTable analysis={tableAnalysis} theme={theme} />
      </div>
    </div>
  );
}
