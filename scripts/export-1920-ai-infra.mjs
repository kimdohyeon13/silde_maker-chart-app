#!/usr/bin/env node

import { chromium } from "playwright";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { extname, resolve } from "path";

const port = 3001;
const slug = process.argv[2] || "2026-08-03-investingpro-ai-infra-market-view";
const pixelRatio = 2;
const projectDir = resolve(process.cwd(), "..", "..", "projects", slug);
const outputDir = resolve(projectDir, "output");
const inputDir = resolve(projectDir, "input");
const baseUrl = `http://localhost:${port}`;

function asciiSlug(text, fallback) {
  const value = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-").toLowerCase();
  return value || fallback;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ deviceScaleFactor: pixelRatio, viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/export`, { waitUntil: "networkidle" });
    await page.locator("select").selectOption(slug);
    await page.waitForTimeout(1800);
    const sunButton = page.locator('button:has-text("☀")');
    if (await sunButton.isVisible()) {
      await sunButton.click();
      await page.waitForTimeout(500);
    }
    await page.addStyleTag({ content: `main { max-width: 1008px !important; } [data-export-name] { width: 960px !important; min-width: 960px !important; max-width: 960px !important; height: 540px !important; }` });
    await page.waitForTimeout(600);

    const cards = page.locator("[data-export-name]");
    const count = await cards.count();
    if (count !== 3) throw new Error(`표 카드 수가 3장이 아닙니다: ${count}`);

    const exported = [];
    for (let i = 0; i < count; i += 1) {
      const card = cards.nth(i);
      const exportName = await card.getAttribute("data-export-name");
      const filename = `${exportName || asciiSlug(`chart-${i + 1}`, `chart-${i + 1}`)}.png`;
      const path = resolve(outputDir, filename);
      await card.screenshot({ path, type: "png" });
      const box = await card.boundingBox();
      exported.push({ filename, cssWidth: box?.width, cssHeight: box?.height });
    }

    if (existsSync(inputDir)) {
      readdirSync(inputDir).filter((file) => [".png", ".jpg", ".jpeg", ".webp"].includes(extname(file).toLowerCase())).forEach((file, index) => {
        const prefix = String(index + 1).padStart(2, "0");
        const base = asciiSlug(file.replace(extname(file), ""), `input-${index + 1}`).slice(0, 50);
        copyFileSync(resolve(inputDir, file), resolve(outputDir, `input_${prefix}-${base}${extname(file)}`));
      });
    }

    console.log(JSON.stringify({ slug, exported }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
