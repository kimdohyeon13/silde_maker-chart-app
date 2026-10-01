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
 *   npm run export-png -- slug --only=02-chart.png # 지정한 장표만 재출력
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
import { parseExportArgs, resolveExportTargets, selectExportCardIndices } from "./export-png-core.mjs";

// ── 설정 ──
const PORT = Number.parseInt(process.env.CHART_APP_PORT ?? "3001", 10);
const BASE_URL = `http://localhost:${PORT}`;
const PIXEL_RATIO = 2; // 고해상도
// 출처 줄 높이를 포함해 표 끝에서 카드 바닥까지 허용하는 최대 거리.
// 이 값을 넘으면 실제 콘텐츠보다 빈 하단이 더 크게 보이므로 export를 중단한다.
const MAX_TABLE_BOTTOM_GAP = 72;

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

async function waitForProjectReady(page, targetSlug, expectedCount) {
  const select = page.locator("select");
  await select.locator(`option[value="${targetSlug}"]`).waitFor({ state: "attached" });
  const currentSlug = await select.inputValue();

  if (currentSlug !== targetSlug) {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/projects/${encodeURIComponent(targetSlug)}`) &&
        response.ok(),
      { timeout: 15000 },
    );
    await select.selectOption(targetSlug);
    await responsePromise;
  }

  await page.waitForFunction(
    ({ slug, count }) => {
      const projectSelect = document.querySelector("select");
      const cards = document.querySelectorAll("[data-export-name]");
      const loading = [...document.querySelectorAll("span")].some(
        (element) => element.textContent?.trim() === "로딩 중...",
      );
      return projectSelect?.value === slug && !loading && cards.length === count;
    },
    { slug: targetSlug, count: expectedCount },
    { timeout: 15000 },
  );

  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.images];
    await Promise.all(
      images
        .filter((image) => !image.complete)
        .map(
          (image) =>
            new Promise((resolveImage) => {
              image.addEventListener("load", resolveImage, { once: true });
              image.addEventListener("error", resolveImage, { once: true });
            }),
        ),
    );
    await new Promise((resolveFrame) =>
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame)),
    );
  });
}

// Recharts 등장 애니메이션이 끝날 때까지 기다린다.
// 선의 path d와 막대의 위치·폭·높이를 지문으로 삼아, 두 번 연속 같은 값이 나오면 정지로 본다.
// 애니메이션이 없는 표 전용 프로젝트에서는 첫 비교에서 바로 통과한다.
async function waitForChartAnimationSettled(page, { timeout = 8000, interval = 220 } = {}) {
  const fingerprint = () =>
    page.evaluate(() => {
      // Recharts 의 선 등장 애니메이션은 `d` 가 아니라 stroke-dasharray/offset 을
      // 움직인다. `d` 만 보면 선이 아직 그려지는 중인데도 "멈췄다"고 판정해,
      // 오른쪽 끝이 잘린 프레임을 캡처한다(dib-235 다크 차트가 그렇게 나갔다).
      const lines = [...document.querySelectorAll("path.recharts-curve.recharts-line-curve")].map(
        (element) => {
          const style = getComputedStyle(element);
          return [
            element.getAttribute("d") ?? "",
            style.strokeDasharray,
            style.strokeDashoffset,
          ].join("|");
        },
      );
      const bars = [...document.querySelectorAll(".recharts-rectangle")].map((element) => {
        const rect = element.getBoundingClientRect();
        return [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 10));
      });
      const areas = [...document.querySelectorAll("path.recharts-curve.recharts-area-area")].map(
        (element) => element.getAttribute("d") ?? "",
      );
      return JSON.stringify([lines, bars, areas]);
    });

  const deadline = Date.now() + timeout;
  let previous = await fingerprint();
  while (Date.now() < deadline) {
    await page.waitForTimeout(interval);
    const current = await fingerprint();
    if (current === previous) return true;
    previous = current;
  }
  log("⚠️", "차트 애니메이션이 제한 시간 안에 멈추지 않았습니다. 현재 프레임으로 캡처합니다.");
  return false;
}

// export 화면에서 보이는 결과를 기준으로만 검사한다. JSON의 예상값을 다시
// 추측하지 않아, 개별 카드의 CSS·글꼴·Recharts 실제 배치까지 함께 확인한다.
async function findCardDomProblems(card) {
  return card.evaluate((element) => {
    const issues = [];
    const CARD_TOLERANCE = 2;
    const TICK_TOLERANCE = 1;
    const cardRect = element.getBoundingClientRect();
    const isVisible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 &&
        rect.width > 0 && rect.height > 0;
    };
    const escapes = (rect, bounds, tolerance = CARD_TOLERANCE) =>
      rect.left < bounds.left - tolerance || rect.right > bounds.right + tolerance ||
      rect.top < bounds.top - tolerance || rect.bottom > bounds.bottom + tolerance;
    const overlap = (a, b) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > TICK_TOLERANCE &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > TICK_TOLERANCE;
    const clipsAxis = (overflow, scrollSize, clientSize) =>
      overflow === "hidden" || overflow === "clip" ||
      ((overflow === "auto" || overflow === "scroll") && scrollSize > clientSize + 1);

    // export 카드가 정상이어도 좁은 부모가 잘라내면 사용자는 잘린 화면을 보게 된다.
    // 실제로 가리는 overflow 조상만 따라가며 카드 전체가 포함되는지 확인한다.
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const rect = ancestor.getBoundingClientRect();
      const clipsX = clipsAxis(style.overflowX, ancestor.scrollWidth, ancestor.clientWidth);
      const clipsY = clipsAxis(style.overflowY, ancestor.scrollHeight, ancestor.clientHeight);
      if (
        (clipsX && (cardRect.left < rect.left - CARD_TOLERANCE || cardRect.right > rect.right + CARD_TOLERANCE)) ||
        (clipsY && (cardRect.top < rect.top - CARD_TOLERANCE || cardRect.bottom > rect.bottom + CARD_TOLERANCE))
      ) {
        const name = ancestor.tagName.toLowerCase();
        const className = typeof ancestor.className === "string"
          ? ancestor.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
        issues.push(`부모 ${name}${className ? `.${className}` : ""}가 export 카드 일부를 가립니다`);
        break;
      }
    }
    if (cardRect.left < -CARD_TOLERANCE || cardRect.right > window.innerWidth + CARD_TOLERANCE) {
      issues.push("export 카드가 브라우저 가로 화면 밖으로 잘렸습니다");
    }

    // 제목의 마지막 줄만 유난히 짧은 경우를 찾는다. h2는 ExportCardHeader의
    // 제목이며 축 제목(recharts-label)은 이 선택자에 포함되지 않는다.
    const title = element.querySelector("[data-export-header] h2") ?? element.querySelector("h1, h2");
    if (title && isVisible(title)) {
      const lines = new Map();
      const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
      let textNode;
      while ((textNode = walker.nextNode())) {
        for (let index = 0; index < textNode.textContent.length; index += 1) {
          const char = textNode.textContent[index];
          if (/\s/.test(char)) continue;
          const range = document.createRange();
          range.setStart(textNode, index);
          range.setEnd(textNode, index + 1);
          const rect = range.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const key = Math.round(rect.top / 2) * 2;
          lines.set(key, (lines.get(key) || "") + char);
        }
      }
      const renderedLines = [...lines.entries()].sort((a, b) => a[0] - b[0]);
      const lastLine = renderedLines.at(-1)?.[1] ?? "";
      if (renderedLines.length > 1 && [...lastLine].length <= 2) {
        issues.push(`제목 마지막 줄이 ${[...lastLine].length}글자입니다 ("${lastLine}")`);
      }

      // scrollWidth만으로는 balance/keep-all 조합의 실제 글리프 넘침을 놓칠 수 있다.
      // 텍스트 조각의 오른쪽 끝을 제목, 카드, 클리핑 조상의 실제 경계와 비교한다.
      let clipRight = Math.min(title.getBoundingClientRect().right, cardRect.right);
      for (let ancestor = title.parentElement; ancestor && ancestor !== element; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (clipsAxis(style.overflowX, ancestor.scrollWidth, ancestor.clientWidth)) {
          clipRight = Math.min(clipRight, ancestor.getBoundingClientRect().right);
        }
      }
      const titleWalker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
      let titleNode;
      let titleClipped = false;
      while ((titleNode = titleWalker.nextNode()) && !titleClipped) {
        const range = document.createRange();
        range.selectNodeContents(titleNode);
        titleClipped = [...range.getClientRects()].some((rect) => rect.right > clipRight + 1);
      }
      if (titleClipped) issues.push("제목 글자가 오른쪽 경계에서 잘렸습니다");
    }

    // 카드 또는 SVG 밖으로 실제 도형·텍스트가 삐져나오면, overflow:hidden으로
    // 가려져도 PNG에는 잘린 상태로 나오므로 중단한다.
    for (const svg of element.querySelectorAll("svg")) {
      if (!isVisible(svg)) continue;
      const svgRect = svg.getBoundingClientRect();
      if (escapes(svgRect, cardRect)) issues.push("SVG 영역이 카드 경계를 벗어났습니다");
      for (const visual of svg.querySelectorAll("text, path, rect, circle, ellipse, polygon, polyline, line")) {
        if (!isVisible(visual)) continue;
        const visualRect = visual.getBoundingClientRect();
        const isAxisLabel = visual.classList.contains("recharts-label");
        const escapesSvg = escapes(visualRect, svgRect);
        const escapesCard = escapes(visualRect, cardRect);
        if (escapesCard || (!isAxisLabel && escapesSvg)) {
          const name = visual.tagName.toLowerCase();
          const className = typeof visual.className?.baseVal === "string"
            ? visual.className.baseVal.trim().split(/\s+/).slice(0, 2).join(".")
            : "";
          const text = visual.textContent?.trim().slice(0, 18) || "";
          issues.push(
            `SVG 안의 ${name}${className ? `.${className}` : ""}${text ? ` ("${text}")` : ""}가 ` +
            `경계에서 잘렸습니다 [${Math.round(visualRect.left)},${Math.round(visualRect.top)},` +
            `${Math.round(visualRect.right)},${Math.round(visualRect.bottom)}]`,
          );
          break;
        }
      }
    }

    // Recharts 눈금만 비교한다. .recharts-label 같은 축 제목과 데이터 직접 라벨은
    // 제외해 축 제목의 의도적인 배치와 혼동하지 않는다.
    for (const axis of element.querySelectorAll(".recharts-cartesian-axis")) {
      const ticks = [...axis.querySelectorAll(".recharts-cartesian-axis-tick text")]
        .filter((tick) => isVisible(tick) && tick.textContent.trim())
        .map((tick) => ({ text: tick.textContent.trim(), rect: tick.getBoundingClientRect() }));
      const axisLabel = axis.querySelector(".recharts-label");
      if (axisLabel && isVisible(axisLabel)) {
        const labelRect = axisLabel.getBoundingClientRect();
        const collidingTick = ticks.find((tick) => overlap(labelRect, tick.rect));
        if (collidingTick) {
          issues.push(
            `축 제목이 눈금과 겹칩니다 ("${axisLabel.textContent.trim()}" / "${collidingTick.text}")`,
          );
        }
      }
      let foundOverlap = false;
      for (let a = 0; a < ticks.length && !foundOverlap; a += 1) {
        for (let b = a + 1; b < ticks.length; b += 1) {
          if (overlap(ticks[a].rect, ticks[b].rect)) {
            issues.push(`같은 축의 눈금 텍스트가 겹칩니다 ("${ticks[a].text}" / "${ticks[b].text}")`);
            foundOverlap = true;
            break;
          }
        }
      }
    }

    // 서로 다른 축의 눈금끼리도 겹친다. 대표적으로 Y축 마지막 눈금("90")과
    // X축 첫 눈금("05-29")이 왼쪽 아래 모서리에서 포개진다. 같은 축만 보는 위
    // 검사로는 이 조합을 잡지 못하므로 Y축×X축을 따로 대조한다.
    const axisTicksOf = (selector) =>
      [...element.querySelectorAll(`${selector} .recharts-cartesian-axis-tick text`)]
        .filter((tick) => isVisible(tick) && tick.textContent.trim())
        .map((tick) => ({ text: tick.textContent.trim(), rect: tick.getBoundingClientRect() }));
    const yTicks = axisTicksOf(".recharts-cartesian-axis.recharts-yAxis");
    const xTicks = axisTicksOf(".recharts-cartesian-axis.recharts-xAxis");
    outer: for (const yTick of yTicks) {
      for (const xTick of xTicks) {
        if (overlap(yTick.rect, xTick.rect)) {
          issues.push(`Y축과 X축 눈금이 겹칩니다 ("${yTick.text}" / "${xTick.text}")`);
          break outer;
        }
      }
    }

    // 헤더(제목·부제·메타)와 차트 안 글자가 포개지는 경우.
    // 축 제목("3개월 전 = 100")이 위로 올라와 부제 위에 얹히는 사고를 잡는다.
    const header = element.querySelector("[data-export-header]");
    if (header && isVisible(header)) {
      const headerTexts = [...header.querySelectorAll("h1, h2, h3, p")]
        .filter((node) => isVisible(node) && node.textContent.trim())
        .map((node) => ({ text: node.textContent.trim(), rect: node.getBoundingClientRect() }));
      const chartTexts = [...element.querySelectorAll("svg text")]
        .filter((node) => isVisible(node) && node.textContent.trim())
        .map((node) => ({ text: node.textContent.trim(), rect: node.getBoundingClientRect() }));
      headerLoop: for (const headerText of headerTexts) {
        for (const chartText of chartTexts) {
          if (overlap(headerText.rect, chartText.rect)) {
            issues.push(
              `헤더 글자와 차트 글자가 겹칩니다 ("${headerText.text.slice(0, 20)}" / "${chartText.text}")`,
            );
            break headerLoop;
          }
        }
      }
    }

    // X축 눈금은 서로 안 겹쳐도 플롯 안으로 올라와 기준선·막대를 침범할 수 있다.
    // X축에만 한정해 정상적인 Y축 눈금/격자 배치를 오탐하지 않는다.
    for (const axis of element.querySelectorAll(".recharts-cartesian-axis.recharts-xAxis")) {
      if (!isVisible(axis)) continue;
      const axisLine = axis.querySelector(".recharts-cartesian-axis-line");
      if (!axisLine) continue;
      const lineRect = axisLine.getBoundingClientRect();
      const plotBottom = lineRect.top + Math.max(lineRect.height, 1);
      const intrudingTick = [...axis.querySelectorAll(".recharts-cartesian-axis-tick text")]
        .filter((tick) => isVisible(tick) && tick.textContent.trim())
        .find((tick) => tick.getBoundingClientRect().top < plotBottom - 1);
      if (intrudingTick) {
        issues.push(`X축 눈금이 플롯 영역을 침범합니다 ("${intrudingTick.textContent.trim()}")`);
      }
    }

    // 데이터 마크가 있는 Recharts 차트는 x축 눈금이 하나도 없으면 실패한다.
    // 표·도넛·캔들처럼 x축이 없는 카드와 빈 데이터 차트는 건너뛴다.
    const recharts = element.querySelector(".recharts-wrapper");
    const marks = element.querySelectorAll(
      ".recharts-bar-rectangle, .recharts-line, .recharts-dot, .recharts-area, .recharts-scatter-symbol"
    );
    const xAxes = [...element.querySelectorAll(".recharts-cartesian-axis.recharts-xAxis")]
      .filter((axis) => isVisible(axis));
    if (recharts && marks.length > 0 && xAxes.length > 0) {
      const xTickCount = xAxes.reduce(
        (count, axis) => count + axis.querySelectorAll(".recharts-cartesian-axis-tick text").length,
        0,
      );
      if (xTickCount === 0) issues.push("데이터가 있는 Recharts 차트에 x축 눈금이 없습니다");
    }

    // 출처가 있는 고정 카드에서 차트와 출처 사이가 다시 크게 벌어지면 중단한다.
    // 실제 렌더링된 Recharts 바깥쪽을 기준으로 재므로 제목 줄 수와 축 높이 변화도 반영된다.
    const source = element.querySelector("[data-export-source]");
    if (recharts && source && isVisible(recharts) && isVisible(source)) {
      const chartRect = recharts.getBoundingClientRect();
      const sourceRect = source.getBoundingClientRect();
      const gap = Math.round(sourceRect.top - chartRect.bottom);
      if (gap > 48) {
        issues.push(`차트와 출처 사이 여백이 ${gap}px로 너무 큽니다`);
      }
    }

    // 제목·본문·표 셀은 잘리면 의미를 잃는다. SVG 텍스트는 위의 SVG 경계 검사와
    // 축 눈금 검사에서 다루므로 여기서는 제외한다.
    const mainText = element.querySelectorAll("h1, h2, h3, p, th, td, [data-export-text]");
    for (const text of mainText) {
      if (!isVisible(text)) continue;
      const rect = text.getBoundingClientRect();
      if (text.scrollWidth > text.clientWidth + 1 || text.scrollHeight > text.clientHeight + 1 || escapes(rect, cardRect)) {
        issues.push(`주요 텍스트가 잘렸습니다 ("${text.textContent.trim().slice(0, 28)}")`);
        break;
      }
    }

    return [...new Set(issues)];
  });
}

// ── 메인 ──
async function main() {
  const { listOnly, requestedSlugs, onlyNames } = parseExportArgs(process.argv.slice(2));

  const startedAt = performance.now();

  // 출력에 필요한 API로 확인한다. 홈 화면의 초기 컴파일을 기다리지 않는다.
  log("🔍", `localhost:${PORT} 확인 중...`);
  let projectsPayload;
  try {
    const response = await fetch(`${BASE_URL}/api/projects`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    projectsPayload = await response.json();
  } catch {
    console.error(`\n❌ 출력 서버에서 정상 응답을 받지 못했습니다: ${BASE_URL}/api/projects`);
    console.error(`   먼저 다른 터미널에서 실행하세요:`);
    console.error(`   cd output/chart-app && npm run dev -- --port ${PORT}\n`);
    process.exit(1);
  }
  log("✅", "dev 서버 연결됨");

  // 프로젝트 목록 가져오기
  const { projects } = projectsPayload;

  if (!projects || projects.length === 0) {
    console.error("❌ 프로젝트가 없습니다. JSON 파일을 먼저 만들어주세요.");
    process.exit(1);
  }

  // --list 플래그: 목록만 출력
  if (listOnly) {
    log("📋", "사용 가능한 프로젝트:");
    projects.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.slug}  (차트 ${p.analysisCount}개)`);
    });
    process.exit(0);
  }

  let targetSlugs;
  try {
    targetSlugs = resolveExportTargets(requestedSlugs, projects);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    console.error("   npm run export-png -- --list 로 목록을 확인하세요.");
    process.exit(1);
  }
  log("📂", `선택: ${targetSlugs.join(", ")}`);

  // ── Playwright 실행 ──
  log("🚀", "브라우저 시작 중...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    deviceScaleFactor: PIXEL_RATIO,
    // 960px CSS canvas × 2 = 1920px 납품 폭. PageShell 기본 960px에는 좌우 패딩이 포함된다.
    viewport: { width: 1008, height: 800 },
  });
  try {
    let totalExported = 0;
    const page = await context.newPage();
    // 목록은 방금 읽은 같은 실행의 응답을 재사용한다. 다음 실행에는 다시 읽는다.
    await page.route(`${BASE_URL}/api/projects`, (route) =>
      route.fulfill({ json: projectsPayload }),
    );
    await page.goto(`${BASE_URL}/export?project=${encodeURIComponent(targetSlugs[0])}`, {
      waitUntil: "domcontentloaded",
    });
    await page.addStyleTag({ content: "main { max-width: 1008px !important; }" });
    await hideDevOverlays(page);
    for (const targetSlug of targetSlugs) {
      const projectStartedAt = performance.now();
      const project = projects.find((entry) => entry.slug === targetSlug);
      const projectDir = resolve(PROJECTS_DIR, targetSlug);
      const outDir = resolve(projectDir, "output");
      const inputDir = resolve(projectDir, "input");
      const previewProjectDir = resolve(PREVIEW_DIR, toAsciiSlug(targetSlug, "project-preview"));
      mkdirSync(outDir, { recursive: true });
      mkdirSync(inputDir, { recursive: true });
      mkdirSync(previewProjectDir, { recursive: true });

      {
        await waitForProjectReady(page, targetSlug, project.analysisCount);
        await hideDevOverlays(page);
        log("📄", `${targetSlug} 로드 완료`);

        const sunBtn = page.locator('button:has-text("☀")');
        if (await sunBtn.isVisible()) {
          await sunBtn.click();
          await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(resolveFrame)));
          log("☀️", "라이트 모드로 전환");
        }

        // 테마 전환은 차트를 다시 그리므로 Recharts 등장 애니메이션이 처음부터 재생된다.
        // 그 사이에 캡처하면 선이 짧게 잘리거나 막대가 덜 자란 중간 프레임이 PNG에 박힌다.
        // 실제 선/막대 기하가 두 프레임 연속 같아질 때까지 기다린 뒤 캡처한다.
        await waitForChartAnimationSettled(page);

    // 4) 차트 카드 찾기
    //    원본 복제형 카드는 export용 헤더를 숨길 수 있으므로 h2가 없을 수 있다.
    //    data-export-name은 모든 캡처 대상 카드에 붙어 있으므로 이것을 기준으로 찾는다.
    const exportCards = page.locator("[data-export-name]");
    const exportCount = await exportCards.count();

        if (exportCount === 0) throw new Error(`${targetSlug}: 차트를 찾을 수 없습니다.`);

        log("📊", `${targetSlug}: ${exportCount}개 차트 발견`);

    // 5) 각 차트 캡처
        const exportNames = await exportCards.evaluateAll((cards) =>
          cards.map((card) => card.getAttribute("data-export-name")),
        );
        const cardIndices = selectExportCardIndices(exportNames, onlyNames);
        const exported = [];
        for (const i of cardIndices) {
      const card = exportCards.nth(i);
      const exportName = await card.getAttribute("data-export-name");
      const titleEl = card.locator("h2").first();
      const hasTitle = await titleEl.count();
      const titleText = hasTitle > 0 ? await titleEl.textContent() : exportName;

      const slug = exportName || toAsciiSlug(titleText || `chart-${i}`, `chart-${i + 1}`);
      const filename = `${slug}.png`;
      const filepath = resolve(outDir, filename);
      const previewName = `${slug}.png`;
      const previewPath = resolve(previewProjectDir, previewName);

      const domProblems = await findCardDomProblems(card);
      if (domProblems.length > 0) {
        throw new Error(`${slug}: ${domProblems.join("; ")}. 레이아웃 또는 축 설정을 조정하세요.`);
      }

      const table = card.locator("table").first();
      if ((await table.count()) > 0) {
        const bottomGap = await card.evaluate((element) => {
          const tableElement = element.querySelector("table");
          if (!tableElement) return 0;
          const cardRect = element.getBoundingClientRect();
          const tableRect = tableElement.getBoundingClientRect();
          return Math.round(cardRect.bottom - tableRect.bottom);
        });

        if (bottomGap > MAX_TABLE_BOTTOM_GAP) {
          throw new Error(
            `${slug}: 표 아래 여백 ${bottomGap}px이 기준 ${MAX_TABLE_BOTTOM_GAP}px을 넘습니다. ` +
              "fitRowsToCanvas 또는 행 높이를 조정하세요."
          );
        }
      }

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

        totalExported += exported.length;
        log("✅", `${targetSlug}: ${exported.length}개 PNG 완료`);
        log("📁", outDir);
        log("⏱", `${targetSlug}: ${((performance.now() - projectStartedAt) / 1000).toFixed(2)}초`);
      }
    }

    console.log("");
    log("✅", `일괄 내보내기 완료! ${targetSlugs.length}개 프로젝트, PNG ${totalExported}개`);
    log("⏱", `전체 ${((performance.now() - startedAt) / 1000).toFixed(2)}초`);
    console.log("");

  } catch (err) {
    console.error("❌ 내보내기 실패:", err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("❌ 내보내기 실패:", error.message);
  process.exitCode = 1;
});
