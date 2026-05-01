#!/usr/bin/env node
/**
 * =====================================================
 * export-png.mjs — 차트를 자동으로 PNG 내보내기
 * =====================================================
 *
 * 사용법:
 *   npm run export-png                          # 최신 프로젝트 자동 선택
 *   npm run export-png -- 2026-03-25-pmi-macro  # 특정 프로젝트 지정
 *   npm run export-png -- --list                # 프로젝트 목록 보기
 *
 * 동작 원리:
 * 1. dev 서버가 켜져 있는지 확인 (없으면 에러)
 * 2. Playwright 헤드리스 브라우저를 열어서 /export 페이지 접속
 * 3. 라이트 모드로 전환 + 프로젝트 선택
 * 4. 각 차트 카드를 개별 스크린샷으로 캡처
 * 5. projects/{프로젝트}/output/ 폴더에 저장
 * 6. projects/{프로젝트}/input/ 에 원본 이미지가 있으면 함께 복사
 *
 * 필요 조건:
 * - Playwright 설치: npx playwright install chromium
 * - dev 서버 실행 중: npm run dev -- --port 3001
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync, copyFileSync } from "fs";
import { resolve, dirname, extname } from "path";
import { fileURLToPath } from "url";

// ── 설정 ──
const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
const PIXEL_RATIO = 2; // 고해상도

// 경로 계산
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
// 프로젝트 기반 폴더 구조: silde_maker/projects/{slug}/output/
const PROJECTS_DIR = resolve(PROJECT_ROOT, "..", "..", "projects");
const PREVIEW_DIR = resolve(PROJECT_ROOT, "..", "previews");

function toAsciiSlug(text, fallback = "item") {
  const ascii = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();

  return ascii || fallback;
}

function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`);
}

async function hideDevOverlays(page) {
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-next-badge-root],
      [data-next-mark],
      [data-nextjs-dialog-overlay],
      [data-nextjs-toast] {
        display: none !important;
        visibility: hidden !important;
      }
    `,
  });

  await page.evaluate(() => {
    document
      .querySelectorAll(
        "nextjs-portal, [data-next-badge-root], [data-next-mark], [data-nextjs-dialog-overlay], [data-nextjs-toast]"
      )
      .forEach((node) => node.remove());
  });
}

// ── 메인 ──
async function main() {
  const args = process.argv.slice(2);

  // dev 서버 체크
  log("🔍", `localhost:${PORT} 확인 중...`);
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) });
  } catch {
    console.error(`\n❌ dev 서버가 실행 중이 아닙니다.`);
    console.error(`   먼저 다른 터미널에서 실행하세요:`);
    console.error(`   cd output/chart-app && npm run dev -- --port ${PORT}\n`);
    process.exit(1);
  }
  log("✅", "dev 서버 연결됨");

  // 프로젝트 목록 가져오기
  const projectsRes = await fetch(`${BASE_URL}/api/projects`);
  const { projects } = await projectsRes.json();

  if (!projects || projects.length === 0) {
    console.error("❌ 프로젝트가 없습니다. JSON 파일을 먼저 만들어주세요.");
    process.exit(1);
  }

  // --list 플래그: 목록만 출력
  if (args.includes("--list")) {
    log("📋", "사용 가능한 프로젝트:");
    projects.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.slug}  (차트 ${p.analysisCount}개)`);
    });
    process.exit(0);
  }

  // 프로젝트 선택
  let targetSlug = args[0];
  if (!targetSlug) {
    // 인자 없으면 가장 최신(분석 있는) 프로젝트 자동 선택
    const withData = projects.find((p) => p.analysisCount > 0);
    if (!withData) {
      console.error("❌ 분석 JSON이 있는 프로젝트가 없습니다.");
      process.exit(1);
    }
    targetSlug = withData.slug;
    log("📂", `자동 선택: ${targetSlug}`);
  } else {
    const found = projects.find((p) => p.slug === targetSlug);
    if (!found) {
      console.error(`❌ 프로젝트 "${targetSlug}" 를 찾을 수 없습니다.`);
      console.error(`   npm run export-png -- --list 로 목록을 확인하세요.`);
      process.exit(1);
    }
    log("📂", `선택: ${targetSlug}`);
  }

  // 프로젝트 폴더 생성 (projects/{slug}/input + output)
  const projectDir = resolve(PROJECTS_DIR, targetSlug);
  const outDir = resolve(projectDir, "output");
  const inputDir = resolve(projectDir, "input");
  const previewProjectDir = resolve(
    PREVIEW_DIR,
    toAsciiSlug(targetSlug, "project-preview")
  );
  mkdirSync(outDir, { recursive: true });
  mkdirSync(inputDir, { recursive: true });
  mkdirSync(previewProjectDir, { recursive: true });

  // ── Playwright 실행 ──
  log("🚀", "브라우저 시작 중...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    deviceScaleFactor: PIXEL_RATIO,
    viewport: { width: 960, height: 800 },
  });
  const page = await context.newPage();

  try {
    // 1) export 페이지 열기
    await page.goto(`${BASE_URL}/export`, { waitUntil: "networkidle" });
    await hideDevOverlays(page);
    log("📄", "/export 페이지 로드 완료");

    // 2) 프로젝트 선택
    await page.locator("select").selectOption(targetSlug);
    // 차트 로딩 대기
    await page.waitForTimeout(1500);
    await hideDevOverlays(page);

    // 3) 라이트 모드 전환
    //    ☀ 버튼이 있으면 이미 다크 모드 → 클릭해서 라이트로
    //    ☾ 버튼이 있으면 이미 라이트 모드 → 그대로
    const sunBtn = page.locator('button:has-text("☀")');
    if (await sunBtn.isVisible()) {
      await sunBtn.click();
      await page.waitForTimeout(500);
      log("☀️", "라이트 모드로 전환");
    } else {
      log("☀️", "이미 라이트 모드");
    }

    // 차트 렌더링 안정화 대기
    await page.waitForTimeout(1000);
    await hideDevOverlays(page);

    // 4) 차트 카드 찾기
    //    export 페이지의 각 차트 카드는 border-radius: 16px, border가 있는 div
    //    구조: 제목 div + 차트 div + 출처 div를 감싸는 부모 div
    //    h2 > 부모의 부모가 캡처 대상
    const chartCards = page.locator(
      'div[style*="border-radius"] > div[style*="padding: 20px 24px"]'
    ).locator("..");

    const count = await chartCards.count();

    if (count === 0) {
      // 대안: h2 요소를 기준으로 카드 찾기
      log("⚠️", "카드 탐색 방법 변경 중...");
    }

    // h2 제목들로 카드를 찾기 (더 안정적인 방법)
    const titles = page.locator("h2");
    const titleCount = await titles.count();

    if (titleCount === 0) {
      console.error("❌ 차트를 찾을 수 없습니다.");
      await browser.close();
      process.exit(1);
    }

    log("📊", `${titleCount}개 차트 발견`);

    // 5) 각 차트 캡처
    const exported = [];
    for (let i = 0; i < titleCount; i++) {
      const titleEl = titles.nth(i);
      const titleText = await titleEl.textContent();

      // h2의 조부모 div가 캡처 대상 카드 (h2 > div[padding] > div[border-radius])
      // export 페이지 구조: div(카드) > div(제목영역) > h2
      const card = titleEl.locator("../..");
      const exportName = await card.getAttribute("data-export-name");

      const slug = exportName || toAsciiSlug(titleText || `chart-${i}`, `chart-${i + 1}`);
      const filename = `${slug}.png`;
      const filepath = resolve(outDir, filename);
      const previewName = `${slug}.png`;
      const previewPath = resolve(previewProjectDir, previewName);

      await card.screenshot({
        path: filepath,
        type: "png",
      });
      copyFileSync(filepath, previewPath);

      exported.push({ filename, previewName, title: titleText });
      log("💾", `${filename}  ← "${titleText}"`);
      log("🪄", `${previewName}  ← preview 경로`);
    }

    // ── 원본 이미지 복사 (input → output에 input_ 접두사로) ──
    if (existsSync(inputDir)) {
      const inputFiles = readdirSync(inputDir).filter((f) =>
        [".png", ".jpg", ".jpeg", ".webp"].includes(extname(f).toLowerCase())
      );
      if (inputFiles.length > 0) {
        inputFiles.forEach((f, idx) => {
          const num = String(idx + 1).padStart(2, "0");
          const inputBaseName = toAsciiSlug(
            f.replace(extname(f), ""),
            `input-${idx + 1}`
          ).slice(0, 50);
          const dest = resolve(outDir, `input_${num}-${inputBaseName}${extname(f)}`);
          copyFileSync(resolve(inputDir, f), dest);
          log("📋", `input_${num}-${inputBaseName}${extname(f)}  ← 원본 복사`);
        });
      }
    }

    // ── 완료 ──
    await browser.close();

    console.log("");
    log("✅", `내보내기 완료! ${exported.length}개 PNG`);
    log("📁", outDir);
    log("🖼️", `preview 폴더: ${previewProjectDir}`);
    log("📂", `프로젝트 폴더: ${projectDir}`);
    console.log("");

  } catch (err) {
    console.error("❌ 내보내기 실패:", err.message);
    await browser.close();
    process.exit(1);
  }
}

main();
