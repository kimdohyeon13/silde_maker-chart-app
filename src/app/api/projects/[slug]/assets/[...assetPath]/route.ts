import { readFile, stat } from "fs/promises";
import { extname } from "path";
import { NextResponse } from "next/server";
import {
  resolveExistingPathWithin,
  resolvePathWithin,
} from "@/lib/path-safety";
import { PATHS } from "@/lib/project-manager";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

type ProjectAssetPath = {
  projectRoot: string;
  requestedPath: string;
};

function resolveProjectAssetPath(
  slug: string,
  assetPath: string[]
): ProjectAssetPath | null {
  if (assetPath.length === 0) {
    return null;
  }

  const projectRoot = resolvePathWithin(PATHS.PROJECTS_ROOT, slug);
  const requestedPath = assetPath.join("/");
  if (!projectRoot || !resolvePathWithin(projectRoot, requestedPath)) {
    return null;
  }

  return { projectRoot, requestedPath };
}

function getMimeType(filePath: string): string | null {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; assetPath: string[] }> }
) {
  const { slug, assetPath } = await params;
  const resolvedPath = resolveProjectAssetPath(slug, assetPath);

  if (!resolvedPath) {
    return NextResponse.json({ error: "잘못된 자산 경로입니다." }, { status: 400 });
  }

  try {
    const filePath = await resolveExistingPathWithin(
      resolvedPath.projectRoot,
      resolvedPath.requestedPath
    );
    if (!filePath) {
      return NextResponse.json({ error: "이미지 파일을 찾을 수 없습니다." }, { status: 404 });
    }

    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) {
      return NextResponse.json({ error: "파일이 아닙니다." }, { status: 400 });
    }

    const mimeType = getMimeType(filePath);
    if (!mimeType) {
      return NextResponse.json({ error: "지원하지 않는 이미지 형식입니다." }, { status: 415 });
    }

    const buffer = await readFile(filePath);
    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        ...(mimeType === "image/svg+xml"
          ? { "Content-Security-Policy": "sandbox; default-src 'none'" }
          : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "이미지 파일을 찾을 수 없습니다." }, { status: 404 });
  }
}
