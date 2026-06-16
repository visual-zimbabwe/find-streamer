/**
 * ProgressiveBlur.js
 *
 * A cinematic, gradient-masked blur overlay — the same technique used by
 * Apple TV+ and Prime Video on iOS. Implemented with expo-blur + MaskedView
 * + expo-linear-gradient (the exact stack behind expo-progressive-blur).
 *
 * Usage:
 *   <ProgressiveBlur
 *     intensity={60}          // blur strength (0–100)
 *     tint="dark"             // 'dark' | 'light' | 'default'
 *     style={StyleSheet.absoluteFill}
 *     direction="bottom"      // 'bottom' | 'top' | 'left' | 'right'
 *   />
 */

import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

const DIRECTION_COLORS = {
  bottom: ['transparent', 'black'],
  top: ['black', 'transparent'],
  left: ['black', 'transparent'],
  right: ['transparent', 'black'],
};

const DIRECTION_END = {
  bottom: { x: 0, y: 1 },
  top: { x: 0, y: 0 },
  left: { x: 0, y: 1 },
  right: { x: 1, y: 1 },
};

const DIRECTION_START = {
  bottom: { x: 0, y: 0 },
  top: { x: 0, y: 1 },
  left: { x: 1, y: 1 },
  right: { x: 0, y: 1 },
};

/**
 * A single blurred + gradient-masked layer.
 * On Android, MaskedView isn't fully supported, so we fall back to a plain
 * LinearGradient overlay with a semi-transparent tint (still looks great).
 */
export function ProgressiveBlur({
  intensity = 60,
  tint = 'dark',
  direction = 'bottom',
  style,
  locations = [0, 1],
  overlayColor,
}) {
  const gradColors = DIRECTION_COLORS[direction] || DIRECTION_COLORS.bottom;
  const gradStart = DIRECTION_START[direction] || DIRECTION_START.bottom;
  const gradEnd = DIRECTION_END[direction] || DIRECTION_END.bottom;

  // Android: MaskedView doesn't clip BlurView correctly — use a gradient scrim instead.
  // Map the direction's color pattern: 'transparent' stays transparent,
  // 'black' becomes the overlayColor (or a tint-based fallback).
  if (Platform.OS === 'android') {
    const opaqueColor =
      overlayColor || (tint === 'dark' ? 'rgba(0,0,0,0.88)' : 'rgba(255,255,255,0.88)');
    const androidColors = gradColors.map((c) =>
      c === 'transparent' ? 'transparent' : opaqueColor,
    );
    return (
      <LinearGradient
        colors={androidColors}
        start={gradStart}
        end={gradEnd}
        locations={locations}
        style={[styles.absoluteFill, style]}
      />
    );
  }

  // iOS: true progressive blur via MaskedView
  return (
    <MaskedView
      style={[styles.absoluteFill, style]}
      maskElement={
        <LinearGradient
          colors={gradColors}
          start={gradStart}
          end={gradEnd}
          locations={locations}
          style={styles.absoluteFill}
        />
      }
    >
      <BlurView
        intensity={intensity}
        tint={tint}
        style={styles.absoluteFill}
        experimentalBlurMethod="dimezisBlurView"
      />
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  absoluteFill: StyleSheet.absoluteFillObject,
});
