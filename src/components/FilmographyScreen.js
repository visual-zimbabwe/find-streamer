import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { EmptyState } from './EmptyState';
import { ResultsSkeleton } from './SkeletonLoaders';
import { GOLD_ACCENT, GOLD_DIM, GRID_PAD, GRID_GAP, gridColWidth } from '../theme/programme';
import { scale } from '../utils/responsive';

const WINDOW_W = Dimensions.get('window').width;
const GRID_COL_W = gridColWidth(WINDOW_W);
const GRID_POSTER_H = GRID_COL_W * 1.5;

function ratingForCard(rating) {
  if (rating == null || rating === '') return '';
  const s = String(rating);
  if (s === 'N/A') return 'N/A';
  return s.split('/')[0];
}

function buildGridRows(items) {
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

function FilmographyCard({ item, role, colors, typography, radii, onPress }) {
  const mediaIcon = item.mediaType === 'tv' ? 'tv-outline' : 'film-outline';
  const showTypeBadge =
    role === 'cast' || role === 'writer' || role === 'composer' || role === 'company';
  const rating = ratingForCard(item.rating);

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
          styles.posterWrap,
          { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.xl },
        ]}
      >
        <MediaArtwork
          uri={item.posterUrl}
          style={styles.posterImg}
          resizeMode="cover"
          accessibilityLabel={`${item.title} poster`}
          title={item.title}
          instant
        />
        {rating ? (
          <View style={[styles.ratingBadge, { borderRadius: radii.sm }]}>
            <Text style={styles.ratingBadgeText}>{rating}</Text>
          </View>
        ) : null}
        {showTypeBadge ? (
          <View style={[styles.typeBadge, { backgroundColor: 'rgba(0,0,0,0.72)' }]}>
            <Ionicons name={mediaIcon} size={10} color={GOLD_ACCENT} />
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.cardTitle, { color: colors.onSurface, ...typography.labelSm }]}
        numberOfLines={2}
      >
        {item.title}
      </Text>
      <Text style={[styles.cardMeta, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
        {item.year}
        {role === 'cast' && item.character ? ` · ${item.character}` : ''}
      </Text>
    </TouchableOpacity>
  );
}

export function FilmographyScreen({
  personName,
  role,
  results = [],
  onSelectItem,
  loading,
  profileUrl,
}) {
  const { theme, resolvedMode } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const bottomNavScroll = useBottomNavScroll();

  const roleLabel =
    role === 'cast'
      ? 'Starring In'
      : role === 'writer'
        ? 'Writing Credits'
        : role === 'composer'
          ? 'Music By'
          : role === 'company'
            ? 'Titles From'
            : role === 'movie'
              ? 'Directed By'
              : 'Created By';

  const countText = `${results.length} title${results.length !== 1 ? 's' : ''}`;
  const gridRows = useMemo(() => buildGridRows(results), [results]);

  const atmosphereColors = [
    resolvedMode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerLow,
    colors.background,
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={atmosphereColors} style={styles.atmosphereTop} pointerEvents="none" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 112 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        {...bottomNavScroll}
      >
        <View style={styles.pageHeader}>
          <View
            style={[
              styles.personAvatar,
              { backgroundColor: GOLD_ACCENT + '18', borderColor: GOLD_DIM },
            ]}
          >
            {profileUrl ? (
              <MediaArtwork
                uri={profileUrl}
                style={styles.avatarImage}
                accessibilityLabel={`${personName} profile photo`}
                title={personName}
                icon="person-outline"
                compactFallback
              />
            ) : (
              <Ionicons
                name={
                  role === 'cast'
                    ? 'star'
                    : role === 'writer'
                      ? 'create-outline'
                      : role === 'composer'
                        ? 'musical-notes-outline'
                        : role === 'company'
                          ? 'business-outline'
                          : 'person'
                }
                size={26}
                color={GOLD_ACCENT}
              />
            )}
          </View>
          <Text style={[styles.roleEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
            {roleLabel}
          </Text>
          <Text
            style={[styles.personName, { color: colors.onSurface, ...typography.titleMd }]}
            numberOfLines={2}
            accessibilityRole="header"
          >
            {personName}
          </Text>
          {!loading && (
            <Text style={[styles.countLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
              {countText}
            </Text>
          )}
        </View>

        <View style={[styles.headerHairline, { backgroundColor: GOLD_DIM }]} />

        {loading ? (
          <ResultsSkeleton count={4} />
        ) : results.length === 0 ? (
          <EmptyState
            variant="empty"
            title="No titles found"
            description="We couldn't find any credits matching this person."
            compact
          />
        ) : (
          <View style={styles.gridBody}>
            {gridRows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.gridRow}>
                {row.map((item) => (
                  <FilmographyCard
                    key={`${item.mediaType}-${item.tmdbId}`}
                    item={item}
                    role={role}
                    colors={colors}
                    typography={typography}
                    radii={radii}
                    onPress={() => onSelectItem(item)}
                  />
                ))}
                {row.length === 1 ? <View style={styles.gridCardSpacer} /> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  atmosphereTop: {
    height: scale(220),
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: GRID_PAD,
    paddingTop: scale(28),
  },
  pageHeader: {
    alignItems: 'center',
    marginBottom: scale(18),
  },
  personAvatar: {
    alignItems: 'center',
    borderRadius: scale(32),
    borderWidth: StyleSheet.hairlineWidth,
    height: scale(64),
    justifyContent: 'center',
    marginBottom: scale(14),
    overflow: 'hidden',
    width: scale(64),
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  roleEyebrow: {
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  personName: {
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  countLabel: {
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  headerHairline: {
    height: StyleSheet.hairlineWidth,
    marginBottom: scale(24),
    opacity: 0.65,
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
  posterWrap: {
    height: GRID_POSTER_H,
    overflow: 'hidden',
    position: 'relative',
    width: GRID_COL_W,
  },
  posterImg: {
    height: '100%',
    width: '100%',
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
  typeBadge: {
    alignItems: 'center',
    borderRadius: 4,
    justifyContent: 'center',
    left: 8,
    paddingHorizontal: 5,
    paddingVertical: 3,
    position: 'absolute',
    top: 8,
  },
  cardTitle: {
    fontWeight: '700',
    marginTop: 8,
    minHeight: 34,
  },
  cardMeta: {
    fontWeight: '600',
    marginTop: 2,
  },
});
