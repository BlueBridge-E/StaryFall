"""
生成社交分享卡片 public/og-image.png（1200×630）。

这是一个**手工工具，不参与构建**，只在改站点标题/副标题/域名时手动重跑一次：

    python tools/og/make-og-image.py

依赖：Pillow、numpy、系统里的中文字体（Windows 用微软雅黑，macOS 用苹方）。
刻意不放进 package.json —— 站点构建不需要它，进了 CI 就是一份永远没人验证的
依赖。生成的 PNG 直接提交到仓库。

视觉上复刻 src/styles/hero.css：同样的渐变底、径向光晕、34px 网格纹理、
-0.03em 字距的渐变标题，保证分享卡片和首页头图是同一套语言。
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
ACCENT = (37, 99, 235)
MUTED = (107, 114, 128)
FAINT = (156, 163, 175)
GRAD_START = (30, 64, 175)
GRAD_END = (79, 70, 229)

OUT = Path(__file__).resolve().parents[2] / 'public' / 'og-image.png'


def pick_font(candidates):
    for pattern, index in candidates:
        p = Path(pattern)
        if p.exists():
            return str(p), index
    raise SystemExit('找不到可用字体，请修改 make-og-image.py 顶部的 find 列表')


# 拉丁字用无衬线（与站点 font stack 首位一致），中文回退到系统黑体
LATIN = pick_font([
    (r'C:\Windows\Fonts\segoeuib.ttf', 0),
    ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 0),
    ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 0),
])
CJK = pick_font([
    (r'C:\Windows\Fonts\msyh.ttc', 0),
    ('/System/Library/Fonts/PingFang.ttc', 0),
    ('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 0),
])
CJK_BOLD = pick_font([
    (r'C:\Windows\Fonts\msyhbd.ttc', 0),
    ('/System/Library/Fonts/PingFang.ttc', 0),
    ('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 0),
])


def font(spec, size):
    return ImageFont.truetype(spec[0], size, index=spec[1])


def background():
    """渐变底 + 顶部径向光晕 + 网格纹理，对应 .hero 的 background 三层。"""
    ys, xs = np.mgrid[0:H, 0:W].astype(float)

    t = (ys / (H - 1))[:, :, None]
    top = np.array([0xF4, 0xF7, 0xFF], float)
    bot = np.array([0xFA, 0xFA, 0xFA], float)
    img = top * (1 - t) + bot * t  # (H, W, 3)，t 已按画布铺开

    # radial-gradient(820px 300px at 50% -80px, rgba(37,99,235,.14), transparent 72%)
    d = np.sqrt(((xs - W / 2) / 820) ** 2 + ((ys + 80) / 300) ** 2)
    w = 0.14 * np.clip(1 - d / 0.72, 0, 1)[:, :, None] ** 0.75
    img = img * (1 - w) + np.array(ACCENT) * w

    # 34px 网格 + 椭圆遮罩（mask-image: radial-gradient(600px 240px at 50% 0)）
    dg = np.sqrt(((xs - W / 2) / 600) ** 2 + (ys / 240) ** 2)
    fade = np.clip(1 - (dg - 0.2) / 0.58, 0, 1)
    line = ((xs % 34 == 0) | (ys % 34 == 0)).astype(float)
    gw = (0.06 * fade * line)[:, :, None]
    img = img * (1 - gw) + np.array(ACCENT) * gw

    return Image.fromarray(img.astype('uint8'), 'RGB').convert('RGBA')


def gradient_text(canvas, xy, text, spec, size, anchor='mm', tracking=0.0):
    """渐变填充的文字：先画到 L 蒙版，再用横向渐变穿过蒙版贴回去。"""
    f = font(spec, size)
    mask = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(mask)

    if tracking:
        # Pillow 没有字距，逐字绘制；先量总宽再居中
        widths = [d.textlength(ch, font=f) for ch in text]
        total = sum(widths) + tracking * (len(text) - 1)
        x = W / 2 - total / 2 if anchor.endswith('m') else xy[0]
        heights = f.getbbox(text)[3]
        for ch, cw in zip(text, widths):
            d.text((x, xy[1] - heights / 2), ch, font=f, fill=255)
            x += cw + tracking
    else:
        d.text(xy, text, font=f, fill=255, anchor=anchor)

    bbox = mask.getbbox()
    if not bbox:
        return
    x0, x1 = bbox[0], bbox[2]
    ramp = np.clip((np.arange(W) - x0) / max(1, (x1 - x0)), 0, 1)[None, :, None]
    strip = np.array(GRAD_START, float) * (1 - ramp) + np.array(GRAD_END, float) * ramp
    strip = np.repeat(strip, H, axis=0).astype('uint8')
    grad = Image.fromarray(strip, 'RGB').convert('RGBA')
    canvas.paste(grad, (0, 0), mask)


def pill(canvas, center, text, size=25):
    """头图里的 .hero-badge：白底、描边、前置圆点。"""
    d = ImageDraw.Draw(canvas)
    f = font(CJK_BOLD, size)
    tw = d.textlength(text, font=f)
    pad_x, pad_y, dot_gap, dot_r = 26, 14, 14, 4
    inner = dot_r * 2 + dot_gap + tw
    left, top = center[0] - inner / 2 - pad_x, center[1] - size / 2 - pad_y
    right, bottom = center[0] + inner / 2 + pad_x, center[1] + size / 2 + pad_y

    d.rounded_rectangle([left, top, right, bottom], radius=(bottom - top) / 2,
                        fill=(255, 255, 255, 190), outline=(37, 99, 235, 56), width=2)
    cx = left + pad_x + dot_r
    d.ellipse([cx - dot_r, center[1] - dot_r, cx + dot_r, center[1] + dot_r],
              fill=(37, 99, 235, 115))
    d.text((cx + dot_r + dot_gap, center[1]), text, font=f, fill=ACCENT, anchor='lm')


def main():
    canvas = background()
    d = ImageDraw.Draw(canvas)

    pill(canvas, (W / 2, 142), 'AI Agent · MCP · 开源解析 · 前端工程化')

    gradient_text(canvas, (W / 2, 292), 'StaryFall', LATIN, 128, tracking=-4)
    d.text((W / 2, 424), '学习与构建的技术博客', font=font(CJK, 34), fill=MUTED, anchor='mm')

    d.text((W / 2, 522), 'bluebridge-e.github.io/StaryFall',
           font=font(LATIN, 22), fill=FAINT, anchor='mm')

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert('RGB').save(OUT, 'PNG', optimize=True)
    print(f'{OUT}  {OUT.stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()
