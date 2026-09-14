#!/usr/bin/env node
/**
 * 配色一览表：把每一组配色画成一张色卡，并排看。
 *
 * 为什么需要它：`palette-check.mjs` 只能查出"数值上太近"，
 * 查不出"看起来是不是一回事"。有些配色在 RGB 空间里距离中等，
 * 视觉上却一眼可分（因为色相不同）；反过来也有数值够远但观感雷同的。
 * **最终判断只能靠看。** 这张表就是给眼睛用的。
 *
 * 每张色卡包含四样东西，它们正是选配色时真正要看的：
 *   - 底色（决定整张卡的"夜"是什么颜色）
 *   - 色阶四档（决定亮部的温度）
 *   - 发光色与点缀色（决定有没有层次）
 *   - 一行示例文字（决定文字压上去读不读得清）
 *
 * 用法：node bin/palette-sheet.mjs [--out out/palettes.png]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PALETTES } from "../packages/engine/palettes.mjs";

const argv = process.argv.slice(2);
const i = argv.indexOf("--out");
const OUT = i >= 0 && argv[i + 1] ? argv[i + 1] : "out/palettes.png";

const { loadPlaywright } = await import("../packages/engine/host.mjs");
const { chromium } = loadPlaywright();
const browser = await chromium.launch();

const COLS = 3;
const CW = 380;   // 单张色卡宽
const CH = 210;   // 单张色卡高
const PAD = 14;
const rows = Math.ceil(PALETTES.length / COLS);
const W = COLS * (CW + PAD) + PAD;
const H = rows * (CH + PAD) + PAD + 40;

const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

const rgba = (c) => `rgb(${c.join(",")})`;
const cards = PALETTES.map((p) => {
  const stops = p.stops.map((s, k) => {
    const w = 100 / p.stops.length;
    return `<i style="background:${rgba(s)};width:${w}%"></i>`;
  }).join("");
  return `<div class="card" style="background:${rgba(p.base)}">
    <div class="hd">
      <b>${p.zh}</b><span>${p.en}</span>
      <em>${p.id}</em>
    </div>
    <div class="mood" style="color:${p.inkSoft}">${p.mood}</div>
    <div class="stops">${stops}</div>
    <div class="pips">
      <span style="background:${rgba(p.glow)}"></span>
      <span style="background:${rgba(p.accent)}"></span>
      <label>glow / accent</label>
    </div>
    <div class="word" style="color:${p.ink}">你现在看见的，是你一直在找的东西</div>
    <div class="word2" style="color:${p.muted}">次要文字 · secondary text · 0123</div>
  </div>`;
}).join("");

await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#07070a;font-family:-apple-system,"PingFang SC","Noto Sans SC",sans-serif;}
  .grid{display:grid;grid-template-columns:repeat(${COLS},${CW}px);gap:${PAD}px;padding:${PAD}px;}
  .card{height:${CH}px;border-radius:8px;padding:14px 16px;box-sizing:border-box;
        display:flex;flex-direction:column;gap:6px;overflow:hidden;
        border:1px solid rgba(255,255,255,0.07);}
  .hd{display:flex;align-items:baseline;gap:8px;}
  .hd b{font-size:16px;color:#fff;font-weight:600;}
  .hd span{font-size:10px;color:rgba(255,255,255,0.42);letter-spacing:.06em;}
  .hd em{margin-left:auto;font-size:10px;font-style:normal;color:rgba(255,255,255,0.30);font-family:ui-monospace,Menlo,monospace;}
  .mood{font-size:11px;line-height:1.35;}
  .stops{display:flex;height:26px;border-radius:4px;overflow:hidden;margin-top:2px;}
  .stops i{display:block;}
  .pips{display:flex;align-items:center;gap:6px;}
  .pips span{width:14px;height:14px;border-radius:50%;}
  .pips label{font-size:9px;color:rgba(255,255,255,0.28);font-family:ui-monospace,Menlo,monospace;}
  .word{font-size:13px;font-weight:600;margin-top:2px;}
  .word2{font-size:10px;}
  .title{color:rgba(255,255,255,0.5);font-size:12px;letter-spacing:.1em;padding:16px 14px 0;
         font-family:ui-monospace,Menlo,monospace;}
</style></head><body>
<div class="title">PALETTES · ${PALETTES.length} 组 · 底色 / 色阶 / 发光与点缀 / 文字可读性</div>
<div class="grid">${cards}</div>
</body></html>`, { waitUntil: "load" });

await page.waitForTimeout(300);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, await page.screenshot({ type: "png" }));
await browser.close();
console.log(`${OUT}  ·  ${PALETTES.length} 组  ·  ${COLS} 列`);
