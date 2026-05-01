/**
 * =====================================================
 * TossCandleChart — 토스증권 스타일 캔들스틱 차트
 * =====================================================
 *
 * 주식 OHLC(시가/고가/저가/종가) 데이터에 사용됩니다.
 * TradingView의 lightweight-charts 라이브러리를 사용합니다.
 *
 * lightweight-charts란?
 * → TradingView(전 세계 1위 차트 플랫폼)가 만든 경량 차트 라이브러리
 * → 주식 차트에 특화되어 있어서 캔들차트가 매우 깔끔하게 나옴
 * → Recharts보다 주식 차트에 적합
 *
 * 토스 스타일 특징:
 * - 양봉(상승) = 빨간색, 음봉(하락) = 파란색
 * - 배경 격자선 최소화
 * - 호버 시 OHLC 수치 표시
 * - 지지/저항선 표시
 */

"use client";

import React, { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, type IChartApi, type CandlestickData, type Time } from "lightweight-charts";
import type { ChartAnalysis } from "@/lib/analysis/schema";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";

interface TossCandleChartProps {
  analysis: ChartAnalysis;
  theme?: ThemeMode;
  width?: number;
  height?: number;
}

function parseTimeValue(x: string | number): Time {
  const str = String(x);
  if (typeof x === "number") return x as unknown as Time;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str as Time;
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return (Math.floor(new Date(str).getTime() / 1000)) as unknown as Time;
  }
  if (/^\d{1,2}:\d{2}/.test(str)) {
    const parts = str.split(":").map(Number);
    const d = new Date("2026-03-24T00:00:00Z");
    d.setUTCHours(parts[0], parts[1], 0, 0);
    return (Math.floor(d.getTime() / 1000)) as unknown as Time;
  }
  return str as Time;
}

export default function TossCandleChart({
  analysis,
  theme: themeMode = "dark",
  width = 800,
  height = 400,
}: TossCandleChartProps) {
  /**
   * useRef란?
   * → React에서 DOM 요소(HTML 태그)를 직접 참조할 때 사용
   * → lightweight-charts는 캔버스에 직접 그리기 때문에
   *   "이 div에 차트를 그려라" 라고 알려줘야 함
   */
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const themeConfig = getTheme(themeMode);
  const { colors } = themeConfig;

  /**
   * useEffect란?
   * → 컴포넌트가 화면에 나타난 후(mount) 실행되는 코드
   * → 여기서는 "차트를 그리는" 작업을 실행
   * → 컴포넌트가 사라질 때(unmount) 차트도 정리(remove)
   */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // ── 1. 차트 생성 ──
    const chart = createChart(chartContainerRef.current, {
      width,
      height,
      layout: {
        background: { color: "transparent" },
        textColor: colors.axisLabel,
        fontFamily: themeConfig.typography.fontFamily.mono,
        fontSize: parseInt(themeConfig.typography.fontSize.axisLabel),
      },
      grid: {
        vertLines: { visible: false }, // 세로 격자선 숨김
        horzLines: {
          color: colors.gridLine,
          style: 2, // 점선
        },
      },
      crosshair: {
        vertLine: {
          color: colors.crosshair,
          width: 2,
          style: 2,
          labelBackgroundColor: colors.tooltipBg,
        },
        horzLine: {
          color: colors.crosshair,
          width: 2,
          style: 2,
          labelBackgroundColor: colors.tooltipBg,
        },
      },
      rightPriceScale: {
        borderColor: colors.axisLine,
        textColor: colors.axisLabel,
      },
      timeScale: {
        borderColor: colors.axisLine,
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    // ── 2. 캔들 시리즈 추가 ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.positive, // 양봉 색
      downColor: colors.negative, // 음봉 색
      wickUpColor: colors.positive, // 양봉 꼬리
      wickDownColor: colors.negative, // 음봉 꼬리
      borderVisible: false,
    });

    // 데이터 변환 (분석 결과 → lightweight-charts 형식)
    const firstSeries = analysis.data.series[0];
    if (firstSeries) {
      const candleData: CandlestickData[] = firstSeries.data
        .filter((point) => point.ohlc) // OHLC 데이터가 있는 포인트만
        .map((point) => ({
          time: parseTimeValue(point.x),
          open: point.ohlc!.open,
          high: point.ohlc!.high,
          low: point.ohlc!.low,
          close: point.ohlc!.close,
        }));

      if (candleData.length > 0) {
        candleSeries.setData(candleData);
      } else {
        // OHLC가 없으면 일반 데이터를 캔들로 변환 (시가=종가)
        const fallbackData: CandlestickData[] = firstSeries.data.map(
          (point, i) => {
            const prevY = i > 0 ? firstSeries.data[i - 1].y : point.y;
            return {
              time: parseTimeValue(point.x),
              open: prevY,
              high: Math.max(prevY, point.y) * 1.005,
              low: Math.min(prevY, point.y) * 0.995,
              close: point.y,
            };
          }
        );
        candleSeries.setData(fallbackData);
      }
    }

    // ── 3. 지지/저항선 표시 (겹침 방지: strong만, 최대 3개) ──
    /**
     * 왜 필터링하나?
     * → 지지/저항선이 5개 이상이면 라벨이 겹쳐서 못 읽음
     * → "strong"만 우선 표시, 없으면 전체에서 2개만
     * → 가격이 너무 가까운 선(8% 이내)은 제거
     */
    const allSR = analysis.patterns.supportResistance;
    const strongSR = allSR.filter((sr) => sr.strength === "strong");
    const srPool = strongSR.length >= 1 ? strongSR : allSR.slice(0, 2);
    const prices = firstSeries?.data.map((p) => p.ohlc?.high ?? p.y) ?? [100];
    const lows = firstSeries?.data.map((p) => p.ohlc?.low ?? p.y) ?? [0];
    const srRange = Math.max(...prices) - Math.min(...lows) || 1;
    const keptSR: typeof srPool = [];
    for (const sr of srPool) {
      const tooClose = keptSR.some(
        (ex) => Math.abs(sr.level - ex.level) / srRange < 0.08
      );
      if (!tooClose) keptSR.push(sr);
      if (keptSR.length >= 3) break;
    }
    for (const sr of keptSR) {
      candleSeries.createPriceLine({
        price: sr.level,
        color: sr.type === "support" ? `${colors.positive}66` : `${colors.negative}66`,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: sr.type === "support"
          ? `지지 ${sr.level.toLocaleString()}`
          : `저항 ${sr.level.toLocaleString()}`,
      });
    }

    // ── 4. 차트를 데이터에 맞게 자동 크기 조절 ──
    chart.timeScale().fitContent();

    // ── 5. 정리 함수 (컴포넌트 언마운트 시) ──
    return () => {
      chart.remove();
    };
  }, [analysis, themeMode, width, height, colors, themeConfig]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        borderRadius: 8,
        overflow: "hidden",
      }}
    />
  );
}
