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
import { resolvePreset, LANGUAGE_TO_COUNTRY_PRESET } from './languagePresets';
import { codesForCountryPreset, findCountryPreset } from './countryPresets';
import { classifyAppError } from './errors';
import {
  normalizeAppliedRating,
  validateRatingRange,
} from './discoverRating';
import {
  AIR_DATE_SORT,
  effectiveDiscoverSortBy,
  filterDiscoverResultsByAiring,
  sortByAirDateAsc,
} from './tvAiringFilter';

const DEFAULT_FILTERS = {
  mediaType: 'movie',
  // ── Include genres ─────────────────────────────────────────────────────────
  genreIds: [],
  genreLogic: 'AND',
  // ── Exclude genres (official TMDB genres) ──────────────────────────────────
  excludeGenreIds: [],
  // ── Exclude smart tags (e.g. 'anime') ──────────────────────────────────────
  excludeSmartTags: [],
  // ── Optional filters ───────────────────────────────────────────────────────
  minRating: '7',
  maxRating: '10.0',
  languageCodes: [],
  originCountries: [],
  fromYear: '',
  toYear: '',
  minRuntime: '',
  maxRuntime: '',
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
  // TV only: keep only shows whose next episode airs today through Sunday.
  airingThisWeek: false,
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

  // ── Smart Tag Toggle ───────────────────────────────────────────────────────

  const toggleSmartTag = useCallback((tag) => {
    setFilters((prev) => {
      const already = prev.excludeSmartTags.includes(tag);
      return {
        ...prev,
        excludeSmartTags: already
          ? prev.excludeSmartTags.filter((t) => t !== tag)
          : [...prev.excludeSmartTags, tag],
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
   * Clear all language selection (preset + individual codes).
   */
  const clearPreset = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      activePreset: null,
      languageCodes: [],
      excludeEnglish: false,
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
    setFilters({
      ...DEFAULT_FILTERS,
      genreIds: [],
      excludeGenreIds: [],
      excludeSmartTags: [],
      languageCodes: [],
      originCountries: [],
      activePreset: null,
      excludeEnglish: false,
      activeCountryPreset: null,
    });
    setPendingCountryLink(null);
    setValidationError(null);
  }, []);

  // ── Trending Loader ────────────────────────────────────────────────────────

  const loadTrending = useCallback(async (mediaType) => {
    setTrendingLoading(true);
    setTrendingError(null);
    try {
      const raw = await fetchTraktTrending(mediaType, 20);
      const enriched = await enrichTraktItems(raw);
      setTrendingResults(enriched.filter((item) => item.posterUrl)); // only show items with posters
    } catch (e) {
      setTrendingError(e?.message || 'Unable to load trending titles.');
      setTrendingResults([]);
    } finally {
      setTrendingLoading(false);
    }
  }, []);

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

    const ratingErr = validateRatingRange(f.minRating, f.maxRating);
    if (ratingErr) return ratingErr;

    return null;
  }

  function resultKey(item) {
    return `${item.mediaType}:${item.tmdbId}`;
  }

  function effectiveOriginCountries(f) {
    if (f.mediaType !== 'tv') return [];
    if (f.originCountries.length > 0) return f.originCountries;
    if (f.activeCountryPreset) return codesForCountryPreset(f.activeCountryPreset);
    return [];
  }

  function buildDiscoverApiFilters(f) {
    return {
      ...f,
      minRating: appliedRating(f.minRating),
      maxRating: appliedRating(f.maxRating),
      originCountries: effectiveOriginCountries(f),
      sortBy: effectiveDiscoverSortBy(f.sortBy),
    };
  }

  async function applyAiringFilter(items, f) {
    if (!f.airingThisWeek || f.mediaType !== 'tv') return items;

    let filtered = await filterDiscoverResultsByAiring(items);
    if (f.sortBy === AIR_DATE_SORT) {
      filtered = sortByAirDateAsc(filtered);
    }
    return filtered;
  }

  function mergeAiringResults(previous, incoming, f) {
    const seen = new Set(previous.map((item) => resultKey(item)));
    const dedupedIncoming = incoming.filter((item) => {
      const key = resultKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let merged = [...previous, ...dedupedIncoming];
    if (f.airingThisWeek && f.mediaType === 'tv' && f.sortBy === AIR_DATE_SORT) {
      merged = sortByAirDateAsc(merged);
    }
    return merged;
  }

  const enrichVisibleResults = useCallback((items, token) => {
    if (!items.length) return;

    setEnrichingResults(true);
    enrichDiscoverResults(items)
      .then((enrichedItems) => {
        if (token !== searchTokenRef.current) return;
        const enrichedByKey = new Map(enrichedItems.map((item) => [resultKey(item), item]));
        setResults((prev) => prev.map((item) => enrichedByKey.get(resultKey(item)) || item));
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
    setResults([]);
    setTotalResults(0);
    setCurrentPage(0);

    try {
      const data = await discoverTitles({ ...buildDiscoverApiFilters(filters), page: 1 });
      if (token !== searchTokenRef.current) return; // stale
      const filteredResults = await applyAiringFilter(data.results, filters);
      if (token !== searchTokenRef.current) return;
      setResults(filteredResults);
      setTotalResults(
        filters.airingThisWeek && filters.mediaType === 'tv'
          ? filteredResults.length
          : data.totalResults,
      );
      setTotalPages(data.totalPages);
      setCurrentPage(1);
      enrichVisibleResults(filteredResults, token);
    } catch (e) {
      if (token !== searchTokenRef.current) return;
      const classified = classifyAppError(e);
      setError(classified.message);
      setErrorInfo(classified);
    } finally {
      if (token === searchTokenRef.current) setLoading(false);
    }
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
      const filteredPage = await applyAiringFilter(data.results, filters);
      let mergedResults = [];
      setResults((prev) => {
        mergedResults = mergeAiringResults(prev, filteredPage, filters);
        return mergedResults;
      });
      if (filters.airingThisWeek && filters.mediaType === 'tv') {
        setTotalResults(mergedResults.length);
      }
      setCurrentPage(nextPage);
      enrichVisibleResults(filteredPage, searchTokenRef.current);
    } catch (e) {
      setLoadMoreError(classifyAppError(e).message || "Couldn't load more. Tap to retry.");
    } finally {
      loadMoreInFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [filters, currentPage, totalPages, loadingMore, enrichVisibleResults]);

  const hasMore = currentPage > 0 && currentPage < totalPages;
  const hasSearched = currentPage > 0;

  return {
    filters,
    updateFilter,
    toggleGenre,
    toggleExcludeGenre,
    toggleSmartTag,
    toggleFilterValue,
    applyPreset,
    clearPreset,
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
