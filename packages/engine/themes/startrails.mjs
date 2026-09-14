export const meta = {
  id: "startrails",
  zh: "星轨",
  en: "Star Trails",
  connects: "轴心",
  mood: "动了很多，但一直绕着同一个点",
  note: "连接来自轴心：所有的移动看起来各不相同，拉到足够长的时间里，都绕着同一个中心。",
};

/**
 * 星轨。
 *
 * 这个主题只有一个数学问题：**同心弧**。做错一步就会变成靶心或螺旋。
 *
 * 三个要点：
 *   1. **极心必须在画面里，但要偏心。** 这里改过一次：第一版学真实照片把极心放到画布外，
 *      理由是"极心在正中就成了靶盘"。那是把两个问题混成了一个 ——
 *      像靶盘的原因是**等长同心圆**，不是极心可见。而卡片讲的是
 *      「所有的轨迹都绕着同一个中心」，把极心推出画面，等于把这句话的主语删了。
 *      正确做法：极心留在画面内，放到**上三分之一、且明显偏左或偏右**，
 *      再靠弧长随机 + 半径幂律让它不像靶盘。
 *   2. **弧长要随机**。所有星画同样的角度范围会得到整齐的环；
 *      每颗星只走自己的一段弧（真实原因是有的星亮、曝光到一半才显影）。
 *   3. **半径要往小半径压**。真实长曝光图的标志是极心附近**一圈圈又密又小的圆**，
 *      越往外弧越稀。等概率半径会得到一堆中等大小的环，那才是靶盘。
 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  // ── 极心：在画面内、上三分之一、明显偏左或偏右 ──
  // 两个互斥的横向区间，避免随机到正中（正中 + 等高弧线 = 靶盘）
  const px = (rng.next() < 0.5 ? rng.range(0.20, 0.40) : rng.range(0.60, 0.80)) * w;
  const py = rng.range(0.12, 0.30) * h;

  // ── 夜空底：极心附近更亮（那里星多）──
  const nw = Math.round(w / 4);
  const nh = Math.round(h / 4);
  const sky = offscreen(nw, nh);
  const img = sky.ctx.createImageData(nw, nh);
  const d = img.data;
  const maxR = Math.hypot(w, h);

  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const u = x / nw;
      const v = y / nh;
      const dist = Math.hypot(u * w - px, v * h - py) / maxR;

      // 中心亮、外围暗的高斯，加上噪声让它不是光滑的圆
      const n = rng.warp(u * 3.4, v * 3.4, 1.6, 4);
      let t = Math.exp(-dist * dist * 2.6) * (0.5 + n * 0.9);
      t *= 0.30 + rng.fbm(u * 8 + 21, v * 8 + 7, 4) * 0.9;
      t = Math.pow(clamp(t), 1.75) * 0.62;

      const c = ramp(palette.stops, t);
      const i = (y * nw + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = Math.round(clamp(t) * 255);
    }
  }
  sky.ctx.putImageData(img, 0, 0);
  blit(ctx, sky.canvas, w, h, 0.9, "lighter");

  // ── 背景散星（静止的一层，星轨下面必须有星空）──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 420; i++) {
    const sx = rng.next() * w;
    const sy = rng.next() * h;
    const mag = rng.power(3.2, 0, 1);
    ctx.fillStyle = rgb(mix(palette.glow, [255, 255, 255], 0.3), 0.14 + mag * 0.5);
    ctx.beginPath();
    ctx.arc(sx, sy, 0.28 + mag * 0.95, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // ── 星轨 ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  const COUNT = rng.int(300, 400);
  for (let i = 0; i < COUNT; i++) {
    // 半径分布：指数 >1 把样本压向小半径（见文件头第 3 点）。
    // 指数 0.62 会让大多数弧落在中等半径上，等于画出一圈圈等距的环——靶盘。
    const r = Math.pow(rng.next(), 1.45) * maxR * 1.35 + 16;

    // 只画与画布相交的那一段，否则一半的计算都浪费在画面外
    const a0 = rng.range(0, TAU);
    // 弧长：大半径的星走得短一些（它们扫过的线速度更快、更容易过曝消失）
    const sweep = rng.range(0.10, 0.62) * (1 - Math.min(0.45, r / maxR * 0.5));

    // 分几十段画，逐段决定可见性——这样弧线是"断断续续"的，
    // 而不是一气呵成的饱满圆环。真实的长曝光里，星会因云、因高度而时隐时现。
    const STEPS = 48;
    let run = [];
    const mag = rng.power(2.4, 0, 1);
    const width = 0.55 + mag * 1.9;
    const bright = 0.10 + mag * 0.62;

    // 色温：少量偏暖、少量偏蓝、多数白
    const temp = rng.next();
    const col = temp > 0.9
      ? mix(palette.glow, [255, 200, 158], 0.7)
      : temp < 0.18
        ? mix(palette.glow, [176, 205, 255], 0.6)
        : palette.glow;

    for (let s = 0; s <= STEPS; s++) {
      const a = a0 + (s / STEPS) * sweep;
      const x = px + Math.cos(a) * r;
      const y = py + Math.sin(a) * r;
      const inside = x > -40 && x < w + 40 && y > -40 && y < h + 40;

      // 亮度沿弧衰减：头尾淡、中段实
      const env = Math.sin((s / STEPS) * Math.PI);
      const visible = inside && env > 0.14;
      if (visible) {
        run.push([x, y]);
      } else if (run.length > 1) {
        ctx.strokeStyle = rgb(col, bright * 0.9);
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(run[0][0], run[0][1]);
        for (let k = 1; k < run.length; k++) ctx.lineTo(run[k][0], run[k][1]);
        ctx.stroke();
        run = [];
      }
    }
    if (run.length > 1) {
      ctx.strokeStyle = rgb(col, bright * 0.9);
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(run[0][0], run[0][1]);
      for (let k = 1; k < run.length; k++) ctx.lineTo(run[k][0], run[k][1]);
      ctx.stroke();
    }
  }

  // 最亮的几颗星：给一条明显更粗更暖的轨，并让它在某处"停"下来——
  // 长曝光的照片里总有一颗特别亮的星，它是整张图的锚点。
  const heroes = rng.int(2, 4);
  for (let i = 0; i < heroes; i++) {
    const r = Math.pow(rng.next(), 1.2) * maxR * 1.12 + 34;
    const a0 = rng.range(0, TAU);
    const sweep = rng.range(0.28, 0.78);
    const col = mix(palette.glow, [255, 236, 200], 0.55);
    const pts = [];
    for (let s = 0; s <= 90; s++) {
      const a = a0 + (s / 90) * sweep;
      pts.push([px + Math.cos(a) * r, py + Math.sin(a) * r]);
    }
    litStroke(ctx, pts, 1.9, col, 0.62, 3);
    litStroke(ctx, pts, 0.8, mix(col, [255, 255, 255], 0.6), 0.85, 1);

    // 锚点：弧的末端给一团光
    const [ex, ey] = pts[pts.length - 1];
    if (ex > 0 && ex < w && ey > 0 && ey < h) {
      glow(ctx, ex, ey, 34, col, 0.28);
      glow(ctx, ex, ey, 8, mix(col, [255, 255, 255], 0.7), 0.6);
    }
  }
  ctx.restore();

  // ── 轴心本身：一圈极小的星轨围着它转 ──
  // 这是整张卡的**主语**，必须有东西在那里。空一个点是不够的：
  // 说"所有轨道都绕着同一个中心"，读者就该看见那个中心是什么。
  // 画法是极心周围一小圈密集的短弧——真实照片里正对天极的位置就是这样，
  // 星星几乎不动，只画出极小的圈。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 90; i++) {
    const r = 6 + Math.pow(rng.next(), 2.1) * 108;
    const a0 = rng.range(0, TAU);
    const sweep = rng.range(0.5, 1.7);
    const mag = rng.power(2.0, 0, 1);
    const pts = [];
    for (let s = 0; s <= 26; s++) {
      const a = a0 + (s / 26) * sweep;
      pts.push([px + Math.cos(a) * r, py + Math.sin(a) * r]);
    }
    const col = mag > 0.72
      ? mix(palette.glow, [255, 238, 205], 0.6)
      : palette.glow;
    litStroke(ctx, pts, 0.4 + mag * 1.1, col, 0.16 + mag * 0.5, 2);
  }
  // 极星：轴心上那颗不动的星
  const pole = mix(palette.glow, [255, 252, 240], 0.72);
  glow(ctx, px, py, 130, palette.glow, 0.14);
  glow(ctx, px, py, 30, pole, 0.30);
  glow(ctx, px, py, 7, pole, 0.85);
  // 极星的四芒。这里压得很轻、而且**四根不等长**：
  // 等长的十字读成"闪光特效"（像相机镜头光斑的贴纸），不等长的才读成"星星在发光"。
  ctx.strokeStyle = rgb(pole, 0.17);
  ctx.lineWidth = 0.8;
  for (const [dx, dy, len] of [[1, 0, 52], [-1, 0, 27], [0, 1, 38], [0, -1, 21]]) {
    ctx.beginPath();
    ctx.moveTo(px + dx * 6, py + dy * 6);
    ctx.lineTo(px + dx * len, py + dy * len);
    ctx.stroke();
  }
  ctx.restore();

  vignette(ctx, w, h, 0.52, 1.26);
  grain(ctx, w, h, rng, 0.046, 2);
}
