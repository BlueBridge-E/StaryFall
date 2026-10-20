#!/usr/bin/env node
/**
 * 内容规范检查（可执行版）。
 *
 * CLAUDE.md 的「Content conventions」是给人看的，这里是给 CI 看的同一套规则的实现。
 * 新增或修改规范时，两处必须同步改。
 *
 * 用法：
 *   node tools/check-content.mjs          # 只报告，有问题退出码 1
 *   node tools/check-content.mjs --fix    # 自动修复「机械性」问题后再报告
 *
 * --fix 只处理可以无歧义修正的项：中英文空格、省略号、行尾空白、末尾换行、
 * CRLF、以及 `typescript` -> `ts` 这类语言别名。需要判断的（补代码块语言、
 * 翻译标签、改写 description）一律不自动改。
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'src/content/docs/posts';
const FIX = process.argv.includes('--fix');

/** 允许的代码围栏语言（规范化之后） */
const LANGS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'bash', 'sh', 'python', 'json', 'jsonc', 'yaml',
  'mermaid', 'markdown', 'c', 'cpp', 'rust', 'go', 'html', 'css', 'scss',
  'sql', 'diff', 'text', 'http', 'toml', 'dockerfile', 'powershell', 'vim',
]);

/** 语言别名 -> 规范写法 */
const LANG_ALIAS = {
  typescript: 'ts',
  javascript: 'js',
  shell: 'bash',
  sh: 'bash',
  py: 'python',
  yml: 'yaml',
  md: 'markdown',
  txt: 'text',
};

const REQUIRED_KEYS = ['title', 'description', 'date', 'tags'];
const DESC_MIN = 40;
const DESC_MAX = 120;
const TAGS_MIN = 2;
const TAGS_MAX = 6;

// ── 解析工具 ─────────────────────────────────────────────────────
const stripFences = (body) => body.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, (m) => m.replace(/[^\n]/g, ' '));
const stripInline = (body) =>
  body
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ');

/** 感知转义的表格单元格切分 */
const cells = (line) => {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const out = [];
  let cur = '';
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\\' && t[i + 1] === '|') {
      cur += '\\|';
      i++;
    } else if (t[i] === '|') {
      out.push(cur);
      cur = '';
    } else cur += t[i];
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

/**
 * 支持块状 `- a` 与内联 `[a, b]` 两种写法的标签解析。
 *
 * 块状形式必须要求 `-` 后至少一个空白：否则 frontmatter 的结束分隔线 `---`
 * 会被当成一个 `--` 标签吃掉（曾经真的把两个文件的 frontmatter 末尾改成
 * `  - --`，导致整篇被解析成 frontmatter）。
 */
function parseTags(frontmatter) {
  const block = frontmatter.match(/^tags:[ \t]*\n((?:[ \t]*-[ \t]+[^\n]+\n?)+)/m);
  if (block) {
    return [...block[1].matchAll(/-[ \t]+(.+?)[ \t]*$/gm)].map((m) => m[1].replace(/^["']|["']$/g, '').trim());
  }
  const inline = frontmatter.match(/^tags:[ \t]*\[(.*)\]/m);
  if (inline) return inline[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  return [];
}

/** 规范化标签（与 src/content.config.ts 的 transform 保持一致） */
const normalizeTag = (t) => t.trim().toLowerCase().replace(/\s+/g, '-');

// ── 收集 ─────────────────────────────────────────────────────────
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).sort();
const problems = [];
const add = (file, line, rule, detail) => problems.push({ file, line, rule, detail });

let fixedCount = 0;
for (const f of files) {
  const p = path.join(DIR, f);
  let raw = fs.readFileSync(p, 'utf8');
  const original = raw;

  // ── 文件层：BOM / CRLF / 行尾空白 / 末尾换行 ──
  if (raw.charCodeAt(0) === 0xfeff) {
    add(f, 1, 'file/bom', '文件以 BOM 开头');
    if (FIX) raw = raw.replace(/^\uFEFF/, '');
  }
  if (raw.includes('\r\n')) {
    add(f, 0, 'file/crlf', '含 CRLF 换行（应为 LF，可 --fix 就地归一）');
    // 无论有没有 --fix 都要就地归一化。否则下面的 /^---\n/ 匹配不到 CRLF 的
    // frontmatter，会误报「缺少 frontmatter」；标题 / 代码块 / 排版那些逐行检查
    // 也会因为行尾多出一个 \r 而全部失真。
    //
    // 这个坑在 Windows 上是**默认触发**的：core.autocrlf=true 时，仓库里存的是 LF，
    // 检出到工作区却变成 CRLF。实测两篇由他人推送的文章在本机报「缺少 frontmatter」，
    // 而 CI（Linux）一路 success —— 误报，不是文章的问题。
    raw = raw.replace(/\r\n/g, '\n');
  }
  if (/[ \t]+$/m.test(raw)) {
    const n = (raw.match(/[ \t]+$/gm) || []).length;
    add(f, 0, 'file/trailing-whitespace', `${n} 行有行尾空白`);
    if (FIX) raw = raw.replace(/[ \t]+$/gm, '');
  }
  if (!raw.endsWith('\n')) {
    add(f, 0, 'file/final-newline', '文件末尾缺换行');
    if (FIX) raw += '\n';
  }
  if (/^\t/m.test(raw)) add(f, 0, 'file/tab', '含 Tab 缩进');

  // ── 拆 frontmatter / body ──
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fmMatch) {
    add(f, 0, 'frontmatter/missing', '缺少 frontmatter');
    continue;
  }
  const frontmatter = fmMatch[1];
  const body = raw.slice(fmMatch[0].length);
  const keys = [...frontmatter.matchAll(/^([A-Za-z_][\w-]*):/gm)].map((m) => m[1]);
  const field = (k) => {
    const m = frontmatter.match(new RegExp(`^${k}:[ \\t]*(.+)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  };

  // ── frontmatter：必填 / 顺序 / 日期格式 ──
  const missing = REQUIRED_KEYS.filter((k) => !keys.includes(k));
  if (missing.length) add(f, 0, 'frontmatter/required', `缺少字段: ${missing.join(', ')}`);
  if (keys.join(',') !== REQUIRED_KEYS.join(',')) {
    add(f, 0, 'frontmatter/order', `字段顺序为 [${keys.join(',')}]，应为 [${REQUIRED_KEYS.join(',')}]`);
  }
  const date = field('date');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) add(f, 0, 'frontmatter/date', `date 写法「${date}」应为 YYYY-MM-DD`);

  // ── description 长度 ──
  const desc = field('description');
  if (desc.length < DESC_MIN) add(f, 0, 'frontmatter/desc-short', `description 仅 ${desc.length} 字（建议 ≥${DESC_MIN}）`);
  if (desc.length > DESC_MAX) add(f, 0, 'frontmatter/desc-long', `description ${desc.length} 字（建议 ≤${DESC_MAX}）`);

  // ── 标签：数量 / 书写形式 ──
  const tags = parseTags(frontmatter);
  if (tags.length < TAGS_MIN) add(f, 0, 'tags/few', `只有 ${tags.length} 个标签（建议 ${TAGS_MIN}–${TAGS_MAX}）`);
  if (tags.length > TAGS_MAX) add(f, 0, 'tags/many', `${tags.length} 个标签（建议 ${TAGS_MIN}–${TAGS_MAX}）`);
  for (const t of tags) {
    if (/[\u4e00-\u9fff]/.test(t)) add(f, 0, 'tags/cjk', `标签「${t}」含中文，应为小写短横线英文`);
    if (/[A-Z]/.test(t)) add(f, 0, 'tags/uppercase', `标签「${t}」含大写，应为小写`);
    if (/\s/.test(t)) add(f, 0, 'tags/space', `标签「${t}」含空格，应为短横线`);
    if (normalizeTag(t) !== t) add(f, 0, 'tags/format', `标签「${t}」规范化后为「${normalizeTag(t)}」`);
  }

  // ── 标题结构 ──
  const noFence = stripFences(body);
  const heads = [...noFence.matchAll(/^(#{1,6})[ \t]+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2], idx: m.index }));
  const h1 = heads.filter((h) => h.level === 1);
  if (h1.length) add(f, 0, 'heading/h1', `正文有 ${h1.length} 个 h1（标题由 PageTitle 渲染）`);
  let prev = 1;
  for (const h of heads) {
    if (h.level > prev + 1) add(f, 0, 'heading/jump', `h${prev} → h${h.level}「${h.text.slice(0, 24)}」`);
    prev = h.level;
  }

  // ── 代码围栏语言 ──
  const bodyLines = body.split('\n');
  let inFence = false;
  for (let i = 0; i < bodyLines.length; i++) {
    const m = bodyLines[i].match(/^```(\S*)\s*$/);
    if (!m) continue;
    if (inFence) {
      inFence = false;
      continue;
    }
    inFence = true;
    const lang = m[1];
    if (!lang) add(f, i + 1, 'fence/no-lang', '代码块未标注语言');
    else if (LANG_ALIAS[lang]) add(f, i + 1, 'fence/alias', `语言「${lang}」应写作「${LANG_ALIAS[lang]}」`);
    else if (!LANGS.has(lang)) add(f, i + 1, 'fence/unknown-lang', `语言「${lang}」不在允许列表内`);
  }

  // ── 表格列数 ──
  {
    const lines = body.split('\n');
    let i = 0;
    while (i < lines.length) {
      if (/^\s*\|/.test(lines[i]) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
        const hc = cells(lines[i]).length;
        let j = i + 2;
        while (j < lines.length && /^\s*\|/.test(lines[j])) {
          const n = cells(lines[j]).length;
          if (n !== hc) add(f, j + 1, 'table/columns', `该行 ${n} 列，表头 ${hc} 列`);
          j++;
        }
        i = j;
      } else i++;
    }
  }

  // ── 站内链接 ──
  for (const m of noFence.matchAll(/\]\((\/[^)\s]+)\)/g)) {
    const url = m[1];
    const clean = url.split('#')[0];
    if (clean && !clean.endsWith('/') && !/\.\w+$/.test(clean)) {
      add(f, 0, 'link/trailing-slash', `站内链接缺尾斜杠: ${url}`);
    }
  }

  // ── 中文排版 ──
  // title / description 也会渲染给读者看（标题、文章导语），排版规则同样适用。
  const prose = stripInline(noFence);
  const rendered = [field('title'), field('description'), prose];
  for (const [i, text] of rendered.entries()) {
    const where = i === 0 ? '标题' : i === 1 ? 'description' : '';
    for (const m of text.matchAll(/[\u4e00-\u9fff][A-Za-z0-9]|[A-Za-z0-9][\u4e00-\u9fff]/g)) {
      add(f, 0, 'prose/cjk-latin-space', `${where}中英文之间缺空格：「${text.slice(Math.max(0, m.index - 6), m.index + 8).replace(/\s+/g, ' ')}」`);
    }
    for (const m of text.matchAll(/[\u4e00-\u9fff][,;:!?]/g)) {
      add(f, 0, 'prose/halfwidth-punct', `${where}中文后接半角标点：「${text.slice(Math.max(0, m.index - 6), m.index + 6)}」`);
    }
    for (const m of text.matchAll(/[\u4e00-\u9fff]\.\.\.(?!\.)|(?:^|[^\w.])\.\.\.[\u4e00-\u9fff]/g)) {
      add(f, 0, 'prose/ellipsis', `${where}中文里用 ... 应写作 ……：「${m[0].slice(0, 12)}」`);
    }
  }

  // ── 自动修复（只做无歧义项） ──
  if (FIX) {
    // 1) 换行/空白/语言别名：整文件级别处理
    let out = raw;

    // 2) 排版修复只作用于 body，且要保护行内代码与链接地址：
    //    `B站` 里的内容不该被改，`](/tags/教育ai/)` 更不能被插入空格。
    const fm = out.match(/^---\n([\s\S]*?)\n---\n?/);
    if (fm) {
      const head = fm[0];
      let rest = out.slice(head.length);

      // 语言别名（仅出现在围栏起始行）
      rest = rest.replace(/^(```)([A-Za-z]+)[ \t]*$/gm, (m, ticks, lang) =>
        LANG_ALIAS[lang] ? `${ticks}${LANG_ALIAS[lang]}` : m,
      );

      // 按围栏切分，只处理围栏外的段落
      const segs = rest.split(/(^```[^\n]*\n[\s\S]*?^```[^\n]*$)/m);
      for (let i = 0; i < segs.length; i++) {
        if (segs[i].startsWith('```')) continue;
        // 用占位符保护行内代码、链接地址、裸 URL
        const vault = [];
        const stash = (s) => {
          vault.push(s);
          return `\u0000${vault.length - 1}\u0000`;
        };
        let text = segs[i]
          .replace(/`[^`\n]*`/g, stash)
          .replace(/\]\([^)\n]*\)/g, stash)
          .replace(/https?:\/\/[^\s<>)\]]+/g, stash)
          .replace(/<[^>\n]+>/g, stash);

        text = text
          .replace(/([\u4e00-\u9fff])([A-Za-z0-9])/g, '$1 $2')
          .replace(/([A-Za-z0-9])([\u4e00-\u9fff])/g, '$1 $2')
          .replace(/([\u4e00-\u9fff])\.\.\.(?!\.)/g, '$1……');

        // 占位符可能嵌套：URL 先被 stash，其外层 `<...>` 又被 HTML 规则整体 stash，
        // 而单次 replace 不会重扫替换结果 —— 所以要循环还原到没有 NUL 为止。
        let guard = 0;
        while (text.includes('\u0000') && guard++ < 50) {
          text = text.replace(/\u0000(\d+)\u0000/g, (_, n) => vault[Number(n)]);
        }
        segs[i] = text;
      }
      rest = segs.join('');
      out = head + rest;
    }

    // 必须和「读盘时的原始内容」比较：文件层修复（CRLF / 末尾换行 / 行尾空白）
    // 已经把 raw 改掉了，若拿 out 去比 raw，只含这类问题的文件会被判定为「无改动」而漏写。
    if (out !== original) {
      fs.writeFileSync(p, out, 'utf8');
      fixedCount++;
      raw = out;
    }
  }
}

// ── 报告 ─────────────────────────────────────────────────────────
const byRule = new Map();
for (const p of problems) {
  if (!byRule.has(p.rule)) byRule.set(p.rule, []);
  byRule.get(p.rule).push(p);
}

if (FIX) console.log(`已自动修复 ${fixedCount} 个文件\n`);

const order = [
  'file/', 'frontmatter/', 'tags/', 'heading/', 'fence/', 'table/', 'link/', 'prose/',
];
const rules = [...byRule.keys()].sort((a, b) => {
  const ia = order.findIndex((o) => a.startsWith(o));
  const ib = order.findIndex((o) => b.startsWith(o));
  return ia - ib || a.localeCompare(b);
});

console.log(`检查 ${files.length} 篇文章，发现 ${problems.length} 处问题，涉及 ${new Set(problems.map((p) => p.file)).size} 个文件\n`);
for (const rule of rules) {
  const list = byRule.get(rule);
  console.log(`[${rule}] ${list.length} 处`);
  const shown = list.slice(0, 6);
  for (const p of shown) console.log(`   ${p.file}${p.line ? ':' + p.line : ''}  ${p.detail}`);
  if (list.length > shown.length) console.log(`   …还有 ${list.length - shown.length} 处`);
}

if (FIX) {
  console.log('\n注意：--fix 已改动源文件，请重新运行一次（不带 --fix）确认剩余问题，并 review diff。');
} else if (problems.length) {
  process.exitCode = 1;
} else {
  console.log('\n全部通过 ✅');
}
