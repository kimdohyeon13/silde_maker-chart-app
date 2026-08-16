/**
 * =====================================================
 * TossScatterChart — 토스증권 스타일 산점도/버블 차트
 * =====================================================
 *
 * 두 지표의 관계를 보여줄 때 사용합니다.
 * 예: 고점 대비 하락률과 목표가 상승여력, P/E와 EPS 성장률 등
 */

"use client";

import React from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  // recharts 3.8 좌표 변환 훅(데이터값 → 픽셀좌표). 차트 컨텍스트(ScatterChart) 안에서만 동작한다.
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
} from "recharts";
import type { ChartAnalysis, DataPoint } from "@/lib/analysis/schema";
import {
  getAnalysisStylePreset,
  getAnalysisThemeMode,
  getPresetColors,
  getPresetRechartsStyle,
} from "@/lib/style-presets";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";
import { chartSettings } from "@/lib/chart-settings";
import { getTickUnit, formatValueWithUnit, getAxisFractionDigits } from "@/lib/chart-format";

interface TossScatterChartProps {
  analysis: ChartAnalysis;
  theme?: ThemeMode;
  width?: number | `${number}%`;
  height?: number;
  animated?: boolean;
}

type LabelPosition = "top" | "bottom" | "left" | "right";

interface ScatterPoint {
  name: string;
  xValue: number;
  yValue: number;
  zValue: number;
  fill: string;
  labelPosition: LabelPosition;
  showLabel: boolean;
}

type ExtendedDataPoint = DataPoint & {
  label?: string;
  company?: string;
  z?: number;
  color?: string;
  labelPosition?: LabelPosition;
  showLabel?: boolean;
};

export default function TossScatterChart({
  analysis,
  theme: themeMode = "dark",
  width = "100%",
  height = 350,
  animated = true,
}: TossScatterChartProps) {
  const renderThemeMode = getAnalysisThemeMode(analysis, themeMode);
  const theme = getTheme(renderThemeMode);
  const preset = getAnalysisStylePreset(analysis);
  const styles = getPresetRechartsStyle(analysis, themeMode);
  const colors = getPresetColors(preset, renderThemeMode);

  const firstSeries = analysis.data.series[0];
  if (!firstSeries) return null;

  const chartData: ScatterPoint[] = firstSeries.data.map((point, index) => {
    const extended = point as ExtendedDataPoint;
    const legendColor = analysis.structure.legend[index]?.originalColor;

    return {
      name: extended.label ?? extended.company ?? String(point.x),
      xValue: Number(point.x),
      yValue: point.y,
      zValue: extended.z ?? 12,
      fill: extended.color ?? legendColor ?? colors.series[index % colors.series.length],
      labelPosition: extended.labelPosition ?? "top",
      showLabel: extended.showLabel !== false,
    };
  });

  const xAxisLabel = analysis.structure.xAxis.label;
  const yAxisLabel = analysis.structure.yAxis.label;
  const xMin = analysis.structure.xAxis.min;
  const xMax = analysis.structure.xAxis.max;
  const yMin = analysis.structure.yAxis.min;
  const yMax = analysis.structure.yAxis.max;

  // 축 단위를 "눈금에 붙여도 되는 짧은 단위"로 정제한다.
  // → %면 %가 붙고, 비었거나 긴/기준 단위면 빈 문자열(숫자만 표시)이 된다.
  //   덕분에 배수/포인트/연도 산점도에서 "2024%"처럼 잘못된 %가 붙지 않는다.
  const xTickUnit = getTickUnit(analysis.structure.xAxis.unit, xAxisLabel);
  const yTickUnit = getTickUnit(analysis.structure.yAxis.unit, yAxisLabel);
  // 축별 소수 자릿수(눈금 간격 기반). 산점도는 도메인 min/max만 알 수 있어 그것으로 추정.
  const xFractionDigits = getAxisFractionDigits(xMin, xMax);
  const yFractionDigits = getAxisFractionDigits(yMin, yMax);

  // 0 기준선 라벨: 단위가 '%'일 때만 "0%", 그 외에는 "0".
  const xZeroLabel = xTickUnit === "%" ? "0%" : "0";
  const yZeroLabel = yTickUnit === "%" ? "0%" : "0";

  const showXZeroLine =
    typeof xMin === "number" && typeof xMax === "number" && xMin < 0 && xMax > 0;
  const showYZeroLine =
    typeof yMin === "number" && typeof yMax === "number" && yMin < 0 && yMax > 0;

  // D7 수정: 두 0기준선이 동시에 그려질 때 '0%' 라벨이 2개(좌상단·중앙우측) 떠
  //          잡음처럼 보였다. 라벨 위치를 축 쪽으로 분리하고, 둘 다 켜질 때는
  //          한쪽(X 0선)은 라벨 없이 선만 그려 중복 표기를 없앤다.
  //          두 선은 원점에서 눈에 띄게 교차하므로 Y축 좌측 끝 라벨 하나로 0 기준이 충분히 전달된다.
  const showBothZeroLines = showXZeroLine && showYZeroLine;

  return (
    <ResponsiveContainer width={width} height={height}>
      <ScatterChart
        margin={{
          top: chartSettings.margin.top + 4,
          right: chartSettings.margin.right + 10,
          bottom: chartSettings.margin.bottom,
          left: chartSettings.margin.left,
        }}
      >
        <CartesianGrid {...styles.grid} />

        <XAxis
          type="number"
          dataKey="xValue"
          name={analysis.structure.xAxis.label}
          width={chartSettings.yAxis.width}
          {...styles.xAxis}
          domain={[
            analysis.structure.xAxis.min ?? "auto",
            analysis.structure.xAxis.max ?? "auto",
          ]}
          tickFormatter={(value) =>
            formatValueWithUnit(Number(value), xTickUnit, xFractionDigits)
          }
          tickCount={6}
        />

        <YAxis
          type="number"
          dataKey="yValue"
          name={analysis.structure.yAxis.label}
          width={chartSettings.yAxis.width}
          {...styles.yAxis}
          domain={[
            analysis.structure.yAxis.min ?? "auto",
            analysis.structure.yAxis.max ?? "auto",
          ]}
          tickFormatter={(value) =>
            formatValueWithUnit(Number(value), yTickUnit, yFractionDigits)
          }
          tickCount={6}
        />

        <ZAxis
          type="number"
          dataKey="zValue"
          range={analysis.structure.chartType === "bubble" ? [150, 520] : [180, 180]}
        />

        <Tooltip
          {...styles.tooltip}
          formatter={(value, name) => {
            // 툴팁은 축 단위를 그대로 반영한다(%면 %, 배수/포인트면 해당 단위, 없으면 숫자만).
            if (name === "xValue")
              return [
                formatValueWithUnit(Number(value), analysis.structure.xAxis.unit ?? "", xFractionDigits),
                xAxisLabel,
              ];
            if (name === "yValue")
              return [
                formatValueWithUnit(Number(value), analysis.structure.yAxis.unit ?? "", yFractionDigits),
                yAxisLabel,
              ];
            // 버블 크기(zValue)는 단위 없는 상대 크기값이라 숫자만 표시.
            if (name === "zValue") return [formatValueWithUnit(Number(value)), "버블 크기"];
            return [String(value), String(name)];
          }}
          labelFormatter={() => ""}
          cursor={{ stroke: colors.textTertiary, strokeDasharray: "4 4" }}
        />

        {showXZeroLine && (
          <ReferenceLine
            x={0}
            stroke={colors.border}
            strokeDasharray="6 6"
            // X축 0선(세로선): 라벨은 X축 근처(아래)에 둔다.
            // 단, 두 0선이 동시에 켜질 때는 라벨을 생략해 Y선 라벨과의 '0%' 중복을 없앤다.
            label={
              showBothZeroLines
                ? undefined
                : {
                    value: xZeroLabel,
                    position: "insideBottom",
                    fill: colors.textTertiary,
                    fontSize: 18,
                    fontWeight: 700,
                  }
            }
          />
        )}

        {showYZeroLine && (
          <ReferenceLine
            y={0}
            stroke={colors.border}
            strokeDasharray="6 6"
            // Y축 0선(가로선): 라벨은 Y축 쪽(좌측 끝)에 둔다 → X선 라벨과 위치가 명확히 분리된다.
            label={{
              value: yZeroLabel,
              position: "insideLeft",
              fill: colors.textTertiary,
              fontSize: 18,
              fontWeight: 700,
            }}
          />
        )}

        <Scatter
          name={firstSeries.name}
          data={chartData}
          fill={colors.accent}
          isAnimationActive={animated}
          animationDuration={theme.animation.chartEntrance.duration}
          animationEasing="ease-out"
        >
          {chartData.map((point) => (
            <Cell key={point.name} fill={point.fill} stroke={colors.surface} strokeWidth={3} />
          ))}
        </Scatter>

        {/*
          라벨 충돌 회피 레이어.
          ⚠️ recharts 3.x에서는 2.x의 <Customized>가 주던 xAxisMap/yAxisMap/offset props가
             더 이상 주입되지 않는다(타입 확인 완료: Customized.d.ts는 props 미주입, deprecated).
             대신 차트 컨텍스트 안에서 동작하는 훅(usePlotArea/useXAxisScale/useYAxisScale)을
             쓰는 게 3.x 정석이다. 그래서 LabelLayer를 ScatterChart의 자식으로 직접 렌더한다.
        */}
        <LabelLayer
          points={chartData}
          labelColor={colors.textPrimary}
          fontFamily={theme.typography.fontFamily.sans}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// =====================================================
// 라벨 충돌 회피 엔진 (그리디 배치 + 리더선 + 우선순위 생략)
// =====================================================

// 라벨 박스(픽셀 좌표계). x,y는 좌상단 모서리.
interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 배치 결과 1건: 어떤 점의 라벨이 어디에 놓였는지.
interface PlacedLabel {
  text: string;
  color: string;
  box: LabelBox;
  // 라벨이 매달린 원본 점의 픽셀 중심(리더선 시작점).
  px: number;
  py: number;
}

interface LabelLayerProps {
  points: ScatterPoint[];
  labelColor: string;
  fontFamily: string;
}

// 라벨 폰트 크기(px). 기존 21보다 작게 잡아 더 많은 라벨을 수용한다.
const LABEL_FONT_SIZE = 14;

// 후보 오프셋 단계(점에서 라벨 박스까지 띄우는 거리, px).
// 앞쪽(작은 값)부터 시도 → 가능한 한 점에 가깝게 붙인다.
// 뒤쪽 큰 값(48,64)은 밀집 클러스터에서 라벨을 여백 쪽으로 밀어내 수용률을 높이는 용도.
const OFFSET_STEPS = [6, 14, 24, 36, 48, 64] as const;

// 리더선을 그릴지 판단하는 임계 거리(px). 점과 라벨이 이보다 멀면 가는 선으로 연결.
const LEADER_THRESHOLD = 14;

// 박스끼리 빽빽하게 맞붙지 않도록 두는 최소 여유 간격(px).
// 충돌 판정 시 각 박스를 이 값만큼 사방으로 키워서 비교 → 살아남는 라벨끼리 최소 3px 틈이 생긴다.
const BOX_MARGIN = 3;

// 두 박스가 겹치는지(AABB 충돌 판정). 한 축이라도 분리되면 안 겹침.
// margin을 주면 박스를 사방으로 그만큼 부풀려서 판정한다(라벨이 너무 붙지 않게).
function boxesOverlap(a: LabelBox, b: LabelBox, margin = 0): boolean {
  return (
    a.x - margin < b.x + b.w &&
    a.x + a.w + margin > b.x &&
    a.y - margin < b.y + b.h &&
    a.y + a.h + margin > b.y
  );
}

// CJK(한글·한자·가나) 인식 폭 추정.
// 한글/한자/가나는 글자당 폭이 ≈ fontSize(전각, 1.0em)이고,
// 라틴·숫자·기호·공백은 ≈ fontSize * 0.55(반각)이다.
// 글자별로 폭을 합산해야 한글 라벨의 실제 폭을 과소평가하지 않는다.
//  (기존 length*fontSize*0.56은 한글을 좁게 계산해 충돌을 오판했다.)
const CJK_REGEX = /[ᄀ-ᇿ㄰-㆏가-힣぀-ヿ一-鿿＀-￯]/;

function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    width += CJK_REGEX.test(ch) ? fontSize * 1.0 : fontSize * 0.55;
  }
  return width;
}

// 박스가 플롯 영역(area) 안에 완전히 들어오는지.
function boxInside(box: LabelBox, area: { x: number; y: number; width: number; height: number }): boolean {
  return (
    box.x >= area.x &&
    box.y >= area.y &&
    box.x + box.w <= area.x + area.width &&
    box.y + box.h <= area.y + area.height
  );
}

function LabelLayer({ points, labelColor, fontFamily }: LabelLayerProps) {
  // 1) 플롯 영역과 축 scale 함수를 훅으로 얻는다.
  //    (recharts 3.8: 데이터값 → 픽셀좌표 변환. 차트 컨텍스트 밖이면 undefined.)
  const plotArea = usePlotArea();
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();

  // 아직 레이아웃이 계산되기 전(초기 렌더)이면 그리지 않는다.
  if (!plotArea || !xScale || !yScale) return null;

  // 2) 라벨 대상 점들의 픽셀 좌표 계산. scale이 undefined를 줄 수 있어(도메인 밖) 걸러낸다.
  const labeled = points
    .filter((p) => p.showLabel)
    .map((p) => {
      const px = xScale(p.xValue);
      const py = yScale(p.yValue);
      return { name: p.name, fill: p.fill, px, py };
    })
    .filter(
      (p): p is { name: string; fill: string; px: number; py: number } =>
        typeof p.px === "number" &&
        typeof p.py === "number" &&
        Number.isFinite(p.px) &&
        Number.isFinite(p.py),
    );

  if (labeled.length === 0) return null;

  // 3) 라벨 박스 크기 추정. 한글/영문 혼용이라 너비는 글자별 폭을 합산해 근사.
  //    w = CJK 인식 글자별 폭 합 + 좌우 패딩 6,  h = 폰트크기 * 1.25
  //    (한글은 1.0em, 라틴·숫자·기호는 0.55em으로 합산 → 한글 라벨 폭을 과소평가하지 않는다.)
  const labelSize = (text: string): { w: number; h: number } => ({
    w: estimateTextWidth(text, LABEL_FONT_SIZE) + 6,
    h: LABEL_FONT_SIZE * 1.25,
  });

  // 4) 우선순위: 모든 점의 픽셀 중심(centroid)을 구해, 중심에서 먼 점부터 정렬(내림차순).
  //    퍼져있는 중요한 점(이상치/주도주)이 먼저 자리를 잡아 살아남게 한다.
  //    ⚠️ 불변성: 원본 배열을 건드리지 않도록 복사본([...])을 정렬한다.
  const cx = labeled.reduce((sum, p) => sum + p.px, 0) / labeled.length;
  const cy = labeled.reduce((sum, p) => sum + p.py, 0) / labeled.length;
  const dist2 = (p: { px: number; py: number }) =>
    (p.px - cx) * (p.px - cx) + (p.py - cy) * (p.py - cy);
  const ordered = [...labeled].sort((a, b) => dist2(b) - dist2(a));

  // 5) 후보 위치(점 기준 상대 방향 8개: 우/좌/상/하 + 4개 대각).
  //    [dx, dy]는 단위 방향. 오프셋 단계와 곱해 실제 후보 박스를 만든다.
  //    박스 정렬: 방향에 따라 점을 기준으로 박스가 바깥쪽에 놓이도록 좌상단 좌표를 보정.
  const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
    [1, 0], // 우
    [-1, 0], // 좌
    [0, -1], // 상
    [0, 1], // 하
    [1, -1], // 우상
    [-1, -1], // 좌상
    [1, 1], // 우하
    [-1, 1], // 좌하
  ];

  // 한 점 + 방향 + 오프셋으로 라벨 박스의 좌상단 좌표를 만든다.
  const makeBox = (
    px: number,
    py: number,
    dx: number,
    dy: number,
    offset: number,
    w: number,
    h: number,
  ): LabelBox => {
    // 점에서 dir 방향으로 offset만큼 떨어진 '앵커' 좌표.
    const ax = px + dx * offset;
    const ay = py + dy * offset;
    // 앵커를 기준으로 박스가 그 방향 바깥에 놓이도록 좌상단(x,y) 계산.
    //  dx<0(좌)이면 박스 오른쪽 끝을 앵커에, dx>0(우)이면 왼쪽 끝을 앵커에, dx==0이면 가로 중앙정렬.
    const x = dx < 0 ? ax - w : dx > 0 ? ax : ax - w / 2;
    const y = dy < 0 ? ay - h : dy > 0 ? ay : ay - h / 2;
    return { x, y, w, h };
  };

  // 6) 그리디 배치: 우선순위 순회. 각 점에서 (플롯 안 + 기존 배치와 비충돌) 첫 후보를 채택.
  //    어떤 후보도 안 되면 그 라벨은 생략(겹쳐 그리지 않음) → 라벨끼리 절대 안 겹침 보장.
  const placed: PlacedLabel[] = [];

  for (const p of ordered) {
    const { w, h } = labelSize(p.name);
    let chosen: LabelBox | null = null;

    // 오프셋(가까운 것부터) × 방향 순으로 후보 탐색 → 가까이 붙는 자리를 우선.
    outer: for (const offset of OFFSET_STEPS) {
      for (const [dx, dy] of DIRECTIONS) {
        const box = makeBox(p.px, p.py, dx, dy, offset, w, h);
        if (!boxInside(box, plotArea)) continue;
        // 최소 여유 간격(BOX_MARGIN)을 둬서 라벨이 너무 빽빽하게 맞붙지 않게 한다.
        const collides = placed.some((q) => boxesOverlap(box, q.box, BOX_MARGIN));
        if (collides) continue;
        chosen = box;
        break outer;
      }
    }

    if (chosen) {
      placed.push({ text: p.name, color: p.fill, box: chosen, px: p.px, py: p.py });
    }
    // chosen이 null이면 생략(아무것도 push하지 않음).
  }

  // 7) 렌더: 리더선(필요 시) → 라벨 텍스트.
  return (
    <g style={{ pointerEvents: "none" }}>
      {placed.map((label, i) => {
        // 텍스트 그릴 기준점: 박스 좌하단 근처(baseline 보정). 박스 안에서 세로 중앙쯤에 오게 한다.
        const textX = label.box.x;
        const textY = label.box.y + label.box.h * 0.78;
        // 라벨 박스 중심(리더선 끝점 계산용).
        const boxCx = label.box.x + label.box.w / 2;
        const boxCy = label.box.y + label.box.h / 2;
        const gap = Math.hypot(boxCx - label.px, boxCy - label.py);
        const showLeader = gap > LEADER_THRESHOLD;

        return (
          <g key={`lbl-${i}-${label.text}`}>
            {showLeader && (
              // 가는 리더선: 점 → 라벨 박스 중심. 해당 점 색을 옅게(opacity 0.45) 써서
              // 밀집 클러스터에서도 '이 라벨이 어느 점의 것인지' 연결을 암시한다.
              <line
                x1={label.px}
                y1={label.py}
                x2={boxCx}
                y2={boxCy}
                stroke={label.color}
                strokeWidth={1}
                strokeOpacity={0.45}
              />
            )}
            <text
              x={textX}
              y={textY}
              fill={labelColor}
              fontSize={LABEL_FONT_SIZE}
              fontWeight={700}
              fontFamily={fontFamily}
            >
              {label.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
