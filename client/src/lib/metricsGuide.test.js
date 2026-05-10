import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  findStrategyGuide,
  flattenGuideText,
  metricGlossary,
  requiredSystemGuideIds,
  strategyGuides,
  systemGuides
} from './metricsGuide.js';
import { strategyList } from './strategies.js';

describe('metrics guide content', () => {
  test('documents every frontend strategy', () => {
    assert.deepEqual(
      strategyGuides.map((guide) => guide.id),
      strategyList.map((strategy) => strategy.id)
    );

    for (const strategy of strategyList) {
      const guide = findStrategyGuide(strategy.id);
      assert.ok(guide, `${strategy.id} should have a guide entry`);
      assert.equal(guide.label, strategy.label);
      assert.ok(guide.summary, `${strategy.id} should explain the strategy purpose`);
      assert.ok(guide.cashScore, `${strategy.id} should explain the cash score`);
      assert.ok(guide.leveragedScore, `${strategy.id} should explain the leveraged score`);
      assert.ok(guide.caveats.length > 0, `${strategy.id} should explain current assumptions`);
    }
  });

  test('strategy guide metric keys cover the strategy table columns', () => {
    for (const strategy of strategyList) {
      const guide = findStrategyGuide(strategy.id);
      const guideKeys = new Set(guide.metricKeys);

      for (const key of [...strategy.cashColumns, ...strategy.leveragedColumns]) {
        assert.ok(
          guideKeys.has(key),
          `${strategy.id} guide should include the ${key} metric key`
        );
      }
    }
  });

  test('includes the required system guides', () => {
    const ids = new Set(systemGuides.map((guide) => guide.id));

    for (const id of requiredSystemGuideIds) {
      assert.ok(ids.has(id), `system guide ${id} should exist`);
    }

    assert.deepEqual(requiredSystemGuideIds, [
      'data-freshness',
      'settings',
      'leverage',
      'mortgage-payment',
      'rate-sensitivity',
      'health-flags',
      'neighborhoods'
    ]);
  });

  test('documents important code-backed formulas and assumptions', () => {
    const text = flattenGuideText();

    for (const phrase of [
      'fixed amortizing principal-and-interest payment',
      'break-even rate',
      '0% and 20%',
      'area * rehabCostPerSqm',
      'price * transactionCostPct / 100',
      'dailyRateEur * 30 * occupancyPct / 100',
      'When leverage is off',
      'score falls back to the cash score'
    ]) {
      assert.match(text, new RegExp(escapeRegExp(phrase), 'i'));
    }
  });

  test('glossary has named groups with entries', () => {
    assert.ok(metricGlossary.length >= 4);

    for (const group of metricGlossary) {
      assert.ok(group.title);
      assert.ok(group.entries.length > 0, `${group.title} should include entries`);

      for (const entry of group.entries) {
        assert.ok(entry.label);
        assert.ok(entry.description);
      }
    }
  });
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
