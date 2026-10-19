# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev        # Astro 开发服务器（热更新），http://localhost:4321/StaryFall/
npm run build      # 构建静态站点到 ./dist
npm run preview    # 本地预览已构建产物
npm run check      # astro check（类型 + 模板诊断，CI 也会跑，必须 0 error）
```

无独立的 test / lint 脚本。`npm run check` 是唯一的静态校验，改动后请务必跑一遍。

## Architecture

Astro + Starlight 静态博客，部署到 GitHub Pages（`base: '/StaryFall'`）。
站点语言 `zh-CN`，通过 `locales: { root: { label: '简体中文', lang: 'zh-CN' } }` 声明
（**只设 `defaultLocale` 而不设 `locales.root` 会被 Starlight 静默忽略**，页面会退回 `lang="en"`）。

**路由与页面类型：**

| Route | Source | 说明 |
|-------|--------|------|
| `/` | `src/pages/index.astro` | 独立页（不走 Starlight）：文章卡片列表 + 分页 |
| `/feed/` | `src/pages/feed.astro` | 独立页：AI 速递，读 `public/ai-news.json`，按月分组，`?page=N` 分页 |
| `/work/` | `src/pages/work.astro` | 独立页：作品集，**构建时**请求 GitHub API 取 stars/语言/更新时间 |
| `/tags/` | `src/pages/tags/index.astro` | 独立页：标签索引 |
| `/tags/[tag]/` | `src/pages/tags/[tag].astro` | 独立页：标签详情，`getStaticPaths` 按内容枚举 |
| `/posts/*` | `src/content/docs/posts/*.md` | Starlight 渲染，带右侧目录 + 文章头部 + 相关文章 |
| `/rss.xml` | `src/pages/rss.xml.ts` | RSS，`@astrojs/rss`，全量文章 |
| `/rss.xsl` | `src/pages/rss.xsl.ts` | `/rss.xml` 的 XSL 样式表：浏览器里打开 rss.xml 会渲染成可读的订阅页，而不是原始 XML。做成 Astro 路由（返回 `application/xml`）而不是放 `public/`，是为了确保 MIME 类型可被浏览器接受，否则样式表会被静默忽略 |
| `/404` | Starlight 内置 | 无需自己写 |

> 注意：仓库里**没有** `/trade/` 交易日志系统，历史文档中的相关描述已移除。

**Key files：**

- **`astro.config.mjs`** — Astro 6 + Starlight 0.39。`sidebar: []`、`devToolbar` 关闭、`customCss` 指向
  `src/styles/custom.css`、`head` 里注入 RSS alternate 与 `twitter:card=summary` 覆盖。
  `components` 覆盖了 4 个 Starlight 组件（见下）。
- **`src/content.config.ts`** — 单一 `docs` collection，Starlight 的 `docsLoader()` + `docsSchema()`
  扩展 `date: z.date().optional()` 与 `tags: z.array(z.string()).optional().default([])`。
  **`tags` 带一个 transform**：`trim → toLowerCase → 空白转 -`，用于合并 `AI`/`ai` 这类大小写重复标签
  （不合并会在大小写不敏感的文件系统上互相覆盖目录，导致标签页文章数不对）。
- **`src/consts.ts`** — `base`（从 `import.meta.env.BASE_URL` 派生）、`site`、`url()`、`absoluteUrl()`、`siteRoot`。
  **站内链接一律用它拼 base，不要硬编码 `/StaryFall`。**
- **`src/lib/posts.ts`** — `postSlug()`、`getPosts()`（按日期倒序）、`findRelated()`、`findSiblings()`、`readingMinutes()`。
  slug 推导是 `post.id.replace(/^posts\//, '').replace(/\.(md|mdx)$/, '')`，只在这里维护一份。
- **`src/scripts/pagination.ts`** — 首页与 /feed 的分页：`?page=N` 写入 URL（`pushState`）、
  月份标题移动到当前页首张卡片之前、响应 `popstate`/`hashchange`。
  上一页/下一页是必需按钮，**第一页/最后一页跳转是可选按钮**（页面提供 `#firstPage`/`#lastPage` 才启用）；
  只有一页时会整条隐藏分页栏。
- **`src/styles/tokens.css`** — 全站设计 token + 文章排版间距 + 重置。
  **重置只允许 `box-sizing` 和 `html, body` 的 margin/padding**：Starlight 的正文排版依赖浏览器默认
  UA 外边距，它自身不定义 `p`/`h2`/`pre`/`table`/`ul` 的 margin 与 padding，一旦对通用选择器清零，
  正文会挤成一团（曾因此出过事故）。
- **`src/styles/custom.css`** — Starlight 侧的布局与排版覆盖，内含若干**非直觉的布局不变量**，见下节。
- **`src/styles/hero.css`** — 首页 / `/feed/` / `/work` 共用的头图样式（统计徽标 + 渐变标题 + 胶囊导航 + 网格纹理）。
  改头图只需改这一个文件，三个页面结构一致（`.hero > .hero-inner > .hero-badge / h1 / .tagline / .hero-nav`）。
- **`--page-max`（`tokens.css`）** — 独立页面的内容最大宽度，当前 `1200px`。
  原先各页各写 720–800px，1440 视口下两侧各空 300px 以上，整站显得又窄又素。
  首页与 `/feed`、`/work` 同时改成 `repeat(auto-fill, minmax(420px, 1fr))` 的双列栅格。

**Starlight 组件覆盖（`astro.config.mjs` 的 `components`）：**

| 覆盖 | 文件 | 作用 |
|------|------|------|
| `Footer` | `src/components/Footer.astro` | 文章底部注入「上一篇 / 下一篇」+「相关文章」（内置 `Pagination` 依赖 sidebar，本项目 `sidebar: []` 故恒为空） |
| `PageTitle` | `src/components/PageTitle.astro` | 文章头部：日期 · 阅读时长 / 大标题 / 摘要（frontmatter `description`）/ 标签胶囊。保留 `id="_top"`，右侧目录首项与跳转链接靠它 |
| `ThemeProvider` | `src/components/ThemeProvider.astro` | **全站钉死浅色**（见下节） |
| `ThemeSelect` | `src/components/ThemeSelect.astro` | 空实现，去掉导航栏里已无意义的主题下拉框 |

## 布局不变量（改 `custom.css` 前必读）

右侧目录与正文的宽度由 Starlight 的公式联动，改动前先看
`node_modules/@astrojs/starlight/components/TwoColumnContent.astro` 与 `ContentPanel.astro`。
以下几条是踩过坑后总结的，**不要顺手"简化"**：

1. **不要把 `--sl-sidebar-width` 设为 0 来隐藏左栏。** 它同时被 ToC 用来算宽度，其中
   `.right-sidebar-panel .sl-container` 的 `width` 是 `calc(var(--sl-sidebar-width) - 2rem)`，
   设为 0 会算出负值，目录直接塌成 0 宽。左栏用 `.sidebar-pane { display: none }` 移出布局即可。
2. **正文偏左的真正来源是 `--sl-content-inline-start`**（`.main-frame` 的 `padding-inline-start`，
   等于 `--sl-sidebar-width`）。`custom.css` 用 `html[data-has-sidebar] { --sl-content-inline-start: 0rem }`
   单独归零。**单位必须写 `0rem` 而不是 `0`** —— 写成裸 `0` 会让 `max(0rem, 0 - 1.5rem)` 类型不匹配，
   整条 `grid-template-columns` 失效，导航栏站名会直接消失。
3. **导航栏需要 `--__toc-width: 0rem` 补丁。** `Header.astro` 用它算网格第一列（站名）的最小宽度，
   而它只在无 ToC 时才被定义；有 ToC 时会回退成 `--sl-sidebar-width`，让站名被挤成 0 宽。
4. **`--sl-content-width` 用 `clamp(45rem, 60vw, 50rem)` 而不是固定值。** 固定 50rem 时
   1152–1350px 视口下「正文 + ToC」几乎占满，正文左留白被压到 20px 上下，看起来又像贴左；
   固定 45rem 又让宽屏右侧空太多。
5. **72rem 以下要补一条居中规则。** `ContentPanel.astro` 里 `.sl-container { margin-inline: … }`
   被包在 `@media (min-width: 72rem)` 内，所以「视口已能容下正文列、但 ToC 还没出现」的那段区间，
   正文会贴左。
6. **目录宽度覆盖了 Starlight 的"魔法数"。** ToC 内容宽原本被一条
   `((100vw - …) * 0.25)` 的 `max-width` 卡到 200px 上下（源码注释自称 `MAGIC NUMBER`），
   而目录列实际有 379px，导致条目折行。现在改为铺满实际列宽并封顶 `20rem`。

## 主题：全站只有浅色

`src/components/ThemeProvider.astro` 把 `data-theme` 固定写成 `light`。

原因：只有 `/posts/*` 走 Starlight（默认 `auto` 跟随系统），而首页 / `/feed/` / `/work/` / `/tags/`
都是独立 Astro 页面，用的是 `tokens.css` 里那套写死的浅色 token，没有任何暗色版本。
深色系统访客会看到「白底首页 → 点进文章变黑底」。

`custom.css` 里保留了一段 `[data-theme='dark']` 的强调色覆盖，当前**不会生效**，是留给将来
重新启用暗色时用的。若真要恢复暗色，除了放开这里，还得给 4 个独立页面补一套暗色 token，
并把 `tokens.css` 里残留的硬编码颜色换成主题变量。

## CI/CD

`.github/workflows/deploy.yml`：`main` 推送（或 PR / 手动触发）→ Node 24 → `npm ci` →
`npm run check` → `npm run build`（`env: GITHUB_TOKEN`，供 `work.astro` 构建时请求 GitHub API）→
仅 `main` 的非 PR 构建上传并部署 `./dist` 到 GitHub Pages。

**只维护 `package-lock.json` 一份锁文件，用 `npm ci`。** 不要再引入 pnpm/yarn 锁文件。

## Content conventions

- 全部内容使用简体中文（zh-CN）。
- 每篇 frontmatter：`title`（必填）、`description`（必填，会渲染成文章头部导语，**不只是给 SEO 用**）、
  `date`（可选 YAML date）、`tags`（可选字符串数组）。
- `tags` 会被 schema 转成小写、空格转 `-` 的 slug，所以 `AI Agent` 与 `ai-agent` 等价；
  **请统一写小写短横线形式**，避免产生两个看起来一样的标签入口。
- 正文从 `##` 开始（`#` 由 `PageTitle` 渲染），标题层级会直接影响右侧目录。

## 开发注意

- `dist/` 每次 build 都会被清空；`astro preview` 在启动时快照 `dist`，重建后需重启。
  dev server 服务的是 `public/`，不是 `dist/`。
- `tools/measure/` 是本仓库的布局/排版测量工具，**不参与站点构建**，改样式后用它做回归验证：
  ```
  npm run dev
  node tools/measure/run.mjs 1440 4321                    # 量布局
  node tools/measure/run.mjs 1440 4321 theme=dark         # 量主题（当前恒为 light）
  node tools/measure/run.mjs 1440 4321 post=<slug>        # 指定文章
  node tools/measure/verify-typography.mjs                # 断言式回归检查（需先 build）
  ```
- 写含中文的源文件时不要用 PowerShell 的 `Set-Content` / `Out-File`（默认编码会在 UTF-8 文件前加 BOM，
  且在部分环境下把中文写坏）。用 Node 的 `fs` 或编辑器直接写。

## Interaction

- 与用户沟通时使用简体中文。
- **推送前必须先让用户检查，不得自行 `git push`。** 完成改动后停在「已 commit、尚未推送」的状态，
  把以下内容摆给用户看，得到明确确认后再推：
  1. `git log --oneline origin/main..HEAD` —— 这次会推哪些提交
  2. `git diff --stat origin/main..HEAD` —— 影响面
  3. 逐条说清改了什么、为什么改，以及**已知的不确定处**（不要只报好消息）
  4. 本地验证结果（`npm run check` / `npm run build` / `verify-typography.mjs`）

  推送到 `main` 会直接触发 GitHub Pages 部署，等于线上变更，所以这一步不能省。
  回滚用 `git revert <sha>` 再走一次同样的检查流程，不要用 `reset --hard` + 强推。
