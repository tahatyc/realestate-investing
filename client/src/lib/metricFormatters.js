import { formatCashFlow, formatEur, formatPercent } from './formatters.js';

export function formatMetric(key, value) {
  if (/pct|rate|roi|yield|ltv/i.test(key)) return formatPercent(value);
  if (/amount|cash|price|profit|value|rent|payment|cost|fee|equity|loan|arv|investment/i.test(key)) {
    return key === 'monthlyCashFlow' ? formatCashFlow(value) : formatEur(value);
  }
  if (typeof value === 'number') return value.toFixed(2);
  return value ?? '-';
}
