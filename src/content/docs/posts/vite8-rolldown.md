---
title: Vite 8 + Rolldown：Rust 驱动的 10 倍构建提速
description: Vite 8 用 Rust 编写的 Rolldown 统一了打包工具链，构建速度提升数倍到数十倍
date: 2026-05-19
tags: [vite, rust, frontend, devtools]
---

## Vite 8 最大的变化

2026 年 3 月，Vite 8.0 正式发布。表面 API 变化不大，底层却是一次重构：**用 Rust 编写的 Rolldown 取代了之前 esbuild + Rollup 的双打包工具架构**，成为 Vite 唯一的打包工具。

先看架构对比：

```
Vite 7 架构：                    Vite 8 架构：
  开发模式 → esbuild (Go)         开发模式 → Rolldown (Rust)
  生产构建 → Rollup (JS)          生产构建 → Rolldown (Rust)
```

以前开发和生产用不同的打包器，行为经常不一致——开发环境跑的代码跟上线后的代码不是同一条管道。现在统一了。

## 性能数据

### 基准测试

Rolldown 比 Rollup（纯 JavaScript）快 **10-30 倍**，性能与 esbuild 持平。

### 真实项目

| 项目 | Vite 7 | Vite 8 | 提升 |
|------|--------|--------|------|
| Linear | 46 秒 | 6 秒 | 87% |
| Ramp | — | — | 57% |
| Beehiiv | — | — | 64% |
| 某百万行代码项目 | 12 分钟 | 2 分钟 | 83% |
| 某中大型项目 | 4 分钟 | 30 秒 | 8 倍 |

对日常开发体验的影响 —— HMR 速度、冷启动时间、CI 构建时长 —— 是实实在在的。

## 底层技术栈

整个工具链由尤雨溪创立的 **VoidZero** 公司主导开发，全部用 Rust 重写：

```
Rolldown (打包器，Rust)
  └── Oxc (编译器/解析/压缩，Rust)
       ├── TypeScript 转译
       ├── JSX 转换
       ├── 语法降级
       ├── 代码压缩
       └── 模块解析
```

所有组件都是同一批人写的，端到端一致性和深度优化是第三方插件达不到的。

## 迁移成本

绝大多数现有 Vite 7 插件可以直接在 Vite 8 中使用，因为 Rolldown 兼容 Rollup 插件 API。升级基本是：

```bash
npm install vite@latest
```

需要注意的点：
- 个别依赖 Rollup 内部实现细节的插件可能需要更新
- 如果用了 `@rollup/plugin-commonjs` 或 `@rollup/plugin-node-resolve`，Rolldown 已内置这些功能，可以直接删掉

## 实验性功能：全打包模式

Vite 在开发时默认不打包模块（利用浏览器原生 ESM），Vite 8 新增了实验性的全打包模式：

| 指标 | 改善 |
|------|------|
| 开发服务器启动 | 快 3x |
| 完全重载 | 快 40% |
| 网络请求数 | 减少 10x |

大型项目的开发服务器启动从几十秒降到几秒，体验提升明显。

## 竞争格局

| 工具 | 打包器 | 语言 | 定位 |
|------|--------|------|------|
| Vite 8 | Rolldown | Rust | 框架无关，插件最多 |
| Next.js 16 | Turbopack | Rust | 深度绑定 Next.js |
| Rspack | Rspack | Rust | Webpack 兼容优先 |
| Bun | 内置 | Zig | 性能最强，运行时+打包 |

Vite 8 的优势在于**框架无关 + 插件生态最广**。不管你用 React、Vue、Svelte 还是 Astro，Vite 8 都能用。

## VoidZero 的下一步

Vite 8 只是第一步，VoidZero 还在推进：

- **Vite+**：统一的项目工作流 CLI，把 dev/build/deploy 整合成一条命令
- **Void**：Vite 原生的部署平台

Vite 正从一个构建工具演变成一个完整的端到端平台。

## 总结

Vite 8 是一个基础设施型升级。你不需要学新 API，但构建速度会显著提升。如果你的项目还在用 Vite 7，升级的投入产出比非常高。
