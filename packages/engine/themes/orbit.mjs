export const meta = {
  id: "orbit",
  zh: "双星",
  en: "Binary",
  connects: "共生",
  mood: "两个都在动的东西，被同一个中心拴着",
  note: "连接来自共生：没有谁绕着谁转，两者绕着共同的质心转——那个中心不在任何一方身上，而在它们之间。",
};

/**
 * 双星。
 *
 * ### 和「轴心」（星轨）的分界 —— 这两张最容易糊在一起
 *
 *   星轨：**一个**不动的中心，无数东西绕着它转。中心是**静止的**，也是唯一的。
 *   双星：**没有**不动的中心。两颗都在动，它们共同绕的那个质心是**空的** ——
 *         那里什么也没有，只有两个质量共同定义出来的一个点。
 *
 * 这个区别决定了画面：
 *   - 星轨是**同心弧**（一个圆心，许多半径）。
 *   - 双星是**两个互相缠绕的轨迹**（两条轨道共用一个焦点，但那个焦点本身不发光）。
 *
 * ### 必须画出来的三件事
 *
 *   1. **两条轨道**，各自是椭圆，而且**共用一个焦点**（质心）。
 *      这是双星最本质的几何：不是两个同心圆。
 *   2. **质心是空的**：那个交点上只有极淡的一点，甚至没有。
 *      如果你在那里放了一个亮点，整张图立刻退回成"轴心"。
 *   3. **两者是耦合的**：一颗走到近点，另一颗也在对应的位置 ——
 *      它们永远在质心的两端（近似）。这个相位关系是"共生"的证据。
 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  // 质心：**空的中心**。位置在画面中偏上，让两条轨道能在下方展开。
  const cx = rng.range(0.42, 0.58) * w;
  const cy = rng.range(0.34, 0.46) * h;

  // 两星质量比：决定各自轨道的**大小**（质量小的轨道大）。
  // 这是双星真正的物理：轨道半径与质量成反比。
  //
  // 质量比刻意取在 1 附近：相差太远时其中一条轨道会缩成一小圈，
  // 看上去就只剩一条轨迹，"两个都在动"这件事就没了。
  const q = rng.range(0.72, 1.34);   // m1/m2
  // 半长轴的基准要够大：第一版给 0.10–0.14w，两条轨道缩在画面中间一小团，
  // 和"被同一个中心拴着的两个大东西"完全不搭。
  const r1 = w * rng.range(0.20, 0.26) / Math.sqrt(q);
  const r2 = r1 * q;

  // 两条轨道的**取向要略有差别**。
  //
  // 严格说同一平面的双星轨道是共轴的，画出来是两条嵌套的相似椭圆 ——
  // 而那样看起来就是**一个形状**（第一版正是如此，像画了一个椭圆）。
  // 这里给两条轨道一个小的夹角，是**为了可读性做的让步**：
  // 它让"这是两条不同的轨道"一眼能看出来，而物理含义（共用一个焦点）
  // 仍然守住了 —— 焦点没动，动的是椭圆的朝向。
  const axis = rng.range(0, Math.PI);
  const axis2 = axis + rng.range(0.30, 0.75) * (rng.next() < 0.5 ? 1 : -1);
  const ecc1 = rng.range(0.30, 0.52);
  const ecc2 = rng.range(0.30, 0.52);

  /**
   * 一点在椭圆轨道上的位置（椭圆的一个焦点在质心）。
   * 焦点在原点时的极坐标方程：r = a(1-e²)/(1+e·cosν)。
   *
   * （轨道线、星的运动轨迹、星的位置都用它 —— 三处必须用同一个式子，
   * 否则星会飘在它自己的轨道旁边。）
   */
  const onOrbit = (a, e, nu, ax = axis, squash = 0.94) => {
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
    const x = r * Math.cos(nu);
    const y = r * Math.sin(nu) * squash;
    const cA = Math.cos(ax), sA = Math.sin(ax);
    return [cx + (x * cA - y * sA), cy + (x * sA + y * cA)];
  };

  // ── 两条轨道 ──
  // 轨道本身是**暗的**：它是"路径"，不是"光"。给一条极细的痕。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [rr, ee, ax] of [[r1, ecc1, axis], [r2, ecc2, axis2]]) {
    const pts = [];
    const N = 220;
    for (let i = 0; i <= N; i++) {
      pts.push(onOrbit(rr, ee, (i / N) * TAU, ax));
    }
    // 轨道痕：分两层画 —— 一层很宽的柔辉光 + 一条线。
    //
    // 这里踩过两次"缩略图生死线"的坑，都记下来：
    //
    // 第一次：原参数 width 1.3 / alpha 0.13。全尺寸没问题，可卡片缩到 200px 宽
    // （信息流里就是这个尺寸）时，1.3 个单位宽的线只剩 **0.24 像素** ——
    // 平均下去就没了。实测让不认识这套东西的人看 200px 缩略图，反馈是
    // "只有两个亮点"，而**这张卡的机制恰恰全在轨道上**（两条轨道共用一个空的质心）。
    // 做了四档对照（1.3/0.13、3.2/0.15、6.0/0.10、4.5/0.18）：6.0 那档最清楚，
    // 但看起来是**一个大圆环套住两个点**（靶心感），正好丢掉"两条朝向不同的椭圆"；
    // 4.5/0.18 是唯一既读得出两条走向不同的弧、又不变成同心圆的一档。
    //
    // 第二次：改成 4.5/0.18 之后弧线有了，但缩略图里仍偏弱。
    // 再试"加一层宽而淡的柔辉光"而不是继续加亮线本身 ——
    // 线保持"路径不是光"的克制定位，辉光在 200px 下被降采样成可见的痕迹。
    // 实测（cur / halo-26 / halo-34 / halo+line）：
    //   halo-34 的光晕太窄，环芯开始有硬边界；halo+line 直接变成靶心硬环；
    //   halo-26 是唯一"缩略图里弧线跳出来、放大后仍是柔光"的一档。
    //
    // 教训：**"极细极淡"这类审美判断，必须在最终会被看到的尺寸上做。**
    litStroke(ctx, pts, 26, palette.stops[1], 0.045, 3);
    litStroke(ctx, pts, 4.5, palette.stops[1], 0.18, 2);
  }
  ctx.restore();

  // ── 两星的运动轨迹：这才是画面主体 ──
  //
  // 每颗星拖出自己的一段弧。**弧长相同、相位相对固定** ——
  // 但亮度沿弧不均：近点慢的地方曝光久 → 亮；远点快 → 暗。
  // 这个"密度不均"是双星轨道最容易被看出来、也最容易被忽略的特征。
  const drawStarTrack = (a, e, col, phase0, sweep, width, bright, ax) => {
    // ── 亮度沿弧变化，但**不能分段描边** ──
    //
    // 这里踩过一个不好发现的坑：第一版把弧切成十几段，每段单独调 alpha 描边。
    // `litStroke` 内部用 `lineCap: "round"`，于是**每一段的两端都留一个圆头**，
    // 而路径是 `lighter` 合成 —— 圆头叠加处比线身亮，整条轨迹上就出现一串等距亮点，
    // 看起来像虚线或刻度。
    //
    // 正确做法：把弧按"停留时间"拆成几层**连续的**折线，一层套一层地叠，
    // 每一层自己是一笔画完的。叠加产生亮度梯度，而层内没有任何接缝。
    //
    // 物理依据仍然是开普勒第二定律：越靠近伴星的点，角速度越快、曝光越短、越暗。
    // 远的点停留久，叠得层数多，自然更亮。
    const N = 150;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const nu = phase0 + (i / N) * sweep;
      pts.push([...onOrbit(a, e, nu, ax), nu]);
    }

    /** 该点的"停留时间"：轨道半径相对半长轴，值越大表示越远、停留越久 */
    const dwellAt = (nu) => {
      const rad = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
      return clamp(rad / (a * (1 + e)), 0, 2);
    };

    // 先铺一层最宽最淡的整体辉光（让人看出"这里有一条轨迹"）
    litStroke(ctx, pts.map((p) => [p[0], p[1]]), width * 2.6, col, bright * 0.14, 3);

    // 再按停留时间分 3 层叠亮：远的点会被叠到更多层
    const TIERS = [0.55, 1.0, 1.45]; // dwell 门槛，从高到低
    const TIER_ALPHA = [0.34, 0.34, 0.32];
    for (let ti = 0; ti < TIERS.length; ti++) {
      const min = TIERS[ti] * 0.5; // 换算成 0–1 的 dwell 区间
      const run = [];
      const runs = [];
      for (const p of pts) {
        if (dwellAt(p[2]) >= min) {
          run.push([p[0], p[1]]);
        } else if (run.length) {
          runs.push(run);
          run.length = 0;
        }
      }
      if (run.length) runs.push(run);
      for (const r of runs) {
        if (r.length < 2) continue;
        litStroke(ctx, r, width, col, bright * TIER_ALPHA[ti], 3);
      }
    }
    // 最亮的一根芯：只在停留最久的那一段
    {
      const run = [];
      const runs = [];
      for (const p of pts) {
        if (dwellAt(p[2]) >= 0.72) run.push([p[0], p[1]]);
        else if (run.length) { runs.push(run); run.length = 0; }
      }
      if (run.length) runs.push(run);
      for (const r of runs) {
        if (r.length < 2) continue;
        litStroke(ctx, r, width * 0.5, mix(col, [255, 255, 255], 0.55), bright * 0.42, 2);
      }
    }

    // 当前所在的位置：一颗实心的星
    const last = pts[pts.length - 1];
    return [last[0], last[1]];
  };

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // 两颗星的相位相差半周 —— 它们分居质心两侧，这是双星的标志。
  const ph1 = rng.range(0, TAU);
  const ph2 = ph1 + Math.PI + rng.range(-0.35, 0.35);
  const sweep = rng.range(1.9, 2.9);

  const P1 = drawStarTrack(r1, ecc1, mix(palette.glow, [255, 255, 255], 0.35), ph1, sweep, 1.7, 0.40, axis);
  const P2 = drawStarTrack(r2, ecc2, mix(palette.glow, palette.accent, 0.45), ph2, sweep, 1.3, 0.30, axis2);

  ctx.restore();

  // ── 两颗星本身 ──
  // 一冷一暖、一大一小：它们是两样不同的东西，不是同一个东西的两个副本。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [P, isMain] of [[P1, true], [P2, false]]) {
    const core = isMain
      ? mix(palette.glow, [255, 255, 255], 0.7)
      : mix(palette.glow, palette.accent, 0.35);
    const big = isMain ? 1.0 : 0.72;
    glow(ctx, P[0], P[1], w * 0.20 * big, palette.glow, 0.14);
    glow(ctx, P[0], P[1], w * 0.045 * big, core, 0.30);
    glow(ctx, P[0], P[1], w * 0.010 * big, core, 0.80);
  }
  ctx.restore();

  // ── 质心：**几乎什么都没有** ──
  // 这是这张卡最重要的一个克制。质心是空的 —— 那里没有天体，
  // 只有一个由两方质量共同定义出来的点。
  //
  // 第一版在这里放了一个亮点，结果整张图立刻变成"轴心"（星轨）那一张的意思。
  // 现在只留一点极其微弱的辉，能看出"这里有个位置"就够了。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, cx, cy, w * 0.055, palette.glow, 0.035);
  glow(ctx, cx, cy, w * 0.012, palette.glow, 0.055);
  ctx.restore();

  // ── 质心的标记：一圈极细的虚环 ──
  // 用"标记"而不是"发光体"来指出它的存在 ——
  // 标记是人画上去的，光是天体自己发的。这样读者不会把它误认成第三颗星。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const RING = w * 0.028;
  const DASH = 26;
  for (let i = 0; i < DASH; i++) {
    if (i % 2) continue;
    const a0 = (i / DASH) * TAU;
    const a1 = ((i + 1) / DASH) * TAU;
    ctx.strokeStyle = rgb(palette.glow, 0.20);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, RING, a0, a1);
    ctx.stroke();
  }
  ctx.restore();

  // ── 两星之间的引力连线 ──
  // 一条极淡的直线穿过质心，把两颗星连起来 ——
  // 这是"它们互相作用"最直接的表达，也顺便把质心的位置讲清楚（在连线中点附近）。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const linkPts = [];
  const LN = 40;
  for (let i = 0; i <= LN; i++) {
    const t = i / LN;
    const x = P1[0] + (P2[0] - P1[0]) * t;
    const y = P1[1] + (P2[1] - P1[1]) * t;
    linkPts.push([x, y]);
  }
  litStroke(ctx, linkPts, 1.6, palette.glow, 0.10, 2);
  litStroke(ctx, linkPts, 0.5, mix(palette.glow, [255, 255, 255], 0.4), 0.13, 1);
  ctx.restore();

  // ── 背景星场 ──
  // 双星在星空里。这一层给尺度感：那两条轨道是"很小的东西"。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 240; i++) {
    const sx = rng.next() * w;
    const sy = rng.next() * h;
    const mag = rng.power(3.4, 0, 1);
    // 轨道附近不画（那里该是干净的，否则轨迹读不出来）
    const dC = Math.hypot(sx - cx, sy - cy) / (w * 0.42);
    if (dC < 1 && rng.next() < 0.75) continue;
    ctx.fillStyle = rgb(mix(palette.glow, [255, 255, 255], 0.25), 0.05 + mag * 0.28);
    ctx.beginPath();
    ctx.arc(sx, sy, 0.28 + mag * 0.85, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  vignette(ctx, w, h, 0.50, 1.32);
  grain(ctx, w, h, rng, 0.044, 2);
}
