#!/usr/bin/env node
/**
 * 生成一个可离线打开的画廊页：把排好的 deck 与配色表并成一张 HTML。
 *
 * 为什么要有它：PNG 是一张张的，翻起来费劲，而"这一套是否协调"必须并排看。
 * 画廊把这些图拼在一页里，可以滚动、可以缩略，也能直接发给人看。
 *
 * 图片以**相对路径**引用，不内联 base64 —— 内联会让文件大到几十 MB，
 * 而且改一张图就得重新生成整页。相对路径只要求目录结构不变。
 *
 * 用法：
 *   node bin/gallery.mjs                          # 用 registry/ 下的 deck
 *   node bin/gallery.mjs --out out/gallery.html
 *
 * **路径一律相对项目根目录解析，不相对当前目录。**
 * 这里踩过一次：原本用 `join("registry", preset)`，也就是跟着 cwd 走。
 * 从别的目录（比如技能被装到 ~/.dimcode/v2/skills/ 之后在 /tmp 下）调用时，
 * registry/ 找不到，画廊就被生成成**一个空页**，而且不报错 ——
 * 一个陌生的 agent 实测踩到了，还以为是 registry 没装。
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRESETS, expandPreset } from "../packages/engine/presets.mjs";
import { PALETTES } from "../packages/engine/palettes.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const i = argv.indexOf("--out");
const OUT = i >= 0 && argv[i + 1] ? argv[i + 1] : join(ROOT, "out/gallery.html");
const REGISTRY = join(ROOT, "registry");

/** 一个 deck 的成品图。取目录里按名字排序的 PNG。 */
function deckImages(preset) {
  const dir = join(REGISTRY, preset);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => ({ file: join(dir, f), name: f.replace(/^\d+-/, "").replace(/\.png$/, "") }));
}

const sections = [];
for (const [key, preset] of Object.entries(PRESETS)) {
  const imgs = deckImages(key);
  if (!imgs.length) continue;
  const cards = expandPreset(key);
  sections.push(`
  <section>
    <h2>${preset.zh}<span>${key}</span></h2>
    <p class="note">${preset.note ?? ""}</p>
    <div class="deck">
      ${imgs.map((im, n) => `<figure>
        <img src="${relative(dirname(OUT), im.file)}" loading="lazy" alt="${im.name}">
        <figcaption>
          <b>${String(n + 1).padStart(2, "0")}</b>
          ${cards[n] ? `<em>${cards[n].theme} · ${cards[n].palette}</em>` : `<em>${im.name}</em>`}
        </figcaption>
      </figure>`).join("")}
    </div>
  </section>`);
}

// 配色表（如果渲染过就放进来）
const sheet = join(ROOT, "out", "palettes.png");
if (existsSync(sheet)) {
  sections.push(`
  <section>
    <h2>配色总表<span>${PALETTES.length} 组</span></h2>
    <p class="note">底色 / 色阶 / 发光与点缀 / 文字可读性。配色是语气，不是装饰。</p>
    <img class="full" src="${relative(dirname(OUT), sheet)}" loading="lazy" alt="palettes">
  </section>`);
}

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Insight Cards · 画廊</title>
<style>
  :root { --bg:#08090c; --fg:#e8ecf1; --dim:#7f8896; --line:rgba(255,255,255,.09); }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
         font:15px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans SC",sans-serif; }
  header { padding:56px 40px 24px; border-bottom:1px solid var(--line); }
  h1 { margin:0 0 8px; font-size:26px; font-weight:600; letter-spacing:.01em; }
  header p { margin:0; color:var(--dim); font-size:13px; max-width:60ch; }
  section { padding:44px 40px; border-bottom:1px solid var(--line); }
  h2 { margin:0 0 4px; font-size:17px; font-weight:600; }
  h2 span { margin-left:10px; font:11px ui-monospace,Menlo,monospace;
            color:var(--dim); font-weight:400; letter-spacing:.08em; }
  .note { margin:0 0 20px; color:var(--dim); font-size:13px; max-width:70ch; }
  .deck { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:14px; }
  figure { margin:0; }
  figure img { width:100%; display:block; border-radius:3px; background:#000;
               border:1px solid var(--line); }
  figcaption { display:flex; gap:8px; align-items:baseline; padding-top:7px;
               font:11px ui-monospace,Menlo,monospace; color:var(--dim); }
  figcaption b { color:#aab3c0; font-weight:500; }
  figcaption em { font-style:normal; }
  .full { width:100%; display:block; border:1px solid var(--line); border-radius:4px; }
  footer { padding:34px 40px 60px; color:var(--dim); font-size:12px; }
  footer code { font-family:ui-monospace,Menlo,monospace; color:#aab3c0; }
</style></head>
<body>
<header>
  <h1>Insight Cards</h1>
  <p>图归算法，字归排版。整条链路没有生图模型 —— 每一张画面都是代码算出来的，
     同一个（主题, 配色, 文案）永远出同一张图。</p>
</header>
${sections.join("\n")}
<footer>
  ${PRESETS ? Object.keys(PRESETS).length : 0} 套 deck · ${PALETTES.length} 组配色 ·
  重渲染：<code>node bin/make-deck.mjs --preset &lt;name&gt; --out registry/&lt;name&gt;</code>
</footer>
</body></html>`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`${OUT}  ·  ${sections.length} 个板块`);
if (!sections.length) {
  // **空页要出声。** 静默生成一个没有图的 HTML，会让人以为是别处的问题。
  console.error(`  警告：一个板块都没有 —— 检查 ${REGISTRY} 下有没有排好的 deck`);
  console.error(`  （先跑 node bin/make-deck.mjs --preset <名字> --out registry/<名字>）`);
  process.exit(1);
}
