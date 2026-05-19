# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev        # Start Astro dev server (hot reload)
npm run build      # Build static site to ./dist
npm run preview    # Serve built output locally
```

No test or lint scripts are configured.

## Architecture

Astro + Starlight static blog deployed to GitHub Pages (`base: '/StaryFall'`). Default locale `zh-CN`.

**Routing and page types:**

| Route | Source | Notes |
|-------|--------|-------|
| `/` | `src/pages/index.astro` | Custom blog homepage with post list, links to `/tags/` |
| `/posts/*` | `src/content/docs/posts/*.md` | Starlight-rendered article pages with right ToC |
| `/tags/` | `src/pages/tags/index.astro` | Tag index page |
| `/tags/[tag]/` | `src/pages/tags/[tag].astro` | Dynamic tag pages, auto-generated from content |

**Key files:**

- **`astro.config.mjs`** — Astro 6 + Starlight 0.39. `sidebar: []` (disabled), `devToolbar: { enabled: false }`, `customCss` links to `src/styles/custom.css`. GitHub social link configured.
- **`src/content.config.ts`** — Single `docs` collection using Starlight's `docsLoader()` + `docsSchema()` extended with `date: z.date().optional()` and `tags: z.array(z.string()).optional().default([])`.
- **`src/styles/custom.css`** — Accent color `#2563eb`, Chinese font stack, left sidebar hidden via CSS, main content left-aligned, right ToC preserved.
- **`src/layouts/TagLayout.astro`** — Shared layout for tag pages (standalone, not wrapped in Starlight theme). Defines its own `--sl-color-*` CSS variables mirroring Starlight's naming so the tag pages visually match the article pages.

## Important patterns

- All internal links in `src/pages/` must prefix with `/StaryFall` (the `base` path). The `base` is hardcoded as a `const` in these pages because `import.meta.env.BASE_URL` is not always available.
- Post slugs are derived from `post.id` using `post.id.replace(/^posts\//, '').replace(/\.(md|mdx)$/, '')`. This pattern appears in `index.astro`, `tags/[tag].astro`, and `tags/index.astro` — keep it consistent.
- Tag pages use `getCollection('docs')` to dynamically discover all tags at build time. Adding a new post with new tags automatically generates new tag pages. The `[tag].astro` route uses `getStaticPaths` to enumerate all tags for SSG.
- Starlight's `data-has-sidebar` attribute is still set even with `sidebar: []`, so CSS overrides are needed to fix the main content width allocation. The layout uses `[data-has-sidebar][data-has-toc] .main-pane` and `[data-has-sidebar] .right-sidebar-container` selectors to correct this.
- The custom homepage (`src/pages/index.astro`) and tag pages do NOT use the Starlight theme — they are standalone Astro pages. Article pages (`/posts/*`) use Starlight with right ToC sidebar only.

## CI/CD

Push to `main` → `.github/workflows/deploy.yml`: Node 24 → `npm install` → `npm run build` → deploy `./dist` to GitHub Pages.

## Content conventions

- All content in Chinese (zh-CN).
- Every post frontmatter: `title` (required), `description` (required), `date` (optional, YAML date), `tags` (optional, string array).

## Interaction

- 与用户沟通时使用简体中文。
