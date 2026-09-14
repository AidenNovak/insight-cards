#!/usr/bin/env node
/**
 * 200px 缩略图并排：THEME-SPEC 自检清单里那条"缩到 200px 宽仍能一眼看出是什么"。
 *
 * 这条没有自动判据（曾写过一个形态度量想守住它，实测分不开"不同主题"与
 * "同主题换种子"，已删 —— 见 bin/audit.mjs 顶部说明）。所以它只能人看，
 * 而这个脚本负责把"要给人看的东西"一次摆齐：
 * 每个主题按它**真实会用的配色**渲染，缩到 200px 宽，并排成一张图。
 *
 * 用法：node Tools/thumb-sheet.mjs <主题...> [--palette <id>] [--out <路径>]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCard, themeMeta } from "../packages/engine/render.mjs";
import { loadPlaywright } from "../packages/engine/host.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argOf = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const PALETTE = argOf("--palette", "deep-field");
const OUT = argOf("--out", resolve(HERE, "out/thumbs-200.png"));
const THEMES = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--palette" && argv[i - 1] !== "--out");

if (!THEMES.length) {
  console.error("用法：node Tools/thumb-sheet.mjs <主题...> [--palette <id>] [--out <路径>]");
  process.exit(2);
}

const TW = 200;
const TH = Math.round((TW * 4) / 3);
const PAD = 8;
const COLS = Math.min(6, THEMES.length);
const rows = Math.ceil(THEMES.length / COLS);

const { chromium } = loadPlaywright();
const browser = await chromium.launch();

const cells = [];
for (const theme of THEMES) {
  const meta = await themeMeta(theme);
  const { buffer } = await renderCard({
    theme,
    palette: PALETTE,
    title: "看起来在动，其实一直绕着同一个点",
    summary: "换城市、换工作、换关系，换完之后你还在同一个位置上困惑。",
    index: "01",
    total: 1,
    scale: 1,
    browser,
  });
  cells.push({ theme, zh: meta?.zh ?? "", b64: buffer.toString("base64") });
}

const page = await browser.newPage({
  viewport: { width: COLS * (TW + PAD) + PAD, height: rows * (TH + 16 + PAD) + PAD },
  deviceScaleFactor: 3, // 放大给人看时仍是清晰的
});
await page.setContent(
  `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#101014}
    .grid{display:grid;grid-template-columns:repeat(${COLS},${TW}px);gap:${PAD}px;padding:${PAD}px}
    img{width:${TW}px;height:${TH}px;display:block}
    .cap{font:11px/1.5 ui-monospace,Menlo,monospace;color:#8b93a2;padding-top:2px}
  </style></head><body><div class="grid">
    ${cells.map((c) => `<div><img src="data:image/png;base64,${c.b64}"><div class="cap">${c.theme} · ${c.zh}</div></div>`).join("")}
  </div></body></html>`,
  { waitUntil: "load" },
);
await page.waitForTimeout(300);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, await page.screenshot({ type: "png" }));
await browser.close();
console.log(`${OUT}  ·  ${cells.length} 个主题  ·  每格 ${TW}px 宽（卡片原始 1080px）`);
