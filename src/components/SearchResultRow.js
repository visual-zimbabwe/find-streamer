import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MediaArtwork } from './MediaArtwork';
import { GOLD_ACCENT, GOLD_DIM } from '../theme/programme';
import { scale } from '../utils/responsive';

/**
 * One row of a search result — a title or a person.
 *
 * Both search surfaces render people now: the live panel always did, and the
 * submitted results learned to after the person short-circuit was removed from
 * `searchTitleCandidates`. Rather than grow a second, subtly different person
 * row on the results screen, both call this.
 */
export function SearchResultRow({
  item,
  showDivider = false,
  colors,
  typography,
  radii,
  onPress,
}) {
  const isPerson = item.resultType === 'person';
  const hasYear = item.year && item.year !== 'N/A';
  const metaText = isPerson
    ? `${item.departmentLabel}${item.knownFor ? ` · ${item.knownFor}` : ''}`
    : `${hasYear ? item.year : ''}${hasYear && item.mediaType ? ' · ' : ''}${item.mediaType === 'tv' ? 'TV Show' : item.mediaType === 'movie' ? 'Movie' : ''}`;
  const imageUrl = isPerson ? item.profileUrl : item.posterUrl;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        showDivider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: GOLD_DIM,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        isPerson
          ? `${item.title}, ${item.departmentLabel}. View filmography.`
          : `${item.title}${hasYear ? `, ${item.year}` : ''}. Open details.`
      }
      activeOpacity={0.78}
    >
      <View
        style={[
          styles.thumbFrame,
          isPerson ? styles.avatarFrame : styles.posterFrame,
          { borderRadius: radii.md, backgroundColor: colors.surfaceContainerHigh },
        ]}
      >
        <MediaArtwork
          uri={imageUrl}
          style={isPerson ? styles.avatar : styles.poster}
          resizeMode="cover"
          icon={isPerson ? 'person-outline' : 'film-outline'}
          title={item.title}
          compactFallback
          instant
          accessibilityLabel={isPerson ? `${item.title} profile photo` : `${item.title} poster`}
        />
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          {isPerson && (
            <Ionicons
              name={item.role === 'movie' ? 'camera-outline' : 'star-outline'}
              size={13}
              color={GOLD_ACCENT}
            />
          )}
          <Text
            style={[styles.title, { color: colors.onSurface, ...typography.bodyMd }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
        </View>
        <Text
          style={[styles.meta, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
          numberOfLines={1}
        >
          {metaText}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={GOLD_ACCENT} style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: scale(12),
    minHeight: 48,
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
  },
  thumbFrame: {
    overflow: 'hidden',
  },
  posterFrame: {
    height: 52,
    width: 36,
  },
  avatarFrame: {
    height: 44,
    width: 44,
  },
  poster: {
    borderRadius: 6,
    height: 52,
    width: 36,
  },
  avatar: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
    fontWeight: '600',
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginBottom: 2,
  },
  meta: {
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  chevron: {
    opacity: 0.72,
  },
});
