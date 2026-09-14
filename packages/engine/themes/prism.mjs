export const meta = {
  id: "prism",
  zh: "棱镜",
  en: "Prism",
  connects: "折射",
  mood: "同一束光进去，出来时被拆成了它的组成",
  note: "连接来自折射：进去的是白色的、看不出成分的，经过一次转折之后，里面本来混着的东西才分开。",
};

/**
 * 棱镜。
 *
 * ### 这是「折射」，不是「扩散」也不是「共振」
 *
 *   - **扩散**（墨）：一个整体的形状在变大、变淡，它**没有内部结构**。
 *   - **折射**（棱镜）：光进去时是白的（看起来不能再简单），
 *     出来时**被拆开了** —— 它一直有内部结构，只是之前看不见。
 *   - **共振**：两个东西互相加强。
 *
 * 所以这张卡要表达的是**"分解"**：一条进来的光、一条出去的扇形光谱。
 * 关键在"扇形"—— 光谱是**有顺序**的（红橙黄绿蓝靛紫按角度排开），
 * 不是一团彩色。
 *
 * ### 一条必须守住的物理
 *
 * 光谱的颜色顺序由折射率决定，**不是随便挑几个好看的颜色**。
 * 但这一组卡片的硬约束是"一切从 palette 派生"（不许写死颜色）。
 * 这两件事怎么同时满足？——
 *
 *   用**亮度/位置**来承担"分解"，用 **palette** 来承担色相。
 *   也就是说：扇形的每一道仍是本配色的色阶（从 glow 到 accent 之间变化），
 *   而"被拆开"这件事由**一道道分开的、角度递增的光线**表达。
 *
 * 这样既守住了硬约束（换配色整张图会变色，体检能验），
 * 又不会变成一张与配色无关的彩虹图 —— 后者会破坏整套的统一性，
 * 因为你换到"石墨"配色时，画面里不该还固执地留着一条彩虹。
 *
 * ### 这套做法买不到什么（代价写在这里，免得以后有人用"彩虹"去修）
 *
 * 代价是：**"每一道是不同的组成"这件事，画面里读不出来**，
 * 能读出来的只有"一束光被拆成了多道"。实测过：把成片给一个没背景的人看，
 * 它给的是"只能看出散开"——而"散开"正是「扩散／水中墨」的机制，
 * 两个主题因此在小尺寸下会靠得偏近。这是这条设计的已知代价。
 *
 * 修它不是"给每道光线指定颜色"。查过全部 18 组配色的色相跨度：
 * 15 组是**单色相的明暗阶梯**（深空、霜、苔原……），只有 3 组有真跨度
 * （极光 90°、霓虹 76°、日蚀 51°）；连 `glow` 与 `accent` 的色相差中位也只有 5°
 * （只有日蚀 40°、霓虹 120° 例外）。这个配色体系**没打算**提供彩虹，
 * 写死一条彩虹会让这张卡在所有配色下长得一样，那它就不是模板了。
 *
 * 结论：分解由**几何**承担（离散的、角度递增的光线 + 穿过棱镜的内部那一段），
 * 色相由配色承担。这是这套体系里能做到的最强表达；不再往"更不像示意图"的方向调，
 * 那会滑向装饰。
 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  // ── 棱镜本体：一个三角形 ──
  // 不用正三角形（那太像教科书插图）。用不规则的、微微倾斜的。
  const cx = rng.range(0.40, 0.58) * w;
  const cy = rng.range(0.46, 0.60) * h;
  const size = w * rng.range(0.20, 0.27);
  const tilt = rng.range(-0.22, 0.22);
  const prism = [
    [cx + Math.cos(-Math.PI / 2 + tilt) * size * 1.15, cy + Math.sin(-Math.PI / 2 + tilt) * size * 1.15],
    [cx + Math.cos(-Math.PI / 2 + tilt + 2.05) * size, cy + Math.sin(-Math.PI / 2 + tilt + 2.05) * size],
    [cx + Math.cos(-Math.PI / 2 + tilt - 2.05) * size, cy + Math.sin(-Math.PI / 2 + tilt - 2.05) * size],
  ];

  // 入射方向：从左上或右上进来。决定整张图的走向。
  const FROM_LEFT = rng.next() < 0.5;
  const inDir = FROM_LEFT ? rng.range(0.35, 0.62) : Math.PI - rng.range(0.35, 0.62);

  // ── 入射光：一束白光 ──
  // 它是"进来之前"的样子：看起来只是一条亮线，没有成分。
  const inStart = [
    cx - Math.cos(inDir) * size * 3.4,
    cy - Math.sin(inDir) * size * 3.4,
  ];
  // 打到棱镜的面上 —— 取棱镜靠入射侧的那条边的中点附近
  const hitT = rng.range(0.34, 0.62);
  const edgeA = FROM_LEFT ? prism[0] : prism[0];
  const edgeB = FROM_LEFT ? prism[1] : prism[2];
  const hit = [
    edgeA[0] + (edgeB[0] - edgeA[0]) * hitT,
    edgeA[1] + (edgeB[1] - edgeA[1]) * hitT,
  ];

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // 白光：宽而柔的一束，中心最亮
  const beam = [];
  const BN = 30;
  for (let i = 0; i <= BN; i++) {
    const t = i / BN;
    beam.push([inStart[0] + (hit[0] - inStart[0]) * t, inStart[1] + (hit[1] - inStart[1]) * t]);
  }
  const white = mix(palette.glow, [255, 255, 255], 0.75);
  litStroke(ctx, beam, 12, palette.glow, 0.10, 3);
  litStroke(ctx, beam, 3.2, white, 0.34, 3);
  litStroke(ctx, beam, 1.0, [255, 255, 255], 0.55, 2);
  ctx.restore();

  // ── 棱镜内部：光在里面走了一段 ──
  // 这一段必须有。光是**穿过**棱镜的，不是被它弹开 ——
  // 少了内部这一段，看起来会是"光照到玻璃上反射了"，而不是"光经过玻璃被分解"。
  const exitEdge = FROM_LEFT ? [prism[2], prism[0]] : [prism[1], prism[0]];
  const exitT = rng.range(0.40, 0.66);
  const exit = [
    exitEdge[0][0] + (exitEdge[1][0] - exitEdge[0][0]) * exitT,
    exitEdge[0][1] + (exitEdge[1][1] - exitEdge[0][1]) * exitT,
  ];

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const inner = [[hit[0], hit[1]], [exit[0], exit[1]]];
  litStroke(ctx, inner, 5, white, 0.18, 3);
  litStroke(ctx, inner, 1.6, [255, 255, 255], 0.40, 2);
  ctx.restore();

  // ── 出射：**被拆开的光谱** ──
  // 这是整张图的主语。现在才第一次出现"分开的、有顺序的多道光线"。
  //
  // 每条光线的**亮度与色温**由配色决定，而"被拆开"由角度递增表达。
  const N = rng.int(7, 10);
  // 出射的总散射角：太大就像洒开的扇子，太小就看不出分解
  const spread = rng.range(0.42, 0.62);
  const outBase = FROM_LEFT ? rng.range(-0.18, 0.18) : Math.PI + rng.range(-0.18, 0.18);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < N; k++) {
    const t = N === 1 ? 0.5 : k / (N - 1);
    const ang = outBase + (t - 0.5) * spread * (FROM_LEFT ? 1 : -1);

    // 每条光的长度不同：靠中间（偏白的那几道）短一些，两端的更长 ——
    // 真实光谱里靠两端的色光偏折更多，也铺得更开。
    const len = size * (2.6 + Math.abs(t - 0.5) * 2.4 + rng.range(0, 0.5));
    const end = [exit[0] + Math.cos(ang) * len, exit[1] + Math.sin(ang) * len];

    // 色相：从 glow 到 accent 之间过渡 ——
    // 这样在"深空"里是一束冷光在分解，在"余烬"里就是一束暖光在分解。
    // 换配色整张图跟着变，但"分解"这件事本身与配色无关。
    const col = mix(palette.glow, palette.accent, t);

    const pts = [];
    const SN = 24;
    for (let i = 0; i <= SN; i++) {
      const u = i / SN;
      // 出射后略微散开（光束不是数学直线）
      const wob = rng.noise2(u * 1.6 + k * 5, 3.1) * size * 0.05;
      pts.push([
        exit[0] + (end[0] - exit[0]) * u - Math.sin(ang) * wob,
        exit[1] + (end[1] - exit[1]) * u + Math.cos(ang) * wob,
      ]);
    }
    // 越靠边的光越弱（能量按角度摊开）
    const edgeFall = 1 - Math.abs(t - 0.5) * 0.75;
    litStroke(ctx, pts, 5.5, col, 0.07 * edgeFall, 3);
    litStroke(ctx, pts, 1.6, col, 0.20 * edgeFall, 3);
    litStroke(ctx, pts, 0.6, mix(col, [255, 255, 255], 0.5), 0.30 * edgeFall, 2);

    // 每道光的末端给一点辉：光谱在远处仍在扩散
    glow(ctx, end[0], end[1], w * 0.055, col, 0.055 * edgeFall);
  }
  ctx.restore();

  // ── 棱镜玻璃本身 ──
  // 玻璃的可见性来自**边缘**（折射率跳变的地方）和**内部的一点散射**，
  // 不是来自填充。填满就变成一个实心三角，把内部的光路遮住了。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // 三条棱：靠入射那一侧更亮（那里正被光打着）
  for (let i = 0; i < 3; i++) {
    const a = prism[i], b = prism[(i + 1) % 3];
    const lit = Math.abs(((Math.atan2(b[1] - a[1], b[0] - a[0]) - inDir + Math.PI * 3) % TAU) - Math.PI);
    const facing = clamp(1 - lit / Math.PI);
    ctx.strokeStyle = rgb(mix(palette.glow, [255, 255, 255], 0.35), 0.18 + facing * 0.45);
    ctx.lineWidth = 1.0 + facing * 1.6;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    // 棱的外侧薄辉：玻璃边缘的反光
    if (facing > 0.35) {
      litStroke(ctx, [[a[0], a[1]], [b[0], b[1]]], 4.5, palette.glow, facing * 0.10, 3);
    }
  }

  // 内部散射：极淡，只为了让三角"是个实体"
  const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 1.25);
  cg.addColorStop(0, rgb(palette.glow, 0.055));
  cg.addColorStop(0.7, rgb(palette.glow, 0.018));
  cg.addColorStop(1, rgb(palette.glow, 0));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(prism[0][0], prism[0][1]);
  ctx.lineTo(prism[1][0], prism[1][1]);
  ctx.lineTo(prism[2][0], prism[2][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ── 入射点与出射点 ──
  // 这两个点是"转折"发生的地方，给一点集中的亮 ——
  // 眼睛需要知道光是在哪里拐弯的，否则那束光和这个三角看起来没关系。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, hit[0], hit[1], w * 0.075, palette.glow, 0.16);
  glow(ctx, hit[0], hit[1], w * 0.018, mix(palette.glow, [255, 255, 255], 0.6), 0.42);
  glow(ctx, exit[0], exit[1], w * 0.11, palette.glow, 0.18);
  glow(ctx, exit[0], exit[1], w * 0.024, mix(palette.glow, [255, 255, 255], 0.7), 0.46);
  ctx.restore();

  // ── 空气里的浮尘 ──
  // 有微尘才看得见光束（丁达尔效应）。这一层很淡，但它让光"有体积"。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 160; i++) {
    const px = rng.next() * w;
    const py = rng.next() * h;
    // 离出射光扇越近的尘越亮
    const dOut = Math.hypot(px - exit[0], py - exit[1]);
    const near = clamp(1 - dOut / (size * 3.2));
    const b = 0.02 + near * 0.10 * rng.next();
    if (b < 0.025) continue;
    ctx.fillStyle = rgb(mix(palette.glow, [255, 255, 255], 0.3), b);
    ctx.beginPath();
    ctx.arc(px, py, rng.range(0.4, 1.5), 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // 底色的暗部层次：让四角沉下去，把注意力收到中间的光路上
  ctx.save();
  const vig = ctx.createRadialGradient(cx, cy, size * 0.9, cx, cy, Math.hypot(w, h) * 0.78);
  vig.addColorStop(0, rgb(palette.base, 0));
  vig.addColorStop(1, rgb(palette.base, 0.55));
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  vignette(ctx, w, h, 0.42, 1.35);
  grain(ctx, w, h, rng, 0.042, 2);
}
