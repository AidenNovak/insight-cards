export const meta = {
  id: "tide",
  zh: "潮汐",
  en: "Tide",
  connects: "周期",
  mood: "被一个更大的东西定期带着走",
  note: "连接来自周期：水自己不会涨。每一次逼近与退去都是同一个外力在不同时间点上的重演。",
};

/**
 * 潮汐。
 *
 * 和星轨的区别，是我写的时候一直在防的一件事：
 * 星轨是**绕着一个点转**（轴心），潮汐是**被一个画外的力来回拉**（周期）。
 * 两者都"在动"，但一个闭合、一个往复。所以潮汐不能出现圆，必须是水平的、有方向的推进与退却。
 *
 * 三个要点：
 *
 *   1. **必须画出"是谁在拉"。** 第一版只画了水面，结果像一堆好看的横波纹——
 *      像海，但不像潮汐。潮汐的定义里有月亮：**没有那个外力，水不会自己涨。**
 *      做法是在画面上方留一个引力源（一颗低垂的光体），并让水面的起伏朝向它对齐。
 *   2. **要有水位线，不能只有波纹。** 波纹是"水在动"，水位是"水来过又走了"。
 *      真正表达潮汐的是**露出来的滩涂**：那些被水反复冲刷、留下横向水痕的湿区。
 *   3. **往复的相位要错开。** 所有波峰对齐就成了标准正弦（像图表）。
 *      真实的水面是许多不同周期、不同相位的波叠加，某处正在涨、某处已经在退。
 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  // ── 引力源：低垂在天边的一颗光体 ──
  // 位置压得很低（贴近水面），这样它的**倒影路径**才能在水面上铺开一段够长的距离。
  // 第一版把它放在 0.06–0.15h 且做得很亮很大，结果它成了主光、水面成了灰带子 ——
  // 反了。这颗东西的作用是**照亮水面**，它自己不该是最亮的东西。
  const mx = rng.range(0.32, 0.68) * w;
  const my = h * rng.range(0.10, 0.17);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, mx, my, w * 0.95, palette.glow, 0.10);
  glow(ctx, mx, my, w * 0.13, mix(palette.glow, [255, 255, 255], 0.3), 0.22);
  glow(ctx, mx, my, w * 0.026, mix(palette.glow, [255, 255, 255], 0.75), 0.62);
  ctx.restore();

  // 水面从这一行开始。上面是天，下面是水。
  const HORIZON = 0.44;

  // ── 水面：底部约六成，用一组相位不同的水平波叠成 ──
  // 相位、波长、幅度都由 rng 定，避免所有波峰对齐成规整的正弦。
  const waves = [];
  const NW = 7;
  for (let i = 0; i < NW; i++) {
    waves.push({
      // 波长跨越整个画面宽度的一小部分到一个多
      len: w * rng.range(0.34, 1.25),
      amp: h * rng.range(0.006, 0.030),
      phase: rng.range(0, TAU),
      // 每层波有自己的基线高度：这就是"不同水位留下的痕"
      y: HORIZON * h + (i + 1) * 0.058 * h + rng.range(-0.014, 0.014) * h,
      // 越靠下越暗（离引力源越远、也越深）
      bright: 0.62 - i * 0.062,
    });
  }

  // 湿滩底色：水退之后留下的那片较亮的区域
  ctx.save();
  const wet = ctx.createLinearGradient(0, h * HORIZON, 0, h);
  wet.addColorStop(0, rgb(ramp(palette.stops, 0.26), 0.50));
  wet.addColorStop(0.35, rgb(ramp(palette.stops, 0.16), 0.42));
  wet.addColorStop(1, rgb(ramp(palette.stops, 0.05), 0.62));
  ctx.fillStyle = wet;
  ctx.fillRect(0, h * HORIZON, w, h * (1 - HORIZON));
  ctx.restore();

  // ── 滩涂上的横向水痕：潮汐真正留下的证据 ──
  // 这些线不发光，是被水冲刷出的暗痕与亮痕交替，所以用 source-over 而非 lighter。
  ctx.save();
  const TRACES = rng.int(26, 40);
  for (let i = 0; i < TRACES; i++) {
    const y0 = h * (0.44 + rng.next() * 0.58);
    // 每条痕的亮度不同：有的被光照到，有的在暗处
    const lit = rng.next();
    const bright = lit > 0.82 ? rng.range(0.18, 0.42) : rng.range(0.03, 0.14);
    const col = lit > 0.82
      ? ramp(palette.stops, rng.range(0.62, 0.9))
      : palette.base;
    const wood = rng.range(0.0004, 0.0022); // 木纹般的缓慢起伏
    const thick = rng.range(0.6, 2.6);

    ctx.strokeStyle = rgb(col, bright);
    ctx.lineWidth = thick;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 14) {
      // 水痕受底层地形影响，所以起伏比波纹更不规则
      const y = y0
        + Math.sin(x * wood * TAU + i * 1.7) * h * rng.range(0.004, 0.020)
        + rng.warp(x / w * 2.4, i * 0.31, 1.1, 3) * h * 0.012;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ── 水面反光的**光路**（glitter path）──
  // 这是整张卡的主光，也是"水"这个材质唯一的签名：光源落在水面上，
  // 会形成一条从地平线一直铺向观者的竖直碎光带 —— 水面由无数朝向随机的小镜面组成，
  // 只有恰好把光反射进眼睛的那些才亮。离开这条带子的地方必须有**明确的暗**，
  // 否则整片水会变成均匀的灰（第一版就是这样，像一块灰板子）。
  //
  // 这里改成**逐行摆碎光段**，而不是逐像素采样。原因：逐像素那版看起来像噪声，
  // 因为真实的光路不是噪点，是**一条条被压扁的亮痕**，每一条都能看出长度和方向。
  // 逐行摆段才能控制"远处短而密、近处长而疏"这个透视特征。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const ROWS = 210;
  for (let row = 0; row < ROWS; row++) {
    const v = row / ROWS;
    // 幂律：近处（画面下方）行距变大，形成透视压缩
    const y = h * HORIZON + Math.pow(v, 1.7) * h * (1 - HORIZON) * 1.04;

    // 光路的横向半宽：地平线处收成一点，到近处展开
    const halfW = w * (0.012 + Math.pow(v, 1.25) * 0.30);

    // 远处的行又密又短（连成一条亮带），近处的行又疏又长（能数出每一道）
    const dashes = Math.round(3 + v * 16);
    const dashLen = (2.5 + v * 26) * rng.range(0.5, 1.7);
    const thick = 0.5 + v * 1.9;

    for (let d = 0; d < dashes; d++) {
      // 横向位置偏向中轴：用两次 rng 相乘制造中间密的分布
      const off = (rng.next() * rng.next() * 2 - 1);
      const x = mx + off * halfW;
      const spread = Math.exp(-off * off * 2.1);

      // 这一道碎光有多亮：由噪声决定，而不是每道都一样 ——
      // 真实的光路里，绝大多数碎光是暗的，只有少数几道正对观者
      const spark = rng.fbm(x / w * 34 + 5.7, v * 11 + row * 0.03, 3);
      const flash = Math.pow(clamp(spark * 1.7 - 0.30), 1.9);

      const b = spread * (0.055 + flash * 0.95) * (0.42 + Math.pow(v, 0.6) * 0.85);
      if (b < 0.02) continue;

      const y0 = y + rng.range(-1, 1) * (0.5 + v * 2.2);
      const col = ramp(palette.stops, 0.46 + spread * flash * 0.54);
      ctx.fillStyle = rgb(col, Math.min(0.96, b));
      // 横线：水面反光是被压扁的波峰，从来不是圆点
      ctx.beginPath();
      ctx.ellipse(x, y0, dashLen, thick, 0, 0, TAU);
      ctx.fill();
    }
  }

  // ── 光路之外的水：必须有明确的暗，才有对比 ──
  // 用两侧的暗色压住离光路远的水面，制造"光源只照亮了一条带"的感觉。
  //
  // **渐变必须铺满到画框边缘**，宽度用 mx 实际到边的距离，不能用固定值。
  // 之前写死 0.55w：当光源偏右（mx≈0.68w）时，左侧那块渐变的起点 0.13w
  // 落在画面里，末端 alpha 0.64 与旁边的 0 之间就出现一条**竖着的硬边**——
  // 看起来像画面被切了一刀。渐变的范围要跟着"光路到画框"的真实距离走。
  ctx.globalCompositeOperation = "source-over";
  for (const dir of [-1, 1]) {
    const span = dir < 0 ? mx : w - mx;
    if (span <= 0) continue;
    const g = ctx.createLinearGradient(mx, 0, mx + dir * span, 0);
    g.addColorStop(0, rgb(palette.base, 0));
    // 按距离取中间停靠点，避免近处压得太死
    g.addColorStop(0.45, rgb(palette.base, 0.26));
    g.addColorStop(1, rgb(palette.base, 0.60));
    ctx.fillStyle = g;
    ctx.fillRect(dir < 0 ? 0 : mx, h * HORIZON, span, h * (1 - HORIZON));
  }
  ctx.restore();

  // ── 退潮的边缘：一条比周围明显亮的湿线，是"刚刚退到这里"的证据 ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const edgeY = h * rng.range(0.40, 0.47);
  const edgePts = [];
  for (let x = -10; x <= w + 10; x += 12) {
    const y = edgeY
      + Math.sin(x / w * TAU * 1.35 + 0.8) * h * 0.010
      + rng.warp(x / w * 3.1, 4.2, 1.4, 4) * h * 0.017;
    edgePts.push([x, y]);
  }
  // 用 litStroke 而不是普通描边：这条线本身是湿的、在反光
  litStroke(ctx, edgePts, 1.5, ramp(palette.stops, 0.86), 0.34, 3);
  litStroke(ctx, edgePts, 0.6, mix(palette.glow, [255, 255, 255], 0.6), 0.5, 1);
  ctx.restore();

  // 滩涂上的一层薄雾：让远处的水痕融进暗部，而不是被硬边切断
  ctx.save();
  const haze = ctx.createLinearGradient(0, h * 0.38, 0, h * 0.72);
  haze.addColorStop(0, rgb(palette.base, 0));
  haze.addColorStop(0.5, rgb(ramp(palette.stops, 0.14), 0.30));
  haze.addColorStop(1, rgb(palette.base, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, h * 0.38, w, h * 0.34);
  ctx.restore();

  // ── 地平线处的一层低雾 ──
  // 这条雾是**缝合**用的，不是装饰：没有它，水面和天空之间会出现一条硬缝
  // （第一版就是这样，像两条色块拼在一起）。真实的海平线永远有一层被光打亮的水汽。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 5; i++) {
    const bandY = h * HORIZON + rng.range(-0.055, 0.02) * h;
    const bandH = h * rng.range(0.012, 0.042);
    const g = ctx.createLinearGradient(0, bandY - bandH, 0, bandY + bandH);
    const a = rng.range(0.05, 0.13);
    g.addColorStop(0, rgb(palette.glow, 0));
    g.addColorStop(0.5, rgb(palette.glow, a));
    g.addColorStop(1, rgb(palette.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, bandY - bandH, w, bandH * 2);
  }
  ctx.restore();

  // ── 天空：极淡的云与星 ──
  // 天空必须**有东西但极暗**。它是"那个更大的东西所在的地方"，
  // 空成一块平色会让整张卡上半部分失重。
  //
  // 云用**一串重叠的圆光**排成横条，而不是把径向渐变做 scale 变换：
  // 渐变坐标在 canvas 里是跟着当前变换走的，scale 之后会跑偏，
  // 我试过，出来的是硬边矩形而不是云。一串圆光既安全又更像云。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 13; i++) {
    const cy = h * rng.range(0.03, HORIZON - 0.05);
    const cx = mx + rng.range(-0.72, 0.72) * w;
    const span = w * rng.range(0.16, 0.52);
    const r = h * rng.range(0.010, 0.030);
    const a = rng.range(0.020, 0.062);
    const beads = Math.max(4, Math.round(span / (r * 0.7)));
    for (let b = 0; b <= beads; b++) {
      const t = b / beads;
      // 两端淡、中间实
      const env = Math.sin(t * Math.PI);
      const x = cx - span / 2 + span * t;
      const y = cy + rng.range(-0.4, 0.4) * r * 1.6;
      glow(ctx, x, y, r * (0.6 + env * 0.9), palette.glow, a * env);
    }
  }
  // 星：稀疏，且不在地平线附近（那里被雾挡住）
  for (let i = 0; i < 130; i++) {
    const sx = rng.next() * w;
    const sy = Math.pow(rng.next(), 1.6) * h * HORIZON;
    const mag = rng.power(3.4, 0, 1);
    ctx.fillStyle = rgb(
      mix(palette.glow, [255, 255, 255], 0.35),
      (0.10 + mag * 0.42) * (1 - (sy / (h * HORIZON)) * 0.4),
    );
    ctx.beginPath();
    ctx.arc(sx, sy, 0.3 + mag * 0.9, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // 光源正下方到水面的**光柱**：由一串逐渐变淡变宽的圆光堆出来。
  // （用 fillRect + 线性渐变会留下两条硬边，看起来像一个贴上去的矩形。）
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const beamTop = my + h * 0.01;
  const beamBot = h * HORIZON + h * 0.02;
  for (let i = 0; i <= 26; i++) {
    const t = i / 26;
    const y = beamTop + (beamBot - beamTop) * t;
    const r = w * (0.030 + t * 0.085);
    const a = 0.085 * (1 - t) * (1 - t);
    glow(ctx, mx, y, r, palette.glow, a);
  }
  ctx.restore();

  vignette(ctx, w, h, 0.50, 1.30);
  grain(ctx, w, h, rng, 0.044, 2);
}
