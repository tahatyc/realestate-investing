import { baseResult, averagePricePerSqm, financingCarryCost, propertyArea, propertyPrice, transactionCosts } from './shared.js';
import { downPayment, loanAmount, originationFee } from '../utils/mortgage.js';
import { isBuyInGreenEligible } from './buyInGreenEligibility.js';

const PRE_ACT14_HOLD_MONTHS = 24;

export function analyze(property, { database, settings }) {
  if (!isBuyInGreenEligible(property)) {
    return baseResult(
      'buy-in-green',
      property,
      {},
      null,
      null,
      null,
      { applicable: false }
    );
  }

  const price = propertyPrice(property);
  const area = propertyArea(property);
  const transaction = transactionCosts(property, settings);
  const totalInvestment = price + transaction;
  const averageFinished = Math.max(averagePricePerSqm(property, database), Number(property.price_per_sqm || 0) * 1.15);
  const futureValue = averageFinished * area;
  const potentialProfit = futureValue - totalInvestment;
  const appreciationPct = totalInvestment > 0 ? (potentialProfit / totalInvestment) * 100 : 0;
  const holdMonths = PRE_ACT14_HOLD_MONTHS;
  const principal = loanAmount(price, settings.leverage.ltvPct);
  const cashDown = downPayment(price, settings.leverage.downPaymentPct);
  const cashInvested = cashDown + transaction;
  const interestCost = financingCarryCost(principal, settings, holdMonths);
  const fee = originationFee(principal, settings.leverage.originationFeePct);
  const leveragedProfit = potentialProfit - interestCost - fee;
  const leveragedRoiPct = cashInvested > 0 ? (leveragedProfit / cashInvested) * 100 : null;

  return baseResult(
    'buy-in-green',
    property,
    {
      purchasePrice: price,
      transactionCosts: transaction,
      totalInvestment,
      averageFinishedPricePerSqm: averageFinished,
      futureValue,
      potentialProfit,
      appreciationPct,
      holdMonths
    },
    {
      loanAmount: principal,
      downPayment: cashDown,
      transactionCosts: transaction,
      cashInvested,
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
