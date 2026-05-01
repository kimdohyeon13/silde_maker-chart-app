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
// 분석 결과 검증
// ─────────────────────────────────────────────

/**
 * validateAnalysis
 *
 * Claude가 출력한 JSON이 스키마에 맞는지 검증합니다.
 * → 필수 필드 누락, 타입 오류 등을 잡아냄
 * → 차트, 표, 인포그래픽 각각의 검증 로직을 contentType으로 분기
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

  const d = data as Record<string, unknown>;

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
