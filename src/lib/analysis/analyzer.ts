/**
 * =====================================================
 * 차트 분석 오케스트레이터 (Orchestrator)
 * =====================================================
 *
 * 오케스트라의 지휘자처럼, 분석의 전체 흐름을 조율합니다.
 *
 * 순서:
 * 1. 이미지 파일 읽기
 * 2. Claude Vision에게 분석 요청 (프롬프트 + 이미지)
 * 3. 응답 JSON 파싱 및 검증
 * 4. 인사이트 엔진으로 후처리
 * 5. 최종 ChartAnalysis 객체 반환
 *
 * 이 파일은 두 가지 모드를 지원합니다:
 *
 * A. API 모드 — Next.js API 라우트에서 Claude API를 직접 호출
 *    → 웹앱에서 이미지 업로드 시 사용
 *
 * B. 파일 모드 — 이미 분석된 JSON 파일을 읽어서 후처리만 수행
 *    → Claude Code 스킬에서 분석한 결과를 Next.js 앱이 렌더링할 때 사용
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import type { VisualAnalysis } from "./schema";
import { isChartAnalysis } from "./schema";
import { postProcessAnalysis } from "./insight-engine";

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

/** 분석 옵션 */
export interface AnalyzeOptions {
  /** 이미지 파일 경로 (파일 모드) */
  imagePath?: string;
  /** 이미지 base64 (API 모드) */
  imageBase64?: string;
  /** 이미지 MIME 타입 */
  mimeType?: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  /** 사용자 제공 맥락 */
  context?: string;
  /** 정보 밀도 */
  density?: "minimal" | "balanced" | "detailed";
}

/** 분석 결과 (성공 시) */
export interface AnalysisResult {
  success: true;
  analysis: VisualAnalysis;
  /** 분석 소요 시간 (ms) */
  duration: number;
}

/** 분석 결과 (실패 시) */
export interface AnalysisError {
  success: false;
  error: string;
  details?: string;
}

// ─────────────────────────────────────────────
// 메인 분석 함수
// ─────────────────────────────────────────────

/**
 * analyzeChart
 *
 * 차트 이미지를 분석합니다.
 * Claude Vision API를 호출하여 6단계 레이어 분석을 수행합니다.
 *
 * @param options - 분석 옵션 (이미지 경로 또는 base64)
 * @returns 분석 결과 또는 에러
 */
export async function analyzeChart(
  options: AnalyzeOptions
): Promise<AnalysisResult | AnalysisError> {
  const startTime = Date.now();

  try {
    // 1. 이미지 준비
    let imageBase64 = options.imageBase64;
    let mimeType = options.mimeType || "image/png";

    if (options.imagePath && !imageBase64) {
      const buffer = await readFile(options.imagePath);
      imageBase64 = buffer.toString("base64");

      // 확장자로 MIME 타입 추론
      const ext = options.imagePath.toLowerCase().split(".").pop();
      if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "webp") mimeType = "image/webp";
      else if (ext === "gif") mimeType = "image/gif";
    }

    if (!imageBase64) {
      return {
        success: false,
        error: "이미지가 제공되지 않았습니다.",
        details: "imagePath 또는 imageBase64 중 하나를 제공해야 합니다.",
      };
    }

    // 2. Claude Vision API 호출을 위한 메시지 구성
    //    (실제 API 호출은 API 라우트에서 수행)
    const analysisRequest = {
      imageBase64,
      mimeType,
      context: options.context,
      density: options.density || "balanced",
    };

    // API 라우트로 분석 요청 전달
    // (이 함수 자체는 서버 사이드에서 실행됨)
    const rawAnalysis = await callAnalysisAPI(analysisRequest);

    if (!rawAnalysis) {
      return {
        success: false,
        error: "분석 결과를 받지 못했습니다.",
      };
    }

    // 3. 후처리 (인사이트 랭킹 + 시각 강조 계획)
    const processedAnalysis = isChartAnalysis(rawAnalysis)
      ? postProcessAnalysis(rawAnalysis, options.density || "balanced")
      : rawAnalysis;

    const duration = Date.now() - startTime;

    return {
      success: true,
      analysis: {
        ...processedAnalysis,
        id: randomUUID(),
        analyzedAt: new Date().toISOString(),
        analysisDuration: duration,
      },
      duration,
    };
  } catch (error) {
    return {
      success: false,
      error: "분석 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─────────────────────────────────────────────
// JSON 파일 기반 분석 (Claude Code 워크플로우용)
// ─────────────────────────────────────────────

/**
 * loadAnalysisFromFile
 *
 * Claude Code 스킬이 분석한 결과 JSON 파일을 읽어서
 * 후처리(인사이트 랭킹 + 시각 강조)를 수행합니다.
 *
 * 워크플로우:
 * 1. Claude Code가 이미지를 분석하여 JSON 파일 생성
 * 2. 이 함수가 JSON 파일을 읽어서 후처리
 * 3. Next.js 앱이 후처리된 결과를 렌더링
 *
 * @param jsonPath - 분석 결과 JSON 파일 경로
 * @param density - 정보 밀도
 * @returns 후처리된 분석 결과
 */
export async function loadAnalysisFromFile(
  jsonPath: string,
  density: "minimal" | "balanced" | "detailed" = "balanced"
): Promise<AnalysisResult | AnalysisError> {
  const startTime = Date.now();

  try {
    const content = await readFile(jsonPath, "utf-8");
    const rawAnalysis: VisualAnalysis = JSON.parse(content);

    // 후처리
    const processedAnalysis = isChartAnalysis(rawAnalysis)
      ? postProcessAnalysis(rawAnalysis, density)
      : rawAnalysis;

    return {
      success: true,
      analysis: processedAnalysis,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: `파일 로드 실패: ${jsonPath}`,
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * loadAllAnalyses
 *
 * data/ 디렉토리의 모든 분석 JSON을 일괄 로드합니다.
 * → 대시보드에서 모든 차트를 한 번에 보여줄 때 사용
 *
 * @param dataDir - 분석 JSON 파일들이 있는 디렉토리
 * @param density - 정보 밀도
 * @returns 모든 분석 결과 배열
 */
export async function loadAllAnalyses(
  dataDir: string,
  density: "minimal" | "balanced" | "detailed" = "balanced"
): Promise<(AnalysisResult | AnalysisError)[]> {
  const { readdir } = await import("fs/promises");

  try {
    const files = await readdir(dataDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    // 병렬 처리! 10개 파일이면 10개 동시에 로드
    const results = await Promise.all(
      jsonFiles.map((file) =>
        loadAnalysisFromFile(join(dataDir, file), density)
      )
    );

    return results;
  } catch (error) {
    return [
      {
        success: false,
        error: `디렉토리 접근 실패: ${dataDir}`,
        details: error instanceof Error ? error.message : String(error),
      },
    ];
  }
}

// ─────────────────────────────────────────────
// 내부 API 호출 함수
// ─────────────────────────────────────────────

/**
 * callAnalysisAPI
 *
 * 실제 Claude Vision API를 호출하는 내부 함수.
 * 현재는 placeholder — API 라우트에서 실제 구현됩니다.
 *
 * 이 함수가 하는 일:
 * 1. 프롬프트 + 이미지를 Claude에게 전송
 * 2. Claude의 응답(JSON)을 파싱
 * 3. 스키마 검증
 * 4. ChartAnalysis 객체 반환
 */
async function callAnalysisAPI(_request: {
  imageBase64: string;
  mimeType: string;
  context?: string;
  density: string;
}): Promise<VisualAnalysis | null> {
  void _request;

  // TODO: 실제 Claude API 호출 구현
  // API 라우트 /api/analyze에서 이 로직을 실행
  // 여기서는 파일 기반 모드만 우선 지원

  console.log("[analyzer] API 모드는 /api/analyze 라우트를 사용하세요.");
  console.log("[analyzer] 파일 모드는 loadAnalysisFromFile()를 사용하세요.");

  return null;
}

// ─────────────────────────────────────────────
// contentType 2차 검증 (오분류 재분류 훅) — P0-1
// ─────────────────────────────────────────────
//
// 왜 필요한가?
// → 1차 분류(프롬프트)는 가끔 시계열/축 기반 그림을 infographic·table로 오분류한다.
// → 이 경우 데이터가 카드/표로 평탄화되어 구조가 파괴된다(근본원인 1·2).
// → 그래서 파싱된 JSON 자체의 "구조적 신호"를 보고, chart로 되돌릴 수 있으면 재분류한다.
//
// ⚠️ 한계(정직하게 명시):
// → 이 훅은 "원본 썸네일 픽셀 대조"가 아니라 **JSON 구조 신호 기반**이다.
//   (이 모듈에는 원본 이미지 바이트가 없고, 실제 Vision 호출은 /api/analyze 라우트에서 일어남)
// → 따라서 1차 시각 분류 보강의 핵심은 prompts.ts의 0단계 분류 결정트리·강등 금지 가드이며,
//   이 훅은 그 뒤를 받치는 2차 안전망(safety net)이다.
// → 픽셀 단위 재대조가 필요하면 API 라우트에서 원본 이미지와 함께 재호출하는 별도 단계가 필요하다.

/** 재분류 판정 결과 */
export interface ReclassifyResult {
  /** 재분류가 일어났는지 */
  reclassified: boolean;
  /** 판정된(또는 원래) contentType — 차트면 undefined */
  contentType?: "table" | "infographic";
  /** 판정 근거(사람이 읽는 설명) */
  reason: string;
  /** 재분류된(또는 원본 그대로의) 데이터 — 불변성 유지를 위해 새 객체로 반환 */
  data: Record<string, unknown>;
}

/** 문자열이 날짜/연도/시계열 라벨처럼 보이는지 (예: "2024", "26F", "2024-01", "1Q24") */
function looksLikeTimeLabel(v: unknown): boolean {
  if (typeof v === "number") return v >= 1900 && v <= 2100; // 연도 추정
  if (typeof v !== "string") return false;
  const s = v.trim();
  // YYYY / YYYY-MM / YYYY.MM / 'NNF(전망) / 1QNN(분기) / NN년 등
  return (
    /^\d{4}([-.\/]\d{1,2})?$/.test(s) ||
    /^\d{2,4}F$/i.test(s) ||
    /^[1-4]Q\d{2,4}$/i.test(s) ||
    /^\d{2,4}\s*년/.test(s) ||
    /^\d{4}(년)?\s*\d{1,2}\s*월$/.test(s)
  );
}

/**
 * reclassifyIfMisclassified
 *
 * 파싱된 분석 JSON이 infographic·table로 분류돼 있지만,
 * 구조 신호상 명백히 시계열/축 기반 차트면 chart로 되돌린다.
 *
 * 재분류 신호(하나라도 강하게 충족하면 chart로 승격):
 *  - structure에 chartType / xAxis.tickValues / panels 등 "축·차트" 구조가 살아 있음
 *  - infographic items의 라벨이 시계열(날짜/연도)처럼 줄지어 있음(시계열을 카드로 펼친 정황)
 *
 * 불변성: 입력을 수정하지 않고, 재분류 시 contentType을 제거한 새 객체를 반환한다.
 *
 * @param data - 파싱된 JSON 데이터(객체)
 * @returns 재분류 판정 + (필요 시 chart로 승격된) 새 데이터
 */
export function reclassifyIfMisclassified(data: unknown): ReclassifyResult {
  if (!data || typeof data !== "object") {
    return { reclassified: false, reason: "데이터가 객체가 아님", data: {} };
  }
  const d = data as Record<string, unknown>;
  const contentType = d.contentType as "table" | "infographic" | undefined;

  // 이미 차트(contentType 없음)면 건드리지 않는다.
  if (contentType !== "table" && contentType !== "infographic") {
    return { reclassified: false, reason: "이미 chart로 분류됨", data: d };
  }

  const structure = (d.structure as Record<string, unknown>) || {};
  const hasChartType = typeof structure.chartType === "string" && structure.chartType.length > 0;
  const hasPanels = Array.isArray(structure.panels) && structure.panels.length > 0;
  const xAxis = structure.xAxis as Record<string, unknown> | undefined;
  const yAxis = structure.yAxis as Record<string, unknown> | undefined;
  const hasAxisTicks =
    (!!xAxis && Array.isArray(xAxis.tickValues) && xAxis.tickValues.length > 0) ||
    (!!yAxis && Array.isArray(yAxis.tickValues) && yAxis.tickValues.length > 0);

  // 인포그래픽 항목 라벨이 시계열처럼 줄지어 있는지 검사
  let timeSeriesLikeItems = false;
  if (contentType === "infographic") {
    const igData = d.infographicData as Record<string, unknown> | undefined;
    const items = (igData?.items as Array<Record<string, unknown>>) || [];
    if (items.length >= 4) {
      const timeLabelCount = items.filter((it) => looksLikeTimeLabel(it?.label)).length;
      // 항목 다수가 날짜/연도 라벨이면 "시계열을 카드로 펼친" 오분류로 본다
      timeSeriesLikeItems = timeLabelCount >= Math.ceil(items.length * 0.6);
    }
  }

  const shouldBeChart = hasChartType || hasPanels || hasAxisTicks || timeSeriesLikeItems;

  if (!shouldBeChart) {
    return {
      reclassified: false,
      reason: `${contentType} 분류 유지 — 차트 구조 신호 없음`,
      data: d,
    };
  }

  // 재분류: contentType을 제거해 chart로 승격한 새 객체 반환 (원본 불변)
  const reasonBits: string[] = [];
  if (hasChartType) reasonBits.push("structure.chartType 존재");
  if (hasPanels) reasonBits.push("structure.panels 존재");
  if (hasAxisTicks) reasonBits.push("축 tickValues 존재");
  if (timeSeriesLikeItems) reasonBits.push("항목 라벨이 시계열(날짜/연도)");

  const { contentType: _removed, ...rest } = d;
  void _removed;

  return {
    reclassified: true,
    contentType: undefined,
    reason: `${contentType} → chart 재분류: ${reasonBits.join(", ")}`,
    data: rest,
  };
}

// ─────────────────────────────────────────────
// 분석 결과 검증
// ─────────────────────────────────────────────

/**
 * validateAnalysis
 *
 * Claude가 출력한 JSON이 스키마에 맞는지 검증합니다.
 * → 필수 필드 누락, 타입 오류 등을 잡아냄
 * → 차트, 표, 인포그래픽 각각의 검증 로직을 contentType으로 분기
 * → 검증 전에 reclassifyIfMisclassified로 오분류된 시계열/축 차트를 chart로 되돌린 뒤 검증한다.
 *
 * @param data - 파싱된 JSON 데이터
 * @returns 검증 결과
 */
export function validateAnalysis(data: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["데이터가 객체가 아닙니다."] };
  }

  // 2차 검증: 시계열/축 기반인데 infographic·table로 오분류됐으면 chart로 되돌린 뒤 검증
  const reclassified = reclassifyIfMisclassified(data);
  const d = reclassified.data;

  // contentType으로 분기: "table", "infographic", 또는 차트(기본)
  const contentType = d.contentType as string | undefined;

  if (contentType === "table") {
    // ── 표 검증 ──
    validateTableAnalysis(d, errors);
  } else if (contentType === "infographic") {
    // ── 인포그래픽 검증 ──
    validateInfographicAnalysis(d, errors);
  } else {
    // ── 기존 차트 검증 (변경 없음) ──
    validateChartAnalysis(d, errors);
  }

  return { valid: errors.length === 0, errors };
}

/** 차트 전용 검증 (기존 로직 그대로) */
function validateChartAnalysis(d: Record<string, unknown>, errors: string[]): void {
  const requiredFields = [
    "structure",
    "data",
    "statistics",
    "patterns",
    "narrative",
    "emphasis",
  ];
  for (const field of requiredFields) {
    if (!d[field]) {
      errors.push(`필수 필드 누락: ${field}`);
    }
  }

  if (d.structure && typeof d.structure === "object") {
    const s = d.structure as Record<string, unknown>;
    if (!s.chartType) errors.push("structure.chartType 누락");
    if (!s.title) errors.push("structure.title 누락");
    if (!s.xAxis) errors.push("structure.xAxis 누락");
    if (!s.yAxis) errors.push("structure.yAxis 누락");
  }

  if (d.data && typeof d.data === "object") {
    const dt = d.data as Record<string, unknown>;
    if (!Array.isArray(dt.series)) errors.push("data.series가 배열이 아닙니다");
    if (typeof dt.totalDataPoints !== "number")
      errors.push("data.totalDataPoints 누락");
  }

  if (d.narrative && typeof d.narrative === "object") {
    const n = d.narrative as Record<string, unknown>;
    if (!n.headline) errors.push("narrative.headline 누락");
    if (!n.summary) errors.push("narrative.summary 누락");
    if (!n.story) errors.push("narrative.story 누락");
  }
}

/** 표 전용 검증 */
function validateTableAnalysis(d: Record<string, unknown>, errors: string[]): void {
  if (!d.tableSubType) errors.push("tableSubType 누락");
  if (!d.structure) errors.push("structure 누락");
  if (!d.narrative) errors.push("narrative 누락");
  if (!d.emphasis) errors.push("emphasis 누락");

  if (d.structure && typeof d.structure === "object") {
    const s = d.structure as Record<string, unknown>;
    if (!s.title) errors.push("structure.title 누락");
  }

  if (!d.tableData) {
    errors.push("tableData 누락");
  } else if (typeof d.tableData === "object") {
    const td = d.tableData as Record<string, unknown>;
    if (!Array.isArray(td.columns)) errors.push("tableData.columns가 배열이 아닙니다");
    if (!Array.isArray(td.rows)) errors.push("tableData.rows가 배열이 아닙니다");
  }
}

/** 인포그래픽 전용 검증 */
function validateInfographicAnalysis(d: Record<string, unknown>, errors: string[]): void {
  if (!d.structure) errors.push("structure 누락");
  if (!d.narrative) errors.push("narrative 누락");
  if (!d.emphasis) errors.push("emphasis 누락");

  if (d.structure && typeof d.structure === "object") {
    const s = d.structure as Record<string, unknown>;
    if (!s.title) errors.push("structure.title 누락");
  }

  if (!d.infographicData) {
    errors.push("infographicData 누락");
  } else if (typeof d.infographicData === "object") {
    const ig = d.infographicData as Record<string, unknown>;
    if (!ig.subType) errors.push("infographicData.subType 누락");
  }
}
