/**
 * =====================================================
 * GET /api/projects/[slug] — 특정 프로젝트의 분석 데이터
 * =====================================================
 *
 * [slug]란?
 * → Next.js의 "동적 라우트 세그먼트"
 * → 대괄호 [ ] 안의 이름이 URL의 일부가 됨
 * → /api/projects/2026-03-24-semiconductor 로 요청하면
 *   slug = "2026-03-24-semiconductor" 가 됨
 *
 * 이 파일이 하는 일:
 * → data/2026-03-24-semiconductor/ 폴더의 모든 JSON 파일을 읽어서
 * → 차트 분석 데이터 배열을 반환
 */

import { NextResponse } from "next/server";
import type { VisualAnalysis } from "@/lib/analysis/schema";
import {
  getProjectAnalyses,
  getProjectTopic,
  parseProjectSlug,
} from "@/lib/project-manager";

function stripNewsAssetSuffixes(stem: string): string {
  return stem
    .replace(
      /(?:[-_](news|article|screenshot|screen|capture|source|raw|orig|original))+$/i,
      ""
    )
    .replace(/(?:[-_]photo)$/i, "");
}

function buildProjectAssetUrl(slug: string, assetPath: string): string {
  const encodedPath = assetPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/api/projects/${encodeURIComponent(slug)}/assets/${encodedPath}`;
}

function buildDerivedNewsPhotoPath(sourceImage: string): string | undefined {
  if (!sourceImage) {
    return undefined;
  }

  const normalizedPath = sourceImage.replaceAll("\\", "/");
  const segments = normalizedPath.split("/");
  const fileName = segments.pop();

  if (!fileName) {
    return undefined;
  }

  const fileStem = stripNewsAssetSuffixes(fileName.replace(/\.[^.]+$/, ""));
  const derivedFileName = `${fileStem}-photo.png`;

  return [...segments, derivedFileName].filter(Boolean).join("/");
}

function resolveAnalysisAssetUrls(
  slug: string,
  analysis: VisualAnalysis
): VisualAnalysis {
  if (
    !("contentType" in analysis) ||
    analysis.contentType !== "infographic" ||
    analysis.infographicData.subType !== "news_brief"
  ) {
    return analysis;
  }

  const derivedMediaPath = buildDerivedNewsPhotoPath(analysis.sourceImage);
  const baseMedia =
    analysis.infographicData.media.length > 0
      ? analysis.infographicData.media
      : derivedMediaPath
        ? [{ path: derivedMediaPath, alt: analysis.structure.title }]
        : [];

  return {
    ...analysis,
    infographicData: {
      ...analysis.infographicData,
      media: baseMedia.map((media) => {
        const resolvedPath = media.path ?? derivedMediaPath;

        return resolvedPath && !media.url
          ? {
              ...media,
              path: resolvedPath,
              url: buildProjectAssetUrl(slug, resolvedPath),
            }
          : media;
      }),
    },
  };
}

/**
 * GET /api/projects/[slug]
 *
 * Next.js 16에서는 params가 비동기(async)입니다.
 * → await params 로 값을 꺼내야 함 (Next.js 16 breaking change)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // 슬러그에서 날짜와 주제 파싱
  const { date, topic: fallbackTopic } = parseProjectSlug(slug);
  const topic = await getProjectTopic(slug) || fallbackTopic;

  // 해당 프로젝트의 모든 분석 JSON 로드
  const analyses = (await getProjectAnalyses(slug)).map((analysis) =>
    resolveAnalysisAssetUrls(slug, analysis)
  );

  if (analyses.length === 0) {
    return NextResponse.json(
      {
        slug,
        date,
        topic,
        analyses: [],
        message: "이 프로젝트에 분석 데이터가 없습니다.",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    slug,
    date,
    topic,
    analyses,
    count: analyses.length,
  });
}
