import { readFile, stat } from "fs/promises";
import { extname, resolve } from "path";
import { NextResponse } from "next/server";
import { PATHS } from "@/lib/project-manager";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function resolveProjectAssetPath(slug: string, assetPath: string[]): string | null {
  if (assetPath.length === 0) {
    return null;
  }

  const projectRoot = resolve(PATHS.PROJECTS_ROOT, slug);
  const requestedPath = assetPath.map(decodeURIComponent).join("/");
  const absolutePath = resolve(projectRoot, requestedPath);

  if (!absolutePath.startsWith(projectRoot)) {
    return null;
  }

  return absolutePath;
}

function getMimeType(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; assetPath: string[] }> }
) {
  const { slug, assetPath } = await params;
  const filePath = resolveProjectAssetPath(slug, assetPath);

  if (!filePath) {
    return NextResponse.json({ error: "잘못된 자산 경로입니다." }, { status: 400 });
  }

  try {
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) {
      return NextResponse.json({ error: "파일이 아닙니다." }, { status: 400 });
    }

    const buffer = await readFile(filePath);
    return new Response(buffer, {
      headers: {
        "Content-Type": getMimeType(filePath),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "이미지 파일을 찾을 수 없습니다." }, { status: 404 });
  }
}
