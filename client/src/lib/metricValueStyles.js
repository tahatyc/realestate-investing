const outcomeMetricKeys = new Set([
  'annualizedRoiPct',
  'appreciationPct',
  'cashFlow',
  'cocPct',
  'discountAmount',
  'discountPct',
  'equityOnCashRatio',
  'instantEquity',
  'leveragedProfit',
  'leveragedRoiPct',
  'longTermComparison',
  'longTermMonthlyCashFlow',
  'monthlyCashFlow',
  'netYieldPct',
  'potentialProfit',
  'profit',
  'roiPct'
]);

export const neutralMetricValueClass = 'text-slate-900';
export const positiveMetricValueClass = 'text-emerald-700';
export const negativeMetricValueClass = 'text-rose-700';

export function isOutcomeMetric(key) {
  return outcomeMetricKeys.has(key);
}

export function getMetricValueClass(key, value) {
  if (!isOutcomeMetric(key)) {
    return neutralMetricValueClass;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) {
    return neutralMetricValueClass;
  }

  return number > 0 ? positiveMetricValueClass : negativeMetricValueClass;
}
