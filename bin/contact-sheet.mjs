#!/usr/bin/env node
/**
 * 把一批卡片拼成一张联络表（contact sheet），一次看完。
 *
 * 为什么需要：单张卡片 2160×2880，一个个看太慢，而且**看不出"这一套是否协调"** ——
 * 协调是整体的性质，只有并排才看得出来。尺有所短，把二十张缩到拇指大小排在一起，
 * 哪几张暗了、哪几张太满、哪几张光贴上去，一眼就出来。
 *
 * 用法：
 *   node bin/contact-sheet.mjs --dir out/grid --out out/sheet.png
 *   node bin/contact-sheet.mjs --dir out/grid --filter starfield --cols 6
 *   node bin/contact-sheet.mjs --themes --out out/themes-sheet.png   # 用内置文案跑每个主题
 */
import { readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCard, listThemes } from "../packages/engine/render.mjs";
import { expandPreset } from "../packages/engine/presets.mjs";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argOf = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

// 路径锚定到项目根目录，不跟着 cwd 走（同 gallery.mjs 的理由：
// 技能被装到别处之后，从任意目录调用都该能用）。
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = argOf("--dir", join(ROOT, "out/grid"));
const OUT = argOf("--out", join(ROOT, "out/sheet.png"));
const FILTER = argOf("--filter", null);
const COLS = Number(argOf("--cols", 5));
const MAX = Number(argOf("--max", 40));
const PRESET = argOf("--preset", null);

const TITLE = "你以为你在往前走，其实你一直在绕着同一个点转";
const SUMMARY =
  "换城市、换工作、换关系，换完之后你还在同一个位置上困惑。绕着转的东西看起来一直在动，所以最难发现它没动。";

async function gather() {
  // 指定预设时，用预设里**本来配好的**主题 × 配色 × 文案。
  // 这比"随便挑个配色"有意义得多：配色在预设里承担语气，抽离出来看会失真。
  if (PRESET) {
    return expandPreset(PRESET).map((c) => ({
      theme: c.theme,
      palette: c.palette,
      title: c.title,
      summary: c.summary,
      label: `${c.theme} · ${c.palette}`,
    }));
  }
  if (!existsSync(DIR)) {
    console.error(`找不到目录 ${DIR}。先跑 node bin/grid.mjs --out ${DIR}`);
    process.exit(1);
  }
  let files = readdirSync(DIR).filter((f) => f.endsWith(".png"));
  if (FILTER) files = files.filter((f) => f.includes(FILTER));
  files.sort();
  return files.slice(0, MAX).map((f) => ({ file: join(DIR, f), label: f.replace(/\.png$/, "") }));
}

const items = await gather();
if (!items.length) {
  console.error("没有可拼的图。");
  process.exit(1);
}

// 缩略图尺寸。保持 3:4 比例，因为卡片是 1080×1440。
const TW = 216;
const TH = 288;
const PAD = 10;
const LABEL_H = 18;
const rows = Math.ceil(items.length / COLS);
const W = COLS * (TW + PAD) + PAD;
const H = rows * (TH + LABEL_H + PAD) + PAD;

// 浏览器**先开**，渲染和拼图共用同一个。
//
// 这里原来是先渲染、后开浏览器 —— 于是每个 renderCard 各自 launch 一次，
// 10 张卡就是 10 次启停，拼图那次是第 11 次。改成先开后共用：
// 既省掉启停开销，也避开本机上 `browserType.launch: ... has been closed` 那类崩溃。
const { loadPlaywright } = await import("../packages/engine/host.mjs");
const { chromium } = loadPlaywright();
const browser = await chromium.launch();

const cells = [];
for (const it of items) {
  if (it.file) {
    cells.push({ label: it.label, file: it.file });
  } else {
    const r = await renderCard({
      theme: it.theme,
      palette: it.palette,
      title: it.title ?? TITLE,
      summary: it.summary ?? SUMMARY,
      scale: 1,
      browser,
    });
    cells.push({ label: it.label ?? it.theme, buffer: r.buffer });
  }
}

// 拼图本身也在浏览器里做——复用同一个 host，不引入新的图像库
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

const payload = cells.map((c) => ({
  label: c.label,
  b64: c.buffer ? c.buffer.toString("base64") : null,
  path: c.file ?? null,
}));

// 本地文件通过 file:// 读不了（沙箱），统一转成 base64 传进去
if (payload.some((p) => !p.b64)) {
  const { readFileSync } = await import("node:fs");
  for (const p of payload) if (!p.b64) p.b64 = readFileSync(p.path).toString("base64");
}

await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#0b0b0d;}
  .grid{display:grid;grid-template-columns:repeat(${COLS},${TW}px);gap:${PAD}px;padding:${PAD}px;}
  .cell{position:relative;}
  .cell img{width:${TW}px;height:${TH}px;display:block;background:#000;}
  .cap{font:11px/1.4 ui-monospace,Menlo,monospace;color:#7a8190;padding-top:3px;
       white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
</style></head><body>
<div class="grid">
  ${payload.map((p, i) => `<div class="cell"><img src="data:image/png;base64,${p.b64}"><div class="cap">${String(i + 1).padStart(2, "0")} ${p.label}</div></div>`).join("")}
</div></body></html>`, { waitUntil: "load" });

await page.waitForTimeout(400);
mkdirSync(dirname(OUT), { recursive: true });
const buf = await page.screenshot({ type: "png" });
writeFileSync(OUT, buf);
await browser.close();

console.log(`${OUT}  ·  ${cells.length} 张  ·  ${COLS} 列`);
