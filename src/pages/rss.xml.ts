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
 *
 * 两个约束都是实测踩出来的：
 *  - `(?!\/)`：不加的话协议相对地址 `//cdn.example.com/x` 会被改成
 *    `https://本站//cdn.example.com/x`，直接变成死链。
 *  - 先用 <pre>/<code> 切分：代码示例里的 `href="/foo"` 是给人看的字符串，
 *    在 HTML 文本节点里引号是字面量，正则会照改不误 —— 一篇讲 HTML 的文章
 *    会被静默篡改。围栏代码块渲染成 <pre>，行内代码渲染成 <code>，两种都跳过。
 */
const absolutize = (html: string) =>
  html
    .split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/)
    .map((seg: string, i: number) =>
      i % 2 === 1 ? seg : seg.replace(/(\b(?:href|src))="\/(?!\/)/g, `$1="${origin}/`),
    )
    .join('');

export async function GET() {
  const posts = await getPosts();
  const container = await AstroContainer.create();

  // 以前这里只有 description（平均 80 字），订阅者点开只能看到一句话，必须跳回网站。
  // 现在把正文渲染成 HTML 放进 item.content：@astrojs/rss 会自动声明 xmlns:content
  // 并写入 <content:encoded>，不需要自己拼 customData。
  //
  // 它写出的是**实体转义的文本**（`&lt;div&gt;`），不是 CDATA —— 这是 RSS 里承载
  // HTML 的常规写法，阅读器解码后照样当 HTML 渲染。不要试图自己包一层 CDATA：
  // 库内部会用 XML 解析器重建 customData，CDATA 标记会被吃掉、只剩转义后的正文，
  // 那段包装代码看着像在防患，实际是空转（这里刚踩过一次，见本文件的提交历史）。
  //
  // 渲染出来的是「内容片段」，不带页面 CSS —— 阅读器用自己的一套排版，这是预期的。
  const items = await Promise.all(
    posts.map(async (post) => {
      const { Content } = await render(post);
      return {
        title: post.data.title,
        description: post.data.description,
        // 必须用绝对地址：`new URL('/posts/…', 'https://host/StaryFall/')`
        // 会丢掉 base 段，所以这里直接给出带 /StaryFall 的完整 URL。
        link: absoluteUrl(`/posts/${postSlug(post.id)}/`),
        pubDate: post.data.date ?? new Date(0),
        categories: post.data.tags,
        content: absolutize(await container.renderToString(Content)),
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
    items,
    // atom:link rel=self 是 feed 工具（含校验器）用来确认「这份 feed 的正式地址」的。
    // 库不会自动生成，也不允许自定义元素进 <channel> 之外 —— 但 xmlns 选项会把
    // @_xmlns:atom 挂到 <rss> 根上，customData 再插 <atom:link>，这样命名空间是合法的。
    // 只写 customData 不声明 xmlns 会产出一份「前缀未定义」的非法 XML，整份 feed 直接失效。
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData:
      `<language>zh-cn</language>` +
      `<atom:link href="${absoluteUrl('/rss.xml')}" rel="self" type="application/rss+xml"/>`,
  });
}
