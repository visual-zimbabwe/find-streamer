import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { watchlistEntryKey } from '../lib/watchlistModel';
import { useBottomNavScroll, useBottomNavVisibility } from '../context/BottomNavVisibilityContext';
import { EmptyState } from './EmptyState';
import {
  ResultsSkeleton,
  GenreChipSkeleton,
  LoadMoreSkeleton,
  PickerListSkeleton,
  SkeletonBlock,
} from './SkeletonLoaders';
import { INTENT_PRESETS, intentPresetActive } from '../lib/languagePresets';
import { SMART_FILTERS } from '../lib/smartFilters';
import {
  RATING_MIN,
  RATING_MAX,
  RATING_STEP,
  YEAR_MIN,
  yearMax,
  RUNTIME_MIN,
  RUNTIME_MAX,
  RUNTIME_STEP,
  ratingLowFromFilters,
  ratingHighFromFilters,
  ratingFiltersFromRange,
  yearLowFromFilters,
  yearHighFromFilters,
  yearFiltersFromRange,
  runtimeLowFromFilters,
  runtimeHighFromFilters,
  runtimeFiltersFromRange,
  formatRatingRange,
  formatYearRange,
  formatRuntimeRange,
  RATING_DISTRIBUTION,
  YEAR_DISTRIBUTION,
} from '../lib/discoverRanges';
import { RangeSlider } from './RangeSlider';
import { shouldPrefetchNextPage } from '../lib/discoverPagination';
import { scale } from '../utils/responsive';
import {
  GOLD_ACCENT,
  GOLD_DIM,
  GRID_PAD,
  GRID_GAP,
  FADE_MS,
  GRID_COL_W,
} from '../theme/programme';
import { ProgrammeSectionHeader } from './ProgrammeSectionHeader';
import { ProgrammeHairline } from './ProgrammeHairline';
import { GridPosterCard } from './GridPosterCard';

// ─── Sort Options (media-type-aware) ──────────────────────────────────────────
const SORT_OPTIONS_MOVIE = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Highest Rated' },
  { value: 'primary_release_date.desc', label: 'Newest First' },
  { value: 'primary_release_date.asc', label: 'Oldest First' },
  { value: 'revenue.desc', label: 'Most Revenue' },
];

const SORT_OPTIONS_TV = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Highest Rated' },
  { value: 'first_air_date.desc', label: 'Newest First' },
  { value: 'first_air_date.asc', label: 'Oldest First' },
];

const AIR_DATE_SORT_OPTION = { value: 'air_date.asc', label: 'Air Date' };

// Resolve an ISO 639-1 code to a human label using the TMDB language list the vm
// already loads; falls back to the upper-cased code before that list arrives.
function labelForLanguageCode(code, languages) {
  const match = Array.isArray(languages) ? languages.find((l) => l.code === code) : null;
  return match?.label || String(code || '').toUpperCase();
}

function buildMultiLabel(items, selectedCodes, emptyLabel, noun) {
  if (!selectedCodes.length) return emptyLabel;

  const labels = selectedCodes
    .map((code) => items.find((item) => item.code === code)?.label || code)
    .filter(Boolean);

  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} ${noun}`;
}

function FilterDivider() {
  return <ProgrammeHairline style={styles.filterHairline} />;
}

function AiringThisWeekChip({ active, onToggle, colors, typography, radii }) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { borderRadius: radii.md },
        active
          ? { backgroundColor: GOLD_ACCENT }
          : {
              backgroundColor: colors.glass,
              borderWidth: 1,
              borderColor: GOLD_DIM,
            },
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        onToggle();
      }}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityLabel="Airing this week"
      accessibilityHint="Shows only TV titles with an episode airing between today and Sunday"
      accessibilityState={{ selected: active }}
    >
      <Ionicons
        name="calendar-outline"
        size={14}
        color={active ? '#141414' : colors.onSurfaceVariant}
        style={{ marginRight: 6 }}
      />
      <Text
        style={[
          styles.chipTextUpper,
          { color: active ? '#141414' : colors.onSurfaceVariant, ...typography.labelSm },
        ]}
      >
        Airing this week
      </Text>
    </TouchableOpacity>
  );
}

function MediaTypeTabs({ mediaType, onChange, colors, typography }) {
  const tabs = [
    { key: 'movie', label: 'Movies', icon: 'film-outline' },
    { key: 'tv', label: 'Shows', icon: 'tv-outline' },
  ];

  return (
    <View style={styles.mediaTabsRow}>
      {tabs.map((tab) => {
        const active = mediaType === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.mediaTab}
            onPress={() => {
              if (!active) {
                Haptics.selectionAsync();
                onChange(tab.key);
              }
            }}
            activeOpacity={0.78}
            accessibilityRole="tab"
            accessibilityLabel={tab.key === 'movie' ? 'Show movie filters' : 'Show TV show filters'}
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={tab.icon}
              size={14}
              color={active ? GOLD_ACCENT : colors.onSurfaceVariant}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.mediaTabLabel,
                {
                  color: active ? colors.onSurface : colors.onSurfaceVariant,
                  ...typography.labelSm,
                },
                active && styles.mediaTabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
            {active && (
              <View style={[styles.mediaTabUnderline, { backgroundColor: GOLD_ACCENT }]} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Searchable Picker Modal ───────────────────────────────────────────────────
const PickerItem = React.memo(({ item, active, onPress, colors, typography }) => {
  return (
    <TouchableOpacity
      style={[pickerStyles.pickerRow, active && { backgroundColor: GOLD_ACCENT + '18' }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[
          {
            flex: 1,
            color: active ? GOLD_ACCENT : colors.onSurface,
            ...typography.bodyMd,
            fontWeight: active ? '700' : '400',
          },
        ]}
      >
        {item.label}
      </Text>
      {active && <Ionicons name="checkmark" size={18} color={GOLD_ACCENT} />}
    </TouchableOpacity>
  );
});

function SearchablePickerModal({
  visible,
  onClose,
  title,
  items, // [{ code, label }]
  selectedCodes = [],
  onToggle,
  onClear,
  loading,
  colors,
  typography,
  radii,
}) {
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const handleSelect = useCallback(
    (item) => {
      Haptics.selectionAsync();
      if (item.code == null) {
        onClear();
        setQuery('');
        return;
      }
      onToggle(item.code);
    },
    [onClear, onToggle],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const active =
        item.code == null ? selectedCodes.length === 0 : selectedCodes.includes(item.code);
      return (
        <PickerItem
          item={item}
          active={active}
          onPress={() => handleSelect(item)}
          colors={colors}
          typography={typography}
        />
      );
    },
    [selectedCodes, colors, typography, handleSelect],
  );

  const getItemLayout = useCallback(
    (_, index) => ({
      length: 48,
      offset: 48 * index,
      index,
    }),
    [],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={pickerStyles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View
            style={[
              pickerStyles.sheet,
              {
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            {/* Header */}
            <View style={pickerStyles.sheetHeader}>
              <Text style={[{ color: colors.onSurface, ...typography.titleMd, fontWeight: '700' }]}>
                {title}
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Done selecting ${title.toLowerCase()}`}
              >
                <Text style={[{ color: GOLD_ACCENT, ...typography.labelSm, fontWeight: '800' }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View
              style={[
                pickerStyles.searchBox,
                { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.md },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={16}
                color={colors.onSurfaceVariant}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={[{ flex: 1, color: colors.onSurface, ...typography.bodyMd }]}
                placeholder="Search…"
                placeholderTextColor={colors.onSurfaceVariant}
                value={query}
                onChangeText={setQuery}
                autoFocus
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => setQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear picker search"
                >
                  <Ionicons name="close-circle-outline" size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <PickerListSkeleton count={8} />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => String(item.code ?? '__any__')}
                style={{ maxHeight: 380 }}
                keyboardShouldPersistTaps="handled"
                renderItem={renderItem}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={11}
                getItemLayout={getItemLayout}
                ListEmptyComponent={
                  <Text
                    style={[
                      {
                        color: colors.onSurfaceVariant,
                        ...typography.bodyMd,
                        textAlign: 'center',
                        marginTop: 24,
                      },
                    ]}
                  >
                    No matches found
                  </Text>
                }
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function DiscoverScreen({
  onSelectItem,
  vm,
  onToggleWatchlist,
  watchlistIds = [],
  recommendedLanguageCodes = [],
}) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const c = colors;
  const insets = useSafeAreaInsets();
  const bottomNavScroll = useBottomNavScroll();
  const scrollRef = useRef(null);

  const [langModalVisible, setLangModalVisible] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const previousMediaTypeRef = useRef(vm.filters.mediaType);

  // Sticky footer (Search + live count). It rides the bottom-nav auto-hide.
  // (It used to also duck for the keyboard raised by the year/rating/runtime text
  // inputs; those are sliders now, so nothing on this scroll summons a keyboard.)
  const { visible: navVisible } = useBottomNavVisibility();
  const [footerH, setFooterH] = useState(scale(120));
  const footerTranslate = useRef(new Animated.Value(0)).current;

  // Sort options depend on mediaType and airing filter
  const sortOptions = useMemo(() => {
    const base = vm.filters.mediaType === 'movie' ? SORT_OPTIONS_MOVIE : SORT_OPTIONS_TV;
    if (vm.filters.mediaType === 'tv' && vm.filters.airingThisWeek) {
      return [...base, AIR_DATE_SORT_OPTION];
    }
    return base;
  }, [vm.filters.mediaType, vm.filters.airingThisWeek]);

  // Ensure current sortBy is valid for the current media type
  const validSortValues = sortOptions.map((o) => o.value);
  const displayedSortBy = validSortValues.includes(vm.filters.sortBy)
    ? vm.filters.sortBy
    : 'popularity.desc';

  // Quick Picks: one language chip per top language in the Highly Recommend list
  // (personalized), then the static Documentary shortcut. Each is a stateless
  // patch, so it flows through the same applyIntentPreset/intentPresetActive
  // engine the old curated presets used. When the recommend list has no language
  // data yet, the row degrades to just Documentary — never blank.
  const quickPickPresets = useMemo(() => {
    const languagePresets = recommendedLanguageCodes.map((code) => ({
      id: `lang:${code}`,
      label: labelForLanguageCode(code, vm.languages),
      icon: 'language-outline',
      patch: { languageCodes: [code], excludeEnglish: false },
    }));
    return [...languagePresets, ...INTENT_PRESETS];
  }, [recommendedLanguageCodes, vm.languages]);

  const selectedLanguageCodes = vm.filters.languageCodes || [];
  const selectedOriginCountries = vm.filters.originCountries || [];
  const langLabel = buildMultiLabel(
    vm.languages,
    selectedLanguageCodes,
    'Any Language',
    'languages',
  );
  const countryLabel = buildMultiLabel(
    vm.countries,
    selectedOriginCountries,
    'Any Country',
    'countries',
  );

  // Language / country control state (inline, no nested sheet).
  const languageActive = selectedLanguageCodes.length > 0 || !!vm.filters.excludeEnglish;
  const languageLabel = vm.filters.excludeEnglish ? 'Non-English' : langLabel;
  const countryActive = selectedOriginCountries.length > 0;

  const advancedCriteriaActive =
    !!vm.filters.fromYear ||
    !!vm.filters.toYear ||
    !!vm.filters.minRuntime ||
    !!vm.filters.maxRuntime ||
    vm.filters.sortBy !== 'popularity.desc';

  // Load genres when mediaType changes; reset genre selections that might not apply
  useEffect(() => {
    vm.loadGenres(vm.filters.mediaType);
    const previousMediaType = previousMediaTypeRef.current;
    if (previousMediaType !== vm.filters.mediaType) {
      vm.updateFilter('genreIds', []);
      vm.updateFilter('excludeGenreIds', []);
      vm.updateFilter('excludeSmartTags', []);
      vm.updateFilter('includeSmartTags', []);
      if (vm.filters.mediaType === 'movie') {
        vm.updateFilter('originCountries', []);
      }
      if (vm.filters.mediaType === 'tv') {
        vm.updateFilter('minRuntime', '');
        vm.updateFilter('maxRuntime', '');
      }
      if (vm.filters.mediaType === 'tv' && vm.filters.sortBy === 'revenue.desc') {
        vm.updateFilter('sortBy', 'popularity.desc');
      }
      previousMediaTypeRef.current = vm.filters.mediaType;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.filters.mediaType]);

  // Preload languages & countries on mount
  useEffect(() => {
    vm.loadLanguages();
    vm.loadCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slide the footer down in concert with the bottom nav. Mirrors BottomNav's own
  // RN-Animated translateY, which is the one place native-driver translate is
  // proven reliable here.
  useEffect(() => {
    Animated.timing(footerTranslate, {
      toValue: navVisible ? 0 : footerH + scale(24),
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [navVisible, footerH, footerTranslate]);

  // Cycle a genre chip through neutral \u2192 include \u2192 exclude \u2192 neutral with one tap.
  // The vm's toggle* helpers already move a genre between groups, so this is just
  // a state machine over which helper to call for the chip's current state.
  const cycleGenre = (id) => {
    if (vm.filters.genreIds.includes(id)) {
      vm.toggleExcludeGenre(id); // include \u2192 exclude (helper moves it across)
    } else if (vm.filters.excludeGenreIds.includes(id)) {
      vm.toggleExcludeGenre(id); // exclude \u2192 neutral
    } else {
      vm.toggleGenre(id); // neutral \u2192 include
    }
  };

  // Same tri-state cycle for a smart tag (Anime), across the include/exclude
  // smart-tag groups.
  const cycleSmartTag = (key) => {
    if (vm.filters.includeSmartTags.includes(key)) {
      vm.toggleSmartTag(key); // include \u2192 exclude (toggleSmartTag drops it from include)
    } else if (vm.filters.excludeSmartTags.includes(key)) {
      vm.toggleSmartTag(key); // exclude \u2192 neutral
    } else {
      vm.toggleIncludeSmartTag(key); // neutral \u2192 include
    }
  };

  const clearGenreFilters = () => {
    vm.updateFilter('genreIds', []);
    vm.updateFilter('excludeGenreIds', []);
    vm.updateFilter('excludeSmartTags', []);
    vm.updateFilter('includeSmartTags', []);
  };

  const filterSurface = colors.glass;

  const atmosphereColors = useMemo(
    () => [colors.surfaceContainerHigh, colors.background],
    [colors.surfaceContainerHigh, colors.background],
  );

  // ── Search button: live count + stale-aware label ──────────────────────────
  const previewCount = vm.previewCount;
  const hasPreview = previewCount != null;
  const zeroMatches = hasPreview && previewCount === 0;
  const searchDisabled = vm.loading || zeroMatches;
  const countText = hasPreview ? previewCount.toLocaleString() : null;
  const searchLabel = zeroMatches
    ? 'No matches'
    : vm.resultsStale
      ? countText
        ? `Update · ${countText}`
        : 'Update'
      : countText
        ? `Search · ${countText}`
        : 'Search';
  const searchAccessibilityLabel = zeroMatches
    ? 'No titles match these filters'
    : `${vm.resultsStale ? 'Update results' : 'Search'}${
        hasPreview ? `, ${previewCount} titles` : ''
      }`;

  // Rec #1(a): the whole screen is now a single virtualized FlatList — the filter
  // stack rides in ListHeaderComponent, the poster grid is the list data, and
  // `onEndReached` prefetches the next page so a browse session never stops under
  // the thumb. The old manual "Load More" button survives as a fast-flick fallback
  // and the retry affordance (see buildResultsView). Virtualization is what makes
  // auto-prefetch safe: without recycling, auto-loading would grow an unbounded
  // tree of mounted poster cards — the very tree the tap-friction used to bound.
  const handleEndReached = useCallback(() => {
    if (
      !shouldPrefetchNextPage({
        hasSearched: vm.hasSearched,
        loading: vm.loading,
        loadingMore: vm.loadingMore,
        loadMoreError: vm.loadMoreError,
        hasMore: vm.hasMore,
      })
    ) {
      return;
    }
    vm.loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.hasSearched, vm.loading, vm.loadingMore, vm.loadMoreError, vm.hasMore, vm.loadMore]);

  const rv = buildResultsView({ vm, colors: c, typography, radii });

  const renderGridItem = ({ item }) => (
    <DiscoverCard
      item={item}
      colors={c}
      typography={typography}
      radii={radii}
      onPress={() => onSelectItem(item)}
      onQuickSave={() => onToggleWatchlist?.(item)}
      isSaved={watchlistIds.includes(watchlistEntryKey(item))}
      showAirDay={rv.showAirDay}
    />
  );

  // The filter stack + the results/trending section header. Built as an element
  // (not an inline component) so React reconciles it in place across renders —
  // remounting it would tear down an in-progress RangeSlider drag.
  const listHeader = (
    <>
      <ProgrammeSectionHeader
        eyebrow="DISCOVER"
        title="Find something to watch"
        subtitle="Start with a vibe, or fine-tune below"
      />

      <MediaTypeTabs
        mediaType={vm.filters.mediaType}
        onChange={(type) => vm.updateFilter('mediaType', type)}
        colors={c}
        typography={typography}
      />

      <View style={styles.filterBand}>
        <SectionLabel label="Quick picks" colors={c} typography={typography} />
        <IntentPresetRow
          presets={quickPickPresets}
          filters={vm.filters}
          onApply={vm.applyIntentPreset}
          colors={c}
          typography={typography}
          radii={radii}
        />
      </View>

      <FilterDivider />

      {vm.filters.mediaType === 'tv' && (
        <>
          <View style={styles.filterBand}>
            <SectionLabel label="Schedule" colors={c} typography={typography} />
            <View style={styles.hChipRow}>
              <AiringThisWeekChip
                active={vm.filters.airingThisWeek}
                onToggle={() => vm.updateFilter('airingThisWeek', !vm.filters.airingThisWeek)}
                colors={c}
                typography={typography}
                radii={radii}
              />
            </View>
          </View>
          <FilterDivider />
        </>
      )}

      <View style={styles.filterBand}>
        <GenreFilterSection
          genres={vm.genres}
          genresLoading={vm.genresLoading}
          genreIds={vm.filters.genreIds}
          genreLogic={vm.filters.genreLogic}
          excludeGenreIds={vm.filters.excludeGenreIds}
          includeSmartTags={vm.filters.includeSmartTags}
          excludeSmartTags={vm.filters.excludeSmartTags}
          onCycleGenre={cycleGenre}
          onCycleSmartTag={cycleSmartTag}
          onUpdateGenreLogic={(v) => vm.updateFilter('genreLogic', v)}
          onClearAll={clearGenreFilters}
          colors={c}
          typography={typography}
          radii={radii}
        />
      </View>

      <FilterDivider />

      <View style={styles.filterBand}>
        <SectionLabel
          label="Rating"
          value={formatRatingRange(vm.filters.minRating, vm.filters.maxRating)}
          colors={c}
          typography={typography}
        />
        <RangeSlider
          min={RATING_MIN}
          max={RATING_MAX}
          step={RATING_STEP}
          low={ratingLowFromFilters(vm.filters.minRating)}
          high={ratingHighFromFilters(vm.filters.maxRating)}
          onChange={(lo, hi) => {
            const { minRating, maxRating } = ratingFiltersFromRange(lo, hi);
            vm.updateFilter('minRating', minRating);
            vm.updateFilter('maxRating', maxRating);
          }}
          distribution={RATING_DISTRIBUTION}
          colors={c}
          labelLow="Minimum rating"
          labelHigh="Maximum rating"
          formatValue={(n) => `${n} out of 10`}
        />
      </View>

      <FilterDivider />

      <View style={styles.filterBand}>
        <SectionLabel label="Language" colors={c} typography={typography} />
        <InlinePickerButton
          icon="language-outline"
          label={languageLabel}
          active={languageActive}
          onOpen={() => setLangModalVisible(true)}
          onClear={() => vm.clearPreset()}
          accessibilityLabel={`Language, ${languageLabel}`}
          clearAccessibilityLabel="Clear language filter"
          surface={filterSurface}
          colors={c}
          typography={typography}
          radii={radii}
        />
      </View>

      {vm.filters.mediaType === 'tv' && (
        <>
          <FilterDivider />
          <View style={styles.filterBand}>
            <SectionLabel label="Country" colors={c} typography={typography} />
            <InlinePickerButton
              icon="globe-outline"
              label={countryLabel}
              active={countryActive}
              onOpen={() => setCountryModalVisible(true)}
              onClear={() => vm.updateFilter('originCountries', [])}
              accessibilityLabel={`Country, ${countryLabel}`}
              clearAccessibilityLabel="Clear country filter"
              surface={filterSurface}
              colors={c}
              typography={typography}
              radii={radii}
            />
          </View>
        </>
      )}

      <FilterDivider />

      <View style={styles.filterBand}>
        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => {
            Haptics.selectionAsync();
            setAdvancedExpanded((open) => !open);
          }}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={`${advancedExpanded ? 'Collapse' : 'Expand'} advanced filters`}
          accessibilityState={{ expanded: advancedExpanded }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionLabel, { color: c.onSurface, ...typography.labelSm }]}>
              Advanced
            </Text>
            {advancedCriteriaActive ? (
              <Text style={[{ color: GOLD_ACCENT, ...typography.labelSm, marginTop: 2 }]}>
                Year, runtime, or sort customized
              </Text>
            ) : (
              <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm, marginTop: 2 }]}>
                Release year, runtime, sort order
              </Text>
            )}
          </View>
          <Ionicons
            name={advancedExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={16}
            color={advancedCriteriaActive ? GOLD_ACCENT : c.onSurfaceVariant}
          />
        </TouchableOpacity>
      </View>

      {advancedExpanded && (
        <>
          <View style={styles.filterBand}>
            <SectionLabel
              label="Release Year"
              value={formatYearRange(vm.filters.fromYear, vm.filters.toYear)}
              colors={c}
              typography={typography}
            />
            <RangeSlider
              min={YEAR_MIN}
              max={yearMax()}
              step={1}
              low={yearLowFromFilters(vm.filters.fromYear)}
              high={yearHighFromFilters(vm.filters.toYear)}
              onChange={(lo, hi) => {
                const { fromYear, toYear } = yearFiltersFromRange(lo, hi);
                vm.updateFilter('fromYear', fromYear);
                vm.updateFilter('toYear', toYear);
              }}
              distribution={YEAR_DISTRIBUTION}
              colors={c}
              labelLow="Earliest year"
              labelHigh="Latest year"
              formatValue={(n) => String(n)}
            />
          </View>

          {vm.filters.mediaType === 'movie' && (
            <>
              <FilterDivider />

              <View style={styles.filterBand}>
                <SectionLabel
                  label="Runtime"
                  value={formatRuntimeRange(vm.filters.minRuntime, vm.filters.maxRuntime)}
                  colors={c}
                  typography={typography}
                />
                <RangeSlider
                  min={RUNTIME_MIN}
                  max={RUNTIME_MAX}
                  step={RUNTIME_STEP}
                  low={runtimeLowFromFilters(vm.filters.minRuntime)}
                  high={runtimeHighFromFilters(vm.filters.maxRuntime)}
                  onChange={(lo, hi) => {
                    const { minRuntime, maxRuntime } = runtimeFiltersFromRange(lo, hi);
                    vm.updateFilter('minRuntime', minRuntime);
                    vm.updateFilter('maxRuntime', maxRuntime);
                  }}
                  colors={c}
                  labelLow="Minimum runtime"
                  labelHigh="Maximum runtime"
                  formatValue={(n) => `${n} minutes`}
                />
              </View>
            </>
          )}

          <FilterDivider />

          <View style={styles.filterBand}>
            <SectionLabel label="Sort" colors={c} typography={typography} />
            <SortByControl
              sortOptions={sortOptions}
              displayedSortBy={displayedSortBy}
              onChange={(value) => vm.updateFilter('sortBy', value)}
              colors={c}
              typography={typography}
              radii={radii}
            />
          </View>
        </>
      )}

      <ProgrammeHairline style={styles.resultsHairline} />

      {rv.headerNode}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <LinearGradient colors={atmosphereColors} style={styles.atmosphereTop} pointerEvents="none" />
      <FlatList
        ref={scrollRef}
        style={styles.root}
        data={rv.gridData}
        numColumns={2}
        columnWrapperStyle={rv.gridData.length ? styles.gridColumnWrapper : undefined}
        keyExtractor={(item) => `${item.tmdbId}-${item.mediaType}`}
        renderItem={renderGridItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={rv.emptyNode}
        ListFooterComponent={rv.footerNode}
        onEndReached={handleEndReached}
        onEndReachedThreshold={1}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + scale(12), paddingBottom: footerH + scale(16) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        {...bottomNavScroll}
      />

      {/* ── Language Picker Modal (kept as Modal for keyboard support) ── */}
      <SearchablePickerModal
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
        title="Select Language"
        items={vm.languages}
        selectedCodes={selectedLanguageCodes}
        onToggle={(code) => {
          vm.toggleFilterValue('languageCodes', code);
          vm.updateFilter('activePreset', null);
          vm.updateFilter('excludeEnglish', false);
        }}
        onClear={() => vm.clearPreset()}
        loading={vm.languagesLoading}
        colors={c}
        typography={typography}
        radii={radii}
      />

      {/* ── Country Picker Modal (kept as Modal for keyboard support) ── */}
      <SearchablePickerModal
        visible={countryModalVisible}
        onClose={() => setCountryModalVisible(false)}
        title="Select Country"
        items={vm.countries}
        selectedCodes={selectedOriginCountries}
        onToggle={(code) => vm.toggleFilterValue('originCountries', code)}
        onClear={() => vm.updateFilter('originCountries', [])}
        loading={vm.countriesLoading}
        colors={c}
        typography={typography}
        radii={radii}
      />

      {/* ── Sticky action bar: Reset + Search (with live count) ── */}
      <Animated.View
        style={[
          styles.stickyFooter,
          {
            backgroundColor: c.background,
            paddingBottom: insets.bottom + scale(54) + scale(10),
            transform: [{ translateY: footerTranslate }],
          },
        ]}
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
      >
        {vm.validationError && (
          <View
            style={[
              styles.validationBannerFooter,
              { backgroundColor: colors.error + '18', borderRadius: radii.md },
            ]}
          >
            <Ionicons name="warning-outline" size={16} color={colors.error} />
            <Text style={[styles.validationText, { color: colors.error, ...typography.bodyMd }]}>
              {vm.validationError}
            </Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.resetBtn, { borderRadius: radii.md, borderColor: GOLD_DIM }]}
            onPress={vm.resetFilters}
            accessibilityRole="button"
            accessibilityLabel="Reset discover filters"
          >
            <Text
              style={[styles.actionBtnText, { color: c.onSurfaceVariant, ...typography.labelSm }]}
            >
              Reset
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.searchBtn,
              {
                backgroundColor:
                  zeroMatches && !vm.loading ? c.surfaceContainerHigh : GOLD_ACCENT,
                borderRadius: radii.md,
                borderWidth: zeroMatches && !vm.loading ? StyleSheet.hairlineWidth : 0,
                borderColor: GOLD_DIM,
              },
            ]}
            onPress={vm.search}
            activeOpacity={0.85}
            disabled={searchDisabled}
            accessibilityRole="button"
            accessibilityLabel={searchAccessibilityLabel}
            accessibilityState={{ disabled: searchDisabled }}
          >
            {vm.loading ? (
              <View style={styles.searchBtnLoader}>
                <SkeletonBlock style={StyleSheet.absoluteFill} />
              </View>
            ) : (
              <Text
                style={[
                  styles.actionBtnText,
                  {
                    color: zeroMatches ? c.onSurfaceVariant : '#141414',
                    ...typography.labelSm,
                  },
                ]}
              >
                {searchLabel}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Intent Preset Row ─────────────────────────────────────────────────────────
// One-tap "quick picks". The chips are now personalized: a language chip per
// top language in the user's Highly Recommend list, followed by the static
// Documentary shortcut. Each chip is still a thin patch over the filter
// primitives; activeness is derived from the live filters, so a chip lights up
// whenever the filters already match it — no separate state to drift.

function IntentPresetRow({ presets, filters, onApply, colors: c, typography, radii }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.presetRow}
    >
      {presets.map((preset) => {
        const active = intentPresetActive(preset, filters);
        return (
          <TouchableOpacity
            key={preset.id}
            style={[
              styles.presetCard,
              { borderRadius: radii.lg },
              active
                ? { backgroundColor: GOLD_ACCENT, borderColor: GOLD_ACCENT }
                : { backgroundColor: c.surfaceContainerHigh, borderColor: GOLD_DIM },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onApply(preset);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${preset.label} quick pick`}
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={preset.icon}
              size={16}
              color={active ? '#141414' : GOLD_ACCENT}
              style={{ marginRight: 7 }}
            />
            <Text
              style={[
                styles.presetLabel,
                { color: active ? '#141414' : c.onSurface, ...typography.labelSm },
              ]}
            >
              {preset.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Inline Picker Button ──────────────────────────────────────────────────────
// The Language / Country control: opens a searchable value picker, shows the
// current selection, and offers an inline clear. Replaces the old nested
// "Language & Country" sheet-that-opened-another-sheet.

function InlinePickerButton({
  icon,
  label,
  active,
  onOpen,
  onClear,
  accessibilityLabel,
  clearAccessibilityLabel,
  surface,
  colors: c,
  typography,
  radii,
}) {
  return (
    <TouchableOpacity
      style={[
        styles.pickerButton,
        {
          backgroundColor: surface,
          borderRadius: radii.md,
          borderColor: active ? GOLD_ACCENT + '55' : GOLD_DIM,
        },
      ]}
      onPress={onOpen}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons
        name={icon}
        size={16}
        color={active ? GOLD_ACCENT : c.onSurfaceVariant}
        style={{ marginRight: 8 }}
      />
      <Text
        style={[
          { flex: 1, color: active ? c.onSurface : c.onSurfaceVariant, ...typography.bodyMd },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {active && (
        <TouchableOpacity
          onPress={onClear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={clearAccessibilityLabel}
        >
          <Ionicons name="close-circle-outline" size={16} color={c.onSurfaceVariant} />
        </TouchableOpacity>
      )}
      <Ionicons
        name="chevron-down-outline"
        size={16}
        color={c.onSurfaceVariant}
        style={{ marginLeft: 4 }}
      />
    </TouchableOpacity>
  );
}

// ─── More Filters Bottom Sheet ───────────────────────────────────────────────

function SortByControl({ sortOptions, displayedSortBy, onChange, colors: c, typography, radii }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.hScroll, { marginBottom: 8 }]}
    >
      <View style={styles.hChipRow}>
        {sortOptions.map((opt) => {
          const active = displayedSortBy === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.chip,
                { borderRadius: radii.md },
                active
                  ? { backgroundColor: GOLD_ACCENT }
                  : {
                      backgroundColor: c.surfaceContainerHigh,
                      borderWidth: 1,
                      borderColor: GOLD_DIM,
                    },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(opt.value);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${opt.label}`}
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.chipTextUpper,
                  { color: active ? '#141414' : c.onSurfaceVariant, ...typography.labelSm },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Genre Filter Section ─────────────────────────────────────────────────────
// One tri-state grammar for the whole section: tapping a genre (or smart filter)
// cycles it neutral → include → exclude → neutral. No tabs, no per-tab colour
// remapping — a chip means exactly one thing at all times.

function GenreFilterSection({
  genres,
  genresLoading,
  genreIds,
  genreLogic,
  excludeGenreIds,
  includeSmartTags,
  excludeSmartTags,
  onCycleGenre,
  onCycleSmartTag,
  onUpdateGenreLogic,
  onClearAll,
  colors: c,
  typography,
  radii,
}) {
  const hasAnySelection =
    genreIds.length > 0 ||
    excludeGenreIds.length > 0 ||
    includeSmartTags.length > 0 ||
    excludeSmartTags.length > 0;

  return (
    <View>
      {/* ── Section header ── */}
      <View style={styles.sectionRow}>
        <SectionLabel label="Genres" colors={c} typography={typography} />
        {hasAnySelection && (
          <TouchableOpacity
            onPress={onClearAll}
            accessibilityRole="button"
            accessibilityLabel="Clear all genre filters"
          >
            <Text style={[{ color: GOLD_ACCENT, ...typography.labelSm }]}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tri-state legend ── */}
      <View style={genreStyles.legendRow}>
        <View style={[genreStyles.legendDot, { backgroundColor: GOLD_ACCENT }]} />
        <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm }]}>Include</Text>
        <View
          style={[genreStyles.legendDot, { backgroundColor: c.error, marginLeft: 14 }]}
        />
        <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm }]}>Exclude</Text>
        <Text
          style={[
            { color: c.onSurfaceVariant, ...typography.labelSm, marginLeft: 14, flex: 1 },
          ]}
          numberOfLines={1}
        >
          · tap to cycle
        </Text>
      </View>

      {/* ── AND / OR logic — governs how included genres combine ── */}
      {genreIds.length > 0 && (
        <View style={[genreStyles.logicRow]}>
          <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm, marginRight: 8 }]}>
            Match:
          </Text>
          <View
            style={[
              styles.logicPill,
              { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.full },
            ]}
          >
            {['AND', 'OR'].map((mode) => {
              const active = genreLogic === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.logicOption,
                    active && { backgroundColor: GOLD_ACCENT, borderRadius: radii.full },
                  ]}
                  onPress={() => {
                    if (genreLogic !== mode) {
                      Haptics.selectionAsync();
                    }
                    onUpdateGenreLogic(mode);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${mode} genre matching`}
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      {
                        color: active ? '#141414' : c.onSurfaceVariant,
                        ...typography.labelSm,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {mode}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text
            style={[{ color: c.onSurfaceVariant, ...typography.labelSm, marginLeft: 8, flex: 1 }]}
            numberOfLines={1}
          >
            {genreLogic === 'AND' ? 'all included genres' : 'any included genre'}
          </Text>
        </View>
      )}

      {/* ── Genre chips (tri-state) ── */}
      {genresLoading ? (
        <GenreChipSkeleton count={10} />
      ) : (
        <View style={styles.chipWrap}>
          {genres.map((genre) => {
            const included = genreIds.includes(genre.id);
            const excluded = excludeGenreIds.includes(genre.id);
            let chipBg = c.surfaceContainerHigh;
            let chipBorder = { borderWidth: 1, borderColor: GOLD_DIM };
            let textColor = c.onSurfaceVariant;
            let icon = null;
            let iconColor = null;
            if (included) {
              chipBg = GOLD_ACCENT;
              chipBorder = {};
              textColor = '#141414';
              icon = 'checkmark';
              iconColor = '#141414';
            } else if (excluded) {
              chipBg = c.error;
              chipBorder = {};
              textColor = c.onPrimary;
              icon = 'close';
              iconColor = c.onPrimary;
            }

            return (
              <TouchableOpacity
                key={genre.id}
                style={[
                  styles.chip,
                  { borderRadius: radii.full, backgroundColor: chipBg },
                  chipBorder,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  onCycleGenre(genre.id);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${genre.name} genre${
                  included ? ', included' : excluded ? ', excluded' : ''
                }`}
                accessibilityHint="Cycles include, exclude, off"
                accessibilityState={{ selected: included || excluded }}
              >
                {icon && (
                  <Ionicons name={icon} size={12} color={iconColor} style={{ marginRight: 3 }} />
                )}
                <Text style={[styles.chipText, { color: textColor, ...typography.labelSm }]}>
                  {genre.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {genresLoading || hasAnySelection ? null : (
        <Text
          style={[
            { color: c.onSurfaceVariant, ...typography.labelSm, marginTop: 8, fontStyle: 'italic' },
          ]}
        >
          Tap a genre to include it; tap again to exclude.
        </Text>
      )}

      {/* ── Smart filters (Anime, …) — same tri-state grammar ── */}
      <View style={genreStyles.smartTagsHeader}>
        <Ionicons
          name="sparkles-outline"
          size={13}
          color={c.onSurfaceVariant}
          style={{ marginRight: 6 }}
        />
        <Text
          style={[
            { color: c.onSurfaceVariant, ...typography.labelSm, fontWeight: '700', letterSpacing: 0.8 },
          ]}
        >
          SMART FILTERS
        </Text>
      </View>

      {SMART_FILTERS.map((tag) => {
        const inc = includeSmartTags.includes(tag.key);
        const exc = excludeSmartTags.includes(tag.key);
        const stateColor = inc ? GOLD_ACCENT : exc ? c.error : c.onSurfaceVariant;
        const stateLabel = inc ? 'INCLUDE' : exc ? 'EXCLUDE' : 'OFF';
        const rowBg = inc ? GOLD_ACCENT + '18' : exc ? c.error + '18' : c.surfaceContainerHigh;
        const rowBorder = inc ? GOLD_ACCENT : exc ? c.error : c.outlineVariant + '40';
        const rowIcon = inc ? 'sparkles' : exc ? 'close-circle' : 'sparkles-outline';
        return (
          <View key={tag.key}>
            <TouchableOpacity
              style={[
                genreStyles.smartTagChip,
                { borderRadius: radii.md, backgroundColor: rowBg, borderColor: rowBorder },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                onCycleSmartTag(tag.key);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${tag.label} smart filter, ${stateLabel.toLowerCase()}`}
              accessibilityHint="Cycles include, exclude, off"
              accessibilityState={{ selected: inc || exc }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons
                  name={rowIcon}
                  size={18}
                  color={inc || exc ? stateColor : c.onSurfaceVariant}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      { color: inc || exc ? stateColor : c.onSurface, ...typography.bodyMd, fontWeight: '700' },
                    ]}
                  >
                    {tag.label}
                  </Text>
                  <Text
                    style={[{ color: c.onSurfaceVariant, ...typography.labelSm, marginTop: 2 }]}
                    numberOfLines={2}
                  >
                    Smart filter · not a TMDB genre
                  </Text>
                </View>
              </View>
              <View
                style={[
                  genreStyles.smartTagBadge,
                  { backgroundColor: inc || exc ? stateColor : c.surfaceContainerHigh, borderRadius: radii.sm },
                ]}
              >
                <Text
                  style={[
                    { color: inc || exc ? c.onPrimary : c.onSurfaceVariant, fontSize: 10, fontWeight: '800' },
                  ]}
                >
                  {stateLabel}
                </Text>
              </View>
            </TouchableOpacity>

            {(inc || exc) && (
              <View
                style={[
                  genreStyles.smartTagInfo,
                  { backgroundColor: stateColor + '10', borderRadius: radii.sm, borderLeftColor: stateColor },
                ]}
              >
                <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm }]}>
                  {inc ? tag.includeDescription : tag.excludeDescription}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Results View ─────────────────────────────────────────────────────────────
// Computes the four FlatList slots — the grid data, the section header (rides in
// ListHeaderComponent under the filters), the empty/placeholder node, and the
// footer (load-more / retry / end-of-results) — for whichever state Discover is
// in. Pure: it builds elements but mounts nothing, so the parent FlatList owns
// scrolling and virtualization.
function buildResultsView({ vm, colors: c, typography, radii }) {
  const {
    loading,
    error,
    errorInfo,
    clearError,
    hasSearched,
    results,
    totalResults,
    hasMore,
    loadingMore,
    loadMore,
    loadMoreError,
    clearLoadMoreError,
    enrichingResults,
  } = vm;

  const empty = { gridData: [], headerNode: null, emptyNode: null, footerNode: null, showAirDay: false };

  // Only skeleton on a first search. A refine keeps the previous grid on screen
  // (see search() — it no longer blanks results) and swaps under an inline
  // "updating" badge instead of flickering to a skeleton.
  if (loading && results.length === 0) {
    return {
      ...empty,
      headerNode: <ProgrammeSectionHeader eyebrow="RESULTS" title="Searching" />,
      emptyNode: <ResultsSkeleton count={4} />,
    };
  }

  if (error) {
    return {
      ...empty,
      emptyNode: (
        <View style={styles.stateBox}>
          <EmptyState
            variant={errorInfo?.severity === 'offline' ? 'offline' : 'service'}
            title={errorInfo?.title || 'Something went wrong'}
            description={error}
            primaryAction={{
              label: 'Refresh',
              icon: 'refresh-outline',
              onPress: () => {
                clearError();
                vm.search();
              },
              accessibilityLabel: 'Refresh discover results',
            }}
            compact
          />
        </View>
      ),
    };
  }

  if (!hasSearched) {
    // Pre-search: show the Trakt trending rail already fetched on mount instead
    // of a blank prompt — the screen gives value on arrival. Falls back to the
    // prompt only if trending is genuinely unavailable.
    if (vm.trendingLoading && vm.trendingResults.length === 0) {
      return {
        ...empty,
        headerNode: <ProgrammeSectionHeader eyebrow="TRENDING" title="Trending now" />,
        emptyNode: <ResultsSkeleton count={4} />,
      };
    }
    if (vm.trendingResults.length > 0) {
      // The trending rail is a single fixed page, so it has no footer and
      // onEndReached is inert here (handleEndReached bails when !hasSearched).
      return {
        ...empty,
        gridData: vm.trendingResults,
        headerNode: (
          <View style={styles.resultsHeader}>
            <ProgrammeSectionHeader
              eyebrow="TRENDING"
              title="Trending now"
              subtitle="Popular this week — or set your filters and search"
            />
          </View>
        ),
      };
    }
    return {
      ...empty,
      emptyNode: (
        <View style={styles.stateBox}>
          <View style={[styles.stateIconCircle, { backgroundColor: GOLD_ACCENT + '15' }]}>
            <Ionicons name="telescope-outline" size={48} color={GOLD_ACCENT} />
          </View>
          <Text style={[styles.stateEyebrow, { color: GOLD_ACCENT, ...typography.labelSm }]}>
            PROGRAMME
          </Text>
          <Text
            style={[
              { color: c.onSurface, ...typography.titleLg, textAlign: 'center', marginBottom: 8 },
            ]}
          >
            Set your filters
          </Text>
          <Text style={[{ color: c.onSurfaceVariant, ...typography.bodyMd, textAlign: 'center' }]}>
            Adjust the filters above and tap "Search" to explore.
          </Text>
        </View>
      ),
    };
  }

  if (results.length === 0) {
    const airingFilterActive = vm.filters.airingThisWeek && vm.filters.mediaType === 'tv';

    return {
      ...empty,
      emptyNode: (
        <View style={styles.stateBox}>
          <EmptyState
            variant="empty"
            title={airingFilterActive ? 'Nothing airing today–Sunday with these filters' : 'No matches found'}
            description={
              airingFilterActive
                ? 'Try clearing a few filters or load more results to scan additional pages.'
                : "We couldn't find anything with those filters. Clear a few choices and search again."
            }
            primaryAction={{
              label: 'Clear Filters',
              icon: 'close-circle-outline',
              onPress: vm.resetFilters,
              accessibilityLabel: 'Clear discover filters',
            }}
            secondaryAction={{
              label: 'Search Again',
              onPress: vm.search,
              accessibilityLabel: 'Search again with current filters',
            }}
            compact
          />
        </View>
      ),
    };
  }

  const airingFilterActive = vm.filters.airingThisWeek && vm.filters.mediaType === 'tv';
  const resultCount = airingFilterActive ? results.length : totalResults;

  const headerNode = (
    <View style={styles.resultsHeader}>
      <ProgrammeSectionHeader eyebrow="RESULTS" title="Programme" />
      <View style={styles.resultsHeaderBadges}>
        {loading && (
          <View
            style={[
              styles.enrichmentBadge,
              {
                backgroundColor: c.surfaceContainerHigh,
                borderRadius: radii.full,
                borderColor: GOLD_DIM,
              },
            ]}
          >
            <SkeletonBlock style={styles.enrichmentDot} />
            <Text
              style={[
                { color: c.onSurfaceVariant, ...typography.labelSm, fontWeight: '700', marginLeft: 6 },
              ]}
            >
              updating
            </Text>
          </View>
        )}
        {vm.resultsStale && !loading && (
          <View
            style={[
              styles.countBadge,
              { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.full },
            ]}
          >
            <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm, fontWeight: '700' }]}>
              Filters changed
            </Text>
          </View>
        )}
        {enrichingResults && (
          <View
            style={[
              styles.enrichmentBadge,
              {
                backgroundColor: c.surfaceContainerHigh,
                borderRadius: radii.full,
                borderColor: GOLD_DIM,
              },
            ]}
          >
            <SkeletonBlock style={styles.enrichmentDot} />
            <Text
              style={[
                {
                  color: c.onSurfaceVariant,
                  ...typography.labelSm,
                  fontWeight: '700',
                  marginLeft: 6,
                },
              ]}
            >
              ratings
            </Text>
          </View>
        )}
        <View
          style={[
            styles.countBadge,
            { backgroundColor: GOLD_ACCENT + '18', borderRadius: radii.full },
          ]}
        >
          <Text style={[{ color: GOLD_ACCENT, ...typography.labelSm, fontWeight: '700' }]}>
            {resultCount.toLocaleString()} found
          </Text>
        </View>
      </View>
    </View>
  );

  // Footer: the load-more skeleton while a page is in flight (auto or manual),
  // then either the inline retry (on a failed page) or the manual "Load More"
  // fallback (Rec #1 keeps it for a fast flick past the prefetch trigger), then
  // the honest end-of-results line.
  const footerNode = (
    <View>
      {!loading && loadingMore && <LoadMoreSkeleton />}

      {!loading && !loadingMore && loadMoreError ? (
        <TouchableOpacity
          style={[
            styles.loadMoreBtn,
            styles.loadMoreErrorBtn,
            {
              backgroundColor: c.error + '12',
              borderRadius: radii.md,
              borderColor: c.error + '44',
            },
          ]}
          onPress={() => {
            clearLoadMoreError();
            loadMore();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Retry loading more results"
        >
          <Ionicons name="refresh-outline" size={16} color={c.error} />
          <Text
            style={[{ color: c.error, ...typography.labelSm, fontWeight: '800', marginLeft: 6 }]}
          >
            Couldn't load more. Tap to retry.
          </Text>
        </TouchableOpacity>
      ) : (
        !loading &&
        !loadingMore &&
        hasMore && (
          <TouchableOpacity
            style={[
              styles.loadMoreBtn,
              {
                backgroundColor: c.surfaceContainerHigh,
                borderRadius: radii.md,
                borderColor: GOLD_DIM,
              },
            ]}
            onPress={loadMore}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Load more results"
          >
            <Ionicons name="chevron-down-outline" size={16} color={GOLD_ACCENT} />
            <Text
              style={[
                { color: GOLD_ACCENT, ...typography.labelSm, fontWeight: '700', marginLeft: 6 },
              ]}
            >
              Load More
            </Text>
          </TouchableOpacity>
        )
      )}

      {!loading && !hasMore && results.length > 0 && (
        <Text style={[styles.endText, { color: c.onSurfaceVariant, ...typography.labelSm }]}>
          — End of results —
        </Text>
      )}
    </View>
  );

  return {
    gridData: results,
    headerNode,
    emptyNode: null,
    footerNode,
    showAirDay: airingFilterActive,
  };
}

// A result tile: the poster (with its always-visible bookmark button) plus an
// OMDb ratings footnote. Saving goes through the one visible bookmark control on
// the poster — there is no hidden swipe gesture; a swipe-action is a list-row
// idiom that only fought the grid's own vertical scroll here.

function DiscoverCard({
  item,
  colors: c,
  typography,
  radii,
  onPress,
  onQuickSave,
  isSaved,
  showAirDay = false,
}) {
  const omdb = item.omdbRatings || {};
  const imdbRating = omdb.imdbRating ? omdb.imdbRating.replace('/10', '') : null;
  const rottenTomatoes = omdb.rottenTomatoes || null;

  // The poster already letters the title (and MediaArtwork renders it in-frame for
  // the posterless tail), so we drop GridPosterCard's caption entirely — no title,
  // no media-type icon/label. All surviving metadata is one line we own here.
  // Lead with the air day (only under the TV "airing this week" filter) or the
  // release year; IMDb / Rotten Tomatoes follow. Content rating (PG-13/R/TV-MA) is
  // intentionally gone.
  const leadMeta =
    showAirDay && item.airDay ? item.airDay : item.year ? String(item.year) : null;
  const metaParts = [
    leadMeta,
    imdbRating ? `IMDb ${imdbRating}` : null,
    rottenTomatoes ? `RT ${rottenTomatoes}` : null,
  ].filter(Boolean);

  return (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${item.title}`}
    >
      <GridPosterCard
        item={item}
        colors={c}
        typography={typography}
        radii={radii}
        pressable={false}
        showCaption={false}
        saved={isSaved}
        onToggleWatchlist={onQuickSave ? () => onQuickSave() : undefined}
      />
      {metaParts.length > 0 && (
        <Text
          style={[styles.omdbMetaLine, { color: c.onSurfaceVariant, ...typography.labelSm }]}
          numberOfLines={1}
        >
          {metaParts.join(' · ')}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Micro Components ──────────────────────────────────────────────────────────

function SectionLabel({ label, value, colors, typography }) {
  // With a `value`, the label carries a live readout on the right — the current
  // range made legible (e.g. "RATING · 7+"), so a bound like the default 7.0 floor
  // announces itself instead of hiding inside a control.
  if (value) {
    return (
      <View style={styles.rangeLabelRow}>
        <Text
          style={[
            styles.sectionLabel,
            { color: colors.onSurface, ...typography.labelSm, marginBottom: 0 },
          ]}
        >
          {label}
        </Text>
        <Text style={[styles.rangeReadout, { color: GOLD_ACCENT, ...typography.labelSm }]}>
          {value}
        </Text>
      </View>
    );
  }
  return (
    <Text style={[styles.sectionLabel, { color: colors.onSurface, ...typography.labelSm }]}>
      {label}
    </Text>
  );
}

// ─── Picker Sheet Styles ───────────────────────────────────────────────────────

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 14,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
});

const genreStyles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  infoBanner: {
    flexDirection: 'row',
    padding: 12,
    borderLeftWidth: 4,
    marginBottom: 16,
  },
  smartTagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  smartTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  smartTagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 12,
  },
  smartTagInfo: {
    padding: 12,
    borderLeftWidth: 2,
    marginBottom: 12,
    marginLeft: 8,
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  atmosphereTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: scale(220),
    zIndex: 0,
  },
  content: {
    paddingHorizontal: GRID_PAD,
  },

  mediaTabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scale(28),
    marginBottom: scale(4),
  },
  mediaTab: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: scale(4),
    position: 'relative',
  },
  mediaTabLabel: {
    fontWeight: '600',
    letterSpacing: 1,
    paddingEnd: 2,
    textTransform: 'uppercase',
  },
  mediaTabLabelActive: {
    fontWeight: '800',
  },
  mediaTabUnderline: {
    position: 'absolute',
    bottom: 2,
    height: 2,
    width: '100%',
    borderRadius: 1,
  },

  filterBand: {
    paddingVertical: scale(14),
  },
  advancedToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  filterHairline: {
    marginBottom: 0,
  },
  resultsHairline: {
    marginBottom: scale(24),
    marginTop: scale(8),
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(12),
  },
  sectionLabel: {
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: scale(12),
    paddingEnd: 2,
    textTransform: 'uppercase',
    fontSize: scale(11),
  },

  logicPill: { flexDirection: 'row', padding: 3 },
  logicOption: {
    minHeight: 44,
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  presetRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingRight: GRID_PAD },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  presetLabel: {
    fontWeight: '800',
    letterSpacing: 0.4,
    fontSize: scale(12),
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, minHeight: 48, justifyContent: 'center' },
  chipText: { fontWeight: '700' },
  chipTextUpper: {
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingEnd: 2,
    textTransform: 'uppercase',
    fontSize: scale(10),
  },
  hScroll: { marginBottom: 4 },
  hChipRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingRight: GRID_PAD },

  moreFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
    minHeight: 48,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
    minHeight: 48,
  },

  rangeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(12),
    gap: 12,
  },
  rangeReadout: {
    fontWeight: '800',
    letterSpacing: 0.4,
    fontSize: scale(11),
  },

  validationText: { flex: 1 },

  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GRID_PAD,
    paddingTop: scale(12),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    zIndex: 20,
  },
  validationBannerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 12,
  },
  actionRow: { flexDirection: 'row', gap: 12 },
  resetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  searchBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    minHeight: 48,
  },
  // Shared label styling for the two footer actions (Reset / Search). Now that
  // both are text-only, the button's own justifyContent centres the label — no
  // flex:1 width hack needed to balance a vanished icon.
  actionBtnText: {
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  searchBtnLoader: {
    borderRadius: 8,
    height: 16,
    overflow: 'hidden',
    width: 16,
  },

  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  stateEyebrow: {
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
    paddingEnd: 3,
    textTransform: 'uppercase',
  },
  stateIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  resultsSection: { marginBottom: 32 },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: scale(20),
    gap: 12,
  },
  resultsHeaderBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: scale(4) },
  countBadge: { paddingHorizontal: 12, paddingVertical: 5 },
  enrichmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  enrichmentDot: {
    borderRadius: 7,
    height: 14,
    width: 14,
  },

  gridCard: { width: GRID_COL_W },
  resultsGrid: {
    paddingHorizontal: 0,
  },
  // 2-up poster rows in the FlatList: one GRID_GAP between the columns and one
  // below each row, matching the old PosterGrid `gap`. Each card is a fixed
  // GRID_COL_W, so a lone trailing item stays left-aligned (no spacer needed).
  gridColumnWrapper: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  omdbMetaLine: { marginTop: 4, fontWeight: '600', letterSpacing: 0.2 },

  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 24,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  loadMoreErrorBtn: { paddingHorizontal: 12 },
  endText: {
    textAlign: 'center',
    marginTop: 24,
    letterSpacing: 1,
    paddingEnd: 2,
    textTransform: 'uppercase',
    fontSize: scale(10),
    fontWeight: '700',
  },
});
