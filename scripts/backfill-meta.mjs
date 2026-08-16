#!/usr/bin/env node

/**
 * =====================================================
 * backfill-meta.mjs — 빠진 project.meta.json 일괄 생성
 * =====================================================
 *
 * 왜 만들었나?
 * --------------------------------------------------
 * audit-projects 감사에서 "project.meta.json 누락"이 가장 많이 나왔다.
 * meta 파일은 프로젝트가 무엇인지(topic), 언제 만들었는지(createdAt)를
 * 기록하는 "박스 라벨" 역할을 한다. 35개 프로젝트에 이 라벨이 없었다.
 * 이 스크립트는 누락된 프로젝트만 골라 라벨을 자동으로 붙여준다.
 *
 * 어떻게 값을 정하나?
 * --------------------------------------------------
 *  - slug          : 폴더명 그대로
 *  - createdAt      : slug 앞의 YYYY-MM-DD 날짜를 사용 (그 날 만든 프로젝트이므로)
 *  - topic          : 그 프로젝트 첫 JSON의 제목(structure.title)을 사용.
 *                     제목이 없으면 slug에서 날짜를 뺀 부분을 사람이 읽기 좋게 변환.
 *  - slugVersion    : 2 (영문 ASCII slug 규칙을 따르는 버전)
 *  - generatedBy    : "backfill-meta" (자동 생성임을 표시 — 나중에 사람이 다듬을 수 있게)
 *
 * ⚠️ 안전장치
 *  - 이미 project.meta.json이 있으면 절대 건드리지 않고 건너뛴다(skip).
 *  - 즉 여러 번 실행해도 기존 파일을 덮어쓰지 않는다(idempotent, 멱등).
 *
 * 사용법
 * --------------------------------------------------
 *   cd output/chart-app && npm run backfill-meta              # 실제 생성
 *   npm run backfill-meta -- --dry-run                        # 미리보기(파일 안 만듦)
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// 경로 설정 (audit-projects.mjs와 동일한 기준)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHART_APP_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(CHART_APP_ROOT, "..", "..");
const DATA_DIR = path.resolve(CHART_APP_ROOT, "src", "data");
const PROJECTS_DIR = path.resolve(REPO_ROOT, "projects");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

/** slug 앞부분의 YYYY-MM-DD 날짜를 추출 (없으면 null) */
function extractDate(slug) {
  const match = slug.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** slug에서 날짜를 뺀 부분을 사람이 읽기 좋은 형태로 (제목 fallback용) */
function topicFromSlug(slug) {
  const withoutDate = slug.replace(/^\d{4}-\d{2}-\d{2}-?/, "");
  return withoutDate.replace(/-/g, " ").trim() || slug;
}

/** 그 프로젝트 첫 JSON의 제목을 topic으로 (가장 의미 있는 값) */
function topicFromFirstJson(slug) {
  const dir = path.join(DATA_DIR, slug);
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  for (const file of files) {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      const title = json.structure?.title || json.narrative?.headline;
      if (title) return title;
    } catch {
      // 깨진 JSON은 무시하고 다음 파일 시도
    }
  }
  return null;
}

// projects 폴더의 모든 프로젝트를 순회
if (!fs.existsSync(PROJECTS_DIR)) {
  console.error(`projects 폴더를 찾을 수 없습니다: ${PROJECTS_DIR}`);
  process.exit(1);
}

const projectSlugs = fs
  .readdirSync(PROJECTS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

let created = 0;
let skipped = 0;

console.log("");
console.log("==================================================");
console.log(`  project.meta.json 일괄 생성 ${dryRun ? "(미리보기)" : ""}`);
console.log("==================================================");

for (const slug of projectSlugs) {
  const metaPath = path.join(PROJECTS_DIR, slug, "project.meta.json");

  // [안전장치] 이미 있으면 건너뜀
  if (fs.existsSync(metaPath)) {
    skipped += 1;
    continue;
  }

  const date = extractDate(slug);
  const topic = topicFromFirstJson(slug) || topicFromSlug(slug);
  const meta = {
    slug,
    topic,
    ...(date ? { createdAt: `${date}T00:00:00+09:00` } : {}),
    slugVersion: 2,
    generatedBy: "backfill-meta",
  };

  console.log(`  ${dryRun ? "[미리보기] " : "✓ 생성 "}${slug}`);
  console.log(`        topic = "${topic}"`);

  if (!dryRun) {
    fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  }
  created += 1;
}

console.log("--------------------------------------------------");
console.log(`  ${dryRun ? "생성 예정" : "생성 완료"}: ${created}개  |  건너뜀(이미 있음): ${skipped}개`);
console.log("==================================================");
