import React from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { StatePanel } from './StatePanel';

export function WatchlistView({ items, onRemove, onSelect }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;

  if (!items || items.length === 0) {
    return (
      <StatePanel 
        type="empty" 
        title="Your Watchlist" 
        description="You have no titles saved yet. Explore movies and add them to your collection."
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface, ...typography.headlineLg }]}>My Watchlist</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          You have {items.length} titles saved to watch later.
        </Text>
      </View>

      <View style={styles.list}>
        {items.map((item) => (
          <TouchableOpacity 
            key={item.tmdbId} 
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => onSelect(item)}
          >
            <View style={[styles.posterWrapper, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}>
              <Image source={{ uri: item.posterUrl }} style={styles.poster} />
              <TouchableOpacity 
                style={[styles.removeButton, { backgroundColor: colors.surface + 'cc' }]}
                onPress={() => onRemove(item.tmdbId)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
            <View style={styles.info}>
              <View style={styles.badgeRow}>
                <Text style={[styles.mediaType, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
                  {item.mediaType?.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.itemTitle, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.meta}>
                <Ionicons name="star" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary }}>{item.rating}</Text>
                <Text style={{ color: colors.onSurfaceVariant }}>• {item.year}</Text>
              </View>
              <Text style={[styles.synopsis, { color: colors.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={2}>
                {item.synopsis}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontWeight: '900',
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  subtitle: {
    fontWeight: '500',
  },
  list: {
    gap: 32,
  },
  card: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  posterWrapper: {
    width: 120,
    aspectRatio: 2 / 3,
    overflow: 'hidden',
    position: 'relative',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  mediaType: {
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  itemTitle: {
    fontWeight: '800',
    lineHeight: 28,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  synopsis: {
    lineHeight: 22,
    marginTop: 4,
  },
});
