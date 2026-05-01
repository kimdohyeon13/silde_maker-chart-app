import type { ChartAnalysis, VisualAnalysis } from "@/lib/analysis/schema";

export interface ProjectPaths {
  root: string;
  input: string;
  data: string;
  exports: string;
  meta: string;
}

export interface ProjectMetadata {
  topic: string;
  slug: string;
  createdAt: string;
  slugVersion: number;
}

export interface ProjectInfo {
  slug: string;
  date: string;
  topic: string;
  imageCount: number;
  analysisCount: number;
  paths: ProjectPaths;
}

export interface ProjectListItem {
  slug: string;
  date: string;
  topic: string;
  imageCount: number;
  analysisCount: number;
}

export interface CreateProjectResult {
  success: boolean;
  slug: string;
  paths: ProjectPaths;
  error?: string;
}

export interface ProjectListResponse {
  projects: ProjectListItem[];
}

/**
 * 프로젝트의 분석 결과 응답
 *
 * analyses 타입이 VisualAnalysis[] — 차트, 표, 인포그래픽 모두 포함 가능
 * (기존 ChartAnalysis도 VisualAnalysis의 일부이므로 하위 호환)
 */
export interface ProjectAnalysesResponse {
  slug: string;
  date: string;
  topic: string;
  analyses: VisualAnalysis[];
  count?: number;
  message?: string;
}

/**
 * @deprecated ChartAnalysis[] 대신 VisualAnalysis[]를 사용하세요.
 * 기존 코드 호환을 위해 re-export
 */
export type { ChartAnalysis, VisualAnalysis };
