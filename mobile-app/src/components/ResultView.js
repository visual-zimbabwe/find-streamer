import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function ResultView({ result, onBack, onToggleWatchlist, isInWatchlist }) {
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
          
          <TouchableOpacity 
            style={[styles.watchButton, { backgroundColor: isInWatchlist ? colors.surfaceContainerHighest : colors.primary }]}
            onPress={() => onToggleWatchlist(result)}
          >
            <Text style={[styles.watchButtonText, { color: isInWatchlist ? colors.onSurface : colors.onPrimary, ...typography.labelSm }]}>
              {isInWatchlist ? '✓ IN WATCHLIST' : '+ ADD TO WATCHLIST'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Detailed Country View */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>GLOBAL AVAILABILITY</Text>
          <View style={[styles.table, { borderColor: colors.outlineVariant + '26' }]}>
            {result.rows.map((row, index) => (
              <View key={row.code} style={[styles.tableRow, index % 2 === 0 ? { backgroundColor: colors.surfaceContainerLow } : null]}>
                <Text style={[styles.countryName, { color: colors.onSurface, ...typography.bodyMd }]}>{row.country}</Text>
                <View style={styles.providerBadges}>
                  {row.providers.netflix && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
                  {row.providers.amazon_prime_video && <View style={[styles.dot, { backgroundColor: colors.primaryDim }]} />}
                  {row.providers.max && <View style={[styles.dot, { backgroundColor: colors.primaryContainer }]} />}
                </View>
              </View>
            ))}
          </View>
        </View>
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
  watchButton: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  watchButtonText: {
    fontWeight: '800',
    letterSpacing: 1,
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
