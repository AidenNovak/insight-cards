#!/usr/bin/env bash
#
# 核对「线上 == 仓库」：把站点上每个文件抓回来，与仓库里的同名文件比 sha256。
#
# 为什么要按文件比对而不是只看 200：部署脚本 rsync 的是 site/ 目录，
# 但线上被谁改过、缓存有没有更新、有没有漏传一个文件，200 都答不了。
#
# 用法：site/check-live.sh [https://skill.sg.aidenovak.com/]
set -uo pipefail
BASE="${1:-https://skill.sg.aidenovak.com/}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FILES=(index.html styles.css cards.json favicon.png assets/og.png assets/cards/fireflies.jpg assets/cards/lattice.jpg)

sha() { shasum -a 256 "$1" | cut -c1-12; }

printf '%-28s %-14s %-14s %s\n' 文件 线上 仓库 一致
for f in "${FILES[@]}"; do
  tmp=$(mktemp)
  code=$(curl -s -o "$tmp" -w '%{http_code}' "$BASE$f")
  live=$(sha "$tmp")
  local_sha=$(sha "$HERE/$f")
  ok="✗"
  [ "$code" = "200" ] && [ "$live" = "$local_sha" ] && ok="✓"
  printf '%-28s %-14s %-14s %s (HTTP %s)\n' "$f" "$live" "$local_sha" "$ok" "$code"
  rm -f "$tmp"
done
printf '\n页面标题：'
curl -s "$BASE" | grep -o '<title>[^<]*' | head -1
printf 'HTTP 跳转：'
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' "${BASE/https:/http:}"
