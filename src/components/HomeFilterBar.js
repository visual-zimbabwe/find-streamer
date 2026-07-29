import React, { memo } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { scale } from '../utils/responsive';
import { GOLD_ACCENT } from '../theme/programme';
import { getServiceLabel } from '../lib/whereToWatch';
import { flagForCountryCode } from '../lib/providerAvailability';

/**
 * Home's browse header: the wordmark over a single horizontally-scrollable chip
 * row. Five chips, three meanings, deliberately one line:
 *   Movies · Shows        — media-type toggle (mutually exclusive)
 *   Collections           — navigates to the Collections screen (chevron ›)
 *   Country · Service      — the where-to-watch availability filter
 *
 * A scroll row (rather than five static pills) is what lets all five share one
 * line on a phone without truncating a long country/service name, and it unifies
 * the type toggle and the filter into one chip language.
 */
function Chip({ flag, logoUrl, label, active, trailingIcon, onPress, accessibilityLabel, accessibilityRole = 'button', selected }) {
  const { theme } = useTheme();
  const { typography } = theme;
  return (
    <TouchableOpacity
      style={styles.chip}
      activeOpacity={0.78}
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityRole === 'tab' ? { selected } : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {logoUrl ? (
        <Image
          source={{ uri: logoUrl }}
          style={styles.chipLogo}
          resizeMode="contain"
          importantForAccessibility="no"
        />
      ) : flag ? (
        <Text style={styles.chipFlag} importantForAccessibility="no">
          {flag}
        </Text>
      ) : null}
      <Text
        style={[
          styles.chipText,
          typography.labelSm,
          { color: active ? GOLD_ACCENT : 'rgba(255,255,255,0.86)' },
          active && styles.chipTextActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {trailingIcon ? (
        <Ionicons
          name={trailingIcon}
          size={12}
          color={active ? GOLD_ACCENT : 'rgba(255,255,255,0.6)'}
        />
      ) : null}
    </TouchableOpacity>
  );
}

export const HomeFilterBar = memo(function HomeFilterBar({
  headerScrolled = false,
  mediaFilter = null,
  onMediaFilterChange,
  onOpenCollections,
  country = null,
  serviceKey = null,
  serviceLogoUrl = null,
  onOpenCountry,
  onOpenService,
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { colors } = theme;

  const countryActive = Boolean(country?.code);
  const serviceActive = Boolean(serviceKey);

  const toggleMedia = (key) => {
    onMediaFilterChange?.(mediaFilter === key ? null : key);
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + scale(10) }]} pointerEvents="box-none">
      {headerScrolled ? (
        Platform.OS === 'ios' ? (
          <BlurView
            intensity={72}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
            experimentalBlurMethod="dimezisBlurView"
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.glass }]} />
        )
      ) : (
        // A solid-at-top, fading-down scrim: gives the wordmark and chips a
        // reliable dark backing and masks the hero card's baked-in title so it
        // can't bleed through behind the chips.
        <LinearGradient
          colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0)']}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <Text style={styles.wordmark} accessibilityRole="header">
        Trova
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
        decelerationRate="fast"
      >
        <Chip
          label="Movies"
          accessibilityRole="tab"
          selected={mediaFilter === 'movie'}
          active={mediaFilter === 'movie'}
          onPress={() => toggleMedia('movie')}
          accessibilityLabel="Show movies"
        />
        <Chip
          label="Shows"
          accessibilityRole="tab"
          selected={mediaFilter === 'tv'}
          active={mediaFilter === 'tv'}
          onPress={() => toggleMedia('tv')}
          accessibilityLabel="Show TV shows"
        />
        <Chip
          label="Collections"
          trailingIcon="chevron-forward"
          onPress={onOpenCollections}
          accessibilityLabel="Open Collections"
        />
        <Chip
          flag={countryActive ? flagForCountryCode(country.code) : null}
          label={countryActive ? country.label : 'All countries'}
          trailingIcon="chevron-down"
          active={countryActive}
          onPress={onOpenCountry}
          accessibilityLabel={`Country: ${countryActive ? country.label : 'All countries'}. Change country`}
        />
        <Chip
          logoUrl={serviceActive ? serviceLogoUrl : null}
          label={serviceActive ? getServiceLabel(serviceKey) : 'All services'}
          trailingIcon="chevron-down"
          active={serviceActive}
          onPress={onOpenService}
          accessibilityLabel={`Service: ${serviceActive ? getServiceLabel(serviceKey) : 'All services'}. Change streaming service`}
        />
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 20,
    overflow: 'hidden',
    paddingBottom: scale(10),
  },
  wordmark: {
    color: '#fff',
    fontFamily: Platform.select({ android: 'serif', ios: 'Georgia', default: 'serif' }),
    fontSize: scale(28),
    lineHeight: scale(34),
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: -0.3,
    marginBottom: scale(10),
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
    paddingHorizontal: scale(20),
  },
  // No fill and no border: the row reads as type sitting in the header, not as
  // controls floated on top of it. Active/idle live entirely on text colour and
  // weight, so nothing pops out of the surface. The padding that remains is
  // touch target, not decoration.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: scale(4),
    paddingVertical: 6,
  },
  chipFlag: {
    fontSize: 15,
  },
  chipLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  chipText: {
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  // Weight carries the selected state alongside the gold, so it doesn't rest on
  // colour alone now that the fill is gone.
  chipTextActive: {
    fontWeight: '800',
  },
});
