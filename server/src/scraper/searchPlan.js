const DEFAULT_BASE_URL = 'https://www.imot.bg';
const DEFAULT_MAX_PAGES_PER_CATEGORY = 5;
const FULL_CRAWL_PAGE_LIMIT = 50;

export const saleCategories = [
  { id: 'dvustaen', path: '/obiavi/prodazhbi/grad-sofiya/dvustaen' },
  { id: 'tristaen', path: '/obiavi/prodazhbi/grad-sofiya/tristaen' },
  { id: 'chetiristaen', path: '/obiavi/prodazhbi/grad-sofiya/chetiristaen' },
  { id: 'mnogostaen', path: '/obiavi/prodazhbi/grad-sofiya/mnogostaen' },
  { id: 'kashta', path: '/obiavi/prodazhbi/grad-sofiya/kashta' }
];

export const rentalCategories = [
  { id: 'dvustaen', path: '/obiavi/naemi/grad-sofiya/dvustaen' },
  { id: 'tristaen', path: '/obiavi/naemi/grad-sofiya/tristaen' },
  { id: 'chetiristaen', path: '/obiavi/naemi/grad-sofiya/chetiristaen' },
  { id: 'mnogostaen', path: '/obiavi/naemi/grad-sofiya/mnogostaen' },
  { id: 'kashta', path: '/obiavi/naemi/grad-sofiya/kashta' }
];

function booleanOption(value, fallback) {
  return value == null ? fallback : Boolean(value);
}

export function normalizeScrapeOptions(options = {}) {
  const fullCrawl = Boolean(options.fullCrawl);
  const rawMaxPages = Number(options.maxPagesPerCategory);

  return {
    includeSales: booleanOption(options.includeSales, true),
    includeRentals: booleanOption(options.includeRentals, true),
    maxPagesPerCategory: fullCrawl
      ? FULL_CRAWL_PAGE_LIMIT
      : Math.max(1, Math.min(Number.isFinite(rawMaxPages) ? rawMaxPages : DEFAULT_MAX_PAGES_PER_CATEGORY, FULL_CRAWL_PAGE_LIMIT)),
    fullCrawl
  };
}

function pageUrl(path, page, baseUrl) {
  const url = new URL(path, baseUrl);
  if (page > 1) {
    url.searchParams.set('page', String(page));
  }
  return url.toString();
}

export function buildSearchPlan({ baseUrl = DEFAULT_BASE_URL, ...options } = {}) {
  const normalized = normalizeScrapeOptions(options);
  const groups = [];

  if (normalized.includeSales) {
    groups.push({ purpose: 'sale', categories: saleCategories });
  }
  if (normalized.includeRentals) {
    groups.push({ purpose: 'rent', categories: rentalCategories });
  }

  return groups.flatMap(({ purpose, categories }) =>
    categories.flatMap((category) =>
      Array.from({ length: normalized.maxPagesPerCategory }, (_, index) => {
        const resultPage = index + 1;
        return {
          purpose,
          category: category.id,
          resultPage,
          url: pageUrl(category.path, resultPage, baseUrl),
          fullScope: normalized.fullCrawl
        };
      })
    )
  );
}
