import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatDate, formatEur, formatPercent, formatSqm } from './formatters.js';

describe('frontend formatters', () => {
  test('formats core investment values compactly', () => {
    assert.equal(formatEur(123456.4), '€123,456');
    assert.equal(formatPercent(8.234), '8.2%');
    assert.equal(formatSqm(72.49), '72.5 sqm');
  });

  test('handles missing values as dashes', () => {
    assert.equal(formatEur(null), '-');
    assert.equal(formatPercent(undefined), '-');
    assert.equal(formatDate(null), '-');
  });
});
