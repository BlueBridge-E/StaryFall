/**
 * 从 public/favicon.svg 生成 public/favicon.ico（16/32/48 多尺寸）。
 *
 * 背景：浏览器（以及部分爬虫）会主动请求站点根下的 /favicon.ico，
 * 只提供 favicon.svg 会让每个页面都产生一条 404。
 *
 * 用法： node tools/generate-favicon.mjs
 */
import fs from 'node:fs';
import sharp from 'sharp';

const svg = fs.readFileSync('public/favicon.svg');
const sizes = [16, 32, 48];

const frames = [];
for (const size of sizes) {
  const png = await sharp(svg).resize(size, size).png().toBuffer();
  frames.push({ size, png });
}

// ICO 头：6 字节 + 每帧 16 字节目录项
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type = icon
header.writeUInt16LE(frames.length, 4);

const dir = Buffer.alloc(16 * frames.length);
let offset = header.length + dir.length;

frames.forEach((f, i) => {
  const base = i * 16;
  dir.writeUInt8(f.size >= 256 ? 0 : f.size, base + 0); // width
  dir.writeUInt8(f.size >= 256 ? 0 : f.size, base + 1); // height
  dir.writeUInt8(0, base + 2); // 调色板数
  dir.writeUInt8(0, base + 3); // reserved
  dir.writeUInt16LE(1, base + 4); // color planes
  dir.writeUInt16LE(32, base + 6); // bits per pixel
  dir.writeUInt32LE(f.png.length, base + 8);
  dir.writeUInt32LE(offset, base + 12);
  offset += f.png.length;
});

const ico = Buffer.concat([header, dir, ...frames.map((f) => f.png)]);
fs.writeFileSync('public/favicon.ico', ico);

console.log(`已生成 public/favicon.ico：${sizes.join('/')} px，${ico.length} 字节`);
