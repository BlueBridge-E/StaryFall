/**
 * 布局测量工具（开发用，不参与站点构建）。
 *
 * dist/ 每次 build 都会被清空，而 dev server 服务的是 public/，
 * 所以这里同时向两处注入 harness（谁存在用谁），测量后一并清理。
 *
 * 用法： node tools/measure/run.mjs [viewportWidth] [port] [query]
 *   示例： node tools/measure/run.mjs 1440 4321 theme=dark
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const width = process.argv[2] ?? '1600';
const port = process.argv[3] ?? '4330';
const query = process.argv[4] ? `?${process.argv[4]}` : '';

const harnessSrc = path.resolve('tools/measure/layout.html');
const targets = ['dist', 'public']
  .filter((d) => fs.existsSync(d))
  .map((d) => path.join(d, '__layout_measure.html'));

for (const t of targets) fs.copyFileSync(harnessSrc, t);

const dumpFile = path.resolve(
  fs.existsSync('dist') ? 'dist/__layout_dump.html' : 'public/__layout_dump.html',
);

const out = fs.openSync(dumpFile, 'w');
const res = spawnSync(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--user-data-dir=${process.env.TEMP}/edge-measure-${Date.now()}`,
    `--window-size=${width},1000`,
    '--virtual-time-budget=9000',
    '--dump-dom',
    `http://localhost:${port}/StaryFall/__layout_measure.html${query}`,
  ],
  { stdio: ['ignore', out, 'ignore'], timeout: 90000 },
);
fs.closeSync(out);

const html = fs.existsSync(dumpFile) ? fs.readFileSync(dumpFile, 'utf8') : '';
fs.rmSync(dumpFile, { force: true });
for (const t of targets) fs.rmSync(t, { force: true });

const m = html.match(/<div id="out">([\s\S]*?)<\/div>/);
if (!m) {
  console.log(`edge exit=${res.status} —— 未取到测量输出`);
  console.log(html.slice(0, 400));
  process.exit(1);
}
console.log(
  m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
);
