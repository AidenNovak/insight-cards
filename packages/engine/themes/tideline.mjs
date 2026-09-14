export const meta = {
  id: "tideline",
  zh: "潮痕",
  en: "Tideline",
  connects: "累积",
  mood: "每一条痕都很浅，但它们记着每一次来过",
  note: "连接来自累积：单次留下的痕迹浅到可以忽略，可它一次次叠在同一处，最后成了这条线。",
};

/**
 * 潮痕。
 *
 * ### 和「堆积」（沉积）的分界
 *
 *   沉积（strata）：**水平**的层理，一层盖一层。讲的是**时间** ——
 *                   每一层是某一段时间里落下的东西。
 *   潮痕（tideline）：**同一条线**被反复冲刷。讲的是**次数** ——
 *                   每次都很浅，是"来了很多次"把它刻出来的。
 *
 * ### 这个主题我重做了两版，都是被同一个联想带偏的
 *
 * 前两版都在主痕上挂一排垂直刻痕，结果都读成**音频波形**。
 *   ① 等距垂直短线 → 波形。
 *   ② 数量减少、长短拉开 → 还是波形（只是变成毛边）。
 *
 * 根本原因：**"一条线上挂一排竖线"这个图形本身就是波形的定义式。**
 * 换参数没用 —— 那只是换了个更像波形的波形。必须换图形。
 *
 * ### 真正的潮痕长什么样
 *
 * 是**扇贝形的弧**（scallop）：水退时，水边缘在沙上留下一串半圆形的浅湾，
 * 湾口朝向水退去的方向，一层压一层。这是潮痕在现实中最强的视觉签名，
 * 而我前两版完全没想到它 —— 只顾着"画一条线然后往上加东西"。
 *
 * 这一版就画扇贝弧：一串相互重叠的弧形，大小不等、深浅不一，
 * 越旧的越往上、越淡（会被后面的冲刷磨掉）。
 *
 * ### 一处被试用者提出的复查，我看了，保留
 *
 * THEME-SPEC §6.2 警告"一串半圆鼓包 → 云朵"，而这里确实是一串鼓包。
 * 我按原尺寸和裁切图各看了一遍：它靠**扁、浅、密**，以及上下多道重影，
 * 读出来是"被水反复啃过的岸"而不是云。所以保留。
 *
 * 但这是**有意的边界情况**，不是没想到 —— 后来改这个主题的人应当知道，
 * 这里离"云朵"这个错误联想只有一步：**一旦把鼓包做得更高更圆、
 * 或让它们稀疏到能一个个数出来，就会立刻翻过去。**
 */
export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);

  // 水在画面下半。上半是已经干了的岸（旧痕所在）。
  const waterY = rng.range(0.52, 0.62) * h;
  // 掠光从一侧来，把弧的内壁照亮
  const FROM_LEFT = rng.next() < 0.5;

  // ── 岸线的整体走向 ──
  // **必须平滑。** 第一版这里用了 fbm 加高频抖动，主痕本身就是一条扭动的曲线 ——
  // 那已经先一步把画面带进了"波形"。岸是一条缓慢的弧，细节全部交给扇贝弧去承担。
  const swim = rng.range(0.35, 0.65);
  const phase = rng.range(0, TAU);
  const amp = h * rng.range(0.018, 0.034);
  const shoreY = (x) => waterY + Math.sin((x / w) * TAU * swim + phase) * amp;

  // ── 水 ──
  ctx.save();
  const wet = ctx.createLinearGradient(0, waterY - h * 0.04, 0, h);
  wet.addColorStop(0, rgb(ramp(palette.stops, 0.16), 0.42));
  wet.addColorStop(0.35, rgb(ramp(palette.stops, 0.18), 0.40));
  wet.addColorStop(1, rgb(ramp(palette.stops, 0.05), 0.50));
  ctx.fillStyle = wet;
  ctx.fillRect(0, waterY - h * 0.04, w, h - waterY + h * 0.04);
  ctx.restore();

  /**
   * 一条**扇贝形的岸线**。
   *
   * 这里是我改到第三版才想明白的地方，值得写下来：
   *
   * 前两版把扇贝弧当成**主痕上的装饰**（一条线上挂一串弧）。
   * 结果是"一串漂浮的圆圈 / 一排牙齿" —— 因为弧是彼此独立的。
   *
   * 而真实的潮痕根本不是那样：**岸线本身就是扇贝形的。**
   * 水退的边缘是一串相连的浅湾，湾与湾共用同一个交点，
   * 合起来构成**一条连续的曲线**。扇贝不是装饰在线上，扇贝就是线。
   *
   * 所以正确做法是：生成一条**连续的路径**，让它每隔一段就鼓出一个半圆，
   * 而不是画一条线再往上面贴弧。这样它一眼就是一条被水啃过的岸。
   *
   * @param depthAt 深度函数 (x) → 0–1，决定那一段的弧有多大
   * @param yAt     基线函数 (x) → y
   */
  const scallopedEdge = (yAt, rxBase, depthAt, seedOff) => {
    const pts = [];
    const segs = Math.max(6, Math.round(w / (rxBase * 0.85)));
    let x = -rxBase * 1.5;
    let flip = 1;
    while (x < w + rxBase * 1.5) {
      // 湾的大小不等：几次大湾夹着许多小湾
      // **扇贝要小。** 改到第四版才调对的：之前 rx 给到 0.03–0.13 个画幅宽，
      // 一个湾上百像素，排在一起读成**拱门 / 云朵**（比"潮痕"更强的联想）。
      // 真实的潮痕是边缘上细密的一圈小湾：它们是细节，不是主体。
      const big = rng.next() < 0.16;
      const rx = rxBase * (big ? rng.range(1.3, 2.1) : rng.range(0.5, 1.15));
      const ry = rx * rng.range(0.34, 0.62);
      const deep = depthAt(x) * (big ? rng.range(1.0, 1.3) : rng.range(0.5, 1.0));
      // 湾口朝向：多数朝水退的方向（下），少数反过来（涨潮时啃的）
      if (rng.next() < 0.22) flip = -flip;

      // 这一段是一整个半圆（从一侧的接点走到另一侧），
      // **两端必须落在基线上** —— 这样段与段才能连成一条不断的线。
      //
      // 注意 y 只在半圆的上半部起伏（用 |sin| 的平方根把它压扁），
      // 直接拿 sin 会鼓成一个饱满的半圆 —— 那是**云**的形状，不是水的边缘。
      // 真实的湾浅而扁，像被手指抹过一道。
      const N = Math.max(8, Math.round(segs / 2));
      const cx = x + rx;
      const cy = yAt(cx);
      for (let i = 0; i <= N; i++) {
        const a = Math.PI * (i / N);            // 0 → π，正好一个半圆
        const px = x + rx * (1 - Math.cos(a));
        // 扁：把正弦开方再乘一个小系数，得到"浅湾"而不是"半圆"
        const bump = Math.sqrt(Math.max(0, Math.sin(a)));
        const py = cy + bump * ry * flip * (0.5 + deep * 0.85);
        pts.push([px, py]);
      }
      x += rx * 2 * rng.range(0.82, 0.97);      // 略微重叠，湾与湾相切
    }
    return pts;
  };

  // ── 当前的潮痕 ──
  // 岸线本身是扇贝形的（见 scallopedEdge 的说明）。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const mainPts = scallopedEdge(shoreY, w * 0.009, () => 1, 0);
  // 三层叠出"湿线"的厚度：宽而淡的湿区 + 中等 + 亮的芯
  // 亮一些：之前整张图太暗，缩到全图看几乎什么都看不见
  litStroke(ctx, mainPts, 9.0, ramp(palette.stops, 0.40), 0.11, 3);
  litStroke(ctx, mainPts, 3.0, ramp(palette.stops, 0.78), 0.30, 3);
  litStroke(ctx, mainPts, 1.0, mix(palette.glow, [255, 255, 255], 0.50), 0.46, 2);
  ctx.restore();

  // ── 更早的潮痕：往上退去 ──
  //
  // 每一次涨落都在岸上留下一道扇贝形的边，越早的越往高处、越淡。
  // 这个"上旧下新"的方向很重要 —— 它让时间在画面上可读。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // **条数要多。** "累积"这件事的视觉表达就是"很多条" ——
  // 四五条看不出累积，那是"几次"。这里十来条，密到能感到"数不清多少次"。
  const OLD = rng.int(9, 15);
  for (let k = 1; k <= OLD; k++) {
    const t = k / OLD;                        // 1 = 最旧
    // 间距不均匀：水位每次涨到的位置本来就不同
    const lift = h * (0.014 + t * 0.24) * rng.range(0.7, 1.35);
    // 衰减放慢：让上面的旧痕也还看得见，否则"很多次"又变成"几次"
    const fade = Math.pow(1 - t, 0.85);
    if (fade < 0.06) continue;

    // 旧痕的走向与当前不同 —— 每次的水位高度和流向都不一样
    const p2 = rng.range(0, TAU);
    const sw2 = rng.range(0.30, 0.60);
    const cy0 = (xx) => shoreY(xx) - lift + Math.sin((xx / w) * TAU * sw2 + p2) * h * 0.018;

    const pts = scallopedEdge(cy0, w * rng.range(0.006, 0.013), () => fade, k);
    // 细线（不要宽度：有宽度十几条会叠成一团云），但亮度要够
    litStroke(ctx, pts, 0.75, ramp(palette.stops, 0.34 + fade * 0.30), 0.06 + fade * 0.20, 2);
  }
  ctx.restore();

  // ── 水中残留的浅湾 ──
  // 水位以下的沙地上也有一道道小扇贝边，但它们在水下，所以更暗、更糊。
  // 这一层给画面纵深：读者能看出"这条线不是一条边界，是一片连续的地形"。
  // 用完整的一条扇贝边（而不是零散几段弧），只是压暗、压低。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0, n = rng.int(1, 3); i < n; i++) {
    const depth = rng.next();
    const cy = (xx) => shoreY(xx) + h * (0.05 + depth * 0.22 + i * 0.06);
    const fade = (1 - depth * 0.6) * 0.42;
    const pts = scallopedEdge(cy, w * rng.range(0.024, 0.042), () => fade, i + 11);
    litStroke(ctx, pts, 0.7, ramp(palette.stops, 0.26), 0.03 + fade * 0.07, 2);
  }
  ctx.restore();

  // ── 湿沙的质感 ──
  // 干的地方是哑的，湿的地方有反光。这条过渡带是"水位刚好在这里"的证据。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const GRAINS = rng.int(420, 700);
  for (let i = 0; i < GRAINS; i++) {
    const gx = rng.next() * w;
    const gy = rng.next() * h;
    const d = gy - shoreY(gx);
    const wetness = d > 0
      ? clamp(1 - d / (h * 0.30)) * 0.7 + 0.3
      : clamp(1 + d / (h * 0.16));
    const b = 0.012 + wetness * 0.055 * rng.next();
    if (b < 0.016) continue;
    ctx.fillStyle = rgb(ramp(palette.stops, 0.32 + wetness * 0.38), b);
    // 沙粒被水刷过，横向排布
    ctx.beginPath();
    ctx.ellipse(gx, gy, rng.range(1.0, 4.6), rng.range(0.28, 0.95), 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // ── 水面的碎光 ──
  // 有水面就一定有反光。它是"这里还有水"的证据 ——
  // 只有痕没有水，会读成"很久以前的干河床"，那是另一件事。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const ROWS = 54;
  for (let row = 0; row < ROWS; row++) {
    const t = row / ROWS;
    const y = waterY + Math.pow(t, 1.4) * (h - waterY);
    const halfW = w * (0.12 + t * 0.52);
    const bias = FROM_LEFT ? -w * 0.18 : w * 0.18;
    for (let d = 0; d < 5 + t * 9; d++) {
      const off = rng.next() * rng.next() * 2 - 1;
      const gx = w * 0.5 + bias + off * halfW;
      const spark = rng.fbm(gx / w * 24 + 5.1, t * 8 + 2.3, 3);
      const flash = Math.pow(clamp(spark * 1.7 - 0.34), 2.1);
      const b = Math.exp(-off * off * 2.4) * (0.040 + flash * 0.58) * (0.4 + t * 0.8);
      if (b < 0.016) continue;
      ctx.fillStyle = rgb(ramp(palette.stops, 0.45 + flash * 0.5), Math.min(0.58, b));
      ctx.beginPath();
      ctx.ellipse(gx, y + rng.range(-1, 1), (2 + t * 18) * rng.range(0.5, 1.5), 0.4 + t * 1.3, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  // ── 掠射光 ──
  // 从一侧低角度扫过来，把弧的内壁擦亮。没有它，所有弧都是"平"的。
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const from = FROM_LEFT ? -0.15 * w : w * 1.15;
  const to = FROM_LEFT ? w * 1.15 : -0.15 * w;
  const rake = ctx.createLinearGradient(from, waterY - h * 0.42, to, waterY + h * 0.30);
  rake.addColorStop(0, rgb(palette.glow, 0.075));
  rake.addColorStop(0.45, rgb(palette.glow, 0.028));
  rake.addColorStop(1, rgb(palette.glow, 0));
  ctx.fillStyle = rake;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 顶与底的收束
  ctx.save();
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.20);
  top.addColorStop(0, rgb(palette.base, 0.72));
  top.addColorStop(1, rgb(palette.base, 0));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h * 0.20);
  const bot = ctx.createLinearGradient(0, h * 0.88, 0, h);
  bot.addColorStop(0, rgb(palette.base, 0));
  bot.addColorStop(1, rgb(palette.base, 0.60));
  ctx.fillStyle = bot;
  ctx.fillRect(0, h * 0.88, w, h * 0.12);
  ctx.restore();

  vignette(ctx, w, h, 0.44, 1.34);
  grain(ctx, w, h, rng, 0.046, 2);
}
