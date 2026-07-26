import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MediaArtwork } from './MediaArtwork';
import { scale } from '../utils/responsive';

/**
 * One poster card on a foot-of-page rail ("More Like This", "More From Cast &
 * Crew").
 *
 * The two rails used to be separate copies of the same markup that had drifted
 * apart: one painted a yellow `IMDb 7.4` chip, the other a bare `7.4` in the
 * same corner, so identical-looking badges meant different things on one
 * screen — and one of them was an unlabelled average that could come from a
 * handful of votes. Neither showed a year. One card, one badge, one meaning.
 *
 * `via` is the attribution line: which person connects this title to the one
 * being viewed. Only the cast-and-crew rail passes it.
 */
export function TitleRailCard({ item, colors, typography, radii, onPress }) {
  const score = typeof item.ratingValue === 'number' && item.ratingValue > 0
    ? item.ratingValue.toFixed(1)
    : null;
  const via = item.viaPersonName || null;
  const typeLabel = item.mediaType === 'tv' ? 'TV series' : 'Film';
  // Reserve two lines from the live token, not a hardcoded pixel count: the
  // token is device-scaled, so a fixed number lets a two-line title shove its
  // year and attribution out of step with the one-line cards beside it.
  const titleHeight = (typography.bodyMd?.lineHeight || 20) * 2;

  const spoken = [
    item.title,
    item.year && item.year !== 'N/A' ? item.year : null,
    typeLabel,
    score ? `TMDb ${score} out of 10` : null,
    via ? `with ${via}${item.viaRole ? `, ${item.viaRole}` : ''}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`${spoken}. Opens details.`}
    >
      <View style={[styles.poster, { borderRadius: radii.md }]}>
        <MediaArtwork
          uri={item.posterUrl}
          style={styles.posterImage}
          accessibilityLabel={`${item.title} poster`}
          title={item.title}
          instant
        />
        {score ? (
          <View style={styles.scoreBadge}>
            {/* Token first, local overrides second — the array's last entry wins. */}
            <Text style={[typography.labelSm, styles.scoreSource]}>TMDb</Text>
            <Text style={[typography.labelSm, styles.scoreValue]}>{score}</Text>
          </View>
        ) : null}
      </View>

      <Text
        style={[
          styles.title,
          { color: colors.onSurface, ...typography.bodyMd, height: titleHeight },
        ]}
        numberOfLines={2}
      >
        {item.title}
      </Text>
      <Text
        style={[styles.meta, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
        numberOfLines={1}
      >
        {item.year && item.year !== 'N/A' ? item.year : typeLabel}
      </Text>
      {via ? (
        <Text
          style={[styles.via, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
          numberOfLines={1}
        >
          {via}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: scale(120),
  },
  poster: {
    aspectRatio: 2 / 3,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
    width: scale(120),
  },
  posterImage: {
    height: '100%',
    width: '100%',
  },
  scoreBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 4,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  scoreSource: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    fontWeight: '700',
  },
  meta: {
    fontWeight: '600',
  },
  via: {
    fontWeight: '700',
    marginTop: 2,
    opacity: 0.85,
  },
});
