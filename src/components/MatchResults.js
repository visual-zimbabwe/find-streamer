import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { scale, verticalScale } from '../utils/responsive';
import { GOLD_ACCENT, GRID_PAD } from '../theme/programme';
import { ProgrammeSectionHeader } from './ProgrammeSectionHeader';
import { ProgrammeHairline } from './ProgrammeHairline';
import { GridPosterCard, PosterGrid } from './GridPosterCard';

const FEATURE_H = verticalScale(280);

const TopMatchFeature = memo(function TopMatchFeature({
  item,
  colors,
  typography,
  radii,
  saved,
  onPress,
  onToggleWatchlist,
}) {
  const backdrop = item.backdropUrl || item.posterUrl;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${item.title}`}
    >
      <View
        style={[
          styles.featureCard,
          { borderRadius: radii.xl, backgroundColor: colors.surfaceContainerHighest },
        ]}
      >
        <MediaArtwork
          uri={backdrop}
          style={styles.featureImg}
          resizeMode="cover"
          accessibilityLabel={`Backdrop for ${item.title}`}
          title={item.title}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.38)', 'transparent']}
          style={styles.featureTopScrim}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.88)']}
          style={styles.featureBottomScrim}
        />
        {onToggleWatchlist && (
          <TouchableOpacity
            style={[
              styles.featureBookmark,
              { borderColor: saved ? GOLD_ACCENT : 'rgba(255,255,255,0.22)' },
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
              size={20}
              color={saved ? GOLD_ACCENT : '#fff'}
            />
          </TouchableOpacity>
        )}
        <View style={styles.featureContent}>
          <Text style={[styles.featureEyebrow, typography.labelSm]}>Top Match</Text>
          <Text style={[styles.featureTitle, typography.headlineMd]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.synopsis ? (
            <Text style={[styles.featureSynopsis, typography.bodyMd]} numberOfLines={2}>
              {item.synopsis}
            </Text>
          ) : null}
          <View style={styles.featureMetaRow}>
            <Text style={[styles.featureMeta, typography.labelSm]}>{item.year}</Text>
            {item.ratingValue > 0 && (
              <View style={styles.featureRatingPill}>
                <Text style={[styles.featureRatingText, typography.labelSm]}>
                  ★ {item.ratingValue.toFixed(1)}
                </Text>
              </View>
            )}
            <View style={styles.featureTypePill}>
              <Ionicons
                name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'}
                size={12}
                color="#fff"
              />
              <Text style={[styles.featureTypeText, typography.labelSm]}>
                {item.mediaType === 'tv' ? 'Series' : 'Movie'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export function MatchResults({
  matches,
  onSelect,
  onToggleWatchlist,
  watchlistIds = [],
  selectedId,
}) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;

  if (!matches || matches.length === 0) return null;

  const topMatch = matches[0];
  const others = matches.slice(1);
  const savedIds = new Set(watchlistIds);

  return (
    <View style={styles.container}>
      <ProgrammeHairline />

      <ProgrammeSectionHeader
        eyebrow="Results"
        title="Top Matches"
        subtitle={`${matches.length} ${matches.length === 1 ? 'TITLE' : 'TITLES'} FOUND`}
        titleUppercase
      />

      <TopMatchFeature
        item={topMatch}
        colors={colors}
        typography={typography}
        radii={radii}
        saved={savedIds.has(watchlistEntryKey(topMatch))}
        onPress={() => onSelect(topMatch)}
        onToggleWatchlist={onToggleWatchlist}
      />

      {others.length > 0 && (
        <View style={styles.alsoMatchedBlock}>
          <ProgrammeHairline />
          <Text
            style={[styles.alsoMatchedTitle, { color: colors.onSurface, ...typography.labelSm }]}
          >
            Also Matched
          </Text>
          <PosterGrid
            bodyStyle={styles.alsoMatchedGrid}
            items={others}
            keyExtractor={watchlistEntryKey}
            renderItem={(item) => (
              <GridPosterCard
                item={item}
                colors={colors}
                typography={typography}
                radii={radii}
                saved={savedIds.has(watchlistEntryKey(item))}
                onPress={() => onSelect(item)}
                onToggleWatchlist={onToggleWatchlist}
              />
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: scale(8),
    paddingHorizontal: GRID_PAD,
  },
  featureCard: {
    height: FEATURE_H,
    overflow: 'hidden',
    position: 'relative',
  },
  featureImg: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    width: '100%',
  },
  featureTopScrim: {
    height: 80,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  featureBottomScrim: {
    bottom: 0,
    height: '72%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  featureBookmark: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: scale(14),
    top: scale(14),
    width: 48,
    zIndex: 2,
  },
  featureContent: {
    bottom: 0,
    left: 0,
    paddingBottom: scale(20),
    paddingHorizontal: scale(18),
    position: 'absolute',
    right: 0,
  },
  featureEyebrow: {
    color: GOLD_ACCENT,
    fontWeight: '700',
    letterSpacing: 2.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  featureTitle: {
    color: '#fff',
    fontWeight: '800',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  featureSynopsis: {
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
    lineHeight: scale(20),
    marginBottom: 10,
  },
  featureMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureMeta: {
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '600',
  },
  featureRatingPill: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  featureRatingText: {
    color: '#FFD580',
    fontWeight: '800',
  },
  featureTypePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  featureTypeText: {
    color: '#fff',
    fontWeight: '700',
  },
  alsoMatchedBlock: {
    marginTop: scale(28),
  },
  alsoMatchedTitle: {
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: scale(14),
    paddingHorizontal: GRID_PAD,
    textTransform: 'uppercase',
  },
  alsoMatchedGrid: {
    paddingHorizontal: 0,
  },
});
