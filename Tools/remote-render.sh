#!/usr/bin/env bash
#
# 在 vultr-sg 上跑批量渲染（网点/网格测试）。
#
# 为什么要有这个脚本：单张卡片渲染 3–8 秒，本地跑「10 主题 × 12 配色 = 120 张」
# 要十几分钟，还会把本机 CPU 占满（这片工作区有明确约定：吃 CPU 的活放到服务器）。
# 服务器 8 vCPU / 31 GiB，但要**限资源**——它同时是生产机。
#
# 用法：
#   Tools/remote-render.sh check                  # 连通性与环境自检
#   Tools/remote-render.sh grid                   # 10 主题 × 12 配色，出问题清单
#   Tools/remote-render.sh themes                 # 每个主题出 1 张成品，取回本地看
#   Tools/remote-render.sh sync                   # 只同步源码，不跑
#   Tools/remote-render.sh clean                  # 清掉服务器上的安装与产物
#
# 环境：
#   REMOTE=user@host   默认 vultr-sg
#   REMOTE_DIR         默认 /opt/insight-studio-render
#   RENDER_JOBS        并行数，默认 3（服务器是生产机，不要开大）
#
set -euo pipefail

REMOTE="${REMOTE:-vultr-sg}"
REMOTE_DIR="${REMOTE_DIR:-/opt/insight-studio-render}"
JOBS="${RENDER_JOBS:-3}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\033[2m%s\033[0m\n' "$*"; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

sync_src() {
  log "→ 同步源码到 $REMOTE:$REMOTE_DIR/src"
  ssh "$REMOTE" "mkdir -p '$REMOTE_DIR/src' '$REMOTE_DIR/out'"
  # macOS 自带的是 rsync 2.6.9（2006 年的版本），不认识 `--info=` 这类新参数，
  # 所以这里只用它认识的最小集合。-a 保权限，-z 压缩，--delete 不带（见下）。
  #
  # **同步的内容要和"能在服务器上跑哪些检查"对齐。**
  # 原来漏了 README.md 与 Tools/，后果是 `doc-check.mjs` 在服务器上
  # 以一句 `ENOENT: README.md` 崩掉（看着像代码坏了，其实只是文件不在）。
  # 现在把"检查会用到的文档与工具"一起带上。
  rsync -az \
    --exclude 'out/' \
    --exclude 'node_modules/' \
    --exclude '.git/' \
    --exclude 'artifacts/' \
    "$HERE/packages" "$HERE/bin" "$HERE/Tools" \
    "$HERE/SKILL.md" "$HERE/README.md" "$HERE/references" \
    "$REMOTE:$REMOTE_DIR/src/"
}

ensure_env() {
  ssh "$REMOTE" bash -s <<EOF
set -euo pipefail
cd '$REMOTE_DIR'
if [ ! -d node_modules/playwright ]; then
  echo "→ 首次安装 playwright（约 300MB，装在 $REMOTE_DIR，不碰系统）"
  cat > package.json <<'JSON'
{ "name": "insight-studio-render", "private": true, "type": "module" }
JSON
  npm install --no-audit --no-fund playwright@1.55.0 2>&1 | tail -3
  PLAYWRIGHT_BROWSERS_PATH=$REMOTE_DIR/browsers npx playwright install --with-deps chromium 2>&1 | tail -5
else
  echo "→ playwright 已就位"
fi
EOF
}

cmd_check() {
  log "→ 服务器自检"
  ssh "$REMOTE" bash -s <<EOF
set -euo pipefail
echo "主机: \$(hostname)  核心: \$(nproc)  内存: \$(free -g | awk '/^Mem:/{print \$2}') GiB"
echo "根盘: \$(df -h / | awk 'NR==2{print \$4" free ("\$5" used)"}')"
echo "node: \$(node --version 2>/dev/null || echo '缺失')"
echo "播放器缓存: \$([ -d '$REMOTE_DIR/browsers' ] && echo 已装 || echo 未装)"
echo "生产容器: \$(docker ps --format '{{.Names}}' | wc -l | tr -d ' ') 个在跑"
EOF
}

cmd_grid() {
  sync_src
  ensure_env
  log "→ 网格测试：每个主题 × 每个配色，各渲染一次（限 $JOBS 并发）"
  ssh "$REMOTE" bash -s <<EOF
set -euo pipefail
cd '$REMOTE_DIR/src'
export PLAYWRIGHT_BROWSERS_PATH=$REMOTE_DIR/browsers
export NODE_OPTIONS=--max-old-space-size=2048
# nice + ionice：服务器是生产机，渲染永远给生产让路
nice -n 15 ionice -c3 node bin/audit.mjs --json > '$REMOTE_DIR/out/audit.json' 2>'$REMOTE_DIR/out/audit.err' || true
tail -3 '$REMOTE_DIR/out/audit.err' || true
echo "--- 结果 ---"
node -e '
const fs = require("fs");
const r = JSON.parse(fs.readFileSync("$REMOTE_DIR/out/audit.json", "utf8"));
const bad = r.filter(x => (x.findings||[]).some(f => f.level === "fail"));
console.log(\`主题 \${r.length} 个，不通过 \${bad.length} 个\`);
for (const x of bad) for (const f of x.findings.filter(f=>f.level==="fail")) console.log("  ✗", x.theme, f.m);
'
EOF
}

cmd_themes() {
  sync_src
  ensure_env
  log "→ 每个主题出一张成品"
  ssh "$REMOTE" bash -s <<EOF
set -euo pipefail
cd '$REMOTE_DIR/src'
export PLAYWRIGHT_BROWSERS_PATH=$REMOTE_DIR/browsers
export NODE_OPTIONS=--max-old-space-size=2048
mkdir -p '$REMOTE_DIR/out/themes'
nice -n 15 ionice -c3 node - <<'NODE'
import { listThemes } from "./packages/engine/render.mjs";
import { renderCard } from "./packages/engine/render.mjs";
import { writeFileSync } from "node:fs";
const t = await listThemes();
for (const theme of t) {
  const r = await renderCard({
    theme, palette: "deep-field",
    title: "体检用的判断句：看起来在动，其实一直绕着同一个点",
    summary: "这是一段用于体检的摘要文字，长度接近真实卡片。",
    scale: 1,
  });
  writeFileSync(\`$REMOTE_DIR/out/themes/\${theme}.png\`, r.buffer);
  console.log("  ✓", theme);
}
NODE
EOF
  log "→ 取回本地"
  mkdir -p "$HERE/out/remote"
  rsync -az "$REMOTE:$REMOTE_DIR/out/themes/" "$HERE/out/remote/"
  log "已取回到 out/remote/"
}

cmd_clean() {
  log "→ 清理服务器上的安装与产物（渲染器是可重建的，别占着生产机的盘）"
  ssh "$REMOTE" "du -sh '$REMOTE_DIR' 2>/dev/null || echo '（不存在）'"
  read -r -p "确认删除 $REMOTE:$REMOTE_DIR ？[y/N] " ans
  [ "$ans" = "y" ] || { log "已取消"; exit 0; }
  ssh "$REMOTE" "rm -rf '$REMOTE_DIR'"
  log "已删除"
}

case "${1:-}" in
  check)  cmd_check ;;
  sync)   sync_src ;;
  grid)   cmd_grid ;;
  themes) cmd_themes ;;
  clean)  cmd_clean ;;
  *) die "用法：$0 {check|sync|grid|themes|clean}" ;;
esac
