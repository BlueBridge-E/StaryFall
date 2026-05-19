---
title: tRPC：前后端类型安全的正确姿势
description: 如何用 tRPC 实现前后端共享 TypeScript 类型，告别手写 API 文档和手动类型声明
date: 2026-05-19
tags: [typescript, trpc, fullstack]
---

## REST API 的痛点

写一个用户搜索接口，传统 REST 做法：

```
1. 后端写好 /api/users?q=xxx  →  写文档说参数是 q，返回 User[]
2. 前端写 fetch('/api/users?q=xxx')  →  手写类型断言 as User[]
3. 某天后端把 q 改成 query  →  前端运行时发现 400
4. 找后端确认  →  "哦改了，文档忘更新了"
```

类型安全在 API 边界断裂了。后端类型定义和前端类型声明是**两套没有关联的东西**。

tRPC 解决的就是这个问题。

## tRPC 怎么做到的

tRPC 的核心思路：**后端定义路由 → TypeScript 自动推断出完整的类型 → 前端直接导入类型使用**。没有代码生成，没有 schema 文件，没有中间表示。

```typescript
// server/router.ts —— 后端
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const appRouter = t.router({
  user: t.router({
    search: t.procedure
      .input(z.object({ q: z.string() }))
      .query(async ({ input }) => {
        // 查询数据库
        return [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
      }),
    create: t.procedure
      .input(z.object({ name: z.string(), email: z.string().email() }))
      .mutation(async ({ input }) => {
        return { id: 3, ...input };
      }),
  }),
});

export type AppRouter = typeof appRouter;
```

```typescript
// client.ts —— 前端
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/router';

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/api/trpc' })],
});

// 调用 search：参数自动补全，返回值自动推断
const users = await trpc.user.search.query({ q: 'alice' });
// users 的类型是 { id: number; name: string }[]
// 不需要 as User[]，不需要手写类型

// 调用 create：input 参数自动补全
const newUser = await trpc.user.create.mutate({
  name: 'Charlie',
  email: 'charlie@example.com',
});
// newUser 的类型是 { id: number; name: string; email: string }
```

整个过程：
- 后端改了入参 → 前端**编译时**就报错，不是运行时
- 后端改了返回值 → 前端自动拿到新类型
- 没有 `/api/users` 和 `/api/users/create` 这样的字符串路径

## 输入校验用 Zod

tRPC 配合 Zod 做输入校验，既保证运行时安全，又提供类型推断：

```typescript
const createUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user'),
});

// Zod schema → TypeScript type 是自动的
// typeof createUserSchema._type = { name: string; email: string; role: 'admin' | 'user' }

t.procedure
  .input(createUserSchema)
  .mutation(async ({ input }) => {
    // input 已经被 Zod 校验过了，类型也是对的
  });
```

在你写 `t.procedure.input(createUserSchema)` 这一行时，TypeScript 就完成了从 Zod schema 到函数参数类型的自动推导。如果你再手动声明显式类型，那反而是多余且容易出错的。

## 真实性能收益

InfoQ 报道过一个从 Apollo GraphQL Federation 迁移到 tRPC 的生产案例，日均 240 万请求、12 个微服务：

| 指标 | GraphQL | tRPC | 变化 |
|------|---------|------|------|
| P95 延迟 | 85ms | 28ms | 降低 67% |
| 冷启动 | 180ms | 45ms | 加快 75% |
| 生产 Bug | — | — | 减少 89% |
| 开发速度 | — | — | 提升 40% |

Bug 减少 89% 的原因很直接：API 契约由 TypeScript 编译器强制检查，而不是靠文档和约定。

## 什么场景适合 tRPC

**适合：**
- TypeScript 全栈 Monorepo（前后端共享类型）
- 内部 SaaS / 后台管理系统
- 前后端同团队开发
- 对 API 文档维护成本敏感的团队

**不太适合：**
- 需要对外暴露的公共 API（第三方调用者不是 TypeScript）
- 多语言异构环境（后端 Go，前端 TypeScript）
- 移动端原生客户端（Swift/Kotlin）

## 2026 年的 tRPC

tRPC v11 已经是稳定版本，生态成熟：

- **React Query 集成**：`@trpc/tanstack-react-query` 替代了旧的 `@trpc/react-query`
- **SSE 订阅**：实时数据推送
- **请求批处理**：同一事件循环里的多个 tRPC 调用自动合并为一个 HTTP 请求
- **Next.js App Router** 和 **React Server Components** 都有官方集成

## 总结

tRPC 的思路值得每个 TypeScript 全栈团队认真考虑：**类型安全不应该在 API 边界断裂。** 如果你已经前后端都用 TypeScript，tRPC 消除了一整类 Bug——"前后端对不上"。
