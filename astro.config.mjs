import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://bluebridge-e.github.io',
  base: '/StaryFall',
  integrations: [
    starlight({
      title: 'StaryFall',
      description: 'A personal blog for learning and building.',
      defaultLocale: 'zh-CN',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/BlueBridge-E' },
      ],
      sidebar: [
        {
          label: '文章',
          items: [{ autogenerate: { directory: 'posts' } }],
        },
      ],
    }),
  ],
});
