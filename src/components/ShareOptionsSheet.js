import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  TextInput,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { ShareCard, CARD_FORMATS } from './ShareCard';
import {
  SERVICE_COLORS,
  SERVICE_ICONS,
  getAvailableCountriesForService,
  buildDefaultSelectedCountries,
  buildCountryIndex,
  filterCountryCodes,
  collapseCountryList,
  shortName,
} from '../lib/shareUtils';

const PREVIEW_AREA_H = 218;

/**
 * A widely-available title is on Netflix in ~126 countries, and rendering one
 * chip each turned this picker into a wall you had to scroll past to reach the
 * share button. Show the head of POPULARITY_ORDER — which is what anyone picks
 * in practice — behind a "+N more", and offer search once the tail is big
 * enough that scanning it beats paging through it.
 */
const COLLAPSED_COUNTRY_LIMIT = 12;
const SEARCH_THRESHOLD = 18;

/**
 * ShareOptionsSheetContent — the share flow.
 *
 * Previously this was a bare country picker: the card it configured was
 * rendered off-screen and went straight to the OS share sheet, so every choice
 * here was made blind. The card now leads, live, and the country picker is
 * optional customization underneath it.
 *
 * Props:
 *   result          – full resolved result from resolveMatch()
 *   cardColors      – the same palette the capture host renders with (the
 *                     poster-derived theme), so the preview is the artifact.
 *   onShare(selected, format) – async; resolves when the capture has been
 *                     handed to the OS. Drives the CTA's busy state.
 *   onDraftChange({ selected, format }) – keeps the off-screen capture host in
 *                     sync so it is warm and correct by the time share is hit.
 */
export function ShareOptionsSheetContent({ result, cardColors, onShare, onDraftChange }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const { width: windowWidth } = useWindowDimensions();

  const [selected, setSelected] = useState(() =>
    buildDefaultSelectedCountries(result?.providerSummary, result?.rows),
  );
  const [format, setFormat] = useState('card');
  const [showCustomize, setShowCustomize] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [expandedServices, setExpandedServices] = useState({});

  // Reset selections whenever the result changes.
  useEffect(() => {
    if (result) {
      setSelected(buildDefaultSelectedCountries(result.providerSummary, result.rows));
      setCountryQuery('');
      setExpandedServices({});
    }
  }, [result?.tmdbId]);

  // Keep the off-screen capture card in lockstep with the preview.
  useEffect(() => {
    onDraftChange?.({ selected, format });
  }, [selected, format, onDraftChange]);

  /**
   * The sheet is a fixed-height container pinned to the bottom of the screen,
   * so the keyboard lands straight on top of it and buries the very chips the
   * search is filtering. Nothing above can resize it, so reclaim the space from
   * inside: while typing, the preview and format switch step aside (neither is
   * actionable mid-search), the list gets enough bottom padding to scroll up
   * into what is left, and the search box is pulled to the top of that space so
   * the first matches land in the visible band above the keyboard.
   */
  const scrollRef = useRef(null);
  const searchAnchorRef = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates?.height || 0);
      // Let the preview/format collapse re-lay-out first, then bring the search
      // box (and the results right below it) up under the header.
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ y: searchAnchorRef.current, animated: true }),
      );
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const isTyping = keyboardHeight > 0;

  const toggleCountry = useCallback((serviceKey, code) => {
    Haptics.selectionAsync();
    setSelected((prev) => {
      const cur = prev[serviceKey] || [];
      if (cur.includes(code)) {
        return { ...prev, [serviceKey]: cur.filter((c) => c !== code) };
      }
      if (cur.length < 2) {
        return { ...prev, [serviceKey]: [...cur, code] };
      }
      // At max: swap out the second slot (surfaced in the header hint below).
      return { ...prev, [serviceKey]: [cur[0], code] };
    });
  }, []);

  const toggleServiceExpanded = useCallback((serviceKey) => {
    Haptics.selectionAsync();
    setExpandedServices((prev) => ({ ...prev, [serviceKey]: !prev[serviceKey] }));
  }, []);

  const availableProviders = useMemo(
    () => (result?.providerSummary || []).filter((p) => p.count > 0),
    [result?.providerSummary],
  );

  const countryIndex = useMemo(() => buildCountryIndex(result?.rows), [result?.rows]);

  // Country lists per service, resolved once instead of on every chip render.
  const countriesByService = useMemo(() => {
    const out = {};
    availableProviders.forEach((p) => {
      out[p.key] = getAvailableCountriesForService(result?.rows, p.key);
    });
    return out;
  }, [availableProviders, result?.rows]);

  const showCountrySearch = useMemo(
    () => Object.values(countriesByService).some((codes) => codes.length > SEARCH_THRESHOLD),
    [countriesByService],
  );

  const totalSelected = useMemo(
    () => availableProviders.reduce((sum, p) => sum + (selected[p.key]?.length || 0), 0),
    [availableProviders, selected],
  );

  const selectionSummary = useMemo(() => {
    const codes = [];
    availableProviders.forEach((p) => (selected[p.key] || []).forEach((c) => codes.push(c)));
    const unique = [...new Set(codes)];
    if (unique.length === 0) return 'Nothing selected';
    const shown = unique
      .slice(0, 3)
      .map((code) => shortName(code, countryIndex.labels))
      .join(', ');
    return unique.length > 3 ? `${shown} +${unique.length - 3}` : shown;
  }, [availableProviders, selected, countryIndex]);

  // Sharing a card that claims a title streams nowhere, when it does, is a lie.
  const blockedByEmptySelection = availableProviders.length > 0 && totalSelected === 0;

  const spec = CARD_FORMATS[format] || CARD_FORMATS.card;
  // The card format's height is content-driven (more providers = taller), so
  // fitting on width alone clipped the footer — the QR and branding, which are
  // the whole reason to show a preview. Measure the laid-out card and fit both
  // axes. onLayout reports pre-transform size, so this can't feed back.
  /**
   * The card format's height is content-driven (more providers = taller), so it
   * has to be measured. The measurement is taken on a first pass with the
   * preview area *unconstrained* and then latched: measuring inside the
   * fixed-height area returns the constrained height, which yields too large a
   * scale and crops the card — and re-measuring afterwards would feed back.
   */
  const [measured, setMeasured] = useState({ format: null, height: 0 });
  const hasMeasured = measured.format === format && measured.height > 0;
  const measuredCardHeight = hasMeasured ? measured.height : 0;

  const handlePreviewLayout = useCallback(
    (e) => {
      const { height } = e.nativeEvent.layout;
      setMeasured((prev) => (prev.format === format && prev.height ? prev : { format, height }));
    },
    [format],
  );

  // Expanding the picker shows nothing if the preview eats the whole viewport.
  const previewAreaHeight = showCustomize ? PREVIEW_AREA_H * 0.62 : PREVIEW_AREA_H;

  const previewScale = useMemo(() => {
    const availableWidth = windowWidth - 88;
    const byWidth = Math.min(availableWidth / spec.width, 1);
    const height = spec.height || measuredCardHeight;
    if (!height) return byWidth;
    return Math.min(byWidth, previewAreaHeight / height);
  }, [windowWidth, spec, measuredCardHeight, previewAreaHeight]);

  const handleShare = useCallback(async () => {
    if (isSharing || blockedByEmptySelection) return;
    Haptics.selectionAsync();
    setIsSharing(true);
    try {
      await onShare?.(selected, format);
    } finally {
      setIsSharing(false);
    }
  }, [isSharing, blockedByEmptySelection, onShare, selected, format]);

  return (
    <View style={styles.contentRoot}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          isTyping && { paddingBottom: keyboardHeight },
        ]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Live preview ─────────────────────────────────────────── */}
        <View
          style={[
            styles.previewArea,
            hasMeasured && { height: previewAreaHeight },
            isTyping && styles.hiddenWhileTyping,
          ]}
        >
          {/* Until measured, this renders full-size and invisible for one frame
              so onLayout sees the card's true height. */}
          <View
            style={{
              flexShrink: 0,
              opacity: hasMeasured ? 1 : 0,
              transform: [{ scale: hasMeasured ? previewScale : 1 }],
            }}
            onLayout={handlePreviewLayout}
          >
            <ShareCard
              key={format}
              result={result}
              selectedCountries={selected}
              format={format}
              themeColors={cardColors}
            />
          </View>
        </View>

        {/* ── Format switch ────────────────────────────────────────── */}
        <View
          style={[
            styles.segmented,
            { borderColor: colors.outlineVariant + '55' },
            isTyping && styles.hiddenWhileTyping,
          ]}
        >
          {Object.values(CARD_FORMATS).map((option) => {
            const isActive = option.key === format;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFormat(option.key);
                }}
                style={[
                  styles.segment,
                  { borderRadius: radii.md },
                  isActive && { backgroundColor: colors.primary + '26' },
                ]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${option.label} format`}
              >
                <Ionicons
                  name={option.key === 'story' ? 'phone-portrait-outline' : 'albums-outline'}
                  size={15}
                  color={isActive ? colors.primary : colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: isActive ? colors.primary : colors.onSurfaceVariant,
                      ...typography.labelSm,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Optional country customization ───────────────────────── */}
        {availableProviders.length > 0 && (
          <>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setShowCustomize((v) => {
                  if (v) setCountryQuery('');
                  return !v;
                });
              }}
              style={[styles.customizeRow, { borderColor: colors.outlineVariant + '44' }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ expanded: showCustomize }}
              accessibilityLabel="Customize countries shown on the card"
            >
              <Ionicons name="globe-outline" size={17} color={colors.onSurfaceVariant} />
              <View style={styles.customizeCopy}>
                <Text
                  style={[styles.customizeTitle, { color: colors.onSurface, ...typography.bodyMd }]}
                >
                  Countries
                </Text>
                <Text
                  style={[
                    styles.customizeSummary,
                    {
                      color: blockedByEmptySelection ? colors.error : colors.onSurfaceVariant,
                      ...typography.labelSm,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {selectionSummary}
                </Text>
              </View>
              <Ionicons
                name={showCustomize ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>

            {showCustomize && showCountrySearch && (
              <View
                onLayout={(e) => {
                  searchAnchorRef.current = e.nativeEvent.layout.y;
                }}
                style={[
                  styles.searchBox,
                  {
                    backgroundColor: colors.surfaceContainerHigh,
                    borderColor: colors.outlineVariant + '35',
                    borderRadius: radii.lg,
                  },
                ]}
              >
                <Ionicons name="search-outline" size={17} color={colors.onSurfaceVariant} />
                <TextInput
                  value={countryQuery}
                  onChangeText={setCountryQuery}
                  placeholder="Search countries"
                  placeholderTextColor={colors.onSurfaceVariant}
                  style={[styles.searchInput, { color: colors.onSurface, ...typography.bodyMd }]}
                  autoCorrect={false}
                  autoCapitalize="none"
                  accessibilityLabel="Search countries"
                />
                {countryQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setCountryQuery('')}
                    accessibilityRole="button"
                    accessibilityLabel="Clear country search"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={17} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {showCustomize &&
              availableProviders.map((provider, idx) => {
                const countries = countriesByService[provider.key] || [];
                const sel = selected[provider.key] || [];
                const color = SERVICE_COLORS[provider.key];
                const isLast = idx === availableProviders.length - 1;
                const atMax = sel.length === 2;

                // A search is itself a "show me everything that matches", so it
                // overrides the collapsed head without disturbing the toggle.
                const isSearching = countryQuery.trim().length > 0;
                const matches = filterCountryCodes(countries, countryQuery, countryIndex);
                const isExpanded = !!expandedServices[provider.key];
                const visible =
                  isSearching || isExpanded
                    ? matches
                    : collapseCountryList(countries, sel, COLLAPSED_COUNTRY_LIMIT);
                const hiddenCount = countries.length - visible.length;

                return (
                  <View
                    key={provider.key}
                    style={[
                      styles.serviceSection,
                      !isLast && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.outlineVariant + '26',
                      },
                    ]}
                  >
                    <View style={styles.serviceHeader}>
                      <View
                        style={[
                          styles.serviceIconWrap,
                          { backgroundColor: color + '22', borderRadius: radii.md },
                        ]}
                      >
                        {provider.logoUrl ? (
                          <Image
                            source={{ uri: provider.logoUrl }}
                            style={styles.serviceLogo}
                            resizeMode="contain"
                          />
                        ) : (
                          <Ionicons
                            name={SERVICE_ICONS[provider.key] || 'play-circle'}
                            size={16}
                            color={color}
                          />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.serviceName,
                          { color: colors.onSurface, ...typography.bodyLg },
                        ]}
                      >
                        {provider.label}
                      </Text>
                      <Text
                        style={[
                          styles.selCount,
                          {
                            color: atMax ? color : colors.onSurfaceVariant,
                            ...typography.labelSm,
                          },
                        ]}
                      >
                        {sel.length}/2
                      </Text>
                    </View>

                    {/* The swap rule used to be invisible: a third tap silently
                        replaced the second pick. Say so. */}
                    {atMax && (
                      <Text
                        style={[
                          styles.swapHint,
                          { color: colors.onSurfaceVariant, ...typography.labelSm },
                        ]}
                      >
                        {`Max reached — tapping another replaces ${shortName(
                          sel[1],
                          countryIndex.labels,
                        )}`}
                      </Text>
                    )}

                    <View style={styles.chipsWrap}>
                      {visible.map((code) => {
                        const isSel = sel.includes(code);
                        return (
                          <TouchableOpacity
                            key={code}
                            onPress={() => toggleCountry(provider.key, code)}
                            activeOpacity={0.75}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: isSel
                                  ? color + '22'
                                  : colors.surfaceContainerHigh,
                                borderColor: isSel ? color : colors.outlineVariant + '44',
                                borderRadius: radii.md,
                              },
                            ]}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isSel }}
                            accessibilityLabel={`${shortName(code, countryIndex.labels)} on ${
                              provider.label
                            }`}
                          >
                            {isSel && <Ionicons name="checkmark" size={11} color={color} />}
                            <Text
                              style={[
                                styles.chipText,
                                { color: isSel ? color : colors.onSurfaceVariant },
                              ]}
                            >
                              {shortName(code, countryIndex.labels)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}

                      {!isSearching && hiddenCount > 0 && (
                        <TouchableOpacity
                          onPress={() => toggleServiceExpanded(provider.key)}
                          activeOpacity={0.75}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: 'transparent',
                              borderColor: colors.outlineVariant + '66',
                              borderRadius: radii.md,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Show all ${countries.length} countries for ${provider.label}`}
                        >
                          <Text style={[styles.chipText, { color: colors.primary }]}>
                            {`+${hiddenCount} more`}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {!isSearching && isExpanded && countries.length > COLLAPSED_COUNTRY_LIMIT && (
                        <TouchableOpacity
                          onPress={() => toggleServiceExpanded(provider.key)}
                          activeOpacity={0.75}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: 'transparent',
                              borderColor: colors.outlineVariant + '66',
                              borderRadius: radii.md,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Show fewer countries for ${provider.label}`}
                        >
                          <Text style={[styles.chipText, { color: colors.primary }]}>
                            Show less
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isSearching && visible.length === 0 && (
                      <Text
                        style={[
                          styles.noMatch,
                          { color: colors.onSurfaceVariant, ...typography.labelSm },
                        ]}
                      >
                        {`No ${provider.label} country matches “${countryQuery.trim()}”`}
                      </Text>
                    )}
                  </View>
                );
              })}
          </>
        )}
      </ScrollView>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      {blockedByEmptySelection && (
        <Text style={[styles.blockedHint, { color: colors.error, ...typography.labelSm }]}>
          Pick at least one country to share.
        </Text>
      )}
      <TouchableOpacity
        style={[
          styles.shareBtn,
          {
            backgroundColor: colors.primary,
            borderRadius: radii.lg,
            opacity: isSharing || blockedByEmptySelection ? 0.55 : 1,
          },
        ]}
        onPress={handleShare}
        disabled={isSharing || blockedByEmptySelection}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: isSharing || blockedByEmptySelection, busy: isSharing }}
        accessibilityLabel={isSharing ? 'Preparing card' : 'Generate and share card'}
      >
        {isSharing ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <Ionicons name="share-social-outline" size={18} color={colors.onPrimary} />
        )}
        <Text style={[styles.shareBtnText, { color: colors.onPrimary, ...typography.labelSm }]}>
          {isSharing ? 'PREPARING…' : 'GENERATE & SHARE'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contentRoot: {
    flex: 1,
    minHeight: 0,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyContent: {
    paddingBottom: 4,
  },
  previewArea: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  segmented: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 16,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
  },
  segmentText: {
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  customizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 14,
  },
  customizeCopy: {
    flex: 1,
    minWidth: 0,
  },
  customizeTitle: {
    fontWeight: '700',
  },
  customizeSummary: {
    fontWeight: '600',
    marginTop: 1,
  },
  // Collapsed rather than unmounted: the preview's height latch and the card's
  // image-readiness state survive, so dismissing the keyboard is instant.
  hiddenWhileTyping: {
    height: 0,
    opacity: 0,
    marginBottom: 0,
    paddingVertical: 0,
    borderWidth: 0,
    overflow: 'hidden',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    marginTop: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
  },
  serviceSection: {
    paddingVertical: 16,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  serviceIconWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  serviceName: {
    flex: 1,
    fontWeight: '700',
  },
  selCount: {
    fontWeight: '900',
  },
  swapHint: {
    fontWeight: '600',
    marginBottom: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noMatch: {
    fontWeight: '600',
    marginTop: 10,
  },
  blockedHint: {
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  shareBtn: {
    marginTop: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flexShrink: 0,
  },
  shareBtnText: {
    fontWeight: '900',
    letterSpacing: 1,
  },
});
