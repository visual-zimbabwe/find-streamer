import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Alert, Keyboard } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, ThemeProvider } from './src/theme/ThemeProvider';
import { AppHeader } from './src/components/AppHeader';
import { BottomNav } from './src/components/BottomNav';
import { SearchPanel } from './src/components/SearchPanel';
import { MatchResults } from './src/components/MatchResults';
import { ResultView } from './src/components/ResultView';
import { SettingsView } from './src/components/SettingsView';
import { WatchlistView } from './src/components/WatchlistView';
import { StatePanel } from './src/components/StatePanel';
import { searchTitleCandidates, resolveMatch } from './src/lib/tmdb';
import { loadRecentSearches, saveRecentSearches, loadWatchlist, saveWatchlist } from './src/lib/storage';

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
  const { colors } = theme;

  // View state: 'search' | 'results' | 'detail' | 'watchlist' | 'settings'
  const [activeView, setActiveView] = useState('search');
  // Tab state: 'search' | 'watchlist'
  const [activeTab, setActiveTab] = useState('search');
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [filter, setFilter] = useState(null); // 'movie' | 'tv' | null

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
  }, [query, recentSearches]);

  const handleSelectMatch = useCallback(async (match) => {
    setLoading(true);
    try {
      const fullResult = await resolveMatch(query, match);
      setSelectedResult(fullResult);
      setActiveView('detail');
    } catch (err) {
      Alert.alert('Error', 'Unable to fetch movie details.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleToggleWatchlist = async (result) => {
    const isAdded = watchlist.some(item => item.tmdbId === result.tmdbId);
    let newWatchlist;
    if (isAdded) {
      newWatchlist = watchlist.filter(item => item.tmdbId !== result.tmdbId);
    } else {
      newWatchlist = [result, ...watchlist];
    }
    setWatchlist(newWatchlist);
    await saveWatchlist(newWatchlist);
  };

  const handleBack = () => {
    if (activeView === 'settings') {
      setActiveView(activeTab === 'watchlist' ? 'watchlist' : 'search');
    } else if (activeView === 'detail') {
      setActiveView(activeTab === 'watchlist' ? 'watchlist' : 'results');
    } else if (activeView === 'results') {
      setActiveView('search');
      setQuery(''); // User wants search box in results, but if clicking back maybe clear?
    } else if (activeTab === 'watchlist') {
      setActiveTab('search');
      setActiveView('search');
    }
  };

  const handleTabPress = (tab) => {
    setActiveTab(tab);
    if (tab === 'search') {
      setActiveView('search');
    } else if (tab === 'watchlist') {
      setActiveView('watchlist');
    }
  };

  const filteredResults = useMemo(() => {
    if (!filter) return results;
    return results.filter(item => item.mediaType === filter);
  }, [results, filter]);

  const showBack = activeView === 'results' || activeView === 'detail' || activeView === 'settings';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
      <AppHeader 
        showBack={showBack} 
        onBack={handleBack} 
        onSettingsPress={() => setActiveView('settings')}
      />
      
      <View style={styles.mainContent}>
        {loading && activeView !== 'detail' ? (
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
              />
            )}
            
            {activeView === 'watchlist' && (
              <WatchlistView 
                items={watchlist} 
                onRemove={(id) => handleToggleWatchlist({ tmdbId: id })}
                onSelect={handleSelectMatch}
              />
            )}

            {activeView === 'settings' && (
              <SettingsView />
            )}
          </>
        )}
      </View>

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
});
