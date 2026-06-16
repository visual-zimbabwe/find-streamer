import React, { memo } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { scale, verticalScale } from '../utils/responsive';

const WINDOW_W = Dimensions.get('window').width;
const GRID_PAD = scale(22);
const GRID_GAP = scale(14);
const GRID_COL_W = (WINDOW_W - GRID_PAD * 2 - GRID_GAP) / 2;
const GRID_POSTER_H = GRID_COL_W * 1.5;
const FEATURE_H = verticalScale(280);
const GOLD_ACCENT = '#D4A853';
const GOLD_DIM = 'rgba(212, 168, 83, 0.48)';

function ProgrammeSectionHeader({ eyebrow, title, subtitle, colors, typography }) {
  return (
    <View style={styles.sectionHeader}>
      {eyebrow ? (
        <Text style={[styles.sectionEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
          {eyebrow}
        </Text>
      ) : null}
      <Text
        style={[styles.sectionTitle, { color: colors.onSurface, ...typography.titleMd }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.sectionSubtitle,
            { color: colors.onSurfaceVariant, ...typography.labelSm },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

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

const MatchGridCard = memo(function MatchGridCard({
  item,
  colors,
  typography,
  radii,
  saved,
  onPress,
  onToggleWatchlist,
}) {
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
        {onToggleWatchlist && (
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
        <Text style={[styles.cardYear, { color: colors.onSurfaceVariant }]}>
          {item.mediaType === 'tv' ? 'Series' : 'Movie'} · {item.year}
        </Text>
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

  const gridRows = [];
  for (let i = 0; i < others.length; i += 2) {
    gridRows.push(others.slice(i, i + 2));
  }

  return (
    <View style={styles.container}>
      <View style={[styles.sectionDivider, { backgroundColor: colors.outlineVariant }]} />

      <ProgrammeSectionHeader
        eyebrow="Results"
        title="Top Matches"
        subtitle={`${matches.length} ${matches.length === 1 ? 'TITLE' : 'TITLES'} FOUND`}
        colors={colors}
        typography={typography}
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
          <View style={[styles.sectionDivider, { backgroundColor: colors.outlineVariant }]} />
          <Text
            style={[styles.alsoMatchedTitle, { color: colors.onSurface, ...typography.labelSm }]}
          >
            Also Matched
          </Text>
          <View style={styles.gridBody}>
            {gridRows.map((pair, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.gridRow}>
                {pair.map((item) => (
                  <MatchGridCard
                    key={watchlistEntryKey(item)}
                    item={item}
                    colors={colors}
                    typography={typography}
                    radii={radii}
                    saved={savedIds.has(watchlistEntryKey(item))}
                    onPress={() => onSelect(item)}
                    onToggleWatchlist={onToggleWatchlist}
                  />
                ))}
                {pair.length === 1 ? <View style={styles.gridCardSpacer} /> : null}
              </View>
            ))}
          </View>
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
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: scale(18),
    opacity: 0.65,
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: scale(18),
  },
  sectionEyebrow: {
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 6,
    textTransform: 'uppercase',
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
    textTransform: 'uppercase',
  },
  gridBody: {
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
    height: GRID_POSTER_H,
    overflow: 'hidden',
    position: 'relative',
    width: GRID_COL_W,
  },
  gridPosterImg: {
    height: '100%',
    width: '100%',
  },
  gridBookmark: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 40,
  },
  ratingBadge: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: 'absolute',
    top: 8,
  },
  ratingBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
  },
  cardTitle: {
    fontWeight: '700',
    marginTop: 8,
    minHeight: 34,
  },
  cardMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  cardYear: {
    fontSize: 11,
    fontWeight: '600',
  },
});
