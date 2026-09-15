# Insight Cards

**用代码算出画面，用排版排出判断。整条链路没有生图模型。**

> 落地页：<https://skill.sg.aidenovak.com/> ·
> 装成 skill：`git clone https://github.com/AidenNovak/insight-cards && cd insight-cards && Tools/install-skill.sh`

一张卡分两半：上面是算出来的画，下面是一句判断。这套东西的前提是——
**图和字必须是同一件事说两遍。** 画面不是配图，是这句话的机制用另一套符号重述了一遍。

```
┌──────────────────────┐
│                      │
│      算出来的画面      │   主题（theme）：谁在动、怎么动
│      （Canvas2D）     │
│                      │
├──────────────────────┤
│ 01 / 10     〔机制〕   │   ← 页眉：序号 + --kicker（**默认空**，要自己传）
│                      │
│ 突破不是积累的结果，    │   ← title：一句判断
│ 是积累到某一点之后的击穿 │
│                      │
│ 你总是想要渐变式的进步。 │   ← summary：这句话凭什么成立
│ 但空气不会慢慢变成导体…│
│                      │
│ 焰心 CORE    临界、白热 │   ← 页脚：配色名 + --footer（默认用配色的情绪词）
└──────────────────────┘
```

上面方框里的「机制」「序号」都是**要自己传参**的：`--kicker "击穿" --index 3 --total 10`。
不传 `--kicker` 时页眉右侧是空的（这条被一个试用者指出来过 —— 他照这张图做，
以为机制名会自动出现）。

## 快速开始

```bash
node bin/make-card.mjs --themes              # 看有哪些主题
node bin/make-card.mjs --palettes            # 看有哪些配色

node bin/make-card.mjs \
  --theme strata --palette bone \
  --title "每一层都薄得不像话，但它们摞成了时间" \
  --summary "你回头看某一年，想找出决定性的那一刻，结果什么也没找到——那是一层不到一毫米的沉积。" \
  --out out/card.png
```

输出 1080×1440 @2x。单张渲染 1–3 秒。

```bash
node bin/make-deck.mjs --preset nexus --out out/nexus         # 一整套
node bin/make-deck.mjs --preset undertow --out out/undertow
node bin/make-deck.mjs --preset structure --out out/structure
```

## 规模

**18 个主题**，每一个演示「连接」的一种不同机制：

<!-- gen:tables:start -->
| 机制 | 主题 | 它在演示什么 |
|---|---|---|
| 约束 | `fiber` 光纤 | 光被束成弧线，只在自由的末端显露 |
| 共振 | `resonance` 共鸣 | 两样东西各自在动，直到它们开始互相加强 |
| 共生 | `orbit` 双星 | 两个都在动的东西，被同一个中心拴着 |
| 延迟 | `echo` 回响 | 你发出的东西，很久之后才回到你这里 |
| 击穿 | `discharge` 放电 | 积累到某一点之后的突然贯通 |
| 引力 | `nebula` 星云 | 巨大的物质在缓慢塌缩成形 |
| 轴心 | `startrails` 星轨 | 动了很多，但一直绕着同一个点 |
| 注视 | `starfield` 星野 | 散落的恒星被想象连成一个形状 |
| 结晶 | `lattice` 晶格 | 散乱的原料，在某个瞬间开始有秩序 |
| 磁场 | `aurora` 极光 | 看不见的场，把光折成有远近的帘幕 |
| 折射 | `prism` 棱镜 | 同一束光进去，出来时被拆成了它的组成 |
| 扩散 | `ink` 水中墨 | 一滴密实的墨，在逆光里散成无数细丝 |
| 堆积 | `strata` 沉积 | 每一层都薄得不像话，但它们摞成了时间 |
| 周期 | `tide` 潮汐 | 被一个更大的东西定期带着走 |
| 累积 | `tideline` 潮痕 | 每一条痕都很浅，但它们记着每一次来过 |
| 激发 | `synapse` 突触 | 两个念头靠得足够近时亮起来 |
| 交换 | `mycelium` 菌丝 | 黑暗里，细小的交换养成明亮的结点 |
| 同步 | `fireflies` 萤火 | 雾中的光点，在彼此的节拍里忽明忽暗 |
<!-- gen:tables:end -->

**18 组配色**，每一组是一种语气（不是装饰）：

深空 / 深海 / 极光 / 霜 / 焰心 / 琥珀 / 黄铜 / 余烬 / 日蚀 / 紫夜 / 苔原 / 石墨 /
生物光 / 锈蚀 / 夜酒 / 骨 / 苔藓 / 霓虹

同一句判断配不同的配色，读者听到的是不同的话——
「深空」里是冷静观察，「余烬」里是警告，「琥珀」里是隔着一层时间的叹息。
**配色是语气，不是装饰。**

## 为什么不用生图模型

- **算出来的图是程序，改一个参数就能看它怎么变；生出来的图是一个既定事实，改不动。**
- 判断句必须精确到字。交给图像模型，它会写错别字、会加装饰、会被光泽带走。
- 同一个判断要能换十几套配色、十几个意象重新出片，而版式一丝不变。

## 设计

**暗是舞台，光是主角。** 深色不是风格，是功能：白纸上的白色不是光，是空白；
只有在暗处，一点亮才真的是亮。由此得到四条不能违反的东西——底色不能是纯黑、
光必须照亮周围、只有一个主光、暗部要有层次。

**图和字必须是同一件事说两遍。** 判断句说「散着的时候什么都不是，聚起来才有形状」，
画面就是星云——不是说"连接很重要"，而是在演示连接**怎么发生**。

完整的推导、以及"怎么判断一张卡做得好不好"的四个问题，见
[`references/DESIGN.md`](references/DESIGN.md)。

## 校验

六个工具，各查一件事。它们查的都是**客观可测**的项，主观的好坏只能靠看。

| 工具 | 查什么 | 为什么需要 |
|---|---|---|
| `audit.mjs` | 确定性、配色响应（含"主体颜色写死了没"）、暗部占比、几何独立性 | 一个主题可以画得好看但每次都不一样，那就没法调参 |
| `grid.mjs` | 全网格能不能都渲染出来、版式会不会溢出 | 某个主题撞上某个配色才崩的情况，单独测发现不了 |
| `readability.mjs` | 文字底下的背景有多亮（WCAG 对比度） | `poster` 的"靠遮罩拿可读性"在这之前从未被验证过 |
| `palette-check.mjs` | 配色之间是否真的可分 + 结构约定 | 两组配色要是看着一样，用户选了等于没选 |
| `doc-check.mjs` | 文档与代码是否一致；同一套 deck 内配色是否撞车 | 已经漏过：帮助文本写了不存在的 `--deck`，`--kicker` 能跑却没人知道 |
| `gen-tables.mjs` | 从主题文件生成机制表 | 手抄的两张表行序不一致、数字过期（写"十四种"时已有十八种） |

```bash
node bin/audit.mjs            # 确定性、配色响应、几何独立性（每个主题）
node bin/grid.mjs             # 全网格：18 主题 × 18 配色 × 3 文案长度
node bin/readability.mjs      # 文字可读性（WCAG 对比度，量文字底下的背景）
node bin/palette-check.mjs    # 配色之间是否真的可分 + 结构约定
node bin/doc-check.mjs        # 文档与代码是否一致（参数名、命令名、数量声明、机制表）
node bin/gen-tables.mjs       # 从主题文件重新生成机制表（加了新主题就要跑）
```

`grid.mjs` 挑文案长度是有意的：**短句最容易暴露问题**（标题不满一行时版式容易失去重心），
长段落则考察溢出与折行。

看图用这四个：

```bash
node bin/gallery.mjs --out out/gallery.html                     # 可离线打开的画廊页
node bin/contact-sheet.mjs --preset nexus --out out/sheet.png   # 整套并排，看协调性
node bin/palette-sheet.mjs --out out/palettes.png               # 全部配色并排
node Tools/thumb-sheet.mjs orbit synapse --palette abyss        # 缩略图尺度（200px）并排
```

**缩略图那条要看真的 200px。** `Tools/thumb-sheet.mjs` 把主题按真实配色渲染、
缩到 200px 宽并排成一张图 —— 信息流里卡片就是这个尺寸。
实测踩过一次：`orbit` 的轨道线参数（1.3 单位宽）在全尺寸下没问题，
缩到 200px 只剩 0.24 像素，画面只剩两个亮点，而它的机制全在那条线上。
**"极细极淡"这类判断必须在最终会被看到的尺寸上做。**

**协调是整体的性质，只有并排才看得出来**——单张一张张看，看不出哪几张暗了、哪几张太满。

`gallery.mjs` 生成一个 HTML，用相对路径引用 `registry/` 与 `out/` 里的图，
不内联 base64（内联会让文件大到几十 MB，改一张图就得整页重生成）。
浏览器直接打开即可，不需要起服务。

### 远程渲染

`Tools/remote-render.sh` 把批量渲染放到 `vultr-sg` 上跑（8 vCPU / 31 GiB）。

```bash
Tools/remote-render.sh check     # 环境自检
Tools/remote-render.sh sync      # 只同步源码
Tools/remote-render.sh grid      # 全网格，出问题清单
Tools/remote-render.sh themes    # 每个主题一张成品，取回 out/remote/
Tools/remote-render.sh clean     # 清掉服务器上的安装与产物
```

单张 1–3 秒，本地跑 972 张要十几分钟还会占满 CPU。服务器上跑完约 6 分钟，
用 `nice`/`ionice` 让路给生产容器。

## 加一个新主题

主题是一个 `.mjs` 文件，放在 `packages/engine/themes/`。
**写之前先读 [`references/THEME-SPEC.md`](references/THEME-SPEC.md)**（接口契约、技法、自检清单）。

三条硬约束，违反就不是模板、只是一张图：

1. **不许写死颜色。** 一切从 `palette` 派生。
2. **不许用 `Math.random()`。** 必须用注入的 `rng`，否则同一输入每次渲染都不同。
3. **不许 `import`。** kit 与 rng 的导出会被注入到作用域。

写新主题前先确定 `meta.connects`——**它必须和已有的每一种机制都不一样**
（`node bin/make-card.mjs --themes` 会列出当前全部机制；
`node bin/doc-check.mjs` 会检查有没有重复）。
如果写不出不同的机制，那大概率是在改配色，不是在加主题。

## 加一组新配色

改 `packages/engine/palettes.mjs`，然后跑 `node bin/palette-check.mjs`。

补配色时先问：**还有哪些情绪没有被任何一组表达过？**
"再挑几个好看的色"会得到一组互相分不出的配色——体检会告诉你哪些太近。

两条结构约定：`base` 必须近黑但有倾向（纯黑在屏幕上发死）；`stops` 最后一档要接近白
（否则光立不起来），第一档要够暗（否则暗部没有层次）。

## 一个真实用例

（在源码仓库的 `trials/cold-start/` 里，**下面这份是仓库的 README，
安装到技能目录时不会带上 `trials/`** —— 因为里面有真实的人写的私人笔记。）

`trials/cold-start/` 里有一组**冷启动试用**的产物：
六条未整理的原始笔记 → 六张卡，由另一个 agent 在**完全没有上下文**的情况下、
只靠这份文档做出来的。

它没有按题材表面相似去选主题。比如"我身上有五个缺点，其实是一个东西"
那条，按题材该配迷宫或岔路，它配了**晶格**——因为那句话的机制是
"成分没变，变的是它们的排列"。这说明文档里教的选主题方法（按机制配对）
是能被陌生人学会的。

试用暴露了七处真问题，其中一处很严重：**每张卡启停一次浏览器**，
导致最重的那个体检工具在本地全量模式下跑到 200 多张就资源耗尽中断——
也就是说，"文档推荐的校验流程"其实跑不完。

**而它的修法本身又留下了第二个同类问题**：当时修的是 renderCard 的**能力**
（加了 browser 参数），`grid` 与 `readability` 确实接上了，
但 `audit` / `make-deck` / `contact-sheet` 没接——全量 `audit` 是
18 主题 × 3 次渲染 = 54 次 Chromium 启停，实际跑会崩。
**能力具备了不等于问题消失了。** 第二次核验时才发现，现已全部接上。

其余六处（安装漏拷目录、路径依赖当前目录、机制表手抄会漂、命名冲突、
`--themes` 不打印最关键的那个字段、帮助文本与文档不一致）连同修法，
记在那个目录的 README 里，并加了工具长期守着。

**第三轮核验**（`trials/cold-start/VERIFICATION-3.md`）查的是另一件事：
自检清单里"缩到 200px 仍认得出主体"那一条**从来没有被真的执行过** ——
它没有自动判据（试过一个形态度量守不住，已删），于是"靠眼睛"在实践中
退化成了"看全尺寸图时在脑子里缩一下"。真的按 200px 走一遍，
18 个主题里有 3 个塌掉（`orbit` 只剩两个点、`echo` 只剩一团光斑、
`fireflies` 只剩一堆散点），根因都是**按画布比例缩放的尺寸在小尺寸下归零**。

同一次核验里还发现，上一轮为堵一个漏洞新加的判据**是假的**：
把主体颜色写死成纯红，它报 0%、全绿。原因是这套引擎几乎都走 alpha 合成，
`硬编码色 × α + 配色底 × (1−α)` 会让每个像素都跟着配色变 ——
逐像素比色的判据在这里量不到任何东西。改成量**亮部整体色相**后成立
（正常主题移动 151°–167°，写死主体掉到 8.6°/41°，阈值取 100°）。

**教训：一条新判据要先证明它会失败，再相信它会通过。**

**第四轮核验**（`trials/cold-start/VERIFICATION-4.md`）接着上一轮留下的
`fireflies` 走。上一轮记的方向是"给最亮的几颗加短拖尾"；真的量过之后，
**那条路没走** —— 短拖尾在语义上是"在飞"，而这个主题的 meta 说的是
"一起明灭"，静帧里两者互相抵消，且会撞上 `startrails` 的语言。
真正缺的是"同一片一起亮、别处刚暗下去"的静态补偿，落点在**雾层**：
雾按群落相位呼吸之后，200px 下的群落亮度差从 5.27 提到 10.89，
缩略图里读成"雾中萤火"，全尺寸反而没有变差（雾团没到星云、层次都在）。
同一轮里还发现 **registry 的成品 deck 停在 10:02**，引擎 10:09 之后的改动
三轮都没进图 —— 这次一并重新生成（渲染本身是确定性的，所以那 20 张的 diff
是真漂移，不是噪声）。

**一个教训：文档的漏洞要靠陌生人才能发现。** 我在这份文档上迭代了很多轮，
但每一条真问题都是不知道背景的人按文档做事时撞出来的。

（`trials/` 里是真实的人写的私人笔记，所以那份记录不适合直接公开 ——
仓库要推出去之前先按那里的提醒处理。）

## 目录

```
insight-studio/
├── SKILL.md                      技能说明（给 agent 看的入口）
├── README.md                     你在这里
├── references/
│   ├── DESIGN.md                 设计理念：为什么这套卡片长这样
│   └── THEME-SPEC.md             主题编写规范（写新主题前必读）
├── packages/engine/
│   ├── render.mjs                渲染器：主题 + 文案 → PNG
│   ├── kit.mjs                   绘图原语（glow / ramp / offscreen / grain / ...）
│   ├── rng.mjs                   确定性随机 + Perlin / fBm / warp 噪声
│   ├── palettes.mjs              18 组配色
│   ├── presets.mjs               整套 deck 的编排（4 套）
│   └── themes/*.mjs              18 个主题
├── bin/
│   ├── make-card.mjs             单张
│   ├── make-deck.mjs             整套
│   ├── audit.mjs                 确定性与配色响应
│   ├── grid.mjs                  全网格
│   ├── readability.mjs           文字可读性（WCAG）
│   ├── palette-check.mjs         配色可分性
│   ├── doc-check.mjs             文档与代码一致性
│   ├── gen-tables.mjs            从主题文件生成机制表
│   ├── contact-sheet.mjs         整套并排
│   ├── palette-sheet.mjs         配色并排
│   └── gallery.mjs               画廊 HTML
├── Tools/
│   ├── remote-render.sh          远程批量渲染
│   ├── install-skill.sh          装成 agent 可调的 skill
│   ├── thumb-sheet.mjs           缩略图（200px）并排，查缩略图生死线
│   └── dbg-theme.mjs             单主题调试（拿到真实报错）
├── registry/                     已排好的 deck 成品图（nexus / undertow / structure）
└── out/                          渲染产物（不进版本库）
```

## 依赖

只需要 Playwright（自带 Chromium）。渲染器会在缺依赖时报出可直接执行的修复命令。
