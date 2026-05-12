import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';

export function FilmographyScreen({ personName, role, results = [], onSelectItem, loading, profileUrl }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;

  // role: 'movie' = director, 'tv' = creator, 'cast' = actor, 'writer' = writing credits
  const roleLabel = role === 'cast'
    ? 'Starring In'
    : role === 'writer'
      ? 'Writing Credits'
      : role === 'movie'
        ? 'Directed By'
        : 'Created By';
  const countText = `${results.length} title${results.length !== 1 ? 's' : ''}`;

  const renderItem = ({ item, index }) => {
    const mediaIcon = item.mediaType === 'tv' ? 'tv-outline' : 'film-outline';
    return (
      <TouchableOpacity
        style={[styles.posterItem, index % 2 === 0 ? styles.posterLeft : styles.posterRight]}
        onPress={() => onSelectItem(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Open details for ${item.title}`}
      >
        <View style={[styles.posterCard, { backgroundColor: colors.surfaceContainer, borderRadius: radii.md }]}>
          <MediaArtwork uri={item.posterUrl} style={styles.poster} accessibilityLabel={`${item.title} poster`} title={item.title} />
          {/* Rating badge */}
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
          {/* Movie / TV badge — only shown for 'cast' since items can be mixed */}
          {(role === 'cast' || role === 'writer') && (
            <View style={[styles.typeBadge, { backgroundColor: colors.primary + 'CC' }]}>
              <Ionicons name={mediaIcon} size={10} color="#fff" />
            </View>
          )}
        </View>
        <Text style={[styles.posterTitle, { color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.posterYear, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
          {item.year}
          {role === 'cast' && item.character ? ` · ${item.character}` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surfaceContainer, borderBottomColor: colors.outlineVariant + '40' }]}>
        <View style={[styles.personAvatar, { backgroundColor: colors.primary + '22' }]}>
          {profileUrl ? (
            <MediaArtwork uri={profileUrl} style={styles.avatarImage} accessibilityLabel={`${personName} profile photo`} title={personName} icon="person-outline" compactFallback />
          ) : (
            <Ionicons
              name={role === 'cast' ? 'star' : role === 'writer' ? 'create-outline' : 'person'}
              size={26}
              color={colors.primary}
            />
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.roleLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
            {roleLabel}
          </Text>
          <Text style={[styles.personName, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={2}>
            {personName}
          </Text>
          {!loading && (
            <Text style={[styles.countLabel, { color: colors.primary, ...typography.labelSm }]}>
              {countText}
            </Text>
          )}
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
            Loading…
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="film-outline" size={52} color={colors.onSurfaceVariant} />
          <Text style={[styles.emptyText, { color: colors.onSurfaceVariant, ...typography.bodyLg }]}>
            No titles found
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
          numColumns={2}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  personAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  headerText: {
    flex: 1,
  },
  roleLabel: {
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  personName: {
    fontWeight: '900',
    marginBottom: 4,
  },
  countLabel: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  grid: {
    padding: 16,
    paddingBottom: 100,
    gap: 8,
  },
  posterItem: {
    flex: 1,
    marginBottom: 20,
  },
  posterLeft: {
    marginRight: 8,
  },
  posterRight: {
    marginLeft: 8,
  },
  posterCard: {
    aspectRatio: 2 / 3,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  posterYear: {
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    marginTop: 8,
  },
  emptyText: {
    fontWeight: '600',
  },
});
