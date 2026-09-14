/**
 * 卡片渲染器：主题代码 + 文案 → 一张 PNG。
 *
 * 整条链路里没有生图模型。图是**算出来的**，字是**排出来的**。
 * 这不是将就，是这一组作品的前提：
 *   - 算出来的图是程序，能改一个参数看它怎么变；生出来的图是一个既定事实，改不动。
 *   - 判断句必须精确到字。交给图像模型，它会写错别字、会加装饰、会被光泽带走。
 *   - 同一个判断要能换 18 套配色、18 种意象重新出片，而字形与版式一丝不变。
 * 只有"图归算法、字归排版"，上面三件事才成立。
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPlaywright } from "./host.mjs";
import { paletteById } from "./palettes.mjs";
import { hashSeed } from "./rng.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/** 去掉 ESM 的 export 关键字，好让源码能塞进浏览器里的普通 <script>。 */
const inline = (src) => src.replace(/^export\s+/gm, "").replace(/^import[\s\S]*?;$/gm, "");

function readEngineSource() {
  return {
    kit: inline(readFileSync(resolve(here, "kit.mjs"), "utf8")),
    rng: inline(readFileSync(resolve(here, "rng.mjs"), "utf8")),
  };
}

/** 列出内置主题（按文件名，不加载）。 */
export async function listThemes() {
  const { readdirSync } = await import("node:fs");
  const dir = resolve(here, "themes");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => f.replace(/\.mjs$/, ""));
}

/** 读取一个主题的 meta（不需要浏览器）。 */
export async function themeMeta(id) {
  const mod = await import(resolve(here, "themes", `${id}.mjs`));
  return mod.meta;
}

const W = 1080;
const H = 1440;

/** 两种版式。plate 更克制、适合阅读；poster 更冲、适合分享。 */
const LAYOUTS = {
  plate: { artH: 864, dissolve: 340, padTop: 0, overlay: false },
  poster: { artH: 1440, dissolve: 0, padTop: 0, overlay: true },
};

function css(w, layout, palette, opts) {
  const titleSize = opts.titleSize ?? (layout.overlay ? 62 : 58);
  const sumSize = opts.summarySize ?? (layout.overlay ? 27 : 25);
  const overlay = layout.overlay;
  return `
  :root {
    --base: ${`rgb(${palette.base.join(",")})`};
    --ink: ${palette.ink};
    --ink-soft: ${palette.inkSoft};
    --muted: ${palette.muted};
    --rule: ${palette.rule};
    --title: ${titleSize}px;
    --sum: ${sumSize}px;
    --sans: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Noto Sans SC", sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${W}px; height: ${H}px; background: var(--base); }
  body { color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; }
  .card { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: var(--base); }
  canvas { position: absolute; top: 0; left: 0; width: ${W}px; height: ${layout.artH}px; display: block; }

  ${overlay ? `
  /* poster：整张图满幅，文字压在下方，靠一层很长的遮罩拿到可读性。
     遮罩必须够长——短了会在图上切出一条能看见的边。

     **遮罩必须比图像的亮部更暗。** 这里加重过一轮：
     原来是 0 → 0.05 → 0.30 → 0.62 → 0.82 → 0.90，
     在多数主题上够用，但遇到"亮部正好从文字后面穿过"的主题就不行了
     （discharge 的闪电、strata 的岩层、ink 的墨丝都会）。
     文字能不能读不该取决于随机种子恰好把光放在了哪里 —— 那是运气，不是设计。
     现在压到 0 → 0.10 → 0.46 → 0.76 → 0.90 → 0.95，留出的余量更大。 */
  .scrim {
    position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(to bottom,
      rgba(0,0,0,0) 0%,
      rgba(0,0,0,0.10) 38%,
      rgba(0,0,0,0.46) 56%,
      rgba(0,0,0,0.76) 70%,
      rgba(0,0,0,0.90) 82%,
      rgba(0,0,0,0.95) 100%);
  }
  ` : `
  /* plate：图在上，底部一段长渐变化进底色，文字落在底色上。
     不给图加边框、圆角、描边——它是"浮出来的光"，不是一张贴上去的图。 */
  .dissolve {
    position: absolute; left: 0; right: 0; top: ${layout.artH - layout.dissolve}px;
    height: ${layout.dissolve}px; pointer-events: none;
    background: linear-gradient(to bottom,
      ${`rgba(${palette.base.join(",")},0)`} 0%,
      ${`rgba(${palette.base.join(",")},0.08)`} 26%,
      ${`rgba(${palette.base.join(",")},0.30)`} 50%,
      ${`rgba(${palette.base.join(",")},0.62)`} 70%,
      ${`rgba(${palette.base.join(",")},0.88)`} 88%,
      var(--base) 100%);
  }
  `}

  .body {
    position: absolute; left: 0; right: 0; bottom: 0;
    height: ${overlay ? 620 : H - layout.artH + 300}px;
    padding: ${overlay ? "0 88px 78px" : "0 84px 74px"};
    display: flex; flex-direction: column; justify-content: flex-end;
  }
  .meta {
    display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
    margin-bottom: ${overlay ? 30 : 28}px;
  }
  .no {
    font-size: 20px; letter-spacing: 0.34em; text-transform: uppercase;
    color: var(--muted); font-variant-numeric: tabular-nums;
  }
  .no b { color: var(--ink); font-weight: 500; }
  .theme-name { font-size: 19px; letter-spacing: 0.30em; color: var(--muted); }

  h1 {
    font-size: var(--title); font-weight: 600; line-height: 1.30;
    letter-spacing: -0.012em; text-wrap: balance;
    text-shadow: 0 2px 30px rgba(0,0,0,0.62);
  }
  .summary {
    margin-top: 26px; font-size: var(--sum); line-height: 1.82;
    color: var(--ink-soft); text-wrap: pretty;
    text-shadow: 0 1px 18px rgba(0,0,0,0.55);
  }
  .foot {
    margin-top: 34px; padding-top: 22px; border-top: 1px solid var(--rule);
    display: flex; align-items: baseline; justify-content: space-between; gap: 20px;
  }
  .pal { font-size: 18px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--muted); }
  .mood { font-size: 18px; color: var(--muted); letter-spacing: 0.06em; }
  `;
}

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * 渲染一张卡片。
 *
 * @returns {Promise<{buffer: Buffer, meta: object}>}
 */
export async function renderCard({
  theme,
  palette = "deep-field",
  title,
  summary,
  index = "01",
  total = 1,
  kicker = null,
  footer = null,
  layout = "plate",
  width = W,
  height = H,
  scale = 2,
  extra = null,
  /**
   * 隐藏全部文字与遮罩，只留画面。
   *
   * 这是**给可读性体检用的**（`bin/readability.mjs`）。那个体检要量的是
   * "文字底下有多亮"，而在一张有字的卡上，文字本身（近白）就是文字带里
   * 最亮的像素 —— 直接量等于拿文字和文字比，会得到 1.15:1 这种荒谬的数字
   * （第一版就是这么错的）。必须拿到**没有字的那一版**才算得出背景的真实亮度。
   */
  hideText = false,
  /**
   * 复用的浏览器实例（可选）。
   *
   * **为什么需要**：这个函数原本每次调用都 `chromium.launch()` 再 `close()`。
   * 单张无所谓，但批量渲染时 `readability.mjs` 每张卡要渲染两次（有字版 + 无字版），
   * 648 张就是 1300 次浏览器启停 —— 实测跑到 200 多张就会因为资源耗尽
   * 抛 `browserType.launch: ... has been closed`，整个体检中断。
   *
   * 传入 browser 时本函数**不负责关闭它**（谁创建谁关闭）。
   */
  browser: sharedBrowser = null,
}) {
  if (!title || !summary) throw new Error("renderCard 需要 title 与 summary");
  const lay = LAYOUTS[layout];
  if (!lay) throw new Error(`未知版式 "${layout}"，可用：${Object.keys(LAYOUTS).join(", ")}`);

  const pal = typeof palette === "string" ? paletteById(palette) : palette;
  const themePath = resolve(here, "themes", `${theme}.mjs`);
  const themeSrc = readFileSync(themePath, "utf8");
  const { kit, rng } = readEngineSource();

  // 种子由主题 + 文案派生。**配色不参与**——
  //
  // 第一版把 palette.id 也算进种子，后果是：换配色会重新掷骰子，
  // 整个构图、星点位置、云团形状全变。这有两层坏处：
  //   ① 用户没法"同一张卡换个颜色比一比"，而那正是配色模板的用途；
  //   ② 体检里"换配色画面应该变色"这条判据失去意义——构图本来就不一样了，
  //      量出来的差异不知道是颜色造成的还是随机造成的。
  // 正确的语义是：**配色只决定颜色，不决定形状。**
  const seed = hashSeed(`${theme}|${title}|${index}`);
  // 艺术区高度：plate 是顶部那一条，poster 是整张
  const artH = layout === "poster" ? height : lay.artH;

  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>${css(width, lay, pal, {})}</style></head>
<body><div class="card">
  <canvas id="art"></canvas>
  ${lay.overlay ? `<div class="scrim"></div>` : `<div class="dissolve"></div>`}
  <div class="body" id="body">
    <div class="meta">
      <span class="no"><b>${esc(index)}</b> / ${String(total).padStart(2, "0")}</span>
      <span class="theme-name">${esc(kicker ?? "")}</span>
    </div>
    <h1 id="title">${esc(title)}</h1>
    <p class="summary" id="summary">${esc(summary)}</p>
    <div class="foot">
      <span class="pal">${esc(pal.zh)} ${esc(pal.en)}</span>
      <span class="mood">${esc(footer ?? pal.mood)}</span>
    </div>
  </div>
</div>
<script>
(function(){
${kit}
${rng}
${themeSrc.replace(/^export\s+/gm, "")}
  window.__meta = meta;
  var dpr = ${scale};
  var cv = document.getElementById("art");
  var W = ${width}, H = ${artH};
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = W + "px";
  cv.style.height = H + "px";
  var ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  var rng = makeRng(${seed});
  var palette = ${JSON.stringify(pal)};
  render(ctx, { w: W, h: H, rng: rng, palette: palette, extra: ${JSON.stringify(extra)} });
  window.__done = true;
})();
</script></body></html>`;

  const { chromium } = loadPlaywright();
  // 复用调用方给的浏览器；没有就自己开一个（并负责关掉）。
  const browser = sharedBrowser ?? (await chromium.launch());
  let page = null;
  try {
    page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: scale,
    });
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForFunction(() => window.__done === true, null, { timeout: 120_000 });

    // 文字容不下时逐级缩小，而不是让页脚被挤出去
    const fit = await page.evaluate(() => {
      const body = document.getElementById("body");
      let step = 0;
      while (body.scrollHeight > body.clientHeight + 1 && step < 6) {
        const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--title"));
        document.documentElement.style.setProperty("--title", (cur * 0.94).toFixed(1) + "px");
        const curS = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sum"));
        document.documentElement.style.setProperty("--sum", (curS * 0.96).toFixed(1) + "px");
        step++;
      }
      return { step, overflow: body.scrollHeight - body.clientHeight };
    });

    // 可读性体检用的"无字版"：把文字层藏掉，**保留遮罩**。
    //
    // 遮罩必须留下 —— 它和文字一起构成读者最终看到的东西，是"交付的一部分"。
    // 把它也藏掉去量，量到的是**没做任何保护**的画面，那必然会报出一堆问题，
    // 而那些问题在成品里并不存在（第一版就是这样，把 25 张判成不合格）。
    // 体检要问的是：**成品上，文字底下的背景有多亮。** 遮罩就该在这笔账里。
    if (hideText) {
      await page.evaluate(() => {
        document.getElementById("body").style.visibility = "hidden";
      });
    }

    /**
     * 文字块的真实几何。
     *
     * **必须从 DOM 量，不能按百分比猜。** 我按"标题占上半、摘要占下半"猜过一次，
     * 结果把页眉（01/10）和页脚（配色名）也算了进去 —— 那两个也是文字，
     * 它们的像素混进统计之后，同一配色下所有主题的量值变得一模一样，
     * 因为页眉页脚的位置颜色与主题无关。那种数字看着合理，实际毫无意义。
     *
     * 拿到 rect 之后，体检就能精确地问："标题这一块底下，背景最亮的地方有多亮"。
     */
    const rects = await page.evaluate(() => {
      const g = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      };
      return { title: g("title"), summary: g("summary") };
    });

    const buffer = await page.locator(".card").screenshot({ type: "png" });
    return { buffer, meta: { theme, palette: pal.id, layout, fit, rects, width, height, scale } };
  } finally {
    // 只关自己开的那个页面；浏览器本身由创建者负责。
    // **页面一定要关** —— 不关的话批量渲染时页面会越积越多，同样会耗尽资源。
    if (page) await page.close().catch(() => {});
    if (!sharedBrowser) await browser.close();
  }
}
