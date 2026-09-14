export const meta = {
  id: "mycelium", zh: "菌丝", en: "Mycelium", connects: "交换",
  mood: "黑暗里，细小的交换养成明亮的结点",
  note: "连接来自交换：菌丝伸展、分岔、重新汇合，营养在粗细不一的通道中流动。",
};

export function render(ctx, { w, h, rng, palette }) {
  ctx.fillStyle = rgb(palette.base);
  ctx.fillRect(0, 0, w, h);
  const unit = w / 1080;
  const hubs = [
    [0.26, 0.31, 1], [0.48, 0.23, 0.62], [0.65, 0.38, 0.9],
    [0.42, 0.56, 0.76], [0.76, 0.59, 0.5], [0.19, 0.62, 0.35],
  ].map(([x, y, mass]) => ({ x: (x + rng.range(-0.026, 0.026)) * w, y: (y + rng.range(-0.026, 0.026)) * h, mass }));
  const nodes = [];
  for (const hub of hubs) {
    nodes.push({ ...hub, hub: true });
    for (let i = 0; i < Math.round(44 * hub.mass + 12); i++) {
      const angle = rng.range(0, TAU), r = rng.power(1.5, 0.009, 0.17);
      nodes.push({ x: clamp(hub.x / w + Math.cos(angle) * r, 0.065, 0.935) * w,
        y: clamp(hub.y / h + Math.sin(angle) * r * 0.78, 0.085, 0.80) * h,
        mass: rng.power(3, 0.06, 0.5), hub: false });
    }
  }

  // 可被结点照亮的细碎基质；中间的独立裂隙保持黑暗。
  const soil = offscreen(w / 3, h / 3);
  const img = soil.ctx.createImageData(soil.canvas.width, soil.canvas.height);
  for (let y = 0; y < soil.canvas.height; y++) for (let x = 0; x < soil.canvas.width; x++) {
    const u = x / soil.canvas.width, v = y / soil.canvas.height;
    let illumination = 0;
    for (const hub of hubs) illumination += hub.mass * Math.exp(-1 * ((u - hub.x / w) / 0.13) ** 2 - ((v - hub.y / h) / 0.14) ** 2);
    const n = rng.warp(u * 11, v * 11, 2, 4);
    const crack = smoothstep((rng.fbm(u * 6 + 31, v * 9, 3) - 0.37) / 0.25);
    const t = clamp(illumination * (0.05 + n * n * 0.48) * crack);
    const c = ramp(palette.stops, t * 0.9);
    img.data.set([...c, Math.round(t * 155)], (y * soil.canvas.width + x) * 4);
  }
  soil.ctx.putImageData(img, 0, 0);
  blit(ctx, soil.canvas, w, h, 0.8, "lighter");

  // 最近邻只决定拓扑；实际通道是弯曲、分股、带侧枝的生长路径。
  const edges = [], seen = new Set();
  function connect(i, j, trunk = false) {
    const key = [Math.min(i, j), Math.max(i, j)].join(":");
    if (seen.has(key)) return;
    seen.add(key);
    const a = nodes[i], b = nodes[j];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const bend = rng.range(-0.18, 0.18) * len;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const cross = Math.sin(t * Math.PI) * (bend + (rng.fbm(t * 4, i + j, 3) - 0.5) * len * 0.28);
      pts.push([lerp(a.x, b.x, t) - dy / len * cross, lerp(a.y, b.y, t) + dx / len * cross]);
    }
    edges.push({ pts: smoothPath(pts, 3), width: (trunk ? rng.range(0.8, 1.55) : rng.power(3, 0.28, 1.3)) * unit,
      strength: trunk ? 0.42 : rng.range(0.13, 0.50), len });
  }
  for (let i = 0; i < nodes.length; i++) {
    const neighbors = nodes.map((p, j) => ({ j, d: Math.hypot(p.x - nodes[i].x, p.y - nodes[i].y) }))
      .filter(p => p.j !== i).sort((a, b) => a.d - b.d);
    for (const p of neighbors.slice(0, nodes[i].hub ? 5 : rng.int(2, 3))) {
      if (p.d < w * 0.20) connect(i, p.j);
    }
  }
  const hi = nodes.map((p, i) => p.hub ? i : -1).filter(i => i >= 0);
  for (const [a, b] of [[0, 1], [1, 2], [0, 3], [3, 2], [2, 4], [3, 5]]) connect(hi[a], hi[b], true);
  edges.sort((a, b) => a.width - b.width);
  function grow(x, y, angle, length, width, depth, alpha) {
    const pts = [[x, y]];
    let a = angle;
    for (let i = 1; i <= 12; i++) {
      a += rng.range(-0.20, 0.20);
      x += Math.cos(a) * length / 12; y += Math.sin(a) * length / 12;
      if (x < w * 0.045 || x > w * 0.955 || y < h * 0.05 || y > h * 0.84) break;
      pts.push([x, y]);
      if (depth > 0 && (i === 5 || i === 9)) {
        grow(x, y, a + rng.pick([-1, 1]) * rng.range(0.4, 0.85), length * rng.range(0.36, 0.66), width * 0.65, depth - 1, alpha * 0.72);
      }
    }
    const sm = smoothPath(pts, 3);
    litStroke(ctx, sm, width, ramp(palette.stops, 0.63), alpha, 2);
  }
  for (const e of edges) {
    const color = ramp(palette.stops, 0.43 + e.strength * 0.47);
    litStroke(ctx, e.pts, e.width, color, e.strength, 3);
    for (let strand = 0; strand < (e.width > unit ? 5 : 2); strand++) {
      const offset = rng.range(-4, 4) * unit;
      const pts = e.pts.map(([x, y], i) => {
        const t = i / (e.pts.length - 1), wave = Math.sin(t * Math.PI) * offset;
        return [x + wave, y + wave * Math.sin(t * 5 + strand)];
      });
      litStroke(ctx, pts, 0.32 * unit, palette.glow, e.strength * 0.38, 1);
    }
    // 极细的自由菌丝从通道侧面生出，末端衰减，不是完整的多边形网格。
    for (let k = 0; k < 5; k++) {
      const idx = rng.int(3, e.pts.length - 4), p = e.pts[idx], q = e.pts[idx + 1];
      const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + rng.pick([-1, 1]) * rng.range(0.5, 1.25);
      const len = rng.range(9, 35) * unit;
      if (k < 3) grow(p[0], p[1], a, len * rng.range(1, 2.2), rng.range(0.4, 0.8) * unit, 2, e.strength * 0.60);
      const tip = [p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len];
      const grad = ctx.createLinearGradient(...p, ...tip);
      grad.addColorStop(0, rgb(color, e.strength * 0.6));
      grad.addColorStop(1, rgb(color, 0));
      ctx.strokeStyle = grad; ctx.lineWidth = 0.45 * unit;
      ctx.beginPath(); ctx.moveTo(...p);
      ctx.quadraticCurveTo(p[0] + Math.cos(a - 0.3) * len * 0.6, p[1] + Math.sin(a - 0.3) * len * 0.6, ...tip); ctx.stroke();
    }
  }
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const n of nodes) {
    if (!n.hub && n.mass < 0.22) continue;
    glow(ctx, n.x, n.y, (12 + n.mass * 65) * unit, palette.accent, n.mass * 0.10);
    glow(ctx, n.x, n.y, (2 + n.mass * 19) * unit, palette.glow, n.mass * 0.32);
    // 不规则的纤维结，不画圆形图论结点。
    for (let i = 0; i < (n.hub ? 180 : 6); i++) {
      const x = n.x + rng.gauss() * n.mass * 32 * unit, y = n.y + rng.gauss() * n.mass * 25 * unit;
      ctx.strokeStyle = rgb(palette.glow, rng.range(0.15, 0.52) * n.mass);
      ctx.lineWidth = rng.range(0.35, 0.85) * unit;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(n.x + rng.gauss() * 27 * unit, n.y + rng.gauss() * 27 * unit,
        n.x + rng.gauss() * 7 * unit, n.y + rng.gauss() * 7 * unit); ctx.stroke();
    }
  }
  ctx.restore();
  vignette(ctx, w, h, 0.50, 1.25);
  grain(ctx, w, h, rng, 0.043, 2);
}
