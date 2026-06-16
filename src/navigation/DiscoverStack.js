import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { DiscoverScreen } from '../components/DiscoverScreen';
import { ResultView } from '../components/ResultView';
import { FilmographyScreen } from '../components/FilmographyScreen';
import { useAppState } from '../context/AppStateContext';
import { useStackScreenOptions } from './useStackScreenOptions';
import { watchlistEntryKey } from '../lib/watchlistModel';

const Stack = createNativeStackNavigator();

function DiscoverMainScreen() {
  const navigation = useNavigation();
  const { handleSelectDiscoverItem, discoverVm, handleToggleWatchlist, savedWatchlistKeys } =
    useAppState();

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
  const {
    selectedResult,
    handleToggleWatchlist,
    handleEnrichWatchlistItem,
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

function DiscoverFilmographyScreen() {
  const navigation = useNavigation();
  const { filmographyPerson, filmographyResults, filmographyLoading, handleSelectFilmographyItem } =
    useAppState();

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

export function DiscoverStack() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Discover" component={DiscoverMainScreen} />
      <Stack.Screen name="Detail" component={DiscoverDetailScreen} />
      <Stack.Screen name="Filmography" component={DiscoverFilmographyScreen} />
    </Stack.Navigator>
  );
}
