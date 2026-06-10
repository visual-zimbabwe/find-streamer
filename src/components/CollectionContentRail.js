import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MediaArtwork } from './MediaArtwork';
import { scale } from '../utils/responsive';

const POSTER_W = scale(118);
const POSTER_H = POSTER_W * 1.5;

function CollectionPosterCard({ item, colors, typography, radii, onPress }) {
  return (
    <TouchableOpacity
      style={styles.posterCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${item.title}`}
    >
      <View style={[styles.posterWrap, { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.xl }]}>
        <MediaArtwork
          uri={item.posterUrl}
          style={styles.posterImg}
          resizeMode="cover"
          accessibilityLabel={`${item.title} poster`}
          title={item.title}
        />
        {item.ratingValue > 0 && (
          <View style={[styles.ratingBadge, { borderRadius: radii.sm }]}>
            <Text style={styles.ratingBadgeText}>★ {item.ratingValue.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.cardTitle, { color: colors.onSurface, ...typography.labelSm }]} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={styles.cardMeta}>
        <Ionicons name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'} size={11} color={colors.onSurfaceVariant} />
        <Text style={[styles.cardYear, { color: colors.onSurfaceVariant }]}>{item.year}</Text>
      </View>
    </TouchableOpacity>
  );
}

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

  return (
    <View style={styles.railBlock}>
      <View style={styles.railHeaderRow}>
        <Text
          style={[styles.railTitle, { color: colors.onSurface, ...typography.titleMd }]}
          accessibilityRole="header"
          numberOfLines={2}
        >
          {title}
        </Text>
        {headerRight}
      </View>
      <FlatList
        horizontal
        nestedScrollEnabled
        data={data}
        keyExtractor={(item) => `${item.mediaType || 'movie'}-${item.tmdbId}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railList}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        renderItem={({ item }) => (
          <CollectionPosterCard
            item={item}
            colors={colors}
            typography={typography}
            radii={radii}
            onPress={() => onSelectItem(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  railBlock: {
    marginTop: 4,
  },
  railHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
    marginBottom: 12,
    gap: 8,
  },
  railTitle: {
    flex: 1,
    fontWeight: '800',
    paddingHorizontal: 20,
  },
  railList: {
    paddingHorizontal: 16,
  },
  posterCard: {
    width: POSTER_W,
  },
  posterWrap: {
    width: POSTER_W,
    height: POSTER_H,
    overflow: 'hidden',
    position: 'relative',
  },
  posterImg: {
    width: '100%',
    height: '100%',
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
