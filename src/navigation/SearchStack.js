import React, { useCallback, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchPanel } from '../components/SearchPanel';
import { SearchField } from '../components/SearchField';
import { MatchResults, SearchResultsLoading } from '../components/MatchResults';
import { EmptyState } from '../components/EmptyState';
import { FilmographyScreen } from '../components/FilmographyScreen';
import { FullCastScreen } from '../components/FullCastScreen';
import { RailListScreen } from '../components/RailListScreen';
import { useSearch, useDetail, useWatchlist, useNav, usePeople } from '../context/domainContexts';
import { useStackScreenOptions } from './useStackScreenOptions';
import { DetailScreenRoute } from './DetailScreenRoute';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { useTheme } from '../theme/ThemeProvider';
import { scale } from '../utils/responsive';
import { GRID_PAD, SCROLL_BOTTOM_PAD } from '../theme/programme';

const Stack = createNativeStackNavigator();

function SearchMainScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { colors } = theme;
  const bottomNavScroll = useBottomNavScroll();
  const {
    query,
    handleQueryChange,
    handleSearch,
    results,
    searchPhase,
    searchError,
    submittedQuery,
    typeResults,
    typeLoading,
    handleTypeSelect,
    handleSelectMatch,
    clearSearch,
    loading,
    searchFocusSignal,
  } = useSearch();
  const { recentViewed, removeRecentViewed, clearRecentViewed } = useDetail();
  const { handleToggleWatchlist, savedWatchlistKeys } = useWatchlist();
  const { handleTabPress } = useNav();
  const searchInputRef = useRef(null);

  const atmosphereColors = [colors.surfaceContainerHigh, colors.background];
  const showLoadingState = searchPhase === 'loading';
  const showResults = searchPhase === 'results' && results.length > 0;
  const showEmptyState = searchPhase === 'empty';
  const showErrorState = searchPhase === 'error';
  const focusSearchInput = useCallback(() => searchInputRef.current?.focus(), []);

  // Re-pressing the Search tab while already on this screen is the "I came here
  // to type" gesture. Arriving from another tab deliberately does not focus:
  // the idle rails are the point of the landing state.
  useEffect(() => {
    if (!searchFocusSignal) return;
    focusSearchInput();
  }, [searchFocusSignal, focusSearchInput]);

  // Clearing is a prelude to typing again, never an exit — so the ✕ hands the
  // field straight back rather than dropping the user on a dead idle screen.
  const handleClear = useCallback(() => {
    clearSearch();
    focusSearchInput();
  }, [clearSearch, focusSearchInput]);

  return (
    <View style={[searchStyles.root, { backgroundColor: colors.background }]}>
      {/*
        Docked. The field used to be the first item of the scroll content, so
        refining a query — the commonest thing anyone does after searching —
        cost a scroll back past the results grid, three rails and a header.
        The gradient resolves to the page background at the dock's lower edge,
        so content scrolling under it has nothing to seam against.
      */}
      <View style={[searchStyles.dock, { paddingTop: insets.top + scale(8) }]}>
        <LinearGradient
          colors={atmosphereColors}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <SearchField
          ref={searchInputRef}
          value={query}
          onChangeText={handleQueryChange}
          onSubmit={() => handleSearch(query, navigation)}
          onClear={handleClear}
          busy={Boolean(loading || typeLoading)}
          busyLabel={loading ? `Searching for ${submittedQuery}` : 'Searching'}
        />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={[
          searchStyles.scrollContent,
          {
            paddingBottom: insets.bottom + SCROLL_BOTTOM_PAD,
          },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        overScrollMode="never"
        {...bottomNavScroll}
      >
        <SearchPanel
          value={query}
          recentViewed={recentViewed}
          onPickRecentViewed={(match) => handleSelectMatch(match, navigation)}
          onRemoveRecentViewed={removeRecentViewed}
          onClearRecentViewed={clearRecentViewed}
          hideHistory={searchPhase !== 'idle'}
          typeResults={typeResults}
          typeLoading={typeLoading}
          onTypeSelect={(match) => handleTypeSelect(match, navigation)}
          submittedQuery={submittedQuery}
          onToggleWatchlist={handleToggleWatchlist}
          savedWatchlistKeys={savedWatchlistKeys}
          onSeeAllRail={(params) => navigation.navigate('RailList', params)}
        />
        {showLoadingState && <SearchResultsLoading query={submittedQuery} />}
        {showResults && (
          <MatchResults
            matches={results}
            onSelect={(match) => handleSelectMatch(match, navigation)}
            onToggleWatchlist={handleToggleWatchlist}
            watchlistIds={savedWatchlistKeys}
          />
        )}
        {showEmptyState && (
          <EmptyState
            variant="empty"
            title="No matches found"
            description={`We couldn't find anything for “${submittedQuery}”. Try a shorter title or edit your search.`}
            primaryAction={{
              label: 'Edit Search',
              icon: 'create-outline',
              onPress: focusSearchInput,
              accessibilityLabel: `Edit search for ${submittedQuery}`,
            }}
            secondaryAction={{
              label: 'Discover',
              onPress: () => handleTabPress('discover'),
              accessibilityLabel: 'Go to Discover',
            }}
            compact
          />
        )}
        {showErrorState && (
          <EmptyState
            variant={
              searchError?.severity === 'offline'
                ? 'offline'
                : searchError?.severity === 'service'
                  ? 'service'
                  : 'error'
            }
            title={searchError?.title || 'Unable to search right now'}
            description={searchError?.message || 'Please try your search again.'}
            primaryAction={{
              label: 'Try Again',
              icon: 'refresh-outline',
              onPress: () => handleSearch(submittedQuery, navigation),
              accessibilityLabel: `Retry search for ${submittedQuery}`,
            }}
            secondaryAction={{
              label: 'Edit Search',
              onPress: focusSearchInput,
              accessibilityLabel: `Edit search for ${submittedQuery}`,
            }}
            compact
          />
        )}
      </ScrollView>
    </View>
  );
}

function SearchFullCastScreen({ route }) {
  const navigation = useNavigation();
  const { handlePersonPress } = usePeople();
  const { title, cast, crew } = route.params || {};

  return (
    <FullCastScreen
      title={title}
      cast={cast}
      crew={crew}
      onPersonPress={(personId, personName, role) =>
        handlePersonPress(personId, personName, role, navigation)
      }
    />
  );
}

function SearchRailListScreen({ route }) {
  const navigation = useNavigation();
  const { handleSelectMatch } = useSearch();
  const { handleToggleWatchlist, savedWatchlistKeys } = useWatchlist();
  const { railId, title } = route.params || {};

  if (!railId) return null;

  return (
    <RailListScreen
      railId={railId}
      title={title}
      eyebrow={railId === 'now-playing' ? 'In Cinemas' : 'Trending'}
      onSelectItem={(item) => handleSelectMatch(item, navigation)}
      onToggleWatchlist={handleToggleWatchlist}
      savedKeys={savedWatchlistKeys}
    />
  );
}

function SearchFilmographyScreen() {
  const navigation = useNavigation();
  const { filmographyPerson, filmographyResults, filmographyLoading, handleSelectFilmographyItem } =
    usePeople();

  if (!filmographyPerson) return null;

  return (
    <FilmographyScreen
      personName={filmographyPerson.name}
      role={filmographyPerson.role}
      profileUrl={filmographyPerson.profileUrl}
      total={filmographyPerson.total}
      currentTmdbId={filmographyPerson.currentTmdbId}
      results={filmographyResults}
      onSelectItem={(item) => handleSelectFilmographyItem(item, navigation)}
      loading={filmographyLoading}
    />
  );
}

export function SearchStack() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Search" component={SearchMainScreen} />
      <Stack.Screen name="Detail" component={DetailScreenRoute} />
      <Stack.Screen name="FullCast" component={SearchFullCastScreen} />
      <Stack.Screen name="RailList" component={SearchRailListScreen} />
      <Stack.Screen name="Filmography" component={SearchFilmographyScreen} />
    </Stack.Navigator>
  );
}

const searchStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dock: {
    paddingBottom: scale(8),
    paddingHorizontal: GRID_PAD,
    zIndex: 2,
  },
  scrollContent: {
    paddingTop: scale(4),
  },
});
