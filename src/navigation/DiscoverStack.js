import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { DiscoverScreen } from '../components/DiscoverScreen';
import { ResultView } from '../components/ResultView';
import { FilmographyScreen } from '../components/FilmographyScreen';
import { FullCastScreen } from '../components/FullCastScreen';
import {
  useSearch,
  useDiscover,
  useDetail,
  useWatchlist,
  usePeople,
} from '../context/domainContexts';
import { useStackScreenOptions } from './useStackScreenOptions';
import { watchlistEntryKey } from '../lib/watchlistModel';

const Stack = createNativeStackNavigator();

function DiscoverMainScreen() {
  const navigation = useNavigation();
  const { handleSelectDiscoverItem } = useSearch();
  const { discoverVm } = useDiscover();
  const { handleToggleWatchlist, savedWatchlistKeys } = useWatchlist();

  return (
    <DiscoverScreen
      onSelectItem={(item) => handleSelectDiscoverItem(item, navigation)}
      vm={discoverVm}
      onToggleWatchlist={handleToggleWatchlist}
      watchlistIds={savedWatchlistKeys}
    />
  );
}

function DiscoverDetailScreen() {
  const navigation = useNavigation();
  const { selectedResult } = useDetail();
  const {
    handleToggleWatchlist,
    handleEnrichWatchlistItem,
    savedWatchlistKeys,
  } = useWatchlist();
  const { handleSelectMatch } = useSearch();
  const { handlePersonPress, handleCompanyPress, handleCollectionPress } = usePeople();

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
      onCollectionPress={(collection, currentTmdbId) =>
        handleCollectionPress(collection, currentTmdbId, navigation)
      }
      onSeeAllPeople={(params) => navigation.push('FullCast', params)}
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
      <Stack.Screen name="Detail" component={DiscoverDetailScreen} />
      <Stack.Screen name="FullCast" component={DiscoverFullCastScreen} />
      <Stack.Screen name="Filmography" component={DiscoverFilmographyScreen} />
    </Stack.Navigator>
  );
}
