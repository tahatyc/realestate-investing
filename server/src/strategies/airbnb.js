import { baseResult, estimatedMonthlyRent, monthlyNoi, propertyPrice, rentalLeveragedMetrics } from './shared.js';

export function analyze(property, { settings }) {
  const price = propertyPrice(property);
  const revenue = Number(settings.airbnb.dailyRateEur ?? 65) * 30 * (Number(settings.airbnb.occupancyPct ?? 65) / 100);
  const operatingExpenses = revenue * (Number(settings.airbnb.operatingExpensePct ?? 30) / 100);
  const noi = revenue - operatingExpenses;
  const longTermNoi = monthlyNoi(property, settings, estimatedMonthlyRent(property, settings));
  const leveragedMetrics = rentalLeveragedMetrics(property, settings, noi);
  const netYieldPct = price > 0 ? (noi * 12 / price) * 100 : 0;

  return baseResult(
    'airbnb',
    property,
    {
      monthlyRevenue: revenue,
      operatingExpenses,
      monthlyNOI: noi,
      netYieldPct,
      longTermMonthlyNOI: longTermNoi,
      longTermComparison: longTermNoi > 0 ? noi / longTermNoi : null
    },
    {
      ...leveragedMetrics,
      longTermMonthlyCashFlow: rentalLeveragedMetrics(property, settings, longTermNoi).monthlyCashFlow
    },
    netYieldPct,
    leveragedMetrics.cocPct
  );
}
