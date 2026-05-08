import { baseResult, averagePricePerSqm, estimatedMonthlyRent, monthlyNoi, propertyArea, propertyPrice, rentalLeveragedMetrics } from './shared.js';
import { downPayment, loanAmount } from '../utils/mortgage.js';

export function analyze(property, { database, settings }) {
  const price = propertyPrice(property);
  const area = propertyArea(property);
  const marketValue = Math.max(averagePricePerSqm(property, database) * area, price);
  const discountAmount = marketValue - price;
  const discountPct = marketValue > 0 ? discountAmount / marketValue * 100 : 0;
  const principal = loanAmount(price, settings.leverage.ltvPct);
  const cashDown = downPayment(price, settings.leverage.downPaymentPct);
  const rent = estimatedMonthlyRent(property, settings);
  const noi = monthlyNoi(property, settings, rent);
  const leveragedRental = rentalLeveragedMetrics(property, settings, noi);
  const leveragedMetrics = {
    ...leveragedRental,
    instantEquity: discountAmount,
    discountAmount,
    downPayment: cashDown,
    effectiveLtvPct: marketValue > 0 ? principal / marketValue * 100 : null,
    equityOnCashRatio: cashDown > 0 ? discountAmount / cashDown : null
  };

  return baseResult(
    'below-market',
    property,
    {
      marketValue,
      discountAmount,
      discountPct,
      daysOnMarket: daysSince(property.first_seen_at),
      priceDrops: countPriceDrops(property.id, database)
    },
    leveragedMetrics,
    discountPct,
    discountPct + (leveragedMetrics.equityOnCashRatio ?? 0) * 10
  );
}

function countPriceDrops(propertyId, database) {
  const rows = database
    .prepare('SELECT price_eur FROM price_history WHERE property_id = ? ORDER BY recorded_at ASC, id ASC')
    .all(propertyId);
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
