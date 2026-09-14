#!/usr/bin/env node
/**
 * 生成一张卡片。
 *
 * 用法：
 *   node bin/make-card.mjs --theme starfield --palette deep-field \
 *     --title "你不是在收集碎片，你在连一个只有你能看见的形状" \
 *     --summary "几百条记录躺在那里的时候什么都不是……" \
 *     --out out/01.png
 *
 *   node bin/make-card.mjs --themes        # 列出主题
 *   node bin/make-card.mjs --palettes      # 列出配色
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCard, listThemes } from "../packages/engine/render.mjs";
import { PALETTES } from "../packages/engine/palettes.mjs";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

function arg(name, fallback = null) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
}
const has = (name) => argv.includes(`--${name}`);

if (has("themes")) {
  const ids = await listThemes();

  // `--themes` 要打印**选主题真正需要的东西**，而不只是一个目录。
  //
  // 这里补过一轮：原本只打 id / zh / connects / mood，漏了 `note` ——
  // 而 `note`（"为什么这个意象表达了连接"）恰恰是从外部选主题时最有用的一句。
  // 漏了它的后果是：一个陌生 agent 只能一个个去 head 主题的 .mjs 文件头，
  // 或者凭主题名猜（实测就这么发生了）。
  //
  // 默认打印得紧凑（一行一个，列表用）；`--themes --full` 再多给 note 与 en，
  // 供真正要挑主题时读。列表里不做成默认，是因为 18 个主题的 note 加起来会很长，
  // 把"扫一眼有哪些"这件事变难。
  const FULL = has("full");
  const rows = [];
  for (const id of ids) {
    const mod = await import(resolve(here, "packages/engine/themes", `${id}.mjs`));
    const m = mod.meta;
    if (FULL) {
      rows.push(
        `${id}  ${m.zh} / ${m.en}\n` +
          `    机制  ${m.connects}\n` +
          `    情绪  ${m.mood}\n` +
          `    画什么  ${m.note}`,
      );
    } else {
      rows.push(`${id.padEnd(16)} ${m.zh.padEnd(8)} 连接来自${m.connects.padEnd(6)} ${m.mood}`);
    }
  }
  console.log(`\n主题（${ids.length}）${FULL ? "" : " —— 加 --full 看每个主题画的是什么（选主题时该看）"}\n`);
  console.log(rows.join(FULL ? "\n" : "\n"));
  console.log();
  process.exit(0);
}

if (has("palettes")) {
  console.log(`\n配色模板（${PALETTES.length}）\n`);
  for (const p of PALETTES) {
    console.log(`${p.id.padEnd(16)} ${p.zh.padEnd(6)} ${p.en.padEnd(16)} ${p.mood}`);
  }
  console.log();
  process.exit(0);
}

const theme = arg("theme", "starfield");
const palette = arg("palette", "deep-field");
const title = arg("title");
const summary = arg("summary");
const out = arg("out");

if (!title || !summary || !out) {
  console.error(
    [
      "缺少参数。至少需要 --title / --summary / --out。",
      "",
      "  --themes  列出所有主题（含各自的连接机制）",
      "  --full    配合 --themes：多给每个主题画的是什么、英文名",
      "  --palettes 列出所有配色（含各自的情绪）",
      "",
      "  --theme   主题 id      （默认 starfield）",
      "  --palette 配色 id      （默认 deep-field）",
      "  --title   判断句（标题）",
      "  --summary 摘要",
      "  --out     输出 PNG 路径",
      "  --index   第几张（默认 01）",
      "  --total   共几张（默认 1）",
      "  --layout  plate | poster（默认 plate）",
      "  --scale   2（默认）| 1 | 3",
      "  --kicker  页眉右侧的短标签（默认空）",
      "  --footer  页脚右侧（默认用配色的情绪词）",
      "",
      "整批渲染用另一个命令：node bin/make-deck.mjs --preset <名字> --out <目录>",
      "参数全表与选主题的方法：读 SKILL.md",
    ].join("\n"),
  );
  process.exit(2);
}

const { buffer, meta } = await renderCard({
  theme,
  palette,
  title,
  summary,
  index: arg("index", "01"),
  total: Number(arg("total", "1")),
  layout: arg("layout", "plate"),
  scale: Number(arg("scale", "2")),
  kicker: arg("kicker", null),
  footer: arg("footer", null),
});

const outPath = resolve(process.cwd(), out);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buffer);
console.log(`${outPath}  ·  ${theme} × ${palette}  ·  ${meta.fit.step ? `文字缩了 ${meta.fit.step} 级` : "版式一次装下"}`);
