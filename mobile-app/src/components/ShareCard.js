import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Brand accent – always use the dark palette for the card so it looks
// great on every receiver app regardless of the sender's theme setting.
const CARD_BG       = '#0a0e14';
const CARD_SURFACE  = '#151a21';
const ACCENT        = '#9aa8ff';
const ON_SURFACE    = '#f1f3fc';
const ON_VARIANT    = '#a8abb3';
const BADGE_BG      = 'rgba(154, 168, 255, 0.15)';

const SERVICE_COLORS = {
  netflix:           '#E50914',
  amazon_prime_video:'#00A8E1',
  max:               '#002BE7',
};

const SERVICE_ICONS = {
  netflix:           'play-circle',
  amazon_prime_video:'logo-amazon',
  max:               'tv',
};

/**
 * ShareCard
 *
 * Rendered off-screen (position absolute, opacity 0, pointer-events none)
 * then captured via ViewShot.  Pass a `ref` that will be forwarded to the
 * outer <View> so ViewShot can capture it.
 *
 * Props:
 *   result  – the full resolved result object from resolveMatch()
 */
export const ShareCard = forwardRef(function ShareCard({ result }, ref) {
  if (!result) return null;

  const isTv = result.mediaType === 'tv';

  // ── Runtime / season string ──────────────────────────────────────────
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

  // ── Genre: first two genres only to keep things tidy ─────────────────
  const genreShort = (result.genres || 'Unknown Genre')
    .split(',')
    .slice(0, 2)
    .map(g => g.trim())
    .join(' · ');

  // ── Streaming: only services with availability ────────────────────────
  const availableProviders = (result.providerSummary || []).filter(p => p.count > 0);

  // ── Country count: total unique countries across all services ─────────
  const countrySet = new Set();
  (result.rows || []).forEach(row => {
    Object.entries(row.providers).forEach(([, available]) => {
      if (available) countrySet.add(row.code);
    });
  });
  const totalCountries = countrySet.size;

  return (
    // The outer View dimensions define the card size that ViewShot captures.
    <View ref={ref} style={styles.card} collapsable={false}>
      {/* ── Poster column ──────────────────────────────────────────────── */}
      {result.posterUrl ? (
        <Image
          source={{ uri: result.posterUrl }}
          style={styles.poster}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.poster, styles.posterFallback]}>
          <Ionicons name={isTv ? 'tv-outline' : 'film-outline'} size={48} color={ON_VARIANT} />
        </View>
      )}

      {/* Gradient-like overlay on the right edge of the poster */}
      <View style={styles.posterFade} />

      {/* ── Content column ──────────────────────────────────────────────── */}
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

        {/* Divider */}
        <View style={styles.divider} />

        {/* Streaming availability */}
        {availableProviders.length > 0 ? (
          <View style={styles.streamingSection}>
            <Text style={styles.streamLabel}>STREAMING IN {totalCountries} COUNTR{totalCountries === 1 ? 'Y' : 'IES'}</Text>
            <View style={styles.providerRow}>
              {availableProviders.map(p => (
                <View key={p.key} style={[styles.providerBadge, { borderColor: SERVICE_COLORS[p.key] + '66' }]}>
                  {p.logoUrl ? (
                    <Image
                      source={{ uri: p.logoUrl }}
                      style={styles.providerLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <Ionicons
                      name={SERVICE_ICONS[p.key] || 'play-circle'}
                      size={14}
                      color={SERVICE_COLORS[p.key]}
                    />
                  )}
                  <Text style={[styles.providerName, { color: SERVICE_COLORS[p.key] }]}>
                    {p.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.streamingSection}>
            <Text style={styles.streamLabel}>NOT CURRENTLY STREAMING</Text>
          </View>
        )}

        {/* Branding footer */}
        <View style={styles.footer}>
          <Text style={styles.brandText}>trovă</Text>
          <Text style={styles.tagLine}>Find where to stream</Text>
        </View>
      </View>
    </View>
  );
});

const CARD_W = 420;
const POSTER_W = 140;

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    flexDirection: 'row',
    overflow: 'hidden',
    // Subtle border
    borderWidth: 1,
    borderColor: 'rgba(154,168,255,0.15)',
  },
  poster: {
    width: POSTER_W,
    // height is set by content, but minimum enforced
    minHeight: 240,
  },
  posterFallback: {
    backgroundColor: CARD_SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterFade: {
    position: 'absolute',
    left: POSTER_W - 20,
    top: 0,
    bottom: 0,
    width: 24,
    // Simulated horizontal gradient via shadow trick (pure RN)
    backgroundColor: 'transparent',
    // Not a real gradient but the card BG bleeds nicely in practice
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
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: CARD_SURFACE,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
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
