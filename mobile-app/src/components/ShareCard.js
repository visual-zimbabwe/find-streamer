import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SERVICE_COLORS, SERVICE_ICONS,
  pickCountries, shortName,
} from '../lib/shareUtils';

// Always dark palette so the card looks great in any receiver app.
const CARD_BG      = '#0a0e14';
const CARD_SURFACE = '#151a21';
const ACCENT       = '#9aa8ff';
const ON_SURFACE   = '#f1f3fc';
const ON_VARIANT   = '#a8abb3';
const BADGE_BG     = 'rgba(154, 168, 255, 0.15)';

/**
 * ShareCard
 *
 * Rendered off-screen and captured via ViewShot.
 *
 * Props:
 *   result           – full resolved result from resolveMatch()
 *   selectedCountries – { serviceKey: [code, ...] }  (optional)
 *                       Falls back to auto-pick if omitted.
 */
export const ShareCard = forwardRef(function ShareCard({ result, selectedCountries }, ref) {
  if (!result) return null;

  const isTv = result.mediaType === 'tv';

  function runtimeLabel() {
    if (isTv) {
      const s = result.numberOfSeasons;
      return s ? `${s} Season${s !== 1 ? 's' : ''}` : 'TV Series';
    }
    const m = result.runtimeMinutes;
    if (!m) return 'Runtime N/A';
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (!h) return `${r}m`;
    return r ? `${h}h ${r}m` : `${h}h`;
  }

  // First 3 genres
  const genreShort = (result.genres || 'Unknown Genre')
    .split(',')
    .slice(0, 3)
    .map(g => g.trim())
    .join(' · ');

  // Only services that are actually available
  const availableProviders = (result.providerSummary || []).filter(p => p.count > 0);

  // Country resolution per service: use caller-supplied selection or auto-pick
  function countriesFor(serviceKey) {
    const override = selectedCountries && selectedCountries[serviceKey];
    if (override && override.length > 0) return override;
    return pickCountries(result.rows, serviceKey);
  }

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {/* ── Poster ─────────────────────────────────────────────── */}
      {result.posterUrl ? (
        <Image source={{ uri: result.posterUrl }} style={styles.poster} resizeMode="cover" />
      ) : (
        <View style={[styles.poster, styles.posterFallback]}>
          <Ionicons name={isTv ? 'tv-outline' : 'film-outline'} size={48} color={ON_VARIANT} />
        </View>
      )}

      {/* ── Content ─────────────────────────────────────────────── */}
      <View style={styles.content}>
        {/* Type pill */}
        <View style={styles.typePill}>
          <Ionicons name={isTv ? 'tv-outline' : 'film-outline'} size={10} color={ACCENT} />
          <Text style={styles.typeText}>{isTv ? 'TV SERIES' : 'MOVIE'}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>{result.title}</Text>

        {/* Year · Genre · Runtime */}
        <Text style={styles.meta}>
          {result.year}  ·  {genreShort}  ·  {runtimeLabel()}
        </Text>

        {/* Rating */}
        {result.rating && result.rating !== 'N/A' && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={ACCENT} />
            <Text style={styles.rating}>{result.rating}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Streaming section */}
        {availableProviders.length > 0 ? (
          <View style={styles.streamingSection}>
            <Text style={styles.streamLabel}>WHERE TO STREAM</Text>
            <View style={styles.providerList}>
              {availableProviders.map(p => {
                const countries = countriesFor(p.key);
                const color = SERVICE_COLORS[p.key];
                return (
                  <View key={p.key} style={styles.providerServiceRow}>
                    {/* Service */}
                    <View style={styles.providerServiceName}>
                      {p.logoUrl ? (
                        <Image source={{ uri: p.logoUrl }} style={styles.providerLogo} resizeMode="contain" />
                      ) : (
                        <Ionicons name={SERVICE_ICONS[p.key] || 'play-circle'} size={11} color={color} />
                      )}
                      <Text style={[styles.providerName, { color }]}>{p.label}</Text>
                    </View>
                    {/* Country chips */}
                    <View style={styles.countryChips}>
                      {countries.map(code => (
                        <View key={code} style={[styles.countryChip, { borderColor: color + '55' }]}>
                          <Text style={[styles.countryChipText, { color }]}>{shortName(code)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.streamingSection}>
            <Text style={styles.streamLabel}>NOT CURRENTLY STREAMING</Text>
          </View>
        )}

        {/* Branding */}
        <View style={styles.footer}>
          <Text style={styles.brandText}>trovă</Text>
          <Text style={styles.tagLine}>Find where to stream</Text>
        </View>
      </View>
    </View>
  );
});

const CARD_W   = 420;
const POSTER_W = 140;

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(154,168,255,0.15)',
  },
  poster: {
    width: POSTER_W,
    minHeight: 240,
  },
  posterFallback: {
    backgroundColor: CARD_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 18,
    paddingLeft: 16,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BADGE_BG,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 8,
  },
  typeText: {
    color: ACCENT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: ON_SURFACE,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  meta: {
    color: ON_VARIANT,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  rating: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(154,168,255,0.12)',
    marginVertical: 12,
  },
  streamingSection: {
    marginBottom: 14,
  },
  streamLabel: {
    color: ON_VARIANT,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  providerList: {
    gap: 7,
  },
  providerServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  providerServiceName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 80,
  },
  providerLogo: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  providerName: {
    fontSize: 10,
    fontWeight: '800',
  },
  countryChips: {
    flexDirection: 'row',
    gap: 5,
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  countryChip: {
    backgroundColor: CARD_SURFACE,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countryChipText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  brandText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tagLine: {
    color: ON_VARIANT,
    fontSize: 9,
    fontWeight: '600',
  },
});
