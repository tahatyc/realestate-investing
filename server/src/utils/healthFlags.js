export const FLAGS = {
  NEGATIVE_CASH_FLOW: 'NEGATIVE_CASH_FLOW',
  LOW_DSCR: 'LOW_DSCR',
  RATE_SENSITIVE: 'RATE_SENSITIVE',
  STRONG_LEVERAGED_RETURN: 'STRONG_LEVERAGED_RETURN',
  REFINANCE_VIABLE: 'REFINANCE_VIABLE',
  INSTANT_EQUITY: 'INSTANT_EQUITY'
};

export function evaluate(leveragedMetrics, settings) {
  if (!leveragedMetrics) {
    return { health: null, flags: [] };
  }

  const flags = [];
  const thresholds = settings.flags ?? settings;
  const leverage = settings.leverage ?? settings;
  const cashFlow = Number(leveragedMetrics.monthlyCashFlow ?? leveragedMetrics.cashFlow ?? 0);
  const coc = Number(leveragedMetrics.cocPct ?? leveragedMetrics.cashOnCashPct ?? 0);
  const metricDscr = Number(leveragedMetrics.dscr ?? 0);
  const breakEven = leveragedMetrics.breakEvenRate ?? leveragedMetrics.breakEvenRatePct;
  const currentRate = Number(leverage.mortgageRate ?? leverage.currentRate ?? 0);

  if (cashFlow < 0) {
    flags.push(FLAGS.NEGATIVE_CASH_FLOW);
  }
  if (metricDscr > 0 && metricDscr < Number(thresholds.dscrMinimum ?? 1.25)) {
    flags.push(FLAGS.LOW_DSCR);
  }
  if (
    breakEven != null &&
    Number(breakEven) <= currentRate + Number(thresholds.rateStressPct ?? 1)
  ) {
    flags.push(FLAGS.RATE_SENSITIVE);
  }
  if (coc >= Number(thresholds.cocGreenPct ?? 8) && cashFlow > 0) {
    flags.push(FLAGS.STRONG_LEVERAGED_RETURN);
  }
  if (leveragedMetrics.refinanceCoveragePct != null && leveragedMetrics.refinanceCoveragePct > 75) {
    flags.push(FLAGS.REFINANCE_VIABLE);
  }
  if (
    leveragedMetrics.discountAmount != null &&
    leveragedMetrics.downPayment != null &&
    leveragedMetrics.discountAmount > leveragedMetrics.downPayment
  ) {
    flags.push(FLAGS.INSTANT_EQUITY);
  }

  let health = 'yellow';
  if (
    coc >= Number(thresholds.cocGreenPct ?? 8) &&
    cashFlow > 0 &&
    metricDscr >= Number(thresholds.dscrMinimum ?? 1.25)
  ) {
    health = 'green';
  }
  if (
    (cashFlow < 0 && coc < Number(thresholds.cocYellowPct ?? 4)) ||
    (breakEven != null && Number(breakEven) <= currentRate)
  ) {
    health = 'red';
  }

  return { health, flags };
}
