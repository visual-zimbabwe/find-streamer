import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsView } from '../components/SettingsView';
import { useAppState } from '../context/AppStateContext';
import { useStackScreenOptions } from './useStackScreenOptions';

const Stack = createNativeStackNavigator();

function SettingsMainScreen() {
  const { watchlist, watchlistCollections, persistWatchlistChange, persistCollectionsChange } =
    useAppState();

  return (
    <SettingsView
      watchlist={watchlist}
      collections={watchlistCollections}
      persistWatchlistChange={persistWatchlistChange}
      persistCollectionsChange={persistCollectionsChange}
    />
  );
}

export function SettingsStack() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Settings" component={SettingsMainScreen} />
    </Stack.Navigator>
  );
}
