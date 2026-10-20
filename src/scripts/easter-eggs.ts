/**
 * 站点彩蛋。三个互相独立的小玩意：
 *   1. 点站名 → 星星从落点散开（站点叫 StaryFall，星落）
 *   2. Konami 密码 ↑↑↓↓←→←→BA → 一只机器人横穿屏幕
 *   3. 控制台里留一段签名
 *
 * 设计约束（都是刻意的）：
 *  - 零依赖、纯客户端、不请求任何外部资源：站点在 GitHub Pages 上，没有后端
 *  - 所有样式内联在 JS 里，不碰任何 .css 文件 —— 整体回滚只需删本文件与两处引用
 *  - `prefers-reduced-motion` 下不播放任何位移动画（前庭敏感用户是真实伤害）
 *  - 同时存在的星星有上限，连点不会把 DOM 撑爆
 *  - 不在输入框里监听按键，否则会偷走 Pagefind 搜索框的 ↑↓
 *
 * 想单独看某个彩蛋（截图/回归用）：在 URL 后加 ?egg=stars 或 ?egg=robot。
 */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── 1. 落星 ── */

/** 与 favicon 同形状的五角星 */
const STAR_CLIP =
  'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
const STAR_COLORS = ['#2563eb', '#4f46e5', '#93c5fd', '#bfdbfe', '#1e40af'];

/** 同时存活的星星上限，防止狂点 */
const MAX_LIVE = 90;

let layer: HTMLDivElement | null = null;
let live = 0;

function starLayer(): HTMLDivElement {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:2147483000;overflow:hidden;contain:strict';
    document.body.appendChild(layer);
  }
  return layer;
}

function burst(x: number, y: number, count = 18): void {
  if (REDUCED || live > MAX_LIVE) return;
  const host = starLayer();

  for (let i = 0; i < count; i += 1) {
    const star = document.createElement('span');
    const size = 6 + Math.random() * 10;
    star.style.cssText = [
      'position:absolute',
      `left:${x}px`,
      `top:${y}px`,
      `width:${size}px`,
      `height:${size}px`,
      `margin:${-size / 2}px 0 0 ${-size / 2}px`,
      `background:${STAR_COLORS[i % STAR_COLORS.length]}`,
      `clip-path:${STAR_CLIP}`,
      'will-change:transform,opacity',
    ].join(';');
    host.appendChild(star);
    live += 1;

    // 先向上弹一下再落下，比单纯下落更像"星落"
    const driftX = (Math.random() - 0.5) * 300;
    const fallY = 180 + Math.random() * 300;
    const spin = (Math.random() - 0.5) * 540;
    const popY = -(30 + Math.random() * 50);
    const duration = 950 + Math.random() * 650;

    const anim = star.animate(
      [
        { transform: 'translate(0px, 0px) rotate(0deg) scale(0.5)', opacity: 0, offset: 0 },
        { transform: `translate(${driftX * 0.3}px, ${popY}px) rotate(${spin * 0.3}deg) scale(1)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${driftX}px, ${fallY}px) rotate(${spin}deg) scale(0.8)`, opacity: 0, offset: 1 },
      ],
      {
        duration,
        easing: 'cubic-bezier(.2,.55,.35,1)',
        fill: 'forwards',
      },
    );

    // onfinish 正常会触发；后台标签页 / 动画被取消时可能不触发，
    // 用一次性兜底保证 DOM 不残留（done 幂等）
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      anim.cancel();
      star.remove();
      live -= 1;
    };
    anim.onfinish = done;
    anim.oncancel = done;
    window.setTimeout(done, duration + 600);
  }
}

/** 站名：独立页面是 hero 里的 h1，文章页是 Starlight 顶栏的 .site-title */
function wireLogo(): void {
  const targets = document.querySelectorAll<HTMLElement>('.hero h1, .site-title');
  targets.forEach((el) => {
    el.addEventListener('pointerdown', (event) => {
      // 指针事件只在主键/触摸时响应，避免右键也炸星
      if (event.button !== undefined && event.button !== 0) return;
      const box = el.getBoundingClientRect();
      burst(box.left + box.width / 2, box.bottom, 18);
    });
  });
}

/* ── 2. Konami 密码 ── */

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];
let progress = 0;

function runRobot(): void {
  const bot = document.createElement('div');
  bot.textContent = '🤖';
  bot.setAttribute('aria-hidden', 'true');
  bot.style.cssText = [
    'position:fixed',
    'bottom:20px',
    'left:0',
    'font-size:46px',
    'line-height:1',
    'z-index:2147483000',
    'pointer-events:none',
    'filter:drop-shadow(0 6px 8px rgba(0,0,0,.18))',
  ].join(';');
  document.body.appendChild(bot);

  if (REDUCED) {
    // 不做位移，只在原地停一会儿
    bot.style.left = '50%';
    bot.style.transform = 'translateX(-50%)';
    window.setTimeout(() => bot.remove(), 2000);
    toast('🤖 你找到了彩蛋');
    return;
  }

  const distance = window.innerWidth + 120;
  const WALK_MS = 2400;
  const walk = bot.animate(
    [{ transform: 'translateX(-60px)' }, { transform: `translateX(${distance}px)` }],
    { duration: WALK_MS, easing: 'linear' },
  );
  // 用独立属性做上下颠簸，与上面的 transform 互不干扰
  const hop = bot.animate(
    [{ translate: '0 0' }, { translate: '0 -16px' }, { translate: '0 0' }],
    { duration: 280, iterations: Infinity, easing: 'ease-in-out' },
  );
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    hop.cancel();
    bot.remove();
  };
  walk.onfinish = finish;
  walk.oncancel = finish;
  window.setTimeout(finish, WALK_MS + 600);

  toast('🤖 彩蛋：点一下站点名字，星星会落下来');
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    progress = 0;
    return;
  }
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === KONAMI[progress]) {
    progress += 1;
    if (progress === KONAMI.length) {
      progress = 0;
      runRobot();
    }
    return;
  }
  progress = key === KONAMI[0] ? 1 : 0;
}

/* ── 3. 提示气泡 ── */

let toastTimer = 0;
function toast(message: string): void {
  const el = document.createElement('div');
  el.textContent = message;
  el.setAttribute('role', 'status');
  el.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:26px',
    'transform:translateX(-50%)',
    'max-width:min(90vw,32rem)',
    'background:#111827',
    'color:#fff',
    'padding:.6rem 1rem',
    'border-radius:999px',
    'font-size:.85rem',
    'line-height:1.4',
    'text-align:center',
    'z-index:2147483001',
    'box-shadow:0 10px 30px rgba(0,0,0,.2)',
    'opacity:0',
    'transition:opacity .18s ease',
  ].join(';');
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
  });
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.style.opacity = '0';
    window.setTimeout(() => el.remove(), 250);
  }, 3800);
}

/* ── 4. 控制台签名 ── */

function signature(): void {
  // 星图是隐藏页，没有入口链接 —— 控制台是它唯一"被发现"的地方
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const sky = `${location.origin}${basePath}/sky/`;
  console.log(
    '%c ✦ StaryFall ',
    'background:#2563eb;color:#fff;padding:3px 8px;border-radius:4px;font-weight:700',
    `\n学习与构建的技术博客\nAstro + Starlight · 静态托管在 GitHub Pages\n\n彩蛋：↑ ↑ ↓ ↓ ← → ← → B A\n星图：${sky}\n`,
  );
}

/* ── 启动 ── */

wireLogo();
document.addEventListener('keydown', onKeydown);
signature();

// 手动触发，供截图与回归验证使用
const egg = new URLSearchParams(location.search).get('egg');
if (egg === 'stars') burst(window.innerWidth / 2, window.innerHeight * 0.38, 26);
if (egg === 'robot') runRobot();
