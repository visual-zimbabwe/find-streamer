export const GOLD_ACCENT = '#D4A853';

export const GLASS_BUTTON_SIZES = {
  sm: 32,
  md: 40,
  lg: 48,
};

export const DEFAULT_GLASS_BUTTON_SIZE = GLASS_BUTTON_SIZES.md;
export const MIN_TOUCH_TARGET = 44;

/**
 * Resolves width, height, border radius, icon size, and hit slop for a given size.
 * @param {number|'sm'|'md'|'lg'} [size]
 * @param {number} [overrideIconSize]
 * @returns {{ size: number, borderRadius: number, iconSize: number, hitSlop?: { top: number, bottom: number, left: number, right: number } }}
 */
export function resolveGlassButtonDimensions(size, overrideIconSize) {
  let resolvedSize = DEFAULT_GLASS_BUTTON_SIZE;
  if (typeof size === 'string' && GLASS_BUTTON_SIZES[size]) {
    resolvedSize = GLASS_BUTTON_SIZES[size];
  } else if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
    resolvedSize = Math.round(size);
  }

  const borderRadius = Math.round(resolvedSize / 2);

  let defaultIconSize = 20;
  if (resolvedSize <= 32) {
    defaultIconSize = 16;
  } else if (resolvedSize >= 48) {
    defaultIconSize = 24;
  } else if (resolvedSize >= 40) {
    defaultIconSize = 20;
  } else {
    defaultIconSize = Math.max(14, Math.round(resolvedSize * 0.5));
  }

  const iconSize =
    typeof overrideIconSize === 'number' && overrideIconSize > 0
      ? overrideIconSize
      : defaultIconSize;

  let hitSlop;
  if (resolvedSize < MIN_TOUCH_TARGET) {
    const pad = Math.ceil((MIN_TOUCH_TARGET - resolvedSize) / 2);
    hitSlop = { top: pad, bottom: pad, left: pad, right: pad };
  }

  return {
    size: resolvedSize,
    borderRadius,
    iconSize,
    hitSlop,
  };
}

/**
 * Resolves color styling for glass icon button.
 * @param {object} [options]
 * @returns {{ backgroundColor: string, borderColor: string, iconColor: string }}
 */
export function resolveGlassButtonColors({
  colors,
  variant = 'glass',
  active = false,
  iconColor,
  activeIconColor = GOLD_ACCENT,
  backgroundColor,
  borderColor,
} = {}) {
  const fallbackSurfaceHighest = colors?.surfaceContainerHighest || '#1e1e20';
  const fallbackOnSurface = colors?.onSurface || '#f5f5f7';

  let resolvedBg;
  let resolvedBorder;

  if (backgroundColor) {
    resolvedBg = backgroundColor;
  } else if (variant === 'clear') {
    resolvedBg = 'transparent';
  } else if (variant === 'surface') {
    resolvedBg = fallbackSurfaceHighest;
  } else {
    // 'glass' variant: translucent surface overlay
    resolvedBg = fallbackSurfaceHighest.startsWith('#')
      ? fallbackSurfaceHighest + 'E6'
      : fallbackSurfaceHighest;
  }

  if (borderColor) {
    resolvedBorder = borderColor;
  } else if (variant === 'clear') {
    resolvedBorder = 'transparent';
  } else {
    resolvedBorder = 'rgba(255, 255, 255, 0.08)';
  }

  let resolvedIconColor;
  if (iconColor) {
    resolvedIconColor = iconColor;
  } else if (active) {
    resolvedIconColor = activeIconColor;
  } else {
    resolvedIconColor = fallbackOnSurface;
  }

  return {
    backgroundColor: resolvedBg,
    borderColor: resolvedBorder,
    iconColor: resolvedIconColor,
  };
}

/**
 * Formats accessibility role, label, and state.
 * @param {object} [options]
 * @returns {{ accessibilityRole: 'button', accessibilityLabel: string, accessibilityState: { disabled: boolean, selected: boolean, busy: boolean } }}
 */
export function formatGlassButtonAccessibility({
  accessibilityLabel,
  active = false,
  disabled = false,
  loading = false,
  fallbackLabel = 'Button',
} = {}) {
  const label = (accessibilityLabel || fallbackLabel || '').trim();

  return {
    accessibilityRole: 'button',
    accessibilityLabel: label,
    accessibilityState: {
      disabled: Boolean(disabled || loading),
      selected: Boolean(active),
      busy: Boolean(loading),
    },
  };
}
