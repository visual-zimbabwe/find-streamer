import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSectionEyebrow,
  resolveSectionActionState,
  formatSectionActionAccessibilityLabel,
  formatSectionActionAccessibilityState,
  GOLD_ACCENT,
  GOLD_DIM,
} from '../src/lib/sectionHeaderModel.js';

test('resolveSectionEyebrow handles empty and missing inputs', () => {
  const result = resolveSectionEyebrow();
  assert.equal(result.displayEyebrow, '');
  assert.equal(result.countText, null);
  assert.equal(result.fullEyebrowText, '');
});

test('resolveSectionEyebrow formats eyebrow with count number', () => {
  const result = resolveSectionEyebrow({ eyebrow: 'Cast', count: 24 });
  assert.equal(result.displayEyebrow, 'Cast');
  assert.equal(result.countText, '24');
  assert.equal(result.fullEyebrowText, 'Cast · 24');
});

test('resolveSectionEyebrow formats eyebrow without count', () => {
  const result = resolveSectionEyebrow({ eyebrow: 'SYNOPSIS' });
  assert.equal(result.displayEyebrow, 'SYNOPSIS');
  assert.equal(result.countText, null);
  assert.equal(result.fullEyebrowText, 'SYNOPSIS');
});

test('resolveSectionEyebrow formats count without eyebrow', () => {
  const result = resolveSectionEyebrow({ count: 10 });
  assert.equal(result.displayEyebrow, '');
  assert.equal(result.countText, '10');
  assert.equal(result.fullEyebrowText, '10');
});

test('resolveSectionActionState detects action presence and clickability', () => {
  const noAction = resolveSectionActionState();
  assert.equal(noAction.hasAction, false);
  assert.equal(noAction.isClickable, false);
  assert.equal(noAction.actionLabel, '');

  const labelOnly = resolveSectionActionState({ actionLabel: 'See All' });
  assert.equal(labelOnly.hasAction, true);
  assert.equal(labelOnly.isClickable, false);
  assert.equal(labelOnly.actionLabel, 'See All');

  const fnOnly = resolveSectionActionState({ onAction: () => {} });
  assert.equal(fnOnly.hasAction, true);
  assert.equal(fnOnly.isClickable, true);

  const fullAction = resolveSectionActionState({
    actionLabel: 'See All',
    onAction: () => {},
  });
  assert.equal(fullAction.hasAction, true);
  assert.equal(fullAction.isClickable, true);
  assert.equal(fullAction.actionLabel, 'See All');

  const disabledAction = resolveSectionActionState({
    actionLabel: 'See All',
    onAction: () => {},
    actionDisabled: true,
  });
  assert.equal(disabledAction.hasAction, true);
  assert.equal(disabledAction.isClickable, false);
});

test('formatSectionActionAccessibilityLabel generates informative speech announcements', () => {
  const customOverride = formatSectionActionAccessibilityLabel({
    actionAccessibilityLabel: 'Custom accessibility announcement',
  });
  assert.equal(customOverride, 'Custom accessibility announcement');

  const defaultAction = formatSectionActionAccessibilityLabel({
    actionLabel: 'See All',
    eyebrow: 'Cast',
    count: 24,
  });
  assert.equal(defaultAction, 'See All for Cast (24)');

  const labelContainsSubject = formatSectionActionAccessibilityLabel({
    actionLabel: 'See all cast',
    eyebrow: 'Cast',
  });
  assert.equal(labelContainsSubject, 'See all cast');

  const noSubject = formatSectionActionAccessibilityLabel({
    actionLabel: 'View details',
  });
  assert.equal(noSubject, 'View details');
});

test('formatSectionActionAccessibilityState handles disabled and busy flags', () => {
  assert.deepEqual(formatSectionActionAccessibilityState(), {});
  assert.deepEqual(formatSectionActionAccessibilityState({ disabled: true }), {
    disabled: true,
  });
  assert.deepEqual(formatSectionActionAccessibilityState({ busy: true }), {
    busy: true,
  });
  assert.deepEqual(
    formatSectionActionAccessibilityState({ disabled: true, busy: true }),
    { disabled: true, busy: true },
  );
});

test('sectionHeaderModel exports design tokens', () => {
  assert.equal(GOLD_ACCENT, '#D4A853');
  assert.equal(GOLD_DIM, 'rgba(212,168,83,0.35)');
});
