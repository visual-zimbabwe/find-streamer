import React from 'react';
import { View, ScrollView, Modal, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchPanel } from '../components/SearchPanel';
import { MatchResults } from '../components/MatchResults';
import { EmptyState } from '../components/EmptyState';
import { ResultView } from '../components/ResultView';
import { FilmographyScreen } from '../components/FilmographyScreen';
import { useAppState } from '../context/AppStateContext';
import { useStackScreenOptions } from './useStackScreenOptions';
import { watchlistEntryKey } from '../lib/watchlistModel';

const Stack = createNativeStackNavigator();

function SearchMainScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    query,
    handleQueryChange,
    handleSearch,
    loading,
    recentSearches,
    recentViewed,
    results,
    filteredResults,
    filter,
    setFilter,
    typeResults,
    typeLoading,
    handleTypeSelect,
    toggleVoiceSearch,
    voiceListening,
    handleSelectMatch,
    handleToggleWatchlist,
    savedWatchlistKeys,
    surpriseLoading,
    setSurprisePickerVisible,
    handleTabPress,
    clearSearchResults,
  } = useAppState();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={searchStyles.scrollContent}>
        <SearchPanel
          value={query}
          onChangeText={handleQueryChange}
          onSubmit={() => handleSearch(query, navigation)}
          loading={loading}
          recentSearches={recentSearches}
          recentViewed={recentViewed}
          onPickSuggestion={(suggestion) => handleSearch(suggestion, navigation)}
          onPickRecentViewed={(match) => handleSelectMatch(match, navigation)}
          hideHistory={results.length > 0}
          typeResults={typeResults}
          typeLoading={typeLoading}
          onTypeSelect={(match) => handleTypeSelect(match, navigation)}
          onVoicePress={toggleVoiceSearch}
          voiceListening={voiceListening}
        />
        {results.length > 0 && (
          <>
            <MatchResults
              matches={filteredResults}
              onSelect={(match) => handleSelectMatch(match, navigation)}
              onToggleWatchlist={handleToggleWatchlist}
              watchlistIds={savedWatchlistKeys}
            />
            {filteredResults.length === 0 && (
              <EmptyState
                variant="empty"
                title="No matches found"
                description={filter
                  ? `We couldn't find any ${filter === 'movie' ? 'movies' : 'TV shows'} for "${query}".`
                  : `We couldn't find any matches for "${query}".`}
                primaryAction={filter ? {
                  label: 'Clear Filters',
                  icon: 'close-circle-outline',
                  onPress: () => setFilter(null),
                  accessibilityLabel: 'Clear result filters',
                          } : {
                            label: 'Check Spelling',
                            icon: 'create-outline',
                            onPress: clearSearchResults,
                            accessibilityLabel: 'Edit search text',
                          }}
                secondaryAction={{
                  label: 'Discover',
                  onPress: () => handleTabPress('discover'),
                  accessibilityLabel: 'Go to Discover',
                }}
                compact
              />
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[searchStyles.surpriseFab, { bottom: insets.bottom + 88 }]}
        onPress={() => setSurprisePickerVisible(true)}
        disabled={surpriseLoading}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Surprise Me – pick a random movie or show"
        accessibilityState={{ busy: Boolean(surpriseLoading) }}
      >
        <LinearGradient
          colors={['#ff7a59', '#ffcf33', '#20d6b5']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={searchStyles.surpriseFabGradient}
        >
          {surpriseLoading
            ? <ActivityIndicator color="#111" size="small" />
            : <Ionicons name="sparkles" size={22} color="#111" />
          }
          <Text style={searchStyles.surpriseFabLabel}>
            {surpriseLoading ? 'Shuffling…' : 'Surprise'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function SearchDetailScreen() {
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

function SearchFilmographyScreen() {
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

export function SearchStack() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Search" component={SearchMainScreen} />
      <Stack.Screen name="Detail" component={SearchDetailScreen} />
      <Stack.Screen name="Filmography" component={SearchFilmographyScreen} />
    </Stack.Navigator>
  );
}

const searchStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 180,
  },
  surpriseFab: {
    position: 'absolute',
    right: 20,
    shadowColor: '#ffb23f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 8,
    borderRadius: 28,
  },
  surpriseFabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 7,
  },
  surpriseFabLabel: {
    color: '#111',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: -0.2,
  },
});
