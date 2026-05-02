import { useState, useCallback, useRef } from 'react';
import { fetchGenres, discoverTitles, fetchLanguages, fetchDiscoverCountries } from './tmdb';

const DEFAULT_FILTERS = {
  mediaType: 'movie',
  genreIds: [],
  genreLogic: 'AND',
  minRating: 0,
  languageCodes: [],
  originCountries: [],
  fromYear: '',
  toYear: '',
  sortBy: 'popularity.desc',
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

  const toggleGenre = useCallback((id) => {
    setFilters((prev) => {
      const already = prev.genreIds.includes(id);
      return {
        ...prev,
        genreIds: already ? prev.genreIds.filter((g) => g !== id) : [...prev.genreIds, id],
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

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS, genreIds: [], languageCodes: [], originCountries: [] });
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
    toggleFilterValue,
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
