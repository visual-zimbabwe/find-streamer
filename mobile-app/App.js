import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Alert, Keyboard, BackHandler, Modal, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeProvider } from './src/theme/ThemeProvider';
import { AppHeader } from './src/components/AppHeader';
import { BottomNav } from './src/components/BottomNav';
import { SearchPanel } from './src/components/SearchPanel';
import { MatchResults } from './src/components/MatchResults';
import { ResultView } from './src/components/ResultView';
import { SettingsView } from './src/components/SettingsView';
import { WatchlistView } from './src/components/WatchlistView';
import { DiscoverScreen } from './src/components/DiscoverScreen';
import { FilmographyScreen } from './src/components/FilmographyScreen';
import { StatePanel } from './src/components/StatePanel';
import { searchTitleCandidates, resolveMatch, fetchPersonFilmography } from './src/lib/tmdb';
import { useDiscoverViewModel } from './src/lib/discoverViewModel';
import { loadRecentSearches, saveRecentSearches, loadWatchlist, saveWatchlist } from './src/lib/storage';
import { WATCHLIST_CATEGORIES, getWatchlistCategory } from './src/lib/watchlistCategories';

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <MobileApp />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function MobileApp() {
  const { theme, resolvedMode } = useTheme();
  const { colors, typography, radii } = theme;

  // View state: 'search' | 'results' | 'detail' | 'watchlist' | 'settings' | 'discover'
  const [activeView, setActiveView] = useState('search');
  // Tab state: 'search' | 'discover' | 'watchlist'
  const [activeTab, setActiveTab] = useState('search');
  // Tracks which view to return to after closing 'detail'
  const [detailOrigin, setDetailOrigin] = useState('results');
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [pendingWatchlistItem, setPendingWatchlistItem] = useState(null); // { ...item, _isReCategorize: bool }
  const [filter, setFilter] = useState(null); // 'movie' | 'tv' | null
  const [filmographyPerson, setFilmographyPerson] = useState(null); // { id, name, role }
  const [filmographyResults, setFilmographyResults] = useState([]);
  const [filmographyLoading, setFilmographyLoading] = useState(false);
  const [filmographyOrigin, setFilmographyOrigin] = useState('detail'); // 'detail' | 'search'
  const discoverVm = useDiscoverViewModel();

  const handleBack = useCallback(() => {
    // If an error is showing, dismiss it and return to search
    if (error) {
      setError(null);
      setActiveView('search');
      return;
    }
    if (activeView === 'settings') {
      setActiveView(activeTab === 'watchlist' ? 'watchlist' : activeTab === 'discover' ? 'discover' : 'search');
    } else if (activeView === 'filmography') {
      setActiveView(filmographyOrigin === 'search' ? 'search' : 'detail');
    } else if (activeView === 'detail') {
      // Return to wherever the user came from
      if (detailOrigin === 'filmography') {
        setActiveView('filmography');
      } else if (detailOrigin === 'discover') {
        setActiveView('discover');
        setActiveTab('discover');
      } else if (detailOrigin === 'watchlist') {
        setActiveView('watchlist');
      } else {
        setActiveView('results');
      }
    } else if (activeView === 'results') {
      setActiveView('search');
      setQuery('');
    } else if (activeTab === 'watchlist') {
      setActiveTab('search');
      setActiveView('search');
    } else if (activeTab === 'discover') {
      setActiveTab('search');
      setActiveView('search');
    }
  }, [error, activeView, activeTab, detailOrigin, filmographyOrigin]);

  // Handle hardware back button
  useEffect(() => {
    const onBackPress = () => {
      // If we are at the root with no error, allow app to close
      if (activeView === 'search' && activeTab === 'search' && !error) {
        return false;
      }
      
      // Otherwise, handle it within our navigation
      handleBack();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [activeView, activeTab, error, handleBack]);

  // Initialization
  useEffect(() => {
    async function init() {
      const [history, saved] = await Promise.all([
        loadRecentSearches(),
        loadWatchlist()
      ]);
      setRecentSearches(history);
      setWatchlist(saved);
    }
    init();
  }, []);

  const handleSearch = useCallback(async (searchQuery = query) => {
    if (!searchQuery.trim()) return;
    
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setQuery(searchQuery);

    try {
      const candidates = await searchTitleCandidates(searchQuery);

      // If TMDB's top hit is a person (e.g. "Tom Hanks"), skip the results list
      // and go straight to their filmography.
      if (candidates.isPerson) {
        setLoading(false);
        const newHistory = [searchQuery, ...recentSearches.filter(q => q !== searchQuery)].slice(0, 3);
        setRecentSearches(newHistory);
        await saveRecentSearches(newHistory);
        handlePersonPress(candidates.personId, candidates.personName, candidates.role, 'search');
        return;
      }

      setResults(candidates);
      setActiveView('results');
      setActiveTab('search');
      setFilter(null); // Reset filter on new search
      
      // Update history
      const newHistory = [searchQuery, ...recentSearches.filter(q => q !== searchQuery)].slice(0, 3);
      setRecentSearches(newHistory);
      await saveRecentSearches(newHistory);
    } catch (err) {
      setError(err.message);
      setActiveView('search');
    } finally {
      setLoading(false);
    }
  }, [query, recentSearches, handlePersonPress]);

  const handleSelectMatch = useCallback(async (match) => {
    setLoading(true);
    setDetailOrigin(activeTab === 'watchlist' ? 'watchlist' : 'results');
    try {
      const fullResult = await resolveMatch(query, match);
      setSelectedResult(fullResult);
      setActiveView('detail');
    } catch (err) {
      Alert.alert('Error', 'Unable to fetch movie details.');
    } finally {
      setLoading(false);
    }
  }, [query, activeTab]);

  // Called when a card in DiscoverScreen is tapped
  const handleSelectDiscoverItem = useCallback(async (item) => {
    setLoading(true);
    setDetailOrigin('discover');
    try {
      // Pass empty string as query — detail screen uses item.title as fallback
      const fullResult = await resolveMatch(item.title, item);
      setSelectedResult(fullResult);
      setActiveView('detail');
    } catch (err) {
      Alert.alert('Error', 'Unable to fetch details.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePersonPress = useCallback(async (personId, personName, role, origin = 'detail') => {
    setFilmographyOrigin(origin);
    setFilmographyLoading(true);
    setFilmographyPerson({ id: personId, name: personName, role, profileUrl: null });
    setFilmographyResults([]);
    setActiveView('filmography');
    try {
      const { results, profileUrl } = await fetchPersonFilmography(personId, personName, role);
      setFilmographyResults(results);
      setFilmographyPerson(prev => ({ ...prev, profileUrl }));
    } catch (err) {
      Alert.alert('Error', 'Unable to fetch filmography.');
    } finally {
      setFilmographyLoading(false);
    }
  }, []);

  const handleSelectFilmographyItem = useCallback(async (item) => {
    setLoading(true);
    setDetailOrigin('filmography');
    try {
      const fullResult = await resolveMatch(item.title, item);
      setSelectedResult(fullResult);
      setActiveView('detail');
    } catch (err) {
      Alert.alert('Error', 'Unable to fetch details.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleWatchlist = async (result) => {
    const existingItem = watchlist.find(item => item.tmdbId === result.tmdbId);
    if (existingItem) {
      // Open the modal showing the current category so the user can move or remove
      setPendingWatchlistItem({ ...existingItem, _isReCategorize: true });
      return;
    }

    setPendingWatchlistItem({ ...result, _isReCategorize: false });
  };

  const handleSelectWatchlistCategory = async (categoryId) => {
    if (!pendingWatchlistItem) return;

    const isReCategorize = pendingWatchlistItem._isReCategorize;
    const { _isReCategorize, ...itemData } = pendingWatchlistItem;

    const updatedItem = {
      ...itemData,
      watchlistCategoryId: categoryId,
      watchlistCategoryLabel: getWatchlistCategory(categoryId).label,
    };

    let newWatchlist;
    if (isReCategorize) {
      // Update in-place, preserving original position
      newWatchlist = watchlist.map(item =>
        item.tmdbId === updatedItem.tmdbId ? updatedItem : item
      );
    } else {
      newWatchlist = [
        updatedItem,
        ...watchlist.filter(item => item.tmdbId !== updatedItem.tmdbId),
      ];
    }

    setPendingWatchlistItem(null);
    setWatchlist(newWatchlist);
    await saveWatchlist(newWatchlist);
  };

  const handleRemoveFromWatchlist = async () => {
    if (!pendingWatchlistItem) return;
    const newWatchlist = watchlist.filter(item => item.tmdbId !== pendingWatchlistItem.tmdbId);
    setPendingWatchlistItem(null);
    setWatchlist(newWatchlist);
    await saveWatchlist(newWatchlist);
  };

  const handleTabPress = (tab) => {
    setActiveTab(tab);
    if (tab === 'search') {
      setActiveView('search');
    } else if (tab === 'discover') {
      setActiveView('discover');
    } else if (tab === 'watchlist') {
      setActiveView('watchlist');
    }
  };

  const filteredResults = useMemo(() => {
    if (!filter) return results;
    return results.filter(item => item.mediaType === filter);
  }, [results, filter]);

  const showBack = activeView === 'results' || activeView === 'detail' || activeView === 'settings' || activeView === 'filmography';
  const showLoading = loading && activeView !== 'detail' && activeView !== 'discover';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
      <AppHeader 
        showBack={showBack} 
        onBack={handleBack} 
        onSettingsPress={() => setActiveView('settings')}
      />
      
      <View style={styles.mainContent}>
        {showLoading ? (
          <StatePanel type="loading" title="Searching..." description="Please wait while we find your movie." />
        ) : error ? (
          <StatePanel type="error" title="Search Error" description={error} onRetry={() => handleSearch(query)} />
        ) : (
          <>
            {activeView === 'search' && (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
                <SearchPanel 
                  value={query} 
                  onChangeText={setQuery} 
                  onSubmit={() => handleSearch()} 
                  loading={loading}
                  recentSearches={recentSearches}
                  onPickSuggestion={handleSearch}
                  filter={filter}
                  onFilterChange={setFilter}
                />
              </ScrollView>
            )}
            
            {activeView === 'results' && (
              <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <SearchPanel 
                  value={query} 
                  onChangeText={setQuery} 
                  onSubmit={() => handleSearch()} 
                  loading={loading}
                  hideHistory={true}
                  hideHero={true}
                  filter={filter}
                  onFilterChange={setFilter}
                />
                <MatchResults 
                  matches={filteredResults} 
                  onSelect={handleSelectMatch} 
                  onToggleWatchlist={handleToggleWatchlist}
                  watchlistIds={watchlist.map(item => item.tmdbId)}
                />
              </ScrollView>
            )}
            
            {activeView === 'detail' && (
              <ResultView 
                result={selectedResult} 
                onBack={handleBack} 
                onToggleWatchlist={handleToggleWatchlist}
                isInWatchlist={watchlist.some(item => item.tmdbId === selectedResult?.tmdbId)}
                onSelectSimilar={handleSelectMatch}
                onPersonPress={handlePersonPress}
              />
            )}
            
            {activeView === 'watchlist' && (
              <WatchlistView 
                items={watchlist} 
                onRemove={(id) => handleToggleWatchlist({ tmdbId: id })}
                onSelect={handleSelectMatch}
              />
            )}

            {activeView === 'discover' && (
              <DiscoverScreen onSelectItem={handleSelectDiscoverItem} vm={discoverVm} />
            )}

            {activeView === 'filmography' && filmographyPerson && (
              <FilmographyScreen
                personName={filmographyPerson.name}
                role={filmographyPerson.role}
                profileUrl={filmographyPerson.profileUrl}
                results={filmographyResults}
                onSelectItem={handleSelectFilmographyItem}
                loading={filmographyLoading}
              />
            )}

            {activeView === 'settings' && (
              <SettingsView />
            )}
          </>
        )}
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={Boolean(pendingWatchlistItem)}
        onRequestClose={() => setPendingWatchlistItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.categorySheet, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant + '4D', borderRadius: radii.xl }]}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryTitleBlock}>
                <Text style={[styles.categoryEyebrow, { color: colors.primary, ...typography.labelSm }]}>
                  {pendingWatchlistItem?._isReCategorize ? 'MOVE TO CATEGORY' : 'SAVE TO WATCHLIST'}
                </Text>
                <Text style={[styles.categoryTitle, { color: colors.onSurface, ...typography.titleLg }]} numberOfLines={2}>
                  {pendingWatchlistItem?.title}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.surfaceContainerHighest }]}
                onPress={() => setPendingWatchlistItem(null)}
                accessibilityRole="button"
                accessibilityLabel="Close watchlist category picker"
              >
                <Ionicons name="close" size={20} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={styles.categoryList}>
              {WATCHLIST_CATEGORIES.map((category) => {
                const isCurrent = pendingWatchlistItem?._isReCategorize &&
                  pendingWatchlistItem?.watchlistCategoryId === category.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryOption,
                      {
                        backgroundColor: isCurrent ? colors.primary + '1A' : colors.surfaceContainerHigh,
                        borderColor: isCurrent ? colors.primary + '66' : colors.outlineVariant + '33',
                        borderRadius: radii.lg,
                      },
                    ]}
                    activeOpacity={0.82}
                    onPress={() => handleSelectWatchlistCategory(category.id)}
                    accessibilityRole="button"
                    accessibilityLabel={isCurrent ? `Currently in ${category.label}` : `Move to ${category.label}`}
                    accessibilityState={{ selected: isCurrent }}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: isCurrent ? colors.primary + '33' : colors.primary + '22' }]}>
                      <Ionicons name={category.icon} size={22} color={colors.primary} />
                    </View>
                    <View style={styles.categoryCopy}>
                      <View style={styles.categoryLabelRow}>
                        <Text style={[styles.categoryOptionTitle, { color: isCurrent ? colors.primary : colors.onSurface, ...typography.bodyLg }]}>
                          {category.label}
                        </Text>
                        {isCurrent && (
                          <View style={[styles.currentBadge, { backgroundColor: colors.primary + '22' }]}>
                            <Text style={[styles.currentBadgeText, { color: colors.primary, ...typography.labelSm }]}>CURRENT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.categoryOptionDescription, { color: colors.onSurfaceVariant, ...typography.bodyMd }]} numberOfLines={2}>
                        {category.description}
                      </Text>
                    </View>
                    <Ionicons name={isCurrent ? 'checkmark-circle' : 'chevron-forward'} size={18} color={isCurrent ? colors.primary : colors.onSurfaceVariant} />
                  </TouchableOpacity>
                );
              })}

              {pendingWatchlistItem?._isReCategorize && (
                <TouchableOpacity
                  style={[styles.removeOption, { backgroundColor: colors.error + '12', borderColor: colors.error + '33', borderRadius: radii.lg }]}
                  activeOpacity={0.82}
                  onPress={handleRemoveFromWatchlist}
                  accessibilityRole="button"
                  accessibilityLabel="Remove from watchlist"
                >
                  <View style={[styles.categoryIcon, { backgroundColor: colors.error + '22' }]}>
                    <Ionicons name="trash-outline" size={22} color={colors.error} />
                  </View>
                  <View style={styles.categoryCopy}>
                    <Text style={[styles.categoryOptionTitle, { color: colors.error, ...typography.bodyLg }]}>Remove from Watchlist</Text>
                    <Text style={[styles.categoryOptionDescription, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}>
                      Permanently remove this title.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav activeTab={activeTab} onTabPress={handleTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Account for BottomNav
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  categorySheet: {
    borderWidth: 1,
    margin: 16,
    padding: 20,
  },
  categoryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  categoryTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  categoryEyebrow: {
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  categoryTitle: {
    fontWeight: '900',
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  categoryList: {
    gap: 10,
  },
  categoryOption: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  categoryIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  categoryCopy: {
    flex: 1,
    minWidth: 0,
  },
  categoryOptionTitle: {
    fontWeight: '800',
  },
  categoryOptionDescription: {
    lineHeight: 18,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  currentBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  currentBadgeText: {
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  removeOption: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    padding: 14,
  },
});
