import React, { memo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { scale } from '../utils/responsive';

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

const GOLD_ACCENT = '#D4A853';

function OverlayNav({ selectedKey, onSelect, navSet }) {
  const insets = useSafeAreaInsets();
  const items = NAV_SETS[navSet] || NAV_SETS.home;

  return (
    <View style={[styles.homeTopNav, { top: insets.top + 8 }]} pointerEvents="box-none">
      <Text style={styles.homeWordmark} accessibilityRole="header">
        Trova
      </Text>
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

const ProgrammeNav = memo(function ProgrammeNav({
  selectedKey,
  onSelect,
  navSet,
  headerScrolled = false,
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const items = NAV_SETS[navSet] || NAV_SETS.home;
  const onLightBackdrop = !headerScrolled;

  return (
    <View
      style={[styles.programmeHeader, { paddingTop: insets.top + scale(10) }]}
      pointerEvents="box-none"
    >
      {headerScrolled ? (
        Platform.OS === 'ios' ? (
          <BlurView
            intensity={72}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
            experimentalBlurMethod="dimezisBlurView"
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.programmeHeaderGlass]} />
        )
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.programmeHeaderScrim]} />
      )}
      <View style={styles.programmeHeaderInner}>
        <Text
          style={[
            styles.programmeWordmark,
            onLightBackdrop ? styles.programmeWordmarkLight : { color: colors.onSurface },
          ]}
          accessibilityRole="header"
        >
          Trova
        </Text>
        <View style={styles.programmeTabRow}>
          {items.map((item) => {
            const selected = selectedKey === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.programmeTabHit}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelect?.(item.key, selected);
                }}
                activeOpacity={0.78}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`Show ${item.label}`}
              >
                <Text
                  style={[
                    styles.programmeTabText,
                    typography.labelSm,
                    onLightBackdrop
                      ? styles.programmeTabTextLight
                      : { color: colors.onSurfaceVariant },
                    selected &&
                      (onLightBackdrop
                        ? styles.programmeTabTextSelectedLight
                        : { color: colors.onSurface, fontWeight: '800' }),
                  ]}
                >
                  {item.label}
                </Text>
                {selected ? (
                  <View
                    style={[
                      styles.programmeTabUnderline,
                      { backgroundColor: onLightBackdrop ? GOLD_ACCENT : colors.primary },
                    ]}
                  />
                ) : (
                  <View style={styles.programmeTabUnderlineSpacer} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
});

export function HomeTopNav({
  selectedKey = null,
  onSelect,
  navSet = 'home',
  variant = 'overlay',
  headerScrolled = false,
}) {
  if (variant === 'programme') {
    return (
      <ProgrammeNav
        selectedKey={selectedKey}
        onSelect={onSelect}
        navSet={navSet}
        headerScrolled={headerScrolled}
      />
    );
  }
  return <OverlayNav selectedKey={selectedKey} onSelect={onSelect} navSet={navSet} />;
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

  programmeHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 20,
    overflow: 'hidden',
  },
  programmeHeaderScrim: {
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  programmeHeaderGlass: {
    backgroundColor: 'rgba(12,12,14,0.94)',
  },
  programmeHeaderInner: {
    alignItems: 'center',
    paddingHorizontal: scale(22),
    paddingBottom: scale(12),
  },
  programmeWordmark: {
    fontFamily: Platform.select({ android: 'serif', ios: 'Georgia', default: 'serif' }),
    fontSize: scale(28),
    lineHeight: scale(34),
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: -0.3,
    marginBottom: scale(10),
    textAlign: 'center',
  },
  programmeWordmarkLight: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  programmeTabRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: scale(20),
  },
  programmeTabHit: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  programmeTabText: {
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: scale(11),
  },
  programmeTabTextLight: {
    color: 'rgba(255,255,255,0.72)',
  },
  programmeTabTextSelectedLight: {
    color: '#fff',
    fontWeight: '800',
  },
  programmeTabUnderline: {
    alignSelf: 'stretch',
    height: 2,
    marginTop: 6,
    borderRadius: 1,
  },
  programmeTabUnderlineSpacer: {
    height: 2,
    marginTop: 6,
  },
});
