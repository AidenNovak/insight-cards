#!/usr/bin/env bash
#
# 把 insight-studio 装成一个可由 agent 调用的 skill。
#
# 为什么是**复制**而不是软链：走查过的 skill 都是以真实目录存在的，
# 没有符号链接的先例。链接是否被技能发现逻辑跟随，没法在这里验证 ——
# 那就不赌，用复制。代价是编辑之后要重跑一次这个脚本，一条命令的事。
#
# 用法：
#   Tools/install-skill.sh            # 安装（覆盖已有的同名 skill）
#   Tools/install-skill.sh --check    # 只检查，不写
#   Tools/install-skill.sh --uninstall
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_ROOT="${DIM_SKILLS_DIR:-$HOME/.dimcode/v2/skills}"
DEST="$DEST_ROOT/insight-cards"

log() { printf '\033[2m%s\033[0m\n' "$*"; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

# 装什么：跑这张卡真正需要的东西，**外加开发者工具**。
#
# `Tools/` 必须装上。曾经没装，后果是一个陌生 agent 实测踩到的：
#   - SKILL.md 的"批量渲染放到服务器上"整节不可用；
#   - 故障排查里让人跑的 `node Tools/dbg-theme.mjs` 不存在；
#   - `gallery.mjs` 生成出来是"0 个板块"的空页（它找不到 registry/）。
# 结论：文档里提到的路径，装的时候都得在，否则文档就是空头支票。
#
# **不装 out/**（渲染产物，几十 MB，可重建）。
# registry/ 装 —— 它是排好的成品 deck，gallery.mjs 依赖它，也是让人一眼看到效果的东西。
FILES=(
  SKILL.md
  README.md
  references
  packages
  bin
  Tools
  registry
)

cmd_check() {
  [ -f "$HERE/SKILL.md" ] || die "找不到 $HERE/SKILL.md —— 这个脚本必须在仓库里跑"
  # 技能清单必须有 name 和 description，否则 agent 看不到它
  head -5 "$HERE/SKILL.md" | grep -q '^name:' || die "SKILL.md 缺 name 字段"
  head -5 "$HERE/SKILL.md" | grep -q '^description:' || die "SKILL.md 缺 description 字段"
  for f in "${FILES[@]}"; do
    [ -e "$HERE/$f" ] || die "缺文件：$f"
  done
  # macOS 自带 du 不认 --exclude，直接量整个目录（node_modules 不在仓库里）
  log "✓ 源文件完整（$(du -sh "$HERE" 2>/dev/null | cut -f1 || echo '?')）"
  log "✓ 目标目录：$DEST"
  [ -d "$DEST" ] && log "! 目标已存在，安装会覆盖它"
  return 0
}

cmd_install() {
  cmd_check
  mkdir -p "$DEST"
  for f in "${FILES[@]}"; do
    log "→ $f"
    rsync -a --delete "$HERE/$f" "$DEST/" 2>/dev/null ||
      cp -R "$HERE/$f" "$DEST/"
  done
  # 版本标记：以后要判断装的是哪一版，看这个
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$DEST/.installed-at"
  log "✓ 已装到 $DEST"
  log "  用 node $DEST/bin/make-card.mjs --themes 验证"
}

cmd_uninstall() {
  [ -d "$DEST" ] || { log "没装过"; exit 0; }
  read -r -p "确认删除 $DEST ？[y/N] " ans
  [ "$ans" = "y" ] || { log "已取消"; exit 0; }
  rm -rf "$DEST"
  log "已删除"
}

case "${1:-}" in
  --check)     cmd_check ;;
  --uninstall) cmd_uninstall ;;
  *)           cmd_install ;;
esac
