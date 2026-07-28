import React, { useRef } from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchPanel } from '../components/SearchPanel';
import { MatchResults, SearchResultsLoading } from '../components/MatchResults';
import { EmptyState } from '../components/EmptyState';
import { FilmographyScreen } from '../components/FilmographyScreen';
import { FullCastScreen } from '../components/FullCastScreen';
import { useSearch, useDetail, useWatchlist, useNav, usePeople } from '../context/domainContexts';
import { useStackScreenOptions } from './useStackScreenOptions';
import { DetailScreenRoute } from './DetailScreenRoute';
import { useBottomNavScroll } from '../context/BottomNavVisibilityContext';
import { useTheme } from '../theme/ThemeProvider';
import { scale, verticalScale } from '../utils/responsive';
import { SCROLL_BOTTOM_PAD } from '../theme/programme';

const Stack = createNativeStackNavigator();

function SearchMainScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme, resolvedMode } = useTheme();
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
    toggleVoiceSearch,
    voiceListening,
    handleSelectMatch,
    clearSearch,
    loading,
  } = useSearch();
  const { recentViewed, removeRecentViewed, clearRecentViewed } = useDetail();
  const { handleToggleWatchlist, savedWatchlistKeys } = useWatchlist();
  const { handleTabPress } = useNav();
  const searchInputRef = useRef(null);

  const atmosphereColors = [
    resolvedMode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerLow,
    colors.background,
  ];
  const showLoadingState = searchPhase === 'loading';
  const showResults = searchPhase === 'results' && results.length > 0;
  const showEmptyState = searchPhase === 'empty';
  const showErrorState = searchPhase === 'error';
  const focusSearchInput = () => searchInputRef.current?.focus();

  return (
    <View style={[searchStyles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={atmosphereColors}
        style={searchStyles.atmosphereTop}
        pointerEvents="none"
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          searchStyles.scrollContent,
          {
            paddingTop: insets.top + scale(8),
            paddingBottom: insets.bottom + SCROLL_BOTTOM_PAD,
          },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        overScrollMode="never"
        {...bottomNavScroll}
      >
        <SearchPanel
          ref={searchInputRef}
          value={query}
          onChangeText={handleQueryChange}
          onSubmit={() => handleSearch(query, navigation)}
          loading={loading}
          recentViewed={recentViewed}
          onPickRecentViewed={(match) => handleSelectMatch(match, navigation)}
          onRemoveRecentViewed={removeRecentViewed}
          onClearRecentViewed={clearRecentViewed}
          hideHistory={searchPhase !== 'idle'}
          typeResults={typeResults}
          typeLoading={typeLoading}
          onTypeSelect={(match) => handleTypeSelect(match, navigation)}
          onClear={clearSearch}
          submittedQuery={submittedQuery}
          onVoicePress={toggleVoiceSearch}
          voiceListening={voiceListening}
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
      <Stack.Screen name="Filmography" component={SearchFilmographyScreen} />
    </Stack.Navigator>
  );
}

const searchStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  atmosphereTop: {
    height: verticalScale(280),
    left: 0,
    opacity: 0.55,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  scrollContent: {
    paddingTop: scale(4),
  },
});
