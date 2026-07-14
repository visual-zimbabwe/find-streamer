import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
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
import { MediaArtwork } from './MediaArtwork';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { EmptyState } from './EmptyState';
import {
  ResultsSkeleton,
  GenreChipSkeleton,
  LoadMoreSkeleton,
  PickerListSkeleton,
  SkeletonBlock,
} from './SkeletonLoaders';
import { REGION_PRESETS, SPECIAL_PRESETS, findPreset } from '../lib/languagePresets';
import { COUNTRY_PRESETS, findCountryPreset, filterCountriesByPreset } from '../lib/countryPresets';
import { sanitizeRatingInput } from '../lib/discoverRating';
import { useBottomSheet } from './StackBottomSheet';
import { scale } from '../utils/responsive';
import {
  GOLD_ACCENT,
  GOLD_DIM,
  GRID_PAD,
  GRID_GAP,
  FADE_MS,
  GRID_COL_W,
  GRID_POSTER_H,
} from '../theme/programme';
import { ProgrammeSectionHeader } from './ProgrammeSectionHeader';
import { ProgrammeHairline } from './ProgrammeHairline';
import { GridPosterCard, PosterGrid } from './GridPosterCard';

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

export function DiscoverScreen({ onSelectItem, vm, onToggleWatchlist, watchlistIds = [] }) {
  const { theme, resolvedMode } = useTheme();
  const { colors, typography, radii } = theme;
  const c = colors;
  const insets = useSafeAreaInsets();
  const { show: showSheet, update: updateSheet, dismiss: dismissSheet } = useBottomSheet();
  const bottomNavScroll = useBottomNavScroll();
  const reduceMotion = useReduceMotion();
  const moreFiltersSheetIdRef = useRef(null);
  const genreSheetIdRef = useRef(null);
  const scrollRef = useRef(null);
  const yearRangeYRef = useRef(0);
  const runtimeRangeYRef = useRef(0);

  const [langModalVisible, setLangModalVisible] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const previousMediaTypeRef = useRef(vm.filters.mediaType);

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

  // Compute whether any advanced filter is active (for the More Filters badge)
  const advancedFilterActive =
    vm.filters.activePreset != null ||
    (vm.filters.languageCodes || []).length > 0 ||
    !!vm.filters.excludeEnglish ||
    vm.filters.activeCountryPreset != null ||
    (vm.filters.originCountries || []).length > 0;

  const advancedCriteriaActive =
    !!vm.filters.fromYear ||
    !!vm.filters.toYear ||
    !!vm.filters.minRuntime ||
    !!vm.filters.maxRuntime ||
    vm.filters.sortBy !== 'popularity.desc';

  const advancedFilterSummary = [
    vm.filters.activePreset ? findPreset(vm.filters.activePreset)?.label : null,
    (vm.filters.languageCodes || []).length > 0 ? langLabel : null,
    vm.filters.excludeEnglish ? 'Excl. English' : null,
    vm.filters.activeCountryPreset
      ? findCountryPreset(vm.filters.activeCountryPreset)?.label
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Load genres when mediaType changes; reset genre selections that might not apply
  useEffect(() => {
    vm.loadGenres(vm.filters.mediaType);
    const previousMediaType = previousMediaTypeRef.current;
    if (previousMediaType !== vm.filters.mediaType) {
      vm.updateFilter('genreIds', []);
      vm.updateFilter('excludeGenreIds', []);
      vm.updateFilter('excludeSmartTags', []);
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

  const renderMoreFiltersSheetContent = () => (
    <MoreFiltersSheetContent
      vm={vm}
      colors={c}
      typography={typography}
      radii={radii}
      langLabel={langLabel}
      countryLabel={countryLabel}
      selectedLanguageCodes={selectedLanguageCodes}
      selectedOriginCountries={selectedOriginCountries}
      onOpenLangModal={() => setLangModalVisible(true)}
      onOpenCountryModal={() => setCountryModalVisible(true)}
    />
  );

  const renderGenreSheetContent = (sheetId) => (
    <GenreBottomSheet
      visible
      embedded
      onClose={() => dismissSheet(sheetId)}
      genres={vm.genres}
      genresLoading={vm.genresLoading}
      genreIds={vm.filters.genreIds}
      genreLogic={vm.filters.genreLogic}
      excludeGenreIds={vm.filters.excludeGenreIds}
      excludeSmartTags={vm.filters.excludeSmartTags}
      onToggleInclude={vm.toggleGenre}
      onToggleExclude={vm.toggleExcludeGenre}
      onToggleSmartTag={vm.toggleSmartTag}
      onUpdateGenreLogic={(v) => vm.updateFilter('genreLogic', v)}
      onClearAll={() => {
        vm.updateFilter('genreIds', []);
        vm.updateFilter('excludeGenreIds', []);
        vm.updateFilter('excludeSmartTags', []);
      }}
      colors={c}
      typography={typography}
      radii={radii}
    />
  );

  useEffect(() => {
    if (moreFiltersSheetIdRef.current) {
      updateSheet(moreFiltersSheetIdRef.current, renderMoreFiltersSheetContent());
    }
    if (genreSheetIdRef.current) {
      updateSheet(genreSheetIdRef.current, renderGenreSheetContent(genreSheetIdRef.current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    vm.filters,
    vm.genres,
    vm.genresLoading,
    vm.languages,
    vm.countries,
    vm.pendingCountryLink,
    c,
    typography,
    radii,
    langLabel,
    countryLabel,
    selectedLanguageCodes,
    selectedOriginCountries,
    updateSheet,
  ]);

  /** Open the "More Filters" panel as a stacked bottom sheet */
  const handleOpenMoreFilters = () => {
    const sheetId = showSheet(() => renderMoreFiltersSheetContent(), {
      title: '\u2699\uFE0F More Filters',
      size: 'full',
      scrollable: false,
      showCloseButton: true,
      dismissOnBackdrop: true,
    });
    moreFiltersSheetIdRef.current = sheetId;
  };

  /** Open genre picker as a stacked sheet */
  const handleOpenGenreSheet = () => {
    const sheetId = showSheet((id) => renderGenreSheetContent(id), {
      title: '\uD83C\uDFAC Genres',
      size: 'large',
      scrollable: false,
      showCloseButton: true,
      dismissOnBackdrop: true,
    });
    genreSheetIdRef.current = sheetId;
  };

  const scrollToYearRange = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, yearRangeYRef.current - 24),
        animated: true,
      });
    }, 120);
  };

  const scrollToRuntimeRange = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, runtimeRangeYRef.current - 24),
        animated: true,
      });
    }, 120);
  };

  const filterSurface = colors.glass;

  const atmosphereColors = useMemo(
    () => [colors.surfaceContainerHigh, colors.background],
    [colors.surfaceContainerHigh, colors.background],
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 72}
    >
      <LinearGradient colors={atmosphereColors} style={styles.atmosphereTop} pointerEvents="none" />
      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + scale(12), paddingBottom: insets.bottom + 112 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        removeClippedSubviews={Platform.OS === 'android'}
        {...bottomNavScroll}
      >
        <ProgrammeSectionHeader
          eyebrow="FILTER"
          title="Refine your programme"
          subtitle="Set criteria, then search the catalogue"
        />

        <MediaTypeTabs
          mediaType={vm.filters.mediaType}
          onChange={(type) => vm.updateFilter('mediaType', type)}
          colors={c}
          typography={typography}
        />

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
          <View style={styles.sectionRow}>
            <SectionLabel label="Genres" colors={c} typography={typography} />
            {(vm.filters.genreIds.length > 0 ||
              vm.filters.excludeGenreIds.length > 0 ||
              vm.filters.excludeSmartTags.length > 0) && (
              <TouchableOpacity
                onPress={() => {
                  vm.updateFilter('genreIds', []);
                  vm.updateFilter('excludeGenreIds', []);
                  vm.updateFilter('excludeSmartTags', []);
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear all genre filters"
              >
                <Text style={[{ color: GOLD_ACCENT, ...typography.labelSm }]}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>
          <HorizontalGenreScroll
            genres={vm.genres}
            genreIds={vm.filters.genreIds}
            excludeGenreIds={vm.filters.excludeGenreIds}
            onOpenSheet={handleOpenGenreSheet}
            colors={c}
            typography={typography}
            radii={radii}
          />
        </View>

        <FilterDivider />

        <View style={styles.filterBand}>
          <SectionLabel label="Rating" colors={c} typography={typography} />
          <View style={styles.yearRow}>
            <View
              style={[
                styles.yearInput,
                {
                  backgroundColor: filterSurface,
                  borderRadius: radii.md,
                  flex: 1,
                  borderColor: GOLD_DIM,
                },
              ]}
            >
              <TextInput
                style={[
                  {
                    color: c.onSurface,
                    ...typography.bodyMd,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  },
                ]}
                placeholder="From (e.g. 6.5)"
                placeholderTextColor={c.onSurfaceVariant}
                keyboardType="decimal-pad"
                maxLength={4}
                value={vm.filters.minRating}
                onChangeText={(v) =>
                  vm.updateFilter('minRating', sanitizeRatingInput(v))
                }
              />
            </View>
            <Text
              style={[{ color: c.onSurfaceVariant, ...typography.bodyMd, marginHorizontal: 8 }]}
            >
              —
            </Text>
            <View
              style={[
                styles.yearInput,
                {
                  backgroundColor: filterSurface,
                  borderRadius: radii.md,
                  flex: 1,
                  borderColor: GOLD_DIM,
                },
              ]}
            >
              <TextInput
                style={[
                  {
                    color: c.onSurface,
                    ...typography.bodyMd,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  },
                ]}
                placeholder="To (e.g. 7.0)"
                placeholderTextColor={c.onSurfaceVariant}
                keyboardType="decimal-pad"
                maxLength={4}
                value={vm.filters.maxRating}
                onChangeText={(v) =>
                  vm.updateFilter('maxRating', sanitizeRatingInput(v))
                }
              />
            </View>
          </View>
        </View>

        <FilterDivider />

        <View style={styles.filterBand}>
          <SectionLabel label="Region" colors={c} typography={typography} />
          <TouchableOpacity
            style={[
              styles.moreFiltersBtn,
              {
                backgroundColor: advancedFilterActive ? GOLD_ACCENT + '12' : filterSurface,
                borderRadius: radii.md,
                borderColor: advancedFilterActive ? GOLD_ACCENT + '55' : GOLD_DIM,
              },
            ]}
            onPress={handleOpenMoreFilters}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open advanced filter options: language and country"
          >
            <Ionicons
              name="globe-outline"
              size={18}
              color={advancedFilterActive ? GOLD_ACCENT : c.onSurfaceVariant}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  {
                    color: advancedFilterActive ? c.onSurface : c.onSurfaceVariant,
                    ...typography.bodyMd,
                    fontWeight: '700',
                  },
                ]}
              >
                Language &amp; Country
              </Text>
              {advancedFilterSummary ? (
                <Text
                  style={[{ color: GOLD_ACCENT, ...typography.labelSm, marginTop: 2 }]}
                  numberOfLines={1}
                >
                  {advancedFilterSummary}
                </Text>
              ) : (
                <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm, marginTop: 2 }]}>
                  Tap to configure
                </Text>
              )}
            </View>
            {advancedFilterActive && (
              <View
                style={[
                  {
                    backgroundColor: GOLD_ACCENT,
                    borderRadius: radii.sm,
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                    marginRight: 8,
                  },
                ]}
              >
                <Text
                  style={{ color: '#141414', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}
                >
                  Active
                </Text>
              </View>
            )}
            <Ionicons
              name="chevron-forward-outline"
              size={16}
              color={advancedFilterActive ? GOLD_ACCENT : c.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>

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
            {advancedCriteriaActive && (
              <View
                style={{
                  backgroundColor: GOLD_ACCENT,
                  borderRadius: radii.sm,
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  marginRight: 8,
                }}
              >
                <Text
                  style={{ color: '#141414', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}
                >
                  Active
                </Text>
              </View>
            )}
            <Ionicons
              name={advancedExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={16}
              color={advancedCriteriaActive ? GOLD_ACCENT : c.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>

        {advancedExpanded && (
          <>
            <View
              style={styles.filterBand}
              onLayout={(e) => {
                yearRangeYRef.current = e.nativeEvent.layout.y;
              }}
            >
              <SectionLabel label="Release Year" colors={c} typography={typography} />
              <View style={styles.yearRow}>
                <View
                  style={[
                    styles.yearInput,
                    {
                      backgroundColor: filterSurface,
                      borderRadius: radii.md,
                      flex: 1,
                      borderColor: GOLD_DIM,
                    },
                  ]}
                >
                  <TextInput
                    style={[
                      {
                        color: c.onSurface,
                        ...typography.bodyMd,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      },
                    ]}
                    placeholder="From (e.g. 2010)"
                    placeholderTextColor={c.onSurfaceVariant}
                    keyboardType="numeric"
                    maxLength={4}
                    value={vm.filters.fromYear}
                    onFocus={scrollToYearRange}
                    onChangeText={(v) => vm.updateFilter('fromYear', v.replace(/[^0-9]/g, ''))}
                  />
                </View>
                <Text
                  style={[{ color: c.onSurfaceVariant, ...typography.bodyMd, marginHorizontal: 8 }]}
                >
                  —
                </Text>
                <View
                  style={[
                    styles.yearInput,
                    {
                      backgroundColor: filterSurface,
                      borderRadius: radii.md,
                      flex: 1,
                      borderColor: GOLD_DIM,
                    },
                  ]}
                >
                  <TextInput
                    style={[
                      {
                        color: c.onSurface,
                        ...typography.bodyMd,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                      },
                    ]}
                    placeholder="To (e.g. 2024)"
                    placeholderTextColor={c.onSurfaceVariant}
                    keyboardType="numeric"
                    maxLength={4}
                    value={vm.filters.toYear}
                    onFocus={scrollToYearRange}
                    onChangeText={(v) => vm.updateFilter('toYear', v.replace(/[^0-9]/g, ''))}
                  />
                </View>
              </View>
            </View>

            {vm.filters.mediaType === 'movie' && (
              <>
                <FilterDivider />

                <View
                  style={styles.filterBand}
                  onLayout={(e) => {
                    runtimeRangeYRef.current = e.nativeEvent.layout.y;
                  }}
                >
                  <SectionLabel label="Runtime" colors={c} typography={typography} />
                  <View style={styles.yearRow}>
                    <View
                      style={[
                        styles.yearInput,
                        {
                          backgroundColor: filterSurface,
                          borderRadius: radii.md,
                          flex: 1,
                          borderColor: GOLD_DIM,
                        },
                      ]}
                    >
                      <TextInput
                        style={[
                          {
                            color: c.onSurface,
                            ...typography.bodyMd,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                          },
                        ]}
                        placeholder="From (e.g. 90)"
                        placeholderTextColor={c.onSurfaceVariant}
                        keyboardType="numeric"
                        maxLength={3}
                        value={vm.filters.minRuntime}
                        onFocus={scrollToRuntimeRange}
                        onChangeText={(v) => vm.updateFilter('minRuntime', v.replace(/[^0-9]/g, ''))}
                        accessibilityLabel="Minimum runtime in minutes"
                      />
                    </View>
                    <Text
                      style={[{ color: c.onSurfaceVariant, ...typography.bodyMd, marginHorizontal: 8 }]}
                    >
                      —
                    </Text>
                    <View
                      style={[
                        styles.yearInput,
                        {
                          backgroundColor: filterSurface,
                          borderRadius: radii.md,
                          flex: 1,
                          borderColor: GOLD_DIM,
                        },
                      ]}
                    >
                      <TextInput
                        style={[
                          {
                            color: c.onSurface,
                            ...typography.bodyMd,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                          },
                        ]}
                        placeholder="To (e.g. 180)"
                        placeholderTextColor={c.onSurfaceVariant}
                        keyboardType="numeric"
                        maxLength={3}
                        value={vm.filters.maxRuntime}
                        onFocus={scrollToRuntimeRange}
                        onChangeText={(v) => vm.updateFilter('maxRuntime', v.replace(/[^0-9]/g, ''))}
                        accessibilityLabel="Maximum runtime in minutes"
                      />
                    </View>
                  </View>
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

        <FilterDivider />

        {vm.validationError && (
          <View
            style={[
              styles.validationBanner,
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
            <Ionicons name="refresh-outline" size={16} color={c.onSurfaceVariant} />
            <Text
              style={[
                {
                  color: c.onSurfaceVariant,
                  ...typography.labelSm,
                  flex: 1,
                  marginLeft: 6,
                  textAlign: 'center',
                },
              ]}
            >
              Reset
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: GOLD_ACCENT, borderRadius: radii.md }]}
            onPress={vm.search}
            activeOpacity={0.85}
            disabled={vm.loading}
            accessibilityRole="button"
            accessibilityLabel="Search with selected filters"
            accessibilityState={{ disabled: vm.loading }}
          >
            {vm.loading ? (
              <View style={styles.searchBtnLoader}>
                <SkeletonBlock style={StyleSheet.absoluteFill} />
              </View>
            ) : (
              <>
                <Ionicons name="search-outline" size={16} color="#141414" />
                <Text style={[styles.searchBtnText, { color: '#141414', ...typography.labelSm }]}>
                  Search
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <ProgrammeHairline style={styles.resultsHairline} />

        {/* ── Results Section ── */}
        <ResultsSection
          vm={vm}
          colors={c}
          typography={typography}
          radii={radii}
          onSelectItem={onSelectItem}
          onToggleWatchlist={onToggleWatchlist}
          watchlistIds={watchlistIds}
          reduceMotion={reduceMotion}
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
          title={
            vm.filters.activeCountryPreset
              ? `${findCountryPreset(vm.filters.activeCountryPreset)?.label} Countries`
              : 'Select Origin Country'
          }
          items={filterCountriesByPreset(vm.countries, vm.filters.activeCountryPreset)}
          selectedCodes={selectedOriginCountries}
          onToggle={(code) => vm.toggleFilterValue('originCountries', code)}
          onClear={() => vm.updateFilter('originCountries', [])}
          loading={vm.countriesLoading}
          colors={c}
          typography={typography}
          radii={radii}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Horizontal Genre Scroll ───────────────────────────────────────────────────

function HorizontalGenreScroll({
  genres,
  genreIds,
  excludeGenreIds,
  onOpenSheet,
  colors: c,
  typography,
  radii,
}) {
  const hasSelections = genreIds.length > 0 || excludeGenreIds.length > 0;
  const totalActive = genreIds.length + excludeGenreIds.length;

  const sorted = useMemo(() => {
    const included = genres.filter((g) => genreIds.includes(g.id));
    const excluded = genres.filter((g) => excludeGenreIds.includes(g.id));
    const rest = genres.filter((g) => !genreIds.includes(g.id) && !excludeGenreIds.includes(g.id));
    return [...included, ...excluded, ...rest];
  }, [genres, genreIds, excludeGenreIds]);

  return (
    <View style={{ marginBottom: 4 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={genreScrollStyles.row}
      >
        <TouchableOpacity
          style={[
            genreScrollStyles.chip,
            {
              borderRadius: radii.md,
              backgroundColor: hasSelections ? GOLD_ACCENT + '18' : c.surfaceContainerHigh,
              borderWidth: 1,
              borderColor: hasSelections ? GOLD_ACCENT : GOLD_DIM,
            },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            onOpenSheet();
          }}
          accessibilityRole="button"
          accessibilityLabel="Open genre filter sheet"
        >
          <Ionicons
            name="options-outline"
            size={14}
            color={hasSelections ? GOLD_ACCENT : c.onSurfaceVariant}
            style={{ marginRight: 5 }}
          />
          <Text
            style={[styles.chipTextUpper, { color: hasSelections ? GOLD_ACCENT : c.onSurface }]}
          >
            All Genres{totalActive > 0 ? ` (${totalActive})` : ''}
          </Text>
          <Ionicons
            name="chevron-down-outline"
            size={12}
            color={hasSelections ? GOLD_ACCENT : c.onSurfaceVariant}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>

        {sorted.slice(0, 12).map((genre) => {
          const included = genreIds.includes(genre.id);
          const excluded = excludeGenreIds.includes(genre.id);
          let bg = c.surfaceContainerHigh;
          let border = GOLD_DIM;
          let textColor = c.onSurfaceVariant;
          if (included) {
            bg = GOLD_ACCENT;
            border = GOLD_ACCENT;
            textColor = '#141414';
          }
          if (excluded) {
            bg = c.error + '22';
            border = c.error + '66';
            textColor = c.error;
          }
          return (
            <TouchableOpacity
              key={genre.id}
              style={[
                genreScrollStyles.chip,
                {
                  borderRadius: radii.md,
                  backgroundColor: bg,
                  borderWidth: 1,
                  borderColor: border,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                onOpenSheet();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${included ? 'Included' : excluded ? 'Excluded' : ''} genre ${genre.name}`}
            >
              <Text style={[styles.chipTextUpper, { color: textColor }]}>{genre.name}</Text>
              {included && (
                <Ionicons name="checkmark" size={12} color="#141414" style={{ marginLeft: 3 }} />
              )}
              {excluded && (
                <Ionicons name="close" size={12} color={c.error} style={{ marginLeft: 3 }} />
              )}
            </TouchableOpacity>
          );
        })}

        {sorted.length > 12 && (
          <TouchableOpacity
            style={[
              genreScrollStyles.chip,
              {
                borderRadius: radii.md,
                backgroundColor: c.surfaceContainerHigh,
                borderWidth: 1,
                borderColor: GOLD_DIM,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onOpenSheet();
            }}
            accessibilityRole="button"
            accessibilityLabel="View all genres"
          >
            <Text style={[styles.chipTextUpper, { color: c.onSurfaceVariant }]}>
              +{sorted.length - 12} more
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Genre Bottom Sheet ────────────────────────────────────────────────────────

function GenreBottomSheet({
  visible,
  embedded,
  onClose,
  genres,
  genresLoading,
  genreIds,
  genreLogic,
  excludeGenreIds,
  excludeSmartTags,
  onToggleInclude,
  onToggleExclude,
  onToggleSmartTag,
  onUpdateGenreLogic,
  onClearAll,
  colors: c,
  typography,
  radii,
}) {
  const insets = useSafeAreaInsets();
  const totalActive = genreIds.length + excludeGenreIds.length + excludeSmartTags.length;

  const content = (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={embedded && { flex: 1 }}
    >
      <GenreFilterSection
        genres={genres}
        genresLoading={genresLoading}
        genreIds={genreIds}
        genreLogic={genreLogic}
        excludeGenreIds={excludeGenreIds}
        excludeSmartTags={excludeSmartTags}
        onToggleInclude={onToggleInclude}
        onToggleExclude={onToggleExclude}
        onToggleSmartTag={onToggleSmartTag}
        onUpdateGenreLogic={onUpdateGenreLogic}
        onClearAll={onClearAll}
        colors={c}
        typography={typography}
        radii={radii}
      />
    </ScrollView>
  );

  if (embedded) {
    return content;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View
            style={[
              pickerStyles.sheet,
              {
                backgroundColor: c.surface,
                borderRadius: radii.xl,
                paddingBottom: insets.bottom + 24,
                maxHeight: '90%',
              },
            ]}
          >
            <View style={pickerStyles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[{ color: c.onSurface, ...typography.titleMd, fontWeight: '700' }]}>
                  Genre Filters
                </Text>
                {totalActive > 0 && (
                  <Text style={[{ color: GOLD_ACCENT, ...typography.labelSm, marginTop: 2 }]}>
                    {genreIds.length > 0 ? `${genreIds.length} included` : ''}
                    {genreIds.length > 0 && excludeGenreIds.length + excludeSmartTags.length > 0
                      ? ' · '
                      : ''}
                    {excludeGenreIds.length + excludeSmartTags.length > 0
                      ? `${excludeGenreIds.length + excludeSmartTags.length} excluded`
                      : ''}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close genre sheet"
              >
                <Text style={[{ color: GOLD_ACCENT, ...typography.labelSm, fontWeight: '800' }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
            {content}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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

function MoreFiltersSheetContent({
  vm,
  colors: c,
  typography,
  radii,
  langLabel,
  countryLabel,
  selectedLanguageCodes,
  selectedOriginCountries,
  onOpenLangModal,
  onOpenCountryModal,
}) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
    >
      {/* Language Presets */}
      <SectionLabel label="Language Presets" colors={c} typography={typography} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.hScroll, { marginBottom: 12 }]}
      >
        <View style={styles.hChipRow}>
          {SPECIAL_PRESETS.map((preset) => {
            const active = vm.filters.activePreset === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.chip,
                  { borderRadius: radii.md },
                  active
                    ? {
                        backgroundColor: GOLD_ACCENT + '22',
                        borderWidth: 1,
                        borderColor: GOLD_ACCENT,
                      }
                    : {
                        backgroundColor: c.surfaceContainerHigh,
                        borderWidth: 1,
                        borderColor: GOLD_DIM,
                      },
                ]}
                onPress={() => (active ? vm.clearPreset() : vm.applyPreset(preset.id))}
              >
                <Text
                  style={[
                    styles.chipTextUpper,
                    { color: active ? GOLD_ACCENT : c.onSurfaceVariant, ...typography.labelSm },
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          {REGION_PRESETS.map((preset) => {
            const active = vm.filters.activePreset === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
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
                onPress={() => (active ? vm.clearPreset() : vm.applyPreset(preset.id))}
              >
                <Text
                  style={[
                    styles.chipTextUpper,
                    { color: active ? '#141414' : c.onSurfaceVariant, ...typography.labelSm },
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {vm.filters.activePreset && (
        <View
          style={[
            genreStyles.infoBanner,
            {
              backgroundColor: c.surfaceContainerHigh,
              borderRadius: radii.md,
              borderLeftColor: GOLD_ACCENT,
              marginBottom: 16,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={[
                { color: c.onSurface, ...typography.labelSm, fontWeight: '700', marginBottom: 2 },
              ]}
            >
              {findPreset(vm.filters.activePreset)?.label}
            </Text>
            <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm }]}>
              {findPreset(vm.filters.activePreset)?.description}
            </Text>
          </View>
          <TouchableOpacity onPress={() => vm.clearPreset()} style={{ marginLeft: 8 }}>
            <Ionicons name="close-circle" size={20} color={c.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      )}

      {vm.pendingCountryLink && vm.filters.mediaType === 'tv' && (
        <View
          style={[
            genreStyles.infoBanner,
            {
              backgroundColor: c.secondaryContainer,
              borderRadius: radii.md,
              borderLeftColor: c.secondary,
              marginBottom: 16,
              alignItems: 'center',
            },
          ]}
        >
          <Ionicons
            name="link-outline"
            size={16}
            color={c.onSecondaryContainer}
            style={{ marginRight: 10 }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                {
                  color: c.onSecondaryContainer,
                  ...typography.labelSm,
                  fontWeight: '700',
                  marginBottom: 2,
                },
              ]}
            >
              Also filter by origin country?
            </Text>
            <Text style={[{ color: c.onSecondaryContainer, ...typography.labelSm, opacity: 0.8 }]}>
              Narrow TV results to shows from {vm.pendingCountryLink.label} countries.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={[
                  {
                    backgroundColor: c.secondary,
                    borderRadius: radii.full,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                  },
                ]}
                onPress={vm.acceptCountryLink}
                accessibilityRole="button"
                accessibilityLabel={`Yes, also filter by ${vm.pendingCountryLink.label} countries`}
              >
                <Text style={[{ color: c.onSecondary, ...typography.labelSm, fontWeight: '800' }]}>
                  Yes, link it
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  {
                    backgroundColor: c.secondaryContainer,
                    borderRadius: radii.full,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: c.secondary + '60',
                  },
                ]}
                onPress={vm.dismissCountryLink}
                accessibilityRole="button"
                accessibilityLabel="No, keep language filter only"
              >
                <Text
                  style={[
                    { color: c.onSecondaryContainer, ...typography.labelSm, fontWeight: '700' },
                  ]}
                >
                  No thanks
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <FilterDivider />

      {/* Advanced Language Filter */}
      <View style={styles.sectionRow}>
        <SectionLabel label="Advanced Language Filter" colors={c} typography={typography} />
        {vm.filters.activePreset && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="flash-outline" size={12} color={GOLD_ACCENT} />
            <Text style={[{ color: GOLD_ACCENT, fontSize: 10, fontWeight: '800' }]}>
              Preset Active
            </Text>
          </View>
        )}
      </View>
      <TouchableOpacity
        style={[
          styles.pickerButton,
          {
            backgroundColor: c.surfaceContainerHigh,
            borderRadius: radii.md,
            borderColor: vm.filters.activePreset ? GOLD_ACCENT + '40' : GOLD_DIM,
          },
        ]}
        onPress={onOpenLangModal}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Original language, ${langLabel}`}
      >
        <Ionicons
          name="language-outline"
          size={16}
          color={
            selectedLanguageCodes.length || vm.filters.excludeEnglish
              ? GOLD_ACCENT
              : c.onSurfaceVariant
          }
          style={{ marginRight: 8 }}
        />
        <Text
          style={[
            {
              flex: 1,
              color:
                selectedLanguageCodes.length || vm.filters.excludeEnglish
                  ? c.onSurface
                  : c.onSurfaceVariant,
              ...typography.bodyMd,
            },
          ]}
          numberOfLines={1}
        >
          {vm.filters.activePreset ? findPreset(vm.filters.activePreset).label : langLabel}
        </Text>
        {(selectedLanguageCodes.length > 0 || vm.filters.excludeEnglish) && (
          <TouchableOpacity
            onPress={() => vm.clearPreset()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Clear selected languages"
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

      {/* Origin Country — TV only */}
      {vm.filters.mediaType === 'tv' && (
        <>
          <FilterDivider />
          <View style={styles.sectionRow}>
            <SectionLabel label="Country Presets" colors={c} typography={typography} />
            {vm.filters.activeCountryPreset && (
              <TouchableOpacity
                onPress={() => vm.clearCountryPreset()}
                accessibilityRole="button"
                accessibilityLabel="Clear country preset"
              >
                <Text style={[{ color: GOLD_ACCENT, ...typography.labelSm }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.hScroll, { marginBottom: 12 }]}
          >
            <View style={styles.hChipRow}>
              {COUNTRY_PRESETS.map((preset) => {
                const active = vm.filters.activeCountryPreset === preset.id;
                return (
                  <TouchableOpacity
                    key={preset.id}
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
                    onPress={() =>
                      active ? vm.clearCountryPreset() : vm.applyCountryPreset(preset.id)
                    }
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter countries by ${preset.label}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.chipTextUpper,
                        { color: active ? '#141414' : c.onSurfaceVariant, ...typography.labelSm },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          {vm.filters.activeCountryPreset && (
            <View
              style={[
                genreStyles.infoBanner,
                {
                  backgroundColor: c.surfaceContainerHigh,
                  borderRadius: radii.md,
                  borderLeftColor: GOLD_ACCENT,
                  marginBottom: 16,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    {
                      color: c.onSurface,
                      ...typography.labelSm,
                      fontWeight: '700',
                      marginBottom: 2,
                    },
                  ]}
                >
                  {findCountryPreset(vm.filters.activeCountryPreset)?.label}
                </Text>
                <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm }]}>
                  {findCountryPreset(vm.filters.activeCountryPreset)?.description}
                </Text>
              </View>
              <TouchableOpacity onPress={() => vm.clearCountryPreset()} style={{ marginLeft: 8 }}>
                <Ionicons name="close-circle" size={20} color={c.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.sectionRow}>
            <SectionLabel label="Origin Country (TV)" colors={c} typography={typography} />
            {vm.filters.activeCountryPreset && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="flash-outline" size={12} color={GOLD_ACCENT} />
                <Text style={[{ color: GOLD_ACCENT, fontSize: 10, fontWeight: '800' }]}>
                  Preset Active
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.pickerButton,
              {
                backgroundColor: c.surfaceContainerHigh,
                borderRadius: radii.md,
                borderColor: vm.filters.activeCountryPreset ? GOLD_ACCENT + '40' : GOLD_DIM,
              },
            ]}
            onPress={onOpenCountryModal}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Origin country, ${countryLabel}`}
          >
            <Ionicons
              name="globe-outline"
              size={16}
              color={selectedOriginCountries.length ? GOLD_ACCENT : c.onSurfaceVariant}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                {
                  flex: 1,
                  color: selectedOriginCountries.length ? c.onSurface : c.onSurfaceVariant,
                  ...typography.bodyMd,
                },
              ]}
              numberOfLines={1}
            >
              {vm.filters.activeCountryPreset && !selectedOriginCountries.length
                ? `All ${findCountryPreset(vm.filters.activeCountryPreset)?.label} countries`
                : countryLabel}
            </Text>
            {selectedOriginCountries.length > 0 && (
              <TouchableOpacity
                onPress={() => vm.updateFilter('originCountries', [])}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Clear selected countries"
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
        </>
      )}
    </ScrollView>
  );
}

// ─── Smart Tags ────────────────────────────────────────────────────────────────
// These are curated filters that don't map 1:1 to a TMDB genre.
const SMART_TAGS = [
  {
    key: 'anime',
    label: 'Anime ✦',
    // Only meaningful in Exclude mode; no TMDB genre ID.
    description:
      'Anime is not an official TMDB genre. This smart-filter removes ' +
      'titles where the original language is Japanese AND the Animation ' +
      'genre is set, or where "anime" appears in the title/overview.',
  },
];

// ─── Genre Filter Section ─────────────────────────────────────────────────────

function GenreFilterSection({
  genres,
  genresLoading,
  genreIds,
  genreLogic,
  excludeGenreIds,
  excludeSmartTags,
  onToggleInclude,
  onToggleExclude,
  onToggleSmartTag,
  onUpdateGenreLogic,
  onClearAll,
  colors: c,
  typography,
  radii,
}) {
  // 'include' | 'exclude'
  const [activeTab, setActiveTab] = useState('include');

  const hasAnySelection =
    genreIds.length > 0 || excludeGenreIds.length > 0 || excludeSmartTags.length > 0;

  const includeCount = genreIds.length;
  const excludeCount = excludeGenreIds.length + excludeSmartTags.length;

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

      {/* ── Include / Exclude tab switcher ── */}
      <View
        style={[
          genreStyles.tabRow,
          { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.lg },
        ]}
      >
        {[
          { key: 'include', label: 'Include', count: includeCount, activeColor: GOLD_ACCENT },
          { key: 'exclude', label: 'Exclude', count: excludeCount, activeColor: c.error },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                genreStyles.tabBtn,
                { borderRadius: radii.md },
                isActive && { backgroundColor: tab.activeColor },
              ]}
              onPress={() => {
                if (activeTab !== tab.key) {
                  Haptics.selectionAsync();
                }
                setActiveTab(tab.key);
              }}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityLabel={`${tab.label} genres tab`}
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  {
                    color: isActive
                      ? tab.key === 'include'
                        ? '#141414'
                        : c.onPrimary
                      : c.onSurfaceVariant,
                    ...typography.labelSm,
                    fontWeight: '700',
                  },
                ]}
              >
                {tab.label}
                {tab.count > 0 ? ` (${tab.count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Include tab content ── */}
      {activeTab === 'include' && (
        <>
          {/* AND / OR logic toggle — only meaningful for include */}
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
              {genreLogic === 'AND' ? 'all selected genres' : 'any selected genre'}
            </Text>
          </View>

          {genresLoading ? (
            <GenreChipSkeleton count={10} />
          ) : (
            <View style={styles.chipWrap}>
              {genres.map((genre) => {
                const included = genreIds.includes(genre.id);
                const excluded = excludeGenreIds.includes(genre.id);
                // Chip state: included → primary, excluded → dimmed-error, else neutral
                let chipBg = c.surfaceContainerHigh;
                let chipBorder = { borderWidth: 1, borderColor: GOLD_DIM };
                let textColor = c.onSurfaceVariant;
                if (included) {
                  chipBg = GOLD_ACCENT;
                  chipBorder = {};
                  textColor = '#141414';
                }
                if (excluded) {
                  chipBg = c.error + '22';
                  chipBorder = { borderWidth: 1, borderColor: c.error + '55' };
                  textColor = c.error;
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
                      onToggleInclude(genre.id);
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Include ${genre.name} genre`}
                    accessibilityState={{ selected: included }}
                  >
                    {included && (
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color="#141414"
                        style={{ marginRight: 3 }}
                      />
                    )}
                    {excluded && (
                      <Ionicons
                        name="remove-circle-outline"
                        size={12}
                        color={c.error}
                        style={{ marginRight: 3 }}
                      />
                    )}
                    <Text style={[styles.chipText, { color: textColor, ...typography.labelSm }]}>
                      {genre.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {genreIds.length === 0 && !genresLoading && (
            <Text
              style={[
                {
                  color: c.onSurfaceVariant,
                  ...typography.labelSm,
                  marginTop: 8,
                  fontStyle: 'italic',
                },
              ]}
            >
              Tap a genre to require it in results.
            </Text>
          )}
        </>
      )}

      {/* ── Exclude tab content ── */}
      {activeTab === 'exclude' && (
        <>
          {/* Info callout */}
          <View
            style={[
              genreStyles.infoBanner,
              {
                backgroundColor: c.surfaceContainerHigh,
                borderRadius: radii.md,
                borderLeftColor: c.error,
              },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={c.onSurfaceVariant}
              style={{ marginRight: 8, marginTop: 1 }}
            />
            <Text style={[{ flex: 1, color: c.onSurfaceVariant, ...typography.labelSm }]}>
              Excluded genres are removed from results even if other filters match.
            </Text>
          </View>

          {genresLoading ? (
            <GenreChipSkeleton count={10} />
          ) : (
            <View style={styles.chipWrap}>
              {genres.map((genre) => {
                const excluded = excludeGenreIds.includes(genre.id);
                const included = genreIds.includes(genre.id);
                let chipBg = c.surfaceContainerHigh;
                let chipBorder = { borderWidth: 1, borderColor: c.outlineVariant + '40' };
                let textColor = c.onSurfaceVariant;
                if (excluded) {
                  chipBg = c.error;
                  chipBorder = {};
                  textColor = c.onPrimary;
                }
                if (included) {
                  chipBg = GOLD_ACCENT + '22';
                  chipBorder = { borderWidth: 1, borderColor: GOLD_ACCENT + '55' };
                  textColor = GOLD_ACCENT;
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
                      onToggleExclude(genre.id);
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Exclude ${genre.name} genre`}
                    accessibilityState={{ selected: excluded }}
                  >
                    {excluded && (
                      <Ionicons
                        name="close"
                        size={12}
                        color={c.onPrimary}
                        style={{ marginRight: 3 }}
                      />
                    )}
                    {included && (
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={GOLD_ACCENT}
                        style={{ marginRight: 3 }}
                      />
                    )}
                    <Text style={[styles.chipText, { color: textColor, ...typography.labelSm }]}>
                      {genre.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Smart Tags (Anime, etc.) ── */}
          <View style={genreStyles.smartTagsHeader}>
            <Ionicons
              name="sparkles-outline"
              size={13}
              color={c.onSurfaceVariant}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                {
                  color: c.onSurfaceVariant,
                  ...typography.labelSm,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                },
              ]}
            >
              SMART FILTERS
            </Text>
          </View>

          {SMART_TAGS.map((tag) => {
            const isActive = excludeSmartTags.includes(tag.key);
            return (
              <View key={tag.key}>
                <TouchableOpacity
                  style={[
                    genreStyles.smartTagChip,
                    {
                      borderRadius: radii.md,
                      backgroundColor: isActive ? c.error + '18' : c.surfaceContainerHigh,
                      borderColor: isActive ? c.error : c.outlineVariant + '40',
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onToggleSmartTag(tag.key);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Exclude ${tag.label}`}
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    {isActive ? (
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={c.error}
                        style={{ marginRight: 8 }}
                      />
                    ) : (
                      <Ionicons
                        name="close-circle-outline"
                        size={18}
                        color={c.onSurfaceVariant}
                        style={{ marginRight: 8 }}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          {
                            color: isActive ? c.error : c.onSurface,
                            ...typography.bodyMd,
                            fontWeight: '700',
                          },
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
                      {
                        backgroundColor: isActive ? c.error : c.surfaceContainerHigh,
                        borderRadius: radii.sm,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        {
                          color: isActive ? c.onPrimary : c.onSurfaceVariant,
                          fontSize: 10,
                          fontWeight: '800',
                        },
                      ]}
                    >
                      {isActive ? 'ON' : 'OFF'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Explanation callout shown when active */}
                {isActive && (
                  <View
                    style={[
                      genreStyles.smartTagInfo,
                      {
                        backgroundColor: c.error + '10',
                        borderRadius: radii.sm,
                        borderLeftColor: c.error,
                      },
                    ]}
                  >
                    <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm }]}>
                      {tag.description}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {excludeGenreIds.length === 0 && excludeSmartTags.length === 0 && !genresLoading && (
            <Text
              style={[
                {
                  color: c.onSurfaceVariant,
                  ...typography.labelSm,
                  marginTop: 8,
                  fontStyle: 'italic',
                },
              ]}
            >
              Tap a genre to exclude it from results.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

// ─── Results Section ──────────────────────────────────────────────────────────

function ResultsSection({
  vm,
  colors: c,
  typography,
  radii,
  onSelectItem,
  onToggleWatchlist,
  watchlistIds = [],
  reduceMotion = false,
}) {
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

  if (loading) {
    return (
      <View style={styles.resultsSection}>
        <ProgrammeSectionHeader eyebrow="RESULTS" title="Searching" />
        <ResultsSkeleton count={4} />
      </View>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (!hasSearched) {
    return (
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
    );
  }

  if (results.length === 0) {
    const airingFilterActive =
      vm.filters.airingThisWeek && vm.filters.mediaType === 'tv';

    return (
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
    );
  }

  const airingFilterActive = vm.filters.airingThisWeek && vm.filters.mediaType === 'tv';
  const resultCount = airingFilterActive ? results.length : totalResults;

  return (
    <View style={styles.resultsSection}>
      <View style={styles.resultsHeader}>
        <ProgrammeSectionHeader eyebrow="RESULTS" title="Programme" />
        <View style={styles.resultsHeaderBadges}>
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

      <PosterGrid
        bodyStyle={styles.resultsGrid}
        items={results}
        keyExtractor={(item) => `${item.tmdbId}-${item.mediaType}`}
        renderItem={(item) => (
          <DiscoverCard
            item={item}
            colors={c}
            typography={typography}
            radii={radii}
            onPress={() => onSelectItem(item)}
            onQuickSave={() => onToggleWatchlist?.(item)}
            isSaved={watchlistIds.includes(watchlistEntryKey(item))}
            reduceMotion={reduceMotion}
            showAirDay={airingFilterActive}
          />
        )}
      />

      {loadingMore && <LoadMoreSkeleton />}

      {!loadingMore && loadMoreError ? (
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

      {!hasMore && results.length > 0 && (
        <Text style={[styles.endText, { color: c.onSurfaceVariant, ...typography.labelSm }]}>
          — End of results —
        </Text>
      )}
    </View>
  );
}

// Swipe RIGHT → quick save to watchlist (gold bookmark hint)

const SWIPE_THRESHOLD = 64;

function DiscoverCard({
  item,
  colors: c,
  typography,
  radii,
  onPress,
  onQuickSave,
  isSaved,
  watchers,
  reduceMotion = false,
  showAirDay = false,
}) {
  const omdb = item.omdbRatings || {};
  const imdbRating = omdb.imdbRating ? omdb.imdbRating.replace('/10', '') : null;
  const rottenTomatoes = omdb.rottenTomatoes || null;
  const contentRating = omdb.rated || null;
  const hasOmdbMetadata = Boolean(imdbRating || rottenTomatoes || contentRating);

  const translateX = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const isTriggered = useRef(false);

  const resetSwipe = () => {
    if (reduceMotion) {
      translateX.setValue(0);
      hintOpacity.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(translateX, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(hintOpacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        isTriggered.current = false;
      },
      onPanResponderMove: (_, g) => {
        const clamped = Math.max(0, Math.min(g.dx, SWIPE_THRESHOLD * 1.4));
        translateX.setValue(clamped);
        hintOpacity.setValue(Math.min(1, clamped / SWIPE_THRESHOLD));

        if (!isTriggered.current && clamped >= SWIPE_THRESHOLD) {
          isTriggered.current = true;
          Haptics.selectionAsync();
        }
      },
      onPanResponderRelease: (_, g) => {
        const triggered = g.dx >= SWIPE_THRESHOLD;
        resetSwipe();

        if (triggered) {
          Haptics.selectionAsync();
          onQuickSave?.();
        }
      },
    }),
  ).current;

  return (
    <View style={styles.gridCard}>
      <Animated.View
        style={[
          styles.swipeHint,
          {
            opacity: hintOpacity,
            backgroundColor: isSaved ? c.surfaceContainerHigh : GOLD_ACCENT + '28',
            borderRadius: radii.xl,
          },
        ]}
      >
        <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={26} color={GOLD_ACCENT} />
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }] }}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Open details for ${item.title}`}
          {...panResponder.panHandlers}
        >
          <GridPosterCard
            item={item}
            colors={c}
            typography={typography}
            radii={radii}
            pressable={false}
            saved={isSaved}
            onToggleWatchlist={onQuickSave ? () => onQuickSave() : undefined}
            metaText={showAirDay && item.airDay ? item.airDay : undefined}
            metaExtra={
              watchers > 0 ? (
                <Text style={[styles.watchersMeta, { color: GOLD_ACCENT }]}>
                  · {watchers >= 1000 ? `${(watchers / 1000).toFixed(1)}k` : watchers} watching
                </Text>
              ) : null
            }
          />
          {hasOmdbMetadata && (
            <Text
              style={[styles.omdbMetaLine, { color: c.onSurfaceVariant, ...typography.labelSm }]}
              numberOfLines={1}
            >
              {imdbRating ? <>IMDb {imdbRating}</> : null}
              {imdbRating && rottenTomatoes ? ' · ' : ''}
              {rottenTomatoes ? <>RT {rottenTomatoes}</> : null}
              {(imdbRating || rottenTomatoes) && contentRating ? ' · ' : ''}
              {contentRating}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Micro Components ──────────────────────────────────────────────────────────

function SectionLabel({ label, colors, typography }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.onSurface, ...typography.labelSm }]}>
      {label}
    </Text>
  );
}

// ─── Genre Scroll Styles ──────────────────────────────────────────────────────

const genreScrollStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
});

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

  yearRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  yearInput: { borderWidth: StyleSheet.hairlineWidth },

  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 16,
  },
  validationText: { flex: 1 },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: scale(20), marginBottom: scale(8) },
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
    gap: 8,
    minHeight: 48,
  },
  // flex:1 + textAlign gives the label a definite width instead of its (short)
  // intrinsic measurement — see the fullBleed note in ProgrammeSectionHeader.
  // The button centres icon+label as a group, and the label's centre lands at
  // the same x either way, so this is not a visual change.
  searchBtnText: {
    flex: 1,
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

  gridCard: { width: GRID_COL_W, position: 'relative' },
  swipeHint: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: GRID_COL_W,
    height: GRID_POSTER_H,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  resultsGrid: {
    paddingHorizontal: 0,
  },
  watchersMeta: { fontSize: 10, fontWeight: '700' },
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
