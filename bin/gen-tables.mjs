#!/usr/bin/env node
/**
 * 从主题文件**生成**机制对照表，并回填进 SKILL.md 与 DESIGN.md 的对应位置。
 *
 * 为什么要生成而不是手写：这两张表原本是手抄的，已经漂过两次 ——
 *   - SKILL.md 与 DESIGN.md 的行序不一致，对不上；
 *   - "放电"一度既是主题名又是机制名，读者会把 discharge 的机制看错；
 *   - 文档写"十四种机制"时实际已经有十八种。
 *
 * 手抄的表一定会漂。让文档里的表由代码生成，就不会。
 *
 * 用法：
 *   node bin/gen-tables.mjs           # 就地把两张表重写进文档
 *   node bin/gen-tables.mjs --check   # 只比对，不改（给 doc-check 用）
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/** 读全部主题的 meta，按机制名稳定排序 */
async function collect() {
  const dir = resolve(here, "packages/engine/themes");
  const ids = readdirSync(dir).filter((f) => f.endsWith(".mjs")).map((f) => f.replace(/\.mjs$/, ""));
  const rows = [];
  for (const id of ids) {
    const mod = await import(resolve(dir, `${id}.mjs`));
    rows.push({
      id,
      zh: mod.meta.zh,
      connects: mod.meta.connects,
      // mood 给 README 的表用（"它在演示什么"那一列）
      mood: mod.meta.mood,
    });
  }
  // 按机制名的中文排序不稳定（不同环境 locale 不同），
  // 改成按 zh 的码点排 —— 只要确定性，读者不关心顺序含义。
  rows.sort((a, b) => (a.zh > b.zh ? 1 : a.zh < b.zh ? -1 : 0));
  return rows;
}

/** 生成两列表格（每行放两组，省纵向空间） */
function table(rows) {
  const half = Math.ceil(rows.length / 2);
  const left = rows.slice(0, half);
  const right = rows.slice(half);
  const lines = ["| 机制 | 主题 | 机制 | 主题 |", "|---|---|---|---|"];
  for (let i = 0; i < half; i++) {
    const a = left[i];
    const b = right[i];
    lines.push(
      `| ${a.connects} | ${a.zh} | ${b ? b.connects : ""} | ${b ? b.zh : ""} |`,
    );
  }
  return lines.join("\n");
}

/** 生成"机制 → 主题 id"的一行式说明（给 SKILL.md 的选主题一节用） */
function inlineList(rows) {
  return rows.map((r) => `${r.connects}(${r.zh})`).join(" / ");
}

/**
 * README 用的三列表：机制 / 主题 / 它在演示什么。
 *
 * 第三列取主题文件里的 `mood`，**不是手写的转述**。
 * 这一列原本是手抄的，漂得比机制名还厉害 —— 核验时发现三处说的是别的东西：
 *   - fiber 写成"单根很弱，绞在一起才承重"（那是绳子/钢缆，代码画的是
 *     光在纤维内部反复反射、只在末端泄漏，与"约束"这个机制无关）；
 *   - synapse 写成"信号在两侧之间来回，直到留下痕迹"（那是 echo 的"延迟"）；
 *   - aurora 写成"我被同一类东西反复吸引"（代码画的是场线把粒子塑形）。
 * `mood` 就在主题文件里、由作者维护，取它就不会与画法脱节。
 */
function readmeTable(rows) {
  const lines = ["| 机制 | 主题 | 它在演示什么 |", "|---|---|---|"];
  for (const r of rows) lines.push(`| ${r.connects} | \`${r.id}\` ${r.zh} | ${r.mood} |`);
  return lines.join("\n");
}

const rows = await collect();
const ALL_TABLE = table(rows);
const INLINE = inlineList(rows);

// 每份文档用哪种表：README 的表带"在演示什么"、按主题 id 分组表达，
// SKILL.md / DESIGN.md 用紧凑的两组一行式（它们是给人速查的）。
const targets = [
  { rel: "SKILL.md", render: () => ALL_TABLE },
  { rel: "references/DESIGN.md", render: () => ALL_TABLE },
  { rel: "README.md", render: () => readmeTable(rows) },
];

// 两张表在文档里的位置：用注释标记围起来，生成器只替换标记之间的内容。
// 没有标记就不动它 —— 宁可漏改，也不要误伤别的段落。
const START = "<!-- gen:tables:start -->";
const END = "<!-- gen:tables:end -->";

let changed = 0;
let missing = [];

for (const { rel, render } of targets) {
  const p = resolve(here, rel);
  let s = readFileSync(p, "utf8");
  const a = s.indexOf(START);
  const b = s.indexOf(END);
  if (a === -1 || b === -1) {
    missing.push(rel);
    continue;
  }
  const block = `${START}\n${render()}\n${END}`;
  const next = s.slice(0, a) + block + s.slice(b + END.length);
  if (next !== s) {
    changed++;
    if (!CHECK) writeFileSync(p, next);
  }
}

if (CHECK) {
  if (missing.length) {
    console.log(`  ✗ 找不到表格标记：${missing.join(", ")}（需要 ${START} / ${END}）`);
    process.exit(1);
  }
  if (changed) {
    console.log(`  ✗ 机制表与主题文件不一致（${changed} 处）—— 跑 node bin/gen-tables.mjs 重写`);
    process.exit(1);
  }
  console.log("  机制表与主题文件一致");
  process.exit(0);
}

if (missing.length) {
  console.log(`警告：以下文档没有表格标记，未处理：${missing.join(", ")}`);
}
console.log(`机制表已更新（${rows.length} 种机制，${changed} 处变更）`);
console.log(`\n${INLINE}\n`);
