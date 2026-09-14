/**
 * 确定性随机与噪声。
 *
 * 为什么必须可复现：卡片是「同一个判断的载体」。同一份输入、同一个风格，
 * 每次渲染必须得到同一张图——否则用户分享出去的卡片和本地看到的不是一张东西，
 * 迭代时也没法判断"改了这一版到底变好了还是变差了"。
 * 所以一切随机都走同一个种子，种子由 (主题 + 文案 + 序号) 派生 —— **配色不在种子里**。
 *
 * 配色为什么不能进种子：同一句话换一套配色，是"同一个判断换一种语气"，
 * 画面结构必须一丝不变，否则换配色等于换了一张图，两版就没法比较了。
 * 实测换配色后画面结构相关性 ≥0.99、颜色确实改变，就是这条契约的行为学证据。
 */

/** 32 位整数混合（murmur3 的 finalizer），把字符串稳定地映成一个种子。 */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32：小、快、周期够用。 */
export function makeRng(seed) {
  let a = (typeof seed === "string" ? hashSeed(seed) : seed >>> 0) || 1;

  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const api = {
    next,
    /** [lo, hi) 之间的浮点。 */
    range: (lo, hi) => lo + next() * (hi - lo),
    /** [lo, hi] 之间的整数。 */
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    bool: (p = 0.5) => next() < p,
    /** 近似正态：三次均匀求和，够用且不会出现长尾异常值。 */
    gauss: () => (next() + next() + next()) / 1.5 - 1,
    /** 幂律分布：用于星点大小这类「大量小、极少数大」的量。 */
    power: (exp = 3, lo = 0, hi = 1) => lo + Math.pow(next(), exp) * (hi - lo),
    /** 洗牌（返回新数组，不改原数组）。 */
    shuffle: (arr) => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };

  return Object.assign(api, makeNoise(api));
}

/**
 * Perlin 梯度噪声 + fBm。
 *
 * 这一组图里所有「自然的形状」都从这里来——星云的云絮、菌丝的走向、
 * 极光的弯曲、放电的扰动。用噪声而不是手画，是因为自然的形状本来就不是
 * 手能画出来的：它有结构，但没有重复。
 */
function makeNoise(rng) {
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const GRAD = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ];
  const grad = (h, x, y) => {
    const g = GRAD[h & 7];
    return g[0] * x + g[1] * y;
  };

  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  /** 单层 Perlin，返回约 -1..1。 */
  function noise2(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const X = xi & 255;
    const Y = yi & 255;
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  }

  /**
   * 分形叠加。返回 0..1（已归一化）——调用方不该关心内部符号。
   * lacunarity 2 / gain 0.5 是标准取值：每层细节减半、幅度减半，
   * 出来的形状"每一级都有东西可看"，正是云和山脉的统计特征。
   */
  function fbm(x, y, octaves = 5, lacunarity = 2, gain = 0.5) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm / 2 + 0.5;
  }

  /**
   * 域扭曲：把噪声的输入坐标本身用噪声推开。
   * 这是让云看起来「翻卷」而不是「一层层叠」的关键——单靠 fbm 得到的
   * 永远是同心团块，扭过之后才有流动感。
   */
  function warp(x, y, amount = 1.6, octaves = 3) {
    const qx = fbm(x + 5.2, y + 1.3, octaves);
    const qy = fbm(x + 1.7, y + 9.2, octaves);
    return fbm(
      x + amount * (qx - 0.5) * 2,
      y + amount * (qy - 0.5) * 2,
      octaves,
    );
  }

  /** 脊线噪声：适合做放电、纤维、山脉这类有"锋"的结构。 */
  function ridge(x, y, octaves = 4) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += (1 - Math.abs(noise2(x * freq, y * freq))) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  return { noise2, fbm, warp, ridge };
}
