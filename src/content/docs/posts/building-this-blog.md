---
title: 搭建这个博客
description: 如何用 Astro + Starlight 从零搭建一个技术博客并部署到 GitHub Pages
date: 2026-05-11
tags: [astro, starlight, github-pages]
---

## 为什么选择 Astro + Starlight

决定搭建个人博客时，我考虑了以下几个需求：

- **内容优先**：主要是写技术文章，不需要复杂的交互
- **代码友好**：需要良好的语法高亮和代码展示
- **部署简单**：静态站点，push 就部署
- **学习价值**：技术栈本身要有意思

最终选择了 Astro + Starlight，主要原因：

1. **Astro** 默认输出零 JS 的纯 HTML，极致性能
2. **Starlight** 是 Astro 官方文档主题，开箱带搜索、暗色模式、Expressive Code 代码块
3. **MDX 支持**：可以在 Markdown 里嵌入组件

## 初始化项目

```bash
# 创建项目
npm create astro@latest -- --template starlight

# 或者手动安装
npm install astro @astrojs/starlight
```

## 配置

`astro.config.mjs` 是核心配置文件：

```js
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'My Blog',
      social: {
        github: 'https://github.com/your-username',
      },
      sidebar: [
        {
          label: 'Posts',
          autogenerate: { directory: 'posts' },
        },
      ],
    }),
  ],
});
```

## 部署到 GitHub Pages

使用 GitHub Actions 自动部署：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

每次 push 到 main 分支，GitHub Actions 就会自动构建并部署。

## 接下来

下一步计划：

- 集成 Giscus 评论系统
- 添加标签页面
- 接入 Umami 访问统计

这个博客本身就是一个持续演进的项目，我会把每次改进的过程都记录下来。
