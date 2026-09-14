export const meta = {
  id: "nebula",
  zh: "星云",
  en: "Nebula",
  connects: "引力",
  mood: "巨大的物质在缓慢塌缩成形",
  note: "连接来自引力：散开的物质不会自己成形，是彼此吸引才塌缩成了新的东西。",
};

/** 密度、遮光、曝光分开计算：紧凑热核到达白热，外围保留色相。 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  const nw = Math.round(w / 3), nh = Math.round(h / 3);
  const cloud = offscreen(nw, nh);
  const img = cloud.ctx.createImageData(nw, nh);
  const cx = rng.range(0.44, 0.57), cy = rng.range(0.32, 0.44);
  const scale = rng.range(3.4, 4.5);
  const coreWhite = mix(palette.glow, [255, 255, 255], 0.94);
  const cores = [
    [cx, cy, 0.036, 3.9],
    [cx - 0.15, cy + 0.12, 0.055, 0.95],
    [cx + 0.15, cy - 0.10, 0.035, 1.15],
  ];

  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const u = x / nw, v = y / nh;
    const base = rng.warp(u * scale, v * scale, 2.5, 5);
    const detail = rng.fbm(u * 21 + 9, v * 21 + 2, 4);
    const wx = (rng.fbm(u * 8 + 51, v * 8, 4) - 0.5) * 0.11;
    const wy = (rng.fbm(u * 8 + 13, v * 8 + 17, 4) - 0.5) * 0.11;
    const dx = (u + wx - cx) * 1.08, dy = (v + wy - cy) * 1.4;
    const envelope = Math.exp(-(dx * dx + dy * dy) * 13);
    const wisps = rng.fbm(u * 65 + 19, v * 65 + 8, 3);
    let emission = Math.pow(clamp((base - 0.28) * 2.6), 2.1) * envelope * (0.35 + detail) * 1.15;
    let heat = 0;
    for (const [hx, hy, hr, hp] of cores) {
      const hd = Math.hypot(u + wx * 0.45 - hx, (v + wy * 0.45 - hy) * 1.3);
      heat += Math.exp(-hd * hd / (hr * hr)) * hp * (0.48 + detail * 0.75 + wisps * 0.3);
      // 热源周围的物质先被照亮成饱和色，离开热源才渐隐。
      emission += Math.exp(-hd * hd / (hr * hr * 8)) * hp * 0.11 * (0.3 + base);
    }
    // 主裂缝与破碎尘云同样切过彩色晕，不能仅压暗背景。
    const laneY = cy + 0.055 + (u - cx) * 0.35 + (rng.fbm(u * 9 + 31, v * 3 + 13, 4) - 0.5) * 0.24;
    const ragged = (detail - 0.5) * 0.07 + (wisps - 0.5) * 0.014;
    const laneWidth = 0.006 + smoothstep((detail - 0.32) / 0.34) * 0.019;
    const lane = 1 - smoothstep((Math.abs(v - laneY + ragged) - laneWidth * 0.35) / laneWidth);
    const patches = smoothstep((rng.warp(u * 12 + 71, v * 12 + 23, 1.3, 3) - 0.48) / 0.18);
    const transmission = (1 - 0.92 * lane) * (1 - 0.8 * patches);
    emission = (emission + heat) * transmission;

    // 保留 >1 的辐射量，再映射到色阶与白热，不能提前 clamp 热核。
    const t = 1 - Math.exp(-emission * 1.7);
    // 渐近白热而非硬截顶：核心内部仍能留下极浅的密度起伏。
    const white = 1 - Math.exp(-Math.max(0, emission - 1.05) * 1.5);
    const c = mix(ramp(palette.stops, t * 0.92), coreWhite, white);
    const i = (y * nw + x) * 4;
    // 为 lighter 的底色贡献留余量，防止整颗核三个通道同时饱和。
    img.data[i] = Math.max(0, c[0] - palette.base[0] * white);
    img.data[i + 1] = Math.max(0, c[1] - palette.base[1] * white);
    img.data[i + 2] = Math.max(0, c[2] - palette.base[2] * white);
    img.data[i + 3] = Math.round(clamp(emission * 1.35) * 255);
  }
  cloud.ctx.putImageData(img, 0, 0);
  blit(ctx, cloud.canvas, w, h, 1, "lighter");

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // 新生星与热源共址，微小白点不替代真正有面积的白热云核。
  for (const [hx, hy, hr, hp] of cores) {
    const x = hx * w, y = hy * h;
    glow(ctx, x, y, hr * w * 1.5, palette.accent, 0.06);
    glow(ctx, x, y, 9 + hp * 2, coreWhite, 0.4);
    ctx.fillStyle = rgb(coreWhite, 0.9);
    ctx.beginPath(); ctx.arc(x, y, 0.8 + hp * 0.25, 0, TAU); ctx.fill();
  }
  for (let i = 0; i < 380; i++) {
    const x = rng.next() * w, y = rng.next() * h;
    const mag = rng.power(4.2);
    const col = mix(palette.glow, [255, 255, 255], 0.5);
    if (mag > 0.75) glow(ctx, x, y, 10, palette.accent, 0.12);
    ctx.fillStyle = rgb(col, 0.14 + mag * 0.65);
    ctx.beginPath(); ctx.arc(x, y, 0.3 + mag * 1.2, 0, TAU); ctx.fill();
  }
  ctx.restore();

  vignette(ctx, w, h, 0.5, 1.28);
  grain(ctx, w, h, rng, 0.045, 2);
}
