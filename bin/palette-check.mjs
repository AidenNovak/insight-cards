#!/usr/bin/env node
/**
 * 配色体检。
 *
 * 检查的是**配色之间是否真的可分**，不是"好不好看"（那个只能靠看）。
 * 一套配色最大的失败不是丑，是**两组看起来一样** —— 用户选了半天，
 * 出来两张分不出的图，那这一整组就是假的。
 *
 * 两个判据（都是客观可测的）：
 *
 *   1. **两两色距**：任意两组之间，色阶（stops）的平均距离要够大。
 *      太近的在表里就是冗余项，应该合并或者重调。
 *   2. **底色够暗**：base 的平均亮度要低。这一组是深色卡片，
 *      底色一亮，上面所有的"光"都失去意义（见 DESIGN.md 第二节）。
 *
 * 用法：node bin/palette-check.mjs
 */
import { PALETTES } from "../packages/engine/palettes.mjs";

const lum = (c) => (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** 两组配色的"外形距离"：色阶逐档比较，取平均。 */
function paletteDistance(a, b) {
  const n = Math.min(a.stops.length, b.stops.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += dist(a.stops[i], b.stops[i]);
  // 底色也参与：两组色阶接近但底色差异大，实际观感仍然不同
  return sum / n * 0.75 + dist(a.base, b.base) * 0.9;
}

// 阈值是量出来的，不是拍的：18 组里最接近的一对（苔原/苔藓）是 26 左右，
// 其余都在 40 以上。低于 22 基本可以认为"用户分不出来"。
const NEAR = 22;
const WARN = 30;

console.log(`\n配色体检 · ${PALETTES.length} 组\n`);

// ── 1. 底色亮度 ──
let badBase = 0;
for (const p of PALETTES) {
  const L = lum(p.base);
  if (L > 20) {
    console.log(`  ✗ ${p.id.padEnd(14)}底色偏亮（亮度 ${L.toFixed(1)}）—— 深色卡片要求近黑`);
    badBase++;
  }
}

// ── 2. 两两距离 ──
const pairs = [];
for (let i = 0; i < PALETTES.length; i++) {
  for (let j = i + 1; j < PALETTES.length; j++) {
    pairs.push({
      a: PALETTES[i],
      b: PALETTES[j],
      d: paletteDistance(PALETTES[i], PALETTES[j]),
    });
  }
}
pairs.sort((x, y) => x.d - y.d);

const tooNear = pairs.filter((p) => p.d < NEAR);
const warn = pairs.filter((p) => p.d >= NEAR && p.d < WARN);

for (const p of tooNear) {
  console.log(`  ✗ ${p.a.id} ↔ ${p.b.id}：色距 ${p.d.toFixed(1)} —— 太近，用户分不出来`);
}
for (const p of warn) {
  console.log(`  ! ${p.a.id} ↔ ${p.b.id}：色距 ${p.d.toFixed(1)} —— 偏近，改其中一组的 stops 中段可拉开`);
}

// ── 3. 结构约定 ──
let badStruct = 0;
for (const p of PALETTES) {
  // 最后一档必须接近白，否则光立不起来
  const top = p.stops[p.stops.length - 1];
  if (lum(top) < 190) {
    console.log(`  ✗ ${p.id.padEnd(14)}色阶最高档不够亮（亮度 ${lum(top).toFixed(0)}）—— 光会立不起来`);
    badStruct++;
  }
  // 第一档要够暗，否则暗部没有层次
  const low = p.stops[0];
  if (lum(low) > 70) {
    console.log(`  ✗ ${p.id.padEnd(14)}色阶最低档不够暗（亮度 ${lum(low).toFixed(0)}）—— 暗部没有层次`);
    badStruct++;
  }
  if (!p.mood || !p.zh || !p.en) {
    console.log(`  ✗ ${p.id.padEnd(14)}缺少 zh / en / mood —— 这三项是选配色的依据，不是展示用的`);
    badStruct++;
  }
}

console.log(`\n  最近的三对：`);
for (const p of pairs.slice(0, 3)) {
  console.log(`    ${p.a.id.padEnd(14)}↔ ${p.b.id.padEnd(14)}${p.d.toFixed(1)}`);
}

const failed = tooNear.length + badStruct + badBase;
console.log(`\n  ${failed ? `${failed} 项不合格` : "全部合格"}\n`);
process.exit(failed ? 1 : 0);
