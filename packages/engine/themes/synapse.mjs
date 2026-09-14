export const meta = {
  id: "synapse",
  zh: "突触",
  en: "Synapse",
  // 「激发」而非「放电」——
  // 原本这里写的是"放电"，但 `discharge` 这个主题的中文名也叫"放电"，
  // 于是同一张表里"放电"既是机制名又是主题名，读者（实测一个陌生 agent）
  // 会把 discharge 的机制误读成"放电"（它其实是"击穿"）。
  // 换个词就没有这个歧义，而且"激发"对突触更准：重点是**被触发**，不是释放。
  connects: "激发",
  mood: "两个念头靠得足够近时亮起来",
  note: "连接来自激发：想法只是并存时不会发生什么，靠得足够近、被彼此点亮，才算存在。",
};

/**
 * 突触。
 *
 * 这是最容易退化成「医学插图」的意象，有两条必须守住：
 *
 *   1. **分支要递归、要不等强。** 主干粗、次级细、末梢极细，
 *      而且每一级的长度都要缩短。等长的分支立刻变成雪花图表。
 *   2. **放电只发生在末梢。** 光点集中在最细的那一级枝上——
 *      如果主干也在发光，画面会变成"发光的树"，那是另一回事。
 *
 * 发光方式仍然遵守 THEME-SPEC：先粗而暗，再细而亮。亮的芯压在柔光上面。
 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  // ── 背景：极淡的雾，给纵深一个底 ──
  const nw = Math.round(w / 4);
  const nh = Math.round(h / 4);
  const haze = offscreen(nw, nh);
  const img = haze.ctx.createImageData(nw, nh);
  const d = img.data;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const u = x / nw;
      const v = y / nh;
      const n = rng.warp(u * 2.4, v * 2.4, 1.8, 4);
      const t = Math.pow(clamp(n * 0.72), 2.1) * 0.4;
      const c = ramp(palette.stops, t * 0.6);
      const i = (y * nw + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = Math.round(t * 255);
    }
  }
  haze.ctx.putImageData(img, 0, 0);
  blit(ctx, haze.canvas, w, h, 0.5, "lighter");

  // ── 树突 ──
  // 递归分叉：每级变细、变短、角度散开。末梢记录下来，之后在那里放光点。
  const tips = [];
  const segments = [];

  function branch(x, y, angle, len, width, depth) {
    const pts = [[x, y]];
    let cx = x;
    let cy = y;
    let a = angle;
    let traveled = 0;
    while (traveled < len) {
      const step = rng.range(9, 20);
      // 曲率随深度增大：越细的枝越容易被推弯
      a += rng.range(-1, 1) * (0.10 + depth * 0.05);
      a += (angle - a) * 0.05;
      cx += Math.cos(a) * step;
      cy += Math.sin(a) * step;
      traveled += step;
      pts.push([cx, cy]);
    }

    // 每级的宽度差要拉大，才有"树干→末梢"的层级
    segments.push({ pts, width, depth });

    if (depth <= 0) {
      tips.push([cx, cy]);
      return;
    }
    const forks = depth > 2 ? rng.int(2, 3) : 2;
    for (let i = 0; i < forks; i++) {
      const spread = rng.range(0.34, 0.82) * (rng.bool() ? 1 : -1);
      branch(
        cx, cy,
        a + spread,
        len * rng.range(0.52, 0.76),
        width * rng.range(0.44, 0.62),
        depth - 1,
      );
    }
  }

  // 三丛，分别落在不同深度——一层在前、两层在后，靠粗细与亮度分开
  const clumps = [
    { x: rng.range(0.18, 0.34), y: rng.range(0.20, 0.38), scale: 1.0, depth: 4, near: false },
    { x: rng.range(0.58, 0.82), y: rng.range(0.30, 0.52), scale: 0.78, depth: 3, near: false },
    { x: rng.range(0.34, 0.62), y: rng.range(0.60, 0.82), scale: 1.28, depth: 4, near: true },
  ];

  for (const c of clumps) {
    const forkCount = 2;
    for (let i = 0; i < forkCount; i++) {
      const a = rng.range(0, TAU);
      branch(
        c.x * w,
        c.y * h,
        a,
        (68 + rng.range(0, 46)) * c.scale,
        (4.2 + rng.range(0, 2.2)) * c.scale * (c.near ? 1.35 : 1),
        c.depth,
      );
    }
  }

  // 由粗到细画：亮芯必须压在最上面
  segments.sort((a, b) => b.width - a.width);
  const core = mix(palette.glow, [255, 255, 255], 0.72);

  for (const s of segments) {
    const sm = smoothPath(s.pts, 5, 0.45);
    const dim = s.depth <= 1 ? 0.72 : 1; // 末梢不必过亮，光点才是主角
    litStroke(ctx, sm, s.width, palette.accent, 0.5 * dim, 4);
    litStroke(ctx, sm, s.width * 0.5, mix(palette.accent, palette.glow, 0.6), 0.8 * dim, 2);
    if (s.width > 1.2) {
      litStroke(ctx, sm, Math.max(0.6, s.width * 0.18), core, 0.9, 1);
    }
  }

  // ── 突触：光只发生在末梢 ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [tx, ty] of tips) {
    const power = rng.range(0.35, 1);
    // 先照亮周围——没有这一层，"放电"看起来是贴上去的白点
    glow(ctx, tx, ty, 26 + 44 * power, core, 0.20 * power);
    glow(ctx, tx, ty, 5 + 7 * power, core, 0.62 * power);
    ctx.fillStyle = rgb(core, 0.85);
    ctx.beginPath();
    ctx.arc(tx, ty, 1.1 + power * 1.5, 0, TAU);
    ctx.fill();

    // 一部分末梢向外溅出粒子：这是"正在放电"而非"已经亮着"的证据
    if (rng.bool(0.42)) {
      const n = rng.int(3, 7);
      for (let k = 0; k < n; k++) {
        const a = rng.range(0, TAU);
        const dist = rng.range(7, 46) * power;
        const px = tx + Math.cos(a) * dist;
        const py = ty + Math.sin(a) * dist;
        ctx.fillStyle = rgb(core, rng.range(0.1, 0.45));
        ctx.beginPath();
        ctx.arc(px, py, rng.range(0.5, 1.7), 0, TAU);
        ctx.fill();
      }
    }

    // 同一簇里的两个末梢之间偶尔发生一次"跨接"——这才是突触的意思
    if (rng.bool(0.14)) {
      const other = tips[rng.int(0, tips.length - 1)];
      const dist = Math.hypot(other[0] - tx, other[1] - ty);
      if (dist > 30 && dist < 190) {
        const mid = [(tx + other[0]) / 2 + rng.gauss() * 14, (ty + other[1]) / 2 + rng.gauss() * 14];
        const arc = smoothPath([[tx, ty], mid, [other[0], other[1]]], 6, 0.5);
        litStroke(ctx, arc, 0.9, core, 0.42, 2);
      }
    }
  }
  ctx.restore();

  vignette(ctx, w, h, 0.55, 1.24);
  grain(ctx, w, h, rng, 0.05, 2);
}
