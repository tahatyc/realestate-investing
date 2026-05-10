import { baseResult, estimatedMonthlyRent, monthlyNoi, propertyPrice, rentalLeveragedMetrics, transactionCosts } from './shared.js';

export function analyze(property, { settings }) {
  const price = propertyPrice(property);
  const transaction = transactionCosts(property, settings);
  const totalInvestment = price + transaction;
  const monthlyRent = estimatedMonthlyRent(property, settings);
  const noi = monthlyNoi(property, settings, monthlyRent);
  const grossYieldPct = totalInvestment > 0 ? (monthlyRent * 12 / totalInvestment) * 100 : 0;
  const netYieldPct = totalInvestment > 0 ? (noi * 12 / totalInvestment) * 100 : 0;
  const leveragedMetrics = rentalLeveragedMetrics(property, settings, noi);

  return baseResult(
    'cash-flow',
    property,
    {
      purchasePrice: price,
      transactionCosts: transaction,
      totalInvestment,
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
