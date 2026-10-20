import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '  PASS' : '  FAIL'}  ${n}${d ? '  -> ' + d : ''}`); ok ? pass++ : fail++; };

console.log('===== 1. 致命错误已修：不再有全局星号边距重置 =====');
const tokens = read('src/styles/tokens.css');
// 剥离注释，再找出「选择器以 * 开头」的规则（即真正的通用选择器，
// 而不是 `> * + *` 这类后代/兄弟组合器里的 *）
const tokensNoComments = tokens.replace(/\/\*[\s\S]*?\*\//g, '');
const starBlocks = [...tokensNoComments.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .filter((m) =>
    m[1]
      .split(',')
      .map((s) => s.trim())
      .some((s) => s === '*' || s.startsWith('*::') || s.startsWith('*:')),
  )
  .map((m) => `${m[1].trim()} { ${m[2].trim()} }`);

check(
  '通用选择器规则不含 margin/padding 归零',
  starBlocks.length > 0 && starBlocks.every((b) => !/margin|padding/.test(b)),
  starBlocks.map((b) => b.replace(/\s+/g, ' ')).join(' ; ') || '未找到',
);
check('tokens.css 仅对 html/body 做边距重置', /html,\s*body\s*\{[^}]*margin:\s*0/.test(tokensNoComments));
check('通用选择器只设 box-sizing', starBlocks.every((b) => /box-sizing:\s*border-box/.test(b)));

const f = fs.readdirSync('dist/_astro').find((x) => /^common\..*\.css$/.test(x));
const css = read(`dist/_astro/${f}`);
check('产物 CSS 无全局星号 margin 重置', !/\*\{box-sizing:border-box;margin:0;padding:0\}/.test(css));
check('首页内联 CSS 也无该重置', !read('dist/index.html').includes('*{box-sizing:border-box;margin:0;padding:0}'));

console.log('\n===== 2. 文章排版规则已进产物 =====');
for (const [n, re] of [
  ['正文纵向节奏 .sl-markdown-content > * + *', /\.sl-markdown-content>\*\+\*\{margin-top:1rem\}/],
  ['标题间距', /\.sl-markdown-content :is\(h1,h2,h3,h4,h5,h6\)\{margin-top:2rem/],
  ['pre 内边距与圆角', /\.sl-markdown-content pre\{padding:1rem 1.15rem;border-radius:8px/],
  ['th/td 内边距与边框', /\.sl-markdown-content :is\(th,td\)\{padding:\.5rem \.85rem/],
  ['表头底色（主题自适应）', /\.sl-markdown-content thead th\{background:var\(--sl-color-bg-accent, ?var\(--accent-soft\)\)/],
  ['列表缩进', /\.sl-markdown-content :is\(ul,ol\)\{padding-inline-start:1\.5rem/],
]) check(n, re.test(css), re.test(css) ? '' : '未在产物中找到');

console.log('\n===== 3. 此前几轮的修复未受影响 =====');
const post = read('dist/posts/mcp-protocol/index.html');
check('文章页 lang=zh-CN', /<html[^>]*lang="zh-CN"/.test(post));
// ↓ 以下几条随布局改版同步更新：旧的断言检查的是「删掉 ToC 换居中」的临时方案，
//   现在 ToC 已恢复，断言改为验证新方案。
check('正文左边距已归零（不留 300px 空档）', /\{--sl-content-inline-start: ?0rem\}/.test(css));
check('导航 --__toc-width 补丁存在', /\.header\{--__toc-width: ?0rem\}/.test(css));
check('ToC 列不再被压成 0 宽', !/\.right-sidebar-container\{width:0/.test(css));
check('正文宽度随视口自适应（45–51.5rem 区间）', /--sl-content-width: ?clamp\(45rem, ?61vw, ?51\.5rem\)/.test(css));
check('72rem 以下补单栏居中', /@media\(max-width:71\.999rem\)\{\s*\.main-pane \.content-panel \.sl-container\{margin-inline:auto\}\s*\}/.test(css));
check('标题区与正文间的整栏分隔线已移除', /\.main-pane \.content-panel\+\.content-panel\{border-top:0\}/.test(css));
// Starlight 在 ≥72rem 给 .right-sidebar 画了一条从视口顶到底的竖线，本项目已关掉
check('正文与目录之间的竖线已移除', /\.right-sidebar\{border-inline-start:0\}/.test(css));
check('文章页 ToC 已渲染', post.includes('right-sidebar-panel') && post.includes('本页内容'));
check('标题区含日期与阅读时长', /class="post-meta/.test(post) && /约 \d+ 分钟/.test(post));
check('标题区含摘要行', /class="post-lead/.test(post));
check('标题区含标签胶囊', /class="post-tag/.test(post));
check('标题锚点 _top 保留', /id="_top"/.test(post));
// 目录改版（2026-10 第二版）：竖轨 + 分层字号 + 当前项在轨上高亮
check('目录宽度铺满列宽（封顶 21rem）', /\.right-sidebar-panel \.sl-container\{width:min\(21rem,calc\(/.test(css));
check('目录父级字号 .95rem', /\.right-sidebar-panel nav>ul>li>a\{[^}]*font-size:\.95rem/.test(css));
check('目录子级字号 .88rem', /\.right-sidebar-panel nav ul ul a\{[^}]*font-size:\.88rem/.test(css));
check('目录父级加粗 600', /\.right-sidebar-panel nav>ul>li>a\{[^}]*font-weight:600/.test(css));
check('目录左侧竖轨 2px', /\.right-sidebar-panel nav>ul:before\{[^}]*width:2px/.test(css));
check('目录当前项高亮条', /a\[aria-current=true\]\{color:var\(--sl-color-text-accent/.test(css));
check('「本页内容」标题弱化', /\.right-sidebar-panel h2\{[^}]*letter-spacing:\.14em/.test(css));
check('「本页内容」下方强调短线', /\.right-sidebar-panel h2:after\{[^}]*width:1\.5rem/.test(css));
check('暗色主题强调色已提亮', /\[data-theme=dark\]\{--sl-color-text-accent: ?#7ea2ff/.test(css));
check('相关文章仍在', post.includes('related-heading'));
check('相关文章卡片结构（日期/时长在标题上方）', /class="related-meta/.test(post) && /class="related-card/.test(post));
check('相关文章不再有标签行', !/class="related-tags/.test(post));
{
  // 页脚的「上一篇/下一篇」与「相关文章」不得重复推荐同一篇
  const dup = [];
  for (const slug of fs.readdirSync('dist/posts')) {
    const f = `dist/posts/${slug}/index.html`;
    if (!fs.existsSync(f)) continue;
    const html = read(f);
    const sib = html.match(/<nav class="post-siblings[\s\S]*?<\/nav>/);
    const rel = html.match(/<section class="related[\s\S]*?<\/section>/);
    if (!sib || !rel) continue;
    const hrefs = (s) => [...s.matchAll(/href="(\/StaryFall\/posts\/[^"]+)"/g)].map((m) => m[1]);
    const seen = new Set(hrefs(sib[0]));
    if (hrefs(rel[0]).some((h) => seen.has(h))) dup.push(slug);
  }
  check('相关文章不与上一篇/下一篇重复', dup.length === 0, dup.join(', '));
}
check('RSS 仍在', fs.existsSync('dist/rss.xml'));
check('favicon.ico 已生成', fs.existsSync('dist/favicon.ico'));
check('favicon.svg 仍在', fs.existsSync('dist/favicon.svg'));
check('robots.txt 仍在', fs.existsSync('dist/robots.txt'));
check('Pagefind zh-cn', read('dist/pagefind/pagefind-entry.json').includes('"zh-cn"'));
check('twitter:card=summary 唯一', (post.match(/name="twitter:card"/g) || []).length === 1);
check('tags/ai-agent 合并', (read('dist/tags/ai-agent/index.html').match(/class="post-title/g) || []).length === 2);
// 期望值从数据源现算：新增文章或 CI 刷新 news 之后，断言不该跟着过期。
const EXPECTED_POSTS = fs.readdirSync('src/content/docs/posts').filter((f) => f.endsWith('.md')).length;
const EXPECTED_NEWS = JSON.parse(fs.readFileSync('public/ai-news.json', 'utf8')).items.length;
check(`feed ${EXPECTED_NEWS} 卡片`, (read('dist/feed/index.html').match(/data-pagination-card/g) || []).length === EXPECTED_NEWS);
check(`首页 ${EXPECTED_POSTS} 卡片`, (read('dist/index.html').match(/data-pagination-card/g) || []).length === EXPECTED_POSTS);
check(`文章数 ${EXPECTED_POSTS}`, fs.readdirSync('dist/posts').filter((d) => fs.existsSync(`dist/posts/${d}/index.html`)).length === EXPECTED_POSTS);
// 主题与内容清理
check('全站钉死浅色（主题选择器已移除）', !post.includes('starlight-theme-select'));
check('work 页不再引用 404 仓库', !read('dist/work/index.html').match(/cyber-coin|Giuseppe/));
check('站点 description 已中文化', read('dist/404.html').includes('个人技术博客'));
// 独立页面改版：统一 1200px 容器 + 共享头图 + 多列栅格
check('--page-max 已定义', /--page-max: ?1200px/.test(css));
check('首页有特稿卡片', read('dist/index.html').includes('post-card--featured'));
check('首页/feed/work 共用头图样式', ['dist/index.html', 'dist/feed/index.html', 'dist/work/index.html'].every((f) => read(f).includes('hero-badge')));
// RSS 订阅页（XSL 样式表）
check('rss.xml 引用 XSL 样式表', /<\?xml-stylesheet href="\/StaryFall\/rss\.xsl" type="text\/xsl"\?>/.test(read('dist/rss.xml')));
check('rss.xsl 已生成且是样式表', read('dist/rss.xsl').includes('<xsl:stylesheet'));
check('rss.xsl 里的订阅地址是生产绝对地址', read('dist/rss.xsl').includes('https://bluebridge-e.github.io/StaryFall/rss.xml'));
check(`rss.xml 仍有 ${EXPECTED_POSTS} 条 item`, (read('dist/rss.xml').match(/<item>/g) || []).length === EXPECTED_POSTS);
// A 组修复回归（2026-10）：重复 h1、表格竖线、work 徽标计数
{
  const htmls = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) htmls.push(p);
    }
  };
  walk('dist');
  const bad = htmls.filter((f) => (read(f).match(/<h1/g) || []).length !== 1);
  check(
    '每页恰好 1 个 <h1>（正文不得再用 # 写标题）',
    bad.length === 0,
    `${bad.length} 页异常：${bad.slice(0, 3).join(', ')}`,
  );

  const hr = read('dist/posts/headroom-deep-dive/index.html');
  const hrRow = (hr.match(/<tr>(?:(?!<\/tr>)[\s\S])*codex(?:(?!<\/tr>)[\s\S])*<\/tr>/) || [''])[0];
  check(
    '表格里的代码竖线已转义（headroom Agent Wrap 行）',
    hrRow.includes('aider') && hrRow.includes('gemini') && (hrRow.match(/<td/g) || []).length === 3,
    hrRow ? `${(hrRow.match(/<td/g) || []).length} 个单元格` : '未找到该行',
  );

  const cc = read('dist/posts/claude-code-commands/index.html');
  const ccRow = (cc.match(/<tr>(?:(?!<\/tr>)[\s\S])*logs\.txt(?:(?!<\/tr>)[\s\S])*<\/tr>/) || [''])[0];
  check(
    '表格里的代码竖线已转义（claude-code-commands 示例列）',
    ccRow.includes('claude -p') && (ccRow.match(/<td/g) || []).length === 3,
    ccRow ? `${(ccRow.match(/<td/g) || []).length} 个单元格` : '未找到该行',
  );

  const work = read('dist/work/index.html');
  const badge = ((work.match(/hero-badge[^>]*>[\s\S]{0,220}?<\/p>/) || [''])[0] || '').replace(/<[^>]+>/g, ' ');
  const cards = (work.match(/class="work-card/g) || []).length;
  check('work 徽标项目数 = 实际卡片数', badge.includes(`${cards} 个项目`), `徽标「${badge.trim()}」/ 卡片 ${cards} 张`);

  check(
    '分页含首页/尾页按钮（首页与 feed）',
    ['dist/index.html', 'dist/feed/index.html'].every(
      (f) => read(f).includes('id="firstPage"') && read(f).includes('id="lastPage"'),
    ),
  );
}
/*
 * feed 的页面样式落在哪里取决于体积：Astro 的 inlineStylesheets: 'auto' 会在
 * 样式表足够小时直接内联进 HTML，否则单独出一个 chunk。这里两种位置都找，
 * 避免断言因为「构建产物的文件布局」变化而假失败（曾因为删除几条 footer 规则
 * 让 feed 的样式掉到内联阈值以下，脚本直接 ENOENT 崩掉）。
 */
const feedCss = () => {
  const inline = (read('dist/feed/index.html').match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
  const chunks = fs
    .readdirSync('dist/_astro')
    .filter((f) => f.endsWith('.css'))
    .map((f) => read(`dist/_astro/${f}`))
    .join('\n');
  return `${inline}\n${chunks}`;
};
check('feed 月份标题跨满整行', /grid-column:1 ?\/ ?-1/.test(feedCss()));

console.log(`\n===== 合计: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
