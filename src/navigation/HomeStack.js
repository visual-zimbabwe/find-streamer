import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { HomeScreen } from '../components/HomeScreen';
import { CollectionsScreen } from '../components/CollectionsScreen';
import { FilmographyScreen } from '../components/FilmographyScreen';
import { FullCastScreen } from '../components/FullCastScreen';
import {
  useSearch,
  useWatchlist,
  usePeople,
  useNav,
} from '../context/domainContexts';
import { useStackScreenOptions } from './useStackScreenOptions';
import { DetailScreenRoute } from './DetailScreenRoute';
const Stack = createNativeStackNavigator();

function HomeScreenRoute() {
  const navigation = useNavigation();
  const { watchlist, userWatchlistCollections, handleToggleWatchlist } = useWatchlist();
  const { handleSelectDiscoverItem } = useSearch();
  const { homeMediaFilter, setHomeMediaFilter, openCollections, homeSpotlightItems } = useNav();

  return (
    <HomeScreen
      watchlist={watchlist}
      collections={userWatchlistCollections}
      spotlight={homeSpotlightItems}
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

function FullCastScreenRoute({ route }) {
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
      total={filmographyPerson.total}
      currentTmdbId={filmographyPerson.currentTmdbId}
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
      <Stack.Screen name="FullCast" component={FullCastScreenRoute} />
      <Stack.Screen name="Filmography" component={FilmographyScreenRoute} />
    </Stack.Navigator>
  );
}
