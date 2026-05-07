import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { MediaArtwork } from './MediaArtwork';
import { REGION_PRESETS, SPECIAL_PRESETS, findPreset } from '../lib/languagePresets';
import { COUNTRY_PRESETS, findCountryPreset, filterCountriesByPreset } from '../lib/countryPresets';

// ─── Sort Options (media-type-aware) ──────────────────────────────────────────
const SORT_OPTIONS_MOVIE = [
  { value: 'popularity.desc',           label: 'Most Popular' },
  { value: 'vote_average.desc',         label: 'Highest Rated' },
  { value: 'primary_release_date.desc', label: 'Newest First' },
  { value: 'primary_release_date.asc',  label: 'Oldest First' },
  { value: 'revenue.desc',              label: 'Most Revenue' },
];

const SORT_OPTIONS_TV = [
  { value: 'popularity.desc',      label: 'Most Popular' },
  { value: 'vote_average.desc',    label: 'Highest Rated' },
  { value: 'first_air_date.desc',  label: 'Newest First' },
  { value: 'first_air_date.asc',   label: 'Oldest First' },
];

// ─── Rating Steps ──────────────────────────────────────────────────────────────
const RATING_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function buildMultiLabel(items, selectedCodes, emptyLabel, noun) {
  if (!selectedCodes.length) return emptyLabel;

  const labels = selectedCodes
    .map((code) => items.find((item) => item.code === code)?.label || code)
    .filter(Boolean);

  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} ${noun}`;
}

// ─── Searchable Picker Modal ───────────────────────────────────────────────────
function SearchablePickerModal({
  visible,
  onClose,
  title,
  items,          // [{ code, label }]
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

  const handleSelect = (item) => {
    if (item.code == null) {
      onClear();
      setQuery('');
      return;
    }
    onToggle(item.code);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={pickerStyles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View style={[pickerStyles.sheet, { backgroundColor: colors.surface, borderRadius: radii.xl, paddingBottom: insets.bottom + 16 }]}>
            {/* Header */}
            <View style={pickerStyles.sheetHeader}>
              <Text style={[{ color: colors.onSurface, ...typography.titleMd, fontWeight: '700' }]}>{title}</Text>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Done selecting ${title.toLowerCase()}`}
              >
                <Text style={[{ color: colors.primary, ...typography.labelSm, fontWeight: '800' }]}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View style={[pickerStyles.searchBox, { backgroundColor: colors.surfaceContainerHigh, borderRadius: radii.md }]}>
              <Ionicons name="search-outline" size={16} color={colors.onSurfaceVariant} style={{ marginRight: 8 }} />
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
              <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => String(item.code ?? '__any__')}
                style={{ maxHeight: 380 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const active = item.code == null ? selectedCodes.length === 0 : selectedCodes.includes(item.code);
                  return (
                    <TouchableOpacity
                      style={[
                        pickerStyles.pickerRow,
                        active && { backgroundColor: colors.primary + '18' },
                      ]}
                      onPress={() => handleSelect(item)}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[{ flex: 1, color: active ? colors.primary : colors.onSurface, ...typography.bodyMd, fontWeight: active ? '700' : '400' }]}>
                        {item.label}
                      </Text>
                      {active && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <Text style={[{ color: colors.onSurfaceVariant, ...typography.bodyMd, textAlign: 'center', marginTop: 24 }]}>
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

export function DiscoverScreen({ onSelectItem, vm }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const c = colors;

  const [langModalVisible, setLangModalVisible] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const previousMediaTypeRef = useRef(vm.filters.mediaType);

  // Sort options depend on mediaType
  const sortOptions = vm.filters.mediaType === 'movie' ? SORT_OPTIONS_MOVIE : SORT_OPTIONS_TV;

  // Ensure current sortBy is valid for the current media type
  const validSortValues = sortOptions.map((o) => o.value);
  const displayedSortBy = validSortValues.includes(vm.filters.sortBy)
    ? vm.filters.sortBy
    : 'popularity.desc';

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

  const selectedLanguageCodes = vm.filters.languageCodes || [];
  const selectedOriginCountries = vm.filters.originCountries || [];
  const langLabel = buildMultiLabel(vm.languages, selectedLanguageCodes, 'Any Language', 'languages');
  const countryLabel = buildMultiLabel(vm.countries, selectedOriginCountries, 'Any Country', 'countries');

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
          Filter movies &amp; shows by criteria
        </Text>
      </View>

      {/* ── Filter Card ── */}
      <View style={[styles.card, { backgroundColor: c.surfaceContainer, borderRadius: radii.xl }]}>

        {/* ── Content Type Toggle ── */}
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
                accessibilityRole="button"
                accessibilityLabel={type === 'movie' ? 'Show movie filters' : 'Show TV show filters'}
                accessibilityState={{ selected: active }}
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

        {/* ── Genre Filter Groups ── */}
        <GenreFilterSection
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

        <Divider color={c.outlineVariant} />

        {/* ── Minimum Rating ── */}
        <SectionLabel
          label={`Minimum Rating: ${vm.filters.minRating > 0 ? vm.filters.minRating.toFixed(1) : 'Any'}`}
          colors={c}
          typography={typography}
        />
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
                accessibilityRole="button"
                accessibilityLabel={step === 0 ? 'Any minimum rating' : `Minimum rating ${step}`}
                accessibilityState={{ selected: active }}
              >
                <Text style={[{ color: active ? c.onPrimary : c.onSurfaceVariant, fontSize: 10, fontWeight: '700' }]}>
                  {step}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Divider color={c.outlineVariant} />

        {/* ── Language Presets ── */}
        <SectionLabel label="Language Presets" colors={c} typography={typography} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.hScroll, { marginBottom: 12 }]}>
          <View style={styles.hChipRow}>
            {SPECIAL_PRESETS.map((preset) => {
              const active = vm.filters.activePreset === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.chip,
                    { borderRadius: radii.full },
                    active
                      ? { backgroundColor: c.secondaryContainer, borderWidth: 1, borderColor: c.secondary }
                      : { backgroundColor: c.surfaceContainerHigh, borderWidth: 1, borderColor: c.outlineVariant + '40' },
                  ]}
                  onPress={() => active ? vm.clearPreset() : vm.applyPreset(preset.id)}
                >
                  <Text style={[styles.chipText, { color: active ? c.onSecondaryContainer : c.onSurfaceVariant, ...typography.labelSm }]}>
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
                    { borderRadius: radii.full },
                    active
                      ? { backgroundColor: c.primary }
                      : { backgroundColor: c.surfaceContainerHigh, borderWidth: 1, borderColor: c.outlineVariant + '40' },
                  ]}
                  onPress={() => active ? vm.clearPreset() : vm.applyPreset(preset.id)}
                >
                  <Text style={[styles.chipText, { color: active ? c.onPrimary : c.onSurfaceVariant, ...typography.labelSm }]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Preset Description / Smart Filter Note */}
        {vm.filters.activePreset && (
          <View style={[genreStyles.infoBanner, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.md, borderLeftColor: c.primary, marginBottom: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[{ color: c.onSurface, ...typography.labelSm, fontWeight: '700', marginBottom: 2 }]}>
                {findPreset(vm.filters.activePreset)?.label}
              </Text>
              <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm }]}>
                {findPreset(vm.filters.activePreset)?.description}
              </Text>
              {findPreset(vm.filters.activePreset)?.smartFilter && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <Ionicons name="sparkles-outline" size={12} color={c.primary} style={{ marginRight: 4 }} />
                  <Text style={[{ color: c.primary, ...typography.labelSm, fontWeight: '700' }]}>SMART FILTER</Text>
                </View>
              )}
              {findPreset(vm.filters.activePreset)?.smartFilterNote && (
                <Text style={[{ color: c.onSurfaceVariant, fontSize: 11, fontStyle: 'italic', marginTop: 4 }]}>
                  {findPreset(vm.filters.activePreset).smartFilterNote}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => vm.clearPreset()} style={{ marginLeft: 8 }}>
              <Ionicons name="close-circle" size={20} color={c.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Linked Country Preset Banner (TV only, automatic) ── */}
        {vm.pendingCountryLink && vm.filters.mediaType === 'tv' && (
          <View style={[
            genreStyles.infoBanner,
            {
              backgroundColor: c.secondaryContainer,
              borderRadius: radii.md,
              borderLeftColor: c.secondary,
              marginBottom: 16,
              alignItems: 'center',
            },
          ]}>
            <Ionicons name="link-outline" size={16} color={c.onSecondaryContainer} style={{ marginRight: 10, marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={[{ color: c.onSecondaryContainer, ...typography.labelSm, fontWeight: '700', marginBottom: 2 }]}>
                Also filter by origin country?
              </Text>
              <Text style={[{ color: c.onSecondaryContainer, ...typography.labelSm, opacity: 0.8 }]}>
                Narrow TV results to shows from {vm.pendingCountryLink.label} countries.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  style={[{ backgroundColor: c.secondary, borderRadius: radii.full, paddingHorizontal: 14, paddingVertical: 6 }]}
                  onPress={vm.acceptCountryLink}
                  accessibilityRole="button"
                  accessibilityLabel={`Yes, also filter by ${vm.pendingCountryLink.label} countries`}
                >
                  <Text style={[{ color: c.onSecondary, ...typography.labelSm, fontWeight: '800' }]}>Yes, link it</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[{ backgroundColor: c.secondaryContainer, borderRadius: radii.full, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: c.secondary + '60' }]}
                  onPress={vm.dismissCountryLink}
                  accessibilityRole="button"
                  accessibilityLabel="No, keep language filter only"
                >
                  <Text style={[{ color: c.onSecondaryContainer, ...typography.labelSm, fontWeight: '700' }]}>No thanks</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        <Divider color={c.outlineVariant} />

        {/* ── Advanced Language Filter ── */}
        <View style={styles.sectionRow}>
          <SectionLabel label="Advanced Language Filter" colors={c} typography={typography} />
          {vm.filters.activePreset && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="flash-outline" size={12} color={c.primary} />
              <Text style={[{ color: c.primary, fontSize: 10, fontWeight: '800' }]}>PRESET ACTIVE</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.pickerButton, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.md, borderColor: vm.filters.activePreset ? c.primary + '40' : c.outlineVariant + '40' }]}
          onPress={() => setLangModalVisible(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Original language, ${langLabel}`}
        >
          <Ionicons name="language-outline" size={16} color={selectedLanguageCodes.length || vm.filters.excludeEnglish ? c.primary : c.onSurfaceVariant} style={{ marginRight: 8 }} />
          <Text style={[{ flex: 1, color: (selectedLanguageCodes.length || vm.filters.excludeEnglish) ? c.onSurface : c.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={1}>
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
          <Ionicons name="chevron-down-outline" size={16} color={c.onSurfaceVariant} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        {/* ── Origin Country (TV only) ── */}
        {vm.filters.mediaType === 'tv' && (
          <>
            <Divider color={c.outlineVariant} />

            {/* Section label + clear */}
            <View style={styles.sectionRow}>
              <SectionLabel label="Country Presets" colors={c} typography={typography} />
              {vm.filters.activeCountryPreset && (
                <TouchableOpacity
                  onPress={() => vm.clearCountryPreset()}
                  accessibilityRole="button"
                  accessibilityLabel="Clear country preset"
                >
                  <Text style={[{ color: c.primary, ...typography.labelSm }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Continent chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.hScroll, { marginBottom: 12 }]}>
              <View style={styles.hChipRow}>
                {COUNTRY_PRESETS.map((preset) => {
                  const active = vm.filters.activeCountryPreset === preset.id;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.chip,
                        { borderRadius: radii.full },
                        active
                          ? { backgroundColor: c.primary }
                          : { backgroundColor: c.surfaceContainerHigh, borderWidth: 1, borderColor: c.outlineVariant + '40' },
                      ]}
                      onPress={() => active ? vm.clearCountryPreset() : vm.applyCountryPreset(preset.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter countries by ${preset.label}`}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.chipText, { color: active ? c.onPrimary : c.onSurfaceVariant, ...typography.labelSm }]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Active preset description banner */}
            {vm.filters.activeCountryPreset && (
              <View style={[genreStyles.infoBanner, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.md, borderLeftColor: c.primary, marginBottom: 16 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[{ color: c.onSurface, ...typography.labelSm, fontWeight: '700', marginBottom: 2 }]}>
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

            {/* Origin Country section label + picker */}
            <View style={styles.sectionRow}>
              <SectionLabel label="Origin Country (TV)" colors={c} typography={typography} />
              {vm.filters.activeCountryPreset && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="flash-outline" size={12} color={c.primary} />
                  <Text style={[{ color: c.primary, fontSize: 10, fontWeight: '800' }]}>PRESET ACTIVE</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.md, borderColor: vm.filters.activeCountryPreset ? c.primary + '40' : c.outlineVariant + '40' }]}
              onPress={() => setCountryModalVisible(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Origin country, ${countryLabel}`}
            >
              <Ionicons name="globe-outline" size={16} color={selectedOriginCountries.length ? c.primary : c.onSurfaceVariant} style={{ marginRight: 8 }} />
              <Text style={[{ flex: 1, color: selectedOriginCountries.length ? c.onSurface : c.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={1}>
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
              <Ionicons name="chevron-down-outline" size={16} color={c.onSurfaceVariant} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </>
        )}

        <Divider color={c.outlineVariant} />

        {/* ── Release Year Range ── */}
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

        {/* ── Sort By ── */}
        <SectionLabel label="Sort By" colors={c} typography={typography} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          <View style={styles.hChipRow}>
            {sortOptions.map((opt) => {
              const active = displayedSortBy === opt.value;
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
                  accessibilityRole="button"
                  accessibilityLabel={`Sort by ${opt.label}`}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, { color: active ? c.onPrimary : c.onSurfaceVariant, ...typography.labelSm }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* ── Validation Error ── */}
        {vm.validationError && (
          <View style={[styles.validationBanner, { backgroundColor: colors.error + '18', borderRadius: radii.md }]}>
            <Ionicons name="warning-outline" size={16} color={colors.error} />
            <Text style={[styles.validationText, { color: colors.error, ...typography.bodyMd }]}>
              {vm.validationError}
            </Text>
          </View>
        )}

        {/* ── Action Row ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.resetBtn, { borderRadius: radii.md, borderColor: c.outlineVariant + '40' }]}
            onPress={vm.resetFilters}
            accessibilityRole="button"
            accessibilityLabel="Reset discover filters"
          >
            <Ionicons name="refresh-outline" size={16} color={c.onSurfaceVariant} />
            <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm, marginLeft: 6 }]}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: c.primary, borderRadius: radii.md }]}
            onPress={vm.search}
            activeOpacity={0.85}
            disabled={vm.loading}
            accessibilityRole="button"
            accessibilityLabel="Search with selected filters"
            accessibilityState={{ disabled: vm.loading }}
          >
            {vm.loading
              ? <ActivityIndicator color={c.onPrimary} size="small" />
              : <>
                  <Ionicons name="search-outline" size={16} color={c.onPrimary} />
                  <Text style={[styles.searchBtnText, { color: c.onPrimary, ...typography.labelSm }]}>Search</Text>
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

      {/* ── Language Picker Modal ── */}
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

      {/* ── Country Picker Modal ── */}
      <SearchablePickerModal
        visible={countryModalVisible}
        onClose={() => setCountryModalVisible(false)}
        title={vm.filters.activeCountryPreset
          ? `${findCountryPreset(vm.filters.activeCountryPreset)?.label} Countries`
          : 'Select Origin Country'}
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
            <Text style={[{ color: c.primary, ...typography.labelSm }]}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Include / Exclude tab switcher ── */}
      <View style={[genreStyles.tabRow, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.lg }]}>
        {[
          { key: 'include', label: 'Include', count: includeCount, activeColor: c.primary },
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
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityLabel={`${tab.label} genres tab`}
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  {
                    color: isActive ? c.onPrimary : c.onSurfaceVariant,
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
            <View style={[styles.logicPill, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.full }]}>
              {['AND', 'OR'].map((mode) => {
                const active = genreLogic === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.logicOption, active && { backgroundColor: c.primary, borderRadius: radii.full }]}
                    onPress={() => onUpdateGenreLogic(mode)}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${mode} genre matching`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[{ color: active ? c.onPrimary : c.onSurfaceVariant, ...typography.labelSm, fontWeight: '700' }]}>
                      {mode}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm, marginLeft: 8, flex: 1 }]} numberOfLines={1}>
              {genreLogic === 'AND' ? 'all selected genres' : 'any selected genre'}
            </Text>
          </View>

          {genresLoading ? (
            <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />
          ) : (
            <View style={styles.chipWrap}>
              {genres.map((genre) => {
                const included = genreIds.includes(genre.id);
                const excluded = excludeGenreIds.includes(genre.id);
                // Chip state: included → primary, excluded → dimmed-error, else neutral
                let chipBg = c.surfaceContainerHigh;
                let chipBorder = { borderWidth: 1, borderColor: c.outlineVariant + '40' };
                let textColor = c.onSurfaceVariant;
                if (included) { chipBg = c.primary; chipBorder = {}; textColor = c.onPrimary; }
                if (excluded) { chipBg = c.error + '22'; chipBorder = { borderWidth: 1, borderColor: c.error + '55' }; textColor = c.error; }

                return (
                  <TouchableOpacity
                    key={genre.id}
                    style={[styles.chip, { borderRadius: radii.full, backgroundColor: chipBg }, chipBorder]}
                    onPress={() => onToggleInclude(genre.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Include ${genre.name} genre`}
                    accessibilityState={{ selected: included }}
                  >
                    {included && (
                      <Ionicons name="checkmark" size={12} color={c.onPrimary} style={{ marginRight: 3 }} />
                    )}
                    {excluded && (
                      <Ionicons name="remove-circle-outline" size={12} color={c.error} style={{ marginRight: 3 }} />
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
            <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm, marginTop: 8, fontStyle: 'italic' }]}>
              Tap a genre to require it in results.
            </Text>
          )}
        </>
      )}

      {/* ── Exclude tab content ── */}
      {activeTab === 'exclude' && (
        <>
          {/* Info callout */}
          <View style={[genreStyles.infoBanner, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.md, borderLeftColor: c.error }]}>
            <Ionicons name="information-circle-outline" size={16} color={c.onSurfaceVariant} style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={[{ flex: 1, color: c.onSurfaceVariant, ...typography.labelSm }]}>
              Excluded genres are removed from results even if other filters match.
            </Text>
          </View>

          {genresLoading ? (
            <ActivityIndicator color={c.error} style={{ marginVertical: 12 }} />
          ) : (
            <View style={styles.chipWrap}>
              {genres.map((genre) => {
                const excluded = excludeGenreIds.includes(genre.id);
                const included = genreIds.includes(genre.id);
                let chipBg = c.surfaceContainerHigh;
                let chipBorder = { borderWidth: 1, borderColor: c.outlineVariant + '40' };
                let textColor = c.onSurfaceVariant;
                if (excluded) { chipBg = c.error; chipBorder = {}; textColor = c.onPrimary; }
                if (included) { chipBg = c.primary + '22'; chipBorder = { borderWidth: 1, borderColor: c.primary + '55' }; textColor = c.primary; }

                return (
                  <TouchableOpacity
                    key={genre.id}
                    style={[styles.chip, { borderRadius: radii.full, backgroundColor: chipBg }, chipBorder]}
                    onPress={() => onToggleExclude(genre.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Exclude ${genre.name} genre`}
                    accessibilityState={{ selected: excluded }}
                  >
                    {excluded && (
                      <Ionicons name="close" size={12} color={c.onPrimary} style={{ marginRight: 3 }} />
                    )}
                    {included && (
                      <Ionicons name="checkmark" size={12} color={c.primary} style={{ marginRight: 3 }} />
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
            <Ionicons name="sparkles-outline" size={13} color={c.onSurfaceVariant} style={{ marginRight: 6 }} />
            <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm, fontWeight: '700', letterSpacing: 0.8 }]}>
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
                  onPress={() => onToggleSmartTag(tag.key)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Exclude ${tag.label}`}
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    {isActive
                      ? <Ionicons name="close-circle" size={18} color={c.error} style={{ marginRight: 8 }} />
                      : <Ionicons name="close-circle-outline" size={18} color={c.onSurfaceVariant} style={{ marginRight: 8 }} />
                    }
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: isActive ? c.error : c.onSurface, ...typography.bodyMd, fontWeight: '700' }]}>
                        {tag.label}
                      </Text>
                      <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm, marginTop: 2 }]} numberOfLines={2}>
                        Smart filter · not a TMDB genre
                      </Text>
                    </View>
                  </View>
                  <View style={[genreStyles.smartTagBadge, { backgroundColor: isActive ? c.error : c.surfaceContainerHigh, borderRadius: radii.sm }]}>
                    <Text style={[{ color: isActive ? c.onPrimary : c.onSurfaceVariant, fontSize: 10, fontWeight: '800' }]}>
                      {isActive ? 'ON' : 'OFF'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Explanation callout shown when active */}
                {isActive && (
                  <View style={[genreStyles.smartTagInfo, { backgroundColor: c.error + '10', borderRadius: radii.sm, borderLeftColor: c.error }]}>
                    <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm }]}>
                      {tag.description}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {excludeGenreIds.length === 0 && excludeSmartTags.length === 0 && !genresLoading && (
            <Text style={[{ color: c.onSurfaceVariant, ...typography.labelSm, marginTop: 8, fontStyle: 'italic' }]}>
              Tap a genre to exclude it from results.
            </Text>
          )}
        </>
      )}
    </View>
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
          accessibilityRole="button"
          accessibilityLabel="Try search again"
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
          Adjust the filters above and tap{'\n'}"Search" to explore.
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
          accessibilityRole="button"
          accessibilityLabel="Load more results"
          accessibilityState={{ disabled: loadingMore }}
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
    <TouchableOpacity
      style={styles.cardItem}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${item.title}`}
    >
      <View style={[styles.posterWrapper, { backgroundColor: c.surfaceContainerHigh, borderRadius: radii.xl }]}>
        {item.posterUrl ? (
          <MediaArtwork uri={item.posterUrl} style={styles.poster} resizeMode="cover" accessibilityLabel={`${item.title} poster`} />
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
  logicOption: { minHeight: 44, minWidth: 48, paddingHorizontal: 12, paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, minHeight: 48, justifyContent: 'center' },
  chipText: { fontWeight: '700' },
  hScroll: { marginBottom: 4 },
  hChipRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  clearGenres: { marginTop: 8, alignSelf: 'flex-start' },

  ratingRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  ratingDot: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },

  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 4,
  },

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
