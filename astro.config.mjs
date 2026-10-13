import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://bluebridge-e.github.io',
  base: '/StaryFall',
  devToolbar: { enabled: false },
  integrations: [
    starlight({
      title: 'StaryFall',
      description: 'A personal blog for learning and building.',
      // Starlight 仅在配置 locales 时才会应用语言；单独写 defaultLocale 会静默回落到 en，
      // 导致全站 <html lang="en">、og:locale=en、Pagefind 用英文分词。
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
      },
      customCss: ['./src/styles/custom.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/BlueBridge-E' },
      ],
      sidebar: [],
    }),
  ],
});
