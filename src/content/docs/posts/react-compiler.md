---
title: React Compiler 1.0：告别 useMemo 和 useCallback
description: React Compiler 如何在编译时自动处理组件记忆化，以及如何在新项目中启用它
date: 2026-05-19
tags: [react, compiler, frontend]
---

## 它解决了什么问题

React 开发者写过太多这样的代码：

```tsx
function ProductList({ category, onSelect }) {
  const filtered = useMemo(
    () => products.filter(p => p.category === category),
    [category]
  );
  const handleClick = useCallback(
    (id) => onSelect(id),
    [onSelect]
  );

  return filtered.map(p => (
    <ProductItem key={p.id} product={p} onClick={handleClick} />
  ));
}
```

这些 `useMemo`、`useCallback`、`React.memo` 的手动优化有几个痛点：
- 忘了加 → 性能问题
- 加了但依赖数组写错 → 闭包陷阱
- 大面积加 → 代码臃肿，可读性下降

React Compiler 1.0（2025 年底稳定）从根本上解决了这个问题：**编译器自动分析数据流，在正确的位置插入记忆化**。你写业务代码，它负责优化。

## 代码对比

```tsx
// 启用 React Compiler 后，上面那段代码简化为：
function ProductList({ category, onSelect }) {
  const filtered = products.filter(p => p.category === category);
  const handleClick = (id) => onSelect(id);

  return filtered.map(p => (
    <ProductItem key={p.id} product={p} onClick={handleClick} />
  ));
}
```

写的是第二段，编译出来等价于第一段。你不写 `useMemo`，但编译器替你加了——而且比你自己加得更准确。

## 它做了什么

编译器分三个阶段处理每个组件：

| 阶段 | 做什么 |
|------|--------|
| **分析** | 将组件解析为 AST，追踪整个渲染树的数据流 |
| **推断** | 将每个表达式分类为静态、响应式或派生 |
| **转换** | 在最优位置插入记忆化边界 |

关键区别：你手写的 `useMemo` 只看自己的闭包，编译器能看到**跨组件的完整依赖链**。

一个实际例子：

```tsx
function UserDashboard({ user }) {
  const { name, email, preferences } = user;

  return (
    <div>
      <Header name={name} />
      {/* 如果只有 email 变化，Header 不会重新渲染 */}
      <EmailSettings email={email} preferences={preferences} />
    </div>
  );
}
```

编译器能精确追踪 `Header` 只依赖 `name`，`EmailSettings` 只依赖 `email` 和 `preferences`。改了 `email` 不会导致 `Header` 重新渲染——不需要你手动 `React.memo` 包裹任何东西。

## 实测数据

| 来源 | 效果 |
|------|------|
| Meta Quest Store | 首屏加载快 12%，交互快 2.5x，重渲染减少 60% |
| Sanity Studio | 渲染时间减少 20-30% |
| Wakelet | LCP 2.4s → 1.8s，INP 180ms → 95ms |

## 如何启用

**Vite 项目：**

```bash
npm install -D babel-plugin-react-compiler
```

```js
// vite.config.js
export default defineConfig({
  plugins: [
    react({
      babel: { plugins: ['babel-plugin-react-compiler'] },
    }),
  ],
});
```

**Next.js 16：**

```js
// next.config.ts
const nextConfig = { reactCompiler: true };
export default nextConfig;
```

启用后打开 React DevTools，优化过的组件会显示 **"Memo ✨"** 标识。

## 渐进式采用

可以按目录逐步启用：

```js
// babel.config.js
module.exports = {
  overrides: [
    {
      test: './src/features/**/*.{js,jsx,ts,tsx}',
      plugins: ['babel-plugin-react-compiler'],
    },
  ],
};
```

单个组件可以用指令退出：

```tsx
function LegacyComponent() {
  'use no memo';
  // 编译器跳过这个组件
}
```

## 编译器不能替代的

编译器解决的是自动记忆化，但以下场景仍然需要手动处理：

- **非纯函数**：`Date.now()`、`Math.random()` 需要显式控制
- **虚拟列表**：`react-window`、`react-virtual` 仍需手动优化
- **外部 Store**：Zustand 的 `useShallow` 仍在编译器范围外
- **ref 操作**：`useRef` 和命令式 DOM 操作不变

## 前提：遵守 React 规则

编译器会强制检查 React 规则，违反则跳过该组件。使用 ESLint 插件提前发现：

- 在 render 中读取 `ref.current` ❌
- 修改 props ❌
- render 中调用 `setState` ❌
- 在 `useEffect` 外执行副作用 ❌

## 总结

React Compiler 不是一个性能特性，而是一个架构转变。你删掉的 `useMemo`、`useCallback`、`React.memo` 是再也不用调试的代码。2026 年的新 React 项目，从第一天就应该开启编译器。
