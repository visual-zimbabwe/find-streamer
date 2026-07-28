import React, { useCallback } from 'react';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GridPosterCard } from './GridPosterCard';
import { ProgrammeHairline } from './ProgrammeHairline';
import { GOLD_ACCENT, GRID_PAD, GRID_GAP } from '../theme/programme';
import { scale } from '../utils/responsive';

export { GridPosterCard, PosterGrid } from './GridPosterCard';
export { GRID_COL_W, GRID_POSTER_H } from '../theme/programme';

export function ContentRail({
  title,
  icon = null,
  data,
  colors,
  typography,
  radii,
  onSelectItem,
  onRemoveItem = null,
  headerRight = null,
  variant = 'section',
  showMediaType = true,
  showCaption = true,
}) {
  const renderItem = useCallback(
    ({ item, index }) => (
      <View style={index > 0 ? styles.railItemGap : null}>
        <GridPosterCard
          item={item}
          colors={colors}
          typography={typography}
          radii={radii}
          showMediaType={showMediaType}
          showCaption={showCaption}
          onRemove={onRemoveItem}
          onPress={() => onSelectItem(item)}
        />
      </View>
    ),
    [colors, typography, radii, showMediaType, showCaption, onRemoveItem, onSelectItem],
  );

  const keyExtractor = useCallback((item) => `${item.mediaType || 'movie'}-${item.tmdbId}`, []);

  if (!data?.length) return null;

  return (
    <View style={[styles.railBlock, variant === 'inline' && styles.railBlockInline]}>
      <ProgrammeHairline style={styles.railHairline} />
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
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railList}
        nestedScrollEnabled
        overScrollMode="never"
        decelerationRate="fast"
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
      />
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
  railHairline: {
    marginBottom: scale(18),
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
});
