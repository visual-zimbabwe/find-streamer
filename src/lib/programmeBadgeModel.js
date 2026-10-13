/**
 * Pure domain model helpers for Badges and Chips (ProgrammeBadge).
 *
 * Decoupled from React Native runtime so this module can be tested in Node test runner.
 */

export const GOLD_ACCENT = '#D4A853';
export const GOLD_DIM = 'rgba(212, 168, 83, 0.48)';
export const HAIRLINE_WIDTH = 0.5;

export const BADGE_VARIANTS = ['glass', 'outline', 'gold', 'solid', 'surface'];
export const BADGE_SIZES = ['xs', 'sm', 'md', 'lg'];
export const BADGE_SHAPES = ['rounded', 'pill', 'circle', 'square'];

export const BADGE_SIZE_METRICS = {
  xs: {
    minHeight: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontSize: 10,
    iconSize: 10,
    gap: 3,
    minWidth: 18,
    letterSpacing: 0.5,
  },
  sm: {
    minHeight: 22,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    fontSize: 11,
    iconSize: 12,
    gap: 4,
    minWidth: 22,
    letterSpacing: 0.5,
  },
  md: {
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    iconSize: 14,
    gap: 6,
    minWidth: 28,
    letterSpacing: 0.3,
  },
  lg: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 6,
    fontSize: 13,
    iconSize: 16,
    gap: 8,
    minWidth: 36,
    letterSpacing: 0.5,
  },
};

/**
 * Resolves dimensional metrics (padding, minHeight, font size, icon size, radius)
 * for a badge based on size and shape specifications.
 */
export function resolveBadgeDimensions({
  size = 'sm',
  shape = 'rounded',
  width,
  height,
  borderRadius,
  radii = { sm: 4, md: 8, lg: 12, full: 9999 },
} = {}) {
  const normalizedSize = BADGE_SIZES.includes(size) ? size : 'sm';
  const normalizedShape = BADGE_SHAPES.includes(shape) ? shape : 'rounded';

  const metrics = BADGE_SIZE_METRICS[normalizedSize];
  const isFixedGeometry = normalizedShape === 'circle' || normalizedShape === 'square';
  const targetDimension = width || height || metrics.minHeight;

  let computedRadius;
  if (borderRadius != null) {
    computedRadius = borderRadius;
  } else if (normalizedShape === 'circle' || normalizedShape === 'pill') {
    computedRadius = radii?.full ?? 9999;
  } else {
    computedRadius = radii?.sm ?? 4;
  }

  return {
    size: normalizedSize,
    shape: normalizedShape,
    minHeight: isFixedGeometry ? targetDimension : (height || metrics.minHeight),
    height: isFixedGeometry ? targetDimension : height,
    width: isFixedGeometry ? targetDimension : width,
    minWidth: isFixedGeometry ? targetDimension : metrics.minWidth,
    paddingHorizontal: isFixedGeometry ? 0 : metrics.paddingHorizontal,
    paddingVertical: isFixedGeometry ? 0 : metrics.paddingVertical,
    borderRadius: computedRadius,
    fontSize: metrics.fontSize,
    iconSize: metrics.iconSize,
    gap: metrics.gap,
    letterSpacing: metrics.letterSpacing,
    isFixedGeometry,
  };
}

/**
 * Resolves color palette (background, border, text, and icon) for a badge
 * based on variant, custom overrides, and semantic state.
 */
export function resolveBadgeColors({
  variant = 'glass',
  color,
  textColor,
  borderColor,
  backgroundColor,
  borderWidth,
  isPending = false,
  active = false,
  selected = false,
  colors = {},
} = {}) {
  const normalizedVariant = BADGE_VARIANTS.includes(variant) ? variant : 'glass';

  // Base defaults per variant
  let bg = 'transparent';
  let border = 'transparent';
  let bWidth = 0;
  let text = '#FFFFFF';
  let icon = '#FFFFFF';

  switch (normalizedVariant) {
    case 'gold':
      bg = GOLD_ACCENT;
      border = 'transparent';
      bWidth = 0;
      text = '#141414';
      icon = '#141414';
      break;

    case 'outline':
      bg = 'transparent';
      border = color || GOLD_ACCENT;
      bWidth = 1;
      text = color || GOLD_ACCENT;
      icon = color || GOLD_ACCENT;
      break;

    case 'solid':
      bg = color || colors?.surfaceContainerHigh || '#26262b';
      border = 'transparent';
      bWidth = 0;
      text = colors?.onSurface || '#FFFFFF';
      icon = colors?.onSurface || '#FFFFFF';
      break;

    case 'surface':
      bg = colors?.surfaceContainer || 'rgba(255, 255, 255, 0.08)';
      border = colors?.outlineVariant ? `${colors.outlineVariant}33` : 'rgba(255, 255, 255, 0.12)';
      bWidth = HAIRLINE_WIDTH;
      text = colors?.onSurfaceVariant || '#E0E0E0';
      icon = colors?.onSurfaceVariant || '#E0E0E0';
      break;

    case 'glass':
    default:
      bg = 'rgba(0, 0, 0, 0.72)';
      border = 'rgba(255, 255, 255, 0.20)';
      bWidth = HAIRLINE_WIDTH;
      text = '#FFFFFF';
      icon = GOLD_ACCENT;
      break;
  }

  // Pending modification (e.g. unreleased items in ordered collections)
  if (isPending) {
    bg = 'rgba(0, 0, 0, 0.72)';
    border = 'rgba(255, 255, 255, 0.12)';
    bWidth = HAIRLINE_WIDTH;
    text = '#D6D6D0';
    icon = '#D6D6D0';
  }

  // Active / Selected state highlight
  if (active || selected) {
    if (normalizedVariant === 'outline') {
      bg = colors?.primary ? `${colors.primary}22` : 'rgba(212, 168, 83, 0.15)';
      border = color || colors?.primary || GOLD_ACCENT;
      text = color || colors?.primary || GOLD_ACCENT;
      icon = color || colors?.primary || GOLD_ACCENT;
    } else if (normalizedVariant === 'surface' || normalizedVariant === 'solid') {
      bg = colors?.primary ? `${colors.primary}22` : GOLD_ACCENT;
      border = colors?.primary ? `${colors.primary}66` : 'transparent';
      bWidth = border !== 'transparent' ? 1 : 0;
      text = colors?.primary || '#141414';
      icon = colors?.primary || '#141414';
    }
  }

  return {
    backgroundColor: backgroundColor || bg,
    borderColor: borderColor || border,
    borderWidth: borderWidth != null ? borderWidth : bWidth,
    textColor: textColor || text,
    iconColor: textColor || icon,
  };
}

/**
 * Normalizes interactive and semantic states.
 */
export function resolveBadgeState({
  disabled = false,
  isPending = false,
  active = false,
  selected = false,
  onPress,
} = {}) {
  const isInteractive = Boolean(onPress) && !disabled;
  return {
    isInteractive,
    isDisabled: Boolean(disabled),
    isPending: Boolean(isPending),
    isActive: Boolean(active),
    isSelected: Boolean(selected),
  };
}

/**
 * Formats accessibility announcements for screen readers.
 */
export function formatBadgeAccessibilityLabel({
  label,
  accessibilityLabel,
  context,
  isPending = false,
  selected = false,
} = {}) {
  if (accessibilityLabel) {
    return accessibilityLabel;
  }

  const baseLabel = label != null ? String(label).trim() : '';

  if (context === 'certification' || context === 'rated') {
    return `Rated ${baseLabel}`;
  }
  if (context === 'year') {
    return `Release year ${baseLabel}`;
  }
  if (context === 'rank') {
    return `Rank ${baseLabel}`;
  }
  if (context === 'order') {
    return isPending ? `Order ${baseLabel}, unreleased` : `Order ${baseLabel}`;
  }
  if (context === 'seasonLatest') {
    return 'Latest season';
  }

  let formatted = baseLabel;
  if (isPending) {
    formatted = `${formatted}, unreleased`;
  }
  if (selected) {
    formatted = `${formatted}, selected`;
  }

  return formatted || undefined;
}
