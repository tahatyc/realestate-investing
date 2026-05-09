import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getMetricValueClass, isOutcomeMetric } from './metricValueStyles.js';

describe('metric value styles', () => {
  test('identifies outcome metrics that should receive sign coloring', () => {
    assert.equal(isOutcomeMetric('profit'), true);
    assert.equal(isOutcomeMetric('monthlyCashFlow'), true);
    assert.equal(isOutcomeMetric('leveragedRoiPct'), true);
    assert.equal(isOutcomeMetric('discountAmount'), true);
    assert.equal(isOutcomeMetric('instantEquity'), true);
    assert.equal(isOutcomeMetric('longTermComparison'), true);
  });

  test('keeps neutral and input metrics uncolored', () => {
    assert.equal(isOutcomeMetric('purchasePrice'), false);
    assert.equal(isOutcomeMetric('loanAmount'), false);
    assert.equal(isOutcomeMetric('monthlyPayment'), false);
    assert.equal(isOutcomeMetric('interestCost'), false);
    assert.equal(isOutcomeMetric('monthlyRent'), false);
    assert.equal(isOutcomeMetric('arv'), false);
    assert.equal(isOutcomeMetric('dscr'), false);
    assert.equal(isOutcomeMetric('effectiveLtvPct'), false);
  });

  test('colors positive outcome values green', () => {
    assert.equal(getMetricValueClass('monthlyCashFlow', 250), 'text-emerald-700');
    assert.equal(getMetricValueClass('roiPct', 12.5), 'text-emerald-700');
  });

  test('colors negative outcome values red', () => {
    assert.equal(getMetricValueClass('monthlyCashFlow', -120), 'text-rose-700');
    assert.equal(getMetricValueClass('longTermComparison', -35), 'text-rose-700');
  });

  test('leaves zero, missing, non-numeric, and neutral metrics uncolored', () => {
    assert.equal(getMetricValueClass('monthlyCashFlow', 0), 'text-slate-900');
    assert.equal(getMetricValueClass('monthlyCashFlow', null), 'text-slate-900');
    assert.equal(getMetricValueClass('monthlyCashFlow', 'n/a'), 'text-slate-900');
    assert.equal(getMetricValueClass('loanAmount', 50000), 'text-slate-900');
  });
});
