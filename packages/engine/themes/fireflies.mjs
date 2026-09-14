export const meta = {
  id: "fireflies", zh: "萤火", en: "Fireflies", connects: "同步",
  mood: "雾中的光点，在彼此的节拍里忽明忽暗",
  note: "连接来自同步：个体看见邻近的闪光，微调自己的节拍，最后整片夜色开始呼吸。",
};

export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);
  const unit = w / 1080;
  const swarms = [[0.32, 0.39], [0.68, 0.47], [0.52, 0.23]];
  const flies = [];
  for (let i = 0; i < 115; i++) {
    const swarm = rng.pick(swarms);
    const depth = rng.power(2.3);
    flies.push({ x: clamp(swarm[0] + rng.gauss() * 0.29, 0.075, 0.925) * w,
      y: clamp(swarm[1] + rng.gauss() * 0.24, 0.09, 0.76) * h,
      depth, mag: rng.power(3.0, 0.12, 1), phase: rng.range(0, TAU), trail: rng.range(8, 45) * unit,
      // 同步相位：同一小片区域的光点共享一个相位（一起亮），
      // 相邻区域依次延后 —— 这就是"同步"在画面里的形态。
      // 簇内留 ±0.35 的抖动，免得到齐得像电子屏。
      sync: (swarm[0] * 3.1 + swarm[1] * 2.3) + rng.range(-0.35, 0.35) });
  }
  // 少数失焦前景光斑，不让所有光点都长得一样。
  for (const [x, y, r] of [[0.16, 0.52, 17], [0.82, 0.29, 23], [0.70, 0.67, 13], [0.32, 0.16, 10]]) {
    flies.push({ x: x * w, y: y * h, depth: 1, mag: 0.65, phase: rng.range(0, TAU), trail: r * unit, blur: r * unit });
  }

  // 每个小群落照亮附近雾滴。独立的竖向遮挡给出林间深度。
  const mist = offscreen(w / 3, h / 3);
  const img = mist.ctx.createImageData(mist.canvas.width, mist.canvas.height);
  for (let y = 0; y < mist.canvas.height; y++) for (let x = 0; x < mist.canvas.width; x++) {
    const u = x / mist.canvas.width, v = y / mist.canvas.height;
    let light = 0;
    for (const [sx, sy] of swarms) light += Math.exp(-1 * ((u - sx) / 0.19) ** 2 - ((v - sy) / 0.16) ** 2);
    const n = rng.warp(u * 5, v * 6, 2.2, 4);
    const obstruction = smoothstep((rng.fbm(u * 14 + 5, v * 0.8, 3) - 0.36) / 0.28);
    // 雾层亮度。原值 (0.09 + n*0.25) 在全尺寸下够用，但缩到 200px 后
    // 光点之间没有共同的介质把它们连起来，一堆孤立亮点降采样后就读成噪点。
    // 提亮一档让"萤火同处一片夜雾"这件事在小尺寸下也成立。
    const t = clamp(light * (0.15 + n * 0.42) * obstruction);
    const c = ramp(palette.stops, t * 0.95);
    img.data.set([...c, Math.round(t * 160)], (y * mist.canvas.width + x) * 4);
  }
  mist.ctx.putImageData(img, 0, 0);
  blit(ctx, mist.canvas, w, h, 0.85, "lighter");

  // 后方的草茎有一点被照到的侧缘，前方的叶子真正挡光。
  for (let i = 0; i < 42; i++) {
    const x = rng.range(0.04, 0.96) * w, y = rng.range(0.51, 0.83) * h;
    const len = rng.range(40, 185) * unit, lean = rng.range(-0.35, 0.35) * len;
    ctx.strokeStyle = rgb(ramp(palette.stops, 0.17), rng.range(0.13, 0.35));
    ctx.lineWidth = rng.range(0.7, 2.4) * unit;
    ctx.beginPath(); ctx.moveTo(x, y + len * 0.35);
    ctx.quadraticCurveTo(x + lean * 0.2, y - len * 0.3, x + lean, y - len); ctx.stroke();
  }

  flies.sort((a, b) => a.depth - b.depth);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const f of flies) {
    const focus = Math.exp(-1 * ((f.depth - 0.38) / 0.30) ** 2);
    const r = f.blur || (0.50 + f.depth * 2.4) * unit;
    const brightness = 0.22 + f.mag * 0.78;
    const col = ramp(palette.stops, 0.53 + f.mag * 0.34);
    glow(ctx, f.x, f.y, (22 + f.mag * 48) * unit + r, palette.accent, brightness * 0.10);
    if (f.blur) {
      // 透镜散焦的有限圆盘 + 外缘散射，不用阴影模糊。
      glow(ctx, f.x, f.y, r * 1.6, col, 0.19);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, rgb(col, 0.13)); g.addColorStop(0.70, rgb(col, 0.15));
      g.addColorStop(0.88, rgb(col, 0.12)); g.addColorStop(1, rgb(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();
      continue;
    }
    // 长曝光中亮度有共同脉冲，飞行方向却各自不同。
    const angle = -0.9 + Math.sin(f.phase) * 0.8;
    const length = f.trail * (0.3 + focus * 0.9);
    const pts = [];
    for (let k = 0; k <= 18; k++) {
      const t = k / 18, bend = Math.sin(t * Math.PI) * length * 0.17;
      pts.push([f.x - Math.cos(angle) * length * (1 - t) + bend * Math.sin(angle),
        f.y - Math.sin(angle) * length * (1 - t) - bend * Math.cos(angle)]);
    }
    for (let k = 0; k < pts.length - 1; k++) {
      const t = k / (pts.length - 1);
      // 相位里带上 f.sync：同一片的光点几乎同时亮，别处的依次跟上。
      // 1.4 是"拖尾上闪几次"，1.9 是"整片雾里波传得多快"。
      // 原版这三个光点各闪各的，meta 说的"同步"在画面里其实不存在。
      const pulse = 0.62 + 0.38 * Math.cos(t * TAU * 1.4 + f.sync * 1.9);
      litStroke(ctx, [pts[k], pts[k + 1]], (0.5 + focus * 0.65) * unit,
        col, t * brightness * focus * pulse * 0.58, 3);
    }
    // **核心的加色能量要压住，否则会过曝成中性白。**
    // 实测：三层 `lighter` 叠加（accent 大晕 + glow 小晕 + 实心点）在萤火最亮处
    // 三个通道同时顶到 255，于是深空配色与余烬配色渲染出的最亮像素几乎一样
    // （都是 ~[228,230,231]）——配色在最亮的地方失效了。
    // 真实的萤火照片里最亮点确实会溢出，但**溢出区应当仍带着色温**。
    // 做法：降低外层 alpha，并把实心点从"纯 glow 色"改为"glow 色略偏向白"，
    // 让它在叠加上限之下就已经够亮，而不是靠顶到 255 才够亮。
    glow(ctx, f.x, f.y, r * (3.5 + (1 - focus) * 3), palette.accent, brightness * 0.20);
    glow(ctx, f.x, f.y, r * 1.5, col, brightness * 0.34);
    if (focus > 0.38) {
      const core = mix(col, [255, 255, 255], 0.34);
      /**
       * 核心半径要有一个**屏上最小尺寸**，不能只按画布比例走。
       *
       * 踩过的坑：`r` 是 `(0.50 + depth*2.4) * unit`（unit = w/1080），
       * 核心取 `r * 0.64` —— 在 1080px 上是 0.3–1.9 像素，
       * 缩到 200px（信息流尺寸）后只剩 **0.09–0.54 像素**，降采样直接抹掉，
       * 整张图只剩那层糊开的辉光，数不出"一只只虫"。
       * 这和 orbit 的轨道线是同一类错误：**按画布比例缩放的尺寸会在小尺寸下归零。**
       *
       * `3.4 * unit` 是下限。做了四档对照（原值 / 只加下限 / 加下限+提不透明 /
       * 再加一个极小锐点）在 200px 与原尺寸下比对：加下限+适度提不透明度
       * 是唯一"缩略图里数得清、原尺寸下仍像发光的虫"的一档
       * （再加锐点会让光点变硬，像 pin 点或噪点，反而失去萤火的柔）。
       */
      const cr = Math.max(r * 0.64, 3.4 * unit);
      ctx.fillStyle = rgb(core, Math.min(0.95, brightness * focus * 0.72 + 0.16));
      ctx.beginPath(); ctx.ellipse(f.x, f.y, cr, cr * 0.68, angle, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  // 两侧的近景草叶打断雾层，不截断主光点。
  ctx.fillStyle = rgb(palette.base, 0.88);
  for (const [x, sign] of [[0.065, 1], [0.93, -1], [0.10, 1]]) {
    ctx.beginPath(); ctx.moveTo(x * w, h * 0.92);
    ctx.quadraticCurveTo((x + sign * 0.065) * w, h * 0.63, (x + sign * 0.015) * w, h * 0.40);
    ctx.quadraticCurveTo((x + sign * 0.04) * w, h * 0.66, (x + sign * 0.025) * w, h * 0.92);
    ctx.closePath(); ctx.fill();
  }
  vignette(ctx, w, h, 0.50, 1.25);
  grain(ctx, w, h, rng, 0.040, 2);
}
