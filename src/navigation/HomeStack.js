import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { HomeScreen } from '../components/HomeScreen';
import { CollectionsScreen } from '../components/CollectionsScreen';
import { ResultView } from '../components/ResultView';
import { FilmographyScreen } from '../components/FilmographyScreen';
import { useAppState } from '../context/AppStateContext';
import { useTheme } from '../theme/ThemeProvider';
import { useStackScreenOptions } from './useStackScreenOptions';
import { watchlistEntryKey } from '../lib/watchlistModel';
const Stack = createNativeStackNavigator();

function HomeScreenRoute() {
  const navigation = useNavigation();
  const {
    watchlist,
    handleSelectDiscoverItem,
    handleToggleWatchlist,
    homeMediaFilter,
    setHomeMediaFilter,
    openCollections,
  } = useAppState();

  return (
    <HomeScreen
      watchlist={watchlist}
      onSelectItem={(item) => handleSelectDiscoverItem(item, navigation)}
      onToggleWatchlist={handleToggleWatchlist}
      mediaFilter={homeMediaFilter}
      onMediaFilterChange={setHomeMediaFilter}
      onOpenCollections={openCollections}
    />
  );
}

function CollectionsScreenRoute() {
  const navigation = useNavigation();
  const {
    handleSelectDiscoverItem,
    handleToggleWatchlist,
    savedWatchlistKeys,
    collectionsSubView,
    setCollectionsSubView,
    collectionsImdbTab,
    setCollectionsImdbTab,
    openHomeFromCollections,
  } = useAppState();

  return (
    <CollectionsScreen
      onSelectItem={(item) => handleSelectDiscoverItem(item, navigation)}
      onToggleWatchlist={handleToggleWatchlist}
      watchlistIds={savedWatchlistKeys}
      subView={collectionsSubView}
      onSubViewChange={setCollectionsSubView}
      imdbMediaTab={collectionsImdbTab}
      onImdbMediaTabChange={setCollectionsImdbTab}
      onOpenHomeFilter={openHomeFromCollections}
    />
  );
}

function DetailScreenRoute() {
  const navigation = useNavigation();
  const {
    selectedResult,
    handleToggleWatchlist,
    savedWatchlistKeys,
    handleSelectMatch,
    handlePersonPress,
    handleCompanyPress,
  } = useAppState();

  return (
    <ResultView
      result={selectedResult}
      onBack={() => navigation.goBack()}
      onToggleWatchlist={handleToggleWatchlist}
      isInWatchlist={savedWatchlistKeys.includes(watchlistEntryKey(selectedResult))}
      onSelectSimilar={(match) => handleSelectMatch(match, navigation)}
      onPersonPress={(personId, personName, role) => handlePersonPress(personId, personName, role, navigation)}
      onCompanyPress={(companyId, companyName, logoUrl) => handleCompanyPress(companyId, companyName, logoUrl, navigation)}
    />
  );
}

function FilmographyScreenRoute() {
  const navigation = useNavigation();
  const {
    filmographyPerson,
    filmographyResults,
    filmographyLoading,
    handleSelectFilmographyItem,
  } = useAppState();

  if (!filmographyPerson) return null;

  return (
    <FilmographyScreen
      personName={filmographyPerson.name}
      role={filmographyPerson.role}
      profileUrl={filmographyPerson.profileUrl}
      results={filmographyResults}
      onSelectItem={(item) => handleSelectFilmographyItem(item, navigation)}
      loading={filmographyLoading}
    />
  );
}

export function HomeStack() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Home" component={HomeScreenRoute} />
      <Stack.Screen name="Collections" component={CollectionsScreenRoute} />
      <Stack.Screen name="Detail" component={DetailScreenRoute} />
      <Stack.Screen name="Filmography" component={FilmographyScreenRoute} />
    </Stack.Navigator>
  );
}
