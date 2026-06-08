import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { WatchlistView } from '../components/WatchlistView';
import { ResultView } from '../components/ResultView';
import { FilmographyScreen } from '../components/FilmographyScreen';
import { useAppState } from '../context/AppStateContext';
import { useStackScreenOptions } from './useStackScreenOptions';
import { watchlistEntryKey } from '../lib/watchlistModel';

const Stack = createNativeStackNavigator();

function WatchlistMainScreen() {
  const navigation = useNavigation();
  const {
    watchlist,
    userWatchlistCollections,
    handleRemoveWatchlistItem,
    handleMarkWatched,
    handleSelectMatch,
    handleTabPress,
  } = useAppState();

  return (
    <WatchlistView
      items={watchlist}
      collections={userWatchlistCollections}
      onRemove={handleRemoveWatchlistItem}
      onMarkWatched={handleMarkWatched}
      onSelect={(match) => handleSelectMatch(match, navigation)}
      onBrowseMovies={() => handleTabPress('discover')}
      onBrowseTV={() => handleTabPress('discover')}
    />
  );
}

function WatchlistDetailScreen() {
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
      onPersonPress={(personId, personName, role) => handlePersonPress(personId, personName, role, navigation)}
      onCompanyPress={(companyId, companyName, logoUrl) => handleCompanyPress(companyId, companyName, logoUrl, navigation)}
    />
  );
}

function WatchlistFilmographyScreen() {
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

export function WatchlistStack() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Watchlist" component={WatchlistMainScreen} />
      <Stack.Screen name="Detail" component={WatchlistDetailScreen} />
      <Stack.Screen name="Filmography" component={WatchlistFilmographyScreen} />
    </Stack.Navigator>
  );
}
