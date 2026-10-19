---
title: Headroom 跟进（九月）：从 56k 到 73k，一个压缩中间件如何长成 Agent 基础设施
description: 距离 7 月那篇跟进又过去两个半月，Headroom 涨到 73k stars、迭代到 v0.37。这期间发生的变化比 star 数更值得看——从"压缩工具"转向"带会话状态的压缩引擎"，以及它开始暴露的工程债。
date: 2026-09-21
tags: [ai, agent, context-engineering, token-optimization, open-source, headroom]
---

## 补一个背景

这条线我写过两次了：

- 6 月 19 日，[Headroom 深度解析（2026 版）](/StaryFall/posts/headroom-deep-dive/)，当时 17k stars；
- 7 月 5 日，[Headroom 跟进更新](/StaryFall/posts/headroom-follow-up-july/)，当时 56.7k stars，刚经历 repo 迁移和 Rust 核心重写。

现在是 9 月 21 日，**73,290 stars**（+29%），**5,636 forks**，最新版本 **v0.37.0**（8 月 27 日发布），代码库 80 MB 量级，Apache-2.0。

但说实话，star 数的边际信息量已经很低了。增长曲线还是那条陡线，没什么新东西可讲。真正值得写的是另外三件事：**产品形态变了**、**工程债开始显形**、**它开始碰别人不该碰的地方**。

## 形态变了：从"压缩函数"到"压缩会话"

7 月的时候，Headroom 的心智模型还是"一段中间件，插进去就开始省钱"——`compress(messages)` 或者一个代理端口。

v0.37 做了两件很小但方向性很强的改动：

- **`/v1/compress` 变成 session-aware**（sidecar 模式），并新增 `/v1/usage` 转发；
- **proxy 和 sidecar 的压缩统一到同一个 session engine 上**。

翻成大白话：以前它是"每次请求路过就压一下"的无状态工具，现在它开始**记住这条对话线上哪些字节已经压过、哪些是新增的**。官方 README 里对应的说法叫 **live-zone compression**——只压新增的部分（新的工具输出、最新一轮对话），冻结的前缀保持逐字节一致，这样 provider 的 KV-cache 前缀不会被打断，历史也不会被丢。

这个转变的意义比版本号大。无状态压缩的硬上限很低：你把前缀压了，prompt cache 就废了，省下来的 token 又赔进 cache miss 里。有状态之后，压缩和缓存才第一次变成可以同时成立的事。

## Cache：从"顺带提一句"变成主战场

如果只看这三个月 release notes 里出现频率最高的词，是 `cache`。挑几个有代表性的：

- **CacheAligner** 成为流水线第一环——它只做一件事：**标记**会打断 KV-cache 前缀的易变内容，从不改写 prompt；
- v0.31 一整串修复都在处理"压缩改写前缀导致 token 级缓存失效"，最后落到一个明确约束：**冻结区必须逐字节原样转发**；
- v0.33 修复缓存断点重锚时丢失 `cache_control` TTL 的问题；
- v0.36 把 `cache_control` 从语义缓存 key 里剥掉（它本来不该参与语义去重）；
- v0.36 的 net-cost mutation 门控改用 **1 小时 cache-write 档位**计价——因为高估了缓存写溢价，门控就会错误地拒绝本该执行的压缩。

这背后是一个挺清醒的认知：**在长会话场景里，token 成本的大头不是"上下文有多长"，而是"缓存有没有被打断"**。压缩工具如果只顾着减 token 而踩坏缓存，账面是省了，账单是亏了。

Headroom 现在的 savings 报告会区分 **net vs gross**，并且会显式暴露"压缩反而让请求变长"的情况（`tok_saved` 钳位吞掉的增长会被单独报出来）。这是个诚实的设计。

## 压缩器变成了插件

v0.33 落了一件事：**pluggable compressor registry + `headroom.compressor` entry point**。SmartCrusher、CodeCompressor、Kompress、text 全部通过 registry 分发，第三方可以注册自己的压缩器。

配套的还有：

- **`--compressor` 显式选择 + registry 清单**；
- **Rust 侧 parity 移植**：CodeCompressor 的 AST 压缩和 Kompress 的 ML 压prose 都往 Rust 搬了一遍（当前是 parity-only，即两边行为对齐、还没有完全替换）；
- **per-extension token savings 统计**——你现在能看到是 `.py` 文件省得多还是 `.json` 省得多。

插件化 + 按扩展名归因，这两件事通常出现在一个项目**从"我们自己的工具"变成"别人的平台"**的节点上。

## 准确率：终于有了可复现的口径

这是我要单独给分的一点。

7 月那篇我提的跟踪方向之一是"有没有可能出现压缩质量退化的正式 benchmark"。答案是有了，而且做法挺克制：

benchmarks 用固定 seed（`--seed 20260902`）、离线运行，四种场景都是拿真实 MCP server 输出格式构造的：

| 场景 | 压缩前 | 压缩后 | 节省 |
|---|---:|---:|---:|
| 代码搜索（100 条结果） | 17,199 | 13,597 | 21% |
| SRE 事故排查 | 55,957 | 24,340 | 57% |
| 代码库探索 | 58,801 | 33,895 | 42% |
| GitHub issue 分诊 | 46,067 | 32,429 | 30% |

准确率侧（`python -m headroom.evals suite --tier 1`，N=100）：

| Benchmark | 类别 | Baseline | Headroom | Delta |
|---|---|---:|---:|---:|
| GSM8K | 数学 | 0.870 | 0.870 | ±0.000 |
| TruthfulQA | 事实 | 0.530 | 0.560 | +0.030 |
| SQuAD v2 | 问答 | — | 97% | @19% 压缩率 |
| BFCL | 工具调用 | — | 97% | @32% 压缩率 |

值得表扬的地方不是数字好看，而是它**主动说明了 +0.030 落在置信区间内、不构成提升**。同时它也不再吹那个 60–95% 的区间数字，改成了"节省程度取决于你 payload 有多重复"——重复的 JSON 数组和日志行能过 90%，散文和本来就紧凑的输出几乎压不动。

从 6 月的"60–95% fewer tokens"到 9 月的这张表，是一次挺好的自我修正。

顺便，性能数字也补上了：**10K token 的 JSON 搜索结果压缩 p50 只用 0.21 ms，100K token 时 1.4 ms**。这个量级确实不会出现在 agent 延迟里。v0.35 还有一条 `perf: cut hot-path latency 27%`。

## 门槛在变高

得说句客观的：这个东西不再是"pip install 就完事"了。

- **`headroom` CLI 只在 PyPI 包里**，npm 上的 `headroom-ai` 只是 TypeScript SDK，**没有 CLI**。这个区分明确到要写进 release notes 的地步（v0.28 专门发了条 doc 说明），说明有人踩过坑。
- **`wrap` 会顺手装 Serena**（语义代码导航），并以 user scope 注册到 `~/.claude.json`——也就是**它会改你别的项目的 Claude Code 配置**，直到你跑 `headroom unwrap`。不想要得显式 `--code-memory none`。
- **Rust 核心 + ONNX + Kompress 本地模型**这一串带来了一堆环境问题：Windows 上要处理 `CREATE_NO_WINDOW` vs `DETACHED_PROCESS`、macOS 有 malloc re-exec 和 launchd 生命周期、Docker 要处理 `--userns=keep-id`、无 AVX2 的老 x86 CPU 上 ONNX 后端要跳过（否则 SIGILL）。
- **v0.32 有整整一大片 `refactor: isolate ... policy` 提交**（body 转发、header 策略、认证分类、速率限制、语义 key……十几个）。这类重构通常是一个信号：**复杂度已经涨到需要人为切分了**。

一句话概括：从"试试看"变成了"要部署"。

## 顺手记一下安全修的东西

这三个月安全相关的修复密度不低，挑几个类型：

- **SSRF**：`vertex` 的 location 参数未校验（v0.37 修掉，加区域白名单）；以及 v0.36 一条"operator secret 不要跟着客户端指定的 upstream 走";
- **本地写接口**：feedback 端点和 loopback 写操作加了 CSRF 检查（v0.36）；
- **WebSocket 鉴权**：`HEADROOM_PROXY_TOKEN` 之前没在 WS 握手上强制执行（v0.37 修）；
- **文件读取保护**：v0.37 加了 `HEADROOM_PROTECT_READS`，防止 Responses API 路径上把读文件的结果做了有损压缩（Copilot 视图那条线）；
- **依赖 CVE**：nltk、mcp 1.28.1、h2 4.4.1、aiohttp、cryptography、Rust 两个 advisory……基本是每个版本都在清。

这些单看都不起眼，但注意它们的共同点：**全部发生在"本地起了一个会转发你流量的进程"这个前提下**。它跑在你机器上、持有你的 key、代理你的请求——这个位置的安全要求，比一个库函数高一个数量级。项目显然意识到了。

## 生态位：它已经不是"工具"了

把 9 月的 README 拉出来看支持的 agent 列表，长这样：

Claude Code · Codex · Grok CLI · Cursor · Aider · Copilot CLI · VS Code Copilot · **OpenClaw** · OpenCode · Cline · Continue · Goose · OpenHands · Mistral Vibe · Oh My Pi · Kimi CLI · ZCode · Cortex Code

加上集成矩阵：OpenAI/Anthropic SDK、Vercel AI SDK、LiteLLM、LangChain、Agno、Strands、ASGI middleware、任意 OpenAI 兼容客户端。

这个覆盖率已经很清楚了——**它不是"某个 agent 的加速插件"，而是所有 agent 都塞得进去的一层**。和 7 月判断一致，但程度更深了。

## 我的判断

三个 takeaway：

1. **护城河不在压缩算法，在缓存协同。** SmartCrusher 这类东西随便一个团队两周能写个七成。真正难的是"压缩之后 provider 的 prompt cache 还活着、历史还完整、原文本还能取回"。v0.31 到 v0.37 的绝大多数工程量都花在这上面。
2. **它在补"可信"而不是补"更快"。** 可复现 benchmark、net vs gross 区分、output savings 明确标注为估计值并给 CI、准确率 delta 主动说"不显著"——这些都不增长 star，但决定它能不能进企业。
3. **工程债已经可见。** 十几个 policy 隔离重构、Windows/macOS/Docker 三套平台适配、43 万行的 release 流水、703 个 open issue。这不再是一个人维护的项目，也不再是一个可以轻率升级的依赖。

**继续跟踪：**

- `/v1/compress` 的 session 语义会不会稳定成事实标准（其他压缩项目跟不跟）；
- `headroom.compressor` 插件生态有没有第三方真的写东西上去——这是"平台化"的试金石；
- **output token reduction 那个 31.7% 是估计值**（95% CI 27.7%–35.7%），官方给了 `HEADROOM_OUTPUT_HOLDOUT=0.1` 的实测方案但需要你自己留对照组。这块目前是它最弱的一环，值得盯;
- 703 个 open issue 的消化速度。

**一句话推荐：** 如果你每天都在跑编码 agent、且工具输出很重——值得上；如果只是偶尔问两句、或者本来就在用厂商自带的 context compaction，那这层中间件的边际收益有限，多出来的部署和排查成本不划算。

---

_前情：[Headroom 深度解析（2026 版）](/StaryFall/posts/headroom-deep-dive/)（2026-06-19）· [Headroom 跟进更新：从 17k 到 56k Stars](/StaryFall/posts/headroom-follow-up-july/)（2026-07-05）_

> **信息来源：** GitHub API `headroomlabs-ai/headroom`（star/fork/license/版本，2026-09-21 抓取）· 各版本 release notes（v0.28–v0.37）· 仓库 `README.md` main 分支 · 官方站点 headroomlabs.ai 与 docs.headroomlabs.ai。文中版本号、提交排序与 benchmark 数字均取自上述来源，未做推算。
