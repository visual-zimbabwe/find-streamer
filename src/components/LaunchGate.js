import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LaunchIntro } from './LaunchIntro';

SplashScreen.preventAutoHideAsync().catch(() => {});

export function LaunchGate({ shellReady, themeReady, children }) {
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
      {children}
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
