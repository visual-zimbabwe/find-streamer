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

  return (
    <View style={[styles.root, isLeft && styles.rootLeft, style]}>
      {eyebrow ? (
        <Text
          style={[
            styles.eyebrow,
            isLeft && styles.eyebrowLeft,
            { color: GOLD_ACCENT, ...typography.labelSm },
          ]}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={[
          styles.title,
          isLeft && styles.titleLeft,
          titleUppercase && styles.titleUppercase,
          { color: colors.onSurface, ...typography[titleVariant] },
        ]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            isLeft && styles.subtitleLeft,
            { color: colors.onSurfaceVariant, ...typography.labelSm },
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
      <Text style={[styles.eyebrowLabel, { color: GOLD_ACCENT, ...typography.labelSm }]}>
        {eyebrow}
      </Text>
      <ProgrammeHairline style={[styles.eyebrowLabelHairline, hairlineStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
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
    textAlign: 'center',
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
    textAlign: 'center',
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
    textTransform: 'uppercase',
  },
  eyebrowLabelHairline: {
    marginBottom: 0,
  },
});
