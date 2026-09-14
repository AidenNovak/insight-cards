/**
 * 浏览器宿主的查找与启动。
 *
 * 渲染需要真正的浏览器（Canvas 2D + 中文字形 + 系统字体栈），
 * 但 Playwright 未必装在项目里。按可靠性依次找：
 *   1. 项目自己的 node_modules
 *   2. npx 缓存（`npx playwright` 用过之后就在那里）
 *   3. 全局 npm 根
 * 都找不到时给出**可执行的**修复指令，而不是一句 ImportError。
 */
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);

function candidates() {
  const list = [];
  const home = homedir();

  // 1. 向上找项目里的 node_modules
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    list.push(join(dir, "node_modules", "playwright"));
    list.push(join(dir, "node_modules", "playwright-core"));
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  // 2. npx 缓存
  const npx = join(home, ".npm", "_npx");
  if (existsSync(npx)) {
    for (const entry of readdirSync(npx)) {
      list.push(join(npx, entry, "node_modules", "playwright"));
    }
  }

  // 3. 全局
  list.push("/opt/homebrew/lib/node_modules/playwright");
  list.push("/usr/local/lib/node_modules/playwright");

  return list;
}

let cached = null;

/** 返回 { chromium, source }。找不到就抛出带修复指令的错误。 */
export function loadPlaywright() {
  if (cached) return cached;
  const tried = [];
  for (const path of candidates()) {
    if (!existsSync(path)) continue;
    tried.push(path);
    try {
      const mod = require(path);
      if (mod.chromium) {
        cached = { chromium: mod.chromium, source: path };
        return cached;
      }
    } catch {
      // 装了但加载失败（版本不匹配等），继续找下一个
    }
  }
  throw new Error(
    [
      "找不到可用的 Playwright。卡片是用真实浏览器渲染的（Canvas + 中文字形），所以需要它。",
      "修复（任选其一）：",
      "  npx playwright install chromium        # 走 npx 缓存，最省事",
      "  npm i -D playwright && npx playwright install chromium",
      `已尝试的路径：\n  ${tried.slice(0, 8).join("\n  ") || "（无）"}`,
    ].join("\n"),
  );
}
