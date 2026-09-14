export const meta = {
  id: "ink",
  zh: "水中墨",
  en: "Ink in Water",
  connects: "扩散",
  mood: "一滴密实的墨，在逆光里散成无数细丝",
  note: "连接来自扩散：浓度推动物质穿过边界，原本独立的一滴逐渐进入整片水。",
};

/**
 * 水中墨。
 *
 * **这一版是重写的，前一版失败了，原因值得记下来。**
 *
 * 前版把染料铺成左右对称的几个瓣（`lobes` 的 x 偏移是 ±0.065 / ±0.15），
 * 逆光渲染出来是**一道八字胡**——因为对称的横向瓣状分布，人的眼睛会立刻
 * 读成一张脸的下半部，而不是一滴墨。
 *
 * 真实的一滴墨在逆光里是这样的：
 *   - **竖向**。它落下、被水阻住、然后向下抽出细丝。整体是柱状的，不是横的。
 *   - **单一起点**。有一个密实的、几乎不透光的核，位置明确。
 *   - **越往下越细、越淡、越分叉**。浓度梯度决定它在哪里消失。
 *   - **丝的走向是"被水流拉出来的"**，所以它们长、弯、偶尔打卷，但不闭合。
 *
 * 所以这一版把场改成：**一个源点 + 向下的速度场 + 让它打卷的旋涡**，
 * 而不是几个对称的浓度瓣。丝的走向由速度场的流线决定，不由手摆的坐标决定。
 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  // ── 源点：墨滴落下的位置。**不在正中**，偏一点才有"正在下落"的动势 ──
  const sx = rng.range(0.40, 0.58);
  const sy = rng.range(0.16, 0.24);

  // 两三个缓慢旋转的涡，把丝卷起来。位置随机，避免左右对称。
  const swirls = Array.from({ length: rng.int(3, 5) }, () => ({
    x: sx + rng.range(-0.22, 0.22),
    y: sy + rng.range(0.14, 0.46),
    r: rng.range(0.07, 0.17),
    spin: rng.range(0.5, 1.6) * (rng.bool() ? 1 : -1),
  }));

  /**
   * 流场：一个向下的主速度 + 水平方向的扩散 + 涡的旋转。
   * 返回一个点在该位置被推往的方向。
   */
  function flow(u, v) {
    // 主方向向下，并且越往下横向扩散越宽（墨在水里是张开的）
    const spread = 0.055 + Math.pow(clamp((v - sy) / 0.6), 0.8) * 0.30;
    let du = (u - sx) * 0.16 + (rng.fbm(u * 4 + 3, v * 4, 3) - 0.5) * 0.22;
    let dv = 1;

    for (const s of swirls) {
      const dx = u - s.x;
      const dy = v - s.y;
      const d2 = (dx * dx + dy * dy) / (s.r * s.r);
      const strength = Math.exp(-d2 * 1.2) * s.spin;
      // 切向速度：绕涡心旋转
      du += -dy * strength * 0.9 + dx * 0.02;
      dv += dx * strength * 0.9 * 0.55;
    }

    // 归一化方向（步长由调用方决定）
    const len = Math.hypot(du, dv) || 1;
    return { dx: du / len, dy: dv / len, spread };
  }

  /**
   * 浓度场：从源点出发的高斯核，向下衰减，被涡横向拉开。
   * 这是决定"哪里还有墨"的唯一依据。
   */
  function density(u, v) {
    if (v < sy - 0.05) return 0;
    const fall = Math.exp(-(v - sy) * 3.4);
    const spread = 0.030 + Math.pow(clamp((v - sy) / 0.65), 0.75) * 0.36;
    // 用噪声把"距离"扭一下，浓度边界才不是规整的锥
    const wobble = (rng.warp(u * 6 + 11, v * 6 + 5, 2.0, 4) - 0.5) * 0.10;
    const dx = (u - sx + wobble) / spread;
    const core = Math.exp(-dx * dx * 1.25);
    // 细丝的纹理：沿流向拉长的条纹，密度在条纹之间掉下去
    const streaks = rng.fbm(u * 46 + 7, v * 13, 4);
    const thread = smoothstep((streaks - 0.36) / 0.30) * 0.72 + 0.28;
    return clamp(fall * core * thread * 1.5);
  }

  // ── 密度场：算在 1/1.5 分辨率上 ──
  const dye = offscreen(w / 1.5, h / 1.5);
  const dw = dye.canvas.width;
  const dh = dye.canvas.height;
  const img = dye.ctx.createImageData(dw, dh);

  for (let py = 0; py < dh; py++) {
    for (let px = 0; px < dw; px++) {
      const u = px / dw;
      const v = py / dh;
      const d = density(u, v);

      // 逆光：薄的地方发亮（银白），厚的地方几乎全黑（吸收）。
      // 这个"反相关"是水中墨最重要的特征——不是越厚越亮。
      const thin = smoothstep((d - 0.06) / 0.34) * (1 - smoothstep((d - 0.42) / 0.44));
      const dense = smoothstep((d - 0.55) / 0.40);

      // 透亮的部分是薄层与折边，这是视觉上的"丝"
      let lit = thin * 0.85 + d * 0.18;
      lit *= 1 - dense * 0.94;

      const c = ramp(palette.stops, clamp(0.28 + lit * 0.85));

      // 整片水有一层极淡的散射，给暗部一点底
      const wash = Math.exp(-((u - sx) ** 2 + (v - sy) ** 2) * 2.2) * 0.028;

      const i = (py * dw + px) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = Math.round(clamp(lit * 0.92 + wash) * 255);
    }
  }
  dye.ctx.putImageData(img, 0, 0);
  blit(ctx, dye.canvas, w, h, 0.96, "lighter");

  // ── 流线：把速度场走出来，得到真正的"被水拉出的丝" ──
  // 浓度场给的是体，流线给的是结构。两者叠加才有"墨在水里"的样子。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const STRANDS = rng.int(90, 140);
  for (let s = 0; s < STRANDS; s++) {
    // 起点集中在源点附近，但要有横向散布
    let u = sx + rng.gauss() * 0.030;
    let v = sy + rng.gauss() * 0.022;
    const step = 0.0055;
    const pts = [];
    const maxSteps = rng.int(90, 200);
    const mag = rng.power(2.6, 0, 1);

    for (let k = 0; k < maxSteps; k++) {
      const { dx, dy } = flow(u, v);
      u += dx * step;
      v += dy * step;
      if (u < -0.05 || u > 1.05 || v > 1.02) break;

      const d = density(u, v);
      // 丝只在"有墨但不厚"的地方显影；进到密核里就被吞掉
      if (d < 0.045) continue;
      pts.push([u * w, v * h]);
    }

    if (pts.length < 6) continue;
    const smooth = smoothPath(pts, 3, 0.5);
    const bright = 0.10 + mag * 0.52;
    const col = ramp(palette.stops, 0.55 + mag * 0.42);
    // 细丝：先用接近底色的宽度打底，再压一条亮芯
    litStroke(ctx, smooth, 0.45 + mag * 0.9, col, bright * 0.5, 2);
    litStroke(ctx, smooth, 0.28 + mag * 0.45, mix(col, [255, 255, 255], 0.5), bright, 1);
  }
  ctx.restore();

  // ── 密核：源点处那一小团几乎不透光的墨 ──
  // 第一版画了一个硬边椭圆再加一圈闭合银边，结果整团看起来像**一只眼睛**。
  // 问题出在"硬边界 + 完整闭合的亮环"——那正是眼睛的图形特征。
  // 改法：核更小、边界更软、亮边只画半圈（闭合的环读成瞳孔，半圈读成被光擦到的边缘）。
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const coreR = rng.range(0.020, 0.031);
  const g = ctx.createRadialGradient(sx * w, sy * h, 0, sx * w, sy * h, coreR * w * 3.4);
  g.addColorStop(0, rgb(palette.base, 0.94));
  g.addColorStop(0.32, rgb(palette.base, 0.72));
  g.addColorStop(0.62, rgb(palette.base, 0.34));
  g.addColorStop(1, rgb(palette.base, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(sx * w, sy * h, coreR * w, coreR * w * 1.5, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // 核的下缘薄墨在光里发亮——只画下半圈，不闭合
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const edge = mix(palette.glow, [255, 255, 255], 0.5);
  const arcStart = rng.range(0.12, 0.4);
  ctx.strokeStyle = rgb(edge, 0.26);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(
    sx * w, sy * h,
    coreR * w * 1.22, coreR * w * 1.62, 0,
    Math.PI * (0.15 + arcStart), Math.PI * (0.85 + arcStart),
  );
  ctx.stroke();
  // 核的上方是墨滴刚穿过的痕迹，极淡
  glow(ctx, sx * w, sy * h - coreR * w * 0.7, coreR * w * 2.0, edge, 0.12);
  ctx.restore();

  vignette(ctx, w, h, 0.5, 1.28);
  grain(ctx, w, h, rng, 0.042, 2);
}
