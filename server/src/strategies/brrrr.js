import { baseResult, averagePricePerSqm, estimatedMonthlyRent, monthlyNoi, propertyArea, propertyPrice, rentalLeveragedMetrics } from './shared.js';

export function analyze(property, { database, settings }) {
  const price = propertyPrice(property);
  const area = propertyArea(property);
  const rehabCost = area * 300;
  const arv = Math.max(averagePricePerSqm(property, database) * area, price * 1.15);
  const totalInvestment = price + rehabCost;
  const monthlyRent = estimatedMonthlyRent({ ...property, price_eur: arv }, settings);
  const noi = monthlyNoi(property, settings, monthlyRent);
  const refinanceLoan = arv * (Number(settings.leverage.ltvPct) / 100);
  const cashLeftInDeal = Math.max(totalInvestment - refinanceLoan, 0);
  const leveragedMetrics = {
    ...rentalLeveragedMetrics({ ...property, price_eur: arv }, settings, noi),
    refinanceLoan,
    cashLeftInDeal,
    refinanceCoveragePct: totalInvestment > 0 ? (refinanceLoan / totalInvestment) * 100 : 0
  };

  if (cashLeftInDeal > 0) {
    leveragedMetrics.cocPct = leveragedMetrics.monthlyCashFlow * 12 / cashLeftInDeal * 100;
  }

  return baseResult(
    'brrrr',
    property,
    {
      purchasePrice: price,
      rehabCost,
      totalInvestment,
      arv,
      monthlyRent,
      grossYieldPct: totalInvestment > 0 ? (monthlyRent * 12 / totalInvestment) * 100 : 0,
      netYieldPct: totalInvestment > 0 ? (noi * 12 / totalInvestment) * 100 : 0
    },
    leveragedMetrics,
    totalInvestment > 0 ? (noi * 12 / totalInvestment) * 100 : 0,
    leveragedMetrics.monthlyCashFlow
  );
}
