import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { DiscoverScreen } from '../components/DiscoverScreen';
import { FilmographyScreen } from '../components/FilmographyScreen';
import { FullCastScreen } from '../components/FullCastScreen';
import { useSearch, useDiscover, useWatchlist, usePeople } from '../context/domainContexts';
import { topWatchlistLanguages } from '../lib/watchlistModel';
import { useStackScreenOptions } from './useStackScreenOptions';
import { DetailScreenRoute } from './DetailScreenRoute';

const Stack = createNativeStackNavigator();

function DiscoverMainScreen() {
  const navigation = useNavigation();
  const { handleSelectDiscoverItem } = useSearch();
  const { discoverVm } = useDiscover();
  const { handleToggleWatchlist, savedWatchlistKeys, watchlist } = useWatchlist();

  // Personalized Quick Picks: the top languages among the user's Highly
  // Recommend titles. Memoized on the list so Discover only re-derives when the
  // library actually changes.
  const recommendedLanguageCodes = useMemo(
    () => topWatchlistLanguages(watchlist),
    [watchlist],
  );

  return (
    <DiscoverScreen
      onSelectItem={(item) => handleSelectDiscoverItem(item, navigation)}
      vm={discoverVm}
      onToggleWatchlist={handleToggleWatchlist}
      watchlistIds={savedWatchlistKeys}
      recommendedLanguageCodes={recommendedLanguageCodes}
    />
  );
}

function DiscoverFullCastScreen({ route }) {
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

function DiscoverFilmographyScreen() {
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

export function DiscoverStack() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Discover" component={DiscoverMainScreen} />
      <Stack.Screen name="Detail" component={DetailScreenRoute} />
      <Stack.Screen name="FullCast" component={DiscoverFullCastScreen} />
      <Stack.Screen name="Filmography" component={DiscoverFilmographyScreen} />
    </Stack.Navigator>
  );
}
