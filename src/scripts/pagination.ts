/**
 * 客户端分页（首页与 /feed/ 共用）。
 *
 * 卡片默认全部在 DOM 中（对爬虫友好），由本脚本按页隐藏。
 * 约定：
 *  - `[data-pagination-card]`      参与分页的卡片
 *  - `[data-pagination]`           分页容器，`data-page-size` 指定每页条数
 *  - `[data-month-heading="YYYY-MM"]`（可选）月份标题，按当前页可见卡片
 *    自动显隐；配合 `#YYYY-MM` 锚点可直接跳到该月所在页
 *
 * 分页状态写入 `?page=N`，支持分享/收藏与浏览器前进后退。
 * 禁用 JS 时仍会一次性显示全部卡片（保留 Ctrl+F 全量检索能力）。
 */

const PAGE_PARAM = 'page';

function readPageFromUrl(totalPages: number): number {
  const value = Number(new URLSearchParams(window.location.search).get(PAGE_PARAM));
  if (!Number.isInteger(value) || value < 1) return 1;
  return Math.min(value, totalPages);
}

export function initPagination(): void {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-pagination-card]'));
  const total = cards.length;
  if (total === 0) return;

  const container = document.querySelector<HTMLElement>('[data-pagination]');
  if (!container) return;

  const pageSize = Number(container.dataset.pageSize) || 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const prevBtn = document.getElementById('prevPage') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('nextPage') as HTMLButtonElement | null;
  const infoEl = document.getElementById('pageInfo');
  if (!prevBtn || !nextBtn || !infoEl) return;

  // 首/末页跳转是可选按钮：页面没提供时脚本照常工作
  const firstBtn = document.getElementById('firstPage') as HTMLButtonElement | null;
  const lastBtn = document.getElementById('lastPage') as HTMLButtonElement | null;

  // 只有一页时整条分页栏没有意义（4 个按钮全禁用），直接藏起来
  if (totalPages === 1) container.hidden = true;

  const monthHeadings = Array.from(
    document.querySelectorAll<HTMLElement>('[data-month-heading]'),
  ).map((heading) => {
    const month = heading.dataset.monthHeading!;
    // 该月第一条卡片的全局序号，决定它归属哪一页
    const firstIndex = cards.findIndex((card) => card.dataset.month === month);
    return { heading, month, firstIndex };
  });

  // 标题初始位于所有卡片之前，需要按当前页的首条该月卡片重新定位，
  // 否则跨页的月份（例如 75 条跨 9 页）只有第一页能看到标题。
  const cardParent = cards[0]?.parentElement ?? null;

  function placeHeadingBefore(heading: HTMLElement, card: HTMLElement): void {
    if (!cardParent) return;
    if (heading.nextElementSibling === card) return;
    cardParent.insertBefore(heading, card);
  }

  let current = 1;

  function pageOfMonth(month: string): number | undefined {
    const found = monthHeadings.find((item) => item.month === month);
    if (!found || found.firstIndex < 0) return undefined;
    return Math.floor(found.firstIndex / pageSize) + 1;
  }

  /** 只渲染（改可见性 + 文案），不碰 URL。scrollTop 为 false 时保持滚动位置。 */
  function render(page: number, options: { updateUrl: 'push' | 'replace' | 'none'; scrollTop: boolean }): void {
    current = page;

    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, total);

    for (let i = 0; i < total; i++) {
      cards[i]!.style.display = i >= start && i < end ? 'block' : 'none';
    }

    // 月份标题：插到当前页「该月第一条可见卡片」之前并显示；
    // 当前页没有该月卡片则隐藏。这样跨页月份的每一页都有月份上下文。
    const placed = new Set<string>();
    for (let i = start; i < end; i++) {
      const month = cards[i]!.dataset.month;
      if (!month || placed.has(month)) continue;
      placed.add(month);
      const found = monthHeadings.find((item) => item.month === month);
      if (!found) continue;
      placeHeadingBefore(found.heading, cards[i]!);
      found.heading.hidden = false;
    }
    for (const { heading, month } of monthHeadings) {
      if (!placed.has(month)) heading.hidden = true;
    }

    prevBtn!.disabled = page === 1;
    nextBtn!.disabled = page === totalPages;
    if (firstBtn) firstBtn.disabled = page === 1;
    if (lastBtn) lastBtn.disabled = page === totalPages;
    infoEl!.textContent = `${page} / ${totalPages}`;

    if (options.updateUrl !== 'none') {
      const method = options.updateUrl === 'push' ? 'pushState' : 'replaceState';
      const url = new URL(window.location.href);
      if (page <= 1) url.searchParams.delete(PAGE_PARAM);
      else url.searchParams.set(PAGE_PARAM, String(page));
      // 翻页时清掉月份锚点，避免 URL 与实际可见内容矛盾
      url.hash = '';
      window.history[method]({ page }, '', `${url.pathname}${url.search}`);
    }

    if (options.scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goTo(page: number): void {
    const target = Math.min(Math.max(page, 1), totalPages);
    if (target === current) return;
    render(target, { updateUrl: 'push', scrollTop: true });
  }

  prevBtn.onclick = () => goTo(current - 1);
  nextBtn.onclick = () => goTo(current + 1);
  if (firstBtn) firstBtn.onclick = () => goTo(1);
  if (lastBtn) lastBtn.onclick = () => goTo(totalPages);

  // 浏览器前进/后退：恢复对应页
  window.addEventListener('popstate', () => {
    render(readPageFromUrl(totalPages), { updateUrl: 'none', scrollTop: false });
  });

  // 月份锚点：跳到该月所在页，再滚动到该标题（标题在分页容器之外，始终可见）
  function applyHash(): boolean {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    if (!hash) return false;
    const target = pageOfMonth(hash);
    if (target === undefined) return false;
    if (target !== current) render(target, { updateUrl: 'none', scrollTop: false });
    document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  window.addEventListener('hashchange', () => {
    applyHash();
  });

  // 首屏：优先响应锚点，否则读取 ?page=N
  if (!applyHash()) {
    const initial = readPageFromUrl(totalPages);
    if (initial > 1) render(initial, { updateUrl: 'replace', scrollTop: false });
    else render(1, { updateUrl: 'none', scrollTop: false });
  }
}
