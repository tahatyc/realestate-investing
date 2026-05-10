import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getLabelMeta, humanizeKey, labelMetadata } from './labels.js';

describe('label metadata helpers', () => {
  test('returns known labels with descriptions', () => {
    assert.equal(getLabelMeta('cocPct').label, 'Cash-on-cash return');
    assert.match(getLabelMeta('cocPct').description, /cash invested/i);
    assert.equal(getLabelMeta('pricePerSqm').label, 'Price per sqm');
    assert.equal(getLabelMeta('rehabCostPerSqm').label, 'Rehab cost per sqm');
    assert.match(getLabelMeta('rehabCostPerSqm').description, /renovation budget/i);
    assert.equal(getLabelMeta('transactionCostPct').label, 'Transaction costs');
    assert.match(getLabelMeta('transactionCosts').description, /notary/i);
  });

  test('humanizes camelCase, snake_case, and kebab-case fallbacks', () => {
    assert.equal(humanizeKey('monthlyCashFlow'), 'Monthly cash flow');
    assert.equal(humanizeKey('avg_price_per_sqm'), 'Avg price per sqm');
    assert.equal(humanizeKey('break-even-rate'), 'Break even rate');
  });

  test('handles acronyms and nullish keys safely', () => {
    assert.equal(humanizeKey('ltvPct'), 'LTV pct');
    assert.equal(humanizeKey(''), 'Unknown');
    assert.equal(humanizeKey(null), 'Unknown');
  });

  test('falls back without a tooltip description for unknown keys', () => {
    assert.deepEqual(getLabelMeta('newBackendMetric'), {
      key: 'newBackendMetric',
      label: 'New backend metric',
      description: ''
    });
  });

  test('returns readable labels and descriptions for backend health flags', () => {
    assert.equal(getLabelMeta('INSTANT_EQUITY').label, 'Instant equity');
    assert.match(getLabelMeta('INSTANT_EQUITY').description, /below market/i);
    assert.equal(getLabelMeta('NEGATIVE_CASH_FLOW').label, 'Negative cash flow');
    assert.equal(getLabelMeta('LOW_DSCR').label, 'Low DSCR');
    assert.equal(getLabelMeta('RATE_SENSITIVE').label, 'Rate sensitive');
    assert.equal(getLabelMeta('STRONG_LEVERAGED_RETURN').label, 'Strong leveraged return');
    assert.equal(getLabelMeta('REFINANCE_VIABLE').label, 'Refinance viable');
  });

  test('covers the strategy metric keys shown on detail pages', () => {
    for (const key of [
      'appreciationPct',
      'arv',
      'breakEvenRate',
      'cashDeployed',
      'cashInvested',
      'cashLeftInDeal',
      'cocPct',
      'daysOnMarket',
      'discountAmount',
      'discountPct',
      'downPayment',
      'dscr',
      'effectiveLtvPct',
      'equityOnCashRatio',
      'holdMonths',
      'instantEquity',
      'interestCost',
      'leveragedPaybackYears',
      'leveragedProfit',
      'leveragedRoiPct',
      'loanAmount',
      'longTermComparison',
      'longTermMonthlyCashFlow',
      'longTermMonthlyRent',
      'marketValue',
      'monthlyCashFlow',
      'monthlyPayment',
      'monthlyRent',
      'monthlyRevenue',
      'netYieldPct',
      'noi',
      'originationFee',
      'paybackYears',
      'potentialProfit',
      'profit',
      'purchasePrice',
      'rateSensitivity',
      'refinanceLoan',
      'rehabCost',
      'roiPct',
      'annualizedRoiPct',
      'totalInvestment',
      'transactionCosts'
    ]) {
      assert.ok(labelMetadata[key], `${key} should have metadata`);
      assert.ok(labelMetadata[key].label, `${key} should have a label`);
      assert.ok(labelMetadata[key].description, `${key} should have a description`);
    }
  });
});
