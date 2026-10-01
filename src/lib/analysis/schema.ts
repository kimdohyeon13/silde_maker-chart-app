/**
 * =====================================================
 * 차트 분석 엔진 — 마스터 스키마
 * =====================================================
 *
 * 이 파일은 차트 이미지를 분석한 결과의 "설계도"입니다.
 * 6단계 레이어 분석의 모든 결과가 이 타입들로 정의됩니다.
 *
 * 왜 이게 중요한가?
 * → Claude가 이미지를 분석할 때 이 스키마에 맞춰서 JSON을 출력합니다.
 * → 차트 컴포넌트가 이 JSON을 읽어서 시각화합니다.
 * → 즉, 이 스키마가 "분석의 언어"이자 "차트의 청사진"입니다.
 */

// ─────────────────────────────────────────────
// Layer 1: 구조 인식 (Structure Recognition)
// "이 차트가 뭔지 파악하기"
// ─────────────────────────────────────────────

/** 지원하는 차트 종류 */
export type ChartType =
  | "line" // 꺾은선 차트 (주가 추이, 시계열 데이터)
  | "bar" // 막대 차트 (비교, 순위)
  | "bar_horizontal" // 가로 막대 (긴 레이블에 적합)
  | "stacked_bar" // 누적 막대 (구성비 비교)
  | "area" // 영역 차트 (누적량 강조)
  | "donut" // 도넛 차트 (비율/구성)
  | "pie" // 파이 차트 (비율/구성)
  | "candle" // 캔들 차트 (주식 OHLC)
  | "scatter" // 산점도 (상관관계)
  | "combo" // 복합 차트 (막대+선 등)
  | "waterfall" // 폭포 차트 (증감 분해)
  | "treemap" // 트리맵 (계층적 비율)
  | "heatmap" // 히트맵 (2차원 밀도)
  | "radar" // 레이더 차트 (다차원 비교)
  | "funnel" // 깔때기 (전환율)
  | "bubble"; // 버블 차트 (3변수 산점도)

/** 축(Axis) 정보 — X축이든 Y축이든 공통 구조 */
export interface AxisInfo {
  /** 축 레이블 (예: "날짜", "매출(억원)", "수익률(%)") */
  label: string;
  /** 데이터 타입 */
  type: "time" | "category" | "numeric";
  /** 축에 표시된 값들 (눈금) */
  tickValues: string[];
  /**
   * 화면에 실제로 표시할 눈금 라벨들 (X축 틱 정규화/솎기용)
   * → tickValues는 원본에서 읽은 모든 눈금, displayTickValues는 그중 렌더링할 부분집합
   * → 데이터 x-key(예: "26F.04")와 정확일치(===)가 안 맞아 틱이 사라지던 문제(P0-5) 대응
   * → 없으면 tickValues를 그대로 사용 (기존 JSON 호환)
   * (기존에는 TossLineChart에서 인라인 캐스팅으로 사용하던 필드를 정식 필드로 승격)
   */
  displayTickValues?: string[];
  /** 단위 (예: "억원", "%", "달러", "명") */
  unit?: string;
  /** 축 최솟값 (숫자축인 경우) */
  min?: number;
  /** 축 최댓값 (숫자축인 경우) */
  max?: number;
  /** 축이 0에서 시작하는지 여부 — 왜곡 탐지에 중요 */
  startsAtZero: boolean;
  /** 로그 스케일 여부 */
  isLogScale: boolean;
}

/** 범례(Legend) 항목 */
export interface LegendItem {
  /** 시리즈 이름 (예: "삼성전자", "코스피") */
  name: string;
  /** 원본 차트에서의 색상 */
  originalColor?: string;
  /** 리메이크에서 사용할 색상 (토스 스타일) */
  remakeColor?: string;
  /** 주연/조연 구분 — secondary는 시각적으로 약하게 렌더링 */
  role?: "primary" | "secondary";
  /**
   * 시리즈 성격 구분 (P0-3 밴드/전망 처리용)
   * → "band": PER 밴드 등 상·하한선 묶음 (옅은 부채꼴 채움 + 우측 끝 배수라벨)
   * → "forecast": 전망선 (점선 + 범례 점선 스와치)
   * → "normal": 일반 시리즈 (기본값으로 취급)
   * → 밴드를 forecast로 오판해 범례/라벨이 사라지던 회귀를 막기 위해 명시 필드로 추가
   * → 없으면 기존 키워드 추론 로직을 그대로 사용 (기존 JSON 호환)
   */
  seriesKind?: "band" | "forecast" | "normal";
}

/**
 * 패널(Panel) 정보 — 다중 패널/스몰멀티플(small-multiples) 차트의 단일 패널 (P0-2)
 *
 * 왜 필요한가?
 * → 기존 스키마는 단일 xAxis/yAxis/secondaryYAxis만 지원했음
 * → 그래서 3분할 패널·2단 콤보 차트가 "합성 단일축"으로 평탄화되어 구조가 파괴됨
 * → 패널마다 독립된 축/시리즈를 가지므로, 각 패널을 이 타입으로 분리해 담는다
 * → structure.panels[]가 있으면 PanelGrid가 패널별 독립축 격자로 렌더 (합성 X축 생성 금지)
 *
 * AxisInfo / ChartType / HighlightZone 은 이 파일에 이미 정의된 타입을 그대로 재사용한다.
 */
export interface PanelInfo {
  /** 패널 제목 (예: "Brent", "WTI") — 없으면 시리즈명으로 대체 */
  title?: string;
  /** 이 패널의 차트 종류 (패널마다 다를 수 있음, 예: 한 패널은 line 다른 패널은 bar) */
  chartType?: ChartType;
  /** 이 패널의 X축 정보 */
  xAxis: AxisInfo;
  /** 이 패널의 Y축 정보 */
  yAxis: AxisInfo;
  /** 이 패널의 보조 Y축 (이중축 패널인 경우) */
  secondaryYAxis?: AxisInfo;
  /** 이 패널에 그릴 시리즈 이름 목록 (data.series[].name과 매칭) */
  seriesNames: string[];
  /** 이 패널에 표시할 강조 구간들 (배경 음영 등) */
  highlightZones?: HighlightZone[];
}

/** Layer 1 전체 구조 */
export interface StructureAnalysis {
  /** 자동 분류된 차트 종류 */
  chartType: ChartType;
  /** 차트 제목 */
  title: string;
  /** 부제목 (있는 경우) */
  subtitle?: string;
  /** 데이터 출처 (예: "한국은행", "Bloomberg") */
  source?: string;
  /** 시간 범위 (예: "2020.01 ~ 2024.12") */
  timeRange?: string;
  /** X축 정보 */
  xAxis: AxisInfo;
  /** Y축 정보 */
  yAxis: AxisInfo;
  /** 보조 Y축 (이중축 차트인 경우) */
  secondaryYAxis?: AxisInfo;
  /**
   * 다중 패널 정보 (P0-2) — 스몰멀티플/3분할/2단 콤보 차트용
   * → 있으면 PanelGrid가 패널별 독립축 격자로 렌더 (단일 xAxis/yAxis로 평탄화 금지)
   * → 없으면 기존처럼 단일 패널 차트로 취급 (기존 JSON 호환)
   */
  panels?: PanelInfo[];
  /** 범례 정보 */
  legend: LegendItem[];
  /**
   * 축 왜곡 경고
   * 예: Y축이 0에서 시작하지 않아서 변동폭이 과장되는 경우
   * → 시청자에게 이를 알려주는 것이 정직한 시각화
   */
  axisDistortionWarning?: string;
}

// ─────────────────────────────────────────────
// Layer 2: 데이터 추출 (Data Extraction)
// "숫자를 정확하게 읽어내기"
// ─────────────────────────────────────────────

/** 단일 데이터 포인트 */
export interface DataPoint {
  /** X값 (시간이면 "2024-01", 카테고리면 "삼성전자" 등) */
  x: string | number;
  /** Y값 (실제 수치) */
  y: number;
  /** 막대 안에 표시할 원문 라벨. 예: 시장점유율 35.8% */
  displayLabel?: string;
  /** 누적 막대 위에 표시할 합계 라벨. 한 계열의 포인트에만 둔다. */
  totalLabel?: string;
  /** 보조 Y값 (이중축인 경우) */
  y2?: number;
  /** 캔들차트 전용: 시가, 고가, 저가, 종가 */
  ohlc?: { open: number; high: number; low: number; close: number };
  /** 이 포인트의 확신도 (0~1, Claude가 이미지에서 읽어낸 정확도) */
  confidence: number;
}

/** 데이터 시리즈 (하나의 선/막대 그룹) */
export interface DataSeries {
  /** 시리즈 이름 (예: "삼성전자 주가") */
  name: string;
  /** 데이터 포인트 배열 */
  data: DataPoint[];
  /** 시리즈 타입 (복합차트에서 선/막대 구분) */
  renderAs?: "line" | "bar" | "area";
  /** 주연/조연 구분 — secondary는 가는 선 + 낮은 투명도로 시각적 약화 */
  role?: "primary" | "secondary";
  /** 선 끝 기준값 옆에 붙이는 작은 당일 등락 배지 */
  dailyMove?: {
    value: string;
    color?: string;
    /** 기준값과 당일 등락을 겹치지 않는 두 열로 나눠 표시 */
    layout?: "inline" | "two-column";
    /** 두 열형 배지의 작은 머리말. 예: 오늘, TODAY */
    label?: string;
  };
  /**
   * 시리즈 성격 구분 (P0-3 밴드/전망 처리용) — LegendItem.seriesKind와 동일 의미
   * → "band": PER 밴드 등 상·하한선 묶음 / "forecast": 전망선 / "normal": 일반 시리즈
   * → 렌더러가 키워드 추론 대신 이 값을 우선 사용해 밴드 오판(범례·라벨 소실)을 방지
   * → 없으면 기존 키워드 추론 로직을 그대로 사용 (기존 JSON 호환)
   */
  seriesKind?: "band" | "forecast" | "normal";
}

/** 데이터 품질 평가 */
export interface DataQuality {
  /** 전체 확신도 (0~1) */
  overallConfidence: number;
  /** 누락된 데이터 포인트 수 */
  missingPoints: number;
  /** 읽기 어려운 영역 설명 */
  hardToReadAreas: string[];
  /** 원본 차트의 해상도/가독성 평가 */
  readabilityScore: "excellent" | "good" | "fair" | "poor";
}

/** Layer 2 전체 구조 */
export interface DataExtraction {
  /** 데이터 시리즈들 */
  series: DataSeries[];
  /** 총 데이터 포인트 수 */
  totalDataPoints: number;
  /** 데이터 품질 평가 */
  quality: DataQuality;
}

// ─────────────────────────────────────────────
// Layer 3: 통계 분석 (Statistical Analysis)
// "숫자 뒤에 숨은 패턴 찾기"
// ─────────────────────────────────────────────

/** 추세 정보 */
export interface TrendInfo {
  /** 전체 방향 */
  direction: "strong_up" | "up" | "sideways" | "down" | "strong_down";
  /** 추세 강도 (0~1, 1이면 완벽한 직선 추세) */
  strength: number;
  /** 추세 설명 */
  description: string;
  /** 최근 추세 (마지막 20% 구간) */
  recentDirection: "accelerating_up" | "decelerating_up" | "flat" | "decelerating_down" | "accelerating_down";
}

/** 변동성 정보 */
export interface VolatilityInfo {
  /** 변동성 수준 */
  level: "very_low" | "low" | "moderate" | "high" | "extreme";
  /** 변동성 수치 (변동계수 등) */
  coefficient: number;
  /** 설명 */
  description: string;
}

/** 기간 대비 변화율 */
export interface ChangeRate {
  /** 기간 설명 (예: "전월 대비", "YoY") */
  period: string;
  /** 변화율 (%) */
  percentChange: number;
  /** 절대 변화량 */
  absoluteChange: number;
  /** 시작값 */
  from: number;
  /** 끝값 */
  to: number;
}

/** 시리즈 간 상관관계 */
export interface Correlation {
  /** 시리즈 A 이름 */
  seriesA: string;
  /** 시리즈 B 이름 */
  seriesB: string;
  /** 상관계수 (-1 ~ 1) */
  coefficient: number;
  /** 관계 설명 */
  description: string;
}

/** 통계 요약 */
export interface StatsSummary {
  /** 최댓값 */
  max: { value: number; at: string };
  /** 최솟값 */
  min: { value: number; at: string };
  /** 평균 */
  average: number;
  /** 중앙값 */
  median: number;
  /** 전체 범위 */
  range: number;
}

/** Layer 3 전체 구조 */
export interface StatisticalAnalysis {
  trend: TrendInfo;
  volatility: VolatilityInfo;
  changeRates: ChangeRate[];
  correlations: Correlation[];
  summary: StatsSummary;
}

// ─────────────────────────────────────────────
// Layer 4: 패턴 감지 (Pattern Detection)
// "중요한 순간 포착하기"
// ─────────────────────────────────────────────

/**
 * 중요도 등급
 * - critical: 반드시 시청자에게 보여줘야 함 (큰 어노테이션)
 * - high: 강조할 가치가 있음 (작은 어노테이션)
 * - medium: 보조 정보 (호버 시 표시)
 */
export type Importance = "critical" | "high" | "medium";

/** 패턴 포인트 — 차트 위의 특별한 지점 */
export interface PatternPoint {
  /** 패턴 종류 */
  type:
    | "inflection" // 추세 전환점 (상승→하락 또는 하락→상승)
    | "outlier" // 이상치 (갑자기 튀는 값)
    | "peak" // 최고점
    | "trough" // 최저점
    | "acceleration" // 변화 가속 구간 시작점
    | "deceleration" // 변화 감속 구간 시작점
    | "breakout" // 저항선 돌파
    | "breakdown" // 지지선 이탈
    | "gap"; // 갭 (급변)
  /** 해당 데이터 포인트 */
  dataPoint: { x: string | number; y: number };
  /** 시리즈 이름 */
  seriesName: string;
  /** 패턴 설명 (시청자용) */
  description: string;
  /** 중요도 */
  importance: Importance;
  /**
   * 왜 이 포인트가 중요한지에 대한 근거
   * → 단순히 "최고점" 이 아니라 "2023년 금리 인하 기대감으로 최고치 기록"
   */
  reasoning: string;
}

/** 교차점 (두 시리즈가 만나는 점) */
export interface CrossoverPoint {
  /** 교차 지점 */
  at: { x: string | number; y: number };
  /** 올라가는 시리즈 */
  risingSeriesName: string;
  /** 내려가는 시리즈 */
  fallingSeriesName: string;
  /** 시사점 (예: "골든크로스 — 단기이평선이 장기이평선을 상향 돌파") */
  implication: string;
  importance: Importance;
}

/** 지지/저항선 (주식 차트용) */
export interface SupportResistance {
  type: "support" | "resistance";
  /** 가격 수준 */
  level: number;
  /** 이 레벨이 테스트된 횟수 */
  touchCount: number;
  /** 강도 */
  strength: "weak" | "moderate" | "strong";
}

/** Layer 4 전체 구조 */
export interface PatternDetection {
  /** 감지된 패턴 포인트들 (중요도순 정렬) */
  points: PatternPoint[];
  /** 교차점들 */
  crossovers: CrossoverPoint[];
  /** 지지/저항선 (해당되는 경우) */
  supportResistance: SupportResistance[];
  /** 주기성 패턴 (있는 경우, 예: "분기별 실적 발표 시 상승") */
  cyclicalPattern?: string;
}

// ─────────────────────────────────────────────
// Layer 5: 서사 구성 (Narrative Building)
// "데이터가 말하는 이야기 만들기"
// ─────────────────────────────────────────────

/** Layer 5 전체 구조 */
export interface NarrativeAnalysis {
  /**
   * UI용 헤드 메시지
   * → 어렵고 긴 headline 대신, 화면에서 가장 먼저 보여줄 핵심 한 줄
   * 예: "가격보다 안전이 먼저"
   */
  headMessage?: string;

  /**
   * UI용 서브 메시지
   * → headMessage를 바로 이해시키는 쉬운 보조 한 줄
   * 예: "로보택시 초반 승부는 요금보다 사고 데이터에서 갈린다"
   */
  subMessage?: string;

  /**
   * 한 줄 헤드라인 (시선을 사로잡는 문장)
   * 예: "반도체 수출 3년 만에 역대 최고치 경신"
   */
  headline: string;

  /**
   * 2~3문장 요약 (핵심만 빠르게)
   * 예: "2024년 반도체 수출이 전년 대비 42% 증가하며 역대 최고를 기록했다.
   *      AI 수요 폭증이 핵심 원인이며, 특히 HBM 매출이 3배 이상 성장했다."
   */
  summary: string;

  /**
   * 시청자용 스토리 (기승전결)
   * → 보고서나 유튜브에서 이 차트를 설명할 때 쓸 수 있는 내러티브
   * → "왜 이렇게 됐고, 앞으로 어떻게 될 수 있는지" 포함
   */
  story: string;

  /**
   * 핵심 시사점 (3~5개)
   * → 시청자가 "아, 이건 알아야겠다" 싶은 것들
   */
  keyTakeaways: string[];

  /**
   * 이 데이터가 제기하는 질문들
   * → 시청자가 더 생각해볼 만한 것들
   * 예: "이 추세가 지속되면 2025년에는 어떤 영향이?"
   */
  questionsRaised: string[];

  /**
   * 시청자 행동 가이드
   * → 이 차트를 본 시청자가 뭘 해야 하는지/주의해야 하는지
   * 예: "투자자라면 반도체 업종 내 HBM 비중이 높은 기업에 주목"
   */
  viewerAction: string;

  /**
   * 맥락 보충 (차트에는 없지만 이해를 돕는 배경 정보)
   * → "참고로 이 시기에 ○○ 이벤트가 있었음"
   */
  contextualNotes: string[];
}

// ─────────────────────────────────────────────
// Layer 6: 시각 강조 계획 (Visual Emphasis Plan)
// "어떻게 보여줄 것인가"
// ─────────────────────────────────────────────

/** 어노테이션 — 차트 위에 표시하는 주석 */
export interface Annotation {
  /** 어노테이션 종류 */
  type:
    | "point_label" // 특정 점에 라벨 (예: "최고 52,400원")
    | "range_highlight" // 구간 강조 (예: 상승 구간 배경색)
    | "arrow" // 화살표 (추세 방향 표시)
    | "line" // 수평/수직선 (기준선, 평균선)
    | "callout" // 말풍선 (설명)
    | "badge"; // 뱃지 ("+42%" 같은 수치)
  /** 위치 */
  position: { x: string | number; y?: number };
  /** 표시할 텍스트 */
  text: string;
  /** 스타일 */
  style: "emphasis" | "warning" | "positive" | "negative" | "neutral" | "info";
  /** 중요도 (화면 공간이 부족할 때 낮은 것부터 숨김) */
  importance: Importance;
}

/** 하이라이트 구간 — 배경색으로 특정 영역 강조 */
export interface HighlightZone {
  /** 시작 X */
  fromX: string | number;
  /** 끝 X */
  toX: string | number;
  /** 색상 (반투명) */
  color: string;
  /** 라벨 */
  label: string;
  /** 설명 */
  description: string;
}

/** 추세선 */
export interface TrendLine {
  /** 시작점 */
  from: { x: string | number; y: number };
  /** 끝점 */
  to: { x: string | number; y: number };
  /** 스타일 */
  style: "solid" | "dashed" | "dotted";
  /** 색상 */
  color: string;
  /** 라벨 (예: "저항선 52,000원") */
  label?: string;
}

/**
 * 색상 전략
 * → 토스증권 스타일: 최소한의 색상으로 최대한의 정보 전달
 */
export interface ColorStrategy {
  /** 주 색상 (가장 중요한 시리즈) */
  primary: string;
  /** 보조 색상들 */
  secondary: string[];
  /** 상승 색상 */
  positive: string;
  /** 하락 색상 */
  negative: string;
  /** 강조 색상 */
  accent: string;
  /** 배경 톤 */
  backgroundTone: "dark" | "light";
}

/**
 * 포커스 포인트
 * → 시청자의 시선이 가장 먼저 가야 할 곳
 * → 차트를 처음 봤을 때 1초 안에 "아, 이게 핵심이구나" 하는 곳
 */
export interface FocusPoint {
  /** 위치 */
  position: { x: string | number; y: number };
  /** 왜 여기가 포커스인지 */
  reason: string;
  /** 포커스 포인트에 표시할 주요 수치/텍스트 */
  displayText: string;
}

/** Layer 6 전체 구조 */
export interface EmphasisPlan {
  /** 어노테이션 목록 (중요도순) */
  annotations: Annotation[];
  /** 강조 구간들 */
  highlightZones: HighlightZone[];
  /** 추세선들 */
  trendLines: TrendLine[];
  /** 색상 전략 */
  colorStrategy: ColorStrategy;
  /** 시선 집중점 */
  focusPoint: FocusPoint;
  /**
   * 정보 밀도 레벨
   * → minimal: 핵심만 (유튜브 썸네일용)
   * → balanced: 적절한 양 (발표용)
   * → detailed: 풍부한 정보 (보고서용)
   */
  densityLevel: "minimal" | "balanced" | "detailed";
}

// ─────────────────────────────────────────────
// 마스터 타입: 6개 레이어를 합친 최종 분석 결과
// ─────────────────────────────────────────────

/** 차트 분석 전체 결과 */
export interface ChartAnalysis extends RemakeMetadataFields {
  /** 고유 ID */
  id: string;
  /** 원본 이미지 경로 */
  sourceImage: string;
  /** 분석 시각 */
  analyzedAt: string;
  /** 분석 소요 시간 (ms) */
  analysisDuration?: number;

  /** Layer 1: 구조 인식 */
  structure: StructureAnalysis;
  /** Layer 2: 데이터 추출 */
  data: DataExtraction;
  /** Layer 3: 통계 분석 */
  statistics: StatisticalAnalysis;
  /** Layer 4: 패턴 감지 */
  patterns: PatternDetection;
  /** Layer 5: 서사 구성 */
  narrative: NarrativeAnalysis;
  /** Layer 6: 시각 강조 계획 */
  emphasis: EmphasisPlan;
  /** 원본이 상단 차트와 하단 표를 함께 보여줄 때 쓰는 선택형 표 데이터 */
  tableData?: TableData;
  /** 차트+표 결합형의 내부 높이 배분 */
  chartTableOptions?: {
    chartHeight?: number;
    gap?: number;
  };
}

// ─────────────────────────────────────────────
// 차트 생성 설정 (렌더링용)
// ─────────────────────────────────────────────

/** 차트 렌더링 설정 */
export interface ChartRenderConfig {
  /** 너비 (px) */
  width: number;
  /** 높이 (px) */
  height: number;
  /** 다크모드 여부 */
  isDark: boolean;
  /** 정보 밀도 */
  density: "minimal" | "balanced" | "detailed";
  /** 애니메이션 활성화 */
  animated: boolean;
  /** 인터랙션 활성화 (호버 툴팁 등) */
  interactive: boolean;
  /** 폰트 크기 배율 (1.0 = 기본) */
  fontScale: number;
  /** 내보내기용 여부 (true면 더 높은 해상도) */
  forExport: boolean;
}

// ═════════════════════════════════════════════
// Style-Preserving Remake 메타데이터
// ═════════════════════════════════════════════
//
// 이 프로젝트의 핵심은 원본 표/그래프의 "본질"은 유지하면서
// 고품질 스타일로 다시 렌더링하는 것입니다.
// 아래 메타데이터는 어떤 스타일을 적용했는지, 무엇을 보존해야 하는지,
// 어떤 변화까지 허용되는지를 JSON 안에 명시하기 위한 계약입니다.

export type StylePresetId =
  | "toss-clean"
  | "consulting-slide"
  | "market-terminal"
  | "editorial-card"
  | "signal-editorial";

export type DataFidelityLevel =
  | "exact"
  | "source-visible"
  | "directional";

export type AllowedTransformation =
  | "translate-text"
  | "simplify-labels"
  | "rewrite-title"
  | "group-rows"
  | "reorder-emphasis"
  | "adjust-colors"
  | "adjust-layout"
  | "adjust-density"
  | "crop-source-image";

export interface PreserveIntent {
  /** 원본이 말하려던 핵심 메시지 */
  originalMessage?: string;
  /** 반드시 유지해야 하는 데이터/비교/관계 */
  preservedElements?: string[];
  /** 리디자인 과정에서 의도적으로 바꾼 표현 */
  changedElements?: string[];
  /** 숫자 보존 수준 */
  dataFidelity?: DataFidelityLevel;
  /** 원본 충실도 관련 메모 */
  notes?: string;
}

export interface QualityCheck {
  id: string;
  label: string;
  status: "pending" | "pass" | "warning" | "fail";
  detail?: string;
  checkedAt?: string;
}

export interface ExportOptions {
  headerPadding?: string;
  contentPadding?: string;
  sourcePadding?: string;
  titleFontSize?: number;
  subtitleFontSize?: number;
  /** 서브메시지 글자 굵기(100~900). 생략하면 Paperlogy Light(300), 명시하면 사용자 예외값을 사용 */
  subtitleFontWeight?: number;
  /** 제목 아래 두 번째 보조문장(metaMessage)의 글자 크기 */
  metaFontSize?: number;
  /** 제목 아래 두 번째 보조문장(metaMessage)의 글자 굵기 */
  metaFontWeight?: number;
  /** 키메시지와 보조문장을 각각 한 줄로 고정 */
  headerCopySingleLine?: boolean;
  sourceFontSize?: number;
  /** 채널별 공개 계정 워터마크. 생략하면 X 계정 기본값을 사용 */
  watermarkText?: string;
  fontFamily?: string;
  titleFontFamily?: string;
  titleLetterSpacing?: number;
  titleLineHeight?: number;
  hideHeader?: boolean;
  hideSource?: boolean;
  chartHeight?: number;
  /** 고정 export 카드 높이(px). 912×513은 2배 export 시 1824×1026(16:9) */
  canvasHeight?: number;
  /** 프리셋과 무관하게 export 캔버스 배경색을 지정 */
  backgroundColor?: string;
  borderColor?: string;
  headerVariant?:
    | "stacked"
    | "top-rule"
    | "left-rail"
    | "centered"
    | "split-metric"
    | "signal-editorial";
  frameStyle?: "none" | "hairline" | "boxed";
  /** ContentRouter 내부 프레임 표시 여부 */
  contentBorder?: boolean;
  headerLabel?: string;
  headerLabelFontSize?: number;
  accentColor?: string;
  metricValue?: string;
  metricLabel?: string;
  metricColor?: string;
  metricFontSize?: number;
  metricFontFamily?: string;
  /** 최신 거래일 등락을 차트 기준값과 분리해 보여주는 상단 색상 블록 제목 */
  sessionMoveTitle?: string;
  /** 미국식 상승 초록·하락 주황 화살표 블록. 당일 등락 전용이며 그래프 기준값과 섞지 않는다. */
  sessionMoveItems?: Array<{
    label: string;
    value: string;
    direction: "up" | "down" | "flat";
  }>;
  sourceReplica?: boolean;
  /** 카드, 막대, 선 끝/꺾임의 둥근 처리를 제거해 각진 형태로 렌더링 */
  squareEdges?: boolean;
  /** 선 그래프 아래 면 채우기 표시 여부. 생략하면 시리즈 수에 따른 기본값을 사용 */
  showAreaFill?: boolean;
  /** 라인차트 격자 표현. 생략하면 기존 점선 격자 */
  gridMode?: "none" | "solid" | "dashed";
  /** 라인 끝 직접 라벨 표시 여부. 생략하면 기존 자동 규칙 */
  showDirectLabels?: boolean;
  /** 라인 끝 값의 소수 자릿수 강제값(0~6) */
  directLabelFractionDigits?: number;
  /** 주 시리즈 선 두께(px) */
  lineStrokeWidth?: number;
  /** 장표별 축·값 라벨 크기 배율. 생략하면 기존 크기 유지. */
  chartLabelScale?: number;
  /** 장표별 축·값 라벨 굵기. 제목·부제와 독립적으로 조정한다. */
  chartLabelFontWeight?: number;
  /** 평균선 외의 명시적 수평 기준선도 모두 표시 */
  showAllTrendLines?: boolean;
  /** 첫 번째 시리즈 최신값 위치에 옅은 수평 가이드선을 표시 */
  showLatestGuide?: boolean;
  /** 최신값 가이드선 불투명도(0~1) */
  latestGuideOpacity?: number;
  /** 선 끝 직접 라벨을 위한 오른쪽 여백(px). 값이 작을수록 plot 영역이 넓어진다. */
  endLabelRightMargin?: number;
  /** 다중 패널 차트의 패널별 작은 제목 크기(px) */
  panelTitleFontSize?: number;
  /** 작은 패널 안에서 차트 내부 여백을 줄여 실제 플롯 영역을 확보 */
  compactChartMargins?: boolean;
  /** 막대 색을 최댓값 강조가 아니라 양수/음수 부호 기준으로 표시 */
  barColorMode?: "emphasis" | "sign";
  /** 누적 막대 범례 정렬. 생략하면 기존 오른쪽 정렬 */
  stackedLegendAlign?: "left" | "center" | "right";
  /** 누적 막대 구간 안 직접 라벨 크기(px) */
  stackedLabelFontSize?: number;
  /**
   * 값 라벨 숫자 표기 로케일. 기본값 "ko"는 기존 동작(1만 이상은 "만"·"억" 축약).
   * "en"이면 축약 없이 영어권 자릿수 구분만 쓴다 — 영문 덱에 한글이 섞이지 않게 한다.
   */
  numberLocale?: "ko" | "en";
}

export interface RemakeMetadataFields {
  /** 적용할 고급 리디자인 스타일 프리셋 */
  stylePreset?: StylePresetId;
  /** 원본에서 보존해야 하는 의미/데이터 계약 */
  preserveIntent?: PreserveIntent;
  /** 원본 대비 허용된 리디자인 변화 */
  allowedTransformations?: AllowedTransformation[];
  /** export 전후 품질 검수 상태 */
  qualityChecks?: QualityCheck[];
  /** 카드별 export 여백/폰트 조정 */
  exportOptions?: ExportOptions;
}

// ═════════════════════════════════════════════
// 표(Table) + 인포그래픽(Infographic) 확장
// ═════════════════════════════════════════════
//
// 기존 ChartAnalysis는 그대로 유지합니다.
// 새로운 콘텐츠 타입(표, 인포그래픽)을 위한 별도 인터페이스를 추가하고,
// Discriminated Union(판별 공용체)으로 통합합니다.
//
// 핵심 아이디어:
// → 기존 ChartAnalysis에는 contentType 필드가 없음
// → contentType이 없으면 차트, "table"이면 표, "infographic"면 인포그래픽
// → 기존 JSON 파일은 수정 없이 그대로 동작

// ─────────────────────────────────────────────
// 표(Table) 타입 시스템
// ─────────────────────────────────────────────

/**
 * 표 서브타입 — 어떤 종류의 표인지 구분
 *
 * comparison: 항목 비교 ("삼성 vs LG vs SK")
 * ranking: 순위표 ("매출 TOP 10")
 * summary: 요약표 ("주요 경제 지표 현황")
 * schedule: 일정/이벤트표 ("이번 주 경제 이벤트")
 * financial: 실적/재무표 ("분기별 실적")
 * matrix: 행-열 교차표 ("지역별 × 제품별 매출")
 */
export type TableSubType =
  | "comparison"
  | "ranking"
  | "summary"
  | "schedule"
  | "financial"
  | "matrix";

/**
 * 표의 열(Column) 정의
 *
 * 왜 필요한가?
 * → 열마다 데이터 타입이 다름 (숫자는 우측 정렬, 텍스트는 좌측)
 * → 단위가 다름 ("억원", "%", "달러")
 * → 이 정보가 있어야 셀 스타일링을 자동으로 결정할 수 있음
 */
export interface TableColumn {
  /** 열 식별자 — 데이터 접근 시 key로 사용 (예: "revenue", "company") */
  key: string;
  /** 열 제목 — 한글 (예: "매출액", "회사명") */
  label: string;
  /** 텍스트 정렬 — 숫자는 보통 "right", 텍스트는 "left" */
  align?: "left" | "center" | "right";
  /**
   * 데이터 타입 — 셀 스타일링에 사용
   * text: 일반 텍스트 (좌측 정렬, sans 폰트)
   * number: 숫자 (우측 정렬, mono 폰트)
   * percent: 퍼센트 (우측 정렬, +/- 색상)
   * currency: 금액 (우측 정렬, 단위 포함)
   * date: 날짜 (좌측 정렬)
   * badge: 뱃지형 (태그/라벨 스타일)
   */
  dataType?: "text" | "number" | "percent" | "currency" | "date" | "badge";
  /** 단위 (예: "억원", "%", "$/bbl") */
  unit?: string;
  /** 열 너비 — 픽셀 또는 비율 문자열 (예: 120 또는 "30%") */
  width?: number | string;
  /** 이 열이 행 식별자인지 — 첫 번째 열(회사명, 지표명 등)이 보통 해당 */
  isRowHeader?: boolean;
  /** 여러 지표 묶음 중 새 의미 블록이 시작되는 열인지 */
  sectionStart?: boolean;
}

/** 표 열을 가격·모멘텀, 컨센서스처럼 의미 단위로 묶는 2단 헤더 */
export interface TableColumnGroup {
  /** 화면에 표시할 그룹명 */
  label: string;
  /** 이 그룹에 속하는 TableColumn.key 목록 */
  keys: string[];
}

/**
 * 표의 셀(Cell) — 한 칸의 데이터
 *
 * value는 원본 값, displayValue는 포맷된 표시용 값입니다.
 * 예: value=1234567, displayValue="1,234,567"
 */
export type TableCellHighlight = "positive" | "negative" | "warning" | "accent" | "muted" | "none";

export interface TableCellSideValue {
  /** 셀의 주 표시값 옆에 붙일 보조 표시값 (예: 오늘 등락률) */
  displayValue: string;
  /** 보조 표시값 강조 색상 */
  highlight?: TableCellHighlight;
  /** 보조 표시값 직접 색상 (highlight보다 우선) */
  color?: string;
  /** 배지형 보조값에 쓸 배경색 */
  background?: string;
  /** 배지형 보조값 테두리 */
  border?: string;
  /** 배지형 보조값 안쪽 여백 */
  padding?: string;
  /** 배지형 보조값 둥근 모서리 */
  borderRadius?: string | number;
  /** 보조 표시값 폰트 크기 */
  fontSize?: string;
  /** 보조 표시값 굵기 */
  fontWeight?: number;
}

export interface TableCell {
  /** 원본 값 */
  value: string | number;
  /** 표시용 포맷된 값 (예: "+12.3%", "1,234억원") — 없으면 value를 그대로 표시 */
  displayValue?: string;
  /**
   * 셀 강조 스타일
   * positive: 상승/긍정 (빨강 배경) — 한국 증시 관례
   * negative: 하락/부정 (파랑 배경)
   * warning: 주의 (노랑 배경)
   * accent: 강조 (파란 배경)
   * muted: 흐리게 (회색)
   * none: 강조 없음
   */
  highlight?: TableCellHighlight;
  /** 티커 옆 오늘 등락률처럼 셀 안에서 크게 보조값을 붙일 때 사용 */
  sideValue?: TableCellSideValue;
  /** 셀 병합 — 가로로 여러 칸 차지 */
  colSpan?: number;
  /** 셀 병합 — 세로로 여러 칸 차지 */
  rowSpan?: number;
  /** 셀에 붙일 뱃지 텍스트 (예: "NEW", "1위", "추천") */
  badge?: string;
}

/**
 * 표의 행(Row) — 한 줄의 데이터
 *
 * cells는 열 key → 셀 매핑 구조입니다.
 * 예: { "company": { value: "삼성전자" }, "revenue": { value: 302, displayValue: "302조" } }
 */
export interface TableRow {
  /** 열 key → 셀 데이터 매핑 */
  cells: Record<string, TableCell>;
  /**
   * 행 타입
   * data: 일반 데이터 행
   * header: 그룹 헤더 (섹션 구분)
   * subtotal: 소계
   * total: 합계
   * divider: 구분선
   */
  rowType?: "data" | "header" | "subtotal" | "total" | "divider";
  /** 행 전체를 강조할지 여부 */
  highlight?: boolean;
  /** 행 전체 강조 배경색. 없으면 기본 highlight 배경을 사용 */
  highlightBg?: string;
}

export interface TableVisualOptions {
  rowHeight?: number;
  /** 고정 캔버스의 남는 높이를 표 행에 나눠 큰 하단 공백을 줄인다 */
  fitRowsToCanvas?: boolean;
  /** 자동 행 높이의 하한. 생략하면 rowHeight를 쓴다 */
  minRowHeight?: number;
  /** 자동 행 높이의 상한. 데이터가 적어도 행이 과하게 커지지 않게 한다 */
  maxRowHeight?: number;
  cellPadding?: string;
  lineHeight?: number;
  zebraStripe?: boolean;
  zebraOpacity?: number;
  fontFamily?: string;
  highlightMode?: "background" | "text";
  headerTone?: "plain" | "tinted" | "inverse" | "underline";
  rowRules?: "none" | "soft" | "strong";
  groupHeaderTone?: "plain" | "band" | "accent-rule";
  columnGroupTone?: "plain" | "tinted";
  columnRules?: boolean;
  sectionRules?: boolean;
  accentColor?: string;
  rowRuleColor?: string;
  sectionRuleColor?: string;
  /** 특정 숫자 열에만 얇은 인셀 데이터 바를 표시 */
  dataBarColumns?: Array<{
    key: string;
    max?: number;
    color?: string;
    positiveColor?: string;
    negativeColor?: string;
  }>;
  dataBarStyle?: Partial<{
    minWidthPercent: number;
    maxWidthPercent: number;
    height: number;
    opacity: number;
    bottom: number;
  }>;
  /** 표의 역할별 글자 굵기 — 숫자 전체가 과하게 강조되지 않도록 분리 */
  fontWeight?: Partial<{
    body: number;
    numeric: number;
    rowHeader: number;
    header: number;
    total: number;
    groupHeader: number;
    columnGroup: number;
  }>;
  fontSize?: Partial<{
    header: string;
    body: string;
    total: string;
    badge: string;
    unit: string;
    groupHeader: string;
    columnGroup: string;
  }>;
}

/**
 * 표 데이터 전체 구조 (Layer 2 대체)
 *
 * 차트의 DataExtraction이 series[] 구조인 것과 달리,
 * 표는 columns[] + rows[] 구조입니다.
 */
export interface TableData {
  /** 열 정의 배열 */
  columns: TableColumn[];
  /** 열을 의미 단위로 묶어 표시하는 선택형 2단 헤더 */
  columnGroups?: TableColumnGroup[];
  /** 행 데이터 배열 */
  rows: TableRow[];
  /** 합계/소계 행이 있는지 */
  hasTotalRow: boolean;
  /** 표별 시각 옵션 — 특정 결과물만 글자/여백을 조절할 때 사용 */
  visualOptions?: TableVisualOptions;
  /**
   * 행 그룹핑 — 섹션으로 나눠진 표에서 사용
   * 예: "제조업" 섹션, "서비스업" 섹션
   */
  rowGroups?: Array<{
    /** 그룹 제목 */
    label: string;
    /** 시작 행 인덱스 */
    startIndex: number;
    /** 끝 행 인덱스 */
    endIndex: number;
  }>;
}

// ─────────────────────────────────────────────
// 인포그래픽(Infographic) 타입 시스템
// ─────────────────────────────────────────────

/**
 * 인포그래픽 서브타입 — 어떤 형태의 인포그래픽인지 구분
 *
 * kpi_card: KPI 카드 (주요 지표 나열, 예: "매출 1.2조 / 영업이익률 15%")
 * process_flow: 프로세스 플로우 (단계별, 예: "접수 → 심사 → 승인")
 * comparison_card: 비교 카드 (항목 vs 항목, 예: "플랜A vs 플랜B")
 * timeline: 타임라인 (시간순 이벤트)
 * stat_matrix: 통계 매트릭스 (KPI 그리드, 더 밀도 높은 형태)
 * feature_list: 특징/스펙 리스트 (아이콘 + 제목 + 설명)
 * news_brief: 뉴스 브리프 (번역 헤드라인 + 요약 + 원문 이미지)
 */
export type InfographicSubType =
  | "kpi_card"
  | "process_flow"
  | "comparison_card"
  | "timeline"
  | "stat_matrix"
  | "feature_list"
  | "news_brief";

/**
 * KPI 카드 항목 — 하나의 주요 지표
 *
 * 예: { label: "매출액", value: "1.2조", unit: "원", change: { value: 12.3, direction: "up", period: "전분기 대비" } }
 */
export interface KpiItem {
  /** 지표 이름 */
  label: string;
  /** 현재 값 */
  value: string | number;
  /** 단위 (예: "원", "%", "명") */
  unit?: string;
  /** 변화율/변화량 — 있으면 화살표 + 색상으로 표시 */
  change?: {
    /** 변화 수치 (퍼센트 또는 절대값) */
    value: number;
    /** 방향 */
    direction: "up" | "down" | "flat";
    /** 기간 설명 (예: "전월 대비", "YoY") */
    period: string;
  };
  /** 아이콘 — 이모지 또는 키워드 (예: "📈", "revenue") */
  icon?: string;
  /** 강조 색상 — 커스텀 액센트 (없으면 테마 기본색) */
  accentColor?: string;
}

/**
 * 프로세스 단계 — 플로우 차트의 한 단계
 */
export interface ProcessStep {
  /** 단계 번호 */
  stepNumber: number;
  /** 단계 제목 */
  title: string;
  /** 설명 (선택) */
  description?: string;
  /** 상태 */
  status?: "completed" | "in_progress" | "pending";
  /** 아이콘 (이모지) */
  icon?: string;
}

/**
 * 비교 항목 — 비교 카드의 한 항목 (플랜A, 플랜B 등)
 */
export interface ComparisonItem {
  /** 항목 이름 (예: "플랜A", "삼성전자") */
  name: string;
  /**
   * 속성별 값 매핑
   * 예: { "가격": { value: 100000, displayValue: "10만원", highlight: "positive" } }
   */
  attributes: Record<string, {
    value: string | number;
    displayValue?: string;
    highlight?: "positive" | "negative" | "neutral";
  }>;
  /** 전체 점수/등급 (있으면) */
  overallScore?: string | number;
  /** 추천/우승 여부 — true면 카드에 강조 테두리 */
  isWinner?: boolean;
}

/**
 * 타임라인 이벤트 — 시간순 이벤트 하나
 */
export interface TimelineEvent {
  /** 날짜/시간 (표시용 문자열) */
  date: string;
  /** 이벤트 제목 */
  title: string;
  /** 설명 (선택) */
  description?: string;
  /** 중요도 */
  importance: "critical" | "high" | "medium";
  /** 카테고리 (색상 구분용) */
  category?: string;
}

/**
 * 뉴스 브리프용 이미지 자산
 *
 * path는 로컬 프로젝트 파일 경로입니다.
 * 예: "input/01-article.png"
 * API 응답 단계에서 url이 자동으로 채워질 수 있습니다.
 */
export interface NewsBriefMedia {
  /** 프로젝트 폴더 기준 상대 경로 (선택) */
  path?: string;
  /** 브라우저가 실제로 읽을 수 있는 URL (선택) */
  url?: string;
  /** 대체 텍스트 */
  alt: string;
  /** 이미지 설명/캡션 */
  caption?: string;
  /** 사진 출처 */
  source?: string;
}

/** 뉴스 본문 섹션 — 번역된 기사 본문을 블록 단위로 정리 */
export interface NewsBriefSection {
  /** 섹션 제목 (선택) */
  title?: string;
  /** 번역된 본문 */
  text: string;
}

/**
 * 인포그래픽 데이터 — 서브타입별 Discriminated Union
 *
 * subType 필드로 어떤 형태인지 구분하고, 각 형태에 맞는 데이터 필드를 가집니다.
 * switch(data.subType) 로 분기하면 TypeScript가 자동으로 타입을 좁혀줍니다.
 */
export type InfographicData =
  | {
      subType: "kpi_card";
      items: KpiItem[];
      /** 레이아웃 — "grid"(2×N), "row"(가로 나열), "column"(세로 나열) */
      layout?: "grid" | "row" | "column";
    }
  | {
      subType: "process_flow";
      steps: ProcessStep[];
      /** 방향 */
      direction?: "horizontal" | "vertical";
    }
  | {
      subType: "comparison_card";
      items: ComparisonItem[];
      /** 비교 속성 이름 목록 (행 제목) */
      comparisonAttributes: string[];
    }
  | {
      subType: "timeline";
      events: TimelineEvent[];
      direction?: "horizontal" | "vertical";
    }
  | {
      subType: "stat_matrix";
      items: KpiItem[];
      /** 열 개수 (기본 3) */
      columns?: number;
    }
  | {
      subType: "feature_list";
      items: Array<{
        label: string;
        description: string;
        icon?: string;
      }>;
    }
  | {
      subType: "news_brief";
      /** 기사 섹션 (예: Economy, Politics) */
      section?: string;
      /** 작성 시각/날짜 */
      publishedAt?: string;
      /** 기자명 */
      reporter?: string;
      /** 원문 헤드라인 */
      originalHeadline?: string;
      /** 원문 리드/덱을 번역한 짧은 설명 */
      dek?: string;
      /** 한눈에 보는 핵심 요약 */
      summaryBullets: string[];
      /** 번역된 본문 섹션 */
      translatedBody: NewsBriefSection[];
      /** 원문 이미지를 최대한 보존한 미디어 */
      media: NewsBriefMedia[];
      /** 강조 인용문 */
      pullQuote?: string;
    };

// ─────────────────────────────────────────────
// 공통 구조 — 모든 콘텐츠 타입이 공유
// ─────────────────────────────────────────────

/** 공통 구조 정보 — 차트/표/인포그래픽 모두 제목, 부제목, 출처를 가짐 */
export interface CommonStructure {
  title: string;
  subtitle?: string;
  source?: string;
}

/** 공통 시각 강조 — 포커스 텍스트와 색상 전략 */
export interface CommonEmphasis {
  focusPoint: { displayText: string; reason: string };
  colorStrategy: ColorStrategy;
  densityLevel: "minimal" | "balanced" | "detailed";
}

// ─────────────────────────────────────────────
// 표 분석 결과 (TableAnalysis)
// ─────────────────────────────────────────────

/**
 * 표 분석 전체 결과
 *
 * ChartAnalysis와 같은 수준의 최상위 타입이지만,
 * xAxis/yAxis/data.series 대신 tableData를 가집니다.
 */
export interface TableAnalysis extends RemakeMetadataFields {
  /** 고유 ID */
  id: string;
  /** 원본 이미지 경로 */
  sourceImage: string;
  /** 분석 시각 */
  analyzedAt: string;
  /** 분석 소요 시간 (ms) */
  analysisDuration?: number;

  /** 콘텐츠 타입 판별자 — "table"이면 표 */
  contentType: "table";
  /** 표 서브타입 */
  tableSubType: TableSubType;

  /** 구조 정보 (제목, 부제목, 출처) */
  structure: CommonStructure;
  /** 표 데이터 (열 정의 + 행 데이터) */
  tableData: TableData;
  /** 서사 구성 (차트와 동일한 구조) */
  narrative: NarrativeAnalysis;
  /** 시각 강조 계획 */
  emphasis: CommonEmphasis & {
    /** 하이라이트할 셀 좌표들 — 특별히 눈에 띄게 할 셀 */
    highlightCells?: Array<{
      row: number;
      col: string;
      reason: string;
    }>;
  };
}

// ─────────────────────────────────────────────
// 인포그래픽 분석 결과 (InfographicAnalysis)
// ─────────────────────────────────────────────

/**
 * 인포그래픽 분석 전체 결과
 *
 * KPI 카드, 프로세스 플로우, 비교 카드, 타임라인 등
 * 다양한 인포그래픽 형태를 하나의 타입으로 통합합니다.
 */
export interface InfographicAnalysis extends RemakeMetadataFields {
  /** 고유 ID */
  id: string;
  /** 원본 이미지 경로 */
  sourceImage: string;
  /** 분석 시각 */
  analyzedAt: string;
  /** 분석 소요 시간 (ms) */
  analysisDuration?: number;

  /** 콘텐츠 타입 판별자 — "infographic"이면 인포그래픽 */
  contentType: "infographic";

  /** 구조 정보 (제목, 부제목, 출처) */
  structure: CommonStructure;
  /** 인포그래픽 데이터 (서브타입별 discriminated union) */
  infographicData: InfographicData;
  /** 서사 구성 */
  narrative: NarrativeAnalysis;
  /** 시각 강조 계획 */
  emphasis: CommonEmphasis;
}

// ─────────────────────────────────────────────
// 통합 타입: VisualAnalysis (Discriminated Union)
// ─────────────────────────────────────────────

/**
 * VisualAnalysis — 모든 콘텐츠 타입을 아우르는 통합 타입
 *
 * 이 타입 하나로 차트, 표, 인포그래픽 모두를 처리합니다.
 *
 * 판별 방법:
 * → contentType 필드가 없으면 → ChartAnalysis (기존 호환)
 * → contentType === "table" → TableAnalysis
 * → contentType === "infographic" → InfographicAnalysis
 *
 * 왜 이렇게 하나?
 * → 기존 ChartAnalysis에는 contentType 필드가 없음
 * → 새 타입에만 contentType을 추가하면 기존 JSON 파일은 변경 없이 동작
 * → TypeScript의 타입 가드(type guard)로 안전하게 분기 가능
 */
export type VisualAnalysis = ChartAnalysis | TableAnalysis | InfographicAnalysis;

// ─────────────────────────────────────────────
// 타입 가드 함수들 (Type Guards)
// ─────────────────────────────────────────────
//
// 타입 가드란?
// → "이 변수가 어떤 타입인지" TypeScript에게 알려주는 함수
// → if (isTableAnalysis(data)) { ... } 안에서
//   TypeScript가 data를 TableAnalysis로 자동 인식
//
// 사용 예시:
//   const analysis: VisualAnalysis = ...;
//   if (isChartAnalysis(analysis)) {
//     // 여기서 analysis.data.series 접근 가능 (차트 전용 필드)
//   }

/** 차트 분석인지 확인 — contentType 필드가 없으면 차트 */
export function isChartAnalysis(a: VisualAnalysis): a is ChartAnalysis {
  return !("contentType" in a);
}

/** 표 분석인지 확인 */
export function isTableAnalysis(a: VisualAnalysis): a is TableAnalysis {
  return "contentType" in a && (a as TableAnalysis).contentType === "table";
}

/** 인포그래픽 분석인지 확인 */
export function isInfographicAnalysis(a: VisualAnalysis): a is InfographicAnalysis {
  return "contentType" in a && (a as InfographicAnalysis).contentType === "infographic";
}
