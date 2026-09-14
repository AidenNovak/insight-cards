export const meta = {
  id: "strata",
  zh: "沉积",
  en: "Strata",
  connects: "堆积",
  mood: "每一层都薄得不像话，但它们摞成了时间",
  note: "连接来自堆积：单看任何一层都只是薄薄一片，是层与层彼此的先后关系构成了纵深。",
};

/**
 * 沉积。
 *
 * ### 这个主题我改了三版，每一版都是同一个错误的不同形状
 *
 * **第一版：把"变化"当成了"差异"。**
 * 每层用 `ramp(stops, 噪声值)` 填色，相邻层的颜色几乎一样 ——
 * 出来的是**等高线图**，不是岩层。岩层要的是**离散的、突变的差异**：
 * 每一层是**另一种材料**（砂岩亮、页岩暗），不是同一个颜色渐变过去。
 *
 * **第二版：把石头画成了影子。**
 * 岩性亮度定得太低（页岩 0.06），在近黑底上等于不存在，整张图只剩几道孤零零的线。
 * 岩层是**被光照着的石头**，不是暗处的剪影 —— 先让它有颜色，再让光决定哪里沉进暗处。
 *
 * **第三版：把"局部截断"当成了"全局抹除"。**
 * 让截断高度取所有侵蚀面里最低的那个，于是只要有一道面落在画面中段，
 * 它**上面**的所有层都被判为"已侵蚀"而跳过 —— 上半张图整片空掉。
 * 一道侵蚀面的意思是"它**下面**的老层在这里被削断了"，不是"从这里往上什么都没有"。
 *
 * ### 所以最终的结构是「块」，不是「一叠层」
 *
 * 侵蚀面把整个剖面切成若干**块**。每块内部：
 *   - 层与层**共用同一套倾斜与起伏**（整合接触）—— 它们是一起被推斜的；
 *   - 块与块之间的倾斜和起伏**互不相同**，而且越老（越靠下）变形越强。
 *
 * 不整合面之所以一眼能看出来，靠的不是那条线，而是**线的两侧走向不一致**：
 * 下面的层被斜着削断，上面的层平平地盖上去。那条线只是这个事实的边界。
 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  // 光源在右上、低角度。全图唯一的方位约定。
  const lx = rng.range(0.70, 1.02) * w;
  const ly = rng.range(-0.04, 0.10) * h;

  // ── 五种岩性 ──
  // 亮度是**离散档位**，不是连续值。冷暖各有倾向：砂岩偏黄（铁质氧化）、
  // 页岩偏冷（有机质多）、灰岩中性。权重不等于均匀 —— 真实地层以某几种为主。
  //
  // **亮度整体压低过一轮。** 第一版给到 0.17–0.94，出来整张图平均亮度 58，
  // 而这一组深色卡片其它主题都在 20 上下 —— strata 像一张贴在暗色专辑里的彩页。
  // 岩层是被光照着的石头没错，但**夜里被灯扫到的岩壁也仍然是夜**：
  // 亮部只该出现在被掠射光扫到的那一层，其余部分要沉下去。
  // 亮度再压过一轮。
  //
  // **关于"暗部占比"这个指标的一点说明**：它假设画面大部分应该是近黑的，
  // 这对星野、萤火那种"暗底上几个亮点"的主题成立，但**对沉积不完全成立** ——
  // 这是一张"整幅都是被照到的岩石"的图，它的主体本来就该占满画面。
  // 我不打算为了一个指标把它强行压黑（那会让它变成一张看不见的图）。
  //
  // 但 16% 也确实离这一组太远了（其余主题都在 85% 以上），
  // 所以这里把岩性整体再压一档，让它靠近这一组的语气。
  // 剩下的差异是**题材本身的差异**，不是错误。
  const MATERIALS = [
    { key: "shale", tone: 0.04, warm: -0.30, weight: 0.28, alpha: 0.95 },
    { key: "mud",   tone: 0.10, warm: -0.12, weight: 0.25, alpha: 0.95 },
    { key: "lime",  tone: 0.18, warm: 0.00,  weight: 0.21, alpha: 0.94 },
    { key: "sand",  tone: 0.31, warm: 0.22,  weight: 0.18, alpha: 0.93 },
    { key: "iron",  tone: 0.46, warm: 0.40,  weight: 0.08, alpha: 0.92 },
  ];
  const TOTAL_W = MATERIALS.reduce((s, m) => s + m.weight, 0);
  const pickMaterial = () => {
    let r = rng.next() * TOTAL_W;
    for (const m of MATERIALS) {
      r -= m.weight;
      if (r <= 0) return m;
    }
    return MATERIALS[0];
  };
  /** 岩性 → 实际颜色：tone 定亮度，warm 决定往配色的哪一端偏 */
  const matColor = (m) => {
    const base = ramp(palette.stops, m.tone);
    if (Math.abs(m.warm) < 0.01) return base;
    const target = m.warm > 0
      ? mix(palette.glow, [255, 232, 198], 0.5)
      : mix(palette.glow, [198, 214, 240], 0.5);
    return mix(base, target, Math.abs(m.warm) * 0.55);
  };

  // ── 侵蚀面：把剖面切成块 ──
  const NUNC = rng.int(2, 4);
  const levels = [];
  for (let i = 0; i < NUNC; i++) levels.push(rng.range(0.20, 0.82) * h);
  levels.sort((a, b) => a - b);

  const uncs = levels.map((yv) => ({
    y: yv,
    slope: rng.range(-0.14, 0.14),
    bend: rng.range(0, TAU),
    amp: rng.range(3, 14),
    wave: rng.range(0.5, 1.3),
  }));

  const NX = 96; // 采样密度：所有边界共用
  /** 某道侵蚀面在 x 处的高度 */
  const surfY = (u, x) =>
    u.y
    + Math.sin((x / w) * TAU * u.wave + u.bend) * u.amp
    + u.slope * (x - w / 2)
    + rng.warp(x / w * 9 + u.bend * 2, 3.3, 1.5, 4) * h * 0.009;

  /** 采样成点列，避免同一个边界被反复计算 */
  const sampleSurface = (u) => {
    const pts = [];
    for (let i = 0; i <= NX; i++) {
      const x = (i / NX) * w;
      pts.push({ x, y: surfY(u, x) });
    }
    return pts;
  };
  for (const u of uncs) u.pts = sampleSurface(u);

  // ── 切块 ──
  // 每块有自己的倾斜与起伏，这是不整合面能被看出来的真正原因。
  // 越靠下（越老）变形越强：老的岩层经历过更多次构造运动。
  const bounds = [-0.10 * h, ...levels, 1.10 * h];
  const blocks = [];
  for (let b = 0; b < bounds.length - 1; b++) {
    const depth = b / Math.max(1, bounds.length - 2); // 0 = 最新
    blocks.push({
      top: bounds[b],
      bot: bounds[b + 1],
      // 倾斜：越深越陡，方向在块之间变化（不整合面的成因就是两次变形方向不同）
      dip: rng.range(-1, 1) * (0.008 + depth * 0.055),
      bend: rng.range(0, TAU),
      // 块级的褶皱：**低频、一个宽弧**，不是每层各自扭。
      // 之前 bendWave 开到 1.9、幅度开到 0.020h，每条层都自己扭两三下，
      // 结果岩层看起来像**飘动的绸带**而不是石头。岩石的变形是大尺度的：
      // 整个块一起被推成一个缓弧，单层几乎没有自己的摆动。
      bendAmp: rng.range(0.003, 0.011) * h * (1 + depth * 0.5),
      bendWave: rng.range(0.35, 0.85),
      // 这一块顶部是否有侵蚀面（第一块没有）
      topUnc: b === 0 ? null : uncs[b - 1],
      layers: [],
    });
  }

  // ── 逐块生成层序 ──
  // 块内的层**共用**本块的倾斜与起伏（整合接触），只加一点点各自的抖动。
  // 第一版让每层各有自己的弯曲相位，结果层与层不平行，看起来像一堆飘带。
  for (const B of blocks) {
    let y = B.top;
    while (y < B.bot + 0.04 * h) {
      const u = rng.next();
      const thick = u > 0.86
        ? rng.range(0.050, 0.100) * h    // 厚层（一个"纪"）
        : u > 0.42
          ? rng.range(0.014, 0.038) * h  // 中层
          : rng.range(0.0035, 0.014) * h; // 薄层 / 纹层
      B.layers.push({
        band: y,
        thick,
        mat: pickMaterial(),
        // 层自身的小幅摆动（叠在本块的共用起伏上）
        jitter: rng.range(0.6, 1.4),
        lamina: rng.int(3, 11),
      });
      y += thick;
    }
  }

  /**
   * 一层在某 x 处的上边界。
   * 幅度与层厚挂钩：薄层接近平直，厚层才明显弯曲 ——
   * 既符合厚层更易变形的实际，也避免薄层被弯成一条纯粹的波浪线。
   */
  const edgeY = (B, L, x) => {
    // 幅度受层厚严格限制：薄层几乎只能是直线。
    // 这一条是"绸带感"的主要来源 —— 薄层被弯成波浪线时，它就不再像岩层了。
    const amp = Math.min(B.bendAmp * L.jitter, L.thick * 0.42);
    return L.band
      + B.dip * (x - w / 2)
      + Math.sin((x / w) * TAU * B.bendWave + B.bend) * amp
      // 高频抖动：沉积面不是光滑曲线。**幅度比第一版大**——
      // 太小时边缘仍然是光的，石头看起来像拉丝金属。
      // 真实层理面上到处是几毫米级的凹凸（冲刷痕、虫迹、负载构造）。
      + rng.warp(x / w * 5.5 + B.bend + L.band / h, L.band / h * 9, 1.2, 3) * h * 0.0060
      + rng.warp(x / w * 22 + B.bend * 3, L.band / h * 26, 1.4, 3) * h * 0.0018;
  };

  // 每层的边界点**预先算一次**，后面裁剪、填充、纹层、受光都复用。
  // 反复现算不仅慢，还会让 rng 的调用次序随分支变化，容易出现"改了别处这里也变"。
  for (const B of blocks) {
    for (const L of B.layers) {
      L.edge = [];
      for (let i = 0; i <= NX; i++) {
        const x = (i / NX) * w;
        L.edge.push({ x, y: edgeY(B, L, x) });
      }
    }
  }

  // ── 逐层绘制 ──
  for (const B of blocks) {
    for (const L of B.layers) {
      const col = matColor(L.mat);

      ctx.save();
      // 裁剪一：层体本身（上边界与下边界之间）
      ctx.beginPath();
      ctx.moveTo(L.edge[0].x, L.edge[0].y);
      for (const p of L.edge) ctx.lineTo(p.x, p.y);
      for (let i = NX; i >= 0; i--) {
        const x = L.edge[i].x;
        ctx.lineTo(x, edgeY(B, L, x) + L.thick);
      }
      ctx.closePath();
      ctx.clip();

      // 裁剪二：被本块顶部的侵蚀面削掉的部分。
      // **只有本块受它自己顶部那道面的约束** —— 这就是"局部截断"。
      if (B.topUnc) {
        ctx.beginPath();
        ctx.moveTo(0, h * 1.5);
        for (const p of B.topUnc.pts) ctx.lineTo(p.x, p.y);
        ctx.lineTo(w, h * 1.5);
        ctx.closePath();
        ctx.clip();
      }

      // 1) 基层：接近不透明，层要真的遮住下面的层
      ctx.fillStyle = rgb(col, L.mat.alpha);
      ctx.fillRect(0, L.band - Math.abs(B.dip) * w * 0.6 - B.bendAmp * 2 - h * 0.05,
        w, L.thick + Math.abs(B.dip) * w * 1.2 + B.bendAmp * 4 + h * 0.10);

      // 2) 层内的水平纹层：细密、极低对比。页岩/砂岩的质感来源。
      if (L.thick > h * 0.012) {
        for (let k = 1; k < L.lamina; k++) {
          const t = k / L.lamina;
          const a = 0.035 + rng.next() * 0.075;
          // 一半纹层偏亮（粗颗粒），一半偏暗（细颗粒）
          const bright = rng.next() > 0.45;
          ctx.strokeStyle = bright ? rgb(col, a) : rgb(palette.base, a * 0.9);
          ctx.lineWidth = rng.range(0.5, 1.5);
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const x = (i / 40) * w;
            const yy = edgeY(B, L, x) + L.thick * t
              + rng.warp(x / w * 8 + k, L.band / h * 7, 1.1, 2) * h * 0.0032;
            i === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
      }

      // 2b) 层内的斑驳：**石头不是一个平滑的色块。**
      // 没有这一层，整张图会有一种"拉丝金属/丝带"的光滑感 —— 我做出来就是这样。
      // 岩石断面上到处是不规则的暗斑与亮斑（矿物颗粒、风化、后期填充）。
      // 用一批扁平的椭圆斑点铺在层内，亚像素级、极低对比，但足以把"光滑"打碎。
      {
        // 斑点是**打碎光滑感**用的，不是加亮用的。
        // 第一版亮斑给到 0.13 的 alpha 且数量偏多，整张图的暗部占比从 45% 掉到 12%
        // （体检能看出来：其余主题都在 85% 以上）。这里把亮斑压到近一半。
        const spots = Math.round((L.thick / h) * 700) + 5;
        for (let s = 0; s < spots; s++) {
          const x = rng.next() * w;
          const yy = edgeY(B, L, x) + rng.next() * L.thick;
          // 斑点横向拉长（沉积颗粒是沿层理方向排列的）
          const rx = rng.range(2, 15) * (0.6 + L.thick / h * 11);
          const ry = rx * rng.range(0.10, 0.42);
          const dark = rng.next() > 0.34;
          const a = rng.range(0.025, 0.095);
          ctx.fillStyle = dark
            ? rgb(palette.base, a * 1.4)
            : rgb(mix(col, [255, 255, 255], 0.4), a * 0.42);
          ctx.beginPath();
          ctx.ellipse(x, yy, rx, ry, rng.range(-0.12, 0.12), 0, TAU);
          ctx.fill();
        }
      }

      // 3) 层内右侧受光：低角度光从右上来
      if (L.thick > h * 0.010) {
        const g = ctx.createLinearGradient(w * 0.28, 0, w, 0);
        g.addColorStop(0, rgb(col, 0));
        g.addColorStop(1, rgb(mix(col, [255, 255, 255], 0.30), 0.15));
        ctx.fillStyle = g;
        ctx.fillRect(0, L.band - h * 0.04, w, L.thick + h * 0.08);
      }
      ctx.restore();
    }
  }

  // ── 层缘受光：只给中厚层，且明显克制 ──
  // 第一版给几乎每层都描亮线，满屏是线，像等高线。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const B of blocks) {
    for (const L of B.layers) {
      if (L.thick < h * 0.013) continue;   // 薄层不给光
      if (L.mat.key === "shale") continue; // 页岩是暗的，它不该反光

      // 沿层缘走，遇到块顶的侵蚀面就停 —— 被削掉的那一段不该有受光的边缘
      const pts = [];
      for (const p of L.edge) {
        if (B.topUnc) {
          const ceil = B.topUnc.pts[Math.min(NX, Math.round((p.x / w) * NX))].y;
          if (p.y < ceil) continue;
        }
        pts.push([p.x, p.y]);
      }
      if (pts.length < 4) continue;
      const a = 0.05 + L.mat.tone * 0.22;
      litStroke(ctx, pts, 0.65, ramp(palette.stops, 0.55 + L.mat.tone * 0.45), a, 3);
    }
  }
  ctx.restore();

  // ── 不整合面：全图最锋利的东西 ──
  // 时间被撕开的地方，必须比任何层缘都清楚、都硬。
  // 用实色描边（source-over），因为它是断口，不是光。
  ctx.save();
  for (const u of uncs) {
    const pts = u.pts.map((p) => [p.x, p.y]);
    // 断口本身：一条深色带（凹进去的阴影）
    ctx.strokeStyle = rgb(palette.base, 0.90);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, yy] of pts) ctx.lineTo(x, yy);
    ctx.stroke();
    // 断口上缘被光擦到的细亮线
    ctx.strokeStyle = rgb(ramp(palette.stops, 0.80), 0.30);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1] - 1.6);
    for (const [x, yy] of pts) ctx.lineTo(x, yy - 1.6);
    ctx.stroke();
  }
  ctx.restore();

  // ── 纵向裂隙 ──
  // 横向的东西画多了像条形码。纵横交错的裂纹才是岩石。
  ctx.save();
  const NF = rng.int(3, 6);
  for (let f = 0; f < NF; f++) {
    const fx = rng.range(0.06, 0.94) * w;
    const fTop = rng.range(0, 0.45) * h;
    const fBot = fTop + rng.range(0.25, 0.62) * h;
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const yy = fTop + (fBot - fTop) * t;
      // 裂隙沿走向左右摆动，不是一条直线
      const xx = fx + rng.warp(t * 3.4 + f * 7, 1.7, 1.3, 3) * w * 0.020;
      pts.push([xx, yy]);
    }
    // 缝里的阴影
    ctx.strokeStyle = rgb(palette.base, 0.74);
    ctx.lineWidth = rng.range(1.2, 2.6);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, yy] of pts) ctx.lineTo(x, yy);
    ctx.stroke();
    // 缝隙右侧被光照到的唇缘
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgb(ramp(palette.stops, 0.72), 0.17);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + 1.2, pts[0][1]);
    for (const [x, yy] of pts) ctx.lineTo(x + 1.2, yy);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();

  // ── 主光：某一段地层被照亮 ──
  // 没有它整张图均匀得像一张壁纸。它同时给了"沉积"一个意思：**某一段时间是被照亮的。**
  // 限定在中段：第一版从所有厚层里挑最亮的，常挑到最顶上那层，亮带压在画框边缘，
  // 看起来像裁切错误而不是光照。
  let hero = null;
  for (const B of blocks) {
    for (const L of B.layers) {
      const mid = L.band + L.thick / 2;
      if (L.thick < h * 0.018) continue;
      if (mid < h * 0.20 || mid > h * 0.78) continue;
      if (!hero || L.mat.tone > hero.L.mat.tone) hero = { B, L };
    }
  }
  if (hero) {
    const { B, L } = hero;
    const hx = rng.range(0.24, 0.70) * w;
    const hy = L.band + L.thick / 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, hx, hy, w * 0.40, palette.glow, 0.16);
    glow(ctx, hx, hy, w * 0.15, mix(palette.glow, [255, 255, 255], 0.35), 0.22);
    // 沿层走的一条亮带 —— 被照亮的是一整段地层，不是一个地方
    const pts = [];
    for (let i = 0; i <= 44; i++) {
      const x = w * (0.08 + (i / 44) * 0.84);
      pts.push([x, edgeY(B, L, x)]);
    }
    litStroke(ctx, pts, 2.0, ramp(palette.stops, 0.86), 0.38, 3);
    litStroke(ctx, pts, 0.85, mix(palette.glow, [255, 255, 255], 0.55), 0.50, 1);
    ctx.restore();
  }

  // ── 统一到同一光源下的斜向明暗 ──
  // 只压暗左下；右上的提亮交给下面的掠射光。
  // 用"压暗"去实现"亮"会把整张图压死 —— 第二版就是这么变黑的。
  ctx.save();
  const shade = ctx.createLinearGradient(lx, ly, w * 0.08, h * 1.02);
  shade.addColorStop(0, rgb(palette.base, 0));
  shade.addColorStop(0.34, rgb(palette.base, 0.38));
  shade.addColorStop(1, rgb(palette.base, 0.90));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // ── 掠射光：整面岩壁被右上方的低角度光扫过 ──
  // 让岩层读成**石头**而不是"印花的纸"的那一层。
  // 强度压低过：它负责"被光照到"，不负责"整体提亮"。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rake = ctx.createLinearGradient(w * 1.05, -h * 0.10, w * 0.10, h * 0.95);
  rake.addColorStop(0, rgb(mix(palette.glow, [255, 246, 228], 0.35), 0.11));
  rake.addColorStop(0.28, rgb(palette.glow, 0.055));
  rake.addColorStop(0.60, rgb(palette.glow, 0.015));
  rake.addColorStop(1, rgb(palette.glow, 0));
  ctx.fillStyle = rake;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 顶与底的暗化：进入和离开这段地质
  ctx.save();
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.13);
  top.addColorStop(0, rgb(palette.base, 0.72));
  top.addColorStop(1, rgb(palette.base, 0));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h * 0.13);
  const bot = ctx.createLinearGradient(0, h * 0.87, 0, h);
  bot.addColorStop(0, rgb(palette.base, 0));
  bot.addColorStop(1, rgb(palette.base, 0.84));
  ctx.fillStyle = bot;
  ctx.fillRect(0, h * 0.87, w, h * 0.13);
  ctx.restore();

  vignette(ctx, w, h, 0.40, 1.32);
  grain(ctx, w, h, rng, 0.048, 2);
}
