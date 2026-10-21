# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev            # Astro 开发服务器（热更新），http://localhost:4321/StaryFall/
npm run build          # 构建静态站点到 ./dist
npm run preview        # 本地预览已构建产物
npm run check          # astro check（类型 + 模板诊断，CI 也会跑，必须 0 error）
npm run check:content  # 内容规范检查（frontmatter / 标签 / 排版 / 代码块语言），CI 也会跑
```

`npm run check` 负责代码层（类型与模板），`npm run check:content` 负责内容层（见
「Content conventions」）。**改完内容或样式后两个都要跑。** 内容检查支持 `-- --fix` 自动修
机械性问题。

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
| `/rss.xml` | `src/pages/rss.xml.ts` | RSS，`@astrojs/rss`，全量文章。正文通过 item 的 `content` 字段输出**全文**（用 `astro/container` 把内容组件渲染成 HTML，并把 `/StaryFall/…` 补成绝对地址）。库会自动声明 `xmlns:content` 并写成**实体转义的文本**（`&lt;div&gt;`），这是 RSS 承载 HTML 的常规写法。**不要自己包 CDATA** —— 库内部用 XML 解析器重建 `customData`，CDATA 标记会被吃掉、只剩正文，包装纯属空转（踩过）。代价是整份 feed 约 1.7 MB —— 代码块的 Shiki 高亮是内联 `style`，这是体积的主要来源；gzip 后约 235 KB |
| `/rss.xsl` | `src/pages/rss.xsl.ts` | `/rss.xml` 的 XSL 样式表：浏览器里打开 rss.xml 会渲染成可读的订阅页，而不是原始 XML。做成 Astro 路由（返回 `application/xml`）而不是放 `public/`，是为了确保 MIME 类型可被浏览器接受，否则样式表会被静默忽略 |
| `/404` | Starlight 内置 | 无需自己写 |

> 注意：仓库里**没有** `/trade/` 交易日志系统，历史文档中的相关描述已移除。

**Key files：**

- **`astro.config.mjs`** — Astro 6 + Starlight 0.39。`sidebar: []`、`devToolbar` 关闭、`customCss` 指向
  `src/styles/custom.css`、`head` 里注入 RSS alternate 与分享卡片（`og:image` 等）。
  `components` 覆盖了 4 个 Starlight 组件（见下）。
  `site` / `base` 在这个文件里另有一份字面量（`SITE` / `BASE`）：它不能从 `src/consts.ts` 导入，
  因为后者靠 `import.meta.env` 派生，而配置文件在 Vite 的模块上下文之外执行。
- **`src/content.config.ts`** — 单一 `docs` collection，Starlight 的 `docsLoader()` + `docsSchema()`
  扩展 `date: z.date().optional()` 与 `tags: z.array(z.string()).optional().default([])`。
  **`tags` 带一个 transform**：`trim → toLowerCase → 空白转 -`，用于合并 `AI`/`ai` 这类大小写重复标签
  （不合并会在大小写不敏感的文件系统上互相覆盖目录，导致标签页文章数不对）。
- **`src/consts.ts`** — `base`（从 `import.meta.env.BASE_URL` 派生）、`site`、`url()`、`absoluteUrl()`、`siteRoot`、
  `OG_IMAGE`（分享卡片路径）、`themeColor`（仅给 `theme-color` 这类内联字符串用）。
  **站内链接一律用它拼 base，不要硬编码 `/StaryFall`。**
- **`src/components/SiteHead.astro`** — 首页 / `/feed/` / `/work/` / `/tags/` 共用的 `<head>` **内容**
  （canonical + og:* + twitter:* + apple-touch-icon + RSS alternate）。加一个 meta 只改这里。
  **它只收 `<head>` 内容，不产出 `<html>` / `<body>`**：各页 `<style>` 里的 `body { … }` 会被 Astro
  作用域化成 `body:where(.astro-xxxx)`，作用域类只加在渲染该元素的文件上，把 `<body>` 搬进 layout
  会让四页的字体/行高/max-width 静默失配。文章页不走这里，head 由 Starlight 生成，
  `og:image` 在 `astro.config.mjs` 的 `head` 里注入。
- **`src/lib/posts.ts`** — `postSlug()`、`getPosts()`（按日期倒序）、`findRelated()`、`findSiblings()`、`readingMinutes()`。
  slug 推导是 `post.id.replace(/^posts\//, '').replace(/\.(md|mdx)$/, '')`，只在这里维护一份。
- **`src/scripts/pagination.ts`** — 首页与 /feed 的分页：`?page=N` 写入 URL（`pushState`）、
  月份标题移动到当前页首张卡片之前、响应 `popstate`/`hashchange`。
  上一页/下一页是必需按钮，**第一页/最后一页跳转是可选按钮**（页面提供 `#firstPage`/`#lastPage` 才启用）；
  只有一页时会整条隐藏分页栏。
- **`src/styles/tokens.css`** — 全站设计 token + 文章排版间距 + 重置，另外托管独立页面共用的
  `.footer` 与分页（`.pagination` / `.page-btn` / `.page-info`）—— 这些原来各页各写一份，
  后来分别漂移（页脚 padding 三种、分页有两种外观），收回这里才有唯一来源。
  **重置只允许 `box-sizing` 和 `html, body` 的 margin/padding**：Starlight 的正文排版依赖浏览器默认
  UA 外边距，它自身不定义 `p`/`h2`/`pre`/`table`/`ul` 的 margin 与 padding，一旦对通用选择器清零，
  正文会挤成一团（曾因此出过事故）。
- **`src/styles/custom.css`** — Starlight 侧的布局与排版覆盖，内含若干**非直觉的布局不变量**，见下节。
- **`src/styles/hero.css`** — 首页 / `/feed/` / `/work` 共用的头图样式（统计徽标 + 渐变标题 + 胶囊导航 + 网格纹理）。
  改头图只需改这一个文件，三个页面结构一致（`.hero > .hero-inner > .hero-badge / h1 / .tagline / .hero-nav`）。
- **`--page-max`（`tokens.css`）** — 独立页面的内容最大宽度，当前 `1200px`。
  原先各页各写 720–800px，1440 视口下两侧各空 300px 以上，整站显得又窄又素。
  首页与 `/feed`、`/work` 同时改成 `repeat(auto-fill, minmax(min(420px, 100%), 1fr))` 的双列栅格。
  **`min()` 那一层不能省**：裸写 `minmax(420px, 1fr)` 时列宽下限恒为 420px，视口窄于 420px
  （手机竖屏）会把整页撑出横向滚动条，实测 375px 下溢出约 93px。

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
4. **`--sl-content-width` 用 `clamp(45rem, 61vw, 51.5rem)` 而不是固定值。** 上限原本是 50rem，
   但那样正文在 1440px 以上被锁死在 800px，1920px 视口下两侧各空 366–378px、正文只占视口 42%。
   56rem / 54rem / 52rem 都试过偏宽，最终 51.5rem = 824px = **每行 49.05 个中文字**（正文 16.8px）。
   **这个值是被表格卡住的**：51rem（816px / 48.57 字）时 `claude-code-commands` 表格里
   `cat logs.txt | claude -p "explain"` 会折行，实测折行临界就在 824px。
   对应视口：1152px → 720px、1280px → 781px、1339px 以上封顶 824px。
   **下限别动**：实测抬到 46rem 会让 1152px 下左留白从 34px 掉到 26px（正文贴边）。
5. **72rem 以下要补一条居中规则。** `ContentPanel.astro` 里 `.sl-container { margin-inline: … }`
   被包在 `@media (min-width: 72rem)` 内，所以「视口已能容下正文列、但 ToC 还没出现」的那段区间，
   正文会贴左。
6. **目录宽度覆盖了 Starlight 的"魔法数"。** ToC 内容宽原本被一条
   `((100vw - …) * 0.25)` 的 `max-width` 卡到 200px 上下（源码注释自称 `MAGIC NUMBER`），
   而目录列实际有 379px，导致条目折行。现在改为铺满实际列宽并封顶 `21rem`。

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
`npm run check` → `npm run check:content` → `npm run build`（`env: GITHUB_TOKEN`，供 `work.astro`
构建时请求 GitHub API）→ 仅 `main` 的非 PR 构建上传并部署 `./dist` 到 GitHub Pages。

内容规范检查进了 CI 就意味着**一个缺空格也会让构建失败**。如果哪次赶时间不想被拦，
就临时在本地跑 `npm run check:content -- --fix`，而不是去改 CI。

**只维护 `package-lock.json` 一份锁文件，用 `npm ci`。** 不要再引入 pnpm/yarn 锁文件。

## Content conventions

**这一节是硬规则，`node tools/check-content.mjs` 会逐条实现**（`npm run check:content`，
CI 也会跑）。**改规则必须两处同步**，否则文档和检查器会分叉。

```
npm run check:content            # 只报告，有问题退出码 1
npm run check:content -- --fix   # 自动修「机械性」问题（见下）
```

`--fix` 只处理无歧义项：中英文空格、`...` → `……`、行尾空白、末尾换行、CRLF、语言别名。
需要判断的一律不自动改（补代码块语言、翻译标签、改写 description）。

**frontmatter**

- 字段固定四项、顺序固定：`title` → `description` → `date` → `tags`。
- `description` **40–120 字**。它不只是 SEO —— 会渲染成文章头部导语，太短撑不住，太长会被截断。
- `date` 写裸值 `YYYY-MM-DD`，**不加引号、不带时间**。
- `tags` 写**小写短横线英文**，2–6 个。schema 的 transform 会把中文/大写/空格规范化成 slug，
  但源文件里也必须写规范形式 —— 否则同一个标签会分裂成多个看起来一样的入口。
  块状（`tags:` 换行 + `- x`）与内联（`tags: [x, y]`）两种写法都允许，同一批文章应统一。
- `title` / `description` 也会被排版规则检查（它们同样是读者可见的文本）。

**正文结构**

- 正文从 `##` 开始，`#` 由 `PageTitle` 渲染 —— 正文出现 h1 会导致一页两个 h1。
- 标题层级不得跳跃（`##` 下只能接 `###`）。
- **代码块必须标语言**。ASCII 架构图 / 目录树 / 流程箭头用 `text`；shell 命令用 `bash`。
  语言只能在 `tools/check-content.mjs` 的 `LANGS` 集合内，别名会被要求改正：
  `typescript` → `ts`、`shell` / `sh` → `bash`、`py` → `python`、`yml` → `yaml`。
- 表格各行列数必须与表头一致；单元格里的 `|` 要转义成 `\|`。

**中文排版**

- 中文与英文/数字之间加空格：`Word 文档`、`2024 年`、`多 Agent 流水线`。
- 中文后接全角标点：`，。；：！？`。
- 省略号用 `……`，不用 `...`。
- 站内链接用 `src/consts.ts` 的 `base` 拼，写全路径并以 `/` 结尾（`/StaryFall/posts/foo/`）。

**文件层**：UTF-8 无 BOM、LF 换行、末尾有换行、行尾无空白、不用 Tab 缩进。

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
- 改完内容的固定顺序：`npm run check:content` → `npm run check` → `npm run build` →
  `node tools/measure/verify-typography.mjs`。
- 格式之外还有**内容层面**的规范：`CONTENT-PATTERN.md` 定义了四类文章（产品深度解析 /
  跟进更新 / 概念科普 / 速查表）的骨架、字数预算、证据纪律、执行边界（能不能跑被测项目）
  与交稿自检。它**不由 CI 强制**，但新稿与改稿都应先对着它自检一遍。
- 写含中文的源文件时不要用 PowerShell 的 `Set-Content` / `Out-File`（默认编码会在 UTF-8 文件前加 BOM，
  且在部分环境下把中文写坏）。用 Node 的 `fs` 或编辑器直接写。
- **`public/og-image.png` 与 `public/apple-touch-icon.png` 是生成物**，不是手绘：改站名 / 副标题 /
  域名 / 图标后要重跑 `python tools/og/make-images.py`（需要 Pillow、numpy、系统中文字体），
  否则卡片上还是旧文案。这个脚本**不参与构建、不在 CI 里**，所以它坏了不会有人告诉你 ——
  只有重跑时才会发现。好消息是它幂等：同一份脚本重跑出来字节完全一致，可以直接对比 hash。

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
