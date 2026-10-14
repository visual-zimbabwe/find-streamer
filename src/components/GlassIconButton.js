import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import {
  formatGlassButtonAccessibility,
  resolveGlassButtonColors,
  resolveGlassButtonDimensions,
  GOLD_ACCENT,
} from '../lib/glassIconButtonModel';

/**
 * GlassIconButton
 *
 * A standardized floating translucent chrome button designed for top headers,
 * floating overlays, modals, and sheets.
 *
 * Defaults to 40dp diameter with subtle hairline border, shadow elevation,
 * accessible hitSlop padding when <44dp, and haptic response.
 *
 * @param {object} props
 * @param {string} [props.icon] - Ionicons glyph name (e.g. 'arrow-back', 'close', 'share-social-outline')
 * @param {number} [props.iconSize] - Optional override icon size
 * @param {string} [props.iconColor] - Optional override icon color
 * @param {number|'sm'|'md'|'lg'} [props.size='md'] - Diameter (32, 40, 48, or custom number)
 * @param {'glass'|'surface'|'clear'} [props.variant='glass'] - Background appearance
 * @param {boolean} [props.active=false] - Selected/bookmarked state (turns icon gold by default)
 * @param {string} [props.activeIconColor=GOLD_ACCENT] - Icon color when active
 * @param {string} [props.backgroundColor] - Custom background override
 * @param {string} [props.borderColor] - Custom border override
 * @param {number} [props.borderWidth] - Custom border width override
 * @param {boolean} [props.disabled=false] - Disables touch and applies opacity
 * @param {boolean} [props.loading=false] - Replaces icon with spinner and disables touch
 * @param {'selection'|'impactLight'|'impactMedium'|'none'} [props.haptic='selection'] - Haptic style
 * @param {boolean} [props.blur] - Enable expo-blur on iOS (defaults to true for 'glass' on iOS)
 * @param {number} [props.blurIntensity=70] - BlurView intensity
 * @param {object} [props.hitSlop] - Touch padding override
 * @param {number} [props.activeOpacity=0.75]
 * @param {Function} [props.onPress]
 * @param {Function} [props.onLongPress]
 * @param {string} [props.accessibilityLabel]
 * @param {string} [props.accessibilityHint]
 * @param {object} [props.accessibilityState]
 * @param {object} [props.style]
 * @param {React.ReactNode} [props.children] - Custom content (supersedes icon)
 */
export const GlassIconButton = React.forwardRef(function GlassIconButton(
  {
    icon,
    iconSize: customIconSize,
    iconColor: customIconColor,
    size = 'md',
    variant = 'glass',
    active = false,
    activeIconColor = GOLD_ACCENT,
    backgroundColor: customBg,
    borderColor: customBorderColor,
    borderWidth: customBorderWidth,
    disabled = false,
    loading = false,
    haptic = 'selection',
    blur,
    blurIntensity = 70,
    hitSlop: customHitSlop,
    activeOpacity = 0.75,
    onPress,
    onLongPress,
    accessibilityLabel,
    accessibilityHint,
    accessibilityState: customA11yState,
    style,
    children,
    ...restProps
  },
  ref,
) {
  const { theme } = useTheme();
  const colors = theme?.colors;

  const dimensions = useMemo(
    () => resolveGlassButtonDimensions(size, customIconSize),
    [size, customIconSize],
  );

  const resolvedColors = useMemo(
    () =>
      resolveGlassButtonColors({
        colors,
        variant,
        active,
        iconColor: customIconColor,
        activeIconColor,
        backgroundColor: customBg,
        borderColor: customBorderColor,
      }),
    [
      colors,
      variant,
      active,
      customIconColor,
      activeIconColor,
      customBg,
      customBorderColor,
    ],
  );

  const a11y = useMemo(() => {
    const formatted = formatGlassButtonAccessibility({
      accessibilityLabel:
        accessibilityLabel ||
        (icon ? `${icon.replace(/-/g, ' ')} button` : 'Button'),
      active,
      disabled,
      loading,
    });
    return {
      accessibilityRole: formatted.accessibilityRole,
      accessibilityLabel: formatted.accessibilityLabel,
      accessibilityState: {
        ...formatted.accessibilityState,
        ...customA11yState,
      },
    };
  }, [accessibilityLabel, icon, active, disabled, loading, customA11yState]);

  const shouldBlur =
    blur !== undefined
      ? blur
      : Platform.OS === 'ios' && variant === 'glass';

  const triggerHaptic = useCallback(async () => {
    if (haptic === 'none') return;
    try {
      if (haptic === 'impactLight') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (haptic === 'impactMedium') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        await Haptics.selectionAsync();
      }
    } catch {
      // Ignore haptic failures on unsupported hardware
    }
  }, [haptic]);

  const handlePress = useCallback(
    (event) => {
      if (disabled || loading) return;
      triggerHaptic();
      onPress?.(event);
    },
    [disabled, loading, triggerHaptic, onPress],
  );

  const handleLongPress = useCallback(
    (event) => {
      if (disabled || loading) return;
      triggerHaptic();
      onLongPress?.(event);
    },
    [disabled, loading, triggerHaptic, onLongPress],
  );

  const isClear = variant === 'clear';
  const resolvedBorderWidth =
    customBorderWidth != null
      ? customBorderWidth
      : isClear
        ? 0
        : 1;

  return (
    <TouchableOpacity
      ref={ref}
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={disabled || loading}
      activeOpacity={activeOpacity}
      hitSlop={customHitSlop || dimensions.hitSlop}
      style={[
        styles.base,
        isClear && styles.clearBase,
        {
          width: dimensions.size,
          height: dimensions.size,
          borderRadius: dimensions.borderRadius,
          backgroundColor: resolvedColors.backgroundColor,
          borderColor: resolvedColors.borderColor,
          borderWidth: resolvedBorderWidth,
        },
        (disabled || loading) && styles.disabled,
        style,
      ]}
      accessibilityRole={a11y.accessibilityRole}
      accessibilityLabel={a11y.accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={a11y.accessibilityState}
      {...restProps}
    >
      {shouldBlur ? (
        <BlurView
          intensity={blurIntensity}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}

      {loading ? (
        <ActivityIndicator size="small" color={resolvedColors.iconColor} />
      ) : children ? (
        children
      ) : icon ? (
        <Ionicons
          name={icon}
          size={dimensions.iconSize}
          color={resolvedColors.iconColor}
        />
      ) : null}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  clearBase: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    overflow: 'visible',
  },
  disabled: {
    opacity: 0.45,
  },
});

export default GlassIconButton;
