import React, { memo } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MediaArtwork } from './MediaArtwork';
import { scale } from '../utils/responsive';

const WINDOW_W = Dimensions.get('window').width;
const GRID_PAD = scale(22);
const GRID_GAP = scale(14);
const GRID_COL_W = (WINDOW_W - GRID_PAD * 2 - GRID_GAP) / 2;
const GRID_POSTER_H = GRID_COL_W * 1.5;
const GOLD_ACCENT = '#D4A853';

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

export function ContentRail({
  title,
  icon = null,
  data,
  colors,
  typography,
  radii,
  onSelectItem,
  headerRight = null,
  variant = 'section',
}) {
  if (!data?.length) return null;

  return (
    <View style={[styles.railBlock, variant === 'inline' && styles.railBlockInline]}>
      <View style={[styles.sectionDivider, { backgroundColor: colors.outlineVariant }]} />
      <View style={styles.railHeaderRow}>
        <View style={styles.railHeaderLeft}>
          {icon ? (
            <Ionicons name={icon} size={16} color={GOLD_ACCENT} style={styles.railIcon} />
          ) : null}
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railList}
        nestedScrollEnabled
        overScrollMode="never"
        decelerationRate="fast"
        removeClippedSubviews={Platform.OS === 'android'}
      >
        {data.map((item, index) => (
          <View
            key={`${item.mediaType || 'movie'}-${item.tmdbId}`}
            style={index > 0 ? styles.railItemGap : null}
          >
            <GridPosterCard
              item={item}
              colors={colors}
              typography={typography}
              radii={radii}
              onPress={() => onSelectItem(item)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  railBlock: {
    marginTop: scale(28),
    paddingHorizontal: GRID_PAD,
  },
  railBlockInline: {
    marginTop: scale(4),
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: scale(18),
    opacity: 0.65,
  },
  railHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(14),
    gap: 8,
  },
  railHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  railIcon: {
    marginTop: 1,
  },
  railTitle: {
    flex: 1,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: scale(13),
  },
  railList: {
    paddingRight: GRID_PAD,
  },
  railItemGap: {
    marginLeft: GRID_GAP,
  },
  gridCard: {
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
  cardTitle: { marginTop: 8, fontWeight: '700', minHeight: 34 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardYear: { fontSize: 11, fontWeight: '600' },
});
