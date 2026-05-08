import { baseResult, averagePricePerSqm, financingCarryCost, propertyArea, propertyPrice } from './shared.js';
import { downPayment, loanAmount, originationFee } from '../utils/mortgage.js';

export function analyze(property, { database, settings }) {
  const price = propertyPrice(property);
  const area = propertyArea(property);
  const rehabCost = area * 300;
  const arv = Math.max(averagePricePerSqm(property, database) * area, price * 1.12);
  const transactionCosts = price * 0.03;
  const profit = arv - price - rehabCost - transactionCosts;
  const totalInvestment = price + rehabCost + transactionCosts;
  const roiPct = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;
  const annualizedRoiPct = roiPct * 2;
  const principal = loanAmount(price, settings.leverage.ltvPct);
  const cashDeployed = downPayment(price, settings.leverage.downPaymentPct) + rehabCost;
  const interestCost = financingCarryCost(principal, settings, 6);
  const fee = originationFee(principal, settings.leverage.originationFeePct);
  const leveragedProfit = profit - interestCost - fee;
  const leveragedRoiPct = cashDeployed > 0 ? leveragedProfit / cashDeployed * 100 : null;

  return baseResult(
    'flip',
    property,
    { purchasePrice: price, rehabCost, arv, transactionCosts, profit, roiPct, annualizedRoiPct },
    {
      loanAmount: principal,
      cashDeployed,
      downPayment: downPayment(price, settings.leverage.downPaymentPct),
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
