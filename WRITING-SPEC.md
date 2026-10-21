# StaryFall 博文写作规范

> 给外部写作助手（OpenClaw 等）的交付规范。**逐条都是硬性要求**，
> 与本仓库 `tools/check-content.mjs` 的检查项一一对应 —— 不符合的稿子会在 CI 被拦下。
>
> 本文只管**格式**。**内容层面**（选哪类文章、骨架、字数预算、证据纪律）见
> [`CONTENT-PATTERN.md`](./CONTENT-PATTERN.md)。
>
> 站点：`https://bluebridge-e.github.io/StaryFall/`，内容目录：`src/content/docs/posts/`。

---

## 0. 交付形态

- 一篇 `.md`，文件名用 `kebab-case`（如 `headroom-follow-up-october.md`）。
- 编码 UTF-8 **无 BOM**、换行 LF、文件末尾留一个空行、行尾不要有空白。
- 全文简体中文；技术名词、产品名、代码保留英文原形。

---

## 1. frontmatter

字段只有四个，**顺序固定**：

```yaml
---
title: 标题（中文，可含英文术语）
description: 一句话导语，40–120 字
date: 2026-10-20
tags: [ai, agent, open-source]
---
```

规则：

| 字段 | 要求 |
|---|---|
| `title` | 必填。中文为主；`title` 会被渲染成页面 h1，**正文里不要再写 `#`** |
| `description` | 必填，**40–120 字**。它不是 SEO 占位符，会显示在文章标题下方作为导语：少于 40 字撑不住，多于 120 字会被截断 |
| `date` | 裸值 `YYYY-MM-DD`，**不加引号、不带时间** |
| `tags` | **2–6 个**，全部小写短横线英文。中文标签、大写、空格都不允许 |

`tags` 用内联数组写法（与站内多数文章一致）：`tags: [a, b, c]`。

---

## 2. 正文结构

- **不要写一级标题 `#`**。站点的 h1 由 `title` 自动渲染，正文再写 `#` 会导致一页两个 h1。
- 正文从 `##` 开始，层级不得跳跃（`##` 下面只能接 `###`，不能直接 `####`）。
- 每个标题下要有实际内容，不要连续两个标题而没有正文。
- 小节编号风格建议 `## 一、xxx` / `### 1.1 xxx`，但不强制。

---

## 3. 代码块

**每个代码块都必须标语言**，空的 ```` ``` ```` 会被拦下。

| 内容 | 语言标记 |
|---|---|
| ASCII 架构图、目录树、流程箭头、状态流转 | `text` |
| shell / 命令行 | `bash` |
| TypeScript | `ts`（**不要写 `typescript`**）|
| JavaScript | `js` |
| Python | `python`（不要写 `py`）|
| JSON | `json` |
| YAML | `yaml`（不要写 `yml`）|
| Mermaid 图 | `mermaid` |
| 其它允许值 | `tsx` `jsx` `jsonc` `markdown` `c` `cpp` `rust` `go` `html` `css` `scss` `sql` `diff` `http` `toml` `dockerfile` `powershell` `vim` |

注意：本博客大量使用 `text` 画架构图，**这是正常的，不是偷懒**。

---

## 4. 表格

- 每一行的列数必须和表头一致，多一列少一列都会渲染错位。
- 单元格内部如果要出现竖线，**必须转义成 `\|`**，否则整行会被切断：

```markdown
| 命令 | 说明 | 示例 |
|------|------|------|
| `claude -p` | 非交互模式 | `cat logs.txt \| claude -p "explain"` |
```

---

## 5. 中文排版（最容易出错的一节）

### 5.1 中英文之间加空格

| ❌ 错误 | ✅ 正确 |
|---|---|
| `B站` | `B 站` |
| `2024年10月` | `2024 年 10 月` |
| `Word文档`、`Excel报表` | `Word 文档`、`Excel 报表` |
| `多Agent流水线` | `多 Agent 流水线` |
| `token消耗降低99%` | `token 消耗降低 99%` |

### 5.2 标点全角

中文句子里的逗号、句号、分号、冒号、感叹号、问号一律用全角：`，。；：！？`。

### 5.3 省略号

用 `……`，**不要用 `...`**。

### 5.4 不要动的地方

行内代码 `` `B站` ``、链接地址、URL 内部的字符不要加空格、不要改。

---

## 6. 链接

| 类型 | 写法 |
|---|---|
| 站内文章 | `[标题](/StaryFall/posts/文章slug/)` —— 全路径、**结尾带 `/`** |
| 站内标签 | `[#ai](/StaryFall/tags/ai/)` |
| 外部链接 | `[名称](https://...)`，不要留裸 URL |

---

## 7. 标签词表（优先复用，不要随意造新词）

**已成规模、优先使用**（括号内是 2026-10-21 的出现次数，29 篇共 57 个标签）：

```text
open-source(16)  ai(15)  agent(13)  devtools(7)  claude-code(5)
code-analysis(5)  mcp(5)  context-engineering(3)  frontend(3)  knowledge-graph(3)
rust(3)  token-optimization(3)  typescript(3)  ai-tools(2)  architecture(2)
headroom(2)  python(2)  react(2)
```

**只用过一次（39 个，新增前先确认没有更合适的）**：

```text
ai-trading anthropic apple compiler container deep-dive desktop-app docker
document-processing education-ai electron fullstack langgraph llm macos
methodology microsoft next.js openclaw openmaic orchestration
personal-ai-infrastructure privacy quantization rag rsc screen-recorder simd
speech-to-text swift tauri trpc vector-search vibe-coding vibe-trading
video-production virtualization vite web-scraping
```

已合并的重复项（**新稿一律写左边**）：`open-source`（不要写 `opensource`）、
`agent`（不要写 `ai-agent`）、`code-analysis`（不要写 `analysis`）。
旧写法已于 2026-10-21 全部合并完毕，站内不再有残留；但**检查器不查词表**，
新稿写错不会被 CI 拦下，只能靠这条规则自律。

---

## 8. 交付前自检清单

逐条打勾再交：

- [ ] frontmatter 四字段齐全，顺序为 `title` → `description` → `date` → `tags`
- [ ] `date` 是裸值 `YYYY-MM-DD`
- [ ] `description` 在 40–120 字之间
- [ ] `tags` 2–6 个，全小写短横线英文，优先取自第 7 节词表
- [ ] 正文**没有** `#`，从 `##` 开始，层级不跳
- [ ] **每个代码块都有语言标记**，架构图用 `text`
- [ ] 表格每行列数一致，单元格内竖线写成 `\|`
- [ ] 中文与英文/数字之间都有空格
- [ ] 中文标点全角，省略号是 `……`
- [ ] 站内链接以 `/` 结尾
- [ ] 文件 UTF-8 无 BOM、LF 换行、末尾有空行

---

## 9. 参考：本仓库最近一次全站审计修掉的真实问题

这些不是理论风险，是 29 篇文章里实际存在、被逐条修掉的：

| 问题 | 数量 |
|---|---|
| 代码块没标语言 | 43 处 |
| 中英文之间缺空格 | 28 处 |
| 中文标签 / 大写标签 | 9 个 / 5 个 |
| `description` 过短（最短 24 字） | 2 篇 |
| `description` 过长（最长 131 字） | 3 篇 |
| 用 `...` 代替 `……` | 4 处 |
| 中文后接半角标点 | 1 处 |
| frontmatter 字段顺序错 | 1 篇 |

写稿时避开这些，基本就不会被打回。
