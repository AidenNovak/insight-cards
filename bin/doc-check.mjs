#!/usr/bin/env node
/**
 * 文档与代码的一致性检查。
 *
 * 为什么需要它：这个项目里**文档承诺的接口**和**代码实际提供的接口**
 * 是两套东西，靠人记着同步。已经漏过一次：
 * `--kicker` / `--footer` 在 SKILL.md 里写了，但 `make-card.mjs` 的帮助文本
 * 里没有（功能是好的，只是没人知道），而帮助文本里又写着一条**不存在的**
 * `--deck` 用法。两者都会让人白试一次。
 *
 * 这个脚本把"文档里提到的开关"和"代码里真的读了的开关"对一遍。
 * 它只做**可机械验证**的那部分（参数名、命令名、文件存在），
 * 判断性的内容（某个主题配哪句话）查不了，也不该硬查。
 *
 * 用法：node bin/doc-check.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const problems = [];
const notes = [];

/**
 * 读文档。**文件不在时要给出可读的提示，而不是抛 ENOENT。**
 *
 * 远程构建位只同步了"跑图需要的东西"（packages / bin / references），
 * 没有 README.md —— 于是这个检查在服务器上会以一句
 * `ENOENT: ... README.md` 崩掉，看起来像代码坏了。
 * 实际上只是那份文档不在场：能查多少查多少，缺的说缺。
 */
const readDoc = (p) => {
  try {
    return readFileSync(join(ROOT, p), "utf8");
  } catch {
    return null;
  }
};
const skill = readDoc("SKILL.md");
if (skill === null) {
  console.error("✗ 找不到 SKILL.md —— 这个检查必须在项目根目录下跑");
  process.exit(2);
}
const readme = readDoc("README.md");
if (readme === null) {
  console.log("  · 这份副本里没有 README.md，只检查 SKILL.md（远程构建位就是这种情况）");
}
const docs = [["SKILL.md", skill], ...(readme ? [["README.md", readme]] : [])];

// ── 1. 每个 bin/ 下的脚本，都要在文档里被提到 ──
const binFiles = readdirSync(join(ROOT, "bin")).filter((f) => f.endsWith(".mjs"));
for (const f of binFiles) {
  const mentioned = docs.some(([, text]) => text.includes(f));
  if (!mentioned) problems.push(`bin/${f} 存在，但 SKILL.md 与 README.md 都没提到它`);
}

// ── 2. 文档里提到的 bin/ 脚本，都必须真的存在 ──
const mentionedScripts = new Set();
for (const [, text] of docs) {
  for (const m of text.matchAll(/bin\/([a-z-]+\.mjs)/g)) mentionedScripts.add(m[1]);
}
for (const s of mentionedScripts) {
  if (!existsSync(join(ROOT, "bin", s))) {
    problems.push(`文档里写了 bin/${s}，但文件不存在`);
  }
}

// ── 2b. Tools/ 下的文件同样两向都对得上 ──
//
// 为什么连 Tools/ 也要查：文档里写过的路径必须真的能用，否则文档就是空头支票。
// 这条是踩出来的 —— `Tools/dbg-theme.mjs` 一度没被装进技能目录，
// 故障排查那一节让人跑的命令在别人的机器上根本不存在。
// 反向也要查：Tools/ 里新加的工具，得在文档里出现，否则没人知道它存在。
const toolsFiles = readdirSync(join(ROOT, "Tools")).filter((f) => /\.(mjs|sh)$/.test(f));
for (const f of toolsFiles) {
  const mentioned = docs.some(([, text]) => text.includes(f));
  if (!mentioned) problems.push(`Tools/${f} 存在，但 SKILL.md 与 README.md 都没提到它`);
}
const mentionedTools = new Set();
for (const [, text] of docs) {
  for (const m of text.matchAll(/Tools\/([A-Za-z0-9._-]+)/g)) mentionedTools.add(m[1]);
}
for (const s of mentionedTools) {
  if (!existsSync(join(ROOT, "Tools", s))) {
    problems.push(`文档里写了 Tools/${s}，但文件不存在`);
  }
}

// ── 3. make-card 的开关：文档里说的 与 代码里读的 要对得上 ──
const cardSrc = readDoc("bin/make-card.mjs");
// 代码里通过 arg("xxx") **或** has("xxx") 读的开关 —— 两种都要认。
// 早期只扫了 arg()，于是把 --themes / --palettes 误报成"帮助文本列了但代码没有"。
const codeFlags = new Set();
for (const m of cardSrc.matchAll(/\barg\(\s*"([a-z-]+)"/g)) codeFlags.add(m[1]);
for (const m of cardSrc.matchAll(/\bhas\(\s*"([a-z-]+)"/g)) codeFlags.add(m[1]);
// 帮助文本里列出的开关。
// 帮助文本在源码里是字符串数组，每行形如 `      "  --theme   主题 id ...",`
// 所以要先吃掉缩进和开引号。
// 末尾还有一句"整批渲染用 make-deck.mjs --preset …"，那是另一个命令的开关，
// 不该算进来（它不以引号+两空格开头，自然被排除）。
const helpBlock = cardSrc.slice(cardSrc.indexOf("缺少参数"), cardSrc.indexOf("process.exit(2)"));
const helpFlags = new Set();
for (const line of helpBlock.split("\n")) {
  const m = /^\s*"\s{2}--([a-z-]+)/.exec(line);
  if (m) helpFlags.add(m[1]);
}

for (const f of codeFlags) {
  if (!helpFlags.has(f)) problems.push(`make-card.mjs 支持 --${f}，但帮助文本里没列出来`);
}
for (const f of helpFlags) {
  if (!codeFlags.has(f)) problems.push(`帮助文本里列了 --${f}，但代码没有读这个参数`);
}
// SKILL.md 的参数表里提到的开关，也要真的存在。
// 只在**行首**出现的 `--xxx` 才算开关名，且至少两个字母 —— 否则会把
// 中文破折号、分隔线 `---` 和句子中间的引用都当成参数
// （第一版就把 `---` 解析成了参数名，误报一条）。
const paramSection = skill.slice(skill.indexOf("## 其它参数"), skill.indexOf("## 加一个新主题"));
for (const m of paramSection.matchAll(/^--([a-z][a-z-]*)\b/gm)) {
  const f = m[1];
  if (!codeFlags.has(f)) problems.push(`SKILL.md 的参数表里写了 --${f}，但 make-card.mjs 不认这个参数`);
}

// ── 4. 文档里提到的所有命令，都要能真的跑起来（只查命令名，不执行） ──
for (const [, text] of docs) {
  for (const m of text.matchAll(/node (bin\/[a-z-]+\.mjs)/g)) {
    const f = m[1].replace("bin/", "");
    if (!binFiles.includes(f)) problems.push(`文档里的命令 node bin/${f} 不存在`);
  }
}

// ── 5. 数字声明要对得上实际 ──
const themeCount = readdirSync(join(ROOT, "packages/engine/themes")).filter((f) => f.endsWith(".mjs")).length;
const palMod = await import(join(ROOT, "packages/engine/palettes.mjs"));
const palCount = palMod.PALETTES.length;
const presetMod = await import(join(ROOT, "packages/engine/presets.mjs"));
const presetCount = Object.keys(presetMod.PRESETS).length;

/**
 * 从文档里抠出"数量声明"。
 *
 * 中英文数字都要认（文档里写"18 个主题"，也写"18 themes"），
 * 而且**同一个数字可能被两条正则同时匹配到**（比如"18 个主题"中英文都能命中），
 * 所以最后要去重 —— 否则一个错误会被报两遍（第一版就是这样）。
 */
const CN = { 十: 10, 十四: 14, 十五: 15, 十六: 16, 十七: 17, 十八: 18, 十九: 19, 二十: 20 };
const claim = (doc, zhRe, enRe) => {
  const out = new Set();
  const a = zhRe.exec(doc);
  if (a) out.add(CN[a[1]] ?? parseInt(a[1], 10));
  const b = enRe.exec(doc);
  if (b) out.add(parseInt(b[1], 10));
  return [...out];
};

for (const [name, text] of docs) {
  for (const n of claim(text, /(十[四五六七八九]?|[0-9]+) 个主题/, /([0-9]+) 个主题/)) {
    if (n !== themeCount) problems.push(`${name} 说"${n} 个主题"，实际是 ${themeCount}`);
  }
  for (const n of claim(text, /(十[四五六七八九]?|[0-9]+) 组配色/, /([0-9]+) 组配色/)) {
    if (n !== palCount) problems.push(`${name} 说"${n} 组配色"，实际是 ${palCount}`);
  }
}

// ── 6. 每个主题文件的结构约定 ──
const themeDir = join(ROOT, "packages/engine/themes");
for (const f of readdirSync(themeDir).filter((x) => x.endsWith(".mjs"))) {
  const src = readFileSync(join(themeDir, f), "utf8");
  for (const field of ["id", "zh", "en", "connects", "mood", "note"]) {
    if (!new RegExp(`\\b${field}\\s*:`).test(src)) {
      problems.push(`themes/${f} 的 meta 缺字段 ${field}`);
    }
  }
  // 硬约束 2：不许 Math.random
  if (/Math\.random/.test(src)) problems.push(`themes/${f} 用了 Math.random()，违反硬约束 2`);
  // 硬约束 3：不许 import
  if (/^\s*import\s/m.test(src)) problems.push(`themes/${f} 有 import，违反硬约束 3`);
}

// ── 7. 预设里引用的主题与配色必须存在 ──
const themeIds = new Set(
  readdirSync(themeDir).filter((x) => x.endsWith(".mjs")).map((x) => x.replace(/\.mjs$/, "")),
);
const palIds = new Set(palMod.PALETTES.map((p) => p.id));
for (const [name, preset] of Object.entries(presetMod.PRESETS)) {
  let n = 0;
  for (const c of preset.cards) {
    n++;
    if (!themeIds.has(c.theme)) problems.push(`预设 ${name} 第 ${n} 张引用了不存在的主题 "${c.theme}"`);
    const pid = c.palette ?? preset.palette;
    if (pid && !palIds.has(pid)) problems.push(`预设 ${name} 第 ${n} 张引用了不存在的配色 "${pid}"`);
  }
}

// ── 8. connects 不能重复（每个主题必须演示不同的机制）──
const connects = new Map();
for (const id of themeIds) {
  const src = readFileSync(join(themeDir, `${id}.mjs`), "utf8");
  const m = /connects\s*:\s*"([^"]+)"/.exec(src);
  if (!m) continue;
  if (connects.has(m[1])) {
    problems.push(`主题 ${id} 与 ${connects.get(m[1])} 的 connects 都是"${m[1]}"——机制重复了`);
  }
  connects.set(m[1], id);
}

// ── 9. 文档里的机制表必须与主题文件一致 ──
//
// 那两张表曾经是手抄的，结果是：两张表行序不一致、数字过期（写"十四种"时已有十八种）。
// 现在表由 `bin/gen-tables.mjs` 生成 —— 这里只负责调用它的 --check 模式，
// 确认文档里的表没有被手改回去、或加了新主题却没重新生成。
{
  const { execFileSync } = await import("node:child_process");
  try {
    execFileSync(process.execPath, [join(ROOT, "bin", "gen-tables.mjs"), "--check"], {
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (e) {
    const msg = (e.stdout || e.stderr || "").trim().split("\n").filter(Boolean).pop();
    problems.push(msg ?? "机制表与主题文件不一致（跑 node bin/gen-tables.mjs 重写）");
  }
}

// ── 10. 预设内部：同一套 deck 不该用两组太近的配色 ──
//
// 这条来自一次试用提出的批评：**主题层有可查的判据（机制必须不重复），
// 配色层却只有"感觉要配得上"这种不可查的说法**，于是同一段文案
// 两套合理读法会分叉，谁也不能说另一套错了。
//
// 完全消除这种分叉是不可能的 —— 配色本来就是语气，语气有品味成分。
// 但**有一半是可以机械检查的**：同一套 deck 之内，不能出现两组
// 读者分不出来的配色（那会让"这套卡十张"看起来像"同一张卡印了十次"）。
// 至于"这组配色配这句话对不对"，仍然只能靠人判断，工具不管。
{
  const dist = (a, b) => {
    const n = Math.min(a.stops.length, b.stops.length);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(
        a.stops[i][0] - b.stops[i][0],
        a.stops[i][1] - b.stops[i][1],
        a.stops[i][2] - b.stops[i][2],
      );
      sum += d;
    }
    const base = Math.hypot(a.base[0] - b.base[0], a.base[1] - b.base[1], a.base[2] - b.base[2]);
    return (sum / n) * 0.75 + base * 0.9;
  };
  const byId = new Map(palMod.PALETTES.map((p) => [p.id, p]));
  // 阈值与 palette-check.mjs 的 NEAR 一致（22）——
  // 那边判"全局冗余"，这边判"同一套里撞车"，标准相同。
  //
  // **为什么是 22 而不是 palette-check 报"偏近"的 30**：
  // 30 是给"要不要再拉开一点"的建议线；22 是"读者真的分不出来"的硬线。
  // 实测 nexus 用了 deep-field / frost / core（两两 24.8–25.0），
  // 并排看是深蓝星空、白墨丝、白热闪电，差别很清楚 —— 那就没问题。
  // 同一套 deck 里允许有"偏近但可分"的组合，不允许的是"分不出来"。
  const NEAR = 22;
  for (const [name, preset] of Object.entries(presetMod.PRESETS)) {
    const used = preset.cards
      .map((c) => ({ theme: c.theme, pal: c.palette ?? preset.palette ?? "deep-field" }))
      .filter((u) => byId.has(u.pal));
    for (let i = 0; i < used.length; i++) {
      for (let j = i + 1; j < used.length; j++) {
        if (used[i].pal === used[j].pal) continue; // 完全相同另说（见下）
        const d = dist(byId.get(used[i].pal), byId.get(used[j].pal));
        if (d < NEAR) {
          problems.push(
            `预设 ${name} 里第 ${i + 1} 张（${used[i].pal}）与第 ${j + 1} 张（${used[j].pal}）` +
              `配色太近（色距 ${d.toFixed(1)}）—— 同一套里读者分不出来`,
          );
        }
      }
    }
  }
}

// ── 输出 ──
console.log(`\n文档一致性检查\n`);
console.log(`  主题 ${themeCount} · 配色 ${palCount} · 预设 ${presetCount} · 脚本 ${binFiles.length} · 机制 ${connects.size}`);

if (notes.length) for (const n of notes) console.log(`  · ${n}`);
if (!problems.length) {
  console.log(`\n  ✓ 文档与代码一致\n`);
  process.exit(0);
}
console.log(`\n  ✗ ${problems.length} 处不一致：`);
for (const p of problems) console.log(`      ${p}`);
console.log("");
process.exit(1);
