import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

/** Android WebView default UA contains "; wv)" — YouTube often blocks embedded playback for that client. */
const YOUTUBE_WEBVIEW_USER_AGENT_ANDROID =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.4472.114 Mobile Safari/537.36';

/**
 * Extracts the YouTube video ID from any standard YouTube URL.
 * Returns null if the URL is not a YouTube URL.
 */
function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Direct embed URL (loaded as the WebView document URL).
 * Do not add `origin=` here: it must match the real document origin; a mismatch triggers YouTube 152/153 in WebViews.
 */
function buildYouTubeEmbedUri(videoId) {
  const q = new URLSearchParams({
    autoplay: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
  });
  return `https://www.youtube.com/embed/${videoId}?${q.toString()}`;
}

/** YouTube expects a valid https Referer for embed config (see react-native-webview#3889). */
function getYouTubeEmbedReferer() {
  const cfg = Constants.expoConfig;
  const host = cfg?.android?.package ?? cfg?.ios?.bundleIdentifier;
  if (host) return `https://${host}`;
  return 'https://kkadogo.findstreamer.com';
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
  const youtubeUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : trailerUrl;
  const embedUri = videoId ? buildYouTubeEmbedUri(videoId) : null;
  const embedReferer = useMemo(() => getYouTubeEmbedReferer(), []);

  const handleClose = useCallback(() => {
    setWebLoading(true); // reset for next open
    onClose?.();
  }, [onClose]);

  const handleOpenYouTube = useCallback(() => {
    if (youtubeUrl) Linking.openURL(youtubeUrl);
  }, [youtubeUrl]);

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
          {embedUri ? (
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
                source={{
                  uri: embedUri,
                  headers: { Referer: embedReferer },
                }}
                userAgent={Platform.OS === 'android' ? YOUTUBE_WEBVIEW_USER_AGENT_ANDROID : undefined}
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                domStorageEnabled
                thirdPartyCookiesEnabled
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                javaScriptCanOpenWindowsAutomatically
                onLoadEnd={() => setWebLoading(false)}
                onError={() => setWebLoading(false)}
              />
              <TouchableOpacity
                style={[styles.youtubeBtn, { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.full }]}
                onPress={handleOpenYouTube}
                accessibilityRole="button"
                accessibilityLabel="Watch trailer on YouTube"
              >
                <Ionicons name="logo-youtube" size={18} color={colors.primary} />
                <Text style={[styles.youtubeBtnText, { color: colors.onSurface, ...typography.labelSm }]}>
                  YouTube
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={[styles.errorBox, { backgroundColor: colors.surfaceContainer }]}>
              <Ionicons name="videocam-off-outline" size={40} color={colors.onSurfaceVariant} />
              <Text style={[styles.errorText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
                Trailer unavailable
              </Text>
              {youtubeUrl ? (
                <TouchableOpacity
                  style={[styles.errorAction, { backgroundColor: colors.primary, borderRadius: radii.full }]}
                  onPress={handleOpenYouTube}
                  accessibilityRole="button"
                  accessibilityLabel="Watch trailer on YouTube"
                >
                  <Ionicons name="logo-youtube" size={18} color={colors.onPrimary} />
                  <Text style={[styles.errorActionText, { color: colors.onPrimary, ...typography.labelMd }]}>
                    Watch on YouTube
                  </Text>
                </TouchableOpacity>
              ) : null}
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
  youtubeBtn: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 38,
  },
  youtubeBtnText: {
    fontWeight: '700',
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
  errorAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 42,
    marginTop: 4,
  },
  errorActionText: {
    fontWeight: '700',
  },
});
