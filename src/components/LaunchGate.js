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
export function LaunchGate({ shellReady, contentReady, themeReady, children }) {
  const [introVisible, setIntroVisible] = useState(true);
  const [sequenceComplete, setSequenceComplete] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);

  const canDismiss = sequenceComplete && shellReady;
  const showIntro = introVisible && themeReady;

  const handleIntroLayout = useCallback(() => {
    if (nativeSplashHidden) return;
    setNativeSplashHidden(true);
    SplashScreen.hideAsync().catch(() => {});
  }, [nativeSplashHidden]);

  const handleSequenceComplete = useCallback(() => {
    setSequenceComplete(true);
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
          onDismiss={handleDismiss}
        />
      ) : null}
    </View>
  );
}
