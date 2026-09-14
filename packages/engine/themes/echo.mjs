export const meta = {
  id: "echo",
  zh: "回响",
  en: "Echo",
  connects: "延迟",
  mood: "你发出的东西，很久之后才回到你这里",
  note: "连接来自延迟：发出与返回之间隔着的不是距离，是时间，而时间会让形状改变。",
};

/**
 * 回响。
 *
 * ### 第一版是雷达/声呐，不是回响（记下来）
 *
 * 第一版把波画成一组**正面看的同心圆**：等距、干净、每轮都是完美圆形。
 * 出来的是一张声呐屏，而且是"仪器图"，不是"'发生过一次的事"。
 * 错在三处：
 *   - **视角**。正面俯视一组同心圆，在任何仪器上都是这个形状。要让人认出是**水面**，
 *     必须给出透视 —— 人是从岸边低角度看着水面的。
 *   - **衰减没做出来**。所有环看起来一样强，于是没有"时间过去了"的感觉。
 *   - **太干净**。真实的波会被地形切碎，不会一圈圈都完整。
 *
 * ### 这一版的做法
 *
 * **透视投影。** 相机在岸边，高度归一化为 1，水面是地平面。
 * 地面上距相机 d 处的一点，投影到屏幕上的位置是经典的 `y ∝ 1/d`：
 *
 *     屏幕 y = 地平线 + K / (D0 + r·cos(a))
 *     屏幕 x = cx + K · (r·sin(a)) / (D0 + r·cos(a))
 *
 * 这一个式子就给了整张图：近处的波又大又散，远处的波被压扁并**挤在地平线附近**。
 * 圆环自然变成一叠间距越远越窄的椭圆 —— 这是"水面"最强的视觉签名。
 *
 * **去程与回程。** 回响的关键不是波出去，是**它回来**。
 * 物理上水波撞到岸边会反射，所以画面里有两组波：
 *   - 出程波：从源点向外，亮、紧、还没散；
 *   - 回程波：从远处折回，暗、宽、已经被打散，而且**打碎成一段段**。
 * 回程波才是这张卡的主语。
 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  // ── 相机与地平线 ──
  // 相机压得低（地平线在上方 26%），落点离相机不远（D0 小）——
  // 这样波有足够大的屏幕尺度铺开。之前 D0=1.0 时波挤在地平线附近一小团，
  // 画面下半全是空水，构图失重。
  const HORIZON = 0.26;
  const K = h * 0.34;            // 透视常数
  const D0 = 0.78;               // 落点到相机的距离（归一化）
  // 源点（石头落水处）。偏左或偏右，放正中会太"仪表"。
  const sx = rng.range(0.32, 0.68) * w;
  const sy = h * HORIZON + K / D0;

  // 水平光：从左上斜下来。它在水面上留下一条光路（见下）。
  const lx = rng.range(0.10, 0.90) * w;

  // 投影：地面坐标 (方位角 a，半径 r) → 屏幕坐标
  const project = (a, r) => {
    const d = D0 + r * Math.cos(a);
    if (d < 0.06) return null;                 // 在相机后面/贴着相机，丢弃
    const s = K / d;
    return [sx + K * (r * Math.sin(a)) / d, h * HORIZON + s];
  };

  // ── 夜色水面：远处亮、近处暗（天光在水面上，近处看到的是水的深处）──
  ctx.save();
  const wet = ctx.createLinearGradient(0, h * HORIZON, 0, h);
  wet.addColorStop(0, rgb(ramp(palette.stops, 0.22), 0.42));
  wet.addColorStop(0.30, rgb(ramp(palette.stops, 0.13), 0.30));
  wet.addColorStop(1, rgb(ramp(palette.stops, 0.04), 0.46));
  ctx.fillStyle = wet;
  ctx.fillRect(0, h * HORIZON, w, h * (1 - HORIZON));
  ctx.restore();

  // ── 干扰场：波走过多远，就被地形扰动多少 ──
  // 用一个角度→扰动的函数，所有轮次共用，这样扰动是连贯的（相邻两轮的形变相似）。
  const DK = [];
  const DP = [];
  for (let i = 0; i < 6; i++) {
    DK.push(Math.round(rng.range(2, 6)));   // 角向频率取整数，保证首尾接得上
    DP.push(rng.range(0, TAU));
  }
  const disturb = (a) => {
    let s = 0;
    for (let i = 0; i < DK.length; i++) s += Math.sin(a * DK[i] + DP[i]);
    return s / DK.length;
  };

  // ── 波纹的通用画法 ──
  /**
   * 画一条波。
   *
   * **这一版最重要的改动：波只在"对着光"的那一段可见。**
   * 前两版把整圈波画得一样亮，结果再怎么调都像靶子/作物圈 ——
   * 因为"一圈均匀发亮的圆"在现实中根本不存在：水面只在波的坡面
   * **恰好把光反射进眼睛**时才亮，其余部分是暗的。
   * 所以亮度必须随方位角剧烈变化，这是把几何图案变成水面的关键一步。
   *
   * @param r       当前半径（世界单位）
   * @param out     出程(true) / 回程(false)：决定亮部的色温与朝向
   * @param energy  这一轮的强度 0–1
   * @param spread  扩散程度：越散越宽越暗
   * @param jitter  面向扰动强度（回程更大）
   * @param gaps    断成几段（回程被打碎；0 = 完整）
   */
  const drawRing = (r, out, energy, spread, jitter, gaps) => {
    const N = 200;
    const segs = gaps > 0 ? gaps : 1;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * TAU;
      const span = (TAU / segs) * (gaps > 0 ? rng.range(0.35, 0.92) : 1);
      if (gaps > 0 && rng.next() < 0.25) continue; // 有些段整段消失

      const pts = [];
      const amps = [];
      const M = Math.max(8, Math.round(N / segs));
      for (let i = 0; i <= M; i++) {
        const a = a0 + (i / M) * span;
        const rr = r * (1 + disturb(a) * jitter);
        const p = project(a, rr);
        if (!p) continue;
        pts.push(p);

        // 对光的响应：坡面朝向决定这段波有多亮。
        // 用两个方向的分量 —— 主方向朝光源，次方向给一点变化，
        // 避免整圈只有一个亮点、其余全黑（那又会变成"一道弧"）。
        const toLight = Math.cos(a - lightAngle);
        // 反射最强的方位：正对光源方向。
        //
        // 这个指数看着是"高光有多锐利"，实际它决定了**有多少圈波能被看见**：
        // 取 2.2 时只有正对光源的那几条弧进入可见范围，整张卡缩到 200px
        // （信息流里就是这个尺寸）就只剩一团模糊光斑，认不出是涟漪 ——
        // 而"一圈圈扩散"正是这张卡的机制本身。取 1.5 让更多方位的弧带一点反光，
        // 缩略图里才读得出这件事。全尺寸下也更好：内圈反光强、外圈弱，
        // 更接近真实水面的反射，而不是"一道亮弧"。
        const spec = Math.pow(Math.max(0, toLight), 1.5);
        // 再加一层低频随机，让亮段的位置不完全对称
        const wobble = 0.5 + 0.5 * Math.sin(a * 3 + r * 5.5);
        amps.push(spec * (0.30 + wobble * 0.70));
      }
      if (pts.length < 4) continue;

      // 越远的波在屏幕上越窄（透视压扁），线宽要跟着压，
      // 否则远处的波会显得比近处的还粗，透视立刻就假了。
      //
      // **这里踩过一次坑**：`K/(D0+r)` 是**像素**（它就是投影高度），
      // 我第一版直接拿它当归一化系数乘进线宽，得到几百倍的放大 ——
      // 整张图糊成一片白。归一化要用 `1/(D0+r)`，它的范围才是 0–1。
      const depth = 1 / (D0 + r);
      // 线宽：原值 (0.35 + energy*1.5)。缩到 200px 后，这个宽度下的弧线
      // 会被降采样平均掉（和 orbit 轨道线同一个问题），所以加粗一档。
      // 注意**只加粗、不提亮**：提亮会让中心糊成一团白，向"靶心"滑；
      // 加粗只影响线的存在感，不影响明暗层次。
      const baseW = (0.60 + energy * 2.4) * spread * (0.30 + depth * 1.35);

      const col = mix(palette.glow, [255, 255, 255], out ? 0.35 : 0.05);
      // 亮度基数。原值 (0.05 + energy*0.46) * 0.60 在全尺寸下够用，
      // 但缩到 200px 后回程波整段消失 —— 回程波恰恰是"回响"的主语
      // （去程波只是"发出去了"，回来才是回响）。这里上调约 1.4 倍，
      // 让它在信息流尺寸下也留得住痕迹。
      const a0v = (0.10 + energy * 0.70) * (out ? 1 : 0.72);

      // 分段绘制，每段用自己那一点的亮度 —— 这样明暗沿波"流动"，
      // 而不是整条波一起亮或一起灭。
      const STEP = 6;
      for (let i = 0; i + 1 < pts.length; i += STEP) {
        const seg = pts.slice(i, Math.min(pts.length, i + STEP + 1));
        if (seg.length < 2) continue;
        let amp = 0;
        for (let k = i; k < Math.min(amps.length, i + STEP + 1); k++) amp += amps[k];
        amp /= Math.min(amps.length, i + STEP + 1) - i || 1;
        if (amp < 0.03) continue;

        // 波是有体积的：宽而淡的底 + 窄而亮的棱。
        //
        // 棱要比底窄、要亮 —— 缩到 200px（信息流尺寸）时，**"结构可见"全靠这条棱**：
        // 实测原参数（棱与底同宽、亮度只由 a0v 决定）缩下来只剩"模糊的圈圈"，
        // 相邻几圈糊在一起，数不出是几道波。把棱收窄到 0.78 倍、亮度提到 1.7 倍后，
        // 每圈弧线能一根根分开追踪，而"回程波比出程波暗"的语义不受影响
        // （那是两组各自的 a0v 决定的，这里只是让同一条波自己更清楚）。
        litStroke(ctx, seg, baseW * 2.8, palette.glow, a0v * amp * 0.20, 2);
        litStroke(ctx, seg, baseW * 0.78, col, Math.min(0.95, a0v * amp * 1.7), 3);
      }
    }
  };

  // 光源方位角：光路所在的方位就是"对光"的方向。
  // 注意屏幕坐标 y 向下，所以这里用 -atan2 换算成数学角度。
  const lightAngle = Math.atan2(-(h * HORIZON - sy) || -1, lx - sx) + Math.PI / 2;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // ── 出程波：撑开、变宽、变暗 ──
  const OUT = rng.int(6, 8);
  let rr = 0.050;
  for (let k = 0; k < OUT; k++) {
    const t = 1 - k / (OUT + 1);           // 1 = 最新
    drawRing(rr, true, Math.pow(t, 0.80), 1 + k * 0.55, 0.010 + k * 0.012, 0);
    rr += 0.062 * (1 + k * 0.40);
  }

  // ── 回程波：从远处折回，暗、宽、被打碎 ──
  // 它们占据更大的半径（靠近地平线），而且因为它们走了两倍的路，
  // 强度只余下出程的一小部分 —— 这是"很久之后才回来"的全部含义。
  const BACK = rng.int(4, 6);
  const backStart = rr * rng.range(0.9, 1.15);
  let br = backStart;
  for (let k = 0; k < BACK; k++) {
    const t = 1 - k / (BACK + 1);
    // 关键对比：亮度只有同轮出程波的 ~35%，扩散度却大得多
    drawRing(br, false, Math.pow(t, 1.1) * 0.36, 1.6 + k * 0.85, 0.030 + k * 0.030, rng.int(3, 6));
    br += 0.070 * (1 + k * 0.38);
  }
  ctx.restore();

  // ── 源点：石头刚落下的那一下 ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, sx, sy, w * 0.055, palette.glow, 0.22);
  glow(ctx, sx, sy, w * 0.016, mix(palette.glow, [255, 255, 255], 0.5), 0.40);
  glow(ctx, sx, sy, w * 0.0042, mix(palette.glow, [255, 255, 255], 0.92), 0.95);
  ctx.restore();

  // ── 水面上的光路 ──
  // 一道竖直的碎光带（远处窄、近处宽）。它给了水面一个**材质**，
  // 否则下面的椭圆可能看起来仍像画在纸上的线。
  //
  // 强度**刻意压得比波纹低**：它是配角（说明"水面"），波纹是主角（说明"回响"）。
  // 之前它太亮太大，把观众的注意力全带走了。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const ROWS = 120;
  for (let row = 0; row < ROWS; row++) {
    const t = row / ROWS;
    const y = h * HORIZON + Math.pow(t, 1.6) * h * (1 - HORIZON);
    const halfW = w * (0.010 + Math.pow(t, 1.3) * 0.18);
    const dashes = Math.round(2 + t * 9);
    for (let d = 0; d < dashes; d++) {
      const off = rng.next() * rng.next() * 2 - 1;
      const x = lx + off * halfW;
      const spark = rng.fbm(x / w * 30 + 3.3, t * 9 + 1.7, 3);
      const flash = Math.pow(clamp(spark * 1.7 - 0.34), 2.2);
      const b = Math.exp(-off * off * 2.2) * (0.035 + flash * 0.42) * (0.4 + t * 0.8);
      if (b < 0.018) continue;
      const col = ramp(palette.stops, 0.46 + flash * 0.5);
      ctx.fillStyle = rgb(col, Math.min(0.62, b));
      ctx.beginPath();
      ctx.ellipse(x, y + rng.range(-1, 1) * (0.5 + t * 2), (2 + t * 20) * rng.range(0.5, 1.6),
        0.45 + t * 1.6, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  // ── 近岸：画面最下方压暗，暗示这里是岸边看出去 ──
  ctx.save();
  const near = ctx.createLinearGradient(0, h * 0.78, 0, h);
  near.addColorStop(0, rgb(palette.base, 0));
  near.addColorStop(1, rgb(palette.base, 0.55));
  ctx.fillStyle = near;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  ctx.restore();

  // ── 地平线以上：夜空 ──
  // 这几条横向亮雾是"天光被水汽散开"的暗示，但它只是场景交代，
  // **不该抢波纹的戏**。原参数（0.05–0.11）在全尺寸下像夜空，
  // 缩到 200px 后就只剩一条没来由的横向亮带 —— 实测观者读到的是
  // "画面瑕疵"而不是"夜空"，反而破坏了"这是水面"的判断。
  // 压到 0.03–0.065 之后横带退进背景，读起来才是"夜色水面上一圈圈涟漪"。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const bY = h * HORIZON + rng.range(-0.05, 0.01) * h;
    const bH = h * rng.range(0.010, 0.034);
    const g = ctx.createLinearGradient(0, bY - bH, 0, bY + bH);
    const a = rng.range(0.03, 0.065);
    g.addColorStop(0, rgb(palette.glow, 0));
    g.addColorStop(0.55, rgb(palette.glow, a));
    g.addColorStop(1, rgb(palette.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, bY - bH, w, bH * 2);
  }
  for (let i = 0; i < 70; i++) {
    const stx = rng.next() * w;
    const sty = Math.pow(rng.next(), 1.5) * h * HORIZON;
    const mag = rng.power(3.2, 0, 1);
    ctx.fillStyle = rgb(mix(palette.glow, [255, 255, 255], 0.35), 0.08 + mag * 0.36);
    ctx.beginPath();
    ctx.arc(stx, sty, 0.28 + mag * 0.8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // 地平线上一道极淡的推远：让天空和水面之间有层次，不是一条硬接缝
  ctx.save();
  const skyBand = ctx.createLinearGradient(0, 0, 0, h * HORIZON);
  skyBand.addColorStop(0, rgb(palette.base, 0.55));
  skyBand.addColorStop(1, rgb(palette.base, 0));
  ctx.fillStyle = skyBand;
  ctx.fillRect(0, 0, w, h * HORIZON);
  ctx.restore();

  vignette(ctx, w, h, 0.46, 1.30);
  grain(ctx, w, h, rng, 0.045, 2);
}
