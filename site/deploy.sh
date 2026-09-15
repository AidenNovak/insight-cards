#!/usr/bin/env bash
#
# 把 site/ 发到 skill.sg.aidenovak.com（vultr-sg 上的静态站）。
#
# 这个脚本只管**发布**，不管 DNS：A 记录要在 Cloudflare 上指向 45.76.152.44，
# 而且必须在签证书**之前**就生效（certbot 用 nginx 认证器，要走 80 端口验证）。
#
# 用法：
#   site/deploy.sh            # 同步 + 装 vhost + 签证书（如缺）+ reload + 验收
#   site/deploy.sh --sync     # 只同步文件
#   site/deploy.sh --check    # 只看现状，不改任何东西
#
# 幂等：重复跑不会重复签证书、不会重装已存在的 vhost（内容不同时才覆盖并 reload）。
set -euo pipefail

REMOTE="${REMOTE:-vultr-sg}"
HOST_NAME="${HOST_NAME:-skill.sg.aidenovak.com}"
WEB_ROOT="/var/www/$HOST_NAME"
VHOST="/etc/nginx/sites-available/$HOST_NAME"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '\033[2m%s\033[0m\n' "$*"; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

MODE="deploy"
case "${1:-}" in
  --sync) MODE="sync" ;;
  --check) MODE="check" ;;
  "") ;;
  *) die "未知参数：$1" ;;
esac

# ── 只同步「页面要用的东西」 ──────────────────────────────────────────────
# build-images.mjs / shot.mjs 是本地工具，README 是给人看的，都不必上线。
sync_site() {
  log "→ 同步页面到 $REMOTE:$WEB_ROOT"
  ssh "$REMOTE" "mkdir -p '$WEB_ROOT'"
  rsync -az --delete \
    --exclude '*.mjs' \
    --exclude 'README.md' \
    --exclude 'nginx-*.conf' \
    --exclude 'deploy.sh' \
    "$HERE/" "$REMOTE:$WEB_ROOT/"
}

check_state() {
  ssh "$REMOTE" bash -s <<EOF
set -uo pipefail
echo "DNS:   \$(getent hosts $HOST_NAME | head -1 || echo 未解析)"
echo "vhost: \$([ -f '$VHOST' ] && echo 已安装 || echo 未安装)"
echo "cert:  \$([ -d /etc/letsencrypt/live/$HOST_NAME ] && echo 已签发 || echo 未签发)"
echo "root:  \$([ -d '$WEB_ROOT' ] && ls '$WEB_ROOT' | wc -l || echo 0) 个文件"
EOF
}

install_vhost_and_cert() {
  # 1) DNS 必须先通，否则 certbot 会把失败的验证写进限流计数。
  if ! ssh "$REMOTE" "getent hosts $HOST_NAME >/dev/null"; then
    die "$HOST_NAME 还没解析。先在 Cloudflare 加 A 记录指向 45.76.152.44，等生效后再跑。"
  fi

  have_cert() { ssh "$REMOTE" "test -d /etc/letsencrypt/live/$HOST_NAME"; }
  put_vhost() {  # $1 = 本地 conf 文件名
    if ssh "$REMOTE" "test -f '$VHOST' && cmp -s - '$VHOST'" < "$HERE/$1"; then
      log "vhost 已是当前版本，跳过"
    else
      log "→ 安装 vhost（$1）"
      ssh "$REMOTE" "cat > '$VHOST'" < "$HERE/$1"
      ssh "$REMOTE" "ln -sf '$VHOST' /etc/nginx/sites-enabled/$HOST_NAME"
    fi
  }

  # 2) 没有证书时**必须先上 HTTP-only 版本**：完整版写死了
  #    `ssl_certificate /etc/letsencrypt/live/<host>/...`，证书还不存在时
  #    `nginx -t` 直接失败（cannot load certificate），certbot 也就无从下手。
  #
  #    另一件坑：这里**绝不能用 `certbot --nginx`**。这台主机的 443 由 nginx
  #    stream 的 SNI 分流占着（default → 127.0.0.1:9443），certbot 的 nginx
  #    安装器会往 vhost 里塞 `listen 443 ssl`，和 stream 抢同一个端口 ——
  #    第一次部署就是这么踩的。所以用 **webroot** 认证器 + 自己在 9443 上收 TLS。
  if ! have_cert; then
    put_vhost "nginx-$HOST_NAME.http.conf"
    ssh "$REMOTE" "nginx -t && systemctl reload nginx" || die "nginx -t 失败（HTTP-only 版），已保持原状"
    log "→ 签发证书（certbot certonly --webroot）"
    ssh "$REMOTE" "certbot certonly --webroot -w /var/www/html -d $HOST_NAME \
      --non-interactive --agree-tos 2>&1 | tail -3"
    have_cert || die "证书仍未签发，检查 $HOST_NAME 的解析与 80 端口"
  fi

  # 3) 装完整版（80 跳转 + 9443 ssl），测试通过才 reload。
  put_vhost "nginx-$HOST_NAME.conf"
  ssh "$REMOTE" "nginx -t && systemctl reload nginx" || die "nginx -t 失败，已保持原状"
}

verify() {
  log "→ 验收"
  ssh "$REMOTE" bash -s <<EOF
set -uo pipefail
code=\$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: $HOST_NAME' http://127.0.0.1/ )
echo "  http 重定向: \$code"
code=\$(curl -sk -o /dev/null -w '%{http_code}' --resolve $HOST_NAME:443:127.0.0.1 https://$HOST_NAME/)
echo "  https 首页: \$code"
title=\$(curl -sk --resolve $HOST_NAME:443:127.0.0.1 https://$HOST_NAME/ | grep -o '<title>[^<]*' | head -1)
echo "  页面标题: \$title"
for f in styles.css cards.json assets/cards/fireflies.jpg favicon.png assets/og.png; do
  c=\$(curl -sk -o /dev/null -w '%{http_code}' --resolve $HOST_NAME:443:127.0.0.1 https://$HOST_NAME/\$f)
  echo "  \$f: \$c"
done
EOF
}

case "$MODE" in
  check) check_state ;;
  sync)  sync_site ;;
  deploy)
    sync_site
    install_vhost_and_cert
    verify
    log "✓ https://$HOST_NAME/"
    ;;
esac
