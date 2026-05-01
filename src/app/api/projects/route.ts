/**
 * =====================================================
 * GET /api/projects — 프로젝트 목록 API
 * =====================================================
 *
 * 이 파일이 하는 일:
 * → 브라우저가 GET /api/projects 를 호출하면
 * → data/ 폴더를 스캔해서 프로젝트 목록을 JSON으로 반환
 *
 * Route Handler란?
 * → Next.js App Router에서 API 엔드포인트를 만드는 방법
 * → app/api/projects/route.ts → GET /api/projects 로 접근 가능
 * → export async function GET() { ... } 형태로 작성
 *
 * NextResponse란?
 * → Next.js에서 HTTP 응답을 만드는 도우미 객체
 * → NextResponse.json(data) → JSON 응답 반환
 */

import { NextResponse } from "next/server";
import {
  createProject,
  listProjects,
  toProjectListItem,
} from "@/lib/project-manager";

/**
 * GET /api/projects
 * → 모든 프로젝트 목록 반환
 */
export async function GET() {
  const projects = (await listProjects()).map(toProjectListItem);
  return NextResponse.json({ projects });
}

/**
 * POST /api/projects
 * → 새 프로젝트 생성
 *
 * 요청 바디 예시:
 * { "topic": "반도체 수출 분석" }
 * { "topic": "kospi-sectors", "date": "2026-03-24" }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, date } = body;

    if (!topic || typeof topic !== "string") {
      return NextResponse.json(
        { error: "topic은 필수입니다." },
        { status: 400 }
      );
    }

    const dateObj = date ? new Date(date) : undefined;
    const result = await createProject(topic, dateObj);

    if (result.success) {
      return NextResponse.json(result, { status: 201 });
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "잘못된 요청입니다.", details: String(error) },
      { status: 400 }
    );
  }
}
