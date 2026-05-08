import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getStrategy, strategyList } from './strategies.js';

describe('strategy frontend definitions', () => {
  test('defines all server strategy routes with cash and leveraged columns', () => {
    assert.deepEqual(strategyList.map((strategy) => strategy.id), [
      'buy-in-green',
      'brrrr',
      'flip',
      'cash-flow',
      'airbnb',
      'below-market'
    ]);

    for (const strategy of strategyList) {
      assert.ok(strategy.label);
      assert.ok(strategy.path);
      assert.ok(strategy.cashColumns.length > 0);
      assert.ok(strategy.leveragedColumns.length > 0);
    }
  });

  test('looks up unknown strategies with a stable fallback', () => {
    assert.equal(getStrategy('cash-flow').label, 'Cash Flow Rental');
    assert.equal(getStrategy('missing').id, 'missing');
  });
});
