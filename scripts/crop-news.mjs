#!/usr/bin/env node
/**
 * =====================================================
 * crop-news.mjs — 뉴스 기사 스크린샷에서 사진 영역 자동 크롭
 * =====================================================
 *
 * 사용법:
 *   npm run crop-news -- 2026-04-05-news-brief-demo
 *   npm run crop-news -- 2026-04-05-news-brief-demo --force
 *   npm run crop-news -- /absolute/path/to/image.png
 *
 * 핵심 아이디어:
 * 1. 이미지를 작은 크기로 축소해 빠르게 분석
 * 2. "흰 배경이 아닌 픽셀이 조밀하게 몰린 큰 가로 구간"을 찾음
 * 3. 그 구간 안에서 다시 좌우 경계를 계산
 * 4. 원본 해상도 기준으로 잘라서 `-photo.png` 파일 저장
 *
 * 왜 이 방식이 통하나?
 * → 기사 스크린샷의 텍스트는 흰 배경 위에 띄엄띄엄 놓임
 * → 반면 기사 사진은 큰 직사각형 안에 픽셀이 빽빽하게 차 있음
 * → 그래서 "행/열 밀도"만으로도 꽤 안정적으로 사진 블록을 찾을 수 있음
 */

import { existsSync, readdirSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { basename, dirname, extname, relative, resolve, sep } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const ANALYSIS_WIDTH = 480;

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHART_APP_ROOT = resolve(__dirname, "..");
const SILDE_MAKER_ROOT = resolve(CHART_APP_ROOT, "..", "..");
const PROJECTS_ROOT = resolve(SILDE_MAKER_ROOT, "projects");
const DATA_ROOT = resolve(CHART_APP_ROOT, "src", "data");

function log(icon, message) {
  console.log(`${icon}  ${message}`);
}

function showUsage() {
  console.log(`
사용법:
  npm run crop-news -- <project-slug> [--force]
  npm run crop-news -- <image-file-or-directory> [--force]

예시:
  npm run crop-news -- 2026-04-05-news-brief-demo
  npm run crop-news -- 2026-04-05-news-brief-demo --force
`);
}

function parseArgs(argv) {
  const force = argv.includes("--force");
  const dryRun = argv.includes("--dry-run");
  const targets = argv.filter((arg) => !arg.startsWith("--"));

  if (targets.length === 0) {
    showUsage();
    process.exit(1);
  }

  return { force, dryRun, targets };
}

function isImageFile(filePath) {
  return IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function isAlreadyCropped(filePath) {
  return /(?:^|[-_])photo$/i.test(basename(filePath, extname(filePath)));
}

function stripKnownSuffixes(stem) {
  return stem.replace(
    /(?:[-_](news|article|screenshot|screen|capture|source|raw|orig|original))+$/i,
    ""
  );
}

function normalizeNewsStem(stem) {
  return stripKnownSuffixes(stem).replace(/(?:[-_]photo)$/i, "");
}

function buildOutputPath(inputPath) {
  const ext = extname(inputPath).toLowerCase();
  const dir = dirname(inputPath);
  const stem = basename(inputPath, ext);
  const normalizedStem = stripKnownSuffixes(stem);
  return resolve(dir, `${normalizedStem}-photo.png`);
}

function resolveTargets(targets) {
  const files = [];

  for (const target of targets) {
    const directPath = resolve(target);

    if (existsSync(directPath)) {
      const stats = readdirOrStat(directPath);
      if (stats.kind === "file") {
        if (isImageFile(directPath) && !isAlreadyCropped(directPath)) {
          files.push(directPath);
        }
        continue;
      }

      if (stats.kind === "dir") {
        files.push(...listImageFiles(directPath));
        continue;
      }
    }

    const projectInputDir = resolve(PROJECTS_ROOT, target, "input");
    if (!existsSync(projectInputDir)) {
      throw new Error(`입력 경로를 찾을 수 없습니다: ${target}`);
    }

    files.push(...listImageFiles(projectInputDir));
  }

  return Array.from(new Set(files));
}

function readdirOrStat(path) {
  try {
    return { kind: "dir", entries: readdirSync(path, { withFileTypes: true }) };
  } catch {
    return { kind: "file" };
  }
}

function listImageFiles(directoryPath) {
  return readdirSync(directoryPath)
    .map((name) => resolve(directoryPath, name))
    .filter((filePath) => isImageFile(filePath) && !isAlreadyCropped(filePath))
    .sort();
}

function listJsonFiles(directoryPath) {
  if (!existsSync(directoryPath)) {
    return [];
  }

  return readdirSync(directoryPath)
    .filter((name) => extname(name).toLowerCase() === ".json")
    .map((name) => resolve(directoryPath, name))
    .sort();
}

function normalizePathSlashes(filePath) {
  return filePath.replaceAll("\\", "/");
}

function getProjectSlugFromInputPath(inputPath) {
  const relativePath = relative(PROJECTS_ROOT, resolve(inputPath));

  if (!relativePath || relativePath.startsWith("..")) {
    return null;
  }

  const segments = relativePath.split(sep);
  if (segments.length >= 3 && segments[1] === "input") {
    return segments[0];
  }

  return null;
}

function buildProjectRelativeAssetPath(projectSlug, absolutePath) {
  const projectRoot = resolve(PROJECTS_ROOT, projectSlug);
  return normalizePathSlashes(relative(projectRoot, absolutePath));
}

function isNewsBriefAnalysis(analysis) {
  return (
    analysis &&
    analysis.contentType === "infographic" &&
    analysis.infographicData &&
    analysis.infographicData.subType === "news_brief"
  );
}

function collectNewsMatchKeys(analysis, jsonPath) {
  const keys = new Set();
  const jsonStem = basename(jsonPath, extname(jsonPath));
  keys.add(normalizeNewsStem(jsonStem));

  if (typeof analysis.sourceImage === "string") {
    const sourceStem = basename(
      analysis.sourceImage,
      extname(analysis.sourceImage)
    );
    keys.add(normalizeNewsStem(sourceStem));
  }

  const mediaItems = Array.isArray(analysis.infographicData?.media)
    ? analysis.infographicData.media
    : [];

  for (const media of mediaItems) {
    if (!media?.path) continue;
    const mediaStem = basename(media.path, extname(media.path));
    keys.add(normalizeNewsStem(mediaStem));
  }

  return keys;
}

async function syncNewsJsonWithCroppedPhoto(result) {
  const projectSlug = getProjectSlugFromInputPath(result.inputPath);

  if (!projectSlug || !result.outputPath) {
    return [];
  }

  const dataDir = resolve(DATA_ROOT, projectSlug);
  const desiredMediaPath = buildProjectRelativeAssetPath(
    projectSlug,
    result.outputPath
  );
  const inputKey = normalizeNewsStem(
    basename(result.inputPath, extname(result.inputPath))
  );
  const linkedJsonPaths = [];

  for (const jsonPath of listJsonFiles(dataDir)) {
    let rawJson;
    let analysis;

    try {
      rawJson = await readFile(jsonPath, "utf8");
      analysis = JSON.parse(rawJson);
    } catch (error) {
      console.warn(
        `⚠️  ${basename(jsonPath)} JSON을 읽지 못해 건너뜀: ${error.message}`
      );
      continue;
    }

    if (!isNewsBriefAnalysis(analysis)) {
      continue;
    }

    const matchKeys = collectNewsMatchKeys(analysis, jsonPath);
    if (!matchKeys.has(inputKey)) {
      continue;
    }

    const mediaItems = Array.isArray(analysis.infographicData.media)
      ? [...analysis.infographicData.media]
      : [];
    const fallbackAlt =
      analysis.structure?.title?.trim() || "뉴스 기사 대표 이미지";
    let updated = false;

    if (mediaItems.length === 0) {
      mediaItems.push({
        path: desiredMediaPath,
        alt: fallbackAlt,
      });
      updated = true;
    } else {
      const targetIndex = Math.max(
        0,
        mediaItems.findIndex((media) => {
          if (!media?.path) return true;
          const mediaStem = basename(media.path, extname(media.path));
          return normalizeNewsStem(mediaStem) === inputKey;
        })
      );
      const targetMedia = { ...mediaItems[targetIndex] };

      if (targetMedia.path !== desiredMediaPath) {
        targetMedia.path = desiredMediaPath;
        updated = true;
      }

      if (!targetMedia.alt?.trim()) {
        targetMedia.alt = fallbackAlt;
        updated = true;
      }

      mediaItems[targetIndex] = targetMedia;
    }

    if (!updated) {
      continue;
    }

    analysis.infographicData.media = mediaItems;
    await writeFile(jsonPath, `${JSON.stringify(analysis, null, 2)}\n`);
    linkedJsonPaths.push(jsonPath);
  }

  return linkedJsonPaths;
}

function computeStats(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

function smooth(values, radius = 3) {
  return values.map((_, index) => {
    let sum = 0;
    let count = 0;

    for (let offset = -radius; offset <= radius; offset += 1) {
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= values.length) continue;
      sum += values[nextIndex];
      count += 1;
    }

    return count > 0 ? sum / count : values[index];
  });
}

function findRuns(values, threshold, minLength) {
  const runs = [];
  let start = null;

  values.forEach((value, index) => {
    if (value >= threshold) {
      if (start === null) start = index;
      return;
    }

    if (start !== null && index - start >= minLength) {
      runs.push([start, index - 1]);
    }
    start = null;
  });

  if (start !== null && values.length - start >= minLength) {
    runs.push([start, values.length - 1]);
  }

  return runs;
}

function pickBestRun(runs, values) {
  return runs
    .map(([start, end]) => {
      const segment = values.slice(start, end + 1);
      const avg = segment.reduce((sum, value) => sum + value, 0) / segment.length;
      const length = end - start + 1;
      return { start, end, score: avg * length };
    })
    .sort((a, b) => b.score - a.score)[0];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function detectPhotoCrop(inputPath) {
  const metadata = await sharp(inputPath).metadata();
  const originalWidth = metadata.width;
  const originalHeight = metadata.height;

  if (!originalWidth || !originalHeight) {
    throw new Error("이미지 크기를 읽을 수 없습니다.");
  }

  const scale = Math.min(1, ANALYSIS_WIDTH / originalWidth);
  const previewWidth = Math.max(1, Math.round(originalWidth * scale));

  const { data, info } = await sharp(inputPath)
    .resize({ width: previewWidth })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rowDensity = new Array(info.height).fill(0);

  for (let y = 0; y < info.height; y += 1) {
    let rowCount = 0;

    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * info.channels;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const isNonWhite = r < 245 || g < 245 || b < 245;

      if (isNonWhite) rowCount += 1;
    }

    rowDensity[y] = rowCount / info.width;
  }

  const smoothedRowDensity = smooth(rowDensity, 4);
  const { mean, std } = computeStats(smoothedRowDensity);
  const rowThreshold = clamp(mean + std * 0.5, 0.12, 0.85);
  const minRunHeight = Math.max(40, Math.round(info.height * 0.12));
  const rowRuns = findRuns(smoothedRowDensity, rowThreshold, minRunHeight);

  if (rowRuns.length === 0) {
    throw new Error("사진 후보 영역을 찾지 못했습니다.");
  }

  const bestRowRun = pickBestRun(rowRuns, smoothedRowDensity);

  let topRow = bestRowRun.start;
  let bottomRow = bestRowRun.end;

  // 1차로 찾은 큰 구간 안에서 "진짜 사진 본체"만 다시 좁혀 잡습니다.
  // 보통 기사 사진 아래의 캡션/본문은 밀도가 더 낮아서 여기서 잘려 나갑니다.
  const bestRowSegment = smoothedRowDensity.slice(topRow, bottomRow + 1);
  const bandMaxDensity = Math.max(...bestRowSegment);
  const refinedRowThreshold = clamp(
    Math.max(rowThreshold + 0.06, bandMaxDensity * 0.82),
    0.18,
    0.95
  );
  const refinedRowRuns = findRuns(
    bestRowSegment,
    refinedRowThreshold,
    Math.max(16, Math.round(bestRowSegment.length * 0.12))
  );

  if (refinedRowRuns.length > 0) {
    const bestRefinedRun = pickBestRun(refinedRowRuns, bestRowSegment);
    topRow += bestRefinedRun.start;
    bottomRow = topRow + (bestRefinedRun.end - bestRefinedRun.start);
  }

  const colDensity = new Array(info.width).fill(0);
  const bandHeight = bottomRow - topRow + 1;

  for (let x = 0; x < info.width; x += 1) {
    let colCount = 0;

    for (let y = topRow; y <= bottomRow; y += 1) {
      const index = (y * info.width + x) * info.channels;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const isNonWhite = r < 245 || g < 245 || b < 245;

      if (isNonWhite) colCount += 1;
    }

    colDensity[x] = colCount / bandHeight;
  }

  const smoothedColDensity = smooth(colDensity, 3);
  const { mean: colMean } = computeStats(smoothedColDensity);
  const colThreshold = clamp(colMean * 0.7, 0.08, 0.8);
  const activeColumns = smoothedColDensity
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value >= colThreshold)
    .map(({ index }) => index);

  if (activeColumns.length === 0) {
    throw new Error("사진 좌우 경계를 찾지 못했습니다.");
  }

  const previewLeft = activeColumns[0];
  const previewRight = activeColumns[activeColumns.length - 1];
  const verticalPadding = Math.round(info.height * 0.012);
  const horizontalPadding = Math.round(info.width * 0.012);
  const inverseScale = 1 / scale;

  const left = clamp(
    Math.round((previewLeft - horizontalPadding) * inverseScale),
    0,
    originalWidth - 1
  );
  const top = clamp(
    Math.round((topRow - verticalPadding) * inverseScale),
    0,
    originalHeight - 1
  );
  const right = clamp(
    Math.round((previewRight + horizontalPadding) * inverseScale),
    left + 1,
    originalWidth
  );
  const bottom = clamp(
    Math.round((bottomRow + verticalPadding) * inverseScale),
    top + 1,
    originalHeight
  );

  const width = right - left;
  const height = bottom - top;

  if (width < originalWidth * 0.35 || height < originalHeight * 0.15) {
    throw new Error("탐지된 영역이 너무 작아 사진으로 보기 어렵습니다.");
  }

  return { left, top, width, height };
}

async function cropSingleImage(inputPath, options) {
  const outputPath = buildOutputPath(inputPath);

  if (existsSync(outputPath) && !options.force) {
    log("⏭️", `${basename(outputPath)} 이미 존재해서 건너뜀 (--force로 덮어쓰기 가능)`);
    return { status: "skipped", inputPath, outputPath };
  }

  const crop = await detectPhotoCrop(inputPath);

  if (!options.dryRun) {
    await mkdir(dirname(outputPath), { recursive: true });
    await sharp(inputPath).extract(crop).png().toFile(outputPath);
  }

  log(
    options.dryRun ? "🧪" : "✂️",
    `${basename(inputPath)} → ${basename(outputPath)} (${crop.width}x${crop.height})`
  );

  return { status: "cropped", inputPath, outputPath, crop };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputFiles = resolveTargets(options.targets);

  if (inputFiles.length === 0) {
    console.error("❌ 처리할 원본 뉴스 이미지가 없습니다.");
    process.exit(1);
  }

  const results = [];

  for (const inputPath of inputFiles) {
    try {
      const result = await cropSingleImage(inputPath, options);
      const linkedJsonPaths = await syncNewsJsonWithCroppedPhoto(result);

      if (linkedJsonPaths.length > 0) {
        log("🔗", `${basename(inputPath)} → ${linkedJsonPaths.length}개 JSON 연결`);
      }

      results.push({ ...result, linkedJsonPaths });
    } catch (error) {
      console.error(`❌ ${basename(inputPath)} 실패: ${error.message}`);
      results.push({ status: "failed", inputPath, error: error.message });
    }
  }

  const croppedCount = results.filter((result) => result.status === "cropped").length;
  const failedCount = results.filter((result) => result.status === "failed").length;

  const manifest = {
    generatedAt: new Date().toISOString(),
    results,
  };

  const manifestPath = resolve(PROJECTS_ROOT, ".last-news-crop-report.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log("");
  log("✅", `완료: ${croppedCount}개 크롭, ${failedCount}개 실패`);
  log("📝", `리포트 저장: ${manifestPath}`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ crop-news 실행 실패:", error);
  process.exit(1);
});
