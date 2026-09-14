#!/usr/bin/env node
/**
 * 全网格渲染体检：**每个主题 × 每个配色 × 每种文案长度**，全都要能出图。
 *
 * 为什么需要这一层（`audit.mjs` 已经查了确定性和配色响应）：
 * `audit.mjs` 每个主题只跑 2 次、只用 2 个配色，覆盖不到"某个主题碰上某个配色就崩"
 * 这类问题——主题里若假设了 `palette.stops` 的某一档、或某个几何量在小画布下退化，
 * 单独测是看不出来的。文案长度同理：短句和长段落对版式的压力完全不同。
 *
 * 用法：
 *   node bin/grid.mjs                 # 全量（主题数 × 配色数 × 3 文案，见运行时输出）
 *   node bin/grid.mjs --quick         # 抽样（每主题 2 配色 × 1 文案）
 *   node bin/grid.mjs --json          # 机器可读，供远程脚本消费
 *   node bin/grid.mjs --out out/grid  # 顺便留图
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { renderCard, listThemes } from "../packages/engine/render.mjs";
import { PALETTES } from "../packages/engine/palettes.mjs";
import { loadPlaywright } from "../packages/engine/host.mjs";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argOf = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const QUICK = has("--quick");
const AS_JSON = has("--json");
const OUT = argOf("--out", null);

/**
 * 三种文案长度。**短句最容易暴露问题**：标题不满一行时，很多版式会失去重心；
 * 长段落则考察溢出与折行。中间长度是常规情形。
 */
const COPY = [
  {
    tag: "短",
    title: "不动",
    summary: "看起来在动，其实一直绕着同一个点。",
  },
  {
    tag: "中",
    title: "你以为你在往前走，其实你一直在绕着同一个点转",
    summary:
      "换城市、换工作、换关系，换完之后你还在同一个位置上困惑。绕着转的东西看起来一直在动，所以最难发现它没动。",
  },
  {
    tag: "长",
    title: "你以为你在往前走，其实你一直在绕着同一个点转，只是半径变大了",
    summary:
      "换城市、换工作、换关系，换完之后你还在同一个位置上困惑。绕着转的东西看起来一直在动，所以最难发现它没动。等你终于看出来它是一个圆，你已经花掉了好几年。而那几年并不算白费——不绕够一圈，你也看不见那个圆心。真正的问题从来不是哪一次选择做错了，是那个让所有选择都回到原点的东西，你一次也没问过它。",
  },
];

async function main() {
  // **一个浏览器贯穿全程。**
  // 每张卡启停一次浏览器的话，全量 972 张会有近千次启停，
  // 跑到中途资源耗尽直接抛错中断（readability 上真实发生过）。
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  /** 统一走这个包装，确保复用浏览器 */
  const render = (opts) => renderCard({ ...opts, browser });
  try {
    await run(browser, render);
  } finally {
    await browser.close();
  }
}

async function run(browser, render) {
  const themes = await listThemes();
  const palettes = QUICK ? PALETTES.slice(0, 2) : PALETTES;
  const copies = QUICK ? COPY.slice(0, 1) : COPY;
  const total = themes.length * palettes.length * copies.length;

  if (OUT) mkdirSync(OUT, { recursive: true });
  if (!AS_JSON) console.log(`\n网格体检 · ${themes.length} 主题 × ${palettes.length} 配色 × ${copies.length} 文案 = ${total} 张\n`);

  const failures = [];
  const slow = [];
  let done = 0;
  const t00 = Date.now();

  for (const theme of themes) {
    let themeFails = 0;
    let themeMs = 0;
    for (const pal of palettes) {
      for (const copy of copies) {
        const t0 = Date.now();
        try {
          const r = await render({
            theme,
            palette: pal.id,
            title: copy.title,
            summary: copy.summary,
            scale: 1,
          });
          const ms = Date.now() - t0;
          themeMs += ms;
          if (OUT) writeFileSync(`${OUT}/${theme}-${pal.id}-${copy.tag}.png`, r.buffer);

          // 版式合格性。渲染器会逐级缩小字号直到装下（fit.step 是缩了几级），
          // **step 大就是危险信号**：说明这段文案在这个主题下已经把字号压得很小，
          // 再长一点就会失败。overflow 仍有残留则直接判失败。
          const fit = r.meta && r.meta.fit;
          if (fit && fit.overflow > 1) {
            failures.push({
              theme, palette: pal.id, copy: copy.tag,
              why: `文字装不下（缩了 ${fit.step} 级后仍溢出 ${fit.overflow}px）`,
            });
            themeFails++;
          } else if (fit && fit.step >= 5) {
            failures.push({
              theme, palette: pal.id, copy: copy.tag,
              why: `版式吃紧（缩了 ${fit.step} 级才装下）`,
            });
            themeFails++;
          }
        } catch (e) {
          failures.push({
            theme,
            palette: pal.id,
            copy: copy.tag,
            why: `抛错：${String(e && e.message ? e.message : e).slice(0, 160)}`,
          });
          themeFails++;
        }
        done++;
        if (!AS_JSON && done % 20 === 0) {
          process.stdout.write(`\r  进度 ${done}/${total}  `);
        }
      }
    }
    slow.push({ theme, avgMs: Math.round(themeMs / (palettes.length * copies.length)) });
    if (!AS_JSON && themeFails) console.log(`\n  ✗ ${theme}：${themeFails} 张有问题`);
  }

  const elapsed = ((Date.now() - t00) / 1000).toFixed(1);
  slow.sort((a, b) => b.avgMs - a.avgMs);

  if (AS_JSON) {
    console.log(JSON.stringify({ total, done, failures, slow, seconds: Number(elapsed) }, null, 2));
  } else {
    console.log(`\r  ${done}/${total} 张完成，用时 ${elapsed}s\n`);
    if (failures.length) {
      console.log(`  ✗ ${failures.length} 张有问题：`);
      const byTheme = {};
      for (const f of failures) (byTheme[f.theme] ??= []).push(f);
      for (const [theme, fs] of Object.entries(byTheme)) {
        console.log(`    ${theme}（${fs.length}）`);
        for (const f of fs.slice(0, 4)) console.log(`      · ${f.palette} / ${f.copy} — ${f.why}`);
        if (fs.length > 4) console.log(`      · …另有 ${fs.length - 4} 张`);
      }
    } else {
      console.log("  ✓ 全部通过\n");
    }
    console.log("  最慢的三个主题（单张平均）：");
    for (const s of slow.slice(0, 3)) console.log(`    ${String(s.theme).padEnd(14)}${s.avgMs}ms`);
    console.log("");
  }

  process.exit(failures.length ? 1 : 0);
}

await main();
