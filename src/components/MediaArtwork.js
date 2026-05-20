import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';

export function MediaArtwork({
  uri,
  style,
  resizeMode = 'cover',
  icon = 'image-outline',
  accessibilityLabel,
  title,
  compactFallback = false,
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const [failedUri, setFailedUri] = useState(null);
  const shouldLoadImage = Boolean(uri) && failedUri !== uri;

  useEffect(() => {
    if (uri && failedUri !== uri) return;
    if (!uri) setFailedUri(null);
  }, [uri, failedUri]);

  if (shouldLoadImage) {
    return (
      <Image
        source={{ uri }}
        style={style}
        resizeMode={resizeMode}
        onError={() => setFailedUri(uri)}
        accessible={Boolean(accessibilityLabel)}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  const fallbackTitle = title || accessibilityLabel?.replace(/\s+(poster|artwork|profile photo)$/i, '') || 'Find Streamer';

  return (
    <View
      style={[style, styles.fallback, { backgroundColor: colors.surfaceContainerHighest }]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel || 'Artwork unavailable'}
    >
      <LinearGradient
        colors={[colors.surfaceContainerHighest, colors.surfaceContainerHigh, colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[compactFallback ? styles.compactMark : styles.mark, { borderColor: colors.primary + '66', backgroundColor: colors.primary + '18' }]}>
        <Ionicons name={icon} size={compactFallback ? 18 : 28} color={colors.primary} />
      </View>
      {!compactFallback && (
        <Text
          style={[styles.title, { color: colors.onSurface, ...typography.labelSm }]}
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {fallbackTitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 12,
  },
  mark: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    marginBottom: 12,
    width: 56,
  },
  compactMark: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  title: {
    fontWeight: '900',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
});
