---
title: React Server Components 实战
description: RSC 的核心概念、架构模式、性能优化和常见陷阱
date: 2026-05-19
tags: [react, rsc, frontend]
---

## Server Component 是什么

React Server Components（RSC）让你可以在服务端渲染 React 组件，这些组件**不发送任何 JavaScript 到浏览器**。

在此之前，你的 React 组件要么纯客户端渲染（CSR），要么服务端渲染后还要在客户端水合（SSR + hydration）。RSC 提供了第三种选择：只在服务端运行，零客户端代价。

## Server vs Client 一目了然

| | Server Component | Client Component |
|---|---|---|
| 文件标记 | 无需标记（默认） | `'use client'` |
| 访问数据库 | ✅ | ❌ |
| `useState` / `useEffect` | ❌ | ✅ |
| 事件处理 | ❌ | ✅ |
| `async/await` | ✅ | ❌ |
| 发送 JS 到浏览器 | ❌ | ✅ |

一句话：**默认用 Server Component，需要交互时才加 `'use client'`。**

## 核心模式

### 模式一：Static Shell + Dynamic Islands

这是 RSC 最重要的架构模式。页面的静态部分（导航、布局）作为 Server Component 从边缘缓存直接输出，动态部分用 `<Suspense>` 包裹，按数据到达顺序流式展示：

```tsx
export default function Dashboard() {
  return (
    <div>
      <Sidebar />                    {/* 静态，TTFB 就展示 */}
      <Suspense fallback={<Skeleton />}>
        <RevenueChart />             {/* 动态，到了就渲染 */}
      </Suspense>
      <Suspense fallback={<Skeleton />}>
        <UserActivity />             {/* 独立加载，互不阻塞 */}
      </Suspense>
    </div>
  );
}
```

每个 `<Suspense>` 是一个独立的流式单元。快查询（50ms）即使位于页面底部，也会比慢查询（400ms）先渲染出来。

### 模式二：边界尽量靠叶子节点

好的设计：

```
Page (Server)
  └── Layout (Server)
       └── Header (Server)
            └── SearchInput (Client)  ← 只有这个需要交互
```

差的设计：

```
Page (Client)  ← 整棵树全变成客户端代码
```

一条规则：把 `'use client'` 放到尽可能深层的位置。一旦某个父组件标注了 `'use client'`，它的**所有子组件**都变成客户端代码——即使子组件没有标注。

### 模式三：Server Actions

不只是渲染，Server Component 还能通过 Server Actions 处理表单提交：

```tsx
async function createPost(formData: FormData) {
  'use server';
  const title = formData.get('title');
  await db.post.create({ data: { title } });
}

export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" />
      <button type="submit">发布</button>
    </form>
  );
}
```

不需要 `useState`、不需要 `onSubmit`、不需要 `fetch('/api/posts')`。一个 async 函数加 `'use server'` 指令，表单提交就搞定了。

## 性能收益

| 指标 | 传统 SSR | RSC Streaming + PPR |
|------|----------|---------------------|
| TTFB | ~450ms | ~45ms |
| LCP | ~1.2s | ~380ms |
| Bundle 减少 | — | 30-70% |

TTFB 从 450ms 降到 45ms 的原因是 PPR（Partial Prerendering）：静态外壳在构建时就生成好了，存在边缘节点，请求一来直接返回，不需要等服务器渲染。

## 一个反直觉的优化

并非所有组件都适合做 Server Component。如果一个展示型组件有大量 CSS className（比如 Tailwind 的 utility classes），做 Server Component 反而会导致 Flight Payload（RSC 序列化数据）膨胀——每个 className 都会被 JSON 序列化传输。

实测案例：4 个纯展示组件改为 Client Component 后：
- Flight Payload 减少 42%（67KB）
- 客户端 JS 仅增加 2.2KB
- TTFB 从 808ms 降到 245ms

实用的判断标准：**className 密度高的重复展示组件，做 Client Component 可能更省带宽。**

## 常见错误

1. **在顶层加 `'use client'`**：在根布局加会导致所有子组件变客户端代码
2. **Server Component 里用 hooks**：编译报错，因为服务端没有 state
3. **忘记设置缓存**：Next.js 15+ 默认不再缓存 fetch，需要显式设置
4. **`proxy_buffering off`**：生产环境用 Nginx 做反向代理时必须关掉缓冲，否则流式响应退化为单次大块

## 什么时候不该用 RSC

- 需要频繁交互的富应用 → CSR 更合适
- 团队不熟悉服务端渲染的调试方式
- 不需要 SEO 或极致首屏速度的场景
- 后端数据获取链路复杂的项目

不要全局切换。应该按路由逐步灰度：1% → 10% → 50%。

## 总结

RSC 的核心理念是**把计算放在该放的地方**：静态内容放服务端甚至边缘缓存，交互逻辑放客户端。2026 年它已经稳定，是新 React 项目的默认选择。关键是别滥用——不是所有东西都该上服务端。
