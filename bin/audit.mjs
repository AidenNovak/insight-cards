#!/usr/bin/env node
/**
 * 引擎体检。
 *
 * 每条判据都不是随便定的——每一条都对应一个**已经在别处发生过的真实事故**：
 *
 *   1. **确定性**：同一命令渲染两次，输出必须逐字节相同。
 *      不成立意味着主题里漏用了 `rng`（或用了 `Date.now()`），
 *      后果是"昨天看过的那张卡片，今天渲染不出来了"。
 *   2. **配色独立性**：换个配色，画面必须整体变色。
 *      不成立意味着主题里写死了颜色，那它就不是模板，只是恰好那样的一张图。
 *      这条分两问 —— 整体的亮部色距，与**亮部色相有没有跟着走**：
 *      只写死主体时，平均色距会被没写死的那部分稀释掉（实测仍有 33.8）。
 *      色相那条的第一版是错的（逐像素比色，在这种 alpha 合成引擎上恒为 0%，
 *      见下方 2b 的完整说明与标定数据）。
 *   3. **深色底**：卡片必须够暗，这是这一整套的基调（`strata` 是写明理由的例外）。
 *   4. **几何独立于配色**：配色只决定颜色、不决定形状。契约，走静态检查。
 *
 * **缩略图可读（缩到 200px 仍认得出主体）不在这里。** 它是语义判断，
 * 没有能自校准的读数 —— 曾经写过一个形态度量想守住这条，实测分不开
 * "两个不同的主题"与"同一主题换个种子"（跨主题最小 0.721，低于自身变异中位 0.771），
 * 那样上线等于发布一个假检查，已删。这条留在 `references/THEME-SPEC.md`
 * 的人工自检清单里，靠眼睛。
 *
 * 用法：node bin/audit.mjs [--theme starfield] [--json]
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCard, listThemes } from "../packages/engine/render.mjs";
import { PALETTES } from "../packages/engine/palettes.mjs";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? d : argv[i + 1];
};
const asJson = argv.includes("--json");
const only = arg("theme");

const TITLE = "体检用的判断句：看起来在动，其实一直绕着同一个点";
const SUMMARY = "这是一段用于体检的摘要文字，长度接近真实卡片，用来确认版式在正常长度下不会溢出，也确认字号自动收缩机制没有被触发。";

/**
 * 两张图的色指纹。**只统计画面区**（卡片上方的作品区），不统计文字区。
 *
 * 这里踩过一次坑，记下来：第一版量的是整张卡片，包括卡片下方的标题与摘要。
 * 那些文字是白色/近白（`--ink`），**两种配色下完全一样**，于是"最亮像素"
 * 恒为 ~[228,230,231]（文字的抗锯齿边缘），配色差异被彻底掩盖——
 * fireflies 因此被误判成"写死了颜色"，实际它的亮部色距是 45.5。
 *
 * **测量范围选错，会把正确的实现报成错的。** 这是同一个错误的第二次（第一次见
 * audit 里"全图 vs 亮部"的注释）。凡是"换 X 应该让 Y 变"的判据，
 * 先问一遍：我量的范围里，有没有不随 X 变的东西？
 *
 * 第三件事在这里算：亮部的**色相向量**（见下）。
 */
async function fingerprint(page, buf, artRatio = 0.6) {
  return page.evaluate(async ({ b64, artRatio }) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = `data:image/png;base64,${b64}`;
    });
    // 360 宽：局部写死的判据要在这个尺度上才稳（180 宽时细丝只剩几个像素）
    const W = 360;
    const H = 480;
    const artH = Math.round(H * artRatio);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, artH).data;

    let r = 0, g = 0, b = 0, n = 0, dark = 0;
    let lr = 0, lg = 0, lb = 0, ln = 0;
    let peak = [0, 0, 0, 0];
    /**
     * 亮部色相向量：按**饱和度**加权累加单位向量。
     *
     * 用向量（cos/sin）而不是角度平均，是因为色相是环形的 ——
     * 把 350° 和 10° 直接平均会得到 180°，那是完全相反的颜色。
     *
     * 只计够亮（lum ≥ 30）且够彩（sat ≥ 12）的像素：
     * 近灰的像素色相不稳，一点噪声就能让它跳 180°，权重低却能污染结果。
     */
    let hx = 0, hy = 0, hw = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [pr, pg, pb] = [d[i], d[i + 1], d[i + 2]];
      const lum = (pr + pg + pb) / 3;
      r += pr; g += pg; b += pb; n++;
      if (lum < 26) dark++;
      // 亮部才承载配色信息；近黑背景不随配色变，混进来只会稀释差异
      else { lr += pr; lg += pg; lb += pb; ln++; }
      if (lum > peak[0]) peak = [lum, pr, pg, pb];

      if (lum >= 30) {
        const max = Math.max(pr, pg, pb);
        const min = Math.min(pr, pg, pb);
        const sat = max - min;
        if (sat >= 12) {
          const dd = sat;
          let t;
          if (max === pr) t = (((pg - pb) / dd) % 6 + 6) % 6;
          else if (max === pg) t = (pb - pr) / dd + 2;
          else t = (pr - pg) / dd + 4;
          const rad = (t * 60 * Math.PI) / 180;
          hx += Math.cos(rad) * sat;
          hy += Math.sin(rad) * sat;
          hw += sat;
        }
      }
    }
    return {
      r: r / n, g: g / n, b: b / n,
      darkRatio: dark / n,
      lit: ln ? [lr / ln, lg / ln, lb / ln] : [0, 0, 0],
      litRatio: ln / n,
      peak: peak.slice(1),
      hue: hw ? { x: hx / hw, y: hy / hw, w: hw } : null,
    };
  }, { b64: buf.toString("base64"), artRatio });
}

const { loadPlaywright } = await import("../packages/engine/host.mjs");
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });

/**
 * 全程复用同一个浏览器。
 *
 * 这个文件里已经开了一个 browser 给指纹用，但下面的 renderCard 没有把
 * 它传进去 —— 于是 renderCard 每调用一次就自己 chromium.launch() 一遍。
 * 全量跑是 18 主题 × 3 次渲染 = 54 次 Chromium 启停，
 * 实测会以 `browserType.launch: ... has been closed` + SIGKILL 崩掉。
 *
 * 这正是文档里说"已修掉"的那个问题。当时修的是 renderCard 的能力
 * （加了 browser 参数），但没落地到这条最重的体检路径上 ——
 * **能力具备了不等于问题消失了。** 包一层，让下面每一处都必然复用。
 */
const render = (opts) => renderCard({ ...opts, browser });

const themes = only ? [only] : await listThemes();
const results = [];

for (const theme of themes) {
  const findings = [];
  const t0 = Date.now();

  // 1. 确定性：同参数渲染两次
  let a;
  let b;
  try {
    a = await render({ theme, palette: "deep-field", title: TITLE, summary: SUMMARY, scale: 1 });
    b = await render({ theme, palette: "deep-field", title: TITLE, summary: SUMMARY, scale: 1 });
  } catch (err) {
    results.push({ theme, findings: [{ level: "fail", m: `渲染失败：${String(err.message).split("\n")[0]}` }] });
    continue;
  }
  const ha = createHash("sha256").update(a.buffer).digest("hex").slice(0, 12);
  const hb = createHash("sha256").update(b.buffer).digest("hex").slice(0, 12);
  if (ha === hb) findings.push({ level: "pass", m: `两次渲染一致 (${ha})` });
  else findings.push({ level: "fail", m: `两次渲染不同 (${ha} vs ${hb})——主题里漏用了 rng` });

  // 2. 配色独立性：换一个**色相差别最大**的配色。
  //
  // **判据只看亮部，不看全图平均。** 第一版用全图平均色距，把 7 个主题全判成
  // "写死了颜色"——但那是判据的错：这一组是深色卡片，近黑背景占 88–95% 的像素，
  // 它不随配色变，于是把真实的色彩差异稀释到阈值以下。实测亮部色距 30–36，
  // 背景一平均就只剩 13–16。**测量对象选错，会把正确的实现报成错的。**
  //
  // 对照配色**按色相距离现算**，不写死某个 id。
  // 写死过一版（固定用 ember），隐患是：将来配色表一变，万一选中的这组
  // 与新表里最接近的配色色相很近，18 个主题会集体误报"颜色写死了"——
  // 一个会突然对全部主题叫的检查，很快就会被当成噪声忽略掉。
  // 现在每次运行都挑"与基准配色色相距离最远的那一组"。
  // 今天它挑出来的仍然是 ember（distance 176°，见下方标定），
  // 所以标定数据依然成立。
  const hueOf = ([r, g, b]) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return null;
    const d = max - min;
    let t;
    if (max === r) t = (((g - b) / d) % 6 + 6) % 6;
    else if (max === g) t = (b - r) / d + 2;
    else t = (r - g) / d + 4;
    return t * 60;
  };
  const circGap = (x, y) => {
    const d = Math.abs(x - y) % 360;
    return d > 180 ? 360 - d : d;
  };
  const base = PALETTES.find((p) => p.id === "deep-field") ?? PALETTES[0];
  const baseHue = hueOf(base.glow);
  const other =
    PALETTES.map((p) => {
      const h = hueOf(p.glow);
      return { p, gap: h == null || baseHue == null ? -1 : circGap(h, baseHue) };
    })
      .filter((x) => x.p.id !== base.id)
      .sort((x, y) => y.gap - x.gap)[0]?.p ?? PALETTES[1];
  const c = await render({ theme, palette: other.id, title: TITLE, summary: SUMMARY, scale: 1 });
  const fa = await fingerprint(page, a.buffer);
  const fc = await fingerprint(page, c.buffer);
  const distLit = Math.hypot(fa.lit[0] - fc.lit[0], fa.lit[1] - fc.lit[1], fa.lit[2] - fc.lit[2]);
  // 最亮像素也单独看一眼：它是"光"的颜色，最能体现配色是否真的生效
  const distPeak = Math.hypot(...[0, 1, 2].map((i) => fa.peak[i] - fc.peak[i]));
  if (distLit > 20) {
    findings.push({
      level: "pass",
      m: `换配色后画面变色明显（亮部色距 ${distLit.toFixed(1)}，最亮点 ${distPeak.toFixed(1)}）`,
    });
  } else {
    findings.push({
      level: "fail",
      m: `换配色后画面几乎没变（亮部色距 ${distLit.toFixed(1)}）——主题里写死了颜色`,
    });
  }

  // 2b. 局部写死：亮部的**色相**有没有跟着配色走。
  //
  // **为什么上面那条不够。** 它量的是整个亮部区域的平均色距 —— 局部写死的颜色
  // 会被没写死的那部分稀释掉。实测过：把 fiber 的主体结构色写死成纯红
  // （画面主体永久变红），亮部平均色距仍有 33.8，轻松通过。
  // 一个"主体写死颜色却报绿"的判据等于没有。
  //
  // ── 第一版这条判据是错的，写在这里免得下次再写一遍 ──
  //
  // 第一版问："有多少**亮着**的像素在换配色后颜色几乎一动不动（RGB 距离 < 6）？"
  // 它对 fiber 的两种写死都报 **0%**，而我当时是看着数据写的判据、没有正控，
  // 差点就当它成立。原因：这个仓库的绘制几乎都走 `lighter` / alpha 合成，
  // 像素 = 硬编码色 × α + 配色底 × (1−α)。**配色底一变，合成色就跟着变** ——
  // 哪怕主体颜色写死，也没有一个像素是"冻住"的。
  // 逐像素比色的判据在这个引擎上量不到这件事（后来把分辨率从 180 提到 360
  // 又试了一次，仍为 0%）。
  //
  // ── 现在问的问题 ──
  //
  // 不问"单个像素动没动"，问"**整体**有没有跟着走"：
  // 亮部的饱和加权平均色相，在两套配色下相差多少度？
  // 一个全由配色决定的主体，换配色就该整体换色相；
  // 一个写死成红色的主体，会在两套配色下都把亮部拉向红色，色相几乎不动。
  //
  // 实测标定（18 个主题 × deep-field → ember，同一段文案）：
  //   正常主题：151.4° – 167.1°（全部集中在 160° 上下）
  //   把 fiber 主体写死成纯红：41.0°（保留 alpha）/ 8.6°（不透明）
  // 两组之间有三倍以上的空档。阈值取 100°：距正常最小值 51°，
  // 距写死最大值 59° —— 两侧余量都在 1.5 倍以上。
  const hueShift = (() => {
    if (!fa.hue || !fc.hue) return null;
    const dot = fa.hue.x * fc.hue.x + fa.hue.y * fc.hue.y;
    const cross = fa.hue.x * fc.hue.y - fa.hue.y * fc.hue.x;
    return (Math.atan2(cross, dot) * 180) / Math.PI;
  })();
  const HUE_SHIFT_MIN = 100;
  if (hueShift == null) {
    findings.push({
      level: "warn",
      m: "亮部几乎没有彩色像素，色相判据量不了（画面是不是接近单色？）",
    });
  } else if (Math.abs(hueShift) >= HUE_SHIFT_MIN) {
    findings.push({
      level: "pass",
      m: `亮部色相跟着配色走（移动 ${Math.abs(hueShift).toFixed(0)}°）`,
    });
  } else {
    findings.push({
      level: "fail",
      m: `换配色后亮部色相只移动了 ${Math.abs(hueShift).toFixed(0)}°（正常应 >100°）` +
        `——主体颜色几乎写死了，配色只改到了别处（平均色距 ${distLit.toFixed(1)} 会把它掩盖掉）`,
    });
  }

  // 3. 深色底：卡片必须够暗，这是这一整套的基调。
  //
  // **这条判据对 strata 不适用，原因写在这里而不是留在告警里。**
  // "暗部占比"假设画面大部分应该是近黑 —— 这对星野、萤火那种
  // "暗底上几个亮点"成立。但沉积是一张**整幅都是被照到的岩石**的图，
  // 它的主体本来就该占满画面；把它的暗部压到 85% 会让它变成一张看不见的图。
  //
  // 我已经人工看过两次（bone / brass 两个配色，缩略图加原尺寸），
  // 它在整组 deck 里读成"一块被光照到的岩壁"，不是"一张过曝的卡"。
  // 所以这是一个**明确的、有理由的例外**，不是还没修的缺陷。
  const BRIGHT_BY_DESIGN = new Set(["strata"]);
  if (fa.darkRatio > 0.30) {
    findings.push({ level: "pass", m: `暗部占比 ${(fa.darkRatio * 100).toFixed(0)}%` });
  } else if (BRIGHT_BY_DESIGN.has(theme)) {
    findings.push({
      level: "pass",
      m: `暗部占比 ${(fa.darkRatio * 100).toFixed(0)}%（整幅受光的主体，见本行上方注释）`,
    });
  } else {
    findings.push({ level: "warn", m: `暗部占比只有 ${(fa.darkRatio * 100).toFixed(0)}%，偏亮，不像深色卡片` });
  }

  results.push({
    theme,
    ms: Date.now() - t0,
    hash: ha,
    findings,
  });
}

// ── 契约检查：几何不可依赖配色 ──
//
// 这是**契约**，不是风格偏好：配色只决定颜色，不决定形状。
// 一旦主题用 palette 的**数值**做控制流（`if (palette.base[0] > 10)`），
// 或把 palette 传进 rng（`rng.range(0, palette.stops.length)`），
// 换配色就会改变构图 —— 上面"换配色画面应该变色"那条判据会因此失去意义，
// 因为量到的差异里混进了随机性。
//
// 用静态检查就够：这两种写法都是显式的。
// （另有一种隐式情况查不到：主题把 palette 传进一个自己定义的函数再由它影响几何。
//   实际的防护是上面那两条 + 人工看主题源码时留意。）
{
  // `here` 在 audit.mjs 里已经解析成仓库根目录（见文件顶部的定义），
  // 不要再加 `..` —— 我第一版多写了一层，直接找到上一层去了。
  const themeDir = resolve(here, "packages", "engine", "themes");
  const issues = [];
  for (const f of readdirSync(themeDir)) {
    if (!f.endsWith(".mjs")) continue;
    const src = readFileSync(resolve(themeDir, f), "utf8");
    if (/\b(if|while|for)\s*\([^)]*palette\.(base|stops|glow|accent)\s*\[/.test(src)) {
      issues.push({ level: "fail", m: `${f}：用 palette 的值做条件判断，几何会随配色改变` });
    }
    if (/\brng\.[a-z]+\([^)]*palette\.[a-z]/.test(src)) {
      issues.push({ level: "fail", m: `${f}：把 palette 传进了 rng，随机流会随配色改变` });
    }
  }
  results.push({
    theme: "（契约）",
    ms: 0,
    hash: "—",
    findings: issues.length
      ? issues
      : [{ level: "pass", m: "几何不依赖配色（所有主题：无 palette 条件分支、无 palette 入 rng）" }],
  });
}

await browser.close();

if (asJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(`\n引擎体检 · ${results.length} 个主题\n`);
  for (const r of results) {
    const failed = (r.findings ?? []).filter((f) => f.level === "fail");
    const warned = (r.findings ?? []).filter((f) => f.level === "warn");
    const mark = failed.length ? "✗" : warned.length ? "!" : "✓";
    console.log(`  ${mark} ${String(r.theme).padEnd(14)}${r.ms ? ` ${(r.ms / 1000).toFixed(1)}s` : ""}`);
    for (const f of r.findings ?? []) {
      console.log(`      ${f.level === "fail" ? "✗" : f.level === "warn" ? "!" : "·"} ${f.m}`);
    }
  }
  const failed = results.filter((r) => (r.findings ?? []).some((f) => f.level === "fail")).length;
  console.log(`\n  合计：${failed ? `${failed} 个主题不通过` : "全部通过"}\n`);
}

process.exit(results.some((r) => (r.findings ?? []).some((f) => f.level === "fail")) ? 1 : 0);
