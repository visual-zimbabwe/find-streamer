import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GridPosterCard } from './GridPosterCard';
import { ProgrammeHairline } from './ProgrammeHairline';
import { GOLD_ACCENT, GRID_PAD, GRID_GAP } from '../theme/programme';
import { scale } from '../utils/responsive';

export { GridPosterCard, PosterGrid, GRID_COL_W, GRID_POSTER_H } from './GridPosterCard';

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
