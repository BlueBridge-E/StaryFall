/**
 * 站点级常量。`base` 从 Astro 注入的 BASE_URL 派生，
 * 这样仓库改名或部署到域名根时无需再改任何页面
 * （astro.config.mjs 的 `base` 是唯一来源）。
 */
const rawBase = import.meta.env.BASE_URL || '/';
export const base = rawBase.replace(/\/$/, '');
export const site = import.meta.env.SITE || '';

/**
 * 拼接站内绝对路径，例如 url('/tags/') -> '/StaryFall/tags/'。
 *
 * 模板里普遍直接写 `${base}/tags/`（两者完全等价，只是少一层函数调用），
 * 所以它目前的实际调用点几乎只有 absoluteUrl()。
 */
export const url = (path: string) => `${base}${path.startsWith('/') ? path : `/${path}`}`;

/** 拼接用于 canonical / og:url 的完整地址 */
export const absoluteUrl = (path: string) => new URL(url(path), site).href;

/**
 * 站点根（含 base）的完整地址，例如 https://example.github.io/StaryFall/。
 * 用于把「相对站点的路径」交给第三方工具（如 RSS 的 item link）解析，
 * 避免在各处重复拼 base。
 */
export const siteRoot = new URL(`${base}/`, site).href;

/**
 * 社交分享卡片，位于 public/og-image.png，1200×630。
 * 由 tools/og/make-images.py 生成（手工工具，不参与构建）——
 * 改站名/副标题/域名后需要重跑一次，否则分享卡片还是旧文案。
 */
export const OG_IMAGE = '/og-image.png';

/**
 * 品牌主色，仅供 theme-color 这类必须是内联字符串的位置使用。
 * CSS 侧请用 tokens.css 的 --accent，不要引用这个常量。
 */
export const themeColor = '#2563eb';

