import React, { memo } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MediaArtwork } from './MediaArtwork';
import { scale } from '../utils/responsive';

const WINDOW_W = Dimensions.get('window').width;
const GRID_PAD = scale(22);
const GRID_GAP = scale(14);
const GRID_COL_W = (WINDOW_W - GRID_PAD * 2 - GRID_GAP) / 2;
const GRID_POSTER_H = GRID_COL_W * 1.5;
const GOLD_ACCENT = '#D4A853';
const GOLD_DIM = 'rgba(212, 168, 83, 0.48)';

const GridPosterCard = memo(function GridPosterCard({ item, colors, typography, radii, onPress }) {
  return (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${item.title}`}
    >
      <View
        style={[
          styles.gridPosterWrap,
          { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.xl },
        ]}
      >
        <MediaArtwork
          uri={item.posterUrl}
          style={styles.gridPosterImg}
          resizeMode="cover"
          accessibilityLabel={`${item.title} poster`}
          title={item.title}
          instant
        />
        {item.ratingValue > 0 && (
          <View style={[styles.ratingBadge, { borderRadius: radii.sm }]}>
            <Text style={styles.ratingBadgeText}>★ {item.ratingValue.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.cardTitle, { color: colors.onSurface, ...typography.labelSm }]}
        numberOfLines={2}
      >
        {item.title}
      </Text>
      <View style={styles.cardMeta}>
        <Ionicons
          name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'}
          size={11}
          color={colors.onSurfaceVariant}
        />
        <Text style={[styles.cardYear, { color: colors.onSurfaceVariant }]}>{item.year}</Text>
      </View>
    </TouchableOpacity>
  );
});

export function CollectionContentRail({
  title,
  data,
  colors,
  typography,
  radii,
  onSelectItem,
  headerRight = null,
}) {
  if (!data?.length) return null;

  const rows = [];
  for (let i = 0; i < data.length; i += 2) {
    rows.push(data.slice(i, i + 2));
  }

  return (
    <View style={styles.railBlock}>
      <View style={[styles.sectionDivider, { backgroundColor: GOLD_DIM }]} />
      <View style={styles.railHeaderRow}>
        <View style={styles.railHeaderLeft}>
          <Ionicons name="albums-outline" size={16} color={GOLD_ACCENT} style={styles.railIcon} />
          <Text
            style={[styles.railTitle, { color: colors.onSurface, ...typography.titleMd }]}
            accessibilityRole="header"
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
        {headerRight}
      </View>
      <View style={styles.gridBody}>
        {rows.map((pair, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.gridRow}>
            {pair.map((item) => (
              <GridPosterCard
                key={`${item.mediaType || 'movie'}-${item.tmdbId}`}
                item={item}
                colors={colors}
                typography={typography}
                radii={radii}
                onPress={() => onSelectItem(item)}
              />
            ))}
            {pair.length === 1 ? <View style={styles.gridCardSpacer} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  railBlock: {
    marginTop: 4,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: GRID_PAD,
    marginBottom: scale(16),
  },
  railHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GRID_PAD,
    marginBottom: scale(12),
    gap: 8,
  },
  railHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  railIcon: {
    flexShrink: 0,
  },
  railTitle: {
    flex: 1,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  gridBody: {
    paddingHorizontal: GRID_PAD,
    gap: GRID_GAP,
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
  gridPosterImg: {
    width: GRID_COL_W,
    height: GRID_POSTER_H,
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  ratingBadgeText: {
    color: '#FFD580',
    fontSize: 11,
    fontWeight: '800',
  },
  cardTitle: {
    marginTop: 8,
    fontWeight: '700',
    lineHeight: 16,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardYear: {
    fontSize: 11,
    fontWeight: '600',
  },
});
