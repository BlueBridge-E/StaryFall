import fs from 'node:fs';

const f = fs.readdirSync('dist/_astro').find((x) => /^common\..*\.css$/.test(x));
const css = fs.readFileSync(`dist/_astro/${f}`, 'utf8');

console.log('=== Starlight 里 display:block 作用在 table 上的规则 ===');
for (const m of css.matchAll(/[^{}]{0,120}\{[^}]*\}/g)) {
  if (/display:\s*block/.test(m[0]) && /table/i.test(m[0])) {
    console.log('  ' + m[0].slice(0, 260) + '\n');
  }
}

console.log('=== 所有提到 table 的选择器 ===');
for (const m of css.matchAll(/[^{}]{0,140}\{[^}]*\}/g)) {
  if (/\btable\b/.test(m[0]) && /\.sl-markdown-content|markdown/.test(m[0])) {
    console.log('  ' + m[0].slice(0, 260));
  }
}

console.log('\n=== 上下文：包含 table 与 display:block 的媒体查询 ===');
const i = css.search(/table[^{}]{0,60}\{[^}]*display:\s*block/);
console.log(i > -1 ? css.slice(Math.max(0, i - 500), i + 200) : '(未直接匹配)');
