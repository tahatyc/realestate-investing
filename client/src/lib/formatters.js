export function formatEur(value, options = {}) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) {
    return '-';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: options.maximumFractionDigits ?? 0
  }).format(Number(value));
}

export function formatPercent(value, digits = 1) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) {
    return '-';
  }
  return `${Number(value).toFixed(digits)}%`;
}

export function formatSqm(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) {
    return '-';
  }
  return `${Number(value).toFixed(1)} sqm`;
}

export function formatNumber(value, digits = 0) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) {
    return '-';
  }
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(Number(value));
}

export function formatDate(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date);
}

export function formatCashFlow(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) {
    return '-';
  }
  const formatted = formatEur(Math.abs(Number(value)));
  return Number(value) >= 0 ? `+${formatted}` : `-${formatted}`;
}
