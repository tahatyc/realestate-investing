import * as cheerio from 'cheerio';
import { bgnToEur, eurToBgn } from '../utils/currency.js';
import { detectCondition } from '../utils/conditionDetector.js';
import { normalizeNeighborhood, zoneForNeighborhood } from './neighborhoods.js';

function compact(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function numberFromText(text) {
  const match = compact(text).match(/(\d[\d\s.,]*)/);
  if (!match) {
    return null;
  }
  return Number(match[1].replace(/\s/g, '').replace(',', '.'));
}

function parsePrice(text) {
  const eurMatch = compact(text).match(/(\d[\d\s.,]*)\s*(?:EUR|€)/i);
  const bgnMatch = compact(text).match(/(\d[\d\s.,]*)\s*(?:лв|BGN)/i);
  const value = numberFromText(text);

  if (eurMatch) {
    const priceEur = Number(eurMatch[1].replace(/\s/g, '').replace(',', '.'));
    return { priceEur, priceBgn: Math.round(eurToBgn(priceEur) * 100) / 100 };
  }

  if (bgnMatch) {
    const priceBgn = Number(bgnMatch[1].replace(/\s/g, '').replace(',', '.'));
    return { priceEur: Math.round(bgnToEur(priceBgn) * 100) / 100, priceBgn };
  }

  if (value == null) {
    return { priceEur: null, priceBgn: null };
  }

  if (/лв|bgn/i.test(text)) {
    return { priceEur: Math.round(bgnToEur(value) * 100) / 100, priceBgn: value };
  }

  return { priceEur: value, priceBgn: Math.round(eurToBgn(value) * 100) / 100 };
}

function parseFloor(text) {
  const match = compact(text).match(/(?:ет\.?|етаж)\s*(\d+)\s*(?:от|\/)\s*(\d+)/i);
  if (!match) {
    return { floor: null, totalFloors: null };
  }
  return { floor: Number(match[1]), totalFloors: Number(match[2]) };
}

function parseRooms(title) {
  const lower = title.toLowerCase();
  if (/едностаен|1-?стаен/.test(lower)) return 1;
  if (/двустаен|2-?стаен/.test(lower)) return 2;
  if (/тристаен|3-?стаен/.test(lower)) return 3;
  if (/четиристаен|4-?стаен/.test(lower)) return 4;
  return null;
}

function parseType(title) {
  const rooms = parseRooms(title);
  if (rooms) {
    return `${rooms}-bedroom`;
  }
  if (/къща/i.test(title)) {
    return 'house';
  }
  return 'apartment';
}

function absoluteUrl(url, baseUrl) {
  if (!url) {
    return null;
  }
  return new URL(url, baseUrl).toString();
}

function externalIdFrom(card, url) {
  const dataId = card.attr('data-id') || card.attr('id');
  if (dataId) {
    return dataId;
  }
  const adv = url?.match(/adv=([^&]+)/i)?.[1];
  if (adv) {
    return `imot-${adv}`;
  }
  const obiava = url?.match(/obiava-([^-/]+)/i)?.[1];
  if (obiava) {
    return `id${obiava}`;
  }
  return url || null;
}

export function parseSearchResults(html, baseUrl = 'https://www.imot.bg') {
  const $ = cheerio.load(html);
  const cards = $('.listing-card, .offer, .item, tr:has(a[href*="imot.cgi"])').toArray();

  return cards
    .map((element) => {
      const card = $(element);
      const link = card.find('a.listing-link[href], a[href*="obiava-"], a[href*="imot.cgi"]').first();
      const cardText = compact(card.text());
      const image = card.find('img.pic, img[alt*="Обява"], img').filter((_, img) => !/icons\//i.test($(img).attr('src') ?? '')).first();
      const title =
        compact(link.text() || card.find('h2,h3').first().text() || image.attr('alt')) ||
        compact(cardText.match(/Продава\s+[^€]+?(?=\d[\d\s.,]*\s*(?:EUR|€|лв|BGN))/i)?.[0]);
      const url = absoluteUrl(link.attr('href'), baseUrl);
      const priceText = compact(card.find('.price, [data-field="price"]').first().text()) || cardText;
      const areaText = compact(card.find('.area, [data-field="area"]').first().text()) || compact(card.text().match(/\d[\d\s.,]*\s*(?:кв\.?\s*м|m2|sqm)/i)?.[0]);
      const titleLocation = compact((title || cardText).match(/(?:град|гр\.)\s*София,\s*([^0-9€лв]+)/i)?.[1]);
      const locationText =
        titleLocation ||
        compact(card.find('.location, .quarter, [data-field="location"]').first().text()) ||
        title.split(',').slice(1).join(',');
      const description = compact(card.find('.description, p').first().text());
      const imageUrl = absoluteUrl(image.attr('src'), baseUrl);
      const price = parsePrice(priceText);
      const areaSqm = numberFromText(areaText);
      const neighborhood = normalizeNeighborhood(locationText || title.split(',').at(-1));
      const floor = parseFloor(compact(card.find('.floor, [data-field="floor"]').first().text()) || card.text());

      if (!url || price.priceEur == null) {
        return null;
      }

      return {
        externalId: externalIdFrom(card, url),
        source: 'imot.bg',
        url,
        title,
        neighborhood,
        zone: zoneForNeighborhood(neighborhood),
        type: parseType(title),
        condition: detectCondition(`${title} ${description}`),
        priceEur: price.priceEur,
        priceBgn: price.priceBgn,
        areaSqm,
        pricePerSqm: areaSqm ? price.priceEur / areaSqm : null,
        floor: floor.floor,
        totalFloors: floor.totalFloors,
        rooms: parseRooms(title),
        description,
        imageUrl
      };
    })
    .filter(Boolean);
}

export function parseDetailPage(html) {
  const $ = cheerio.load(html);
  const text = compact($.text());
  const description = compact($('.description, #description, [itemprop="description"]').first().text()) || text;
  const yearMatch = text.match(/(?:Година|година|построен[ао]?)[^\d]*(19\d{2}|20\d{2})/);
  const stageMatch = text.match(/акт\s*(14|15|16)/i);

  return {
    constructionYear: yearMatch ? Number(yearMatch[1]) : null,
    constructionStage: stageMatch ? `act${stageMatch[1]}` : null,
    description,
    condition: detectCondition(description || text)
  };
}
