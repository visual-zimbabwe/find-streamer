import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { GOLD_ACCENT } from '../theme/programme';
import { ProgrammeHairline } from './ProgrammeHairline';
import { scale } from '../utils/responsive';

export function ProgrammeSectionHeader({
  eyebrow,
  title,
  subtitle,
  style,
  titleVariant = 'titleLg',
  titleUppercase = false,
  align = 'center',
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const isLeft = align === 'left';
  const textAlign = isLeft ? 'left' : 'center';

  return (
    <View style={[styles.root, isLeft && styles.rootLeft, style]}>
      {eyebrow ? (
        <Text
          style={[
            styles.eyebrow,
            styles.fullBleed,
            isLeft && styles.eyebrowLeft,
            { color: GOLD_ACCENT, textAlign, ...typography.labelSm },
          ]}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={[
          styles.title,
          styles.fullBleed,
          isLeft && styles.titleLeft,
          titleUppercase && styles.titleUppercase,
          { color: colors.onSurface, textAlign, ...typography[titleVariant] },
        ]}
        accessibilityRole="header"
      >
        {title}
      </Text>
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
  );
}

/** Left-aligned eyebrow + hairline for detail section breaks (no title). */
export function ProgrammeEyebrowLabel({ eyebrow, style, hairlineStyle }) {
  const { theme } = useTheme();
  const { typography } = theme;

  return (
    <View style={[styles.eyebrowLabelRoot, style]}>
      <Text
        style={[
          styles.eyebrowLabel,
          styles.fullBleed,
          { color: GOLD_ACCENT, ...typography.labelSm },
        ]}
      >
        {eyebrow}
      </Text>
      <ProgrammeHairline style={[styles.eyebrowLabelHairline, hairlineStyle]} />
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
  eyebrowLabel: {
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: scale(10),
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  eyebrowLabelHairline: {
    marginBottom: 0,
  },
});
