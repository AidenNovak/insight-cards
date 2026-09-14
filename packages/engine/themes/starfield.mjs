export const meta = {
  id: "starfield",
  zh: "星野",
  en: "Starfield",
  connects: "注视",
  mood: "散落的恒星被想象连成一个形状",
  note: "连接来自注视：几百颗星本来毫无关系，是人反复看的那几颗把它们连成了形象。",
};

/** 银河的亮度来自星数；低频层只托住未分辨星光，不充当主体。 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  const nw = Math.round(w / 3), nh = Math.round(h / 3);
  const band = offscreen(nw, nh);
  const img = band.ctx.createImageData(nw, nh);
  const density = new Float32Array(nw * nh);
  const ang = rng.range(-0.62, -0.34);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const ox = rng.range(0.40, 0.52), oy = rng.range(0.40, 0.49);
  const width = rng.range(0.13, 0.17);

  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const u = x / (nw - 1), v = y / (nh - 1);
    const along = (u - ox) * ca + (v - oy) * sa;
    const cross = -(u - ox) * sa + (v - oy) * ca;
    const cloud = rng.warp(u * 5.2 + 3, v * 5.2, 1.7, 4);
    const fine = rng.fbm(u * 38 + 9, v * 38 + 7, 3);
    const bend = (rng.fbm(along * 4 + 19, 6, 4) - 0.5) * 0.24;
    const bulge = Math.exp(-Math.pow((along - 0.08) / 0.24, 2));
    const p = (cross - bend) / (width * (0.76 + bulge * 0.5));
    let mass = Math.exp(-p * p * 1.6) * (0.16 + Math.pow(cloud * 1.6, 2) * 0.8);
    mass *= 0.8 + bulge * 0.45;
    // 大裂谷带有破碎边沿；第二条支缝在亮侧分叉。
    const jagged = (rng.fbm(u * 21 + 3, v * 21, 3) - 0.5) * 0.065;
    const laneWidth = 0.008 + 0.045 * smoothstep((rng.fbm(along * 9 + 31, 8, 3) - 0.3) / 0.4);
    const lane = 1 - smoothstep((Math.abs(cross - bend + jagged) - laneWidth * 0.35) / (laneWidth * 0.8));
    const fork = (1 - smoothstep((Math.abs(cross - bend - 0.07 - along * 0.13 + jagged) - 0.005) / 0.017))
      * smoothstep((along + 0.25) / 0.25);
    const knots = smoothstep((rng.warp(u * 13 + 17, v * 13 + 4, 1.1, 3) - 0.51) / 0.18);
    mass *= (1 - lane * 0.96) * (1 - fork * 0.74) * (1 - knots * 0.68);
    mass = clamp(mass * (0.65 + fine * 0.7));
    density[y * nw + x] = mass;
    const c = ramp(palette.stops, 0.25 + mass * 0.54);
    const i = (y * nw + x) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2];
    img.data[i + 3] = Math.round(Math.pow(mass, 1.35) * 100);
  }
  band.ctx.putImageData(img, 0, 0);
  blit(ctx, band.canvas, w, h, 0.65, "lighter");

  // 同一遮光场同时截断底层与背景恒星，双线性采样避免低分辨率格子。
  function massAt(u, v) {
    const x = u * (nw - 1), y = v * (nh - 1);
    const ix = Math.floor(x), iy = Math.floor(y);
    const jx = Math.min(ix + 1, nw - 1), jy = Math.min(iy + 1, nh - 1);
    return lerp(lerp(density[iy * nw + ix], density[iy * nw + jx], x - ix),
      lerp(density[jy * nw + ix], density[jy * nw + jx], x - ix), y - iy);
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // 原生 CSS 分辨率的点扩散斑，不随低分辨率云层放大。
  const count = Math.round(w * h * 0.36);
  const starColors = [palette.glow, mix(palette.glow, palette.accent, 0.65),
    mix(palette.glow, [255, 255, 255], 0.55)];
  for (let i = 0; i < count; i++) {
    const u = rng.next(), v = rng.next();
    const mass = massAt(u, v);
    if (rng.next() > mass * 0.92 + 0.004) continue;
    const mag = rng.power(3.8);
    const r = 0.18 + mag * 0.73;
    // 密集区提升的是逐颗恒星的曝光，不再叠一层平滑雾白。
    ctx.fillStyle = rgb(rng.pick(starColors), 0.20 + mag * 0.64 + mass * 0.10);
    ctx.beginPath(); ctx.arc(u * w, v * h, r, 0, TAU); ctx.fill();
  }

  // 前景星在尘埃之前，允许跨过暗缝，但不能把缝填满。
  for (let i = 0; i < 480; i++) {
    const x = rng.next() * w, y = rng.next() * h;
    const mag = rng.power(4.4);
    const col = rng.pick(starColors);
    const r = 0.38 + mag * 1.75;
    if (mag > 0.55) glow(ctx, x, y, r * 8, col, 0.18);
    ctx.fillStyle = rgb(col, 0.24 + mag * 0.68);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  // 星芒保持局部，不用横贯画面的十字抢走银河。
  for (let i = 0; i < 4; i++) {
    const x = rng.range(0.12, 0.88) * w, y = rng.range(0.12, 0.65) * h;
    const power = rng.range(0.6, 1);
    const col = mix(palette.glow, [255, 255, 255], 0.8);
    glow(ctx, x, y, 65 * power, palette.accent, 0.12);
    glow(ctx, x, y, 16 * power, col, 0.5);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const len = 40 * power * (Math.abs(Math.sin(a)) > 0.5 ? 0.72 : 1);
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      const g = ctx.createLinearGradient(x, y, ex, ey);
      g.addColorStop(0, rgb(col, 0.62));
      g.addColorStop(0.22, rgb(col, 0.18));
      g.addColorStop(1, rgb(col, 0));
      ctx.strokeStyle = g; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.fillStyle = rgb(col);
    ctx.beginPath(); ctx.arc(x, y, 1.5 * power, 0, TAU); ctx.fill();
  }
  ctx.restore();

  vignette(ctx, w, h, 0.46, 1.3);
  grain(ctx, w, h, rng, 0.042, 2);
}
