/**
 * =====================================================
 * 데모 데이터 — 개발 및 테스트용 샘플 분석 결과
 * =====================================================
 *
 * 실제로 차트 이미지를 분석하기 전에,
 * 이 데모 데이터로 차트 렌더링이 제대로 되는지 확인합니다.
 *
 * 실제 사용 시에는:
 * 1. Claude Code 스킬이 이미지를 분석 → JSON 생성
 * 2. 이 JSON을 data/ 폴더에 저장
 * 3. Next.js 앱이 data/ 폴더의 JSON을 읽어서 렌더링
 */

import type { ChartAnalysis, TableAnalysis, InfographicAnalysis, VisualAnalysis } from "./analysis/schema";

/** 데모 1: 반도체 수출 추이 (선 차트) */
export const demoLineChart: ChartAnalysis = {
  id: "demo-line-001",
  sourceImage: "semiconductor_export.png",
  analyzedAt: new Date().toISOString(),

  structure: {
    chartType: "line",
    title: "한국 반도체 수출 추이",
    subtitle: "월별 수출액 (억 달러)",
    source: "한국무역협회",
    timeRange: "2022.01 ~ 2024.12",
    xAxis: {
      label: "월",
      type: "time",
      tickValues: ["22.01", "22.07", "23.01", "23.07", "24.01", "24.07", "24.12"],
      startsAtZero: true,
      isLogScale: false,
    },
    yAxis: {
      label: "수출액",
      type: "numeric",
      tickValues: ["40", "60", "80", "100", "120", "140"],
      unit: "억$",
      min: 40,
      max: 140,
      startsAtZero: false,
      isLogScale: false,
    },
    legend: [{ name: "반도체 수출", originalColor: "#4DABF7" }],
    axisDistortionWarning: "Y축이 40억$에서 시작합니다. 실제 변동폭보다 과장되어 보일 수 있습니다.",
  },

  data: {
    series: [
      {
        name: "반도체 수출",
        data: [
          { x: "22.01", y: 128, confidence: 0.9 },
          { x: "22.03", y: 131, confidence: 0.9 },
          { x: "22.05", y: 118, confidence: 0.85 },
          { x: "22.07", y: 105, confidence: 0.9 },
          { x: "22.09", y: 88, confidence: 0.9 },
          { x: "22.11", y: 72, confidence: 0.85 },
          { x: "23.01", y: 58, confidence: 0.9 },
          { x: "23.03", y: 52, confidence: 0.9 },
          { x: "23.05", y: 48, confidence: 0.85 },
          { x: "23.07", y: 55, confidence: 0.9 },
          { x: "23.09", y: 68, confidence: 0.9 },
          { x: "23.11", y: 82, confidence: 0.85 },
          { x: "24.01", y: 95, confidence: 0.9 },
          { x: "24.03", y: 108, confidence: 0.9 },
          { x: "24.05", y: 115, confidence: 0.85 },
          { x: "24.07", y: 125, confidence: 0.9 },
          { x: "24.09", y: 131, confidence: 0.9 },
          { x: "24.12", y: 138, confidence: 0.85 },
        ],
      },
    ],
    totalDataPoints: 18,
    quality: {
      overallConfidence: 0.88,
      missingPoints: 0,
      hardToReadAreas: [],
      readabilityScore: "good",
    },
  },

  statistics: {
    trend: {
      direction: "up",
      strength: 0.65,
      description: "V자 반등 후 우상향 추세",
      recentDirection: "accelerating_up",
    },
    volatility: {
      level: "high",
      coefficient: 0.32,
      description: "반도체 사이클에 따른 높은 변동성",
    },
    changeRates: [
      { period: "전체", percentChange: 7.8, absoluteChange: 10, from: 128, to: 138 },
      { period: "23.05→24.12", percentChange: 187.5, absoluteChange: 90, from: 48, to: 138 },
      { period: "22.01→23.05", percentChange: -62.5, absoluteChange: -80, from: 128, to: 48 },
    ],
    correlations: [],
    summary: {
      max: { value: 138, at: "24.12" },
      min: { value: 48, at: "23.05" },
      average: 95.4,
      median: 95,
      range: 90,
    },
  },

  patterns: {
    points: [
      {
        type: "trough",
        dataPoint: { x: "23.05", y: 48 },
        seriesName: "반도체 수출",
        description: "반도체 수출 바닥 — 48억$",
        importance: "critical",
        reasoning: "글로벌 메모리 재고 조정과 소비자 수요 둔화가 겹치며 역대급 저점 기록. 이후 AI 수요가 반등의 촉매가 됨.",
      },
      {
        type: "inflection",
        dataPoint: { x: "23.07", y: 55 },
        seriesName: "반도체 수출",
        description: "반등 시작점",
        importance: "high",
        reasoning: "ChatGPT 등 생성형 AI 붐으로 GPU/HBM 수요가 급증하며 반도체 수출이 반등 전환.",
      },
      {
        type: "peak",
        dataPoint: { x: "24.12", y: 138 },
        seriesName: "반도체 수출",
        description: "역대 최고 수출 — 138억$",
        importance: "critical",
        reasoning: "AI 데이터센터 투자 확대와 HBM3E 출하 본격화로 사상 최대 수출 달성. 22년 고점을 상회.",
      },
    ],
    crossovers: [],
    supportResistance: [],
    cyclicalPattern: "반도체 사이클(약 2~3년)에 따른 규칙적 등락 패턴",
  },

  narrative: {
    headline: "반도체 수출, AI 덕분에 바닥에서 3배 반등 — 역대 최고 138억$ 돌파",
    summary: "2023년 5월 48억 달러로 바닥을 찍은 한국 반도체 수출이 AI 수요 폭증에 힘입어 2024년 12월 138억 달러로 사상 최고치를 경신했다. 불과 19개월 만에 약 3배 반등한 것이다.",
    story: "2022년 초 호황기를 보내던 반도체 수출은 글로벌 재고 조정과 소비 위축으로 급격히 하락했다(기). 2023년 상반기 바닥권에서 업계는 감산과 구조조정을 단행했다(승). 그러던 중 ChatGPT로 대표되는 생성형 AI 붐이 터지면서 고성능 반도체 수요가 폭발했다(전). 결국 2024년 말 역대 최고치를 기록하며 반도체 강국의 면모를 재확인했다(결).",
    keyTakeaways: [
      "AI가 반도체 수출의 게임체인저 — 기존 PC/스마트폰 중심에서 데이터센터/AI로 수요 축이 이동",
      "V자 반등의 속도가 이례적 — 19개월 만에 약 3배, 역대 가장 빠른 회복",
      "HBM(고대역폭메모리)이 핵심 — 삼성전자·SK하이닉스의 HBM 매출이 반등을 주도",
    ],
    questionsRaised: [
      "AI 반도체 수요가 지속 가능한 것인가, 버블인가?",
      "중국 반도체 자급률 상승이 한국 수출에 미칠 영향은?",
      "2025년에도 이 성장세가 유지될 수 있을까?",
    ],
    viewerAction: "투자자라면 AI 반도체 밸류체인(HBM, 선단공정, 패키징) 관련 기업에 주목. 다만 사이클 고점 가능성도 열어두고 분산 투자 고려.",
    contextualNotes: [
      "2022년 하반기: 연준 급격한 금리 인상 → 글로벌 IT 투자 위축",
      "2023년 1월: ChatGPT 사용자 1억 돌파 → AI 반도체 수요 급증 시작",
      "2024년: NVIDIA H100/H200 수주 폭주, HBM3E 양산 본격화",
    ],
  },

  emphasis: {
    annotations: [
      {
        type: "point_label",
        position: { x: "23.05", y: 48 },
        text: "최저 48억$",
        style: "negative",
        importance: "critical",
      },
      {
        type: "point_label",
        position: { x: "24.12", y: 138 },
        text: "최고 138억$",
        style: "positive",
        importance: "critical",
      },
      {
        type: "badge",
        position: { x: "24.03", y: 108 },
        text: "+187%",
        style: "positive",
        importance: "high",
      },
    ],
    highlightZones: [
      {
        fromX: "23.05",
        toX: "24.12",
        color: "rgba(255, 107, 107, 0.06)",
        label: "AI 반등 구간",
        description: "바닥에서 역대 최고까지의 반등 구간",
      },
    ],
    trendLines: [
      {
        from: { x: "23.05", y: 48 },
        to: { x: "24.12", y: 138 },
        style: "dashed",
        color: "rgba(255, 255, 255, 0.12)",
        label: "반등 추세",
      },
    ],
    colorStrategy: {
      primary: "#58A6FF",
      secondary: ["#8B949E"],
      positive: "#FF6B6B",
      negative: "#4DABF7",
      accent: "#58A6FF",
      backgroundTone: "dark",
    },
    focusPoint: {
      position: { x: "24.12", y: 138 },
      reason: "역대 최고치 경신 — 가장 최근이자 가장 중요한 데이터 포인트",
      displayText: "138억$",
    },
    densityLevel: "balanced",
  },
};

/** 데모 2: 업종별 수익률 (막대 차트) */
export const demoBarChart: ChartAnalysis = {
  id: "demo-bar-001",
  sourceImage: "sector_returns.png",
  analyzedAt: new Date().toISOString(),

  structure: {
    chartType: "bar",
    title: "2024년 코스피 업종별 수익률",
    subtitle: "연초 대비 등락률 (%)",
    source: "한국거래소",
    timeRange: "2024.01.01 ~ 2024.12.31",
    xAxis: {
      label: "업종",
      type: "category",
      tickValues: ["반도체", "자동차", "바이오", "금융", "화학", "건설", "철강", "유통"],
      startsAtZero: true,
      isLogScale: false,
    },
    yAxis: {
      label: "수익률",
      type: "numeric",
      tickValues: ["-20", "-10", "0", "10", "20", "30", "40"],
      unit: "%",
      min: -20,
      max: 40,
      startsAtZero: true,
      isLogScale: false,
    },
    legend: [{ name: "수익률" }],
  },

  data: {
    series: [
      {
        name: "수익률",
        data: [
          { x: "반도체", y: 35.2, confidence: 0.95 },
          { x: "자동차", y: 18.7, confidence: 0.95 },
          { x: "바이오", y: 12.3, confidence: 0.9 },
          { x: "금융", y: 8.1, confidence: 0.95 },
          { x: "화학", y: -2.4, confidence: 0.9 },
          { x: "건설", y: -8.6, confidence: 0.9 },
          { x: "철강", y: -12.1, confidence: 0.9 },
          { x: "유통", y: -15.3, confidence: 0.85 },
        ],
      },
    ],
    totalDataPoints: 8,
    quality: {
      overallConfidence: 0.92,
      missingPoints: 0,
      hardToReadAreas: [],
      readabilityScore: "excellent",
    },
  },

  statistics: {
    trend: {
      direction: "sideways",
      strength: 0.3,
      description: "양극화 — 반도체/자동차 강세, 건설/철강 약세",
      recentDirection: "flat",
    },
    volatility: {
      level: "high",
      coefficient: 0.85,
      description: "업종 간 수익률 편차가 매우 큼 (50.5%p 차이)",
    },
    changeRates: [
      { period: "1위 vs 꼴찌", percentChange: 50.5, absoluteChange: 50.5, from: -15.3, to: 35.2 },
    ],
    correlations: [],
    summary: {
      max: { value: 35.2, at: "반도체" },
      min: { value: -15.3, at: "유통" },
      average: 4.5,
      median: 2.85,
      range: 50.5,
    },
  },

  patterns: {
    points: [
      {
        type: "peak",
        dataPoint: { x: "반도체", y: 35.2 },
        seriesName: "수익률",
        description: "반도체 업종 수익률 1위 — +35.2%",
        importance: "critical",
        reasoning: "AI 수요 폭발로 반도체 업종이 독보적 1위. 코스피 전체 수익률의 대부분을 견인.",
      },
      {
        type: "trough",
        dataPoint: { x: "유통", y: -15.3 },
        seriesName: "수익률",
        description: "유통 업종 최하위 — -15.3%",
        importance: "high",
        reasoning: "소비 심리 위축과 이커머스 경쟁 격화로 전통 유통 업종 부진 지속.",
      },
    ],
    crossovers: [],
    supportResistance: [],
  },

  narrative: {
    headline: "반도체 +35% vs 유통 -15% — 업종별 양극화 역대급",
    summary: "2024년 코스피는 반도체·자동차 중심으로 상승했으나, 건설·철강·유통은 두 자릿수 하락을 기록하며 역대급 양극화를 보였다.",
    story: "AI 수요에 힘입은 반도체 업종이 +35.2%로 압도적 1위를 차지한 반면, 내수 경기 부진의 직격탄을 맞은 유통(-15.3%)·철강(-12.1%)은 고전했다. 상위 4개 업종은 플러스, 하위 4개는 마이너스를 기록하며 '반도체 쏠림' 현상이 뚜렷했다.",
    keyTakeaways: [
      "업종 간 수익률 차이 50.5%p — 종목 선택보다 업종 선택이 수익을 결정한 해",
      "AI 관련 업종(반도체, 자동차-전장)이 시장을 주도",
      "내수 업종(유통, 건설)의 부진이 지속 — 소비 회복이 관건",
    ],
    questionsRaised: [
      "2025년에도 반도체 쏠림이 계속될까?",
      "내수 업종 반등의 트리거는 무엇인가?",
    ],
    viewerAction: "포트폴리오 점검: AI/수출 중심 업종 비중이 적절한지 확인. 하락 업종 중 반등 가능성이 있는 업종 선별적 접근 고려.",
    contextualNotes: [
      "2024년 코스피 지수 전체 수익률: +7.4%",
      "미국 S&P 500 수익률: +24.2% (비교 참고)",
    ],
  },

  emphasis: {
    annotations: [
      {
        type: "point_label",
        position: { x: "반도체", y: 35.2 },
        text: "+35.2%",
        style: "positive",
        importance: "critical",
      },
      {
        type: "point_label",
        position: { x: "유통", y: -15.3 },
        text: "-15.3%",
        style: "negative",
        importance: "critical",
      },
    ],
    highlightZones: [],
    trendLines: [],
    colorStrategy: {
      primary: "#58A6FF",
      secondary: ["#8B949E"],
      positive: "#FF6B6B",
      negative: "#4DABF7",
      accent: "#58A6FF",
      backgroundTone: "dark",
    },
    focusPoint: {
      position: { x: "반도체", y: 35.2 },
      reason: "가장 높은 수익률 — 시장의 핵심 테마인 AI를 대표",
      displayText: "+35.2%",
    },
    densityLevel: "balanced",
  },
};

/** 데모 3: 주요 반도체 기업 실적 비교 (표) */
export const demoTable: TableAnalysis = {
  id: "demo-table-001",
  sourceImage: "semiconductor_comparison.png",
  analyzedAt: new Date().toISOString(),
  contentType: "table",
  tableSubType: "comparison",
  structure: {
    title: "글로벌 반도체 기업 실적 비교",
    subtitle: "2024년 연간 실적 (단위: 조원)",
    source: "각사 사업보고서, Bloomberg",
  },
  tableData: {
    columns: [
      { key: "company", label: "기업명", dataType: "text", isRowHeader: true },
      { key: "revenue", label: "매출액", dataType: "currency", unit: "조원", align: "right" },
      { key: "operating", label: "영업이익", dataType: "currency", unit: "조원", align: "right" },
      { key: "margin", label: "영업이익률", dataType: "percent", align: "right" },
      { key: "yoy", label: "YoY 성장률", dataType: "percent", align: "right" },
    ],
    rows: [
      {
        cells: {
          company: { value: "삼성전자" },
          revenue: { value: 302, displayValue: "302" },
          operating: { value: 35.8, displayValue: "35.8" },
          margin: { value: 11.9, displayValue: "11.9%", highlight: "positive" },
          yoy: { value: 18.2, displayValue: "+18.2%", highlight: "positive", badge: "1위" },
        },
      },
      {
        cells: {
          company: { value: "SK하이닉스" },
          revenue: { value: 66.2, displayValue: "66.2" },
          operating: { value: 23.5, displayValue: "23.5" },
          margin: { value: 35.5, displayValue: "35.5%", highlight: "positive", badge: "최고" },
          yoy: { value: 142.3, displayValue: "+142.3%", highlight: "positive" },
        },
      },
      {
        cells: {
          company: { value: "TSMC" },
          revenue: { value: 126.4, displayValue: "126.4" },
          operating: { value: 57.8, displayValue: "57.8" },
          margin: { value: 45.7, displayValue: "45.7%", highlight: "positive" },
          yoy: { value: 26.3, displayValue: "+26.3%", highlight: "positive" },
        },
      },
      {
        cells: {
          company: { value: "인텔" },
          revenue: { value: 72.3, displayValue: "72.3" },
          operating: { value: -2.1, displayValue: "-2.1" },
          margin: { value: -2.9, displayValue: "-2.9%", highlight: "negative" },
          yoy: { value: -12.5, displayValue: "-12.5%", highlight: "negative" },
        },
      },
      {
        cells: {
          company: { value: "엔비디아" },
          revenue: { value: 95.3, displayValue: "95.3" },
          operating: { value: 58.2, displayValue: "58.2" },
          margin: { value: 61.1, displayValue: "61.1%", highlight: "positive", badge: "최고" },
          yoy: { value: 125.8, displayValue: "+125.8%", highlight: "positive" },
        },
      },
    ],
    hasTotalRow: false,
  },
  narrative: {
    headline: "엔비디아 영업이익률 61%, AI 수요가 수익성 판도를 바꾸다",
    summary: "2024년 글로벌 반도체 업계는 AI ��혜주와 비수혜주로 양극화가 심화���었다.",
    story: "엔비디아와 SK하이닉스가 AI 수요로 사상 최대 실적을 기록한 반면, 인텔은 파운드리 사업 부진으로 적자 전환했다.",
    keyTakeaways: [
      "엔비디아 영업이익률 61.1% — AI GPU 독점의 힘",
      "SK하이닉스 YoY +142% — HBM 수혜 극대화",
      "인텔 유일한 적자 — 파운드리 전환 비용 부담",
    ],
    questionsRaised: ["AI 반도체 수요가 2025년에도 지속될까?"],
    viewerAction: "HBM과 AI 가속기 밸��체인에 주목",
    contextualNotes: ["환율 효과로 한국 기업의 원화 기준 매출은 더 크게 증���"],
  },
  emphasis: {
    focusPoint: { displayText: "영업이익률 61.1%", reason: "엔비디아의 압도적 수익성" },
    colorStrategy: {
      primary: "#58A6FF",
      secondary: ["#FF6B6B", "#34D399"],
      positive: "#FF6B6B",
      negative: "#4DABF7",
      accent: "#58A6FF",
      backgroundTone: "dark",
    },
    densityLevel: "balanced",
    highlightCells: [
      { row: 4, col: "margin", reason: "최고 영업이익률" },
      { row: 3, col: "yoy", reason: "유일한 마이너스 성장" },
    ],
  },
};

/** 데모 4: 반도체 산업 핵심 지표 (KPI 인포그래픽) */
export const demoKpi: InfographicAnalysis = {
  id: "demo-kpi-001",
  sourceImage: "semiconductor_kpi.png",
  analyzedAt: new Date().toISOString(),
  contentType: "infographic",
  structure: {
    title: "글로벌 반도체 시장 핵심 지표",
    subtitle: "2024년 4분기 기준",
    source: "WSTS, Gartner",
  },
  infographicData: {
    subType: "kpi_card",
    items: [
      {
        label: "글로벌 반도체 시장 규모",
        value: "6,274",
        unit: "억 달러",
        icon: "🌐",
        change: { value: 19.7, direction: "up", period: "YoY" },
      },
      {
        label: "AI 반도체 매출",
        value: "1,340",
        unit: "억 달러",
        icon: "🤖",
        change: { value: 87.2, direction: "up", period: "YoY" },
      },
      {
        label: "메모리 반도체 가격 (DRAM)",
        value: "3.42",
        unit: "$/Gb",
        icon: "💾",
        change: { value: 35.1, direction: "up", period: "QoQ" },
      },
      {
        label: "파운���리 가동률",
        value: "82",
        unit: "%",
        icon: "🏭",
        change: { value: -3.2, direction: "down", period: "전분기 대비" },
      },
    ],
    layout: "grid",
  },
  narrative: {
    headline: "AI가 반도체 시장 성장 견인, 메모리 가격 회복세 뚜렷",
    summary: "글로벌 반도체 시장이 AI 수요에 힘입어 전년 대비 19.7% 성장하며 6,274억 달러를 기록했다.",
    story: "AI 반도체 매출이 전년 대비 87.2% 급증하며 전체 시장 성장을 주도했다. 메모리 가격도 회복세를 보이고 있으나, 파운드리 가동률은 소폭 하락했다.",
    keyTakeaways: [
      "AI 반도체 YoY +87% — 시장의 성장 엔진",
      "DRAM 가격 QoQ +35% — 공급 타이트닝 효과",
      "파운드리 가동률 하락 — 일반 소비 전자 수요 부진",
    ],
    questionsRaised: ["AI 외 수요가 2025년 상반기에 회복될 수 있을까?"],
    viewerAction: "AI 관련 반도체 밸류체인의 실적 모멘텀에 주목",
    contextualNotes: ["WSTS 기준, 환율 변동 제외한 달러 기준 수치"],
  },
  emphasis: {
    focusPoint: { displayText: "6,274억 달러", reason: "시장 규모 역대 최고" },
    colorStrategy: {
      primary: "#58A6FF",
      secondary: ["#FF6B6B"],
      positive: "#FF6B6B",
      negative: "#4DABF7",
      accent: "#58A6FF",
      backgroundTone: "dark",
    },
    densityLevel: "balanced",
  },
};

/** 모든 데모 데이터 — 차트 + 표 + 인포그래픽 */
export const allDemoData: VisualAnalysis[] = [demoLineChart, demoBarChart, demoTable, demoKpi];
