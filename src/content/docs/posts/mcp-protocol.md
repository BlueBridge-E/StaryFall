---
title: MCP：让 AI 连接万物的协议
description: Model Context Protocol 是什么、怎么用，以及如何自己动手写一个 MCP Server
date: 2026-05-19
tags: [ai, mcp, devtools]
---

## 为什么需要 MCP

AI 编程助手很强，但有一个根本局限：**它看不到项目之外的东西。**

你的数据库里有什么表？Notion 上有哪些文档？Figma 的设计稿长什么样？这些问题 AI 回答不了，除非你复制粘贴给它。

MCP（Model Context Protocol）就是解决这个问题的。它是 Anthropic 推出的开放协议，定义了一套标准，让 AI 能安全地连接外部数据源和工具。2026 年已经有超过 10,000 个公共 MCP 服务器。

## MCP 的架构

MCP 是典型的客户端-服务器架构：

```
AI 应用 (Host)
    │
    ├── MCP Client
    │       │
    │       ├──→ MCP Server A (连接数据库)
    │       ├──→ MCP Server B (连接 Notion)
    │       └──→ MCP Server C (连接 Figma)
```

一个 AI 应用可以同时连接多个 MCP 服务器，每个服务器提供三种能力：

| 原语 | 用途 | 例子 |
|------|------|------|
| **Tools** | 让 AI 调用执行操作 | 查数据库、发邮件、创建 Issue |
| **Resources** | 让 AI 读取数据 | 读文件、获取文档内容 |
| **Prompts** | 预定义的提示模板 | "帮我审查这段代码" |

## 动手写一个 MCP Server

用 TypeScript 写一个天气查询的 MCP 服务器，代码不到 60 行：

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'weather-server',
  version: '1.0.0',
});

// 注册一个工具：查询城市天气
server.tool(
  'get_weather',
  '查询指定城市的天气',
  { city: z.string().describe('城市名称，如 Beijing') },
  async ({ city }) => {
    // 实际项目中调用天气 API
    return {
      content: [{ type: 'text', text: `${city} 今天晴，22°C` }],
    };
  }
);

// 通过 stdio 传输连接
const transport = new StdioServerTransport();
await server.connect(transport);
```

配置到 Claude Code：

```json
{
  "mcpServers": {
    "weather": {
      "command": "npx",
      "args": ["tsx", "./weather-server.ts"]
    }
  }
}
```

然后你就可以在 Claude Code 里问："北京今天天气怎么样？"——AI 会自动调用你的 MCP 工具获取答案。

## 实战场景

**查数据库再写代码：**

```
你：给 users 表加一个 last_login 字段，顺便更新相关接口

AI 通过 MCP：
1. 连接数据库 → 读取 users 表当前结构
2. 扫描项目 → 找到所有引用 users 的代码
3. 生成 migration + 更新所有相关接口
4. 你确认后一次性提交
```

以前需要你手动告诉 AI 表结构、手动列出所有相关文件，现在 AI 自己通过 MCP 获取。

**从需求到代码：**

```
1. AI 通过 Notion MCP 读取需求文档
2. AI 通过 Figma MCP 看到设计稿
3. AI 通过 Linear MCP 创建任务拆解
4. AI 写代码、跑测试
5. AI 通过 GitHub MCP 创建 PR
```

## 传输方式

| 方式 | 适用场景 |
|------|----------|
| **stdio** | 本地进程通信，最简单 |
| **HTTP (SSE)** | 远程服务器，适合团队共享 |
| **Streamable HTTP** | 新一代传输，支持流式 |

本地开发和测试用 stdio 就够了，部署到生产时换 HTTP。

## 调试

官方提供了 MCP Inspector：

```bash
npx @modelcontextprotocol/inspector tsx ./weather-server.ts
```

浏览器打开后可以交互式地测试你的 server——调用工具、查看返回、追踪请求链路。

## 生态现状

- **10,000+** 公共 MCP 服务器
- 支持的语言：TypeScript、Python、Go、Rust、Java、Kotlin
- 主流 AI 工具都支持：Claude Code、Cursor、Copilot、Windsurf
- 覆盖的数据源：PostgreSQL、SQLite、Notion、Figma、Linear、Slack、GitHub 等

## 什么时候不需要 MCP

- 数据量小，复制粘贴更快 → 没必要
- 团队只有 1-2 个人 → ROI 不高
- AI 不需要外部数据就能完成 → 过度设计

MCP 的价值在于**自动化重复的信息获取和操作流程**。当 AI 每次都需要你手动提供同样的上下文时，MCP 就该上场了。

## 总结

MCP 让 AI 从"只能看到你给它的东西"升级为"能主动获取需要的东西"。2026 年它是 AI 开发工具链中增长最快的标准之一。
