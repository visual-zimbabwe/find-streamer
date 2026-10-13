import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BADGE_SHAPES,
  BADGE_SIZES,
  BADGE_VARIANTS,
  formatBadgeAccessibilityLabel,
  resolveBadgeColors,
  resolveBadgeDimensions,
  resolveBadgeState,
  GOLD_ACCENT,
} from '../src/lib/programmeBadgeModel.js';

test('constants expose all expected variants, sizes, and shapes', () => {
  assert.deepEqual(BADGE_VARIANTS, ['glass', 'outline', 'gold', 'solid', 'surface']);
  assert.deepEqual(BADGE_SIZES, ['xs', 'sm', 'md', 'lg']);
  assert.deepEqual(BADGE_SHAPES, ['rounded', 'pill', 'circle', 'square']);
});

test('resolveBadgeDimensions resolves default sm rounded dimensions', () => {
  const dimensions = resolveBadgeDimensions();
  assert.equal(dimensions.size, 'sm');
  assert.equal(dimensions.shape, 'rounded');
  assert.ok(dimensions.minHeight > 0);
  assert.ok(dimensions.paddingHorizontal > 0);
  assert.equal(dimensions.isFixedGeometry, false);
  assert.equal(dimensions.borderRadius, 4);
});

test('resolveBadgeDimensions resolves xs size with proportional micro scale', () => {
  const xs = resolveBadgeDimensions({ size: 'xs' });
  const sm = resolveBadgeDimensions({ size: 'sm' });
  assert.ok(xs.minHeight < sm.minHeight);
  assert.ok(xs.fontSize <= sm.fontSize);
  assert.ok(xs.paddingHorizontal < sm.paddingHorizontal);
});

test('resolveBadgeDimensions resolves md and lg larger dimensions', () => {
  const md = resolveBadgeDimensions({ size: 'md' });
  const lg = resolveBadgeDimensions({ size: 'lg' });
  assert.ok(lg.minHeight > md.minHeight);
  assert.ok(lg.paddingHorizontal > md.paddingHorizontal);
});

test('resolveBadgeDimensions resolves pill shape with full radius', () => {
  const pill = resolveBadgeDimensions({ shape: 'pill', radii: { full: 9999 } });
  assert.equal(pill.borderRadius, 9999);
  assert.equal(pill.isFixedGeometry, false);
});

test('resolveBadgeDimensions resolves circle and square fixed geometry', () => {
  const circle = resolveBadgeDimensions({ shape: 'circle', size: 'sm' });
  assert.equal(circle.isFixedGeometry, true);
  assert.equal(circle.width, circle.height);
  assert.equal(circle.paddingHorizontal, 0);
  assert.equal(circle.paddingVertical, 0);
  assert.equal(circle.borderRadius, 9999);

  const square = resolveBadgeDimensions({ shape: 'square', size: 'xs', radii: { sm: 4 } });
  assert.equal(square.isFixedGeometry, true);
  assert.equal(square.width, square.height);
  assert.equal(square.paddingHorizontal, 0);
  assert.equal(square.borderRadius, 4);
});

test('resolveBadgeDimensions respects explicit borderRadius, width, and height overrides', () => {
  const custom = resolveBadgeDimensions({
    borderRadius: 14,
    width: 30,
    height: 30,
  });
  assert.equal(custom.borderRadius, 14);
  assert.equal(custom.width, 30);
  assert.equal(custom.height, 30);
});

test('resolveBadgeColors resolves glass variant defaults', () => {
  const colors = resolveBadgeColors({ variant: 'glass' });
  assert.ok(colors.backgroundColor.includes('rgba(0, 0, 0'));
  assert.equal(colors.textColor, '#FFFFFF');
  assert.equal(colors.iconColor, GOLD_ACCENT);
  assert.ok(colors.borderWidth > 0);
});

test('resolveBadgeColors resolves gold variant with dark text', () => {
  const colors = resolveBadgeColors({ variant: 'gold' });
  assert.equal(colors.backgroundColor, GOLD_ACCENT);
  assert.equal(colors.textColor, '#141414');
  assert.equal(colors.iconColor, '#141414');
});

test('resolveBadgeColors resolves outline variant with accent border and transparent background', () => {
  const colors = resolveBadgeColors({ variant: 'outline', color: '#FF5500' });
  assert.equal(colors.backgroundColor, 'transparent');
  assert.equal(colors.borderColor, '#FF5500');
  assert.equal(colors.textColor, '#FF5500');
  assert.equal(colors.borderWidth, 1);
});

test('resolveBadgeColors resolves solid and surface variants', () => {
  const solid = resolveBadgeColors({
    variant: 'solid',
    colors: { surfaceContainerHigh: '#333333', onSurface: '#EEEEEE' },
  });
  assert.equal(solid.backgroundColor, '#333333');
  assert.equal(solid.textColor, '#EEEEEE');

  const surface = resolveBadgeColors({
    variant: 'surface',
    colors: { surfaceContainer: '#222222', onSurfaceVariant: '#AAAAAA' },
  });
  assert.equal(surface.backgroundColor, '#222222');
  assert.equal(surface.textColor, '#AAAAAA');
});

test('resolveBadgeColors handles isPending state with dimmer presentation', () => {
  const pending = resolveBadgeColors({ variant: 'gold', isPending: true });
  assert.ok(pending.backgroundColor.includes('rgba(0, 0, 0'));
  assert.equal(pending.textColor, '#D6D6D0');
});

test('resolveBadgeColors handles active and selected states', () => {
  const activeOutline = resolveBadgeColors({
    variant: 'outline',
    active: true,
    colors: { primary: '#6200EE' },
  });
  assert.equal(activeOutline.borderColor, '#6200EE');
  assert.ok(activeOutline.backgroundColor.includes('22'));

  const selectedSurface = resolveBadgeColors({
    variant: 'surface',
    selected: true,
    colors: { primary: '#6200EE' },
  });
  assert.equal(selectedSurface.textColor, '#6200EE');
});

test('resolveBadgeColors respects explicit color overrides', () => {
  const custom = resolveBadgeColors({
    backgroundColor: '#123456',
    borderColor: '#654321',
    borderWidth: 2,
    textColor: '#AABBCC',
  });
  assert.equal(custom.backgroundColor, '#123456');
  assert.equal(custom.borderColor, '#654321');
  assert.equal(custom.borderWidth, 2);
  assert.equal(custom.textColor, '#AABBCC');
});

test('resolveBadgeState identifies interactive badge when onPress is provided', () => {
  const fn = () => {};
  assert.deepEqual(resolveBadgeState({ onPress: fn }), {
    isInteractive: true,
    isDisabled: false,
    isPending: false,
    isActive: false,
    isSelected: false,
  });
});

test('resolveBadgeState disables interaction when disabled is true', () => {
  const fn = () => {};
  assert.deepEqual(resolveBadgeState({ onPress: fn, disabled: true }), {
    isInteractive: false,
    isDisabled: true,
    isPending: false,
    isActive: false,
    isSelected: false,
  });
});

test('formatBadgeAccessibilityLabel prioritizes explicit accessibilityLabel', () => {
  assert.equal(
    formatBadgeAccessibilityLabel({
      label: '1',
      accessibilityLabel: 'Custom Announcement',
    }),
    'Custom Announcement',
  );
});

test('formatBadgeAccessibilityLabel formats certification, rank, year, and order contexts', () => {
  assert.equal(
    formatBadgeAccessibilityLabel({
      label: 'PG-13',
      context: 'certification',
    }),
    'Rated PG-13',
  );

  assert.equal(
    formatBadgeAccessibilityLabel({
      label: 1,
      context: 'rank',
    }),
    'Rank 1',
  );

  assert.equal(
    formatBadgeAccessibilityLabel({
      label: 2024,
      context: 'year',
    }),
    'Release year 2024',
  );

  assert.equal(
    formatBadgeAccessibilityLabel({
      label: 3,
      context: 'order',
    }),
    'Order 3',
  );

  assert.equal(
    formatBadgeAccessibilityLabel({
      label: 4,
      context: 'order',
      isPending: true,
    }),
    'Order 4, unreleased',
  );

  assert.equal(
    formatBadgeAccessibilityLabel({
      context: 'seasonLatest',
    }),
    'Latest season',
  );

  assert.equal(
    formatBadgeAccessibilityLabel({
      label: 'Action',
      selected: true,
    }),
    'Action, selected',
  );
});
