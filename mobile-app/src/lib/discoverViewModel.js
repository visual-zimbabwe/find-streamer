import { useState, useCallback, useRef } from 'react';
import { fetchGenres, discoverTitles, fetchLanguages, fetchDiscoverCountries } from './tmdb';
import { resolvePreset } from './languagePresets';
import { codesForCountryPreset } from './countryPresets';

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
  minRating: 0,
  languageCodes: [],
  originCountries: [],
  fromYear: '',
  toYear: '',
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
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState(null);

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
        genreIds: alreadyIncluded
          ? prev.genreIds.filter((g) => g !== id)
          : [...prev.genreIds, id],
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
    setFilters((prev) => ({
      ...prev,
      activePreset: presetId,
      languageCodes,
      excludeEnglish,
    }));
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
    setValidationError(null);
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
    setValidationError(null);
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────

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
    return null;
  }

  // ── Search (Page 1) ────────────────────────────────────────────────────────

  const search = useCallback(async () => {
    const err = validate(filters);
    if (err) { setValidationError(err); return; }

    const token = ++searchTokenRef.current;
    setLoading(true);
    setError(null);
    setValidationError(null);
    setResults([]);
    setTotalResults(0);
    setCurrentPage(0);

    try {
      const data = await discoverTitles({ ...filters, page: 1 });
      if (token !== searchTokenRef.current) return; // stale
      setResults(data.results);
      setTotalResults(data.totalResults);
      setTotalPages(data.totalPages);
      setCurrentPage(1);
    } catch (e) {
      if (token !== searchTokenRef.current) return;
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      if (token === searchTokenRef.current) setLoading(false);
    }
  }, [filters]);

  // ── Load More (Pagination) ─────────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (loadingMore || currentPage >= totalPages) return;

    const nextPage = currentPage + 1;
    setLoadingMore(true);
    try {
      const data = await discoverTitles({ ...filters, page: nextPage });
      setResults((prev) => [...prev, ...data.results]);
      setCurrentPage(nextPage);
    } catch (e) {
      setError(e.message || 'Failed to load more results.');
    } finally {
      setLoadingMore(false);
    }
  }, [filters, currentPage, totalPages, loadingMore]);

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

    loading,
    loadingMore,
    error,
    validationError,

    search,
    loadMore,
    clearError: () => setError(null),
  };
}
