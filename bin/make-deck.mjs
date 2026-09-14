#!/usr/bin/env node
/**
 * 渲染一整套卡片。
 *
 * 用法：
 *   node bin/make-deck.mjs --preset nexus --out out/nexus
 *   node bin/make-deck.mjs --presets            # 列出预设
 *   node bin/make-deck.mjs --preset nexus --out out/nexus --layout poster --scale 1
 *
 * 失败不静默：某一张渲染不出来会明确报出来，并以非零码退出——
 * 一套卡片缺了一张却"成功退出"，是最容易漏掉的事故。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCard } from "../packages/engine/render.mjs";
import { PRESETS, expandPreset } from "../packages/engine/presets.mjs";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

if (has("presets")) {
  console.log("\n预设\n");
  for (const [id, p] of Object.entries(PRESETS)) {
    console.log(`${id.padEnd(16)} ${p.zh}  ·  ${p.cards.length} 张`);
    if (p.note) console.log(`${" ".repeat(17)}${p.note}`);
  }
  console.log();
  process.exit(0);
}

const presetName = arg("preset", "nexus");
const outDir = resolve(process.cwd(), arg("out", `out/${presetName}`));
const layout = arg("layout", "plate");
const scale = Number(arg("scale", "2"));
const only = arg("only", null); // 逗号分隔的序号，便于重跑个别张

let cards;
try {
  cards = expandPreset(presetName);
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
if (only) {
  const wanted = new Set(only.split(",").map((s) => String(s).padStart(2, "0")));
  cards = cards.filter((c) => wanted.has(c.index));
  if (!cards.length) {
    console.error(`--only "${only}" 没有匹配任何卡片`);
    process.exit(2);
  }
}

mkdirSync(outDir, { recursive: true });
const preset = PRESETS[presetName];
console.log(`\n${preset.zh}  ·  ${cards.length} 张  ·  ${layout} @${scale}x\n`);

// 全程复用一个浏览器。
//
// renderCard 不传 browser 时会自己 chromium.launch() 一遍 ——
// 一套 10 张就是 10 次启停（本机实测跑到中途会以
// `browserType.launch: ... has been closed` 崩掉）。
// 详见 render.mjs 里 browser 参数的说明。
const { loadPlaywright } = await import("../packages/engine/host.mjs");
const { chromium } = loadPlaywright();
const browser = await chromium.launch();

const failed = [];
const t0 = Date.now();

for (const card of cards) {
  const file = resolve(outDir, `${card.index}-${card.theme}.png`);
  try {
    const { buffer, meta } = await renderCard({ ...card, layout, scale, browser });
    writeFileSync(file, buffer);
    const shrink = meta.fit.step ? `  ·  文字缩了 ${meta.fit.step} 级` : "";
    console.log(`  ✓ ${card.index}  ${card.theme.padEnd(12)} × ${card.palette.padEnd(14)}${shrink}`);
  } catch (err) {
    failed.push({ index: card.index, theme: card.theme, error: String(err.message || err) });
    console.log(`  ✗ ${card.index}  ${card.theme.padEnd(12)} — ${String(err.message || err).split("\n")[0]}`);
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n完成 ${cards.length - failed.length}/${cards.length} 张，用时 ${secs}s`);
console.log(`输出：${outDir}`);
await browser.close();

if (failed.length) {
  console.log(`\n失败 ${failed.length} 张：`);
  for (const f of failed) console.log(`  ${f.index} ${f.theme} — ${f.error}`);
  process.exit(1);
}
