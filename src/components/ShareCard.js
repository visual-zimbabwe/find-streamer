import React, { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SERVICE_COLORS,
  SERVICE_ICONS,
  buildCountryIndex,
  pickCountries,
  shortName,
} from '../lib/shareUtils';
import { buildTitleWebUrl } from '../lib/shareLinks';
import { createQrMatrix } from '../lib/qrMatrix';

// Always dark palette so the card looks great in any receiver app.
const CARD_BG = '#0a0e14';
const CARD_SURFACE = '#151a21';
const ACCENT = '#9aa8ff';
const ON_SURFACE = '#f1f3fc';
const ON_VARIANT = '#a8abb3';
const BADGE_BG = 'rgba(154, 168, 255, 0.15)';

/**
 * The story canvas is a fixed 9:16 box. Three rows plus a "+N more" line is
 * what fits cleanly; `storyStreaming`'s overflow guard covers the rest (very
 * long titles) so the footer's QR can never be pushed off.
 */
const STORY_PROVIDER_CAP = 3;

export const CARD_FORMATS = {
  card: { key: 'card', label: 'Card', width: 420, height: null, capture: null },
  // 9:16 laid out at 360×640 and captured at 3× — the shape Stories actually want.
  story: { key: 'story', label: 'Story', width: 360, height: 640, capture: { width: 1080, height: 1920 } },
};

function ShareQrCode({ value, color, backgroundColor, cell = 2 }) {
  const matrix = createQrMatrix(value);
  if (!matrix) return null;
  return (
    <View style={[styles.qrCode, { backgroundColor, padding: cell * 2 }]}>
      {matrix.map((row, rowIndex) => (
        <View key={`qr-row-${rowIndex}`} style={styles.qrRow}>
          {row.map((isDark, colIndex) => (
            <View
              key={`qr-cell-${rowIndex}-${colIndex}`}
              style={{
                width: cell,
                height: cell,
                backgroundColor: isDark ? color : backgroundColor,
              }}
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
 * Rendered both as the live preview inside the share sheet and off-screen for
 * ViewShot capture.
 *
 * Props:
 *   result            – full resolved result from resolveMatch()
 *   selectedCountries – { serviceKey: [code, ...] } (optional)
 *                       A key present with an empty array means the user
 *                       deliberately cleared that service, and it drops off the
 *                       card. Only an *absent* key falls back to auto-pick.
 *   format            – 'card' | 'story'
 *   onReadyChange(ready) – false while any image on the card is still loading,
 *                       true once they have all settled. The capture used to
 *                       run on a fixed 400ms timer, which shot half-painted
 *                       cards on a cold cache.
 */
export const ShareCard = forwardRef(function ShareCard(
  { result, selectedCountries, themeColors, format = 'card', onReadyChange },
  ref,
) {
  const isTv = result?.mediaType === 'tv';
  const spec = CARD_FORMATS[format] || CARD_FORMATS.card;
  const isStory = spec.key === 'story';

  const accent = themeColors?.primary || ACCENT;
  const background = themeColors?.background || CARD_BG;
  const surface = themeColors?.surfaceContainer || CARD_SURFACE;
  const surfaceHigh = themeColors?.surfaceContainerHigh || CARD_SURFACE;
  const onSurface = themeColors?.onSurface || ON_SURFACE;
  const onVariant = themeColors?.onSurfaceVariant || ON_VARIANT;

  const shareUrl = buildTitleWebUrl(result);

  // Any country can be picked now, not just the ~45 with a hand-written short
  // name, so the card resolves labels from the rows too.
  const countryIndex = useMemo(() => buildCountryIndex(result?.rows), [result?.rows]);

  // Country resolution per service: an explicitly-emptied service stays empty.
  const countriesFor = useCallback(
    (serviceKey) => {
      if (selectedCountries && Object.prototype.hasOwnProperty.call(selectedCountries, serviceKey)) {
        return selectedCountries[serviceKey] || [];
      }
      return pickCountries(result?.rows, serviceKey);
    },
    [selectedCountries, result?.rows],
  );

  const providerRows = useMemo(
    () =>
      (result?.providerSummary || [])
        .filter((p) => p.count > 0)
        .map((p) => ({ ...p, countries: countriesFor(p.key) }))
        .filter((p) => p.countries.length > 0),
    [result?.providerSummary, countriesFor],
  );

  /**
   * Only the rows this format actually renders. Readiness counts settled images
   * against this list, so it must be the same list the layout draws — when the
   * story cap trimmed the rendered rows but not this one, the expected count
   * was never reachable and capture blocked forever.
   */
  const visibleProviderRows = useMemo(
    () => (isStory ? providerRows.slice(0, STORY_PROVIDER_CAP) : providerRows),
    [providerRows, isStory],
  );

  // ── Image readiness ──────────────────────────────────────────────────────
  const imageUris = useMemo(() => {
    const uris = [];
    if (result?.posterUrl) uris.push(result.posterUrl);
    visibleProviderRows.forEach((p) => {
      if (p.logoUrl) uris.push(p.logoUrl);
    });
    return uris;
  }, [result?.posterUrl, visibleProviderRows]);

  // `format` is part of the key on purpose: the two layouts mount their own
  // <Image> elements, so switching format remounts them even though the URI
  // list may be identical. Without it the latch would stay armed from the
  // previous layout and capture a blank poster.
  const imageKey = `${format}|${imageUris.join('|')}`;
  const settledRef = useRef(new Set());
  const keyRef = useRef(null);
  const reportedRef = useRef(null);

  // Reset during render, before the new <Image> children can report — an effect
  // here could land *after* a cached load and strand the latch at false.
  if (keyRef.current !== imageKey) {
    keyRef.current = imageKey;
    settledRef.current = new Set();
    reportedRef.current = null;
  }

  /**
   * Recomputes readiness from the settled set rather than latching on an event,
   * so it doesn't matter whether loads or effects run first.
   */
  const evaluateReady = useCallback(() => {
    const ready = settledRef.current.size >= imageUris.length;
    if (reportedRef.current !== ready) {
      reportedRef.current = ready;
      onReadyChange?.(ready);
    }
  }, [imageUris.length, onReadyChange]);

  useEffect(() => {
    evaluateReady();
  }, [evaluateReady, imageKey]);

  const markSettled = useCallback(
    (uri) => {
      settledRef.current.add(uri);
      evaluateReady();
    },
    [evaluateReady],
  );

  if (!result) return null;

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
  const genreShort =
    result.genres && result.genres !== 'N/A'
      ? result.genres
          .split(',')
          .slice(0, 3)
          .map((g) => g.trim())
          .join(' · ')
      : null;
  const metaParts = [result.year !== 'N/A' ? result.year : null, genreShort, runtimeLabel()].filter(
    Boolean,
  );

  const hasAnyProvider = (result.providerSummary || []).some((p) => p.count > 0);

  const renderProviderList = (compact) => (
    <View style={compact ? styles.providerList : styles.providerListStory}>
      {visibleProviderRows.map((p) => {
        const color = SERVICE_COLORS[p.key];
        return (
          <View key={p.key} style={styles.providerServiceRow}>
            <View style={styles.providerServiceName}>
              {p.logoUrl ? (
                <Image
                  source={{ uri: p.logoUrl }}
                  style={compact ? styles.providerLogo : styles.providerLogoStory}
                  resizeMode="contain"
                  onLoadEnd={() => markSettled(p.logoUrl)}
                />
              ) : (
                <Ionicons
                  name={SERVICE_ICONS[p.key] || 'play-circle'}
                  size={compact ? 11 : 15}
                  color={color}
                />
              )}
              <Text
                style={[compact ? styles.providerName : styles.providerNameStory, { color }]}
                numberOfLines={1}
              >
                {p.label}
              </Text>
            </View>
            <View style={styles.countryChips}>
              {p.countries.map((code) => (
                <View
                  key={code}
                  style={[
                    compact ? styles.countryChip : styles.countryChipStory,
                    { backgroundColor: surface, borderColor: color + '55' },
                  ]}
                >
                  <Text
                    style={[
                      compact ? styles.countryChipText : styles.countryChipTextStory,
                      { color },
                    ]}
                    numberOfLines={1}
                  >
                    {shortName(code, countryIndex.labels)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );

  const streamingLabel = hasAnyProvider ? 'Where to Stream' : 'Not Currently Streaming';

  // ── Story (9:16) ─────────────────────────────────────────────────────────
  if (isStory) {
    return (
      <View
        ref={ref}
        style={[
          styles.story,
          { width: spec.width, height: spec.height, backgroundColor: background },
        ]}
        collapsable={false}
      >
        {/* The poster absorbs whatever the content block doesn't need. Sizing it
            fixed meant hand-budgeting every row against a 640dp box, and a
            provider-heavy title clipped mid-row. */}
        <View style={[styles.storyPosterWrap, { backgroundColor: surface }]}>
          {result.posterUrl ? (
            <Image
              source={{ uri: result.posterUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onLoadEnd={() => markSettled(result.posterUrl)}
            />
          ) : (
            <Ionicons name={isTv ? 'tv-outline' : 'film-outline'} size={72} color={onVariant} />
          )}
        </View>
        <View style={[styles.storyCorner, { backgroundColor: surfaceHigh }]} />
        <View style={[styles.storyRule, { backgroundColor: accent + '44' }]} />

        <View style={styles.storyContent}>
          <View style={[styles.typePill, { backgroundColor: accent + '26' }]}>
            <Ionicons name={isTv ? 'tv-outline' : 'film-outline'} size={12} color={accent} />
            <Text style={[styles.typeTextStory, { color: accent }]}>
              {isTv ? 'TV SERIES' : 'MOVIE'}
            </Text>
          </View>

          <Text style={[styles.titleStory, { color: onSurface }]} numberOfLines={2}>
            {result.title}
          </Text>

          {metaParts.length > 0 && (
            <Text style={[styles.metaStory, { color: onVariant }]} numberOfLines={1}>
              {metaParts.join('  ·  ')}
            </Text>
          )}

          {result.rating && result.rating !== 'N/A' && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={15} color={accent} />
              <Text style={[styles.ratingStory, { color: accent }]}>{result.rating}</Text>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: accent + '24' }]} />

          <View style={styles.storyStreaming}>
            <Text style={[styles.streamLabelStory, { color: onVariant }]}>{streamingLabel}</Text>
            {providerRows.length > 0 && renderProviderList(false)}
          </View>
          {providerRows.length > STORY_PROVIDER_CAP ? (
            <Text style={[styles.storyMore, { color: onVariant }]}>
              {`+${providerRows.length - STORY_PROVIDER_CAP} more`}
            </Text>
          ) : null}

          <View style={styles.storyFooter}>
            <View style={styles.footerCopy}>
              <Text style={[styles.brandTextStory, { color: accent }]}>trovă</Text>
              <Text style={[styles.tagLineStory, { color: onVariant }]}>Find where to stream</Text>
            </View>
            {shareUrl ? (
              <View style={styles.qrWrap}>
                <ShareQrCode value={shareUrl} color="#0a0e14" backgroundColor="#ffffff" cell={2} />
                <Text style={[styles.qrLabelStory, { color: onVariant }]}>SCAN</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  // ── Card (landscape) ─────────────────────────────────────────────────────
  return (
    <View
      ref={ref}
      style={[
        styles.card,
        { width: spec.width, backgroundColor: background, borderColor: accent + '33' },
      ]}
      collapsable={false}
    >
      <View style={[styles.themeWash, { backgroundColor: accent + '1F' }]} />
      <View style={[styles.themeCorner, { backgroundColor: surfaceHigh }]} />
      {result.posterUrl ? (
        <Image
          source={{ uri: result.posterUrl }}
          style={styles.poster}
          resizeMode="cover"
          onLoadEnd={() => markSettled(result.posterUrl)}
        />
      ) : (
        <View style={[styles.poster, styles.posterFallback, { backgroundColor: surface }]}>
          <Ionicons name={isTv ? 'tv-outline' : 'film-outline'} size={48} color={onVariant} />
        </View>
      )}

      <View style={[styles.content, { backgroundColor: background }]}>
        <View style={[styles.typePill, { backgroundColor: accent + '26' }]}>
          <Ionicons name={isTv ? 'tv-outline' : 'film-outline'} size={10} color={accent} />
          <Text style={[styles.typeText, { color: accent }]}>{isTv ? 'TV Series' : 'Movie'}</Text>
        </View>

        <Text style={[styles.title, { color: onSurface }]} numberOfLines={2}>
          {result.title}
        </Text>

        {metaParts.length > 0 && (
          <Text style={[styles.meta, { color: onVariant }]}>{metaParts.join('  ·  ')}</Text>
        )}

        {result.rating && result.rating !== 'N/A' && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={accent} />
            <Text style={[styles.rating, { color: accent }]}>{result.rating}</Text>
          </View>
        )}

        <View style={[styles.divider, { backgroundColor: accent + '24' }]} />

        <View style={styles.streamingSection}>
          <Text style={[styles.streamLabel, { color: onVariant }]}>{streamingLabel}</Text>
          {providerRows.length > 0 && renderProviderList(true)}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerCopy}>
            <Text style={[styles.brandText, { color: accent }]}>trovă</Text>
            <Text style={[styles.tagLine, { color: onVariant }]}>Find where to stream</Text>
          </View>
          {shareUrl ? (
            <View style={styles.qrWrap}>
              <ShareQrCode value={shareUrl} color="#0a0e14" backgroundColor="#ffffff" cell={2} />
              <Text style={[styles.qrLabel, { color: onVariant }]}>Scan</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const CARD_W = CARD_FORMATS.card.width;
const POSTER_W = 140;

const styles = StyleSheet.create({
  card: {
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
    flexShrink: 1,
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
  },
  qrRow: {
    flexDirection: 'row',
  },
  qrLabel: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  // ── Story (9:16) ─────────────────────────────────────────────────────────
  story: {
    overflow: 'hidden',
    position: 'relative',
  },
  storyPosterWrap: {
    width: '100%',
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  storyCorner: {
    borderRadius: 110,
    height: 220,
    opacity: 0.22,
    position: 'absolute',
    right: -96,
    top: 250,
    width: 220,
  },
  storyRule: {
    height: 2,
    width: '100%',
  },
  // Natural height — never squeezed, so nothing inside it can be clipped.
  storyContent: {
    flexShrink: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  typeTextStory: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  titleStory: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  metaStory: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 18,
  },
  ratingStory: {
    fontSize: 14,
    fontWeight: '800',
  },
  storyStreaming: {
    flexShrink: 0,
  },
  storyMore: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  streamLabelStory: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  providerListStory: {
    gap: 12,
  },
  providerLogoStory: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  providerNameStory: {
    fontSize: 13,
    fontWeight: '800',
  },
  countryChipStory: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  countryChipTextStory: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  storyFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexShrink: 0,
    gap: 12,
    marginTop: 12,
  },
  brandTextStory: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tagLineStory: {
    fontSize: 12,
    fontWeight: '600',
  },
  qrLabelStory: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
