import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
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
  instant = false,
  /**
   * Artwork to hold the frame while `uri` loads — normally a URL the app has
   * already decoded elsewhere. The detail hero prefers a clean textless still
   * chosen from `images.backdrops`, which is by definition a cache miss, so
   * without this the hero sat black for a measured 800ms after the rest of the
   * page had painted while the poster from the tapped row went unused.
   */
  placeholder = null,
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const [failedUri, setFailedUri] = useState(null);
  const shouldLoadImage = Boolean(uri) && failedUri !== uri;

  useEffect(() => {
    if (!uri) {
      setFailedUri(null);
      return;
    }
    // If the URI changes, reset failure state to attempt loading the new image
    if (uri !== failedUri) {
      setFailedUri(null);
    }
  }, [uri]);

  useEffect(() => {
    if (failedUri) {
      // Retry loading the image after a 7-second delay to handle transient network hiccups
      const timer = setTimeout(() => {
        setFailedUri(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [failedUri]);

  if (shouldLoadImage) {
    return (
      <Image
        source={{ uri }}
        style={style}
        contentFit={
          resizeMode === 'stretch' ? 'fill' : resizeMode === 'center' ? 'none' : resizeMode
        }
        placeholder={placeholder && placeholder !== uri ? { uri: placeholder } : undefined}
        placeholderContentFit={
          resizeMode === 'stretch' ? 'fill' : resizeMode === 'center' ? 'none' : resizeMode
        }
        transition={instant ? 0 : 250}
        cachePolicy="memory-disk"
        recyclingKey={uri}
        onError={() => setFailedUri(uri)}
        accessible={Boolean(accessibilityLabel)}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  const fallbackTitle =
    title ||
    accessibilityLabel?.replace(/\s+(poster|artwork|profile photo)$/i, '') ||
    'Find Streamer';

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
      <View
        style={[
          compactFallback ? styles.compactMark : styles.mark,
          { borderColor: colors.primary + '66', backgroundColor: colors.primary + '18' },
        ]}
      >
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
