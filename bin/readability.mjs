#!/usr/bin/env node
/**
 * 可读性体检：**文字底下到底有多亮。**
 *
 * 为什么需要它：`poster` 版式的全部前提是"靠遮罩拿到可读性"，但之前没有任何东西
 * 验证过这句话。实测 `discharge` 的 poster 卡上，闪电正好从标题后面穿过，
 * 而遮罩是一个**固定梯度** —— 它不知道背后的画面有多亮。
 *
 * ### 这条判据我写错了三次，每次都是"量错了对象"
 *
 *   1. 直接量成品卡的文字带 → 量到的是**文字自己**（近白）。
 *      文字和文字比当然得到 1.15:1 这种荒谬数字。
 *   2. 藏掉文字**也藏掉遮罩** → 量到的是**没做任何保护**的画面。
 *      遮罩是交付的一部分，那些问题在成品里并不存在。25 张被误判。
 *   3. 按"标题占上半、摘要占下半"百分比切分 → 把**页眉和页脚**也算成了正文。
 *      它们的位置与文字颜色跟主题无关，于是同一配色下所有主题量值一模一样
 *      （4.72 / 1.33）—— 数值看着合理，其实什么都没量到。
 *
 * 现在：**文字块的位置从 DOM 精确量取**（render 返回 `meta.rects`），
 * 背景取无字版在**同一个 rect 内**的像素，文字按 alpha 合成到那个背景上。
 * 不依赖抗锯齿像素，也不猜位置。
 *
 * 判据用 WCAG：`(L_bright + 0.05) / (L_dark + 0.05)`，
 * 标题（大字）≥3.0，摘要（小字）≥4.5。
 *
 * 用法：
 *   node bin/readability.mjs                 # 全量（18 主题 × 18 配色 × 2 版式 = 648 张）
 *   node bin/readability.mjs --quick         # 抽样（前 4 组配色）
 *   node bin/readability.mjs --layout poster # 只测 poster
 *   node bin/readability.mjs --title "…" --summary "…"   # 用你自己那句话测
 *
 * **耗时与内存**：全量约 10–15 分钟（972 张格网体检约 10 分钟，可以对照着估）。
 * 它跑得比其它检查慢，是因为**每张卡要渲染两次**（有字版 + 无字版）。
 *
 * 如果中途崩了：先确认是不是资源问题。曾经有过一次——
 * 每张卡都启停浏览器，1300 次启停之后进程被拖垮，报的是
 * `browserType.launch: ... has been closed` 这类与渲染无关的错。
 * 现在全程复用一个浏览器（见下方 browser 的用法），这个问题已经修掉。
 * 若在别处再遇到"跑到一半抛异常"，先怀疑资源，而不是主题。
 */
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
const ONLY = argOf("--layout", null);
const AS_JSON = has("--json");

// 默认用一段**偏长**的测试文案：它比短的更容易把版式挤到边界，
// 测出来的余量才是真的余量。
// 也可以传 --title / --summary 换成你自己要用的那句话 ——
// 见文件末尾的说明。
const TITLE = argOf("--title", "你以为你在往前走，其实你一直在绕着同一个点转");
const SUMMARY = argOf(
  "--summary",
  "换城市、换工作、换关系，换完之后你还在同一个位置上困惑。绕着转的东西看起来一直在动，所以最难发现它没动。",
);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 相对亮度（WCAG 定义） */
const relLum = ([r, g, b]) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (la, lb) => {
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
};
/** "rgba(230,235,240,0.72)" → { rgb:[...], a:0.72 } */
function parseColor(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s);
  if (!m) return { rgb: [255, 255, 255], a: 1 };
  const p = m[1].split(",").map((x) => parseFloat(x));
  return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
}
/** 半透明前景合成到不透明背景上 —— 文字实际显示成什么颜色 */
const over = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a));

// **一个浏览器贯穿全程。**
//
// 原本每张卡都让 renderCard 自己启停浏览器：648 张 × 2 版 = 1300 次启停，
// 实测跑到 200 多张就因资源耗尽抛 `browserType.launch: ... has been closed`，
// 整个体检中断（拆成单版式各跑才过得去 —— 那种"绕过"不该是文档推荐的用法）。
//
// 现在：这里开**一个**浏览器，量图用**一个**常驻页面，
// renderCard 也复用同一个浏览器（只开关页面）。
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });

/** renderCard 统一走这个包装，确保复用浏览器 */
const render = (opts) => renderCard({ ...opts, browser });

/**
 * 在无字版里量 rect 内的背景。
 *
 * 返回两组样本，都带**真实 RGB**（不是只给亮度 —— 半透明文字合成需要 RGB）：
 *   bright：最亮的那 2%（局部压住一行字的亮处，最不利）
 *   median：中位亮度附近的一小段（用来判断"整体是否也不行"）
 */
async function bgStats(buf, rect, cardW, cardH) {
  return page.evaluate(
    async ({ b64, rect, cardW, cardH }) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = "data:image/png;base64," + b64;
      });
      const W = 216;
      const H = Math.round((cardH / cardW) * W);
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0, W, H);

      const sx = W / cardW, sy = H / cardH;
      const x0 = Math.max(0, Math.floor((rect.x + 2) * sx));
      const y0 = Math.max(0, Math.floor((rect.y + 2) * sy));
      const x1 = Math.min(W, Math.ceil((rect.x + rect.w - 2) * sx));
      const y1 = Math.min(H, Math.ceil((rect.y + rect.h - 2) * sy));
      if (x1 <= x0 || y1 <= y0) return null;

      const d = x.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const px = [];
      for (let i = 0; i < d.length; i += 4) {
        px.push({ rgb: [d[i], d[i + 1], d[i + 2]], l: 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]) });
      }
      px.sort((a, b) => b.l - a.l);
      const avg = (list) => {
        if (!list.length) return null;
        const n = list.length;
        return {
          rgb: [0, 1, 2].map((i) => list.reduce((s, p) => s + p.rgb[i], 0) / n),
          l: list.reduce((s, p) => s + p.l, 0) / n,
        };
      };
      const nBright = Math.max(1, Math.floor(px.length * 0.02));
      const midStart = Math.floor(px.length * 0.45);
      return {
        bright: avg(px.slice(0, nBright)),
        median: avg(px.slice(midStart, midStart + Math.max(1, Math.floor(px.length * 0.1)))),
        n: px.length,
      };
    },
    { b64: buf.toString("base64"), rect, cardW, cardH },
  );
}

/**
 * 一个文字块的对比度。
 * 在**最亮的那片背景**上做合成 —— 那是最不利的情形，也是判据要守的地方。
 */
async function judge(bareBuf, rect, colorStr, cardW, cardH) {
  if (!rect || !rect.w || !rect.h) return null;
  const bg = await bgStats(bareBuf, rect, cardW, cardH);
  if (!bg) return null;
  const { rgb: fg, a } = parseColor(colorStr);

  const shownWorst = over(fg, bg.bright.rgb, a);
  const shownMedian = over(fg, bg.median.rgb, a);

  return {
    worst: ratio(relLum(shownWorst), bg.bright.l),
    median: ratio(relLum(shownMedian), bg.median.l),
    bgWorst: bg.bright.l,
  };
}

const themes = await listThemes();
const palettes = QUICK ? PALETTES.slice(0, 4) : PALETTES;
const layouts = ONLY ? [ONLY] : ["plate", "poster"];
const total = themes.length * palettes.length * layouts.length;

if (!AS_JSON) {
  console.log(`\n可读性体检 · ${themes.length} 主题 × ${palettes.length} 配色 × ${layouts.length} 版式 = ${total} 张`);
  console.log("（DOM 取文字位置，量它底下的背景亮度；标题 ≥3.0，摘要 ≥4.5）\n");
}

const problems = [];
const samples = [];   // 所有量到的值（用来核对判据本身是否有区分度）
let done = 0;

for (const layout of layouts) {
  for (const theme of themes) {
    for (const pal of palettes) {
      const base = { theme, palette: pal.id, layout, title: TITLE, summary: SUMMARY, scale: 1 };
      const withText = await render(base);
      const bare = await render({ ...base, hideText: true });
      const { rects, width, height } = withText.meta;

      const t = await judge(bare.buffer, rects.title, pal.ink, width, height);
      const s = await judge(bare.buffer, rects.summary, pal.inkSoft, width, height);

      samples.push({
        layout, theme, palette: pal.id,
        cTitle: t?.worst ?? null, cSummary: s?.worst ?? null,
      });

      if ((t && t.worst < 3.0) || (s && s.worst < 4.5)) {
        problems.push({
          layout, theme, palette: pal.id,
          cTitle: t?.worst ?? null, cSummary: s?.worst ?? null,
          medTitle: t?.median ?? null, medSummary: s?.median ?? null,
        });
      }
      done++;
      if (!AS_JSON && done % 40 === 0) process.stdout.write(`\r  进度 ${done}/${total}  `);
    }
  }
}

/**
 * 判据自检：**一个从不失败的标准是没用的标准。**
 *
 * 如果所有量值都远高于阈值，那要么画面真的都很安全，要么量错了东西
 * （我在这个文件里已经量错过三次）。所以把分布打出来看一眼：
 * 最小值、中位数、以及有多少张真的贴着阈值。
 */
function reportStats() {
  for (const layout of layouts) {
    const list = samples.filter((x) => x.layout === layout);
    const ct = list.map((x) => x.cTitle).filter((v) => v != null).sort((a, b) => a - b);
    const cs = list.map((x) => x.cSummary).filter((v) => v != null).sort((a, b) => a - b);
    const q = (arr, t) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * t))] : NaN);
    const near = ct.filter((v) => v < 5).length + cs.filter((v) => v < 6).length;
    console.log(
      `    ${layout.padEnd(7)}标题 min ${q(ct, 0).toFixed(1)} / 中位 ${q(ct, 0.5).toFixed(1)} / max ${q(ct, 0.999).toFixed(1)}` +
        `   摘要 min ${q(cs, 0).toFixed(1)} / 中位 ${q(cs, 0.5).toFixed(1)}`,
    );
    console.log(`          贴近阈值（标题<5 或 摘要<6）的：${near} / ${list.length * 2}`);
  }
}

await browser.close();

if (AS_JSON) {
  console.log(JSON.stringify({ total, done, problems }, null, 2));
} else {
  console.log(`\r  ${done}/${total} 张量完\n`);
  console.log("  量值分布（用来核对判据本身有区分度）：");
  reportStats();
  console.log("");
  if (!problems.length) {
    console.log("  ✓ 全部通过\n");
  } else {
    const byLayout = {};
    for (const p of problems) (byLayout[p.layout] ??= []).push(p);
    for (const [layout, list] of Object.entries(byLayout)) {
      console.log(`  ✗ ${layout}：${list.length} 张不合格`);
      list.sort((a, b) => (a.cTitle ?? 9) - (b.cTitle ?? 9));
      for (const p of list.slice(0, 14)) {
        console.log(
          `      ${p.theme.padEnd(12)}× ${p.palette.padEnd(14)}` +
            `标题 ${p.cTitle?.toFixed(2)}（中位 ${p.medTitle?.toFixed(2)}）` +
            `  摘要 ${p.cSummary?.toFixed(2)}（中位 ${p.medSummary?.toFixed(2)}）`,
        );
      }
      if (list.length > 14) console.log(`      …另有 ${list.length - 14} 张`);
    }
    console.log("");
  }
}

process.exit(problems.length ? 1 : 0);
