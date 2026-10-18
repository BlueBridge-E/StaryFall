/**
 * 为 /rss.xml 提供一个 XSL 样式表，让「点进 rss.xml」不再是一屏原始 XML。
 *
 * 为什么做成 Astro 路由而不是放 public/rss.xsl：
 * 浏览器要求样式表的 MIME 类型可被解析（text/xml、application/xml 等）。
 * 放 public/ 时 dev server 与 GitHub Pages 对 `.xsl` 的处理不确定，
 * 一旦按 octet-stream 返回，Chrome/Edge 会直接忽略它、退回显示原始 XML。
 * 这里显式返回 application/xml，行为在 dev 和生产都确定。
 *
 * 生成的地址：/StaryFall/rss.xsl
 */
import { base, site } from '../consts';

// 订阅地址与回站链接都由 base 派生，仓库改名后无需改这份样式表
const feedUrl = `${site}${base}/rss.xml`;
const homeUrl = `${base}/`;

const stylesheet = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="no"/>
  <xsl:strip-space elements="*"/>

  <!-- RFC-822 的 pubDate（如 "Mon, 21 Sep 2026 00:00:00 GMT"）转成 2026-09-21 -->
  <xsl:template name="iso-date">
    <xsl:param name="pub"/>
    <xsl:variable name="afterComma" select="substring-after($pub, ', ')"/>
    <xsl:variable name="day" select="substring-before($afterComma, ' ')"/>
    <xsl:variable name="rest" select="substring-after($afterComma, ' ')"/>
    <xsl:variable name="mon" select="substring-before($rest, ' ')"/>
    <xsl:variable name="rest2" select="substring-after($rest, ' ')"/>
    <xsl:variable name="year" select="substring-before($rest2, ' ')"/>
    <xsl:value-of select="$year"/>
    <xsl:text>-</xsl:text>
    <xsl:choose>
      <xsl:when test="$mon = 'Jan'">01</xsl:when>
      <xsl:when test="$mon = 'Feb'">02</xsl:when>
      <xsl:when test="$mon = 'Mar'">03</xsl:when>
      <xsl:when test="$mon = 'Apr'">04</xsl:when>
      <xsl:when test="$mon = 'May'">05</xsl:when>
      <xsl:when test="$mon = 'Jun'">06</xsl:when>
      <xsl:when test="$mon = 'Jul'">07</xsl:when>
      <xsl:when test="$mon = 'Aug'">08</xsl:when>
      <xsl:when test="$mon = 'Sep'">09</xsl:when>
      <xsl:when test="$mon = 'Oct'">10</xsl:when>
      <xsl:when test="$mon = 'Nov'">11</xsl:when>
      <xsl:when test="$mon = 'Dec'">12</xsl:when>
      <xsl:otherwise>—</xsl:otherwise>
    </xsl:choose>
    <xsl:text>-</xsl:text>
    <xsl:value-of select="$day"/>
  </xsl:template>

  <xsl:template match="/">
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>StaryFall — RSS 订阅源</title>
        <style>
          *{box-sizing:border-box}
          body{margin:0;background:#fafafa;color:#1a1a2e;line-height:1.7;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif;
               -webkit-font-smoothing:antialiased}
          .wrap{max-width:760px;margin:0 auto;padding:3rem 1.5rem 4rem}
          .badge{display:inline-block;margin:0;padding:.28rem .8rem;border:1px solid rgba(37,99,235,.22);
                 border-radius:999px;background:#fff;color:#2563eb;font-size:.78rem;letter-spacing:.04em}
          h1{margin:.9rem 0 0;font-size:2.25rem;font-weight:800;letter-spacing:-.02em;color:#1e40af}
          .lead{margin:.8rem 0 0;color:#6b7280;font-size:1rem}
          .url{margin:1.4rem 0 0;padding:.9rem 1.1rem;background:#fff;border:1px dashed #c7d2fe;
               border-radius:10px;font-size:.9rem;color:#1e40af;overflow-wrap:anywhere}
          code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
          .hint{margin:.7rem 0 0;color:#6b7280;font-size:.85rem}
          h2{margin:2.6rem 0 1rem;padding-bottom:.6rem;border-bottom:1px solid #e5e7eb;
             font-size:1.05rem;font-weight:700}
          ul{margin:0;padding:0;list-style:none}
          li{padding:1.1rem 0;border-bottom:1px solid #eee}
          li:last-child{border-bottom:0}
          .date{display:block;margin-bottom:.25rem;color:#9ca3af;font-size:.78rem;
                font-variant-numeric:tabular-nums}
          .title{color:#1a1a2e;font-size:1rem;font-weight:700;text-decoration:none}
          .title:hover{color:#2563eb}
          .desc{margin:.35rem 0 0;color:#6b7280;font-size:.87rem}
          .foot{margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid #e5e7eb;font-size:.85rem}
          .foot a{color:#2563eb;text-decoration:none}
        </style>
      </head>
      <body>
        <div class="wrap">
          <p class="badge">RSS 订阅源</p>
          <h1>StaryFall</h1>
          <p class="lead">这是本站的订阅地址。把它填进任意 RSS 阅读器（Feedly、Inoreader、NetNewsWire、微信读书等），有新文章时会自动收到。</p>
          <p class="url"><code>${feedUrl}</code></p>
          <p class="hint">当前共 <xsl:value-of select="count(/rss/channel/item)"/> 篇文章。用浏览器直接打开这个地址只能看到订阅源本身，需要配合阅读器使用。</p>

          <h2>最新文章</h2>
          <ul>
            <xsl:for-each select="/rss/channel/item">
              <li>
                <span class="date">
                  <xsl:call-template name="iso-date">
                    <xsl:with-param name="pub" select="pubDate"/>
                  </xsl:call-template>
                </span>
                <a class="title" href="{link}"><xsl:value-of select="title"/></a>
                <p class="desc"><xsl:value-of select="description"/></p>
              </li>
            </xsl:for-each>
          </ul>

          <p class="foot"><a href="${homeUrl}">← 返回 StaryFall</a></p>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;

export async function GET() {
  return new Response(stylesheet, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
