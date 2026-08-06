import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LaunchIntro } from './LaunchIntro';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * `contentReady` gates the *mount* of the shell; `shellReady` gates only when
 * the intro may be dismissed.
 *
 * The shell used to mount unconditionally, so it performed its first layout
 * behind the intro overlay while the custom fonts were still loading. Text was
 * measured with fallback metrics and kept those (too-narrow) bounds when the
 * real faces swapped in, clipping trailing words until something forced a
 * re-layout (T1).
 *
 * Deliberately NOT gated on the full `shellReady`: that includes
 * `nav.navigationReady`, which is set by the NavigationContainer's `onReady` —
 * and the container is one of these children. Gating on it would deadlock
 * (children never mount -> onReady never fires -> children never mount).
 */
export function LaunchGate({ shellReady, contentReady, children }) {
  const [introVisible, setIntroVisible] = useState(true);
  const [sequenceComplete, setSequenceComplete] = useState(false);
  const [skipRequested, setSkipRequested] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);

  // The intro is dismissible as soon as the shell is ready AND either the brand
  // build-in has finished (the floor) or the user tapped to skip. It is NOT
  // gated on the full build running to completion regardless of load — a fast
  // cold start exits at roughly the floor instead of a fixed multi-second wait.
  const canDismiss = (sequenceComplete || skipRequested) && shellReady;
  // The intro used to also wait on the theme resolving a stored preference, so
  // it couldn't paint the wrong palette for a frame. The app is dark-only now,
  // so the palette is known before the first render.
  const showIntro = introVisible;

  const handleIntroLayout = useCallback(() => {
    if (nativeSplashHidden) return;
    setNativeSplashHidden(true);
    SplashScreen.hideAsync().catch(() => {});
  }, [nativeSplashHidden]);

  const handleSequenceComplete = useCallback(() => {
    setSequenceComplete(true);
  }, []);

  const handleSkip = useCallback(() => {
    setSkipRequested(true);
  }, []);

  const handleDismiss = useCallback(() => {
    setIntroVisible(false);
  }, []);

  useEffect(() => {
    if (!showIntro || nativeSplashHidden) return undefined;

    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setNativeSplashHidden(true);
    }, 120);

    return () => clearTimeout(timer);
  }, [showIntro, nativeSplashHidden]);

  return (
    <View style={{ flex: 1 }}>
      {contentReady ? children : null}
      {showIntro ? (
        <LaunchIntro
          canDismiss={canDismiss}
          onLayout={handleIntroLayout}
          onSequenceComplete={handleSequenceComplete}
          onSkip={handleSkip}
          onDismiss={handleDismiss}
        />
      ) : null}
    </View>
  );
}
