import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { GOLD_ACCENT } from '../theme/programme';
import { ProgrammeHairline } from './ProgrammeHairline';
import { scale } from '../utils/responsive';
import {
  formatSectionActionAccessibilityLabel,
  formatSectionActionAccessibilityState,
  resolveSectionActionState,
  resolveSectionEyebrow,
} from '../lib/sectionHeaderModel';

export function ProgrammeSectionHeader({
  eyebrow,
  title,
  subtitle,
  icon,
  count,
  style,
  titleVariant = 'titleLg',
  titleUppercase = false,
  titleStyle,
  align = 'center',
  actionLabel,
  onAction,
  actionAccessibilityLabel,
  actionAccessibilityHint,
  actionIcon,
  actionIconSize = 13,
  actionIconColor,
  actionDisabled = false,
  actionHitSlop = { top: 10, bottom: 10, left: 10, right: 10 },
  actionStyle,
  actionTextStyle,
  renderAction,
  headerRight,
  showHairline = false,
  hairlineStyle,
  haptic = true,
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const isLeft = align === 'left';
  const textAlign = isLeft ? 'left' : 'center';

  const { fullEyebrowText } = resolveSectionEyebrow({ eyebrow, count });
  const actionState = resolveSectionActionState({
    actionLabel,
    onAction,
    actionDisabled,
  });

  const handleAction = useCallback(
    (event) => {
      if (actionState.isClickable) {
        if (haptic) {
          try {
            Haptics.selectionAsync();
          } catch {
            // Ignore if unsupported
          }
        }
        onAction?.(event);
      }
    },
    [actionState.isClickable, haptic, onAction],
  );

  const a11yLabel = formatSectionActionAccessibilityLabel({
    actionLabel: actionState.actionLabel,
    actionAccessibilityLabel,
    eyebrow,
    title,
    count,
  });

  const hasAction = actionState.hasAction || Boolean(renderAction || headerRight);

  return (
    <View
      style={[
        styles.root,
        isLeft && styles.rootLeft,
        hasAction && isLeft && styles.rootLeftWithAction,
        style,
      ]}
    >
      <View style={[styles.headerRow, hasAction && styles.headerRowWithAction]}>
        <View style={[styles.headerMainBlock, hasAction && styles.headerMainBlockWithAction]}>
          {fullEyebrowText ? (
            <Text
              style={[
                styles.eyebrow,
                styles.fullBleed,
                isLeft && styles.eyebrowLeft,
                { color: GOLD_ACCENT, textAlign, ...typography.labelSm },
              ]}
            >
              {fullEyebrowText}
            </Text>
          ) : null}
          <View style={[styles.titleRow, isLeft && styles.titleRowLeft]}>
            {icon ? (
              <Ionicons
                name={icon}
                size={18}
                color={GOLD_ACCENT}
                style={styles.headerIcon}
              />
            ) : null}
            <Text
              style={[
                styles.title,
                !hasAction && styles.fullBleed,
                isLeft && styles.titleLeft,
                titleUppercase && styles.titleUppercase,
                { color: colors.onSurface, textAlign, ...typography[titleVariant] },
                titleStyle,
              ]}
              accessibilityRole="header"
            >
              {title}
            </Text>
          </View>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                styles.fullBleed,
                isLeft && styles.subtitleLeft,
                { color: colors.onSurfaceVariant, textAlign, ...typography.labelSm },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {headerRight || (renderAction ? renderAction({ colors, typography, GOLD_ACCENT }) : null)}

        {!headerRight && !renderAction && actionState.hasAction ? (
          <TouchableOpacity
            onPress={handleAction}
            disabled={!actionState.isClickable}
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityHint={actionAccessibilityHint}
            accessibilityState={formatSectionActionAccessibilityState({
              disabled: actionDisabled,
            })}
            hitSlop={actionHitSlop}
            style={[
              styles.actionButton,
              actionStyle,
              actionDisabled && styles.actionDisabled,
            ]}
            activeOpacity={0.7}
          >
            {actionState.actionLabel ? (
              <Text
                style={[
                  typography.labelSm,
                  styles.actionText,
                  { color: GOLD_ACCENT },
                  actionTextStyle,
                ]}
              >
                {actionState.actionLabel}
              </Text>
            ) : null}
            {actionIcon ? (
              <Ionicons
                name={actionIcon}
                size={actionIconSize}
                color={actionIconColor || GOLD_ACCENT}
                style={styles.actionIcon}
              />
            ) : null}
          </TouchableOpacity>
        ) : null}
      </View>

      {showHairline ? (
        <ProgrammeHairline style={[styles.sectionHeaderHairline, hairlineStyle]} />
      ) : null}
    </View>
  );
}

/** Left-aligned eyebrow + hairline for detail section breaks (with optional count & action link). */
export function ProgrammeEyebrowLabel({
  eyebrow,
  count,
  actionLabel,
  onAction,
  actionAccessibilityLabel,
  actionAccessibilityHint,
  actionIcon,
  actionIconSize = 13,
  actionIconColor,
  actionDisabled = false,
  actionHitSlop = { top: 10, bottom: 10, left: 10, right: 10 },
  actionStyle,
  actionTextStyle,
  renderAction,
  showHairline = true,
  hairlineStyle,
  style,
  contentStyle,
  eyebrowStyle,
  haptic = true,
  children,
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const { fullEyebrowText } = resolveSectionEyebrow({ eyebrow, count });
  const actionState = resolveSectionActionState({
    actionLabel,
    onAction,
    actionDisabled,
  });

  const handleAction = useCallback(
    (event) => {
      if (actionState.isClickable) {
        if (haptic) {
          try {
            Haptics.selectionAsync();
          } catch {
            // Ignore if unsupported
          }
        }
        onAction?.(event);
      }
    },
    [actionState.isClickable, haptic, onAction],
  );

  const a11yLabel = formatSectionActionAccessibilityLabel({
    actionLabel: actionState.actionLabel,
    actionAccessibilityLabel,
    eyebrow,
    count,
  });

  const hasAction = actionState.hasAction || Boolean(renderAction);

  return (
    <View style={[styles.eyebrowLabelRoot, style]}>
      <View style={[styles.eyebrowRow, contentStyle]}>
        <Text
          style={[
            styles.eyebrowLabel,
            !hasAction && styles.fullBleed,
            { color: GOLD_ACCENT, ...typography.labelSm },
            eyebrowStyle,
          ]}
          numberOfLines={1}
        >
          {fullEyebrowText}
        </Text>

        {renderAction ? (
          renderAction({ colors, typography, GOLD_ACCENT })
        ) : actionState.hasAction ? (
          <TouchableOpacity
            onPress={handleAction}
            disabled={!actionState.isClickable}
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityHint={actionAccessibilityHint}
            accessibilityState={formatSectionActionAccessibilityState({
              disabled: actionDisabled,
            })}
            hitSlop={actionHitSlop}
            style={[
              styles.actionButton,
              actionStyle,
              actionDisabled && styles.actionDisabled,
            ]}
            activeOpacity={0.7}
          >
            {actionState.actionLabel ? (
              <Text
                style={[
                  typography.labelSm,
                  styles.actionText,
                  { color: GOLD_ACCENT },
                  actionTextStyle,
                ]}
              >
                {actionState.actionLabel}
              </Text>
            ) : null}
            {actionIcon ? (
              <Ionicons
                name={actionIcon}
                size={actionIconSize}
                color={actionIconColor || GOLD_ACCENT}
                style={styles.actionIcon}
              />
            ) : null}
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
      {showHairline ? (
        <ProgrammeHairline style={[styles.eyebrowLabelHairline, hairlineStyle]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Android + custom fonts (Inter/Manrope, PR #60) under-measure a <Text>'s
   * intrinsic width by a few px, so a content-sized label has its final glyph
   * clipped ("DISPLAY" -> "DISPLA"). The clip happens at the Text's own content
   * box, and RN sizes that box to exactly the (short) measured width — padding
   * is added *outside* it, which is why paddingEnd/paddingRight never helped.
   *
   * Stretching the label to its parent's width takes the broken measurement out
   * of the layout entirely; textAlign then positions the glyphs. Verified in a
   * release build on device.
   */
  fullBleed: {
    alignSelf: 'stretch',
  },
  root: {
    alignItems: 'center',
    marginBottom: scale(18),
  },
  rootLeft: {
    alignItems: 'flex-start',
    marginBottom: scale(16),
  },
  rootLeftWithAction: {
    alignItems: 'stretch',
  },
  headerRow: {
    width: '100%',
  },
  headerRowWithAction: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  headerMainBlock: {
    alignItems: 'center',
  },
  headerMainBlockWithAction: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  titleRowLeft: {
    justifyContent: 'flex-start',
  },
  headerIcon: {
    marginRight: 2,
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  eyebrowLeft: {
    marginBottom: 8,
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  titleLeft: {
    textAlign: 'left',
  },
  titleUppercase: {
    textTransform: 'uppercase',
  },
  subtitle: {
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  subtitleLeft: {
    textAlign: 'left',
  },
  eyebrowLabelRoot: {
    marginBottom: scale(16),
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(10),
  },
  eyebrowLabel: {
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 0,
    paddingEnd: scale(4),
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  eyebrowLabelHairline: {
    marginBottom: 0,
  },
  sectionHeaderHairline: {
    marginTop: scale(12),
    marginBottom: 0,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  actionText: {
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actionIcon: {
    marginLeft: 2,
  },
  actionDisabled: {
    opacity: 0.45,
  },
});
