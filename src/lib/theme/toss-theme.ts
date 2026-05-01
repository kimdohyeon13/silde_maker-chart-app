/**
 * =====================================================
 * 토스증권 스타일 테마 시스템
 * =====================================================
 *
 * 토스증권의 디자인 철학을 코드로 표현합니다.
 *
 * 핵심 원칙:
 * 1. 미니멀리즘 — 불필요한 장식 제거, 데이터만 남기기
 * 2. 명확한 위계 — 중요한 것은 크고 밝게, 덜 중요한 것은 작고 흐리게
 * 3. 공간의 여유 — 빽빽하지 않게, 숨 쉴 공간 확보
 * 4. 숫자가 주인공 — 차트 장식이 아닌 수치가 시선을 끌어야 함
 *
 * 이 파일이 하는 일:
 * → 색상, 폰트, 간격, 애니메이션 등의 디자인 토큰(token)을 정의
 * → 다크모드/라이트모드 전환 지원
 * → 차트 컴포넌트에서 이 값들을 import해서 사용
 */

// ─────────────────────────────────────────────
// 색상 팔레트
// ─────────────────────────────────────────────

/** 다크 테마 색상 */
export const darkColors = {
  // ── 배경 계열 ──
  background: "#0D1117", // 가장 깊은 배경 (앱 전체)
  surface: "#161B22", // 카드/패널 배경
  surfaceHover: "#1C2128", // 호버 시 배경
  surfaceActive: "#21262D", // 액티브 시 배경
  elevated: "#1C2128", // 떠있는 요소 (툴팁, 팝오버)

  // ── 테두리/구분선 ──
  border: "#30363D", // 기본 테두리
  borderSubtle: "#21262D", // 은은한 테두리
  divider: "#21262D", // 구분선

  // ── 텍스트 ──
  textPrimary: "#E6EDF3", // 주요 텍스트 (제목, 수치)
  textSecondary: "#8B949E", // 보조 텍스트 (레이블, 설명)
  textTertiary: "#6E7681", // 3차 텍스트 (타임스탬프 등)
  textDisabled: "#484F58", // 비활성 텍스트

  // ── 차트 핵심 색상 ──
  positive: "#FF6B6B", // 상승 (한국 증시 관례: 빨강 = 상승)
  positiveSubtle: "rgba(255, 107, 107, 0.15)", // 상승 배경
  negative: "#4DABF7", // 하락 (파랑 = 하락)
  negativeSubtle: "rgba(77, 171, 247, 0.15)", // 하락 배경

  // ── 강조 / 액센트 ──
  accent: "#58A6FF", // 주요 강조 (포커스 포인트)
  accentSubtle: "rgba(88, 166, 255, 0.15)",
  accentMuted: "#388BFD",

  // ── 경고/정보 ──
  warning: "#D29922", // 경고 (이상치, 주의)
  warningSubtle: "rgba(210, 153, 34, 0.15)",
  info: "#58A6FF", // 정보
  infoSubtle: "rgba(88, 166, 255, 0.15)",

  // ── 차트 시리즈 색상 (멀티 시리즈용) ──
  series: [
    "#58A6FF", // 블루 (주 시리즈)
    "#FF6B6B", // 레드
    "#FBBF24", // 옐로우
    "#34D399", // 그린
    "#A78BFA", // 퍼플
    "#F472B6", // 핑크
    "#FB923C", // 오렌지
    "#38BDF8", // 스카이
  ],

  // ── 차트 보조 요소 ──
  gridLine: "rgba(48, 54, 61, 0.5)", // 격자선 (매우 은은하게)
  axisLine: "#30363D", // 축 선
  axisLabel: "#6E7681", // 축 레이블
  tooltipBg: "#1C2128", // 툴팁 배경
  tooltipBorder: "#30363D", // 툴팁 테두리
  crosshair: "rgba(139, 148, 158, 0.3)", // 크로스헤어
};

/** 라이트 테마 색상 */
export const lightColors = {
  background: "#FFFFFF",
  surface: "#F6F8FA",
  surfaceHover: "#F0F2F4",
  surfaceActive: "#EAEEF2",
  elevated: "#FFFFFF",

  border: "#D0D7DE",
  borderSubtle: "#E8ECF0",
  divider: "#D8DEE4",

  textPrimary: "#1F2328",
  textSecondary: "#656D76",
  textTertiary: "#8C959F",
  textDisabled: "#B1BAC4",

  positive: "#CF222E",
  positiveSubtle: "rgba(207, 34, 46, 0.08)",
  negative: "#0969DA",
  negativeSubtle: "rgba(9, 105, 218, 0.08)",

  accent: "#0969DA",
  accentSubtle: "rgba(9, 105, 218, 0.08)",
  accentMuted: "#0550AE",

  warning: "#9A6700",
  warningSubtle: "rgba(154, 103, 0, 0.08)",
  info: "#0969DA",
  infoSubtle: "rgba(9, 105, 218, 0.08)",

  series: [
    "#0969DA",
    "#CF222E",
    "#BF8700",
    "#1A7F37",
    "#8250DF",
    "#BF3989",
    "#BC4C00",
    "#0550AE",
  ],

  gridLine: "rgba(208, 215, 222, 0.5)",
  axisLine: "#D0D7DE",
  axisLabel: "#8C959F",
  tooltipBg: "#FFFFFF",
  tooltipBorder: "#D0D7DE",
  crosshair: "rgba(101, 109, 118, 0.2)",
};

// ─────────────────────────────────────────────
// 타이포그래피
// ─────────────────────────────────────────────

/**
 * 폰트 설정
 *
 * Geist Sans: UI 텍스트, 제목, 설명
 * Geist Mono: 수치, 축 레이블, 코드
 *
 * 왜 Mono를 수치에 쓰는가?
 * → 모노스페이스 폰트는 모든 숫자가 같은 폭이라서
 *   숫자가 정렬되고 비교하기 쉬움 (12,345 vs 98,765)
 */
export const typography = {
  fontFamily: {
    sans: '"Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif',
    mono: '"Geist Mono", "Geist Mono Fallback", ui-monospace, monospace',
  },

  fontSize: {
    // 차트 제목 / 헤드 메시지
    chartTitle: "48px",
    chartTitleWeight: "800",

    // 차트 부제목 / 메타 정보
    chartSubtitle: "27px",
    chartSubtitleWeight: "600",

    // 서브 메시지
    messageSubtitle: "33px",
    messageSubtitleWeight: "700",

    // 축 레이블
    axisLabel: "19px",
    axisLabelWeight: "600",

    // 데이터 수치 (포인트 라벨, 뱃지)
    dataValue: "20px",
    dataValueWeight: "800",

    // 큰 수치 (포커스 포인트, 헤드라인 수치)
    heroValue: "78px",
    heroValueWeight: "800",

    // 어노테이션 텍스트
    annotation: "20px",
    annotationWeight: "800",

    // 툴팁
    tooltip: "17px",
    tooltipWeight: "600",

    // 인사이트 / 메시지 패널
    insight: "36px",
    insightWeight: "700",
  },
};

// ─────────────────────────────────────────────
// 간격 / 레이아웃
// ─────────────────────────────────────────────

/**
 * 차트 레이아웃 설정
 *
 * 토스 스타일의 핵심: 여백이 넉넉해야 깔끔함
 * → 빽빽한 차트는 피로감, 여유 있는 차트는 신뢰감
 */
export const layout = {
  // 차트 영역 패딩
  chart: {
    paddingTop: 48, // 제목 + 여백
    paddingRight: 24,
    paddingBottom: 48, // 축 레이블 + 여백
    paddingLeft: 56, // Y축 레이블 공간
  },

  // 기본 차트 크기
  defaultSize: {
    width: 800,
    height: 450,
  },

  // 내보내기용 크기 (고해상도)
  exportSize: {
    width: 1920,
    height: 1080,
  },

  // 발표용 크기 (16:9)
  presentationSize: {
    width: 1280,
    height: 720,
  },

  // 요소 간 간격
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  // 둥근 모서리
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
};

// ─────────────────────────────────────────────
// 애니메이션
// ─────────────────────────────────────────────

/**
 * 애니메이션 설정
 *
 * 토스증권의 차트 애니메이션은:
 * → 부드럽지만 과하지 않음
 * → 데이터가 "그려지는" 느낌 (왼→오 순차 등장)
 * → 호버 시 살짝 확대, 즉각적 반응
 */
export const animation = {
  // 차트 등장 애니메이션
  chartEntrance: {
    duration: 800, // ms
    easing: "cubic-bezier(0.16, 1, 0.3, 1)", // easeOutExpo
    staggerDelay: 50, // 시리즈별 지연
  },

  // 호버 인터랙션
  hover: {
    duration: 150,
    easing: "ease-out",
    scale: 1.05, // 호버 시 확대 비율
  },

  // 툴팁 등장
  tooltip: {
    duration: 100,
    easing: "ease-out",
  },

  // 숫자 카운트업 (히어로 수치)
  countUp: {
    duration: 1200,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
};

// ─────────────────────────────────────────────
// 테마 합치기 (다크/라이트 통합)
// ─────────────────────────────────────────────

export type ThemeMode = "dark" | "light";

/**
 * getTheme
 *
 * 다크/라이트 모드에 따른 전체 테마 객체를 반환합니다.
 * → 차트 컴포넌트에서 이 함수를 호출해서 현재 테마의 색상을 가져옴
 *
 * @param mode - "dark" 또는 "light"
 * @returns 색상 + 타이포그래피 + 레이아웃 + 애니메이션
 */
export function getTheme(mode: ThemeMode = "dark") {
  return {
    colors: mode === "dark" ? darkColors : lightColors,
    typography,
    layout,
    animation,
    mode,
  };
}

export type TossTheme = ReturnType<typeof getTheme>;

// ─────────────────────────────────────────────
// Recharts용 스타일 헬퍼
// ─────────────────────────────────────────────

/**
 * getRechartsStyle
 *
 * Recharts 차트 컴포넌트에 바로 넣을 수 있는 스타일 객체를 반환합니다.
 * → <CartesianGrid />, <XAxis />, <YAxis /> 등에 직접 적용 가능
 *
 * @param mode - 테마 모드
 * @returns Recharts 스타일 속성들
 */
export function getRechartsStyle(mode: ThemeMode = "dark") {
  const colors = mode === "dark" ? darkColors : lightColors;

  return {
    /** CartesianGrid (격자선) */
    grid: {
      stroke: colors.gridLine,
      strokeDasharray: "3 3",
      vertical: false, // 세로 격자선은 숨김 (깔끔함)
    },

    /** XAxis */
    xAxis: {
      stroke: colors.axisLine,
      tick: {
        fill: colors.axisLabel,
        fontSize: parseInt(typography.fontSize.axisLabel),
        fontFamily: typography.fontFamily.mono,
        fontWeight: parseInt(typography.fontSize.axisLabelWeight),
      },
      axisLine: { stroke: colors.axisLine, strokeWidth: 1.4 },
      tickLine: false, // 눈금선 숨김 (깔끔함)
    },

    /** YAxis */
    yAxis: {
      stroke: colors.axisLine,
      tick: {
        fill: colors.axisLabel,
        fontSize: parseInt(typography.fontSize.axisLabel),
        fontFamily: typography.fontFamily.mono,
        fontWeight: parseInt(typography.fontSize.axisLabelWeight),
      },
      axisLine: false, // Y축 선 숨김 (격자선만으로 충분)
      tickLine: false,
    },

    /** Tooltip */
    tooltip: {
      contentStyle: {
        background: colors.tooltipBg,
        border: `1px solid ${colors.tooltipBorder}`,
        borderRadius: layout.borderRadius.lg,
        padding: "12px 16px",
        boxShadow:
          mode === "dark"
            ? "0 8px 24px rgba(0, 0, 0, 0.4)"
            : "0 8px 24px rgba(0, 0, 0, 0.1)",
        fontFamily: typography.fontFamily.sans,
        fontSize: typography.fontSize.tooltip,
      },
      labelStyle: {
        color: colors.textSecondary,
        marginBottom: 4,
      },
      itemStyle: {
        color: colors.textPrimary,
        fontFamily: typography.fontFamily.mono,
        fontWeight: 700,
      },
      cursor: {
        stroke: colors.crosshair,
        strokeWidth: 1.5,
      },
    },

    /** Legend */
    legend: {
      wrapperStyle: {
        fontFamily: typography.fontFamily.sans,
        fontSize: typography.fontSize.axisLabel,
        color: colors.textSecondary,
        fontWeight: 600,
      },
    },
  };
}
