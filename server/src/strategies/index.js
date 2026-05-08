import { getDb } from '../db/connection.js';
import { queryProperties } from '../db/properties.js';
import { getSettings } from '../db/settings.js';
import { evaluate } from '../utils/healthFlags.js';
import { analyze as analyzeAirbnb } from './airbnb.js';
import { analyze as analyzeBelowMarket } from './belowMarket.js';
import { analyze as analyzeBrrrr } from './brrrr.js';
import { analyze as analyzeBuyInGreen } from './buyInGreen.js';
import { analyze as analyzeCashFlow } from './cashFlow.js';
import { analyze as analyzeFlip } from './flipper.js';

const registry = {
  'buy-in-green': analyzeBuyInGreen,
  brrrr: analyzeBrrrr,
  flip: analyzeFlip,
  'cash-flow': analyzeCashFlow,
  airbnb: analyzeAirbnb,
  'below-market': analyzeBelowMarket
};

export function strategyNames() {
  return Object.keys(registry);
}

function decorateResult(result, settings) {
  if (!settings.leverage.enabled) {
    return {
      ...result,
      leveragedMetrics: null,
      health: null,
      flags: [],
      rateSensitivity: [],
      breakEvenRate: null,
      score: result.cashScore
    };
  }

  const healthResult = evaluate(result.leveragedMetrics, settings);
  const flags = [...new Set([...(result.flags ?? []), ...healthResult.flags])];

  return {
    ...result,
    health: healthResult.health,
    flags,
    rateSensitivity: result.leveragedMetrics?.rateSensitivity ?? [],
    breakEvenRate: result.leveragedMetrics?.breakEvenRate ?? null,
    score: result.leveragedScore ?? result.cashScore
  };
}

export function analyzeProperty(property, { database = getDb(), settings = getSettings(database) } = {}) {
  const results = {};
  for (const [name, analyzer] of Object.entries(registry)) {
    results[name] = decorateResult(analyzer(property, { database, settings }), settings);
  }
  return results;
}

function healthBreakdown(results) {
  return results.reduce(
    (counts, result) => {
      if (result.health) {
        counts[result.health] += 1;
      }
      return counts;
    },
    { green: 0, yellow: 0, red: 0 }
  );
}

export function analyzeStrategy(name, options = {}) {
  const analyzer = registry[name];
  if (!analyzer) {
    throw new Error(`Unknown strategy: ${name}`);
  }

  const database = options.database ?? getDb();
  const settings = options.settings ?? getSettings(database);
  const limit = Math.min(Number(options.limit) || 50, 250);
  const offset = Number(options.offset) || 0;
  const properties = queryProperties({ ...options.filters, limit: 10000 }, database);
  let results = properties
    .map((property) => decorateResult(analyzer(property, { database, settings }), settings))
    .filter((result) => result.applicable !== false);

  if (options.health) {
    results = results.filter((result) => result.health === options.health);
  }

  results.sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));

  return {
    strategy: name,
    results: results.slice(offset, offset + limit),
    summary: {
      total: results.length,
      leverageEnabled: settings.leverage.enabled,
      currentRate: settings.leverage.mortgageRate,
      healthBreakdown: healthBreakdown(results),
      avgCocPct: average(results.map((item) => item.leveragedMetrics?.cocPct).filter(Number.isFinite))
    },
    pagination: {
      limit,
      offset,
      total: results.length
    }
  };
}

function average(values) {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
