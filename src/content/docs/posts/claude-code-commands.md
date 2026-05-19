---
title: Claude Code 常用命令
description: Claude Code 的命令体系分为终端 CLI 命令、斜杠命令和键盘快捷键三类，一篇全掌握。
date: 2026-05-19
tags: [claude-code, ai, 工具]
---

# Claude Code 常用命令

Claude Code 的命令体系分为**三类**：终端 CLI 命令、交互会话中的斜杠命令（`/`）、以及键盘快捷键。其中 CLI 命令负责启动与控制，斜杠命令负责会话内的操作，快捷键负责快速交互。

---

## 一、CLI 命令（终端启动时使用）

| 命令 | 功能描述 | 示例 |
|------|---------|------|
| `claude` | 在当前目录启动交互式会话 | `claude` |
| `claude [路径]` | 在指定项目目录启动 | `claude /path/to/project` |
| `claude "query"` | 启动并立即执行指定任务 | `claude "fix the build error"` |
| `claude -p "query"` | 非交互模式，执行查询后退出 | `cat logs.txt | claude -p "explain"` |
| `claude -c` | 继续最近一次对话 | `claude --continue` |
| `claude -r <id>` | 通过会话 ID 恢复历史对话 | `claude -r "abc123"` |
| `claude --add-dir <path>` | 添加额外工作目录 | `claude --add-dir ../lib` |
| `claude --model <model>` | 指定模型（sonnet/opus/haiku） | `claude --model opus` |
| `claude --verbose` | 启用详细日志 | `claude --verbose` |
| `claude update` | 更新至最新版本 | `claude update` |
| `claude --version` | 查看当前版本 | `claude --version` |
| `claude mcp` | 进入 MCP 服务器配置 | `claude mcp` |

---

## 二、斜杠命令（会话中交互使用，以 `/` 开头）

在交互会话中输入 `/` 即可查看所有可用命令，边输入边筛选。

### 📌 核心命令
| 命令 | 功能 |
|------|------|
| `/init` | 扫描项目生成 CLAUDE.md 记忆文件，让 AI 理解项目结构、技术栈和规范 |
| `/help` | 查看所有命令列表与用法说明 |
| `/clear` | 清空对话历史，硬重置上下文 |
| `/compact` | 压缩对话内容，保留核心摘要，解决 token 超限问题 |
| `/status` | 查看会话状态（版本、路径、模型、配置等） |
| `/cost` | 查看 token 消耗与预估费用 |
| `/model` | 切换模型（Sonnet/Opus/Haiku） |

### 📁 配置与管理
| 命令 | 功能 |
|------|------|
| `/config` | 交互式配置面板（自动压缩、主题、通知等） |
| `/memory` | 编辑 CLAUDE.md 记忆文件，支持项目级与用户级配置 |
| `/context` | 可视化当前上下文用量，并给出优化建议 |
| `/doctor` | 环境诊断工具，检查 API、依赖、权限、版本 |
| `/add-dir` | 添加工作目录，让 AI 可访问更多文件夹 |
| `/hooks` | 配置自动化钩子（保存后自动格式化、自动 lint 等） |
| `/tasks` | 查看后台任务列表与进度 |

### 🔍 代码分析与质量
| 命令 | 功能 |
|------|------|
| `/diff` | 交互式差异查看器，展示 git 未提交修改与逐轮 diff |
| `/security-review` | 分析待提交更改，识别安全风险（注入、身份验证缺陷等） |
| `/simplify [聚焦]` | 并行启动三个审查 Agent，检查代码复用、质量与效率 |
| `/batch <指令>` | 大规模代码并行改造，拆分为独立单元执行 |
| `/autofix-pr` | 监听 PR，CI 失败或 Reviewer 评论时自动推送修复 |

### 🛠️ Git 与版本控制（内置技能）
| 命令 | 功能 |
|------|------|
| `/commit` | 自动生成规范 git 提交信息（带 emoji） |
| `/create-pr` | 一条命令完成 PR 创建流程 |
| `/fix-issue` | 根据 GitHub issue 号自动修复问题 |
| `/check` | 执行代码质量与安全检查 |
| `/clean` | 自动修复代码格式问题 |
| `/tdd` | 引导测试驱动开发 |

### 🔧 诊断与协作
| 命令 | 功能 |
|------|------|
| `/debug [描述]` | 开启调试日志并分析 |
| `/plan [描述]` | 进入计划模式，先输出方案再执行 |
| `/insights` | 生成项目使用分析报告 |
| `/stats` | 可视化每日用量、会话历史、模型偏好 |
| `/schedule` | 创建/管理云端定时任务 |

---

## 三、键盘快捷键（会话中直接使用）

| 快捷键 | 功能 |
|--------|------|
| Ctrl+C | 取消当前生成或输入 |
| Ctrl+R | 搜索命令历史 |
| Shift+Tab | 切换工作模式（普通模式 ↔ 自动接受模式 ↔ 计划模式） |
| Ctrl+T | 显示/隐藏任务列表面板，查看后台任务进度 |
| Ctrl+D | 发送 EOF（结束会话） |

---

## 四、界面工作模式速查

使用 Shift+Tab 可循环切换三种模式：

| 模式 | 特点 | 适用场景 |
|------|------|---------|
| **Default（默认模式）** | 每次修改需手动确认，安全性最高 | 初次使用或不确定操作后果时 |
| **Auto-Accept（自动接受）** | 文件修改自动执行，shell 命令仍需确认 | 重复性高、确定性强的编码工作 |
| **Plan（计划模式）** | 纯只读，不修改文件、不执行命令 | 阅读陌生代码、梳理架构、制定改动计划 |

---

## 五、常用自然语言交互示例

| 需求 | 示例提示 |
|------|---------|
| 理解代码库 | > what does this project do? |
| 添加功能 | > add input validation to the user registration form |
| 修复 bug | > there's a bug where users can submit empty forms - fix it |
| 重构代码 | > refactor the authentication module to use async/await |
| 编写测试 | > write unit tests for the calculator functions |
| 更新文档 | > update the README with installation instructions |
| 代码审查 | > review my changes and suggest improvements |

---

## 💡 提示
- `/compact` 与 `/clear` 的选择：上下文快满但需保留项目背景时用 `/compact`；切换到完全不相关的任务时用 `/clear`。
- 计划模式（Plan Mode）适合复杂任务前的方案对齐，Claude 会先输出方案供确认，不会立即修改代码。
- 若想将自定义规则永久生效，使用 `/init` 生成 CLAUDE.md 后可直接追加编码规范。
