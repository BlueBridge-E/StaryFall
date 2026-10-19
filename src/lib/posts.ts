import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'docs'>;

/**
 * 内容集合的 slug 约定：`posts/foo/bar.md` -> `foo/bar`。
 * 单一来源，避免各处重复写正则。
 */
export function postSlug(id: string): string {
  return id.replace(/^posts\//, '').replace(/\.(md|mdx)$/, '');
}

/** 全部文章（仅 posts/ 下），按日期倒序。 */
export async function getPosts(): Promise<Post[]> {
  const docs = await getCollection('docs');
  return docs
    .filter((entry) => entry.id.startsWith('posts/'))
    .sort((a, b) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0));
}

/** 同一系列（同目录）的其它文章，例如 headroom-follow-up-* 与 headroom-deep-dive。 */
function seriesKey(slug: string): string {
  const parts = slug.split('/');
  parts.pop();
  return parts.join('/');
}

export interface RelatedOptions {
  /** 最多返回几篇，默认 4。 */
  limit?: number;
  /** 标签交集的权重，默认 3（每个共同标签的分数）。 */
  tagWeight?: number;
  /** 同系列（同目录）的额外加分，默认 5。 */
  seriesBonus?: number;
  /** 标签不足时的兜底：不足 limit 时用最新文章补齐，默认 true。 */
  fillWithLatest?: boolean;
  /** 需要排除的 entry id。用于避免「相关文章」重复「上一篇/下一篇」已推荐的文章。 */
  exclude?: string[];
}

/**
 * 计算相关文章：按「共同标签 × tagWeight + 同系列加分」排序。
 * 纯构建期计算，无运行时开销，也不改动任何文章内容。
 */
export function findRelated(current: Post, all: Post[], options: RelatedOptions = {}): Post[] {
  const { limit = 4, tagWeight = 3, seriesBonus = 5, fillWithLatest = true, exclude = [] } = options;
  const currentTags = new Set(current.data.tags);
  const currentSlug = postSlug(current.id);
  const currentSeries = seriesKey(currentSlug);
  const excluded = new Set(exclude);

  const scored = all
    .filter((entry) => entry.id !== current.id && !excluded.has(entry.id))
    .map((entry) => {
      const slug = postSlug(entry.id);
      const shared = entry.data.tags.filter((tag) => currentTags.has(tag));
      const sameSeries = currentSeries !== '' && seriesKey(slug) === currentSeries;
      return {
        entry,
        score: shared.length * tagWeight + (sameSeries ? seriesBonus : 0),
        shared: shared.length,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // 同分时新文章优先
      return (b.entry.data.date?.getTime() ?? 0) - (a.entry.data.date?.getTime() ?? 0);
    })
    .map((item) => item.entry);

  const related = scored.slice(0, limit);

  if (fillWithLatest && related.length < limit) {
    // 兜底同样要排除被剔除的文章，否则「相关文章」会从最新几篇里把它们又捞回来
    const chosen = new Set([current.id, ...exclude, ...related.map((entry) => entry.id)]);
    for (const entry of all) {
      if (related.length >= limit) break;
      if (chosen.has(entry.id)) continue;
      related.push(entry);
      chosen.add(entry.id);
    }
  }

  return related;
}

/** 按日期给出上一篇（更新）与下一篇（更旧）。 */
export function findSiblings(current: Post, all: Post[]): { newer?: Post; older?: Post } {
  const index = all.findIndex((entry) => entry.id === current.id);
  if (index === -1) return {};
  return { newer: all[index - 1], older: all[index + 1] };
}

/**
 * 估算阅读时长（分钟）。
 *
 * 中英混排按两类分别计时再相加：中日韩字符 350 字/分钟，西文单词 200 词/分钟。
 * 计算前会剥离 Markdown 噪声（代码围栏、行内代码、链接地址、HTML 标签），
 * 否则 `https://...` 这类长 URL 会被当成单词虚增时长。
 */
export function readingMinutes(body: string | undefined): number {
  if (!body) return 1;

  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ');

  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z0-9][A-Za-z0-9'’\-]*/g) ?? []).length;

  return Math.max(1, Math.round(cjk / 350 + latin / 200));
}
