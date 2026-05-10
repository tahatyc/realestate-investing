import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { shouldHideRejected, statusLabel } from './dealTriageHelpers.js';

describe('DealTriage helpers', () => {
  test('labels triage statuses for controls', () => {
    assert.equal(statusLabel('new'), 'New');
    assert.equal(statusLabel('needs_call'), 'Needs call');
    assert.equal(statusLabel('made_offer'), 'Made offer');
    assert.equal(statusLabel('unknown'), 'unknown');
  });

  test('hides rejected rows only when includeRejected is false', () => {
    assert.equal(shouldHideRejected({ triage: { status: 'rejected' } }, false), true);
    assert.equal(shouldHideRejected({ triage: { status: 'rejected' } }, true), false);
    assert.equal(shouldHideRejected({ triage: { status: 'watching' } }, false), false);
  });
});
