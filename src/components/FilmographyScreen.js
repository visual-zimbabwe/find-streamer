import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { EmptyState } from './EmptyState';
import { ResultsSkeleton } from './SkeletonLoaders';
import { GOLD_ACCENT, GOLD_DIM, GRID_PAD } from '../theme/programme';
import { ProgrammeHairline } from './ProgrammeHairline';
import { GridPosterCard, PosterGrid } from './GridPosterCard';
import { scale } from '../utils/responsive';

function FilmographyCard({ item, role, colors, typography, radii, onPress }) {
  const mediaIcon = item.mediaType === 'tv' ? 'tv-outline' : 'film-outline';
  const showTypeBadge =
    role === 'cast' || role === 'writer' || role === 'composer' || role === 'company';

  return (
    <GridPosterCard
      item={item}
      colors={colors}
      typography={typography}
      radii={radii}
      onPress={onPress}
      showMediaIcon={false}
      metaText={`${item.year}${role === 'cast' && item.character ? ` · ${item.character}` : ''}`}
      posterOverlay={
        showTypeBadge ? (
          <View style={styles.typeBadge}>
            <Ionicons name={mediaIcon} size={10} color={GOLD_ACCENT} />
          </View>
        ) : null
      }
    />
  );
}

export function FilmographyScreen({
  personName,
  role,
  results = [],
  onSelectItem,
  loading,
  profileUrl,
  total = null,
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

  const isCompany = role === 'company';

  // A person's filmography is the whole credit list, so its length IS the count.
  // A studio catalogue is a page-1 slice of something far larger — printing the
  // slice as a total is how Columbia Pictures came to claim 22 titles against a
  // real 1,544. Say which it is rather than rounding the truth away.
  const countText =
    total && total > results.length
      ? `Top ${results.length} of ${total.toLocaleString()}`
      : `${results.length} title${results.length !== 1 ? 's' : ''}`;

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
              isCompany && styles.companyAvatar,
              {
                // A studio wordmark is usually black artwork on transparency;
                // on this dark surface it needs a light plate to read at all.
                backgroundColor: isCompany && profileUrl ? '#f2f2ee' : GOLD_ACCENT + '18',
                borderColor: GOLD_DIM,
              },
            ]}
          >
            {profileUrl ? (
              <MediaArtwork
                uri={profileUrl}
                style={styles.avatarImage}
                // `cover` (the default) crops a 1000×269 wordmark to its middle
                // slice — Columbia Pictures rendered as "MBI / URE".
                resizeMode={isCompany ? 'contain' : 'cover'}
                accessibilityLabel={
                  isCompany ? `${personName} logo` : `${personName} profile photo`
                }
                title={personName}
                icon={isCompany ? 'business-outline' : 'person-outline'}
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

        <ProgrammeHairline style={styles.headerHairline} />

        {loading ? (
          <ResultsSkeleton count={4} />
        ) : results.length === 0 ? (
          <EmptyState
            variant="empty"
            title="No titles found"
            description={
              isCompany
                ? "We couldn't find any titles from this studio."
                : "We couldn't find any credits matching this person."
            }
            compact
          />
        ) : (
          <PosterGrid
            bodyStyle={styles.resultsGrid}
            items={results}
            keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
            renderItem={(item) => (
              <FilmographyCard
                item={item}
                role={role}
                colors={colors}
                typography={typography}
                radii={radii}
                onPress={() => onSelectItem(item)}
              />
            )}
          />
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
  // A 64dp circle cannot hold a wordmark at any fit mode: `cover` crops it,
  // `contain` shrinks it past reading size. Studios get a wide rounded plate.
  companyAvatar: {
    borderRadius: scale(12),
    height: scale(56),
    paddingHorizontal: scale(10),
    paddingVertical: scale(8),
    width: scale(148),
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  roleEyebrow: {
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 6,
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
  personName: {
    fontWeight: '800',
    letterSpacing: 0.3,
    paddingEnd: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  countLabel: {
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 6,
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
  headerHairline: {
    marginBottom: scale(24),
  },
  resultsGrid: {
    paddingHorizontal: 0,
  },
  typeBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 4,
    bottom: 8,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    width: 18,
  },
});
