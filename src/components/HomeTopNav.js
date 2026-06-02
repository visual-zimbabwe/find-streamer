import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const NAV_SETS = {
  home: [
    { key: 'movie', label: 'Movies' },
    { key: 'tv', label: 'Shows' },
    { key: 'collections', label: 'Collections' },
  ],
  collectionsRoot: [
    { key: 'collections', label: 'Collections' },
    { key: 'imdb_top100', label: 'Top 100 IMDb' },
  ],
  imdbTop100: [
    { key: 'collections', label: 'Collections' },
    { key: 'movie', label: 'Movies' },
    { key: 'tv', label: 'Shows' },
  ],
};

export function HomeTopNav({ selectedKey = null, onSelect, navSet = 'home' }) {
  const insets = useSafeAreaInsets();
  const items = NAV_SETS[navSet] || NAV_SETS.home;

  return (
    <View
      style={[
        styles.homeTopNav,
        { top: insets.top + 8 },
      ]}
      pointerEvents="box-none"
    >
      <Text style={styles.homeWordmark} accessibilityRole="header">Trova</Text>
      <View style={styles.glassBar}>
        {items.map((item) => {
          const selected = selectedKey === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.typePill}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect?.(item.key, selected);
              }}
              activeOpacity={0.78}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show ${item.label}`}
            >
              <Text style={[styles.typePillText, selected && styles.typePillTextSelected]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  homeTopNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 20,
  },
  homeWordmark: {
    color: '#fff',
    fontFamily: Platform.select({ android: 'serif', ios: 'Georgia', default: 'serif' }),
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
    marginBottom: 10,
  },
  glassBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingVertical: 2,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    paddingHorizontal: 0,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  typePillText: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  typePillTextSelected: {
    color: '#fff',
    fontWeight: '900',
  },
});
