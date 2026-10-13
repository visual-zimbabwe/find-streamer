import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveGlassButtonDimensions,
  resolveGlassButtonColors,
  formatGlassButtonAccessibility,
  DEFAULT_GLASS_BUTTON_SIZE,
  GOLD_ACCENT,
} from '../src/lib/glassIconButtonModel.js';

test('resolveGlassButtonDimensions returns default 40dp dimensions with hitSlop', () => {
  const result = resolveGlassButtonDimensions();
  assert.equal(result.size, 40);
  assert.equal(result.borderRadius, 20);
  assert.equal(result.iconSize, 20);
  assert.deepEqual(result.hitSlop, { top: 2, bottom: 2, left: 2, right: 2 });
});

test('resolveGlassButtonDimensions supports size presets sm, md, and lg', () => {
  const sm = resolveGlassButtonDimensions('sm');
  assert.equal(sm.size, 32);
  assert.equal(sm.borderRadius, 16);
  assert.equal(sm.iconSize, 16);
  assert.deepEqual(sm.hitSlop, { top: 6, bottom: 6, left: 6, right: 6 });

  const md = resolveGlassButtonDimensions('md');
  assert.equal(md.size, 40);
  assert.equal(md.borderRadius, 20);
  assert.equal(md.iconSize, 20);

  const lg = resolveGlassButtonDimensions('lg');
  assert.equal(lg.size, 48);
  assert.equal(lg.borderRadius, 24);
  assert.equal(lg.iconSize, 24);
  assert.equal(lg.hitSlop, undefined);
});

test('resolveGlassButtonDimensions handles custom numeric sizes and icon overrides', () => {
  const custom = resolveGlassButtonDimensions(36, 18);
  assert.equal(custom.size, 36);
  assert.equal(custom.borderRadius, 18);
  assert.equal(custom.iconSize, 18);
  assert.deepEqual(custom.hitSlop, { top: 4, bottom: 4, left: 4, right: 4 });

  const big = resolveGlassButtonDimensions(56, 28);
  assert.equal(big.size, 56);
  assert.equal(big.borderRadius, 28);
  assert.equal(big.iconSize, 28);
  assert.equal(big.hitSlop, undefined);

  const fallback = resolveGlassButtonDimensions(-10);
  assert.equal(fallback.size, DEFAULT_GLASS_BUTTON_SIZE);
});

test('resolveGlassButtonColors resolves glass variant with translucent surface', () => {
  const colors = {
    surfaceContainerHighest: '#242426',
    onSurface: '#f5f5f7',
  };

  const res = resolveGlassButtonColors({ colors, variant: 'glass' });
  assert.equal(res.backgroundColor, '#242426E6');
  assert.equal(res.borderColor, 'rgba(255, 255, 255, 0.08)');
  assert.equal(res.iconColor, '#f5f5f7');
});

test('resolveGlassButtonColors supports surface and clear variants', () => {
  const colors = {
    surfaceContainerHighest: '#242426',
    onSurface: '#f5f5f7',
  };

  const surface = resolveGlassButtonColors({ colors, variant: 'surface' });
  assert.equal(surface.backgroundColor, '#242426');
  assert.equal(surface.borderColor, 'rgba(255, 255, 255, 0.08)');

  const clear = resolveGlassButtonColors({ colors, variant: 'clear' });
  assert.equal(clear.backgroundColor, 'transparent');
  assert.equal(clear.borderColor, 'transparent');
});

test('resolveGlassButtonColors handles active state and custom color overrides', () => {
  const colors = {
    surfaceContainerHighest: '#242426',
    onSurface: '#f5f5f7',
  };

  const active = resolveGlassButtonColors({ colors, active: true });
  assert.equal(active.iconColor, GOLD_ACCENT);

  const custom = resolveGlassButtonColors({
    colors,
    active: true,
    activeIconColor: '#FFCC00',
    backgroundColor: '#000000',
    borderColor: '#D4A853',
  });
  assert.equal(custom.iconColor, '#FFCC00');
  assert.equal(custom.backgroundColor, '#000000');
  assert.equal(custom.borderColor, '#D4A853');
});

test('formatGlassButtonAccessibility structures role and state flags', () => {
  const a11y = formatGlassButtonAccessibility({
    accessibilityLabel: 'Go back',
    active: false,
    disabled: true,
    loading: false,
  });

  assert.equal(a11y.accessibilityRole, 'button');
  assert.equal(a11y.accessibilityLabel, 'Go back');
  assert.deepEqual(a11y.accessibilityState, {
    disabled: true,
    selected: false,
    busy: false,
  });

  const loadingA11y = formatGlassButtonAccessibility({
    accessibilityLabel: 'Bookmark',
    active: true,
    disabled: false,
    loading: true,
  });
  assert.deepEqual(loadingA11y.accessibilityState, {
    disabled: true,
    selected: true,
    busy: true,
  });
});
