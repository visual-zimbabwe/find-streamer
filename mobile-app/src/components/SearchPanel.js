import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function SearchPanel({ value, onChangeText, onSubmit, loading, recentSearches, onPickSuggestion, filter, onFilterChange, hideHistory, hideHero }) {
  const { theme } = useTheme();
  const { colors, spacing, typography, radii } = theme;

  return (
    <View style={styles.container}>
      {!hideHero && (
        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: colors.onSurface, ...typography.headlineLg }]}>Find your next favourite movie or tv show</Text>
          <Text style={[styles.heroSubtitle, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
            Explore movies, TV shows and more with Trova's smart search engine.
          </Text>
        </View>
      )}

      <View style={[styles.searchWrapper, { backgroundColor: colors.surfaceContainerHighest, borderRadius: radii.lg }]}>
        <View style={styles.iconWrapper}>
          <Text style={{ color: colors.primary, fontSize: 20 }}>🔍</Text>
        </View>
        <TextInput
          style={[styles.input, { color: colors.onSurface, ...typography.bodyLg }]}
          placeholder="Search for a movie, show"
          placeholderTextColor={colors.onSurfaceVariant}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          editable={!loading}
          autoFocus={true}
        />
      </View>

      <View style={styles.filterToggles}>
        <TouchableOpacity 
          style={[styles.filterChip, filter === 'movie' ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant + '26' }]}
          onPress={() => onFilterChange(filter === 'movie' ? null : 'movie')}
        >
          <Text style={[styles.filterLabel, { color: filter === 'movie' ? colors.onPrimary : colors.onSurfaceVariant, ...typography.labelSm }]}>Movies</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterChip, filter === 'tv' ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant + '26' }]}
          onPress={() => onFilterChange(filter === 'tv' ? null : 'tv')}
        >
          <Text style={[styles.filterLabel, { color: filter === 'tv' ? colors.onPrimary : colors.onSurfaceVariant, ...typography.labelSm }]}>TV Shows</Text>
        </TouchableOpacity>
      </View>

      {!hideHistory && recentSearches && recentSearches.length > 0 && (
        <View style={styles.suggestionsWrapper}>
          <Text style={[styles.suggestionTitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>RECENT SEARCHES</Text>
          <View style={styles.suggestionChips}>
            {recentSearches.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.suggestionChip, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant + '26' }]}
                onPress={() => onPickSuggestion(item)}
              >
                <Text style={{ color: colors.onSurface, ...typography.bodyMd }}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 60,
    marginBottom: 40,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 48,
  },
  heroTitle: {
    textAlign: 'center',
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 16,
  },
  heroSubtitle: {
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  searchWrapper: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 12,
  },
  iconWrapper: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontWeight: '500',
  },
  filterToggles: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  filterChip: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterLabel: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  suggestionsWrapper: {
    marginTop: 48,
  },
  suggestionTitle: {
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
  },
});
