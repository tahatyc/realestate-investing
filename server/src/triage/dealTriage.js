import { defaultTriage, getTriageMap } from '../db/dealTriage.js';
import { getDb } from '../db/connection.js';
import { getPriceHistoryByPropertyId } from '../db/priceHistory.js';
import { queryProperties } from '../db/properties.js';
import { getSettings } from '../db/settings.js';
import { toPropertyResponse } from '../routes/properties.js';
import { analyzeProperty } from '../strategies/index.js';

const STRATEGY_LABELS = {
  'buy-in-green': 'Buy in Green',
  brrrr: 'BRRRR',
  flip: 'Fix & Flip',
  'cash-flow': 'Cash Flow',
  airbnb: 'Airbnb',
  'below-market': 'Below Market'
};

function parseBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function addSignal(signals, signal) {
  if (!signals.some((existing) => existing.type === signal.type && existing.label === signal.label)) {
    signals.push(signal);
  }
}

function formatEur(value) {
  return `EUR ${Math.round(value).toLocaleString('en-US')}`;
}

function priceDropSignal(property, database) {
  const history = getPriceHistoryByPropertyId(property.id, database);
  if (history.length < 2) {
    return null;
  }

  const first = history[0].price_eur;
  const current = property.price_eur;
  const drop = first - current;

  if (drop <= 0) {
    return null;
  }

  return {
    type: 'price_drop',
    label: `Price dropped ${formatEur(drop)}`,
    severity: 'positive',
    weight: Math.min(20, Math.max(5, drop / 1000))
  };
}

function deriveSignals(result, property, database) {
  const signals = [];
  const cash = result.cashMetrics ?? {};
  const leveraged = result.leveragedMetrics ?? {};

  if (result.health === 'green') {
    addSignal(signals, {
      type: 'green_health',
      label: `Green health in ${STRATEGY_LABELS[result.strategy] ?? result.strategy}`,
      severity: 'positive',
      weight: 18
    });
  }

  if (result.health === 'red') {
    addSignal(signals, {
      type: 'red_health',
      label: `Red health in ${STRATEGY_LABELS[result.strategy] ?? result.strategy}`,
      severity: 'risk',
      weight: -15
    });
  }

  if (Number.isFinite(cash.discountPct) && cash.discountPct > 0) {
    addSignal(signals, {
      type: 'discount',
      label: `${Math.round(cash.discountPct)}% below neighborhood average`,
      severity: 'positive',
      weight: Math.min(30, cash.discountPct)
    });
  }

  if (Number.isFinite(leveraged.monthlyCashFlow) && leveraged.monthlyCashFlow > 0) {
    addSignal(signals, {
      type: 'cash_flow',
      label: `Positive monthly cash flow: ${formatEur(leveraged.monthlyCashFlow)}`,
      severity: 'positive',
      weight: Math.min(20, leveraged.monthlyCashFlow / 25)
    });
  }

  if (Number.isFinite(leveraged.monthlyCashFlow) && leveraged.monthlyCashFlow < 0) {
    addSignal(signals, {
      type: 'negative_cash_flow',
      label: `Negative monthly cash flow: ${formatEur(Math.abs(leveraged.monthlyCashFlow))}`,
      severity: 'risk',
      weight: -12
    });
  }

  if (Number.isFinite(cash.roiPct) && cash.roiPct >= 10) {
    addSignal(signals, {
      type: 'cash_roi',
      label: `Cash ROI ${Math.round(cash.roiPct)}%`,
      severity: 'positive',
      weight: Math.min(20, cash.roiPct)
    });
  }

  if (Number.isFinite(leveraged.leveragedRoiPct) && leveraged.leveragedRoiPct >= 10) {
    addSignal(signals, {
      type: 'leveraged_roi',
      label: `Leveraged ROI ${Math.round(leveraged.leveragedRoiPct)}%`,
      severity: 'positive',
      weight: Math.min(20, leveraged.leveragedRoiPct)
    });
  }

  if (result.flags?.includes('INSTANT_EQUITY')) {
    addSignal(signals, {
      type: 'instant_equity',
      label: 'Instant equity signal',
      severity: 'positive',
      weight: 12
    });
  }

  if (result.flags?.includes('REFINANCE_VIABLE')) {
    addSignal(signals, {
      type: 'refinance_viable',
      label: 'Refinance covers most of investment',
      severity: 'positive',
      weight: 10
    });
  }

  const priceDrop = priceDropSignal(property, database);
  if (priceDrop) {
    addSignal(signals, priceDrop);
  }

  return signals;
}

function summarizeStrategyResult(strategy, result, property, database) {
  const signals = deriveSignals({ ...result, strategy }, property, database);
  const signalScore = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const score = toNumber(result.score) ?? 0;
  const healthBonus = result.health === 'green' ? 15 : result.health === 'red' ? -15 : 0;

  return {
    strategy,
    bestScore: score,
    health: result.health,
    signals,
    rankScore: Math.max(0, signalScore + healthBonus + Math.min(20, Math.max(0, score / 2)))
  };
}

function bestOpportunityForProperty(property, database, settings) {
  let results;
  try {
    results = analyzeProperty(property, { database, settings });
  } catch {
    return null;
  }

  const candidates = Object.entries(results)
    .filter(([, result]) => result.applicable !== false)
    .map(([strategy, result]) => summarizeStrategyResult(strategy, result, property, database));

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => b.rankScore - a.rankScore || b.bestScore - a.bestScore);
  const signals = [];
  for (const candidate of candidates) {
    for (const signal of candidate.signals) {
      addSignal(signals, signal);
    }
  }

  return {
    ...candidates[0],
    signals,
    rankScore: candidates.reduce((sum, candidate) => sum + candidate.rankScore, 0)
  };
}

export function listDealTriageOpportunities(options = {}, database = getDb()) {
  const limit = Math.min(Number(options.limit) || 50, 250);
  const includeRejected = parseBoolean(options.includeRejected);
  const settings = getSettings(database);
  const properties = queryProperties(
    {
      zone: options.zone,
      type: options.type,
      minPrice: options.minPrice,
      maxPrice: options.maxPrice,
      minArea: options.minArea,
      maxArea: options.maxArea,
      limit: 10000
    },
    database
  );
  const triageMap = getTriageMap(properties.map((property) => property.id), database);
  let hiddenRejected = 0;

  const opportunities = properties
    .map((property) => {
      const triage = triageMap.get(property.id) ?? defaultTriage(property.id);
      const best = bestOpportunityForProperty(property, database, settings);
      if (!best) {
        return null;
      }

      return {
        property: toPropertyResponse(property),
        triage,
        bestStrategy: best.strategy,
        bestScore: best.bestScore,
        rankScore: best.rankScore,
        health: best.health,
        signals: best.signals.map(({ weight, ...signal }) => signal)
      };
    })
    .filter(Boolean)
    .filter((item) => item.rankScore > 0 || item.triage.status !== 'new')
    .filter((item) => {
      if (item.triage.status === 'rejected' && !includeRejected) {
        hiddenRejected += 1;
        return false;
      }
      return true;
    })
    .sort((a, b) => b.rankScore - a.rankScore || b.bestScore - a.bestScore)
    .slice(0, limit);

  return {
    opportunities,
    summary: {
      total: opportunities.length,
      hiddenRejected
    }
  };
}
