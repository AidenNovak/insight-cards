#!/usr/bin/env node
/**
 * 落地页截图：两个宽度各出一张全页图，用来做视觉验收。
 *
 * 为什么不用浏览器里手点：验收要看的是**桌面宽度**下的版式（三栏画廊、
 * 左图右文的解剖图），窄窗口只会看到移动端单栏。这里固定 1440 与 390 两个宽度，
 * 顺便把 `?eager=1` 带上——全页截图时懒加载不一定会触发，画廊会拍成空框。
 *
 * 用法：
 *   node site/shot.mjs                    # 出 out/site-desktop.png 与 out/site-mobile.png
 *   node site/shot.mjs --url http://127.0.0.1:8791/
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPlaywright } from "../packages/engine/host.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const URL_BASE = argOf("--url", `file://${join(HERE, "index.html")}`);
const OUT_DIR = argOf("--out", join(HERE, "..", "out"));
mkdirSync(OUT_DIR, { recursive: true });

// file:// 下 fetch(cards.json) 会被 CORS 挡掉，画廊会空——所以默认要求起静态服务器。
if (URL_BASE.startsWith("file://")) {
  console.log("注意：file:// 下画廊会被 CORS 挡掉，看图时只当版式参考。");
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch();

for (const [name, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const url = `${URL_BASE}${URL_BASE.includes("?") ? "&" : "?"}eager=1`;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const broken = await page.evaluate(() =>
    [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute("src")));
  const out = join(OUT_DIR, `site-${name}.png`);
  writeFileSync(out, await page.screenshot({ fullPage: true }));
  console.log(`  ${name.padEnd(8)} ${width}px → ${out}${broken.length ? `  ⚠ 未加载图 ${broken.length} 张` : ""}`);
  await page.close();
}

await browser.close();
