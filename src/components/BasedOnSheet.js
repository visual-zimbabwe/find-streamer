import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme/ThemeProvider';
import { SkeletonBlock } from './SkeletonLoaders';
import { buildSourceMetaLine, capitalize, fetchOtherAdaptations, pickSourceType } from '../lib/basedOn';
import { getTitleMatchById } from '../lib/tmdb';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';

/**
 * A source work's cover, from Wikimedia Commons.
 *
 * `expo-image`, not React Native's `Image`, and the distinction is load-bearing:
 * upload.wikimedia.org answers 403 to the OkHttp User-Agent RN's Image sends on
 * Android, so every cover rendered as an empty grey box on device while the same
 * URL returned 200 from a desktop client. The awards rail hit this first and
 * `AwardLogoImage` is the pattern being followed here, failure reset included —
 * a recycled card must not inherit the previous work's failure.
 */
export function SourceCoverImage({ uri, style, fallbackStyle, iconSize = 16, iconColor }) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={fallbackStyle}>
        <Ionicons name="book-outline" size={iconSize} color={iconColor} />
      </View>
    );
  }

  return (
    <ExpoImage
      source={{ uri }}
      style={style}
      contentFit="cover"
      transition={150}
      onError={() => setFailed(true)}
    />
  );
}

/** Adaptation-row shaped placeholders — poster plus two lines, like the loaded row. */
function AdaptationSkeleton({ colors }) {
  return (
    <View accessibilityLabel="Loading other adaptations">
      {[0, 1, 2].map((index) => (
        <View
          key={`adaptation-skeleton-${index}`}
          style={[
            styles.adaptationRow,
            index < 2 && { borderBottomWidth: StyleSheet.hairlineWidth },
            { borderBottomColor: colors.outlineVariant },
          ]}
        >
          <SkeletonBlock style={styles.adaptationPosterSkeleton} />
          <View style={styles.adaptationBody}>
            <SkeletonBlock style={styles.adaptationTitleSkeleton} />
            <SkeletonBlock style={styles.adaptationMetaSkeleton} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * The source work, one tap from the Based On card.
 *
 * Replaces what used to be a straight `Linking.openURL` into
 * `wikidata.org/wiki/Q3603347` — a property table built for data editors. The
 * cover, the type, the byline and the year all already came back with the
 * detail screen's own SPARQL call, so showing them costs nothing; Wikidata
 * stays available as a secondary action for anyone who actually wants it.
 *
 * The rail underneath is the part no streaming app can copy: everything else
 * made from the same book, opening inside Trova — which already knows where
 * each of them streams.
 */
export function BasedOnSheetContent({ work, currentTitle, onOpenWikidata, onSelectTitle, onDismiss }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const [adaptations, setAdaptations] = React.useState([]);
  const [loading, setLoading] = React.useState(Boolean(work?.id));
  const [failed, setFailed] = React.useState(false);

  const typeLabel = React.useMemo(() => {
    const type = pickSourceType(work?.types);
    return type ? capitalize(type) : null;
  }, [work?.types]);
  // The sheet's own eyebrow already reads BASED ON / INSPIRED BY.
  const metaLine = React.useMemo(() => buildSourceMetaLine(work, { showRelation: false }), [work]);

  React.useEffect(() => {
    if (!work?.id) return undefined;
    let cancelled = false;

    async function load() {
      try {
        const rows = await fetchOtherAdaptations([work.id], {
          excludeTmdbId: currentTitle?.tmdbId,
          excludeMediaType: currentTitle?.mediaType,
        });
        // Wikidata knows the id; TMDb owns the poster, title and year. A row
        // whose lookup fails is dropped rather than rendered without artwork.
        const hydrated = await Promise.all(
          rows.map((row) =>
            getTitleMatchById(row.mediaType, row.tmdbId)
              .then((match) => ({ ...match, mediaType: row.mediaType }))
              .catch(() => null),
          ),
        );
        if (!cancelled) setAdaptations(hydrated.filter(Boolean));
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [work?.id, currentTitle?.tmdbId, currentTitle?.mediaType]);

  return (
    <View style={styles.root}>
      {/* The source work itself */}
      <View style={styles.identityRow}>
        <SourceCoverImage
          uri={work?.coverUrl}
          style={[styles.cover, { backgroundColor: colors.surfaceContainerHigh }]}
          fallbackStyle={[styles.cover, styles.coverFallback, { backgroundColor: GOLD_ACCENT + '18' }]}
          iconSize={22}
          iconColor={GOLD_ACCENT}
        />
        <View style={styles.identityText}>
          {/* No work name here — the sheet header above already carries it in
              full, and printing it twice cost the sheet three lines it needed
              for the adaptations list. */}
          {typeLabel ? (
            <Text style={[styles.typeLabel, { color: GOLD_ACCENT, ...typography.labelSm }]}>
              {typeLabel}
            </Text>
          ) : null}
          {metaLine ? (
            <Text
              style={[styles.metaLine, { color: colors.onSurface, ...typography.bodyMd }]}
              numberOfLines={3}
            >
              {metaLine}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Everything else made from it */}
      <Text style={[styles.railLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
        Other adaptations
      </Text>

      {loading ? (
        <AdaptationSkeleton colors={colors} />
      ) : failed ? (
        <Text style={[styles.stateText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          Couldn&apos;t load other adaptations.
        </Text>
      ) : adaptations.length === 0 ? (
        <Text style={[styles.stateText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          This is the only screen adaptation Wikidata knows about.
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.adaptationScroll}>
          {adaptations.map((item, index) => (
            <TouchableOpacity
              key={`${item.mediaType}-${item.tmdbId}`}
              style={[
                styles.adaptationRow,
                index < adaptations.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth },
                { borderBottomColor: colors.outlineVariant },
              ]}
              activeOpacity={0.78}
              onPress={() => {
                onDismiss();
                if (onSelectTitle) onSelectTitle(item);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.title}${item.year && item.year !== 'N/A' ? `, ${item.year}` : ''}`}
            >
              <Image
                source={{ uri: item.posterUrl }}
                style={[
                  styles.adaptationPoster,
                  { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.md },
                ]}
                resizeMode="cover"
              />
              <View style={styles.adaptationBody}>
                <Text
                  style={[styles.adaptationTitle, { color: colors.onSurface, ...typography.bodyMd }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.adaptationMeta,
                    { color: colors.onSurfaceVariant, ...typography.labelSm },
                  ]}
                >
                  {[item.year !== 'N/A' ? item.year : null, item.mediaType === 'tv' ? 'Series' : 'Film']
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Ionicons
                name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'}
                size={14}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {work?.id && onOpenWikidata ? (
        <TouchableOpacity
          style={[styles.wikidataRow, { borderTopColor: colors.outlineVariant + '55' }]}
          onPress={() => {
            onOpenWikidata(work);
            onDismiss();
          }}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={`Open ${work.name} on Wikidata`}
        >
          <Text style={[styles.wikidataText, { color: GOLD_DIM, ...typography.labelSm }]}>
            View on Wikidata
          </Text>
          <Ionicons name="open-outline" size={14} color={GOLD_DIM} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  identityRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  cover: {
    borderRadius: 8,
    height: 96,
    marginRight: 14,
    width: 64,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: {
    flex: 1,
    justifyContent: 'center',
  },
  typeLabel: {
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  workName: {
    fontWeight: '800',
  },
  metaLine: {
    fontWeight: '600',
    marginTop: 4,
  },
  railLabel: {
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  stateText: {
    paddingVertical: 10,
  },
  adaptationScroll: {
    flex: 1,
  },
  adaptationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 9,
  },
  adaptationPoster: {
    height: 54,
    marginRight: 12,
    width: 36,
  },
  adaptationPosterSkeleton: {
    borderRadius: 6,
    height: 54,
    marginRight: 12,
    width: 36,
  },
  adaptationBody: {
    flex: 1,
  },
  adaptationTitle: {
    fontWeight: '700',
  },
  adaptationMeta: {
    marginTop: 2,
  },
  adaptationTitleSkeleton: {
    height: 13,
    width: '62%',
  },
  adaptationMetaSkeleton: {
    height: 11,
    marginTop: 6,
    width: '38%',
  },
  wikidataRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 6,
    paddingTop: 14,
  },
  wikidataText: {
    fontWeight: '700',
  },
});
