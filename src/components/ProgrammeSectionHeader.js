import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { GOLD_ACCENT } from '../theme/programme';
import { scale } from '../utils/responsive';

export function ProgrammeSectionHeader({
  eyebrow,
  title,
  subtitle,
  style,
  titleVariant = 'titleLg',
  titleUppercase = false,
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  return (
    <View style={[styles.root, style]}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={[
          styles.title,
          titleUppercase && styles.titleUppercase,
          { color: colors.onSurface, ...typography[titleVariant] },
        ]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[styles.subtitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    marginBottom: scale(18),
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
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
});
