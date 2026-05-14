import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isStrategyApplicable, strategyNotApplicableMessage } from './propertyDetailHelpers.js';

describe('property detail helpers', () => {
  test('detects non-applicable strategy results', () => {
    assert.equal(isStrategyApplicable({ applicable: false }), false);
    assert.equal(isStrategyApplicable({ cashMetrics: {} }), true);
    assert.equal(isStrategyApplicable(null), true);
  });

  test('describes buy-in-green non-applicability', () => {
    assert.equal(
      strategyNotApplicableMessage('buy-in-green'),
      'Not applicable: this listing is not explicitly pre-construction before Act 14.'
    );
    assert.equal(
      strategyNotApplicableMessage('cash-flow'),
      'Not applicable for this listing.'
    );
  });
});
