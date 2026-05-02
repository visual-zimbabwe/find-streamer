import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

export function MediaArtwork({ uri, style, resizeMode = 'cover', icon = 'image-outline', accessibilityLabel }) {
  const { theme } = useTheme();
  const { colors } = theme;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={style}
        resizeMode={resizeMode}
        accessible={Boolean(accessibilityLabel)}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <View
      style={[style, styles.fallback, { backgroundColor: colors.surfaceContainerHighest }]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel || 'Artwork unavailable'}
    >
      <Ionicons name={icon} size={32} color={colors.onSurfaceVariant} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
