import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { HomeScreen } from '../components/HomeScreen';
import { CollectionsScreen } from '../components/CollectionsScreen';
import { ResultView } from '../components/ResultView';
import { FilmographyScreen } from '../components/FilmographyScreen';
import {
  useSearch,
  useDetail,
  useWatchlist,
  usePeople,
  useNav,
} from '../context/domainContexts';
import { useTheme } from '../theme/ThemeProvider';
import { useStackScreenOptions } from './useStackScreenOptions';
import { watchlistEntryKey } from '../lib/watchlistModel';
const Stack = createNativeStackNavigator();

function HomeScreenRoute() {
  const navigation = useNavigation();
  const { watchlist, handleToggleWatchlist } = useWatchlist();
  const { handleSelectDiscoverItem } = useSearch();
  const { homeMediaFilter, setHomeMediaFilter, openCollections } = useNav();

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
  const { handleSelectDiscoverItem } = useSearch();
  const { handleToggleWatchlist, savedWatchlistKeys } = useWatchlist();
  const {
    collectionsSubView,
    setCollectionsSubView,
    collectionsImdbTab,
    setCollectionsImdbTab,
    openHomeFromCollections,
  } = useNav();

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
  const { selectedResult } = useDetail();
  const {
    handleToggleWatchlist,
    handleEnrichWatchlistItem,
    savedWatchlistKeys,
  } = useWatchlist();
  const { handleSelectMatch } = useSearch();
  const { handlePersonPress, handleCompanyPress } = usePeople();

  return (
    <ResultView
      result={selectedResult}
      onBack={() => navigation.goBack()}
      onToggleWatchlist={handleToggleWatchlist}
      onEnrichWatchlistItem={handleEnrichWatchlistItem}
      isInWatchlist={savedWatchlistKeys.includes(watchlistEntryKey(selectedResult))}
      onSelectSimilar={(match) => handleSelectMatch(match, navigation)}
      onPersonPress={(personId, personName, role) =>
        handlePersonPress(personId, personName, role, navigation)
      }
      onCompanyPress={(companyId, companyName, logoUrl) =>
        handleCompanyPress(companyId, companyName, logoUrl, navigation)
      }
    />
  );
}

function FilmographyScreenRoute() {
  const navigation = useNavigation();
  const { filmographyPerson, filmographyResults, filmographyLoading, handleSelectFilmographyItem } =
    usePeople();

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
