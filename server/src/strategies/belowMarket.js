import { baseResult, averagePricePerSqm, estimatedMonthlyRent, monthlyNoi, propertyArea, propertyPrice, rentalLeveragedMetrics, transactionCosts } from './shared.js';
import { downPayment, loanAmount } from '../utils/mortgage.js';
import { getPriceHistoryByPropertyId } from '../db/priceHistory.js';

export async function analyze(property, { settings }) {
  const price = propertyPrice(property);
  const area = propertyArea(property);
  const transaction = transactionCosts(property, settings);
  const totalInvestment = price + transaction;
  const marketValue = Math.max(await averagePricePerSqm(property) * area, price);
  const discountAmount = marketValue - totalInvestment;
  const discountPct = marketValue > 0 ? discountAmount / marketValue * 100 : 0;
  const principal = loanAmount(price, settings.leverage.ltvPct);
  const cashDown = downPayment(price, settings.leverage.downPaymentPct);
  const cashInvested = cashDown + transaction;
  const rent = estimatedMonthlyRent(property, settings);
  const noi = monthlyNoi(property, settings, rent);
  const leveragedRental = rentalLeveragedMetrics(property, settings, noi);
  const leveragedMetrics = {
    ...leveragedRental,
    instantEquity: discountAmount,
    discountAmount,
    downPayment: cashDown,
    transactionCosts: transaction,
    cashInvested,
    effectiveLtvPct: marketValue > 0 ? principal / marketValue * 100 : null,
    equityOnCashRatio: cashInvested > 0 ? discountAmount / cashInvested : null
  };

  return baseResult(
    'below-market',
    property,
    {
      purchasePrice: price,
      transactionCosts: transaction,
      totalInvestment,
      marketValue,
      discountAmount,
      discountPct,
      daysOnMarket: daysSince(property.first_seen_at),
      priceDrops: await countPriceDrops(property.id)
    },
    leveragedMetrics,
    discountPct,
    discountPct + (leveragedMetrics.equityOnCashRatio ?? 0) * 10
  );
}

async function countPriceDrops(propertyId) {
  const rows = await getPriceHistoryByPropertyId(propertyId);
  return rows.reduce((drops, row, index) => {
    if (index > 0 && row.price_eur < rows[index - 1].price_eur) {
      return drops + 1;
    }
    return drops;
  }, 0);
}

function daysSince(value) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}
