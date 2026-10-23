import { useState, useCallback, useRef, useEffect } from 'react';
import {
  fetchGenres,
  discoverTitles,
  enrichDiscoverResults,
  fetchLanguages,
  fetchDiscoverCountries,
  enrichTraktItems,
} from './tmdb';
import { fetchTraktTrending } from './trakt';
import { resolvePreset, LANGUAGE_TO_COUNTRY_PRESET, intentPresetActive } from './languagePresets';
import { codesForCountryPreset, findCountryPreset } from './countryPresets';
import { classifyAppError } from './errors';
import {
  normalizeAppliedRating,
  validateRatingRange,
} from './discoverRating';
import {
  AIR_DATE_SORT,
  effectiveDiscoverSortBy,
  enrichResultsWithAirDay,
  sortByAirDateAsc,
  translateSortByForMediaType,
} from './tvAiringFilter';
import { REGION_QUICK_PICK_FILTERS } from './smartFilters';
import { matchesSeasonsRange } from './discoverRanges';
import { getProviderIdsForService } from './providerAvailability';

const REGION_SMART_TAG_KEYS = new Set(REGION_QUICK_PICK_FILTERS.map((f) => f.key));

/**
 * Structural equality over the filter object. Both sides are plain objects built
 * by spreading DEFAULT_FILTERS, so key order is stable and stringify is reliable.
 * Used to tell whether the live filters have drifted from the last committed
 * search (the "results are stale" signal).
 */
function filtersEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compute a canonical JSON signature of all filter fields EXCEPT `sortBy`.
 * Sort order is a presentation order over the exact same filtered set and must
 * never change the number of matching titles.
 */
export function filterSignatureWithoutSort(f) {
  if (!f) return '';
  const { sortBy: _ignoredSortBy, ...rest } = f;
  return JSON.stringify(rest);
}

const DEFAULT_FILTERS = {
  mediaType: 'movie',
  // ── Include genres ─────────────────────────────────────────────────────────
  genreIds: [],
  genreLogic: 'AND',
  // ── Exclude genres (official TMDB genres) ──────────────────────────────────
  excludeGenreIds: [],
  // ── Exclude smart tags (e.g. 'anime', 'eu', 'non_english') ─────────────────
  excludeSmartTags: [],
  // ── Include smart tags (e.g. 'anime', 'eu', 'non_english') ─────────────────
  includeSmartTags: [],
  // ── Optional filters ───────────────────────────────────────────────────────
  minRating: '7',
  maxRating: '10.0',
  languageCodes: [],
  excludeLanguageCodes: [],
  originCountries: [],
  excludeOriginCountries: [],
  fromYear: '',
  toYear: '',
  minRuntime: '',
  maxRuntime: '',
  minSeasons: '',
  maxSeasons: '',
  sortBy: 'popularity.desc',
  // ── Language preset (region shortcut) ─────────────────────────────────────
  // Stores the active preset id ('europe', 'east_asia', 'exclude_english', …)
  // null means the user is using the advanced individual-language picker.
  activePreset: null,
  // When true, `with_original_language` will use NOT logic to exclude 'en'.
  // Derived from the 'exclude_english' / 'non_english_only' special presets.
  excludeEnglish: false,
  // ── Country preset (continent shortcut, TV only) ───────────────────────────
  // Stores the active continent id ('africa', 'asia', 'europe', …).
  // Filters the country picker to only show countries in that continent.
  activeCountryPreset: null,
  // TV only: keep only shows with an episode airing in the next 7 days. Applied
  // server-side via TMDb's air_date.gte/lte on /discover/tv (see discoverTitles).
  airingThisWeek: false,
  // TV only: exclude currently airing shows (keep only ended/completed series).
  excludeAiringThisWeek: false,
  // ── Streaming service & region ─────────────────────────────────────────────
  watchServiceKey: null,
  watchRegion: null,
  watchRegionLabel: null,
};

export function useDiscoverViewModel() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [genres, setGenres] = useState([]);
  const [genresLoading, setGenresLoading] = useState(false);

  const [languages, setLanguages] = useState([]);
  const [languagesLoading, setLanguagesLoading] = useState(false);

  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);

  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0); // 0 = not yet searched

  // ── Live preview count (fires before commit) ────────────────────────────────
  // A debounced, count-only /discover call so the Search button can advertise
  // how many titles the current filters return before the user commits. null =
  // unknown (invalid range, in-flight, error, or the airing filter which has no
  // cheap count).
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewTokenRef = useRef(0);
  // Canonical count cache keyed by filterSignatureWithoutSort(filters) so
  // switching between any sort options never alters previewCount or totalResults.
  const canonicalCountBySignatureRef = useRef(new Map());

  // Snapshot of the filters that produced the currently-shown results. Compared
  // against live `filters` to know whether the results on screen are stale.
  const [searchedFilters, setSearchedFilters] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [enrichingResults, setEnrichingResults] = useState(false);
  const [error, setError] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [loadMoreError, setLoadMoreError] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // ── Trending (Trakt) ───────────────────────────────────────────────────────
  const [trendingResults, setTrendingResults] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState(null);

  // Linked-preset banner: set when a language preset maps to a country preset
  // and the user is on the TV view. Shape: { presetId, label } | null
  const [pendingCountryLink, setPendingCountryLink] = useState(null);

  // Abort guard: prevent stale responses overwriting newer ones
  const searchTokenRef = useRef(0);

  // ── Genre Fetching ─────────────────────────────────────────────────────────

  const loadGenres = useCallback(async (mediaType) => {
    setGenresLoading(true);
    try {
      const list = await fetchGenres(mediaType);
      setGenres(list);
    } catch {
      setGenres([]);
    } finally {
      setGenresLoading(false);
    }
  }, []);

  // ── Language Fetching ──────────────────────────────────────────────────────

  const loadLanguages = useCallback(async () => {
    if (languages.length > 0) return; // already loaded
    setLanguagesLoading(true);
    try {
      const list = await fetchLanguages();
      setLanguages(list);
    } catch {
      setLanguages([]);
    } finally {
      setLanguagesLoading(false);
    }
  }, [languages.length]);

  // ── Country Fetching ───────────────────────────────────────────────────────

  const loadCountries = useCallback(async () => {
    if (countries.length > 0) return; // already loaded
    setCountriesLoading(true);
    try {
      const list = await fetchDiscoverCountries();
      setCountries(list);
    } catch {
      setCountries([]);
    } finally {
      setCountriesLoading(false);
    }
  }, [countries.length]);

  // ── Filter Helpers ─────────────────────────────────────────────────────────

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setValidationError(null);
  }, []);

  // Toggle the TV "Airing this week" filter. Turning it on defaults the sort to
  // chronological (Air Date) so the grid reads like a schedule — but only if the
  // user is still on the popularity default, so an explicit sort choice is never
  // stomped. Turning it off reverts that implicit Air-Date default.
  const setAiringThisWeek = useCallback((next) => {
    setFilters((prev) => {
      const patch = {
        ...prev,
        airingThisWeek: next,
        excludeAiringThisWeek: next ? false : prev.excludeAiringThisWeek,
      };
      if (next && prev.sortBy === 'popularity.desc') {
        patch.sortBy = AIR_DATE_SORT;
      } else if (!next && prev.sortBy === AIR_DATE_SORT) {
        patch.sortBy = DEFAULT_FILTERS.sortBy;
      }
      return patch;
    });
    setValidationError(null);
  }, []);

  // Tri-state handler for "Airing this week" Quick Pick ('neutral' | 'include' | 'exclude').
  // Selecting include or exclude automatically switches mediaType to 'tv' if needed.
  const setAiringState = useCallback((targetState) => {
    setFilters((prev) => {
      if (targetState === 'include') {
        return {
          ...prev,
          mediaType: 'tv',
          airingThisWeek: true,
          excludeAiringThisWeek: false,
          sortBy:
            prev.sortBy === 'popularity.desc'
              ? AIR_DATE_SORT
              : translateSortByForMediaType(prev.sortBy, 'tv'),
        };
      }
      if (targetState === 'exclude') {
        return {
          ...prev,
          mediaType: 'tv',
          airingThisWeek: false,
          excludeAiringThisWeek: true,
          sortBy:
            prev.sortBy === AIR_DATE_SORT
              ? DEFAULT_FILTERS.sortBy
              : translateSortByForMediaType(prev.sortBy, 'tv'),
        };
      }
      return {
        ...prev,
        airingThisWeek: false,
        excludeAiringThisWeek: false,
        sortBy: prev.sortBy === AIR_DATE_SORT ? DEFAULT_FILTERS.sortBy : prev.sortBy,
      };
    });
    setValidationError(null);
  }, []);

  // ── Include / Exclude Language Toggles (Tri-state) ─────────────────────────
  const toggleIncludeLanguage = useCallback((code) => {
    setFilters((prev) => {
      const alreadyIncluded = prev.languageCodes.includes(code);
      const nextIncluded = alreadyIncluded
        ? prev.languageCodes.filter((c) => c !== code)
        : [...prev.languageCodes, code];
      const nextExcluded = (prev.excludeLanguageCodes || []).filter((c) => c !== code);
      const nextIncludeSmartTags =
        code === 'en' && !alreadyIncluded
          ? prev.includeSmartTags.filter((t) => t !== 'non_english')
          : prev.includeSmartTags;
      return {
        ...prev,
        activePreset: null,
        languageCodes: nextIncluded,
        excludeLanguageCodes: nextExcluded,
        excludeEnglish: code === 'en' && !alreadyIncluded ? false : prev.excludeEnglish,
        includeSmartTags: nextIncludeSmartTags,
      };
    });
    setValidationError(null);
  }, []);

  const toggleExcludeLanguage = useCallback((code) => {
    setFilters((prev) => {
      const currentEx = prev.excludeLanguageCodes || [];
      const alreadyExcluded = currentEx.includes(code) || (code === 'en' && prev.excludeEnglish);
      const nextExcluded = alreadyExcluded
        ? currentEx.filter((c) => c !== code)
        : [...currentEx.filter((c) => c !== code), code];
      const nextIncluded = prev.languageCodes.filter((c) => c !== code);
      const nextExcludeSmartTags =
        code === 'en' && !alreadyExcluded
          ? prev.excludeSmartTags.filter((t) => t !== 'non_english')
          : prev.excludeSmartTags;
      const nextIncludeSmartTags =
        code === 'en' && alreadyExcluded
          ? prev.includeSmartTags.filter((t) => t !== 'non_english')
          : prev.includeSmartTags;
      return {
        ...prev,
        activePreset: null,
        languageCodes: nextIncluded,
        excludeLanguageCodes: nextExcluded,
        excludeEnglish: code === 'en' && alreadyExcluded ? false : prev.excludeEnglish,
        excludeSmartTags: nextExcludeSmartTags,
        includeSmartTags: nextIncludeSmartTags,
      };
    });
    setValidationError(null);
  }, []);

  // ── Include Genre Toggle ───────────────────────────────────────────────────
  // A genre can only be in ONE group at a time.
  // Toggling into "include" removes it from "exclude" if present.

  const toggleGenre = useCallback((id) => {
    setFilters((prev) => {
      const alreadyIncluded = prev.genreIds.includes(id);
      return {
        ...prev,
        genreIds: alreadyIncluded ? prev.genreIds.filter((g) => g !== id) : [...prev.genreIds, id],
        // Remove from exclude group if it was there
        excludeGenreIds: prev.excludeGenreIds.filter((g) => g !== id),
      };
    });
    setValidationError(null);
  }, []);

  // ── Exclude Genre Toggle ───────────────────────────────────────────────────
  // Toggling into "exclude" removes it from "include" if present.

  const toggleExcludeGenre = useCallback((id) => {
    setFilters((prev) => {
      const alreadyExcluded = prev.excludeGenreIds.includes(id);
      return {
        ...prev,
        excludeGenreIds: alreadyExcluded
          ? prev.excludeGenreIds.filter((g) => g !== id)
          : [...prev.excludeGenreIds, id],
        // Remove from include group if it was there
        genreIds: prev.genreIds.filter((g) => g !== id),
      };
    });
    setValidationError(null);
  }, []);

  // ── Smart Tag Toggle (Exclude) ─────────────────────────────────────────────

  const toggleSmartTag = useCallback((tag) => {
    setFilters((prev) => {
      const already = prev.excludeSmartTags.includes(tag);
      const nextExcludeSmartTags = already
        ? prev.excludeSmartTags.filter((t) => t !== tag)
        : [...prev.excludeSmartTags, tag];
      const nextIncludeSmartTags = prev.includeSmartTags.filter((t) => t !== tag);
      // Excluding 'non_english' means English-only, so clear any explicit 'en' exclusion.
      const clearEnExclusion = tag === 'non_english' && !already;
      return {
        ...prev,
        excludeSmartTags: nextExcludeSmartTags,
        includeSmartTags: nextIncludeSmartTags,
        excludeLanguageCodes: clearEnExclusion
          ? (prev.excludeLanguageCodes || []).filter((c) => c !== 'en')
          : prev.excludeLanguageCodes || [],
        excludeEnglish: clearEnExclusion ? false : prev.excludeEnglish,
      };
    });
    setValidationError(null);
  }, []);

  // ── Include Smart Tag Toggle ───────────────────────────────────────────────

  const toggleIncludeSmartTag = useCallback((tag) => {
    setFilters((prev) => {
      const already = prev.includeSmartTags.includes(tag);
      const nextIncludeSmartTags = already
        ? prev.includeSmartTags.filter((t) => t !== tag)
        : [...prev.includeSmartTags, tag];
      const nextExcludeSmartTags = prev.excludeSmartTags.filter((t) => t !== tag);
      // Including 'non_english' excludes English, so drop 'en' from explicit languageCodes.
      const clearEnInclusion = tag === 'non_english' && !already;
      return {
        ...prev,
        includeSmartTags: nextIncludeSmartTags,
        excludeSmartTags: nextExcludeSmartTags,
        languageCodes: clearEnInclusion
          ? prev.languageCodes.filter((c) => c !== 'en')
          : prev.languageCodes,
      };
    });
    setValidationError(null);
  }, []);

  const toggleFilterValue = useCallback((key, value) => {
    setFilters((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      const already = current.includes(value);
      return {
        ...prev,
        [key]: already ? current.filter((item) => item !== value) : [...current, value],
      };
    });
    setValidationError(null);
  }, []);

  // ── Intent Preset Actions ──────────────────────────────────────────────────

  /**
   * Toggle an intent preset (Anime, Korean, Foreign, …). If the preset is
   * already satisfied by the live filters it is cleared (each patched key reset
   * to its default); otherwise the patch is merged in. Stateless — activeness is
   * derived by `intentPresetActive`, never stored.
   */
  const applyIntentPreset = useCallback((preset) => {
    setFilters((prev) => {
      if (intentPresetActive(preset, prev)) {
        const cleared = {};
        Object.keys(preset.patch).forEach((key) => {
          cleared[key] = DEFAULT_FILTERS[key];
        });
        return { ...prev, ...cleared };
      }
      // Clear any legacy region-preset highlight when an intent preset takes over.
      return { ...prev, activePreset: null, ...preset.patch };
    });
    setPendingCountryLink(null);
    setValidationError(null);
  }, []);

  // ── Preset Actions ─────────────────────────────────────────────────────────

  /**
   * Activate a region or special preset.
   * Clears any manually selected individual language codes and sets the
   * derived languageCodes / excludeEnglish flags from the curated mapping.
   */
  const applyPreset = useCallback((presetId) => {
    const { languageCodes, excludeEnglish } = resolvePreset(presetId);
    setFilters((prev) => {
      const linkedId = LANGUAGE_TO_COUNTRY_PRESET[presetId];
      const isTV = prev.mediaType === 'tv';
      if (linkedId && isTV && !prev.activeCountryPreset) {
        const linked = findCountryPreset(linkedId);
        setPendingCountryLink(linked ? { presetId: linkedId, label: linked.label } : null);
      } else {
        setPendingCountryLink(null);
      }
      return {
        ...prev,
        activePreset: presetId,
        languageCodes,
        excludeEnglish,
      };
    });
    setValidationError(null);
  }, []);

  /**
   * Clear all language selection (preset + individual codes + region smart tags).
   */
  const clearPreset = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      activePreset: null,
      languageCodes: [],
      excludeLanguageCodes: [],
      excludeEnglish: false,
      includeSmartTags: prev.includeSmartTags.filter((t) => !REGION_SMART_TAG_KEYS.has(t)),
      excludeSmartTags: prev.excludeSmartTags.filter((t) => !REGION_SMART_TAG_KEYS.has(t)),
    }));
    setPendingCountryLink(null);
    setValidationError(null);
  }, []);

  /**
   * Clear all Quick Picks (languages, regions, vibes/formats, and airing schedule).
   */
  const clearQuickPicks = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      activePreset: null,
      languageCodes: [],
      excludeLanguageCodes: [],
      excludeEnglish: false,
      includeSmartTags: [],
      excludeSmartTags: [],
      airingThisWeek: false,
      excludeAiringThisWeek: false,
      sortBy: prev.sortBy === AIR_DATE_SORT ? DEFAULT_FILTERS.sortBy : prev.sortBy,
    }));
    setPendingCountryLink(null);
    setValidationError(null);
  }, []);

  // ── Linked Country Preset Actions ──────────────────────────────────────────

  /** User accepted the linked country preset suggestion. */
  const acceptCountryLink = useCallback(() => {
    if (!pendingCountryLink) return;
    const allowed = new Set(codesForCountryPreset(pendingCountryLink.presetId));
    setFilters((prev) => ({
      ...prev,
      activeCountryPreset: pendingCountryLink.presetId,
      originCountries: prev.originCountries.filter((code) => allowed.has(code)),
    }));
    setPendingCountryLink(null);
    setValidationError(null);
  }, [pendingCountryLink]);

  /** User dismissed the linked country preset suggestion. */
  const dismissCountryLink = useCallback(() => {
    setPendingCountryLink(null);
  }, []);

  // ── Country Preset Actions ─────────────────────────────────────────────────

  /**
   * Activate a continent preset for the Origin Country picker.
   * Clears any selected origin countries that are outside the chosen continent.
   */
  const applyCountryPreset = useCallback((presetId) => {
    const allowed = new Set(codesForCountryPreset(presetId));
    setFilters((prev) => ({
      ...prev,
      activeCountryPreset: presetId,
      // Keep only already-selected countries that belong to the continent.
      originCountries: prev.originCountries.filter((code) => allowed.has(code)),
    }));
    setValidationError(null);
  }, []);

  /**
   * Clear the continent preset (shows full country list again).
   * Does NOT clear the already-selected countries.
   */
  const clearCountryPreset = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      activeCountryPreset: null,
    }));
    setValidationError(null);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters((prev) => ({
      ...DEFAULT_FILTERS,
      mediaType: prev.mediaType,
      genreIds: [],
      excludeGenreIds: [],
      excludeSmartTags: [],
      includeSmartTags: [],
      languageCodes: [],
      excludeLanguageCodes: [],
      originCountries: [],
      excludeOriginCountries: [],
      minSeasons: '',
      maxSeasons: '',
      activePreset: null,
      excludeEnglish: false,
      activeCountryPreset: null,
      airingThisWeek: false,
      excludeAiringThisWeek: false,
      watchServiceKey: null,
      watchRegion: null,
      watchRegionLabel: null,
    }));
    setPendingCountryLink(null);
    setValidationError(null);
  }, []);

  // ── Trending Loader ────────────────────────────────────────────────────────

  const trendingTokenRef = useRef(0);

  // TMDb popularity for the current media type — the fallback when Trakt is
  // unavailable (its /trending endpoint 403s on some networks). Keeps the
  // pre-search rail populated instead of dropping to a blank prompt.
  const loadTmdbPopularFallback = useCallback(async (mediaType, token) => {
    try {
      const data = await discoverTitles({ mediaType, sortBy: 'popularity.desc', page: 1 });
      if (token !== trendingTokenRef.current) return;
      const withPosters = (data.results || []).filter((item) => item.posterUrl);
      setTrendingResults(withPosters);
      setTrendingError(withPosters.length === 0 ? 'Unable to load trending titles.' : null);
    } catch (inner) {
      if (token !== trendingTokenRef.current) return;
      setTrendingError(inner?.message || 'Unable to load trending titles.');
      setTrendingResults([]);
    }
  }, []);

  const loadTrending = useCallback(
    async (mediaType) => {
      const token = ++trendingTokenRef.current;
      setTrendingLoading(true);
      setTrendingError(null);
      try {
        const raw = await fetchTraktTrending(mediaType, 20);
        const enriched = await enrichTraktItems(raw);
        if (token !== trendingTokenRef.current) return; // stale
        const withPosters = enriched.filter((item) => item.posterUrl);
        if (withPosters.length > 0) {
          setTrendingResults(withPosters);
        } else {
          // Trakt returned nothing usable → fall back to TMDb popularity.
          await loadTmdbPopularFallback(mediaType, token);
        }
      } catch {
        // Trakt failed (commonly 403) → TMDb popularity keeps the rail alive.
        await loadTmdbPopularFallback(mediaType, token);
      } finally {
        if (token === trendingTokenRef.current) setTrendingLoading(false);
      }
    },
    [loadTmdbPopularFallback],
  );

  // Auto-reload trending whenever mediaType changes
  useEffect(() => {
    loadTrending(filters.mediaType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.mediaType]);

  // ── Validation ─────────────────────────────────────────────────────────────

  function appliedRating(value) {
    return normalizeAppliedRating(value);
  }

  function appliedRuntime(value) {
    const parsed = parseInt(value, 10);
    if (!value || isNaN(parsed) || parsed === 0) return null;
    return parsed;
  }

  function appliedSeasons(value) {
    const parsed = parseInt(value, 10);
    if (!value || isNaN(parsed) || parsed <= 0) return null;
    return parsed;
  }

  function validate(f) {
    const from = parseInt(f.fromYear, 10);
    const to = parseInt(f.toYear, 10);
    if (f.fromYear && f.toYear && !isNaN(from) && !isNaN(to) && from > to) {
      return '"From Year" cannot be greater than "To Year".';
    }
    const curYear = new Date().getFullYear();
    if (f.fromYear && !isNaN(from) && (from < 1900 || from > curYear + 5)) {
      return `"From Year" must be between 1900 and ${curYear + 5}.`;
    }
    if (f.toYear && !isNaN(to) && (to < 1900 || to > curYear + 5)) {
      return `"To Year" must be between 1900 and ${curYear + 5}.`;
    }

    if (f.minRuntime) {
      const rawMin = parseInt(f.minRuntime, 10);
      if (isNaN(rawMin) || rawMin < 0 || rawMin > 999) {
        return 'Min runtime must be between 0 and 999.';
      }
    }
    if (f.maxRuntime) {
      const rawMax = parseInt(f.maxRuntime, 10);
      if (isNaN(rawMax) || rawMax < 0 || rawMax > 999) {
        return 'Max runtime must be between 0 and 999.';
      }
    }

    const minRuntime = appliedRuntime(f.minRuntime);
    const maxRuntime = appliedRuntime(f.maxRuntime);
    if (minRuntime != null && maxRuntime != null && minRuntime > maxRuntime) {
      return 'Min runtime cannot be greater than max runtime';
    }

    if (f.minSeasons) {
      const rawMinS = parseInt(f.minSeasons, 10);
      if (isNaN(rawMinS) || rawMinS < 1 || rawMinS > 99) {
        return 'Min seasons must be between 1 and 99.';
      }
    }
    if (f.maxSeasons) {
      const rawMaxS = parseInt(f.maxSeasons, 10);
      if (isNaN(rawMaxS) || rawMaxS < 1 || rawMaxS > 99) {
        return 'Max seasons must be between 1 and 99.';
      }
    }

    const minSeasons = appliedSeasons(f.minSeasons);
    const maxSeasons = appliedSeasons(f.maxSeasons);
    if (minSeasons != null && maxSeasons != null && minSeasons > maxSeasons) {
      return 'Min seasons cannot be greater than max seasons.';
    }

    const ratingErr = validateRatingRange(f.minRating, f.maxRating);
    if (ratingErr) return ratingErr;

    return null;
  }

  function resultKey(item) {
    return `${item.mediaType}:${item.tmdbId}`;
  }

  function effectiveOriginCountries(f) {
    // Manually-picked origin countries now apply to BOTH movies and TV (TMDb's
    // with_origin_country supports /discover/movie too). The continent-preset
    // expansion stays TV-only — those presets are only offered on the TV view.
    if (f.originCountries.length > 0) return f.originCountries;
    if (f.mediaType === 'tv' && f.activeCountryPreset) {
      return codesForCountryPreset(f.activeCountryPreset);
    }
    return [];
  }

  function buildDiscoverApiFilters(f) {
    const watchProviders = f.watchServiceKey ? getProviderIdsForService(f.watchServiceKey, f.watchRegion) : [];
    return {
      ...f,
      minRating: appliedRating(f.minRating),
      maxRating: appliedRating(f.maxRating),
      minSeasons: f.mediaType === 'tv' ? appliedSeasons(f.minSeasons) : null,
      maxSeasons: f.mediaType === 'tv' ? appliedSeasons(f.maxSeasons) : null,
      originCountries: effectiveOriginCountries(f),
      sortBy: effectiveDiscoverSortBy(f.sortBy, f.mediaType),
      watchRegion: f.watchServiceKey ? f.watchRegion : null,
      watchProviders,
    };
  }

  function resolveCanonicalCount(f, rawTotalResults) {
    const sig = filterSignatureWithoutSort(f);
    const cache = canonicalCountBySignatureRef.current;
    if (cache.has(sig)) {
      return cache.get(sig);
    }
    if (cache.size >= 64) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    cache.set(sig, rawTotalResults);
    return rawTotalResults;
  }

  function dedupeAppend(previous, incoming) {
    const seen = new Set(previous.map((item) => resultKey(item)));
    const add = incoming.filter((item) => {
      const key = resultKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [...previous, ...add];
  }

  // Non-blocking day-label pass for the airing-this-week grid. The SET is already
  // correct (server-side air_date window), so this only stamps `airDay` for the
  // schedule read and — when the user is sorting by Air Date — re-sorts the grid
  // chronologically once the labels land. Fire-and-forget, like OMDb enrichment.
  const enrichAirDays = useCallback((items, token, f) => {
    if (!f.airingThisWeek || f.mediaType !== 'tv' || !items.length) return;
    enrichResultsWithAirDay(items)
      .then((enriched) => {
        if (token !== searchTokenRef.current) return;
        const byKey = new Map(enriched.map((item) => [resultKey(item), item]));
        setResults((prev) => {
          // Field-merge (not replace): the OMDb ratings pass runs concurrently
          // over the same items, so overwriting whole items would clobber the
          // omdbRatings it just stamped (and vice-versa). Overlaying only the
          // fields each pass adds keeps both.
          const merged = prev.map((item) => {
            const e = byKey.get(resultKey(item));
            return e ? { ...item, ...e } : item;
          });
          return f.sortBy === AIR_DATE_SORT ? sortByAirDateAsc(merged) : merged;
        });
      })
      .catch(() => {
        // Best-effort labels — a failure just leaves the year fallback in place.
      });
  }, []);

  const enrichVisibleResults = useCallback((items, token, f) => {
    if (!items.length) return;

    setEnrichingResults(true);
    enrichDiscoverResults(items)
      .then((enrichedItems) => {
        if (token !== searchTokenRef.current) return;
        const enrichedByKey = new Map(enrichedItems.map((item) => [resultKey(item), item]));
        // Field-merge (not replace) so a concurrent air-day pass isn't clobbered.
        setResults((prev) => {
          const merged = prev.map((item) => {
            const e = enrichedByKey.get(resultKey(item));
            return e ? { ...item, ...e } : item;
          });
          const minRt = appliedRuntime(f?.minRuntime);
          const maxRt = appliedRuntime(f?.maxRuntime);
          const minS = appliedSeasons(f?.minSeasons);
          const maxS = appliedSeasons(f?.maxSeasons);
          if (minRt == null && maxRt == null && minS == null && maxS == null) return merged;
          return merged.filter((item) => {
            if (item.mediaType === 'movie' && item.runtimeMinutes != null) {
              if (minRt != null && item.runtimeMinutes < minRt) return false;
              if (maxRt != null && item.runtimeMinutes > maxRt) return false;
            }
            if (item.mediaType === 'tv' && item.numberOfSeasons != null) {
              if (!matchesSeasonsRange(item.numberOfSeasons, minS, maxS)) return false;
            }
            return true;
          });
        });
      })
      .catch(() => {
        // OMDb enrichment is best-effort and should never block or fail Discover.
      })
      .finally(() => {
        if (token === searchTokenRef.current) setEnrichingResults(false);
      });
  }, []);

  // ── Search (Page 1) ────────────────────────────────────────────────────────

  const search = useCallback(async () => {
    const err = validate(filters);
    if (err) {
      setValidationError(err);
      return;
    }

    const token = ++searchTokenRef.current;
    setLoading(true);
    setError(null);
    setErrorInfo(null);
    setLoadMoreError(null);
    setValidationError(null);
    setEnrichingResults(false);
    // Snapshot the committed filters so `resultsStale` can tell when the live
    // filters drift away from what's on screen.
    setSearchedFilters(filters);
    // NB: we deliberately do NOT clear results/totalResults/currentPage here.
    // Blanking to an empty grid + skeleton on every re-search threw away the
    // list the user was reading and flickered. Keeping the previous results in
    // place lets the grid swap under a lightweight "updating" indicator; the
    // skeleton now shows only on a first search (results.length === 0).

    try {
      const data = await discoverTitles({ ...buildDiscoverApiFilters(filters), page: 1 });
      if (token !== searchTokenRef.current) return; // stale
      const canonicalTotal = resolveCanonicalCount(filters, data.totalResults);
      setResults(data.results);
      setTotalResults(canonicalTotal);
      setPreviewCount(canonicalTotal);
      setTotalPages(data.totalPages);
      setCurrentPage(1);
      enrichVisibleResults(data.results, token, filters);
      enrichAirDays(data.results, token, filters);
    } catch (e) {
      if (token !== searchTokenRef.current) return;
      const classified = classifyAppError(e);
      setError(classified.message);
      setErrorInfo(classified);
    } finally {
      if (token === searchTokenRef.current) setLoading(false);
    }
  }, [filters]);

  // ── Live Preview Count ───────────────────────────────────────────────────────
  // Debounced, count-only /discover call on every settled filter change so the
  // Search button can say "Search · 1,240" before the user commits. Uses the same
  // buildDiscoverApiFilters pipeline the real search uses, so the number matches.
  // Because sort order never alters the filter predicate, a pure sortBy change
  // reuses the canonical count for the current filter signature immediately.
  useEffect(() => {
    // Invalid ranges → no meaningful count. The airing-this-week filter now has a
    // real, cheap count: its server-side air_date window returns a truthful
    // total_results like any other /discover query, so it no longer bails here.
    if (validate(filters)) {
      previewTokenRef.current += 1; // cancel any in-flight preview
      setPreviewLoading(false);
      setPreviewCount(null);
      return;
    }

    const sig = filterSignatureWithoutSort(filters);
    if (canonicalCountBySignatureRef.current.has(sig)) {
      previewTokenRef.current += 1;
      setPreviewLoading(false);
      setPreviewCount(canonicalCountBySignatureRef.current.get(sig));
      return;
    }

    const token = ++previewTokenRef.current;
    setPreviewLoading(true);
    const handle = setTimeout(async () => {
      try {
        const data = await discoverTitles({ ...buildDiscoverApiFilters(filters), page: 1 });
        if (token !== previewTokenRef.current) return;
        const canonicalTotal = resolveCanonicalCount(filters, data.totalResults);
        setPreviewCount(canonicalTotal);
      } catch {
        if (token !== previewTokenRef.current) return;
        setPreviewCount(null); // best-effort; never blocks the real search
      } finally {
        if (token === previewTokenRef.current) setPreviewLoading(false);
      }
    }, 400);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // ── Load More (Pagination) ─────────────────────────────────────────────────

  const loadMoreInFlightRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingMore || loadMoreInFlightRef.current || currentPage >= totalPages) return;

    const nextPage = currentPage + 1;
    loadMoreInFlightRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const data = await discoverTitles({ ...buildDiscoverApiFilters(filters), page: nextPage });
      setResults((prev) => dedupeAppend(prev, data.results));
      setCurrentPage(nextPage);
      enrichVisibleResults(data.results, searchTokenRef.current, filters);
      enrichAirDays(data.results, searchTokenRef.current, filters);
    } catch (e) {
      setLoadMoreError(classifyAppError(e).message || "Couldn't load more. Tap to retry.");
    } finally {
      loadMoreInFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [filters, currentPage, totalPages, loadingMore, enrichVisibleResults]);

  const hasMore = currentPage > 0 && currentPage < totalPages;
  const hasSearched = currentPage > 0;
  // Results on screen no longer match the live filters: the user has edited a
  // filter since the last committed search.
  const resultsStale =
    hasSearched && searchedFilters != null && !filtersEqual(filters, searchedFilters);

  return {
    filters,
    updateFilter,
    setAiringThisWeek,
    setAiringState,
    toggleIncludeLanguage,
    toggleExcludeLanguage,
    toggleGenre,
    toggleExcludeGenre,
    toggleSmartTag,
    toggleIncludeSmartTag,
    toggleFilterValue,
    applyIntentPreset,
    applyPreset,
    clearPreset,
    clearQuickPicks,
    acceptCountryLink,
    dismissCountryLink,
    pendingCountryLink,
    applyCountryPreset,
    clearCountryPreset,
    resetFilters,

    genres,
    genresLoading,
    loadGenres,

    languages,
    languagesLoading,
    loadLanguages,

    countries,
    countriesLoading,
    loadCountries,

    results,
    totalResults,
    hasMore,
    hasSearched,
    resultsStale,

    previewCount,
    previewLoading,

    trendingResults,
    trendingLoading,
    trendingError,
    loadTrending,

    loading,
    loadingMore,
    enrichingResults,
    error,
    errorInfo,
    loadMoreError,
    validationError,

    search,
    loadMore,
    clearError: () => {
      setError(null);
      setErrorInfo(null);
    },
    clearLoadMoreError: () => setLoadMoreError(null),
  };
}
