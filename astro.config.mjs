import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// 与 src/consts.ts 的 site / base 保持一致。
// 这里的值不能从 consts.ts 导入：那个文件靠 import.meta.env 派生路径，
// 而配置文件在 Vite 的模块上下文之外执行，import.meta.env 不存在。
const SITE = 'https://bluebridge-e.github.io';
const BASE = '/StaryFall';

// 全站共用的社交分享卡片（public/og-image.png，由 tools/og/make-og-image.py 生成）。
// head 里的字符串不会被 Astro 重写，所以必须写绝对地址。
// 改站名/副标题后要重跑生成脚本，否则卡片上还是旧文案。
const OG_IMAGE = `${SITE}${BASE}/og-image.png`;
const OG_IMAGE_ALT = 'StaryFall —— 学习与构建的技术博客';

export default defineConfig({
  site: SITE,
  base: BASE,
  devToolbar: { enabled: false },
  integrations: [
    starlight({
      title: 'StaryFall',
      description: '个人技术博客：记录 AI 工具、工程实践与协议分析。',
      // 必须同时声明 locales.root：Starlight 只把 defaultLocale 当作 locales 的查找键，
      // 未配置 locales 时它会静默回退到内置的英文 locale（lang="en"）。
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/custom.css'],
      // 在文章页底部注入「上一篇/下一篇」与「相关文章」
      // （Starlight 内置的 <Pagination /> 依赖 sidebar，本项目 sidebar: [] 故恒为空）
      components: {
        Footer: './src/components/Footer.astro',
        // 文章页标题区：日期 / 阅读时长 / 摘要 / 标签
        PageTitle: './src/components/PageTitle.astro',
        // 全站钉死浅色主题：独立页面（首页/feed/work/tags）只有浅色 token，
        // 若文章页跟随系统变暗会出现「白底首页 → 黑底文章」的割裂
        ThemeProvider: './src/components/ThemeProvider.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
      head: [
        {
          tag: 'link',
          attrs: {
            rel: 'alternate',
            type: 'application/rss+xml',
            title: 'StaryFall',
            href: `${BASE}/rss.xml`,
          },
        },
        // Starlight 自己会输出 og:title / og:type / og:url / og:locale /
        // og:description / og:site_name 和 canonical，但**不输出 og:image**。
        // 所以它默认写的 twitter:card=summary_large_image 一直是无图的大图卡
        // （原配置曾反向覆盖成 summary 来规避这个矛盾，现在补上图即可恢复）。
        // 独立页面（首页/feed/work/tags）的同一批标签在 src/components/SiteHead.astro。
        { tag: 'meta', attrs: { property: 'og:image', content: OG_IMAGE } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: OG_IMAGE_ALT } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: OG_IMAGE } },
        { tag: 'meta', attrs: { name: 'twitter:image:alt', content: OG_IMAGE_ALT } },
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/BlueBridge-E' },
      ],
      sidebar: [],
    }),
  ],
});
