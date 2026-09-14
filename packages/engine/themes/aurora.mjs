export const meta = {
  id: "aurora", zh: "极光", en: "Aurora", connects: "磁场",
  mood: "看不见的场，把光折成有远近的帘幕",
  note: "连接来自磁场：粒子沿场线抵达大气，能量才显出共同的形状。",
};

export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);
  const unit = w / 1080;
  const phase = rng.range(-0.24, 0.24);

  // 一条在三维中来回折叠的下缘。x 非单调，背面会被前面的折面遮住。
  function hem(s, rear = false) {
    const a = s * TAU * 1.8 + phase + 0.36 * Math.sin(s * 7.3);
    const z = Math.sin(a);
    return {
      x: (0.10 + 0.79 * s + (0.065 + 0.027 * s) * Math.sin(a + 0.55)) * w,
      y: (0.44 + (0.082 + s * 0.045) * z + 0.045 * s + 0.012 * Math.sin(s * 19) + (rear ? -0.125 : 0)) * h,
      z,
      length: (0.24 + 0.075 * (z + 1) + 0.045 * rng.fbm(s * 9, 3)) * h,
    };
  }

  // 极淡的被照亮的大气，和帘幕同源，不用满幅雾洗亮黑夜。
  const air = offscreen(w / 3, h / 3);
  const img = air.ctx.createImageData(air.canvas.width, air.canvas.height);
  const anchors = Array.from({ length: 42 }, (_, i) => hem(i / 41));
  for (let y = 0; y < air.canvas.height; y++) {
    for (let x = 0; x < air.canvas.width; x++) {
      const u = x / air.canvas.width, v = y / air.canvas.height;
      let light = 0;
      for (const p of anchors) {
        light = Math.max(light, Math.exp(-1 * ((u - p.x / w) / 0.11) ** 2 - ((v - p.y / h + 0.04) / 0.10) ** 2));
      }
      const n = rng.warp(u * 4, v * 5, 1.8, 3);
      const t = light * (0.12 + n * 0.22);
      const c = ramp(palette.stops, t * 0.75);
      const k = (y * air.canvas.width + x) * 4;
      img.data.set([...c, Math.round(t * 150)], k);
    }
  }
  air.ctx.putImageData(img, 0, 0);
  blit(ctx, air.canvas, w, h, 0.65, "lighter");

  function curtain(rear) {
    const rays = [];
    const count = rear ? 640 : 1550;
    for (let i = 0; i < count; i++) {
      const s = i / (count - 1);
      const p = hem(s, rear);
      rays.push({ ...p, s, jitter: rng.range(0.72, 1.08), fine: rng.power(3.1), width: rng.range(0.48, 1.3) * unit });
    }
    rays.sort((a, b) => a.z - b.z);
    for (const p of rays) {
      const edge = smoothstep(p.s / 0.075) * smoothstep((1 - p.s) / 0.10);
      const fold = 0.28 + 0.72 * smoothstep((p.z + 0.75) / 1.7);
      const stripe = 0.16 + 0.55 * p.fine + 0.23 * rng.ridge(p.s * 125, 2, 3);
      const alpha = edge * fold * stripe * (rear ? 0.18 : 0.62);
      const len = p.length * p.jitter * (rear ? 0.66 : 1);
      const topX = p.x + (p.x / w - 0.48) * w * 0.055;
      const g = ctx.createLinearGradient(topX, p.y - len, p.x, p.y + h * 0.008);
      g.addColorStop(0, rgb(ramp(palette.stops, 0.74), 0));
      g.addColorStop(0.28, rgb(ramp(palette.stops, 0.74), alpha * 0.06));
      g.addColorStop(0.60, rgb(ramp(palette.stops, 0.51), alpha * 0.30));
      g.addColorStop(0.91, rgb(ramp(palette.stops, 0.65), alpha * 0.85));
      g.addColorStop(0.976, rgb(palette.glow, alpha));
      g.addColorStop(1, rgb(palette.accent, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = p.width;
      ctx.beginPath();
      ctx.moveTo(topX, p.y - len);
      ctx.quadraticCurveTo(p.x - w * 0.009, p.y - len * 0.40, p.x, p.y + h * 0.008);
      ctx.stroke();
      if (!rear && p.fine > 0.77) {
        glow(ctx, p.x, p.y - h * 0.012, 14 * unit, palette.accent, alpha * 0.07);
      }
    }
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  curtain(true);
  curtain(false);

  // 稀少的小星只负责给天空尺度，不与帘幕争夺主角。
  for (let i = 0; i < 150; i++) {
    const x = rng.range(0.04, 0.96) * w, y = rng.range(0.035, 0.66) * h;
    const r = (0.32 + rng.power(4) * 1.0) * unit;
    glow(ctx, x, y, r * 4, palette.glow, 0.07);
    ctx.fillStyle = rgb(palette.glow, rng.range(0.10, 0.34));
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // 远山挡住低处的散射光，地平线不做一条硬直线。
  ctx.fillStyle = rgb(palette.base);
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let i = 0; i <= 100; i++) {
    const s = i / 100;
    ctx.lineTo(s * w, h * (0.72 + 0.055 * rng.fbm(s * 7, 9, 4) + 0.035 * Math.sin(s * 11)));
  }
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  vignette(ctx, w, h, 0.48, 1.3);
  grain(ctx, w, h, rng, 0.039, 2);
}
