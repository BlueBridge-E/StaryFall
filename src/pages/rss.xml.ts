import rss from '@astrojs/rss';
import { render } from 'astro:content';
// Astro 6.3 仍以 experimental_ 前缀导出容器 API，这是把内容组件渲染成字符串的
// 官方途径（升级 Astro 时要留意它何时转正）。
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { absoluteUrl, base, siteRoot } from '../consts';
import { getPosts, postSlug } from '../lib/posts';

const origin = new URL(siteRoot).origin;

/**
 * 正文里的站内链接是 `/StaryFall/…` 这样的站点绝对路径，而 feed 阅读器没有
 * 「base」这个概念，必须补成完整地址，否则在阅读器里点开是死链。
 */
const absolutize = (html: string) => html.replace(/(\b(?:href|src))="\//g, `$1="${origin}/`);

/** CDATA 段里出现 `]]>` 会提前闭合，按 XML 规范拆成两段再接上 */
const cdata = (html: string) => `<![CDATA[${html.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

export async function GET() {
  const posts = await getPosts();
  const container = await AstroContainer.create();

  // 以前这里只有 description（平均 80 字），订阅者点开只能看到一句话，必须跳回网站。
  // 现在把正文渲染成 HTML 塞进 content:encoded：完整的 RSS 阅读体验。
  // 注意渲染出来的是「内容片段」，不带页面 CSS —— 阅读器会用自己的一套排版，这是预期的。
  const items = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post);
      const html = absolutize(await container.renderToString(Content));
      return {
        title: post.data.title,
        description: post.data.description,
        // 必须用绝对地址：`new URL('/posts/…', 'https://host/StaryFall/')`
        // 会丢掉 base 段，所以这里直接给出带 /StaryFall 的完整 URL。
        link: absoluteUrl(`/posts/${postSlug(post.id)}/`),
        pubDate: post.data.date ?? new Date(0),
        categories: post.data.tags,
        customData: `<content:encoded>${cdata(html)}</content:encoded>`,
      };
    }),
  );

  return rss({
    title: 'StaryFall',
    description: '关于 AI Agent、MCP、开源项目深度解析与前端工程化的技术博客。',
    // 含 base 的站点根，供 channel <link> 与相对链接解析使用。
    site: siteRoot,
    // 让「直接在浏览器里打开 rss.xml」渲染成可读的订阅页，而不是一屏原始 XML。
    // 注意 @astrojs/rss 是原样写进 <?xml-stylesheet href="…"?>，不会自动补 base。
    stylesheet: `${base}/rss.xsl`,
    // 声明 content:encoded 所在的命名空间（RSS 2.0 的内容扩展）
    xmlns: { content: 'http://purl.org/rss/1.0/modules/content/' },
    items,
    customData: '<language>zh-cn</language>',
  });
}
