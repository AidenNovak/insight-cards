/**
 * 主题共用的绘图原语。
 *
 * 这些函数被注入到每个主题的作用域里（见 render.mjs），所以主题里直接调用即可，
 * 不需要 import。集中在这里的原因不只是省代码——**同一批原语才能出同一种手感**：
 * 所有"光"都走 glow()、所有颗粒都走 grain()、所有柔化都走 offscreen 降采样。
 * 换个主题时，质感是连续的，只有结构在变。
 */

export const TAU = Math.PI * 2;

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** 平滑插值：0..1 进出都缓。做遮罩与衰减时几乎总比线性好看。 */
export const smoothstep = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

/** [r,g,b] → css 颜色。alpha 省略时用 1。 */
export function rgb(c, a = 1) {
  const [r, g, b] = c;
  return a >= 1
    ? `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
    : `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(4)})`;
}

/** 两个颜色按 t 混合，返回 [r,g,b]。 */
export function mix(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/**
 * 在色阶上取色。这是主题与调色板之间**唯一**的接口：
 * 主题说"这里强度是 0.7"，调色板决定 0.7 是什么颜色。
 */
export function ramp(stops, t) {
  const x = clamp(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

/**
 * 一团光。整组图的"发光感"全靠它——不用 shadowBlur（慢且脏），
 * 用径向渐变叠乘，暗部干净、亮部不糊。
 */
export function glow(ctx, x, y, r, color, alpha = 1) {
  if (r <= 0 || alpha <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgb(color, alpha));
  g.addColorStop(0.35, rgb(color, alpha * 0.42));
  g.addColorStop(0.68, rgb(color, alpha * 0.12));
  g.addColorStop(1, rgb(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** 一张离屏画布。噪声类主题都该在低分辨率上算完再放大——快，而且更柔。 */
export function offscreen(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return { canvas, ctx: canvas.getContext("2d") };
}

/** 把离屏画布放大贴回主画布（平滑插值）。 */
export function blit(ctx, canvas, w, h, alpha = 1, mode = "lighter") {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = mode;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, w, h);
  ctx.restore();
}

/**
 * 胶片颗粒。
 *
 * 一条硬要求：这一组图**不能是干净的**。纯矢量渐变出来会像 PPT，
 * 一层很轻的颗粒立刻把它拉回"被拍摄/被冲洗出来的东西"。
 * 用量要小（默认 0.035），它的作用是让眼睛相信这是材料，不是渲染。
 */
export function grain(ctx, w, h, rng, amount = 0.035, scale = 1) {
  const g = offscreen(w / scale, h / scale);
  const img = g.ctx.createImageData(g.canvas.width, g.canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 128 + (rng.next() - 0.5) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  g.ctx.putImageData(img, 0, 0);
  blit(ctx, g.canvas, w, h, amount, "overlay");
}

/** 四角压暗。让光更立得住，也让卡片的边缘自然收住。 */
export function vignette(ctx, w, h, amount = 0.5, radius = 1.25) {
  const g = ctx.createRadialGradient(
    w / 2, h * 0.42, 0,
    w / 2, h * 0.42, Math.max(w, h) * radius * 0.62,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.55, `rgba(0,0,0,${amount * 0.28})`);
  g.addColorStop(1, `rgba(0,0,0,${amount})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * 一条带柔边的线。放电、菌丝、光纤都用它——
 * 直接 stroke 出来的是硬边，叠加几层不同宽度的低透明度版本才有"发光"的错觉。
 */
export function litStroke(ctx, points, width, color, alpha = 1, layers = 4) {
  if (points.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = layers - 1; i >= 0; i--) {
    const t = i / Math.max(1, layers - 1);
    ctx.strokeStyle = rgb(color, alpha * (0.1 + 0.9 * (1 - t)) * (i === 0 ? 1 : 0.5));
    ctx.lineWidth = width * (1 + t * 4.5);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let k = 1; k < points.length; k++) ctx.lineTo(points[k][0], points[k][1]);
    ctx.stroke();
  }
  ctx.restore();
}

/** Catmull-Rom 平滑：把折线变成曲线。分支类结构都需要它。 */
export function smoothPath(points, perSegment = 8, tension = 0.5) {
  if (points.length < 3) return points;
  const out = [];
  const p = [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t * tension * 2 +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t * tension * 2 +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
