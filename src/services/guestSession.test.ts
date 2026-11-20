import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ONBOARDING_STEPS,
  createDefaultGuestSession,
  markEnteredAsGuest,
  markTourCompleted,
  markTourSkipped,
  parseGuestSession,
  serializeGuestSession,
  shouldShowWelcomeOnLoad,
} from './guestSession';

describe('RAIRA 2.2 Guest Session & Onboarding Logic', () => {
  it('creates a first-time guest session with local storage scope and future-ready sync field', () => {
    const fixedNow = '2026-11-20T12:00:00.000Z';
    const session = createDefaultGuestSession(fixedNow, 'guest-test-001');

    assert.equal(session.schemaVersion, 1);
    assert.equal(session.mode, 'guest');
    assert.equal(session.storageScope, 'local');
    assert.equal(session.guestId, 'guest-test-001');
    assert.equal(session.hasEnteredApp, false);
    assert.equal(session.tourCompleted, false);
    assert.equal(session.tourSkipped, false);
    assert.equal(session.syncProvider, null);
    assert.equal(shouldShowWelcomeOnLoad(session), true);
  });

  it('recovers gracefully from empty or malformed localStorage payloads', () => {
    const empty = parseGuestSession(null, '2026-11-20T12:00:00.000Z');
    assert.equal(empty.isFirstVisit, true);
    assert.equal(empty.session.hasEnteredApp, false);

    const corrupted = parseGuestSession('{not-valid-json', '2026-11-20T12:00:00.000Z');
    assert.equal(corrupted.isFirstVisit, true);
    assert.equal(corrupted.session.mode, 'guest');
  });

  it('transitions to returning guest after entering app and skips Welcome on subsequent loads', () => {
    const initial = createDefaultGuestSession('2026-11-20T12:00:00.000Z', 'guest-abc');
    const entered = markEnteredAsGuest(initial, '2026-11-20T12:05:00.000Z');

    assert.equal(entered.hasEnteredApp, true);
    assert.equal(shouldShowWelcomeOnLoad(entered), false);
    assert.equal(shouldShowWelcomeOnLoad(entered, '?welcome=1'), true);
    assert.equal(shouldShowWelcomeOnLoad(initial, '?autostart=1'), false);

    const roundTrip = parseGuestSession(serializeGuestSession(entered));
    assert.equal(roundTrip.isFirstVisit, false);
    assert.equal(roundTrip.session.guestId, 'guest-abc');
    assert.equal(roundTrip.session.hasEnteredApp, true);
  });

  it('tracks tour completion and skip transitions cleanly', () => {
    const initial = createDefaultGuestSession('2026-11-20T12:00:00.000Z', 'guest-tour');
    const skipped = markTourSkipped(initial, '2026-11-20T12:01:00.000Z');
    assert.equal(skipped.hasEnteredApp, true);
    assert.equal(skipped.tourSkipped, true);
    assert.equal(skipped.tourCompleted, false);

    const completed = markTourCompleted(skipped, '2026-11-20T12:02:00.000Z');
    assert.equal(completed.hasEnteredApp, true);
    assert.equal(completed.tourCompleted, true);
    assert.equal(completed.tourSkipped, false);
  });

  it('defines all 6 required guided onboarding tour steps in exact order', () => {
    assert.equal(ONBOARDING_STEPS.length, 6);
    assert.deepEqual(
      ONBOARDING_STEPS.map((s) => s.title),
      [
        'Welcome to RAIRA',
        'Understanding the simulation',
        'Exploring scheduling algorithms',
        'Understanding the RL Training Centre',
        'Discovering research laboratories',
        'Starting the first simulation',
      ]
    );
    ONBOARDING_STEPS.forEach((step, idx) => {
      assert.equal(step.stepNumber, idx + 1);
      assert.ok(step.highlights.length >= 2);
      assert.ok(step.targetPage.length > 0);
    });
  });
});
