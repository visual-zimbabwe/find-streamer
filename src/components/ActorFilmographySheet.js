import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { SkeletonBlock } from './SkeletonLoaders';
import { fetchPersonFilmography } from '../lib/tmdb';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';

const PEEK_CREDIT_COUNT = 10;

function initialsForName(name = '') {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return initials || '?';
}

/** Credit-row shaped placeholders — matches the loaded row's poster + two lines. */
function PeekSkeleton({ colors }) {
  return (
    <View accessibilityLabel="Loading filmography">
      {[0, 1, 2, 3].map((index) => (
        <View
          key={`peek-skeleton-${index}`}
          style={[
            styles.creditRow,
            index < 3 && { borderBottomWidth: StyleSheet.hairlineWidth },
            { borderBottomColor: colors.outlineVariant },
          ]}
        >
          <SkeletonBlock style={styles.creditPosterSkeleton} />
          <View style={styles.creditBody}>
            <SkeletonBlock style={styles.creditTitleSkeleton} />
            <SkeletonBlock style={styles.creditMetaSkeleton} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Lightweight filmography peek pushed onto the sheet stack when a cast or crew
 * card is long-pressed. Shows skeleton rows, then the first credits.
 * "Full →" hands off to the full Filmography screen.
 */
export function ActorFilmographySheetContent({ person, role, onPersonPress, onDismiss }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const [credits, setCredits] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { results } = await fetchPersonFilmography(person.id, person.name, role);
        if (!cancelled) setCredits(results.slice(0, PEEK_CREDIT_COUNT));
      } catch {
        if (!cancelled) setError('Could not load filmography.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [person.id, person.name, role]);

  return (
    <View style={styles.root}>
      {/* Identity row */}
      <View style={styles.identityRow}>
        {person.profileUrl ? (
          <Image source={{ uri: person.profileUrl }} style={styles.identityAvatar} />
        ) : (
          <View
            style={[
              styles.identityAvatar,
              styles.identityAvatarFallback,
              { backgroundColor: GOLD_ACCENT + '18' },
            ]}
          >
            <Text style={[styles.identityInitials, { color: GOLD_ACCENT, ...typography.labelSm }]}>
              {initialsForName(person.name)}
            </Text>
          </View>
        )}
        <View style={styles.identityText}>
          <Text
            style={[styles.identityName, { color: colors.onSurface, ...typography.titleMd }]}
            numberOfLines={1}
          >
            {person.name}
          </Text>
          {person.roleLabel ? (
            <Text
              style={[
                styles.identityRole,
                { color: colors.onSurfaceVariant, ...typography.labelSm },
              ]}
              numberOfLines={1}
            >
              {person.roleLabel}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => {
            onDismiss();
            if (onPersonPress) onPersonPress(person.id, person.name, role);
          }}
          style={[
            styles.fullButton,
            { backgroundColor: GOLD_ACCENT + '18', borderColor: GOLD_DIM, borderRadius: radii.full },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`See full filmography for ${person.name}`}
        >
          <Text style={[styles.fullButtonText, { color: GOLD_ACCENT, ...typography.labelSm }]}>
            Full →
          </Text>
        </TouchableOpacity>
      </View>

      {/* Credits */}
      {loading ? (
        <PeekSkeleton colors={colors} />
      ) : error ? (
        <Text style={[styles.stateText, { color: colors.error, ...typography.bodyMd }]}>
          {error}
        </Text>
      ) : credits.length === 0 ? (
        <Text style={[styles.stateText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          No credits found.
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.creditScroll}>
          {credits.map((item, i) => (
            <View
              key={`${item.tmdbId}-${item.mediaType}-${i}`}
              style={[
                styles.creditRow,
                i < credits.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth },
                { borderBottomColor: colors.outlineVariant },
              ]}
            >
              <Image
                source={{ uri: item.posterUrl }}
                style={[
                  styles.creditPoster,
                  { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.md },
                ]}
                resizeMode="cover"
              />
              <View style={styles.creditBody}>
                <Text
                  style={[styles.creditTitle, { color: colors.onSurface, ...typography.bodyMd }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.creditMeta,
                    { color: colors.onSurfaceVariant, ...typography.labelSm },
                  ]}
                >
                  {[item.year, item.character && `as ${item.character}`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Ionicons
                name={item.mediaType === 'tv' ? 'tv-outline' : 'film-outline'}
                size={14}
                color={colors.onSurfaceVariant}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 16,
  },
  identityAvatar: {
    borderRadius: 26,
    height: 52,
    marginRight: 12,
    width: 52,
  },
  identityAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityInitials: {
    fontWeight: '900',
  },
  identityText: {
    flex: 1,
  },
  identityName: {
    fontWeight: '800',
  },
  identityRole: {
    fontWeight: '600',
    marginTop: 2,
  },
  fullButton: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  fullButtonText: {
    fontWeight: '800',
  },
  stateText: {
    textAlign: 'center',
  },
  creditScroll: {
    flex: 1,
  },
  creditRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 9,
  },
  creditPoster: {
    height: 54,
    marginRight: 12,
    width: 36,
  },
  creditPosterSkeleton: {
    borderRadius: 6,
    height: 54,
    marginRight: 12,
    width: 36,
  },
  creditBody: {
    flex: 1,
  },
  creditTitle: {
    fontWeight: '700',
  },
  creditMeta: {
    marginTop: 2,
  },
  creditTitleSkeleton: {
    height: 13,
    width: '62%',
  },
  creditMetaSkeleton: {
    height: 11,
    marginTop: 6,
    width: '38%',
  },
});
