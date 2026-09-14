export const meta = {
  id: "lattice",
  zh: "晶格",
  en: "Lattice",
  connects: "结晶",
  mood: "散乱的原料，在某个瞬间开始有秩序",
  note: "连接来自结晶：同样的原子，散着的时候是流体，排列起来之后就是晶体——变的不是成分，是它们彼此的相对位置。",
};

/**
 * 晶格。
 *
 * ### 机制上和「引力」（星云）的分界
 *
 * 星云是**聚起来**：物质被吸到一处，越聚越密。那是量的变化。
 * 晶格是**排起来**：原子数量一个没变，只是开始按固定的相对位置落座。这是**序**的变化。
 *
 * 所以这一张的主角不是"越亮越密"，而是**两种状态同时在场**：
 * 已经排好的、和还没排好的，而且是同一种东西。
 *
 * ### 我在这里错了两次，第二次才找对方向
 *
 *   1. **晶核在正中、晶面段数太少** → 结晶区成了一个整齐的多边形团块，像一块石头标本。
 *   2. **把晶格做成一整片同取向的点阵** → 看起来是**坐标纸 / 屏幕像素**，
 *      完全不像物质。这一版最刺眼的教训。
 *
 * 第 2 个错误的根源是：**真实的多晶体不是一整块对齐的格子，是许多"晶粒"拼起来的。**
 * 每一粒内部取向一致，粒与粒之间取向不同，交界处形成**晶界**。
 * 晶界正是"秩序"这件事在画面上的可见证据 —— 没有它，点阵就只是一种纹理。
 *
 * ### 这一版
 *
 *   - 从 2–4 个晶核各自生长，**每个晶粒有自己的转角**。
 *   - 晶粒大小刻意不同（有的吃掉了邻居），交界处自然形成参差的晶界。
 *   - 熔体（没结晶的部分）明确可见：同样的密度、同样的亮度量级，只是没有秩序。
 *   - 晶界是主光：那里是两种取向碰撞的地方，也是"正在发生"的地方。
 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  const DIAG = Math.hypot(w, h);
  // 点阵间距：整张图最重要的一个数——太大只剩几个点，太小糊成一片网。
  // 相对画幅偏小，让**晶粒**成为主角而不是单个原子。
  const A = w * rng.range(0.026, 0.034);
  const BOND_TOL = A * 1.16;

  // ── 晶粒：2–4 个晶核，各自生长 ──
  // 晶核基本都贴在画面边缘（结晶从容器壁开始），这是物理事实，
  // 也让构图有明确方向。每个晶粒有自己的转角——这是"多晶"的关键。
  const NG = rng.int(2, 4);
  const grains = [];
  for (let g = 0; g < NG; g++) {
    const side = g % 4;
    const gx = side === 0 ? rng.range(-0.05, 0.08) : side === 1 ? rng.range(0.92, 1.05)
      : side === 2 ? rng.range(0.1, 0.9) : rng.range(0.1, 0.9);
    const gy = side === 0 ? rng.range(0.1, 0.9) : side === 1 ? rng.range(0.1, 0.9)
      : side === 2 ? rng.range(-0.05, 0.08) : rng.range(0.92, 1.05);

    // 生长范围：**要够大**，晶粒得真的占住画面、并且彼此相接 ——
    // 晶界正是它们相撞的地方，晶粒太小就不会碰面，多晶的效果也就不存在。
    // 上一版给 0.16–0.34，结果晶体缩在两个角落里，中间一片空。
    const reach = DIAG * rng.range(0.30, 0.46);

    // 每个晶粒的转角不同 —— 这是"多晶"的视觉核心。
    const theta = rng.range(0, TAU);

    // 生长半径：**直的晶面**。
    //
    // 这里踩过一次：用噪声做边界，出来的是一圈**波浪线**，
    // 看起来像划痕或等高线，完全不像晶体。
    // 真实晶体的外缘是**平的**——那是原子按晶格一层层堆上去的结果。
    // 所以边界要用少数几段直线拼成多边形（那些平面就是"晶面"）。
    const NF = rng.int(5, 9);
    const facets = [];
    for (let i = 0; i < NF; i++) {
      facets.push({
        a0: (i / NF) * TAU,
        a1: ((i + 1) / NF) * TAU,
        // 各晶面推进的快慢不同：有的面长出去了，有的还没
        r: reach * rng.range(0.62, 1.18),
      });
    }
    grains.push({
      x: gx * w,
      y: gy * h,
      theta,
      cosT: Math.cos(theta),
      sinT: Math.sin(theta),
      reach,
      // 位错：晶格并非完美，整体有一点点漂移
      strain: rng.range(-0.012, 0.012),
      facets,
      // 段内取常数 ⇒ 一圈折线 ⇒ 直的晶面
      growth: (a) => {
        const t = ((a % TAU) + TAU) % TAU;
        for (const f of facets) if (t >= f.a0 && t < f.a1) return f.r;
        return facets[0].r;
      },
    });
  }

  // 六方（三角阵）或斜方
  const HEX = rng.next() < 0.5;
  const basis = HEX ? [[1, 0], [0.5, Math.sqrt(3) / 2]] : [[1, 0], [0, 1]];

  // ── 生成原子 ──
  // 每个原子按**最近晶核**决定自己属于哪一粒；不在任何一粒范围内的就是熔体。
  const atoms = [];
  const RANGE = Math.ceil((DIAG / A) * 1.05) + 3;

  for (const G of grains) {
    for (let i = -RANGE; i <= RANGE; i++) {
      for (let j = -RANGE; j <= RANGE; j++) {
        const gx = i * basis[0][0] + j * basis[1][0];
        const gy = i * basis[0][1] + j * basis[1][1];
        // 用**本粒的转角**旋转 —— 粒与粒取向不同，这就是多晶
        const px = G.x + (gx * G.cosT - gy * G.sinT) * A;
        const py = G.y + (gx * G.sinT + gy * G.cosT) * A;
        if (px < -A * 1.5 || px > w + A * 1.5 || py < -A * 1.5 || py > h + A * 1.5) continue;

        const dist = Math.hypot(px - G.x, py - G.y);
        const ang = Math.atan2(py - G.y, px - G.x);
        const R = G.growth(ang);

        // 边界打毛：晶面是平的，但堆上去的最后几层原子不可能整齐，
        // 所以给一点点抖动（比上一版小得多，保住"直"这个特征）
        const jitter = rng.fbm(px / w * 7.5, py / h * 7.5, 3) * A * 1.5;
        if (dist + jitter >= R) continue;

        // **竞争**：如果这个点离另一个晶核更近，就归那一粒（先到先得）。
        // 这一步产生了晶界 —— 两粒相撞的地方。
        let owner = 0;
        let bestD = Infinity;
        for (let gi = 0; gi < grains.length; gi++) {
          const d = Math.hypot(px - grains[gi].x, py - grains[gi].y);
          // 用"归一化距离"比较：reach 大的晶粒更有竞争力（它长得快）
          const norm = d / (grains[gi].reach + 1);
          if (norm < bestD) { bestD = norm; owner = gi; }
        }
        if (owner !== grains.indexOf(G)) continue;

        atoms.push({
          x: px, y: py, px, py,
          grain: G,
          // 位错：把原子从理想格点推开一点
          dx: px + (py - G.y) * G.strain,
          dist,
        });
      }
    }
  }

  // ── 熔体：没被任何晶粒吃掉的区域 ──
  // **必须看得见。** 第一版把这一层压到几乎为零，画面只剩孤立的晶块，
  // "从无序中长出秩序"完全没了对照。它是配角，但不能不存在。
  // 做法：在整幅范围撒同样的密度，跳过已经结晶的位置。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const isCrystal = (x, y) => {
    for (const a of atoms) {
      if (Math.abs(a.x - x) < A * 0.42 && Math.abs(a.y - y) < A * 0.42) return true;
    }
    return false;
  };
  const MELT_N = Math.round((w * h) / (A * A) * 1.15);
  let placed = 0;
  for (let k = 0; k < MELT_N; k++) {
    const x = rng.next() * w;
    const y = rng.next() * h;
    if (isCrystal(x, y)) continue;
    // 未结晶的原子被热运动推得更远
    const jx = x + rng.gauss() * A * 0.42;
    const jy = y + rng.gauss() * A * 0.42;
    // 熔体要**明确看得见**：同样的量级，只是没有秩序。
    //
    // 这里也踩过一次：用 `${'$'}{stops[1]}`（深色）配 0.1 的 alpha。
    // `lighter` 合成是**把颜色按 alpha 加上去**，深色乘以小 alpha 几乎等于零 ——
    // 在近黑底上肉眼完全看不见，我却以为"已经画了"。
    // 要让它可见，颜色至少取到 stops[2]，alpha 也要够。
    ctx.fillStyle = rgb(palette.stops[2], rng.range(0.16, 0.40));
    ctx.beginPath();
    ctx.arc(jx, jy, w * 0.0020, 0, TAU);
    ctx.fill();
    placed++;
  }
  void placed;
  ctx.restore();

  // ── 键：晶格真正的骨架 ──
  // 只在**同一晶粒内**、距离接近键长的两个原子之间连。
  // 这一步是"连成一体"和"一堆点"的分界，不能省。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const CELL = BOND_TOL;
  const grid = new Map();
  const key = (i, j) => i * 100003 + j;
  for (const a of atoms) {
    const ci = Math.floor(a.x / CELL), cj = Math.floor(a.y / CELL);
    const k = key(ci, cj);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(a);
  }

  const drawn = new Set();
  for (const a of atoms) {
    const ci = Math.floor(a.x / CELL), cj = Math.floor(a.y / CELL);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const bucket = grid.get(key(ci + di, cj + dj));
        if (!bucket) continue;
        for (const b of bucket) {
          if (b === a) continue;
          // 只连同粒的原子：跨界连出来的键会破坏晶界
          if (b.grain !== a.grain) continue;
          if (Math.hypot(a.x - b.x, a.y - b.y) > BOND_TOL) continue;
          const id = a.px < b.px || (a.px === b.px && a.py < b.py)
            ? `${a.px.toFixed(1)},${a.py.toFixed(1)}|${b.px.toFixed(1)},${b.py.toFixed(1)}`
            : `${b.px.toFixed(1)},${b.py.toFixed(1)}|${a.px.toFixed(1)},${a.py.toFixed(1)}`;
          if (drawn.has(id)) continue;
          drawn.add(id);

          // 越靠近晶粒外缘的键越弱——那些还在形成
          const fall = clamp(1 - Math.max(a.dist, b.dist) / (a.grain.reach * 1.05));
          if (fall < 0.30 && rng.next() < 0.40) continue; // 断续
          ctx.strokeStyle = rgb(palette.stops[2], 0.10 + fall * 0.34);
          ctx.lineWidth = 0.6 + fall * 0.85;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
  }
  ctx.restore();

  // ── 原子 ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const a of atoms) {
    const fall = clamp(1 - a.dist / (a.grain.reach * 1.05));
    ctx.fillStyle = rgb(mix(palette.stops[2], palette.glow, fall), 0.16 + fall * 0.55);
    ctx.beginPath();
    ctx.arc(a.x, a.y, w * 0.0022 + fall * w * 0.0018, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // ── 晶界：主光，但**不画成线** ──
  //
  // 第一版把晶界描成了一条发光的曲线，结果看起来像划痕 ——
  // 因为我在"画一条线"，而晶界根本不是线：它是两个晶粒**相接的那一片区域**。
  //
  // 真实晶界的样子是：两边的点阵各自延续，中间对不上，于是出现一道
  // **相对暗的缝**，而缝的两侧各有微光（两侧的原子都还没完全落位）。
  // 所以这里只沿交界处铺一层柔和的辉光，不描边。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // 在两个晶核的连线上找中点附近，铺一段拉长的辉光
  for (let i = 0; i < grains.length; i++) {
    for (let j = i + 1; j < grains.length; j++) {
      const Gi = grains[i], Gj = grains[j];
      // 取两核之间的若干点，靠近"势力范围相等"的位置才是真正的晶界
      for (let k = 1; k < 12; k++) {
        const t = k / 12;
        const x = Gi.x + (Gj.x - Gi.x) * t;
        const y = Gi.y + (Gj.y - Gi.y) * t;
        if (x < 0 || x > w || y < 0 || y > h) continue;
        // 只在真正靠近交界的地方点亮
        const dGap = Math.abs(Math.hypot(x - Gi.x, y - Gi.y) - Math.hypot(x - Gj.x, y - Gj.y));
        if (dGap > (Gi.reach + Gj.reach) * 0.16) continue;
        glow(ctx, x, y, w * 0.085, palette.glow, 0.05);
        glow(ctx, x, y, w * 0.022, mix(palette.glow, [255, 255, 255], 0.2), 0.10);
      }
    }
  }
  ctx.restore();

  // ── 晶核：每个晶粒最先排好的那一小片 ──
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const G of grains) {
    glow(ctx, G.x, G.y, w * 0.13, palette.glow, 0.12);
    glow(ctx, G.x, G.y, w * 0.030, mix(palette.glow, [255, 255, 255], 0.35), 0.26);
    glow(ctx, G.x, G.y, w * 0.007, mix(palette.glow, [255, 255, 255], 0.8), 0.62);
  }
  ctx.restore();

  // ── 熔体的"热" ──
  // 没有结晶的地方更接近流动状态，给一层极淡的暖底，
  // 让画面有从冷硬到流动的温度过渡。它也是熔体"看得见"的一部分。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const heat = ctx.createRadialGradient(w * 0.5, h * 0.5, DIAG * 0.30, w * 0.5, h * 0.5, DIAG * 0.80);
  heat.addColorStop(0, rgb(palette.accent, 0));
  heat.addColorStop(1, rgb(palette.accent, 0.055));
  ctx.fillStyle = heat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  vignette(ctx, w, h, 0.50, 1.30);
  grain(ctx, w, h, rng, 0.042, 2);
}
