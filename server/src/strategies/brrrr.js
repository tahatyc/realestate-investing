import { baseResult, averagePricePerSqm, estimatedMonthlyRent, monthlyNoi, propertyArea, propertyPrice, rentalLeveragedMetrics, transactionCosts } from './shared.js';

export async function analyze(property, { settings }) {
  const price = propertyPrice(property);
  const area = propertyArea(property);
  const rehabCost = area * Number(settings.general?.rehabCostPerSqm ?? 300);
  const transaction = transactionCosts(property, settings);
  const arv = Math.max(await averagePricePerSqm(property) * area, price * 1.15);
  const totalInvestment = price + rehabCost + transaction;
  const monthlyRent = estimatedMonthlyRent({ ...property, price_eur: arv }, settings);
  const noi = monthlyNoi(property, settings, monthlyRent);
  const refinanceLoan = arv * (Number(settings.leverage.ltvPct) / 100);
  const cashLeftInDeal = Math.max(totalInvestment - refinanceLoan, 0);
  const leveragedMetrics = {
    ...rentalLeveragedMetrics({ ...property, price_eur: arv }, settings, noi, { transactionCosts: transaction }),
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
      transactionCosts: transaction,
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
