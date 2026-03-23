import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, LayoutAnimation, Platform, ScrollView, UIManager, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from './src/components/AppHeader';
import { MatchResults } from './src/components/MatchResults';
import { ResultView } from './src/components/ResultView';
import { SearchPanel } from './src/components/SearchPanel';
import { LoadingSkeleton, StatePanel } from './src/components/StatePanel';
import { BottomNav } from './src/components/BottomNav';
import { loadRecentSearches, saveRecentSearches } from './src/lib/storage';
import { resolveMatch, searchTitleCandidates } from './src/lib/tmdb';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

const SUGGESTED_TITLES = ['Sci-Fi Epics', 'Award Winners', 'Trending Now', 'Dune', 'Inception'];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const { theme, resolvedMode, ready } = useTheme();
  const { colors, spacing } = theme;
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [matches, setMatches] = useState([]);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [screenState, setScreenState] = useState('idle');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    loadRecentSearches().then(setRecentSearches).catch(() => setRecentSearches([]));
  }, []);

  const suggestions = useMemo(
    () => SUGGESTED_TITLES.filter((title) => !recentSearches.includes(title)).slice(0, 4),
    [recentSearches]
  );

  async function commitRecentSearch(nextQuery) {
    const nextItems = [nextQuery, ...recentSearches.filter((item) => item !== nextQuery)].slice(0, 6);
    setRecentSearches(nextItems);
    await saveRecentSearches(nextItems);
  }

  function animateLayout() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }

  async function handleSearch(nextValue = query) {
    const nextQuery = nextValue.trim();
    if (!nextQuery) {
      setFieldError('Enter a movie or TV title to start.');
      return;
    }

    animateLayout();
    setFieldError('');
    setStatus('Searching...');
    setScreenState('searching');
    setMatches([]);
    setResult(null);
    setSelectedId(null);

    try {
      const candidateMatches = await searchTitleCandidates(nextQuery);
      await commitRecentSearch(nextQuery);
      setQuery(nextQuery);
      setMatches(candidateMatches);
      setScreenState('matches');
    } catch (error) {
      const isNoResults = error?.code === 'NO_RESULTS' || String(error?.message || '').includes('No movie or TV results found');
      setScreenState(isNoResults ? 'no-results' : 'error');
      setStatus(isNoResults ? '' : error?.message || 'Something went wrong.');
      setMatches([]);
    }
  }

  async function handleSelectMatch(match) {
    animateLayout();
    setSelectedId(match.tmdbId);
    setScreenState('resolving');

    try {
      const nextResult = await resolveMatch(query, match);
      setResult(nextResult);
      setScreenState('result');
    } catch (error) {
      setScreenState('error');
      setStatus(error?.message || 'Could not load availability.');
    } finally {
      setSelectedId(null);
    }
  }

  function handleBack() {
    animateLayout();
    if (screenState === 'result') {
      setScreenState('matches');
    } else {
      setScreenState('idle');
      setQuery('');
      setMatches([]);
      setResult(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <AppHeader onBack={handleBack} showBack={screenState !== 'idle'} />
        
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: 100,
            backgroundColor: colors.background,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {screenState !== 'result' && (
            <SearchPanel
              value={query}
              onChangeText={setQuery}
              onSubmit={() => handleSearch(query)}
              loading={screenState === 'searching'}
              suggestions={screenState === 'idle' ? suggestions : null}
              onPickSuggestion={(value) => {
                setQuery(value);
                handleSearch(value);
              }}
            />
          )}

          {screenState === 'idle' && (
            <StatePanel
              variant="empty"
              title="Find your next favorite movie or show."
              message="Just type a title to start exploring. We treat every film as a piece of art."
            />
          )}

          {screenState === 'searching' || screenState === 'resolving' ? (
            <LoadingSkeleton />
          ) : null}

          {screenState === 'matches' && (
            <MatchResults matches={matches} onSelect={handleSelectMatch} selectedId={selectedId} />
          )}

          {screenState === 'result' && result && (
            <ResultView result={result} onBack={handleBack} />
          )}

          {screenState === 'no-results' && (
            <StatePanel
              variant="no-results"
              title="No matching title found"
              message={`We couldn’t find a result for “${query}”.`}
            />
          )}

          {screenState === 'error' && (
            <StatePanel
              variant="error"
              title="Something went wrong"
              message={status}
            />
          )}
        </ScrollView>
        
        <BottomNav />
      </View>
    </SafeAreaView>
  );
}
