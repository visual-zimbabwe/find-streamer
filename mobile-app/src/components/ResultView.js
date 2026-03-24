import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function ResultView({ result, onBack, onToggleWatchlist, isInWatchlist, onSelectSimilar }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;

  if (!result) return null;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.heroSection}>
        <Image
          source={{ uri: result.backdropUrl || result.posterUrl }}
          style={styles.backdrop}
          resizeMode="cover"
        />
        <View style={styles.scrim} />
        
        <View style={styles.heroContent}>
          <View style={styles.metaRow}>
            <View style={[styles.genreBadge, { backgroundColor: colors.primary + '33' }]}>
              <Text style={[styles.genreText, { color: colors.primary, ...typography.labelSm }]}>{result.genres || 'Unknown Genre'}</Text>
            </View>
            <View style={styles.ratingRow}>
              <Text style={{ color: colors.primary, fontSize: 14 }}>⭐</Text>
              <Text style={[styles.ratingText, { color: colors.onSurface, ...typography.labelSm }]}>{result.rating}</Text>
            </View>
          </View>
          
          <Text style={[styles.title, { color: colors.onSurface, ...typography.displayLg }]}>{result.title}</Text>
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoText, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>📅 {result.year}</Text>
            <Text style={[styles.infoText, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>⏱️ 2h 28m</Text>
          </View>
        </View>
      </View>

      <View style={styles.detailsContent}>
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>DIRECTOR</Text>
            <Text style={[styles.metaText, { color: colors.onSurface, ...typography.bodyMd }]}>{result.director}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>STARRING</Text>
            <Text style={[styles.metaText, { color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={2}>
              {result.starring}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>SYNOPSIS</Text>
          <Text style={[styles.synopsis, { color: colors.onSurface, ...typography.bodyLg }]}>
            {result.synopsis}
          </Text>
        </View>

        <View style={[styles.streamingCard, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl, borderColor: colors.outlineVariant + '26' }]}>
          <Text style={[styles.sectionLabel, { color: colors.onSurface, ...typography.labelSm, marginBottom: 24 }]}>WHERE TO STREAM</Text>
          
          {result.providerSummary.map((provider) => (
            <View key={provider.key} style={styles.providerRow}>
              <View style={styles.providerInfo}>
                <View style={[styles.providerIcon, { backgroundColor: colors.surfaceContainerHighest }]}>
                  <Text style={{ color: colors.primary, fontSize: 20 }}>🎬</Text>
                </View>
                <Text style={[styles.providerName, { color: colors.onSurface, ...typography.bodyLg }]}>{provider.label}</Text>
              </View>
              <Text style={[styles.providerStatus, { color: provider.count > 0 ? colors.primary : colors.onSurfaceVariant, ...typography.labelSm }]}>
                {provider.count > 0 ? `Available in ${provider.count} countries` : 'Not available'}
              </Text>
            </View>
          ))}
          
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.watchButton, { backgroundColor: colors.primary }]}
              onPress={() => Linking.openURL(result.trailer)}
              disabled={!result.trailer || result.trailer === 'N/A'}
            >
              <Text style={[styles.watchButtonText, { color: colors.onPrimary, ...typography.labelSm }]}>▶ WATCH TRAILER</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.bookmarkButton, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant + '4D' }]}
              onPress={() => onToggleWatchlist(result)}
            >
              <Text style={{ fontSize: 24, color: isInWatchlist ? colors.primary : colors.onSurfaceVariant }}>
                {isInWatchlist ? '🔖' : '📑'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Detailed Country View */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>GLOBAL AVAILABILITY</Text>
          
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#E50914' }]} />
              <Text style={[styles.legendText, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Netflix</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#00A8E1' }]} />
              <Text style={[styles.legendText, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Prime</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#002BE7' }]} />
              <Text style={[styles.legendText, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Max</Text>
            </View>
          </View>

          <View style={[styles.table, { borderColor: colors.outlineVariant + '26' }]}>
            {result.rows.map((row, index) => (
              <View key={row.code} style={[styles.tableRow, index % 2 === 0 ? { backgroundColor: colors.surfaceContainerLow } : null]}>
                <Text style={[styles.countryName, { color: colors.onSurface, ...typography.bodyMd }]}>{row.country}</Text>
                <View style={styles.providerBadges}>
                  {row.providers.netflix && <View style={[styles.dot, { backgroundColor: '#E50914' }]} />}
                  {row.providers.amazon_prime_video && <View style={[styles.dot, { backgroundColor: '#00A8E1' }]} />}
                  {row.providers.max && <View style={[styles.dot, { backgroundColor: '#002BE7' }]} />}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* More Like This */}
        {result.similar && result.similar.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>MORE LIKE THIS</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarScroll}
            >
              {result.similar.map((item) => (
                <TouchableOpacity 
                  key={item.tmdbId} 
                  style={styles.similarItem}
                  onPress={() => onSelectSimilar(item)}
                >
                  <View style={[styles.similarPoster, { backgroundColor: colors.surfaceContainer, borderRadius: radii.md }]}>
                    <Image source={{ uri: item.posterUrl }} style={styles.poster} />
                    <View style={styles.similarRating}>
                      <Text style={{ color: colors.white, fontSize: 10, fontWeight: '800' }}>{item.rating}</Text>
                    </View>
                  </View>
                  <Text style={[styles.similarTitle, { color: colors.onSurface, ...typography.bodyMd }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    height: 600,
    width: '100%',
    position: 'relative',
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 20, 0.4)',
    // In a real app we'd use a gradient here
  },
  heroContent: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  genreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  genreText: {
    fontWeight: '800',
    letterSpacing: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontWeight: '800',
  },
  title: {
    fontWeight: '900',
    letterSpacing: -2,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
  },
  infoText: {
    fontWeight: '600',
  },
  detailsContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 40,
  },
  sectionLabel: {
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  synopsis: {
    fontWeight: '300',
    lineHeight: 28,
  },
  streamingCard: {
    padding: 24,
    marginBottom: 40,
    borderWidth: 1,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    fontWeight: '600',
  },
  providerStatus: {
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 40,
  },
  metaItem: {
    flex: 1,
  },
  metaText: {
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  watchButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchButtonText: {
    fontWeight: '800',
    letterSpacing: 1,
  },
  bookmarkButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  similarScroll: {
    gap: 16,
    paddingRight: 40,
  },
  similarItem: {
    width: 120,
  },
  similarPoster: {
    width: 120,
    aspectRatio: 2 / 3,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  similarRating: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  similarTitle: {
    fontWeight: '700',
  },
  table: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  countryName: {
    fontWeight: '500',
  },
  providerBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
