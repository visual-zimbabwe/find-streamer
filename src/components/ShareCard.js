import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SERVICE_COLORS, SERVICE_ICONS,
  pickCountries, shortName,
} from '../lib/shareUtils';
import { createQrMatrix } from '../lib/qrMatrix';

// Always dark palette so the card looks great in any receiver app.
const CARD_BG      = '#0a0e14';
const CARD_SURFACE = '#151a21';
const ACCENT       = '#9aa8ff';
const ON_SURFACE   = '#f1f3fc';
const ON_VARIANT   = '#a8abb3';
const BADGE_BG     = 'rgba(154, 168, 255, 0.15)';

function ShareQrCode({ value, color, backgroundColor }) {
  const matrix = createQrMatrix(value);
  return (
    <View style={[styles.qrCode, { backgroundColor }]}>
      {matrix.map((row, rowIndex) => (
        <View key={`qr-row-${rowIndex}`} style={styles.qrRow}>
          {row.map((isDark, colIndex) => (
            <View
              key={`qr-cell-${rowIndex}-${colIndex}`}
              style={[
                styles.qrCell,
                { backgroundColor: isDark ? color : backgroundColor },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

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
export const ShareCard = forwardRef(function ShareCard({ result, selectedCountries, themeColors }, ref) {
  if (!result) return null;

  const isTv = result.mediaType === 'tv';
  const accent = themeColors?.primary || ACCENT;
  const background = themeColors?.background || CARD_BG;
  const surface = themeColors?.surfaceContainer || CARD_SURFACE;
  const surfaceHigh = themeColors?.surfaceContainerHigh || CARD_SURFACE;
  const onSurface = themeColors?.onSurface || ON_SURFACE;
  const onVariant = themeColors?.onSurfaceVariant || ON_VARIANT;
  const fallbackSlug = String(result.title || 'title')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 10);
  const deepLink = `trova://title/${isTv ? 'tv' : 'movie'}/${result.tmdbId || fallbackSlug || 'title'}`;

  function runtimeLabel() {
    if (isTv) {
      const s = result.numberOfSeasons;
      return s ? `${s} Season${s !== 1 ? 's' : ''}` : 'TV Series';
    }
    const m = result.runtimeMinutes;
    if (!m) return null;
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (!h) return `${r}m`;
    return r ? `${h}h ${r}m` : `${h}h`;
  }

  // First 3 genres
  const genreShort = result.genres && result.genres !== 'N/A'
    ? result.genres
    .split(',')
    .slice(0, 3)
    .map(g => g.trim())
    .join(' · ')
    : null;
  const metaParts = [result.year !== 'N/A' ? result.year : null, genreShort, runtimeLabel()].filter(Boolean);

  // Only services that are actually available
  const availableProviders = (result.providerSummary || []).filter(p => p.count > 0);

  // Country resolution per service: use caller-supplied selection or auto-pick
  function countriesFor(serviceKey) {
    const override = selectedCountries && selectedCountries[serviceKey];
    if (override && override.length > 0) return override;
    return pickCountries(result.rows, serviceKey);
  }

  return (
    <View
      ref={ref}
      style={[
        styles.card,
        {
          backgroundColor: background,
          borderColor: accent + '33',
        },
      ]}
      collapsable={false}
    >
      <View style={[styles.themeWash, { backgroundColor: accent + '1F' }]} />
      <View style={[styles.themeCorner, { backgroundColor: surfaceHigh }]} />
      {/* ── Poster ─────────────────────────────────────────────── */}
      {result.posterUrl ? (
        <Image source={{ uri: result.posterUrl }} style={styles.poster} resizeMode="cover" />
      ) : (
        <View style={[styles.poster, styles.posterFallback, { backgroundColor: surface }]}>
          <Ionicons name={isTv ? 'tv-outline' : 'film-outline'} size={48} color={onVariant} />
        </View>
      )}

      {/* ── Content ─────────────────────────────────────────────── */}
      <View style={[styles.content, { backgroundColor: background }]}>
        {/* Type pill */}
        <View style={[styles.typePill, { backgroundColor: accent + '26' }]}>
          <Ionicons name={isTv ? 'tv-outline' : 'film-outline'} size={10} color={accent} />
          <Text style={[styles.typeText, { color: accent }]}>{isTv ? 'TV Series' : 'Movie'}</Text>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: onSurface }]} numberOfLines={2}>{result.title}</Text>

        {/* Year · Genre · Runtime */}
        {metaParts.length > 0 && (
          <Text style={[styles.meta, { color: onVariant }]}>
            {metaParts.join('  ·  ')}
          </Text>
        )}

        {/* Rating */}
        {result.rating && result.rating !== 'N/A' && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={accent} />
            <Text style={[styles.rating, { color: accent }]}>{result.rating}</Text>
          </View>
        )}

        <View style={[styles.divider, { backgroundColor: accent + '24' }]} />

        {/* Streaming section */}
        {availableProviders.length > 0 ? (
          <View style={styles.streamingSection}>
            <Text style={[styles.streamLabel, { color: onVariant }]}>Where to Stream</Text>
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
                        <View key={code} style={[styles.countryChip, { backgroundColor: surface, borderColor: color + '55' }]}>
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
            <Text style={[styles.streamLabel, { color: onVariant }]}>Not Currently Streaming</Text>
          </View>
        )}

        {/* Branding */}
        <View style={styles.footer}>
          <View style={styles.footerCopy}>
            <Text style={[styles.brandText, { color: accent }]}>trovă</Text>
            <Text style={[styles.tagLine, { color: onVariant }]}>Find where to stream</Text>
          </View>
          <View style={styles.qrWrap}>
            <ShareQrCode value={deepLink} color="#0a0e14" backgroundColor="#ffffff" />
            <Text style={[styles.qrLabel, { color: onVariant }]}>Scan</Text>
          </View>
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
    borderRadius: 20,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  themeWash: {
    bottom: 0,
    left: POSTER_W - 16,
    opacity: 0.95,
    position: 'absolute',
    top: 0,
    width: CARD_W - POSTER_W + 16,
  },
  themeCorner: {
    borderRadius: 90,
    height: 180,
    opacity: 0.28,
    position: 'absolute',
    right: -82,
    top: -86,
    width: 180,
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
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  meta: {
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
    fontSize: 11,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  streamingSection: {
    marginBottom: 14,
  },
  streamLabel: {
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
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  footerCopy: {
    flex: 1,
  },
  brandText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tagLine: {
    fontSize: 9,
    fontWeight: '600',
  },
  qrWrap: {
    alignItems: 'center',
    gap: 3,
  },
  qrCode: {
    borderRadius: 4,
    padding: 4,
  },
  qrRow: {
    flexDirection: 'row',
  },
  qrCell: {
    height: 2,
    width: 2,
  },
  qrLabel: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
