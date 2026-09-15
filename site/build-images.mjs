#!/usr/bin/env node
/**
 * 落地页用的图：把卡片渲染成网页尺寸的 JPEG，另出一张 Open Graph 图。
 *
 * 为什么要有这个脚本：registry/ 里是 2160×2880 的成品 PNG（每张 2 MB 上下），
 * 直接当网页图会拖垮首屏。这里统一渲染 → 缩到 720 宽 → JPEG q82，
 * 页面只引用 site/assets/ 下的小图。
 *
 * 用法：node site/build-images.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCard, themeMeta } from "../packages/engine/render.mjs";
import { paletteById } from "../packages/engine/palettes.mjs";
import { loadPlaywright } from "../packages/engine/host.mjs";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)));
const OUT_CARDS = join(HERE, "assets/cards");
const OUT_SOCIAL = join(HERE, "assets");

const CARDS = [
  { slug: "starfield", theme: "starfield", palette: "deep-field", kicker: "注视",
    title: "你不是在收集碎片，你在连一个只有你能看见的形状",
    summary: "几百条记录躺在那里的时候什么都不是。是你反复看的那几条，把它们连成了一个形状——而那个形状别人看不见，因为它只存在于你的注视里。" },
  { slug: "nebula", theme: "nebula", palette: "abyss", kicker: "引力",
    title: "散着的时候什么都不是，聚起来才有形状",
    summary: "你以为是你在整理它们。其实是它们彼此靠近到一定程度之后，自己开始有结构。" },
  { slug: "strata", theme: "strata", palette: "bone", kicker: "堆积",
    title: "每一层都薄得不像话，但它们摞成了时间",
    summary: "你回头看某一年，想找出决定性的那一刻，结果什么也没找到——那是一层不到一毫米的沉积。" },
  { slug: "discharge", theme: "discharge", palette: "core", kicker: "击穿",
    title: "突破不是积累的结果，是积累到某一点之后的击穿",
    summary: "你总想要渐变式的进步。但空气不会慢慢变成导体，它是在某一刻突然导电的。" },
  { slug: "echo", theme: "echo", palette: "amber", kicker: "延迟",
    title: "有些话要过很久才生效，而且是以衰减的方式回来",
    summary: "你当时说完就忘了。三年后某个下午，它以一句你早已不记得的句子的形状回来了。" },
  { slug: "tideline", theme: "tideline", palette: "brass", kicker: "累积",
    title: "每次都很浅，是来了很多次才刻出这道沟",
    summary: "没有哪一次特别重要。是同一个动作重复到足够多次，才在石头上留下痕迹。" },
  { slug: "lattice", theme: "lattice", palette: "graphite", kicker: "结晶",
    title: "成分没变，变的是它们的排列",
    summary: "同样的碳，散着是石墨，排列起来是钻石。你缺的不是新的东西，是它们之间的关系。" },
  { slug: "orbit", theme: "orbit", palette: "frost", kicker: "共生",
    title: "谁也没绕着谁，你们绕着彼此之间那个空的地方",
    summary: "两颗星的轨道由它们共同的重心决定，而那个点不在任何一颗星上。" },
  { slug: "fireflies", theme: "fireflies", palette: "bio", kicker: "同步",
    title: "同步不是有人指挥，是每个都在看邻座",
    summary: "没有中心，没有信号灯。整片夜色亮起来的那一刻，是无数个微小的彼此看见累积出来的。" },
  { slug: "mycelium", theme: "mycelium", palette: "moss", kicker: "交换",
    title: "看得见的是树，真正在交换的是地下的那张网",
    summary: "森林里最忙的地方没有一寸在地面之上。养分、警告、消息，全在看不见的地方走。" },
  { slug: "prism", theme: "prism", palette: "neon", kicker: "折射",
    title: "一直是那个东西，是某次转折才看出里面有什么",
    summary: "同一束白光进去，出来时被拆成了它的组成。它没变，是路径变了。" },
  { slug: "fiber", theme: "fiber", palette: "wine", kicker: "约束",
    title: "约束不是妨碍，是让光拐弯的东西",
    summary: "把光限制在一根比头发还细的玻璃里，它反而能带着信息走很远。" },
];

const browser = await loadPlaywright().chromium.launch();
mkdirSync(OUT_CARDS, { recursive: true });

// 只缩不放：卡片按 1080×1440 渲染，再缩到 720 宽。
const { default: sharpLike } = { default: null }; // 不引入新依赖，改用 Playwright 自己缩
const page = await browser.newPage({ viewport: { width: 720, height: 960 }, deviceScaleFactor: 1 });

const manifest = [];
for (const [i, card] of CARDS.entries()) {
  const meta = await themeMeta(card.theme);
  const palette = paletteById(card.palette);
  const { buffer } = await renderCard({
    ...card,
    index: String(i + 1).padStart(2, "0"),
    total: CARDS.length,
    width: 1080,
    height: 1440,
    scale: 1,
    browser,
  });
  const b64 = buffer.toString("base64");
  const shot = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 960;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, 720, 960);
    return canvas.toDataURL("image/jpeg", 0.82).split(",")[1];
  }, b64);
  writeFileSync(join(OUT_CARDS, `${card.slug}.jpg`), Buffer.from(shot, "base64"));
  manifest.push({
    slug: card.slug,
    theme: card.theme,
    themeZh: meta?.zh ?? card.theme,
    connects: meta?.connects ?? "",
    palette: card.palette,
    paletteZh: palette?.zh ?? card.palette,
    title: card.title,
  });
  console.log(`  ✓ ${card.slug.padEnd(10)} ${card.theme}/${card.palette}`);
}

// Open Graph 图：左边标题，右边一张卡。
const hero = CARDS[8]; // fireflies：最能代表"算出来的画面"
const heroMeta = await themeMeta(hero.theme);
const heroRender = await renderCard({
  ...hero,
  index: "09",
  total: CARDS.length,
  width: 1080,
  height: 1440,
  scale: 1,
  browser,
});
const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await og.setContent(
  `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:#14161c;color:#f4f3f0;
      font-family:"Noto Sans SC","PingFang SC",system-ui,sans-serif}
    .wrap{display:flex;height:100%;align-items:center;gap:56px;padding:64px}
    .txt{flex:1}
    h1{margin:0 0 20px;font-size:52px;line-height:1.25;letter-spacing:-0.01em}
    p{margin:0;font-size:22px;line-height:1.7;color:#b6bdc8}
    .tag{display:inline-block;margin-bottom:28px;padding:6px 14px;border:1px solid #2c313b;
      border-radius:999px;font-size:18px;color:#93dcbc}
    img{width:352px;height:469px;border-radius:14px;display:block}
  </style></head><body><div class="wrap">
    <div class="txt"><span class="tag">insight-cards</span>
      <h1>用代码算出画面，<br>用排版排出判断。</h1>
      <p>整条链路没有生图模型。18 个主题，每一个演示「连接」的一种机制。</p>
    </div>
    <img src="data:image/png;base64,${heroRender.buffer.toString("base64")}">
  </div></body></html>`,
  { waitUntil: "load" },
);
await og.waitForTimeout(300);
writeFileSync(join(OUT_SOCIAL, "og.png"), await og.screenshot({ type: "png" }));

writeFileSync(join(HERE, "cards.json"), JSON.stringify(manifest, null, 2) + "\n");
await browser.close();
console.log(`\n${CARDS.length} 张卡 → site/assets/cards/ ，OG 图 → site/assets/og.png ，清单 → site/cards.json`);
