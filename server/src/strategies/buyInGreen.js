import { baseResult, averagePricePerSqm, financingCarryCost, propertyArea, propertyPrice } from './shared.js';
import { downPayment, loanAmount, originationFee } from '../utils/mortgage.js';

export function analyze(property, { database, settings }) {
  const price = propertyPrice(property);
  const area = propertyArea(property);
  const averageFinished = Math.max(averagePricePerSqm(property, database), Number(property.price_per_sqm || 0) * 1.15);
  const futureValue = averageFinished * area;
  const potentialProfit = futureValue - price;
  const appreciationPct = price > 0 ? (potentialProfit / price) * 100 : 0;
  const stage = property.construction_stage;
  const holdMonths = stage === 'act14' ? 18 : stage === 'act15' ? 8 : 6;
  const principal = loanAmount(price, settings.leverage.ltvPct);
  const cashDown = downPayment(price, settings.leverage.downPaymentPct);
  const interestCost = financingCarryCost(principal, settings, holdMonths);
  const fee = originationFee(principal, settings.leverage.originationFeePct);
  const leveragedProfit = potentialProfit - interestCost - fee;
  const leveragedRoiPct = cashDown > 0 ? (leveragedProfit / cashDown) * 100 : null;

  return baseResult(
    'buy-in-green',
    property,
    {
      averageFinishedPricePerSqm: averageFinished,
      futureValue,
      potentialProfit,
      appreciationPct,
      holdMonths
    },
    {
      loanAmount: principal,
      downPayment: cashDown,
      interestCost,
      originationFee: fee,
      leveragedProfit,
      leveragedRoiPct,
      monthlyCashFlow: leveragedProfit / Math.max(holdMonths, 1),
      cocPct: leveragedRoiPct,
      dscr: 2,
      breakEvenRate: settings.leverage.mortgageRate + 2,
      rateSensitivity: []
    },
    potentialProfit,
    leveragedRoiPct
  );
}
