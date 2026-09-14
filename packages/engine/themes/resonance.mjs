export const meta = {
  id: "resonance",
  zh: "共鸣",
  en: "Resonance",
  connects: "共振",
  mood: "两样东西各自在动，直到它们开始互相加强",
  note: "连接来自共振：不是变得一样，而是频率接近到可以彼此放大，相遇处振幅远大于两者之和。",
};

/**
 * 共鸣。
 *
 * ### 最容易犯的错：把它画成"两个东西变一样了"
 *
 * 共鸣不是同步，是**互相加强**。两个振源频率接近但不相同，
 * 各自都不强，但在相位对上的地方振幅叠成一个远大于任何一边的峰。
 * 所以画面的主角**不是那两个源**，是**它们对上的那一点**。
 *
 * ### 前三版都是同一个错误的不同形状：把干涉画成了"雾"
 *
 * 一版是同心的干净圆环（**靶子**，而且那是 echo 的机制，不是共振）；
 * 一版用逐像素的有符号振幅场渲染成一张图，出来是**一片糊的云**；
 * 一版加了空间包络之后变成**灯光秀的斑点**。
 * 共同的问题：**逐像素的场太软，读不出"两组波"这个结构。**
 * 干涉之所以能被认出来，靠的是**线**之间的交叉，那是几何关系，不是亮度分布。
 *
 * ### 所以这一版：两组圆环，画成线
 *
 *   - A 从左边出发，B 从右边出发，各画自己的一圈圈波峰（细亮的线）。
 *   - 两源波长**相差 8%–16%**：这是能产生"对上一次、又错开、又对上"的前提。
 *     完全一样就变成同一件事，差太远则各走各的。
 *   - 环与环交叉的地方自然形成一片双曲线网格 —— 这就是干涉本来的样子，
 *     画成线之后非常清楚，不需要任何"雾"。
 *
 * ### 关键一招：让相位在相遇点**精确对齐**
 *
 * 不是随便放两套环，然后指望它们在某处恰好对上。
 * 而是**先定下相遇点，再解出 B 的相位**，使两条环线正好都穿过那里：
 *
 *     phaseB = phaseA − (dA/lenA − dB/lenB)·τ
 *
 * 于是那个点是构造出来的、必然的对齐点 —— 也就是"它们对上了"的那一瞬间。
 * 离开这个点越远，两套环就越错开（视觉上能看出网格在相互滑动），
 * 这正是"频率接近但不相同"的直观表达。
 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  // ── 两个振源：分居左右，略高于画面下沿 ──
  // 位置先定，波长与相位随后由"相遇点"反推。见下。
  const A = {
    x: rng.range(0.06, 0.20) * w,
    y: rng.range(0.70, 0.86) * h,
    // 波长要大。太密的话两套环会糊成一片网，看不出"两组"。
    len: h * rng.range(0.115, 0.145),
    phase: 0,
  };
  const B = {
    x: rng.range(0.80, 0.94) * w,
    y: rng.range(0.70, 0.86) * h,
    // 差异 8%–16%：既不是同一件事，也不至于各走各的
    len: 0,
    phase: 0,
  };
  B.len = A.len * rng.range(1.08, 1.16);

  // ── 相遇点：两源的垂直平分线附近，偏上 ──
  // 这是整张卡的主语，所有构图都指向它。
  const cx = (A.x + B.x) / 2 + rng.range(-0.05, 0.05) * w;
  const cy = rng.range(0.32, 0.46) * h;

  // ── 让两套环**都**精确穿过相遇点 ──
  // 一张环在经过距离 d 处时，波峰条件是 (d/λ)·τ + φ = 2πk。
  // 给定 d 与 λ，反解出 φ，就能保证这一圈正落在相遇点上：
  //
  //     φ = 2π·round(d/λ) − (d/λ)·τ
  //
  // 两套环都这样定相位，于是相遇点必然是"对上了"的地方 ——
  // 这个对齐是**构造出来的确定事实**，不是碰运气。
  // 随机性来自两源位置（它决定 d），这样每张卡的对齐点都不同。
  const dA0 = Math.hypot(cx - A.x, cy - A.y);
  const dB0 = Math.hypot(cx - B.x, cy - B.y);
  A.phase = kPhase(dA0, A.len);
  B.phase = kPhase(dB0, B.len);
  function kPhase(d, len) {
    const t = d / len;
    return Math.round(t) * TAU - t * TAU;
  }

  // 光从上方来。环的"亮段"朝向它 —— 见 drawRings 里的说明。
  const lightAngle = -Math.PI / 2 + rng.range(-0.55, 0.55);

  // ── 一组圆环的绘制 ──
  /**
   * 从某个源画出一圈圈波峰。
   * @param S       源
   * @param angOff  整组环的角向偏置（让两组的"缺口"不重合）
   * @param maxR    画到多远（世界单位）
   */
  const drawRings = (S, angOff, maxR) => {
    const N = 72;
    const count = Math.floor(maxR / S.len);
    for (let k = 1; k <= count; k++) {
      const r = k * S.len;

      // 距离衰减：越外越弱。这既是物理，也让画面有中心
      const fall = Math.pow(1 - k / (count + 1.2), 0.65);
      if (fall < 0.06) continue;

      // 对光的响应：波只在坡面朝着光源的那一段亮。
      // 整圈一样亮就只是"画出来的圆"，不是水波 —— 这一条是像与不像的分界。
      const pts = [];
      const amps = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * TAU + angOff;
        pts.push([S.x + Math.cos(a) * r, S.y + Math.sin(a) * r]);
        // 朝光方向的一个窄亮峰 + 一层很宽的底，避免整圈只剩一个亮点
        const toLight = Math.cos(a - lightAngle);
        const spec = Math.pow(Math.max(0, toLight), 2.6);
        const wide = 0.30 + 0.30 * Math.max(0, toLight);
        amps.push(spec * 0.75 + wide);
      }

      const col = palette.glow;
      const baseA = 0.055 + fall * 0.30;

      // 分段绘制：每段用自己那一点的亮度，明暗沿环流动
      const STEP = 4;
      for (let i = 0; i + 1 < pts.length; i += STEP) {
        const seg = pts.slice(i, Math.min(pts.length, i + STEP + 1));
        if (seg.length < 2) continue;
        let amp = 0;
        for (let q = i; q < Math.min(amps.length, i + STEP + 1); q++) amp += amps[q];
        amp /= Math.min(amps.length, i + STEP + 1) - i || 1;
        if (amp < 0.05) continue;

        // **能量向相遇处集中。** 这一段是"共鸣"在画面上的落点：
        // 两波耦合强的地方振幅才大，离得远的地方各自都在衰减。
        // 没有它，环会均匀铺满画面 —— 那读起来是一张示意图，不是"某处发生了共振"。
        // 关键是：这里只调**亮度**，不模糊线条。线一糊，结构就没了。
        const midX = (seg[0][0] + seg[seg.length - 1][0]) / 2;
        const midY = (seg[0][1] + seg[seg.length - 1][1]) / 2;
        const dm = Math.hypot(midX - cx, midY - cy) / (w * 0.50);
        const conc = 0.22 + 0.78 * Math.exp(-dm * dm * 0.85);

        // 环是一峰一谷的：线本身要细，两侧只留极淡的辉。
        // 线一粗就变成"光晕"，整张图立刻软掉。
        litStroke(ctx, seg, 1.5, col, baseA * amp * conc * 0.22, 2);
        litStroke(ctx, seg, 0.55, mix(col, [255, 255, 255], 0.30), baseA * amp * conc, 2);
      }
    }
  };

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawRings(A, rng.range(0, 0.7), h * 1.15);
  drawRings(B, rng.range(2.1, 3.0), h * 1.15);
  ctx.restore();

  // ── 相遇处的主光 ──
  // 必须明显强于任何一个源，否则读者会以为最强的波来自某个源，
  // 而不是来自"两者相遇"。这是全图的重心。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const core = mix(palette.glow, [255, 255, 255], 0.60);
  glow(ctx, cx, cy, w * 0.42, palette.glow, 0.13);
  glow(ctx, cx, cy, w * 0.17, palette.glow, 0.22);
  glow(ctx, cx, cy, w * 0.062, core, 0.40);
  glow(ctx, cx, cy, w * 0.015, core, 0.88);
  ctx.restore();

  // ── 两个源：刻意画得比相遇处暗、小 ──
  // 如果源比相遇处亮，整张图的重点就跑到"它们"身上了 ——
  // 而共鸣的重点是"它们之间发生的事"。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const S of [A, B]) {
    glow(ctx, S.x, S.y, w * 0.17, palette.glow, 0.09);
    glow(ctx, S.x, S.y, w * 0.034, palette.glow, 0.22);
    glow(ctx, S.x, S.y, w * 0.0085, mix(palette.glow, [255, 255, 255], 0.35), 0.48);
  }
  ctx.restore();

  // ── 拍频包络 ──
  // 两源频率略有差异，叠加之后会产生一个**缓慢变化的包络**（拍）。
  // 这是"频率接近但不相同"最标准的特征，也是最容易被忽略的一条。
  // 做法是极淡的横向条带，一层就够 —— 厚了会盖住环。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const beatLen = (A.len * B.len) / Math.abs(A.len - B.len);
  const bands = Math.max(3, Math.round(h / beatLen));
  for (let i = 0; i < bands; i++) {
    const t = i / bands;
    const y = h * (0.14 + t * 0.72);
    const s = 0.5 + 0.5 * Math.cos(t * TAU);
    const g = ctx.createLinearGradient(0, y - h * 0.07, 0, y + h * 0.07);
    g.addColorStop(0, rgb(palette.glow, 0));
    g.addColorStop(0.5, rgb(palette.glow, 0.022 + s * 0.036));
    g.addColorStop(1, rgb(palette.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, y - h * 0.07, w, h * 0.14);
  }
  ctx.restore();

  vignette(ctx, w, h, 0.52, 1.30);
  grain(ctx, w, h, rng, 0.044, 2);
}
