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

// Ordered by streaming-market size / popularity – used as fallback when
// neither US nor CA is available for a given service.
const POPULARITY_ORDER = [
  'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'BR', 'MX', 'JP', 'IN',
  'ES', 'IT', 'NL', 'KR', 'SE', 'NO', 'DK', 'PL', 'AR', 'CO',
  'CL', 'PT', 'ZA', 'SG', 'TR', 'CH', 'BE', 'AT', 'FI', 'HU',
  'CZ', 'RO', 'GR', 'IE', 'NZ', 'IL', 'TH', 'PH', 'MY', 'HK',
  'TW', 'VN', 'ID', 'EG', 'NG',
];

// Short display names for the most common streaming markets.
const SHORT_COUNTRY_NAMES = {
  US: 'USA',    CA: 'Canada',  GB: 'UK',        AU: 'Australia',
  DE: 'Germany',FR: 'France',  BR: 'Brazil',    MX: 'Mexico',
  JP: 'Japan',  IN: 'India',   ES: 'Spain',     IT: 'Italy',
  NL: 'Netherlands', KR: 'S. Korea', SE: 'Sweden', NO: 'Norway',
  DK: 'Denmark',PL: 'Poland',  AR: 'Argentina', CO: 'Colombia',
  CL: 'Chile',  PT: 'Portugal',ZA: 'S. Africa', SG: 'Singapore',
  TR: 'Turkey', CH: 'Switzerland', BE: 'Belgium', AT: 'Austria',
  FI: 'Finland',HU: 'Hungary', CZ: 'Czechia',   RO: 'Romania',
  GR: 'Greece', IE: 'Ireland', NZ: 'N. Zealand', IL: 'Israel',
  TH: 'Thailand',PH: 'Philippines', MY: 'Malaysia', HK: 'Hong Kong',
  TW: 'Taiwan', VN: 'Vietnam', ID: 'Indonesia',  EG: 'Egypt',
  NG: 'Nigeria',
};

function shortName(code) {
  return SHORT_COUNTRY_NAMES[code] || code;
}

/**
 * Pick at most 2 countries for a given service:
 *  1. Prefer US then CA if available.
 *  2. Fill remaining slots from POPULARITY_ORDER (skipping already picked).
 */
function pickCountries(rows, serviceKey) {
  const available = new Set(
    (rows || []).filter(r => r.providers[serviceKey]).map(r => r.code)
  );
  if (available.size === 0) return [];

  const picked = [];
  // Always prefer US first, then CA
  if (available.has('US')) picked.push('US');
  if (picked.length < 2 && available.has('CA')) picked.push('CA');

  // Fill up to 2 from popularity ranking
  if (picked.length < 2) {
    for (const code of POPULARITY_ORDER) {
      if (picked.length >= 2) break;
      if (!picked.includes(code) && available.has(code)) picked.push(code);
    }
  }

  // Final safety: if popularity list didn't cover all codes, grab any remaining
  if (picked.length < 2) {
    for (const code of available) {
      if (picked.length >= 2) break;
      if (!picked.includes(code)) picked.push(code);
    }
  }

  return picked;
}

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

  // ── Genre: first three genres only to keep things tidy ───────────────
  const genreShort = (result.genres || 'Unknown Genre')
    .split(',')
    .slice(0, 3)
    .map(g => g.trim())
    .join(' · ');

  // ── Streaming: only services with availability ────────────────────────
  const availableProviders = (result.providerSummary || []).filter(p => p.count > 0);

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
            <Text style={styles.streamLabel}>WHERE TO STREAM</Text>
            <View style={styles.providerList}>
              {availableProviders.map(p => {
                const countries = pickCountries(result.rows, p.key);
                return (
                  <View key={p.key} style={styles.providerServiceRow}>
                    {/* Service name */}
                    <View style={styles.providerServiceName}>
                      {p.logoUrl ? (
                        <Image
                          source={{ uri: p.logoUrl }}
                          style={styles.providerLogo}
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons
                          name={SERVICE_ICONS[p.key] || 'play-circle'}
                          size={11}
                          color={SERVICE_COLORS[p.key]}
                        />
                      )}
                      <Text style={[styles.providerName, { color: SERVICE_COLORS[p.key] }]}>
                        {p.label}
                      </Text>
                    </View>
                    {/* Country chips */}
                    <View style={styles.countryChips}>
                      {countries.map(code => (
                        <View
                          key={code}
                          style={[styles.countryChip, { borderColor: SERVICE_COLORS[p.key] + '55' }]}
                        >
                          <Text style={[styles.countryChipText, { color: SERVICE_COLORS[p.key] }]}>
                            {shortName(code)}
                          </Text>
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
