export const meta = {
  id: "fiber", zh: "光纤", en: "Fiber", connects: "约束",
  mood: "光被束成弧线，只在自由的末端显露",
  note: "连接来自约束：光在纤维内部反复反射，沿共同的束口出发，在不同的末端抵达。",
};

export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);
  const unit = w / 1080;
  const root = { x: 0.41 * w, y: 0.80 * h };
  const fibers = [];
  function bezier(a, b, c, d, t) {
    const s = 1 - t;
    return [s ** 3 * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t ** 3 * d[0],
      s ** 3 * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t ** 3 * d[1]];
  }
  // 所有丝穿过同一束口；控制点控制弹性弯曲，绝不向路径添加随机折角。
  for (let i = 0; i < 240; i++) {
    const fan = rng.range(-1, 1), depth = rng.next();
    const spread = Math.abs(fan);
    const end = [(0.48 + fan * 0.35 + rng.gauss() * 0.035) * w,
      (0.17 + spread ** 1.4 * 0.29 + rng.gauss() * 0.057) * h];
    const start = [root.x + rng.gauss() * w * 0.012, root.y + rng.gauss() * h * 0.022];
    const b = [root.x + (0.085 + fan * 0.025) * w, h * (0.55 + depth * 0.035)];
    const c = [end[0] - fan * w * 0.13, end[1] - h * (0.12 - depth * 0.04)];
    const pts = Array.from({ length: 81 }, (_, k) => bezier(start, b, c, end, k / 80));
    fibers.push({ pts, end, depth, mag: rng.power(3.6), width: rng.range(0.32, 0.88) * unit });
  }
  fibers.sort((a, b) => a.depth - b.depth);
  ctx.save(); ctx.globalCompositeOperation = "lighter";

  // 只有纤维束附近有微弱散射。其余空间保留原底色，不添加全幅雾。
  glow(ctx, root.x + w * 0.045, h * 0.57, w * 0.16, palette.accent, 0.035);
  for (const f of fibers) {
    const brightness = 0.09 + f.depth * 0.16 + f.mag * 0.16;
    const color = ramp(palette.stops, 0.28 + f.depth * 0.30);
    // 按弧长分段泄漏一点光，束口与下端渐隐，不会被画布硬切。
    for (let k = 0; k < 80; k += 8) {
      const t = (k + 4) / 80;
      const leak = smoothstep(t / 0.24) * (0.45 + 0.55 * Math.sin(t * Math.PI));
      litStroke(ctx, f.pts.slice(k, k + 9), f.width, color, brightness * leak, 2);
    }
  }
  // 光端打亮邻近的透明丝，短距离的散射不把暗处泛灰。
  for (const f of fibers) {
    const [x, y] = f.end;
    const focus = smoothstep((f.depth - 0.18) / 0.65);
    const r = (0.6 + f.mag * 2.0) * unit;
    const col = ramp(palette.stops, 0.62 + f.mag * 0.32);
    glow(ctx, x, y, (8 + f.mag * 28) * unit, palette.accent, 0.09 + f.mag * 0.11);
    glow(ctx, x, y, r * (3.5 + (1 - focus) * 3), col, 0.19 + f.mag * 0.28);
    if (focus > 0.18) {
      ctx.fillStyle = rgb(palette.glow, 0.4 + focus * 0.5);
      ctx.beginPath(); ctx.arc(x, y, r * (0.6 + focus * 0.3), 0, TAU); ctx.fill();
    }
    if (f.mag > 0.80 && focus > 0.50) {
      for (const angle of [0, Math.PI / 2]) {
        const len = (8 + f.mag * 9) * unit;
        const dx = Math.cos(angle) * len, dy = Math.sin(angle) * len;
        const g = ctx.createLinearGradient(x - dx, y - dy, x + dx, y + dy);
        g.addColorStop(0, rgb(palette.glow, 0));
        g.addColorStop(0.5, rgb(palette.glow, 0.58));
        g.addColorStop(1, rgb(palette.glow, 0));
        ctx.strokeStyle = g; ctx.lineWidth = 0.65 * unit;
        ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
      }
    }
  }
  ctx.restore();
  vignette(ctx, w, h, 0.46, 1.3);
  grain(ctx, w, h, rng, 0.031, 2);
}
