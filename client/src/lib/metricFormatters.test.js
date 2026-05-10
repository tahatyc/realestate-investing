import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatMetric } from './metricFormatters.js';

describe('metric formatters', () => {
  test('formats amount metrics as euros', () => {
    assert.equal(formatMetric('totalInvestment', 103000), '€103,000');
    assert.equal(formatMetric('discountAmount', 12500), '€12,500');
  });
});
