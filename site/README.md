# 落地页

这个目录是给 **insight-cards** 做对外说明的静态页：一个人第一次听说这套东西时，
五分钟内能看懂它是干什么的、凭什么可信、怎么用起来。

它**不属于技能本体**（`Tools/install-skill.sh` 不拷这个目录）：agent 用不到它，
装进技能目录只是白占空间。

## 内容与来源

页面上的每个事实都能在仓库里找到出处，不写"效果震撼""上千用户"这类话：

| 页面上的东西 | 出处 |
|---|---|
| 十八种机制与主题 | `packages/engine/themes/*.mjs` 的 `meta`（`bin/gen-tables.mjs` 生成的表） |
| "图和字是同一件事说两遍" | `references/DESIGN.md` 第一节 |
| 冷启动试用与四轮核验的结论 | `trials/cold-start/README.md` + `VERIFICATION-1..4.md` |
| 命令与安装方式 | `SKILL.md` 的 Quick Start、`Tools/install-skill.sh --help` |
| 画廊那十二张卡 | `site/build-images.mjs` 现渲染，文案写在本脚本的 `CARDS` 里 |

## 两个脚本

```bash
node site/build-images.mjs      # 渲染画廊 + OG 图 → site/assets/ ，清单 → site/cards.json
node site/shot.mjs --url http://127.0.0.1:8791/   # 1440 / 390 两个宽度各出一张全页图
```

**为什么图要单独渲染一遍**：`registry/` 里是 2160×2880 的成品 PNG，每张 2 MB 上下，
当网页图会拖垮首屏。这里统一渲染 → 缩到 720 宽 → JPEG q82，每张 40–90 KB。

## 本地看

```bash
cd site && python3 -m http.server 8791 --bind 127.0.0.1
# 打开 http://127.0.0.1:8791/
```

**必须起服务器**：画廊是 `fetch("cards.json")` 之后填的，`file://` 下会被 CORS 挡掉，
只剩一个空网格。截图验收时加 `?eager=1`：全页截图不一定触发懒加载，画廊会拍成空框。

## 部署

已经上线：**https://skill.sg.aidenovak.com/**（vultr-sg 上的静态站）。

```bash
site/deploy.sh            # 同步 + 装 vhost + 签证书（如缺）+ reload + 验收
site/deploy.sh --sync     # 只同步文件
site/deploy.sh --check    # 只看现状（DNS / vhost / 证书 / 文件数）
```

`deploy.sh` 把 `site/` 里**页面要用的东西**同步到 `/var/www/skill.sg.aidenovak.com/`，
排除 `*.mjs`、`README.md`、`nginx-*.conf`、`deploy.sh` 这些本地工具。

### 这台主机的两条硬规矩（踩过）

1. **站点监听 9443，不是 443。** 443 被宿主 nginx 的 `stream` 段占着做 SNI 分流
   （`www.samsung.com` → Xray REALITY，`default` → `127.0.0.1:9443`）。vhost 写
   `listen 127.0.0.1:9443 ssl http2`，80 段只做 ACME challenge 与跳转。
2. **不要用 `certbot --nginx`，用 `certbot certonly --webroot`。**
   第一次部署就是 `--nginx`：它的安装器往 vhost 里塞了 `listen 443 ssl`，和 stream
   抢同一个端口；而且完整版 vhost 写死了还不存在的证书路径，`nginx -t` 直接失败，
   形成"要证书才能测配置、要改配置才能签证书"的死结。现在的顺序是：
   先上 HTTP-only 版 → `certbot certonly --webroot -w /var/www/html` → 再上完整版。
   续期配置因此是 `authenticator = webroot`（`certbot renew --dry-run` 验过），
   certbot 不会再改 nginx 配置。

DNS 不在脚本里管：A 记录 `skill.sg.aidenovak.com → 45.76.152.44` 要在
**签证书之前**就在 Cloudflare 上生效。

## 还没做的

- 英文版。现在是中文（主题名保留中英双语），要面向英文读者得再写一遍文案。
- favicon 与社交卡片的更新脚本：`assets/og.png` 是 `build-images.mjs` 生成的，
  换标题要重跑脚本，不是手改。
