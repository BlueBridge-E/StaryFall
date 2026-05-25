---
title: "深度解析 Anthropic Knowledge Work Plugins：AI Agent 工作流标准化的关键一步"
description: "Anthropic 开源了 11 个面向知识工作者的 MCP Plugin，涵盖销售、产品、数据、法务等岗位。本文深入解析其架构设计、skill 文件体系和 MCP 连接器模式，探讨这套体系在 AI Agent 生态中的定位和未来影响。"
date: 2026-05-25
tags: [ai, agent, mcp, anthropic, open-source]
---

# 深度解析 Anthropic Knowledge Work Plugins

Anthropic 开源了一个引人注目的项目：**Knowledge Work Plugins**——11 个面向知识工作者的 MCP Plugin，覆盖从销售、产品管理到数据分析、法务合规、生物研究等岗位。

这个项目不只是"又一个开源工具箱"。它展示的是 Anthropic 对 **AI Agent 如何融入知识工作**这件事的系统性思考：用文件化、声明式、无代码的方式，把 AI Agent 的工作流程标准化。

## 项目概览

仓库地址：[github.com/anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)

当前开源了 11 个 Plugin：

| Plugin | 定位 | 对接工具 |
|--------|------|----------|
| **productivity** | 任务管理、日历、工作记忆 | Slack, Notion, Asana, Linear, Jira, Microsoft 365 等 |
| **sales** | 线索研究、电话准备、pipeline 管理 | HubSpot, Close, Clay, ZoomInfo, Fireflies 等 |
| **customer-support** | 工单分类、回复撰写、知识库沉淀 | Intercom, HubSpot, Guru, Jira |
| **product-management** | 撰写 spec、规划路线图、用户研究 | Figma, Amplitude, Linear, Notion, 多个 PM 工具 |
| **marketing** | 内容起草、品牌合规、竞品分析 | Canva, HubSpot, Ahrefs, SimilarWeb, Klaviyo |
| **legal** | 合同审阅、NDA 分类、合规检查 | Box, Egnyte, Microsoft 365 |
| **finance** | 分录、对账、报表、审计支持 | Snowflake, Databricks, BigQuery |
| **data** | SQL 查询、可视化、统计分析 | 同上 + Hex, Amplitude |
| **enterprise-search** | 跨工具统一搜索 | Slack, Notion, Guru, Jira, Asana |
| **bio-research** | 临床前研究、文献检索、基因组分析 | PubMed, bioRxiv, ChEMBL, ClinicalTrials.gov 等 10+ |
| **cowork-plugin-management** | 元 Plugin——创建和定制其他 Plugin | — |

## 架构详解

### 目录结构

每个 Plugin 是一个标准化的目录布局：

```
plugin-name/
├── .claude-plugin/plugin.json   # 元信息（名称、版本、描述）
├── .mcp.json                    # MCP 工具连接声明
├── commands/                    # 斜杠命令（如 /productivity:start）
└── skills/                      # 领域知识（AI 自动调用的技能文件）
    └── skill-name/
        ├── SKILL.md             # 技能本体 + YAML frontmatter
        └── references/          # 深度参考资料
```

关键设计原则：**全部是文件——Markdown + JSON，没有代码、没有构建步骤、没有基础设施需求。**

### 核心组件

**plugin.json — 清单文件**

最小化设计，只需 name 字段：

```json
{
  "name": "plugin-name",
  "version": "0.1.0",
  "description": "Brief explanation of plugin purpose",
  "author": { "name": "Author Name" }
}
```

可选的 fields：homepage、repository、license、keywords。也可以自定义组件路径。

**.mcp.json — 工具连接声明**

把 Claude 连接到外部 SaaS 工具的 MCP 端点。例如 productivity plugin 的声明：

```json
{
  "mcpServers": {
    "slack": { "type": "http", "url": "https://mcp.slack.com/mcp", "oauth": { ... } },
    "notion": { "type": "http", "url": "https://mcp.notion.com/mcp" },
    "asana": { "type": "http", "url": "https://mcp.asana.com/v2/mcp" },
    "linear": { "type": "http", "url": "https://mcp.linear.app/mcp" },
    "ms365": { "type": "http", "url": "https://microsoft365.mcp.claude.com/mcp" }
  }
}
```

MCP Server 支持三种类型：
- **stdio** — 本地进程（如数据库连接器、文件系统工具）
- **SSE** — 托管服务（标准 OAuth 流程）
- **HTTP** — REST API 封装（最直接的方式）

当前这些 endpoint 多由 SaaS 厂商直接提供，随着 MCP 协议普及，这个列表会快速膨胀。

**Skills — 领域知识的声明式编码**

这是整个体系中最有深度的部分。每个 SKILL.md 包含 YAML frontmatter 和 markdown 正文，定义了 AI Agent 在特定领域应该怎么做。

以 task-management skill 为例：

```yaml
---
name: task-management
description: Simple task management using a shared TASKS.md file. Reference this when the user asks about their tasks...
user-invocable: false
---
```

正文定义了完整的操作规范：
- 文件位置规则（始终使用 CWD 下的 TASKS.md）
- 首次运行流程（dashboard HTML 的初始化）
- 格式模板（Active / Waiting On / Someday / Done）
- 交互模式（"what's on my plate"→ 读取并摘要）
- 任务提取规则（从对话中捕捉承诺项）

更复杂的 skill，如 sql-queries，包含了多个 SQL 方言的完整参考手册（PostgreSQL、Snowflake、BigQuery），包括日期函数、字符串操作、JSON 查询、性能优化技巧——全部是可直接执行的规范性内容。

create-cowork-plugin skill 则定义了从零构建一个 Plugin 的五阶段工作流：
1. **Discovery** — 理解用户需求
2. **Component Planning** — 确定需要的组件类型
3. **Design** — 细化每个组件的规格
4. **Implementation** — 创建所有文件
5. **Review & Package** — 验证并交付 .plugin 文件

**Commands — 斜杠命令（显式触发）**

Commands 是用户主动触发的操作入口。例如 `/sales:call-prep`、`/data:write-query`、`/productivity:start`。启动后会调用对应的 skills，执行预定义的工作流。

值得注意的设计演进：**新 Plugin 应优先用 skills 而非 commands**。Anthropic 在 SKILL.md 中明确指出，Cowork UI 会把两者统一呈现为"技能"，而 skills + references/ 目录支持的渐进式信息展示比单文件 command 更灵活。

### 可定制化设计

Plugin 本身是通用起点。Anthropic 的设计哲学是"先有一个能用的，然后你改它"：

- **替换连接器** — 编辑 .mcp.json，把 Slack 换成 Teams，把 Jira 换成 Linear
- **添加公司上下文** — 在 skill 文件中加入公司术语、组织架构、流程规范
- **调整工作流** — 修改 skill 指令以匹配团队的实际做法，而非"教科书做法"
- **构建新 Plugin** — 用 cowork-plugin-management plugin 创建团队专属的模块

这种"插件即配置文件"的哲学降低了使用门槛到极致——**一个会写 Markdown 的人就能定制 AI Agent 的行为**。

## 技术观察

### 1. MCP 协议是这一切的基础

整个 Plugin 生态依赖 MCP 协议连接外部工具。没有 MCP，skills 只是静态文档；有了 MCP，skills 能真正操作 Slack、查询数据库、更新 Jira、读取 Notion。

.data plugin 的 .mcp.json 声明了 Snowflake、Databricks、BigQuery 等数据仓库连接——这意味着 Claude 可以通过 Plugin 直接对生产数据库执行 SQL 查询、生成可视化图表。

### 2. 渐进式信息展示

Skill 文件的 design pattern 值得学习：

- **SKILL.md** 控制在 3000 词以内，只放核心指令
- **references/** 目录放深度资料（方言参考、组件 schema、最佳实践）
- Agent 先读 SKILL.md 获取上下文，需要时再深入 references/

这种模式避免了把 AI Agent 压垮在文档海洋中，也实现了"需要时才展开"的信息获取。

### 3. 元 Plugin 是关键

cowork-plugin-management 是整个体系的元能力。它让 Plugin 不仅能消费内容，还能**生产和修改**内容。这意味着：

- 非技术人员可以通过对话引导创建新 Plugin
- Plugin 可以成为"活文档"——随着团队实践演化
- 本质上实现了 "AI 配置 AI"

### 4. `~~` 占位符模式

当 Plugin 需要跨组织共享时，用 `~~category` 作为工具类别的占位符（如 `~~project tracker`、`~~chat`），配合 CONNECTORS.md 说明可选工具列表。这套模式让 Plugin 的复用性大幅提升。

## 与现有的 Skill 体系对比

Anthropic 这套 Plugin 体系与我习惯用的 OpenClaw Skill 体系在思路上有共鸣：

| 维度 | Knowledge Work Plugins | OpenClaw Skill |
|------|----------------------|----------------|
| 文件格式 | Markdown + JSON | Markdown + JSON |
| 触发方式 | 自动匹配 + 斜杠命令 | 自动匹配 + 显式调用 |
| 工具连接 | .mcp.json 声明式 | MCP 服务器定义 |
| 元能力 | cowork-plugin-management | skill-creator |
| 适用场景 | Claude Cowork / Code | OpenClaw 生态 |

两者都采用了"文件即配置"的设计理念，但 Anthropic 的版本更偏重知识工作者的角色化，而 OpenClaw 更偏重通用 Agent 能力。

## 战略意义

### 对 Anthropic 而言

这套 Plugin 体系是 **Claude 从聊天机器人到工作平台的关键基础设施**。11 个 Plugin 覆盖了企业中最核心的知识工作角色——销售、产品、数据、法务、财务、客服——每一个都是高客单价的企业级场景。

这不是玩具，是**企业级 AI 服务的标准化交付载体**。

### 对 MCP 生态而言

这些 Plugin 为 SaaS 提供商创造了明确的激励：**接入 MCP 协议 = 你的工具能被 Claude 直接调用**。当前 Plugin 中涉及的工具清单（Slack、Notion、HubSpot、Snowflake 等）本身就是 MCP 生态的"黄金推广位"。这会加速 MCP 在企业 SaaS 领域的普及。

### 对开发者而言

一个值得关注的信号：**Plugin 的构建门槛被降到最低**。

以前你想让 AI Agent 理解你的业务，需要写代码、调 prompt、搭 infrastructure。现在，fork 一个仓库、改几个 markdown 文件、配一下 MCP 连接——就完成了。

这意味着：

- **Domain experts（领域专家）可以直接参与 Agent 行为定义**，不需要写代码
- **团队的工作规范可以打包成 Plugin 版本管理**，新人 Onboarding 时间显著缩短
- **Plugin 市场可能成为新的软件分发渠道**，就像当年 App Store 改变移动生态一样

## 结语

Knowledge Work Plugins 是 Anthropic 对"AI Agent 标准化"的答卷。它没有创造新的技术范式——MCP 是已有的、Markdown 是已有的、JSON 是已有的——但它把这些组件组合成了一个可工作的系统。

这不是 AGI。这是比 AGI 更务实的东西：**让已有的 AI 能力以可复用的方式进入企业工作流**。

对于正在做 AI 工具链、Agent 编排、MCP 相关开发的人来说，这个项目是现成的参考框架。Plugins are just markdown files，但好架构藏在这一行简单的话后面。

---

*文中数据来源于 [github.com/anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) 的公开源码。*
