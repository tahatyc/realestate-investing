import { estimateMonthlyRentFromComps } from './rentalComps.js';
import { baseResult, monthlyNoi, propertyPrice, rentalLeveragedMetrics, transactionCosts } from './shared.js';

export async function analyze(property, { settings }) {
  const price = propertyPrice(property);
  const transaction = transactionCosts(property, settings);
  const totalInvestment = price + transaction;
  const revenue = Number(settings.airbnb.dailyRateEur ?? 65) * 30 * (Number(settings.airbnb.occupancyPct ?? 65) / 100);
  const operatingExpenses = revenue * (Number(settings.airbnb.operatingExpensePct ?? 30) / 100);
  const noi = revenue - operatingExpenses;
  const longTermRentEstimate = await estimateMonthlyRentFromComps(property, { settings });
  const longTermNoi = monthlyNoi(property, settings, longTermRentEstimate.monthlyRent);
  const leveragedMetrics = rentalLeveragedMetrics(property, settings, noi);
  const netYieldPct = totalInvestment > 0 ? (noi * 12 / totalInvestment) * 100 : 0;

  return baseResult(
    'airbnb',
    property,
    {
      purchasePrice: price,
      transactionCosts: transaction,
      totalInvestment,
      monthlyRevenue: revenue,
      operatingExpenses,
      monthlyNOI: noi,
      netYieldPct,
      longTermRentEstimate,
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
