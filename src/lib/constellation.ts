/**
 * 星图布局（三维）：把文章排成一片星云，共享标签的文章在空间里彼此靠近。
 *
 * 为什么用力导向而不是硬分组：标签是**多对多**的，一篇文章同时属于 ai / agent /
 * mcp。任何「每篇归一个组」的切法都会丢掉重叠关系 —— 实测按最高频标签归组会把
 * 14 篇全塞进 ai，按最低频归组又会碎成 16 个两人小组。力导向让节点自己找到位置。
 *
 * 布局在**构建期**算完，页面只负责渲染：运行时不用跑物理模拟，加载即可见，
 * 且固定随机种子保证每次构建的结果一致。
 */

/** 固定种子：布局必须可复现，否则每次构建的星云都不一样 */
const SEED = 20261020;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SkyPost {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  minutes: number;
}

export interface SkyStar {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  /** 以原点为中心的三维坐标 */
  x: number;
  y: number;
  z: number;
  /** 相对大小，由阅读时长决定 */
  r: number;
  /** 与其他文章的共享标签数之和，0 表示孤星 */
  degree: number;
}

export interface SkyLink {
  a: string;
  b: string;
  weight: number;
}

export interface SkyCluster {
  tag: string;
  x: number;
  y: number;
  z: number;
  count: number;
}

export interface SkyMap {
  stars: SkyStar[];
  links: SkyLink[];
  clusters: SkyCluster[];
  tagTotal: number;
}

/** 把某一轴按 90 分位数缩放到 [-1, 1]，避免几颗离群星压扁主体 */
function normalize(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const q = sorted[Math.max(0, Math.floor(sorted.length * 0.9) - 1)] || 1;
  return values.map((v) => Math.tanh(v / q));
}

export function buildSkyMap(posts: SkyPost[]): SkyMap {
  const n = posts.length;
  const rand = mulberry32(SEED);

  // 初始位置铺在一个球壳上，避免所有点从同一点出发产生对称死锁
  const nodes = posts.map((post, i) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const radius = 120 + rand() * 40;
    return {
      ...post,
      x: radius * Math.sin(phi) * Math.cos(theta),
      y: radius * Math.cos(phi),
      z: radius * Math.sin(phi) * Math.sin(theta),
      vx: 0,
      vy: 0,
      vz: 0,
    };
  });

  const index = new Map(nodes.map((node, i) => [node.slug, i]));

  const links: SkyLink[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const shared = nodes[i].tags.filter((tag) => nodes[j].tags.includes(tag));
      if (shared.length > 0) {
        links.push({ a: nodes[i].slug, b: nodes[j].slug, weight: shared.length });
      }
    }
  }

  const ITERATIONS = 620;
  for (let step = 0; step < ITERATIONS; step += 1) {
    const cooling = 1 - step / ITERATIONS;

    // 三维斥力
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let dz = nodes[j].z - nodes[i].z;
        const dist2 = dx * dx + dy * dy + dz * dz || 0.01;
        const dist = Math.sqrt(dist2);
        // 立方反比，比平方更"散"，星云才不会有密不透风的核
        const force = 260000 / (dist2 * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[i].vz -= fz;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
        nodes[j].vz += fz;
      }
    }

    // 弹簧引力：共享标签越多拉得越紧（封顶，避免强关联的文章叠在一起）
    for (const link of links) {
      const a = nodes[index.get(link.a)!];
      const b = nodes[index.get(link.b)!];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dy, dz) || 0.01;
      const strength = 0.014 * Math.min(link.weight, 3);
      const force = (dist - 165) * strength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;
      a.vx += fx;
      a.vy += fy;
      a.vz += fz;
      b.vx -= fx;
      b.vy -= fy;
      b.vz -= fz;
    }

    // 向心力（把星云收成一个球，而不是瘫在平面上）+ 阻尼
    for (const node of nodes) {
      node.vx -= node.x * 0.0035;
      node.vy -= node.y * 0.0035;
      node.vz -= node.z * 0.0035;
      node.x += node.vx * cooling;
      node.y += node.vy * cooling;
      node.z += node.vz * cooling;
      node.vx *= 0.8;
      node.vy *= 0.8;
      node.vz *= 0.8;
    }
  }

  // 三轴分别归一化到 [-1, 1]
  const xs = normalize(nodes.map((node) => node.x - nodes.reduce((s, k) => s + k.x, 0) / n));
  const ys = normalize(nodes.map((node) => node.y - nodes.reduce((s, k) => s + k.y, 0) / n));
  const zs = normalize(nodes.map((node) => node.z - nodes.reduce((s, k) => s + k.z, 0) / n));

  const stars: SkyStar[] = nodes.map((node, i) => ({
    slug: node.slug,
    title: node.title,
    date: node.date,
    tags: node.tags,
    x: +xs[i].toFixed(4),
    // 纵向压扁成盘状：球形星云在 16:9 的画布上会被高度卡住，左右空出一大片。
    // 但压太薄就只剩一张纸，没有体积感 —— 0.58 是"能铺开、又看得出厚度"的折中。
    y: +(ys[i] * 0.58).toFixed(4),
    z: +zs[i].toFixed(4),
    // 阅读时长 → 相对大小
    r: +(0.62 + Math.min(node.minutes, 12) * 0.035).toFixed(3),
    degree: links.filter((l) => l.a === node.slug || l.b === node.slug).length,
  }));

  const bySlug = new Map(stars.map((star) => [star.slug, star]));

  // 标签云团：只标出现 ≥5 次的标签，否则会糊成一片
  const freq = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) freq.set(tag, (freq.get(tag) ?? 0) + 1);
  }

  const clusters: SkyCluster[] = [];
  for (const [tag, count] of freq) {
    if (count < 5) continue;
    const members = stars.filter((star) => star.tags.includes(tag));
    if (members.length === 0) continue;
    clusters.push({
      tag,
      x: +(members.reduce((s, star) => s + star.x, 0) / members.length).toFixed(3),
      y: +(members.reduce((s, star) => s + star.y, 0) / members.length).toFixed(3),
      z: +(members.reduce((s, star) => s + star.z, 0) / members.length).toFixed(3),
      count,
    });
  }
  clusters.sort((a, b) => b.count - a.count);

  // 连线只存坐标索引的配对，页面按 slug 查位置
  const safeLinks = links
    .filter((link) => bySlug.has(link.a) && bySlug.has(link.b))
    .map((link) => ({ a: link.a, b: link.b, weight: link.weight }));

  return { stars, links: safeLinks, clusters, tagTotal: freq.size };
}
