import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { createDatabase } from '../src/db/connection.js';
import { getPriceHistoryByPropertyId } from '../src/db/priceHistory.js';
import { getPropertyByExternalId, queryProperties, upsertProperty } from '../src/db/properties.js';
import { getLatestScrapingRun } from '../src/db/scrapingRuns.js';
import { decodeWindows1251 } from '../src/scraper/encoding.js';
import { detectCondition } from '../src/utils/conditionDetector.js';
import { normalizeNeighborhood, zoneForNeighborhood } from '../src/scraper/neighborhoods.js';
import { parseDetailPage, parseSearchResults } from '../src/scraper/parser.js';
import { buildSearchPlan, normalizeScrapeOptions } from '../src/scraper/searchPlan.js';
import { runScrape } from '../src/scraper/imotbg.js';
import { createApp } from '../src/index.js';

let databases = [];

function memoryDb() {
  const db = createDatabase(':memory:');
  databases.push(db);
  return db;
}

async function withServer(app, callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

afterEach(() => {
  for (const db of databases) {
    db.close();
  }
  databases = [];
});

describe('Phase 3 scraper', () => {
  test('decodes windows-1251 Cyrillic buffers', () => {
    const encoded = Buffer.from([0xcc, 0xeb, 0xe0, 0xe4, 0xee, 0xf1, 0xf2, 0x20, 0x31]);
    assert.equal(decodeWindows1251(encoded), 'Младост 1');
  });

  test('maps Sofia quarters to normalized zones', () => {
    assert.equal(normalizeNeighborhood('гр. София, Младост 1'), 'Младост 1');
    assert.equal(zoneForNeighborhood('Младост 1'), 'Младост');
    assert.equal(zoneForNeighborhood('Люлин 7'), 'Люлин');
  });

  test('detects Bulgarian condition keywords', () => {
    assert.equal(detectCondition('Апартамент за ремонт, тухла'), 'needs_rehab');
    assert.equal(detectCondition('Луксозно ремонтиран и обзаведен'), 'fully_renovated');
    assert.equal(detectCondition('Ново строителство с акт 16'), 'new');
  });

  test('normalizes scrape options with conservative defaults', () => {
    assert.deepEqual(normalizeScrapeOptions({}), {
      includeSales: true,
      includeRentals: true,
      maxPagesPerCategory: 5,
      fullCrawl: false
    });

    assert.deepEqual(normalizeScrapeOptions({ includeRentals: false, maxPagesPerCategory: 2 }), {
      includeSales: true,
      includeRentals: false,
      maxPagesPerCategory: 2,
      fullCrawl: false
    });
  });

  test('builds sale and rental search work for every configured category', () => {
    const plan = buildSearchPlan({
      baseUrl: 'https://example.test',
      maxPagesPerCategory: 2
    });

    assert.equal(plan.length, 20);
    assert.deepEqual(
      plan.slice(0, 4).map((item) => ({
        purpose: item.purpose,
        category: item.category,
        page: item.resultPage,
        fullScope: item.fullScope
      })),
      [
        { purpose: 'sale', category: 'dvustaen', page: 1, fullScope: false },
        { purpose: 'sale', category: 'dvustaen', page: 2, fullScope: false },
        { purpose: 'sale', category: 'tristaen', page: 1, fullScope: false },
        { purpose: 'sale', category: 'tristaen', page: 2, fullScope: false }
      ]
    );
    assert.ok(plan.some((item) => item.purpose === 'rent' && item.category === 'kashta'));
    assert.ok(plan.every((item) => item.url.startsWith('https://example.test/')));
  });

  test('builds sale-only plan without slicing categories', () => {
    const plan = buildSearchPlan({
      baseUrl: 'https://example.test',
      includeRentals: false,
      maxPagesPerCategory: 1
    });

    assert.equal(plan.length, 5);
    assert.deepEqual(plan.map((item) => item.category), ['dvustaen', 'tristaen', 'chetiristaen', 'mnogostaen', 'kashta']);
    assert.ok(plan.every((item) => item.purpose === 'sale'));
  });

  test('parses search result cards and detail pages into property data', () => {
    const searchHtml = `
      <section class="listing-card" data-id="imot-123">
        <a class="listing-link" href="/pcgi/imot.cgi?act=5&adv=1c123">Двустаен, Младост 1</a>
        <span class="price">85 000 EUR</span>
        <span class="area">65 кв.м</span>
        <span class="location">гр. София, Младост 1</span>
        <span class="floor">ет. 4 от 8</span>
        <img src="/photos/123.jpg">
        <p class="description">Южен апартамент за ремонт.</p>
      </section>
    `;
    const [property] = parseSearchResults(searchHtml, 'https://www.imot.bg');

    assert.equal(property.externalId, 'imot-123');
    assert.equal(property.url, 'https://www.imot.bg/pcgi/imot.cgi?act=5&adv=1c123');
    assert.equal(property.title, 'Двустаен, Младост 1');
    assert.equal(property.priceEur, 85000);
    assert.equal(property.areaSqm, 65);
    assert.equal(property.neighborhood, 'Младост 1');
    assert.equal(property.zone, 'Младост');
    assert.equal(property.condition, 'needs_rehab');
    assert.equal(property.floor, 4);
    assert.equal(property.totalFloors, 8);
    assert.equal(property.imageUrl, 'https://www.imot.bg/photos/123.jpg');

    const detail = parseDetailPage(`
      <h1>Двустаен, Младост 1</h1>
      <dl><dt>Година</dt><dd>2019</dd></dl>
      <div class="stage">Акт 15</div>
      <div class="description">Пълно описание с акт 15 и тухла.</div>
    `);

    assert.equal(detail.constructionYear, 2019);
    assert.equal(detail.constructionStage, 'act15');
    assert.match(detail.description, /Пълно описание/);
  });

  test('parses current imot.bg listing markup without treating ads as listings', () => {
    const html = `
      <div class="item">
        <a href="https://fakti.bg/avto/1053159-test">Sponsored</a>
        <span>4 лв.</span>
      </div>
      <div class="item">
        <a href="//www.imot.bg/obiava-1c123-prodava-tristaen-apartament-grad-sofiya-boyana" class="image saveSlink">
          <img class="pic" src="//imotstatic1.focus.bg/imot/photosimotbg/1/123/1c123.jpg" alt="Обява Продава 3-СТАЕН,град София, Бояна">
        </a>
        <div class="location">бул. Христо Ботев 75</div>
        <p>Продава 3-СТАЕНград София, Бояна</p>
        <p>367 000 €718 000 лв.</p>
        <p>150 кв.м, 2-ри ет. от 5, Въведен в експлоатация</p>
      </div>
    `;

    const listings = parseSearchResults(html, 'https://www.imot.bg');

    assert.equal(listings.length, 1);
    assert.equal(listings[0].externalId, 'id1c123');
    assert.equal(listings[0].priceEur, 367000);
    assert.equal(listings[0].neighborhood, 'Бояна');
    assert.equal(listings[0].imageUrl, 'https://imotstatic1.focus.bg/imot/photosimotbg/1/123/1c123.jpg');
  });

  test('runs a scrape, tracks price changes, marks missing listings inactive, and recomputes stats', async () => {
    const db = memoryDb();
    const searchUrl = 'https://www.imot.bg/search?page=1';
    const detailUrl = 'https://www.imot.bg/pcgi/imot.cgi?act=5&adv=1c123';
    let price = '85 000 EUR';
    let includeListing = true;

    const fetcher = async (url) => {
      if (url === searchUrl) {
        return {
          body: includeListing
            ? `<section class="listing-card" data-id="imot-123">
                <a class="listing-link" href="${detailUrl}">Двустаен, Младост 1</a>
                <span class="price">${price}</span>
                <span class="area">65 кв.м</span>
                <span class="location">Младост 1</span>
              </section>`
            : '<main></main>'
        };
      }
      return {
        body: '<div class="description">Акт 16, добро състояние.</div><span>Година: 2019</span>'
      };
    };

    const searchPlan = [{ purpose: 'sale', category: 'dvustaen', resultPage: 1, url: searchUrl, fullScope: true }];
    const first = await runScrape({ database: db, searchPlan, fetcher, delayMs: 0 });
    assert.equal(first.listingsSaved, 1);

    price = '83 000 EUR';
    const second = await runScrape({ database: db, searchPlan, fetcher, delayMs: 0 });
    const property = getPropertyByExternalId('imot-123', db);
    const history = getPriceHistoryByPropertyId(property.id, db);

    assert.equal(property.listing_purpose, 'sale');
    assert.equal(property.category, 'dvustaen');
    assert.equal(second.priceChanges, 1);
    assert.equal(property.price_eur, 83000);
    assert.deepEqual(history.map((entry) => entry.price_eur), [85000, 83000]);

    includeListing = false;
    await runScrape({ database: db, searchPlan, fetcher, delayMs: 0 });
    assert.equal(queryProperties({}, db).length, 0);
    assert.equal(queryProperties({ includeInactive: true }, db)[0].is_active, 0);
  });

  test('bounded scrape does not deactivate listings outside completed scanned scope', async () => {
    const db = memoryDb();
    upsertProperty({ externalId: 'sale-a', listingPurpose: 'sale', category: 'dvustaen', priceEur: 100000 }, db);
    upsertProperty({ externalId: 'sale-b', listingPurpose: 'sale', category: 'tristaen', priceEur: 120000 }, db);
    upsertProperty({ externalId: 'rent-a', listingPurpose: 'rent', category: 'dvustaen', priceEur: 600 }, db);

    await runScrape({
      database: db,
      searchPlan: [{ purpose: 'sale', category: 'dvustaen', resultPage: 1, url: 'https://www.imot.bg/sale-a', fullScope: true }],
      fetcher: async () => ({ body: '<main></main>' }),
      delayMs: 0
    });

    assert.equal(getPropertyByExternalId('sale-a', db).is_active, 0);
    assert.equal(getPropertyByExternalId('sale-b', db).is_active, 1);
    assert.equal(getPropertyByExternalId('rent-a', db).is_active, 1);
  });

  test('bounded partial scopes keep unseen listings active within the same category', async () => {
    const db = memoryDb();
    upsertProperty({ externalId: 'sale-a', listingPurpose: 'sale', category: 'dvustaen', priceEur: 100000 }, db);

    await runScrape({
      database: db,
      searchPlan: [{ purpose: 'sale', category: 'dvustaen', resultPage: 1, url: 'https://www.imot.bg/sale-a', fullScope: false }],
      fetcher: async () => ({ body: '<main></main>' }),
      delayMs: 0
    });

    assert.equal(getPropertyByExternalId('sale-a', db).is_active, 1);
  });

  test('exposes scraper start, status, and history routes', async () => {
    const db = memoryDb();
    let receivedOptions = null;
    const app = createApp({
      database: db,
      scraper: {
        start: async (options) => {
          receivedOptions = options;
          return runScrape({
            database: db,
            searchPlan: [],
            fetcher: async () => ({ body: '<main></main>' }),
            delayMs: 0
          });
        }
      }
    });

    await withServer(app, async (baseUrl) => {
      const start = await fetch(`${baseUrl}/api/scraper/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ includeRentals: false, maxPagesPerCategory: 2 })
      });
      assert.equal(start.status, 202);
      const startJson = await start.json();
      assert.equal(startJson.status, 'running');
      assert.deepEqual(receivedOptions, { includeRentals: false, maxPagesPerCategory: 2 });

      await new Promise((resolve) => setTimeout(resolve, 20));

      const status = await fetch(`${baseUrl}/api/scraper/status`);
      assert.equal(status.status, 200);
      assert.equal((await status.json()).status, 'completed');

      const history = await fetch(`${baseUrl}/api/scraper/history`);
      assert.equal(history.status, 200);
      assert.equal((await history.json()).runs.length, 1);
      assert.equal(getLatestScrapingRun(db).status, 'completed');
    });
  });
});
