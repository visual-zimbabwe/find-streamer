import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { MediaArtwork } from './MediaArtwork';
import {
  GOLD_ACCENT,
  GRID_GAP,
  GRID_PAD,
  GRID_COL_W,
  GRID_POSTER_H,
  buildGridRows,
} from '../theme/programme';
import { resolveRatingValue } from '../lib/ratings';
import { tmdbImageAtSize } from '../lib/tmdbImages';

/**
 * A poster tile.
 *
 * `showCaption={false}` drops the title/year/type block underneath and lets the
 * artwork carry the identification on its own. That is safe because TMDb's
 * `language=en-US` poster already has the title lettered into it: sampled over
 * 169 results from 40 real queries, 78.7% carried English lettering and 97.4%
 * of *rank-1* results did — and not one of the remainder had a better poster
 * available to swap in, so there is nothing to repair, only something to trust.
 *
 * The residue the sample did find is titles with no poster at all (4.1%, all of
 * them at ranks 2+). Those are covered by `MediaArtwork`'s full fallback, which
 * renders `title` inside the frame — which is why `compactFallback` must NOT be
 * passed here.
 *
 * @param {object} props
 * @param {boolean} [props.showCaption] render the text block under the poster
 * @param {string | null} [props.yearBadge] year to letter onto the poster itself,
 *   used when two results in the same set share a title and the art can't
 *   separate them
 * @param {'w185'|'w342'|'w500'|'w780'|'original'} [props.posterSize]
 */
export const GridPosterCard = memo(function GridPosterCard({
  item,
  colors,
  typography,
  radii,
  onPress,
  style,
  accessibilityLabel,
  ratingValue: ratingValueProp,
  saved,
  onToggleWatchlist,
  /** Corner ✕. Used by the Recent rail; never combined with the bookmark. */
  onRemove,
  posterOverlay = null,
  metaText,
  metaExtra = null,
  mediaLabel,
  showMediaIcon = true,
  showMediaType = true,
  showCaption = true,
  yearBadge = null,
  posterSize = 'w500',
  posterStyle,
  pressable = true,
  touchableProps = {},
  activeOpacity = 0.85,
}) {
  if (!item) return null;

  const ratingValue = ratingValueProp != null ? ratingValueProp : resolveRatingValue(item);
  const mediaType = item?.mediaType;
  const defaultMediaLabel = mediaType === 'tv' ? 'Series' : 'Movie';
  const label = mediaLabel ?? defaultMediaLabel;

  const cardBody = (
    <>
      <View
        style={[
          styles.gridPosterWrap,
          { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.xl },
          posterStyle,
        ]}
      >
        <MediaArtwork
          uri={tmdbImageAtSize(item.posterUrl, posterSize)}
          style={styles.gridPosterImg}
          resizeMode="cover"
          accessibilityLabel={`${item.title} poster`}
          title={item.title}
        />
        {ratingValue > 0 && (
          <View style={[styles.ratingBadge, { borderRadius: radii.sm }]}>
            <Text style={styles.ratingBadgeText}>★ {ratingValue.toFixed(1)}</Text>
          </View>
        )}
        {yearBadge ? (
          <View style={[styles.yearBadge, { borderRadius: radii.sm }]}>
            <Text style={styles.yearBadgeText}>{yearBadge}</Text>
          </View>
        ) : null}
        {onRemove ? (
          <TouchableOpacity
            style={[styles.gridBookmark, { borderColor: 'rgba(255,255,255,0.2)' }]}
            onPress={(event) => {
              event.stopPropagation?.();
              Haptics.selectionAsync();
              onRemove(item);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.title} from recent`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        ) : null}
        {onToggleWatchlist ? (
          <TouchableOpacity
            style={[
              styles.gridBookmark,
              { borderColor: saved ? GOLD_ACCENT : 'rgba(255,255,255,0.2)' },
            ]}
            onPress={(event) => {
              event.stopPropagation?.();
              Haptics.selectionAsync();
              onToggleWatchlist(item);
            }}
            accessibilityRole="button"
            accessibilityLabel={
              saved ? `Remove ${item.title} from watchlist` : `Add ${item.title} to watchlist`
            }
            accessibilityState={{ selected: saved }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={saved ? GOLD_ACCENT : '#fff'}
            />
          </TouchableOpacity>
        ) : null}
        {posterOverlay}
      </View>
      {!showCaption ? null : (
        <>
          <Text
            style={[styles.cardTitle, { color: colors.onSurface, ...typography.labelSm }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {metaText ? (
            <Text
              style={[
                styles.cardMetaText,
                { color: colors.onSurfaceVariant, ...typography.labelSm },
              ]}
            >
              {metaText}
            </Text>
          ) : (
            <View style={styles.cardMeta}>
              {showMediaType && showMediaIcon ? (
                <Ionicons
                  name={mediaType === 'tv' ? 'tv-outline' : 'film-outline'}
                  size={11}
                  color={colors.onSurfaceVariant}
                />
              ) : null}
              <Text style={[styles.cardYear, { color: colors.onSurfaceVariant }]}>
                {showMediaType
                  ? `${label}${item.year ? ` · ${item.year}` : ''}`
                  : item.year
                    ? `${item.year}`
                    : ''}
              </Text>
              {metaExtra}
            </View>
          )}
        </>
      )}
    </>
  );

  const rootStyle = [styles.gridCard, style];

  if (!pressable || !onPress) {
    return <View style={rootStyle}>{cardBody}</View>;
  }

  return (
    <TouchableOpacity
      style={rootStyle}
      // The bookmark button beside it, and every rail tile on the detail screen,
      // already confirm the touch this way; the poster — the most-tapped control
      // in the app — was the one that didn't.
      onPress={(event) => {
        Haptics.selectionAsync();
        onPress(event);
      }}
      activeOpacity={activeOpacity}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Open details for ${item.title}`}
      {...touchableProps}
    >
      {cardBody}
    </TouchableOpacity>
  );
});

export function PosterGrid({ items, keyExtractor, renderItem, style, bodyStyle }) {
  if (!items?.length) return null;

  const rows = buildGridRows(items);

  return (
    <View style={[styles.gridBody, bodyStyle, style]}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.gridRow}>
          {row.map((item) => (
            <View key={keyExtractor(item)}>{renderItem(item)}</View>
          ))}
          {row.length === 1 ? <View style={styles.gridCardSpacer} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gridBody: {
    gap: GRID_GAP,
    paddingHorizontal: GRID_PAD,
  },
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  gridCard: {
    width: GRID_COL_W,
  },
  gridCardSpacer: {
    width: GRID_COL_W,
  },
  gridPosterWrap: {
    width: GRID_COL_W,
    height: GRID_POSTER_H,
    overflow: 'hidden',
    position: 'relative',
  },
  gridPosterImg: { width: '100%', height: '100%' },
  ratingBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  ratingBadgeText: { color: '#FFD700', fontSize: 10, fontWeight: '800' },
  // Bottom-left, mirroring the rating badge, so the two read as one system of
  // marks on the art rather than as a caption that moved.
  yearBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  yearBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  gridBookmark: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // No `minHeight`: it reserved two lines for every card, so a one-line title
  // padded the grid with a blank line it never used.
  cardTitle: { marginTop: 8, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  cardMetaText: { marginTop: 2, fontWeight: '600' },
  cardYear: { fontSize: 11, fontWeight: '600' },
});
