import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://bluebridge-e.github.io',
  base: '/StaryFall',
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
            href: '/StaryFall/rss.xml',
          },
        },
        {
          // Starlight 固定输出 twitter:card=summary_large_image，但本站在没有
          // og:image 的情况下大图卡会退化为普通卡，语义矛盾。这里显式覆盖成
          // summary（Starlight 的 mergeHead 按 name 去重，会替换而非追加重复标签）。
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary' },
        },
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/BlueBridge-E' },
      ],
      sidebar: [],
    }),
  ],
});
