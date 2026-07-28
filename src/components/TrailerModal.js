import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

/** Android WebView default UA contains "; wv)" — YouTube often blocks embedded playback for that client. */
const YOUTUBE_WEBVIEW_USER_AGENT_ANDROID =
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.4472.114 Mobile Safari/537.36';

/**
 * The player owns its own surface, pinned darker than the app's chrome so the
 * header bar reads as part of the player rather than the screen behind it. These
 * stay hard-coded rather than reading `colors.*` so a poster-derived accent can
 * never tint the video frame.
 */
const PLAYER_SURFACE = '#0B0B0B';
const PLAYER_SURFACE_HIGH = 'rgba(255,255,255,0.12)';
const PLAYER_BACKDROP = '#000';
const PLAYER_ON_SURFACE = '#F5F5F5';
const PLAYER_ON_SURFACE_DIM = 'rgba(245,245,245,0.62)';


/**
 * Extracts the YouTube video ID from any standard YouTube URL.
 * Returns null if the URL is not a YouTube URL.
 */
function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

/**
 * Direct embed URL, loaded as the WebView *document*.
 *
 * Do not add `origin=` here: it must match the real document origin; a mismatch triggers YouTube 152/153 in WebViews.
 * The same trap kills the obvious "use the IFrame Player API" approach — serving a host
 * page via `{ html, baseUrl: 'https://www.youtube.com' }` does not give the document a
 * real youtube.com origin on Android (`loadDataWithBaseURL` leaves it opaque), and YouTube
 * answers every video with error 152. Verified on device: all five Blade Runner 2049
 * candidates failed that way. So the document stays a genuine youtube.com URL, and the
 * player is observed from inside it — see PLAYER_OBSERVER_JS.
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
 * Observes the player from *inside* the embed document.
 *
 * The problem this solves: age-gated, geo-blocked and taken-down videos all return a
 * clean HTTP 200 and then render YouTube's own error inside themselves, so the WebView's
 * `onError` never fires and the user is left staring at a black rectangle with no
 * explanation and no way out. Measured: 4 of 91 popular titles.
 *
 * Because the document is a real youtube.com page, injected script is same-origin and can
 * simply watch it: `.ytp-error` is the refusal, and `movie_player.getPlayerState() === 1`
 * is picture on screen. Reading YouTube's own refusal *text* turns out to beat the numeric
 * IFrame API codes anyway — it distinguishes an age gate from a region block, which
 * codes 101/150 collapse together.
 *
 * ROTATION_VIEWPORT_NOTE — rotation used to leave the player offset, with a wide black band
 * down the left and the picture running off the right edge. Cause: MainActivity handles
 * orientation through `configChanges` (which is exactly what keeps playback alive across a
 * rotate), so Android's WebView never refreshes its density and lays the page out at ~412dpi
 * instead of the A54's 450 — measured on device, a 909x420dp viewport inside an 832x384dp
 * view, with YouTube sizing #movie_player to 832 *CSS* px and offsetting it by 29. The
 * injected stylesheet pins the container to the viewport in percentages, which makes the
 * miscomputed pixel size irrelevant; YouTube still letterboxes the video inside it.
 *
 * Note the whole script is a template literal, so nothing in here may contain a backtick.
 */
const PLAYER_OBSERVER_JS = `
(function () {
  if (window.__trovaPlayerObserver) return;
  window.__trovaPlayerObserver = true;
  function post(message) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(message)); } catch (e) {}
  }
  // See ROTATION_VIEWPORT_NOTE above the template: pin the player to the viewport in %
  // so the WebView's miscomputed post-rotation density can't box it into a corner.
  var style = document.createElement('style');
  style.textContent =
    'html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important}' +
    '#player,#movie_player,.html5-video-player{width:100%!important;height:100%!important;left:0!important;top:0!important}';
  document.head.appendChild(style);
  var ticks = 0;
  var timer = setInterval(function () {
    ticks++;
    var error = document.querySelector('.ytp-error');
    if (error && error.offsetParent !== null) {
      clearInterval(timer);
      post({ t: 'blocked', reason: (error.innerText || '').slice(0, 200) });
      return;
    }
    var player = document.getElementById('movie_player');
    if (player && typeof player.getPlayerState === 'function') {
      // 1 = playing, 3 = buffering. Buffering means the player has accepted the video and
      // is fetching it, which is close enough to uncover the frame.
      var state = player.getPlayerState();
      if (state === 1 || state === 3) {
        clearInterval(timer);
        post({ t: 'playing' });
        return;
      }
    }
    // ~8s. Autoplay normally fires well inside this; if it didn't, stop covering a
    // perfectly usable player with a spinner.
    if (ticks > 32) { clearInterval(timer); post({ t: 'timeout' }); }
  }, 250);
})();
true;
`;

/**
 * YouTube's own refusal text → what we tell the user.
 *
 * An embed can never satisfy an age gate — no amount of player configuration will do it —
 * so the only honest answer is handing off to the YouTube app, where the user's signed-in
 * session clears it in one tap.
 */
function describeBlockReason(reason) {
  const text = String(reason || '');
  if (/age|sign in to confirm/i.test(text)) {
    return {
      title: 'This trailer is age-restricted',
      body: "YouTube won't play age-restricted videos inside another app. Open it in YouTube, where you're signed in.",
    };
  }
  if (/country|region|not available in your/i.test(text)) {
    return {
      title: 'Not available in your region',
      body: 'The uploader has restricted this trailer to other countries.',
    };
  }
  if (/removed|no longer|private|terminated|unavailable/i.test(text)) {
    return {
      title: 'Trailer no longer available',
      body: 'This video has been removed from YouTube or made private.',
    };
  }
  return {
    title: "This trailer won't play here",
    body: "YouTube blocked playback inside the app. Opening it in YouTube usually works.",
  };
}

/**
 * TrailerModal
 *
 * Props:
 *   visible    {boolean}  — controls visibility
 *   trailerUrl {string}   — YouTube watch URL (the best candidate)
 *   candidates {Array}    — ranked `[{ url, type, official, name }]`; the player walks
 *                           these when YouTube rejects one. Optional: cached results
 *                           predating this field fall back to `trailerUrl` alone.
 *   trailerType{string}   — 'Trailer' | 'Teaser', for the header label
 *   posterUrl  {string}   — hero backdrop, shown behind the loader instead of a blank wait
 *   title      {string}   — movie/show title (used in header)
 *   onClose    {function} — called when user dismisses the modal
 */
export function TrailerModal({
  visible,
  trailerUrl,
  candidates,
  trailerType,
  posterUrl,
  title,
  onClose,
}) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  /**
   * Measured size of the modal's own content box.
   *
   * `useWindowDimensions` reports the *activity* window. MainActivity declares
   * `configChanges="orientation|screenSize"` so rotation never recreates it — which is what
   * keeps playback alive — but it also means RN's Modal runs in a second window whose
   * resize can lag the activity's. Trusting the activity size laid the player out against
   * dimensions the modal didn't actually have, so in landscape the video sat 322px off the
   * left edge while running flush off the right. Measuring the container is authoritative.
   */
  const [frame, setFrame] = useState(null);
  const handleFrameLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    console.warn('[TrailerModal] frame layout', width, height);
    setFrame((previous) =>
      previous && previous.width === width && previous.height === height
        ? previous
        : { width, height },
    );
  }, []);
  const stageWidth = frame?.width ?? window.width;
  const stageHeight = frame?.height ?? window.height;
  const isLandscape = stageWidth > stageHeight;

  /** Ranked playback attempts. Falls back to the single URL for cached results. */
  const playlist = useMemo(() => {
    const list = (candidates || [])
      .map((candidate) => ({ ...candidate, id: extractYouTubeId(candidate.url) }))
      .filter((candidate) => candidate.id);
    if (list.length) return list;
    const id = extractYouTubeId(trailerUrl);
    return id ? [{ id, url: trailerUrl, type: trailerType || 'Trailer' }] : [];
  }, [candidates, trailerUrl, trailerType]);

  const [attempt, setAttempt] = useState(0);
  const [webLoading, setWebLoading] = useState(true);
  const [playerError, setPlayerError] = useState(null);
  /**
   * `react-native-webview` snapshots `activity.requestedOrientation` when it sets up its
   * chrome client and restores that value when the user leaves YouTube's fullscreen. If we
   * unlock *after* it mounts, exiting fullscreen silently re-locks the app to portrait
   * mid-playback — so the WebView doesn't render until the unlock has landed.
   */
  const [orientationReady, setOrientationReady] = useState(false);

  const current = playlist[attempt] || null;
  const embedReferer = useMemo(() => getYouTubeEmbedReferer(), []);
  const youtubeUrl = current ? `https://www.youtube.com/watch?v=${current.id}` : trailerUrl;

  const handleClose = useCallback(() => {
    setAttempt(0);
    setWebLoading(true);
    setPlayerError(null);
    onClose?.();
  }, [onClose]);

  // Honour the phone's own auto-rotate setting while the trailer is open: `unlockAsync`
  // maps to the system default, so a user who has auto-rotate switched OFF stays in
  // portrait. `OrientationLock.ALL` would override that choice, which isn't ours to make.
  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    ScreenOrientation.unlockAsync()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setOrientationReady(true);
      });
    // Cleanup, not `handleClose` — a deep link or a backgrounded app can unmount this
    // without ever calling onClose, and that would leave the whole app unlocked.
    return () => {
      cancelled = true;
      setOrientationReady(false);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [visible]);

  /** Advance to the next ranked candidate; show the error state only once they're exhausted. */
  const failCurrent = useCallback(
    (reason) => {
      if (attempt + 1 < playlist.length) {
        setAttempt(attempt + 1);
        setWebLoading(true);
        return;
      }
      setWebLoading(false);
      setPlayerError(describeBlockReason(reason));
    },
    [attempt, playlist.length],
  );

  const handleMessage = useCallback(
    (event) => {
      let message;
      try {
        message = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      // 'playing' is the real "there is picture on screen" signal. `onLoadEnd` only ever
      // meant "the document parsed", which cleared the spinner over a still-black frame.
      if (message.t === 'playing') {
        setWebLoading(false);
        return;
      }
      if (message.t === 'timeout') {
        // Neither playing nor refused — leave the player up rather than inventing an error.
        setWebLoading(false);
        return;
      }
      if (message.t === 'blocked') {
        console.warn('[TrailerModal] YouTube refused playback:', message.reason, current?.id);
        failCurrent(message.reason);
      }
    },
    [current, failCurrent],
  );

  const handleOpenYouTube = useCallback(() => {
    if (youtubeUrl) Linking.openURL(youtubeUrl);
  }, [youtubeUrl]);

  // Drag the header down to dismiss. Deliberately scoped to the header only — a
  // responder over the player would fight YouTube's own scrub and tap controls.
  //
  // The start position is recorded in the *capture* phase without claiming the responder.
  // Claiming on any movement (which is what `touches.length === 1` did) meant a tap with a
  // pixel of finger drift stole the responder from the close / YouTube buttons and
  // cancelled the press — the buttons read as unresponsive.
  const dragStart = useRef({ x: 0, y: 0 });
  const handleDragStartCapture = useCallback((event) => {
    dragStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    return false;
  }, []);
  const shouldStartDrag = useCallback((event) => {
    const dy = event.nativeEvent.pageY - dragStart.current.y;
    const dx = event.nativeEvent.pageX - dragStart.current.x;
    return dy > 15 && dy > Math.abs(dx);
  }, []);
  const handleDragRelease = useCallback(
    (event) => {
      if (event.nativeEvent.pageY - dragStart.current.y > 60) handleClose();
    },
    [handleClose],
  );

  if (!visible) return null;

  const hasVideo = playlist.length > 0;
  const label = trailerType === 'Teaser' ? 'Teaser' : 'Trailer';
  const showHeader = !isLandscape;

  return (
    <Modal
      transparent={false}
      animationType="fade"
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar style="light" hidden={isLandscape} />
      <View
        onLayout={handleFrameLayout}
        style={[
          styles.overlay,
          {
            paddingTop: showHeader ? insets.top || 16 : 0,
            paddingBottom: showHeader ? insets.bottom : 0,
          },
        ]}
      >
        {showHeader ? (
          <View
            style={[styles.header, { backgroundColor: PLAYER_SURFACE }]}
            onStartShouldSetResponderCapture={handleDragStartCapture}
            onMoveShouldSetResponder={shouldStartDrag}
            onResponderRelease={handleDragRelease}
          >
            <View style={styles.headerLeft}>
              <Ionicons name="play-circle" size={22} color={colors.primary} />
              <View style={styles.headerText}>
                <Text
                  style={[styles.headerTitle, { color: PLAYER_ON_SURFACE, ...typography.bodyMd }]}
                  numberOfLines={1}
                >
                  {title || label}
                </Text>
                <Text
                  style={[
                    styles.headerSubtitle,
                    { color: PLAYER_ON_SURFACE_DIM, ...typography.labelSm },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            </View>
            {/* Moved out of the player's bounds: floating over the video it overlapped
                YouTube's controls in fullscreen and read as a watermark rather than an
                action — and it's the escape hatch whenever YouTube refuses to embed. */}
            <TouchableOpacity
              style={[
                styles.youtubeBtn,
                { backgroundColor: PLAYER_SURFACE_HIGH, borderRadius: radii.full },
              ]}
              onPress={handleOpenYouTube}
              accessibilityRole="button"
              accessibilityLabel="Watch trailer on YouTube"
            >
              <Ionicons name="logo-youtube" size={18} color={colors.primary} />
              <Text
                style={[styles.youtubeBtnText, { color: PLAYER_ON_SURFACE, ...typography.labelSm }]}
              >
                YouTube
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.closeBtn,
                { backgroundColor: PLAYER_SURFACE_HIGH, borderRadius: radii.full },
              ]}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close trailer player"
            >
              <Ionicons name="close" size={20} color={PLAYER_ON_SURFACE} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.playerWrapper}>
          {playerError || !hasVideo ? (
            // The old behaviour was a toast plus `handleClose()` — the surface evaporated
            // and took the explanation with it. Keep the frame, state the reason, attach
            // the action.
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={40} color={PLAYER_ON_SURFACE_DIM} />
              <Text style={[styles.errorTitle, { color: PLAYER_ON_SURFACE, ...typography.bodyLg }]}>
                {playerError ? playerError.title : 'Trailer unavailable'}
              </Text>
              <Text
                style={[
                  styles.errorText,
                  { color: PLAYER_ON_SURFACE_DIM, ...typography.bodyMd },
                ]}
              >
                {playerError ? playerError.body : "We couldn't find a video for this title."}
              </Text>
              {hasVideo ? (
                <TouchableOpacity
                  style={[
                    styles.errorAction,
                    { backgroundColor: colors.primary, borderRadius: radii.full },
                  ]}
                  onPress={handleOpenYouTube}
                  accessibilityRole="button"
                  accessibilityLabel="Open this trailer in YouTube"
                >
                  <Ionicons name="logo-youtube" size={18} color="#141414" />
                  <Text style={[styles.errorActionText, { color: '#141414', ...typography.labelLg }]}>
                    Open in YouTube
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View
              style={[
                styles.stage,
                // Explicit pixels from the measured container rather than flex/aspectRatio:
                // the modal window's own size is the only thing YouTube's embed can be
                // centred against reliably across a rotation.
                isLandscape
                  ? { width: stageWidth, height: stageHeight }
                  : { width: stageWidth, height: Math.round((stageWidth * 9) / 16) },
              ]}
              onLayout={(event) =>
                console.warn(
                  '[TrailerModal] stage layout',
                  JSON.stringify(event.nativeEvent.layout),
                  'window',
                  window.width,
                  window.height,
                )
              }
            >
              {orientationReady && current ? (
                <WebView
                  // Deliberately NOT keyed on orientation: the WebView survives rotation, so
                  // playback continues instead of reloading. Verified on device that a
                  // remount changes nothing about the landscape geometry.
                  key={current.id}
                  style={styles.webview}
                  source={{
                    uri: buildYouTubeEmbedUri(current.id),
                    headers: { Referer: embedReferer },
                  }}
                  userAgent={
                    Platform.OS === 'android' ? YOUTUBE_WEBVIEW_USER_AGENT_ANDROID : undefined
                  }
                  allowsFullscreenVideo
                  allowsInlineMediaPlayback
                  domStorageEnabled
                  thirdPartyCookiesEnabled
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                  javaScriptCanOpenWindowsAutomatically
                  injectedJavaScript={PLAYER_OBSERVER_JS}
                  onMessage={handleMessage}
                  // Covers the rotation remount with the poster frame instead of a black
                  // flash; the observer clears it again on the first painted frame.
                  onLoadStart={() => setWebLoading(true)}
                  onError={() => failCurrent(null)}
                />
              ) : null}

              {webLoading && (
                <View style={styles.loaderOverlay}>
                  {posterUrl ? (
                    <ExpoImage
                      source={{ uri: posterUrl }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : null}
                  <View style={styles.loaderScrim} />
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text
                    style={[
                      styles.loaderText,
                      { color: PLAYER_ON_SURFACE, ...typography.bodyMd },
                    ]}
                  >
                    Loading {label.toLowerCase()}…
                  </Text>
                </View>
              )}
            </View>
          )}

          {isLandscape ? (
            <TouchableOpacity
              style={[styles.closeFloating, { top: (insets.top || 12) + 8 }]}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close trailer player"
            >
              <Ionicons name="close" size={22} color={PLAYER_ON_SURFACE} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: PLAYER_BACKDROP,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 4,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontWeight: '700',
  },
  headerSubtitle: {
    fontWeight: '600',
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeFloating: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 20,
  },
  playerWrapper: {
    flex: 1,
    backgroundColor: PLAYER_BACKDROP,
    // Portrait: centre a correctly-proportioned player instead of letterboxing a
    // 16:9 video inside a full-screen black rectangle. In landscape the stage is the
    // full container, so centring is a no-op.
    justifyContent: 'center',
    alignItems: 'center',
  },
  stage: {
    backgroundColor: PLAYER_BACKDROP,
  },
  webview: {
    flex: 1,
    backgroundColor: PLAYER_BACKDROP,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: PLAYER_BACKDROP,
    zIndex: 10,
  },
  loaderScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  loaderText: {
    fontWeight: '600',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 44,
    marginTop: 8,
  },
  errorActionText: {
    fontWeight: '800',
  },
  youtubeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 36,
  },
  youtubeBtnText: {
    fontWeight: '700',
  },
});
