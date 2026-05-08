import { baseResult, estimatedMonthlyRent, monthlyNoi, propertyPrice, rentalLeveragedMetrics } from './shared.js';

export function analyze(property, { settings }) {
  const price = propertyPrice(property);
  const monthlyRent = estimatedMonthlyRent(property, settings);
  const noi = monthlyNoi(property, settings, monthlyRent);
  const grossYieldPct = price > 0 ? (monthlyRent * 12 / price) * 100 : 0;
  const netYieldPct = price > 0 ? (noi * 12 / price) * 100 : 0;
  const leveragedMetrics = rentalLeveragedMetrics(property, settings, noi);

  return baseResult(
    'cash-flow',
    property,
    {
      monthlyRent,
      monthlyNOI: noi,
      grossYieldPct,
      netYieldPct,
      capRatePct: netYieldPct,
      paybackYears: netYieldPct > 0 ? 100 / netYieldPct : null
    },
    leveragedMetrics,
    netYieldPct,
    leveragedMetrics.cocPct
  );
}
