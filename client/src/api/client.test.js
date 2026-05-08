import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildQueryString, buildSettingsUpdate } from './client.js';

describe('client API helpers', () => {
  test('builds clean query strings without empty filters', () => {
    assert.equal(
      buildQueryString({ zone: 'Mладост', health: '', limit: 25, minPrice: null }),
      '?zone=M%D0%BB%D0%B0%D0%B4%D0%BE%D1%81%D1%82&limit=25'
    );
  });

  test('keeps down payment and LTV linked for settings updates', () => {
    assert.deepEqual(buildSettingsUpdate({ leverage: { downPaymentPct: 35 } }), {
      leverage: { downPaymentPct: 35, ltvPct: 65 }
    });
    assert.deepEqual(buildSettingsUpdate({ leverage: { ltvPct: 70 } }), {
      leverage: { ltvPct: 70, downPaymentPct: 30 }
    });
  });
});
