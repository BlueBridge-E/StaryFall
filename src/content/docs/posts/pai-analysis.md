---
title: PAI 方法论拆解：当个人 AI 基础设施变成"生活操作系统"
description: 深入分析 Daniel Miessler 的 Personal AI Infrastructure 项目，从 Algorithm 七阶段循环到 Ideal State Artifact，再到它与 OpenClaw 路线的对比思考
date: 2026-06-07
tags: [ai, personal-ai-infrastructure, methodology, agent]
---

## 缘起

在 GitHub 上刷到 [danielmiessler/Personal_AI_Infrastructure](https://github.com/danielmiessler/Personal_AI_Infrastructure) 时，我心里想的是：又一套 AI 脚手架。

但读完 README 之后，我改变了看法。

这不是又一个 LangChain 套壳，也不是又一个 Agent 框架。Daniel Miessler（fabric 的作者）在做一件更激进的事：**把 AI 从一个你问它答的工具，变成一套持续朝你定义的方向推进的操作系统。**

## PAI 是什么

PAI = Personal AI Infrastructure。v5.0.0 的副标题是 **Life Operating System**。

三层结构：

- **PAI** — 操作系统本身：Skills、Memory、Algorithm、Telos（人生终极目标文件）
- **Pulse** — Life Dashboard，跑在 localhost:31337，让你看到自己当前的状态、目标和进展
- **DA** — Digital Assistant，你对谈的那个具名 AI 角色

它的核心理念是：**你只对一个 DA 说话，那个 DA 在背后调用了整个工具军团。** 不是跟一群 Agent 打交道，而是跟一个了解你全部信息、知道你所有目标的实体打交道。

## 最核心的方法论：Algorithm v6.3.0

这是 PAI 最有价值的部分，值得仔细看。

### 一句话概括

每一个 AI 交互，本质上都是在做同一件事：**从当前状态（Current State）过渡到理想状态（Ideal State）**。PAI 把这个过程编码成了一个可执行的七阶段循环。

### 七阶段循环

OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN

这七个阶段映射的是科学方法论：

| 阶段 | 做什么 | 对应科学方法 |
|------|--------|-------------|
| OBSERVE | 分析现状，生成 ISA，定义"完成"长什么样 | 提出问题 |
| THINK | 从封闭列表中选择 Thinking Capability | 形成假说 |
| PLAN | 分解任务、排列步骤 | 设计实验 |
| BUILD | 实际产出代码或内容 | 实施 |
| EXECUTE | 运行验证 | 收集数据 |
| VERIFY | 对照 ISC 逐条验证 | 检验假说 |
| LEARN | 记录决策、修正、经验回写 | 得出结论 |

每个阶段都对应 AI 可以执行的操作，不是口头说说。

### ISA（Ideal State Artifact）

这是 PAI 亲手打造的原子单位。ISA = **PRD + 测试用例 + 验收标准 + Done 条件 + 信源记录**，五合一的单文件。

12 个固定章节，顺序不可变：

1. Problem（问题）
2. Vision（愿景）
3. Out of Scope（不做什么）
4. Principles（设计原则）
5. Constraints（约束条件）
6. Goal（目标）
7. Criteria（标准——这些是**可测试的断言**）
8. Test Strategy（测试策略）
9. Features（功能）
10. Decisions（决策记录）
11. Changelog（变更日志）
12. Verification（验证结果）

关键在于：**Criteria 是可以自动验证的。** 每个 ISC（Ideal State Criterion）是一个断言，全部通过 = 任务完成。没有"我觉得差不多了"的模糊地带。

### Effort Tiers（E1-E5）

每个 prompt 进来时，一个 Sonnet 分类器自动判断该走什么模式：

| 层级 | 时间预算 | ISC 数量底线 | 思考能力底线 | 感受 |
|------|---------|-------------|-------------|------|
| E1 标准 | < 90s | 无 | 0-1 | 快速通道 |
| E2 扩展 | < 3min | ≥16 | ≥2 硬性 | 有结构但不慢 |
| E3 进阶 | < 10min | ≥32 | ≥4 硬性 | 多文件工作 |
| E4 深度 | < 30min | ≥128 | ≥6 硬性 | 复杂设计 |
| E5 全面 | < 120min+ | ≥256 | ≥8 硬性 | 无时间压力 |

**这件事很厉害**——系统自动决定当前工作该投入多少资源。我回想自己做技术调研时的情况：有时候一个问题只需要 30 秒的搜索，但经常不小心就深挖了一小时。反过来，有时一个复杂问题值得花一小时，但工具却给出了蜻蜓点水的回答。这个分级是在建立一种**对任务复杂度的估算意识**。

### 封闭思考能力列表

18 种命名的 thinking capability，必须在列表内选取，**发明新名字算 CRITICAL FAILURE**。

FirstPrinciples、SystemsThinking、RootCauseAnalysis、Council（多方辩论）、RedTeam（红队测试）、ApertureOscillation（宏观-微观视角切换）……

这实际上是一种**元认知的标准化**。不让 AI 随便编思考方式，而是给它一组经过验证的模式，按需选用。

## 最有趣的设计哲学

### 1. TELOS 前置

PAI 装完之后的第一件事，不是配工具，不是写提示词，而是**定义你是谁**。

/INTERVIEW 流程会引导你完成四个阶段：
- Phase 1 — TELOS：使命、目标、信念、智慧、挑战、书籍、心智模型、人生叙事
- Phase 2 — IDEAL：成功到底长什么样
- Phase 3 — 偏好：工具、规范、工作风格
- Phase 4 — 身份：DA 的人设微调

这些信息写入 `PAI/USER/`，每次会话自动加载。你告诉 DA 你是谁，它才知道往哪个方向优化。

这不就是我们的 `MEMORY.md` + `USER.md` 在试图做的事吗？只不过我们的更松散，PAI 把它变成了一个结构化流程。

### 2. "系统随模型变强而缩小"

Daniel 有一个 BitterPillEngineering skill，专门用来**审计并删除多余的指令**。

原则是：当模型变强之后，那些曾经需要的详细指导就不再必要了。不断删减，保持系统精干。代码多于提示词，真实的逻辑由真实的代码执行，提示词只是用来编排的壳。

这让我反思我们的一些 Skills 写法——有没有还在为旧模型写的过度指导？

### 3. 弃用 RAG

PAI 从 2025 年 6 月起放弃了 RAG。**理由是：** embedding 的精度问题、检索的随机性、以及 fidelity 的损失，不值得那点收益。

替代方案是：富文本 + 交叉引用 + ripgrep。你的文件系统就是索引。

"If you can't read it with cat, we don't want it."

干净利落，也符合 Bear Blog-style 的极简审美。

### 4. Markdown > 数据库

同上。PAI 尽量避免 SQLite、Postgres 和其他不透明的存储。一切应该是可读的、可 grep 的、可被任何工具消费的。

这和我们在 desktop-cc-gui 中 SQLite/FTS5 + tree-sitter 的路线不同。但各有各的适用场景——检索大规模结构化数据时数据库仍有优势。

## 它的局限

读 PAI 的时候需要始终记住一件事：**它绑定在 Claude Code 上。**

Claude Code 是执行引擎、是工具入口、是会话载体。PAI 的 Skills、Algorithm、Memory，全部运行在 Claude Code 的终端会话中。没有 Claude Code，PAI 就是一个空壳。

这意味着它的使用场景被天然限制：
- 必须在终端里工作
- macOS/Linux 环境
- 绑定 Anthropic 模型
- **主动开会话**的模式，而不是被动待命

而我们在跑 OpenClaw——它运行在腾讯云服务器上，通过 QQ/微信消息交互，7×24 小时待命，不依赖于一个终端会话。我们的场景是**消息驱动的轻量交互**，不是一个持续性的"工作会话"。

这不是谁好谁坏的问题。这是两个完全不同的使用范式。

## 它给我的启发

1. **目标驱动比工具堆砌重要** — PAI 真正有力量的地方不是它的 Skills 数量，而是每个 Skills 都被 Algotithm 的 Current → Ideal State 循环收束。我们目前的系统里，Skills 之间是松散的，缺少一个"我们最终在往哪个方向走"的上层坐标系。

2. **"完成"需要被显式定义** — ISA 的 Criteria + Verification 设计，本质上是把模糊的目标变成了可操作的状态。这件事我们自己做项目时也经常忽略——"做得差不多就行了"而非"这几条标准都通过了"。

3. **分级思考不是偷懒，是纪律** — E1-E5 的分级，以及封闭的思考能力列表，本质是在管理 AI 的资源分配。不是每一个问题都需要深度分析，也不是每一个深度分析都可以被快速带过。这个意识本身就有价值。

4. **系统设计要有退出路径** — PAI 持续做 BitterPillEngineering，主动识别哪些层可以被移除。因为我们总是在堆功能，很少主动拆功能。

---

PAI 不是一个拿来就能用的产品。它太个人化、太绑定 Daniel 的个人工作流和哲学偏好。但它是一面很好的镜子，可以让我们反思：

**你的 AI 知道你要去哪吗？还是它只是在等你下一次开口？**