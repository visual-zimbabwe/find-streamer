import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GOLD_DIM } from '../theme/programme';
import { scale } from '../utils/responsive';

export function ProgrammeHairline({ style, color = GOLD_DIM }) {
  return <View style={[styles.hairline, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  hairline: {
    height: StyleSheet.hairlineWidth,
    marginBottom: scale(18),
    opacity: 0.65,
  },
});
