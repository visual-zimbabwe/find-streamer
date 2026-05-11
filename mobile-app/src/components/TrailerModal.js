import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Extracts the YouTube video ID from any standard YouTube URL.
 * Returns null if the URL is not a YouTube URL.
 */
function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * TrailerModal
 *
 * Props:
 *   visible    {boolean}  — controls visibility
 *   trailerUrl {string}   — YouTube watch URL
 *   title      {string}   — movie/show title (used in header)
 *   onClose    {function} — called when user dismisses the modal
 */
export function TrailerModal({ visible, trailerUrl, title, onClose }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const [webLoading, setWebLoading] = useState(true);

  const videoId = extractYouTubeId(trailerUrl);
  // Use the no-cookie embed URL + autoplay for a cleaner experience
  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`
    : null;

  const handleClose = useCallback(() => {
    setWebLoading(true); // reset for next open
    onClose?.();
  }, [onClose]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingTop: insets.top || 16, paddingBottom: insets.bottom }]}>
        {/* Header bar */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerLeft}>
            <Ionicons name="play-circle" size={22} color={colors.primary} />
            <Text
              style={[styles.headerTitle, { color: colors.onSurface, ...typography.bodyMd }]}
              numberOfLines={1}
            >
              {title || 'Trailer'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.full }]}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close trailer player"
          >
            <Ionicons name="close" size={20} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        {/* Player */}
        <View style={styles.playerWrapper}>
          {embedUrl ? (
            <>
              {webLoading && (
                <View style={[styles.loaderOverlay, { backgroundColor: colors.surface }]}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loaderText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
                    Loading trailer…
                  </Text>
                </View>
              )}
              <WebView
                style={styles.webview}
                source={{ uri: embedUrl }}
                allowsFullscreenVideo
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                onLoadEnd={() => setWebLoading(false)}
                onError={() => setWebLoading(false)}
              />
            </>
          ) : (
            <View style={[styles.errorBox, { backgroundColor: colors.surfaceContainer }]}>
              <Ionicons name="videocam-off-outline" size={40} color={colors.onSurfaceVariant} />
              <Text style={[styles.errorText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
                Trailer unavailable
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 12,
  },
  headerTitle: {
    fontWeight: '700',
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerWrapper: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 10,
  },
  loaderText: {
    fontWeight: '600',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  errorText: {
    fontWeight: '600',
  },
});
