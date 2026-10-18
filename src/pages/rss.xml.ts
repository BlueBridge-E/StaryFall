import rss from '@astrojs/rss';
import { absoluteUrl, base, siteRoot } from '../consts';
import { getPosts, postSlug } from '../lib/posts';

export async function GET() {
  const posts = await getPosts();

  return rss({
    title: 'StaryFall',
    description: '关于 AI Agent、MCP、开源项目深度解析与前端工程化的技术博客。',
    // 含 base 的站点根，供 channel <link> 与相对链接解析使用。
    site: siteRoot,
    // 让「直接在浏览器里打开 rss.xml」渲染成可读的订阅页，而不是一屏原始 XML。
    // 注意 @astrojs/rss 是原样写进 <?xml-stylesheet href="…"?>，不会自动补 base。
    stylesheet: `${base}/rss.xsl`,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      // 必须用绝对地址：`new URL('/posts/…', 'https://host/StaryFall/')`
      // 会丢掉 base 段，所以这里直接给出带 /StaryFall 的完整 URL。
      link: absoluteUrl(`/posts/${postSlug(post.id)}/`),
      pubDate: post.data.date ?? new Date(0),
      categories: post.data.tags,
    })),
    customData: '<language>zh-cn</language>',
  });
}
