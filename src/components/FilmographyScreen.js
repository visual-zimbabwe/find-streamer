import React, { useMemo } from 'react';
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
import { ContentRailSkeleton } from './SkeletonLoaders';
import { GOLD_ACCENT, GOLD_DIM, GRID_PAD } from '../theme/programme';
import { ProgrammeHairline } from './ProgrammeHairline';
import { GlassIconButton } from './GlassIconButton';
import { ContentRail } from './ContentRail';
import { partitionFilmographyCredits } from '../lib/actorFilmographyModel';
import { franchiseCountLabel, franchiseTileMeta, releaseStateFor } from '../lib/franchise';
import { scale } from '../utils/responsive';

export function FilmographyScreen({
  personName,
  role,
  results = [],
  rails = null,
  onSelectItem,
  loading,
  profileUrl,
  total = null,
  currentTmdbId = null,
  onBack,
}) {
  const { theme } = useTheme();
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
            : role === 'collection'
              ? 'Films In'
              : role === 'movie'
                ? 'Directed By'
                : 'Created By';

  const isCompany = role === 'company';
  const isCollection = role === 'collection';

  // Release order is the spine of a collection, and it has to survive the rails:
  // the badge states a film's place in the WHOLE set, not its cell position.
  const items = useMemo(
    () =>
      isCollection ? results.map((item, index) => ({ ...item, order: index + 1 })) : results,
    [isCollection, results],
  );

  // A person's filmography is the whole credit list, so its length IS the count.
  // A studio catalogue is a page-1 slice of something far larger — printing the
  // slice as a total is how Columbia Pictures came to claim 22 titles against a
  // real 1,544. Say which it is rather than rounding the truth away.
  // A collection is complete but not all watchable, so it splits the other way.
  const countText = isCollection
    ? franchiseCountLabel(results)
    : total && total > results.length
      ? `Top ${results.length} of ${total.toLocaleString()}`
      : `${results.length} title${results.length !== 1 ? 's' : ''}`;

  // Resolve role rails for talent (partitioned by Acting, Directing, Writing, Music)
  const resolvedRails = useMemo(() => {
    if (rails && rails.length > 0) return rails;
    if (isCollection || isCompany) return null;
    if (!results || results.length === 0) return [];
    const { rails: derived } = partitionFilmographyCredits({ cast: results, crew: [] }, role, 30);
    return derived;
  }, [rails, results, isCollection, isCompany, role]);

  const atmosphereColors = [colors.surfaceContainerHigh, colors.background];
  const hasRails = resolvedRails && resolvedRails.length > 0;
  const hasItems = items && items.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={atmosphereColors} style={styles.atmosphereTop} pointerEvents="none" />

      {onBack ? (
        <View
          style={[styles.floatingHeader, { top: (insets.top || 0) + 12 }]}
          pointerEvents="box-none"
        >
          <GlassIconButton
            icon="arrow-back"
            iconSize={22}
            onPress={onBack}
            accessibilityLabel="Go back"
          />
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (insets.top || 0) + (onBack ? scale(56) : scale(28)),
            paddingBottom: insets.bottom + 112,
          },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        {...bottomNavScroll}
      >
        <View style={styles.pageHeader}>
          <View
            style={[
              styles.personAvatar,
              isCompany && styles.companyAvatar,
              // Collection art is a 2:3 key-art poster, not a face and not a
              // wordmark — a circle would crop it and a wide plate would letterbox it.
              isCollection && styles.collectionAvatar,
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
                  isCompany
                    ? `${personName} logo`
                    : isCollection
                      ? `${personName} artwork`
                      : `${personName} profile photo`
                }
                title={personName}
                icon={
                  isCompany ? 'business-outline' : isCollection ? 'albums-outline' : 'person-outline'
                }
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
                          : role === 'collection'
                            ? 'albums-outline'
                            : 'person'
                }
                size={26}
                color={GOLD_ACCENT}
              />
            )}
          </View>
          {/* Token first, local style second — RN style arrays let the last entry
              win, so spreading the token last silently kills these fontWeights. */}
          <Text style={[typography.labelSm, styles.roleEyebrow, { color: GOLD_ACCENT }]}>
            {roleLabel}
          </Text>
          <Text
            style={[typography.titleMd, styles.personName, { color: colors.onSurface }]}
            numberOfLines={2}
            accessibilityRole="header"
          >
            {personName}
          </Text>
          {!loading && countText ? (
            <Text style={[typography.labelSm, styles.countLabel, { color: colors.onSurfaceVariant }]}>
              {countText}
            </Text>
          ) : null}
        </View>

        <ProgrammeHairline style={styles.headerHairline} />

        {loading ? (
          <View style={styles.skeletonContainer}>
            <ContentRailSkeleton posterCount={4} />
            <View style={styles.skeletonSpacer} />
            <ContentRailSkeleton posterCount={4} />
          </View>
        ) : !hasRails && !hasItems ? (
          <EmptyState
            variant="empty"
            title="No titles found"
            description={
              isCompany
                ? "We couldn't find any titles from this studio."
                : isCollection
                  ? "We couldn't find any films in this collection."
                  : "We couldn't find any credits matching this person."
            }
            compact
          />
        ) : hasRails ? (
          resolvedRails.map((rail, railIdx) => (
            <ContentRail
              key={rail.roleType || rail.id || railIdx}
              title={rail.title}
              subtitle={`${rail.totalCount || rail.count || rail.data?.length} title${
                (rail.totalCount || rail.count || rail.data?.length) !== 1 ? 's' : ''
              }`}
              data={rail.data || rail.credits}
              colors={colors}
              typography={typography}
              radii={radii}
              variant="section"
              bleed
              showMediaType={false}
              showTitle={false}
              showCaption
              onSelectItem={onSelectItem}
              getItemMetaText={(item) =>
                item.metaText || item.roleMeta || (item.year && item.year !== 'N/A' ? item.year : '')
              }
            />
          ))
        ) : isCollection ? (
          <ContentRail
            title={roleLabel}
            subtitle={countText}
            data={items}
            colors={colors}
            typography={typography}
            radii={radii}
            variant="section"
            bleed
            showMediaType={false}
            showTitle={false}
            showCaption
            onSelectItem={onSelectItem}
            getItemRankBadge={(item) => item.order}
            getItemMetaText={(item) =>
              franchiseTileMeta({
                year: item.year,
                state: releaseStateFor(item),
                isCurrent: item.tmdbId === currentTmdbId,
              })
            }
          />
        ) : (
          <ContentRail
            title={roleLabel}
            subtitle={countText}
            data={items}
            colors={colors}
            typography={typography}
            radii={radii}
            variant="section"
            bleed
            showMediaType={false}
            showTitle={false}
            showCaption
            onSelectItem={onSelectItem}
            getItemMetaText={(item) => (item.year && item.year !== 'N/A' ? item.year : '')}
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
  floatingHeader: {
    position: 'absolute',
    left: 16,
    zIndex: 50,
  },
  content: {
    paddingHorizontal: 0,
  },
  pageHeader: {
    alignItems: 'center',
    marginBottom: scale(18),
    paddingHorizontal: GRID_PAD,
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
  // Collection art is 2:3 key art; a circle crops it and a wide plate letterboxes it.
  collectionAvatar: {
    borderRadius: scale(10),
    height: scale(96),
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
    marginHorizontal: GRID_PAD,
    marginBottom: scale(12),
  },
  skeletonContainer: {
    paddingVertical: scale(8),
  },
  skeletonSpacer: {
    height: scale(28),
  },
});
