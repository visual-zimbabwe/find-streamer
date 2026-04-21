import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useDiscoverViewModel } from '../lib/discoverViewModel';

// ─── Language Options ──────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: null,  label: 'Any language' },
  { code: 'en',  label: 'English' },
  { code: 'fr',  label: 'French' },
  { code: 'ko',  label: 'Korean' },
  { code: 'ja',  label: 'Japanese' },
  { code: 'es',  label: 'Spanish' },
  { code: 'hi',  label: 'Hindi' },
  { code: 'de',  label: 'German' },
  { code: 'zh',  label: 'Chinese' },
];

// ─── Sort Options ──────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'popularity.desc',        label: 'Popularity ↓' },
  { value: 'vote_average.desc',      label: 'Rating ↓' },
  { value: 'primary_release_date.desc', label: 'Newest first' },
  { value: 'primary_release_date.asc',  label: 'Oldest first' },
  { value: 'revenue.desc',           label: 'Revenue ↓' },
];

// ─── Rating Steps ──────────────────────────────────────────────────────────────
const RATING_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function DiscoverScreen({ onSelectItem }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;

  const vm = useDiscoverViewModel();

  // Load genres when mediaType changes
  useEffect(() => {
    vm.loadGenres(vm.filters.mediaType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.filters.mediaType]);

  // ── helpers ────────────────────────────────────────────────────────────────
  const c = colors;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Page Header ── */}
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: c.onSurface, ...typography.headlineMd }]}>
          Discover
        </Text>
        <Text style={[{ color: c.onSurfaceVariant, ...typography.bodyMd }]}>
          Filter movies & shows by criteria
        </Text>
      </View>

      {/* ── Filter Card ── */}
      <View style={[styles.card, { backgroundColor: c.surfaceContainer, borderRadius: radii.xl }]}>

        {/* Content Type Toggle */}
        <SectionLabel label="Content Type" colors={c} typography={typography} />
        <View style={styles.toggleRow}>
          {['movie', 'tv'].map((type) => {
            const active = vm.filters.mediaType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  { borderRadius: radii.md, borderColor: c.outlineVariant + '40' },
                  active && { backgroundColor: c.primary },
                  !active && { backgroundColor: c.surfaceContainerHigh, borderWidth: 1 },
                ]}
                onPress={() => vm.updateFilter('mediaType', type)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={type === 'movie' ? 'film-outline' : 'tv-outline'}
                  size={18}
                  color={active ? c.onPrimary : c.onSurfaceVariant}
                />
                <Text style={[styles.typeLabel, { color: active ? c.onPrimary : c.onSurfaceVariant, ...typography.labelSm }]}>
                  {type === 'movie' ? 'Movies' : 'TV Shows'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Divider color={c.outlineVariant} />

        {/* Genre Multi-Select */}
        <View style={styles.sectionRow}>
          <SectionLabel label="Genres" colors={c} typography={typography} />
          {/* AND / OR toggle */}
          <View style={[styles.logicPill, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.full }]}>
            {['AND', 'OR'].map((mode) => {
              const active = vm.filters.genreLogic === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.logicOption, active && { backgroundColor: c.primary, borderRadius: radii.full }]}
                  onPress={() => vm.updateFilter('genreLogic', mode)}
                >
                  <Text style={[{ color: active ? c.onPrimary : c.onSurfaceVariant, ...typography.labelSm, fontWeight: '700' }]}>
                    {mode}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {vm.genresLoading ? (
          <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />
        ) : (
          <View style={styles.chipWrap}>
            {vm.genres.map((genre) => {
              const active = vm.filters.genreIds.includes(genre.id);
              return (
                <TouchableOpacity
                  key={genre.id}
                  style={[
                    styles.chip,
                    { borderRadius: radii.full },
                    active
                      ? { backgroundColor: c.primary }
                      : { backgroundColor: c.surfaceContainerHigh, borderWidth: 1, borderColor: c.outlineVariant + '40' },
                  ]}
                  onPress={() => vm.toggleGenre(genre.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, { color: active ? c.onPrimary : c.onSurfaceVariant, ...typography.labelSm }]}>
                    {genre.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {vm.filters.genreIds.length > 0 && (
          <TouchableOpacity onPress={() => vm.updateFilter('genreIds', [])} style={styles.clearGenres}>
            <Text style={[{ color: c.primary, ...typography.labelSm }]}>Clear genres</Text>
          </TouchableOpacity>
        )}

        <Divider color={c.outlineVariant} />

        {/* Min Rating */}
        <SectionLabel label={`Minimum Rating: ${vm.filters.minRating > 0 ? vm.filters.minRating.toFixed(1) : 'Any'}`} colors={c} typography={typography} />
        <View style={styles.ratingRow}>
          {RATING_STEPS.map((step) => {
            const active = vm.filters.minRating === step;
            return (
              <TouchableOpacity
                key={step}
                style={[
                  styles.ratingDot,
                  { borderRadius: radii.full, borderColor: c.outlineVariant + '40' },
                  active ? { backgroundColor: c.primary } : { backgroundColor: c.surfaceContainerHigh, borderWidth: 1 },
                ]}
                onPress={() => vm.updateFilter('minRating', step)}
              >
                <Text style={[{ color: active ? c.onPrimary : c.onSurfaceVariant, fontSize: 10, fontWeight: '700' }]}>
                  {step}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Divider color={c.outlineVariant} />

        {/* Language */}
        <SectionLabel label="Language" colors={c} typography={typography} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          <View style={styles.hChipRow}>
            {LANGUAGES.map((lang) => {
              const active = vm.filters.language === lang.code;
              return (
                <TouchableOpacity
                  key={lang.label}
                  style={[
                    styles.chip,
                    { borderRadius: radii.full },
                    active
                      ? { backgroundColor: c.primary }
                      : { backgroundColor: c.surfaceContainerHigh, borderWidth: 1, borderColor: c.outlineVariant + '40' },
                  ]}
                  onPress={() => vm.updateFilter('language', lang.code)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, { color: active ? c.onPrimary : c.onSurfaceVariant, ...typography.labelSm }]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <Divider color={c.outlineVariant} />

        {/* Release Year Range */}
        <SectionLabel label="Release Year Range" colors={c} typography={typography} />
        <View style={styles.yearRow}>
          <View style={[styles.yearInput, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.md, flex: 1 }]}>
            <TextInput
              style={[{ color: c.onSurface, ...typography.bodyMd, paddingHorizontal: 12, paddingVertical: 10 }]}
              placeholder="From (e.g. 2010)"
              placeholderTextColor={c.onSurfaceVariant}
              keyboardType="numeric"
              maxLength={4}
              value={vm.filters.fromYear}
              onChangeText={(v) => vm.updateFilter('fromYear', v.replace(/[^0-9]/g, ''))}
            />
          </View>
          <Text style={[{ color: c.onSurfaceVariant, ...typography.bodyMd, marginHorizontal: 8 }]}>→</Text>
          <View style={[styles.yearInput, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.md, flex: 1 }]}>
            <TextInput
              style={[{ color: c.onSurface, ...typography.bodyMd, paddingHorizontal: 12, paddingVertical: 10 }]}
              placeholder="To (e.g. 2024)"
              placeholderTextColor={c.onSurfaceVariant}
              keyboardType="numeric"
              maxLength={4}
              value={vm.filters.toYear}
              onChangeText={(v) => vm.updateFilter('toYear', v.replace(/[^0-9]/g, ''))}
            />
          </View>
        </View>

        <Divider color={c.outlineVariant} />

        {/* Sort By */}
        <SectionLabel label="Sort By" colors={c} typography={typography} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          <View style={styles.hChipRow}>
            {SORT_OPTIONS.map((opt) => {
              const active = vm.filters.sortBy === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.chip,
                    { borderRadius: radii.full },
                    active
                      ? { backgroundColor: c.primary }
                      : { backgroundColor: c.surfaceContainerHigh, borderWidth: 1, borderColor: c.outlineVariant + '40' },
                  ]}
                  onPress={() => vm.updateFilter('sortBy', opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, { color: active ? c.onPrimary : c.onSurfaceVariant, ...typography.labelSm }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Validation Error */}
        {vm.validationError && (
          <View style={[styles.validationBanner, { backgroundColor: colors.error + '18', borderRadius: radii.md }]}>
            <Ionicons name="warning-outline" size={16} color={colors.error} />
            <Text style={[styles.validationText, { color: colors.error, ...typography.bodyMd }]}>
              {vm.validationError}
            </Text>
          </View>
        )}

        {/* Action Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.resetBtn, { borderRadius: radii.md, borderColor: c.outlineVariant + '40' }]}
            onPress={vm.resetFilters}
          >
            <Ionicons name="refresh-outline" size={16} color={c.onSurfaceVariant} />
            <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm, marginLeft: 6 }]}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: c.primary, borderRadius: radii.md }]}
            onPress={vm.search}
            activeOpacity={0.85}
            disabled={vm.loading}
          >
            {vm.loading
              ? <ActivityIndicator color={c.onPrimary} size="small" />
              : <>
                  <Ionicons name="options-outline" size={16} color={c.onPrimary} />
                  <Text style={[styles.searchBtnText, { color: c.onPrimary, ...typography.labelSm }]}>Find Content</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Results Section ── */}
      <ResultsSection
        vm={vm}
        colors={c}
        typography={typography}
        radii={radii}
        onSelectItem={onSelectItem}
      />
    </ScrollView>
  );
}

// ─── Results Section ──────────────────────────────────────────────────────────

function ResultsSection({ vm, colors: c, typography, radii, onSelectItem }) {
  const { loading, error, clearError, hasSearched, results, totalResults, hasMore, loadingMore, loadMore } = vm;

  if (loading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color={c.primary} size="large" />
        <Text style={[styles.stateText, { color: c.onSurfaceVariant, ...typography.bodyMd, marginTop: 16 }]}>
          Searching…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateBox}>
        <View style={[styles.stateIconCircle, { backgroundColor: c.error + '18' }]}>
          <Ionicons name="alert-circle-outline" size={48} color={c.error} />
        </View>
        <Text style={[{ color: c.onSurface, ...typography.titleLg, textAlign: 'center', marginBottom: 8 }]}>
          Something went wrong
        </Text>
        <Text style={[{ color: c.onSurfaceVariant, ...typography.bodyMd, textAlign: 'center', marginBottom: 24 }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: c.primary, borderRadius: radii.full }]}
          onPress={() => { clearError(); vm.search(); }}
        >
          <Text style={[{ color: c.onPrimary, ...typography.labelSm, fontWeight: '700' }]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasSearched) {
    return (
      <View style={styles.stateBox}>
        <View style={[styles.stateIconCircle, { backgroundColor: c.primary + '15' }]}>
          <Ionicons name="telescope-outline" size={48} color={c.primary} />
        </View>
        <Text style={[{ color: c.onSurface, ...typography.titleLg, textAlign: 'center', marginBottom: 8 }]}>
          Set your filters
        </Text>
        <Text style={[{ color: c.onSurfaceVariant, ...typography.bodyMd, textAlign: 'center' }]}>
          Adjust the filters above and tap{'\n'}"Find Content" to explore.
        </Text>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={styles.stateBox}>
        <View style={[styles.stateIconCircle, { backgroundColor: c.primary + '15' }]}>
          <Ionicons name="search-outline" size={48} color={c.onSurfaceVariant} />
        </View>
        <Text style={[{ color: c.onSurface, ...typography.titleLg, textAlign: 'center', marginBottom: 8 }]}>
          No results found
        </Text>
        <Text style={[{ color: c.onSurfaceVariant, ...typography.bodyMd, textAlign: 'center' }]}>
          Try broadening your filters or removing some criteria.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.resultsSection}>
      {/* Results count */}
      <View style={styles.resultsHeader}>
        <Text style={[{ color: c.onSurface, ...typography.titleLg, fontWeight: '800' }]}>
          Results
        </Text>
        <View style={[styles.countBadge, { backgroundColor: c.primary + '20', borderRadius: radii.full }]}>
          <Text style={[{ color: c.primary, ...typography.labelSm, fontWeight: '700' }]}>
            {totalResults.toLocaleString()} found
          </Text>
        </View>
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {results.map((item) => (
          <DiscoverCard
            key={`${item.tmdbId}-${item.mediaType}`}
            item={item}
            colors={c}
            typography={typography}
            radii={radii}
            onPress={() => onSelectItem(item)}
          />
        ))}
      </View>

      {/* Load More */}
      {hasMore && (
        <TouchableOpacity
          style={[styles.loadMoreBtn, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.md, borderColor: c.outlineVariant + '40' }]}
          onPress={loadMore}
          disabled={loadingMore}
          activeOpacity={0.8}
        >
          {loadingMore
            ? <ActivityIndicator color={c.primary} size="small" />
            : <>
                <Ionicons name="chevron-down-outline" size={16} color={c.primary} />
                <Text style={[{ color: c.primary, ...typography.labelSm, fontWeight: '700', marginLeft: 6 }]}>
                  Load More
                </Text>
              </>
          }
        </TouchableOpacity>
      )}

      {!hasMore && results.length > 0 && (
        <Text style={[styles.endText, { color: c.onSurfaceVariant, ...typography.labelSm }]}>
          — End of results —
        </Text>
      )}
    </View>
  );
}

// ─── Discover Card ─────────────────────────────────────────────────────────────

function DiscoverCard({ item, colors: c, typography, radii, onPress }) {
  return (
    <TouchableOpacity style={styles.cardItem} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.posterWrapper, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.xl }]}>
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.posterPlaceholder, { backgroundColor: c.surfaceContainerHigh }]}>
            <Ionicons name="image-outline" size={32} color={c.onSurfaceVariant} />
          </View>
        )}
        {/* Rating badge */}
        {item.ratingValue > 0 && (
          <View style={[styles.ratingBadge, { backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: radii.sm }]}>
            <Text style={{ color: '#FFD700', fontSize: 10, fontWeight: '800' }}>★ {item.ratingValue.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.cardTitle, { color: c.onSurface, ...typography.labelSm, fontWeight: '700' }]} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={[{ color: c.onSurfaceVariant, fontSize: 10, fontWeight: '600' }]}>
        {item.mediaType === 'movie' ? '🎬' : '📺'} {item.year}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Micro Components ──────────────────────────────────────────────────────────

function SectionLabel({ label, colors, typography }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>
      {label.toUpperCase()}
    </Text>
  );
}

function Divider({ color }) {
  return <View style={[styles.divider, { backgroundColor: color + '20' }]} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 16 },

  pageHeader: { marginBottom: 20 },
  pageTitle: { fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },

  card: { padding: 20, marginBottom: 24 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: { fontWeight: '700', letterSpacing: 1, marginBottom: 12 },

  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  typeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  typeLabel: { fontWeight: '700' },

  logicPill: { flexDirection: 'row', padding: 3 },
  logicOption: { paddingHorizontal: 12, paddingVertical: 4 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontWeight: '700' },
  hScroll: { marginBottom: 4 },
  hChipRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  clearGenres: { marginTop: 8, alignSelf: 'flex-start' },

  ratingRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  ratingDot: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  yearRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  yearInput: {},

  validationBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginTop: 16 },
  validationText: { flex: 1 },

  divider: { height: 1, marginVertical: 20 },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  resetBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderWidth: 1 },
  searchBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  searchBtnText: { fontWeight: '800' },

  // State
  stateBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  stateText: { textAlign: 'center' },
  stateIconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  retryBtn: { paddingHorizontal: 32, paddingVertical: 12 },

  // Results
  resultsSection: { marginBottom: 32 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  countBadge: { paddingHorizontal: 12, paddingVertical: 5 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cardItem: { width: '46%', marginBottom: 8 },
  posterWrapper: { aspectRatio: 2 / 3, overflow: 'hidden', marginBottom: 8, position: 'relative' },
  poster: { width: '100%', height: '100%' },
  posterPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  ratingBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3 },
  cardTitle: { marginBottom: 2 },

  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 24, borderWidth: 1 },
  endText: { textAlign: 'center', marginTop: 24, letterSpacing: 1 },
});
