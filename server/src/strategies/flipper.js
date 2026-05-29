import { baseResult, averagePricePerSqm, financingCarryCost, propertyArea, propertyPrice, transactionCosts } from './shared.js';
import { downPayment, loanAmount, originationFee } from '../utils/mortgage.js';

export async function analyze(property, { settings }) {
  const price = propertyPrice(property);
  const area = propertyArea(property);
  const rehabCost = area * Number(settings.general?.rehabCostPerSqm ?? 300);
  const arv = Math.max(await averagePricePerSqm(property) * area, price * 1.12);
  const transaction = transactionCosts(property, settings);
  const profit = arv - price - rehabCost - transaction;
  const totalInvestment = price + rehabCost + transaction;
  const roiPct = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;
  const annualizedRoiPct = roiPct * 2;
  const principal = loanAmount(price, settings.leverage.ltvPct);
  const cashDeployed = downPayment(price, settings.leverage.downPaymentPct) + rehabCost + transaction;
  const interestCost = financingCarryCost(principal, settings, 6);
  const fee = originationFee(principal, settings.leverage.originationFeePct);
  const leveragedProfit = profit - interestCost - fee;
  const leveragedRoiPct = cashDeployed > 0 ? leveragedProfit / cashDeployed * 100 : null;

  return baseResult(
    'flip',
    property,
    { purchasePrice: price, transactionCosts: transaction, rehabCost, arv, profit, totalInvestment, roiPct, annualizedRoiPct },
    {
      loanAmount: principal,
      cashDeployed,
      downPayment: downPayment(price, settings.leverage.downPaymentPct),
      transactionCosts: transaction,
      interestCost,
      originationFee: fee,
      leveragedProfit,
      leveragedRoiPct,
      leveragedAnnualizedRoiPct: leveragedRoiPct == null ? null : leveragedRoiPct * 2,
      monthlyCashFlow: leveragedProfit / 6,
      cocPct: leveragedRoiPct,
      dscr: 2,
      breakEvenRate: settings.leverage.mortgageRate + 2,
      rateSensitivity: []
    },
    roiPct,
    leveragedRoiPct
  );
}
