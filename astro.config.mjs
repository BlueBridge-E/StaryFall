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
      defaultLocale: 'zh-CN',
      customCss: ['./src/styles/custom.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/BlueBridge-E' },
      ],
      sidebar: [],
    }),
  ],
});
