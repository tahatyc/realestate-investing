import { propertyArea, propertyPrice } from './shared.js';
import { queryAllProperties } from '../db/properties.js';

const MIN_SAMPLE_SIZE = 3;

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function estimatedMonthlyRentFallback(property, settings) {
  return propertyPrice(property) * (Number(settings.general?.targetGrossYieldPct ?? 6) / 100) / 12;
}

function matchingTypeFilter(property) {
  if (property.rooms != null) {
    return { rooms: Number(property.rooms) };
  }
  if (property.type) {
    return { type: property.type };
  }
  return {};
}

async function rentalComps(property, scope) {
  const typeMatch = matchingTypeFilter(property);
  const scopeFilter = scope === 'neighborhood' ? { neighborhood: property.neighborhood } : { zone: property.zone };
  if (Object.values(scopeFilter).some((value) => value == null || value === '')) {
    return [];
  }

  const queryFilter = {
    listingPurpose: 'rent',
    ...scopeFilter,
    ...(typeMatch.type ? { type: typeMatch.type } : {}),
    limit: 10000
  };
  const comps = await queryAllProperties(queryFilter);

  return comps.filter((comp) => {
    if (typeMatch.rooms != null && Number(comp.rooms) !== typeMatch.rooms) {
      return false;
    }
    if (comp.price_eur == null) {
      return false;
    }
    return Number.isFinite(Number(comp.price_eur));
  });
}

function estimateFromSelectedComps(property, comps, source) {
  const area = propertyArea(property);
  const compsWithArea = comps.filter(
    (comp) =>
      comp.area_sqm != null &&
      comp.price_eur != null &&
      Number(comp.area_sqm) > 0 &&
      Number(comp.price_eur) > 0
  );

  if (area > 0 && compsWithArea.length >= MIN_SAMPLE_SIZE) {
    const medianRentPerSqm = median(compsWithArea.map((comp) => Number(comp.price_eur) / Number(comp.area_sqm)));
    return {
      monthlyRent: Math.round(medianRentPerSqm * area),
      source,
      sampleSize: compsWithArea.length,
      fallback: false
    };
  }

  return {
    monthlyRent: median(comps.map((comp) => Number(comp.price_eur))),
    source,
    sampleSize: comps.length,
    fallback: false
  };
}

export async function estimateMonthlyRentFromComps(property, { settings }) {
  const neighborhoodComps = await rentalComps(property, 'neighborhood');
  if (neighborhoodComps.length >= MIN_SAMPLE_SIZE) {
    return estimateFromSelectedComps(property, neighborhoodComps, 'neighborhood_comps');
  }

  const zoneComps = await rentalComps(property, 'zone');
  if (zoneComps.length >= MIN_SAMPLE_SIZE) {
    return estimateFromSelectedComps(property, zoneComps, 'zone_comps');
  }

  return {
    monthlyRent: estimatedMonthlyRentFallback(property, settings),
    source: 'target_yield_fallback',
    sampleSize: 0,
    fallback: true
  };
}
