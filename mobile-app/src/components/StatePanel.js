import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function StatePanel({ type, title, description }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;

  const getIcon = () => {
    switch(type) {
      case 'loading': return '📡';
      case 'empty': return '✨';
      case 'error': return '⚠️';
      case 'no-results': return '🔍';
      default: return '🎬';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={[styles.glow, { backgroundColor: colors.primary + '1A' }]} />
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant + '1A' }]}>
            <Text style={{ fontSize: 60 }}>{getIcon()}</Text>
          </View>
        </View>
        <Text style={[styles.title, { color: colors.onSurface, ...typography.headlineLg }]}>{title}</Text>
        {description && <Text style={[styles.message, { color: colors.onSurfaceVariant, ...typography.bodyLg }]}>{description}</Text>}
      </View>
    </View>
  );
}

export function LoadingSkeleton() {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={styles.container}>
      <Text style={{ color: colors.onSurfaceVariant }}>Loading cinematic content...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
    textAlign: 'center',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    // Note: React Native blur is hard without extra libs, using opacity for now
  },
  iconBox: {
    width: 128,
    height: 128,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  message: {
    textAlign: 'center',
    lineHeight: 26,
  },
});
