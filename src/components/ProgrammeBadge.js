import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { theme as defaultTheme } from '../theme/tokens';
import {
  formatBadgeAccessibilityLabel,
  resolveBadgeColors,
  resolveBadgeDimensions,
  resolveBadgeState,
} from '../lib/programmeBadgeModel';

function useSafeTheme() {
  try {
    const ctx = useTheme();
    return ctx?.theme || defaultTheme;
  } catch {
    return defaultTheme;
  }
}

/**
 * ProgrammeBadge
 *
 * Unified badge and chip component standardizing typography, padding, corner radii,
 * and presentation variants (glass, outline, gold, solid, surface) across posters,
 * certifications, order pills, status chips, and metadata indicators.
 */
export function ProgrammeBadge({
  // Content
  label,
  children,
  icon,
  iconSize: propIconSize,
  iconColor: propIconColor,
  iconPosition = 'leading', // 'leading' | 'trailing'
  numberOfLines = 1,

  // Geometry & Variant
  variant = 'glass', // 'glass' | 'outline' | 'gold' | 'solid' | 'surface'
  size = 'sm', // 'xs' | 'sm' | 'md' | 'lg'
  shape = 'rounded', // 'rounded' | 'pill' | 'circle' | 'square'
  width,
  height,
  minWidth: propMinWidth,
  borderRadius: propBorderRadius,

  // Color & Token Overrides
  color,
  textColor: propTextColor,
  borderColor: propBorderColor,
  backgroundColor: propBackgroundColor,
  borderWidth: propBorderWidth,

  // State
  isPending = false,
  active = false,
  selected = false,
  disabled = false,

  // Interaction
  onPress,
  onLongPress,
  activeOpacity = 0.75,
  haptic = true,
  hitSlop,

  // Context & Accessibility
  context, // 'certification' | 'year' | 'rank' | 'order' | 'seasonLatest' | etc.
  accessibilityLabel: propAccessibilityLabel,
  accessibilityHint,
  accessibilityRole: propAccessibilityRole,
  accessibilityState: propAccessibilityState,
  importantForAccessibility,

  // Styles
  style,
  contentContainerStyle,
  textStyle,
  iconStyle,
  pointerEvents,
}) {
  const safeTheme = useSafeTheme();
  const { colors, radii, typography } = safeTheme;

  const dimensions = resolveBadgeDimensions({
    size,
    shape,
    width,
    height,
    borderRadius: propBorderRadius,
    radii,
  });

  const palette = resolveBadgeColors({
    variant,
    color,
    textColor: propTextColor,
    borderColor: propBorderColor,
    backgroundColor: propBackgroundColor,
    borderWidth: propBorderWidth,
    isPending,
    active,
    selected,
    colors,
  });

  const state = resolveBadgeState({
    disabled,
    isPending,
    active,
    selected,
    onPress,
  });

  const handlePress = useCallback(
    (event) => {
      if (!state.isInteractive) return;
      if (haptic) {
        try {
          Haptics.selectionAsync();
        } catch {
          // Ignore if unsupported
        }
      }
      onPress?.(event);
    },
    [state.isInteractive, haptic, onPress],
  );

  const displayLabel = label != null ? String(label) : null;
  const hasLabel = displayLabel != null && displayLabel.length > 0;
  const hasChildren = children != null;
  const hasIcon = Boolean(icon);

  const resolvedA11yLabel = formatBadgeAccessibilityLabel({
    label: displayLabel,
    accessibilityLabel: propAccessibilityLabel,
    context,
    isPending,
    selected,
  });

  const defaultRole = state.isInteractive ? 'button' : 'text';
  const role = propAccessibilityRole || defaultRole;

  const resolvedIconSize = propIconSize ?? dimensions.iconSize;
  const resolvedIconColor = propIconColor ?? palette.iconColor;

  const renderIcon = () => {
    if (!hasIcon) return null;
    if (typeof icon === 'string') {
      return (
        <Ionicons
          name={icon}
          size={resolvedIconSize}
          color={resolvedIconColor}
          style={[styles.icon, iconStyle]}
        />
      );
    }
    return icon;
  };

  const containerStyles = [
    styles.base,
    {
      minHeight: dimensions.minHeight,
      minWidth: propMinWidth ?? dimensions.minWidth,
      paddingHorizontal: dimensions.paddingHorizontal,
      paddingVertical: dimensions.paddingVertical,
      borderRadius: dimensions.borderRadius,
      backgroundColor: palette.backgroundColor,
      borderColor: palette.borderColor,
      borderWidth: palette.borderWidth,
      gap: hasIcon && (hasLabel || hasChildren) ? dimensions.gap : 0,
    },
    dimensions.height != null && { height: dimensions.height },
    dimensions.width != null && { width: dimensions.width },
    state.isDisabled && styles.disabled,
    style,
  ];

  const content = (
    <View
      style={[
        styles.innerRow,
        dimensions.isFixedGeometry && styles.centeredContent,
        contentContainerStyle,
      ]}
    >
      {iconPosition === 'leading' ? renderIcon() : null}

      {hasChildren ? (
        children
      ) : hasLabel ? (
        <Text
          numberOfLines={numberOfLines}
          style={[
            typography?.labelSm,
            styles.text,
            {
              fontSize: dimensions.fontSize,
              color: palette.textColor,
              letterSpacing: dimensions.letterSpacing,
              fontWeight: variant === 'gold' || size === 'xs' ? '800' : '700',
            },
            textStyle,
          ]}
        >
          {displayLabel}
        </Text>
      ) : null}

      {iconPosition === 'trailing' ? renderIcon() : null}
    </View>
  );

  if (state.isInteractive) {
    return (
      <TouchableOpacity
        style={containerStyles}
        onPress={handlePress}
        onLongPress={onLongPress}
        activeOpacity={activeOpacity}
        disabled={state.isDisabled}
        hitSlop={hitSlop}
        pointerEvents={pointerEvents}
        accessibilityRole={role}
        accessibilityLabel={resolvedA11yLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{
          disabled: state.isDisabled,
          selected: state.isSelected,
          ...propAccessibilityState,
        }}
        importantForAccessibility={importantForAccessibility}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={containerStyles}
      pointerEvents={pointerEvents}
      accessible={Boolean(resolvedA11yLabel)}
      accessibilityRole={role}
      accessibilityLabel={resolvedA11yLabel}
      importantForAccessibility={importantForAccessibility}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    textAlign: 'center',
    includeFontPadding: false,
  },
  icon: {
    alignSelf: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
});
