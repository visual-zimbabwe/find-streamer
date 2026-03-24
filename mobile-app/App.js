import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Alert, Keyboard } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, ThemeProvider } from './src/theme/ThemeProvider';
import { AppHeader } from './src/components/AppHeader';
import { BottomNav } from './src/components/BottomNav';
import { SearchPanel } from './src/components/SearchPanel';
import { MatchResults } from './src/components/MatchResults';
import { ResultView } from './src/components/ResultView';
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

  // View state: 'search' | 'results' | 'detail' | 'watchlist'
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

  const handleBack = () => {
    if (activeView === 'detail') {
      setActiveView('results');
    } else if (activeView === 'results') {
      setActiveView('search');
    } else if (activeTab === 'watchlist') {
      setActiveTab('search');
      setActiveView('search');
    }
  };

  const handleTabPress = (tab) => {
    setActiveTab(tab);
    if (tab === 'search') {
      // If we were on detail or results, stay there unless explicitly resetting?
      // For now, let's reset to search if they re-click search tab when already in search results?
      // Actually, standard behavior: click tab = reset to its root view.
      setActiveView('search');
    } else if (tab === 'watchlist') {
      setActiveView('watchlist');
    }
  };

  const isDetail = activeView === 'detail';
  const showBack = activeView === 'results' || activeView === 'detail';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
      <AppHeader showBack={showBack} onBack={handleBack} />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {loading && activeView !== 'detail' ? (
          <StatePanel type="loading" title="Searching..." description="Please wait while we find your movie." />
        ) : error ? (
          <StatePanel type="error" title="Search Error" description={error} onRetry={() => handleSearch(query)} />
        ) : (
          <>
            {activeView === 'search' && (
              <SearchPanel 
                value={query} 
                onChangeText={setQuery} 
                onSubmit={() => handleSearch()} 
                loading={loading}
                recentSearches={recentSearches}
                onPickSuggestion={handleSearch}
              />
            )}
            
            {activeView === 'results' && (
              <MatchResults 
                matches={results} 
                onSelect={handleSelectMatch} 
              />
            )}
            
            {activeView === 'detail' && (
              <ResultView 
                result={selectedResult} 
                onBack={handleBack} 
              />
            )}
            
            {activeView === 'watchlist' && (
              <StatePanel 
                type="empty" 
                title="Your Watchlist" 
                description="This feature is coming soon! You'll be able to save your favorite movies here."
              />
            )}
          </>
        )}
      </ScrollView>

      <BottomNav activeTab={activeTab} onTabPress={handleTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Account for BottomNav
  },
});
