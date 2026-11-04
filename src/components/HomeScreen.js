import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { HomeFilterBar } from './HomeFilterBar';
import {
  getAvailableWatchlistLanguages,
  getUserWatchlistCollections,
  isDefaultCollectionId,
  resolveLanguageLabel,
  watchlistEntryKey,
} from '../lib/watchlistModel';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { useWhereToWatchFilter } from '../hooks/useWhereToWatchFilter';
import { getServiceLabel, isWhereFilterNarrowing } from '../lib/whereToWatch';
import { useBottomSheet } from './StackBottomSheet';
import {
  WhereToWatchCountrySheet,
  WhereToWatchLanguageSheet,
  WhereToWatchServiceSheet,
} from './WhereToWatchSheets';
import { ContentRail } from './ContentRail';
import { scale, verticalScale } from '../utils/responsive';
import { resolveRatingValue } from '../lib/ratings';
import { loadRailSortPrefs, saveRailSortPrefs } from '../lib/storage';
import { sortRailItems, toggleRailSortMode } from '../lib/railSort';
import { GOLD_ACCENT, GOLD_DIM, GRID_PAD } from '../theme/programme';
import { HomeFeedSkeleton } from './SkeletonLoaders';
import { useServiceLogos } from '../hooks/useServiceLogos';
import {
  getAwardCeremonyRows,
  getTvAwardCeremonyRows,
  getAllAwardWinners,
  getAllTvAwardWinners,
  getAllHonorsWinners,
} from '../lib/awardsCatalog';
import { ProgrammeSectionHeader } from './ProgrammeSectionHeader';
import { CinematicCardDeck } from './CinematicCardDeck';
import { MediaArtwork } from './MediaArtwork';
import { useDownloads } from '../lib/downloadManager';

const HEADER_BODY_H = scale(96);
const FILTERED_HERO_MAX = 12;

export { ContentRail } from './ContentRail';
export { CinematicCardDeck } from './CinematicCardDeck';

const sortByRatingDesc = (arr) =>
  [...arr].sort((a, b) => resolveRatingValue(b) - resolveRatingValue(a));

function hexWithAlpha(hex, alpha) {
  if (!hex || typeof hex !== 'string') return `rgba(212, 168, 83, ${alpha})`;
  const clean = hex.replace('#', '');
  let r = 212;
  let g = 168;
  let b = 83;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function makeAtmosphereGradient(hex) {
  return [
    hexWithAlpha(hex, 0.45),
    hexWithAlpha(hex, 0.22),
    hexWithAlpha(hex, 0.07),
    'transparent',
  ];
}

export function HomeScreen({
  watchlist = [],
  collections = [],
  spotlight = [],
  onSelectItem,
  onOpenCollections,
  mediaFilter = null,
  onMediaFilterChange,
}) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();
  const bottomSheet = useBottomSheet();
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const headerScrolledRef = useRef(false);
  const bottomNavScroll = useBottomNavScroll((event) => {
    const y = event?.nativeEvent?.contentOffset?.y ?? 0;
    const scrolled = y > 24;
    if (scrolled !== headerScrolledRef.current) {
      headerScrolledRef.current = scrolled;
      setHeaderScrolled(scrolled);
    }
  });
  const headerOffset = insets.top + HEADER_BODY_H;

  // ─── Where-to-watch and Language filters (Home owns the facets; the shared engine does the
  // scan). Rests at All / All = off, so first paint shows the whole library and
  // nothing is fetched until the user narrows.
  const [homeCountry, setHomeCountry] = useState(null); // { code, label } | null = all
  const [homeServiceKey, setHomeServiceKey] = useState(null); // null = all services
  const [homeLanguage, setHomeLanguage] = useState(null); // { code, label } | null = all
  const whereActive = isWhereFilterNarrowing(homeCountry, homeServiceKey);
  const isFiltered = whereActive || Boolean(homeLanguage);

  const [railSortPrefs, setRailSortPrefs] = useState({});

  useEffect(() => {
    let active = true;
    loadRailSortPrefs().then((saved) => {
      if (active && saved && typeof saved === 'object') {
        setRailSortPrefs(saved);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleToggleRailSort = useCallback((railId) => {
    if (!railId) return;
    setRailSortPrefs((prev) => {
      const current = prev[railId] || 'rating';
      const next = toggleRailSortMode(current);
      const updated = { ...prev, [railId]: next };
      saveRailSortPrefs(updated);
      return updated;
    });
  }, []);

  const availableLanguages = useMemo(() => {
    const base = getAvailableWatchlistLanguages(watchlist, collections);
    const byCode = new Map();
    let otherCount = 0;
    base.forEach((entry) => {
      if (entry.isOther || entry.code === 'other') {
        otherCount += entry.count || 0;
      } else if (entry.code) {
        byCode.set(entry.code, (byCode.get(entry.code) || 0) + (entry.count || 0));
      }
    });

    const seenKeys = new Set(
      (watchlist || []).map(watchlistEntryKey).filter(Boolean),
    );
    const honorsPool =
      mediaFilter === 'movie'
        ? getAllAwardWinners()
        : mediaFilter === 'tv'
        ? getAllTvAwardWinners()
        : getAllHonorsWinners();

    honorsPool.forEach((item) => {
      const key = watchlistEntryKey(item);
      if (!key || seenKeys.has(key)) return;
      seenKeys.add(key);
      const code = (item.originalLanguageCode || item.originalLanguage || '')
        .toLowerCase()
        .trim();
      if (!code) {
        otherCount += 1;
      } else {
        byCode.set(code, (byCode.get(code) || 0) + 1);
      }
    });

    const results = [];
    for (const [code, count] of byCode.entries()) {
      results.push({
        code,
        label: resolveLanguageLabel(code),
        count,
      });
    }
    results.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    if (otherCount > 0) {
      results.push({
        code: 'other',
        label: 'Other',
        count: otherCount,
        isOther: true,
      });
    }
    return results;
  }, [watchlist, collections, mediaFilter]);

  const totalLibraryTitlesCount = useMemo(() => {
    const seen = new Set();
    (watchlist || []).forEach((w) => {
      if (mediaFilter && w.mediaType !== mediaFilter) return;
      const key = watchlistEntryKey(w);
      if (key && !seen.has(key)) seen.add(key);
    });
    const honorsPool =
      mediaFilter === 'movie'
        ? getAllAwardWinners()
        : mediaFilter === 'tv'
        ? getAllTvAwardWinners()
        : getAllHonorsWinners();
    honorsPool.forEach((w) => {
      const key = watchlistEntryKey(w);
      if (key && !seen.has(key)) seen.add(key);
    });
    return seen.size;
  }, [watchlist, mediaFilter]);

  // Real provider logos for the service chip (the flag's counterpart), keyed by
  // service. Fetched once, cached; the chip falls back to no icon until present.
  const serviceLogos = useServiceLogos();
  const serviceLogoUrl = homeServiceKey ? serviceLogos[homeServiceKey] || null : null;

  const whereScopeItems = useMemo(() => {
    const list = [...(watchlist || [])];
    const seen = new Set(list.map(watchlistEntryKey).filter(Boolean));
    const allWinners = getAllHonorsWinners();
    allWinners.forEach((w) => {
      const key = watchlistEntryKey(w);
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push(w);
      }
    });
    return list;
  }, [watchlist]);

  const { matches: whereMatches, checking: whereChecking, scopeCount } =
    useWhereToWatchFilter({
      items: whereScopeItems,
      active: whereActive,
      country: homeCountry,
      serviceKey: homeServiceKey,
      collectionIds: null,
    });

  const watchlistRows = useMemo(() => {
    const matchedKeys = whereMatches?.keys || null;
    const allCollections =
      Array.isArray(collections) && collections.length > 0
        ? collections
        : getUserWatchlistCollections();

    // Built-in legacy categories render at the top in fixed sequence;
    // custom user watchlists render at the bottom, sorted newest-first.
    const systemCollections = allCollections.filter(
      (c) => c.source === 'legacy' || !c.source || isDefaultCollectionId(c.id),
    );
    const customCollections = allCollections
      .filter((c) => c.source === 'custom' && !isDefaultCollectionId(c.id))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const orderedCollections = [...systemCollections, ...customCollections];

    return orderedCollections
      .map((collection) => {
        const items = (watchlist || []).filter((w) => {
          if (mediaFilter && w.mediaType !== mediaFilter) return false;
          if (matchedKeys && !matchedKeys.has(watchlistEntryKey(w))) return false;
          if (homeLanguage) {
            const langCode =
              typeof w.originalLanguageCode === 'string'
                ? w.originalLanguageCode.toLowerCase().trim()
                : '';
            if (homeLanguage.code === 'other') {
              if (langCode) return false;
            } else {
              if (langCode !== homeLanguage.code) return false;
            }
          }
          return w.collectionIds?.includes(collection.id);
        });
        const sortMode = railSortPrefs[collection.id] || 'rating';
        const sorted = sortRailItems(items, sortMode);
        return {
          category: {
            id: collection.id,
            label: collection.name,
            icon: collection.icon,
          },
          items: sorted,
        };
      })
      .filter((row) => row.items.length > 0);
  }, [collections, watchlist, mediaFilter, whereMatches, homeLanguage, railSortPrefs]);

  const filterAndSortHonorsRows = useCallback(
    (rows) => {
      const matchedKeys = whereMatches?.keys || null;
      return rows
        .map((r) => {
          let items = r.items;
          if (matchedKeys) {
            items = items.filter((item) => matchedKeys.has(watchlistEntryKey(item)));
          }
          if (homeLanguage) {
            items = items.filter((item) => {
              const langCode = (item.originalLanguageCode || item.originalLanguage || '')
                .toLowerCase()
                .trim();
              if (homeLanguage.code === 'other') {
                return !langCode;
              }
              return langCode === homeLanguage.code;
            });
          }
          const ceremonyId = r.category.ceremonyId || r.category.id;
          const sortMode = railSortPrefs[ceremonyId] || 'rating';
          const sorted = sortRailItems(items, sortMode);
          return {
            ...r,
            items: sorted,
          };
        })
        .filter((r) => r.items.length > 0);
    },
    [homeLanguage, railSortPrefs, whereMatches],
  );

  const awardCeremonyRows = useMemo(() => {
    if (mediaFilter === 'tv') return [];
    return filterAndSortHonorsRows(getAwardCeremonyRows('movie'));
  }, [mediaFilter, filterAndSortHonorsRows]);

  const tvAwardCeremonyRows = useMemo(() => {
    if (mediaFilter === 'movie') return [];
    return filterAndSortHonorsRows(getTvAwardCeremonyRows());
  }, [mediaFilter, filterAndSortHonorsRows]);

  const {
    downloads,
    usedBytes,
    playDownloaded,
    pauseDownload,
    pauseByInfoHash,
    resumeDownload,
    resumeByInfoHash,
    deleteDownload,
    deleteByInfoHash,
    formatBytes,
    formatSpeed,
  } = useDownloads();

  const downloadedRow = useMemo(() => {
    if (!Array.isArray(downloads) || downloads.length === 0) return null;
    const filtered = downloads.filter((d) => {
      if (mediaFilter && d.mediaType !== mediaFilter) return false;
      return true;
    });
    if (filtered.length === 0) return null;

    const groups = new Map();
    filtered.forEach((d) => {
      const seasonNum = Number(d.season) || 0;
      if (seasonNum > 0) {
        const seriesKey = d.imdbId || d.tmdbId || d.infoHash || d.title || d.id;
        const groupKey = `tv_${seriesKey}_s${seasonNum}`;
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey).push(d);
      } else {
        groups.set(`movie_${d.id}`, [d]);
      }
    });

    const items = [];
    groups.forEach((groupEntries, groupKey) => {
      groupEntries.sort((a, b) => (Number(a.episode) || 0) - (Number(b.episode) || 0));
      const d = groupEntries[0];
      const isMultiEp = groupEntries.length > 1 || (Number(d.season) > 0 && Number(d.episode) === 0);
      items.push({
        id: `dl_${groupKey}`,
        tmdbId: d.tmdbId || undefined,
        imdbId: d.imdbId || undefined,
        title: isMultiEp
          ? `${d.title} · S${String(d.season).padStart(2, '0')}`
          : d.season > 0 && d.episode > 0
          ? `${d.title} S${String(d.season).padStart(2, '0')}E${String(d.episode).padStart(2, '0')}`
          : d.title || 'Downloaded Video',
        year: d.year || '',
        mediaType: d.mediaType || 'movie',
        posterUrl: d.posterUrl || null,
        downloadEntry: d,
        downloadEntries: groupEntries,
      });
    });

    return {
      category: {
        id: 'downloaded_offline_row',
        label: 'Downloaded',
        subtitle: `${formatBytes(usedBytes)} of 75 GB used`,
        isDownloadedRail: true,
      },
      items,
    };
  }, [downloads, mediaFilter, usedBytes, formatBytes]);

  const feedRows = useMemo(() => {
    const list = [];
    if (downloadedRow && !whereActive) {
      list.push(downloadedRow);
    }
    list.push(...watchlistRows);
    // If we have movie award ceremony rails
    if (awardCeremonyRows.length > 0) {
      list.push({
        id: 'awards_header_row',
        category: { id: 'awards_header_row' },
        isAwardsHeader: true,
        headerEyebrow: 'GLOBAL CINEMA HONORS',
        items: [],
      });
      awardCeremonyRows.forEach((r) => {
        list.push(r);
      });
    }
    // If we have TV award ceremony rails
    if (tvAwardCeremonyRows.length > 0) {
      list.push({
        id: 'tv_awards_header_row',
        category: { id: 'tv_awards_header_row' },
        isAwardsHeader: true,
        headerEyebrow: 'GLOBAL TELEVISION HONORS',
        items: [],
      });
      tvAwardCeremonyRows.forEach((r) => {
        list.push(r);
      });
    }
    return list;
  }, [downloadedRow, watchlistRows, awardCeremonyRows, tvAwardCeremonyRows, whereActive]);

  // The hero pool: the curated rotating spotlight when unfiltered; the matched
  // library titles themselves when a filter is on (so the hero can never feature
  // something the rails below it just filtered out).
  const heroPool = useMemo(() => {
    if (!isFiltered) return spotlight;
    const seen = new Set();
    const pool = [];
    watchlistRows.forEach((row) =>
      row.items.forEach((item) => {
        const key = watchlistEntryKey(item);
        if (!seen.has(key)) {
          seen.add(key);
          pool.push(item);
        }
      }),
    );
    awardCeremonyRows.forEach((row) =>
      row.items.forEach((item) => {
        const key = watchlistEntryKey(item);
        if (!seen.has(key)) {
          seen.add(key);
          pool.push(item);
        }
      }),
    );
    tvAwardCeremonyRows.forEach((row) =>
      row.items.forEach((item) => {
        const key = watchlistEntryKey(item);
        if (!seen.has(key)) {
          seen.add(key);
          pool.push(item);
        }
      }),
    );
    return sortByRatingDesc(pool).slice(0, FILTERED_HERO_MAX);
  }, [isFiltered, spotlight, watchlistRows, awardCeremonyRows, tvAwardCeremonyRows]);

  const hasHeroItems = heroPool.length > 0;

  // Android back: close any open bottom sheet first, then peel the filter off
  // before leaving Home — first the language, then the availability filter, then
  // the media-type filter.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (bottomSheet?.hasOpenSheet) {
        return bottomSheet.dismissTopSheet();
      }
      if (homeLanguage) {
        setHomeLanguage(null);
        return true;
      }
      if (whereActive) {
        setHomeCountry(null);
        setHomeServiceKey(null);
        return true;
      }
      if (mediaFilter) {
        onMediaFilterChange?.(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [bottomSheet, homeLanguage, whereActive, mediaFilter, onMediaFilterChange]);

  const openLanguageSheet = useCallback(() => {
    Haptics.selectionAsync();
    bottomSheet.show(
      (sheetId) => (
        <WhereToWatchLanguageSheet
          languages={availableLanguages}
          selectedCode={homeLanguage?.code || null}
          totalCount={totalLibraryTitlesCount}
          onSelect={(lang) => {
            setHomeLanguage(
              lang?.code
                ? {
                    code: lang.code,
                    label: resolveLanguageLabel(lang.code) || lang.label,
                  }
                : null,
            );
            bottomSheet.dismiss(sheetId);
          }}
        />
      ),
      {
        title: 'Original language',
        centerTitle: true,
        showCloseButton: false,
        size: 'large',
        scrollable: true,
      },
    );
  }, [bottomSheet, availableLanguages, homeLanguage, totalLibraryTitlesCount]);

  const openCountrySheet = useCallback(() => {
    Haptics.selectionAsync();
    bottomSheet.show(
      (sheetId) => (
        <WhereToWatchCountrySheet
          selectedCode={homeCountry?.code || null}
          allowAll
          onSelect={(region) => {
            setHomeCountry(region?.code ? { code: region.code, label: region.label } : null);
            bottomSheet.dismiss(sheetId);
          }}
        />
      ),
      {
        title: 'Streaming region',
        centerTitle: true,
        showCloseButton: false,
        size: 'large',
        scrollable: true,
      },
    );
  }, [bottomSheet, homeCountry]);

  const openServiceSheet = useCallback(() => {
    Haptics.selectionAsync();
    bottomSheet.show(
      (sheetId) => (
        <WhereToWatchServiceSheet
          selectedKey={homeServiceKey}
          onSelect={(serviceKey) => {
            setHomeServiceKey(serviceKey);
            bottomSheet.dismiss(sheetId);
            // Nudge: a service without a country answers "on X somewhere", which
            // is rarely what's meant. Steer straight into picking a country.
            if (serviceKey && !homeCountry?.code) {
              setTimeout(openCountrySheet, 220);
            }
          }}
        />
      ),
      {
        title: 'Streaming service',
        centerTitle: true,
        showCloseButton: false,
        size: 'large',
        scrollable: true,
      },
    );
  }, [bottomSheet, homeServiceKey, homeCountry, openCountrySheet]);

  const [ambientA, setAmbientA] = useState(GOLD_ACCENT);
  const [ambientB, setAmbientB] = useState(GOLD_ACCENT);
  const ambientFade = useRef(new Animated.Value(0)).current;
  const currentAmbientRef = useRef(GOLD_ACCENT);

  const handleHeroColorChange = useCallback(
    (newHex) => {
      if (!newHex || newHex === currentAmbientRef.current) return;
      setAmbientB(newHex);
      ambientFade.setValue(0);
      Animated.timing(ambientFade, {
        toValue: 1,
        duration: 700,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          currentAmbientRef.current = newHex;
          setAmbientA(newHex);
          ambientFade.setValue(0);
        }
      });
    },
    [ambientFade],
  );

  const openDownloadedItemSheet = useCallback(
    (railItem) => {
      const dl = railItem?.downloadEntry;
      const entries =
        Array.isArray(railItem?.downloadEntries) && railItem.downloadEntries.length > 0
          ? railItem.downloadEntries
          : dl
          ? [dl]
          : [];
      if (!dl || entries.length === 0) {
        onSelectItem?.(railItem);
        return;
      }
      Haptics.selectionAsync();
      const isMultiEpisode = entries.length > 1;

      bottomSheet.show(
        (sheetId) => {
          if (isMultiEpisode) {
            const completedEps = entries.filter((e) => e.state === 'completed');
            const activeEps = entries.filter(
              (e) => e.state === 'downloading' || e.state === 'resolving',
            );
            const pausedEps = entries.filter((e) => e.state === 'paused' || e.state === 'error');
            const totalBytes = entries.reduce((sum, e) => sum + (e.totalBytes || 0), 0);
            const completedBytes = entries.reduce((sum, e) => sum + (e.completedBytes || 0), 0);
            const speedBps = entries.reduce((sum, e) => sum + (e.speedBps || 0), 0);
            const pct = totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 0;

            return (
              <View style={styles.downloadedSheetWrap}>
                <View style={styles.downloadedSheetHeader}>
                  <MediaArtwork
                    uri={dl.posterUrl}
                    style={styles.downloadedSheetPoster}
                    accessibilityLabel={`${railItem.title} poster`}
                    title={railItem.title}
                    instant
                  />
                  <View style={styles.downloadedSheetMetaCol}>
                    <Text
                      style={[
                        styles.downloadedSheetTitle,
                        { color: colors.onSurface, ...typography.titleMd },
                      ]}
                      numberOfLines={2}
                    >
                      {`${dl.title} · Season ${dl.season}`}
                    </Text>
                    <Text
                      style={[
                        styles.downloadedSheetSub,
                        { color: colors.onSurfaceVariant, ...typography.labelSm },
                      ]}
                      numberOfLines={1}
                    >
                      {`${entries.length} episodes in pack`}
                    </Text>
                    <Text
                      style={[
                        styles.downloadedSheetSub,
                        { color: GOLD_ACCENT, ...typography.labelSm },
                      ]}
                    >
                      {completedEps.length === entries.length
                        ? `${entries.length} episodes · ${formatBytes(
                            totalBytes || completedBytes,
                          )} · Ready offline`
                        : activeEps.length > 0
                        ? `Downloading ${completedEps.length}/${entries.length} episodes (${pct}%) · ${formatBytes(
                            completedBytes,
                          )}${totalBytes > 0 ? ` / ${formatBytes(totalBytes)}` : ''}${
                            speedBps > 0 ? ` · ${formatSpeed(speedBps)}` : ''
                          }`
                        : `Paused (${completedEps.length}/${entries.length} episodes ready) · ${formatBytes(
                            completedBytes,
                          )}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.downloadedSheetActions}>
                  {activeEps.length > 0 && dl.infoHash && (
                    <TouchableOpacity
                      style={styles.downloadedActionBtn}
                      onPress={() => {
                        Haptics.selectionAsync();
                        pauseByInfoHash(dl.infoHash);
                        bottomSheet.dismiss(sheetId);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.downloadedSecondaryText,
                          { color: colors.onSurface, ...typography.labelMd },
                        ]}
                      >
                        Pause All
                      </Text>
                    </TouchableOpacity>
                  )}

                  {activeEps.length === 0 && pausedEps.length > 0 && dl.infoHash && (
                    <TouchableOpacity
                      style={styles.downloadedActionBtn}
                      onPress={() => {
                        Haptics.selectionAsync();
                        resumeByInfoHash(dl.infoHash, railItem.title);
                        bottomSheet.dismiss(sheetId);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.downloadedPrimaryText,
                          { color: GOLD_ACCENT, ...typography.labelMd },
                        ]}
                      >
                        Resume All
                      </Text>
                    </TouchableOpacity>
                  )}

                  {dl.infoHash && (
                    <TouchableOpacity
                      style={styles.downloadedActionBtn}
                      onPress={() => {
                        Haptics.selectionAsync();
                        deleteByInfoHash(dl.infoHash);
                        bottomSheet.dismiss(sheetId);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.downloadedSecondaryText,
                          { color: colors.onSurfaceVariant, ...typography.labelMd },
                        ]}
                      >
                        Delete Season Pack
                      </Text>
                    </TouchableOpacity>
                  )}

                  {(dl.tmdbId || dl.imdbId) && (
                    <TouchableOpacity
                      style={styles.downloadedActionBtn}
                      onPress={() => {
                        Haptics.selectionAsync();
                        bottomSheet.dismiss(sheetId);
                        onSelectItem?.({
                          id: dl.tmdbId || dl.imdbId,
                          tmdbId: dl.tmdbId || undefined,
                          imdbId: dl.imdbId || undefined,
                          title: dl.title,
                          year: dl.year,
                          mediaType: dl.mediaType || 'tv',
                          posterUrl: dl.posterUrl,
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.downloadedSecondaryText,
                          { color: colors.onSurface, ...typography.labelMd },
                        ]}
                      >
                        Open Title Page
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.downloadedEpisodesList}>
                  {entries.map((epItem) => {
                    const epDone = epItem.state === 'completed';
                    const epActive =
                      epItem.state === 'downloading' || epItem.state === 'resolving';
                    const epPaused = epItem.state === 'paused' || epItem.state === 'error';
                    const epLabel = `Episode ${String(epItem.episode || 1).padStart(2, '0')}${
                      epItem.episodeTitle ? ` · ${epItem.episodeTitle}` : ''
                    }`;

                    return (
                      <View key={epItem.id} style={styles.downloadedEpisodeRow}>
                        <Text
                          style={[
                            styles.downloadedEpisodeTitle,
                            { color: colors.onSurface, ...typography.labelMd },
                          ]}
                          numberOfLines={1}
                        >
                          {epLabel}
                        </Text>
                        <Text
                          style={[
                            styles.downloadedSheetSub,
                            {
                              color: epDone ? GOLD_ACCENT : colors.onSurfaceVariant,
                              ...typography.labelSm,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {epDone
                            ? `${formatBytes(
                                epItem.totalBytes || epItem.completedBytes,
                              )} · Ready offline`
                            : epActive
                            ? `Downloading ${Math.round(
                                (epItem.progress || 0) * 100,
                              )}% · ${formatBytes(epItem.completedBytes)}${
                                epItem.totalBytes > 0
                                  ? ` / ${formatBytes(epItem.totalBytes)}`
                                  : ''
                              }`
                            : `Paused at ${Math.round((epItem.progress || 0) * 100)}%`}
                        </Text>
                        <View style={styles.downloadedSheetActions}>
                          {(epDone || epItem.completedBytes > 0) && (
                            <TouchableOpacity
                              style={styles.downloadedActionBtn}
                              onPress={() => {
                                Haptics.selectionAsync();
                                bottomSheet.dismiss(sheetId);
                                playDownloaded(epItem);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.downloadedPrimaryText,
                                  { color: GOLD_ACCENT, ...typography.labelSm },
                                ]}
                              >
                                {epDone ? 'Play Downloaded' : 'Play Now'}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {epPaused && (
                            <TouchableOpacity
                              style={styles.downloadedActionBtn}
                              onPress={() => {
                                Haptics.selectionAsync();
                                resumeDownload(epItem.id, epLabel);
                                bottomSheet.dismiss(sheetId);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.downloadedPrimaryText,
                                  { color: GOLD_ACCENT, ...typography.labelSm },
                                ]}
                              >
                                Resume
                              </Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={styles.downloadedActionBtn}
                            onPress={() => {
                              Haptics.selectionAsync();
                              deleteDownload(epItem.id);
                              bottomSheet.dismiss(sheetId);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.downloadedSecondaryText,
                                { color: colors.onSurfaceVariant, ...typography.labelSm },
                              ]}
                            >
                              Delete
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          }

          const isCompleted = dl.state === 'completed';
          const isActive = dl.state === 'downloading' || dl.state === 'resolving';
          const isPaused = dl.state === 'paused' || dl.state === 'error';

          return (
            <View style={styles.downloadedSheetWrap}>
              <View style={styles.downloadedSheetHeader}>
                <MediaArtwork
                  uri={dl.posterUrl}
                  style={styles.downloadedSheetPoster}
                  accessibilityLabel={`${railItem.title} poster`}
                  title={railItem.title}
                  instant
                />
                <View style={styles.downloadedSheetMetaCol}>
                  <Text
                    style={[styles.downloadedSheetTitle, { color: colors.onSurface, ...typography.titleMd }]}
                    numberOfLines={2}
                  >
                    {railItem.title}
                  </Text>
                  {dl.episodeTitle ? (
                    <Text
                      style={[styles.downloadedSheetSub, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
                      numberOfLines={1}
                    >
                      {dl.episodeTitle}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.downloadedSheetSub, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
                    numberOfLines={2}
                  >
                    {dl.releaseName || railItem.title}
                  </Text>
                  <Text
                    style={[styles.downloadedSheetSub, { color: GOLD_ACCENT, ...typography.labelSm }]}
                  >
                    {isCompleted
                      ? `${formatBytes(dl.totalBytes || dl.completedBytes)} · Ready offline`
                      : isActive
                      ? `Downloading ${Math.round((dl.progress || 0) * 100)}% · ${formatBytes(
                          dl.completedBytes,
                        )}${dl.totalBytes > 0 ? ` / ${formatBytes(dl.totalBytes)}` : ''}${
                          dl.speedBps > 0 ? ` · ${formatSpeed(dl.speedBps)}` : ''
                        }`
                      : `Paused at ${Math.round((dl.progress || 0) * 100)}% · ${formatBytes(
                          dl.completedBytes,
                        )}`}
                  </Text>
                </View>
              </View>

              <View style={styles.downloadedSheetActions}>
                {(isCompleted || dl.completedBytes > 0) && (
                  <TouchableOpacity
                    style={styles.downloadedActionBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      bottomSheet.dismiss(sheetId);
                      playDownloaded(dl);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.downloadedPrimaryText, { color: GOLD_ACCENT, ...typography.labelMd }]}>
                      {isCompleted ? 'Play Downloaded' : 'Play Now'}
                    </Text>
                  </TouchableOpacity>
                )}

                {isActive && (
                  <TouchableOpacity
                    style={styles.downloadedActionBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      pauseDownload(dl.id);
                      bottomSheet.dismiss(sheetId);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.downloadedSecondaryText, { color: colors.onSurface, ...typography.labelMd }]}>
                      Pause
                    </Text>
                  </TouchableOpacity>
                )}

                {isPaused && (
                  <TouchableOpacity
                    style={styles.downloadedActionBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      resumeDownload(dl.id, railItem.title);
                      bottomSheet.dismiss(sheetId);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.downloadedPrimaryText, { color: GOLD_ACCENT, ...typography.labelMd }]}>
                      Resume
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.downloadedActionBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    deleteDownload(dl.id);
                    bottomSheet.dismiss(sheetId);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.downloadedSecondaryText,
                      { color: colors.onSurfaceVariant, ...typography.labelMd },
                    ]}
                  >
                    {isCompleted ? 'Delete Download' : 'Cancel Download'}
                  </Text>
                </TouchableOpacity>

                {(dl.tmdbId || dl.imdbId) && (
                  <TouchableOpacity
                    style={styles.downloadedActionBtn}
                    onPress={() => {
                      Haptics.selectionAsync();
                      bottomSheet.dismiss(sheetId);
                      onSelectItem?.({
                        id: dl.tmdbId || dl.imdbId,
                        tmdbId: dl.tmdbId || undefined,
                        imdbId: dl.imdbId || undefined,
                        title: dl.title,
                        year: dl.year,
                        mediaType: dl.mediaType || 'movie',
                        posterUrl: dl.posterUrl,
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.downloadedSecondaryText, { color: colors.onSurface, ...typography.labelMd }]}>
                      Open Title Page
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        },
        {
          title: 'Downloaded on Device',
          centerTitle: true,
          showCloseButton: false,
          size: isMultiEpisode ? 'large' : 'medium',
          scrollable: isMultiEpisode,
        },
      );
    },
    [
      bottomSheet,
      colors,
      typography,
      formatBytes,
      formatSpeed,
      playDownloaded,
      pauseDownload,
      pauseByInfoHash,
      resumeDownload,
      resumeByInfoHash,
      deleteDownload,
      deleteByInfoHash,
      onSelectItem,
    ],
  );

  const renderRail = useCallback(
    ({ item }) => {
      if (item.isAwardsHeader) {
        return (
          <View style={styles.awardsHeaderSection}>
            <ProgrammeSectionHeader
              eyebrow={item.headerEyebrow || 'GLOBAL CINEMA HONORS'}
              align="left"
              style={styles.awardsProgrammeHeader}
            />
          </View>
        );
      }

      const { category, items } = item;
      const isFirstAwardRail =
        category.isAwardCeremony &&
        (awardCeremonyRows[0]?.category?.id === category.id ||
          tvAwardCeremonyRows[0]?.category?.id === category.id);
      const subtitle =
        category.subtitle ||
        (category.awardName
          ? `${category.awardName}${category.country ? ` · ${category.country}` : ''}`
          : null);

      const isSortable = !category.isDownloadedRail;
      const sortId = category.ceremonyId || category.id;

      return (
        <ContentRail
          title={category.fullName || category.label}
          subtitle={subtitle}
          data={items}
          colors={colors}
          typography={typography}
          radii={radii}
          showMediaType={false}
          showCaption={false}
          showHairline={false}
          titleCase
          style={isFirstAwardRail ? styles.firstAwardRail : undefined}
          onPress={isSortable ? () => handleToggleRailSort(sortId) : undefined}
          onSelectItem={category.isDownloadedRail ? openDownloadedItemSheet : onSelectItem}
          getItemRankBadge={
            category.isAwardCeremony
              ? (film) => film.awardYear || null
              : category.isDownloadedRail
              ? (film) => {
                  const entries = film.downloadEntries;
                  if (Array.isArray(entries) && entries.length > 1) {
                    const done = entries.filter((e) => e.state === 'completed').length;
                    if (done === entries.length) return `${entries.length} Eps`;
                    return `${done}/${entries.length} Eps`;
                  }
                  const dl = film.downloadEntry;
                  if (!dl) return null;
                  if (dl.state === 'completed') return 'Ready';
                  return `${Math.round((dl.progress || 0) * 100)}%`;
                }
              : undefined
          }
        />
      );
    },
    [
      colors,
      typography,
      radii,
      onSelectItem,
      onOpenCollections,
      openDownloadedItemSheet,
      handleToggleRailSort,
      awardCeremonyRows,
      tvAwardCeremonyRows,
    ],
  );

  const railKeyExtractor = useCallback((item) => item.category?.id || item.id, []);

  const filterParts = [];
  if (homeLanguage?.label) {
    const langLabel = resolveLanguageLabel(homeLanguage.code) || homeLanguage.label;
    filterParts.push(`in ${langLabel}`);
  }
  if (homeServiceKey) {
    filterParts.push(
      `on ${getServiceLabel(homeServiceKey)}${homeCountry?.code ? ` in ${homeCountry.label}` : ''}`,
    );
  } else if (homeCountry?.code) {
    filterParts.push(`in ${homeCountry.label}`);
  }
  const filterContext = filterParts.join(' ');

  // While a filter is crawling, show skeleton only if no cached matches exist yet.
  // As soon as matches are available, the feed renders immediately and updates smoothly.
  const isWhereInitialCrawl = whereChecking && !whereMatches?.keys?.size;
  const showFeedSkeleton = isWhereInitialCrawl || (!hasHeroItems && !isFiltered);
  const listHeader = (
    <View
      style={styles.spotlightSection}
      accessibilityRole="region"
      accessibilityLabel="Spotlight titles"
    >
      {showFeedSkeleton ? (
        <View style={styles.skeletonWrap}>
          <HomeFeedSkeleton />
        </View>
      ) : hasHeroItems ? (
        <CinematicCardDeck
          items={heroPool}
          onSelectItem={onSelectItem}
          onActiveColorChange={handleHeroColorChange}
        />
      ) : null}
    </View>
  );

  const renderWhereEmpty = () => {
    if (!isFiltered || whereChecking) return null;
    return (
      <View
        style={[
          styles.whereEmptyBox,
          { backgroundColor: colors.glass, borderColor: GOLD_DIM, borderRadius: radii.lg },
        ]}
      >
        <Ionicons
          name={homeLanguage && !whereActive ? 'language-outline' : 'eye-off-outline'}
          size={22}
          color={GOLD_ACCENT}
        />
        <Text style={[styles.whereEmptyTitle, { color: colors.onSurface, ...typography.titleMd }]}>
          {homeLanguage && !whereActive ? 'No titles in this language' : 'Nothing to stream yet'}
        </Text>
        <Text style={[styles.whereEmptyText, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
          None of your {scopeCount || totalLibraryTitlesCount} saved titles match your current filters{filterContext ? ` (${filterContext})` : ''}. Try another language or streaming filter.
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.rootWrap, { backgroundColor: colors.background }]}>
      <View style={styles.atmosphereContainer} pointerEvents="none">
        <LinearGradient
          colors={makeAtmosphereGradient(ambientA)}
          style={styles.atmosphereLayer}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <Animated.View style={[styles.atmosphereLayer, { opacity: ambientFade }]}>
          <LinearGradient
            colors={makeAtmosphereGradient(ambientB)}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>
      </View>

      <HomeFilterBar
        headerScrolled={headerScrolled}
        mediaFilter={mediaFilter}
        onMediaFilterChange={onMediaFilterChange}
        onOpenCollections={onOpenCollections}
        language={homeLanguage}
        onOpenLanguage={openLanguageSheet}
        country={homeCountry}
        serviceKey={homeServiceKey}
        serviceLogoUrl={serviceLogoUrl}
        onOpenCountry={openCountrySheet}
        onOpenService={openServiceSheet}
      />

      <FlatList
        style={styles.scroll}
        data={isWhereInitialCrawl ? [] : feedRows}
        renderItem={renderRail}
        keyExtractor={railKeyExtractor}
        extraData={theme}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderWhereEmpty}
        contentContainerStyle={[
          styles.scrollInner,
          { paddingTop: headerOffset, paddingBottom: insets.bottom + 112 },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        nestedScrollEnabled
        overScrollMode="never"
        decelerationRate="normal"
        {...bottomNavScroll}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrap: { flex: 1 },
  atmosphereContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: verticalScale(560),
    overflow: 'hidden',
  },
  atmosphereLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  scroll: { flex: 1 },
  scrollInner: {},

  spotlightSection: {
    paddingHorizontal: 0,
    marginBottom: scale(18),
  },
  awardsHeaderSection: {
    paddingHorizontal: GRID_PAD,
    marginTop: scale(28),
    marginBottom: 0,
  },
  awardsProgrammeHeader: {
    marginBottom: 0,
  },
  firstAwardRail: {
    marginTop: scale(8),
  },
  skeletonWrap: {
    paddingHorizontal: GRID_PAD,
  },

  whereEmptyBox: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    marginHorizontal: GRID_PAD,
    marginTop: scale(24),
    padding: scale(20),
  },
  whereEmptyTitle: {
    fontWeight: '800',
  },
  whereEmptyText: {
    textAlign: 'center',
  },
  downloadedSheetWrap: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    gap: 16,
    paddingBottom: 16,
  },
  downloadedSheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  downloadedSheetPoster: {
    borderRadius: 8,
    height: 96,
    width: 64,
  },
  downloadedSheetMetaCol: {
    flex: 1,
    gap: 4,
  },
  downloadedSheetTitle: {
    fontWeight: '700',
  },
  downloadedSheetSub: {
    fontWeight: '500',
  },
  downloadedSheetActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  downloadedActionBtn: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 6,
  },
  downloadedPrimaryText: {
    fontWeight: '700',
  },
  downloadedSecondaryText: {
    fontWeight: '700',
  },
  downloadedEpisodesList: {
    gap: 14,
    marginTop: 4,
  },
  downloadedEpisodeRow: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    gap: 4,
    paddingVertical: 4,
  },
  downloadedEpisodeTitle: {
    fontWeight: '700',
  },
});
