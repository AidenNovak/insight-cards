export const meta = {
  id: "discharge",
  zh: "放电",
  en: "Discharge",
  connects: "击穿",
  mood: "积累到某一点之后的突然贯通",
  note: "连接来自击穿：空气一直不导电，直到某一个瞬间整条通道同时形成。",
};

/**
 * 放电。
 *
 * 分叉的算法只有一条规则：**每一步都稍微偏一点，偶尔分一次岔。**
 * 让分支好看的是参数，不是复杂度：
 *   - 偏转角要小（±0.28 弧度）。大了会变成一条扭来扭去的虫。
 *   - 每一步都要往主方向拉回（`a += (angle - a) * 0.08`）。
 *     少了这个回拉，轨迹会随机游走出画面。
 *   - 分支的长度与宽度同步衰减。宽度不衰减，画面会被小分支填满。
 *
 * 发光则靠 litStroke 的多层叠加：**先画粗而暗的，再画细而亮的**。
 * 反过来画，亮芯会被外层的柔光洗掉。
 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  // ── 背景云层 ──
  // 放电必须有东西可被打亮。没有云，闪电就悬在真空里。
  const nw = Math.round(w / 3);
  const nh = Math.round(h / 3);
  const sky = offscreen(nw, nh);
  const img = sky.ctx.createImageData(nw, nh);
  const d = img.data;
  const cyBase = rng.range(0.28, 0.44);

  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const u = x / nw;
      const v = y / nh;
      const n = rng.warp(u * 2.2, v * 2.6, 1.8, 4);
      const detail = rng.fbm(u * 6 + 5, v * 6 + 9, 4);
      let t = n * (0.5 + 0.5 * detail);
      // 云集中在画面的上半部与中部——闪电从那里打下来
      t *= smoothstep((cyBase + 0.34 - v) / 0.5) * 0.9 + 0.12;
      t = Math.pow(clamp(t), 1.7) * 0.55;

      const c = ramp(palette.stops, t);
      const i = (y * nw + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = Math.round(clamp(t) * 255);
    }
  }
  sky.ctx.putImageData(img, 0, 0);
  blit(ctx, sky.canvas, w, h, 0.55, "lighter");

  // ── 生成分叉 ──
  const branches = [];

  function bolt(x, y, angle, len, width, depth) {
    const pts = [[x, y]];
    let cx = x;
    let cy = y;
    let a = angle;
    let traveled = 0;
    while (traveled < len) {
      const step = rng.range(16, 34);
      a += rng.range(-0.28, 0.28);
      a += (angle - a) * 0.08; // 回拉，防止随机游走
      cx += Math.cos(a) * step;
      cy += Math.sin(a) * step;
      traveled += step;
      pts.push([cx, cy]);

      if (depth > 0 && rng.next() < 0.17) {
        const offset = rng.range(0.45, 1.25) * (rng.bool() ? 1 : -1);
        bolt(
          cx, cy,
          a + offset,
          len * rng.range(0.28, 0.58),
          width * 0.55,
          depth - 1,
        );
      }
    }
    branches.push({ pts, width });
    return pts;
  }

  // 主干：从画面上方打下来，整体略斜
  const rootAngle = Math.PI / 2 + rng.range(-0.34, 0.34);
  const rootX = rng.range(w * 0.30, w * 0.62);
  const rootY = -h * 0.06;
  const main = bolt(rootX, rootY, rootAngle, h * rng.range(0.86, 1.02), rng.range(7, 10), 4);

  // 主干之外再补 1–2 条独立的小分支，避免"只有一棵树"
  const extras = rng.int(1, 2);
  for (let i = 0; i < extras; i++) {
    const ex = rng.range(w * 0.08, w * 0.92);
    bolt(ex, -h * 0.04, Math.PI / 2 + rng.range(-0.5, 0.5), h * rng.range(0.35, 0.6), rng.range(3, 5), 3);
  }

  // 宽的先画、细的后画：亮芯压在柔光上面
  branches.sort((a, b) => b.width - a.width);

  // 整条通道的总体光晕（只给主干，用它的中点）
  const mid = main[Math.floor(main.length * 0.45)];
  const core = mix(palette.glow, [255, 255, 255], 0.7);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, rootX, rootY + h * 0.28, w * 0.62, palette.accent, 0.10);
  glow(ctx, mid[0], mid[1], w * 0.34, palette.accent, 0.09);
  ctx.restore();

  for (const b of branches) {
    const smooth = smoothPath(b.pts, 6, 0.4);
    // 外层：带色的辉光
    litStroke(ctx, smooth, b.width, palette.accent, 0.62, 5);
    // 中层：更亮的主色
    litStroke(ctx, smooth, b.width * 0.55, mix(palette.accent, palette.glow, 0.7), 0.9, 3);
    // 芯：接近白
    litStroke(ctx, smooth, Math.max(0.9, b.width * 0.20), core, 1, 1);
  }

  // 分叉点的等离子光团
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of branches) {
    if (b.width < 3.4) continue;
    for (let i = 3; i < b.pts.length - 3; i += 5) {
      const [x, y] = b.pts[i];
      glow(ctx, x, y, b.width * 5.5, core, 0.11);
    }
  }
  ctx.restore();

  // ── 雨 ──
  // 极淡的竖条：告诉观众空气是湿的、正在被击穿
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 220; i++) {
    const x = rng.next() * w;
    const y = rng.next() * h;
    const len = rng.range(30, 120);
    const a = rng.range(0.02, 0.075);
    ctx.strokeStyle = rgb(palette.accent, a);
    ctx.lineWidth = rng.range(0.6, 1.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.12, y + len);
    ctx.stroke();
  }
  ctx.restore();

  // 击穿瞬间把云从内部照亮
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, rootX, rootY + h * 0.16, w * 0.9, palette.accent, 0.07);
  ctx.restore();

  vignette(ctx, w, h, 0.55, 1.22);
  grain(ctx, w, h, rng, 0.05, 2);
}
